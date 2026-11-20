// اختبارات وحدة حماية اللوحة (المرحلة م٦-د) —
// `deno test control/security.test.ts`
// عميل بوت وهمي (نمط visitors.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. الوحدة دي تمرير خالص: العقد هو 405 قبل البوابة،
// 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم، وفشل البوت 502.
// والمنطق النقي بتاع قرار بوابة الرقم السري عايش جوه سكربت
// اللوحة بين علامتي PURE-SECURITY — الاختبارات بتقراه من
// control.html حرفيًا وبتشغّله.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlSecurityDeps,
  handleControlSecurityRequest,
} from "./security.ts";
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

function depsOf(bot: FakeBotClient, admin = true): ControlSecurityDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
): Request {
  return new Request(`https://api.example${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined
      ? undefined
      : { "Content-Type": "application/json" },
  });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlSecurityRequest(req("/control/bot-pin"), d), null, "pin alone");
  eq(await handleControlSecurityRequest(req("/control/bot-pin-setx"), d), null, "suffix-x");
  eq(await handleControlSecurityRequest(req("/control/bot-settings"), d), null, "settings");
  eq(await handleControlSecurityRequest(req("/control/bot-visitors"), d), null, "visitors");
  eq(await handleControlSecurityRequest(req("/control/home"), d), null, "home");
});

Deno.test("بوابة الأدمن: 401 قبل أي نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const res = await handleControlSecurityRequest(
    req("/control/bot-pin-status"),
    d,
  );
  eq(res?.status, 401, "status GET");
  eq((await bodyOf(res)).error, "unauthorized", "error");
  const res2 = await handleControlSecurityRequest(
    req("/control/bot-pin-verify", "POST", { pin: "1234" }),
    d,
  );
  eq(res2?.status, 401, "status POST");
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const wrong: [string, string][] = [
    ["/control/bot-pin-set", "GET"],
    ["/control/bot-pin-verify", "GET"],
    ["/control/bot-pin-status", "POST"],
    ["/control/bot-settings-undo", "GET"],
    ["/control/bot-pin-set", "DELETE"],
  ];
  for (const [p, m] of wrong) {
    const res = await handleControlSecurityRequest(req(p, m), d);
    eq(res?.status, 405, `${m} ${p} status`);
    eq((await bodyOf(res)).error, "method", `${m} ${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("التمرير حرفي: ضبط الرقم السري وحالاته", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = { status: 200, body: { ok: true } };
  const res = await handleControlSecurityRequest(
    req("/control/bot-pin-set", "POST", { pin: "2468" }),
    d,
  );
  eq(res?.status, 200, "set status");
  eq(bot.calls.length, 1, "one bot call");
  eq(bot.calls[0].method, "POST", "set method");
  eq(bot.calls[0].path, "/api/control/pin-set", "set bot path");
  eq(bot.calls[0].body, { pin: "2468" }, "set body verbatim");

  bot.result = { status: 409, body: { ok: false, error: "pin_already_set" } };
  const res2 = await handleControlSecurityRequest(
    req("/control/bot-pin-set", "POST", { pin: "2468" }),
    d,
  );
  eq(res2?.status, 409, "already-set status passthrough");
  eq((await bodyOf(res2)).error, "pin_already_set", "already-set verbatim");

  bot.result = { status: 423, body: { ok: false, error: "pin_locked" } };
  const res3 = await handleControlSecurityRequest(
    req("/control/bot-pin-set", "POST", { pin: "2468", current_pin: "1357" }),
    d,
  );
  eq(res3?.status, 423, "locked status passthrough");
  eq((await bodyOf(res3)).error, "pin_locked", "locked verbatim");
});

Deno.test("التمرير حرفي: التحقق من الرقم السري", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 401,
    body: { ok: false, error: "pin_wrong", attempts_left: 3 },
  };
  const res = await handleControlSecurityRequest(
    req("/control/bot-pin-verify", "POST", { pin: "0000" }),
    d,
  );
  eq(res?.status, 401, "bot 401 status passthrough");
  const body = await bodyOf(res);
  eq(body.error, "pin_wrong", "pin_wrong verbatim");
  eq(body.attempts_left, 3, "attempts_left verbatim");
  eq(bot.calls[0].path, "/api/control/pin-verify", "verify bot path");

  bot.result = { status: 409, body: { ok: false, error: "pin_not_set" } };
  const res2 = await handleControlSecurityRequest(
    req("/control/bot-pin-verify", "POST", { pin: "0000" }),
    d,
  );
  eq(res2?.status, 409, "not-set status passthrough");
  eq((await bodyOf(res2)).error, "pin_not_set", "not-set verbatim");
});

