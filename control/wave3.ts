// لوحة التحكم — موجة Instinct التالتة (البنود ١٥–٢٢، خلفية بس):
//   ١٥) GET  /control/notifications      — حالات محتاجة فعل،
//        مشتقة من مصادر قائمة بس (محادثات البوت، شحنات البوت
//        والموقع المنتظرة، توصيلات التجار الفاشلة من رئيسية
//        البوت، وممرات الدفع الواقفة/رسائل قديمة من المكونات
//        والرئيسية) — مفيش تخزين جديد ومفيش أرقام مخترعة: كل
//        مصدر بيقرا لوحده وفشله بيتصرح بيه في unavailable.
//   ١٦) GET  /control/search?q=          — بحث واحد مصنف
//        {orders, events, customers, products, merchants} فوق
//        مسارات البحث/القراءة القائمة لكل نوع، بحد لكل مجموعة،
//        وكل نتيجة شايلة مصدرها ومعرّفها — الاسم لوحده عمره
//        ما بيدمج شخصين.
//   ١٧) GET/POST /control/followups + POST /control/followups-close
//        — متابعات داخلية على حالة واحدة في جدول اللوحة الجديد
//        control_followups (هجرة 038). الإغلاق بيكتب في جدول
//        المتابعات بس بالبناء: عميل الوحدة دي مالوش أي طريقة
//        كتابة تانية، فحالة العنصر وفلوسه مستحيل يتمسّوا منها.
//   ١٨) GET  /control/diagnose?kind=&id= — «افحص السبب»: نقاط
//        فحص مرتبة من قراءات قائمة بس (اتسجل الدفع؟ اتربط؟
//        المورد رد؟ التسليم اتأكد؟) بحالات مؤكد/غير مؤكد/مش
//        معروف — اللي البيانات ما تثبتوش بيظهر «مش معروف»
//        بالحرف، مفيش تشخيص متخيل. قراءة بس.
//   ١٩) GET/PUT/DELETE /control/drafts?key= — مسودات نصوص
//        طويلة بس (قناة/موقع/أسئلة/دعم) في control_drafts
//        (هجرة 038). أي مفتاح أو قيمة شكلها سر بتترفض صراحة
//        قبل أي كتابة.
//   ٢٠) GET  /control/impact?kind=&id=   — أثر تغيير قبل تنفيذه:
//        العناصر اللي النظام يقدر يثبت ارتباطها بس، مفصولة
//        «طلبات قائمة» عن «مشتريات جديدة»، وقائمة unknowns
//        صريحة لأي أثر مش قابل للإثبات. قراءة بس.
//   ٢١) POST /control/bulk {action, ids} — جماعي محدود لغير
//        الفلوس بس: catalog.archive و coupons.stop حصرًا،
//        بتنفيذ مسار العنصر القائم نفسه لكل معرّف ونتيجة لكل
//        عنصر لوحده. أي فعل تاني (وبالذات أي فعل فلوس) رفض.
//   ٢٢) GET  /control/product-preview?id= — معاينة البوت القائمة
//        (preview.ts) وعرض الموقع لنفس المنتج (ربط الهوية اللي
//        catalog.ts بيستخدمه + كتالوج الموقع من get_catalog)
//        جنب بعض في رد واحد؛ غياب أي جهة بيتصرح بيه بسببها.
//
// قواعد الموجة كلها: بوابة الأدمن على كل مسار، مفيش أي كتابة
// رصيد أو حركة فلوس في أي مسار هنا، مفيش أسرار في أي رد
// (الحقول بتتاخد بقوائم بيضاء)، والفشل الجزئي بيتصرح بيه
// بمصدره بدل ما يخفي باقي النتائج أو يخترع بديل.

import type { BotControlProxyClient, BotProxyResult } from "./customers.ts";
import type { BotHomeClient, ControlStoreClient } from "./mod.ts";
import { parseCountRange } from "./mod.ts";
import type { ControlCustomersClient } from "./customers.ts";
import type { ControlOrdersClient, StoreOrderRow } from "./orders.ts";
import type { ControlEventsClient } from "./events.ts";
import { depositStatusOf, smsStatusOf } from "./events.ts";
import type { ControlCouponsClient } from "./coupons.ts";
import type { ControlSiteClient } from "./site.ts";
import type { ControlPricesClient } from "./prices.ts";

// ------------------------------------------------------------- الثوابت
/**
 * عتبة «تطبيق الرسائل ساكت»: ٦ ساعات — دي العتبة القائمة أصلًا
 * في عرض المكونات باللوحة (renderComponents: آخر رسالة من أكتر
 * من ٦ ساعات = تنبيه راجع التطبيق)، فالتنبيه هنا بيستخدم نفس
 * الرقم الموجود مش رقم جديد.
 */
export const SMS_STALE_HOURS = 6;
/** حد نتائج كل مجموعة في البحث الموحد (بند ١٦). */
export const SEARCH_GROUP_CAP = 10;
/** حد العناصر في أي فعل جماعي (بند ٢١). */
export const BULK_MAX_IDS = 50;
/** أنواع الكيانات اللي المتابعة بتتربط بيها (بند ١٧). */
export const FOLLOWUP_ENTITY_KINDS = [
  "order",
  "event",
  "topup",
  "chat",
  "customer",
  "product",
  "merchant",
] as const;
/** الأفعال الجماعية المسموحة حصرًا (بند ٢١) — غير الفلوس بس. */
export const BULK_ACTIONS = ["catalog.archive", "coupons.stop"] as const;
/**
 * مفاتيح المسودات المسموحة (بند ١٩): بادئة نوع المحرر + اسم
 * حر محدود الحروف. أي مفتاح برّه الشكل ده بيترفض، وأي مفتاح
 * شايل كلمة سرية بيترفض قبله بقاعدة مستقلة تحت.
 */
export const DRAFT_KEY_RE = /^(channel|site|faq|support):[A-Za-z0-9._-]{1,80}$/;

// ------------------------------------------------------------- الأنواع
export interface FollowupRow {
  id: string;
  entity_kind: string;
  entity_id: string;
  note: string;
  due_at: string | null;
  status: string;
  created_at: string | null;
  closed_at: string | null;
}

export interface DraftRow {
  key: string;
  text: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface PendingStoreTopupRow {
  id: string;
  customer_id: string | null;
  amount_egp: number | string | null;
  payment_method: string | null;
  transfer_ref: string | null;
  created_at: string | null;
}

export interface StoreTopupRow extends PendingStoreTopupRow {
  status: string | null;
  sender_account: string | null;
  decided_at: string | null;
}

/** عميل جداول اللوحة الجديدة + قراءات موقع إضافية للموجة دي. */
export interface Wave3StoreClient {
  listFollowups(filter: {
    status: string | null;
    entityKind: string | null;
    entityId: string | null;
  }): Promise<FollowupRow[]>;
  insertFollowup(input: {
    entity_kind: string;
    entity_id: string;
    note: string;
    due_at: string | null;
  }): Promise<FollowupRow>;
  getFollowup(id: string): Promise<FollowupRow | null>;
  /** إغلاق محروس بالحالة المفتوحة — بيرجع الصف أو null لو سباق. */
  closeFollowup(id: string, closedAtIso: string): Promise<FollowupRow | null>;
  getDraft(key: string): Promise<DraftRow | null>;
  upsertDraft(key: string, text: string): Promise<DraftRow>;
  deleteDraft(key: string): Promise<boolean>;
  listPendingStoreTopups(limit: number): Promise<PendingStoreTopupRow[]>;
  getStoreTopup(id: string): Promise<StoreTopupRow | null>;
  countPendingTopupsByMethod(method: string): Promise<number>;
  listPendingTopupsByMethod(
    method: string,
    limit: number,
  ): Promise<PendingStoreTopupRow[]>;
  searchStoreOrders(q: string, limit: number): Promise<StoreOrderRow[]>;
}

export interface ControlWave3Deps {
  store: Wave3StoreClient;
  homeStore: ControlStoreClient;
  botHome: BotHomeClient;
  botClient: BotControlProxyClient;
  customers: Pick<
    ControlCustomersClient,
    "getUserById" | "resolveEmail" | "searchBySenderAccount" | "walletBalance"
  >;
  orders: Pick<
    ControlOrdersClient,
    "listOrders" | "getOrder" | "findWalletPayDebit"
  >;
  events: Pick<
    ControlEventsClient,
    "fetchSmsEvents" | "fetchDepositEvents" | "getSmsEvent" | "getDepositEvent"
  >;
  coupons: Pick<ControlCouponsClient, "getCoupon" | "updateCoupon">;
  site: Pick<
    ControlSiteClient,
    "listPaymentMethods" | "getPaymentMethod" | "listSiteContent"
  >;
  prices: Pick<ControlPricesClient, "getCatalog">;
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

// ------------------------------------------------- أدوات نقية (بتتختبر)
/** أول مصفوفة موجودة بين المفاتيح المرشحة — نمط pickArr بتاع اللوحة. */
export function arrOf(
  body: Record<string, unknown> | null | undefined,
  keys: string[],
): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  for (const k of keys) {
    const v = body[k];
    if (Array.isArray(v)) {
      return v.filter((x) =>
        x && typeof x === "object" && !Array.isArray(x)
      ) as Record<string, unknown>[];
    }
  }
  return [];
}

export function strOf(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** مرجع محادثة من صف محادثات البوت — نفس تسامح اللوحة مع الشكل. */
export function chatRefOf(c: Record<string, unknown>): string {
  return strOf(c.customer_ref || c.chat_id || c.ref || c.id || "");
}

export function chatSinceOf(c: Record<string, unknown>): string | null {
  const lm = c.last_message && typeof c.last_message === "object"
    ? c.last_message as Record<string, unknown>
    : null;
  const v = c.last_at || (lm && lm.created_at) || c.updated_at ||
    c.created_at;
  return v ? String(v) : null;
}

/**
 * حالة ممر دفع عند البوت من حمولة المكونات — نفس قراءة اللوحة
 * (evLaneOn) بالحرف: خريطة lanes/rails أو قائمة components،
 * والغياب = null («مش معروف») مش اختراع حالة.
 */
export function laneOn(
  payload: Record<string, unknown> | null,
  lane: string,
): boolean | null {
  if (!payload) return null;
  const lanes = (payload.lanes || payload.rails || {}) as Record<
    string,
    unknown
  >;
  let v: unknown = lanes[lane];
  if (v === undefined) v = payload[lane];
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    v = o.on !== undefined ? o.on : o.enabled;
  }
  if (typeof v === "boolean") return v;
  if (Array.isArray(payload.components)) {
    for (const raw of payload.components) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      if (c.key === lane || c.lane === lane || c.id === lane) {
        const w = c.on !== undefined
          ? c.on
          : (c.enabled !== undefined ? c.enabled : c.active);
        if (typeof w === "boolean") return w;
      }
    }
  }
  return null;
}

