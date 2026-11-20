// اختبارات وحدة كوبونات اللوحة (م٥-ج) — `deno test control/coupons.test.ts`
// عميل قاعدة وهمي وعميل بوت وهمي — مفيش أي نداء شبكة ولا قاعدة
// حقيقية. العقد: بوابة أدمن قبل أي لمس للقاعدة، تحقق نقي قبل
// الكتابة، الكود ما بيتبدّلش، الحذف ممنوع لكوبون مستخدم، وفشل
// التدقيق بيتصرح بيه من غير ما يخفي نجاح الكتابة. والمنطق النقي
// بتاع شاشة الكوبونات عايش جوه سكربت اللوحة بين علامتي
// PURE-COUPONS — الاختبارات بتقراه من control.html حرفيًا.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlCouponsClient,
  type ControlCouponsDeps,
  type CouponInput,
  couponUsesCount,
  fractionToPercent,
  handleControlCouponsRequest,
  percentToFraction,
  PostgrestControlCouponsClient,
  type StoreCouponRow,
  validateCouponInput,
} from "./coupons.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ------------------------------------------------------------- عملاء وهميون
// العميل الوهمي بيشتغل بعقد اللوحة (discount نسبة بشرية) زي واجهة
// ControlCouponsClient بالظبط — تحويل النسبة لكسر بيحصل جوه عميل
// PostgREST الحقيقي بس، وبيتغطى باختبارات السلك تحت لوحده.
class FakeCouponsClient implements ControlCouponsClient {
  rows: StoreCouponRow[] = [];
  fail = false;

  listCoupons(): Promise<StoreCouponRow[]> {
    if (this.fail) return Promise.reject(new Error("db down"));
    return Promise.resolve(this.rows);
  }
  getCoupon(code: string): Promise<StoreCouponRow | null> {
    if (this.fail) return Promise.reject(new Error("db down"));
    return Promise.resolve(this.rows.find((r) => r.code === code) ?? null);
  }
  insertCoupon(input: CouponInput): Promise<StoreCouponRow> {
    if (this.fail) return Promise.reject(new Error("db down"));
    const row: StoreCouponRow = {
      ...input,
      created_at: "2026-11-20T00:00:00.000Z",
      uses_count: 0,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }
  updateCoupon(
    code: string,
    patch: Omit<CouponInput, "code">,
  ): Promise<StoreCouponRow | null> {
    if (this.fail) return Promise.reject(new Error("db down"));
    const i = this.rows.findIndex((r) => r.code === code);
    if (i < 0) return Promise.resolve(null);
    this.rows[i] = { ...this.rows[i], ...patch };
    return Promise.resolve(this.rows[i]);
  }
  deleteCoupon(code: string): Promise<boolean> {
    if (this.fail) return Promise.reject(new Error("db down"));
    const i = this.rows.findIndex((r) => r.code === code);
    if (i < 0) return Promise.resolve(false);
    this.rows.splice(i, 1);
    return Promise.resolve(true);
  }
}

class FakeBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  fail = false;

  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.fail) return Promise.reject(new Error("bot down"));
    return Promise.resolve({ status: 200, body: { ok: true } });
  }
}

