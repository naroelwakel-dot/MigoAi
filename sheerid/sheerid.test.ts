/**
 * اختبارات أتمتة تحقق SheerID على الموقع — `deno test sheerid.test.ts`
 * من غير أي استيراد خارجي (بتشتغل offline بالكامل).
 *
 * ⚠️ كل النداءات على نقل وهمي (FakeSheerid) وذاكرة بشكل قاعدة
 * Staging الحقيقي (MemoryStoreDb بتاعة store_executor) — ممنوع أي
 * نداء حقيقي لخدمة التحقق أو لقاعدة إنتاج في الاختبارات دي أبدًا.
 * معرّفات العمليات هنا وهمية عمدًا (JOB-TEST-*).
 */

import { SheerIDClient, SheerIDError } from "./client.ts";
import type { Transport, TransportRequest } from "./client.ts";
import { STATUS_AWAITING_LINK, STUDENT_SKU } from "./config.ts";
import {
  MemoryOrderPort,
  MemorySheeridRepository,
  type OrderPort,
  type SheeridJob,
} from "./repo.ts";
import {
  findVerifyUrl,
  SheeridService,
  validateActivationUrl,
  validateVerifyUrl,
  type EmailOutcome,
} from "./service.ts";
import {
  buildSheeridFromEnvAsync,
  fetchBridgeToken,
  handleSheeridRequest,
  SheeridRateLimiter,
} from "./mod.ts";
import { BRIDGE_PATH } from "./config.ts";

// عنوان جسر وهمي للاختبارات — العنوان الحقيقي بقى من البيئة بس
// (إصلاح اللجنة #10: مفيش عناوين مورّد/جسر مكتوبة في الكود).
const TEST_BRIDGE_URL = "https://bridge.invalid";
import { MemoryStoreDb } from "../store_executor/store_db.ts";
import type { StoreOrder } from "../store_executor/types.ts";

// مساعدات تأكيد صغيرة (بديل std/assert عشان الاختبار يشتغل offline).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy — ${label}`);
}

// ---------------------------------------------------------------------
// النقل الوهمي لخدمة التحقق
// ---------------------------------------------------------------------
class FakeSheerid {
  calls: TransportRequest[] = [];
  balanceData: Record<string, unknown> = {
    service_available: true,
    possible_verifications: 5,
  };
  verifyData: Record<string, unknown> = {
    job_id: "JOB-TEST-1",
    charged_usd: 1.99,
    status: "processing",
  };
  statusQueue: Record<string, unknown>[] = [];
  failVerify = false;
  failBalance = false;

  transport: Transport = (req) => {
    this.calls.push(req);
    const envelope = (data: Record<string, unknown>) => ({
      status: 200,
      text: JSON.stringify({ ok: true, data }),
    });
    if (req.url.includes("/balance")) {
      if (this.failBalance) {
        return Promise.resolve({
          status: 500,
          text: JSON.stringify({ ok: false, message: "down" }),
        });
      }
      return Promise.resolve(envelope(this.balanceData));
    }
    if (req.url.includes("/verify")) {
      if (this.failVerify) {
        return Promise.resolve({
          status: 502,
          text: JSON.stringify({ ok: false, message: "boom" }),
        });
      }
      return Promise.resolve(envelope(this.verifyData));
    }
    if (req.url.includes("/status/")) {
      const next = this.statusQueue.length
        ? this.statusQueue.shift()!
        : { status: "processing" };
      return Promise.resolve(envelope(next));
    }
    return Promise.resolve({ status: 404, text: "{}" });
  };

  count(part: string): number {
    return this.calls.filter((c) => c.url.includes(part)).length;
  }
}

// ---------------------------------------------------------------------
// تجهيز مشترك
// ---------------------------------------------------------------------
const VALID_URL = "https://services.sheerid.com/verify/abc123?x=1";

interface Harness {
  fake: FakeSheerid;
  store: MemoryStoreDb;
  repo: MemorySheeridRepository;
  service: SheeridService;
  orders: MemoryOrderPort;
  adminNotes: string[];
  emails: { kind: string; order_ref: string }[];
  emailOutcome: EmailOutcome;
  clock: { t: Date };
}

function makeOrder(over: Partial<StoreOrder> = {}): StoreOrder {
  return {
    order_ref: "MG-200001",
    status: "paid",
    customer_email: "student@example.com",
    sender_account: "01000000000",
    payment_method: "فودافون كاش",
    items: [{ sku: STUDENT_SKU, qty: 1, price_egp: 280 }],
    server_total_egp: 280,
    idempotency_key: null,
    ...over,
  };
}

function harness(order?: StoreOrder): Harness {
  const clock = { t: new Date("2026-11-18T12:00:00.000Z") };
  const nowFn = () => new Date(clock.t);
  const fake = new FakeSheerid();
  const store = new MemoryStoreDb(nowFn);
  if (order) store.addOrder(order);
  const repo = new MemorySheeridRepository(nowFn);
  const orders = new MemoryOrderPort(store);
  const adminNotes: string[] = [];
  const emails: { kind: string; order_ref: string }[] = [];
  const h: Harness = {
    fake, store, repo, orders, adminNotes, emails,
    emailOutcome: "sent",
    clock,
    service: null as unknown as SheeridService,
  };
  h.service = new SheeridService({
    repo,
    client: new SheerIDClient({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid",
      transport: fake.transport,
    }),
    orders,
    sendEmail: ({ order: o, kind }) => {
      emails.push({ kind, order_ref: o.order_ref });
      return Promise.resolve(h.emailOutcome);
    },
    alertAdmin: (t) => adminNotes.push(t),
    log: () => {},
    sleeper: () => Promise.resolve(),
    now: nowFn,
    paidStatuses: ["paid", "payment_confirmed"],
  });
  return h;
}

async function jobOf(h: Harness, ref = "MG-200001"): Promise<SheeridJob> {
  const job = await h.repo.findForOrder(ref);
  if (!job) throw new Error("job missing");
  return job;
}

