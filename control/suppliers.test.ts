/**
 * اختبارات الموردين وسجل الموردين والتحويل (المرحلة م٣-ب) —
 * `deno test control/`: عميل بوت وهمي. التغطية: بوابة الأدمن قبل
 * أي نداء على كل مسار، الطريقة الغلط 405 قبل بوابة الأدمن، تمرير
 * مسارات القراءة بمسارها واستعلامها زي ما هما (بحث روابط مورد
 * بترقيمه)، تمرير أجسام الكتابة زي ما هي ورجوع حالة/جسم البوت زي
 * ما هما (بما فيها أخطاء التحويل 409)، جسم مش صالح = bad_body من
 * غير نداء، وفشل البوت = bot_unavailable. مفيش أي مسار حذف بين
 * المسارات دي — إغلاق السجل بيتم بحفظ الحالة «مغلق» بس.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import {
  type ControlSuppliersDeps,
  handleControlSuppliersRequest,
} from "./suppliers.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";

class FakeBotClient implements BotControlProxyClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  responses = new Map<string, BotProxyResult>();
  failNext = false;
  async proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.failNext) {
      this.failNext = false;
      throw new Error("bot down");
    }
    const hit = this.responses.get(path.split("?")[0]);
    if (hit) return hit;
    return { status: 200, body: { ok: true, proxied: path } };
  }
}

function makeDeps() {
  const bot = new FakeBotClient();
  const deps: ControlSuppliersDeps = {
    botClient: bot,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({ "X-Test-Cors": "yes" }),
    logError: () => {},
  };
  return { deps, bot };
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

const GET_ROUTES: [string, string][] = [
  ["/control/bot-suppliers", "/api/control/suppliers"],
  ["/control/bot-supplier-products", "/api/control/supplier-products"],
];
const POST_ROUTES: [string, string][] = [
  ["/control/bot-supplier-engine", "/api/control/supplier-engine"],
  ["/control/bot-supplier-registry-save", "/api/control/supplier-registry-save"],
  ["/control/bot-supplier-link", "/api/control/supplier-link"],
  ["/control/bot-catalog-failover", "/api/control/catalog-failover"],
];

Deno.test("suppliers: foreign paths return null (and there is no delete route)", async () => {
  const { deps, bot } = makeDeps();
  eq(await handleControlSuppliersRequest(
    req("/control/bot-catalog-products"), deps), null,
    "null for catalog path");
  eq(await handleControlSuppliersRequest(
    req("/control/bot-orders"), deps), null, "null for orders path");
  eq(await handleControlSuppliersRequest(
    req("/control/bot-supplier-delete", "POST", {}), deps), null,
    "no supplier delete route exists");
  const del = await handleControlSuppliersRequest(
    req("/control/bot-suppliers", "DELETE"), deps);
  eq(del?.status, 405,
    "DELETE on the list route is a method error, not a delete");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("suppliers: admin gate blocks every route before any proxy call", async () => {
  const { deps, bot } = makeDeps();
  for (const [path] of GET_ROUTES) {
    const res = await handleControlSuppliersRequest(
      req(path, "GET", undefined, false), deps);
    eq(res?.status, 401, `${path} without admin = 401`);
    eq((await res!.json()).error, "unauthorized", `${path} error code`);
  }
  for (const [path] of POST_ROUTES) {
    const res = await handleControlSuppliersRequest(
      req(path, "POST", {}, false), deps);
    eq(res?.status, 401, `${path} without admin = 401`);
  }
  eq(bot.calls.length, 0, "no bot call before admin on any route");
});

Deno.test("suppliers: wrong method is 405 and beats the admin gate", async () => {
  const { deps, bot } = makeDeps();
  const get = await handleControlSuppliersRequest(
    req("/control/bot-catalog-failover", "GET", undefined, false), deps);
  eq(get?.status, 405, "GET on the failover POST route = 405");
  const post = await handleControlSuppliersRequest(
    req("/control/bot-suppliers", "POST", {}, false), deps);
  eq(post?.status, 405, "POST on the list GET route = 405");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("suppliers: GET proxies pass path and query through verbatim", async () => {
  const { deps, bot } = makeDeps();
  const list = await handleControlSuppliersRequest(
    req("/control/bot-suppliers"), deps);
  eq(list?.status, 200, "list status");
  eq(list?.headers.get("x-test-cors"), "yes", "cors headers pass through");
  eq(bot.calls[0].path, "/api/control/suppliers", "list bot path");
  eq(bot.calls[0].method, "GET", "list method");

  const products = await handleControlSuppliersRequest(
    req("/control/bot-supplier-products?provider=wasmou&q=canva&limit=50&offset=100"),
    deps);
  eq(products?.status, 200, "products status");
  eq(bot.calls[1].path,
    "/api/control/supplier-products?provider=wasmou&q=canva&limit=50&offset=100",
    "search + pagination query passes through verbatim");
});

Deno.test("suppliers: POST proxies pass body verbatim and return bot status/body", async () => {
  const { deps, bot } = makeDeps();
  bot.responses.set("/api/control/catalog-failover", {
    status: 409,
    body: { ok: false, error: "failover_incomplete", registry_locked: true },
  });
  const failover = await handleControlSuppliersRequest(
    req("/control/bot-catalog-failover", "POST", {
      product_key: "canva-pro-1y",
      target_supplier_key: "drayik",
      reason: "المورد الحالي واقف",
    }), deps);
  eq(failover?.status, 409, "bot 409 passes through");
  const failoverBody = await failover!.json();
  eq(failoverBody.error, "failover_incomplete", "bot error code passes");
  eq(failoverBody.registry_locked, true, "bot error extras pass through");
  eq(bot.calls[0].path, "/api/control/catalog-failover", "failover bot path");
  eq(bot.calls[0].body, {
    product_key: "canva-pro-1y",
    target_supplier_key: "drayik",
    reason: "المورد الحالي واقف",
  }, "failover body verbatim");

  for (const [path, botPath] of POST_ROUTES) {
    if (path === "/control/bot-catalog-failover") continue;
    const res = await handleControlSuppliersRequest(
      req(path, "POST", { probe: path }), deps);
    eq(res?.status, 200, `${path} status`);
    const call = bot.calls[bot.calls.length - 1];
    eq(call.path, botPath, `${path} bot path`);
    eq(call.body, { probe: path }, `${path} body verbatim`);
  }
});

Deno.test("suppliers: invalid POST body is bad_body with no bot call", async () => {
  const { deps, bot } = makeDeps();
  const arr = await handleControlSuppliersRequest(
    req("/control/bot-supplier-engine", "POST", ["activate"]), deps);
  eq(arr?.status, 400, "array body = 400");
  eq((await arr!.json()).error, "bad_body", "error code");
  const raw = new Request("https://api.example/control/bot-supplier-engine", {
    method: "POST",
    headers: { "x-migo-admin": ADMIN_KEY, "Content-Type": "application/json" },
    body: "{not json",
  });
  const bad = await handleControlSuppliersRequest(raw, deps);
  eq(bad?.status, 400, "unparseable body = 400");
  eq((await bad!.json()).error, "bad_body", "error code");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("suppliers: bot failure surfaces as bot_unavailable", async () => {
  const { deps, bot } = makeDeps();
  bot.failNext = true;
  const res = await handleControlSuppliersRequest(
    req("/control/bot-supplier-engine", "POST", {
      slug: "wasmou", op: "balance",
    }), deps);
  eq(res?.status, 502, "502");
  const body = await res!.json();
  eq(body.error, "bot_unavailable", "error code");
  eq(body.bot_unavailable, true, "flag set");
  ok(bot.calls.length === 1, "one attempted call");
});
