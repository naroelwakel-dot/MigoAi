// لوحة التحكم (المرحلة م٥-ج): كوبونات الموقع — قراءة وكتابة على
// جدول coupons في قاعدة الموقع نفسها (بنفس نمط طلبات الموقع في
// م٢)، فوق الأعمدة القائمة (code/discount/active/created_at)
// والأعمدة الجديدة من هجرة 025 (expires_at/max_uses/uses_count/
// min_order_egp).
//
// معنى «discount» — مصدر الحقيقة هو التخزين الحي وواجهة المتجر:
// القاعدة بتخزّن كسرًا عشريًا (0.10 = ١٠٪؛ الصفوف الحية MIGO5
// بـ 0.05 وMIGO10 بـ 0.10 وMIGO15 بـ 0.15)، وvalidate_coupon
// بترجّع الكسر زي ما هو، وواجهة المتجر (app.js) بتعرضه
// (الكسر × 100)٪ وبتحسب الخصم (الإجمالي × الكسر). حدود اللوحة
// دي بتتكلم بنسبة بشرية (10 = ١٠٪) عشان الأدمن يكتب ويقرأ نسبة،
// والتحويل بين النسبة والكسر بيحصل في عميل PostgREST تحت بس
// (كتابة: ÷100، قراءة: ×100) — فالقاعدة عمرها ما تشوف نسبة
// بشرية جاية من اللوحة.
//
// قرارات موثّقة:
// - كود الكوبون ما بيتبدّلش بعد إنشائه: طلبات العملاء شايلة الكود
//   نصًا في orders.coupon، فتبديله بيقطع الربط بين الطلب والكوبون.
//   اللي عاوز كود جديد بيعمل كوبون جديد وبيوقّف القديم.
// - الحذف متاح بس لكوبون ما اتستخدمش ولا مرة (uses_count = 0):
//   حذف كوبون مستخدم بيمسح سجل استخدامه، فبيترفض بـ coupon_in_use
//   والتوجيه هو الإيقاف. طلبات العملاء نفسها مش هتتكسر بالحذف
//   (الكود نص في الطلب، مفيش مفتاح خارجي) — الحماية لسجل الاستخدام.
//   والشرط نفسه مفروض ذرّيًا في جملة الحذف (uses_count=eq.0) مش
//   بفحص التطبيق بس، فطلب عميل يوصل بين الفحص والحذف بيمنع الحذف
//   بدل ما يخسر الكوبون سجله (إصلاح بوابة مراجعة م٥).
// - كل حفظ/حذف بيتدقق في سجل البوت الموحد، وفشل التدقيق بيتصرح
//   بيه (audit_failed) ومش بيخفي نجاح الكتابة — نفس نمط م٢.

import type { BotControlProxyClient } from "./customers.ts";

// ------------------------------------------------------------ البيانات
// عند حدود الواجهات دي (StoreCouponRow و CouponInput) قيمة
// discount نسبة بشرية (10 = ١٠٪) — ده عقد اللوحة مع شاشتها.
// التخزين في القاعدة كسر (0.10)، والتحويل بين الشكلين مسؤولية
// عميل PostgREST تحت لوحده.
export interface StoreCouponRow {
  code: string;
  discount: number | string;
  active: boolean;
  created_at: string | null;
  expires_at: string | null;
  max_uses: number | string | null;
  uses_count: number | string | null;
  min_order_egp: number | string | null;
}

export interface CouponInput {
  code: string;
  discount: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  min_order_egp: number | null;
}

export interface ControlCouponsClient {
  listCoupons(): Promise<StoreCouponRow[]>;
  getCoupon(code: string): Promise<StoreCouponRow | null>;
  insertCoupon(input: CouponInput): Promise<StoreCouponRow>;
  updateCoupon(
    code: string,
    patch: Omit<CouponInput, "code">,
  ): Promise<StoreCouponRow | null>;
  deleteCoupon(code: string): Promise<boolean>;
}

