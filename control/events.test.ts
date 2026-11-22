// اختبارات وحدة أحداث اللوحة (م٤) — `deno test control/events.test.ts`
// عميل بوت وهمي (نمط catalog.test.ts) + عميل قاعدة موقع وهمي فوق
// صفوف في الذاكرة بنفس معاني الفلاتر الحقيقية — مفيش أي نداء
// شبكة ولا قاعدة حقيقية. الأرقام والمراجع كلها وهمية عمدًا.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlEventsClient,
  type ControlEventsDeps,
  type DepositEventRow,
  handleControlEventsRequest,
  type IngestSmsArgs,
  type SmsEventRow,
  type StoreEventsFilter,
} from "./events.ts";

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
    if (path === "/api/control/audit-log") {
      return Promise.resolve({ status: 200, body: { ok: true, id: "audit-1" } });
    }
    return Promise.resolve(this.result);
  }
}

// ------------------------------------------------------- عميل موقع وهمي
const SMS_1 = "11111111-1111-1111-1111-111111111111";
const SMS_2 = "22222222-2222-2222-2222-222222222222";
const SMS_3 = "33333333-3333-3333-3333-333333333333";
const SMS_4 = "44444444-4444-4444-4444-444444444444";
const SMS_5 = "55555555-5555-5555-5555-555555555555";
const DEP_1 = "66666666-6666-6666-6666-666666666666";
const CLAIM_1 = "77777777-7777-7777-7777-777777777777";
const DEP_2 = "88888888-8888-8888-8888-888888888888";
const DEP_3 = "99999999-9999-9999-9999-999999999999";
const DEP_4 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const INTENT_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function smsRow(p: Partial<SmsEventRow>): SmsEventRow {
  return {
    id: "x",
    received_at: "2026-11-20T00:00:00Z",
    ingested_at: "2026-11-20T00:00:00Z",
    sender_id: "01000000000",
    body: "نص",
    amount_egp: null,
    sender_account: null,
    transfer_ref: null,
    match_state: "unmatched",
    matched_topup_id: null,
    matched_order_id: null,
    matched_bot_topup_id: null,
    dedupe_key: "k",
    source: "sms",
    package_name: null,
    corroborated_by: null,
    autocredit_basis: null,
    ...p,
  };
}

function depRow(p: Partial<DepositEventRow>): DepositEventRow {
  return {
    id: "x",
    rail: "binance",
    exchange_ref: "REF",
    asset: "USDT",
    amount_usdt: 1,
    tx_hash: null,
    matched_intent_id: null,
    outcome: "no_matching_intent",
    claim_id: null,
    matched_bot_topup_id: null,
    created_at: "2026-11-20T00:00:00Z",
    ...p,
  };
}

class FakeEventsClient implements ControlEventsClient {
  smsRows: SmsEventRow[] = [];
  depRows: DepositEventRow[] = [];
  settings = new Map<string, string>();
  stateWrites: { id: string; from: string; to: string }[] = [];
  stateRowsOverride: number | null = null;
  settleCalls: { id: string; from: string | null }[] = [];
  settleRowsOverride: number | null = null;
  resolveCalls: Record<string, unknown>[] = [];
  autoCreditCalls: Record<string, unknown>[] = [];
  ingestCalls: IngestSmsArgs[] = [];
  rematchCalls = 0;
  orderRematchCalls = 0;

  private smsFiltered(f: StoreEventsFilter): SmsEventRow[] {
    if (f.source === "binance" || f.source === "bybit") return [];
    return this.smsRows.filter((r) => {
      if (f.source && r.source !== f.source) return false;
      if (
        f.status === "pending" &&
        (r.match_state === "matched" || r.match_state === "credited" ||
          r.match_state === "ignored")
      ) return false;
      if (
        f.status === "done" &&
        r.match_state !== "matched" && r.match_state !== "credited"
      ) return false;
      if (f.status === "ignored" && r.match_state !== "ignored") return false;
      if (
        f.q && !`${r.transfer_ref || ""} ${r.sender_account || ""} ${r.body}`
          .includes(f.q)
      ) return false;
      return true;
    });
  }

  private depFiltered(f: StoreEventsFilter): DepositEventRow[] {
    if (f.source === "sms" || f.source === "app_notification") return [];
    if (f.status === "ignored") return [];
    return this.depRows.filter((r) => {
      if (f.source && r.rail !== f.source) return false;
      const done = r.outcome === "credited" ||
        r.outcome === "manually_settled" || !!r.matched_intent_id ||
        !!r.claim_id || !!r.matched_bot_topup_id;
      if (f.status === "pending" && done) return false;
      if (f.status === "done" && !done) return false;
      if (f.q && !`${r.exchange_ref} ${r.tx_hash || ""}`.includes(f.q)) {
        return false;
      }
      return true;
    });
  }

