/**
 * لوحة التحكم — المرحلة م١-أ: العملاء والمحافظ (موقع + بوت).
 *
 * المسارات (كلها ورا فاحص x-migo-admin المشترك، زي /control/home):
 *   GET  /control/store-customer?id=<uuid> | ?email=<email>
 *   POST /control/store-topup-decide   {topup_id, action, note?}
 *   POST /control/store-wallet-adjust  {customer_id, mode, amount_egp|
 *                                       target_egp, kind, reason,
 *                                       idempotency_key}
 *   GET  /control/bot-customer?ref=<chat_id>
 *   POST /control/bot-topup-decide     → تمرير لنقطة البوت
 *   POST /control/bot-wallet-adjust    → تمرير لنقطة البوت
 *   POST /control/bot-wallet-transfer  → تمرير لنقطة البوت
 *   POST /control/bot-wallet-reverse   → تمرير لنقطة البوت
 *   GET  /control/customers/search?q=<أي معرّف>
 *
 * أفعال الموقع بتتنفّذ بدوال القاعدة الداخلية بس (هجرة 009/022/023):
 * الاعتماد بـ wallet_credit_topup_internal، والرفض بـ
 * wallet_reject_topup_internal، والتعديل (إضافة/خصم) بـ
 * wallet_adjust_internal، و«اضبط على» بـ wallet_set_balance_internal
 * (الفرق بيتحسب جوه القاعدة تحت قفل صف المحفظة — مفيش قراءة رصيد
 * وحساب فرق في طبقة Deno، والـ ref بيستهلك حتى لو الفرق صفر).
 * — مفيش كتابة جداول مباشرة من هنا أبدًا. أفعال البوت تمرير خادمي
 * لنقاط البوت الداخلية باعتماد الجسر القائم: رد البوت (حالة + جسم)
 * بيعدّي زي ما هو، وفشل الاتصال/الضبط = 502 bot_unavailable —
 * ممنوع اختراع بيانات أو نجاح.
 *
 * هوية عميل الموقع = auth.users: الإيميل بيتحل عبر GoTrue Admin
 * API بمفتاح الخدمة (بحث صفحات بمطابقة تامة)، وفشل الحل = 404
 * صادق — مفيش عميل وهمي.
 */

// ------------------------------------------------------------- البيانات
export interface StoreCustomer {
  id: string;
  email: string | null;
  balance_egp: number | string;
}

export interface StoreCustomerData {
  customer: StoreCustomer;
  topups: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  orders: Record<string, unknown>[];
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface SenderAccountMatch {
  id: string; // customer_id
  balance_egp: number | string;
}

export interface ControlCustomersClient {
  resolveEmail(email: string): Promise<AuthUser | null>;
  getUserById(id: string): Promise<AuthUser | null>;
  walletBalance(customerId: string): Promise<number>;
  fetchStoreCustomer(
    id: string,
    email: string | null,
  ): Promise<StoreCustomerData>;
  creditTopupInternal(
    topupId: string,
    note: string | null,
  ): Promise<Record<string, unknown>>;
  rejectTopupInternal(
    topupId: string,
    note: string | null,
  ): Promise<Record<string, unknown>>;
  adjustInternal(args: {
    customerId: string;
    delta: number;
    kind: string;
    ref: string;
    note: string;
  }): Promise<Record<string, unknown>>;
  setBalanceInternal(args: {
    customerId: string;
    target: number;
    kind: string;
    ref: string;
    note: string;
  }): Promise<Record<string, unknown>>;
  searchBySenderAccount(q: string): Promise<SenderAccountMatch[]>;
}

export interface BotProxyResult {
  status: number;
  body: Record<string, unknown>;
}

export interface BotControlProxyClient {
  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult>;
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** عميل قراءة/نداء PostgREST + GoTrue Admin، بنفس نمط باقي الوحدات. */
export class PostgrestControlCustomersClient
  implements ControlCustomersClient {
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
      throw new Error(`control read http ${res.status}: ${text.slice(0, 200)}`);
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      // جسم خطأ PostgREST بيحمل رسالة القاعدة نفسها (insufficient /
      // topup not found...) — المعالج بيصنّف منها، فبتعدّي في الرسالة.
      throw new Error(`rpc ${fn} http ${res.status}: ${text.slice(0, 300)}`);
    }
    return (json && typeof json === "object")
      ? json as Record<string, unknown>
      : { value: json };
  }