// ---------------------------------------------------------------------
// 1) المسار السعيد الكامل: طلب → دفع → رابط → تحقق → تفعيل ظاهر
// ---------------------------------------------------------------------
Deno.test("happy path: submit → poll → completed, activation stored, order fulfilled, delivered", async () => {
  const h = harness(makeOrder());
  h.fake.statusQueue = [
    { status: "processing" },
    { status: "completed", activation_url: "https://activate.example/xyz" },
  ];
  const state = await h.service.submit(makeOrder(), VALID_URL);
  eq(state.state, "completed", "final state");
  eq(state.activation_url, "https://activate.example/xyz", "activation in state");
  const job = await jobOf(h);
  eq(job.status, "completed", "job completed");
  eq(job.job_id, "JOB-TEST-1", "provider job id stored internally");
  eq(job.activation_url, "https://activate.example/xyz", "activation stored");
  ok(!!job.delivered_at, "delivered_at marked after email sent");
  eq(h.fake.count("/verify"), 1, "exactly one verify call");
  eq(h.store.orders.get("MG-200001")?.status, "fulfilled", "order fulfilled");
  eq(h.emails.length, 1, "one completion email");
  eq(h.emails[0].kind, "completed", "completion email kind");
  ok(h.adminNotes.some((t) => t.includes("JOB-TEST-1")), "admin note carries provider id (admin surface only)");
});

// ---------------------------------------------------------------------
// 2) التسوية من رد الإرسال نفسه (من غير استطلاع)
// ---------------------------------------------------------------------
Deno.test("verify response already completed → settled without polling", async () => {
  const h = harness(makeOrder());
  h.fake.verifyData = {
    job_id: "JOB-TEST-9",
    charged_usd: 1.99,
    status: "completed",
    activation_url: "https://activate.example/instant",
  };
  const state = await h.service.submit(makeOrder(), VALID_URL);
  eq(state.state, "completed", "state");
  eq(h.fake.count("/status/"), 0, "no status polls needed");
});

// ---------------------------------------------------------------------
// 3) مسار الفشل: المورد ردّ refunded → استرداد المتجر يشتغل
// ---------------------------------------------------------------------
Deno.test("failure (refunded): refund_order mechanics fire — obligation + order refunded", async () => {
  const h = harness(makeOrder());
  h.fake.statusQueue = [{ status: "refunded" }];
  const state = await h.service.submit(makeOrder(), VALID_URL);
  eq(state.state, "failed", "customer sees failed state");
  const job = await jobOf(h);
  eq(job.status, "refunded", "job refunded");
  eq(h.store.refundObligations.length, 1, "one refund obligation");
  eq(h.store.refundObligations[0].amount_egp, 280, "obligation = full sell price");
  eq(h.store.refundObligations[0].sender_account, "01000000000", "obligation carries sender account");
  eq(h.store.refundObligations[0].state, "obligation_recorded", "cash rail waits for owner pay-back step");
  eq(h.store.orders.get("MG-200001")?.status, "refunded", "order refunded");
  const ex = await h.store.getExecutionByOrderSku("MG-200001", STUDENT_SKU);
  eq(ex?.status, "refunded", "execution refunded");
  eq(ex?.supplier_key, "sheerid", "execution owned by sheerid flow");
  ok(h.emails.some((e) => e.kind === "failed"), "failure email sent");
  // إعادة التسوية ما تكررش الاسترداد (إيدمبوتنسي refund_order).
  const again = await h.service.refresh("JOB-TEST-1");
  eq(again?.status, "refunded", "still refunded");
  eq(h.store.refundObligations.length, 1, "still exactly one obligation");
});

// ---------------------------------------------------------------------
// 4) فشل نهائي بصيغة failed عند المورد → نفس مسار الاسترداد
// ---------------------------------------------------------------------
Deno.test("failure (failed status): job failed + refund confirmed", async () => {
  const h = harness(makeOrder());
  h.fake.statusQueue = [{ status: "failed" }];
  const state = await h.service.submit(makeOrder(), VALID_URL);
  eq(state.state, "failed", "state");
  eq((await jobOf(h)).status, "failed", "job failed");
  eq(h.store.orders.get("MG-200001")?.status, "refunded", "order refunded");
});

// ---------------------------------------------------------------------
// 5) حارس التكرار: إرسال تاني أثناء/بعد المعالجة = صفر نداءات جديدة
// ---------------------------------------------------------------------
Deno.test("duplicate submission never re-verifies (no double spend)", async () => {
  const h = harness(makeOrder());
  const s1 = await h.service.submit(makeOrder(), VALID_URL);
  eq(s1.state, "processing", "still processing after poll budget");
  eq(h.fake.count("/verify"), 1, "one verify");
  const s2 = await h.service.submit(makeOrder(), VALID_URL);
  eq(s2.state, "processing", "duplicate returns processing");
  eq(h.fake.count("/verify"), 1, "still one verify after duplicate");
  // وبعد الاكتمال برضه:
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/dup" },
  ];
  await h.service.refresh("JOB-TEST-1");
  const s3 = await h.service.submit(makeOrder(), VALID_URL);
  eq(s3.state, "completed", "post-completion submit returns completed");
  eq(h.fake.count("/verify"), 1, "verify count unchanged forever");
});

// ---------------------------------------------------------------------
// 6) رابط غير صالح: رفض نضيف + صفر نداءات
// ---------------------------------------------------------------------
Deno.test("invalid / foreign URLs rejected with zero provider calls", async () => {
  const h = harness(makeOrder());
  for (
    const bad of [
      "https://example.com/verify/x",
      "http://services.sheerid.com/verify/x",
      "https://services.sheerid.com.evil.com/verify/x",
      "https://services.sheerid.com/other/x",
      "مش رابط أصلًا",
    ]
  ) {
    let threw = false;
    try {
      await h.service.submit(makeOrder(), bad);
    } catch (e) {
      threw = e instanceof SheerIDError;
    }
    ok(threw, `rejects: ${bad}`);
  }
  eq(h.fake.calls.length, 0, "zero provider calls for invalid links");
  // الاستخراج من نص حر شغال وبينضّف الترقيم اللي بعده:
  eq(
    findVerifyUrl(`ابعت ${VALID_URL}.`),
    VALID_URL,
    "extracts url from free text",
  );
  eq(validateVerifyUrl(VALID_URL), VALID_URL, "valid url passes");
});

