// اختبارات وحدة مسؤولي اللوحة (موجة Instinct الرابعة، البند ٢٣) —
// `deno test control/admins.test.ts`
// عميل سجل وهمي في الذاكرة + اختبار عميل PostgREST الحقيقي بـ
// fetch مثبّت — مفيش أي نداء شبكة ولا قاعدة حقيقية. التغطية:
// بوابة الأدمن (401 قبل أي نداء)، 405 قبل البوابة، إدارة السجل
// owner-only (403 لأدوار support/catalog المربوطة)، مصفوفة
// الصلاحيات وrequireRole، القائمة البيضاء للحقول، تحقق الإنشاء
// والإيقاف، والإيقاف بيرفع token_version في نفس الكتابة. وفوق
// ده عقد الخمول: من غير مزوّد دور، المسؤول المصادَق الحالي هو
// owner ضمنيًا وبيعدّي، ومعالج الوحدة ما بيلمسش مسارات الجلسة،
// وسلوك دخول الجلسة نفسه ثابت (دخول ناجح بيطلع جلسة موقعة
// صالحة بفاحص admin_auth القائم).
import { tokenEquals, verifySessionToken } from "../admin_auth.ts";
import type { BotProxyResult } from "./customers.ts";
import { handleControlSessionRequest } from "./session.ts";
import {
  type AdminRole,
  ALL_PERMISSIONS,
  type ControlAdminRow,
  type ControlAdminsClient,
  type ControlAdminsDeps,
  handleControlAdminsRequest,
  hasPermission,
  PostgrestAdminsClient,
  requirePermission,
  requireRole,
  ROLE_PERMISSIONS,
} from "./admins.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const A3 = "33333333-3333-4333-8333-333333333333";

// ------------------------------------------------------- سجل وهمي
class FakeAdminsClient implements ControlAdminsClient {
  rows = new Map<string, ControlAdminRow>();
  calls: string[] = [];
  fail = false;
  private seq = 0;

  private guard(method: string) {
    this.calls.push(method);
    if (this.fail) throw new Error("store down");
  }
  listAdmins(): Promise<ControlAdminRow[]> {
    this.guard("list");
    return Promise.resolve([...this.rows.values()]);
  }
  createAdmin(input: { name: string; role: AdminRole }) {
    this.guard("create");
    this.seq++;
    const row: ControlAdminRow = {
      id: `44444444-4444-4444-8444-44444444444${this.seq}`,
      name: input.name,
      role: input.role,
      disabled: false,
      token_version: 1,
      created_at: "2026-11-23T10:00:00.000Z",
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }
  getAdmin(id: string): Promise<ControlAdminRow | null> {
    this.guard("get");
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  disableAdmin(id: string): Promise<ControlAdminRow | null> {
    this.guard("disable");
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    row.disabled = true;
    row.token_version = Number(row.token_version) + 1;
    return Promise.resolve(row);
  }
}

function seed(client: FakeAdminsClient) {
  client.rows.set(A1, {
    id: A1, name: "Martin", role: "owner", disabled: false,
    token_version: 1, created_at: "2026-11-20T09:00:00.000Z",
  });
  client.rows.set(A2, {
    id: A2, name: "دعم", role: "support", disabled: false,
    token_version: 3, created_at: "2026-11-21T09:00:00.000Z",
  });
}

function depsOf(
  client: FakeAdminsClient,
  opts: { admin?: boolean; role?: AdminRole | null; withRoleOf?: boolean } = {},
): ControlAdminsDeps {
  const deps: ControlAdminsDeps = {
    client,
    isAdmin: () => opts.admin !== false,
    corsOf: () => ({}),
    logError: () => {},
  };
  if (opts.withRoleOf) {
    deps.currentRoleOf = () => opts.role ?? null;
  }
  return deps;
}

function req(path: string, method = "GET", body?: unknown): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: body !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null — ومسارات الجلسة مش بتاعة الوحدة دي", async () => {
  const d = depsOf(new FakeAdminsClient());
  eq(await handleControlAdminsRequest(req("/control/admin"), d), null, "bare admin");
  eq(await handleControlAdminsRequest(req("/control/admins-x"), d), null, "suffix-x");
  eq(await handleControlAdminsRequest(req("/control/admin-users"), d), null, "site admin-users is another module");
  eq(await handleControlAdminsRequest(req("/control/session-login", "POST", {}), d), null, "session-login untouched");
  eq(await handleControlAdminsRequest(req("/control/bot-totp-enroll", "POST", {}), d), null, "totp-enroll untouched");
  eq(await handleControlAdminsRequest(req("/control/home"), d), null, "home");
});