// ------------------------------------------------- تحقق نقي (بيتختبر)
// الكود: حروف إنجليزي وأرقام وشرطة وشرطة سفلية، ٣ لـ ٤٠ حرف،
// وبيتخزن بحروف كبيرة زي ما واجهة المتجر بتبعته لـ validate_coupon.
export const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function validateCouponInput(
  body: Record<string, unknown>,
): { input: CouponInput } | { error: string } {
  const codeRaw = typeof body.code === "string" ? body.code : "";
  const code = codeRaw.trim().toUpperCase();
  if (!COUPON_CODE_RE.test(code)) return { error: "bad_code" };

  // discount الواصل من الشاشة نسبة بشرية (10 = ١٠٪) فحدوده
  // 0 < النسبة <= 100 — وبتتحوّل لكسر (0.10) وقت الكتابة الفعلية
  // في عميل PostgREST، فالتحقق هنا على النسبة مش على الكسر.
  const discount = numOrNull(body.discount);
  if (
    discount === null || Number.isNaN(discount) || discount <= 0 ||
    discount > 100
  ) {
    return { error: "bad_discount" };
  }

  const activeRaw = body.active;
  if (activeRaw !== undefined && typeof activeRaw !== "boolean") {
    // قيمة غير منطقية (نص/رقم/null) مرفوضة صراحة — التحويل الصامت
    // لـ false كان بيوقف كوبون شغّال من غير ما الأدمن يحس.
    return { error: "bad_active" };
  }
  const active = activeRaw === undefined ? true : activeRaw;

  let expiresAt: string | null = null;
  const expRaw = body.expires_at;
  if (expRaw !== null && expRaw !== undefined && expRaw !== "") {
    if (typeof expRaw !== "string") return { error: "bad_expires" };
    const t = Date.parse(expRaw);
    if (!Number.isFinite(t)) return { error: "bad_expires" };
    expiresAt = new Date(t).toISOString();
  }

  let maxUses: number | null = null;
  const maxRaw = numOrNull(body.max_uses);
  if (maxRaw !== null) {
    if (
      Number.isNaN(maxRaw) || !Number.isInteger(maxRaw) || maxRaw < 1 ||
      maxRaw > 1000000
    ) {
      return { error: "bad_max_uses" };
    }
    maxUses = maxRaw;
  }

  let minOrder: number | null = null;
  const minRaw = numOrNull(body.min_order_egp);
  if (minRaw !== null) {
    if (Number.isNaN(minRaw) || minRaw < 0) {
      return { error: "bad_min_order" };
    }
    minOrder = minRaw;
  }

  return {
    input: {
      code,
      discount,
      active,
      expires_at: expiresAt,
      max_uses: maxUses,
      min_order_egp: minOrder,
    },
  };
}

