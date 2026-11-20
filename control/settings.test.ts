// اختبارات وحدة إعدادات اللوحة (م٥-أ) — `deno test control/settings.test.ts`
// عميل بوت وهمي (نمط events.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. الوحدة دي تمرير خالص: العقد هو 405 قبل البوابة،
// 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم، وفشل البوت 502،
// وجسم settings-set بيعدّي زي ما هو بالحرف.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlSettingsDeps,
  handleControlSettingsRequest,
} from "./settings.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
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

function depsOf(bot: FakeBotClient, admin = true): ControlSettingsDeps {
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
  body?: unknown,
): Request {
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

const ALL_PATHS: [string, string][] = [
  ["/control/bot-settings", "GET"],
  ["/control/bot-settings-set", "POST"],
  ["/control/bot-settings-history", "GET"],
  ["/control/bot-settings-backup", "GET"],
  ["/control/bot-settings-import", "POST"],
];

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlSettingsRequest(req("/control/bot-orders"), d), null, "bot-orders");
  eq(await handleControlSettingsRequest(req("/control/settings"), d), null, "bare settings");
  eq(await handleControlSettingsRequest(req("/control/bot-settings-x"), d), null, "suffix-x");
  eq(await handleControlSettingsRequest(req("/control/bot-settings-set-x"), d), null, "set suffix-x");
  eq(await handleControlSettingsRequest(req("/control/store-events"), d), null, "store-events");
});

