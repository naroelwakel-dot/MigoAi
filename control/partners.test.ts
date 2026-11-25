/**
 * اختبارات توريد الشركاء وحالة السيرفرات — `deno test control/`:
 * عميل بوت وهمي. التغطية: بوابة الأدمن قبل أي نداء على كل
 * مسار، الطريقة الغلط 405 قبل بوابة الأدمن، تمرير مسارات
 * القراءة بمسارها واستعلامها زي ما هما (تفاصيل شريك بمعرّفه)،
 * فكّ الالتباس بين /control/partners و/control/partner (الأطول
 * بيكسب)، تمرير أجسام الكتابة زي ما هي ورجوع حالة/جسم البوت
 * زي ما هما، جسم مش صالح = bad_body من غير نداء، وفشل البوت
 * = bot_unavailable. مفيش أي مسار حذف بين المسارات دي.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import {
  type ControlPartnersDeps,
  handleControlPartnersRequest,
} from "./partners.ts";

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
  const deps: ControlPartnersDeps = {
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
  ["/control/partners", "/api/control/partners"],
  ["/control/partner", "/api/control/partner"],
  ["/control/servers", "/api/control/servers"],
];
const POST_ROUTES: [string, string][] = [
  ["/control/partner-credit", "/api/control/partner-credit"],
  ["/control/partner-received", "/api/control/partner-received"],
];

Deno.test("partners: foreign paths return null (and there is no delete route)", async () => {
  const { deps, bot } = makeDeps();
  eq(await handleControlPartnersRequest(
    req("/control/bot-suppliers"), deps), null, "null for suppliers path");
  eq(await handleControlPartnersRequest(
    req("/control/bot-orders"), deps), null, "null for orders path");
  eq(await handleControlPartnersRequest(
    req("/control/partner-delete", "POST", {}), deps), null,
    "no partner delete route exists");
  const del = await handleControlPartnersRequest(
    req("/control/partners", "DELETE"), deps);
  eq(del?.status, 405,
    "DELETE on the list route is a method error, not a delete");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("partners: admin gate blocks every route before any proxy call", async () => {
  const { deps, bot } = makeDeps();
  for (const [path] of GET_ROUTES) {
    const res = await handleControlPartnersRequest(
      req(path, "GET", undefined, false), deps);
    eq(res?.status, 401, `${path} without admin = 401`);
    eq((await res!.json()).error, "unauthorized", `${path} error code`);
  }
  for (const [path] of POST_ROUTES) {
    const res = await handleControlPartnersRequest(
      req(path, "POST", {}, false), deps);
    eq(res?.status, 401, `${path} without admin = 401`);
  }
  eq(bot.calls.length, 0, "no bot call before admin on any route");
});

Deno.test("partners: wrong method is 405 and beats the admin gate", async () => {
  const { deps, bot } = makeDeps();
  const get = await handleControlPartnersRequest(
    req("/control/partner-credit", "GET", undefined, false), deps);
  eq(get?.status, 405, "GET on the credit POST route = 405");
  const post = await handleControlPartnersRequest(
    req("/control/partners", "POST", {}, false), deps);
  eq(post?.status, 405, "POST on the list GET route = 405");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("partners: GET proxies pass path and query through verbatim", async () => {
  const { deps, bot } = makeDeps();
  const list = await handleControlPartnersRequest(
    req("/control/partners"), deps);
  eq(list?.status, 200, "list status");
  eq(list?.headers.get("x-test-cors"), "yes", "cors headers pass through");
  eq(bot.calls[0].path, "/api/control/partners",
    "list goes to the list bot path, not the detail one");
  eq(bot.calls[0].method, "GET", "list method");

  const detail = await handleControlPartnersRequest(
    req("/control/partner?id=prt_7B_ZGqdKIbhU"), deps);
  eq(detail?.status, 200, "detail status");
  eq(bot.calls[1].path, "/api/control/partner?id=prt_7B_ZGqdKIbhU",
    "detail id query passes through verbatim");

  const servers = await handleControlPartnersRequest(
    req("/control/servers"), deps);
  eq(servers?.status, 200, "servers status");
  eq(bot.calls[2].path, "/api/control/servers", "servers bot path");
});

Deno.test("partners: POST proxies pass body verbatim and return bot status/body", async () => {
  const { deps, bot } = makeDeps();
  bot.responses.set("/api/control/partner-credit", {
    status: 200,
    body: { ok: true, balance_cents: 3440, tranches: [] },
  });
  const credit = await handleControlPartnersRequest(
    req("/control/partner-credit", "POST", {
      partner_id: "prt_7B_ZGqdKIbhU",
      amount_cents: 1600,
      price_cents: 16,
      note: "دفعة ١٠٠ تفعيلة",
    }), deps);
  eq(credit?.status, 200, "credit status");
  const creditBody = await credit!.json();
  eq(creditBody.balance_cents, 3440, "bot balance passes through");
  eq(bot.calls[0].path, "/api/control/partner-credit", "credit bot path");
  eq(bot.calls[0].body, {
    partner_id: "prt_7B_ZGqdKIbhU",
    amount_cents: 1600,
    price_cents: 16,
    note: "دفعة ١٠٠ تفعيلة",
  }, "credit body verbatim");

  for (const [path, botPath] of POST_ROUTES) {
    if (path === "/control/partner-credit") continue;
    const res = await handleControlPartnersRequest(
      req(path, "POST", { probe: path }), deps);
    eq(res?.status, 200, `${path} status`);
    const call = bot.calls[bot.calls.length - 1];
    eq(call.path, botPath, `${path} bot path`);
    eq(call.body, { probe: path }, `${path} body verbatim`);
  }
});

Deno.test("partners: invalid POST body is bad_body with no bot call", async () => {
  const { deps, bot } = makeDeps();
  const arr = await handleControlPartnersRequest(
    req("/control/partner-credit", "POST", ["credit"]), deps);
  eq(arr?.status, 400, "array body = 400");
  eq((await arr!.json()).error, "bad_body", "error code");
  const raw = new Request("https://api.example/control/partner-received", {
    method: "POST",
    headers: { "x-migo-admin": ADMIN_KEY, "Content-Type": "application/json" },
    body: "{not json",
  });
  const bad = await handleControlPartnersRequest(raw, deps);
  eq(bad?.status, 400, "unparseable body = 400");
  eq((await bad!.json()).error, "bad_body", "error code");
  eq(bot.calls.length, 0, "no bot calls");
});

Deno.test("partners: bot failure surfaces as bot_unavailable", async () => {
  const { deps, bot } = makeDeps();
  bot.failNext = true;
  const res = await handleControlPartnersRequest(
    req("/control/partner-received", "POST", {
      partner_id: "prt_7B_ZGqdKIbhU", amount_cents: 1100,
    }), deps);
  eq(res?.status, 502, "502");
  const body = await res!.json();
  eq(body.error, "bot_unavailable", "error code");
  eq(body.bot_unavailable, true, "flag set");
  ok(bot.calls.length === 1, "one attempted call");
});