  fetchSmsEvents(f: StoreEventsFilter, limit: number) {
    return Promise.resolve(
      [...this.smsFiltered(f)].sort((a, b) =>
        String(b.ingested_at).localeCompare(String(a.ingested_at))
      ).slice(0, limit),
    );
  }
  fetchDepositEvents(f: StoreEventsFilter, limit: number) {
    return Promise.resolve(
      [...this.depFiltered(f)].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at))
      ).slice(0, limit),
    );
  }
  countSmsEvents(f: StoreEventsFilter) {
    return Promise.resolve(this.smsFiltered(f).length);
  }
  countDepositEvents(f: StoreEventsFilter) {
    return Promise.resolve(this.depFiltered(f).length);
  }
  fetchOpenClaims() {
    return Promise.resolve([{ id: CLAIM_1, exchange_ref: "DEP1" }]);
  }
  fetchOpenIntents() {
    return Promise.resolve([
      { id: INTENT_1, amount_egp: 1000, unique_amount: 300 },
    ]);
  }
  fetchLastSmsIngestedAt() {
    return Promise.resolve("2026-11-20T08:00:00Z");
  }
  fetchLastDepositAt(rail: string) {
    return Promise.resolve(
      rail === "binance" ? "2026-11-20T05:00:00Z" : "2026-11-18T05:00:00Z",
    );
  }
  getSmsEvent(id: string) {
    return Promise.resolve(this.smsRows.find((r) => r.id === id) ?? null);
  }
  getDepositEvent(id: string) {
    return Promise.resolve(this.depRows.find((r) => r.id === id) ?? null);
  }
  updateSmsEventState(id: string, from: string, to: string) {
    if (this.stateRowsOverride !== null) {
      return Promise.resolve(this.stateRowsOverride);
    }
    const row = this.smsRows.find((r) => r.id === id);
    if (!row || row.match_state !== from) return Promise.resolve(0);
    row.match_state = to;
    this.stateWrites.push({ id, from, to });
    return Promise.resolve(1);
  }
  settleDepositEvent(id: string, from: string | null) {
    if (this.settleRowsOverride !== null) {
      return Promise.resolve(this.settleRowsOverride);
    }
    const row = this.depRows.find((r) => r.id === id);
    if (!row) return Promise.resolve(0);
    // نفس حراس الكتابة الحقيقية: النتيجة الحالية + كل الروابط فاضية.
    if ((row.outcome ?? null) !== from) return Promise.resolve(0);
    if (row.matched_intent_id || row.claim_id || row.matched_bot_topup_id) {
      return Promise.resolve(0);
    }
    row.outcome = "manually_settled";
    this.settleCalls.push({ id, from });
    return Promise.resolve(1);
  }
  getSetting(key: string) {
    const v = this.settings.get(key);
    return Promise.resolve(
      v === undefined ? null : { key, value: v },
    );
  }
  upsertSetting(key: string, value: string) {
    this.settings.set(key, value);
    return Promise.resolve(1);
  }
  callResolveClaim(args: Record<string, unknown>) {
    this.resolveCalls.push(args);
    return Promise.resolve({ ok: true, status: "credited" });
  }
  callAutoCreditDeposit(args: Record<string, unknown>) {
    this.autoCreditCalls.push(args);
    return Promise.resolve({ ok: true, status: "no_matching_intent" });
  }
  callSmsRematch() {
    this.rematchCalls++;
    return Promise.resolve({ ok: true, matched: 0 });
  }
  callOrderRematch() {
    this.orderRematchCalls++;
    return Promise.resolve({ ok: true, matched: 0 });
  }
  callIngestSms(args: IngestSmsArgs) {
    this.ingestCalls.push(args);
    return Promise.resolve({ ok: true, deduped: false });
  }
}