// ---------------------------------------------------------------------
// 7) المفتاح غايب: الميزة مقفولة fail-closed
// ---------------------------------------------------------------------
Deno.test("key absent: disabled state, manual wording, zero provider calls", async () => {
  const h = harness(makeOrder());
  const disabled = new SheeridService({
    repo: h.repo,
    client: new SheerIDClient({
      apiKey: "",
      baseUrl: "https://provider.invalid",
      transport: h.fake.transport,
    }),
    orders: h.orders,
    log: () => {},
    sleeper: () => Promise.resolve(),
    paidStatuses: ["paid"],
  });
  eq(disabled.enabled(), false, "disabled without key");
  const state = await disabled.stateForOrder(makeOrder());
  eq(state?.state, "disabled", "disabled customer state");
  ok(state!.message.includes("يدويًا"), "manual completion wording");
  const counts = await disabled.sweep();
  eq(counts.opened, 0, "sweep opens nothing while disabled");
  eq(h.fake.calls.length, 0, "zero provider calls while disabled");
});

// ---------------------------------------------------------------------
// 8) بوابة الجاهزية: الخدمة واقفة / الرصيد فاضي → مسار يدوي
// ---------------------------------------------------------------------
Deno.test("provider not ready → manual fallback, job stays awaiting_link, no verify", async () => {
  const h = harness(makeOrder());
  h.fake.balanceData = { service_available: false };
  const s = await h.service.submit(makeOrder(), VALID_URL);
  eq(s.state, "manual_fallback", "fallback state");
  const job = await jobOf(h);
  eq(job.status, STATUS_AWAITING_LINK, "job back to awaiting_link");
  eq(job.manual_fallback, true, "fallback flag set");
  eq(h.fake.count("/verify"), 0, "no verify call");
  ok(h.adminNotes.some((t) => t.includes("يدويًا")), "admin alerted");
  ok(h.emails.some((e) => e.kind === "fallback"), "customer emailed fallback wording");
  // الحالة المعروضة بعد كده بتعكس المسار اليدوي:
  const view = await h.service.stateForOrder(makeOrder());
  eq(view?.state, "manual_fallback", "status view shows manual fallback");

  const h2 = harness(makeOrder());
  h2.fake.balanceData = { service_available: true, possible_verifications: 0 };
  const s2 = await h2.service.submit(makeOrder(), VALID_URL);
  eq(s2.state, "manual_fallback", "zero possible verifications → fallback");
  eq(h2.fake.count("/verify"), 0, "no verify when balance empty");

  const h3 = harness(makeOrder());
  h3.fake.failBalance = true;
  const s3 = await h3.service.submit(makeOrder(), VALID_URL);
  eq(s3.state, "manual_fallback", "balance read failure → fallback");
});

// ---------------------------------------------------------------------
// 9) فشل الإرسال نفسه عند المورد → مسار يدوي نظيف
// ---------------------------------------------------------------------
Deno.test("verify call fails → manual fallback, job awaiting_link", async () => {
  const h = harness(makeOrder());
  h.fake.failVerify = true;
  const s = await h.service.submit(makeOrder(), VALID_URL);
  eq(s.state, "manual_fallback", "fallback state");
  eq((await jobOf(h)).status, STATUS_AWAITING_LINK, "awaiting link again");
});

// ---------------------------------------------------------------------
// 10) الاستطلاع يخلص والتحقق لسه شغّال → المسح الدوري يكمّل التسوية
// ---------------------------------------------------------------------
Deno.test("still processing after poll → sweep settles it later", async () => {
  const h = harness(makeOrder());
  const s = await h.service.submit(makeOrder(), VALID_URL);
  eq(s.state, "processing", "processing after in-request poll");
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/late" },
  ];
  h.clock.t = new Date("2026-11-18T12:01:10.000Z"); // +70s: عدّى حد الـ40 ثانية
  const counts = await h.service.sweep();
  eq(counts.checked, 1, "sweep checked the in-flight job");
  eq(counts.settled, 1, "sweep settled it");
  eq((await jobOf(h)).status, "completed", "job completed by sweep");
  eq(h.store.orders.get("MG-200001")?.status, "fulfilled", "order fulfilled");
});

// ---------------------------------------------------------------------
// 11) الإشعار (webhook): refresh بنفس مسار المسح
// ---------------------------------------------------------------------
Deno.test("refresh by provider job id settles (webhook path)", async () => {
  const h = harness(makeOrder());
  await h.service.submit(makeOrder(), VALID_URL);
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/hook" },
  ];
  const job = await h.service.refresh("JOB-TEST-1");
  eq(job?.status, "completed", "settled via refresh");
  const missing = await h.service.refresh("JOB-UNKNOWN");
  eq(missing, null, "unknown id → null, no crash");
});

// ---------------------------------------------------------------------
// 12) ضمان التسليم: إيميل فاشل → إعادة بفواصل → نجاح → ممنوع التكرار
// ---------------------------------------------------------------------
Deno.test("delivery guarantee: failed email retries on gaps, never twice after success", async () => {
  const h = harness(makeOrder());
  h.emailOutcome = "failed";
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/retry" },
  ];
  const s = await h.service.submit(makeOrder(), VALID_URL);
  eq(s.state, "completed", "completed despite email failure");
  let job = await jobOf(h);
  eq(job.delivered_at, null, "not delivered yet");
  eq(job.delivery_attempts, 1, "first attempt recorded");
  // قبل الفاصل (60 ثانية): المسح ما يعيدش.
  h.clock.t = new Date("2026-11-18T12:00:30.000Z");
  await h.service.sweep();
  eq(h.emails.length, 1, "no early retry");
  // بعد الفاصل + الإيميل بقى شغّال:
  h.emailOutcome = "sent";
  h.clock.t = new Date("2026-11-18T12:01:05.000Z");
  const counts = await h.service.sweep();
  eq(counts.delivery_retried, 1, "one retry");
  eq(counts.delivery_delivered, 1, "retry delivered");
  job = await jobOf(h);
  ok(!!job.delivered_at, "delivered_at set");
  // أي مسح بعد كده: ممنوع إرسال تاني أبدًا.
  h.clock.t = new Date("2026-11-18T13:00:00.000Z");
  await h.service.sweep();
  eq(h.emails.filter((e) => e.kind === "completed").length, 2, "no third email ever");
});

