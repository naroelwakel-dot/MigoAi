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
  type SheeridJob,
} from "./repo.ts";
import {
  findVerifyUrl,
  SheeridService,
  validateVerifyUrl,
  type EmailOutcome,
} from "./service.ts";
import { handleSheeridRequest } from "./mod.ts";
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
// 13) مشاهدة العميل للنتيجة في صفحة الفاتورة = تسليم مؤكد
// ---------------------------------------------------------------------
Deno.test("customer viewing the completed invoice state marks delivery", async () => {
  const h = harness(makeOrder());
  h.emailOutcome = "failed";
  h.fake.statusQueue = [
    { status: "completed", activation_url: "https://activate.example/view" },
  ];
  await h.service.submit(makeOrder(), VALID_URL);
  eq((await jobOf(h)).delivered_at, null, "undelivered before view");
  const view = await h.service.stateForOrder(makeOrder());
  eq(view?.state, "completed", "view shows completed");
  ok(!!(await jobOf(h)).delivered_at, "view marked delivered_at");
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