function seedClient(): FakeEventsClient {
  const c = new FakeEventsClient();
  c.smsRows = [
    smsRow({
      id: SMS_1,
      source: "sms",
      sender_id: "VodafoneCash-01012345678",
      body: "تم استلام مبلغ 500 جنيه بنجاح",
      amount_egp: 500,
      transfer_ref: "REF1",
      dedupe_key: "ref:abc1",
      corroborated_by: SMS_2,
      ingested_at: "2026-11-20T08:00:00Z",
    }),
    smsRow({
      id: SMS_2,
      source: "app_notification",
      sender_id: "com.vodafone.vodafone_cash",
      body: "إشعار تحويل وارد",
      amount_egp: 250,
      autocredit_basis: "dual_channel",
      ingested_at: "2026-11-20T07:00:00Z",
    }),
    smsRow({
      id: SMS_5,
      source: "sms",
      sender_id: "01077776666",
      body: "تحويل وارد 300",
      amount_egp: 300,
      ingested_at: "2026-11-20T06:00:00Z",
    }),
    smsRow({
      id: SMS_3,
      source: "sms",
      sender_id: "01099998888",
      body: "تحويل قديم",
      amount_egp: 100,
      match_state: "matched",
      matched_topup_id: "topup-x",
      ingested_at: "2026-11-19T10:00:00Z",
    }),
    smsRow({
      id: SMS_4,
      source: "sms",
      sender_id: "VF-Promo",
      body: "عرض ترويجي",
      match_state: "ignored",
      ingested_at: "2026-11-19T09:00:00Z",
    }),
  ];
  c.depRows = [
    depRow({
      id: DEP_1,
      rail: "binance",
      exchange_ref: "DEP1",
      amount_usdt: 10,
      created_at: "2026-11-20T05:00:00Z",
    }),
    depRow({
      id: DEP_3,
      rail: "binance",
      exchange_ref: "DEP3",
      amount_usdt: 20,
      outcome: "credited",
      matched_bot_topup_id: "bt1",
      created_at: "2026-11-20T03:00:00Z",
    }),
    depRow({
      id: DEP_2,
      rail: "bybit",
      exchange_ref: "DEP2",
      amount_usdt: 5,
      created_at: "2026-11-18T05:00:00Z",
    }),
  ];
  return c;
}

function depsOf(
  bot: FakeBotClient,
  client: FakeEventsClient,
  admin = true,
): ControlEventsDeps {
  return {
    client,
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

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient(), seedClient());
  eq(await handleControlEventsRequest(req("/control/bot-orders"), d), null, "bot-orders");
  eq(await handleControlEventsRequest(req("/control/store-prices"), d), null, "store-prices");
  eq(await handleControlEventsRequest(req("/control/bot-events"), d), null, "bare events");
  eq(await handleControlEventsRequest(req("/control/store-events-x"), d), null, "suffix-x");
});