Deno.test("التمرير حرفي: حالة الرقم السري GET", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 200,
    body: {
      ok: true,
      pin_set: true,
      locked: false,
      locked_until: null,
      gate_threshold_egp: 500,
    },
  };
  const res = await handleControlSecurityRequest(
    req("/control/bot-pin-status"),
    d,
  );
  eq(res?.status, 200, "status");
  eq(bot.calls[0].method, "GET", "method");
  eq(bot.calls[0].path, "/api/control/pin-status", "bot path");
  eq(bot.calls[0].body, undefined, "GET has no body");
  const body = await bodyOf(res);
  eq(body.pin_set, true, "pin_set verbatim");
  eq(body.gate_threshold_egp, 500, "threshold verbatim");
});

Deno.test("التمرير حرفي: تراجع الإعدادات", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 200,
    body: { ok: true, key: "sales_enabled", value: true, previous: false },
  };
  const res = await handleControlSecurityRequest(
    req("/control/bot-settings-undo", "POST", { history_id: 42 }),
    d,
  );
  eq(res?.status, 200, "undo status");
  eq(bot.calls[0].path, "/api/control/settings-undo", "undo bot path");
  eq(bot.calls[0].body, { history_id: 42 }, "undo body verbatim");
  eq((await bodyOf(res)).key, "sales_enabled", "undo result verbatim");

  bot.result = { status: 404, body: { ok: false, error: "history_not_found" } };
  const res2 = await handleControlSecurityRequest(
    req("/control/bot-settings-undo", "POST", { history_id: 999 }),
    d,
  );
  eq(res2?.status, 404, "not-found status passthrough");
  eq((await bodyOf(res2)).error, "history_not_found", "not-found verbatim");
});

Deno.test("جسم POST فاسد = 400 من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlSecurityRequest(
    new Request("https://api.example/control/bot-pin-set", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    }),
    d,
  );
  eq(res?.status, 400, "status");
  eq((await bodyOf(res)).error, "bad_body", "error");
  eq(bot.calls.length, 0, "zero bot calls on bad body");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlSecurityRequest(
    req("/control/bot-pin-status"),
    d,
  );
  eq(res?.status, 502, "status");
  const body = await bodyOf(res);
  eq(body.error, "bot_unavailable", "error");
  eq(body.bot_unavailable, true, "flag");
});

Deno.test("ردود الحماية ممنوعة من الكاش (no-store)", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlSecurityRequest(
    req("/control/bot-pin-status"),
    d,
  );
  eq(res?.status, 200, "status");
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store on 200");
  const denied = await handleControlSecurityRequest(
    req("/control/bot-pin-status"),
    depsOf(bot, false),
  );
  eq(denied?.headers.get("Cache-Control"), "no-store", "no-store on 401");
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureSecurity {
  walletAdjustNeedsPin: (
    mode: string,
    amountEgp: unknown,
    thresholdEgp: unknown,
    pinSet: unknown,
  ) => boolean;
}

const PB = "/*PURE-SECURITY-BEGIN*/";
const PE = "/*PURE-SECURITY-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure security block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { walletAdjustNeedsPin };",
) as () => PureSecurity)();

Deno.test("walletAdjustNeedsPin: مفيش رقم سري مضبوط = مفيش بوابة", () => {
  eq(pure.walletAdjustNeedsPin("set", 100, 500, false), false, "set, no pin");
  eq(pure.walletAdjustNeedsPin("add", 99999, 500, false), false, "big add, no pin");
  eq(pure.walletAdjustNeedsPin("add", 99999, 500, undefined), false, "pinSet missing");
});

Deno.test("walletAdjustNeedsPin: الضبط دايمًا محروس والحد شامل", () => {
  eq(pure.walletAdjustNeedsPin("set", 1, 500, true), true, "set always gated");
  eq(pure.walletAdjustNeedsPin("set", 0, 500, true), true, "set to zero gated");
  eq(pure.walletAdjustNeedsPin("add", 500, 500, true), true, "at threshold gated");
  eq(pure.walletAdjustNeedsPin("add", 501, 500, true), true, "above threshold gated");
  eq(pure.walletAdjustNeedsPin("deduct", 750, 500, true), true, "deduct above gated");
});

Deno.test("walletAdjustNeedsPin: تحت الحد = من غير بوابة", () => {
  eq(pure.walletAdjustNeedsPin("add", 499, 500, true), false, "add below");
  eq(pure.walletAdjustNeedsPin("add", 0, 500, true), false, "add zero");
  eq(pure.walletAdjustNeedsPin("deduct", 100, 500, true), false, "deduct below");
  eq(pure.walletAdjustNeedsPin("add", "600", "500", true), true, "string amounts coerced");
  eq(pure.walletAdjustNeedsPin("add", "abc", 500, true), false, "bad amount not gated");
});