  // ----------------------------------------------------- GoTrue Admin
  async resolveEmail(email: string): Promise<AuthUser | null> {
    const target = email.trim().toLowerCase();
    if (!target) return null;
    // بحث صفحات بمطابقة تامة (GoTrue ما عندوش مرشّح إيميل خادمي
    // موثوق عبر النسخ): سقف ٢٠ صفحة × ١٠٠ — فوق كده «مش موجود»
    // صادق بدل تخمين.
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(
        `${this.opts.baseUrl}/auth/v1/admin/users?page=${page}&per_page=100`,
        { headers: this.headers() },
      );
      if (!res.ok) {
        throw new Error(`auth admin list http ${res.status}`);
      }
      const json = await res.json().catch(() => null) as
        | { users?: Record<string, unknown>[] }
        | null;
      const users = json?.users ?? [];
      for (const u of users) {
        const em = typeof u.email === "string" ? u.email : "";
        if (em.toLowerCase() === target) {
          return { id: String(u.id), email: em };
        }
      }
      if (users.length < 100) break;
    }
    return null;
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const res = await fetch(
      `${this.opts.baseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`,
      { headers: this.headers() },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`auth admin get http ${res.status}`);
    const u = await res.json().catch(() => null) as
      | Record<string, unknown>
      | null;
    if (!u || typeof u.id !== "string") return null;
    return {
      id: u.id,
      email: typeof u.email === "string" ? u.email : null,
    };
  }

  // -------------------------------------------------------- المحفظة
  async walletBalance(customerId: string): Promise<number> {
    const rows = await this.get(
      `customer_wallets?customer_id=eq.${customerId}&select=balance_egp`,
    );
    const raw = rows[0]?.balance_egp;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  async fetchStoreCustomer(
    id: string,
    email: string | null,
  ): Promise<StoreCustomerData> {
    const topupCols =
      "id,amount_egp,payment_method,sender_account,status,transfer_ref,decision_note,created_at,decided_at";
    const txCols = "id,kind,amount_egp,ref,order_ref,note,created_at";
    const orderCols =
      "id,order_ref,customer_email,sender_account,payment,server_total,status,created_at";
    const orderFilter = email
      ? `or=(customer_id.eq.${id},customer_email.eq.${
        encodeURIComponent(email)
      })`
      : `customer_id=eq.${id}`;
    const [balance, topups, transactions, orders] = await Promise.all([
      this.walletBalance(id),
      this.get(
        `wallet_topups?customer_id=eq.${id}&select=${topupCols}` +
          `&order=created_at.desc&limit=10`,
      ),
      this.get(
        `wallet_transactions?customer_id=eq.${id}&select=${txCols}` +
          `&order=created_at.desc&limit=20`,
      ),
      this.get(
        `orders?${orderFilter}&select=${orderCols}` +
          `&order=created_at.desc&limit=10`,
      ),
    ]);
    return {
      customer: { id, email, balance_egp: balance },
      topups,
      transactions,
      orders,
    };
  }

  creditTopupInternal(topupId: string, note: string | null) {
    return this.rpc("wallet_credit_topup_internal", {
      p_topup_id: topupId,
      p_note: note,
    });
  }

  rejectTopupInternal(topupId: string, note: string | null) {
    return this.rpc("wallet_reject_topup_internal", {
      p_topup_id: topupId,
      p_note: note,
    });
  }

  adjustInternal(args: {
    customerId: string;
    delta: number;
    kind: string;
    ref: string;
    note: string;
  }) {
    return this.rpc("wallet_adjust_internal", {
      p_customer_id: args.customerId,
      p_delta: args.delta,
      p_kind: args.kind,
      p_ref: args.ref,
      p_note: args.note,
    });
  }

  setBalanceInternal(args: {
    customerId: string;
    target: number;
    kind: string;
    ref: string;
    note: string;
  }) {
    return this.rpc("wallet_set_balance_internal", {
      p_customer_id: args.customerId,
      p_target: args.target,
      p_kind: args.kind,
      p_ref: args.ref,
      p_note: args.note,
    });
  }

  async searchBySenderAccount(q: string): Promise<SenderAccountMatch[]> {
    const needle = q.replace(/[%_\\]/g, "\\$&");
    const rows = await this.get(
      `wallet_topups?sender_account=ilike.%25${encodeURIComponent(needle)}%25` +
        `&select=customer_id,created_at&order=created_at.desc&limit=50`,
    );
    const seen = new Set<string>();
    const matches: SenderAccountMatch[] = [];
    for (const r of rows) {
      const cid = typeof r.customer_id === "string" ? r.customer_id : "";
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      matches.push({ id: cid, balance_egp: await this.walletBalance(cid) });
      if (matches.length >= 10) break;
    }
    return matches;
  }
}