// ---------------------------------------------------------------------
// 13) مشاهدة العميل للنتيجة في صفحة الفاتورة ما بتعلّمش التسليم
//     (إصلاح اللجنة #11 — كان السلوك القديم بيعلّم delivered_at)
// ---------------------------------------------------------------------
Deno.test("panel fix 9: viewing the completed invoice state does NOT mark delivery", async () => {
  const h = harness(makeOrder());
  h.emailOutcome = "failed";
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/view" },
  ];
  await h.service.submit(makeOrder(), VALID_URL);
  eq((await jobOf(h)).delivered_at, null, "undelivered before view");
  const view = await h.service.stateForOrder(makeOrder());
  eq(view?.state, "completed", "view shows completed");
  eq(view?.activation_url, "https://activate.example/view", "activation visible on the invoice");
  eq((await jobOf(h)).delivered_at, null, "view does NOT set delivered_at anymore");
  // والتسليم الحقيقي بيكمل من مسار التسليم المتتبَّع لما الإيميل يشتغل:
  h.emailOutcome = "sent";
  h.clock.t = new Date("2026-11-18T12:01:05.000Z");
  const counts = await h.service.sweep();
  eq(counts.delivery_delivered, 1, "sweep delivers via email after the view");
  ok(!!(await jobOf(h)).delivered_at, "delivered_at set by real delivery only");
});

// ---------------------------------------------------------------------
// 14) سلة مختلطة: اكتمال التحقق ما يعلّمش الطلب كله fulfilled
// ---------------------------------------------------------------------
Deno.test("mixed cart: completion does not fulfil the whole order", async () => {
  const order = makeOrder({
    items: [
      { sku: STUDENT_SKU, qty: 1, price_egp: 280 },
      { sku: "منتج تاني", qty: 1, price_egp: 100 },
    ],
    server_total_egp: 380,
  });
  const h = harness(order);
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/mix" },
  ];
  const s = await h.service.submit(order, VALID_URL);
  eq(s.state, "completed", "verification completed");
  eq(h.store.orders.get("MG-200001")?.status, "paid", "order status untouched for mixed cart");
});

// ---------------------------------------------------------------------
// 15) ممنوع خطف تنفيذ مش بتاعنا عند الاسترداد
// ---------------------------------------------------------------------
Deno.test("refund never hijacks a foreign execution row", async () => {
  const h = harness(makeOrder());
  await h.store.claimExecution({
    order_ref: "MG-200001",
    sku: STUDENT_SKU,
    product_key: "google-student",
    supplier_key: "bunny",
    listing_ref: "x",
    reference: "",
    sell_egp: 280,
    quantity: 1,
  });
  h.fake.statusQueue = [{ status: "failed" }];
  await h.service.submit(makeOrder(), VALID_URL);
  eq(h.store.refundObligations.length, 0, "no obligation created");
  ok(
    h.adminNotes.some((t) => t.includes("لسه مش مؤكد")),
    "admin alerted that refund is unconfirmed",
  );
});

