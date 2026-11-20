/**
 * لوحة التحكم — المرحلة م١-ب: إعدادات الفلوس + بحث الشحنة الضايعة.
 *
 * المسارات (كلها ورا فاحص x-migo-admin المشترك):
 *   GET  /control/bot-money-settings   → تمرير لنقطة البوت
 *   POST /control/bot-money-settings   → تمرير لنقطة البوت
 *   GET  /control/bot-lost-topups      → تمرير لنقطة البوت
 *   POST /control/bot-topup-match      → تمرير لنقطة البوت
 *   GET  /control/store-money-settings
 *   POST /control/store-money-settings {key, value, reason?}
 *   GET  /control/lost-events?q=&amount=&days=30
 *
 * قواعد التنفيذ:
 * - إعدادات البوت وأفعال مطابقة شحنات البوت تمرير خادمي بس لنقاط
 *   البوت الداخلية — مفيش منطق فلوس بوت هنا.
 * - إعدادات المتجر بتتكتب في wallet_settings نفسها (نفس الجدول اللي
 *   دوال القاعدة بتقراه)، والتحقق لكل مفتاح بيحصل قبل أي كتابة.
 *   الكتابة لازم تمس صفًا واحدًا بالظبط؛ غير كده فشل بصوت عالي.
 * - بعد نجاح كتابة إعداد متجر، بيتبعت صف تدقيق لسجل التدقيق الموحد
 *   عند البوت. فشل التدقيق ما بيخفيش نجاح الكتابة: بيظهر في الرد
 *   كـ audit_failed: true.
 * - بحث أحداث المتجر قراءة فقط من مصادرها الأصلية الأربعة، بحد
 *   50 صف لكل مصدر — مفيش أي كتابة أو ربط من نقطة البحث دي.
 */

import {
  type BotControlProxyClient,
  type BotProxyResult,
} from "./customers.ts";

// ------------------------------------------------------------- البيانات
export interface MoneySettingRow {
  key: string;
  value: string | null;
  note?: string | null;
  updated_at?: string | null;
}

export interface LostEventsQuery {
  q: string;
  amount: number | null;
  days: number;
  since: string;
}

export type LostEventRow = Record<string, unknown>;

export interface ControlMoneyClient {
  fetchSettings(): Promise<MoneySettingRow[]>;
  getSetting(key: string): Promise<MoneySettingRow | null>;
  updateSetting(key: string, value: string): Promise<number>;
  fetchDepositEvents(query: LostEventsQuery): Promise<LostEventRow[]>;
  fetchSmsEvents(query: LostEventsQuery): Promise<LostEventRow[]>;
  fetchDepositClaims(query: LostEventsQuery): Promise<LostEventRow[]>;
  fetchTopupIntents(query: LostEventsQuery): Promise<LostEventRow[]>;
}

export interface ControlMoneyDeps {
  client: ControlMoneyClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
}

export const STORE_MONEY_SETTING_KEYS = [
  "usdt_egp_rate",
  "sms_autocredit_cap_egp",
  "sms_trusted_cap_egp",
  "sms_trusted_daily_max",
  "sms_trusted_min_confirmed",
  "intent_expiry_minutes",
  "deposit_address_binance",
  "deposit_address_bybit",
  "wallet_app_package",
] as const;

const STORE_KEY_SET = new Set<string>(STORE_MONEY_SETTING_KEYS);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PACKAGE_RE =
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const INTENT_STATUSES = ["open", "credited", "expired", "cancelled"];
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ------------------------------------------------- تحقق إعدادات المتجر
type Validation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * عشري صارم بحد أقصى منزلتين: رقم JSON أو نص رقمي نظيف بس.
 * بيمنع التحويل الضمني ("" و true و null) والكسور الأعمق من قرشين
 * — نفس درس إصلاح م١-أ، لأن القيم دي بتتحكم في مطابقة فلوس حقيقية.
 */
