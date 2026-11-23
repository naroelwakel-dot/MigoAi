// لوحة التحكم (المرحلة م٤): صندوق الأحداث الموحّد + المكونات —
// طبقة قراءة مطبّعة وأفعال أدمن فوق جداول الأحداث الحالية في
// قاعدة الموقع كما هي (wallet_sms_events + wallet_deposit_events)،
// وتمرير خادمي لنقاط أحداث البوت (شحناته/ربطه/مكوناته/مفاتيح
// ممراته/تقرير مطابقته). مفيش جداول جديدة ومفيش مسار ائتمان
// جديد: الاعتماد بيعدّي على دوال القاعدة القائمة بعقودها
// الحرفية، والتقنيع إلزامي — المُرسل الخام ما بيغادرش النقطة دي
// أبدًا (sender_masked بس هو اللي بيخرج).

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import { computeDedupeKey, parseSms } from "../sms_bridge/sms_parse.ts";

// ------------------------------------------------------------- الأنواع
export type StoreEventSource =
  | "sms"
  | "app_notification"
  | "binance"
  | "bybit";
export type StoreEventStatus = "pending" | "done" | "ignored";
export type EventConfidence = "high" | "medium" | "low";

export interface StoreEvent {
  id: string;
  source: StoreEventSource;
  /** نوع الحدث: sms_event لصفوف جدول الرسائل، deposit_event للإيداعات. */
  type: "sms_event" | "deposit_event";
  amount_egp: number | null;
  amount_usdt: number | null;
  ref: string | null;
  dedupe_key: string;
  status: StoreEventStatus;
  /** نتيجة الإيداع الخام (صف الإيداعات بس؛ الرسائل = null دايمًا). */
  outcome: string | null;
  body: string | null;
  sender_masked: string | null;
  confidence: EventConfidence;
  created_at: string | null;
  matched: Record<string, string>;
}

export interface SmsEventRow {
  id: string;
  received_at?: string | null;
  ingested_at?: string | null;
  sender_id?: string | null;
  body?: string | null;
  amount_egp?: number | null;
  sender_account?: string | null;
  transfer_ref?: string | null;
  match_state?: string | null;
  matched_topup_id?: string | null;
  matched_order_id?: number | string | null;
  matched_bot_topup_id?: string | null;
  dedupe_key?: string | null;
  source?: string | null;
  corroborated_by?: string | null;
  autocredit_basis?: string | null;
  [key: string]: unknown;
}