// ------------------------------------------------- عميل البوت (الجسر)
export interface BotProxyOptions {
  baseUrlOf: () => string; // SHEERID_BRIDGE_URL بعد فرض https (sheerid/config)
  bridgeTokenOf: () => Promise<string>; // env أولًا وإلا backend_config
  timeoutMs?: number;
}

/**
 * تمرير خادمي لنقاط البوت الداخلية /api/control/* بنفس اعتماد
 * الجسر القائم (ترويسة x-bridge-token). أي رد HTTP بيعدّي بحالته
 * وجسمه زي ما هما؛ الفشل الوحيد اللي بيترفع كاستثناء هو غياب
 * الضبط أو الشبكة — المعالج بيحوّله لـ bot_unavailable صادق.
 */
export class BridgeBotControlProxyClient implements BotControlProxyClient {
  private opts: BotProxyOptions;
  constructor(opts: BotProxyOptions) {
    this.opts = opts;
  }
  async proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    const base = (this.opts.baseUrlOf() || "").replace(/\/+$/, "");
    const token = (await this.opts.bridgeTokenOf()) || "";
    if (!base || !token) throw new Error("bot bridge not configured");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? 8000,
    );
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          "x-bridge-token": token,
          "Accept": "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new Error("bot control bad response");
      }
      return { status: res.status, body: json as Record<string, unknown> };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ------------------------------------------------------------- المعالج
export interface ControlCustomersDeps {
  client: ControlCustomersClient;
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

const ADJUST_KINDS = ["deposit", "compensation", "correction"];

/**
 * مبلغ من جسم الطلب — صارم عمدًا (إصلاح مراجعة م١-أ): أرقام JSON بس.
 * التحويل الضمني كان بيعدّي "" و null و false كـ 0 (هدف «اضبط على»
 * فاضي = تصفير محفظة) و true كـ 1، وبيعدّي كسور أصغر من القرش
 * (0.004) بتتقصّ في القاعدة بصمت. دلوقتي: أي نوع غير number، وأي
 * قيمة غير منتهية، وأي كسر أعمق من منزلتين عشريتين = مرفوض (null).
 */
function numField(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-9) return null;
  return v;
}

