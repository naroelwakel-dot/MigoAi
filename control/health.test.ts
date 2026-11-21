/**
 * اختبارات تمرير صحة النظام — `deno test control/health.test.ts`
 * عميل بوت وهمي. الوحدة تمرير قراءة بس: العقد هو 405 قبل البوابة،
 * 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم لنقطة البوت
 * /api/control/system-health، وفشل البوت = 502 bot_unavailable
 * (الواجهة بتعرض «غير متاحة» ومش بتخترع حالة). الإضافة الوحيدة
 * على التمرير: أرصدة موردي المحرك الشغالين بتتلحق من عملية
 * الرصيد بنفس شكل رصيد Pixel، وفشل أي مورد بيعدّي هادي.
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
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  result: BotProxyResult = { status: 200, body: { ok: true } };
  engineResults: Record<string, BotProxyResult> = {};
  engineFail = false;
  fail = false;
  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.fail) return Promise.reject(new Error("bot down"));
    if (path === "/api/control/supplier-engine") {
      if (this.engineFail) return Promise.reject(new Error("engine down"));
      const slug = String(body?.slug ?? "");
      return Promise.resolve(
        this.engineResults[slug] ?? { status: 502, body: { ok: false } },
      );
    }
    return Promise.resolve(this.result);
  }
  engineCalls(): { method: string; path: string; body?: Record<string, unknown> }[] {
    return this.calls.filter((c) => c.path === "/api/control/supplier-engine");
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

Deno.test("أرصدة موردي المحرك بتتلحق بنفس شكل Pixel (قيمة رئيسية)", async () => {
  const bot = new FakeBotClient();
  bot.result = {
    status: 200,
    body: {
      ok: true,
      providers: [
        { key: "bunny-ai", name: "Bunny AI", active: true, dry_run: false },
        { key: "drayik", name: "Drayik", active: true, dry_run: false },
        { key: "wasmou", name: "Wasmou", active: false, dry_run: false },
        { key: "pixel-verification", name: "Pixel Verification", active: true, balance: 2, currency: "$" },
      ],
    },
  };
  // عملية الرصيد بترجع أصغر وحدة: 212 = $2.12.
  bot.engineResults = {
    "bunny-ai": { status: 200, body: { ok: true, result: { balance: 212, currency: "USD" } } },
    "drayik": { status: 200, body: { ok: true, result: { balance: 0, currency: "USD" } } },
  };
  const res = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot));
  eq(res?.status, 200, "status");
  const body = await res!.json() as Record<string, unknown>;
  const provs = body.providers as Record<string, unknown>[];
  eq(provs[0].balance, 2.12, "bunny minor 212 -> major 2.12");
  eq(provs[0].currency, "$", "bunny currency mirrors pixel shape");
  eq(provs[1].balance, 0, "drayik zero balance attached");
  eq(provs[2].balance, undefined, "inactive supplier not asked, no balance");
  eq(provs[3].balance, 2, "pixel balance untouched");
  eq(provs[3].currency, "$", "pixel currency untouched");
  const slugs = bot.engineCalls().map((c) => c.body?.slug).sort();
  eq(slugs, ["bunny-ai", "drayik"], "engine asked for active engine suppliers only");
  eq(bot.engineCalls()[0].body?.op, "balance", "balance op only");
});

Deno.test("فشل رصيد مورد بيعدّي هادي ومش بيوقع رد الصحة", async () => {
  const bot = new FakeBotClient();
  bot.result = {
    status: 200,
    body: {
      ok: true,
      providers: [
        { key: "bunny-ai", name: "Bunny AI", active: true },
        { key: "tunvn", name: "TunVN PreHub", active: true },
      ],
    },
  };
  bot.engineResults = {
    "bunny-ai": { status: 200, body: { ok: true, result: { balance: 212, currency: "USD" } } },
    // tunvn غايب من الخريطة = المحرك رجّع 502 عند الوهمي.
  };
  const res = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot));
  eq(res?.status, 200, "status stays 200");
  const body = await res!.json() as Record<string, unknown>;
  const provs = body.providers as Record<string, unknown>[];
  eq(provs[0].balance, 2.12, "healthy supplier enriched");
  eq(provs[1].balance, undefined, "failed supplier passes without balance");

  const bot2 = new FakeBotClient();
  bot2.result = {
    status: 200,
    body: {
      ok: true,
      providers: [
        { key: "bunny-ai", name: "Bunny AI", active: true },
        { key: "tunvn", name: "TunVN PreHub", active: true },
      ],
    },
  };
  bot2.engineFail = true;
  const res2 = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot2));
  eq(res2?.status, 200, "engine fully down still 200");
  const body2 = await res2!.json() as Record<string, unknown>;
  eq((body2.providers as Record<string, unknown>[])[0].balance, undefined,
    "no invented balance when engine down");
});

Deno.test("حالة البوت غير 200 بتعدّي زي ما هي من غير نداءات محرك", async () => {
  const bot = new FakeBotClient();
  bot.result = { status: 502, body: { ok: false, error: "x" } };
  const res = await handleControlHealthRequest(
    req("/control/system-health"), depsOf(bot));
  eq(res?.status, 502, "status passthrough");
  eq(bot.engineCalls().length, 0, "no engine calls on error status");
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
  // شكل السيرفر الحي: الحالة نص systemd جوه كائن، مش بوليان.
  eq(pure.healthUnitState({ active: "active", journal_age_s: 26734 }),
    "active", "systemd string active");
  eq(pure.healthUnitState({ active: "inactive" }), "down", "systemd string inactive");
  eq(pure.healthUnitState({ active: "failed" }), "down", "systemd string failed");
});

Deno.test("healthLoopsDown: شكل السيرفر الحي كله شغال", () => {
  const live = { loops: { units: {
    "provenance-heartbeat.service": { active: "active", journal_age_s: 26734 },
    "stock-cycle.service": { active: "active", journal_age_s: 20682 },
    "sheerid-sweep.service": { active: "active", journal_age_s: 26823 },
    "migo-site-sheerid-sweep.service": { active: "active", journal_age_s: 33630 },
    "exec-sweep.service": { active: "active", journal_age_s: 33612 },
    "migo-deposit-watcher.service": { active: "active", journal_age_s: 26823 },
  } } };
  eq(pure.healthLoopsDown(live), [], "live units all active, none down");
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
  eq(good.text, "البوت يعمل · وصول العملاء للبوت على سيرفرنا الأساسي · الحلقات كلها شغالة · الحراس كلهم تمام",
    "all good text");
  const degraded = pure.healthStripSummary({
    ok: true,
    bot: { ok: false, webhook_target: "vercel" },
    loops: { units: { a: "inactive", b: "active" } },
    guards: null,
  });
  eq(degraded.ok, false, "degraded flag");
  eq(degraded.text,
    "البوت مش بيرد · وصول العملاء للبوت على الخادم الاحتياطي (Vercel) · حلقات واقفة: 1 · الحراس: غير متاح",
    "degraded text names the gaps, never invents");
});