export interface DepositEventRow {
  id: string;
  rail?: string | null;
  exchange_ref?: string | null;
  asset?: string | null;
  amount_usdt?: number | null;
  tx_hash?: string | null;
  matched_intent_id?: string | null;
  outcome?: string | null;
  claim_id?: string | null;
  matched_bot_topup_id?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface StoreEventsFilter {
  source: "" | StoreEventSource;
  status: "" | StoreEventStatus;
  q: string;
}

export interface IngestSmsArgs {
  p_sender_id: string;
  p_body: string;
  p_amount: number | null;
  p_sender_account: string | null;
  p_transfer_ref: string | null;
  p_received_at: string;
  p_dedupe_key: string;
  p_parsed: Record<string, unknown>;
  p_source: string;
  p_package_name: string | null;
}

export interface ControlEventsClient {
  fetchSmsEvents(
    filter: StoreEventsFilter,
    fetchLimit: number,
  ): Promise<SmsEventRow[]>;
  fetchDepositEvents(
    filter: StoreEventsFilter,
    fetchLimit: number,
  ): Promise<DepositEventRow[]>;
  countSmsEvents(filter: StoreEventsFilter): Promise<number>;
  countDepositEvents(filter: StoreEventsFilter): Promise<number>;
  /** مطالبات إيداع مفتوحة (لسه ما اتحسمتش) — سياق درجة الثقة. */
  fetchOpenClaims(): Promise<{ id: string; exchange_ref: string }[]>;
  /** نيات شحن مفتوحة — سياق درجة الثقة (مطابقة المبلغ الفريد). */
  fetchOpenIntents(): Promise<
    { id: string; amount_egp: number | null; unique_amount: number | null }[]
  >;
  fetchLastSmsIngestedAt(): Promise<string | null>;
  fetchLastDepositAt(rail: string): Promise<string | null>;
  getSmsEvent(id: string): Promise<SmsEventRow | null>;
  getDepositEvent(id: string): Promise<DepositEventRow | null>;
  /** كتابة حالة رسالة محروسة بالحالة الحالية — بيرجع عدد الصفوف المعدّلة. */
  updateSmsEventState(
    id: string,
    fromState: string,
    toState: string,
  ): Promise<number>;
  /**
   * تسوية إيداع يدويًا: كتابة محروسة على عمود outcome وحده
   * (من الحالة الحالية + كل الروابط فاضية) لقيمة
   * manually_settled — بيرجع عدد الصفوف المعدّلة. مفيش أي
   * مسار محفظة/نية/مطالبة/شحنة في الكتابة دي.
   */
  settleDepositEvent(
    id: string,
    fromOutcome: string | null,
  ): Promise<number>;
  getSetting(
    key: string,
  ): Promise<{ key: string; value: string | null } | null>;
  upsertSetting(key: string, value: string): Promise<number>;
  callResolveClaim(args: {
    p_claim_id: string;
    p_amount_usdt: string | null;
    p_tx_id: string | null;
    p_asset: string | null;
    p_reject_reason: string | null;
  }): Promise<Record<string, unknown>>;
  callAutoCreditDeposit(args: {
    p_rail: string;
    p_exchange_ref: string;
    p_asset: string;
    p_amount_usdt: string;
    p_tx_hash: string | null;
    intentId?: string;
  }): Promise<Record<string, unknown>>;
  callSmsRematch(limit: number): Promise<Record<string, unknown>>;
  callOrderRematch(limit: number): Promise<Record<string, unknown>>;
  callIngestSms(args: IngestSmsArgs): Promise<Record<string, unknown>>;
}

export interface ControlEventsDeps {
  client: ControlEventsClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  now?: () => Date;
}

// ------------------------------------------------------------- التقنيع
/**
 * تقنيع المُرسل: أول حرفين + آخر حرفين بس (والأقصر من كده بيظهر
 * أول حرف ونجوم). المُرسل الخام (رقم/حساب) ما بيطلعش من النقطة
 * دي في أي رد — ده شرط المواصفة، مش تجميل.
 */
export function maskSender(sender: string | null | undefined): string | null {
  const s = String(sender || "").trim();
  if (!s) return null;
  if (s.length <= 4) return `${s.slice(0, 1)}***`;
  return `${s.slice(0, 2)}***${s.slice(-2)}`;
}

// ------------------------------------------------------------- الحالات
/** حالة رسالة مطبّعة: unmatched = ينتظر، matched/credited = تمّ. */
export function smsStatusOf(matchState: string | null | undefined): StoreEventStatus {
  switch (String(matchState || "")) {
    case "matched":
    case "credited":
      return "done";
    case "ignored":
      return "ignored";
    default:
      // unmatched وأي قيمة غير معروفة = لسه ما اتحسمتش.
      return "pending";
  }
}

/**
 * حالة إيداع مطبّعة: credited أو مربوط بأي سطح (نية/مطالبة/شحن
 * بوت) أو manually_settled (اتسوّى يدويًا برّه المنصة بقرار
 * المالك — هجرة 031) = تمّ؛ no_matching_intent = ينتظر. مفيش
 * حالة «متجاهل» للإيداعات — نتيجتها بتكتبها دوال الائتمان بس،
 * ما عدا التسوية اليدوية اللي بيكتبها فعل اللوحة المحروس
 * (settle_manually) على عمود outcome وحده. أي outcome تاني غير
 * معروف بيتحسب «ينتظر» (ما اتحسمش) بدل ما يختفي.
 */
export function depositStatusOf(row: DepositEventRow): StoreEventStatus {
  if (
    String(row.outcome || "") === "credited" ||
    String(row.outcome || "") === "manually_settled" ||
    row.matched_intent_id || row.claim_id || row.matched_bot_topup_id
  ) {
    return "done";
  }
  return "pending";
}

// ------------------------------------------------------------- التطبيع
export interface ConfidenceContext {
  /** مراجع مطالبات مفتوحة (exchange_ref) للمطابقة الحرفية. */
  claimRefs: Set<string>;
  /** مبالغ نيات مفتوحة (amount_egp وunique_amount) للمطابقة بالمبلغ. */
  intentAmounts: Set<number>;
}

function confidenceOf(input: {
  corroboratedBy: string | null;
  ref: string | null;
  autocreditBasis: string | null;
  amount: number | null;
  ctx: ConfidenceContext;
}): EventConfidence {
  // درجة عرض بس — ما بتغيّرش أي قرار ائتمان في أي مكان.
  if (input.corroboratedBy) return "high";
  if (input.ref && input.ctx.claimRefs.has(input.ref)) return "high";
  if (input.autocreditBasis) return "medium";
  if (
    input.amount !== null && Number.isFinite(input.amount) &&
    input.ctx.intentAmounts.has(input.amount)
  ) {
    return "medium";
  }
  return "low";
}

export function normalizeSmsEvent(
  row: SmsEventRow,
  ctx: ConfidenceContext,
): StoreEvent {
  const matched: Record<string, string> = {};
  if (row.matched_topup_id) matched.topup_id = String(row.matched_topup_id);
  if (row.matched_bot_topup_id) {
    matched.bot_topup_id = String(row.matched_bot_topup_id);
  }
  if (row.matched_order_id !== null && row.matched_order_id !== undefined) {
    matched.order_id = String(row.matched_order_id);
  }
  const source: StoreEventSource =
    String(row.source || "") === "app_notification"
      ? "app_notification"
      : "sms";
  return {
    id: String(row.id),
    source,
    type: "sms_event",
    amount_egp: row.amount_egp !== null && row.amount_egp !== undefined
      ? Number(row.amount_egp)
      : null,
    amount_usdt: null,
    ref: row.transfer_ref ? String(row.transfer_ref) : null,
    dedupe_key: String(row.dedupe_key || ""),
    status: smsStatusOf(row.match_state),
    outcome: null,
    body: row.body !== null && row.body !== undefined
      ? String(row.body)
      : null,
    sender_masked: maskSender(row.sender_id),
    confidence: confidenceOf({
      corroboratedBy: row.corroborated_by
        ? String(row.corroborated_by)
        : null,
      ref: row.transfer_ref ? String(row.transfer_ref) : null,
      autocreditBasis: row.autocredit_basis
        ? String(row.autocredit_basis)
        : null,
      amount: row.amount_egp !== null && row.amount_egp !== undefined
        ? Number(row.amount_egp)
        : null,
      ctx,
    }),
    created_at: row.ingested_at
      ? String(row.ingested_at)
      : (row.received_at ? String(row.received_at) : null),
    matched,
  };
}

export function normalizeDepositEvent(
  row: DepositEventRow,
  ctx: ConfidenceContext,
): StoreEvent {
  const matched: Record<string, string> = {};
  if (row.matched_intent_id) matched.intent_id = String(row.matched_intent_id);
  if (row.claim_id) matched.claim_id = String(row.claim_id);
  if (row.matched_bot_topup_id) {
    matched.bot_topup_id = String(row.matched_bot_topup_id);
  }
  const rail = String(row.rail || "");
  const ref = row.exchange_ref ? String(row.exchange_ref) : null;
  return {
    id: String(row.id),
    source: rail === "bybit" ? "bybit" : "binance",
    type: "deposit_event",
    amount_egp: null,
    amount_usdt: row.amount_usdt !== null && row.amount_usdt !== undefined
      ? Number(row.amount_usdt)
      : null,
    ref,
    // مفتاح منع التكرار البنيوي للإيداع هو الزوج (rail, exchange_ref).
    dedupe_key: `${rail}:${ref || ""}`,
    status: depositStatusOf(row),
    outcome: row.outcome ? String(row.outcome) : null,
    body: null,
    sender_masked: null,
    confidence: confidenceOf({
      corroboratedBy: null,
      ref,
      autocreditBasis: null,
      amount: null,
      ctx,
    }),
    created_at: row.created_at ? String(row.created_at) : null,
    matched,
  };
}

// ------------------------------------------------- كلمات الاستبعاد
/** فك قيمة إعداد الكلمات المستبعدة: JSON array، أو نص مفصول بفواصل/أسطر. */
export function parseExclusionsValue(raw: string | null | undefined): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  let parts: unknown[] | null = null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) parts = parsed;
  } catch {
    parts = null;
  }
  const list = parts !== null
    ? parts.map((p) => (typeof p === "string" ? p.trim() : ""))
    : text.split(/[\n,،]/).map((p) => p.trim());
  const out: string[] = [];
  for (const w of list) {
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

function validateExclusions(
  words: unknown,
): { ok: true; words: string[] } | { ok: false } {
  if (!Array.isArray(words) || words.length > 50) return { ok: false };
  const out: string[] = [];
  for (const w of words) {
    if (typeof w !== "string") return { ok: false };
    const t = w.trim();
    if (!t || t.length > 100) return { ok: false };
    if (!out.includes(t)) out.push(t);
  }
  return { ok: true, words: out };
}

export const EXCLUSIONS_KEY = "sms_excluded_words";

// ------------------------------------------------------------- العميل
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

function ilikePattern(q: string): string {
  // نفس حماية money.ts: حروف بنية PostgREST بتتشال قبل التضمين
  // في or=(...) وبعدها تهريب وحيدات LIKE نفسها.
  const safe = q.replace(/[(),"*]/g, "");
  return `%${safe.replace(/[%_\\]/g, "\\$&")}%`;
}

function orIlike(fields: string[], q: string): string {
  const pattern = encodeURIComponent(ilikePattern(q));
  return `or=(${fields.map((f) => `${f}.ilike.${pattern}`).join(",")})`;
}

function smsTableIncluded(f: StoreEventsFilter): boolean {
  return f.source === "" || f.source === "sms" ||
    f.source === "app_notification";
}

function depositTableIncluded(f: StoreEventsFilter): boolean {
  return f.source === "" || f.source === "binance" || f.source === "bybit";
}

// دمج المرشّحات: شرط or= واحد بيعدي زي ما هو، واتنين أو أكتر
// بيتلفّوا في and=(...) واحدة — تكرار or= على نفس المستوى في
// PostgREST سلوكه مش مضمون التوثيق، واللفّ بيخلي المعنى واحد
// في كل الأحوال.
function combineParams(plain: string[], groups: string[]): string[] {
  if (groups.length <= 1) return [...plain, ...groups];
  const inner = groups.map((g) => g.replace("or=(", "or(")).join(",");
  return [...plain, `and=(${inner})`];
}

function smsFilterParams(f: StoreEventsFilter): string[] {
  const plain: string[] = [];
  const groups: string[] = [];
  if (f.source === "sms" || f.source === "app_notification") {
    plain.push(`source=eq.${f.source}`);
  }
  // «ينتظر» بيطابق smsStatusOf بالحرف: أي حالة مش منتهية
  // (matched/credited/ignored) — بما فيها الفاضية — هي pending،
  // وإلا صفوف بتظهر في «الكل» وتختفي من فلتر الانتظار وعدّاده.
  if (f.status === "pending") {
    groups.push(
      "or=(match_state.is.null," +
        "match_state.not.in.(matched,credited,ignored))",
    );
  } else if (f.status === "done") {
    plain.push("match_state=in.(matched,credited)");
  } else if (f.status === "ignored") {
    plain.push("match_state=eq.ignored");
  }
  if (f.q) {
    groups.push(orIlike(["transfer_ref", "sender_account", "body"], f.q));
  }
  return combineParams(plain, groups);
}

function depositFilterParams(f: StoreEventsFilter): string[] | null {
  // null = الجدول مستبعد بالكامل بالفلتر ده (مفيش «متجاهل» للإيداعات).
  if (f.status === "ignored") return null;
  const plain: string[] = [];
  const groups: string[] = [];
  if (f.source === "binance" || f.source === "bybit") {
    plain.push(`rail=eq.${f.source}`);
  }
  if (f.status === "pending") {
    // بيطابق depositStatusOf بالحرف: مش credited ومش
    // manually_settled ومش مربوط بأي هدف — أي outcome تانية
    // (بما فيها الفاضية) لسه pending.
    groups.push(
      "or=(outcome.is.null,outcome.not.in.(credited,manually_settled))",
    );
    plain.push("matched_intent_id=is.null");
    plain.push("claim_id=is.null");
    plain.push("matched_bot_topup_id=is.null");
  } else if (f.status === "done") {
    groups.push(
      "or=(outcome.eq.credited,outcome.eq.manually_settled," +
        "matched_intent_id.not.is.null," +
        "claim_id.not.is.null,matched_bot_topup_id.not.is.null)",
    );
  }
  if (f.q) groups.push(orIlike(["exchange_ref", "tx_hash"], f.q));
  return combineParams(plain, groups);
}

const SMS_SELECT =
  "id,received_at,ingested_at,sender_id,body,amount_egp,sender_account," +
  "transfer_ref,match_state,matched_topup_id,matched_order_id," +
  "matched_bot_topup_id,dedupe_key,source,package_name,corroborated_by," +
  "autocredit_basis";
const DEPOSIT_SELECT =
  "id,rail,exchange_ref,asset,amount_usdt,tx_hash,matched_intent_id," +
  "outcome,claim_id,matched_bot_topup_id,created_at";

/** عميل PostgREST لوحدة الأحداث، بنفس نمط عملاء الوحدات التانية. */
export class PostgrestControlEventsClient implements ControlEventsClient {
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

  private async get(
    path: string,
  ): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      headers: this.headers(),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control events read http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async count(path: string): Promise<number> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      headers: { ...this.headers(), "Prefer": "count=exact" },
    });
    if (!res.ok) {
      throw new Error(`control events count http ${res.status}`);
    }
    const range = res.headers.get("content-range") || "";
    const m = /\/(\d+)\s*$/.exec(range);
    if (!m) throw new Error("control events count: no content-range");
    return Number(m[1]);
  }

  private async rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (!res.ok) {
      throw new Error(`rpc ${fn} http ${res.status}: ${text.slice(0, 200)}`);
    }
    return (parsed && typeof parsed === "object")
      ? parsed as Record<string, unknown>
      : { value: parsed };
  }

  async fetchSmsEvents(
    filter: StoreEventsFilter,
    fetchLimit: number,
  ): Promise<SmsEventRow[]> {
    if (!smsTableIncluded(filter)) return [];
    const params = smsFilterParams(filter);
    const rows = await this.get(
      `wallet_sms_events?select=${SMS_SELECT}&${params.join("&")}` +
        `&order=ingested_at.desc&limit=${fetchLimit}`,
    );
    return rows as unknown as SmsEventRow[];
  }

  async fetchDepositEvents(
    filter: StoreEventsFilter,
    fetchLimit: number,
  ): Promise<DepositEventRow[]> {
    if (!depositTableIncluded(filter)) return [];
    const params = depositFilterParams(filter);
    if (params === null) return [];
    const rows = await this.get(
      `wallet_deposit_events?select=${DEPOSIT_SELECT}&${params.join("&")}` +
        `&order=created_at.desc&limit=${fetchLimit}`,
    );
    return rows as unknown as DepositEventRow[];
  }

  async countSmsEvents(filter: StoreEventsFilter): Promise<number> {
    if (!smsTableIncluded(filter)) return 0;
    const params = smsFilterParams(filter);
    return await this.count(
      `wallet_sms_events?select=id&${params.join("&")}&limit=1`,
    );
  }

  async countDepositEvents(filter: StoreEventsFilter): Promise<number> {
    if (!depositTableIncluded(filter)) return 0;
    const params = depositFilterParams(filter);
    if (params === null) return 0;
    return await this.count(
      `wallet_deposit_events?select=id&${params.join("&")}&limit=1`,
    );
  }

  async fetchOpenClaims(): Promise<{ id: string; exchange_ref: string }[]> {
    const rows = await this.get(
      "wallet_deposit_claims?select=id,exchange_ref" +
        "&resolved_at=is.null&order=created_at.desc&limit=200",
    );
    return rows.map((r) => ({
      id: String(r.id || ""),
      exchange_ref: String(r.exchange_ref || ""),
    })).filter((r) => r.id && r.exchange_ref);
  }

  async fetchOpenIntents(): Promise<
    { id: string; amount_egp: number | null; unique_amount: number | null }[]
  > {
    const rows = await this.get(
      "wallet_topup_intents?select=id,amount_egp,unique_amount" +
        "&status=eq.open&order=created_at.desc&limit=200",
    );
    return rows.map((r) => ({
      id: String(r.id || ""),
      amount_egp: r.amount_egp === null || r.amount_egp === undefined
        ? null
        : Number(r.amount_egp),
      unique_amount: r.unique_amount === null ||
          r.unique_amount === undefined
        ? null
        : Number(r.unique_amount),
    })).filter((r) => r.id);
  }

  async fetchLastSmsIngestedAt(): Promise<string | null> {
    const rows = await this.get(
      "wallet_sms_events?select=ingested_at&order=ingested_at.desc&limit=1",
    );
    const v = rows[0]?.ingested_at;
    return v ? String(v) : null;
  }

  async fetchLastDepositAt(rail: string): Promise<string | null> {
    const rows = await this.get(
      `wallet_deposit_events?select=created_at&rail=eq.${
        encodeURIComponent(rail)
      }&order=created_at.desc&limit=1`,
    );
    const v = rows[0]?.created_at;
    return v ? String(v) : null;
  }

  async getSmsEvent(id: string): Promise<SmsEventRow | null> {
    const rows = await this.get(
      `wallet_sms_events?select=${SMS_SELECT}&id=eq.${
        encodeURIComponent(id)
      }&limit=1`,
    );
    return (rows[0] as unknown as SmsEventRow) ?? null;
  }

  async getDepositEvent(id: string): Promise<DepositEventRow | null> {
    const rows = await this.get(
      `wallet_deposit_events?select=${DEPOSIT_SELECT}&id=eq.${
        encodeURIComponent(id)
      }&limit=1`,
    );
    return (rows[0] as unknown as DepositEventRow) ?? null;
  }

  async updateSmsEventState(
    id: string,
    fromState: string,
    toState: string,
  ): Promise<number> {
    // إصلاح W9 #1: المعالج بيحوّل match_state الـ NULL لنص فاضي —
    // مرشّح eq. الفاضي عمره ما بيطابق NULL في PostgREST، فأحداث
    // الـ NULL كانت بتاخد 409 event_consumed على طول في التجاهل
    // وفكّه. الحارس الصح للـ NULL هو is.null (نفس نمط
    // settleDepositEvent تحت).
    const stateGuard = fromState === ""
      ? "match_state=is.null"
      : `match_state=eq.${encodeURIComponent(fromState)}`;
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/wallet_sms_events?id=eq.${
        encodeURIComponent(id)
      }&${stateGuard}`,
      {
        method: "PATCH",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ match_state: toState }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control events state write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return Array.isArray(parsed) ? parsed.length : 0;
  }

  async settleDepositEvent(
    id: string,
    fromOutcome: string | null,
  ): Promise<number> {
    // كتابة محروسة بنفس نمط updateSmsEventState: بتتم بس لو
    // النتيجة لسه هي اللي اتقرت وكل الروابط فاضية — أي سباق
    // (استهلاك/ربط حصل بين القراءة والكتابة) بيخلي الصفوف صفر.
    const outcomeGuard = fromOutcome === null
      ? "outcome=is.null"
      : `outcome=eq.${encodeURIComponent(fromOutcome)}`;
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/wallet_deposit_events?id=eq.${
        encodeURIComponent(id)
      }&${outcomeGuard}` +
        "&matched_intent_id=is.null&claim_id=is.null" +
        "&matched_bot_topup_id=is.null",
      {
        method: "PATCH",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ outcome: "manually_settled" }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control events settle write http ${res.status}: ${
          text.slice(0, 200)
        }`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return Array.isArray(parsed) ? parsed.length : 0;
  }

  async getSetting(
    key: string,
  ): Promise<{ key: string; value: string | null } | null> {
    const rows = await this.get(
      `wallet_settings?key=eq.${encodeURIComponent(key)}` +
        "&select=key,value&limit=1",
    );
    const row = rows[0];
    if (!row) return null;
    return {
      key: String(row.key || key),
      value: row.value === null || row.value === undefined
        ? null
        : String(row.value),
    };
  }

  async upsertSetting(key: string, value: string): Promise<number> {
    // إدراج أو تحديث: مفتاح الكلمات المستبعدة جديد وممكن ما يكونش
    // له صف أصلًا، فالكتابة upsert على مفتاح الجدول الفريد.
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/wallet_settings?on_conflict=key`,
      {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          key,
          value,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control events setting write http ${res.status}: ${
          text.slice(0, 200)
        }`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return Array.isArray(parsed) ? parsed.length : 0;
  }

  callResolveClaim(args: {
    p_claim_id: string;
    p_amount_usdt: string | null;
    p_tx_id: string | null;
    p_asset: string | null;
    p_reject_reason: string | null;
  }): Promise<Record<string, unknown>> {
    return this.rpc("wallet_resolve_claim", { ...args });
  }

  callAutoCreditDeposit(args: {
    p_rail: string;
    p_exchange_ref: string;
    p_asset: string;
    p_amount_usdt: string;
    p_tx_hash: string | null;
    intentId?: string;
  }): Promise<Record<string, unknown>> {
    const { intentId, ...rpcArgs } = args;
    return this.rpc("wallet_auto_credit_deposit", {
      ...rpcArgs,
      ...(intentId ? { p_intent_id: intentId } : {}),
    });
  }

  callSmsRematch(limit: number): Promise<Record<string, unknown>> {
    return this.rpc("wallet_sms_rematch", { p_limit: limit });
  }

  callOrderRematch(limit: number): Promise<Record<string, unknown>> {
    return this.rpc("order_sms_rematch", { p_limit: limit });
  }

  callIngestSms(args: IngestSmsArgs): Promise<Record<string, unknown>> {
    return this.rpc("wallet_ingest_sms", { ...args });
  }
}

// ------------------------------------------------------------- المعالج
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EVENT_SOURCES: StoreEventSource[] = [
  "sms",
  "app_notification",
  "binance",
  "bybit",
];
const EVENT_STATUSES: StoreEventStatus[] = ["pending", "done", "ignored"];
const EVENT_ACTIONS = [
  "approve",
  "ignore",
  "unignore",
  "rematch",
  "settle_manually",
];

/**
 * معالج أحداث اللوحة (م٤) — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlEventsRequest(
  req: Request,
  deps: ControlEventsDeps,
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

  const BOT_PROXIES: Record<string, { method: string; botPath: string }> = {
    "/control/bot-events-topups": {
      method: "GET",
      botPath: "/api/control/events-topups",
    },
    "/control/bot-events-link": {
      method: "POST",
      botPath: "/api/control/events-link",
    },
    "/control/bot-events-components": {
      method: "GET",
      botPath: "/api/control/events-components",
    },
    "/control/bot-events-rail-toggle": {
      method: "POST",
      botPath: "/api/control/events-rail-toggle",
    },
    "/control/bot-events-match-report": {
      method: "GET",
      botPath: "/api/control/events-match-report",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين.
  const suffix = Object.keys(BOT_PROXIES)
    .sort((a, b) => b.length - a.length)
    .find((s) => path.endsWith(s));

  const isStoreEvents = path.endsWith("/control/store-events");
  const isStoreAction = path.endsWith("/control/store-event-action");
  const isStorePaste = path.endsWith("/control/store-event-paste");
  const isStoreExclusions = path.endsWith("/control/store-event-exclusions");
  if (
    !suffix && !isStoreEvents && !isStoreAction && !isStorePaste &&
    !isStoreExclusions
  ) {
    return null;
  }

  // الطريقة الغلط 405 قبل بوابة الأدمن وأي نداء (نمط الوحدات).
  let allowedMethods: string[];
  if (suffix) allowedMethods = [BOT_PROXIES[suffix].method];
  else if (isStoreEvents) allowedMethods = ["GET"];
  else if (isStoreExclusions) allowedMethods = ["GET", "POST"];
  else allowedMethods = ["POST"];
  if (!allowedMethods.includes(req.method)) {
    return json({ ok: false, error: "method" }, 405);
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
      deps.logError("control.events", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  };

  // التدقيق في السجل الموحد عند البوت (نمط money.ts): فشله بيظهر
  // كـ audit_failed ومش بيخفي نجاح الفعل نفسه.
  const audit = async (
    action: string,
    entityType: string,
    entityRef: string,
    before: unknown,
    after: unknown,
    reason: string | null,
  ): Promise<boolean> => {
    try {
      const r = await deps.botClient.proxy("POST", "/api/control/audit-log", {
        action,
        entity_type: entityType,
        entity_ref: entityRef,
        before,
        after,
        reason,
      });
      return !(r.status < 200 || r.status >= 300 || r.body?.ok === false);
    } catch (e) {
      deps.logError("control.events", "audit failed", e);
      return false;
    }
  };

  // ------------------------------------------------ تمرير البوت
  if (suffix) {
    const route = BOT_PROXIES[suffix];
    if (route.method === "GET") {
      return await proxyBot("GET", `${route.botPath}${url.search}`);
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    return await proxyBot("POST", route.botPath, body);
  }

  const loadConfidenceCtx = async (): Promise<ConfidenceContext> => {
    const [claims, intents] = await Promise.all([
      deps.client.fetchOpenClaims(),
      deps.client.fetchOpenIntents(),
    ]);
    const claimRefs = new Set<string>();
    for (const c of claims) if (c.exchange_ref) claimRefs.add(c.exchange_ref);
    const intentAmounts = new Set<number>();
    for (const i of intents) {
      if (i.amount_egp !== null && Number.isFinite(i.amount_egp)) {
        intentAmounts.add(i.amount_egp);
      }
      if (i.unique_amount !== null && Number.isFinite(i.unique_amount)) {
        intentAmounts.add(i.unique_amount);
      }
    }
    return { claimRefs, intentAmounts };
  };

  // ------------------------------------------------ صندوق أحداث الموقع
  if (isStoreEvents) {
    const sourceRaw = (url.searchParams.get("source") || "").trim();
    const statusRaw = (url.searchParams.get("status") || "").trim();
    const q = (url.searchParams.get("q") || "").trim();
    if (
      (sourceRaw && !EVENT_SOURCES.includes(sourceRaw as StoreEventSource)) ||
      (statusRaw && !EVENT_STATUSES.includes(statusRaw as StoreEventStatus)) ||
      q.length > 200
    ) {
      return json({ ok: false, error: "bad_query" }, 400);
    }
    const limitRaw = (url.searchParams.get("limit") || "").trim();
    const offsetRaw = (url.searchParams.get("offset") || "").trim();
    let limit = 50;
    let offset = 0;
    if (limitRaw) {
      const n = Number(limitRaw);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return json({ ok: false, error: "bad_query" }, 400);
      }
      limit = n;
    }
    if (offsetRaw) {
      const n = Number(offsetRaw);
      if (!Number.isInteger(n) || n < 0 || n > 100000) {
        return json({ ok: false, error: "bad_query" }, 400);
      }
      offset = n;
    }
    const filter: StoreEventsFilter = {
      source: (sourceRaw || "") as StoreEventsFilter["source"],
      status: (statusRaw || "") as StoreEventsFilter["status"],
      q,
    };
    try {
      const countFor = async (f: StoreEventsFilter): Promise<number> => {
        const [a, b] = await Promise.all([
          deps.client.countSmsEvents(f),
          deps.client.countDepositEvents(f),
        ]);
        return a + b;
      };
      // العدّادات: إجمالي كل بُعد بيحترم فلاتر الأبعاد التانية
      // وبيتجاهل فلتر بُعده هو — فعدّاد «ينتظر» مثلًا بيقول كام
      // حدث ينتظر ضمن المصدر/البحث الحاليين، مش ضمن حالة «ينتظر».
      // النداءات الثمانية مستقلة عن بعضها — دفعة متوازية واحدة
      // (م٦-د) بدل ثماني جولات متسلسلة؛ النتائج والشكل زي ما هما.
      const [sourceCounts, statusCounts, total] = await Promise.all([
        Promise.all(EVENT_SOURCES.map((s) => countFor({ ...filter, source: s }))),
        Promise.all(
          EVENT_STATUSES.map((st) => countFor({ ...filter, status: st })),
        ),
        countFor(filter),
      ]);
      const bySource = {} as Record<StoreEventSource, number>;
      EVENT_SOURCES.forEach((s, i) => {
        bySource[s] = sourceCounts[i];
      });
      const byStatus = {} as Record<StoreEventStatus, number>;
      EVENT_STATUSES.forEach((st, i) => {
        byStatus[st] = statusCounts[i];
      });

      const fetchLimit = offset + limit;
      const [smsRows, depRows, ctx, lastSms, lastBinance, lastBybit] =
        await Promise.all([
          deps.client.fetchSmsEvents(filter, fetchLimit),
          deps.client.fetchDepositEvents(filter, fetchLimit),
          loadConfidenceCtx(),
          deps.client.fetchLastSmsIngestedAt(),
          deps.client.fetchLastDepositAt("binance"),
          deps.client.fetchLastDepositAt("bybit"),
        ]);
      const items: StoreEvent[] = [
        ...smsRows.map((r) => normalizeSmsEvent(r, ctx)),
        ...depRows.map((r) => normalizeDepositEvent(r, ctx)),
      ];
      items.sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        if (tb !== ta) return tb - ta;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      return json({
        ok: true,
        items: items.slice(offset, offset + limit),
        counts: { by_source: bySource, by_status: byStatus },
        total,
        limit,
        offset,
        sms_last_ingested_at: lastSms,
        deposit_last: { binance: lastBinance, bybit: lastBybit },
      });
    } catch (e) {
      deps.logError("control.events", "store events read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ الكلمات المستبعدة
  if (isStoreExclusions) {
    if (req.method === "GET") {
      try {
        const row = await deps.client.getSetting(EXCLUSIONS_KEY);
        return json({
          ok: true,
          words: parseExclusionsValue(row?.value),
        });
      } catch (e) {
        deps.logError("control.events", "exclusions read failed", e);
        return json({ ok: false, error: "store_failed" }, 502);
      }
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const validation = validateExclusions(body.words);
    if (!validation.ok) {
      return json({ ok: false, error: "bad_exclusions" }, 400);
    }
    let beforeWords: string[];
    let rowsAffected: number;
    try {
      const before = await deps.client.getSetting(EXCLUSIONS_KEY);
      beforeWords = parseExclusionsValue(before?.value);
      rowsAffected = await deps.client.upsertSetting(
        EXCLUSIONS_KEY,
        JSON.stringify(validation.words),
      );
    } catch (e) {
      deps.logError("control.events", "exclusions write failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
    if (rowsAffected !== 1) {
      deps.logError(
        "control.events",
        "exclusions write touched an unexpected row count",
        undefined,
        { rows_affected: rowsAffected },
      );
      return json(
        { ok: false, error: "setting_write_failed", rows_affected: rowsAffected },
        500,
      );
    }
    const auditOk = await audit(
      "store_event_exclusions_set",
      "wallet_settings",
      EXCLUSIONS_KEY,
      { words: beforeWords },
      { words: validation.words },
      null,
    );
    return json({
      ok: true,
      words: validation.words,
      audit_failed: !auditOk,
    });
  }

  // ------------------------------------------------ ألصق رسالة يدويًا
  if (isStorePaste) {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const text = typeof body.body === "string" ? body.body : "";
    if (!text.trim() || text.length > 2000) {
      return json({ ok: false, error: "bad_body" }, 400);
    }
    // المُرسل ثابت «panel» دايمًا: أي sender_id جاي في الطلب
    // بيُتجاهل تمامًا — الرسالة الملصوقة من اللوحة ما تكتسبش
    // أبدًا هوية مُرسل موثوق، وإلا إعادة المطابقة ممكن تشحن
    // على لصق يدوي (قاعدة الفلوس: اللصق بعقد الجسر بس بهوية
    // اللوحة اللي ما بتولّدش ثقة).
    const senderId = "panel";

    let words: string[];
    try {
      const row = await deps.client.getSetting(EXCLUSIONS_KEY);
      words = parseExclusionsValue(row?.value);
    } catch (e) {
      deps.logError("control.events", "paste exclusions read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
    // فحص الاستبعاد قبل أي إدخال: كلمة مستبعدة في النص = تخطٍّ
    // كامل بلا حدث وبلا مطابقة (قرار الأدمن في إعداداته).
    const lower = text.toLowerCase();
    const hit = words.find((w) => lower.includes(w.toLowerCase()));
    if (hit) return json({ ok: true, skipped: "excluded_word" });

    // نفس عقد جسر الرسائل بالحرف: نفس المحلّل، نفس حساب مفتاح
    // منع التكرار، نفس وسائط wallet_ingest_sms، ونفس إعادة
    // المطابقة الانتهازية بعد الإدخال. مرسل اللصق الافتراضي
    // «panel» أصله unknown عند المحلّل، فاللصق مستحيل يفتح شحنًا
    // تلقائيًا لوحده — المطابقة والقرار بيضلوا لقواعد القاعدة.
    const receivedAt = (deps.now ? deps.now() : new Date()).toISOString();
    try {
      const parsed = parseSms(senderId, text);
      const dedupeKey = await computeDedupeKey({
        sender_id: senderId,
        body: text,
        received_at_iso: receivedAt,
        amount_egp: parsed.amount_egp,
        transfer_ref: parsed.transfer_ref,
      });
      const result = await deps.client.callIngestSms({
        p_sender_id: senderId,
        p_body: text,
        p_amount: parsed.matchable ? parsed.amount_egp : null,
        p_sender_account: parsed.sender_account,
        p_transfer_ref: parsed.transfer_ref,
        p_received_at: receivedAt,
        p_dedupe_key: dedupeKey,
        p_parsed: {
          template: parsed.template,
          direction: parsed.direction,
          matchable: parsed.matchable,
          origin: parsed.origin,
          source: "sms",
          package_name: null,
          client_dedupe_key: null,
        },
        p_source: "sms",
        p_package_name: null,
      });
      let rematch: Record<string, unknown> | null = null;
      try {
        rematch = await deps.client.callSmsRematch(50);
      } catch (e) {
        deps.logError("control.events", "paste rematch failed", e);
      }
      let orderRematch: Record<string, unknown> | null = null;
      try {
        orderRematch = await deps.client.callOrderRematch(50);
      } catch (e) {
        deps.logError("control.events", "paste order rematch failed", e);
      }
      const auditOk = await audit(
        "store_event_paste",
        "wallet_sms_events",
        dedupeKey,
        null,
        {
          sender_id: senderId,
          matchable: parsed.matchable,
          amount_egp: parsed.amount_egp,
        },
        null,
      );
      return json({
        ok: true,
        ...result,
        rematch,
        order_rematch: orderRematch,
        audit_failed: !auditOk,
      });
    } catch (e) {
      deps.logError("control.events", "paste ingest failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ فعل على حدث موقع
  if (isStoreAction) {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const source = typeof body.source === "string" ? body.source.trim() : "";
    const eventId = typeof body.event_id === "string"
      ? body.event_id.trim()
      : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (!EVENT_SOURCES.includes(source as StoreEventSource) || !eventId) {
      return json({ ok: false, error: "bad_event" }, 400);
    }
    if (!EVENT_ACTIONS.includes(action)) {
      return json({ ok: false, error: "bad_action" }, 400);
    }
    let reason: string | null = null;
    if (body.reason !== undefined && body.reason !== null) {
      if (typeof body.reason !== "string" || body.reason.trim().length > 500) {
        return json({ ok: false, error: "bad_reason" }, 400);
      }
      reason = body.reason.trim() || null;
    }
    const isDeposit = source === "binance" || source === "bybit";

    try {
      const ctx = await loadConfidenceCtx();

      // ------------------------------------------ أحداث الإيداعات
      if (isDeposit) {
        const row = await deps.client.getDepositEvent(eventId);
        if (!row) return json({ ok: false, error: "bad_event" }, 404);
        const rail = String(row.rail || "");
        if (rail !== "binance" && rail !== "bybit") {
          return json({ ok: false, error: "bad_rail" }, 400);
        }
        if (rail !== source) {
          // مصدر الطلب لازم يطابق سكة الحدث المخزّنة بالحرف —
          // التنفيذ بيتبع الصف المخزّن، وأي اختلاف طلب غلط.
          return json({ ok: false, error: "bad_source" }, 400);
        }
        const before = normalizeDepositEvent(row, ctx);
        if (action === "ignore" || action === "unignore") {
          // أحداث الإيداعات مالهاش حالة تجاهل عند الأدمن: نتيجتها
          // بتكتبها دوال الائتمان بس، فالتجاهل هنا فعل غير موجود
          // بالتصميم — مش بنخترع عمود حالة جديد.
          return json({ ok: false, error: "bad_action" }, 400);
        }
        if (before.status === "done") {
          return json({ ok: false, error: "event_consumed" }, 409);
        }
        if (action === "settle_manually") {
          // تسوية يدوية خارج المنصة (هجرة 031): الحدث لسه معلّق
          // ومش مربوط بأي سطح (فحص done فوق بيضمن ده)، فالكتابة
          // المحروسة بتقفل نتيجته manually_settled على عمود
          // outcome وحده — من غير أي شحن محفظة ولا ربط. صفر
          // صفوف = سباق استهلاك/ربط حصل بعد القراءة.
          const settledRows = await deps.client.settleDepositEvent(
            eventId,
            row.outcome ? String(row.outcome) : null,
          );
          if (settledRows !== 1) {
            return json({ ok: false, error: "event_consumed" }, 409);
          }
          const settledRow = await deps.client.getDepositEvent(eventId);
          const settledAfter = settledRow
            ? normalizeDepositEvent(settledRow, ctx)
            : before;
          const settleAuditOk = await audit(
            "store_event_action",
            "store_event",
            `${source}:${eventId}`,
            { status: before.status },
            { action, status: settledAfter.status },
            reason,
          );
          return json({
            ok: true,
            action,
            result: { outcome: "manually_settled" },
            event: settledAfter,
            audit_failed: !settleAuditOk,
          });
        }
        const hasClaim = body.claim_id !== undefined &&
          body.claim_id !== null && body.claim_id !== "";
        const hasIntent = body.intent_id !== undefined &&
          body.intent_id !== null && body.intent_id !== "";
        if (action === "approve" && hasClaim && hasIntent) {
          // هدف واحد بس للاعتماد — مطالبة أو نية. الاتنين مع
          // بعض ملتبس ومفيش أولوية صامتة بينهم.
          return json({ ok: false, error: "bad_target" }, 400);
        }
        const amountStr = String(row.amount_usdt ?? "");
        let result: Record<string, unknown>;
        if (action === "approve" && body.claim_id !== undefined &&
          body.claim_id !== null && body.claim_id !== "") {
          const claimId = typeof body.claim_id === "string"
            ? body.claim_id.trim()
            : "";
          if (!UUID_RE.test(claimId)) {
            return json({ ok: false, error: "bad_event" }, 400);
          }
          // عقد wallet_resolve_claim الحرفي (نفس نداء api.ts):
          // المبلغ نص دايمًا، والرفض مش من المسار ده (reason فاضي).
          result = await deps.client.callResolveClaim({
            p_claim_id: claimId,
            p_amount_usdt: amountStr === "" ? null : amountStr,
            p_tx_id: row.tx_hash ? String(row.tx_hash) : null,
            p_asset: row.asset ? String(row.asset) : null,
            p_reject_reason: null,
          });
        } else if (action === "approve" && body.intent_id !== undefined &&
          body.intent_id !== null && body.intent_id !== "") {
          const intentId = typeof body.intent_id === "string"
            ? body.intent_id.trim()
            : "";
          if (!UUID_RE.test(intentId)) {
            return json({ ok: false, error: "bad_event" }, 400);
          }
          // النية بتتربط جوه الدالة نفسها تحت قفلها بقاعدة المبلغ
          // الفريد — مفيش مسار ربط تاني بنخترعه من اللوحة.
          result = await deps.client.callAutoCreditDeposit({
            p_rail: rail,
            p_exchange_ref: String(row.exchange_ref || ""),
            p_asset: row.asset ? String(row.asset) : "",
            p_amount_usdt: amountStr,
            p_tx_hash: row.tx_hash ? String(row.tx_hash) : null,
            intentId,
          });
        } else if (action === "approve") {
          // اعتماد بلا هدف (لا مطالبة ولا نية) ممنوع: مش هنخترع
          // مسار ائتمان حر لحدث إيداع.
          return json({ ok: false, error: "needs_target" }, 400);
        } else {
          // rematch: إعادة تشغيل محرك المطابقة نفسه على الحدث.
          result = await deps.client.callAutoCreditDeposit({
            p_rail: rail,
            p_exchange_ref: String(row.exchange_ref || ""),
            p_asset: row.asset ? String(row.asset) : "",
            p_amount_usdt: amountStr,
            p_tx_hash: row.tx_hash ? String(row.tx_hash) : null,
          });
        }
        const afterRow = await deps.client.getDepositEvent(eventId);
        const after = afterRow
          ? normalizeDepositEvent(afterRow, ctx)
          : before;
        const auditOk = await audit(
          "store_event_action",
          "store_event",
          `${source}:${eventId}`,
          { status: before.status },
          { action, status: after.status },
          reason,
        );
        return json({
          ok: true,
          action,
          result,
          event: after,
          audit_failed: !auditOk,
        });
      }

      // ------------------------------------------ أحداث الرسائل
      const row = await deps.client.getSmsEvent(eventId);
      if (!row) return json({ ok: false, error: "bad_event" }, 404);
      if (String(row.source || "") !== source) {
        // مصدر الطلب لازم يطابق مصدر الحدث المخزّن بالحرف.
        return json({ ok: false, error: "bad_source" }, 400);
      }
      const before = normalizeSmsEvent(row, ctx);
      if (action === "settle_manually") {
        // التسوية اليدوية فعل إيداعات بس: أحداث الرسائل مالهاش
        // outcome أصلًا — رفض صريح بدل ما الفعل يعدّي صامتًا
        // ويرجع ok من غير ما يعمل حاجة.
        return json({ ok: false, error: "bad_action" }, 400);
      }
      if (before.status === "done") {
        // حدث مستهلَك (matched/credited): أي فعل عليه مرفوض بنيويًا.
        return json({ ok: false, error: "event_consumed" }, 409);
      }
      const matchState = String(row.match_state || "");
      let result: Record<string, unknown> | null = null;
      let orderRematch: Record<string, unknown> | null = null;
      if (action === "approve" || action === "rematch") {
        if (before.status === "ignored") {
          // إعادة المطابقة بتشتغل على unmatched بس — المتجاهل
          // لازم يتشال تجاهله الأول.
          return json({ ok: false, error: "bad_action" }, 400);
        }
        // اعتماد/إعادة معالجة رسالة = تشغيل ممر إعادة المطابقة
        // القائم نفسه (بيطابق كل المعلّق المستحق، زي ما الجسر
        // بيعمل انتهازيًا) وبعدين قراءة حالة الحدث ده بالذات.
        // وزي اللصق بالحرف: مطابقة الطلبات («أكّد الدفع») بتتعاد
        // هي كمان — الرسالة ممكن تطابق طلب مش شحنة محفظة.
        result = await deps.client.callSmsRematch(50);
        try {
          orderRematch = await deps.client.callOrderRematch(50);
        } catch (e) {
          deps.logError(
            "control.events", "action order rematch failed", e);
        }
      } else if (action === "ignore") {
        if (matchState !== "ignored") {
          const rows = await deps.client.updateSmsEventState(
            eventId,
            matchState,
            "ignored",
          );
          if (rows !== 1) {
            return json({ ok: false, error: "event_consumed" }, 409);
          }
        }
      } else if (action === "unignore") {
        if (matchState !== "unmatched") {
          const rows = await deps.client.updateSmsEventState(
            eventId,
            matchState,
            "unmatched",
          );
          if (rows !== 1) {
            return json({ ok: false, error: "event_consumed" }, 409);
          }
        }
      }
      const afterRow = await deps.client.getSmsEvent(eventId);
      const after = afterRow ? normalizeSmsEvent(afterRow, ctx) : before;
      const auditOk = await audit(
        "store_event_action",
        "store_event",
        `${source}:${eventId}`,
        { status: before.status },
        { action, status: after.status },
        reason,
      );
      return json({
        ok: true,
        action,
        result,
        order_rematch: orderRematch,
        event: after,
        audit_failed: !auditOk,
      });
    } catch (e) {
      deps.logError("control.events", "store event action failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  return null;
}
