/**
 * اختبارات تمرير شاشة الحراس — `deno test control/guards.test.ts`
 * عميل بوت وهمي. الوحدة تمرير بس: العقد هو null للمسارات الغريبة،
 * 405 قبل البوابة، 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم
 * لنقطتي البوت /api/control/guards و/api/control/guards-wake،
 * وجسم التفويق (والـ PIN جواه) بيعدّي زي ما هو — البوت صاحب
 * القرار. فشل البوت = 502 bot_unavailable.
 */
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlGuardsDeps,
  handleControlGuardsRequest,
} from "./guards.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

class FakeBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  result: BotProxyResult = { status: 200, body: { ok: true } };
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

function depsOf(bot: FakeBotClient, admin = true): ControlGuardsDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(path: string, method = "GET", body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request(`https://api.example${path}`, init);
}

Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlGuardsRequest(req("/control/home"), d), null, "home");
  eq(
    await handleControlGuardsRequest(req("/control/guards-x"), d),
    null,
    "suffix-x",
  );
  eq(
    await handleControlGuardsRequest(req("/control/system-health"), d),
    null,
    "health stays health's",
  );
});

Deno.test("405 قبل البوابة و401 قبل أي نداء بوت", async () => {
  const bot = new FakeBotClient();
  const postList = await handleControlGuardsRequest(
    req("/control/guards", "POST", {}),
    depsOf(bot, false),
  );
  eq(postList?.status, 405, "POST list = 405 even without admin");
  const getWake = await handleControlGuardsRequest(
    req("/control/guards-wake"),
    depsOf(bot, false),
  );
  eq(getWake?.status, 405, "GET wake = 405 even without admin");

  const denied = await handleControlGuardsRequest(
    req("/control/guards"),
    depsOf(bot, false),
  );
  eq(denied?.status, 401, "no admin = 401");
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("قائمة الحراس: تمرير حرفي للحالة والجسم", async () => {
  const bot = new FakeBotClient();
  bot.result = {
    status: 200,
    body: {
      ok: true,
      guards: [{
        id: "session-guard",
        name: "حارس الجلسات والشحنات",
        status: "ok",
        last_check_at: 1795302834,
        verdict: "سليم",
      }],
      wake: null,
    },
  };
  const res = await handleControlGuardsRequest(
    req("/control/guards"),
    depsOf(bot),
  );
  eq(res?.status, 200, "status passthrough");
  eq(
    bot.calls[0],
    { method: "GET", path: "/api/control/guards" },
    "bot call",
  );
  const body = await res!.json() as Record<string, unknown>;
  const guards = body.guards as Record<string, unknown>[];
  eq(guards[0].name, "حارس الجلسات والشحنات", "body verbatim");
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store header");
});

Deno.test("التفويق: الجسم والـ PIN بيعدّوا زي ما هم", async () => {
  const bot = new FakeBotClient();
  bot.result = {
    status: 200,
    body: { ok: true, requested_at: 1795302900, vps: {} },
  };
  const res = await handleControlGuardsRequest(
    req("/control/guards-wake", "POST", { pin: "1234" }),
    depsOf(bot),
  );
  eq(res?.status, 200, "wake ok");
  eq(bot.calls[0].method, "POST", "wake method");
  eq(bot.calls[0].path, "/api/control/guards-wake", "wake path");
  eq(bot.calls[0].body, { pin: "1234" }, "body verbatim incl pin");
});

Deno.test("التفويق: رفض الـ PIN عند البوت بيعدّي بحالته", async () => {
  const bot = new FakeBotClient();
  bot.result = { status: 403, body: { ok: false, error: "pin_required" } };
  const res = await handleControlGuardsRequest(
    req("/control/guards-wake", "POST", {}),
    depsOf(bot),
  );
  eq(res?.status, 403, "pin gate status passthrough");
  const body = await res!.json() as Record<string, unknown>;
  eq(body.error, "pin_required", "pin gate error passthrough");
});

Deno.test("التفويق: جسم فاسد = 400 من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  const res = await handleControlGuardsRequest(
    req("/control/guards-wake", "POST", "{not json"),
    depsOf(bot),
  );
  eq(res?.status, 400, "bad json = 400");
  eq(bot.calls.length, 0, "no bot call on bad body");
});

Deno.test("فشل البوت = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const res = await handleControlGuardsRequest(
    req("/control/guards"),
    depsOf(bot),
  );
  eq(res?.status, 502, "bot down = 502");
  const body = await res!.json() as Record<string, unknown>;
  eq(body.error, "bot_unavailable", "error code");
});