Deno.test("405 قبل البوابة وقبل أي نداء سجل", async () => {
  const client = new FakeAdminsClient();
  const d = depsOf(client, { admin: false });
  eq((await handleControlAdminsRequest(req("/control/admins", "DELETE"), d))?.status, 405, "DELETE list");
  eq((await handleControlAdminsRequest(req("/control/admins", "PUT", {}), d))?.status, 405, "PUT list");
  eq((await handleControlAdminsRequest(req("/control/admins-disable", "GET"), d))?.status, 405, "GET disable");
  eq(client.calls.length, 0, "zero store calls on 405");
});

Deno.test("بوابة الأدمن: 401 قبل أي نداء سجل على المسارات التلاتة", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  const d = depsOf(client, { admin: false });
  eq((await handleControlAdminsRequest(req("/control/admins"), d))?.status, 401, "list 401");
  eq((await handleControlAdminsRequest(req("/control/admins", "POST", { name: "x", role: "support" }), d))?.status, 401, "create 401");
  eq((await handleControlAdminsRequest(req("/control/admins-disable", "POST", { id: A1 }), d))?.status, 401, "disable 401");
  eq(client.calls.length, 0, "zero store calls behind the gate");
});

// ------------------------------------------------------- عقد الخمول
Deno.test("الخمول: من غير مزوّد دور، المصادَق الحالي owner ضمنيًا وبيعدّي في الكل", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  const d = depsOf(client); // no currentRoleOf at all — today's wiring
  const list = await handleControlAdminsRequest(req("/control/admins"), d);
  eq(list?.status, 200, "list ok for implicit owner");
  const created = await handleControlAdminsRequest(
    req("/control/admins", "POST", { name: "جديد", role: "catalog" }), d);
  eq(created?.status, 200, "create ok for implicit owner");
  const disabled = await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", { id: A2 }), d);
  eq(disabled?.status, 200, "disable ok for implicit owner");
});

Deno.test("الخمول: مزوّد دور بيرجع null = owner ضمني برضه", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  const d = depsOf(client, { withRoleOf: true, role: null });
  eq((await handleControlAdminsRequest(req("/control/admins"), d))?.status, 200, "null role falls back to owner");
});

Deno.test("إدارة السجل owner-only: support و catalog بيقفوا 403 قبل أي نداء", async () => {
  for (const role of ["support", "catalog"] as AdminRole[]) {
    const client = new FakeAdminsClient();
    seed(client);
    const d = depsOf(client, { withRoleOf: true, role });
    const list = await handleControlAdminsRequest(req("/control/admins"), d);
    eq(list?.status, 403, `${role} list 403`);
    eq((await bodyOf(list)).error, "forbidden", `${role} list error`);
    eq((await handleControlAdminsRequest(
      req("/control/admins", "POST", { name: "x", role: "support" }), d))?.status, 403, `${role} create 403`);
    eq((await handleControlAdminsRequest(
      req("/control/admins-disable", "POST", { id: A1 }), d))?.status, 403, `${role} disable 403`);
    eq(client.calls.length, 0, `${role}: zero store calls behind the role gate`);
  }
  const client = new FakeAdminsClient();
  seed(client);
  const owner = depsOf(client, { withRoleOf: true, role: "owner" });
  eq((await handleControlAdminsRequest(req("/control/admins"), owner))?.status, 200, "explicit owner passes");
});

