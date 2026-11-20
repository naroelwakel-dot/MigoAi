// لوحة التحكم (المرحلة م٥-هـ): قسم الموقع — شقّان فوق قاعدة
// الموقع نفسها (بنفس نمط كوبونات م٥-ج):
// ١) طرق الدفع: قراءة/تحرير جدول payment_methods الحي (value/
// active/note) اللي دوال إنشاء الطلبات بتتحقق منه — التحرير
// بمعاينة من اللوحة وتدقيق هنا، والصفوف بتقابل أزرار إتمام
// الشراء في صفحات الموقع واحد لواحد.
// ٢) محتوى الموقع: جدول site_content (هجرة 026) — شريط إعلان
// ونص شروط بديل وأسئلة شائعة وإظهار/إخفاء أقسام ووضع صيانة،
// بيقرأه الجمهور عبر GET /site/content من نفس الملف ده.
//
// قرارات موثّقة:
// - طرق الدفع: مفيش إنشاء ولا حذف من اللوحة. كل صف في الجدول
//   بيقابل زر دفع مكتوب في صفحات الموقع، فصف جديد من اللوحة
//   مش هيظهر له زر، وحذف صف بيكسر زره — التحرير المتاح هو
//   الاسم والحالة والملحوظة بس، وتغيير الاسم بيتحذّر منه في
//   معاينة اللوحة لأنه لازم يقابله نفس الاسم على الزر.
// - الرقم/الحساب وتعليمات الدفع اللي العميل بيشوفها في نافذة
//   الدفع مكتوبة في كود الواجهة (app.js) مش في الجدول — ده
//   استثناء موثّق ومعروض في شاشة القسم نفسها.
// - أي قيمة تالفة في site_content (شكل غلط من كتابة قاعدة
//   مباشرة مثلًا) بتترجع للثابت المدمج هنا مفتاحًا بمفتاح في
//   القراءة العامة — ممنوع قيمة تالفة تُصفّر سلوك الموقع.
// - وضع الصيانة بيأثر على واجهة المتجر العامة بس (الصفحات
//   بتغطي نفسها لما تشوفه)؛ اللوحة ومسارات الأدمن ما بيقرأوش
//   محتوى الموقع العام أصلًا، فالصيانة عمرها ما تحجب الإدارة.
// - كل حفظ بيتدقق في سجل البوت الموحد، وفشل التدقيق بيتصرح
//   بيه (audit_failed) ومش بيخفي نجاح الكتابة — نفس نمط م٢/م٥-ج.

import type { BotControlProxyClient } from "./customers.ts";

// ------------------------------------------------------------ الثوابت
// معرّفات أقسام الصفحة الرئيسية العشرة زي ما هي في index.html.
export const SITE_SECTION_IDS = [
  "sec-ai",
  "sec-games",
  "sec-coins",
  "sec-live",
  "sec-social",
  "sec-entertainment",
  "sec-productivity",
  "sec-vcc",
  "reviews",
  "sec-faq",
] as const;

export const SITE_CONTENT_KEYS = [
  "announcement",
  "terms",
  "faq",
  "sections",
  "maintenance",
] as const;

export const DEFAULT_MAINTENANCE_MESSAGE =
  "الموقع متوقف مؤقتًا للصيانة والتحديث — راجعين لكم قريبًا. " +
  "لو عندك طلب شغال، تواصل معنا واتساب وهنكمله معاك.";