/** كلمة سرية كمكوّن مستقل في المفتاح (monkey ما بتتمسكش). */
const SECRET_WORD_RE =
  /(^|[^a-z])(api[-_]?key|secret|token|password|passwd)([^a-z]|$)/i;

export function draftKeyLooksSecret(key: string): boolean {
  return SECRET_WORD_RE.test(key);
}

/**
 * أشكال اعتماد واضحة في قيمة مسودة: مفتاح خاص، JWT، مفاتيح
 * خدمات معروفة البادئة، سطر «سر: قيمة»، أو القيمة كلها توكن
 * واحد طويل بلا مسافات. نص عربي/إنجليزي عادي طويل ما بيتمسكش
 * (المسودات للنصوص الطويلة أصلًا).
 */
export function looksLikeSecretText(text: string): boolean {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) return true;
  if (
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/
      .test(text)
  ) return true;
  if (
    /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/
      .test(text)
  ) return true;
  if (
    /(api[_-]?key|api[_-]?secret|secret|token|password|passwd)\s*[:=]\s*\S+/i
      .test(text)
  ) return true;
  const t = text.trim();
  if (/^[A-Za-z0-9_\-+/=]{40,}$/.test(t)) return true;
  if (/^[0-9a-fA-F]{32,}$/.test(t)) return true;
  return false;
}

/** مزوّد صف طلب/منتج بوت من أي حقل معروف — غيابه = "" (مش إثبات). */
export function providerSlugOf(row: Record<string, unknown>): string {
  const ex = row.executing && typeof row.executing === "object"
    ? row.executing as Record<string, unknown>
    : null;
  return strOf(
    row.provider_slug || row.supplier_slug || row.supplier_key ||
      row.provider || (ex && (ex.provider_slug || ex.slug || ex.provider)) ||
      "",
  );
}

const TERMINAL_ORDER_STATUSES = new Set([
  "fulfilled",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
  "closed",
  "done",
]);