// ------------------------------------------------------------- القائمة
Deno.test("القائمة: حقول بيضاء بس — أي عمود زيادة في الصف ما بيعدّيش", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  // صف شايل حقل شكله سرّ (محاكاة عمود مستقبلي): الرد ما يشيلوش.
  client.rows.set(A3, {
    id: A3, name: "x", role: "catalog", disabled: true,
    token_version: 2, created_at: null,
    ...({ token_hash: "should-never-leak" } as Record<string, unknown>),
  } as ControlAdminRow);
  const res = await handleControlAdminsRequest(
    req("/control/admins"), depsOf(client));
  eq(res?.status, 200, "status");
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store");
  const admins = (await bodyOf(res)).admins as Record<string, unknown>[];
  eq(admins.length, 3, "all rows listed");
  eq(Object.keys(admins[0]).sort(),
    ["created_at", "disabled", "id", "name", "role", "token_version"],
    "whitelisted keys only");
  eq(admins[0].name, "Martin", "name present");
  eq(admins[1].token_version, 3, "token_version present");
  ok(!JSON.stringify(admins).includes("should-never-leak"), "extra field never leaks");
});

// ------------------------------------------------------------- الإنشاء
Deno.test("الإنشاء: تحقق الاسم والدور والجسم", async () => {
  const client = new FakeAdminsClient();
  const d = depsOf(client);
  const bad: [unknown, string][] = [
    [{ role: "support" }, "bad_name"],
    [{ name: "   ", role: "support" }, "bad_name"],
    [{ name: "x".repeat(101), role: "support" }, "bad_name"],
    [{ name: 42, role: "support" }, "bad_name"],
    [{ name: "x" }, "bad_role"],
    [{ name: "x", role: "admin" }, "bad_role"],
    [{ name: "x", role: "OWNER" }, "bad_role"],
  ];
  for (const [b, err] of bad) {
    const res = await handleControlAdminsRequest(
      req("/control/admins", "POST", b), d);
    eq(res?.status, 400, `400 for ${err}`);
    eq((await bodyOf(res)).error, err, `error ${err}`);
  }
  const arrRes = await handleControlAdminsRequest(
    new Request("https://api.example/control/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([1]),
    }), d);
  eq(arrRes?.status, 400, "array body 400");
  eq((await bodyOf(arrRes)).error, "bad_body", "array body error");
  eq(client.calls.filter((c) => c === "create").length, 0, "no create on invalid input");
});

Deno.test("الإنشاء الناجح: الاسم بيتنضف والدفولتات من السجل", async () => {
  const client = new FakeAdminsClient();
  const res = await handleControlAdminsRequest(
    req("/control/admins", "POST", { name: "  سارة  ", role: "support" }),
    depsOf(client));
  eq(res?.status, 200, "status");
  const admin = (await bodyOf(res)).admin as Record<string, unknown>;
  eq(admin.name, "سارة", "name trimmed");
  eq(admin.role, "support", "role");
  eq(admin.disabled, false, "starts enabled");
  eq(admin.token_version, 1, "token_version starts at 1");
});