function depsOf(
  client: FakeCouponsClient,
  bot: FakeBotClient,
  admin = true,
): ControlCouponsDeps {
  return {
    client,
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(path: string, method = "GET", body?: unknown): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: body !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function bodyOf(res: Response | null): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

function seedRow(patch: Partial<StoreCouponRow> = {}): StoreCouponRow {
  return {
    code: "SAVE10",
    discount: 10,
    active: true,
    created_at: "2026-11-01T00:00:00.000Z",
    expires_at: null,
    max_uses: null,
    uses_count: 0,
    min_order_egp: null,
    ...patch,
  };
}

// ------------------------------------------------------------------ التحقق
Deno.test("validateCouponInput: تطبيع وقبول ورفض", () => {
  const good = validateCouponInput({ code: " save10 ", discount: "10" });
  ok("input" in good, "valid input accepted");
  if ("input" in good) {
    eq(good.input.code, "SAVE10", "code uppercased+trimmed");
    eq(good.input.discount, 10, "discount stays human percent at the panel boundary");
    eq(good.input.active, true, "active defaults true");
    eq(good.input.expires_at, null, "expires null");
    eq(good.input.max_uses, null, "max_uses null");
    eq(good.input.min_order_egp, null, "min_order null");
  }
  eq(validateCouponInput({ code: "AB", discount: 10 }), { error: "bad_code" }, "short code");
  eq(validateCouponInput({ code: "كود", discount: 10 }), { error: "bad_code" }, "arabic code");
  eq(validateCouponInput({ code: "SAVE10", discount: 0 }), { error: "bad_discount" }, "zero discount");
  eq(validateCouponInput({ code: "SAVE10", discount: 101 }), { error: "bad_discount" }, "over 100");
  eq(validateCouponInput({ code: "SAVE10", discount: 10, expires_at: "مش تاريخ" }), { error: "bad_expires" }, "bad expires");
  eq(validateCouponInput({ code: "SAVE10", discount: 10, max_uses: 0 }), { error: "bad_max_uses" }, "zero max_uses");
  eq(validateCouponInput({ code: "SAVE10", discount: 10, max_uses: 2.5 }), { error: "bad_max_uses" }, "fractional max_uses");
  eq(validateCouponInput({ code: "SAVE10", discount: 10, min_order_egp: -5 }), { error: "bad_min_order" }, "negative min order");
  // active غير المنطقي مرفوض صراحة — التحويل الصامت لـ false كان
  // بيوقف كوبون شغّال من غير ما يبان.
  for (const bad of ["true", 1, 0, null]) {
    eq(
      validateCouponInput({ code: "SAVE10", discount: 10, active: bad }),
      { error: "bad_active" },
      `non-boolean active ${JSON.stringify(bad)}`,
    );
  }
  const full = validateCouponInput({
    code: "VIP-20",
    discount: 20,
    active: false,
    expires_at: "2027-01-01T00:00:00Z",
    max_uses: 50,
    min_order_egp: 200,
  });
  ok("input" in full, "full input accepted");
  if ("input" in full) {
    eq(full.input.expires_at, "2027-01-01T00:00:00.000Z", "expires normalized to ISO");
    eq(full.input.max_uses, 50, "max_uses kept");
    eq(full.input.min_order_egp, 200, "min_order kept");
    eq(full.input.active, false, "active false kept");
  }
});

Deno.test("couponUsesCount: أرقام ونصوص وغياب", () => {
  eq(couponUsesCount(seedRow({ uses_count: 3 })), 3, "number");
  eq(couponUsesCount(seedRow({ uses_count: "4" })), 4, "string number");
  eq(couponUsesCount(seedRow({ uses_count: null })), 0, "null");
  eq(couponUsesCount(seedRow({ uses_count: -2 })), 0, "negative clamps");
});

// ------------------------------------------------------------------ المعالج
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeCouponsClient(), new FakeBotClient());
  eq(await handleControlCouponsRequest(req("/control/store-orders"), d), null, "orders");
  eq(await handleControlCouponsRequest(req("/control/bot-channel-queue"), d), null, "channel");
  eq(await handleControlCouponsRequest(req("/control/store-coupons-x"), d), null, "suffix-x");
});

Deno.test("القائمة: بوابة و405 ورد حرفي وفشل قاعدة", async () => {
  const client = new FakeCouponsClient();
  client.rows = [seedRow()];
  const bot = new FakeBotClient();

  const denied = await handleControlCouponsRequest(
    req("/control/store-coupons"),
    depsOf(client, bot, false),
  );
  eq(denied?.status, 401, "gate status");
  eq((await bodyOf(denied)).error, "unauthorized", "gate error");

  const wrong = await handleControlCouponsRequest(
    req("/control/store-coupons", "POST", {}),
    depsOf(client, bot),
  );
  eq(wrong?.status, 405, "POST on list is 405");

  const res = await handleControlCouponsRequest(
    req("/control/store-coupons"),
    depsOf(client, bot),
  );
  eq(res?.status, 200, "list status");
  eq((await bodyOf(res)).coupons, [seedRow()], "coupons verbatim");

  client.fail = true;
  const failed = await handleControlCouponsRequest(
    req("/control/store-coupons"),
    depsOf(client, bot),
  );
  eq(failed?.status, 502, "db failure status");
  eq((await bodyOf(failed)).error, "store_failed", "db failure error");
});

