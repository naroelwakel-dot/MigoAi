/**
 * اختبارات مستخدمي الأدمن — `deno test control/admin_users.test.ts`
 * عميل مصادقة وهمي في الذاكرة + اختبار عميل GoTrue الحقيقي
 * بـ fetch مثبّت. التغطية: بوابة الأدمن، شكل القائمة وحالة الحظر
 * المشتقة من banned_until (مستقبلي = محظور، منتهي/فاضي = لأ)،
 * تحقق الحظر (UUID/قيمة = 400، مش موجود = 404)، وحاجزا قفل
 * النفس: حظر صاحب الجلسة = 409 self_ban، وحظر آخر حساب غير
 * محظور = 409 last_admin — والحاجزين ما بيمنعوش الحظر العادي
 * ولا رفع الحظر أبدًا.
 */
import html from "../control.html" with { type: "text" };
import {
  type AdminUser,
  type AdminUsersClient,
  type ControlAdminUsersDeps,
  GoTrueAdminUsersClient,
  handleControlAdminUsersRequest,
} from "./admin_users.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const OWNER_ID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_ID = "223e4567-e89b-12d3-a456-426614174001";
const THIRD_ID = "323e4567-e89b-12d3-a456-426614174002";
const BANNED_UNTIL = "2126-01-01T00:00:00Z";
const EXPIRED_UNTIL = "2000-01-01T00:00:00Z";

function user(partial: Partial<AdminUser>): AdminUser {
  return {
    id: OWNER_ID,
    email: "owner@example.com",
    created_at: "2026-11-01T00:00:00.000Z",
    last_sign_in_at: "2026-11-19T00:00:00.000Z",
    banned_until: null,
    ...partial,
  };
}

class FakeAdminUsersClient implements AdminUsersClient {
  users = new Map<string, AdminUser>();
  banCalls: { id: string; banned: boolean }[] = [];
  listUsers(): Promise<AdminUser[]> {
    return Promise.resolve([...this.users.values()]);
  }
  getUser(userId: string): Promise<AdminUser | null> {
    return Promise.resolve(this.users.get(userId) ?? null);
  }
  setBan(userId: string, banned: boolean): Promise<AdminUser | null> {
    const u = this.users.get(userId);
    if (!u) return Promise.resolve(null);
    this.banCalls.push({ id: userId, banned });
    u.banned_until = banned ? BANNED_UNTIL : null;
    return Promise.resolve(u);
  }
}

function makeDeps(requesterId: string | null = null) {
  const client = new FakeAdminUsersClient();
  client.users.set(OWNER_ID, user({}));
  client.users.set(OTHER_ID, user({
    id: OTHER_ID, email: "other@example.com", last_sign_in_at: null,
  }));
  const deps: ControlAdminUsersDeps = {
    client,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
    requesterIdOf: () => requesterId,
  };
  return { deps, client };
}

