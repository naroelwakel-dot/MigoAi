/**
 * اختبارات تمرير صحة النظام — `deno test control/health.test.ts`
 * عميل بوت وهمي. الوحدة تمرير قراءة بس: العقد هو 405 قبل البوابة،
 * 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم لنقطة البوت
 * /api/control/system-health، وفشل البوت = 502 bot_unavailable
 * (الواجهة بتعرض «غير متاحة» ومش بتخترع حالة).
 */
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlHealthDeps,
  handleControlHealthRequest,
} from "./health.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

class FakeBotClient {
  calls: { method: string; path: string }[] = [];
  result: BotProxyResult = { status: 200, body: { ok: true } };
  fail = false;
  proxy(method: string, path: string): Promise<BotProxyResult> {
    this.calls.push({ method, path });
    if (this.fail) return Promise.reject(new Error("bot down"));
    return Promise.resolve(this.result);
  }
}

function depsOf(bot: FakeBotClient, admin = true): ControlHealthDeps {
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

Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlHealthRequest(req("/control/home"), d), null, "home");
  eq(await handleControlHealthRequest(req("/control/system-health-x"), d), null, "suffix-x");
  eq(await handleControlHealthRequest(req("/control/health"), d), null, "bare health");
});

Deno.test("405 قبل البوابة و401 قبل أي نداء بوت", async () => {
  const bot = new FakeBotClient();
  const post = await handleControlHealthRequest(
    req("/control/system-health", "POST"), depsOf(bot, false));
  eq(post?.status, 405, "POST = 405 even without admin");

  const denied = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot, false));
  eq(denied?.status, 401, "no admin = 401");
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("التمرير حرفي للحالة والجسم", async () => {
  const bot = new FakeBotClient();
  bot.result = {
    status: 200,
    body: {
      ok: true,
      bot: { ok: true, webhook_target: "vps" },
      loops: { units: {} },
      providers: [],
      guards: null,
    },
  };
  const res = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot));
  eq(res?.status, 200, "status passthrough");
  eq(bot.calls[0], { method: "GET", path: "/api/control/system-health" }, "bot call");
  const body = await res!.json() as Record<string, unknown>;
  eq((body.bot as Record<string, unknown>).webhook_target, "vps", "body verbatim");
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store header");
});

Deno.test("فشل البوت = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const res = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot));
  eq(res?.status, 502, "status");
  const body = await res!.json() as Record<string, unknown>;
  eq(body.error, "bot_unavailable", "error");
  eq(body.bot_unavailable, true, "flag");
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureHealth {
  healthUnitState: (v: unknown) => string;
  healthLoopsDown: (d: unknown) => string[] | null;
  healthWebhookLabel: (d: unknown) => string;
  healthGuardProblems: (d: unknown) => string[] | null;
  healthStripSummary: (
    d: unknown,
  ) => { ok: boolean; text: string };
}

const PB = "/*PURE-HEALTH-BEGIN*/";
const PE = "/*PURE-HEALTH-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure health block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { healthUnitState, healthLoopsDown, healthWebhookLabel, healthGuardProblems, healthStripSummary };",
) as () => PureHealth)();

Deno.test("healthUnitState: أشكال حالة الوحدات", () => {
  eq(pure.healthUnitState("active"), "active", "string active");
  eq(pure.healthUnitState("inactive"), "down", "string inactive");
  eq(pure.healthUnitState(true), "active", "bool true");
  eq(pure.healthUnitState(false), "down", "bool false");
  eq(pure.healthUnitState({ active: true }), "active", "object active");
  eq(pure.healthUnitState({ status: "failed" }), "down", "object failed");
  eq(pure.healthUnitState({}), "unknown", "empty object");
  eq(pure.healthUnitState(null), "unknown", "null");
});

Deno.test("healthLoopsDown: الواقفة بس، وغياب القسم = null", () => {
  eq(pure.healthLoopsDown(null), null, "no data");
  eq(pure.healthLoopsDown({ loops: null }), null, "loops null");
  eq(pure.healthLoopsDown({ loops: { units: {
    a: "active", b: "inactive", c: { active: false }, d: { active: true },
  } } }), ["b", "c"], "down names only");
  eq(pure.healthLoopsDown({ loops: { units: {} } }), [], "no units");
});

Deno.test("healthGuardProblems: أشكال الحراس وغيابهم", () => {
  eq(pure.healthGuardProblems({ guards: null }), null, "guards null");
  eq(pure.healthGuardProblems({ guards: { problems: ["x", "y"] } }),
    ["x", "y"], "flat problems list");
  eq(pure.healthGuardProblems({ guards: {
    failover: { ok: true }, money: { ok: false }, loops: { problems: 2 },
  } }), ["money", "loops (2)"], "per-guard shapes");
  eq(pure.healthGuardProblems({ guards: { failover: { ok: true } } }),
    [], "all fine");
});

Deno.test("healthStripSummary: ملخص الشريط وعدم الاختراع", () => {
  eq(pure.healthStripSummary(null),
    { ok: false, text: "حالة النظام غير متاحة الآن" }, "null data");
  eq(pure.healthStripSummary({ ok: false }).ok, false, "not-ok payload");
  const good = pure.healthStripSummary({
    ok: true,
    bot: { ok: true, webhook_target: "vps" },
    loops: { units: { a: "active" } },
    guards: { failover: { ok: true } },
  });
  eq(good.ok, true, "all good flag");
  eq(good.text, "البوت يعمل · الويب هوك على السيرفر · الحلقات كلها شغالة · الحراس كلهم تمام",
    "all good text");
  const degraded = pure.healthStripSummary({
    ok: true,
    bot: { ok: false, webhook_target: "vercel" },
    loops: { units: { a: "inactive", b: "active" } },
    guards: null,
  });
  eq(degraded.ok, false, "degraded flag");
  eq(degraded.text,
    "البوت مش بيرد · الويب هوك على Vercel الاحتياطي · حلقات واقفة: 1 · الحراس: غير متاح",
    "degraded text names the gaps, never invents");
});