Deno.test("الإنشاء: حفظ + تدقيق + تعارض + تحقق", async () => {
  const client = new FakeCouponsClient();
  const bot = new FakeBotClient();
  const d = depsOf(client, bot);

  const res = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", { code: "new15", discount: 15 }),
    d,
  );
  eq(res?.status, 200, "create status");
  const body = await bodyOf(res);
  eq((body.coupon as StoreCouponRow).code, "NEW15", "created uppercased");
  eq(body.audit_failed, false, "audit ok");
  eq(bot.calls.length, 1, "one audit call");
  eq(bot.calls[0].path, "/api/control/audit-log", "audit path");
  eq(bot.calls[0].body?.action, "store_coupon_save", "audit action");
  eq(bot.calls[0].body?.entity_type, "store_coupon", "audit entity type");

  const dup = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", { code: "NEW15", discount: 5 }),
    d,
  );
  eq(dup?.status, 409, "duplicate status");
  eq((await bodyOf(dup)).error, "coupon_exists", "duplicate error");

  const bad = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", { code: "OK100", discount: 0 }),
    d,
  );
  eq(bad?.status, 400, "invalid status");
  eq((await bodyOf(bad)).error, "bad_discount", "invalid error");
  eq(client.rows.length, 1, "invalid write never landed");
});

Deno.test("التعديل: نفس الكود بس، وغياب = 404", async () => {
  const client = new FakeCouponsClient();
  client.rows = [seedRow()];
  const d = depsOf(client, new FakeBotClient());

  const res = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", {
      code: "SAVE10",
      discount: 25,
      active: false,
      original_code: "SAVE10",
    }),
    d,
  );
  eq(res?.status, 200, "update status");
  eq(client.rows[0].discount, 25, "discount updated");
  eq(client.rows[0].active, false, "active updated");

  const rename = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", {
      code: "SAVE20",
      discount: 20,
      original_code: "SAVE10",
    }),
    d,
  );
  eq(rename?.status, 400, "rename status");
  eq((await bodyOf(rename)).error, "code_immutable", "rename refused");

  const missing = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", {
      code: "GONE",
      discount: 20,
      original_code: "GONE",
    }),
    d,
  );
  eq(missing?.status, 404, "missing status");
  eq((await bodyOf(missing)).error, "not_found", "missing error");
});

Deno.test("الحذف: غير المستخدم بس، والمستخدم 409", async () => {
  const client = new FakeCouponsClient();
  client.rows = [seedRow(), seedRow({ code: "USED5", uses_count: 3 })];
  const bot = new FakeBotClient();
  const d = depsOf(client, bot);

  const used = await handleControlCouponsRequest(
    req("/control/store-coupons-delete", "POST", { code: "USED5" }),
    d,
  );
  eq(used?.status, 409, "used status");
  eq((await bodyOf(used)).error, "coupon_in_use", "used error");
  eq(client.rows.length, 2, "used coupon kept");

  const res = await handleControlCouponsRequest(
    req("/control/store-coupons-delete", "POST", { code: "save10" }),
    d,
  );
  eq(res?.status, 200, "delete status");
  eq(client.rows.length, 1, "unused coupon deleted");
  eq(bot.calls[0].body?.action, "store_coupon_delete", "delete audited");

  const missing = await handleControlCouponsRequest(
    req("/control/store-coupons-delete", "POST", { code: "SAVE10" }),
    d,
  );
  eq(missing?.status, 404, "missing delete status");
});

