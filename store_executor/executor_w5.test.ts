/**
 * اختبارات إصلاحات مراجعة الموقع W5 (store_executor) — `deno test
 * store_executor/executor_w5.test.ts` من غير أي استيراد خارجي.
 * كل شيء على وهميات/ذاكرة — ممنوع أي نداء حي أو فلوس حقيقية.
 *
 * بتغطي:
 *  1) تنقية job_id/custom_id ما تكسرش JSON المضغوط (قيم مقنّعة بس).
 *  2) بوابة حالة الطلب في المنفّذ: ملغي/مسترد بعد الحجز = قفل يدوي
 *     من غير شراء؛ تسليم وصل بعد إلغاء = محتجَز من غير إشعار عميل.
 *  3) استخراج التسليم من عناصر قوائم على شكل كائنات (مش
 *     "[object Object]").
 *  4) setOrderStatus عند PostgREST لازم يرمي على فشل HTTP.
 *  5) تغذية/سجل بتاريخ توليد مستقبلي مرفوض (سماحية انحراف ساعة بس).
 *  6) تنبيه الهامش مرة واحدة عند الدخول في حالة الحظر بس.
 */

import { StoreExecutor } from "./executor.ts";
import {
  MemoryStoreDb,
  PostgrestStoreDb,
} from "./store_db.ts";
import {
  deliveryFromRaw,
  extractDeliveryItems,
  sanitizeRaw,
} from "./sanitize.ts";
import { FeedAvailabilitySource, JsonRegistrySource } from "./registry.ts";
import type {
  ExecutorDeps,
  ProvenanceRecord,
  PurchaseOutcome,
  StoreOrder,
  SupplierAdapter,
} from "./types.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const RECORD: ProvenanceRecord = {
  product_key: "prod-1",
  store_sku: "SKU-1",
  supplier_key: "fake",
  listing_ref: "L1",
  cost_usd: 1,
  store_price_egp: 100,
};

function makeOrder(status: string): StoreOrder {
  return {
    order_ref: "MG-W5-1",
    status,
    customer_email: "customer@example.com",
    sender_account: null,
    items: [{ sku: "SKU-1", qty: 1, price_egp: 100 }],
    server_total_egp: 100,
    idempotency_key: null,
  };
}

interface Harness {
  store: MemoryStoreDb;
  executor: StoreExecutor;
  alerts: string[];
  notifies: string[];
  submits: number;
}

function makeHarness(opts: {
  snapshotCost?: number;
  onSubmit?: (store: MemoryStoreDb) => PurchaseOutcome;
} = {}): Harness {
  const store = new MemoryStoreDb();
  const alerts: string[] = [];
  const notifies: string[] = [];
  const h: Harness = {
    store,
    alerts,
    notifies,
    submits: 0,
    executor: null as unknown as StoreExecutor,
  };
  const adapter: SupplierAdapter = {
    key: "fake",
    secretValues: () => [],
    getBalance: () => Promise.resolve({ balance_usd: 100, currency: "USD" }),
    getSnapshot: () =>
      Promise.resolve({
        cost_usd: opts.snapshotCost ?? 1,
        stock: 10,
        available: true,
      }),
    submitPurchase: () => {
      h.submits++;
      if (opts.onSubmit) return Promise.resolve(opts.onSubmit(store));
      return Promise.resolve({
        kind: "delivered",
        external_ref: "EXT-1",
        delivery: [{ label: "الكود", value: "CODE-123" }],
        raw: {},
      } as PurchaseOutcome);
    },
    getPurchaseStatus: () =>
      Promise.resolve({
        kind: "processing",
        external_ref: "EXT-1",
        delivery: [],
        raw: {},
      } as PurchaseOutcome),
  };
  const deps: ExecutorDeps = {
    store,
    registry: {
      snapshot: () =>
        Promise.resolve({
          feed: "migo-provenance",
          version: 1,
          generated_at: new Date().toISOString(),
          records: [RECORD],
        }),
    },
    availability: { isOrderable: () => Promise.resolve(true) },
    adapters: new Map([["fake", adapter]]),
    flags: {
      globalEnabled: true,
      enabledProducts: new Set(["prod-1"]),
    },
    logError: () => {},
    notifyCustomer: (e) => {
      notifies.push(e.kind);
      return Promise.resolve(true);
    },
    alertAdmin: (m) => {
      alerts.push(m);
      return Promise.resolve();
    },
    now: () => new Date(),
  };
  h.executor = new StoreExecutor(deps);
  return h;
}

