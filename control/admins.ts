// لوحة التحكم — موجة Instinct الرابعة (البند ٢٣): هويات مسؤولي
// اللوحة وأدوارهم، مبنية خاملة (DORMANT) بالتصميم.
//
// ⚠️ ما تتلخبطش مع control/admin_users.ts: ديك بتدير حسابات
// عملاء *الموقع* (Supabase Auth — حظر/رفع حظر). الوحدة دي عن
// مسؤولي *اللوحة نفسهم*: سجل control_admins (هجرة 039) بأسماء
// وأدوار owner/support/catalog وحالة إيقاف ونسخة توكن.
//
// عقد الخمول (DORMANCY CONTRACT) — صلب، ما يتكسرش من غير قرار
// مالك صريح ومرحلة تفعيل لوحدها:
//   ١) دخول اللوحة وجلساتها (control/session.ts + admin_auth.ts)
//      بيكملوا زي النهاردة بالحرف: الوحدة دي لا بتلمس إصدار
//      جلسة ولا تحققها، وrequireRole مش مربوط بأي مسار قائم.
//   ٢) مفيش أي صف في control_admins مطلوب عشان المسؤول الحالي
//      يشتغل: أي طلب عدّى بوابة الأدمن القائمة (isAdmin) من
//      غير مزوّد دور مربوط بيتحلّ دوره لـ owner ضمنيًا —
//      المسؤول المصادَق الحالي *هو* الـ owner، والجدول سجل
//      أسماء للتفعيل اللي جاي بس.
//   ٣) خريطة الصلاحيات وrequireRole تحت معروضين للربط
//      المستقبلي، ومتطبّقين فعليًا جوه مسارات الوحدة دي بس
//      (إدارة السجل نفسه owner-only) — برّاها مفيش أي مسار
//      بيستشيرهم النهاردة.
//   ٤) الإيقاف بيبدّل disabled وبيزوّد token_version في نفس
//      الكتابة: ده ذراع إلغاء الجلسات عند التفعيل (جلسة شايلة
//      نسخة أقدم من نسخة الصف = ملغية) — النهاردة الجلسات مش
//      شايلة نسخ أصلًا، فالذراع موجود ومش مربوط بحاجة.
//
// المسارات (كلها ورا بوابة الأدمن القائمة + دور owner):
//   GET  /control/admins         — قائمة السجل (حقول بيضاء بس)
//   POST /control/admins         — إنشاء مسؤول {name, role}
//   POST /control/admins-disable — إيقاف + رفع نسخة التوكن {id}

// ------------------------------------------------------------- الأدوار
export const ADMIN_ROLES = ["owner", "support", "catalog"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * مناطق الصلاحية بأسماء شغل اللوحة. ‏topup_decisions منفصلة عن
 * money عن قصد: قرار شحنة (اعتماد/رفض/طلب بيانات) مش عملية
 * محفظة — تعديل رصيد/نقل/عكس قيود دي money ومش مع الدعم.
 */
export type AdminPermission =
  | "customers"
  | "chats"
  | "orders"
  | "topup_decisions"
  | "catalog"
  | "prices"
  | "coupons"
  | "money"
  | "settings"
  | "keys"
  | "admins";

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  "customers",
  "chats",
  "orders",
  "topup_decisions",
  "catalog",
  "prices",
  "coupons",
  "money",
  "settings",
  "keys",
  "admins",
];