function req(
  path: string,
  method = "GET",
  body?: unknown,
  admin = true,
): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: {
      ...(admin ? { "x-migo-admin": ADMIN_KEY } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

Deno.test("مسارات غريبة بترجع null", async () => {
  const { deps } = makeDeps();
  eq(await handleControlAdminUsersRequest(req("/control/admin"), deps), null, "bare admin");
  eq(await handleControlAdminUsersRequest(req("/control/admin-users-x"), deps), null, "suffix-x");
  eq(await handleControlAdminUsersRequest(req("/control/users"), deps), null, "users");
});

Deno.test("القائمة: بوابة الأدمن وشكل الصفوف وحالة الحظر", async () => {
  const { deps, client } = makeDeps();
  const denied = await handleControlAdminUsersRequest(
    req("/control/admin-users", "GET", undefined, false), deps);
  eq(denied?.status, 401, "no admin = 401");

  client.users.set(THIRD_ID, user({
    id: THIRD_ID, email: "banned@example.com", banned_until: BANNED_UNTIL,
  }));
  const res = await handleControlAdminUsersRequest(
    req("/control/admin-users"), deps);
  eq(res?.status, 200, "status");
  const users = (await bodyOf(res)).users as Record<string, unknown>[];
  eq(users.length, 3, "all users listed");
  eq(users[0].email, "owner@example.com", "email present");
  eq(users[0].banned, false, "null banned_until = not banned");
  eq(users[2].banned, true, "future banned_until = banned");
  eq(users[2].last_sign_in_at, "2026-11-19T00:00:00.000Z", "last sign-in present");

  // حظر منتهي مش حظر.
  client.users.set(THIRD_ID, user({
    id: THIRD_ID, email: "banned@example.com", banned_until: EXPIRED_UNTIL,
  }));
  const res2 = await handleControlAdminUsersRequest(
    req("/control/admin-users"), deps);
  const users2 = (await bodyOf(res2)).users as Record<string, unknown>[];
  eq(users2[2].banned, false, "expired ban = not banned");
});

Deno.test("القائمة: طريقة غلط = 405", async () => {
  const { deps } = makeDeps();
  const res = await handleControlAdminUsersRequest(
    req("/control/admin-users", "POST", {}), deps);
  eq(res?.status, 405, "POST on list = 405");
});

Deno.test("الحظر: تحقق الجسم والمستخدم", async () => {
  const { deps, client } = makeDeps();
  const bad: [unknown, string][] = [
    [{ banned: true }, "invalid_user"],
    [{ user_id: "not-a-uuid", banned: true }, "invalid_user"],
    [{ user_id: OWNER_ID }, "invalid_value"],
    [{ user_id: OWNER_ID, banned: "yes" }, "invalid_value"],
  ];
  for (const [b, err] of bad) {
    const res = await handleControlAdminUsersRequest(
      req("/control/admin-user-ban", "POST", b), deps);
    eq(res?.status, 400, `400 for ${JSON.stringify(b)}`);
    eq((await bodyOf(res)).error, err, `error for ${JSON.stringify(b)}`);
  }
  const missing = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: THIRD_ID, banned: true }), deps);
  eq(missing?.status, 404, "unknown user = 404");
  eq((await bodyOf(missing)).error, "user_not_found", "404 error");
  eq(client.banCalls.length, 0, "no ban written on invalid input");
});

Deno.test("الحظر: بوابة الأدمن قبل أي نداء", async () => {
  const { deps, client } = makeDeps();
  const res = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OTHER_ID, banned: true }, false), deps);
  eq(res?.status, 401, "no admin = 401");
  eq(client.banCalls.length, 0, "no ban behind the gate");
});

Deno.test("حاجز حظر النفس: صاحب الجلسة ما يحظرش حسابه", async () => {
  const { deps, client } = makeDeps(OWNER_ID);
  const res = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OWNER_ID, banned: true }), deps);
  eq(res?.status, 409, "self ban = 409");
  const body = await bodyOf(res);
  eq(body.error, "self_ban", "self ban error");
  ok(typeof body.reason === "string" && body.reason.length > 0, "plain reason present");
  eq(client.banCalls.length, 0, "self ban never written");

  // رفع الحظر عن النفس مسموح دايمًا (مش قفل).
  client.users.set(OWNER_ID, user({ banned_until: BANNED_UNTIL }));
  const unban = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OWNER_ID, banned: false }), deps);
  eq(unban?.status, 200, "self unban allowed");
  eq(client.banCalls[0], { id: OWNER_ID, banned: false }, "unban written");
});

Deno.test("حاجز آخر حساب: حظر آخر غير محظور = 409", async () => {
  const { deps, client } = makeDeps();
  // التاني محظور أصلًا، فالمالك هو آخر حساب غير محظور.
  client.users.set(OTHER_ID, user({
    id: OTHER_ID, email: "other@example.com", banned_until: BANNED_UNTIL,
  }));
  const res = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OWNER_ID, banned: true }), deps);
  eq(res?.status, 409, "last unbanned ban = 409");
  const body = await bodyOf(res);
  eq(body.error, "last_admin", "last admin error");
  ok(typeof body.reason === "string" && body.reason.length > 0, "plain reason present");
  eq(client.banCalls.length, 0, "last-admin ban never written");

  // فكّ حظر التاني بيفتح الطريق: بعده حظر المالك يعدّي.
  const unban = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OTHER_ID, banned: false }), deps);
  eq(unban?.status, 200, "unban other ok");
  const ban = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OWNER_ID, banned: true }), deps);
  eq(ban?.status, 200, "ban owner ok once another is unbanned");
});

