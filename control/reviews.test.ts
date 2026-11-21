/**
 * اختبارات إدارة تقييمات اللوحة — `deno test control/reviews.test.ts`
 * عميل قاعدة وهمي في الذاكرة + اختبار عميل PostgREST الحقيقي
 * بـ fetch مثبّت. التغطية: بوابة الأدمن قبل أي نداء، فلتر الحالة
 * (افتراضي pending وقيمة غلط = 400)، شكل القائمة مع إيميل العميل
 * المحلول من الطلب وغيابه = null، وتحقق القرار: جسم/معرّف/قرار
 * غلط = 400، تقييم مش موجود = 404، والنجاح بيكتب الحالة ووقت
 * الإدارة من الساعة المحقونة.
 */
import {
  type ControlReviewsClient,
  type ControlReviewsDeps,
  handleControlReviewsRequest,
  parseReviewId,
  PostgrestReviewsClient,
  type ReviewRow,
} from "./reviews.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const NOW = "2026-11-21T10:00:00.000Z";

function row(partial: Partial<ReviewRow>): ReviewRow {
  return {
    id: 1,
    order_ref: "MG-100001",
    display_name: "عميل",
    rating: 5,
    body: "خدمة ممتازة",
    product_label: "منتج",
    status: "pending",
    created_at: "2026-11-20T09:00:00.000Z",
    moderated_at: null,
    ...partial,
  };
}

class FakeReviewsClient implements ControlReviewsClient {
  rows = new Map<string, ReviewRow>();
  emails = new Map<string, string>();
  listCalls: { status: string | null; limit: number }[] = [];
  statusCalls: { id: string; decision: string; at: string }[] = [];

  listReviews(status: string | null, limit: number): Promise<ReviewRow[]> {
    this.listCalls.push({ status, limit });
    const all = [...this.rows.values()]
      .filter((r) => !status || r.status === status)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return Promise.resolve(all.slice(0, limit));
  }
  getReview(id: string): Promise<ReviewRow | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  setReviewStatus(
    id: string,
    decision: string,
    moderatedAtIso: string,
  ): Promise<ReviewRow | null> {
    const r = this.rows.get(id);
    if (!r) return Promise.resolve(null);
    this.statusCalls.push({ id, decision, at: moderatedAtIso });
    r.status = decision;
    r.moderated_at = moderatedAtIso;
    return Promise.resolve(r);
  }
  orderEmails(orderRefs: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const ref of orderRefs) {
      const e = this.emails.get(ref);
      if (e) out.set(ref, e);
    }
    return Promise.resolve(out);
  }
}

function makeDeps() {
  const client = new FakeReviewsClient();
  client.rows.set("1", row({ id: 1 }));
  client.rows.set("2", row({
    id: 2,
    order_ref: "MG-100002",
    display_name: "عميلة",
    rating: 4,
    body: "كويس",
    status: "approved",
    created_at: "2026-11-19T09:00:00.000Z",
    moderated_at: "2026-11-19T10:00:00.000Z",
  }));
  client.rows.set("3", row({
    id: 3,
    order_ref: "MG-100003",
    status: "rejected",
    created_at: "2026-11-18T09:00:00.000Z",
  }));
  client.emails.set("MG-100001", "first@example.com");
  const deps: ControlReviewsDeps = {
    client,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
    nowIso: () => NOW,
  };
  return { deps, client };
}