// ------------------------------------------------------------- الإيقاف
Deno.test("الإيقاف: تحقق المعرّف والوجود", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  const d = depsOf(client);
  eq((await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", {}), d))?.status, 400, "missing id 400");
  const badUuid = await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", { id: "not-a-uuid" }), d);
  eq(badUuid?.status, 400, "bad uuid 400");
  eq((await bodyOf(badUuid)).error, "bad_id", "bad uuid error");
  const missing = await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", { id: A3 }), d);
  eq(missing?.status, 404, "unknown admin 404");
  eq((await bodyOf(missing)).error, "not_found", "404 error");
});

Deno.test("الإيقاف بيرفع token_version في نفس العملية — وكل إيقاف رفع جديد", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  const d = depsOf(client);
  const res = await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", { id: A2 }), d);
  eq(res?.status, 200, "status");
  const admin = (await bodyOf(res)).admin as Record<string, unknown>;
  eq(admin.disabled, true, "disabled set");
  eq(admin.token_version, 4, "token_version 3 -> 4 (revocation bump)");
  const again = await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", { id: A2 }), d);
  const admin2 = (await bodyOf(again)).admin as Record<string, unknown>;
  eq(admin2.token_version, 5, "second disable bumps again 4 -> 5");
});

Deno.test("فشل السجل = 502 store_failed على المسارات التلاتة", async () => {
  const client = new FakeAdminsClient();
  seed(client);
  client.fail = true;
  const d = depsOf(client);
  eq((await handleControlAdminsRequest(req("/control/admins"), d))?.status, 502, "list 502");
  eq((await handleControlAdminsRequest(
    req("/control/admins", "POST", { name: "x", role: "owner" }), d))?.status, 502, "create 502");
  const dis = await handleControlAdminsRequest(
    req("/control/admins-disable", "POST", { id: A1 }), d);
  eq(dis?.status, 502, "disable 502");
  eq((await bodyOf(dis)).error, "store_failed", "disable 502 error");
});

// ------------------------------------------------- مصفوفة الصلاحيات
Deno.test("مصفوفة الصلاحيات: owner كل حاجة", () => {
  for (const p of ALL_PERMISSIONS) {
    ok(hasPermission("owner", p), `owner can ${p}`);
    ok(requirePermission("owner", p), `owner requirePermission ${p}`);
  }
  eq(ROLE_PERMISSIONS.owner.length, ALL_PERMISSIONS.length, "owner row is the full set");
});

Deno.test("مصفوفة الصلاحيات: support شغل العملاء بس — من غير إعدادات/مفاتيح/مسؤولين/فلوس", () => {
  for (const p of ["customers", "chats", "orders", "topup_decisions"] as const) {
    ok(hasPermission("support", p), `support can ${p}`);
  }
  for (
    const p of [
      "settings", "keys", "admins", "money", "catalog", "prices", "coupons",
    ] as const
  ) {
    eq(hasPermission("support", p), false, `support cannot ${p}`);
  }
});

Deno.test("مصفوفة الصلاحيات: catalog كتالوج بس — من غير فلوس ولا إعدادات ولا عملاء", () => {
  for (const p of ["catalog", "prices", "coupons"] as const) {
    ok(hasPermission("catalog", p), `catalog can ${p}`);
  }
  for (
    const p of [
      "money", "settings", "keys", "admins", "customers", "chats",
      "orders", "topup_decisions",
    ] as const
  ) {
    eq(hasPermission("catalog", p), false, `catalog cannot ${p}`);
  }
});

Deno.test("requireRole: المسموح بس بيعدّي، والغايب/المجهول لأ", () => {
  eq(requireRole("owner", ["owner"]), true, "owner in owner");
  eq(requireRole("support", ["owner"]), false, "support not owner");
  eq(requireRole("support", ["owner", "support"]), true, "support allowed list");
  eq(requireRole(null, ["owner"]), false, "null role denied");
  eq(requireRole(undefined, ["owner"]), false, "undefined role denied");
  eq(hasPermission(null, "customers"), false, "null role has nothing");
});

