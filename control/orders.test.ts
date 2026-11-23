/**
 * اختبارات الطلبات والمحادثات (المرحلة م٢) — `deno test control/`:
 * عميل بوت وعميل طلبات موقع وهميان. التغطية: بوابة الأدمن قبل أي
 * نداء، تمرير مسارات البوت (طلبات/مهام يدوية/محادثات) بحالاتها،
 * فشل البوت = bot_unavailable، وطلبات الموقع: قراءة بمرشّح حالة،
 * رفض أي حالة بره مفردات الموقع الحالية، 404 لطلب مش موجود،
 * تغيير الحالة بيعدّي على القاعدة، والتدقيق بيتبعت وبيتصرح
 * بفشله (audit_failed) من غير ما يخفي نجاح تغيير الحالة.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import {
  type ControlOrdersClient,
  type ControlOrdersDeps,
  handleControlOrdersRequest,
  type StoreOrderRow,
} from "./orders.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

class FakeBotClient implements BotControlProxyClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  failNext = false;
  auditStatus = 200;
  async proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.failNext) {
      this.failNext = false;
      throw new Error("bot down");
    }
    if (path === "/api/control/audit-log") {
      return { status: this.auditStatus, body: { ok: this.auditStatus < 300 } };
    }
    return { status: 200, body: { ok: true, proxied: path } };
  }
}

class FakeOrdersClient implements ControlOrdersClient {
  rows = new Map<string, StoreOrderRow>();
  writes: { id: string; status: string }[] = [];
  lastList: { status: string | null; limit: number } | null = null;
  payDebits = new Map<string, { customerId: string; amountEgp: number }>();
  refundCalls: { customerId: string; amountEgp: number; orderRef: string }[] =
    [];
  refundedRefs = new Set<string>();
  failRefund = false;
  failLookup = false;
  // صفوف قيد ردّ بمرجع اللوحة كما في wallet_transactions الحقيقية:
  // نجاح الـ RPC بيكتب واحد، وممكن يتبذر يدويًا لمحاكاة قيد اتكتب
  // من مسار تاني (W7 #2).
  panelCreditRows = new Set<string>();
  async hasWalletRefund(orderRef: string) {
    return this.panelCreditRows.has(orderRef);
  }
  // محاكاة سباق: أول كتابة بتقلب حالة الصف لقيمة تانية قبل شرط
  // الحالة المتوقعة، فالكتابة المشروطة ما بتلاقيش صف ترجّعه.
  flipOnWrite: string | null = null;
  async findWalletPayDebit(orderRef: string) {
    if (this.failLookup) throw new Error("lookup down");
    return this.payDebits.get(orderRef) ?? null;
  }
  async refundWalletPay(
    customerId: string,
    amountEgp: number,
    orderRef: string,
  ): Promise<{ already: boolean }> {
    if (this.failRefund) throw new Error("rpc down");
    this.refundCalls.push({ customerId, amountEgp, orderRef });
    // محاكاة عدم تكرار الدالة الحقيقية: نفس المرجع = already بلا حركة.
    if (this.refundedRefs.has(orderRef)) return { already: true };
    this.refundedRefs.add(orderRef);
    this.panelCreditRows.add(orderRef);
    return { already: false };
  }
  async listOrders(
    status: string | null,
    limit: number,
  ): Promise<StoreOrderRow[]> {
    this.lastList = { status, limit };
    return [...this.rows.values()].filter((r) =>
      !status || r.status === status
    );
  }
  async getOrder(id: string): Promise<StoreOrderRow | null> {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }
  async setOrderStatus(
    id: string,
    status: string,
    expectedStatus: string,
  ): Promise<StoreOrderRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (this.flipOnWrite) {
      row.status = this.flipOnWrite;
      this.flipOnWrite = null;
    }
    // نفس دلالة الكتابة المشروطة الحقيقية: الحالة الحالية لازم
    // تطابق المتوقعة، وإلا مفيش صف بيتكتب ولا بيرجع.
    if (row.status !== expectedStatus) return null;
    this.writes.push({ id, status });
    row.status = status;
    return { ...row };
  }
}

function seedOrder(): StoreOrderRow {
  return {
    id: ORDER_ID,
    order_ref: "MG-100099",
    customer_email: "buyer@example.com",
    items: [{ name: "منتج", qty: 1, price: 100 }],
    total_text: "100 ج.م",
    server_total: 100,
    status: "new",
    payment: "vodafone",
    customer_id: null,
    created_at: "2026-11-20T00:00:00Z",
  };
}

function makeDeps() {
  const bot = new FakeBotClient();
  const orders = new FakeOrdersClient();
  orders.rows.set(ORDER_ID, seedOrder());
  const deps: ControlOrdersDeps = {
    client: orders,
    botClient: bot,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
  };
  return { deps, bot, orders };
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
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.test("foreign paths return null", async () => {
  const { deps } = makeDeps();
  eq(await handleControlOrdersRequest(
    req("/control/bot-customer-control"), deps), null, "null for flags path");
  eq(await handleControlOrdersRequest(
    req("/control/store-customer-ban"), deps), null, "null for ban path");
});

Deno.test("bot proxies pass through with admin gate and method order", async () => {
  const { deps, bot } = makeDeps();
  const denied = await handleControlOrdersRequest(
    req("/control/bot-chat-send", "POST", {}, false), deps);
  eq(denied?.status, 401, "no admin = 401");
  eq(bot.calls.length, 0, "no bot call before admin");

  const wrong = await handleControlOrdersRequest(
    req("/control/bot-chat-send", "GET", undefined, false), deps);
  eq(wrong?.status, 405, "wrong method beats admin: 405 first");

  const res = await handleControlOrdersRequest(
    req("/control/bot-order-shop-decide", "POST", {
      order_id: "7", action: "done", reason: "اتنفذ",
    }), deps);
  eq(res?.status, 200, "proxy status");
  eq(bot.calls[0].path, "/api/control/order-shop-decide", "bot path");
  eq(bot.calls[0].method, "POST", "bot method");
  eq(bot.calls[0].body?.order_id, "7", "body passes verbatim");

  const get = await handleControlOrdersRequest(
    req("/control/bot-orders?queue=intervention&limit=20"), deps);
  eq(get?.status, 200, "get proxy status");
  eq(bot.calls[1].path, "/api/control/orders?queue=intervention&limit=20",
    "query passes through");

  const hist = await handleControlOrdersRequest(
    req("/control/bot-chat-history?ref=500&limit=50"), deps);
  eq(hist?.status, 200, "history proxy status");
  eq(bot.calls[2].path, "/api/control/chat-history?ref=500&limit=50",
    "history bot path");

  const saved = await handleControlOrdersRequest(
    req("/control/bot-chat-send-saved", "POST", {
      customer_ref: "500", index: 1,
    }), deps);
  eq(saved?.status, 200, "send-saved status");
  eq(bot.calls[3].path, "/api/control/chat-send-saved",
    "send-saved is its own route, not chat-send");
});

Deno.test("bot failure surfaces as bot_unavailable", async () => {
  const { deps, bot } = makeDeps();
  bot.failNext = true;
  const res = await handleControlOrdersRequest(
    req("/control/bot-manual-task", "POST", { op: "create" }), deps);
  eq(res?.status, 502, "502");
  const body = await res!.json();
  eq(body.error, "bot_unavailable", "error code");
  eq(body.bot_unavailable, true, "flag set");
});

Deno.test("store orders: read with status filter and limit", async () => {
  const { deps, orders } = makeDeps();
  const denied = await handleControlOrdersRequest(
    req("/control/store-orders", "GET", undefined, false), deps);
  eq(denied?.status, 401, "no admin = 401");

  const res = await handleControlOrdersRequest(
    req("/control/store-orders?status=new&limit=10"), deps);
  eq(res?.status, 200, "read 200");
  const body = await res!.json();
  eq(body.orders.length, 1, "one order");
  eq(body.orders[0].order_ref, "MG-100099", "order ref");
  eq(orders.lastList, { status: "new", limit: 10 }, "filter passed");

  const badFilter = await handleControlOrdersRequest(
    req("/control/store-orders?status=paid"), deps);
  eq(badFilter?.status, 400, "unknown filter status 400");
  eq((await badFilter!.json()).error, "invalid_status", "error code");
});

Deno.test("store orders: status change validation, 404, write + audit", async () => {
  const { deps, bot, orders } = makeDeps();
  const badStatus = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "paid",
    }), deps);
  eq(badStatus?.status, 400, "'paid' is not a store status: 400");
  eq((await badStatus!.json()).error, "invalid_status", "error code");
  eq(orders.writes.length, 0, "no write for bad status");

  const missing = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: "123e4567-e89b-12d3-a456-426614174999", status: "cancelled",
    }), deps);
  eq(missing?.status, 404, "unknown order 404");
  eq(orders.writes.length, 0, "no write for missing order");

  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "العميل طلب الإلغاء",
    }), deps);
  eq(res?.status, 200, "change 200");
  const body = await res!.json();
  eq(body.status, "cancelled", "status changed");
  eq(body.audit_failed, false, "audit ok");
  eq(orders.writes[0].status, "cancelled", "db write happened");
  const audit = bot.calls.find((c) => c.path === "/api/control/audit-log");
  ok(audit, "audit sent");
  eq(audit!.body?.action, "store_order_status", "audit action");
  eq(audit!.body?.entity_type, "store_order", "audit entity type");
  eq(audit!.body?.entity_ref, "MG-100099", "audit ref is order_ref");
  eq((audit!.body?.before as { status: string }).status, "new",
    "audit before");
  eq((audit!.body?.after as { status: string }).status, "cancelled",
    "audit after");
});

Deno.test("store orders: wallet-paid cancel refunds via the existing wallet RPC, exactly once", async () => {
  const { deps, bot, orders } = makeDeps();
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "إلغاء",
    }), deps);
  eq(res?.status, 200, "cancel 200");
  const body = await res!.json();
  eq(body.refund.applied, true, "refund applied");
  eq(body.refund.already, false, "first refund is fresh");
  eq(body.refund.amount_egp, 100, "refund equals the original debit");
  eq(orders.refundCalls.length, 1, "one refund call");
  eq(orders.refundCalls[0].customerId,
    "123e4567-e89b-12d3-a456-426614174001", "refund to the payer");
  eq(orders.writes[0].status, "cancelled", "status claimed first");
  const audit = bot.calls.find((c) => c.path === "/api/control/audit-log");
  eq((audit!.body?.after as { refund?: { applied: boolean } }).refund
    ?.applied, true, "audit carries the refund");

  const again = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled",
    }), deps);
  const againBody = await again!.json();
  eq(againBody.refund.applied, true, "repeat still reports refund");
  eq(againBody.refund.already, true, "repeat is idempotent: already");
});

Deno.test("store orders: externally-paid cancel touches no wallet", async () => {
  const { deps, orders } = makeDeps();
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "العميل لغى",
    }), deps);
  const body = await res!.json();
  eq(body.refund.applied, false, "no refund for external payment");
  eq(body.refund.reason, "not_wallet_paid", "reason disclosed");
  eq(orders.refundCalls.length, 0, "no wallet call");
  eq(orders.writes[0].status, "cancelled", "status still changes");
});

Deno.test("store orders: refund failure after the claim discloses the new status, retry completes the refund", async () => {
  const { deps, orders } = makeDeps();
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  orders.failRefund = true;
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "إلغاء",
    }), deps);
  eq(res?.status, 502, "refund failure = 502");
  const body = await res!.json();
  eq(body.error, "refund_failed", "error code");
  // الحجز حصل قبل الرجوع: الحالة اتغيّرت فعلًا وده متصرّح بيه في
  // الرد عشان المشغّل يعرف إن الطلب ملغي والرجوع لسه معلّق.
  eq(body.order_id, ORDER_ID, "order id disclosed");
  eq(body.status, "cancelled", "new status disclosed");
  eq(orders.writes.length, 1, "status WAS claimed before the refund");
  eq(orders.rows.get(ORDER_ID)!.status, "cancelled", "row is cancelled");

  // الاسترداد: إعادة نفس الطلب (تكرار نفس الحالة النهائية انتقال
  // مسموح) بتعيد تشغيل الرجوع وبتكمّله.
  orders.failRefund = false;
  const retry = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled",
    }), deps);
  eq(retry?.status, 200, "retry 200");
  const retryBody = await retry!.json();
  eq(retryBody.refund.applied, true, "retry applies the refund");
  eq(retryBody.refund.already, false, "first successful refund is fresh");
  eq(orders.refundCalls.length, 1, "one successful refund call");

  // ولو الرجوع كان اتطبّق والرد ضاع، إعادة المحاولة بترجع already.
  const again = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled",
    }), deps);
  const againBody = await again!.json();
  eq(againBody.refund.applied, true, "repeat still reports refund");
  eq(againBody.refund.already, true, "already flag passes through");
});

Deno.test("store orders: non-cancel status never refunds", async () => {
  const { deps, orders } = makeDeps();
  orders.rows.get(ORDER_ID)!.status = "payment_confirmed";
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "fulfilled",
    }), deps);
  const body = await res!.json();
  eq(body.ok, true, "fulfil ok");
  eq("refund" in body, false, "no refund field on fulfil");
  eq(orders.refundCalls.length, 0, "no wallet call");
});

Deno.test("store orders: terminal states have no way out (transition map)", async () => {
  const { deps, orders } = makeDeps();
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  // طلب اتسلّم ما يتلغاش — إلغاؤه كان هيرجّع فلوسه وهو متسلّم.
  orders.rows.get(ORDER_ID)!.status = "fulfilled";
  const cancelDelivered = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "تجربة",
    }), deps);
  eq(cancelDelivered?.status, 409, "fulfilled->cancelled 409");
  const cdBody = await cancelDelivered!.json();
  eq(cdBody.error, "invalid_transition", "error code");
  eq(cdBody.from_status, "fulfilled", "from disclosed");
  eq(orders.writes.length, 0, "no write");
  eq(orders.refundCalls.length, 0, "no refund for a delivered order");

  // طلب اتلغى أو استُرد ما يرجعش منفّذ.
  for (const from of ["cancelled", "refunded"]) {
    orders.rows.get(ORDER_ID)!.status = from;
    const revive = await handleControlOrdersRequest(
      req("/control/store-orders", "POST", {
        order_id: ORDER_ID, status: "fulfilled",
      }), deps);
    eq(revive?.status, 409, `${from}->fulfilled 409`);
    eq((await revive!.json()).error, "invalid_transition", "error code");
  }

  // وطلب جديد ما يقفزش للتنفيذ قبل تأكيد الدفع.
  orders.rows.get(ORDER_ID)!.status = "new";
  const skip = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "fulfilled",
    }), deps);
  eq(skip?.status, 409, "new->fulfilled 409");
  eq(orders.writes.length, 0, "still no writes");

  const confirm = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "payment_confirmed",
    }), deps);
  eq(confirm?.status, 200, "new->payment_confirmed ok");
  eq(orders.writes[0].status, "payment_confirmed", "write happened");
});

Deno.test("store orders: real cancel/refund requires a written reason", async () => {
  const { deps, orders } = makeDeps();
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  const noReason = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled",
    }), deps);
  eq(noReason?.status, 400, "cancel without reason 400");
  eq((await noReason!.json()).error, "reason_required", "error code");
  eq(orders.writes.length, 0, "no write without reason");
  eq(orders.refundCalls.length, 0, "no refund without reason");

  orders.rows.get(ORDER_ID)!.status = "payment_confirmed";
  const noReasonRefund = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "refunded", reason: "   ",
    }), deps);
  eq(noReasonRefund?.status, 400, "refund without reason 400");
  eq((await noReasonRefund!.json()).error, "reason_required",
    "error code");
});

Deno.test("store orders: status race surfaces state_changed and no refund is performed", async () => {
  const { deps, orders } = makeDeps();
  orders.rows.get(ORDER_ID)!.status = "payment_confirmed";
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  // الكتابة المشروطة بتخسر سباقًا: الحالة اتقلبت «fulfilled» تحتنا.
  orders.flipOnWrite = "fulfilled";
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "إلغاء",
    }), deps);
  eq(res?.status, 409, "race = 409");
  const body = await res!.json();
  eq(body.error, "state_changed", "error code");
  // الحجز أولًا: خسران السباق يعني مفيش رجوع اتعمل أصلًا، فالرد
  // مفيهوش أي حقل رجوع — الطلب اتسلّم وفلوسه ما رجعتش.
  eq("refund" in body, false, "no refund field on a lost race");
  eq(orders.refundCalls.length, 0, "refund never called");
  eq(orders.writes.length, 0, "no status write won the race");
  eq(orders.rows.get(ORDER_ID)!.status, "fulfilled",
    "row keeps the winning status");
});

Deno.test("store orders: audit failure is disclosed, change still succeeds", async () => {
  const { deps, bot, orders } = makeDeps();
  orders.rows.get(ORDER_ID)!.status = "payment_confirmed";
  bot.auditStatus = 500;
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "fulfilled",
    }), deps);
  const body = await res!.json();
  eq(body.ok, true, "change ok");
  eq(body.status, "fulfilled", "status applied");
  eq(body.audit_failed, true, "audit_failed disclosed");
});

// =====================================================================
// إصلاحات مراجعة الموقع W7 (طلبات اللوحة)
// =====================================================================

Deno.test("W7#1: wallet lookup failure still audits the status change, then returns the original 502", async () => {
  const { deps, bot, orders } = makeDeps();
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  orders.failLookup = true;
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "إلغاء",
    }), deps);
  eq(res?.status, 502, "original error status preserved");
  const body = await res!.json();
  eq(body.error, "store_failed", "original error body preserved");
  eq(orders.writes.length, 1, "status was claimed first");
  const audit = bot.calls.find((c) => c.path === "/api/control/audit-log");
  ok(audit, "audit written despite the refund-step failure");
  const after = audit!.body?.after as {
    status: string;
    refund?: { applied: boolean; reason?: string };
  };
  eq(after.status, "cancelled", "audit carries the transition");
  eq(after.refund?.applied, false, "audit refund not applied");
  eq(after.refund?.reason, "wallet_lookup_failed", "audit refund carries the failure reason");
});

Deno.test("W7#1: refund RPC failure still audits the status change, then returns the original 502", async () => {
  const { deps, bot, orders } = makeDeps();
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  orders.failRefund = true;
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled", reason: "إلغاء",
    }), deps);
  eq(res?.status, 502, "original error status preserved");
  const body = await res!.json();
  eq(body.error, "refund_failed", "original error body preserved");
  eq(body.order_id, ORDER_ID, "order id disclosed");
  eq(body.status, "cancelled", "new status disclosed");
  const audit = bot.calls.find((c) => c.path === "/api/control/audit-log");
  ok(audit, "audit written despite the refund failure");
  const after = audit!.body?.after as {
    refund?: { applied: boolean; reason?: string };
  };
  eq(after.refund?.applied, false, "audit refund not applied");
  eq(after.refund?.reason, "refund_failed", "audit refund carries the failure reason");
});

Deno.test("W7#2: same-status retry with an existing panel credit row never re-issues the refund", async () => {
  const { deps, orders } = makeDeps();
  // الطلب اتلغى قبل كده وقيد الردّ بمرجع اللوحة موجود في المحفظة —
  // لكن سجل الـ RPC نفسه فاضي (القيد اتكتب من مسار تاني)، فمن غير
  // الفحص المسبق الـ RPC كان هيطبّق من جديد.
  orders.rows.get(ORDER_ID)!.status = "cancelled";
  orders.payDebits.set("MG-100099", {
    customerId: "123e4567-e89b-12d3-a456-426614174001",
    amountEgp: 100,
  });
  orders.panelCreditRows.add("MG-100099");
  const res = await handleControlOrdersRequest(
    req("/control/store-orders", "POST", {
      order_id: ORDER_ID, status: "cancelled",
    }), deps);
  eq(res?.status, 200, "retry succeeds");
  const body = await res!.json();
  eq(body.refund.applied, true, "refund reported applied");
  eq(body.refund.already, true, "reported as already-refunded");
  eq(body.refund.amount_egp, 100, "amount from the original debit");
  eq(orders.refundCalls.length, 0, "refund RPC never re-issued");
});