// الأسئلة الحية الحالية في الصفحة الرئيسية — الاحتياطي المدمج
// لما صف faq غايب أو تالف (نفس بذرة هجرة 026 بالحرف).
export const DEFAULT_FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "كيف يصلني الشحن؟",
    a: "إلى معرّف اللاعب (ID) خلال 2 إلى 5 دقائق دون كلمة مرور.",
  },
  {
    q: "هل الاشتراكات والأدوات رسمية؟",
    a: "نعم، تفعيل رسمي على بريدك مع ضمان سلامة التفعيل والتسليم من طرفنا.",
  },
  {
    q: "ما طرق الدفع المتاحة؟",
    a: "فودافون كاش، إنستاباي، باينانس، والبطاقات البنكية.",
  },
  {
    q: "هل أحتاج مشاركة كلمة مروري؟",
    a: "لا، يكفي معرّف اللاعب أو تاج الحساب فقط.",
  },
  {
    q: "هل الأسعار بالجنيه المصري؟",
    a: "نعم، كل الأسعار بالجنيه المصري (EGP).",
  },
  { q: "هل يوجد دعم فني؟", a: "نعم، دعم مباشر عبر واتساب يومياً." },
];

// ------------------------------------------------------------ الأنواع
export interface SiteContentRow {
  key: string;
  value: unknown;
  updated_at: string | null;
}

export interface PaymentMethodRow {
  value: string;
  active: boolean;
  note: string | null;
}

export interface PublicSiteContent {
  announcement: { enabled: boolean; text: string; url: string };
  terms: { text: string };
  faq: { items: { q: string; a: string }[] };
  sections: Record<string, boolean>;
  maintenance: { enabled: boolean; message: string };
}

export interface ControlSiteClient {
  listSiteContent(): Promise<SiteContentRow[]>;
  upsertSiteContent(key: string, value: unknown): Promise<SiteContentRow>;
  listPaymentMethods(): Promise<PaymentMethodRow[]>;
  getPaymentMethod(value: string): Promise<PaymentMethodRow | null>;
  updatePaymentMethod(
    originalValue: string,
    patch: { value: string; active: boolean; note: string },
  ): Promise<PaymentMethodRow | null>;
}

// ------------------------------------------- تطبيع نقي (بيتختبر)
// القراءة العامة رحيمة: أي شكل قريب بيتصلّح، وأي تلف بيرجع
// للثابت. الحفظ من اللوحة صارم (validateSiteContentInput تحت).
function objOrNull(v: unknown): Record<string, unknown> | null {
  return (v && typeof v === "object" && !Array.isArray(v))
    ? v as Record<string, unknown>
    : null;
}