function req(
  path: string,
  method = "GET",
  body?: unknown,
  admin = true,
): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: {
      ...(admin ? { "x-migo-admin": ADMIN_KEY } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

Deno.test("مسارات غريبة بترجع null", async () => {
  const { deps } = makeDeps();
  eq(await handleControlReviewsRequest(req("/control/home"), deps), null, "home");
  eq(await handleControlReviewsRequest(req("/control/reviews-x"), deps), null, "suffix-x");
  eq(await handleControlReviewsRequest(req("/control/store-reviews"), deps), null, "store-reviews");
});

Deno.test("القائمة: بوابة الأدمن والافتراضي pending", async () => {
  const { deps, client } = makeDeps();
  const denied = await handleControlReviewsRequest(
    req("/control/reviews", "GET", undefined, false), deps);
  eq(denied?.status, 401, "no admin = 401");
  eq(client.listCalls.length, 0, "no db call behind the gate");

  const res = await handleControlReviewsRequest(req("/control/reviews"), deps);
  eq(res?.status, 200, "status");
  eq(client.listCalls[0].status, "pending", "default filter is pending");
  const body = await bodyOf(res);
  eq(body.status, "pending", "echoed filter");
  const reviews = body.reviews as Record<string, unknown>[];
  eq(reviews.length, 1, "only the pending row");
  eq(reviews[0].id, 1, "row id");
  eq(reviews[0].customer_email, "first@example.com", "email resolved from order");
});

Deno.test("القائمة: فلاتر الحالة و all وقيمة غلط", async () => {
  const { deps, client } = makeDeps();
  let res = await handleControlReviewsRequest(
    req("/control/reviews?status=approved"), deps);
  let body = await bodyOf(res);
  eq((body.reviews as unknown[]).length, 1, "approved count");
  eq(client.listCalls[0].status, "approved", "approved passed through");

  res = await handleControlReviewsRequest(
    req("/control/reviews?status=all"), deps);
  body = await bodyOf(res);
  eq((body.reviews as unknown[]).length, 3, "all count");
  eq(client.listCalls[1].status, null, "all = no filter");
  const all = body.reviews as Record<string, unknown>[];
  eq(all[0].id, 1, "newest first");
  eq(all[1].customer_email, null, "unknown order email stays null");

  res = await handleControlReviewsRequest(
    req("/control/reviews?status=maybe"), deps);
  eq(res?.status, 400, "bad status = 400");
  eq((await bodyOf(res)).error, "invalid_status", "bad status error");
});

Deno.test("القائمة: طريقة غلط = 405", async () => {
  const { deps } = makeDeps();
  const res = await handleControlReviewsRequest(
    req("/control/reviews", "POST", {}), deps);
  eq(res?.status, 405, "POST on list = 405");
});

Deno.test("القرار: تحقق الجسم والمعرّف والقرار", async () => {
  const { deps, client } = makeDeps();
  const bad: [unknown, string][] = [
    [{ decision: "approved" }, "invalid_id"],
    [{ id: 0, decision: "approved" }, "invalid_id"],
    [{ id: -3, decision: "approved" }, "invalid_id"],
    [{ id: "abc", decision: "approved" }, "invalid_id"],
    [{ id: 1.5, decision: "approved" }, "invalid_id"],
    [{ id: 1 }, "invalid_decision"],
    [{ id: 1, decision: "pending" }, "invalid_decision"],
    [{ id: 1, decision: "maybe" }, "invalid_decision"],
    [{ id: 1, decision: 5 }, "invalid_decision"],
  ];
  for (const [b, err] of bad) {
    const res = await handleControlReviewsRequest(
      req("/control/reviews-decision", "POST", b), deps);
    eq(res?.status, 400, `400 for ${JSON.stringify(b)}`);
    eq((await bodyOf(res)).error, err, `error for ${JSON.stringify(b)}`);
  }
  const arrReq = new Request("https://api.example/control/reviews-decision", {
    method: "POST",
    headers: { "x-migo-admin": ADMIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify([1]),
  });
  const arrRes = await handleControlReviewsRequest(arrReq, deps);
  eq(arrRes?.status, 400, "array body = 400");
  eq((await bodyOf(arrRes)).error, "bad_body", "array body error");
  eq(client.statusCalls.length, 0, "no write on invalid input");
});

Deno.test("القرار: بوابة الأدمن وتقييم مش موجود = 404", async () => {
  const { deps, client } = makeDeps();
  const denied = await handleControlReviewsRequest(
    req("/control/reviews-decision", "POST",
      { id: 1, decision: "approved" }, false), deps);
  eq(denied?.status, 401, "no admin = 401");
  eq(client.statusCalls.length, 0, "no write behind the gate");

  const res = await handleControlReviewsRequest(
    req("/control/reviews-decision", "POST",
      { id: 999, decision: "approved" }), deps);
  eq(res?.status, 404, "missing review = 404");
  eq((await bodyOf(res)).error, "review_not_found", "404 error");
  eq(client.statusCalls.length, 0, "no write for missing review");
});

Deno.test("القرار: موافقة ورفض بيكتبوا الحالة ووقت الإدارة", async () => {
  const { deps, client } = makeDeps();
  let res = await handleControlReviewsRequest(
    req("/control/reviews-decision", "POST",
      { id: 1, decision: "approved" }), deps);
  eq(res?.status, 200, "approve status");
  let body = await bodyOf(res);
  const review = body.review as Record<string, unknown>;
  eq(review.status, "approved", "approved written");
  eq(review.moderated_at, NOW, "moderated_at from injected clock");
  eq(client.statusCalls[0], { id: "1", decision: "approved", at: NOW }, "write call");

  res = await handleControlReviewsRequest(
    req("/control/reviews-decision", "POST",
      { id: "1", decision: "rejected" }), deps);
  eq(res?.status, 200, "reject status");
  body = await bodyOf(res);
  eq((body.review as Record<string, unknown>).status, "rejected", "rejected written");
});

Deno.test("parseReviewId: أشكال سليمة وغلط", () => {
  eq(parseReviewId(5), "5", "number");
  eq(parseReviewId("42"), "42", "string");
  eq(parseReviewId(" 7 "), "7", "trimmed string");
  eq(parseReviewId(0), null, "zero");
  eq(parseReviewId(-1), null, "negative");
  eq(parseReviewId(2.5), null, "fraction");
  eq(parseReviewId(""), null, "empty");
  eq(parseReviewId(null), null, "null");
  eq(parseReviewId(undefined), null, "undefined");
});

// -------------------------------------------- عميل PostgREST بـ fetch مثبّت
Deno.test("عميل PostgREST: قراءة القائمة وكتابة القرار بنفس العقود", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method || "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    if ((init?.method || "GET") === "PATCH") {
      return Promise.resolve(new Response(JSON.stringify([{
        id: 7, order_ref: "MG-7", display_name: "س", rating: 3,
        body: "نص", product_label: null, status: "approved",
        created_at: "2026-11-20T00:00:00.000Z", moderated_at: NOW,
      }]), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.resolve(new Response(JSON.stringify([{
      id: 7, order_ref: "MG-7", display_name: "س", rating: 3,
      body: "نص", product_label: null, status: "pending",
      created_at: "2026-11-20T00:00:00.000Z", moderated_at: null,
    }]), { status: 200, headers: { "Content-Type": "application/json" } }));
  }) as typeof fetch;
  try {
    const client = new PostgrestReviewsClient({
      baseUrl: "https://db.example",
      keyOf: () => "service-key",
    });
    const rows = await client.listReviews("pending", 100);
    eq(rows.length, 1, "list rows");
    ok(calls[0].url.includes("reviews?select="), "list hits reviews");
    ok(calls[0].url.includes("status=eq.pending"), "list filters status");
    ok(calls[0].url.includes("order=created_at.desc"), "list newest first");

    const updated = await client.setReviewStatus("7", "approved", NOW);
    eq(updated?.status, "approved", "patch returns the row");
    const patch = calls[1];
    eq(patch.method, "PATCH", "write method");
    ok(patch.url.includes("reviews?id=eq.7"), "patch targets the id");
    eq(JSON.parse(patch.body || "{}"),
      { status: "approved", moderated_at: NOW }, "patch body");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureReviews {
  reviewStatusLabel: (
    status: unknown,
  ) => { key: string; label: string };
  reviewStars: (rating: unknown) => string;
}

const PB = "/*PURE-REVIEWS-BEGIN*/";
const PE = "/*PURE-REVIEWS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure reviews block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { reviewStatusLabel, reviewStars };",
) as () => PureReviews)();

Deno.test("reviewStatusLabel: الحالات التلاتة بلغة اللوحة", () => {
  eq(pure.reviewStatusLabel("pending").key, "pending", "pending");
  eq(pure.reviewStatusLabel("approved").key, "approved", "approved");
  eq(pure.reviewStatusLabel("rejected").key, "rejected", "rejected");
  eq(pure.reviewStatusLabel("whatever").key, "pending", "unknown falls to pending");
  eq(pure.reviewStatusLabel(null).key, "pending", "null falls to pending");
});

Deno.test("reviewStars: نجوم التقييم", () => {
  eq(pure.reviewStars(5), "★★★★★", "five");
  eq(pure.reviewStars(3), "★★★☆☆", "three");
  eq(pure.reviewStars(1), "★☆☆☆☆", "one");
  eq(pure.reviewStars(0), "☆☆☆☆☆", "zero");
  eq(pure.reviewStars(9), "★★★★★", "clamped above");
  eq(pure.reviewStars("x"), "☆☆☆☆☆", "garbage = zero");
});