Deno.test("بوابة الأدمن على كل مسارات م٤", async () => {
  const bot = new FakeBotClient();
  const client = seedClient();
  const d = depsOf(bot, client, false);
  const paths: [string, string][] = [
    ["/control/bot-events-topups", "GET"],
    ["/control/bot-events-link", "POST"],
    ["/control/bot-events-components", "GET"],
    ["/control/bot-events-rail-toggle", "POST"],
    ["/control/bot-events-match-report", "GET"],
    ["/control/store-events", "GET"],
    ["/control/store-event-action", "POST"],
    ["/control/store-event-paste", "POST"],
    ["/control/store-event-exclusions", "GET"],
  ];
  for (const [p, m] of paths) {
    const res = await handleControlEventsRequest(
      req(p, m, m === "POST" ? {} : undefined),
      d,
    );
    eq(res?.status, 401, `${p} status`);
    eq((await bodyOf(res)).error, "unauthorized", `${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
  eq(client.ingestCalls.length, 0, "zero ingest behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, seedClient(), false);
  const cases: [string, string][] = [
    ["/control/bot-events-link", "GET"],
    ["/control/bot-events-topups", "POST"],
    ["/control/store-events", "POST"],
    ["/control/store-event-action", "GET"],
    ["/control/store-event-exclusions", "DELETE"],
  ];
  for (const [p, m] of cases) {
    const res = await handleControlEventsRequest(req(p, m), d);
    eq(res?.status, 405, `${p} ${m}`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("تمريرات البوت الخمسة حرفية وبنفس الحالة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, seedClient());

  bot.result = { status: 200, body: { ok: true, topups: [1, 2] } };
  let res = await handleControlEventsRequest(
    req("/control/bot-events-topups?status=pending&limit=5"),
    d,
  );
  eq(res?.status, 200, "topups status");
  eq(bot.calls[0].method, "GET", "topups method");
  eq(
    bot.calls[0].path,
    "/api/control/events-topups?status=pending&limit=5",
    "topups path+query",
  );
  eq((await bodyOf(res)).topups, [1, 2], "topups body verbatim");

  bot.result = { status: 409, body: { ok: false, error: "already_linked" } };
  res = await handleControlEventsRequest(
    req("/control/bot-events-link", "POST", {
      request_id: "t1",
      source: "sms",
      event_id: SMS_1,
    }),
    d,
  );
  eq(res?.status, 409, "link status passthrough");
  eq(bot.calls[1].path, "/api/control/events-link", "link path");
  eq(bot.calls[1].body, {
    request_id: "t1",
    source: "sms",
    event_id: SMS_1,
  }, "link body verbatim");
  eq((await bodyOf(res)).error, "already_linked", "link error verbatim");

  bot.result = { status: 200, body: { ok: true, components: [] } };
  res = await handleControlEventsRequest(req("/control/bot-events-components"), d);
  eq(res?.status, 200, "components status");
  eq(bot.calls[2].path, "/api/control/events-components", "components path");

  bot.result = { status: 200, body: { ok: true, rail: "sms_auto", enabled: false } };
  res = await handleControlEventsRequest(
    req("/control/bot-events-rail-toggle", "POST", { rail: "sms_auto", enabled: false }),
    d,
  );
  eq(bot.calls[3].path, "/api/control/events-rail-toggle", "toggle path");
  eq(bot.calls[3].body, { rail: "sms_auto", enabled: false }, "toggle body");

  bot.result = { status: 200, body: { ok: true, report: {} } };
  res = await handleControlEventsRequest(req("/control/bot-events-match-report"), d);
  eq(bot.calls[4].path, "/api/control/events-match-report", "report path");
  eq(res?.status, 200, "report status");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const res = await handleControlEventsRequest(
    req("/control/bot-events-components"),
    depsOf(bot, seedClient()),
  );
  eq(res?.status, 502, "status");
  eq((await bodyOf(res)).error, "bot_unavailable", "error");
});

// ------------------------------------------------------- صندوق الموقع
Deno.test("store-events: تطبيع ودمج وترتيب وعدّادات", async () => {
  const res = await handleControlEventsRequest(
    req("/control/store-events"),
    depsOf(new FakeBotClient(), seedClient()),
  );
  eq(res?.status, 200, "status");
  const b = await bodyOf(res);
  const items = b.items as Record<string, unknown>[];
  eq(items.length, 8, "merged count");
  eq(
    items.map((i) => i.id),
    [SMS_1, SMS_2, SMS_5, DEP_1, DEP_3, SMS_3, SMS_4, DEP_2],
    "time-desc merge order",
  );
  eq(b.total, 8, "total");
  eq(b.counts, {
    by_source: { sms: 4, app_notification: 1, binance: 2, bybit: 1 },
    by_status: { pending: 5, done: 2, ignored: 1 },
  }, "counters");
  eq(b.sms_last_ingested_at, "2026-11-20T08:00:00Z", "last sms");
  const first = items[0];
  eq(first.source, "sms", "sms1 source");
  eq(first.status, "pending", "sms1 status");
  eq(first.confidence, "high", "sms1 confidence (corroborated)");
  eq(first.amount_egp, 500, "sms1 amount");
  eq(first.ref, "REF1", "sms1 ref");
  eq(items[1].confidence, "medium", "sms2 confidence (basis)");
  eq(items[2].confidence, "medium", "sms5 confidence (unique intent amount)");
  eq(items[3].confidence, "high", "dep1 confidence (open claim ref)");
  eq(items[3].status, "pending", "dep1 pending");
  eq(items[4].status, "done", "dep3 done");
  eq(items[4].matched, { bot_topup_id: "bt1" }, "dep3 matched");
  eq(items[7].confidence, "low", "dep2 low");
});

Deno.test("store-events: التقنيع — المرسل الخام مش بيخرج أبدًا", async () => {
  const res = await handleControlEventsRequest(
    req("/control/store-events"),
    depsOf(new FakeBotClient(), seedClient()),
  );
  const raw = JSON.stringify(await bodyOf(res));
  ok(!raw.includes("VodafoneCash-01012345678"), "raw sender 1 absent");
  ok(!raw.includes("01099998888"), "raw sender 3 absent");
  ok(!raw.includes("com.vodafone.vodafone_cash"), "raw package sender absent");
  ok(raw.includes("Vo***78"), "masked sender present");
});

Deno.test("store-events: الفلاتر والعدّادات العابرة للأبعاد", async () => {
  const d = depsOf(new FakeBotClient(), seedClient());
  let b = await bodyOf(
    await handleControlEventsRequest(req("/control/store-events?status=pending"), d),
  );
  eq((b.items as unknown[]).length, 5, "pending items");
  eq(b.counts, {
    by_source: { sms: 2, app_notification: 1, binance: 1, bybit: 1 },
    by_status: { pending: 5, done: 2, ignored: 1 },
  }, "status filter: source counters respect it, status counters ignore it");

  b = await bodyOf(
    await handleControlEventsRequest(req("/control/store-events?source=binance"), d),
  );
  eq((b.items as unknown[]).length, 2, "binance items");
  eq(b.total, 2, "binance total");

  b = await bodyOf(
    await handleControlEventsRequest(req("/control/store-events?source=xxx"), d),
  );
  eq(b.error, "bad_query", "bad source rejected");
});

// ------------------------------------------------------- الأفعال
Deno.test("فعل الرسالة: تجاهل محروس + تدقيق، ومستهلَك = 409", async () => {
  const bot = new FakeBotClient();
  const client = seedClient();
  const d = depsOf(bot, client);

  let res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_1,
      action: "ignore",
    }),
    d,
  );
  eq(res?.status, 200, "ignore status");
  eq(client.stateWrites, [{ id: SMS_1, from: "unmatched", to: "ignored" }], "guarded write");
  const b = await bodyOf(res);
  eq((b.event as Record<string, unknown>).status, "ignored", "status after");
  eq(b.audit_failed, false, "audit ok");
  ok(
    bot.calls.some((c) =>
      c.path === "/api/control/audit-log" &&
      c.body?.action === "store_event_action"
    ),
    "audit recorded with store_event_action",
  );
});

Deno.test("فعل الرسالة: تجاهل مستهلَك وإلغاء تجاهل واعتماد متجاهل", async () => {
  const client = seedClient();
  const d = depsOf(new FakeBotClient(), client);

  let res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_3,
      action: "ignore",
    }),
    d,
  );
  eq(res?.status, 409, "consumed status");
  eq((await bodyOf(res)).error, "event_consumed", "consumed error");
  eq(client.stateWrites.length, 0, "no write on consumed");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_4,
      action: "approve",
    }),
    d,
  );
  eq(res?.status, 400, "approve on ignored status");
  eq((await bodyOf(res)).error, "bad_action", "approve on ignored error");
  eq(client.rematchCalls, 0, "no rematch on ignored approve");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_4,
      action: "unignore",
    }),
    d,
  );
  eq(res?.status, 200, "unignore status");
  eq(client.stateWrites, [{ id: SMS_4, from: "ignored", to: "unmatched" }], "unignore write");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_4,
      action: "approve",
    }),
    d,
  );
  // SMS_4 رجع unmatched بعد إلغاء التجاهل — الاعتماد هنا يشتغل،
  // وبيشغّل مطابقة الطلبات مع مطابقة الشحنات زي اللصق بالحرف.
  eq(res?.status, 200, "approve after unignore");
  eq(client.rematchCalls, 1, "rematch ran");
  eq(client.orderRematchCalls, 1, "order rematch ran too");
});

Deno.test("فعل الإيداع: اعتماد بلا هدف = needs_target، وبمطالبة = resolve_claim", async () => {
  const client = seedClient();
  const d = depsOf(new FakeBotClient(), client);

  let res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "approve",
    }),
    d,
  );
  eq(res?.status, 400, "no-target status");
  eq((await bodyOf(res)).error, "needs_target", "no-target error");
  eq(client.resolveCalls.length + client.autoCreditCalls.length, 0, "no credit invented");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "binance",
      event_id: DEP_1,
      action: "approve",
      claim_id: CLAIM_1,
    }),
    d,
  );
  eq(res?.status, 200, "claim approve status");
  eq(client.resolveCalls, [{
    p_claim_id: CLAIM_1,
    p_amount_usdt: "10",
    p_tx_id: null,
    p_asset: "USDT",
    p_reject_reason: null,
  }], "resolve_claim contract");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "binance",
      event_id: DEP_3,
      action: "approve",
      claim_id: CLAIM_1,
    }),
    d,
  );
  eq(res?.status, 409, "consumed deposit status");
  eq((await bodyOf(res)).error, "event_consumed", "consumed deposit error");
  eq(client.resolveCalls.length, 1, "no second resolve");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "rematch",
    }),
    d,
  );
  eq(res?.status, 200, "deposit rematch status");
  eq(client.autoCreditCalls, [{
    p_rail: "bybit",
    p_exchange_ref: "DEP2",
    p_asset: "USDT",
    p_amount_usdt: "5",
    p_tx_hash: null,
  }], "auto-credit re-run contract");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "ignore",
    }),
    d,
  );
  eq(res?.status, 400, "deposit ignore status");
  eq((await bodyOf(res)).error, "bad_action", "deposits have no ignore");

  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: "00000000-0000-0000-0000-000000000000",
      action: "ignore",
    }),
    d,
  );
  eq(res?.status, 404, "missing event status");
  eq((await bodyOf(res)).error, "bad_event", "missing event error");
});

Deno.test("فعل الحدث: حراس المصدر والهدف والسباق", async () => {
  const client = seedClient();
  const d = depsOf(new FakeBotClient(), client);

  // مصدر الطلب مش بيطابق سكة الحدث المخزّنة (DEP_1 على binance)
  let res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_1,
      action: "approve",
      claim_id: CLAIM_1,
    }),
    d,
  );
  eq(res?.status, 400, "deposit source mismatch status");
  eq((await bodyOf(res)).error, "bad_source", "deposit source mismatch");
  eq(client.resolveCalls.length, 0, "no resolve on mismatch");

  // مصدر الطلب مش بيطابق مصدر الرسالة المخزّن (SMS_1 مصدرها sms)
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "app_notification",
      event_id: SMS_1,
      action: "ignore",
    }),
    d,
  );
  eq(res?.status, 400, "sms source mismatch status");
  eq((await bodyOf(res)).error, "bad_source", "sms source mismatch");
  eq(client.stateWrites.length, 0, "no write on mismatch");

  // هدفان مع بعض (مطالبة + نية) = ملتبس، مفيش أولوية صامتة
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "approve",
      claim_id: CLAIM_1,
      intent_id: INTENT_1,
    }),
    d,
  );
  eq(res?.status, 400, "both targets status");
  eq((await bodyOf(res)).error, "bad_target", "both targets error");
  eq(
    client.resolveCalls.length + client.autoCreditCalls.length,
    0,
    "no credit on both targets",
  );

  // اعتماد بنية: إعادة تشغيل الاعتماد التلقائي ببيانات الحدث،
  // والربط بيحصل جوه الدالة تحت قفلها.
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "approve",
      intent_id: INTENT_1,
    }),
    d,
  );
  eq(res?.status, 200, "intent approve status");
  eq(client.autoCreditCalls.length, 1, "auto-credit ran for intent");
  eq(client.resolveCalls.length, 0, "no resolve for intent");

  // سباق على كتابة حالة الرسالة: الصفوف المعدّلة صفر = مستهلَك
  client.stateRowsOverride = 0;
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_1,
      action: "ignore",
    }),
    d,
  );
  eq(res?.status, 409, "cas race status");
  eq((await bodyOf(res)).error, "event_consumed", "cas race error");
  eq(client.stateWrites.length, 0, "no write on race");
});

Deno.test("التسوية اليدوية: خريطة الحالة — متسوّي = تمّ ونتيجته ظاهرة", async () => {
  const client = seedClient();
  client.depRows.push(depRow({
    id: DEP_4,
    rail: "bybit",
    exchange_ref: "DEP4",
    amount_usdt: 7,
    outcome: "manually_settled",
    created_at: "2026-11-20T04:00:00Z",
  }));
  const d = depsOf(new FakeBotClient(), client);

  const b = await bodyOf(
    await handleControlEventsRequest(req("/control/store-events"), d),
  );
  const items = b.items as Record<string, unknown>[];
  const settled = items.find((i) => i.id === DEP_4);
  ok(settled !== undefined, "settled item present");
  eq(settled?.status, "done", "manually_settled maps to done");
  eq(settled?.outcome, "manually_settled", "outcome exposed on the event");
  eq(
    (items.find((i) => i.id === SMS_1))?.outcome,
    null,
    "sms events carry outcome null",
  );
  eq(b.counts, {
    by_source: { sms: 4, app_notification: 1, binance: 2, bybit: 2 },
    by_status: { pending: 5, done: 3, ignored: 1 },
  }, "settled counted as done, never pending");

  const bp = await bodyOf(
    await handleControlEventsRequest(
      req("/control/store-events?status=pending"), d),
  );
  ok(
    !(bp.items as Record<string, unknown>[]).some((i) => i.id === DEP_4),
    "settled excluded from pending filter",
  );
  const bd = await bodyOf(
    await handleControlEventsRequest(
      req("/control/store-events?status=done"), d),
  );
  ok(
    (bd.items as Record<string, unknown>[]).some((i) => i.id === DEP_4),
    "settled included in done filter",
  );
});

Deno.test("فعل الإيداع: تسوية يدوية ناجحة على معلّق — بلا أي مسار ائتمان", async () => {
  const bot = new FakeBotClient();
  const client = seedClient();
  const d = depsOf(bot, client);

  const res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "settle_manually",
    }),
    d,
  );
  eq(res?.status, 200, "settle status");
  const b = await bodyOf(res);
  eq(b.action, "settle_manually", "action echoed");
  eq(b.result, { outcome: "manually_settled" }, "settle result");
  const ev = b.event as Record<string, unknown>;
  eq(ev.status, "done", "event done after settle");
  eq(ev.outcome, "manually_settled", "event outcome after settle");
  eq(b.audit_failed, false, "audit ok");
  eq(
    client.settleCalls,
    [{ id: DEP_2, from: "no_matching_intent" }],
    "guarded settle write with the read outcome",
  );
  eq(client.resolveCalls.length, 0, "zero resolve_claim calls");
  eq(client.autoCreditCalls.length, 0, "zero auto-credit calls");
  eq(client.rematchCalls + client.orderRematchCalls, 0, "zero rematch calls");
  eq(client.stateWrites.length, 0, "zero sms state writes");
  ok(
    bot.calls.some((c) =>
      c.path === "/api/control/audit-log" &&
      c.body?.action === "store_event_action"
    ),
    "audit recorded with store_event_action",
  );
  eq(
    client.depRows.find((r) => r.id === DEP_2)?.outcome,
    "manually_settled",
    "row flipped in place",
  );
});

Deno.test("فعل الإيداع: تسوية مرفوضة على مستهلَك ومربوط ورسالة وسباق", async () => {
  const client = seedClient();
  const d = depsOf(new FakeBotClient(), client);

  // credited = مستهلَك: 409 قبل أي كتابة
  let res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "binance",
      event_id: DEP_3,
      action: "settle_manually",
    }),
    d,
  );
  eq(res?.status, 409, "credited settle status");
  eq((await bodyOf(res)).error, "event_consumed", "credited settle error");
  eq(client.settleCalls.length, 0, "no settle write on credited");

  // مربوط بنية لكن مش credited: حالته done بالربط — 409 برضه
  client.depRows.push(depRow({
    id: DEP_4,
    rail: "bybit",
    exchange_ref: "DEP4",
    matched_intent_id: INTENT_1,
  }));
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_4,
      action: "settle_manually",
    }),
    d,
  );
  eq(res?.status, 409, "linked settle status");
  eq((await bodyOf(res)).error, "event_consumed", "linked settle error");
  eq(client.settleCalls.length, 0, "no settle write on linked");

  // حدث رسالة: التسوية فعل إيداعات بس — رفض صريح مش صامت
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "sms",
      event_id: SMS_1,
      action: "settle_manually",
    }),
    d,
  );
  eq(res?.status, 400, "sms settle status");
  eq((await bodyOf(res)).error, "bad_action", "sms settle error");
  eq(client.stateWrites.length, 0, "no sms write on settle");

  // سباق على الكتابة المحروسة: صفر صفوف = مستهلَك
  client.settleRowsOverride = 0;
  res = await handleControlEventsRequest(
    req("/control/store-event-action", "POST", {
      source: "bybit",
      event_id: DEP_2,
      action: "settle_manually",
    }),
    d,
  );
  eq(res?.status, 409, "settle race status");
  eq((await bodyOf(res)).error, "event_consumed", "settle race error");
  eq(
    client.depRows.find((r) => r.id === DEP_2)?.outcome,
    "no_matching_intent",
    "row untouched on race",
  );
});

// ------------------------------------------------------- اللصق
const VODAFONE_BODY =
  "تم استلام مبلغ 500.00 جنيه من رقم 01000000000 إلى محفظة فودافون كاش الخاصة بك. رصيدك الحالي 1,750.00 جنيه. رقم العملية 123456789012 بتاريخ 18/11/2026 الساعة 10:30";

Deno.test("اللصق: كلمة مستبعدة تتخطى بلا إدخال", async () => {
  const client = seedClient();
  client.settings.set("sms_excluded_words", JSON.stringify(["عرض خاص"]));
  const res = await handleControlEventsRequest(
    req("/control/store-event-paste", "POST", {
      body: "عرض خاص من فودافون: اشترك دلوقتي واكسب هدايا!",
    }),
    depsOf(new FakeBotClient(), client),
  );
  eq(res?.status, 200, "status");
  const b = await bodyOf(res);
  eq(b.skipped, "excluded_word", "skipped marker");
  eq(client.ingestCalls.length, 0, "zero ingest on excluded");
});

Deno.test("اللصق: إدخال بنفس عقد الجسر بالحرف", async () => {
  const client = seedClient();
  const res = await handleControlEventsRequest(
    req("/control/store-event-paste", "POST", {
      body: VODAFONE_BODY,
      sender_id: "VodafoneCash",
    }),
    depsOf(new FakeBotClient(), client),
  );
  eq(res?.status, 200, "status");
  eq(client.ingestCalls.length, 1, "one ingest");
  const a = client.ingestCalls[0];
  // أي sender_id في الطلب بيُتجاهل: اللصق دايمًا بهوية اللوحة
  // وأصل «مش معروف» — ما يكتسبش ثقة مرسل رسمي أبدًا.
  eq(a.p_sender_id, "panel", "sender forced to panel");
  eq(a.p_parsed.origin, "unknown", "paste origin is unknown");
  eq(a.p_body, VODAFONE_BODY, "body");
  eq(a.p_amount, 500, "amount (matchable)");
  eq(a.p_sender_account, "01000000000", "sender account");
  eq(a.p_transfer_ref, "123456789012", "transfer ref");
  eq(a.p_source, "sms", "source");
  eq(a.p_package_name, null, "package");
  ok(String(a.p_dedupe_key).startsWith("ref:"), "dedupe from ref");
  eq(a.p_parsed.template, "vodafone_ar", "parsed template");
  eq(a.p_parsed.matchable, true, "parsed matchable");
  eq(a.p_parsed.source, "sms", "parsed source");
  eq(client.rematchCalls, 1, "sms rematch after ingest");
  eq(client.orderRematchCalls, 1, "order rematch after ingest");
});

Deno.test("اللصق: رسالة غير قابلة للمطابقة بتدخل بمبلغ فاضي", async () => {
  const client = seedClient();
  const res = await handleControlEventsRequest(
    req("/control/store-event-paste", "POST", { body: "رسالة عادية بلا قالب" }),
    depsOf(new FakeBotClient(), client),
  );
  eq(res?.status, 200, "status");
  eq(client.ingestCalls.length, 1, "one ingest");
  eq(client.ingestCalls[0].p_amount, null, "amount null when not matchable");
  eq(client.ingestCalls[0].p_sender_id, "panel", "default paste sender");
  ok(
    String(client.ingestCalls[0].p_dedupe_key).startsWith("auto:"),
    "auto dedupe without ref",
  );
});

// ------------------------------------------------------- الاستبعادات
Deno.test("الاستبعادات: قراءة وكتابة بتحقق وتدقيق", async () => {
  const bot = new FakeBotClient();
  const client = seedClient();
  client.settings.set("sms_excluded_words", '["كلمة١","كلمة٢"]');
  const d = depsOf(bot, client);

  let res = await handleControlEventsRequest(
    req("/control/store-event-exclusions"),
    d,
  );
  eq((await bodyOf(res)).words, ["كلمة١", "كلمة٢"], "read words");

  res = await handleControlEventsRequest(
    req("/control/store-event-exclusions", "POST", {
      words: [" أ ", "ب", "أ"],
    }),
    d,
  );
  eq(res?.status, 200, "write status");
  eq((await bodyOf(res)).words, ["أ", "ب"], "trimmed + deduped");
  eq(client.settings.get("sms_excluded_words"), '["أ","ب"]', "stored json");
  ok(
    bot.calls.some((c) =>
      c.path === "/api/control/audit-log" &&
      c.body?.action === "store_event_exclusions_set"
    ),
    "audit recorded",
  );

  const bad: unknown[] = [
    { words: "مش مصفوفة" },
    { words: [""] },
    { words: Array.from({ length: 51 }, (_, i) => `w${i}`) },
    { words: ["x".repeat(101)] },
  ];
  for (const payload of bad) {
    res = await handleControlEventsRequest(
      req("/control/store-event-exclusions", "POST", payload),
      d,
    );
    eq(res?.status, 400, "bad exclusions status");
    eq((await bodyOf(res)).error, "bad_exclusions", "bad exclusions error");
  }
});