async function claimFor(
  h: Harness,
  order: StoreOrder,
) {
  h.store.addOrder(order);
  const { execution } = await h.store.claimExecution({
    order_ref: order.order_ref,
    sku: "SKU-1",
    product_key: "prod-1",
    supplier_key: "fake",
    listing_ref: "L1",
    reference: `store-${order.order_ref}-prod-1`,
    sell_egp: 100,
    quantity: 1,
  });
  return execution;
}

// ------------------------------------------------------------ 1) التنقية
Deno.test("W5#1: sanitizeRaw masks id values without breaking compact JSON", () => {
  const raw = {
    custom_id: "B-123",
    job_id: "J-9",
    status: "ok",
    data: { items: [{ code: "ABC-123" }] },
  };
  const out = sanitizeRaw(raw) as Record<string, unknown>;
  ok(!("text" in out), "sanitized payload stays a parsed object");
  eq(out.custom_id, "***", "custom_id value masked");
  eq(out.job_id, "***", "job_id value masked");
  eq(out.status, "ok", "unrelated fields untouched");
  eq(
    extractDeliveryItems(out),
    ["ABC-123"],
    "delivery items still extractable after sanitize",
  );
});

Deno.test("W5#1: sanitizeRaw masks unquoted numeric id values", () => {
  const out = sanitizeRaw({ job_id: 12345, state: "done" }) as Record<
    string,
    unknown
  >;
  ok(!("text" in out), "numeric id payload stays parsed");
  eq(out.job_id, "***", "numeric job_id masked");
  eq(out.state, "done", "state untouched");
});

// ------------------------------------------------------- 3) استخراج كائنات
Deno.test("W5#3: object list elements extract via known delivery keys", () => {
  eq(
    extractDeliveryItems({
      items: [{ code: "ABC-123" }, { code: "DEF-456" }, { other: "zz" }],
    }),
    ["ABC-123", "DEF-456"],
    "object elements yield their code values, never [object Object]",
  );
  const items = deliveryFromRaw({ items: [{ code: "ABC-123" }] });
  eq(items.map((i) => i.value), ["ABC-123"], "deliveryFromRaw list of objects");
  const single = deliveryFromRaw({ code: { code: "X1" } });
  eq(
    single.map((i) => i.value),
    ["X1"],
    "object value under a known key resolves via extraction",
  );
});

// ------------------------------------------------------------ 2) البوابة
Deno.test("W5#2: order cancelled after claim closes execution, no purchase", async () => {
  const h = makeHarness();
  const order = makeOrder("paid");
  const ex = await claimFor(h, order);
  await h.store.setOrderStatus(order.order_ref, "cancelled");
  const after = await h.executor.attemptExecution(ex, RECORD, order);
  eq(after.status, "manual_review", "execution closed for manual review");
  eq(after.last_error, "order_cancelled_after_claim", "close marker");
  eq(h.submits, 0, "supplier purchase never submitted");
  eq(h.alerts.length, 1, "exactly one admin alert");
});

Deno.test("W5#2: unpaid order never reaches the supplier", async () => {
  const h = makeHarness();
  const order = makeOrder("new");
  const ex = await claimFor(h, order);
  const after = await h.executor.attemptExecution(ex, RECORD, order);
  eq(after.status, "claimed", "execution left untouched");
  eq(h.submits, 0, "no purchase for unpaid order");
});