function parseDecimal(
  v: unknown,
  maxDecimals: number,
): number | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const scale = 10 ** maxDecimals;
    if (Math.abs(v * scale - Math.round(v * scale)) > 1e-9) return null;
    return v;
  }
  if (typeof v === "string") {
    const s = v.trim();
    const re = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
    if (!re.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseInteger(v: unknown): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) && Number.isInteger(v) ? v : null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

function canonicalDecimal(n: number): string {
  // بلا أصفار زائدة وبلا صيغة علمية للقيم الصغيرة/الكبيرة في النطاقات
  // المسموحة هنا (أكبر قيمة 100000 وأصغر كسر قرشين/مليون حسب النداء).
  return String(n);
}

function validateStoreSetting(key: string, value: unknown): Validation {
  switch (key) {
    case "usdt_egp_rate": {
      const n = parseDecimal(value, 2);
      if (n === null || n <= 0 || n > 1000) {
        return { ok: false, error: "bad_rate" };
      }
      return { ok: true, value: canonicalDecimal(n) };
    }
    case "sms_autocredit_cap_egp":
    case "sms_trusted_cap_egp": {
      const n = parseDecimal(value, 2);
      if (n === null || n < 0 || n > 100000) {
        return { ok: false, error: "bad_cap" };
      }
      return { ok: true, value: canonicalDecimal(n) };
    }
    case "sms_trusted_daily_max":
    case "sms_trusted_min_confirmed": {
      const n = parseInteger(value);
      if (n === null || n < 1 || n > 100) {
        return { ok: false, error: "bad_integer" };
      }
      return { ok: true, value: String(n) };
    }
    case "intent_expiry_minutes": {
      const n = parseInteger(value);
      if (n === null || n < 1 || n > 10080) {
        return { ok: false, error: "bad_integer" };
      }
      return { ok: true, value: String(n) };
    }
    case "deposit_address_binance":
    case "deposit_address_bybit": {
      if (typeof value !== "string") {
        return { ok: false, error: "bad_address" };
      }
      const s = value.trim();
      if (!ADDRESS_RE.test(s)) return { ok: false, error: "bad_address" };
      return { ok: true, value: s };
    }
    case "wallet_app_package": {
      if (typeof value !== "string") {
        return { ok: false, error: "bad_package_list" };
      }
      const parts = value.split(",").map((p) => p.trim());
      if (
        parts.length < 1 || parts.length > 10 ||
        parts.some((p) => !PACKAGE_RE.test(p)) ||
        new Set(parts).size !== parts.length
      ) {
        return { ok: false, error: "bad_package_list" };
      }
      return { ok: true, value: parts.join(",") };
    }
    default:
      return { ok: false, error: "unknown_key" };
  }
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

function ilikePattern(q: string): string {
  // حروف بنية PostgREST (فواصل وأقواس وعلامات تنصيص ونجمة) بتتشال
  // قبل التضمين في or=(...) — وجودها بيكسر بناء المرشّح أو يفتح
  // باب حقن مرشّحات، وهي عمرها ما بتكون جزء من رقم عملية أو حساب
  // مرسل حقيقي. بعدها تهريب وحيدات LIKE نفسها (% و _ و \).
  const safe = q.replace(/[(),"*]/g, "");
  return `%${safe.replace(/[%_\\]/g, "\\$&")}%`;
}

function orIlike(fields: string[], q: string): string {
  const pattern = encodeURIComponent(ilikePattern(q));
  return `or=(${fields.map((f) => `${f}.ilike.${pattern}`).join(",")})`;
}

/** عميل قراءة/كتابة PostgREST لإعدادات وأحداث المتجر، بنفس نمط العملاء. */
export class PostgrestControlMoneyClient implements ControlMoneyClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }

  private headers(): Record<string, string> {
    return {
      "apikey": this.opts.keyOf(),
      "Authorization": `Bearer ${this.opts.keyOf()}`,
      "Accept": "application/json",
    };
  }

  private async get(path: string): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      headers: this.headers(),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`control money read http ${res.status}: ${text.slice(0, 200)}`);
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async fetchSettings(): Promise<MoneySettingRow[]> {
    const rows = await this.get(
      "wallet_settings?select=key,value,note,updated_at&order=key.asc",
    );
    return rows as unknown as MoneySettingRow[];
  }

  async getSetting(key: string): Promise<MoneySettingRow | null> {
    const rows = await this.get(
      `wallet_settings?key=eq.${encodeURIComponent(key)}` +
        "&select=key,value,note,updated_at&limit=1",
    );
    return (rows[0] as unknown as MoneySettingRow) ?? null;
  }

  async updateSetting(key: string, value: string): Promise<number> {
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/wallet_settings?key=eq.${
        encodeURIComponent(key)
      }`,
      {
        method: "PATCH",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          value,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control money write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    // عدد الصفوف الراجعة في التمثيل هو دليل الكتابة الوحيد هنا:
    // المعالج بيفشل بصوت عالي لو مش صف واحد بالظبط.
    return Array.isArray(parsed) ? parsed.length : 0;
  }

  async fetchDepositEvents(
    query: LostEventsQuery,
  ): Promise<LostEventRow[]> {
    const filters: string[] = [
      `created_at=gte.${encodeURIComponent(query.since)}`,
    ];
    if (query.q) filters.push(orIlike(["exchange_ref", "tx_hash"], query.q));
    if (query.amount !== null) {
      filters.push(`amount_usdt=eq.${query.amount}`);
    }
    return await this.get(
      "wallet_deposit_events?select=id,rail,exchange_ref,asset,amount_usdt," +
        "tx_hash,matched_intent_id,outcome,claim_id,matched_bot_topup_id,created_at" +
        `&${filters.join("&")}&order=created_at.desc&limit=50`,
    );
  }

  async fetchSmsEvents(query: LostEventsQuery): Promise<LostEventRow[]> {
    const filters: string[] = [
      `ingested_at=gte.${encodeURIComponent(query.since)}`,
    ];
    if (query.q) {
      filters.push(orIlike(["transfer_ref", "sender_account"], query.q));
    }
    if (query.amount !== null) {
      filters.push(`amount_egp=eq.${query.amount}`);
    }
    return await this.get(
      "wallet_sms_events?select=id,received_at,ingested_at,sender_id," +
        "amount_egp,sender_account,transfer_ref,match_state,matched_topup_id," +
        "matched_order_id,matched_bot_topup_id,source,package_name" +
        `&${filters.join("&")}&order=ingested_at.desc&limit=50`,
    );
  }

  async fetchDepositClaims(
    query: LostEventsQuery,
  ): Promise<LostEventRow[]> {
    const filters: string[] = [
      `created_at=gte.${encodeURIComponent(query.since)}`,
    ];
    if (query.q) filters.push(orIlike(["exchange_ref"], query.q));
    return await this.get(
      "wallet_deposit_claims?select=id,customer_id,rail,exchange_ref,tx_id," +
        "status,amount_usdt,amount_egp,created_at,resolved_at,resolve_note" +
        `&${filters.join("&")}&order=created_at.desc&limit=50`,
    );
  }

  async fetchTopupIntents(
    query: LostEventsQuery,
  ): Promise<LostEventRow[]> {
    const filters: string[] = [
      `created_at=gte.${encodeURIComponent(query.since)}`,
    ];
    if (query.amount !== null) {
      filters.push(`amount_egp=eq.${query.amount}`);
    }
    if (query.q) {
      if (INTENT_STATUSES.includes(query.q)) {
        filters.push(`status=eq.${encodeURIComponent(query.q)}`);
      } else if (UUID_RE.test(query.q)) {
        filters.push(`id=eq.${encodeURIComponent(query.q)}`);
      } else {
        // «مبلغ/حالة» بس للمقصود من النوايا في المواصفة: نص مش حالة
        // ومش معرّف = مفيش نتيجة بدل تخمين بحث أوسع من المقصود.
        filters.push("status=eq.__no_match__");
      }
    }
    return await this.get(
      "wallet_topup_intents?select=id,customer_id,rail,amount_egp," +
        "amount_usdt,unique_amount,status,expires_at,credited_event_id," +
        "credited_at,created_at" +
        `&${filters.join("&")}&order=created_at.desc&limit=50`,
    );
  }
}

// ------------------------------------------------- تشكيل أحداث ضايعة
function shapeDepositEvent(r: LostEventRow): LostEventRow {
  return {
    ...r,
    source: "deposit_events",
    amount: r.amount_usdt ?? null,
    currency: r.asset ?? "USDT",
    status: r.outcome ?? null,
    time: r.created_at ?? null,
    matched: Boolean(
      r.matched_intent_id || r.claim_id || r.matched_bot_topup_id,
    ),
  };
}

function shapeSmsEvent(r: LostEventRow): LostEventRow {
  return {
    ...r,
    channel: r.source ?? null,
    source: "sms_events",
    amount: r.amount_egp ?? null,
    currency: "EGP",
    status: r.match_state ?? null,
    time: r.received_at ?? r.ingested_at ?? null,
    matched: Boolean(
      r.matched_topup_id || r.matched_order_id || r.matched_bot_topup_id,
    ),
  };
}

function shapeDepositClaim(r: LostEventRow): LostEventRow {
  const hasEgp = r.amount_egp !== null && r.amount_egp !== undefined;
  return {
    ...r,
    source: "deposit_claims",
    amount: hasEgp ? r.amount_egp : (r.amount_usdt ?? null),
    currency: hasEgp ? "EGP" : (r.amount_usdt != null ? "USDT" : null),
    status: r.status ?? null,
    time: r.created_at ?? null,
    matched: r.status === "credited",
  };
}

function shapeTopupIntent(r: LostEventRow): LostEventRow {
  return {
    ...r,
    source: "topup_intents",
    amount: r.amount_egp ?? null,
    currency: "EGP",
    status: r.status ?? null,
    time: r.created_at ?? null,
    matched: r.status === "credited",
  };
}

// ------------------------------------------------------------- المعالج
function parseLostQuery(url: URL): LostEventsQuery | null {
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length > 200) return null;

  const daysRaw = (url.searchParams.get("days") || "").trim();
  let days = 30;
  if (daysRaw) {
    const n = Number(daysRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 365) {
      return null;
    }
    days = n;
  }

  const amountRaw = (url.searchParams.get("amount") || "").trim();
  let amount: number | null = null;
  if (amountRaw) {
    const n = Number(amountRaw);
    if (
      !Number.isFinite(n) || n <= 0 ||
      Math.abs(n * 1_000_000 - Math.round(n * 1_000_000)) > 1e-6
    ) {
      return null;
    }
    amount = n;
  }

  return {
    q,
    amount,
    days,
    since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * معالج فلوس اللوحة (م١-ب) — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlMoneyRequest(
  req: Request,
  deps: ControlMoneyDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...deps.corsOf(req),
      },
    });

  const isBotSettings = path.endsWith("/control/bot-money-settings");
  const isBotLostTopups = path.endsWith("/control/bot-lost-topups");
  const isBotTopupMatch = path.endsWith("/control/bot-topup-match");
  const isStoreSettings = path.endsWith("/control/store-money-settings");
  const isLostEvents = path.endsWith("/control/lost-events");

  if (
    !isBotSettings && !isBotLostTopups && !isBotTopupMatch &&
    !isStoreSettings && !isLostEvents
  ) {
    return null;
  }

  // الاتجاهات: إعدادات الطرفين GET+POST، وبحث الضايعة GET،
  // والمطابقة POST — أي اتجاه تاني 405 قبل المصادقة وأي نداء.
  if (isBotSettings || isStoreSettings) {
    if (req.method !== "GET" && req.method !== "POST") {
      return json({ ok: false, error: "method" }, 405);
    }
  } else if (isBotTopupMatch) {
    if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  } else {
    if (req.method !== "GET") return json({ ok: false, error: "method" }, 405);
  }

  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const readBody = async (): Promise<Record<string, unknown> | null> => {
    const parsed = await req.json().catch(() => null);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : null;
  };

  const proxyBot = async (
    method: string,
    botPath: string,
    body?: Record<string, unknown>,
  ): Promise<Response> => {
    try {
      const r: BotProxyResult = await deps.botClient.proxy(
        method,
        botPath,
        body,
      );
      return json(r.body, r.status);
    } catch (e) {
      deps.logError("control.money", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  };

  // ------------------------------------------------ تمرير البوت
  if (isBotSettings) {
    if (req.method === "GET") {
      return await proxyBot("GET", "/api/control/money-settings");
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    return await proxyBot("POST", "/api/control/money-settings", body);
  }

  if (isBotLostTopups) {
    return await proxyBot("GET", `/api/control/lost-topups${url.search}`);
  }

  if (isBotTopupMatch) {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    return await proxyBot("POST", "/api/control/topup-match", body);
  }

  // ------------------------------------------------ إعدادات المتجر: قراءة
  if (isStoreSettings && req.method === "GET") {
    try {
      const rows = await deps.client.fetchSettings();
      const seen = new Set<string>();
      const settings = rows.map((r) => {
        seen.add(r.key);
        return { ...r, known: STORE_KEY_SET.has(r.key) };
      });
      for (const key of STORE_MONEY_SETTING_KEYS) {
        if (!seen.has(key)) {
          settings.push({
            key,
            value: null,
            note: null,
            updated_at: null,
            known: true,
          });
        }
      }
      return json({ ok: true, settings });
    } catch (e) {
      deps.logError("control.money", "store settings read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ إعدادات المتجر: كتابة
  if (isStoreSettings && req.method === "POST") {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!STORE_KEY_SET.has(key)) {
      return json({ ok: false, error: "unknown_key" }, 400);
    }
    const reasonRaw = body.reason;
    let reason: string | null = null;
    if (reasonRaw !== undefined && reasonRaw !== null) {
      if (typeof reasonRaw !== "string" || reasonRaw.trim().length > 500) {
        return json({ ok: false, error: "bad_reason" }, 400);
      }
      reason = reasonRaw.trim() || null;
    }
    const validation = validateStoreSetting(key, body.value);
    if (!validation.ok) {
      return json({ ok: false, error: validation.error }, 400);
    }

    let before: MoneySettingRow | null;
    let rowsAffected: number;
    try {
      before = await deps.client.getSetting(key);
      rowsAffected = await deps.client.updateSetting(key, validation.value);
    } catch (e) {
      deps.logError("control.money", "store setting write failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
    if (rowsAffected !== 1) {
      deps.logError(
        "control.money",
        "store setting write touched an unexpected row count",
        undefined,
        { key, rows_affected: rowsAffected },
      );
      return json(
        { ok: false, error: "setting_write_failed", rows_affected: rowsAffected },
        500,
      );
    }

    // التدقيق في السجل الموحد عند البوت — فشله بيظهر ومش بيخفي
    // نجاح الكتابة (الفلوس/الإعداد اتحركت فعلًا؛ الإخفاء أخطر).
    let auditFailed = false;
    try {
      const r = await deps.botClient.proxy(
        "POST",
        "/api/control/audit-log",
        {
          action: "store_money_setting_set",
          entity_type: "wallet_settings",
          entity_ref: key,
          before: { value: before?.value ?? null },
          after: { value: validation.value },
          reason,
        },
      );
      if (r.status < 200 || r.status >= 300 || r.body?.ok === false) {
        auditFailed = true;
      }
    } catch (e) {
      auditFailed = true;
      deps.logError("control.money", "store setting audit failed", e);
    }

    return json({
      ok: true,
      key,
      value: validation.value,
      before_value: before?.value ?? null,
      audit_failed: auditFailed,
    });
  }

  // ------------------------------------------------ أحداث المتجر الضايعة
  if (isLostEvents) {
    const query = parseLostQuery(url);
    if (!query) return json({ ok: false, error: "bad_query" }, 400);
    try {
      const [depositEvents, smsEvents, depositClaims, topupIntents] =
        await Promise.all([
          deps.client.fetchDepositEvents(query),
          deps.client.fetchSmsEvents(query),
          deps.client.fetchDepositClaims(query),
          deps.client.fetchTopupIntents(query),
        ]);
      return json({
        ok: true,
        q: query.q,
        amount: query.amount,
        days: query.days,
        deposit_events: depositEvents.slice(0, 50).map(shapeDepositEvent),
        sms_events: smsEvents.slice(0, 50).map(shapeSmsEvent),
        deposit_claims: depositClaims.slice(0, 50).map(shapeDepositClaim),
        topup_intents: topupIntents.slice(0, 50).map(shapeTopupIntent),
      });
    } catch (e) {
      deps.logError("control.money", "lost events read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  return null;
}