function strOf(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function defaultPublicSiteContent(): PublicSiteContent {
  const sections: Record<string, boolean> = {};
  for (const id of SITE_SECTION_IDS) sections[id] = true;
  return {
    announcement: { enabled: false, text: "", url: "" },
    terms: { text: "" },
    faq: { items: DEFAULT_FAQ_ITEMS.map((i) => ({ ...i })) },
    sections,
    maintenance: { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE },
  };
}

export function normalizePublicSiteContent(
  rows: SiteContentRow[],
): PublicSiteContent {
  const out = defaultPublicSiteContent();
  const byKey = new Map<string, unknown>();
  for (const r of rows ?? []) {
    if (r && typeof r.key === "string") byKey.set(r.key, r.value);
  }

  const ann = objOrNull(byKey.get("announcement"));
  if (ann) {
    const rawUrl = strOf(ann.url, 500);
    out.announcement = {
      enabled: ann.enabled === true,
      text: strOf(ann.text, 300),
      // رابط بغير http/https (صف تالف أو مكتوب مباشرة في القاعدة
      // زي javascript:) بيتصفّر هنا زي ما الحفظ الصارم بيرفضه —
      // القراءة العامة ممنوع تقدّم للزوار مخطط روابط خطير.
      url: /^https?:\/\//i.test(rawUrl) ? rawUrl : "",
    };
    // شريط مفعّل من غير نص = مفيش شريط (نص فاضي ما يظهرش).
    if (!out.announcement.text) out.announcement.enabled = false;
  }

  const terms = objOrNull(byKey.get("terms"));
  if (terms) out.terms = { text: strOf(terms.text, 20000) };

  const faq = objOrNull(byKey.get("faq"));
  if (faq && Array.isArray(faq.items)) {
    const items: { q: string; a: string }[] = [];
    for (const raw of faq.items) {
      const it = objOrNull(raw);
      if (!it) continue;
      const q = strOf(it.q, 200).trim();
      const a = strOf(it.a, 1000).trim();
      if (q && a) items.push({ q, a });
    }
    // قائمة فاضية بعد التنظيف = تلف، نرجع للافتراضي الحي.
    if (items.length) out.faq = { items: items.slice(0, 50) };
  }

  const sec = objOrNull(byKey.get("sections"));
  if (sec) {
    for (const id of SITE_SECTION_IDS) {
      if (typeof sec[id] === "boolean") out.sections[id] = sec[id] as boolean;
    }
  }

  const maint = objOrNull(byKey.get("maintenance"));
  if (maint) {
    const message = strOf(maint.message, 300).trim();
    out.maintenance = {
      enabled: maint.enabled === true,
      message: message || DEFAULT_MAINTENANCE_MESSAGE,
    };
  }

  return out;
}

// --------------------------------- تحقق صارم لحفظ اللوحة (بيتختبر)
export function validateSiteContentInput(
  key: unknown,
  value: unknown,
): { key: string; value: unknown } | { error: string } {
  if (
    typeof key !== "string" ||
    !(SITE_CONTENT_KEYS as readonly string[]).includes(key)
  ) {
    return { error: "bad_key" };
  }
  const v = objOrNull(value);
  if (!v) return { error: "bad_value" };

  if (key === "announcement") {
    // enabled غير المنطقي مرفوض مش متحوّل بصمت لـ false (نفس
    // صرامة أقسام الصفحة تحت) — تحويل صامت ممكن يطفي إعلان شغّال.
    if (v.enabled !== undefined && typeof v.enabled !== "boolean") {
      return { error: "bad_value" };
    }
    const enabled = v.enabled === true;
    const text = typeof v.text === "string" ? v.text.trim() : null;
    const url = typeof v.url === "string" ? v.url.trim() : null;
    if (text === null || text.length > 300) return { error: "bad_value" };
    if (url === null || url.length > 500) return { error: "bad_value" };
    if (url && !/^https?:\/\//i.test(url)) return { error: "bad_value" };
    if (enabled && !text) return { error: "bad_value" };
    return { key, value: { enabled, text, url } };
  }

  if (key === "terms") {
    if (typeof v.text !== "string" || v.text.length > 20000) {
      return { error: "bad_value" };
    }
    return { key, value: { text: v.text } };
  }

  if (key === "faq") {
    if (!Array.isArray(v.items) || v.items.length > 50) {
      return { error: "bad_value" };
    }
    const items: { q: string; a: string }[] = [];
    for (const raw of v.items) {
      const it = objOrNull(raw);
      if (!it || typeof it.q !== "string" || typeof it.a !== "string") {
        return { error: "bad_value" };
      }
      const q = it.q.trim();
      const a = it.a.trim();
      if (!q || q.length > 200 || !a || a.length > 1000) {
        return { error: "bad_value" };
      }
      items.push({ q, a });
    }
    if (!items.length) return { error: "bad_value" };
    return { key, value: { items } };
  }

  if (key === "sections") {
    const out: Record<string, boolean> = {};
    for (const [k, val] of Object.entries(v)) {
      if (!(SITE_SECTION_IDS as readonly string[]).includes(k)) {
        return { error: "bad_value" };
      }
      if (typeof val !== "boolean") return { error: "bad_value" };
      out[k] = val;
    }
    return { key, value: out };
  }

  // maintenance
  if (v.enabled !== undefined && typeof v.enabled !== "boolean") {
    return { error: "bad_value" };
  }
  const enabled = v.enabled === true;
  const message = typeof v.message === "string" ? v.message.trim() : null;
  if (message === null || message.length > 300) {
    return { error: "bad_value" };
  }
  if (enabled && !message) return { error: "bad_value" };
  return {
    key,
    value: { enabled, message: message || DEFAULT_MAINTENANCE_MESSAGE },
  };
}

export function validatePaymentMethodInput(
  body: Record<string, unknown>,
): {
  originalValue: string;
  patch: { value: string; active: boolean; note: string };
} | { error: string } {
  const original = typeof body.original_value === "string"
    ? body.original_value.trim()
    : "";
  if (!original || original.length > 120) return { error: "bad_value" };
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value || value.length > 120) return { error: "bad_value" };
  if (typeof body.active !== "boolean") return { error: "bad_value" };
  const note = body.note === null || body.note === undefined
    ? ""
    : (typeof body.note === "string" ? body.note.trim() : null);
  if (note === null || note.length > 500) return { error: "bad_value" };
  return {
    originalValue: original,
    patch: { value, active: body.active, note },
  };
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const SITE_CONTENT_SELECT = "key,value,updated_at";
const PAYMENT_METHOD_SELECT = "value,active,note";

/** عميل قراءة/كتابة PostgREST لمحتوى الموقع وطرق دفعه. */
export class PostgrestControlSiteClient implements ControlSiteClient {
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
        `control site read http ${res.status}: ${text.slice(0, 200)}`,
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
        `control site write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async listSiteContent(): Promise<SiteContentRow[]> {
    return await this.get(
      `site_content?select=${SITE_CONTENT_SELECT}&order=key.asc`,
    ) as unknown as SiteContentRow[];
  }

  async upsertSiteContent(
    key: string,
    value: unknown,
  ): Promise<SiteContentRow> {
    const rows = await this.write(
      "POST",
      "site_content?on_conflict=key",
      { key, value, updated_at: new Date().toISOString() },
      "resolution=merge-duplicates,return=representation",
    );
    const row = rows[0] as unknown as SiteContentRow | undefined;
    if (!row) throw new Error("control site upsert: no row returned");
    return row;
  }

  async listPaymentMethods(): Promise<PaymentMethodRow[]> {
    return await this.get(
      `payment_methods?select=${PAYMENT_METHOD_SELECT}&order=value.asc`,
    ) as unknown as PaymentMethodRow[];
  }

  async getPaymentMethod(
    value: string,
  ): Promise<PaymentMethodRow | null> {
    const rows = await this.get(
      `payment_methods?value=eq.${encodeURIComponent(value)}` +
        `&select=${PAYMENT_METHOD_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as PaymentMethodRow) ?? null;
  }

  async updatePaymentMethod(
    originalValue: string,
    patch: { value: string; active: boolean; note: string },
  ): Promise<PaymentMethodRow | null> {
    const rows = await this.write(
      "PATCH",
      `payment_methods?value=eq.${encodeURIComponent(originalValue)}`,
      patch,
    );
    return (rows[0] as unknown as PaymentMethodRow) ?? null;
  }
}

// -------------------------------------------- المعالج العام (قراءة)
// GET /site/content — من غير مصادقة: المحتوى معروض للعملاء
// أصلًا على صفحات الموقع. فشل القاعدة أو غياب الجدول = 200
// بالثوابت المدمجة وتصريح في السجل بس؛ الموقع ما بينكسرش.
export interface SiteContentPublicDeps {
  client: Pick<ControlSiteClient, "listSiteContent">;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

export async function handleSiteContentPublicRequest(
  req: Request,
  deps: SiteContentPublicDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/site/content")) return null;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...deps.corsOf(req),
      },
    });
  if (req.method !== "GET") {
    return json({ ok: false, error: "method" }, 405);
  }
  let rows: SiteContentRow[] = [];
  try {
    rows = await deps.client.listSiteContent();
  } catch (e) {
    deps.logError(
      "site.content",
      "site content read failed — serving built-in defaults",
      e,
    );
    rows = [];
  }
  return json({ ok: true, content: normalizePublicSiteContent(rows) });
}