Deno.test("W5#2: executeOrder on a cancelled order is a no-op", async () => {
  const h = makeHarness();
  h.store.addOrder(makeOrder("cancelled"));
  const results = await h.executor.executeOrder("MG-W5-1");
  eq(results, [], "no item results for cancelled order");
  eq(h.store.executions.size, 0, "no execution claimed");
});

Deno.test("W5#2: delivery arriving after cancellation is held, customer not notified", async () => {
  const h = makeHarness({
    onSubmit: (store) => {
      // الإلغاء وصل أثناء ما الشراء عند المورد.
      store.orders.get("MG-W5-1")!.status = "cancelled";
      return {
        kind: "delivered",
        external_ref: "EXT-1",
        delivery: [{ label: "الكود", value: "CODE-123" }],
        raw: {},
      } as PurchaseOutcome;
    },
  });
  const order = makeOrder("paid");
  const ex = await claimFor(h, order);
  const after = await h.executor.attemptExecution(ex, RECORD, order);
  eq(after.status, "manual_review", "delivery held for manual review");
  eq(after.last_error, "delivered_after_order_cancelled", "held marker");
  eq(
    (after.delivery ?? []).map((d) => d.value),
    ["CODE-123"],
    "delivery data kept on the held record for the admin",
  );
  eq(h.notifies.length, 0, "customer never notified");
  eq(
    h.store.orders.get("MG-W5-1")?.status,
    "cancelled",
    "order not fulfilled after cancellation",
  );
});

// ------------------------------------------------- 4) فشل كتابة حالة الطلب
Deno.test("W5#4: PostgrestStoreDb.setOrderStatus throws on HTTP failure", async () => {
  const db = new PostgrestStoreDb({
    baseUrl: "https://db.invalid",
    keyOf: () => "k",
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response("boom", { status: 500 }));
  try {
    let threw = false;
    try {
      await db.setOrderStatus("MG-W5-1", "fulfilled");
    } catch {
      threw = true;
    }
    ok(threw, "non-2xx setOrderStatus must throw");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ------------------------------------------------------ 5) حداثة التغذية
Deno.test("W5#5: future-dated registry snapshot and availability feed rejected", async () => {
  const now = new Date("2026-11-23T00:00:00Z");
  const future = new Date(now.getTime() + 3600_000).toISOString();
  const reg = new JsonRegistrySource(
    () =>
      Promise.resolve({
        feed: "migo-provenance",
        version: 1,
        generated_at: future,
        records: [],
      }),
    () => now,
  );
  eq(await reg.snapshot(), null, "registry snapshot 1h in the future rejected");
  const feed = new FeedAvailabilitySource(
    () =>
      Promise.resolve({
        feed: "migo-availability",
        version: 1,
        generated_at: future,
        items: [{ sku: "SKU-1", orderable: true, reason: "" }],
      }),
    () => now,
  );
  eq(
    await feed.isOrderable("prod-1"),
    false,
    "availability feed 1h in the future rejected (fail-closed)",
  );
  const slight = new JsonRegistrySource(
    () =>
      Promise.resolve({
        feed: "migo-provenance",
        version: 1,
        generated_at: new Date(now.getTime() + 30_000).toISOString(),
        records: [],
      }),
    () => now,
  );
  ok(
    (await slight.snapshot()) !== null,
    "30s clock skew still accepted",
  );
});

// ------------------------------------------------------------ 6) الهامش
Deno.test("W5#6: margin block alerts once, not on every sweep", async () => {
  const h = makeHarness({ snapshotCost: 10 }); // floor 825 > sell 100
  const order = makeOrder("paid");
  const ex = await claimFor(h, order);
  const first = await h.executor.attemptExecution(ex, RECORD, order);
  eq(first.last_error, "margin_blocked", "first attempt margin-blocked");
  const stored = await h.store.getExecution(ex.id);
  const second = await h.executor.attemptExecution(stored!, RECORD, order);
  eq(second.last_error, "margin_blocked", "still margin-blocked");
  eq(h.alerts.length, 1, "admin alerted once across repeated sweeps");
  eq(h.submits, 0, "never purchased");
});
