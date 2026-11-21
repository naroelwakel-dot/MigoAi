// لوحة التحكم: مستخدمو الأدمن — إدارة حسابات مصادقة المتجر
// (Supabase Auth) من اللوحة: قائمة الحسابات وحظر/رفع حظر عبر
// GoTrue Admin بنفس مفتاح service_role ونفس عقد ban_duration
// بتاع حظر العملاء (customer-control.ts).
//
// حواجز ضد قفل النفس بره (شروط صلبة):
//   ١) حظر حساب صاحب الجلسة نفسه ممنوع (409 self_ban) — هوية
//      صاحب الطلب بتيجي من requesterIdOf. تنبيه معماري موثق:
//      جلسة اللوحة الحالية (admin_auth.ts) توكن HMAC من التوكن
//      المشترك ومش شايلة معرّف مستخدم، فالمزوّد الافتراضي في
//      api.ts بيرجع null والحاجز ده بيشتغل أول ما الجلسات تبقى
//      مربوطة بمستخدمين. الحاجز التاني شغال دايمًا وبيغطي خطر
//      القفل الكلي فعليًا.
//   ٢) حظر آخر حساب غير محظور فاضل ممنوع (409 last_admin) —
//      القائمة لازم يفضل فيها حساب واحد على الأقل يقدر يدخل.

import { isBanned } from "./customer-control.ts";

export interface AdminUser {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

export interface AdminUserView extends AdminUser {
  banned: boolean;
}

export interface AdminUsersClient {
  listUsers(): Promise<AdminUser[]>;
  getUser(userId: string): Promise<AdminUser | null>;
  setBan(userId: string, banned: boolean): Promise<AdminUser | null>;
}

export interface ControlAdminUsersDeps {
  client: AdminUsersClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  /**
   * معرّف مستخدم المصادقة صاحب جلسة اللوحة الحالية، أو null لو
   * الجلسة مش مربوطة بمستخدم (حالة اللوحة الحالية — شوف الترويسة).
   */
  requesterIdOf: (req: Request) => string | null;
}

// ------------------------------------------------------------ عميل GoTrue
interface GtOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const PER_PAGE = 100;
const MAX_PAGES = 20; // سقف أمان: ٢٠٠٠ حساب كفاية لقاعدة المتجر

function shapeUser(row: Record<string, unknown> | null): AdminUser | null {
  if (!row || typeof row.id !== "string") return null;
  const str = (v: unknown): string | null =>
    typeof v === "string" ? v : null;
  return {
    id: row.id,
    email: str(row.email),
    created_at: str(row.created_at),
    last_sign_in_at: str(row.last_sign_in_at),
    banned_until: str(row.banned_until),
  };
}

/** عميل GoTrue Admin: قائمة/قراءة/حظر — نفس نمط customer-control. */
export class GoTrueAdminUsersClient implements AdminUsersClient {
  private opts: GtOptions;
  constructor(opts: GtOptions) {
    this.opts = opts;
  }

  private async call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const key = this.opts.keyOf();
    if (!key) throw new Error("service key not configured");
    const res = await fetch(`${this.opts.baseUrl}/auth/v1/admin/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`gotrue admin ${method} -> ${res.status}`);
    return await res.json().catch(() => null);
  }

  async listUsers(): Promise<AdminUser[]> {
    const out: AdminUser[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const json = await this.call(
        "GET",
        `users?page=${page}&per_page=${PER_PAGE}`,
      );
      const rows = (json && typeof json === "object" &&
          Array.isArray((json as Record<string, unknown>).users))
        ? (json as Record<string, unknown>).users as Record<string, unknown>[]
        : [];
      for (const row of rows) {
        const user = shapeUser(row);
        if (user) out.push(user);
      }
      if (rows.length < PER_PAGE) break;
    }
    return out;
  }

  async getUser(userId: string): Promise<AdminUser | null> {
    const json = await this.call(
      "GET",
      `users/${encodeURIComponent(userId)}`,
    );
    return shapeUser(
      (json && typeof json === "object" && !Array.isArray(json))
        ? json as Record<string, unknown>
        : null,
    );
  }

  async setBan(
    userId: string,
    banned: boolean,
  ): Promise<AdminUser | null> {
    // حظر فعّال عمليًا بلا نهاية قريبة، والفكّ بـ "none" (عقد GoTrue).
    const json = await this.call(
      "PUT",
      `users/${encodeURIComponent(userId)}`,
      { ban_duration: banned ? "876000h" : "none" },
    );
    return shapeUser(
      (json && typeof json === "object" && !Array.isArray(json))
        ? json as Record<string, unknown>
        : null,
    );
  }
}

// ------------------------------------------------------------- المعالج
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function view(user: AdminUser): AdminUserView {
  return { ...user, banned: isBanned(user) };
}

/**
 * معالج مستخدمي الأدمن — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlAdminUsersRequest(
  req: Request,
  deps: ControlAdminUsersDeps,
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

  const isList = path.endsWith("/control/admin-users");
  const isBan = path.endsWith("/control/admin-user-ban");
  if (!isList && !isBan) return null;

  // ------------------------------------------------ قائمة المستخدمين
  if (isList) {
    if (req.method !== "GET") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    try {
      const users = await deps.client.listUsers();
      return json({ ok: true, users: users.map(view) });
    } catch (e) {
      deps.logError("control.admin_users", "users list failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ حظر / رفع حظر
  if (req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const parsed = await req.json().catch(() => null);
  const body = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : null;
  if (!body) return json({ ok: false, error: "bad_body" }, 400);

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!UUID_RE.test(userId)) {
    return json({ ok: false, error: "invalid_user" }, 400);
  }
  const banned = body.banned;
  if (typeof banned !== "boolean") {
    return json({ ok: false, error: "invalid_value" }, 400);
  }

  try {
    const target = await deps.client.getUser(userId);
    if (!target) return json({ ok: false, error: "user_not_found" }, 404);

    if (banned && !isBanned(target)) {
      // حاجز ١: حظر النفس — صاحب الجلسة ما يحظرش حسابه.
      const requesterId = deps.requesterIdOf(req);
      if (requesterId && requesterId === userId) {
        return json({
          ok: false,
          error: "self_ban",
          reason: "مش هينفع تحظر حسابك أنت — ده حساب الدخول بتاعك.",
        }, 409);
      }
      // حاجز ٢: آخر حساب غير محظور — الحظر ده هيقفل الكل بره.
      const users = await deps.client.listUsers();
      const unbannedCount = users.filter((u) => !isBanned(u)).length;
      if (unbannedCount <= 1) {
        return json({
          ok: false,
          error: "last_admin",
          reason:
            "ده آخر حساب غير محظور — حظره هيقفل الدخول على الكل. فكّ حظر حساب تاني أو اعمل حساب جديد الأول.",
        }, 409);
      }
    }

    const after = await deps.client.setBan(userId, banned);
    if (!after) return json({ ok: false, error: "user_not_found" }, 404);
    return json({ ok: true, user: view(after) });
  } catch (e) {
    deps.logError("control.admin_users", "user ban failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
}