// ------------------------------------------------- معالج اللوحة
export interface ControlSiteDeps {
  client: ControlSiteClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

export async function handleControlSiteRequest(
  req: Request,
  deps: ControlSiteDeps,
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

  const isMethods = path.endsWith("/control/site-payment-methods");
  const isMethodSave = path.endsWith("/control/site-payment-method-save");
  const isContent = path.endsWith("/control/site-content");
  const isContentSave = path.endsWith("/control/site-content-save");
  if (!isMethods && !isMethodSave && !isContent && !isContentSave) {
    return null;
  }

  const readBody = async (): Promise<Record<string, unknown> | null> => {
    const parsed = await req.json().catch(() => null);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : null;
  };

  // التدقيق في السجل الموحد عند البوت — فشله بيتصرح بيه ومش
  // بيخفي نجاح الكتابة (نفس نمط كوبونات م٥-ج).
  const audit = async (
    action: string,
    entityType: string,
    entityRef: string,
    before: unknown,
    after: unknown,
  ): Promise<boolean> => {
    try {
      const r = await deps.botClient.proxy("POST", "/api/control/audit-log", {
        action,
        entity_type: entityType,
        entity_ref: entityRef,
        before: before ?? null,
        after: after ?? null,
      });
      return !(r.status < 200 || r.status >= 300 || r.body?.ok === false);
    } catch (e) {
      deps.logError("control.site", "site audit failed", e);
      return false;
    }
  };

  // ------------------------------------------------- طرق الدفع: قائمة
  if (isMethods) {
    if (req.method !== "GET") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    try {
      const methods = await deps.client.listPaymentMethods();
      return json({ ok: true, methods });
    } catch (e) {
      deps.logError("control.site", "payment methods read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ محتوى الموقع: قائمة
  if (isContent) {
    if (req.method !== "GET") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    try {
      const content = await deps.client.listSiteContent();
      return json({ ok: true, content });
    } catch (e) {
      deps.logError("control.site", "site content read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------ طرق الدفع: حفظ (تعديل بس)
  if (isMethodSave) {
    if (req.method !== "POST") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const v = validatePaymentMethodInput(body);
    if ("error" in v) return json({ ok: false, error: v.error }, 400);
    try {
      const before = await deps.client.getPaymentMethod(v.originalValue);
      if (!before) return json({ ok: false, error: "not_found" }, 404);
      // اسم جديد بيتصادم مع صف قائم = رفض واضح بدل كسر القيد الفريد.
      if (v.patch.value !== v.originalValue) {
        const clash = await deps.client.getPaymentMethod(v.patch.value);
        if (clash) return json({ ok: false, error: "method_exists" }, 409);
      }
      const updated = await deps.client.updatePaymentMethod(
        v.originalValue,
        v.patch,
      );
      if (!updated) return json({ ok: false, error: "not_found" }, 404);
      const auditOk = await audit(
        "site_payment_method_save",
        "site_payment_method",
        updated.value,
        before,
        updated,
      );
      return json({ ok: true, method: updated, audit_failed: !auditOk });
    } catch (e) {
      deps.logError("control.site", "payment method save failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ محتوى الموقع: حفظ
  if (req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const body = await readBody();
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  const v = validateSiteContentInput(body.key, body.value);
  if ("error" in v) return json({ ok: false, error: v.error }, 400);
  try {
    const rows = await deps.client.listSiteContent();
    const before = rows.find((r) => r.key === v.key) ?? null;
    const saved = await deps.client.upsertSiteContent(v.key, v.value);
    const auditOk = await audit(
      "site_content_save",
      "site_content",
      v.key,
      before?.value ?? null,
      saved.value,
    );
    return json({ ok: true, row: saved, audit_failed: !auditOk });
  } catch (e) {
    deps.logError("control.site", "site content save failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
}
