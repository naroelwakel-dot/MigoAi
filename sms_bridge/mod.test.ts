/**
 * اختبارات معالج جسر الرسائل (الحزمة 15) — `deno test sms_bridge/`
 * من غير أي استيراد خارجي (بتشتغل offline بالكامل): عميل RPC وهمي
 * بيسجل النداءات وبيفشل عند الطلب، والمعالج بيتركب عليه مباشرة.
 *
 * التغطية: نداء order_sms_rematch الجديد — بيتنادى بعد إعادة
 * مطابقة الشحنات، وفشله (أو فشل إعادة مطابقة الشحنات) مش بيكسر
 * رد الإدخال أبدًا. قرارات الفلوس نفسها في القاعدة (تدريبات
 * الحزمة 15)، مش هنا.
 */
import { handleSmsRequest, type SmsDeps, type SmsRpcClient } from "./mod.ts";

// مساعدات تأكيد صغيرة (نفس نمط sms_parse.test.ts).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

class FakeClient implements SmsRpcClient {
  calls: string[] = [];
  failIngest = false;
  failRematch = false;
  failOrderRematch = false;
  callIngestSms(_args: Parameters<SmsRpcClient["callIngestSms"]>[0]) {
    this.calls.push("ingest");
    if (this.failIngest) return Promise.reject(new Error("ingest boom"));
    return Promise.resolve({ ingested: true, match_state: "unmatched" });
  }
  callRematch(_limit: number) {
    this.calls.push("rematch");
    if (this.failRematch) return Promise.reject(new Error("rematch boom"));
    return Promise.resolve({ checked: 3, credited: 1 });
  }
  callOrderRematch(_limit: number) {
    this.calls.push("order_rematch");
    if (this.failOrderRematch) {
      return Promise.reject(new Error("order rematch boom"));
    }
    return Promise.resolve({ checked: 3, confirmed: 1 });
  }
}

function makeDeps(client: FakeClient, errors: string[]): SmsDeps {
  return {
    client,
    bridgeKeyOf: () => "test-bridge-key",
    logError: (source: string) => {
      errors.push(source);
    },
  };
}

function makeReq(key = "test-bridge-key"): Request {
  return new Request("https://bridge.test/wallet/sms", {
    method: "POST",
    headers: { "x-migo-sms-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_id: "VodafoneCash",
      body: "تم استلام مبلغ 500.00 جنيه من رقم 01000000000. رقم العملية 123456789012",
      received_at: "2026-11-19T10:00:00.000Z",
    }),
  });
}

Deno.test("bridge: order rematch runs after wallet rematch on ingest", async () => {
  const client = new FakeClient();
  const errors: string[] = [];
  const res = await handleSmsRequest(makeReq(), makeDeps(client, errors));
  ok(res !== null, "response exists");
  eq(res!.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok flag");
  eq(client.calls, ["ingest", "rematch", "order_rematch"], "call order");
  eq(body.rematch, { checked: 3, credited: 1 }, "wallet rematch in response");
  eq(body.order_rematch, { checked: 3, confirmed: 1 }, "order rematch in response");
  eq(errors, [], "no errors logged");
});

Deno.test("bridge: order rematch failure does not fail ingest", async () => {
  const client = new FakeClient();
  client.failOrderRematch = true;
  const errors: string[] = [];
  const res = await handleSmsRequest(makeReq(), makeDeps(client, errors));
  ok(res !== null, "response exists");
  eq(res!.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok flag");
  eq(body.order_rematch, null, "order rematch null on failure");
  eq(errors, ["wallet_sms.order_rematch"], "failure logged once");
});

Deno.test("bridge: wallet rematch failure still runs order rematch", async () => {
  const client = new FakeClient();
  client.failRematch = true;
  const errors: string[] = [];
  const res = await handleSmsRequest(makeReq(), makeDeps(client, errors));
  ok(res !== null, "response exists");
  eq(res!.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok flag");
  eq(body.rematch, null, "wallet rematch null on failure");
  eq(body.order_rematch, { checked: 3, confirmed: 1 }, "order rematch still ran");
  eq(client.calls, ["ingest", "rematch", "order_rematch"], "call order");
  eq(errors, ["wallet_sms.rematch"], "failure logged once");
});

Deno.test("bridge: ingest failure returns 502 and skips both rematches", async () => {
  const client = new FakeClient();
  client.failIngest = true;
  const errors: string[] = [];
  const res = await handleSmsRequest(makeReq(), makeDeps(client, errors));
  ok(res !== null, "response exists");
  eq(res!.status, 502, "status");
  eq(client.calls, ["ingest"], "no rematch calls");
  eq(errors, ["wallet_sms.ingest"], "ingest failure logged");
});

Deno.test("bridge: wrong bridge key is rejected before any RPC", async () => {
  const client = new FakeClient();
  const errors: string[] = [];
  const res = await handleSmsRequest(
    makeReq("wrong-key"),
    makeDeps(client, errors),
  );
  ok(res !== null, "response exists");
  eq(res!.status, 401, "status");
  eq(client.calls, [], "no RPC calls");
});