Deno.test("الحذف: سباق استخدام بين الفحص والحذف = 409 والكوبون يبقى", async () => {
  // العميل الوهمي بيحاكي السباق: القراءة الأولى uses_count = 0،
  // والحذف المشروط ما بيطابقش (طلب عميل رفع العدّاد في النص)،
  // والقراءة التانية بتلاقي الكوبون مستخدم خلاص.
  class RaceClient extends FakeCouponsClient {
    reads = 0;
    override getCoupon(code: string): Promise<StoreCouponRow | null> {
      this.reads++;
      const base = this.rows.find((r) => r.code === code) ?? null;
      if (!base) return Promise.resolve(null);
      return Promise.resolve({
        ...base,
        uses_count: this.reads === 1 ? 0 : 1,
      });
    }
    override deleteCoupon(_code: string): Promise<boolean> {
      return Promise.resolve(false);
    }
  }
  const client = new RaceClient();
  client.rows = [seedRow()];
  const res = await handleControlCouponsRequest(
    req("/control/store-coupons-delete", "POST", { code: "SAVE10" }),
    depsOf(client, new FakeBotClient()),
  );
  eq(res?.status, 409, "raced delete status");
  eq((await bodyOf(res)).error, "coupon_in_use", "raced delete error");
  eq(client.rows.length, 1, "raced coupon kept");
});