// ------------------------------------------- عميل PostgREST بـ fetch مثبّت
Deno.test("عميل PostgREST: اختيار الأعمدة البيضاء والإيقاف المحروس بالنسخة", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const stored: Record<string, unknown> = {
    id: A2, name: "دعم", role: "support", disabled: false,
    token_version: 3, created_at: "2026-11-21T09:00:00.000Z",
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    calls.push({
      url, method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    if (method === "PATCH") {
      const patch = JSON.parse(calls[calls.length - 1].body || "{}");
      Object.assign(stored, patch);
      return Promise.resolve(new Response(JSON.stringify([stored]), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    if (method === "POST") {
      const inputBody = JSON.parse(calls[calls.length - 1].body || "{}");
      return Promise.resolve(new Response(JSON.stringify([{
        id: A1, disabled: false, token_version: 1,
        created_at: "2026-11-23T10:00:00.000Z", ...inputBody,
      }]), { status: 201, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.resolve(new Response(JSON.stringify([stored]), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
  }) as typeof fetch;
  try {
    const client = new PostgrestAdminsClient({
      baseUrl: "https://db.example",
      keyOf: () => "service-key",
    });
    const list = await client.listAdmins();
    eq(list.length, 1, "one admin listed");
    ok(calls[0].url.includes("control_admins?select=id,name,role,disabled,token_version,created_at"),
      "list selects whitelisted columns only");

    const created = await client.createAdmin({ name: "جديد", role: "catalog" });
    eq(created.role, "catalog", "created role");
    eq(JSON.parse(calls[1].body || "{}"), { name: "جديد", role: "catalog" }, "create body is name+role only");

    const after = await client.disableAdmin(A2);
    eq(after?.disabled, true, "disabled after patch");
    eq(after?.token_version, 4, "version bumped 3 -> 4");
    const patch = calls[calls.length - 1];
    eq(patch.method, "PATCH", "disable writes PATCH");
    ok(patch.url.includes("token_version=eq.3"), "patch guarded by the read version");
    eq(JSON.parse(patch.body || "{}"),
      { disabled: true, token_version: 4 }, "one write carries flag + bump together");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --------------------------------- الخمول: سلوك الجلسة ثابت ومفيش ربط
Deno.test("الخمول: دخول الجلسة القائم بيشتغل زي ما هو — جلسة موقعة صالحة", async () => {
  const ADMIN = "shared-master";
  const NOW = 1_800_000_000;
  const bot = {
    calls: [] as { method: string; path: string }[],
    proxy(method: string, path: string): Promise<BotProxyResult> {
      this.calls.push({ method, path });
      return Promise.resolve({ status: 200, body: { ok: true, active: true } });
    },
  };
  const res = await handleControlSessionRequest(
    new Request("https://api.example/control/session-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-migo-admin": ADMIN,
      },
      body: JSON.stringify({ code: "fake-code" }),
    }),
    {
      botClient: bot,
      isAdmin: (r: Request) =>
        tokenEquals(r.headers.get("x-migo-admin") || "", ADMIN),
      corsOf: () => ({}),
      logError: () => {},
      adminToken: ADMIN,
      nowSeconds: () => NOW,
    },
  );
  eq(res?.status, 200, "login still succeeds");
  const body = await res!.json() as Record<string, unknown>;
  eq(body.ok, true, "login ok");
  eq(
    await verifySessionToken(body.session as string, ADMIN, NOW),
    true,
    "issued session still verifies with the existing checker",
  );
});

Deno.test("الخمول: فحص ساكن — session.ts ما يعرفش الوحدة دي، والوحدة ما تستوردش الجلسة", async () => {
  const sessionSrc = await Deno.readTextFile(
    new URL("./session.ts", import.meta.url),
  );
  ok(!sessionSrc.includes("control_admins"), "session.ts never reads the roster");
  ok(!sessionSrc.includes("requireRole"), "session.ts has no role wiring");
  ok(!sessionSrc.includes("admins.ts"), "session.ts does not import admins");
  const adminsSrc = await Deno.readTextFile(
    new URL("./admins.ts", import.meta.url),
  );
  ok(!adminsSrc.includes("handleControlSessionRequest"), "admins never drives the session handler");
  ok(!adminsSrc.includes("makeSessionToken"), "admins never issues sessions");
});
