/**
 * اختبارات معالج إيداعات البوت (هجرة 018) — `deno test bot_exchange/`
 * من غير أي استيراد خارجي (offline بالكامل): عميل RPC وهمي بيسجل
 * النداءات، والمعالج بيتركب عليه مباشرة.
 *
 * التغطية: بوابة الجسر (مقفول/مرفوض)، تحقق جسم الحجز الشكلي
 * (مبلغ/وقت)، وعدّ تمرير نتائج الـ RPC زي ما هي. قرارات الفلوس
 * نفسها مش هنا: الحجز ذرّي في القاعدة (bot_exchange_claim)
 * والقيد عند البوت.
 */
import {
  type BotExchangeDeps,
  type BotExchangeRpcClient,
  handleBotExchangeRequest,
} from "./mod.ts";

// مساعدات تأكيد صغيرة (نفس نمط bot_sms).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const EVENT_ID = "6aff1723-1014-7802-7d02-5eda6aff1723";
const TOKEN = "bridge-token-for-tests";
const CLAIM_BODY = {
  event_id: EVENT_ID,
  bot_topup_id: "topup-uuid-1",
  expected_egp: "270.00",
  topup_created_at: "2026-11-19T15:55:00.000Z",
};

class FakeClient implements BotExchangeRpcClient {
  calls: string[] = [];
  fail = false;
  callCandidates(limit: number) {
    this.calls.push(`candidates:${limit}`);
    if (this.fail) return Promise.reject(new Error("rpc boom"));
    return Promise.resolve({
      rate: "54",
      events: [{ event_id: EVENT_ID, rail: "binance" }],
    });
  }
  callClaim(args: Parameters<BotExchangeRpcClient["callClaim"]>[0]) {
    this.calls.push(
      `claim:${args.p_event_id}:${args.p_bot_topup_id}:` +
        `${args.p_expected_egp}:${args.p_topup_created_at}`);
    if (this.fail) return Promise.reject(new Error("rpc boom"));
    return Promise.resolve({ claimed: true, event_id: args.p_event_id });
  }
  callUnclaim(
    args: Parameters<BotExchangeRpcClient["callUnclaim"]>[0],
  ): Promise<Record<string, unknown>> {
    this.calls.push(`unclaim:${args.p_event_id}:${args.p_bot_topup_id}`);
    if (this.fail) return Promise.reject(new Error("rpc boom"));
    return Promise.resolve({ unclaimed: true, event_id: args.p_event_id });
  }
}

function deps(client: FakeClient, token = TOKEN): BotExchangeDeps {
  return {
    client,
    bridgeTokenOf: () => Promise.resolve(token),
    logError: () => {},
  };
}