Deno.test("عميل PostgREST: الحذف مشروط بـ uses_count=eq.0 في الرابط نفسه", async () => {
  const seen: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    seen.push(`${init?.method ?? "GET"} ${String(input)}`);
    return Promise.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
  try {
    const client = new PostgrestControlCouponsClient({
      baseUrl: "https://db.example",
      keyOf: () => "svc-key",
    });
    const gone = await client.deleteCoupon("SAVE10");
    eq(gone, false, "no rows matched = not deleted");
    eq(seen.length, 1, "one delete call");
    ok(seen[0].startsWith("DELETE "), "delete method");
    ok(seen[0].includes("code=eq.SAVE10"), "code filter present");
    ok(seen[0].includes("uses_count=eq.0"), "atomic unused condition present");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ------------------------------------------------- تحويل النسبة ↔ الكسر
Deno.test("تحويل النسبة والكسر: دوال نقية", () => {
  eq(percentToFraction(10), 0.1, "10% stored as 0.1");
  eq(percentToFraction(5), 0.05, "5% stored as 0.05");
  eq(percentToFraction(100), 1, "100% stored as 1");
  eq(fractionToPercent(0.15), 15, "stored 0.15 shows 15");
  eq(fractionToPercent(0.1), 10, "stored 0.1 shows 10");
  eq(fractionToPercent(0.29), 29, "float dust rounded away");
  eq(fractionToPercent(1), 100, "stored 1 shows 100");
});

Deno.test("عميل PostgREST: الكتابة بتخزّن كسر والقراءة بترجّع نسبة", async () => {
  const calls: { method: string; url: string; body?: { discount?: number } }[] =
    [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body
      ? JSON.parse(String(init.body)) as { discount?: number }
      : undefined;
    calls.push({ method, url: String(input), body });
    // المحاكاة: القاعدة بتخزّن جسم الكتابة زي ما هو وبترد بيه،
    // والقراءات بترجع صفوفًا مخزّنة بكسر (رقم مرة ونص مرة، زي ما
    // PostgREST ممكن يرجّع numeric بأي شكل).
    let payload: unknown;
    if (method === "POST" || method === "PATCH") {
      payload = [{
        code: "SAVE10",
        discount: body?.discount,
        active: true,
        created_at: "2026-11-20T00:00:00.000Z",
        expires_at: null,
        max_uses: null,
        uses_count: 0,
        min_order_egp: null,
      }];
    } else if (String(input).includes("limit=1")) {
      payload = [{
        code: "MIGO15",
        discount: "0.15",
        active: true,
        created_at: "2026-11-01T00:00:00.000Z",
        expires_at: null,
        max_uses: null,
        uses_count: 2,
        min_order_egp: null,
      }];
    } else {
      payload = [{
        code: "MIGO15",
        discount: 0.15,
        active: true,
        created_at: "2026-11-01T00:00:00.000Z",
        expires_at: null,
        max_uses: null,
        uses_count: 2,
        min_order_egp: null,
      }];
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
  try {
    const client = new PostgrestControlCouponsClient({
      baseUrl: "https://db.example",
      keyOf: () => "svc-key",
    });

    // حفظ 10 من اللوحة = 0.10 في جسم الكتابة، والرد راجع بنسبة.
    const created = await client.insertCoupon({
      code: "SAVE10",
      discount: 10,
      active: true,
      expires_at: null,
      max_uses: null,
      min_order_egp: null,
    });
    const post = calls.find((c) => c.method === "POST");
    eq(post?.body?.discount, 0.1, "panel save of 10 writes fraction 0.10");
    eq(created.discount, 10, "insert response back in percent");

    // تعديل لـ 20 من اللوحة = 0.20 على السلك، والرد بنسبة.
    const updated = await client.updateCoupon("SAVE10", {
      discount: 20,
      active: true,
      expires_at: null,
      max_uses: null,
      min_order_egp: null,
    });
    const patch = calls.find((c) => c.method === "PATCH");
    eq(patch?.body?.discount, 0.2, "panel update of 20 writes fraction 0.20");
    eq(updated?.discount, 20, "update response back in percent");

    // قراءة صف مخزّن 0.15 = 15 في اللوحة (رقم في القائمة، ونص
    // في القراءة المفردة).
    const list = await client.listCoupons();
    eq(list[0].discount, 15, "stored 0.15 lists as 15");
    const one = await client.getCoupon("MIGO15");
    eq(one?.discount, 15, "stored '0.15' gets as 15");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("فشل تدقيق البوت بيتصرح بيه ومش بيخفي نجاح الحفظ", async () => {
  const client = new FakeCouponsClient();
  const bot = new FakeBotClient();
  bot.fail = true;
  const res = await handleControlCouponsRequest(
    req("/control/store-coupons-save", "POST", { code: "AUD9", discount: 9 }),
    depsOf(client, bot),
  );
  eq(res?.status, 200, "save still succeeds");
  eq((await bodyOf(res)).audit_failed, true, "audit failure disclosed");
  eq(client.rows.length, 1, "row landed");
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureCoupons {
  couponUsesText: (c: Record<string, unknown> | null) => string;
  couponExpiresText: (c: Record<string, unknown> | null) => string;
}

const PB = "/*PURE-COUPONS-BEGIN*/";
const PE = "/*PURE-COUPONS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure coupons block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { couponUsesText, couponExpiresText };",
) as () => PureCoupons)();

Deno.test("couponUsesText: بحد ومن غير حد", () => {
  eq(pure.couponUsesText({ uses_count: 3, max_uses: 10 }), "3 من 10", "with max");
  eq(pure.couponUsesText({ uses_count: 3, max_uses: null }), "3", "no max");
  eq(pure.couponUsesText({ uses_count: "2", max_uses: "5" }), "2 من 5", "string fields");
  eq(pure.couponUsesText({}), "0", "missing fields");
  eq(pure.couponUsesText(null), "0", "null coupon");
});

Deno.test("couponExpiresText: غياب وجارٍ ومنتهي", () => {
  eq(pure.couponExpiresText({ expires_at: null }), "ملوش انتهاء", "no expiry");
  eq(pure.couponExpiresText({}), "ملوش انتهاء", "missing field");
  const future = new Date(Date.now() + 86400_000).toISOString();
  ok(pure.couponExpiresText({ expires_at: future }).startsWith("ينتهي "), "future expiry");
  const past = new Date(Date.now() - 86400_000).toISOString();
  ok(pure.couponExpiresText({ expires_at: past }).startsWith("انتهى "), "past expiry");
});
