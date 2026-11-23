/**
 * اختبارات إساءة: اشتقاق IP العميل الموثوق (W3 #4 + W6 #8 — نص XFF).
 *
 * القاعدة: المفتاح الوحيد لدلاء حدود المعدّل هو `cf-connecting-ip`
 * اللي بيكتبه Cloudflare بنفسه عند بوابة migoai.shop. أول قفزة في
 * `x-forwarded-for` من العميل وتتزوّر — الاختبارات دي بتثبّت إن
 * تدويرها مش بيغيّر الدلو لا في الدالة ولا عبر معالج SheerID
 * الحقيقي، وإن غياب هيدر Cloudflare بيوقع الكل في دلو "unknown"
 * المشترك (حدود أشد، مش غايبة).
 */
import { clientIp } from "./client_ip.ts";
import { handleSheeridRequest, SheeridRateLimiter } from "./sheerid/mod.ts";
import type { SheeridService } from "./sheerid/service.ts";
import type { OrderPort } from "./sheerid/repo.ts";

function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}
function eq(a: unknown, b: unknown, label: string) {
  if (a !== b) {
    throw new Error(`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  }
}

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://deno.example/api", { headers });
}

Deno.test("clientIp: cf-connecting-ip is the only trusted source", () => {
  eq(
    clientIp(reqWith({ "cf-connecting-ip": "203.0.113.7" })),
    "203.0.113.7",
    "cloudflare header wins",
  );
  eq(
    clientIp(reqWith({ "cf-connecting-ip": " 203.0.113.7 " })),
    "203.0.113.7",
    "value trimmed",
  );
  eq(
    clientIp(reqWith({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "1.2.3.4",
    })),
    "203.0.113.7",
    "spoofed XFF does not override the trusted header",
  );
});

Deno.test("clientIp: XFF alone never becomes a bucket key", () => {
  eq(
    clientIp(reqWith({ "x-forwarded-for": "1.2.3.4" })),
    "unknown",
    "single forged hop ignored",
  );
  eq(
    clientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    "unknown",
    "forged chain ignored",
  );
  eq(clientIp(reqWith({})), "unknown", "absent headers share one bucket");
});

// ---------------------------------------------------------------------
// عبر معالج SheerID الحقيقي: الحدّ بيتحسب قبل أي شغل قاعدة، فطلبات
// الحالة بطلب وهمي (مش موجود) تكفي لإثبات سلوك الدلو.
// ---------------------------------------------------------------------
const stubService = {
  enabled: () => true,
  stateForOrder: () => Promise.resolve(null),
  submit: () => Promise.reject(new Error("unused in these tests")),
  refresh: () => Promise.resolve(null),
  sweep: () => Promise.resolve({}),
} as unknown as SheeridService;

const stubOrders = {
  getOrder: () => Promise.resolve(null),
} as unknown as OrderPort;

function statusReq(headers: Record<string, string>): Request {
  return new Request("https://deno.example/sheerid/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ order_ref: "MG-000000", sender_account: "0100" }),
  });
}

function depsWithLimit(perMinute: number) {
  return {
    service: stubService,
    orders: stubOrders,
    isAuthorized: () => false,
    rateLimiter: new SheeridRateLimiter({
      statusPerMinute: perMinute,
      submitPerMinute: perMinute,
      callbackPerMinute: perMinute,
    }),
  };
}

Deno.test("sheerid limiter: rotating spoofed XFF does not escape the CF bucket", async () => {
  const deps = depsWithLimit(2);
  const cf = { "cf-connecting-ip": "203.0.113.7" };
  let res = await handleSheeridRequest(
    statusReq({ ...cf, "x-forwarded-for": "10.0.0.1" }),
    deps,
  );
  eq(res!.status, 200, "first request passes");
  res = await handleSheeridRequest(
    statusReq({ ...cf, "x-forwarded-for": "172.16.9.9, 10.0.0.1" }),
    deps,
  );
  eq(res!.status, 200, "second request passes");
  res = await handleSheeridRequest(
    statusReq({ ...cf, "x-forwarded-for": "99.99.99.99" }),
    deps,
  );
  eq(res!.status, 429, "third request limited despite a fresh forged XFF");
});

Deno.test("sheerid limiter: distinct CF IPs get distinct buckets", async () => {
  const deps = depsWithLimit(2);
  for (let i = 0; i < 2; i++) {
    const res = await handleSheeridRequest(
      statusReq({ "cf-connecting-ip": "203.0.113.7" }),
      deps,
    );
    eq(res!.status, 200, `request ${i + 1} for the first client passes`);
  }
  const res = await handleSheeridRequest(
    statusReq({ "cf-connecting-ip": "198.51.100.9" }),
    deps,
  );
  eq(res!.status, 200, "a different real client is not limited");
});

Deno.test("sheerid limiter: no CF header falls into the shared unknown bucket", async () => {
  const deps = depsWithLimit(2);
  let res = await handleSheeridRequest(
    statusReq({ "x-forwarded-for": "1.1.1.1" }),
    deps,
  );
  eq(res!.status, 200, "first direct request passes");
  res = await handleSheeridRequest(
    statusReq({ "x-forwarded-for": "2.2.2.2" }),
    deps,
  );
  eq(res!.status, 200, "second direct request passes");
  res = await handleSheeridRequest(
    statusReq({ "x-forwarded-for": "3.3.3.3" }),
    deps,
  );
  eq(res!.status, 429, "rotating forged XFF stays in the one shared bucket");
  ok(true, "done");
});