function req(path: string, body?: unknown, token?: string, method = "POST") {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token !== undefined) headers["x-bridge-token"] = token;
  return new Request(`https://store.example${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

Deno.test("unknown path is not ours", async () => {
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-sms-candidates", {}, TOKEN), deps(new FakeClient()));
  eq(res, null, "null for foreign path");
});

Deno.test("GET is rejected with 405", async () => {
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-candidates", undefined, TOKEN, "GET"),
    deps(new FakeClient()));
  eq(res?.status, 405, "status");
});

Deno.test("bridge token not configured closes the route (503)", async () => {
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-candidates", {}, TOKEN),
    deps(new FakeClient(), ""));
  eq(res?.status, 503, "status");
  eq((await res!.json()).error, "bridge_not_configured", "error");
});

Deno.test("missing or wrong bridge token is 401 and never calls RPC", async () => {
  const client = new FakeClient();
  const noToken = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-candidates", {}), deps(client));
  eq(noToken?.status, 401, "no-token status");
  const wrong = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-candidates", {}, "nope"), deps(client));
  eq(wrong?.status, 401, "wrong-token status");
  eq(client.calls, [], "no RPC calls");
});

Deno.test("candidates pass through with clamped limit", async () => {
  const client = new FakeClient();
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-candidates", { limit: 5000 }, TOKEN),
    deps(client));
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.rate, "54", "rate passthrough");
  eq(body.events.length, 1, "events passthrough");
  eq(client.calls, ["candidates:200"], "limit clamped to 200");
});

Deno.test("claim validates body shape before RPC", async () => {
  const client = new FakeClient();
  const badEvent = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, event_id: "not-a-uuid" }, TOKEN), deps(client));
  eq(badEvent?.status, 400, "bad event id");
  const badAmountText = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, expected_egp: "abc" }, TOKEN), deps(client));
  eq(badAmountText?.status, 400, "bad amount text");
  const badAmountScale = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, expected_egp: "270.001" }, TOKEN), deps(client));
  eq(badAmountScale?.status, 400, "bad amount scale");
  const badAmountZero = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, expected_egp: "0" }, TOKEN), deps(client));
  eq(badAmountZero?.status, 400, "zero amount");
  const badTime = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, topup_created_at: "not-a-date" }, TOKEN),
    deps(client));
  eq(badTime?.status, 400, "bad topup time");
  const missingTime = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, topup_created_at: "" }, TOKEN), deps(client));
  eq(missingTime?.status, 400, "missing topup time");
  eq(client.calls, [], "no RPC calls for invalid bodies");
});

Deno.test("claim happy path returns RPC result verbatim", async () => {
  const client = new FakeClient();
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim", CLAIM_BODY, TOKEN), deps(client));
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.claimed, true, "claimed passthrough");
  eq(client.calls, [
    `claim:${EVENT_ID}:topup-uuid-1:270.00:2026-11-19T15:55:00.000Z`,
  ], "rpc call");
});

Deno.test("claim accepts a numeric JSON amount by stringifying it", async () => {
  const client = new FakeClient();
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-claim",
      { ...CLAIM_BODY, expected_egp: 270.5 }, TOKEN), deps(client));
  eq(res?.status, 200, "status");
  eq(client.calls, [
    `claim:${EVENT_ID}:topup-uuid-1:270.5:2026-11-19T15:55:00.000Z`,
  ], "rpc call");
});

Deno.test("RPC failure is a 502, never a half answer", async () => {
  const client = new FakeClient();
  client.fail = true;
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-candidates", {}, TOKEN), deps(client));
  eq(res?.status, 502, "status");
  eq((await res!.json()).error, "rpc_failed", "error");
  ok(client.calls.length === 1, "rpc attempted once");
});

Deno.test("unclaim happy path returns RPC result verbatim", async () => {
  const client = new FakeClient();
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-unclaim", {
      event_id: EVENT_ID,
      bot_topup_id: "topup-uuid-1",
    }, TOKEN), deps(client));
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.unclaimed, true, "unclaimed passthrough");
  eq(client.calls, [`unclaim:${EVENT_ID}:topup-uuid-1`], "rpc call");
});

Deno.test("unclaim refusal passes through (never forced)", async () => {
  const client = new FakeClient();
  client.callUnclaim = () => Promise.resolve({
    unclaimed: false,
    reason: "not_bot_claimed",
  });
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-unclaim", {
      event_id: EVENT_ID,
      bot_topup_id: "topup-uuid-1",
    }, TOKEN), deps(client));
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.unclaimed, false, "refusal passthrough");
  eq(body.reason, "not_bot_claimed", "reason passthrough");
});

Deno.test("unclaim validates body shape and bridge gate before RPC", async () => {
  const client = new FakeClient();
  const badEvent = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-unclaim",
      { event_id: "not-a-uuid", bot_topup_id: "t-1" }, TOKEN),
    deps(client));
  eq(badEvent?.status, 400, "bad event id");
  const noToken = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-unclaim",
      { event_id: EVENT_ID, bot_topup_id: "t-1" }), deps(client));
  eq(noToken?.status, 401, "no-token status");
  eq(client.calls, [], "no RPC calls for invalid/unauthenticated bodies");
});

Deno.test("unclaim RPC failure is a 502", async () => {
  const client = new FakeClient();
  client.fail = true;
  const res = await handleBotExchangeRequest(
    req("/wallet/bot-exchange-unclaim",
      { event_id: EVENT_ID, bot_topup_id: "t-1" }, TOKEN), deps(client));
  eq(res?.status, 502, "status");
  eq((await res!.json()).error, "rpc_failed", "error");
});