/**
 * معالج عملاء/محافظ اللوحة (م١-أ) — بيتركب في api.ts على مسارات
 * /control/* الجديدة. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlCustomersRequest(
  req: Request,
  deps: ControlCustomersDeps,
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

  const isStoreCustomer = path.endsWith("/control/store-customer");
  const isStoreDecide = path.endsWith("/control/store-topup-decide");
  const isStoreAdjust = path.endsWith("/control/store-wallet-adjust");
  const isBotCustomer = path.endsWith("/control/bot-customer");
  const isSearch = path.endsWith("/control/customers/search");
  const botPostRoutes: Record<string, string> = {
    "/control/bot-topup-decide": "/api/control/topup-decide",
    "/control/bot-wallet-adjust": "/api/control/wallet-adjust",
    "/control/bot-wallet-transfer": "/api/control/wallet-transfer",
    "/control/bot-wallet-reverse": "/api/control/wallet-reverse",
  };
  const botPostSuffix = Object.keys(botPostRoutes).find((s) =>
    path.endsWith(s)
  );

  if (
    !isStoreCustomer && !isStoreDecide && !isStoreAdjust && !isBotCustomer &&
    !isSearch && !botPostSuffix
  ) {
    return null;
  }

  const needsPost = isStoreDecide || isStoreAdjust || !!botPostSuffix;
  if (needsPost && req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!needsPost && req.method !== "GET") {
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

  // ------------------------------------------------ تمرير البوت (POST)
  if (botPostSuffix) {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    try {
      const r = await deps.botClient.proxy(
        "POST",
        botPostRoutes[botPostSuffix],
        body,
      );
      return json(r.body, r.status);
    } catch (e) {
      deps.logError("control.customers", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  }

  // -------------------------------------------------- عميل البوت (GET)
  if (isBotCustomer) {
    const ref = (url.searchParams.get("ref") || "").trim();
    if (!ref) return json({ ok: false, error: "ref_required" }, 400);
    try {
      const r = await deps.botClient.proxy(
        "GET",
        `/api/control/customer?ref=${encodeURIComponent(ref)}`,
      );
      return json(r.body, r.status);
    } catch (e) {
      deps.logError("control.customers", "bot customer failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  }

  // --------------------------------------------------- ملف عميل الموقع
  if (isStoreCustomer) {
    const idParam = (url.searchParams.get("id") || "").trim();
    const emailParam = (url.searchParams.get("email") || "").trim();
    let id = "";
    let email: string | null = null;
    try {
      if (idParam) {
        if (!isUuid(idParam)) {
          return json({ ok: false, error: "bad_id" }, 400);
        }
        id = idParam;
        const user = await deps.client.getUserById(id);
        email = user?.email ?? null;
      } else if (emailParam) {
        const user = await deps.client.resolveEmail(emailParam);
        if (!user) return json({ ok: false, error: "not_found" }, 404);
        id = user.id;
        email = user.email;
      } else {
        return json({ ok: false, error: "id_or_email_required" }, 400);
      }
      const data = await deps.client.fetchStoreCustomer(id, email);
      return json({ ok: true, ...data });
    } catch (e) {
      deps.logError("control.customers", "store customer failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------- قرار شحنة الموقع
  if (isStoreDecide) {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const topupId = typeof body.topup_id === "string" ? body.topup_id : "";
    const action = typeof body.action === "string" ? body.action : "";
    const note = typeof body.note === "string" && body.note.trim()
      ? body.note
      : null;
    if (!isUuid(topupId)) {
      return json({ ok: false, error: "bad_topup_id" }, 400);
    }
    if (action !== "approve" && action !== "reject") {
      return json({ ok: false, error: "bad_action" }, 400);
    }
    try {
      const r = action === "approve"
        ? await deps.client.creditTopupInternal(topupId, note)
        : await deps.client.rejectTopupInternal(topupId, note);
      if (r.already === true) {
        return json(
          { ok: false, error: "already_decided", status: r.status ?? null },
          409,
        );
      }
      return json({ ok: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("topup not found")) {
        return json({ ok: false, error: "not_found" }, 404);
      }
      deps.logError("control.customers", "store topup decide failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ تعديل رصيد الموقع
  if (isStoreAdjust) {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const customerId = typeof body.customer_id === "string"
      ? body.customer_id
      : "";
    const mode = typeof body.mode === "string" ? body.mode : "";
    const kind = typeof body.kind === "string" ? body.kind : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const idem = typeof body.idempotency_key === "string"
      ? body.idempotency_key.trim()
      : "";
    if (!isUuid(customerId)) {
      return json({ ok: false, error: "bad_customer_id" }, 400);
    }
    if (mode !== "add" && mode !== "deduct" && mode !== "set") {
      return json({ ok: false, error: "bad_mode" }, 400);
    }
    if (!ADJUST_KINDS.includes(kind)) {
      return json({ ok: false, error: "bad_kind" }, 400);
    }
    if (!reason) return json({ ok: false, error: "reason_required" }, 400);
    if (!idem) {
      return json({ ok: false, error: "idempotency_key_required" }, 400);
    }
    try {
      if (mode === "set") {
        // «اضبط على»: الهدف بيروح للدالة زي ما هو والفرق بيتحسب
        // جوه القاعدة تحت قفل صف المحفظة (هجرة 023) — قراءة الرصيد
        // وحساب الفرق هنا كانوا سباق مع أي حركة محفظة متزامنة،
        // وحالة «الهدف = الرصيد» كانت بتعدّي من غير ما تستهلك
        // مفتاح الإيدمبوتنسي.
        const target = numField(body.target_egp);
        if (target === null || target < 0) {
          return json({ ok: false, error: "bad_target" }, 400);
        }
        const r = await deps.client.setBalanceInternal({
          customerId,
          target,
          kind,
          ref: `panel:${idem}`,
          note: `[${kind}] ${reason}`,
        });
        if (r.already === true) {
          return json({
            ok: true,
            already: true,
            balance_after: r.balance_after ?? null,
          });
        }
        return json({
          ok: true,
          adjusted: r.adjusted === true,
          balance_after: r.balance_after ?? null,
        });
      }
      const amount = numField(body.amount_egp);
      if (amount === null || amount <= 0) {
        return json({ ok: false, error: "bad_amount" }, 400);
      }
      const delta = mode === "add" ? amount : -amount;
      const r = await deps.client.adjustInternal({
        customerId,
        delta,
        kind,
        ref: `panel:${idem}`,
        note: `[${kind}] ${reason}`,
      });
      if (r.already === true) {
        return json({
          ok: true,
          already: true,
          balance_after: r.balance_after ?? null,
        });
      }
      return json({ ok: true, adjusted: true, balance_after: r.balance_after ?? null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // عميل مش موجود في auth.users (هجرة 024): رفض صادق 404 —
      // مفيش محفظة بتتعمل لعميل وهمي ولا رصيد بيتحرك.
      if (msg.includes("customer_not_found")) {
        return json({ ok: false, error: "customer_not_found" }, 404);
      }
      // نفس الـ ref مربوط بعميل تاني (هجرة 023): تعارض حقيقي مش
      // إعادة — 409 بدل ما يرجع نجاح وهمي برصيد عميل تاني.
      if (msg.includes("ref_conflict")) {
        return json({ ok: false, error: "ref_conflict" }, 409);
      }
      if (msg.includes("insufficient")) {
        return json({ ok: false, error: "insufficient" }, 422);
      }
      deps.logError("control.customers", "store wallet adjust failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------------ البحث الموحد
  if (isSearch) {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return json({ ok: false, error: "q_required" }, 400);

    let bot: unknown = null;
    let botUnavailable = false;
    try {
      const r = await deps.botClient.proxy(
        "GET",
        `/api/control/customers/search?q=${encodeURIComponent(q)}`,
      );
      if (r.status === 200) {
        // شكل رد بحث البوت: مصفوفة نتائج تحت results/customers/
        // matches — بناخد أول حقل مصفوفة موجود، وأي شكل غير كده
        // بيعلّم عدم إتاحة بدل ما يخترع نتائج.
        const arr = [r.body.results, r.body.customers, r.body.matches]
          .find((v) => Array.isArray(v));
        if (arr) bot = arr;
        else botUnavailable = true;
      } else {
        botUnavailable = true;
      }
    } catch (e) {
      botUnavailable = true;
      deps.logError("control.customers", "bot search failed", e);
    }

    const store: StoreCustomer[] = [];
    try {
      if (isUuid(q)) {
        const user = await deps.client.getUserById(q).catch(() => null);
        const balance = await deps.client.walletBalance(q);
        if (user || balance !== 0) {
          store.push({ id: q, email: user?.email ?? null, balance_egp: balance });
        }
      } else if (q.includes("@")) {
        const user = await deps.client.resolveEmail(q);
        if (user) {
          store.push({
            id: user.id,
            email: user.email,
            balance_egp: await deps.client.walletBalance(user.id),
          });
        }
      } else {
        const matches = await deps.client.searchBySenderAccount(q);
        for (const m of matches) {
          const user = await deps.client.getUserById(m.id).catch(() => null);
          store.push({
            id: m.id,
            email: user?.email ?? null,
            balance_egp: m.balance_egp,
          });
        }
      }
    } catch (e) {
      deps.logError("control.customers", "store search failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }

    return json({ ok: true, bot, bot_unavailable: botUnavailable, store });
  }

  return null;
}
