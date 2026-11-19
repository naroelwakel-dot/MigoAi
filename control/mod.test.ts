/**
 * اختبارات نقطة تجميع رئيسية لوحة التحكم (المرحلة م٠) —
 * `deno test control/` من غير أي استيراد خارجي (offline بالكامل):
 * عميلا قاعدة وبوت وهميان، والمعالج بيتركب عليهم مباشرة.
 *
 * التغطية: بوابة الأدمن (مفتاح غلط = 401 من غير أي نداء)، شكل
 * الرد السليم (عدّادات الموقع + رد البوت زي ما هو)، تدهور البوت
 * (فشل النداء = bot: null + علم bot_unavailable وأرقام الموقع
 * سليمة — ممنوع اختراع أرقام)، وفشل قاعدة الموقع = 502.
 */
import {
  type BotHomeClient,
  BridgeBotControlClient,
  type ControlDeps,
  type ControlStoreClient,
  type ControlStoreData,
  handleControlHomeRequest,
  parseCountRange,
  PostgrestControlClient,
} from "./mod.ts";

// مساعدات تأكيد صغيرة (نفس نمط باقي الوحدات).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const BOT_HOME = {
  ok: true,
  generated_at: "2026-11-19T19:00:00.000Z",
  queues: {
    pending_topups: 3,
    flagged_topups: 1,
    sheerid_needs_review: 1,
    failed_orders: 2,
    unanswered_chats: 4,
    manual_orders: 1,
  },
  latest_topups: [],
};

const STORE_DATA: ControlStoreData = {
  pending_topups_count: 2,
  pending_topups: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      amount_egp: 340,
      payment_method: "vodafone",
      sender_account: "01001500005",
      transfer_ref: "ref-1",
      created_at: "2026-11-19T18:30:00.000Z",
    },
  ],
  unmatched_sms: 5,
  new_orders: 2,
  unmatched_exchange: 1,
  latest_sms_at: "2026-11-19T18:59:00.000Z",
  latest_deposit_at: "2026-11-19T18:45:00.000Z",
};

class FakeStoreClient implements ControlStoreClient {
  calls = 0;
  fail = false;
  fetchStoreData(): Promise<ControlStoreData> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("db boom"));
    return Promise.resolve(STORE_DATA);
  }
}

class FakeBotClient implements BotHomeClient {
  calls = 0;
  fail = false;
  payload: Record<string, unknown> = BOT_HOME;
  fetchHome(): Promise<Record<string, unknown>> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("bot boom"));
    return Promise.resolve(this.payload);
  }
}

function deps(
  store: FakeStoreClient,
  bot: FakeBotClient,
): ControlDeps {
  return {
    client: store,
    botClient: bot,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(path: string, key?: string, method = "GET"): Request {
  const headers: Record<string, string> = {};
  if (key) headers["x-migo-admin"] = key;
  return new Request(`https://api.example${path}`, { method, headers });
}

Deno.test("path not ours returns null", async () => {
  const res = await handleControlHomeRequest(
    req("/wallet/sms", ADMIN_KEY),
    deps(new FakeStoreClient(), new FakeBotClient()),
  );
  eq(res, null, "null for foreign path");
});

Deno.test("wrong method is 405", async () => {
  const res = await handleControlHomeRequest(
    req("/control/home", ADMIN_KEY, "POST"),
    deps(new FakeStoreClient(), new FakeBotClient()),
  );
  eq(res?.status, 405, "status");
});

Deno.test("missing or wrong admin key is 401 and touches nothing", async () => {
  const store = new FakeStoreClient();
  const bot = new FakeBotClient();
  const d = deps(store, bot);
  const noKey = await handleControlHomeRequest(req("/control/home"), d);
  eq(noKey?.status, 401, "no key status");
  const wrong = await handleControlHomeRequest(
    req("/control/home", "wrong-key"),
    d,
  );
  eq(wrong?.status, 401, "wrong key status");
  eq(store.calls, 0, "store untouched");
  eq(bot.calls, 0, "bot untouched");
});

Deno.test("happy path aggregates store counts and passes bot through", async () => {
  const res = await handleControlHomeRequest(
    req("/control/home", ADMIN_KEY),
    deps(new FakeStoreClient(), new FakeBotClient()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  ok(typeof body.generated_at === "string", "generated_at present");
  eq(body.store.unmatched_sms, 5, "unmatched_sms");
  eq(body.store.new_orders, 2, "new_orders");
  eq(body.store.unmatched_exchange, 1, "unmatched_exchange");
  eq(body.store.pending_topups_count, 2, "pending count");
  eq(body.store.pending_topups[0].amount_egp, 340, "pending row amount");
  eq(body.store.latest_sms_at, STORE_DATA.latest_sms_at, "latest sms");
  eq(body.bot, BOT_HOME, "bot passed through verbatim");
  eq(body.bot_unavailable, false, "bot available flag");
});

Deno.test("bot failure degrades to bot null with flag, store intact", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const res = await handleControlHomeRequest(
    req("/control/home", ADMIN_KEY),
    deps(new FakeStoreClient(), bot),
  );
  eq(res?.status, 200, "status still 200");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.bot, null, "bot null — never fabricated");
  eq(body.bot_unavailable, true, "unavailable flag");
  eq(body.store.unmatched_sms, 5, "store counts intact");
});

Deno.test("store failure is a plain 502", async () => {
  const store = new FakeStoreClient();
  store.fail = true;
  const res = await handleControlHomeRequest(
    req("/control/home", ADMIN_KEY),
    deps(store, new FakeBotClient()),
  );
  eq(res?.status, 502, "status");
  const body = await res!.json();
  eq(body.ok, false, "ok false");
});

Deno.test("bridge bot client refuses when not configured", async () => {
  const client = new BridgeBotControlClient({
    baseUrlOf: () => "",
    bridgeTokenOf: () => Promise.resolve(""),
  });
  let threw = false;
  try {
    await client.fetchHome();
  } catch {
    threw = true;
  }
  ok(threw, "throws without base/token — handler turns it into bot null");
});

Deno.test("parseCountRange reads PostgREST totals", () => {
  eq(parseCountRange("0-0/123"), 123, "range with rows");
  eq(parseCountRange("*/0"), 0, "star range zero");
  eq(parseCountRange(null), null, "missing header is null — never a fallback");
  eq(parseCountRange("garbage"), null, "garbage is null");
  eq(parseCountRange("0-0/*"), null, "wildcard total is null");
});

Deno.test("store client fails loud when the count header is missing", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  try {
    const client = new PostgrestControlClient({
      baseUrl: "https://example.invalid",
      keyOf: () => "k",
    });
    let threw = false;
    try {
      await client.fetchStoreData();
    } catch {
      threw = true;
    }
    ok(threw, "missing Content-Range total must throw — never fabricate a count");
  } finally {
    globalThis.fetch = realFetch;
  }
});
