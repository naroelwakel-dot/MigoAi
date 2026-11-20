// اختبارات وحدة زوار البوت في اللوحة (متابعة م٦) —
// `deno test control/visitors.test.ts`
// عميل بوت وهمي (نمط channel.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. الوحدة دي تمرير خالص: العقد هو 405 قبل البوابة،
// 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم، وفشل البوت 502.
// والمنطق النقي بتاع شاشة الزوار عايش جوه سكربت اللوحة بين
// علامتي PURE-VISITORS — الاختبارات بتقراه من control.html
// حرفيًا وبتشغّله.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlVisitorsDeps,
  handleControlVisitorsRequest,
} from "./visitors.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ---------------------------------------------------------------- بوت وهمي
class FakeBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  result: BotProxyResult = { status: 200, body: { ok: true, echoed: true } };
  fail = false;

  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.fail) return Promise.reject(new Error("bot down"));
    return Promise.resolve(this.result);
  }
}

function depsOf(bot: FakeBotClient, admin = true): ControlVisitorsDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(path: string, method = "GET"): Request {
  return new Request(`https://api.example${path}`, { method });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

// ---------------------------------------------------------------- المسار
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlVisitorsRequest(req("/control/bot-visitors-x"), d), null, "suffix-x");
  eq(await handleControlVisitorsRequest(req("/control/bot-visitor"), d), null, "singular");
  eq(await handleControlVisitorsRequest(req("/control/bot-chats"), d), null, "chats");
  eq(await handleControlVisitorsRequest(req("/control/bot-channel-queue"), d), null, "channel");
  eq(await handleControlVisitorsRequest(req("/control/home"), d), null, "home");
});

Deno.test("بوابة الأدمن: 401 قبل أي نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const res = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    d,
  );
  eq(res?.status, 401, "status");
  eq((await bodyOf(res)).error, "unauthorized", "error");
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = await handleControlVisitorsRequest(
      req("/control/bot-visitors", m),
      d,
    );
    eq(res?.status, 405, `${m} status`);
    eq((await bodyOf(res)).error, "method", `${m} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("التمرير حرفي وبنفس الحالة والاستعلام بيعدّي", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const item = {
    chat_id: "5178395472",
    last_inbound_at: "2026-11-20T13:01:00.000Z",
    last_inbound_text: "تمام",
    inbound_count: 4,
    outbound_count: 6,
    balance_minor: 25000,
    balance_egp: 250,
    orders_count: 3,
    orders_fulfilled: 1,
    has_conversation: true,
  };
  bot.result = { status: 200, body: { ok: true, items: [item] } };
  const res = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    d,
  );
  eq(res?.status, 200, "status");
  eq(bot.calls.length, 1, "one bot call");
  eq(bot.calls[0].method, "GET", "method");
  eq(bot.calls[0].path, "/api/control/visitors", "bot path");
  eq(bot.calls[0].body, undefined, "GET has no body");
  eq((await bodyOf(res)).items, [item], "body verbatim");

  const res2 = await handleControlVisitorsRequest(
    req("/control/bot-visitors?limit=20"),
    d,
  );
  eq(res2?.status, 200, "query status");
  eq(bot.calls[1].path, "/api/control/visitors?limit=20", "query passthrough");

  bot.result = { status: 200, body: { ok: true, items: [] } };
  const res3 = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    d,
  );
  eq((await bodyOf(res3)).items, [], "empty state verbatim");

  bot.result = { status: 500, body: { ok: false, error: "db_down" } };
  const res4 = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    d,
  );
  eq(res4?.status, 500, "bot 500 status passthrough");
  eq((await bodyOf(res4)).error, "db_down", "bot error verbatim");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    d,
  );
  eq(res?.status, 502, "status");
  const body = await bodyOf(res);
  eq(body.error, "bot_unavailable", "error");
  eq(body.bot_unavailable, true, "flag");
});

Deno.test("ردود الزوار ممنوعة من الكاش (no-store)", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    d,
  );
  eq(res?.status, 200, "status");
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store on 200");
  const denied = await handleControlVisitorsRequest(
    req("/control/bot-visitors"),
    depsOf(bot, false),
  );
  eq(denied?.headers.get("Cache-Control"), "no-store", "no-store on 401");
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureVisitors {
  visitorItemsOf: (d: Record<string, unknown> | null) => unknown[];
  visitorChatRefOf: (v: Record<string, unknown> | null) => string;
  visitorHasChat: (v: Record<string, unknown> | null) => boolean;
  visitorsNextGen: (s: { gen?: number }) => number;
  visitorsGenIsCurrent: (s: { gen?: number } | null, gen: number) => boolean;
}

const PB = "/*PURE-VISITORS-BEGIN*/";
const PE = "/*PURE-VISITORS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure visitors block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { visitorItemsOf, visitorChatRefOf, visitorHasChat, visitorsNextGen, visitorsGenIsCurrent };",
) as () => PureVisitors)();

Deno.test("visitorItemsOf: أول مصفوفة معروفة", () => {
  eq(pure.visitorItemsOf({ items: [1] }), [1], "items");
  eq(pure.visitorItemsOf({ visitors: [2] }), [2], "visitors");
  eq(pure.visitorItemsOf({ rows: [3] }), [3], "rows");
  eq(pure.visitorItemsOf({}), [], "none");
  eq(pure.visitorItemsOf(null), [], "null");
});

Deno.test("visitors generation: الاستجابة الأقدم لا تستبدل الأحدث", () => {
  const state: { gen?: number } = {};
  const first = pure.visitorsNextGen(state);
  eq(first, 1, "first gen");
  ok(pure.visitorsGenIsCurrent(state, first), "only request is current");
  const second = pure.visitorsNextGen(state);
  eq(second, 2, "second gen");
  eq(pure.visitorsGenIsCurrent(state, first), false, "stale gen rejected");
  ok(pure.visitorsGenIsCurrent(state, second), "latest gen current");
  eq(pure.visitorsGenIsCurrent(null, second), false, "no state");
});

Deno.test("visitorChatRefOf و visitorHasChat: رابط المحادثة", () => {
  eq(pure.visitorChatRefOf({ chat_id: "123" }), "123", "string id");
  eq(pure.visitorChatRefOf({ chat_id: 123 }), "123", "numeric id stringified");
  eq(pure.visitorChatRefOf({}), "", "missing id");
  eq(pure.visitorChatRefOf(null), "", "null visitor");
  ok(pure.visitorHasChat({ chat_id: "1", has_conversation: true }), "has chat");
  eq(pure.visitorHasChat({ chat_id: "1", has_conversation: false }), false, "flag false");
  eq(pure.visitorHasChat({ chat_id: "1" }), false, "flag missing");
  eq(pure.visitorHasChat({ has_conversation: true }), false, "no chat id");
  eq(pure.visitorHasChat(null), false, "null visitor");
});
