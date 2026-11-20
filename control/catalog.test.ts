/**
 * اختبارات كتالوج البوت وخريطة الهوية (المرحلة م٣-ب) —
 * `deno test control/`: عميل بوت وهمي. التغطية: بوابة الأدمن قبل
 * أي نداء على كل مسار، الطريقة الغلط 405 قبل بوابة الأدمن، تمرير
 * مسارات القراءة بمسارها واستعلامها زي ما هما، تمرير أجسام الكتابة
 * زي ما هي ورجوع حالة/جسم البوت زي ما هما (بما فيها أخطاء 409)،
 * جسم مش صالح = bad_body من غير نداء، وفشل البوت = bot_unavailable.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import {
  type ControlCatalogDeps,
  handleControlCatalogRequest,
} from "./catalog.ts";

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
  const deps: ControlCatalogDeps = {
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
  ["/control/bot-catalog-products", "/api/control/catalog-products"],
  ["/control/bot-catalog-identity", "/api/control/catalog-identity"],
  [
    "/control/bot-catalog-product-suppliers",
    "/api/control/catalog-product-suppliers",
  ],
];
const POST_ROUTES: [string, string][] = [
  ["/control/bot-catalog-product-save", "/api/control/catalog-product-save"],
  ["/control/bot-catalog-price-batch", "/api/control/catalog-price-batch"],
  [
    "/control/bot-catalog-price-batch-undo",
    "/api/control/catalog-price-batch-undo",
  ],
  ["/control/bot-catalog-category-save", "/api/control/catalog-category-save"],
  ["/control/bot-catalog-identity-save", "/api/control/catalog-identity-save"],
];

Deno.test("catalog: foreign paths return null", async () => {
  const { deps, bot } = makeDeps();
  eq(await handleControlCatalogRequest(
    req("/control/bot-orders"), deps), null, "null for orders path");
  eq(await handleControlCatalogRequest(
    req("/control/store-prices"), deps), null, "null for prices path");
  eq(await handleControlCatalogRequest(
    req("/control/bot-suppliers"), deps), null, "null for suppliers path");
  eq(await handleControlCatalogRequest(
    req("/control/bot-catalog"), deps), null, "null for bare prefix");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("catalog: admin gate blocks every route before any proxy call", async () => {
  const { deps, bot } = makeDeps();
  for (const [path] of GET_ROUTES) {
    const res = await handleControlCatalogRequest(
      req(path, "GET", undefined, false), deps);
    eq(res?.status, 401, `${path} without admin = 401`);
    eq((await res!.json()).error, "unauthorized", `${path} error code`);
  }
  for (const [path] of POST_ROUTES) {
    const res = await handleControlCatalogRequest(
      req(path, "POST", {}, false), deps);
    eq(res?.status, 401, `${path} without admin = 401`);
  }
  eq(bot.calls.length, 0, "no bot call before admin on any route");
});

Deno.test("catalog: wrong method is 405 and beats the admin gate", async () => {
  const { deps, bot } = makeDeps();
  const get = await handleControlCatalogRequest(
    req("/control/bot-catalog-product-save", "GET", undefined, false), deps);
  eq(get?.status, 405, "GET on a POST route = 405 even without admin");
  const post = await handleControlCatalogRequest(
    req("/control/bot-catalog-products", "POST", {}, false), deps);
  eq(post?.status, 405, "POST on a GET route = 405 even without admin");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("catalog: GET proxies pass path and query through verbatim", async () => {
  const { deps, bot } = makeDeps();
  for (const [path, botPath] of GET_ROUTES) {
    const res = await handleControlCatalogRequest(req(path), deps);
    eq(res?.status, 200, `${path} status`);
  }
  eq(bot.calls.map((c) => c.path), GET_ROUTES.map((r) => r[1]),
    "bot paths in order");
  eq(bot.calls.every((c) => c.method === "GET"), true, "all GET");

  const one = await handleControlCatalogRequest(
    req("/control/bot-catalog-product-suppliers?product_id=abc-123"), deps);
  eq(one?.status, 200, "product suppliers status");
  eq(one?.headers.get("x-test-cors"), "yes", "cors headers pass through");
  eq(bot.calls[3].path,
    "/api/control/catalog-product-suppliers?product_id=abc-123",
    "query passes through verbatim");
});

Deno.test("catalog: POST proxies pass body verbatim and return bot status/body", async () => {
  const { deps, bot } = makeDeps();
  bot.responses.set("/api/control/catalog-price-batch", {
    status: 409,
    body: { ok: false, error: "below_floor", product_ids: ["p1"] },
  });
  const conflict = await handleControlCatalogRequest(
    req("/control/bot-catalog-price-batch", "POST", {
      items: [{ product_id: "p1", cost_cents: 100 }],
      dry_run: false,
      reason: "تعديل تكلفة",
    }), deps);
  eq(conflict?.status, 409, "bot 409 passes through");
  const conflictBody = await conflict!.json();
  eq(conflictBody.error, "below_floor", "bot error code passes through");
  eq(conflictBody.product_ids, ["p1"], "bot error extras pass through");
  eq(bot.calls[0].path, "/api/control/catalog-price-batch", "bot path");
  eq(bot.calls[0].method, "POST", "bot method");
  eq(bot.calls[0].body, {
    items: [{ product_id: "p1", cost_cents: 100 }],
    dry_run: false,
    reason: "تعديل تكلفة",
  }, "body passes verbatim");

  for (const [path, botPath] of POST_ROUTES) {
    if (path === "/control/bot-catalog-price-batch") continue;
    const res = await handleControlCatalogRequest(
      req(path, "POST", { probe: path }), deps);
    eq(res?.status, 200, `${path} status`);
    const call = bot.calls[bot.calls.length - 1];
    eq(call.path, botPath, `${path} bot path`);
    eq(call.body, { probe: path }, `${path} body verbatim`);
  }

  const undo = await handleControlCatalogRequest(
    req("/control/bot-catalog-price-batch-undo", "POST", {
      audit_id: 42, reason: "تراجع",
    }), deps);
  eq(undo?.status, 200, "undo status");
  eq(bot.calls[bot.calls.length - 1].path,
    "/api/control/catalog-price-batch-undo",
    "undo is its own route, not price-batch");
});

Deno.test("catalog: invalid POST body is bad_body with no bot call", async () => {
  const { deps, bot } = makeDeps();
  const arr = await handleControlCatalogRequest(
    req("/control/bot-catalog-product-save", "POST", [1, 2]), deps);
  eq(arr?.status, 400, "array body = 400");
  eq((await arr!.json()).error, "bad_body", "error code");
  const raw = new Request("https://api.example/control/bot-catalog-product-save", {
    method: "POST",
    headers: { "x-migo-admin": ADMIN_KEY, "Content-Type": "application/json" },
    body: "{not json",
  });
  const bad = await handleControlCatalogRequest(raw, deps);
  eq(bad?.status, 400, "unparseable body = 400");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("catalog: bot failure surfaces as bot_unavailable", async () => {
  const { deps, bot } = makeDeps();
  bot.failNext = true;
  const res = await handleControlCatalogRequest(
    req("/control/bot-catalog-products"), deps);
  eq(res?.status, 502, "502");
  const body = await res!.json();
  eq(body.error, "bot_unavailable", "error code");
  eq(body.bot_unavailable, true, "flag set");
  ok(bot.calls.length === 1, "one attempted call");
});