Deno.test("الحظر العادي ورفعه بيعدّوا على العميل", async () => {
  const { deps, client } = makeDeps();
  const res = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OTHER_ID, banned: true }), deps);
  eq(res?.status, 200, "ban status");
  const body = await bodyOf(res);
  eq((body.user as Record<string, unknown>).banned, true, "banned in view");
  eq(client.banCalls[0], { id: OTHER_ID, banned: true }, "ban call");

  const res2 = await handleControlAdminUsersRequest(
    req("/control/admin-user-ban", "POST",
      { user_id: OTHER_ID, banned: false }), deps);
  eq(res2?.status, 200, "unban status");
  eq((await bodyOf(res2)).user !== undefined, true, "user in unban response");
  eq(client.banCalls[1], { id: OTHER_ID, banned: false }, "unban call");
});

// -------------------------------------------- عميل GoTrue بـ fetch مثبّت
Deno.test("عميل GoTrue: القائمة بصفحاتها وعقد ban_duration", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method || "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    if ((init?.method || "GET") === "PUT") {
      return Promise.resolve(new Response(JSON.stringify({
        id: OTHER_ID, email: "other@example.com",
        created_at: "2026-11-02T00:00:00.000Z", last_sign_in_at: null,
        banned_until: BANNED_UNTIL,
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      users: [{
        id: OWNER_ID, email: "owner@example.com",
        created_at: "2026-11-01T00:00:00.000Z",
        last_sign_in_at: "2026-11-19T00:00:00.000Z", banned_until: null,
      }],
      total: 1,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  }) as typeof fetch;
  try {
    const client = new GoTrueAdminUsersClient({
      baseUrl: "https://db.example",
      keyOf: () => "service-key",
    });
    const users = await client.listUsers();
    eq(users.length, 1, "one user from one short page");
    eq(users[0].email, "owner@example.com", "email shaped");
    ok(calls[0].url.includes("/auth/v1/admin/users?page=1&per_page=100"),
      "list url");

    const after = await client.setBan(OTHER_ID, true);
    eq(after?.banned_until, BANNED_UNTIL, "ban returns updated user");
    const put = calls[1];
    eq(put.method, "PUT", "ban method");
    ok(put.url.includes(`/auth/v1/admin/users/${OTHER_ID}`), "ban url");
    eq(JSON.parse(put.body || "{}"), { ban_duration: "876000h" }, "ban body");

    const unban = await client.setBan(OTHER_ID, false);
    ok(unban !== null, "unban returns user");
    eq(JSON.parse(calls[2].body || "{}"), { ban_duration: "none" }, "unban body");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureAdmin {
  adminUserState: (
    u: unknown,
  ) => { key: string; label: string };
}

const PB = "/*PURE-ADMIN-BEGIN*/";
const PE = "/*PURE-ADMIN-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure admin block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { adminUserState };",
) as () => PureAdmin)();

Deno.test("adminUserState: حالة الحظر من العلم أو التاريخ", () => {
  eq(pure.adminUserState(null).key, "active", "null user");
  eq(pure.adminUserState({ banned: true }).key, "banned", "server flag");
  eq(pure.adminUserState({ banned: false }).key, "active", "server clear");
  eq(pure.adminUserState({ banned_until: BANNED_UNTIL }).key, "banned", "future until");
  eq(pure.adminUserState({ banned_until: EXPIRED_UNTIL }).key, "active", "expired until");
  eq(pure.adminUserState({ banned_until: null }).key, "active", "null until");
});