export function couponUsesCount(row: StoreCouponRow): number {
  const n = Number(row.uses_count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// ------------------------------------------------- تحويل النسبة والكسر
// النسبة البشرية (عقد اللوحة) ↔ الكسر العشري (تخزين القاعدة).
// التحويل بيحصل هنا بس، عند سلك PostgREST: الكتابة ÷100 والقراءة
// ×100. أي مسار تاني في الملف ده بيتعامل بنسبة بشرية وبس.
export function percentToFraction(percent: number): number {
  return percent / 100;
}

export function fractionToPercent(fraction: number): number {
  // تقريب لـ ٦ خانات عشرية: غبار الفاصلة العائمة ما يطلعش في
  // اللوحة (0.29 × 100 = 28.999999999999996 من غير التقريب).
  return Math.round(fraction * 100 * 1e6) / 1e6;
}

/** صف جاي من القاعدة (discount كسر) → صف بحدود اللوحة (نسبة). */
function storedRowToPanel(row: StoreCouponRow): StoreCouponRow {
  const f = Number(row.discount);
  if (!Number.isFinite(f)) return row;
  return { ...row, discount: fractionToPercent(f) };
}

/** مدخل لوحة (discount نسبة) → جسم كتابة للقاعدة (كسر). */
function panelInputToStored(input: CouponInput): CouponInput {
  return { ...input, discount: percentToFraction(input.discount) };
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const COUPON_SELECT =
  "code,discount,active,created_at,expires_at,max_uses,uses_count," +
  "min_order_egp";

/**
 * عميل قراءة/كتابة PostgREST لكوبونات المتجر، بنفس نمط باقي
 * العملاء — وهو مكان تحويل discount الوحيد: بيكتب كسرًا للقاعدة
 * وبيقرأ كسرًا منها ويرجّع نسبة بشرية لحدود اللوحة.
 */
export class PostgrestControlCouponsClient implements ControlCouponsClient {
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
        `control coupons read http ${res.status}: ${text.slice(0, 200)}`,
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
  ): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control coupons write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async listCoupons(): Promise<StoreCouponRow[]> {
    const rows = await this.get(
      `coupons?select=${COUPON_SELECT}&order=created_at.desc`,
    ) as unknown as StoreCouponRow[];
    return rows.map(storedRowToPanel);
  }

  async getCoupon(code: string): Promise<StoreCouponRow | null> {
    const rows = await this.get(
      `coupons?code=eq.${encodeURIComponent(code)}` +
        `&select=${COUPON_SELECT}&limit=1`,
    );
    const row = rows[0] as unknown as StoreCouponRow | undefined;
    return row ? storedRowToPanel(row) : null;
  }

  async insertCoupon(input: CouponInput): Promise<StoreCouponRow> {
    const rows = await this.write("POST", "coupons", panelInputToStored(input));
    const row = rows[0] as unknown as StoreCouponRow | undefined;
    if (!row) throw new Error("control coupons insert: no row returned");
    return storedRowToPanel(row);
  }

  async updateCoupon(
    code: string,
    patch: Omit<CouponInput, "code">,
  ): Promise<StoreCouponRow | null> {
    const storedPatch = {
      ...patch,
      discount: percentToFraction(patch.discount),
    };
    const rows = await this.write(
      "PATCH",
      `coupons?code=eq.${encodeURIComponent(code)}`,
      storedPatch,
    );
    const row = rows[0] as unknown as StoreCouponRow | undefined;
    return row ? storedRowToPanel(row) : null;
  }

  async deleteCoupon(code: string): Promise<boolean> {
    // الحذف مشروط ذرّيًا في القاعدة نفسها (uses_count = 0): فحص
    // التطبيق اللي قبله نافذة سباق — طلب عميل يوصل بين الفحص
    // والحذف بيرفع العدّاد، والشرط ده بيخلي الحذف ساعتها ما
    // يطابقش أي صف بدل ما يمسح كوبون اتستخدم خلاص.
    const rows = await this.write(
      "DELETE",
      `coupons?code=eq.${encodeURIComponent(code)}&uses_count=eq.0`,
    );
    return rows.length > 0;
  }
}

// ------------------------------------------------------------- المعالج
export interface ControlCouponsDeps {
  client: ControlCouponsClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

export async function handleControlCouponsRequest(
  req: Request,
  deps: ControlCouponsDeps,
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

  const isList = path.endsWith("/control/store-coupons");
  const isSave = path.endsWith("/control/store-coupons-save");
  const isDelete = path.endsWith("/control/store-coupons-delete");
  if (!isList && !isSave && !isDelete) return null;

  const readBody = async (): Promise<Record<string, unknown> | null> => {
    const parsed = await req.json().catch(() => null);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : null;
  };

  // التدقيق في السجل الموحد عند البوت — فشله بيتصرح بيه ومش
  // بيخفي نجاح الكتابة (نفس نمط طلبات الموقع في م٢).
  const audit = async (
    action: string,
    code: string,
    before: unknown,
    after: unknown,
  ): Promise<boolean> => {
    try {
      const r = await deps.botClient.proxy("POST", "/api/control/audit-log", {
        action,
        entity_type: "store_coupon",
        entity_ref: code,
        before: before ?? null,
        after: after ?? null,
      });
      return !(r.status < 200 || r.status >= 300 || r.body?.ok === false);
    } catch (e) {
      deps.logError("control.coupons", "coupon audit failed", e);
      return false;
    }
  };

  // ---------------------------------------------------------- القائمة
  if (isList) {
    if (req.method !== "GET") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    try {
      const coupons = await deps.client.listCoupons();
      return json({ ok: true, coupons });
    } catch (e) {
      deps.logError("control.coupons", "coupons read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ----------------------------------------------------- حفظ (إنشاء/تعديل)
  if (isSave) {
    if (req.method !== "POST") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const v = validateCouponInput(body);
    if ("error" in v) return json({ ok: false, error: v.error }, 400);
    const input = v.input;

    const originalCode = typeof body.original_code === "string"
      ? body.original_code.trim().toUpperCase()
      : "";
    try {
      if (!originalCode) {
        // إنشاء: الكود موجود أصلًا = تعارض واضح بدل كتابة فوقه.
        const existing = await deps.client.getCoupon(input.code);
        if (existing) {
          return json({ ok: false, error: "coupon_exists" }, 409);
        }
        const created = await deps.client.insertCoupon(input);
        const auditOk = await audit(
          "store_coupon_save",
          created.code,
          null,
          created,
        );
        return json({ ok: true, coupon: created, audit_failed: !auditOk });
      }
      // تعديل: الكود نفسه ما بيتبدّلش (قرار موثّق فوق).
      if (input.code !== originalCode) {
        return json({ ok: false, error: "code_immutable" }, 400);
      }
      const before = await deps.client.getCoupon(originalCode);
      if (!before) return json({ ok: false, error: "not_found" }, 404);
      const { code: _code, ...patch } = input;
      const updated = await deps.client.updateCoupon(originalCode, patch);
      if (!updated) return json({ ok: false, error: "not_found" }, 404);
      const auditOk = await audit(
        "store_coupon_save",
        updated.code,
        before,
        updated,
      );
      return json({ ok: true, coupon: updated, audit_failed: !auditOk });
    } catch (e) {
      deps.logError("control.coupons", "coupon save failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------------------- الحذف
  if (req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const body = await readBody();
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  const code = typeof body.code === "string"
    ? body.code.trim().toUpperCase()
    : "";
  if (!COUPON_CODE_RE.test(code)) {
    return json({ ok: false, error: "bad_code" }, 400);
  }
  try {
    const before = await deps.client.getCoupon(code);
    if (!before) return json({ ok: false, error: "not_found" }, 404);
    // كوبون اتستخدم قبل كده ما بيتحذفش — سجل استخدامه أغلى منه،
    // والإيقاف بيقوم بنفس الغرض من غير مسح (قرار موثّق فوق).
    if (couponUsesCount(before) > 0) {
      return json({ ok: false, error: "coupon_in_use" }, 409);
    }
    const gone = await deps.client.deleteCoupon(code);
    if (!gone) {
      // الحذف المشروط ما طابقش صف: يا الكوبون اتستخدم في نافذة
      // السباق بين فحصنا والحذف (409 زي الفحص الأصلي)، يا اتحذف
      // من مسار تاني (404).
      const now = await deps.client.getCoupon(code);
      if (now && couponUsesCount(now) > 0) {
        return json({ ok: false, error: "coupon_in_use" }, 409);
      }
      if (now) return json({ ok: false, error: "store_failed" }, 502);
      return json({ ok: false, error: "not_found" }, 404);
    }
    const auditOk = await audit("store_coupon_delete", code, before, null);
    return json({ ok: true, code, audit_failed: !auditOk });
  } catch (e) {
    deps.logError("control.coupons", "coupon delete failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
}
