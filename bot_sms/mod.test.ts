/**
 * اختبارات معالج إيصالات البوت (هجرتا 017 + 019) — `deno test bot_sms/`
 * من غير أي استيراد خارجي (offline بالكامل): عميل RPC وهمي بيسجل
 * النداءات، والمعالج بيتركب عليه مباشرة.
 *
 * التغطية: بوابة الجسر (مقفول/مرفوض)، تحقق جسم الحجز/فك الحجز
 * الشكلي، وعدّ تمرير نتائج الـ RPC زي ما هي (بما فيها رفض فك
 * الحجز — الفك مش بيتم بالقوة أبدًا). قرارات الفلوس نفسها مش
 * هنا: الحجز وفكه ذرّيان في القاعدة (bot_sms_claim/unclaim)
 * والقيد عند البوت.
 */
import {
  type BotSmsDeps,
  type BotSmsRpcClient,
  handleBotSmsRequest,
} from "./mod.ts";

// مساعدات تأكيد صغيرة (نفس نمط sms_bridge).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const EVENT_ID = "6aff1723-1014-7802-7d02-5eda6aff1723";
const PARTNER_ID = "7baff172-3101-4780-a27d-025eda6aff17";
const TOKEN = "bridge-token-for-tests";

class FakeClient implements BotSmsRpcClient {
  calls: string[] = [];
  fail = false;
  callCandidates(limit: number) {
    this.calls.push(`candidates:${limit}`);
    if (this.fail) return Promise.reject(new Error("rpc boom"));
    return Promise.resolve({
      cap_egp: 500,
      events: [{ event_id: EVENT_ID, rail: "instapay" }],
    });
  }
  callClaim(args: Parameters<BotSmsRpcClient["callClaim"]>[0]) {
    this.calls.push(`claim:${args.p_event_id}:${args.p_bot_topup_id}`);
    if (this.fail) return Promise.reject(new Error("rpc boom"));
    return Promise.resolve({ claimed: true, event_id: args.p_event_id });
  }
  callUnclaim(
    args: Parameters<BotSmsRpcClient["callUnclaim"]>[0],
  ): Promise<Record<string, unknown>> {
    this.calls.push(`unclaim:${args.p_event_id}:${args.p_bot_topup_id}`);
    if (this.fail) return Promise.reject(new Error("rpc boom"));
    return Promise.resolve({ unclaimed: true, event_id: args.p_event_id });
  }
}

function deps(client: FakeClient, token = TOKEN): BotSmsDeps {
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
  const res = await handleBotSmsRequest(
    req("/wallet/auto-credit", {}, TOKEN), deps(new FakeClient()));
  eq(res, null, "null for foreign path");
});

Deno.test("GET is rejected with 405", async () => {
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-candidates", undefined, TOKEN, "GET"),
    deps(new FakeClient()));
  eq(res?.status, 405, "status");
});

Deno.test("bridge token not configured closes the route (503)", async () => {
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-candidates", {}, TOKEN),
    deps(new FakeClient(), ""));
  eq(res?.status, 503, "status");
  eq((await res!.json()).error, "bridge_not_configured", "error");
});

Deno.test("missing or wrong bridge token is 401 and never calls RPC", async () => {
  const client = new FakeClient();
  const noToken = await handleBotSmsRequest(
    req("/wallet/bot-sms-candidates", {}), deps(client));
  eq(noToken?.status, 401, "no-token status");
  const wrong = await handleBotSmsRequest(
    req("/wallet/bot-sms-candidates", {}, "nope"), deps(client));
  eq(wrong?.status, 401, "wrong-token status");
  eq(client.calls, [], "no RPC calls");
});

Deno.test("candidates pass through with clamped limit", async () => {
  const client = new FakeClient();
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-candidates", { limit: 5000 }, TOKEN),
    deps(client));
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.cap_egp, 500, "cap passthrough");
  eq(body.events.length, 1, "events passthrough");
  eq(client.calls, ["candidates:200"], "limit clamped to 200");
});

Deno.test("claim validates body shape before RPC", async () => {
  const client = new FakeClient();
  const badEvent = await handleBotSmsRequest(
    req("/wallet/bot-sms-claim", { event_id: "not-a-uuid",
      bot_topup_id: "t-1" }, TOKEN), deps(client));
  eq(badEvent?.status, 400, "bad event id");
  const badBasis = await handleBotSmsRequest(
    req("/wallet/bot-sms-claim", { event_id: EVENT_ID,
      bot_topup_id: "t-1", basis: "magic" }, TOKEN), deps(client));
  eq(badBasis?.status, 400, "bad basis");
  const badPartner = await handleBotSmsRequest(
    req("/wallet/bot-sms-claim", { event_id: EVENT_ID,
      bot_topup_id: "t-1", partner_id: "zzz" }, TOKEN), deps(client));
  eq(badPartner?.status, 400, "bad partner id");
  eq(client.calls, [], "no RPC calls for invalid bodies");
});

Deno.test("claim happy path returns RPC result verbatim", async () => {
  const client = new FakeClient();
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-claim", {
      event_id: EVENT_ID,
      bot_topup_id: "topup-uuid-1",
      partner_id: PARTNER_ID,
      basis: "dual_channel",
    }, TOKEN), deps(client));
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.claimed, true, "claimed passthrough");
  eq(client.calls, [`claim:${EVENT_ID}:topup-uuid-1`], "rpc call");
});

Deno.test("RPC failure is a 502, never a half answer", async () => {
  const client = new FakeClient();
  client.fail = true;
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-candidates", {}, TOKEN), deps(client));
  eq(res?.status, 502, "status");
  eq((await res!.json()).error, "rpc_failed", "error");
  ok(client.calls.length === 1, "rpc attempted once");
});

Deno.test("unclaim happy path returns RPC result verbatim", async () => {
  const client = new FakeClient();
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-unclaim", {
      event_id: EVENT_ID,
      bot_topup_id: "topup-uuid-1",
      partner_id: PARTNER_ID,
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
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-unclaim", {
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
  const badEvent = await handleBotSmsRequest(
    req("/wallet/bot-sms-unclaim", { event_id: "not-a-uuid",
      bot_topup_id: "t-1" }, TOKEN), deps(client));
  eq(badEvent?.status, 400, "bad event id");
  const badPartner = await handleBotSmsRequest(
    req("/wallet/bot-sms-unclaim", { event_id: EVENT_ID,
      bot_topup_id: "t-1", partner_id: "zzz" }, TOKEN), deps(client));
  eq(badPartner?.status, 400, "bad partner id");
  const noToken = await handleBotSmsRequest(
    req("/wallet/bot-sms-unclaim", { event_id: EVENT_ID,
      bot_topup_id: "t-1" }), deps(client));
  eq(noToken?.status, 401, "no-token status");
  eq(client.calls, [], "no RPC calls for invalid/unauthenticated bodies");
});

Deno.test("unclaim RPC failure is a 502", async () => {
  const client = new FakeClient();
  client.fail = true;
  const res = await handleBotSmsRequest(
    req("/wallet/bot-sms-unclaim", { event_id: EVENT_ID,
      bot_topup_id: "t-1" }, TOKEN), deps(client));
  eq(res?.status, 502, "status");
  eq((await res!.json()).error, "rpc_failed", "error");
});