/**
 * مصفوفة الصلاحيات (بند ٢٣):
 *   owner   = كل حاجة.
 *   support = عملاء/محادثات/طلبات/قرارات شحن — من غير
 *             إعدادات ولا مفاتيح ولا مسؤولين ولا عمليات محفظة.
 *   catalog = كتالوج/أسعار/كوبونات — من غير فلوس ولا إعدادات.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ALL_PERMISSIONS,
  support: ["customers", "chats", "orders", "topup_decisions"],
  catalog: ["catalog", "prices", "coupons"],
};

export function isAdminRole(v: unknown): v is AdminRole {
  return typeof v === "string" &&
    (ADMIN_ROLES as readonly string[]).includes(v);
}

/** هل الدور يقدر على المنطقة دي؟ دور غايب/مجهول = لأ دايمًا. */
export function hasPermission(
  role: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!role || !isAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * حارس دور للربط المستقبلي: بيرجع true بس لو الدور المحلول
 * واحد من المسموحين. أي مسار قائم ما بيستدعيش ده النهاردة
 * (عقد الخمول فوق) — أول استخدام فعلي هو مسارات الوحدة دي.
 */
export function requireRole(
  role: AdminRole | null | undefined,
  allowed: readonly AdminRole[],
): boolean {
  return !!role && isAdminRole(role) && allowed.includes(role);
}

/** اختصار المنطقة: requireRole فوق خريطة الصلاحيات. */
export function requirePermission(
  role: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean {
  return hasPermission(role, permission);
}

// ------------------------------------------------------------- الأنواع
export interface ControlAdminRow {
  id: string;
  name: string;
  role: string;
  disabled: boolean;
  token_version: number;
  created_at: string | null;
}

/** شكل العرض: نفس الحقول البيضاء بالحرف — مفيش أي حقل زيادة. */
export interface ControlAdminView {
  id: string;
  name: string;
  role: string;
  disabled: boolean;
  token_version: number;
  created_at: string | null;
}

export interface ControlAdminsClient {
  listAdmins(): Promise<ControlAdminRow[]>;
  createAdmin(input: {
    name: string;
    role: AdminRole;
  }): Promise<ControlAdminRow>;
  getAdmin(id: string): Promise<ControlAdminRow | null>;
  /**
   * إيقاف ذرّي المعنى: disabled=true وtoken_version بتزيد واحد
   * عن قيمتها الحالية في نفس التحديث — بيرجع الصف بعد الكتابة
   * أو null لو الصف اختفى بين القراءة والكتابة.
   */
  disableAdmin(id: string): Promise<ControlAdminRow | null>;
}

export interface ControlAdminsDeps {
  client: ControlAdminsClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  /**
   * مزوّد دور الطلب الحالي — للتفعيل المستقبلي بس. غيابه (حالة
   * النهاردة) أو رجوعه بـ null معناه: الطلب عدّى بوابة الأدمن
   * القائمة فصاحبه هو الـ owner ضمنيًا (عقد الخمول، نقطة ٢).
   */
  currentRoleOf?: (req: Request) => AdminRole | null;
}

function view(row: ControlAdminRow): ControlAdminView {
  // قائمة بيضاء صريحة: أي عمود زيادة يظهر في الجدول مستقبلًا
  // ما بيعدّيش للرد من نفسه.
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    disabled: row.disabled === true,
    token_version: Number(row.token_version),
    created_at: row.created_at ?? null,
  };
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const ADMIN_SELECT = "id,name,role,disabled,token_version,created_at";

/** عميل PostgREST لسجل مسؤولي اللوحة، بنفس نمط عملاء اللوحة. */
export class PostgrestAdminsClient implements ControlAdminsClient {
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
        `control admins read http ${res.status}: ${text.slice(0, 200)}`,
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
        `control admins write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async listAdmins(): Promise<ControlAdminRow[]> {
    const rows = await this.get(
      `control_admins?select=${ADMIN_SELECT}&order=created_at.asc&limit=200`,
    );
    return rows as unknown as ControlAdminRow[];
  }

  async createAdmin(input: {
    name: string;
    role: AdminRole;
  }): Promise<ControlAdminRow> {
    const rows = await this.write("POST", "control_admins", input);
    const row = rows[0] as unknown as ControlAdminRow | undefined;
    if (!row) throw new Error("control admins insert: no row");
    return row;
  }

  async getAdmin(id: string): Promise<ControlAdminRow | null> {
    const rows = await this.get(
      `control_admins?id=eq.${encodeURIComponent(id)}` +
        `&select=${ADMIN_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as ControlAdminRow) ?? null;
  }

  async disableAdmin(id: string): Promise<ControlAdminRow | null> {
    const before = await this.getAdmin(id);
    if (!before) return null;
    // الزيادة محسوبة من الصف المقروء ومكتوبة مع علم الإيقاف في
    // تحديث واحد، ومحروسة بالنسخة المقروءة نفسها: كتابة منافسة
    // بين القراءة والتحديث بتخلي التحديث يرجع صفر صفوف بدل ما
    // يخفي رفع نسخة حصل فعلًا (نفس نمط إغلاق متابعات 038).
    const rows = await this.write(
      "PATCH",
      `control_admins?id=eq.${encodeURIComponent(id)}` +
        `&token_version=eq.${Number(before.token_version)}`,
      { disabled: true, token_version: Number(before.token_version) + 1 },
    );
    return (rows[0] as unknown as ControlAdminRow) ?? null;
  }
}

// ------------------------------------------------------------- المعالج
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * معالج مسؤولي اللوحة (بند ٢٣) — بيتركب في api.ts على مسارات
 * /control/*. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlAdminsRequest(
  req: Request,
  deps: ControlAdminsDeps,
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
    "/control/admins": ["GET", "POST"],
    "/control/admins-disable": ["POST"],
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
  // إدارة السجل owner-only جوه الوحدة دي نفسها: الدور بيتحلّ من
  // المزوّد المربوط، وغيابه = owner ضمني (عقد الخمول) فالمسؤول
  // الحالي بيعدّي زي النهاردة بالحرف. دور support/catalog مربوط
  // مستقبلًا بيتوقف هنا بـ 403 قبل أي قراءة أو كتابة.
  const role: AdminRole = deps.currentRoleOf
    ? (deps.currentRoleOf(req) ?? "owner")
    : "owner";
  if (!requireRole(role, ["owner"])) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const readBody = async (): Promise<Record<string, unknown> | null> => {
    const parsed = await req.json().catch(() => null);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : null;
  };

  // ------------------------------------------------------- القائمة
  if (suffix === "/control/admins" && req.method === "GET") {
    try {
      const admins = await deps.client.listAdmins();
      return json({ ok: true, admins: admins.map(view) });
    } catch (e) {
      deps.logError("control.admins", "admins list failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------------- الإنشاء
  if (suffix === "/control/admins" && req.method === "POST") {
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) {
      return json({ ok: false, error: "bad_name" }, 400);
    }
    if (!isAdminRole(body.role)) {
      return json({ ok: false, error: "bad_role" }, 400);
    }
    try {
      const admin = await deps.client.createAdmin({
        name,
        role: body.role,
      });
      return json({ ok: true, admin: view(admin) });
    } catch (e) {
      deps.logError("control.admins", "admin create failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------------- الإيقاف
  const body = await readBody();
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) {
    return json({ ok: false, error: "bad_id" }, 400);
  }
  try {
    const before = await deps.client.getAdmin(id);
    if (!before) return json({ ok: false, error: "not_found" }, 404);
    const after = await deps.client.disableAdmin(id);
    if (!after) {
      // سباق: الصف اتغيّر بين القراءتين — بنعيد القراءة ونصرّح
      // بالحالة بدل ما ندّعي إيقاف ما حصلش عندنا.
      const current = await deps.client.getAdmin(id);
      if (!current) return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: false, error: "state_changed" }, 409);
    }
    return json({ ok: true, admin: view(after) });
  } catch (e) {
    deps.logError("control.admins", "admin disable failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
}
