/**
 * اختبارات فلوس لوحة التحكم (المرحلة م١-ب) —
 * `deno test control/` من غير أي استيراد خارجي (offline بالكامل):
 * عميل موقع وعميل بوت وهميان، والمعالج بيتركب عليهم مباشرة.
 *
 * التغطية: بوابة الأدمن قبل أي نداء، تمرير البوت (مسارات + حالات +
 * فشل اتصال = bot_unavailable)، مصفوفة تحقق إعدادات المتجر لكل
 * مفتاح، كتابة لازم تمس صفًا واحدًا بالظبط (صفر/صفان = فشل بصوت
 * عالي من غير تدقيق)، فشل التدقيق بيظهر audit_failed من غير ما
 * يخفي نجاح الكتابة، وتشكيل بحث الأحداث الضايعة لكل مصدر + سقف 50.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import {
  type ControlMoneyClient,
  type ControlMoneyDeps,
  handleControlMoneyRequest,
  type LostEventRow,
  type LostEventsQuery,
  type MoneySettingRow,
  PostgrestControlMoneyClient,
} from "./money.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const ADDR = "0xc4d2b1af9b3e586176a8b586c10ee583f2cd2c06";

const BASE_SETTINGS: MoneySettingRow[] = [
  { key: "usdt_egp_rate", value: "54" },
  { key: "sms_autocredit_cap_egp", value: "500" },
  { key: "sms_trusted_cap_egp", value: "300" },
  { key: "sms_trusted_daily_max", value: "3" },
  { key: "sms_trusted_min_confirmed", value: "2" },
  { key: "intent_expiry_minutes", value: "60" },
  { key: "deposit_address_binance", value: ADDR },
  { key: "deposit_address_bybit", value: ADDR },
  { key: "wallet_app_package", value: "com.vodafone.ana,io.telda.app" },
];

class FakeMoneyClient implements ControlMoneyClient {
  calls: string[] = [];
  settings: MoneySettingRow[] = [...BASE_SETTINGS];
  updateRows = 1;
  updateError: Error | null = null;
  readError: Error | null = null;
  lastUpdate: { key: string; value: string } | null = null;
  lostQueries: LostEventsQuery[] = [];
  depositEvents: LostEventRow[] = [];
  smsEvents: LostEventRow[] = [];
  depositClaims: LostEventRow[] = [];
  topupIntents: LostEventRow[] = [];

  fetchSettings(): Promise<MoneySettingRow[]> {
    this.calls.push("fetchSettings");
    if (this.readError) return Promise.reject(this.readError);
    return Promise.resolve(this.settings);
  }
  getSetting(key: string): Promise<MoneySettingRow | null> {
    this.calls.push("getSetting");
    return Promise.resolve(this.settings.find((s) => s.key === key) ?? null);
  }
  updateSetting(key: string, value: string): Promise<number> {
    this.calls.push("updateSetting");
    this.lastUpdate = { key, value };
    if (this.updateError) return Promise.reject(this.updateError);
    return Promise.resolve(this.updateRows);
  }
  fetchDepositEvents(q: LostEventsQuery): Promise<LostEventRow[]> {
    this.calls.push("fetchDepositEvents");
    this.lostQueries.push(q);
    return Promise.resolve(this.depositEvents);
  }
  fetchSmsEvents(q: LostEventsQuery): Promise<LostEventRow[]> {
    this.calls.push("fetchSmsEvents");
    this.lostQueries.push(q);
    return Promise.resolve(this.smsEvents);
  }
  fetchDepositClaims(q: LostEventsQuery): Promise<LostEventRow[]> {
    this.calls.push("fetchDepositClaims");
    this.lostQueries.push(q);
    return Promise.resolve(this.depositClaims);
  }
  fetchTopupIntents(q: LostEventsQuery): Promise<LostEventRow[]> {
    this.calls.push("fetchTopupIntents");
    this.lostQueries.push(q);
    return Promise.resolve(this.topupIntents);
  }
}

class FakeBotProxy implements BotControlProxyClient {
  calls: string[] = [];
  fail = false;
  result: BotProxyResult = { status: 200, body: { ok: true } };
  lastMethod = "";
  lastPath = "";
  lastBody: Record<string, unknown> | undefined;
  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push("proxy");
    this.lastMethod = method;
    this.lastPath = path;
    this.lastBody = body;
    if (this.fail) return Promise.reject(new Error("bot boom"));
    return Promise.resolve(this.result);
  }
}

function deps(
  client: FakeMoneyClient,
  bot: FakeBotProxy,
): ControlMoneyDeps {
  return {
    client,
    botClient: bot,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(
  path: string,
  opts: { key?: string; method?: string; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = {};
  if (opts.key) headers["x-migo-admin"] = opts.key;
  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`https://api.example${path}`, init);
}

function postSetting(
  body: unknown,
  client = new FakeMoneyClient(),
  bot = new FakeBotProxy(),
) {
  return handleControlMoneyRequest(
    req("/control/store-money-settings", {
      key: ADMIN_KEY,
      method: "POST",
      body,
    }),
    deps(client, bot),
  );
}

const ALL_ROUTES: Array<[string, { method?: string; body?: unknown }]> = [
  ["/control/bot-money-settings", {}],
  ["/control/bot-money-settings", {
    method: "POST",
    body: { key: "stars_topup_enabled", value: true },
  }],
  ["/control/bot-lost-topups?q=x", {}],
  ["/control/bot-topup-match", {
    method: "POST",
    body: { topup_id: "t", event_source: "sms", event_id: "e" },
  }],
  ["/control/store-money-settings", {}],
  ["/control/store-money-settings", {
    method: "POST",
    body: { key: "usdt_egp_rate", value: 55 },
  }],
  ["/control/lost-events?q=x", {}],
];

Deno.test("foreign paths return null", async () => {
  const d = deps(new FakeMoneyClient(), new FakeBotProxy());
  eq(
    await handleControlMoneyRequest(req("/control/home", { key: ADMIN_KEY }), d),
    null,
    "home path is not ours",
  );
  eq(
    await handleControlMoneyRequest(
      req("/control/store-customer?id=x", { key: ADMIN_KEY }),
      d,
    ),
    null,
    "customers path is not ours",
  );
});

Deno.test("admin gate blocks every route before any call", async () => {
  for (const [path, opts] of ALL_ROUTES) {
    const client = new FakeMoneyClient();
    const bot = new FakeBotProxy();
    const res = await handleControlMoneyRequest(
      req(path, { ...opts, key: "wrong-key" }),
      deps(client, bot),
    );
    eq(res?.status, 401, `401 for ${path}`);
    eq(client.calls.length, 0, `store untouched for ${path}`);
    eq(bot.calls.length, 0, `bot untouched for ${path}`);
  }
});

Deno.test("wrong method is 405", async () => {
  const d = deps(new FakeMoneyClient(), new FakeBotProxy());
  const postOnLost = await handleControlMoneyRequest(
    req("/control/lost-events", { key: ADMIN_KEY, method: "POST", body: {} }),
    d,
  );
  eq(postOnLost?.status, 405, "POST on lost-events");
  const getOnMatch = await handleControlMoneyRequest(
    req("/control/bot-topup-match", { key: ADMIN_KEY }),
    d,
  );
  eq(getOnMatch?.status, 405, "GET on topup-match");
  const deleteOnSettings = await handleControlMoneyRequest(
    req("/control/store-money-settings", { key: ADMIN_KEY, method: "DELETE" }),
    d,
  );
  eq(deleteOnSettings?.status, 405, "DELETE on store settings");
});

// ---------------------------------------------------------- تمرير البوت
Deno.test("bot money settings GET proxies to the bot settings path", async () => {
  const bot = new FakeBotProxy();
  bot.result = {
    status: 200,
    body: { ok: true, settings: { stars_topup_enabled: true } },
  };
  const res = await handleControlMoneyRequest(
    req("/control/bot-money-settings", { key: ADMIN_KEY }),
    deps(new FakeMoneyClient(), bot),
  );
  eq(res?.status, 200, "status");
  eq(bot.lastMethod, "GET", "method");
  eq(bot.lastPath, "/api/control/money-settings", "bot path");
  const body = await res!.json();
  eq(body.settings.stars_topup_enabled, true, "bot body verbatim");
});

Deno.test("bot money settings POST passes the body through", async () => {
  const bot = new FakeBotProxy();
  const payload = { key: "stars_rate_minor", value: 75, reason: "تجربة" };
  const res = await handleControlMoneyRequest(
    req("/control/bot-money-settings", {
      key: ADMIN_KEY,
      method: "POST",
      body: payload,
    }),
    deps(new FakeMoneyClient(), bot),
  );
  eq(res?.status, 200, "status");
  eq(bot.lastMethod, "POST", "method");
  eq(bot.lastPath, "/api/control/money-settings", "bot path");
  eq(bot.lastBody, payload, "body verbatim — validation is the bot's job");
});

Deno.test("bot lost topups GET preserves the query string", async () => {
  const bot = new FakeBotProxy();
  bot.result = { status: 200, body: { ok: true, results: [] } };
  const res = await handleControlMoneyRequest(
    req("/control/bot-lost-topups?q=REF-9&amount_egp=250&days=7", {
      key: ADMIN_KEY,
    }),
    deps(new FakeMoneyClient(), bot),
  );
  eq(res?.status, 200, "status");
  eq(
    bot.lastPath,
    "/api/control/lost-topups?q=REF-9&amount_egp=250&days=7",
    "query preserved",
  );
});

Deno.test("bot topup match POST proxies to the bot match path", async () => {
  const bot = new FakeBotProxy();
  bot.result = { status: 200, body: { ok: true, matched: true } };
  const payload = { topup_id: "t-1", event_source: "exchange", event_id: "e-1" };
  const res = await handleControlMoneyRequest(
    req("/control/bot-topup-match", {
      key: ADMIN_KEY,
      method: "POST",
      body: payload,
    }),
    deps(new FakeMoneyClient(), bot),
  );
  eq(res?.status, 200, "status");
  eq(bot.lastPath, "/api/control/topup-match", "bot path");
  eq(bot.lastBody, payload, "body verbatim");
});

Deno.test("bot proxy passes bot errors through with their status", async () => {
  for (const status of [400, 404, 409]) {
    const bot = new FakeBotProxy();
    bot.result = { status, body: { ok: false, error: `bot-${status}` } };
    const res = await handleControlMoneyRequest(
      req("/control/bot-topup-match", {
        key: ADMIN_KEY,
        method: "POST",
        body: { topup_id: "t", event_source: "sms", event_id: "e" },
      }),
      deps(new FakeMoneyClient(), bot),
    );
    eq(res?.status, status, `status ${status} passes through`);
    eq((await res!.json()).error, `bot-${status}`, "bot error verbatim");
  }
});

Deno.test("bot connection failure is an honest bot_unavailable on every bot route", async () => {
  const botRoutes: Array<[string, { method?: string; body?: unknown }]> = [
    ["/control/bot-money-settings", {}],
    ["/control/bot-money-settings", { method: "POST", body: { key: "x" } }],
    ["/control/bot-lost-topups?q=x", {}],
    ["/control/bot-topup-match", { method: "POST", body: { topup_id: "t" } }],
  ];
  for (const [path, opts] of botRoutes) {
    const bot = new FakeBotProxy();
    bot.fail = true;
    const res = await handleControlMoneyRequest(
      req(path, { ...opts, key: ADMIN_KEY }),
      deps(new FakeMoneyClient(), bot),
    );
    eq(res?.status, 502, `502 for ${path}`);
    const body = await res!.json();
    eq(body.error, "bot_unavailable", "error");
    eq(body.bot_unavailable, true, "flag");
  }
});

// ------------------------------------------------------- إعدادات المتجر
Deno.test("store settings GET returns the nine known keys plus raw extras", async () => {
  const client = new FakeMoneyClient();
  client.settings = [
    { key: "usdt_egp_rate", value: "54" },
    { key: "future_key_from_db", value: "raw-value" },
  ];
  const res = await handleControlMoneyRequest(
    req("/control/store-money-settings", { key: ADMIN_KEY }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.settings.length, 10, "9 known + 1 extra");
  const extra = body.settings.find((s: MoneySettingRow) =>
    s.key === "future_key_from_db"
  );
  eq(extra.value, "raw-value", "extra row raw");
  eq(extra.known, false, "extra flagged unknown");
  const missing = body.settings.find((s: MoneySettingRow) =>
    s.key === "intent_expiry_minutes"
  );
  eq(missing.value, null, "missing known key shown empty, not invented");
  eq(missing.known, true, "missing known flagged known");
});

Deno.test("store settings GET failure is an honest 502", async () => {
  const client = new FakeMoneyClient();
  client.readError = new Error("db down");
  const res = await handleControlMoneyRequest(
    req("/control/store-money-settings", { key: ADMIN_KEY }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 502, "status");
  eq((await res!.json()).error, "store_failed", "error");
});

Deno.test("store setting write succeeds, canonicalizes, and audits", async () => {
  const client = new FakeMoneyClient();
  const bot = new FakeBotProxy();
  const res = await postSetting(
    { key: "usdt_egp_rate", value: "54.50", reason: "تعديل تجريبي" },
    client,
    bot,
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.value, "54.5", "canonical value in response");
  eq(body.before_value, "54", "before value reported");
  eq(body.audit_failed, false, "audit ok");
  eq(client.lastUpdate, { key: "usdt_egp_rate", value: "54.5" }, "db write");
  eq(bot.lastPath, "/api/control/audit-log", "audit path");
  eq(bot.lastBody?.action, "store_money_setting_set", "audit action");
  eq(bot.lastBody?.entity_type, "wallet_settings", "audit entity type");
  eq(bot.lastBody?.entity_ref, "usdt_egp_rate", "audit entity ref");
  eq(bot.lastBody?.before, { value: "54" }, "audit before");
  eq(bot.lastBody?.after, { value: "54.5" }, "audit after");
  eq(bot.lastBody?.reason, "تعديل تجريبي", "audit reason");
});

Deno.test("unknown store setting key is 400 before any write", async () => {
  const client = new FakeMoneyClient();
  const bot = new FakeBotProxy();
  for (const key of ["merchant_api_enabled", "usd_rate", "", 42, null]) {
    const res = await postSetting({ key, value: 1 }, client, bot);
    eq(res?.status, 400, `status for key ${JSON.stringify(key)}`);
    eq((await res!.json()).error, "unknown_key", "error");
  }
  ok(!client.calls.includes("updateSetting"), "no write attempted");
  eq(bot.calls.length, 0, "no audit attempted");
});

Deno.test("bad exchange rates are 400 before any write", async () => {
  const bad: unknown[] = [
    0, -5, 1000.01, 1001, 54.123, "54.123", "abc", "", " ", true, false,
    null, "54,5", "0x36",
  ];
  for (const value of bad) {
    const client = new FakeMoneyClient();
    const res = await postSetting(
      { key: "usdt_egp_rate", value },
      client,
      new FakeBotProxy(),
    );
    eq(res?.status, 400, `rate ${JSON.stringify(value)} rejected`);
    eq((await res!.json()).error, "bad_rate", "error");
    ok(!client.calls.includes("updateSetting"), "no write");
  }
  for (const value of [54, "54", 54.5, "0.01", 1000]) {
    const client = new FakeMoneyClient();
    const res = await postSetting(
      { key: "usdt_egp_rate", value },
      client,
      new FakeBotProxy(),
    );
    eq(res?.status, 200, `rate ${JSON.stringify(value)} accepted`);
  }
});

Deno.test("bad sms caps are 400; zero and the ceiling are allowed", async () => {
  for (const key of ["sms_autocredit_cap_egp", "sms_trusted_cap_egp"]) {
    const bad: unknown[] = [-1, 100000.01, 100001, 10.005, "x", "", true, null];
    for (const value of bad) {
      const client = new FakeMoneyClient();
      const res = await postSetting({ key, value }, client, new FakeBotProxy());
      eq(res?.status, 400, `${key} ${JSON.stringify(value)} rejected`);
      eq((await res!.json()).error, "bad_cap", "error");
      ok(!client.calls.includes("updateSetting"), "no write");
    }
    for (const value of [0, "0", 500, 100000]) {
      const res = await postSetting(
        { key, value },
        new FakeMoneyClient(),
        new FakeBotProxy(),
      );
      eq(res?.status, 200, `${key} ${JSON.stringify(value)} accepted`);
    }
  }
});

Deno.test("bad integer settings are 400 with their ranges enforced", async () => {
  const ranges: Array<[string, number, number]> = [
    ["sms_trusted_daily_max", 1, 100],
    ["sms_trusted_min_confirmed", 1, 100],
    ["intent_expiry_minutes", 1, 10080],
  ];
  for (const [key, min, max] of ranges) {
    const bad: unknown[] = [
      min - 1, max + 1, 1.5, "1.5", "x", "", true, null, -3,
    ];
    for (const value of bad) {
      const client = new FakeMoneyClient();
      const res = await postSetting({ key, value }, client, new FakeBotProxy());
      eq(res?.status, 400, `${key} ${JSON.stringify(value)} rejected`);
      eq((await res!.json()).error, "bad_integer", "error");
      ok(!client.calls.includes("updateSetting"), "no write");
    }
    for (const value of [min, max, String(min)]) {
      const res = await postSetting(
        { key, value },
        new FakeMoneyClient(),
        new FakeBotProxy(),
      );
      eq(res?.status, 200, `${key} ${JSON.stringify(value)} accepted`);
    }
  }
});

Deno.test("bad deposit addresses are 400 before any write", async () => {
  const bad: unknown[] = [
    "0x123",
    "c4d2b1af9b3e586176a8b586c10ee583f2cd2c06", // missing 0x
    "0xZZd2b1af9b3e586176a8b586c10ee583f2cd2c06", // non-hex
    `${ADDR}ff`, // too long
    ADDR.slice(0, -2), // too short
    "",
    42,
    null,
  ];
  for (const key of ["deposit_address_binance", "deposit_address_bybit"]) {
    for (const value of bad) {
      const client = new FakeMoneyClient();
      const res = await postSetting({ key, value }, client, new FakeBotProxy());
      eq(res?.status, 400, `${key} ${JSON.stringify(value)} rejected`);
      eq((await res!.json()).error, "bad_address", "error");
      ok(!client.calls.includes("updateSetting"), "no write");
    }
    const res = await postSetting(
      { key, value: "0xC4D2B1AF9B3E586176A8B586C10EE583F2CD2C06" },
      new FakeMoneyClient(),
      new FakeBotProxy(),
    );
    eq(res?.status, 200, `${key} uppercase hex accepted`);
  }
});

Deno.test("bad package lists are 400 before any write", async () => {
  const bad: unknown[] = [
    "",
    "com", // no dot
    "com..example", // empty segment
    "com.example, bad-name", // illegal character
    "com.example,", // trailing empty item
    ",com.example", // leading empty item
    "com.example,com.example", // duplicate
    Array.from({ length: 11 }, (_, i) => `com.example${i}.app`).join(","),
    42,
    null,
    ["com.example.app"],
  ];
  for (const value of bad) {
    const client = new FakeMoneyClient();
    const res = await postSetting(
      { key: "wallet_app_package", value },
      client,
      new FakeBotProxy(),
    );
    eq(res?.status, 400, `packages ${JSON.stringify(value)} rejected`);
    eq((await res!.json()).error, "bad_package_list", "error");
    ok(!client.calls.includes("updateSetting"), "no write");
  }
  const client = new FakeMoneyClient();
  const res = await postSetting(
    {
      key: "wallet_app_package",
      value: "com.vodafone.ana, io.telda.app ,com.egyptianbanks.instapay",
    },
    client,
    new FakeBotProxy(),
  );
  eq(res?.status, 200, "valid list accepted");
  eq(
    client.lastUpdate?.value,
    "com.vodafone.ana,io.telda.app,com.egyptianbanks.instapay",
    "canonical comma-joined value written",
  );
});

Deno.test("an over-long reason is 400 before any write", async () => {
  const client = new FakeMoneyClient();
  const res = await postSetting(
    { key: "usdt_egp_rate", value: 55, reason: "x".repeat(501) },
    client,
    new FakeBotProxy(),
  );
  eq(res?.status, 400, "status");
  eq((await res!.json()).error, "bad_reason", "error");
  ok(!client.calls.includes("updateSetting"), "no write");
});

Deno.test("a write touching zero rows fails loud and skips the audit", async () => {
  const client = new FakeMoneyClient();
  client.updateRows = 0;
  const bot = new FakeBotProxy();
  const res = await postSetting(
    { key: "usdt_egp_rate", value: 55 },
    client,
    bot,
  );
  eq(res?.status, 500, "status");
  const body = await res!.json();
  eq(body.error, "setting_write_failed", "error");
  eq(body.rows_affected, 0, "row count surfaced");
  eq(bot.calls.length, 0, "no audit for a failed write");
});

Deno.test("a write touching two rows fails loud and skips the audit", async () => {
  const client = new FakeMoneyClient();
  client.updateRows = 2;
  const bot = new FakeBotProxy();
  const res = await postSetting(
    { key: "usdt_egp_rate", value: 55 },
    client,
    bot,
  );
  eq(res?.status, 500, "status");
  const body = await res!.json();
  eq(body.error, "setting_write_failed", "error");
  eq(body.rows_affected, 2, "row count surfaced");
  eq(bot.calls.length, 0, "no audit for an ambiguous write");
});

Deno.test("a store write exception is an honest 502", async () => {
  const client = new FakeMoneyClient();
  client.updateError = new Error("db down");
  const res = await postSetting(
    { key: "usdt_egp_rate", value: 55 },
    client,
    new FakeBotProxy(),
  );
  eq(res?.status, 502, "status");
  eq((await res!.json()).error, "store_failed", "error");
});

Deno.test("audit failure surfaces audit_failed without hiding the write", async () => {
  // اتصال البوت واقع أصلًا
  const client1 = new FakeMoneyClient();
  const bot1 = new FakeBotProxy();
  bot1.fail = true;
  const res1 = await postSetting(
    { key: "usdt_egp_rate", value: 55 },
    client1,
    bot1,
  );
  eq(res1?.status, 200, "write still reported");
  const body1 = await res1!.json();
  eq(body1.ok, true, "ok");
  eq(body1.audit_failed, true, "audit_failed surfaced (connection)");
  eq(client1.lastUpdate?.value, "55", "the write itself happened");

  // البوت رد بخطأ HTTP
  const bot2 = new FakeBotProxy();
  bot2.result = { status: 500, body: { ok: false, error: "audit boom" } };
  const res2 = await postSetting(
    { key: "usdt_egp_rate", value: 55 },
    new FakeMoneyClient(),
    bot2,
  );
  eq((await res2!.json()).audit_failed, true, "audit_failed surfaced (500)");

  // البوت رد 200 بس بجسم فشل
  const bot3 = new FakeBotProxy();
  bot3.result = { status: 200, body: { ok: false } };
  const res3 = await postSetting(
    { key: "usdt_egp_rate", value: 55 },
    new FakeMoneyClient(),
    bot3,
  );
  eq((await res3!.json()).audit_failed, true, "audit_failed surfaced (ok:false)");
});

// -------------------------------------------------------- الأحداث الضايعة
function seedLost(client: FakeMoneyClient) {
  client.depositEvents = [{
    id: "d1",
    rail: "binance",
    exchange_ref: "REF-1",
    tx_hash: null,
    asset: "USDT",
    amount_usdt: 12.5,
    outcome: "no_matching_intent",
    matched_intent_id: null,
    claim_id: null,
    matched_bot_topup_id: null,
    created_at: "2026-11-20T01:00:00.000Z",
  }];
  client.smsEvents = [{
    id: "s1",
    source: "sms",
    sender_id: "VodafoneCash",
    sender_account: "01001500001",
    transfer_ref: "T-1",
    amount_egp: 200,
    match_state: "unmatched",
    matched_topup_id: null,
    matched_order_id: null,
    matched_bot_topup_id: null,
    received_at: "2026-11-20T01:05:00.000Z",
    ingested_at: "2026-11-20T01:05:10.000Z",
  }];
  client.depositClaims = [{
    id: "c1",
    customer_id: "11111111-1111-4111-8111-111111111111",
    rail: "bybit",
    exchange_ref: "REF-1",
    status: "pending",
    amount_usdt: null,
    amount_egp: null,
    created_at: "2026-11-20T01:10:00.000Z",
  }];
  client.topupIntents = [{
    id: "i1",
    customer_id: "11111111-1111-4111-8111-111111111111",
    rail: "binance",
    amount_egp: 300,
    amount_usdt: 5.555,
    unique_amount: 5.556,
    status: "open",
    created_at: "2026-11-20T01:15:00.000Z",
  }];
}

Deno.test("lost events are shaped per source with a shared query", async () => {
  const client = new FakeMoneyClient();
  seedLost(client);
  const before = Date.now();
  const res = await handleControlMoneyRequest(
    req("/control/lost-events?q=REF&amount=200&days=7", { key: ADMIN_KEY }),
    deps(client, new FakeBotProxy()),
  );
  const after = Date.now();
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.q, "REF", "q echoed");
  eq(body.amount, 200, "amount echoed");
  eq(body.days, 7, "days echoed");

  eq(client.lostQueries.length, 4, "all four sources queried");
  for (const q of client.lostQueries) {
    eq(q.q, "REF", "q passed");
    eq(q.amount, 200, "amount passed");
    eq(q.days, 7, "days passed");
    const sinceMs = new Date(q.since).getTime();
    ok(
      sinceMs >= before - 7 * 86400000 - 1000 &&
        sinceMs <= after - 7 * 86400000 + 1000,
      "since is seven days back",
    );
  }

  const dep = body.deposit_events[0];
  eq(dep.source, "deposit_events", "deposit source tag");
  eq(dep.amount, 12.5, "deposit amount normalized to USDT amount");
  eq(dep.currency, "USDT", "deposit currency");
  eq(dep.status, "no_matching_intent", "deposit status from outcome");
  eq(dep.matched, false, "deposit unmatched");

  const sms = body.sms_events[0];
  eq(sms.source, "sms_events", "sms source tag");
  eq(sms.channel, "sms", "sms channel preserved");
  eq(sms.amount, 200, "sms amount");
  eq(sms.currency, "EGP", "sms currency");
  eq(sms.status, "unmatched", "sms status from match_state");
  eq(sms.time, "2026-11-20T01:05:00.000Z", "sms time from received_at");

  const claim = body.deposit_claims[0];
  eq(claim.source, "deposit_claims", "claim source tag");
  eq(claim.amount, null, "claim without amounts stays null — never invented");
  eq(claim.currency, null, "claim currency null");
  eq(claim.matched, false, "pending claim unmatched");

  const intent = body.topup_intents[0];
  eq(intent.source, "topup_intents", "intent source tag");
  eq(intent.amount, 300, "intent amount in EGP");
  eq(intent.currency, "EGP", "intent currency");
  eq(intent.status, "open", "intent status");
  eq(intent.matched, false, "open intent unmatched");
});

Deno.test("lost events default to 30 days and cap each source at 50", async () => {
  const client = new FakeMoneyClient();
  client.depositEvents = Array.from({ length: 55 }, (_, i) => ({
    id: `d${i}`,
    amount_usdt: 1,
    asset: "USDT",
    outcome: "received",
    created_at: "2026-11-20T00:00:00.000Z",
  }));
  const res = await handleControlMoneyRequest(
    req("/control/lost-events", { key: ADMIN_KEY }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.days, 30, "default days");
  eq(body.amount, null, "default amount");
  eq(body.q, "", "default q");
  eq(body.deposit_events.length, 50, "source capped at 50");
});

Deno.test("lost events reject a bad query before any read", async () => {
  const badPaths = [
    "/control/lost-events?days=0",
    "/control/lost-events?days=366",
    "/control/lost-events?days=abc",
    "/control/lost-events?days=1.5",
    "/control/lost-events?amount=0",
    "/control/lost-events?amount=-5",
    "/control/lost-events?amount=abc",
    "/control/lost-events?amount=0.0000001",
  ];
  for (const path of badPaths) {
    const client = new FakeMoneyClient();
    const res = await handleControlMoneyRequest(
      req(path, { key: ADMIN_KEY }),
      deps(client, new FakeBotProxy()),
    );
    eq(res?.status, 400, `${path} rejected`);
    eq((await res!.json()).error, "bad_query", "error");
    eq(client.calls.length, 0, "no source read");
  }
});

Deno.test("lost events q cannot break out of the PostgREST or filter", async () => {
  const client = new PostgrestControlMoneyClient({
    baseUrl: "https://example.supabase.co",
    keyOf: () => "test-key",
  });
  const originalFetch = globalThis.fetch;
  let captured = "";
  globalThis.fetch = ((input: unknown) => {
    captured = String(input);
    return Promise.resolve(new Response("[]", { status: 200 }));
  }) as typeof fetch;
  try {
    await client.fetchDepositEvents({
      q: 'x),amount_usdt=gt.0,("y*',
      amount: null,
      days: 30,
      since: "2026-10-21T00:00:00.000Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const orStart = captured.indexOf("or=(");
  ok(orStart >= 0, "or filter present");
  const orSegment = captured.slice(orStart, captured.indexOf("&", orStart));
  // الأقواس الوحيدة في المقطع هي البنيوية: فتح واحد وإغلاق واحد.
  eq(orSegment.split("(").length - 1, 1, "one opening paren");
  eq(orSegment.split(")").length - 1, 1, "one closing paren");
  ok(!orSegment.includes("*"), "no raw star from q");
  // النمط بعد فك الترميز (زي ما PostgREST بيشوفه) من غير أي حرف بنيوي:
  const rawPattern = orSegment.match(/ilike\.([^,]*)/)?.[1] ?? "";
  const decoded = decodeURIComponent(rawPattern);
  ok(!/[(),"*]/.test(decoded), "decoded pattern has no structural chars");
});

// =====================================================================
// إصلاحات مراجعة الموقع W7 (فلوس اللوحة)
// =====================================================================

Deno.test("W7#5: lost events disclose per-source truncation instead of silently capping", async () => {
  const client = new FakeMoneyClient();
  client.depositEvents = Array.from({ length: 51 }, (_, i) => ({
    id: `d${i}`,
    amount_usdt: 1,
    asset: "USDT",
    outcome: "received",
    created_at: "2026-11-20T00:00:00.000Z",
  }));
  client.topupIntents = Array.from({ length: 50 }, (_, i) => ({
    id: `t${i}`,
    amount_egp: 10,
    status: "open",
    created_at: "2026-11-20T00:00:00.000Z",
  }));
  const res = await handleControlMoneyRequest(
    req("/control/lost-events", { key: ADMIN_KEY }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.deposit_events.length, 50, "display still capped at 50");
  eq(body.truncated.deposit_events, true, "51st row disclosed as truncation");
  eq(body.truncated.topup_intents, false, "exactly 50 is not truncation");
  eq(body.truncated.sms_events, false, "empty source not truncated");
  eq(body.truncated.deposit_claims, false, "empty claims not truncated");
});

// عميل PostgREST الحقيقي على نقل مثبّت: بيصوّر الطلبات بس.
function pgMoneyClient(capture: { url: string; method: string; prefer: string }[]) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    capture.push({
      url: String(input),
      method: init?.method ?? "GET",
      prefer: new Headers(init?.headers).get("Prefer") ?? "",
    });
    return Promise.resolve(new Response(JSON.stringify([{ key: "k", value: "1" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }) as typeof fetch;
  const client = new PostgrestControlMoneyClient({
    baseUrl: "https://db.invalid",
    keyOf: () => "k",
  });
  return { client, restore: () => { globalThis.fetch = originalFetch; } };
}

Deno.test("W7#4: updateSetting upserts — a missing settings row is created, not a 500", async () => {
  const capture: { url: string; method: string; prefer: string }[] = [];
  const { client, restore } = pgMoneyClient(capture);
  try {
    const rows = await client.updateSetting("intent_expiry_minutes", "60");
    eq(rows, 1, "one row written by the upsert");
    eq(capture.length, 1, "one request");
    eq(capture[0].method, "POST", "upsert is a POST, not a conditional PATCH");
    ok(
      capture[0].prefer.includes("resolution=merge-duplicates"),
      "merge-duplicates preference set",
    );
    ok(!capture[0].url.includes("key=eq."), "no existence filter on the write");
  } finally {
    restore();
  }
});

Deno.test("W7#5/#6: lost-event fetchers filter amounts on every stored column and page at 51", async () => {
  const capture: { url: string; method: string; prefer: string }[] = [];
  const { client, restore } = pgMoneyClient(capture);
  const query: LostEventsQuery = {
    q: "",
    amount: 200,
    days: 30,
    since: "2026-10-24T00:00:00.000Z",
  };
  try {
    await client.fetchDepositClaims(query);
    await client.fetchTopupIntents(query);
    await client.fetchDepositEvents(query);
    await client.fetchSmsEvents(query);
  } finally {
    restore();
  }
  const [claims, intents, events, sms] = capture.map((c) => c.url);
  ok(
    claims.includes("or=(amount_egp.eq.200,amount_usdt.eq.200)"),
    "claims filter matches EGP and USDT amount columns",
  );
  ok(
    intents.includes("or=(amount_egp.eq.200,unique_amount.eq.200)"),
    "intents filter matches nominal and unique amounts",
  );
  for (const [label, url] of [
    ["claims", claims],
    ["intents", intents],
    ["events", events],
    ["sms", sms],
  ] as const) {
    ok(url.includes("limit=51"), `${label} fetcher pages at 51 (truncation probe)`);
  }
});