// ---------------------------------------------------------------------
// 16) المعالج: مصادقة العميل + الإشعار + حماية المسح
// ---------------------------------------------------------------------
function req(body: unknown, path: string, headers: Record<string, string> = {}) {
  return new Request(`https://deno.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

Deno.test("handler: ownership proof, invalid link, callback 200, sweep auth", async () => {
  const h = harness(makeOrder());
  const deps = {
    service: h.service,
    orders: h.orders,
    isAuthorized: (r: Request) => r.headers.get("x-migo-admin") === "adm",
  };
  // حساب مرسل غلط = مش موجود (نفس سلوك get_invoice).
  let res = await handleSheeridRequest(
    req({ order_ref: "MG-200001", sender_account: "999" }, "/sheerid/status"),
    deps,
  );
  eq((await res!.json()).found, false, "wrong sender → found:false");
  // الحالة الصح: إرشاد مستني الرابط (وبيفتح العملية).
  res = await handleSheeridRequest(
    req({ order_ref: "MG-200001", sender_account: "01000000000" }, "/sheerid/status"),
    deps,
  );
  let body = await res!.json();
  eq(body.state, "awaiting_link", "status opens job with guidance");
  ok(!!(await h.repo.findForOrder("MG-200001")), "job opened by status view");
  // رابط غلط عبر المعالج:
  res = await handleSheeridRequest(
    req(
      { order_ref: "MG-200001", sender_account: "01000000000", url: "https://evil.example/verify/x" },
      "/sheerid/submit",
    ),
    deps,
  );
  body = await res!.json();
  eq(body.state, "invalid_link", "invalid link state via handler");
  eq(h.fake.calls.length, 0, "still zero provider calls");
  // الإشعار: دايمًا 200 حتى بمعرّف مجهول.
  res = await handleSheeridRequest(req({ job_id: "JOB-UNKNOWN" }, "/sheerid/callback"), deps);
  eq(res!.status, 200, "callback always 200");
  eq((await res!.json()).ok, true, "callback ok");
  // المسح من غير صلاحية = 401، وبصلاحية = عدّادات.
  res = await handleSheeridRequest(req({}, "/sheerid/sweep"), deps);
  eq(res!.status, 401, "sweep requires admin");
  res = await handleSheeridRequest(req({}, "/sheerid/sweep", { "x-migo-admin": "adm" }), deps);
  body = await res!.json();
  eq(body.ok, true, "sweep ok with admin header");
});

// ---------------------------------------------------------------------
// 17) تدقيق العلامة البيضاء: لا بصمة مورد في أي سطح عميل
// ---------------------------------------------------------------------
Deno.test("white-label audit: no provider fingerprint in any customer surface", async () => {
  const h = harness(makeOrder());
  const surfaces: string[] = [];
  const s0 = await h.service.stateForOrder(makeOrder());
  surfaces.push(s0!.message);
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/wl" },
  ];
  const s1 = await h.service.submit(makeOrder(), VALID_URL);
  surfaces.push(s1.message);
  const s2 = await h.service.stateForOrder(makeOrder());
  surfaces.push(s2!.message);
  const h2 = harness(makeOrder());
  h2.fake.statusQueue = [{ status: "refunded" }];
  const s3 = await h2.service.submit(makeOrder(), VALID_URL);
  surfaces.push(s3.message);
  const joined = surfaces.join("\n");
  for (
    const banned of [
      "bunny", "Bunny", "BNY", "JOB-TEST", "charged", "USD", "$",
      "bunnytoolsbot", "محفظة المورد",
    ]
  ) {
    ok(!joined.includes(banned), `customer surface must not contain: ${banned}`);
  }
});

// ---------------------------------------------------------------------
// 18) طلب لسه مش مدفوع: مفيش عملية بتتفتح
// ---------------------------------------------------------------------
Deno.test("unpaid order: awaiting_payment state and no job created", async () => {
  const order = makeOrder({ status: "new" });
  const h = harness(order);
  const s = await h.service.stateForOrder(order);
  eq(s?.state, "awaiting_payment", "awaiting payment");
  eq(await h.repo.findForOrder("MG-200001"), null, "no job for unpaid order");
});

// ---------------------------------------------------------------------
// 19) وضع الجسر: العميل بينادي نقطة البوت الداخلية بالأفعال والتوكن
// ---------------------------------------------------------------------
class FakeBridge {
  calls: TransportRequest[] = [];
  rejectAction = "";
  unauthorized = false;

  transport: Transport = (req) => {
    this.calls.push(req);
    if (this.unauthorized) {
      return Promise.resolve({
        status: 401,
        text: JSON.stringify({ ok: false, error: "unauthorized" }),
      });
    }
    const body = JSON.parse(req.body || "{}") as Record<string, unknown>;
    if (body["action"] === this.rejectAction) {
      return Promise.resolve({
        status: 200,
        text: JSON.stringify({ ok: false, message: "bridge refusal" }),
      });
    }
    const dataByAction: Record<string, Record<string, unknown>> = {
      balance: { service_available: true, possible_verifications: 9 },
      verify: { job_id: "JOB-TEST-9", status: "processing", charged_usd: 1.99 },
      status: {
        status: "completed",
        activation_url: "https://example.com/activate/9",
      },
    };
    return Promise.resolve({
      status: 200,
      text: JSON.stringify({ ok: true, data: dataByAction[String(body["action"])] || {} }),
    });
  };
}

Deno.test("bridge client: actions + token header + envelope, no provider key", async () => {
  const fake = new FakeBridge();
  const client = new SheerIDClient({
    apiKey: "",
    baseUrl: TEST_BRIDGE_URL,
    bridgeToken: "tok-bridge-1",
    transport: fake.transport,
  });
  ok(client.hasKey, "bridge token counts as configured");
  ok(client.viaBridge, "bridge mode on");

  const bal = await client.balance();
  eq(bal["possible_verifications"], 9, "balance data via bridge");
  const ver = await client.verify(VALID_URL, "https://hook.example/cb");
  eq(ver["job_id"], "JOB-TEST-9", "verify data via bridge");
  const st = await client.status("JOB-TEST-9");
  eq(st["status"], "completed", "status data via bridge");

  eq(fake.calls.length, 3, "three bridge calls");
  for (const call of fake.calls) {
    eq(call.url, TEST_BRIDGE_URL + BRIDGE_PATH, "bridge endpoint url");
    eq(call.method, "POST", "bridge method");
    eq(call.headers["x-bridge-token"], "tok-bridge-1", "bridge token header");
    ok(!("X-API-Key" in call.headers), "no provider key header via bridge");
  }
  eq(JSON.parse(fake.calls[0].body!), { action: "balance" }, "balance body");
  eq(
    JSON.parse(fake.calls[1].body!),
    { action: "verify", url: VALID_URL, webhook_url: "https://hook.example/cb" },
    "verify body",
  );
  eq(
    JSON.parse(fake.calls[2].body!),
    { action: "status", job_id: "JOB-TEST-9" },
    "status body",
  );
});

Deno.test("bridge client: rejection envelope and 401 both raise SheerIDError", async () => {
  const fake = new FakeBridge();
  fake.rejectAction = "verify";
  const client = new SheerIDClient({
    apiKey: "",
    baseUrl: TEST_BRIDGE_URL,
    bridgeToken: "tok-bridge-1",
    transport: fake.transport,
  });
  let threw = false;
  try {
    await client.verify(VALID_URL);
  } catch (e) {
    threw = e instanceof SheerIDError;
  }
  ok(threw, "ok:false envelope raises SheerIDError");

  fake.unauthorized = true;
  threw = false;
  try {
    await client.balance();
  } catch (e) {
    threw = e instanceof SheerIDError;
  }
  ok(threw, "bridge 401 raises SheerIDError");
});

Deno.test("bridge client: no token and no key → disabled, zero transport calls", async () => {
  let calls = 0;
  const exploding: Transport = () => {
    calls++;
    return Promise.resolve({ status: 500, text: "{}" });
  };
  const client = new SheerIDClient({
    apiKey: "",
    baseUrl: TEST_BRIDGE_URL,
    bridgeToken: "",
    transport: exploding,
  });
  ok(!client.hasKey, "unconfigured without token");
  let threw = false;
  try {
    await client.balance();
  } catch (e) {
    threw = e instanceof SheerIDError;
  }
  ok(threw, "balance refuses when unconfigured");
  eq(calls, 0, "zero transport calls when unconfigured");
});

// ---------------------------------------------------------------------
// 20) توصيل الجسر: التوكن من backend_config، والغياب = مقفول
// ---------------------------------------------------------------------
function envOf(map: Record<string, string>) {
  return (n: string) => map[n];
}

Deno.test("bridge wiring: token row in backend_config enables the service", async () => {
  const seen: string[] = [];
  const transport: Transport = (req) => {
    seen.push(req.url);
    if (req.url.includes("/rest/v1/backend_config")) {
      eq(req.headers["Authorization"], "Bearer svc-test", "service role auth");
      return Promise.resolve({
        status: 200,
        text: JSON.stringify([{ value: "tok-from-db" }]),
      });
    }
    return Promise.resolve({ status: 404, text: "{}" });
  };
  const wiring = await buildSheeridFromEnvAsync({
    env: envOf({
      SUPABASE_SERVICE_ROLE_KEY: "svc-test",
      SHEERID_BRIDGE_URL: TEST_BRIDGE_URL,
    }),
    sbUrl: "https://db.invalid",
    logError: () => {},
    transport,
  });
  ok(wiring.service.enabled(), "enabled with token from backend_config");
  eq(seen.length, 1, "exactly one config read at build");
});

Deno.test("bridge wiring: missing token row keeps the service disabled", async () => {
  const transport: Transport = (req) => {
    if (req.url.includes("/rest/v1/backend_config")) {
      return Promise.resolve({ status: 200, text: "[]" });
    }
    return Promise.resolve({ status: 404, text: "{}" });
  };
  const wiring = await buildSheeridFromEnvAsync({
    env: envOf({ SUPABASE_SERVICE_ROLE_KEY: "svc-test" }),
    sbUrl: "https://db.invalid",
    logError: () => {},
    transport,
  });
  ok(!wiring.service.enabled(), "disabled without token row (fail-closed)");
});

Deno.test("bridge wiring: SHEERID_API_KEY env override stays direct, no config read", async () => {
  let calls = 0;
  const transport: Transport = () => {
    calls++;
    return Promise.resolve({ status: 500, text: "{}" });
  };
  const wiring = await buildSheeridFromEnvAsync({
    env: envOf({
      SHEERID_API_KEY: "direct-key",
      SHEERID_BASE_URL: "https://provider.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "svc-test",
    }),
    sbUrl: "https://db.invalid",
    logError: () => {},
    transport,
  });
  ok(wiring.service.enabled(), "enabled with direct env key");
  eq(calls, 0, "no backend_config read in direct mode");
});

Deno.test("fetchBridgeToken: read failure is fail-safe empty", async () => {
  const down: Transport = () =>
    Promise.resolve({ status: 500, text: "boom" });
  const token = await fetchBridgeToken({
    sbUrl: "https://db.invalid",
    keyOf: () => "svc-test",
    transport: down,
  });
  eq(token, "", "empty token on read failure");
  const noKey = await fetchBridgeToken({
    sbUrl: "https://db.invalid",
    keyOf: () => "",
    transport: down,
  });
  eq(noKey, "", "empty token without service key");
});

// ---------------------------------------------------------------------
// 21) إصلاحات اللجنة — (أ) إرسال لطلب غير مدفوع: رفض فوري، صفر نداءات
// ---------------------------------------------------------------------
Deno.test("panel fix 1a: unpaid submit → awaiting_payment, ZERO provider calls, no job", async () => {
  const order = makeOrder({ status: "new" });
  const h = harness(order);
  const s = await h.service.submit(order, VALID_URL);
  eq(s.state, "awaiting_payment", "unpaid submit state");
  eq(h.fake.calls.length, 0, "zero provider calls for unpaid submit");
  eq(await h.repo.findForOrder("MG-200001"), null, "no job opened for unpaid order");
  // وحتى فتح العملية مباشرة من مسار عميل بيترفض لطلب غير مدفوع:
  let threw = false;
  try {
    await h.service.expectLink(order);
  } catch (e) {
    threw = e instanceof SheerIDError;
  }
  ok(threw, "expectLink refuses an unpaid order");
  eq(await h.repo.findForOrder("MG-200001"), null, "still no job after expectLink attempt");
});

// ---------------------------------------------------------------------
// 22) إصلاحات اللجنة — (و) اكتمال عند المورد لطلب غير مدفوع ≠ fulfilled
// ---------------------------------------------------------------------
Deno.test("panel fix 1f: settleCompleted on unpaid order → completed job, order NOT fulfilled", async () => {
  const order = makeOrder({ status: "new" });
  const h = harness(order);
  const job = await h.repo.createJob({
    order_ref: "MG-200001",
    customer_email: "student@example.com",
    status: "processing",
  });
  await h.repo.updateJob(job.id, { job_id: "JOB-TEST-1" });
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/unpaid" },
  ];
  const settled = await h.service.refresh("JOB-TEST-1");
  eq(settled?.status, "completed", "job settles completed (provider fact recorded)");
  eq(
    h.store.orders.get("MG-200001")?.status,
    "new",
    "unpaid order is NOT marked fulfilled",
  );
  ok(
    h.adminNotes.some((t) => t.includes("غير مؤكد الدفع")),
    "admin alerted about completion on unpaid order",
  );
});

// ---------------------------------------------------------------------
// 23) إصلاحات اللجنة — (ب) إرسالان متزامنان: تحقق واحد بس عند المورد
// ---------------------------------------------------------------------
Deno.test("panel fix 2b: two concurrent submits → exactly ONE verify call", async () => {
  const h = harness(makeOrder());
  const [s1, s2] = await Promise.all([
    h.service.submit(makeOrder(), VALID_URL),
    h.service.submit(makeOrder(), VALID_URL),
  ]);
  eq(h.fake.count("/verify"), 1, "exactly one provider verify under concurrency");
  eq(s1.state, "processing", "first caller sees processing");
  eq(s2.state, "processing", "race loser backs off to processing state");
  const job = await jobOf(h);
  eq(job.status, "processing", "single job processing");
  eq(job.job_id, "JOB-TEST-1", "single provider job id stored");
});

// ---------------------------------------------------------------------
// 24) إصلاحات اللجنة — (ج) فشل الاسترداد: نص صادق + refund_pending
// ---------------------------------------------------------------------
Deno.test("panel fix 3c: refund failure → no false refund claim, job refund_pending, sweep recovers", async () => {
  const h = harness(makeOrder());
  // منفذ طلبات استرداده بيرجع false لحد ما نقلب العلم (محاكاة عطل
  // في مسار الاسترداد) — باقي سلوكه هو منفذ الذاكرة الحقيقي.
  let refundWorks = false;
  const flakyOrders: OrderPort = {
    getOrder: (r) => h.orders.getOrder(r),
    setOrderStatus: (r, s) => h.orders.setOrderStatus(r, s),
    listConfirmedOrders: (n) => h.orders.listConfirmedOrders(n),
    refundOnFailure: (o, reason) =>
      refundWorks
        ? h.orders.refundOnFailure(o, reason)
        : Promise.resolve(false),
  };
  const service = new SheeridService({
    repo: h.repo,
    client: new SheerIDClient({
      apiKey: "test-key",
      baseUrl: "https://provider.invalid",
      transport: h.fake.transport,
    }),
    orders: flakyOrders,
    sendEmail: ({ order: o, kind }) => {
      h.emails.push({ kind, order_ref: o.order_ref });
      return Promise.resolve(h.emailOutcome);
    },
    alertAdmin: (t) => h.adminNotes.push(t),
    log: () => {},
    sleeper: () => Promise.resolve(),
    now: () => new Date(h.clock.t),
    paidStatuses: ["paid", "payment_confirmed"],
  });
  h.fake.statusQueue = [{ status: "failed" }];
  const s = await service.submit(makeOrder(), VALID_URL);
  eq(s.state, "failed", "customer sees failed state");
  ok(
    !s.message.includes("تمت معالجة استرداد كامل"),
    "customer text does NOT claim a completed refund",
  );
  ok(s.message.includes("جارٍ معالجة الاسترداد"), "honest pending wording");
  let job = await jobOf(h);
  eq(job.status, "refund_pending", "job parked refund_pending — NOT terminal");
  eq(h.store.refundObligations.length, 0, "no obligation while refund unconfirmed");
  ok(
    h.emails.some((e) => e.kind === "refund_pending"),
    "pending-refund email sent (honest kind)",
  );
  ok(
    !h.emails.some((e) => e.kind === "failed"),
    "no refund-claiming failure email yet",
  );
  // المسح قبل فاصل إعادة المحاولة (300 ثانية) ما يعيدش المحاولة:
  await service.sweep();
  eq((await jobOf(h)).status, "refund_pending", "still pending inside retry gap");
  // بعد الفاصل والاسترداد اشتغل: المسح بيقفل العملية نهائيًا.
  refundWorks = true;
  h.clock.t = new Date("2026-11-18T12:06:00.000Z");
  const counts = await service.sweep();
  eq(counts.refund_recovered, 1, "sweep recovered the pending refund");
  job = await jobOf(h);
  eq(job.status, "failed", "job terminal after recovery");
  eq(h.store.refundObligations.length, 1, "obligation created on recovery");
  eq(h.store.orders.get("MG-200001")?.status, "refunded", "order refunded on recovery");
  ok(
    h.emails.some((e) => e.kind === "failed"),
    "confirmed failure email sent only after recovery",
  );
});

// ---------------------------------------------------------------------
// 25) إصلاحات اللجنة — (د) خطأ مورد بنص ملوّن: العميل ما يشوفش منه حرف
// ---------------------------------------------------------------------
Deno.test("panel fix 4d: provider error text never reaches the customer", async () => {
  // مستوى العميل: رسالة المورد الخام بتتحفظ في detail بس.
  const leaky: Transport = () =>
    Promise.resolve({
      status: 200,
      text: JSON.stringify({
        ok: false,
        message: "BunnyTools wallet empty BNY-777 balance 0.30 USD",
      }),
    });
  const client = new SheerIDClient({
    apiKey: "test-key",
    baseUrl: "https://provider.invalid",
    transport: leaky,
  });
  let err: unknown = null;
  try {
    await client.verify(VALID_URL);
  } catch (e) {
    err = e;
  }
  ok(err instanceof SheerIDError, "provider rejection raises SheerIDError");
  const se = err as SheerIDError;
  ok(!se.message.includes("Bunny"), "error message has no supplier name");
  ok(!se.message.includes("BNY"), "error message has no provider job id");
  ok(!se.message.includes("balance"), "error message has no balance wording");
  ok(!se.customerSafe, "provider errors are not customer-safe");
  ok(se.detail.includes("BunnyTools"), "raw provider text kept server-side (detail)");

  // مستوى المعالج: خطأ مورد بيهرب من الخدمة → رد عام ثابت للعميل.
  const h = harness(makeOrder());
  const stubService = {
    enabled: () => true,
    stateForOrder: () => Promise.resolve(null),
    submit: () =>
      Promise.reject(
        new SheerIDError("خدمة التحقق رفضت الطلب", {
          detail: "BunnyTools wallet empty BNY-777",
        }),
      ),
    refresh: () => Promise.resolve(null),
    sweep: () => Promise.resolve({}),
  } as unknown as SheeridService;
  const res = await handleSheeridRequest(
    req(
      { order_ref: "MG-200001", sender_account: "01000000000", url: VALID_URL },
      "/sheerid/submit",
    ),
    { service: stubService, orders: h.orders, isAuthorized: () => false },
  );
  const body = await res!.json();
  eq(body.state, "manual_fallback", "sanitized failure → generic manual state");
  ok(!String(body.message).includes("Bunny"), "handler response has no supplier name");
  ok(!String(body.message).includes("BNY"), "handler response has no provider job id");
});

// ---------------------------------------------------------------------
// 26) إصلاحات اللجنة — (هـ) سر الـ callback + حدود المعدل على المسارات
// ---------------------------------------------------------------------
Deno.test("panel fix 5e: callback secret enforced when configured; per-route rate limits trip", async () => {
  const h = harness(makeOrder());
  await h.service.submit(makeOrder(), VALID_URL); // عملية processing بـ JOB-TEST-1
  const statusCallsBefore = h.fake.count("/status/");
  const deps = {
    service: h.service,
    orders: h.orders,
    isAuthorized: () => false,
    callbackSecret: "cb-secret-1",
    rateLimiter: new SheeridRateLimiter({
      statusPerMinute: 100,
      submitPerMinute: 100,
      callbackPerMinute: 2,
    }),
  };
  // من غير ترويسة السر: مرفوض 401 ومفيش أي سؤال حالة عند المورد.
  let res = await handleSheeridRequest(
    req({ job_id: "JOB-TEST-1" }, "/sheerid/callback"),
    deps,
  );
  eq(res!.status, 401, "callback without secret header rejected");
  eq(h.fake.count("/status/"), statusCallsBefore, "no refresh on rejected callback");
  // بالترويسة الصح: 200 والتسوية بتحصل.
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/cb" },
  ];
  res = await handleSheeridRequest(
    req({ job_id: "JOB-TEST-1" }, "/sheerid/callback", {
      "x-sheerid-callback-secret": "cb-secret-1",
    }),
    deps,
  );
  eq(res!.status, 200, "callback with secret accepted");
  eq((await jobOf(h)).status, "completed", "accepted callback settled the job");
  // حد المعدل (2/دقيقة للـ callback): النداء التالت بيترفض 429.
  res = await handleSheeridRequest(
    req({ job_id: "JOB-TEST-1" }, "/sheerid/callback", {
      "x-sheerid-callback-secret": "cb-secret-1",
    }),
    deps,
  );
  eq(res!.status, 429, "third callback in the minute is rate-limited");

  // حد معدل الإرسال: أول محاولة تعدّي والتانية 429.
  const h2 = harness(makeOrder());
  const deps2 = {
    service: h2.service,
    orders: h2.orders,
    isAuthorized: () => false,
    rateLimiter: new SheeridRateLimiter({
      statusPerMinute: 100,
      submitPerMinute: 1,
      callbackPerMinute: 100,
    }),
  };
  res = await handleSheeridRequest(
    req(
      { order_ref: "MG-200001", sender_account: "01000000000", url: "https://evil.example/verify/x" },
      "/sheerid/submit",
    ),
    deps2,
  );
  eq((await res!.json()).state, "invalid_link", "first submit passes the limiter");
  res = await handleSheeridRequest(
    req(
      { order_ref: "MG-200001", sender_account: "01000000000", url: "https://evil.example/verify/x" },
      "/sheerid/submit",
    ),
    deps2,
  );
  eq(res!.status, 429, "second submit in the minute is rate-limited");
});

// ---------------------------------------------------------------------
// 27) إصلاحات اللجنة — عملية جارية أقدم من 24 ساعة: مسار يدوي + تنبيه
// ---------------------------------------------------------------------
Deno.test("panel fix 9b: in-flight job older than 24h → manual_fallback + admin alert", async () => {
  const h = harness(makeOrder());
  await h.service.submit(makeOrder(), VALID_URL);
  eq((await jobOf(h)).status, "processing", "processing before aging");
  h.clock.t = new Date("2026-11-19T12:00:01.000Z"); // +24 ساعة وثانية
  const counts = await h.service.sweep();
  eq(counts.stuck, 1, "one stuck job flagged");
  const job = await jobOf(h);
  eq(job.manual_fallback, true, "stuck job flagged manual_fallback");
  ok(
    h.adminNotes.some((t) => t.includes("عالقة")),
    "admin alerted about the stuck job",
  );
  const view = await h.service.stateForOrder(makeOrder());
  eq(
    view?.state,
    "manual_fallback",
    "customer sees manual fallback instead of eternal processing",
  );
  // مسح تاني: العملية متعلّمة أصلًا فمفيش تنبيه ولا عدّ مكرر.
  const alertsBefore = h.adminNotes.length;
  const counts2 = await h.service.sweep();
  eq(counts2.stuck, 0, "already-flagged job is not re-flagged");
  eq(h.adminNotes.length, alertsBefore, "no duplicate stuck alert");
});

// ---------------------------------------------------------------------
// 28) تقوية اللجنة (الحزمة التانية) — رابط التفعيل: المورد موثوق
//     وصيغه بتتغيّر، فأي http/https بيتسلّم زي ما هو على أي نطاق؛
//     الحظر الوحيد لمخططات غير الويب. التحقق تحليل نصي خالص —
//     ممنوع فتح/جلب الرابط أبدًا (قاعدة المالك: الرابط بيتلف لو
//     اتفتح على جهاز تاني قبل ما يوصل للعميل).
// ---------------------------------------------------------------------
Deno.test("panel hardening C: provider https link on an UNLISTED host with ref/query → delivered UNCHANGED", async () => {
  const h = harness(makeOrder());
  const link =
    "https://delivery.provider-x.net/activate/abc123?ref=ORD-9917&sig=zz9&utm=x";
  h.fake.statusQueue = [{ status: "completed", activation_url: link }];
  const state = await h.service.submit(makeOrder(), VALID_URL);
  eq(state.state, "completed", "completed with unlisted-host link");
  eq(state.activation_url, link, "link delivered byte-identical (no allowlist, no rewrite)");
  const job = await jobOf(h);
  eq(job.status, "completed", "job completed");
  eq(job.activation_url, link, "link stored byte-identical");
  ok(!!job.delivered_at, "delivered via email");
  eq(h.emails.filter((e) => e.kind === "completed").length, 1, "one completion email");
  eq(h.store.orders.get("MG-200001")?.status, "fulfilled", "order fulfilled");
  // http برضه بيعدّي زي ما هو (تصحيح المالك: أي http/https):
  const h2 = harness(makeOrder());
  const httpLink = "http://links.supplier-y.org/get/42?t=1";
  h2.fake.statusQueue = [{ status: "completed", activation_url: httpLink }];
  const s2 = await h2.service.submit(makeOrder(), VALID_URL);
  eq(s2.state, "completed", "http link completes too");
  eq(s2.activation_url, httpLink, "http link delivered unchanged");
});

Deno.test("panel hardening C: javascript: activation link → blocked, manual_fallback, never stored or delivered", async () => {
  const h = harness(makeOrder());
  h.fake.statusQueue = [
    { status: "completed", activation_url: "javascript:alert(1)" },
    { status: "completed", activation_url: "javascript:alert(1)" },
  ];
  const state = await h.service.submit(makeOrder(), VALID_URL);
  eq(state.state, "manual_fallback", "customer gets manual-fallback state, not the link");
  eq(state.activation_url, undefined, "no activation_url in customer state");
  const job = await jobOf(h);
  eq(job.status, "processing", "job NOT completed with a poisoned link");
  eq(job.manual_fallback, true, "job flagged manual_fallback");
  ok(!job.activation_url, "poisoned link never stored on the job");
  eq(job.delivered_at, null, "nothing delivered");
  eq(h.emails.filter((e) => e.kind === "completed").length, 0, "no completion email");
  ok(h.emails.some((e) => e.kind === "fallback"), "fallback email sent");
  eq(h.store.orders.get("MG-200001")?.status, "paid", "order NOT fulfilled");
  ok(
    !h.adminNotes.join("\n").includes("alert(1)"),
    "admin alert carries no raw link payload (host only / none)",
  );
  const alertsAfterSubmit = h.adminNotes.length;
  ok(alertsAfterSubmit > 0, "admin alerted once");
  // تسوية متكررة بنفس الرابط المسموم: مفيش تنبيه مكرر ولا اكتمال.
  await h.service.refresh("JOB-TEST-1");
  eq(h.adminNotes.length, alertsAfterSubmit, "no duplicate admin alert on re-settle");
  eq((await jobOf(h)).status, "processing", "still not completed");
  const view = await h.service.stateForOrder(makeOrder());
  eq(view?.state, "manual_fallback", "invoice view shows manual fallback");
});

Deno.test("panel hardening C: validateActivationUrl — scheme gate only, pure parsing", () => {
  // أي http/https على أي نطاق/مسار/باراميترات بيعدّي:
  for (
    const good of [
      "https://services.sheerid.com/verify/x",
      "https://activate.example/xyz",
      "https://anything.unknown.tld/a/b?c=d&e=f",
      "http://plain-http.example/link",
    ]
  ) {
    eq(validateActivationUrl(good).ok, true, `passes: ${good}`);
  }
  eq(
    validateActivationUrl("https://delivery.provider-x.net/a?ref=1").host,
    "delivery.provider-x.net",
    "host extracted for server logs",
  );
  // مخططات غير الويب + كلام مش روابط = محظور:
  for (
    const bad of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://files.example/x",
      "مش رابط أصلًا",
      "",
    ]
  ) {
    eq(validateActivationUrl(bad).ok, false, `blocked: ${bad.slice(0, 24)}`);
  }
});