export function isOpenOrderStatus(status: string): boolean {
  return !TERMINAL_ORDER_STATUSES.has(status.toLowerCase());
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const FOLLOWUP_SELECT =
  "id,entity_kind,entity_id,note,due_at,status,created_at,closed_at";
const DRAFT_SELECT = "key,text,created_at,updated_at";
const PENDING_TOPUP_SELECT =
  "id,customer_id,amount_egp,payment_method,transfer_ref,created_at";
const STORE_TOPUP_SELECT =
  "id,customer_id,amount_egp,payment_method,sender_account,transfer_ref," +
  "status,created_at,decided_at";
// نفس أعمدة orders.ts ORDER_SELECT بالحرف.
const WAVE3_ORDER_SELECT =
  "id,order_ref,customer_email,items,total_text,server_total,status," +
  "payment,customer_id,created_at";

function ilikePattern(q: string): string {
  // نفس حماية money.ts/events.ts: حروف بنية PostgREST بتتشال
  // قبل التضمين في or=(...) وبعدها تهريب وحيدات LIKE نفسها.
  const safe = q.replace(/[(),"*]/g, "");
  return `%${safe.replace(/[%_\\]/g, "\\$&")}%`;
}

/** عميل قراءة/كتابة PostgREST لوحدة الموجة التالتة، بنفس نمط العملاء. */
export class PostgrestWave3Client implements Wave3StoreClient {
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
      throw new Error(
        `control wave3 read http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async write(
    method: string,
    path: string,
    body?: unknown,
    prefer = "return=representation",
  ): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
        "Prefer": prefer,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control wave3 write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------ المتابعات
  async listFollowups(filter: {
    status: string | null;
    entityKind: string | null;
    entityId: string | null;
  }): Promise<FollowupRow[]> {
    const params: string[] = [`select=${FOLLOWUP_SELECT}`];
    if (filter.status) {
      params.push(`status=eq.${encodeURIComponent(filter.status)}`);
    }
    if (filter.entityKind) {
      params.push(
        `entity_kind=eq.${encodeURIComponent(filter.entityKind)}`,
      );
    }
    if (filter.entityId) {
      params.push(`entity_id=eq.${encodeURIComponent(filter.entityId)}`);
    }
    // المفتوحة أولًا بميعاد الرجوع الأقرب، وبعدها الأحدث عمومًا.
    params.push("order=status.asc,due_at.asc.nullslast,created_at.desc");
    params.push("limit=200");
    const rows = await this.get(`control_followups?${params.join("&")}`);
    return rows as unknown as FollowupRow[];
  }

  async insertFollowup(input: {
    entity_kind: string;
    entity_id: string;
    note: string;
    due_at: string | null;
  }): Promise<FollowupRow> {
    const rows = await this.write("POST", "control_followups", input);
    const row = rows[0] as unknown as FollowupRow | undefined;
    if (!row) throw new Error("control wave3 followup insert: no row");
    return row;
  }

  async getFollowup(id: string): Promise<FollowupRow | null> {
    const rows = await this.get(
      `control_followups?id=eq.${encodeURIComponent(id)}` +
        `&select=${FOLLOWUP_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as FollowupRow) ?? null;
  }

  async closeFollowup(
    id: string,
    closedAtIso: string,
  ): Promise<FollowupRow | null> {
    // الكتابة محروسة بالحالة المفتوحة في جملة التحديث نفسها:
    // متابعة اتقفلت من مسار تاني بين القراءة والكتابة ما
    // بتتفتحش ولا بتتقفل تاني بصمت — صفر صفوف = سباق.
    const rows = await this.write(
      "PATCH",
      `control_followups?id=eq.${encodeURIComponent(id)}&status=eq.open`,
      { status: "closed", closed_at: closedAtIso },
    );
    return (rows[0] as unknown as FollowupRow) ?? null;
  }

  // ------------------------------------------------------- المسودات
  async getDraft(key: string): Promise<DraftRow | null> {
    const rows = await this.get(
      `control_drafts?key=eq.${encodeURIComponent(key)}` +
        `&select=${DRAFT_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as DraftRow) ?? null;
  }

  async upsertDraft(key: string, text: string): Promise<DraftRow> {
    const rows = await this.write(
      "POST",
      "control_drafts?on_conflict=key",
      { key, text, updated_at: new Date().toISOString() },
      "resolution=merge-duplicates,return=representation",
    );
    const row = rows[0] as unknown as DraftRow | undefined;
    if (!row) throw new Error("control wave3 draft upsert: no row");
    return row;
  }

  async deleteDraft(key: string): Promise<boolean> {
    const rows = await this.write(
      "DELETE",
      `control_drafts?key=eq.${encodeURIComponent(key)}`,
    );
    return rows.length > 0;
  }

  // ------------------------------------------------- شحنات الموقع
  async listPendingStoreTopups(
    limit: number,
  ): Promise<PendingStoreTopupRow[]> {
    const rows = await this.get(
      `wallet_topups?status=eq.pending&select=${PENDING_TOPUP_SELECT}` +
        `&order=created_at.asc&limit=${limit}`,
    );
    return rows as unknown as PendingStoreTopupRow[];
  }

  async getStoreTopup(id: string): Promise<StoreTopupRow | null> {
    const rows = await this.get(
      `wallet_topups?id=eq.${encodeURIComponent(id)}` +
        `&select=${STORE_TOPUP_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as StoreTopupRow) ?? null;
  }

  async countPendingTopupsByMethod(method: string): Promise<number> {
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/wallet_topups?status=eq.pending` +
        `&payment_method=eq.${encodeURIComponent(method)}&select=id&limit=0`,
      { headers: { ...this.headers(), "Prefer": "count=exact" } },
    );
    if (!res.ok) {
      throw new Error(`control wave3 count http ${res.status}`);
    }
    const total = parseCountRange(res.headers.get("content-range"));
    if (total === null) {
      throw new Error("control wave3 count: no Content-Range total");
    }
    return total;
  }

  async listPendingTopupsByMethod(
    method: string,
    limit: number,
  ): Promise<PendingStoreTopupRow[]> {
    const rows = await this.get(
      `wallet_topups?status=eq.pending&payment_method=eq.${
        encodeURIComponent(method)
      }&select=${PENDING_TOPUP_SELECT}&order=created_at.asc&limit=${limit}`,
    );
    return rows as unknown as PendingStoreTopupRow[];
  }

  async searchStoreOrders(
    q: string,
    limit: number,
  ): Promise<StoreOrderRow[]> {
    const pattern = encodeURIComponent(ilikePattern(q));
    const rows = await this.get(
      `orders?select=${WAVE3_ORDER_SELECT}` +
        `&or=(order_ref.ilike.${pattern},customer_email.ilike.${pattern})` +
        `&order=created_at.desc&limit=${limit}`,
    );
    return rows as unknown as StoreOrderRow[];
  }
}

// ------------------------------------------------------------- المعالج
export interface NotificationItem {
  kind: string;
  ref: string;
  title: string;
  since: string | null;
  target: { view: string; filter?: string; id?: string };
}

const LANE_TITLES: Record<string, string> = {
  sms_auto: "طريق شحن البوت من رسائل البنك واقف",
  exchange_auto: "طريق شحن البوت من إيداعات المنصات واقف",
  stars: "شحن البوت بالنجوم واقف",
};

/**
 * معالج موجة Instinct التالتة — بيتركب في api.ts على مسارات
 * /control/*. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlWave3Request(
  req: Request,
  deps: ControlWave3Deps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...deps.corsOf(req),
      },
    });

  const ROUTES: Record<string, string[]> = {
    "/control/notifications": ["GET"],
    "/control/search": ["GET"],
    "/control/followups": ["GET", "POST"],
    "/control/followups-close": ["POST"],
    "/control/diagnose": ["GET"],
    "/control/drafts": ["GET", "PUT", "DELETE"],
    "/control/impact": ["GET"],
    "/control/bulk": ["POST"],
    "/control/product-preview": ["GET"],
  };
  const suffix = Object.keys(ROUTES)
    .sort((a, b) => b.length - a.length)
    .find((s) => path.endsWith(s));
  if (!suffix) return null;
  // الطريقة الغلط 405 قبل بوابة الأدمن وأي نداء (نمط الوحدات).
  if (!ROUTES[suffix].includes(req.method)) {
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

  const botGet = async (
    botPath: string,
  ): Promise<BotProxyResult | null> => {
    try {
      const r = await deps.botClient.proxy("GET", botPath);
      return r.status === 200 ? r : null;
    } catch {
      return null;
    }
  };

  const now = () => (deps.now ? deps.now() : new Date());

  // ------------------------------------------------- ١٥) التنبيهات
  if (suffix === "/control/notifications") {
    const items: NotificationItem[] = [];
    const seen = new Set<string>();
    const unavailable: string[] = [];
    let sourcesOk = 0;
    const push = (item: NotificationItem) => {
      const key = `${item.kind}\n${item.ref}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    // محادثات البوت من غير رد — بقائمة البوت القائمة نفسها
    // (اللوحة بتولّدها من أعلام unanswered أو قائمة جاهزة).
    {
      const r = await botGet("/api/control/chats");
      if (!r) {
        unavailable.push("bot_chats");
      } else {
        sourcesOk++;
        const flagged = arrOf(r.body, ["unanswered"]);
        const pool = flagged.length
          ? flagged
          : arrOf(r.body, ["active", "chats", "conversations"])
            .filter((c) => c.unanswered === true);
        for (const c of pool) {
          const ref = chatRefOf(c);
          if (!ref) continue;
          push({
            kind: "unanswered_chat",
            ref,
            title: `محادثة من غير رد — عميل ${ref}`,
            since: chatSinceOf(c),
            target: { view: "chats", id: ref },
          });
        }
      }
    }

    // شحنات البوت المنتظرة القرار — قائمة أحداث البوت القائمة.
    {
      const r = await botGet("/api/control/events-topups?limit=100");
      if (!r) {
        unavailable.push("bot_topups");
      } else {
        sourcesOk++;
        for (
          const t of arrOf(r.body, ["topups", "results", "items", "requests"])
        ) {
          if (strOf(t.status) !== "pending") continue;
          const id = strOf(t.id);
          if (!id) continue;
          const minor = t.amount_minor !== null &&
              t.amount_minor !== undefined
            ? Number(t.amount_minor) / 100
            : Number(t.amount);
          const amt = Number.isFinite(minor) ? ` — ${minor} ج.م` : "";
          const cust = strOf(t.customer_ref);
          push({
            kind: "bot_topup_pending",
            ref: id,
            title: `شحنة بوت مستنية قرار${amt}${
              cust ? ` من عميل ${cust}` : ""
            }`,
            since: t.created_at ? String(t.created_at) : null,
            target: { view: "events", id },
          });
        }
      }
    }

    // شحنات موقع منتظرة القرار — أقدمها أولًا من قاعدة الموقع.
    try {
      const rows = await deps.store.listPendingStoreTopups(50);
      sourcesOk++;
      for (const t of rows) {
        const amt = t.amount_egp !== null && t.amount_egp !== undefined
          ? ` — ${Number(t.amount_egp)} ج.م`
          : "";
        push({
          kind: "store_topup_pending",
          ref: String(t.id),
          title: `شحنة موقع مستنية قرار${amt}`,
          since: t.created_at ? String(t.created_at) : null,
          target: t.customer_id
            ? { view: "customers", id: String(t.customer_id) }
            : { view: "home", filter: "store_topups" },
        });
      }
    } catch (e) {
      deps.logError("control.wave3", "store pending topups failed", e);
      unavailable.push("store_topups");
    }

    // توصيلات تجار فاشلة + سكوت تطبيق الرسائل — من رئيسية
    // البوت ورئيسية الموقع القائمتين (عدّادات/أوقات بس).
    {
      let botHomeOk = false;
      try {
        const home = await deps.botHome.fetchHome();
        botHomeOk = true;
        const mt = home.merchant_tasks &&
            typeof home.merchant_tasks === "object"
          ? home.merchant_tasks as Record<string, unknown>
          : {};
        const failed = Number(mt.failed_deliveries);
        if (Number.isFinite(failed) && failed > 0) {
          push({
            kind: "merchant_delivery_failed",
            ref: "merchant-failed-deliveries",
            title: `توصيلات تجار فاشلة — ${failed} إشعار تاجر ما اتوصلش`,
            since: null,
            target: { view: "merchants" },
          });
        }
      } catch (e) {
        deps.logError("control.wave3", "bot home failed", e);
      }
      if (!botHomeOk) unavailable.push("bot_home");

      try {
        const store = await deps.homeStore.fetchStoreData();
        sourcesOk++;
        if (store.latest_sms_at) {
          const ageMs = now().getTime() -
            new Date(store.latest_sms_at).getTime();
          if (
            Number.isFinite(ageMs) &&
            ageMs > SMS_STALE_HOURS * 60 * 60 * 1000
          ) {
            push({
              kind: "payment_component_down",
              ref: "sms-app-stale",
              title:
                `تطبيق رسائل التليفون ما بعتش رسائل من أكتر من ${SMS_STALE_HOURS} ساعات`,
              since: store.latest_sms_at,
              target: { view: "events" },
            });
          }
        }
      } catch (e) {
        deps.logError("control.wave3", "store home failed", e);
        unavailable.push("store_home");
      }
    }

    // ممرات دفع واقفة — مكونات أحداث البوت القائمة.
    {
      const r = await botGet("/api/control/events-components");
      if (!r) {
        unavailable.push("payment_components");
      } else {
        sourcesOk++;
        for (const lane of Object.keys(LANE_TITLES)) {
          if (laneOn(r.body, lane) === false) {
            push({
              kind: "payment_component_down",
              ref: `lane:${lane}`,
              title: LANE_TITLES[lane],
              since: null,
              target: { view: "events" },
            });
          }
        }
      }
    }

    if (!items.length && !sourcesOk) {
      return json(
        { ok: false, error: "notifications_unavailable", unavailable },
        502,
      );
    }
    // الأقدم أولًا (خطر التأخير بيكبر مع العمر)؛ اللي مالوش
    // وقت مؤكد بييجي آخر القائمة بدل ما يتخترع له وقت.
    items.sort((a, b) => {
      const ta = a.since ? Date.parse(a.since) : Number.POSITIVE_INFINITY;
      const tb = b.since ? Date.parse(b.since) : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
    return json({
      ok: true,
      generated_at: now().toISOString(),
      items,
      unavailable,
    });
  }

  // ------------------------------------------------- ١٦) البحث الموحد
  if (suffix === "/control/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return json({ ok: false, error: "q_required" }, 400);
    if (q.length > 200) return json({ ok: false, error: "bad_query" }, 400);
    const ql = q.toLowerCase();
    const contains = (...vals: unknown[]) =>
      vals.some((v) => strOf(v).toLowerCase().includes(ql));
    const groups: Record<string, Record<string, unknown>[]> = {
      orders: [],
      events: [],
      customers: [],
      products: [],
      merchants: [],
    };
    const truncated: Record<string, boolean> = {};
    const unavailable: string[] = [];
    const cap = (group: string, hits: Record<string, unknown>[]) => {
      truncated[group] = truncated[group] === true ||
        hits.length > SEARCH_GROUP_CAP;
      groups[group].push(...hits.slice(0, SEARCH_GROUP_CAP));
    };

    // العملاء: بحث البوت القائم + مسارات عميل الموقع القائمة
    // (نفس منطق customers.ts بالحرف — معرّف/إيميل/حساب مرسل).
    {
      const hits: Record<string, unknown>[] = [];
      const r = await botGet(
        `/api/control/customers/search?q=${encodeURIComponent(q)}`,
      );
      if (!r) unavailable.push("bot_customers");
      else {
        for (
          const c of arrOf(r.body, ["results", "customers", "matches"])
        ) {
          const id = strOf(c.id || c.ref || c.customer_ref || c.chat_id);
          if (!id) continue;
          hits.push({
            source: "bot",
            id,
            identifier: id,
            label: strOf(c.name || c.username || c.email || "") || null,
          });
        }
      }
      try {
        const isUuid =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
            .test(q);
        if (isUuid) {
          const user = await deps.customers.getUserById(q).catch(() => null);
          const balance = await deps.customers.walletBalance(q);
          if (user || balance !== 0) {
            hits.push({
              source: "site",
              id: q,
              identifier: q,
              label: user?.email ?? null,
            });
          }
        } else if (q.includes("@")) {
          const user = await deps.customers.resolveEmail(q);
          if (user) {
            hits.push({
              source: "site",
              id: user.id,
              identifier: user.id,
              label: user.email,
            });
          }
        } else {
          const matches = await deps.customers.searchBySenderAccount(q);
          for (const m of matches) {
            const user = await deps.customers.getUserById(m.id)
              .catch(() => null);
            hits.push({
              source: "site",
              id: m.id,
              identifier: m.id,
              label: user?.email ?? null,
            });
          }
        }
      } catch (e) {
        deps.logError("control.wave3", "store customer search failed", e);
        unavailable.push("store_customers");
      }
      cap("customers", hits);
    }

    // الطلبات: قائمة طلبات البوت (أحدث ١٠٠ — الفلترة فوقها
    // بتتصرح بحدها في truncated) + بحث طلبات الموقع الخادمي.
    {
      const hits: Record<string, unknown>[] = [];
      const r = await botGet("/api/control/orders?queue=all&limit=100");
      if (!r) unavailable.push("bot_orders");
      else {
        const rows = arrOf(r.body, ["orders", "items", "rows"]);
        if (rows.length >= 100) truncated.orders = true;
        for (const o of rows) {
          if (
            !contains(
              o.id,
              o.order_ref,
              o.customer_ref,
              o.customer_email,
              o.product_name,
              o.product_label,
              o.product,
              o.name,
            )
          ) continue;
          const id = strOf(o.id);
          if (!id) continue;
          hits.push({
            source: "bot",
            id,
            identifier: strOf(o.order_ref || id),
            status: strOf(o.status) || null,
            title: strOf(
              o.product_name || o.product_label || o.product || o.name || "",
            ) || null,
          });
        }
      }
      try {
        for (const o of await deps.store.searchStoreOrders(q, 50)) {
          const firstItem = Array.isArray(o.items) && o.items[0] &&
              typeof o.items[0] === "object"
            ? strOf((o.items[0] as Record<string, unknown>).name)
            : "";
          hits.push({
            source: "site",
            id: String(o.id),
            identifier: strOf(o.order_ref || o.id),
            status: o.status,
            title: firstItem || null,
          });
        }
      } catch (e) {
        deps.logError("control.wave3", "store order search failed", e);
        unavailable.push("store_orders");
      }
      cap("orders", hits);
    }

    // الأحداث: بحث أحداث الموقع الخادمي (نفس فلتر events.ts)
    // + شحنات البوت من نقطة أحداثها القائمة بمعامل البحث.
    {
      const hits: Record<string, unknown>[] = [];
      try {
        const filter = { source: "" as const, status: "" as const, q };
        const [sms, dep] = await Promise.all([
          deps.events.fetchSmsEvents(filter, 50),
          deps.events.fetchDepositEvents(filter, 50),
        ]);
        for (const row of sms) {
          hits.push({
            source: strOf(row.source || "sms"),
            id: String(row.id),
            identifier: strOf(row.transfer_ref || row.id),
            status: smsStatusOf(row.match_state),
          });
        }
        for (const row of dep) {
          hits.push({
            source: strOf(row.rail || "binance"),
            id: String(row.id),
            identifier: strOf(row.exchange_ref || row.id),
            status: depositStatusOf(row),
          });
        }
      } catch (e) {
        deps.logError("control.wave3", "store event search failed", e);
        unavailable.push("store_events");
      }
      const r = await botGet(
        `/api/control/events-topups?limit=50&q=${encodeURIComponent(q)}`,
      );
      if (!r) unavailable.push("bot_topups_search");
      else {
        for (
          const t of arrOf(r.body, ["topups", "results", "items", "requests"])
        ) {
          const id = strOf(t.id);
          if (!id) continue;
          hits.push({
            source: "bot_topup",
            id,
            identifier: strOf(t.operation_ref || id),
            status: strOf(t.status) || null,
          });
        }
      }
      cap("events", hits);
    }

    // المنتجات: كتالوج البوت الكامل (اللوحة بتجيبه كله أصلًا)
    // + أسماء كتالوج الموقع من get_catalog القائم.
    {
      const hits: Record<string, unknown>[] = [];
      const r = await botGet("/api/control/catalog-products");
      if (!r) unavailable.push("bot_products");
      else {
        for (const p of arrOf(r.body, ["items", "products"])) {
          if (!contains(p.id, p.name, p.slug)) continue;
          const id = strOf(p.id);
          if (!id) continue;
          hits.push({
            source: "bot",
            id,
            identifier: id,
            status: strOf(p.status) || null,
            title: strOf(p.name || p.slug || "") || null,
          });
        }
      }
      try {
        for (const row of await deps.prices.getCatalog()) {
          if (!row.sku.toLowerCase().includes(ql)) continue;
          hits.push({
            source: "site",
            id: row.sku,
            identifier: row.sku,
            title: row.sku,
            price: row.price,
          });
        }
      } catch (e) {
        deps.logError("control.wave3", "site catalog search failed", e);
        unavailable.push("site_products");
      }
      cap("products", hits);
    }

    // التجار: قائمة تجار البوت القائمة.
    {
      const hits: Record<string, unknown>[] = [];
      const r = await botGet("/api/control/merchants");
      if (!r) unavailable.push("bot_merchants");
      else {
        for (const m of arrOf(r.body, ["merchants", "items"])) {
          if (!contains(m.id, m.name, m.username)) continue;
          const id = strOf(m.id);
          if (!id) continue;
          hits.push({
            source: "bot",
            id,
            identifier: id,
            title: strOf(m.name || "") || null,
          });
        }
      }
      cap("merchants", hits);
    }

    return json({ ok: true, q, groups, truncated, unavailable });
  }

  // ------------------------------------------------- ١٧) المتابعات
  if (suffix === "/control/followups" && req.method === "GET") {
    const statusRaw = (url.searchParams.get("status") || "open").trim();
    if (!["open", "closed", "all"].includes(statusRaw)) {
      return json({ ok: false, error: "bad_status" }, 400);
    }
    const kindRaw = (url.searchParams.get("entity_kind") || "").trim();
    if (
      kindRaw &&
      !(FOLLOWUP_ENTITY_KINDS as readonly string[]).includes(kindRaw)
    ) {
      return json({ ok: false, error: "bad_entity_kind" }, 400);
    }
    const entityId = (url.searchParams.get("entity_id") || "").trim();
    try {
      const followups = await deps.store.listFollowups({
        status: statusRaw === "all" ? null : statusRaw,
        entityKind: kindRaw || null,
        entityId: entityId || null,
      });
      return json({ ok: true, followups });
    } catch (e) {
      deps.logError("control.wave3", "followups list failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  if (suffix === "/control/followups" && req.method === "POST") {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const entityKind = typeof body.entity_kind === "string"
      ? body.entity_kind.trim()
      : "";
    const entityId = typeof body.entity_id === "string"
      ? body.entity_id.trim()
      : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (
      !(FOLLOWUP_ENTITY_KINDS as readonly string[]).includes(entityKind)
    ) {
      return json({ ok: false, error: "bad_entity_kind" }, 400);
    }
    if (!entityId || entityId.length > 200) {
      return json({ ok: false, error: "bad_entity_id" }, 400);
    }
    if (!note || note.length > 1000) {
      return json({ ok: false, error: "bad_note" }, 400);
    }
    let dueAt: string | null = null;
    if (
      body.due_at !== undefined && body.due_at !== null &&
      body.due_at !== ""
    ) {
      if (typeof body.due_at !== "string") {
        return json({ ok: false, error: "bad_due_at" }, 400);
      }
      const t = Date.parse(body.due_at);
      if (!Number.isFinite(t)) {
        return json({ ok: false, error: "bad_due_at" }, 400);
      }
      dueAt = new Date(t).toISOString();
    }
    try {
      const followup = await deps.store.insertFollowup({
        entity_kind: entityKind,
        entity_id: entityId,
        note,
        due_at: dueAt,
      });
      return json({ ok: true, followup });
    } catch (e) {
      deps.logError("control.wave3", "followup create failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  if (suffix === "/control/followups-close") {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
        .test(id)
    ) {
      return json({ ok: false, error: "bad_id" }, 400);
    }
    try {
      const before = await deps.store.getFollowup(id);
      if (!before) return json({ ok: false, error: "not_found" }, 404);
      if (before.status === "closed") {
        return json({ ok: true, already: true, followup: before });
      }
      // الإغلاق بيكتب في جدول المتابعات بس — العميل ده مالوش
      // أي مسار كتابة لجدول تاني أصلًا (ضمان بالبناء).
      const closed = await deps.store.closeFollowup(
        id,
        now().toISOString(),
      );
      if (!closed) {
        const after = await deps.store.getFollowup(id);
        if (after && after.status === "closed") {
          return json({ ok: true, already: true, followup: after });
        }
        return json({ ok: false, error: "state_changed" }, 409);
      }
      return json({ ok: true, followup: closed });
    } catch (e) {
      deps.logError("control.wave3", "followup close failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------- ١٨) افحص السبب
  if (suffix === "/control/diagnose") {
    const kind = (url.searchParams.get("kind") || "").trim();
    const id = (url.searchParams.get("id") || "").trim();
    if (!["order", "event", "topup"].includes(kind)) {
      return json({ ok: false, error: "bad_kind" }, 400);
    }
    if (!id || id.length > 200) {
      return json({ ok: false, error: "bad_id" }, 400);
    }
    type Checkpoint = {
      key: string;
      label: string;
      state: "confirmed" | "unconfirmed" | "unknown";
      detail: string;
    };
    const ACTIONS: Record<string, { id: string; label: string }> = {
      payment: {
        id: "review_payment_events",
        label: "راجع أحداث الدفع واربطها بالحالة من صندوق الأحداث",
      },
      customer: {
        id: "open_customer_search",
        label: "ابحث عن العميل واربطه بالحالة",
      },
      provider: {
        id: "provider_refresh",
        label: "حدّث حالة المورد من تفاصيل الطلب",
      },
      delivery: {
        id: "open_order_detail",
        label: "افتح تفاصيل الطلب وتابع التسليم",
      },
      decision: {
        id: "decide_topup",
        label: "راجع الشحنة وخد قرارك فيها",
      },
      credit: {
        id: "review_topup_decision",
        label: "راجع قرار الشحنة وسجل المحفظة",
      },
    };
    const finish = (checkpoints: Checkpoint[]) => {
      const first = checkpoints.find((c) => c.state === "unconfirmed") ??
        checkpoints.find((c) => c.state === "unknown") ?? null;
      return json({
        ok: true,
        kind,
        id,
        checkpoints,
        first_unconfirmed: first ? first.key : null,
        suggested_action: first
          ? (ACTIONS[first.key] ?? {
            id: "open_case",
            label: "افتح الحالة وراجعها",
          })
          : {
            id: "none",
            label: "كل النقاط مؤكدة — مفيش فعل مطلوب دلوقتي",
          },
      });
    };

    // ---------------- طلب
    if (kind === "order") {
      const r = await botGet(
        `/api/control/order?id=${encodeURIComponent(id)}&kind=shop`,
      );
      const botOrder = r
        ? ((r.body.order && typeof r.body.order === "object"
          ? r.body.order as Record<string, unknown>
          : r.body) as Record<string, unknown>)
        : null;
      if (botOrder && (botOrder.id !== undefined || botOrder.status)) {
        const status = strOf(botOrder.status);
        const paidStatuses = [
          "payment_confirmed",
          "paid",
          "processing",
          "in_progress",
          "fulfilled",
          "delivered",
          "completed",
        ];
        const payment: Checkpoint = {
          key: "payment",
          label: "الدفع اتسجل",
          state: paidStatuses.includes(status) ||
              botOrder.payment_ref || botOrder.wallet_tx_id
            ? "confirmed"
            : (status === "new" || status === "pending_payment" ||
                status === "pending"
              ? "unconfirmed"
              : "unknown"),
          detail: status
            ? `حالة الطلب الحالية: ${status}`
            : "حالة الطلب مش ظاهرة في رد البوت",
        };
        const cust = strOf(
          botOrder.customer_ref || botOrder.customer_id ||
            botOrder.customer_email || "",
        );
        const customer: Checkpoint = {
          key: "customer",
          label: "الطلب اتربط بعميل",
          state: cust ? "confirmed" : "unconfirmed",
          detail: cust ? `العميل: ${cust}` : "مفيش معرّف عميل على الطلب",
        };
        const provState = strOf(
          botOrder.provider_status || botOrder.supplier_status || "",
        );
        const isManual = strOf(botOrder.fulfillment) === "manual";
        const provider: Checkpoint = {
          key: "provider",
          label: "المورد رد",
          state: provState ? "confirmed" : "unknown",
          detail: provState
            ? `حالة المورد: ${provState}`
            : (isManual
              ? "التنفيذ يدوي — مفيش رد مورد آلي يتأكد منه"
              : "مفيش حالة مورد مسجلة على الطلب"),
        };
        const delivered = ["fulfilled", "delivered", "completed"]
          .includes(status) ||
          !!botOrder.delivered_at ||
          !!botOrder.delivery_payload;
        const delivery: Checkpoint = {
          key: "delivery",
          label: "التسليم اتأكد",
          state: delivered ? "confirmed" : "unconfirmed",
          detail: delivered
            ? "التسليم متأكد من حالة الطلب"
            : `التسليم لسه مش متأكد — الحالة: ${status || "مش معروفة"}`,
        };
        return finish([payment, customer, provider, delivery]);
      }
      // طلب موقع: بالمعرّف أو بمرجع الطلب.
      try {
        let order: StoreOrderRow | null = null;
        if (
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
            .test(id)
        ) {
          order = await deps.orders.getOrder(id);
        }
        if (!order) {
          const found = await deps.store.searchStoreOrders(id, 10);
          order = found.find((o) => strOf(o.order_ref) === id) ??
            found[0] ?? null;
        }
        if (!order) return json({ ok: false, error: "not_found" }, 404);
        let walletPaid = false;
        if (order.order_ref) {
          try {
            walletPaid = !!(await deps.orders.findWalletPayDebit(
              String(order.order_ref),
            ));
          } catch {
            walletPaid = false;
          }
        }
        const payment: Checkpoint = {
          key: "payment",
          label: "الدفع اتسجل",
          state: order.status !== "new" || walletPaid
            ? "confirmed"
            : "unconfirmed",
          detail: walletPaid
            ? "مدفوع من محفظة الموقع (قيد دفع مسجل)"
            : `حالة الطلب: ${order.status}`,
        };
        const cust = strOf(order.customer_id || order.customer_email || "");
        const customer: Checkpoint = {
          key: "customer",
          label: "الطلب اتربط بعميل",
          state: cust ? "confirmed" : "unconfirmed",
          detail: cust ? `العميل: ${cust}` : "مفيش عميل مربوط بالطلب",
        };
        const provider: Checkpoint = {
          key: "provider",
          label: "المورد رد",
          state: "unknown",
          detail:
            "طلبات الموقع بينفذها منفّذ المتجر — رد المورد مش متخزن على صف الطلب نفسه",
        };
        const delivery: Checkpoint = {
          key: "delivery",
          label: "التسليم اتأكد",
          state: order.status === "fulfilled" ? "confirmed" : "unconfirmed",
          detail: order.status === "fulfilled"
            ? "الطلب منفّذ"
            : `التسليم لسه مش متأكد — الحالة: ${order.status}`,
        };
        return finish([payment, customer, provider, delivery]);
      } catch (e) {
        deps.logError("control.wave3", "diagnose store order failed", e);
        return json({ ok: false, error: "store_failed" }, 502);
      }
    }

    // ---------------- حدث
    if (kind === "event") {
      try {
        const sms = await deps.events.getSmsEvent(id);
        if (sms) {
          const linked = !!(sms.matched_topup_id || sms.matched_order_id ||
            sms.matched_bot_topup_id);
          const status = smsStatusOf(sms.match_state);
          return finish([
            {
              key: "payment",
              label: "الدفع اتسجل",
              state: sms.amount_egp !== null && sms.amount_egp !== undefined
                ? "confirmed"
                : "unconfirmed",
              detail: sms.amount_egp !== null && sms.amount_egp !== undefined
                ? `المبلغ: ${Number(sms.amount_egp)} ج.م`
                : "المبلغ مش متسجل على الحدث",
            },
            {
              key: "customer",
              label: "الحدث اتربط بشحنة أو طلب",
              state: linked ? "confirmed" : "unconfirmed",
              detail: linked
                ? "الحدث مربوط بهدف مسجل"
                : "الحدث لسه مش مربوط بأي شحنة أو طلب",
            },
            {
              key: "credit",
              label: "الشحن اتنفذ",
              state: status === "done" ? "confirmed" : "unconfirmed",
              detail: status === "done"
                ? "الحدث اتستهلك واتنفذ"
                : (status === "ignored"
                  ? "الحدث متجاهل بقرار — مش هيتنفذ"
                  : "الحدث لسه منتظر التنفيذ"),
            },
          ]);
        }
        const dep = await deps.events.getDepositEvent(id);
        if (dep) {
          const linked = !!(dep.matched_intent_id || dep.claim_id ||
            dep.matched_bot_topup_id);
          const status = depositStatusOf(dep);
          return finish([
            {
              key: "payment",
              label: "الدفع اتسجل",
              state: dep.amount_usdt !== null && dep.amount_usdt !== undefined
                ? "confirmed"
                : "unconfirmed",
              detail: dep.amount_usdt !== null && dep.amount_usdt !== undefined
                ? `المبلغ: ${Number(dep.amount_usdt)} USDT`
                : "المبلغ مش متسجل على الحدث",
            },
            {
              key: "customer",
              label: "الحدث اتربط بشحنة أو نية أو مطالبة",
              state: linked ? "confirmed" : "unconfirmed",
              detail: linked ? "الحدث مربوط بهدف مسجل" : "الحدث لسه مش مربوط",
            },
            {
              key: "credit",
              label: "الشحن اتنفذ",
              state: status === "done" ? "confirmed" : "unconfirmed",
              detail: dep.outcome === "manually_settled"
                ? "الحدث اتسوّى يدويًا برّه المنصة — مفيش شحن محفظة"
                : (status === "done"
                  ? "الإيداع اتنفذ واتربط"
                  : `النتيجة الحالية: ${strOf(dep.outcome) || "فاضية"}`),
            },
          ]);
        }
      } catch (e) {
        deps.logError("control.wave3", "diagnose event failed", e);
        return json({ ok: false, error: "store_failed" }, 502);
      }
      return json({ ok: false, error: "not_found" }, 404);
    }

    // ---------------- شحنة (topup)
    {
      try {
        const t = await deps.store.getStoreTopup(id);
        if (t) {
          const status = strOf(t.status);
          return finish([
            {
              key: "payment",
              label: "طلب الشحنة اتسجل",
              state: "confirmed",
              detail: `المبلغ: ${
                t.amount_egp !== null && t.amount_egp !== undefined
                  ? `${Number(t.amount_egp)} ج.م`
                  : "مش معروف"
              } — الطريقة: ${strOf(t.payment_method) || "مش مسجلة"}`,
            },
            {
              key: "customer",
              label: "الشحنة اتربطت بعميل ومرجع عملية",
              state: t.customer_id && t.transfer_ref
                ? "confirmed"
                : (t.customer_id || t.transfer_ref ? "unknown" : "unconfirmed"),
              detail: t.customer_id
                ? `العميل مربوط${
                  t.transfer_ref
                    ? " ومرجع العملية مسجل"
                    : " — مرجع العملية مش مسجل على الشحنة"
                }`
                : "الشحنة مش مربوطة بعميل",
            },
            {
              key: "decision",
              label: "القرار اتاخد",
              state: status && status !== "pending"
                ? "confirmed"
                : "unconfirmed",
              detail: status && status !== "pending"
                ? `الحالة: ${status}`
                : "الشحنة لسه منتظرة قرار",
            },
            {
              key: "credit",
              label: "الشحن اتنفذ في المحفظة",
              state: status === "approved" ? "confirmed" : "unconfirmed",
              detail: status === "approved"
                ? "الشحنة معتمدة — الرصيد اتشحن بقرار الاعتماد"
                : (status === "rejected"
                  ? "الشحنة اترفضت — مفيش شحن حصل"
                  : "الشحن لسه ما اتنفذش"),
            },
          ]);
        }
      } catch (e) {
        deps.logError("control.wave3", "diagnose store topup failed", e);
        return json({ ok: false, error: "store_failed" }, 502);
      }
      const r = await botGet("/api/control/events-topups?limit=100");
      const botTopup = r
        ? arrOf(r.body, ["topups", "results", "items", "requests"])
          .find((t) => strOf(t.id) === id)
        : undefined;
      if (!botTopup) return json({ ok: false, error: "not_found" }, 404);
      const status = strOf(botTopup.status);
      return finish([
        {
          key: "payment",
          label: "طلب الشحنة اتسجل",
          state: "confirmed",
          detail: `الطريقة: ${strOf(botTopup.method_label) || "مش مسجلة"}`,
        },
        {
          key: "customer",
          label: "الشحنة اتربطت بعميل ومرجع عملية",
          state: botTopup.customer_ref && botTopup.operation_ref
            ? "confirmed"
            : (botTopup.customer_ref || botTopup.operation_ref
              ? "unknown"
              : "unconfirmed"),
          detail: botTopup.customer_ref
            ? `العميل: ${strOf(botTopup.customer_ref)}${
              botTopup.operation_ref
                ? " — مرجع العملية مسجل"
                : " — مرجع العملية مش مسجل"
            }`
            : "الشحنة مش مربوطة بعميل",
        },
        {
          key: "decision",
          label: "القرار اتاخد",
          state: status && status !== "pending" ? "confirmed" : "unconfirmed",
          detail: status && status !== "pending"
            ? `الحالة: ${status}`
            : "الشحنة لسه منتظرة قرار",
        },
        {
          key: "credit",
          label: "الشحن اتنفذ في المحفظة",
          state: status === "approved" ? "confirmed" : "unconfirmed",
          detail: status === "approved"
            ? "الشحنة معتمدة عند البوت"
            : "الشحن لسه ما اتنفذش",
        },
      ]);
    }
  }

  // ------------------------------------------------- ١٩) المسودات الآمنة
  if (suffix === "/control/drafts") {
    const key = (url.searchParams.get("key") || "").trim();
    // قاعدة الأسرار قبل أي حاجة: مفتاح شايل كلمة سرية بيترفض
    // حتى لو شكله العام سليم، وقبل أي قراءة أو كتابة.
    if (key && draftKeyLooksSecret(key)) {
      return json({
        ok: false,
        error: "secret_not_allowed",
        message:
          "المفاتيح والأسرار ما بتتحفظش في المسودات — المسودات للنصوص الطويلة بس",
      }, 400);
    }
    if (!DRAFT_KEY_RE.test(key)) {
      return json({
        ok: false,
        error: "bad_key",
        message:
          "مفتاح المسودة لازم يبدأ بـ channel: أو site: أو faq: أو support: وبعده اسم بسيط",
      }, 400);
    }

    if (req.method === "GET") {
      try {
        const draft = await deps.store.getDraft(key);
        // وقت تحديث الأصل: لمسودات محتوى الموقع بس، الأصل هو
        // صف site_content بنفس اسم الجزء اللي بعد البادئة —
        // غير كده مفيش أصل قابل للقراءة من هنا وبيفضل null
        // (الواجهة تقارن بوقت المسودة نفسه، مش برقم مخترع).
        let sourceUpdatedAt: string | null = null;
        const contentKey = key.startsWith("site:")
          ? key.slice("site:".length)
          : (key.startsWith("faq:") ? "faq" : null);
        if (contentKey) {
          try {
            const rows = await deps.site.listSiteContent();
            const row = rows.find((r2) => r2.key === contentKey);
            sourceUpdatedAt = row?.updated_at ?? null;
          } catch {
            sourceUpdatedAt = null;
          }
        }
        return json({
          ok: true,
          key,
          draft: draft
            ? {
              key: draft.key,
              text: draft.text,
              created_at: draft.created_at,
              updated_at: draft.updated_at,
            }
            : null,
          source_updated_at: sourceUpdatedAt,
        });
      } catch (e) {
        deps.logError("control.wave3", "draft read failed", e);
        return json({ ok: false, error: "store_failed" }, 502);
      }
    }

    if (req.method === "DELETE") {
      try {
        const deleted = await deps.store.deleteDraft(key);
        return json({ ok: true, key, deleted });
      } catch (e) {
        deps.logError("control.wave3", "draft delete failed", e);
        return json({ ok: false, error: "store_failed" }, 502);
      }
    }

    // PUT
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const text = typeof body.text === "string" ? body.text : null;
    if (text === null || !text.trim() || text.length > 20000) {
      return json({
        ok: false,
        error: "bad_text",
        message: "نص المسودة لازم يكون نص غير فاضي ولحد ٢٠٠٠٠ حرف",
      }, 400);
    }
    if (looksLikeSecretText(text)) {
      return json({
        ok: false,
        error: "secret_like_content",
        message:
          "المسودة دي شكلها فيها بيانات سرية — المسودات للنصوص الطويلة بس، والأسرار مكانها مش هنا",
      }, 400);
    }
    try {
      const base = typeof body.base_updated_at === "string"
        ? body.base_updated_at
        : null;
      if (base) {
        const existing = await deps.store.getDraft(key);
        if (existing && existing.updated_at !== base) {
          return json({
            ok: false,
            error: "draft_changed",
            current_updated_at: existing.updated_at,
          }, 409);
        }
      }
      const draft = await deps.store.upsertDraft(key, text);
      return json({
        ok: true,
        draft: {
          key: draft.key,
          text: draft.text,
          created_at: draft.created_at,
          updated_at: draft.updated_at,
        },
      });
    } catch (e) {
      deps.logError("control.wave3", "draft write failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------- ٢٠) أثر التغيير
  if (suffix === "/control/impact") {
    const kind = (url.searchParams.get("kind") || "").trim();
    const id = (url.searchParams.get("id") || "").trim();
    if (!["supplier", "product", "paymethod"].includes(kind)) {
      return json({ ok: false, error: "bad_kind" }, 400);
    }
    if (!id || id.length > 200) {
      return json({ ok: false, error: "bad_id" }, 400);
    }
    const unknowns: string[] = [];
    const botOrders = async (): Promise<Record<string, unknown>[]> => {
      const r = await botGet("/api/control/orders?queue=all&limit=100");
      if (!r) {
        unknowns.push("طلبات البوت المفتوحة مش متاحة للقراءة دلوقتي");
        return [];
      }
      return arrOf(r.body, ["orders", "items", "rows"]);
    };

    // ---------------- مورد
    if (kind === "supplier") {
      let supplier: Record<string, unknown> | null = null;
      const sr = await botGet("/api/control/suppliers");
      if (!sr) unknowns.push("سجل الموردين مش متاح للقراءة دلوقتي");
      else {
        supplier = arrOf(sr.body, ["suppliers", "items", "providers"])
          .find((s) => strOf(s.slug || s.key || s.id) === id) ?? null;
        if (!supplier) {
          return json({ ok: false, error: "not_found" }, 404);
        }
      }
      let listings: Record<string, unknown>[] = [];
      const lr = await botGet(
        `/api/control/supplier-products?provider=${
          encodeURIComponent(id)
        }&limit=100`,
      );
      if (!lr) unknowns.push("قوائم منتجات المورد مش متاحة دلوقتي");
      else {
        listings = arrOf(lr.body, ["items", "products", "results"]);
      }
      let linkedProducts: Record<string, unknown>[] = [];
      let linkageProvable = false;
      const cr = await botGet("/api/control/catalog-products");
      if (!cr) unknowns.push("كتالوج البوت مش متاح للقراءة دلوقتي");
      else {
        const products = arrOf(cr.body, ["items", "products"]);
        linkageProvable = products.some((p) => providerSlugOf(p) !== "");
        if (linkageProvable) {
          linkedProducts = products
            .filter((p) => providerSlugOf(p) === id)
            .map((p) => ({
              id: strOf(p.id),
              title: strOf(p.name || p.slug || "") || null,
              status: strOf(p.status) || null,
            }));
        } else {
          unknowns.push(
            "ارتباط منتجات الكتالوج بالمورد مش ظاهر في بيانات المنتجات اللي البوت بيرجعها",
          );
        }
      }
      const orders = await botOrders();
      const ordersProvable = orders.some((o) => providerSlugOf(o) !== "");
      const openOrders = ordersProvable
        ? orders
          .filter((o) =>
            providerSlugOf(o) === id &&
            isOpenOrderStatus(strOf(o.status || "open"))
          )
          .map((o) => ({ id: strOf(o.id), status: strOf(o.status) || null }))
        : [];
      if (!ordersProvable && orders.length) {
        unknowns.push(
          "طلبات البوت مش شايلة معرّف مورد ظاهر — أثر الطلبات القائمة على المورد ده مش قابل للإثبات من هنا",
        );
      }
      return json({
        ok: true,
        kind,
        id,
        subject: supplier
          ? {
            name: strOf(supplier.name || supplier.slug || id),
            active: supplier.active !== false && supplier.enabled !== false,
          }
          : null,
        existing_orders: { open_orders: openOrders },
        new_purchases: {
          linked_products: linkedProducts,
          supplier_listings_count: listings.length,
        },
        unknowns,
      });
    }

    // ---------------- منتج
    if (kind === "product") {
      let product: Record<string, unknown> | null = null;
      const cr = await botGet("/api/control/catalog-products");
      if (!cr) unknowns.push("كتالوج البوت مش متاح للقراءة دلوقتي");
      else {
        product = arrOf(cr.body, ["items", "products"])
          .find((p) => strOf(p.id) === id) ?? null;
        if (!product) return json({ ok: false, error: "not_found" }, 404);
      }
      // عرض الموقع عبر ربط الهوية القائم (نفس مسار بند ٢٢).
      let storeSku: string | null = null;
      const ir = await botGet("/api/control/catalog-identity");
      if (!ir) unknowns.push("ربط هوية المنتجات مش متاح دلوقتي");
      else {
        const link = arrOf(ir.body, ["items"])
          .find((it) => strOf(it.bot_product_id) === id);
        storeSku = link ? (strOf(link.store_sku) || null) : null;
        if (!storeSku) {
          unknowns.push("المنتج مالوش اسم موقع مربوط في خريطة الهوية");
        }
      }
      let siteRow: { sku: string; price: number; kind: string } | null = null;
      if (storeSku) {
        try {
          siteRow = (await deps.prices.getCatalog())
            .find((r2) => r2.sku === storeSku) ?? null;
          if (!siteRow) {
            unknowns.push("اسم الموقع المربوط مش موجود في كتالوج الموقع");
          }
        } catch {
          unknowns.push("كتالوج الموقع مش متاح للقراءة دلوقتي");
        }
      }
      const orders = await botOrders();
      const ordersProvable = orders.some((o) => o.product_id !== undefined);
      const openBotOrders = ordersProvable
        ? orders
          .filter((o) =>
            strOf(o.product_id) === id &&
            isOpenOrderStatus(strOf(o.status || "open"))
          )
          .map((o) => ({ id: strOf(o.id), status: strOf(o.status) || null }))
        : [];
      if (!ordersProvable && orders.length) {
        unknowns.push(
          "طلبات البوت مش شايلة معرّف منتج ظاهر — طلبات المنتج القائمة مش قابلة للإثبات من صفوف الطلبات",
        );
      }
      let openStoreOrders: Record<string, unknown>[] = [];
      if (storeSku) {
        try {
          const rows = await deps.orders.listOrders(null, 100);
          openStoreOrders = rows
            .filter((o) =>
              isOpenOrderStatus(o.status) &&
              Array.isArray(o.items) &&
              o.items.some((it) =>
                it && typeof it === "object" &&
                strOf((it as Record<string, unknown>).name) === storeSku
              )
            )
            .map((o) => ({ id: String(o.id), status: o.status }));
        } catch {
          unknowns.push("طلبات الموقع مش متاحة للقراءة دلوقتي");
        }
      }
      const botStatus = product ? strOf(product.status) : "";
      return json({
        ok: true,
        kind,
        id,
        subject: product
          ? {
            name: strOf(product.name || product.slug || id),
            status: botStatus || null,
          }
          : null,
        existing_orders: {
          open_bot_orders: openBotOrders,
          open_store_orders: openStoreOrders,
        },
        new_purchases: {
          bot_surface_live: botStatus === "published",
          site_surface_live: !!siteRow,
          site_sku: storeSku,
          site_price: siteRow ? siteRow.price : null,
        },
        unknowns,
      });
    }

    // ---------------- طريقة دفع
    let method:
      | { value: string; active: boolean; note: string | null }
      | null = null;
    try {
      method = await deps.site.getPaymentMethod(id);
    } catch (e) {
      deps.logError("control.wave3", "impact paymethod read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
    if (!method) return json({ ok: false, error: "not_found" }, 404);
    let pendingCount = 0;
    let pendingSample: PendingStoreTopupRow[] = [];
    try {
      pendingCount = await deps.store.countPendingTopupsByMethod(id);
      pendingSample = await deps.store.listPendingTopupsByMethod(id, 10);
    } catch {
      unknowns.push("شحنات الموقع المنتظرة على الطريقة دي مش متاحة دلوقتي");
    }
    unknowns.push(
      "تفعيل الطريقة دي عند البوت مش قابل للإثبات من هنا — إعدادات فلوس البوت ما بترجعش قائمة طرق بمعرّفات",
    );
    return json({
      ok: true,
      kind,
      id,
      subject: { value: method.value, active: method.active },
      existing_orders: {
        pending_store_topups_count: pendingCount,
        pending_store_topups: pendingSample.map((t) => ({
          id: String(t.id),
          created_at: t.created_at,
        })),
      },
      new_purchases: {
        store_surface_enabled: method.active === true,
      },
      unknowns,
    });
  }

  // ------------------------------------------------- ٢١) الجماعي المحدود
  if (suffix === "/control/bulk") {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const action = typeof body.action === "string" ? body.action : "";
    if (!(BULK_ACTIONS as readonly string[]).includes(action)) {
      return json({
        ok: false,
        error: "action_not_allowed",
        message:
          "الفعل الجماعي ده مش مسموح — المسموح بس أرشفة منتجات (catalog.archive) أو إيقاف كوبونات (coupons.stop)، وأي فعل فلوس ممنوع جماعيًا",
      }, 400);
    }
    if (
      !Array.isArray(body.ids) || !body.ids.length ||
      body.ids.length > BULK_MAX_IDS
    ) {
      return json({ ok: false, error: "bad_ids" }, 400);
    }
    const ids: string[] = [];
    for (const raw of body.ids) {
      if (typeof raw !== "string" || !raw.trim() || raw.trim().length > 200) {
        return json({ ok: false, error: "bad_ids" }, 400);
      }
      const v = raw.trim();
      if (!ids.includes(v)) ids.push(v);
    }

    type ItemResult = {
      id: string;
      ok: boolean;
      error?: string;
      already?: boolean;
      audit_failed?: boolean;
    };
    const results: ItemResult[] = [];

    if (action === "catalog.archive") {
      // قراءة واحدة حديثة للكتالوج: حالة كل منتج بتتفحص منها
      // قبل حفظه، والمنتج المؤرشف أصلًا ما بيتحفظش تاني.
      const cr = await botGet("/api/control/catalog-products");
      if (!cr) {
        return json(
          { ok: false, error: "bot_unavailable", bot_unavailable: true },
          502,
        );
      }
      const products = arrOf(cr.body, ["items", "products"]);
      for (const pid of ids) {
        const p = products.find((x) => strOf(x.id) === pid);
        if (!p) {
          results.push({ id: pid, ok: false, error: "not_found" });
          continue;
        }
        if (strOf(p.status) === "archived") {
          results.push({ id: pid, ok: true, already: true });
          continue;
        }
        // نفس مسار حفظ المنتج القائم بنفس حقول اللوحة بالحرف —
        // البوت بيتحقق وبيتدقق عنده، ورده هو نتيجة العنصر.
        try {
          const r = await deps.botClient.proxy(
            "POST",
            "/api/control/catalog-product-save",
            {
              product_id: pid,
              name: p.name ?? "",
              description: p.description ?? "",
              category_id: p.category_id ?? null,
              status: "archived",
              sort_order: p.sort_order ?? 0,
              reason: "أرشفة جماعية من لوحة التحكم",
            },
          );
          if (r.status >= 200 && r.status < 300 && r.body?.ok !== false) {
            results.push({ id: pid, ok: true });
          } else {
            results.push({
              id: pid,
              ok: false,
              error: strOf(r.body?.error) || "bot_rejected",
            });
          }
        } catch (e) {
          deps.logError("control.wave3", "bulk archive failed", e);
          results.push({ id: pid, ok: false, error: "bot_unavailable" });
        }
      }
    } else {
      // coupons.stop — نفس مسار حفظ الكوبون القائم (قراءة ثم
      // تحديث بنفس القيم وحالة واقفة)، مع تدقيق لكل عنصر زي
      // معالج الكوبونات بالحرف. ملحوظة صدق: تحديث الكوبون
      // القائم مش محروس بشرط حالة متوقعة في عميله — الحماية
      // هنا هي إعادة القراءة قبل الكتابة مباشرة وتصريح النتيجة.
      for (const rawCode of ids) {
        const code = rawCode.toUpperCase();
        try {
          const before = await deps.coupons.getCoupon(code);
          if (!before) {
            results.push({ id: rawCode, ok: false, error: "not_found" });
            continue;
          }
          if (before.active === false) {
            results.push({ id: rawCode, ok: true, already: true });
            continue;
          }
          const updated = await deps.coupons.updateCoupon(code, {
            discount: Number(before.discount),
            active: false,
            expires_at: before.expires_at ? String(before.expires_at) : null,
            max_uses: before.max_uses === null ||
                before.max_uses === undefined
              ? null
              : Number(before.max_uses),
            min_order_egp: before.min_order_egp === null ||
                before.min_order_egp === undefined
              ? null
              : Number(before.min_order_egp),
          });
          if (!updated) {
            results.push({
              id: rawCode,
              ok: false,
              error: "state_changed",
            });
            continue;
          }
          let auditFailed = false;
          try {
            const ar = await deps.botClient.proxy(
              "POST",
              "/api/control/audit-log",
              {
                action: "store_coupon_bulk_stop",
                entity_type: "store_coupon",
                entity_ref: code,
                before,
                after: updated,
              },
            );
            if (
              ar.status < 200 || ar.status >= 300 ||
              ar.body?.ok === false
            ) auditFailed = true;
          } catch {
            auditFailed = true;
          }
          results.push({
            id: rawCode,
            ok: true,
            ...(auditFailed ? { audit_failed: true } : {}),
          });
        } catch (e) {
          deps.logError("control.wave3", "bulk coupon stop failed", e);
          results.push({ id: rawCode, ok: false, error: "store_failed" });
        }
      }
    }

    return json({
      ok: true,
      action,
      results,
      succeeded: results.filter((r2) => r2.ok).length,
      failed: results.filter((r2) => !r2.ok).length,
    });
  }

  // ------------------------------------------------- ٢٢) المعاينة المترابطة
  if (suffix === "/control/product-preview") {
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) return json({ ok: false, error: "id_required" }, 400);

    // جهة البوت: نفس نقطة معاينة المنتج القائمة (preview.ts).
    let botSide: Record<string, unknown>;
    try {
      const r = await deps.botClient.proxy(
        "GET",
        `/api/control/preview-product?product_id=${encodeURIComponent(id)}`,
      );
      if (r.status === 200 && r.body?.ok !== false) {
        botSide = {
          available: true,
          // قائمة بيضاء لحقول العرض بس — أي حقل تاني في رد
          // البوت ما بيعديش من هنا.
          preview: {
            text: typeof r.body.text === "string" ? r.body.text : null,
            has_photo: r.body.has_photo === true,
            caption_mode: r.body.caption_mode === true,
            buttons: Array.isArray(r.body.buttons) ? r.body.buttons : [],
          },
        };
      } else {
        botSide = {
          available: false,
          reason: strOf(r.body?.error) || "bot_rejected",
        };
      }
    } catch (e) {
      deps.logError("control.wave3", "product preview bot failed", e);
      botSide = { available: false, reason: "bot_unavailable" };
    }

    // جهة الموقع: ربط الهوية القائم ثم كتالوج الموقع الحي.
    let siteSide: Record<string, unknown>;
    let storeSku: string | null = null;
    const ir = await botGet("/api/control/catalog-identity");
    if (!ir) {
      siteSide = { available: false, reason: "identity_unavailable" };
    } else {
      const link = arrOf(ir.body, ["items"])
        .find((it) => strOf(it.bot_product_id) === id);
      storeSku = link ? (strOf(link.store_sku) || null) : null;
      if (!storeSku) {
        siteSide = { available: false, reason: "no_identity_link" };
      } else {
        try {
          const row = (await deps.prices.getCatalog())
            .find((r2) => r2.sku === storeSku);
          siteSide = row
            ? {
              available: true,
              presentation: {
                sku: row.sku,
                price: row.price,
                kind: row.kind,
              },
            }
            : { available: false, reason: "sku_not_on_site", sku: storeSku };
        } catch {
          siteSide = {
            available: false,
            reason: "site_catalog_unavailable",
            sku: storeSku,
          };
        }
      }
    }

    return json({ ok: true, id, bot: botSide, site: siteSide });
  }

  return null;
}