Deno.test("بوابة الأدمن على مسارات الإعدادات الخمسة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  for (const [p, m] of ALL_PATHS) {
    const res = await handleControlSettingsRequest(
      req(p, m, m === "POST" ? {} : undefined),
      d,
    );
    eq(res?.status, 401, `${p} status`);
    eq((await bodyOf(res)).error, "unauthorized", `${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const cases: [string, string][] = [
    ["/control/bot-settings", "POST"],
    ["/control/bot-settings-set", "GET"],
    ["/control/bot-settings-history", "POST"],
    ["/control/bot-settings-backup", "DELETE"],
    ["/control/bot-settings-import", "GET"],
  ];
  for (const [p, m] of cases) {
    const res = await handleControlSettingsRequest(req(p, m), d);
    eq(res?.status, 405, `${p} ${m}`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("التمريرات الخمسة حرفية وبنفس الحالة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);

  bot.result = {
    status: 200,
    body: {
      ok: true,
      payments_source: "env",
      settings: [{ key: "payment_methods", value: [] }],
    },
  };
  let res = await handleControlSettingsRequest(
    req("/control/bot-settings?surface=bot"),
    d,
  );
  eq(res?.status, 200, "list status");
  eq(bot.calls[0].method, "GET", "list method");
  eq(bot.calls[0].path, "/api/control/settings?surface=bot", "list path+query");
  eq((await bodyOf(res)).payments_source, "env", "list body verbatim");

  const setBody = {
    key: "payment_methods",
    value: [
      { name: "فودافون كاش", account: "01000000000", instructions: "ابعت على الرقم", enabled: true },
      { name: "انستاباي", account: "instapay@example", instructions: "", enabled: false },
    ],
  };
  bot.result = { status: 200, body: { ok: true, key: "payment_methods" } };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-set", "POST", setBody),
    d,
  );
  eq(res?.status, 200, "set status");
  eq(bot.calls[1].method, "POST", "set method");
  eq(bot.calls[1].path, "/api/control/settings-set", "set path");
  eq(bot.calls[1].body, setBody, "set body verbatim (payment_methods)");

  const boolBody = { key: "announce_enabled", value: false };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-set", "POST", boolBody),
    d,
  );
  eq(bot.calls[2].body, boolBody, "set body verbatim (bool)");

  bot.result = { status: 400, body: { ok: false, error: "bad_key" } };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-set", "POST", { key: "nope", value: 1 }),
    d,
  );
  eq(res?.status, 400, "bot 400 status passthrough");
  eq((await bodyOf(res)).error, "bad_key", "bot 400 error verbatim");

  bot.result = { status: 200, body: { ok: true, history: [{ key: "x" }] } };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-history?limit=20"),
    d,
  );
  eq(res?.status, 200, "history status");
  eq(bot.calls[4].path, "/api/control/settings-history?limit=20", "history path+query");
  eq((await bodyOf(res)).history, [{ key: "x" }], "history body verbatim");

  bot.result = { status: 200, body: { version: 1, settings: { a: 1 } } };
  res = await handleControlSettingsRequest(req("/control/bot-settings-backup"), d);
  eq(res?.status, 200, "backup status");
  eq(bot.calls[5].path, "/api/control/settings-backup", "backup path");
  eq((await bodyOf(res)).settings, { a: 1 }, "backup body verbatim");

  const importBody = { version: 1, settings: { a: 1, b: [1, 2] } };
  bot.result = { status: 200, body: { ok: true, restored: 2, skipped: 1 } };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-import", "POST", importBody),
    d,
  );
  eq(res?.status, 200, "import status");
  eq(bot.calls[6].method, "POST", "import method");
  eq(bot.calls[6].path, "/api/control/settings-import", "import path");
  eq(bot.calls[6].body, importBody, "import body verbatim");
  eq((await bodyOf(res)).restored, 2, "import counters verbatim");
});

Deno.test("جسم POST مش كائن = 400 من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const arrReq = new Request("https://api.example/control/bot-settings-set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([1, 2, 3]),
  });
  const res = await handleControlSettingsRequest(arrReq, d);
  eq(res?.status, 400, "array body status");
  eq((await bodyOf(res)).error, "bad_body", "array body error");
  const badJson = new Request("https://api.example/control/bot-settings-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  const res2 = await handleControlSettingsRequest(badJson, d);
  eq(res2?.status, 400, "bad json status");
  eq(bot.calls.length, 0, "zero bot calls on bad bodies");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlSettingsRequest(
    req("/control/bot-settings"),
    d,
  );
  eq(res?.status, 502, "GET status");
  eq((await bodyOf(res)).error, "bot_unavailable", "GET error");
  const res2 = await handleControlSettingsRequest(
    req("/control/bot-settings-set", "POST", { key: "x", value: 1 }),
    d,
  );
  eq(res2?.status, 502, "POST status");
  eq((await bodyOf(res2)).error, "bot_unavailable", "POST error");
});

Deno.test("ردود الإعدادات ممنوعة من الكاش (no-store)", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlSettingsRequest(
    req("/control/bot-settings"),
    d,
  );
  eq(res?.status, 200, "settings status");
  eq(res?.headers.get("Cache-Control"), "no-store", "settings no-store");
  const backup = await handleControlSettingsRequest(
    req("/control/bot-settings-backup"),
    d,
  );
  eq(backup?.headers.get("Cache-Control"), "no-store", "backup no-store");
});

// ------------------------------------------------- جدولة التغييرات (م٦-هـ)
Deno.test("وكلاء الجدولة التلاتة: بوابة و405 وتمرير حرفي", async () => {
  const bot = new FakeBotClient();
  const denied = depsOf(bot, false);
  const schedPaths: [string, string][] = [
    ["/control/bot-settings-schedule", "POST"],
    ["/control/bot-settings-schedules", "GET"],
    ["/control/bot-settings-schedule-cancel", "POST"],
  ];
  for (const [p, m] of schedPaths) {
    const res = await handleControlSettingsRequest(
      req(p, m, m === "POST" ? {} : undefined),
      denied,
    );
    eq(res?.status, 401, `${p} behind gate`);
  }
  const wrong: [string, string][] = [
    ["/control/bot-settings-schedule", "GET"],
    ["/control/bot-settings-schedules", "POST"],
    ["/control/bot-settings-schedule-cancel", "GET"],
  ];
  for (const [p, m] of wrong) {
    const res = await handleControlSettingsRequest(req(p, m), denied);
    eq(res?.status, 405, `${p} ${m} method-first`);
  }
  eq(bot.calls.length, 0, "zero bot calls behind gate/405");

  const d = depsOf(bot);
  const createBody = {
    key: "sales_enabled",
    value: false,
    run_at: "2026-11-21T10:00:00.000Z",
    pin: "2468",
  };
  bot.result = { status: 200, body: { ok: true, id: 7, status: "pending" } };
  let res = await handleControlSettingsRequest(
    req("/control/bot-settings-schedule", "POST", createBody),
    d,
  );
  eq(res?.status, 200, "schedule status");
  eq(bot.calls[0].method, "POST", "schedule method");
  eq(bot.calls[0].path, "/api/control/settings-schedule", "schedule path");
  eq(bot.calls[0].body, createBody, "schedule body verbatim");

  bot.result = {
    status: 200,
    body: { ok: true, items: [{ id: 7, setting_key: "sales_enabled", status: "pending" }] },
  };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-schedules"),
    d,
  );
  eq(res?.status, 200, "schedules status");
  eq(bot.calls[1].method, "GET", "schedules method");
  eq(bot.calls[1].path, "/api/control/settings-schedules", "schedules path");
  eq((await bodyOf(res)).items, [{ id: 7, setting_key: "sales_enabled", status: "pending" }], "schedules body verbatim");

  bot.result = { status: 400, body: { ok: false, error: "not_pending" } };
  res = await handleControlSettingsRequest(
    req("/control/bot-settings-schedule-cancel", "POST", { id: 7 }),
    d,
  );
  eq(res?.status, 400, "cancel status passthrough");
  eq(bot.calls[2].path, "/api/control/settings-schedule-cancel", "cancel path");
  eq(bot.calls[2].body, { id: 7 }, "cancel body verbatim");
  eq((await bodyOf(res)).error, "not_pending", "cancel error verbatim");
});
