// اختبارات وحدة موجة Instinct التالتة (البنود ١٥–٢٢) —
// `deno test control/wave3.test.ts`
// عملاء وهميون فوق بيانات في الذاكرة بس — مفيش أي نداء شبكة
// ولا قاعدة حقيقية. الأرقام والمراجع كلها وهمية عمدًا.
import type { BotProxyResult } from "./customers.ts";
import type { ControlStoreData } from "./mod.ts";
import type { StoreOrderRow } from "./orders.ts";
import type {
  DepositEventRow,
  SmsEventRow,
  StoreEventsFilter,
} from "./events.ts";
import type { StoreCouponRow } from "./coupons.ts";
import type { PaymentMethodRow, SiteContentRow } from "./site.ts";
import {
  type ControlWave3Deps,
  draftKeyLooksSecret,
  type DraftRow,
  type FollowupRow,
  handleControlWave3Request,
  laneOn,
  looksLikeSecretText,
  type PendingStoreTopupRow,
  providerSlugOf,
  type StoreTopupRow,
  type Wave3StoreClient,
} from "./wave3.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const NOW = new Date("2026-11-23T12:00:00.000Z");
const CUST_UUID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORDER_UUID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const FU_1 = "f1111111-1111-4111-8111-111111111111";

// ---------------------------------------------------------------- بوت وهمي
class FakeBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  failAll = false;
  botOrder: BotProxyResult | null = null;
  catalogProducts: Record<string, unknown>[] = [
    {
      id: "p1",
      name: "Gemini Pro",
      slug: "gemini-pro",
      status: "published",
      description: "وصف",
      category_id: "c1",
      sort_order: 1,
      executing: { provider_slug: "bunny" },
    },
    {
      id: "p2",
      name: "Canva Pro",
      slug: "canva",
      status: "published",
      provider_slug: "wasmou",
    },
    { id: "p3", name: "منتج قديم", slug: "old", status: "archived" },
  ];
  botOrders: Record<string, unknown>[] = [
    {
      id: "o1",
      product_id: "p1",
      provider_slug: "bunny",
      status: "processing",
      customer_ref: "111",
    },
    {
      id: "o2",
      product_id: "p1",
      provider_slug: "bunny",
      status: "delivered",
      customer_ref: "111",
    },
    {
      id: "o3",
      product_id: "p2",
      provider_slug: "wasmou",
      status: "processing",
      customer_ref: "222",
    },
  ];
  saveRejectIds = new Set<string>();

  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.failAll) return Promise.reject(new Error("bot down"));
    if (path === "/api/control/audit-log") {
      return Promise.resolve({ status: 200, body: { ok: true } });
    }
    if (path.startsWith("/api/control/chats")) {
      return Promise.resolve({
        status: 200,
        body: {
          ok: true,
          active: [
            {
              customer_ref: "111",
              unanswered: true,
              last_at: "2026-11-23T08:00:00Z",
            },
            {
              customer_ref: "111",
              unanswered: true,
              last_at: "2026-11-23T08:00:00Z",
            },
            {
              customer_ref: "222",
              unanswered: false,
              last_at: "2026-11-23T09:00:00Z",
            },
          ],
        },
      });
    }
    if (path.startsWith("/api/control/events-topups")) {
      const all = [
        {
          id: "bt1",
          status: "pending",
          customer_ref: "111",
          amount_minor: 50000,
          method_label: "فودافون كاش",
          operation_ref: "OP1",
          created_at: "2026-11-23T07:00:00Z",
        },
        {
          id: "bt2",
          status: "approved",
          customer_ref: "222",
          amount_minor: 10000,
          operation_ref: "OP2",
          created_at: "2026-11-23T07:30:00Z",
        },
      ];
      // البوت الحقيقي بيطبّق q عنده (اللوحة بتبعته أصلًا) — الوهمي
      // بيحاكيه بالفلترة على المرجع/المعرّف بدل ما يرجّع الكل.
      const q = new URLSearchParams(path.split("?")[1] || "").get("q");
      const topups = q
        ? all.filter((t) => t.id.includes(q) || t.operation_ref.includes(q))
        : all;
      return Promise.resolve({
        status: 200,
        body: { ok: true, topups },
      });
    }
    if (path.startsWith("/api/control/events-components")) {
      return Promise.resolve({
        status: 200,
        body: {
          ok: true,
          lanes: { sms_auto: true, exchange_auto: false, stars: true },
        },
      });
    }
    if (path.startsWith("/api/control/order?")) {
      if (this.botOrder) return Promise.resolve(this.botOrder);
      return Promise.resolve({
        status: 404,
        body: { ok: false, error: "not_found" },
      });
    }
    if (path.startsWith("/api/control/orders")) {
      return Promise.resolve({
        status: 200,
        body: { ok: true, orders: this.botOrders },
      });
    }
    if (path.startsWith("/api/control/customers/search")) {
      return Promise.resolve({
        status: 200,
        body: { ok: true, results: [{ id: "9001", name: "أحمد" }] },
      });
    }
    if (path.startsWith("/api/control/catalog-products")) {
      return Promise.resolve({
        status: 200,
        body: { ok: true, items: this.catalogProducts },
      });
    }
    if (path.startsWith("/api/control/catalog-identity")) {
      return Promise.resolve({
        status: 200,
        body: {
          ok: true,
          items: [
            {
              product_key: "k1",
              bot_product_id: "p1",
              store_sku: "Gemini Pro (سنة)",
            },
          ],
        },
      });
    }
    if (path.startsWith("/api/control/suppliers")) {
      return Promise.resolve({
        status: 200,
        body: {
          ok: true,
          suppliers: [{ slug: "bunny", name: "Bunny", active: true }],
        },
      });
    }
    if (path.startsWith("/api/control/supplier-products")) {
      return Promise.resolve({
        status: 200,
        body: { ok: true, items: [{ id: "sp1" }, { id: "sp2" }] },
      });
    }
    if (path.startsWith("/api/control/merchants")) {
      return Promise.resolve({
        status: 200,
        body: { ok: true, merchants: [{ id: "m1", name: "متجر النور" }] },
      });
    }
    if (path.startsWith("/api/control/preview-product")) {
      const pid = new URLSearchParams(path.split("?")[1] || "")
        .get("product_id");
      if (pid === "p1" || pid === "p2") {
        return Promise.resolve({
          status: 200,
          body: {
            ok: true,
            text: "بطاقة المنتج",
            has_photo: true,
            caption_mode: false,
            buttons: [[{ label: "اشتري" }]],
            internal_note: "must-not-leak",
          },
        });
      }
      return Promise.resolve({
        status: 404,
        body: { ok: false, error: "product_not_found" },
      });
    }
    if (path === "/api/control/catalog-product-save") {
      const pid = String(body?.product_id || "");
      if (this.saveRejectIds.has(pid)) {
        return Promise.resolve({
          status: 409,
          body: { ok: false, error: "state_changed" },
        });
      }
      return Promise.resolve({ status: 200, body: { ok: true } });
    }
    return Promise.resolve({ status: 200, body: { ok: true } });
  }
}

// ------------------------------------------------------- عملاء موقع وهميون
class FakeWave3Store implements Wave3StoreClient {
  followups: FollowupRow[] = [];
  drafts = new Map<string, DraftRow>();
  pendingTopups: PendingStoreTopupRow[] = [{
    id: "st1",
    customer_id: CUST_UUID,
    amount_egp: 300,
    payment_method: "vodafone",
    transfer_ref: "TR1",
    created_at: "2026-11-23T06:00:00Z",
  }];
  storeTopups = new Map<string, StoreTopupRow>([
    ["st1", {
      id: "st1",
      customer_id: CUST_UUID,
      amount_egp: 300,
      payment_method: "vodafone",
      transfer_ref: "TR1",
      created_at: "2026-11-23T06:00:00Z",
      status: "pending",
      sender_account: "0100",
      decided_at: null,
    }],
  ]);
  storeOrders: StoreOrderRow[] = [{
    id: ORDER_UUID,
    order_ref: "SO-1",
    customer_email: "a@b.co",
    items: [{ name: "Gemini Pro (سنة)" }],
    total_text: "300 ج.م",
    server_total: 300,
    status: "payment_confirmed",
    payment: "wallet",
    customer_id: CUST_UUID,
    created_at: "2026-11-23T05:00:00Z",
  }];
  private seq = 0;

  listFollowups(f: {
    status: string | null;
    entityKind: string | null;
    entityId: string | null;
  }) {
    return Promise.resolve(
      this.followups.filter((r) =>
        (!f.status || r.status === f.status) &&
        (!f.entityKind || r.entity_kind === f.entityKind) &&
        (!f.entityId || r.entity_id === f.entityId)
      ),
    );
  }
  insertFollowup(input: {
    entity_kind: string;
    entity_id: string;
    note: string;
    due_at: string | null;
  }) {
    this.seq++;
    const row: FollowupRow = {
      id: `f1111111-1111-4111-8111-11111111111${this.seq}`,
      ...input,
      status: "open",
      created_at: NOW.toISOString(),
      closed_at: null,
    };
    this.followups.push(row);
    return Promise.resolve(row);
  }
  getFollowup(id: string) {
    return Promise.resolve(this.followups.find((r) => r.id === id) ?? null);
  }
  closeFollowup(id: string, closedAtIso: string) {
    const row = this.followups.find((r) => r.id === id);
    if (!row || row.status !== "open") return Promise.resolve(null);
    row.status = "closed";
    row.closed_at = closedAtIso;
    return Promise.resolve(row);
  }
  getDraft(key: string) {
    return Promise.resolve(this.drafts.get(key) ?? null);
  }
  upsertDraft(key: string, text: string) {
    const prev = this.drafts.get(key);
    const row: DraftRow = {
      key,
      text,
      created_at: prev?.created_at ?? NOW.toISOString(),
      updated_at: new Date(NOW.getTime() + this.drafts.size * 1000)
        .toISOString(),
    };
    this.drafts.set(key, row);
    return Promise.resolve(row);
  }
  deleteDraft(key: string) {
    return Promise.resolve(this.drafts.delete(key));
  }
  listPendingStoreTopups() {
    return Promise.resolve(this.pendingTopups);
  }
  getStoreTopup(id: string) {
    return Promise.resolve(this.storeTopups.get(id) ?? null);
  }
  countPendingTopupsByMethod(method: string) {
    return Promise.resolve(
      this.pendingTopups.filter((t) => t.payment_method === method).length,
    );
  }
  listPendingTopupsByMethod(method: string) {
    return Promise.resolve(
      this.pendingTopups.filter((t) => t.payment_method === method),
    );
  }
  searchStoreOrders(q: string) {
    const ql = q.toLowerCase();
    return Promise.resolve(
      this.storeOrders.filter((o) =>
        String(o.order_ref || "").toLowerCase().includes(ql) ||
        String(o.customer_email || "").toLowerCase().includes(ql)
      ),
    );
  }
}

const STORE_HOME: ControlStoreData = {
  pending_topups_count: 1,
  pending_topups: [],
  unmatched_sms: 0,
  new_orders: 0,
  unmatched_exchange: 0,
  latest_sms_at: "2026-11-23T11:00:00Z",
  latest_deposit_at: null,
};

function makeDeps() {
  const bot = new FakeBotClient();
  const store = new FakeWave3Store();
  const homeData = { ...STORE_HOME };
  const botHomePayload: Record<string, unknown> = {
    ok: true,
    merchant_tasks: { failed_deliveries: 2 },
    queues: {},
  };
  const coupons = new Map<string, StoreCouponRow>([
    ["MIGO10", {
      code: "MIGO10",
      discount: 10,
      active: true,
      created_at: "2026-11-01T00:00:00Z",
      expires_at: null,
      max_uses: null,
      uses_count: 3,
      min_order_egp: null,
    }],
    ["OLD5", {
      code: "OLD5",
      discount: 5,
      active: false,
      created_at: "2026-11-01T00:00:00Z",
      expires_at: null,
      max_uses: null,
      uses_count: 0,
      min_order_egp: null,
    }],
  ]);
  const couponWrites: { code: string; patch: unknown }[] = [];
  const smsRows: SmsEventRow[] = [{
    id: "sms1",
    transfer_ref: "TRX9",
    sender_account: "0100",
    body: "تحويل",
    amount_egp: 500,
    match_state: "unmatched",
    matched_topup_id: null,
    matched_order_id: null,
    matched_bot_topup_id: null,
    ingested_at: "2026-11-23T04:00:00Z",
  }];
  const depRows: DepositEventRow[] = [{
    id: "dep1",
    rail: "binance",
    exchange_ref: "DEP9",
    amount_usdt: 10,
    outcome: "no_matching_intent",
    matched_intent_id: null,
    claim_id: null,
    matched_bot_topup_id: null,
    created_at: "2026-11-23T03:00:00Z",
  }];

  const deps: ControlWave3Deps = {
    store,
    homeStore: { fetchStoreData: () => Promise.resolve(homeData) },
    botHome: { fetchHome: () => Promise.resolve(botHomePayload) },
    botClient: bot,
    customers: {
      getUserById: (id: string) =>
        Promise.resolve(
          id === CUST_UUID ? { id, email: "ahmed@example.com" } : null,
        ),
      resolveEmail: (email: string) =>
        Promise.resolve(
          email === "ahmed@example.com" ? { id: CUST_UUID, email } : null,
        ),
      searchBySenderAccount: () =>
        Promise.resolve([{ id: CUST_UUID, balance_egp: 50 }]),
      walletBalance: () => Promise.resolve(50),
    },
    orders: {
      listOrders: () => Promise.resolve(store.storeOrders),
      getOrder: (id: string) =>
        Promise.resolve(store.storeOrders.find((o) => o.id === id) ?? null),
      findWalletPayDebit: (ref: string) =>
        Promise.resolve(
          ref === "SO-1" ? { customerId: CUST_UUID, amountEgp: 300 } : null,
        ),
    },
    events: {
      fetchSmsEvents: (f: StoreEventsFilter) =>
        Promise.resolve(
          smsRows.filter((r) => !f.q || String(r.transfer_ref).includes(f.q)),
        ),
      fetchDepositEvents: (f: StoreEventsFilter) =>
        Promise.resolve(
          depRows.filter((r) => !f.q || String(r.exchange_ref).includes(f.q)),
        ),
      getSmsEvent: (id: string) =>
        Promise.resolve(smsRows.find((r) => r.id === id) ?? null),
      getDepositEvent: (id: string) =>
        Promise.resolve(depRows.find((r) => r.id === id) ?? null),
    },
    coupons: {
      getCoupon: (code: string) => Promise.resolve(coupons.get(code) ?? null),
      updateCoupon: (code: string, patch) => {
        couponWrites.push({ code, patch });
        const cur = coupons.get(code);
        if (!cur) return Promise.resolve(null);
        const updated = { ...cur, ...patch };
        coupons.set(code, updated as StoreCouponRow);
        return Promise.resolve(updated as StoreCouponRow);
      },
    },
    site: {
      listPaymentMethods: () =>
        Promise.resolve([{ value: "vodafone", active: true, note: null }]),
      getPaymentMethod: (v: string) =>
        Promise.resolve(
          v === "vodafone"
            ? {
              value: "vodafone",
              active: true,
              note: null,
            } as PaymentMethodRow
            : null,
        ),
      listSiteContent: () =>
        Promise.resolve([{
          key: "faq",
          value: { items: [] },
          updated_at: "2026-11-20T00:00:00Z",
        }] as SiteContentRow[]),
    },
    prices: {
      getCatalog: () =>
        Promise.resolve([
          { sku: "Gemini Pro (سنة)", price: 300, kind: "ai" },
          { sku: "تيك توك كوينز - 100 عملة", price: 50, kind: "coins" },
        ]),
    },
    isAdmin: (r) => r.headers.get("x-migo-admin") === "k",
    corsOf: () => ({}),
    logError: () => {},
    now: () => NOW,
  };
  return { deps, bot, store, homeData, botHomePayload, coupons, couponWrites };
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
      ...(admin ? { "x-migo-admin": "k" } : {}),
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

// ---------------------------------------------------------------- المسارات
Deno.test("wave3: مسارات غريبة بترجع null", async () => {
  const { deps } = makeDeps();
  eq(await handleControlWave3Request(req("/control/home"), deps), null, "home");
  eq(
    await handleControlWave3Request(req("/control/notification"), deps),
    null,
    "singular",
  );
  eq(
    await handleControlWave3Request(req("/control/searchx"), deps),
    null,
    "searchx",
  );
});

Deno.test("wave3: بوابة الأدمن على كل المسارات قبل أي نداء", async () => {
  const { deps, bot } = makeDeps();
  const paths: [string, string, unknown?][] = [
    ["/control/notifications", "GET"],
    ["/control/search?q=x", "GET"],
    ["/control/followups", "GET"],
    ["/control/followups", "POST", {}],
    ["/control/followups-close", "POST", {}],
    ["/control/diagnose?kind=order&id=1", "GET"],
    ["/control/drafts?key=site:faq", "GET"],
    ["/control/drafts?key=site:faq", "PUT", { text: "x" }],
    ["/control/drafts?key=site:faq", "DELETE"],
    ["/control/impact?kind=product&id=p1", "GET"],
    ["/control/bulk", "POST", {}],
    ["/control/product-preview?id=p1", "GET"],
  ];
  for (const [p, m, b] of paths) {
    const res = await handleControlWave3Request(req(p, m, b, false), deps);
    eq(res?.status, 401, `${m} ${p}`);
  }
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("wave3: 405 قبل البوابة", async () => {
  const { deps, bot } = makeDeps();
  const cases: [string, string][] = [
    ["/control/notifications", "POST"],
    ["/control/bulk", "GET"],
    ["/control/drafts?key=site:faq", "POST"],
    ["/control/followups-close", "GET"],
    ["/control/product-preview?id=p1", "DELETE"],
  ];
  for (const [p, m] of cases) {
    const res = await handleControlWave3Request(
      req(p, m, undefined, false),
      deps,
    );
    eq(res?.status, 405, `${m} ${p}`);
  }
  eq(bot.calls.length, 0, "zero calls on 405");
});

// ---------------------------------------------------------------- ١٥
Deno.test("notifications: تجميع كل الأنواع + منع تكرار + أقدم أولًا", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(req("/control/notifications"), deps),
  );
  eq(b.ok, true, "ok");
  const items = b.items as Record<string, unknown>[];
  const kinds = items.map((i) => `${i.kind}:${i.ref}`);
  eq(kinds, [
    "store_topup_pending:st1",
    "bot_topup_pending:bt1",
    "unanswered_chat:111",
    "merchant_delivery_failed:merchant-failed-deliveries",
    "payment_component_down:lane:exchange_auto",
  ], "kinds deduped + oldest first + timeless last");
  const chat = items.find((i) => i.kind === "unanswered_chat");
  eq(chat?.since, "2026-11-23T08:00:00Z", "chat age carried");
  eq(chat?.target, { view: "chats", id: "111" }, "chat target opens the case");
  const st = items.find((i) => i.kind === "store_topup_pending");
  eq(
    st?.target,
    { view: "customers", id: CUST_UUID },
    "store topup target = customer file",
  );
  eq(b.unavailable, [], "nothing unavailable");
});

Deno.test("notifications: سكوت الرسائل فوق ٦ ساعات + فشل جزئي بيتصرح بيه", async () => {
  const { deps, homeData, bot } = makeDeps();
  homeData.latest_sms_at = "2026-11-23T01:00:00Z"; // 11h before NOW
  bot.failAll = true; // bot sources die; store sources must survive
  const b = await bodyOf(
    await handleControlWave3Request(req("/control/notifications"), deps),
  );
  eq(b.ok, true, "still ok with store-only data");
  const items = b.items as Record<string, unknown>[];
  ok(items.some((i) => i.ref === "sms-app-stale"), "stale sms item present");
  ok(
    items.some((i) => i.kind === "store_topup_pending"),
    "store topup still present",
  );
  const un = b.unavailable as string[];
  ok(
    un.includes("bot_chats") && un.includes("bot_topups") &&
      un.includes("payment_components"),
    "bot failures declared",
  );
});

Deno.test("notifications: كل المصادر واقعة = 502 صريح", async () => {
  const { deps, bot, store } = makeDeps();
  bot.failAll = true;
  store.listPendingStoreTopups = () => Promise.reject(new Error("db"));
  deps.homeStore = { fetchStoreData: () => Promise.reject(new Error("db")) };
  deps.botHome = { fetchHome: () => Promise.reject(new Error("bot")) };
  const res = await handleControlWave3Request(
    req("/control/notifications"),
    deps,
  );
  eq(res?.status, 502, "status");
  eq((await bodyOf(res)).error, "notifications_unavailable", "error");
});

// ---------------------------------------------------------------- ١٦
Deno.test("search: مجموعات مصنفة بمصدر ومعرّف لكل نتيجة", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(req("/control/search?q=Gemini"), deps),
  );
  const g = b.groups as Record<string, Record<string, unknown>[]>;
  ok(
    g.products.some((h) => h.source === "bot" && h.id === "p1"),
    "bot product hit",
  );
  ok(
    g.products.some((h) => h.source === "site" && h.id === "Gemini Pro (سنة)"),
    "site product hit",
  );
  const b2 = await bodyOf(
    await handleControlWave3Request(req("/control/search?q=TRX9"), deps),
  );
  const g2 = b2.groups as Record<string, Record<string, unknown>[]>;
  eq(g2.events.length, 1, "one event hit");
  eq(g2.events[0].identifier, "TRX9", "event identifier is its ref");
  const b3 = await bodyOf(
    await handleControlWave3Request(
      req("/control/search?q=ahmed@example.com"),
      deps,
    ),
  );
  const g3 = b3.groups as Record<string, Record<string, unknown>[]>;
  ok(
    g3.customers.some((h) => h.source === "site" && h.id === CUST_UUID),
    "site customer by email",
  );
  ok(
    g3.customers.some((h) => h.source === "bot" && h.id === "9001"),
    "bot customer hit",
  );
  const bad = await handleControlWave3Request(req("/control/search"), deps);
  eq(bad?.status, 400, "missing q = 400");
});

Deno.test("search: نفس الاسم لشخصين ما بيندمجوش — المعرّفات منفصلة", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(req("/control/search?q=0100"), deps),
  );
  const g = b.groups as Record<string, Record<string, unknown>[]>;
  // عميل موقع من حساب المرسل + عميل بوت من بحثه: نتيجتين بمعرّفين
  // مختلفين حتى لو الاسم/السياق متشابه — مفيش دمج بالاسم أبدًا.
  const ids = g.customers.map((h) => h.id);
  ok(
    ids.includes(CUST_UUID) && ids.includes("9001"),
    "both identifiers kept separate",
  );
});

// ---------------------------------------------------------------- ١٧
Deno.test("followups: إنشاء وقائمة وإغلاق — والإغلاق ما بيلمسش أي حاجة تانية", async () => {
  const { deps, bot, couponWrites } = makeDeps();
  const created = await bodyOf(
    await handleControlWave3Request(
      req("/control/followups", "POST", {
        entity_kind: "order",
        entity_id: "o1",
        note: "مستني رد المورد",
        due_at: "2026-11-24T09:00:00Z",
      }),
      deps,
    ),
  );
  eq(created.ok, true, "created");
  const fu = created.followup as Record<string, unknown>;
  eq(fu.status, "open", "starts open");

  const list = await bodyOf(
    await handleControlWave3Request(
      req("/control/followups?entity_kind=order"),
      deps,
    ),
  );
  eq((list.followups as unknown[]).length, 1, "listed");

  const botCallsBefore = bot.calls.length;
  const closed = await bodyOf(
    await handleControlWave3Request(
      req("/control/followups-close", "POST", { id: fu.id }),
      deps,
    ),
  );
  eq(closed.ok, true, "closed");
  eq(
    (closed.followup as Record<string, unknown>).status,
    "closed",
    "status closed",
  );
  eq(bot.calls.length, botCallsBefore, "close made zero bot calls");
  eq(couponWrites.length, 0, "close wrote no coupons");
  // إغلاق تاني = already من غير خطأ
  const again = await bodyOf(
    await handleControlWave3Request(
      req("/control/followups-close", "POST", { id: fu.id }),
      deps,
    ),
  );
  eq(again.already, true, "second close is already");
  // القائمة الافتراضية (المفتوحة) بقت فاضية
  const open = await bodyOf(
    await handleControlWave3Request(
      req("/control/followups"),
      deps,
    ),
  );
  eq((open.followups as unknown[]).length, 0, "open list empty after close");
});

Deno.test("followups: تحقق صارم من المدخلات", async () => {
  const { deps } = makeDeps();
  const badKind = await handleControlWave3Request(
    req("/control/followups", "POST", {
      entity_kind: "wallet",
      entity_id: "x",
      note: "n",
    }),
    deps,
  );
  eq(
    badKind?.status,
    400,
    "wallet kind rejected — followups never touch money entities as actions",
  );
  const badNote = await handleControlWave3Request(
    req("/control/followups", "POST", {
      entity_kind: "order",
      entity_id: "x",
      note: " ",
    }),
    deps,
  );
  eq(badNote?.status, 400, "empty note rejected");
  const badDue = await handleControlWave3Request(
    req("/control/followups", "POST", {
      entity_kind: "order",
      entity_id: "x",
      note: "n",
      due_at: "بكرة",
    }),
    deps,
  );
  eq(badDue?.status, 400, "bad due_at rejected");
  const missing = await handleControlWave3Request(
    req("/control/followups-close", "POST", { id: FU_1 }),
    deps,
  );
  eq(missing?.status, 404, "unknown followup = 404");
});

// ---------------------------------------------------------------- ١٨
Deno.test("diagnose: طلب بوت — أول نقطة غير مؤكدة وفعل موجود مقترح", async () => {
  const { deps, bot } = makeDeps();
  bot.botOrder = {
    status: 200,
    body: {
      ok: true,
      order: {
        id: "o9",
        status: "processing",
        customer_ref: "111",
        fulfillment: "provider",
      },
    },
  };
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/diagnose?kind=order&id=o9"),
      deps,
    ),
  );
  const cps = b.checkpoints as Record<string, unknown>[];
  eq(
    cps.map((c) => c.key),
    ["payment", "customer", "provider", "delivery"],
    "ordered checkpoints",
  );
  eq(cps[0].state, "confirmed", "payment confirmed from status");
  eq(
    cps[2].state,
    "unknown",
    "provider honestly unknown — no invented diagnosis",
  );
  eq(b.first_unconfirmed, "delivery", "delivery is first unconfirmed");
  eq(
    (b.suggested_action as Record<string, unknown>).id,
    "open_order_detail",
    "existing action suggested",
  );
});

Deno.test("diagnose: طلب موقع مدفوع من المحفظة + حدث وشحنة", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(
      req(`/control/diagnose?kind=order&id=${ORDER_UUID}`),
      deps,
    ),
  );
  const cps = b.checkpoints as Record<string, unknown>[];
  eq(cps[0].state, "confirmed", "wallet debit proves payment");
  ok(String(cps[0].detail).includes("محفظة"), "detail names the wallet proof");
  eq(cps[2].state, "unknown", "store provider state unknown, stated");

  const ev = await bodyOf(
    await handleControlWave3Request(
      req("/control/diagnose?kind=event&id=sms1"),
      deps,
    ),
  );
  eq(ev.first_unconfirmed, "customer", "unlinked event: linkage is first gap");
  const evDone = ev.checkpoints as Record<string, unknown>[];
  eq(evDone[0].state, "confirmed", "event amount recorded");

  const tp = await bodyOf(
    await handleControlWave3Request(
      req("/control/diagnose?kind=topup&id=st1"),
      deps,
    ),
  );
  eq(tp.first_unconfirmed, "decision", "pending topup: decision is first gap");
  eq(
    (tp.suggested_action as Record<string, unknown>).id,
    "decide_topup",
    "decide action",
  );

  const nf = await handleControlWave3Request(
    req("/control/diagnose?kind=event&id=nope"),
    deps,
  );
  eq(nf?.status, 404, "unknown event = 404");
  const bk = await handleControlWave3Request(
    req("/control/diagnose?kind=wallet&id=x"),
    deps,
  );
  eq(bk?.status, 400, "bad kind = 400");
});

// ---------------------------------------------------------------- ١٩
Deno.test("drafts: حفظ وقراءة وحذف + وقت تحديث الأصل لمحتوى الموقع", async () => {
  const { deps } = makeDeps();
  const put = await bodyOf(
    await handleControlWave3Request(
      req("/control/drafts?key=site:faq", "PUT", {
        text: "س: إزاي أشحن؟ ج: من صفحة المحفظة.",
      }),
      deps,
    ),
  );
  eq(put.ok, true, "put ok");
  const got = await bodyOf(
    await handleControlWave3Request(
      req("/control/drafts?key=site:faq"),
      deps,
    ),
  );
  eq(
    (got.draft as Record<string, unknown>).text,
    "س: إزاي أشحن؟ ج: من صفحة المحفظة.",
    "draft roundtrip",
  );
  eq(
    got.source_updated_at,
    "2026-11-20T00:00:00Z",
    "site_content faq updated_at exposed",
  );
  const del = await bodyOf(
    await handleControlWave3Request(
      req("/control/drafts?key=site:faq", "DELETE"),
      deps,
    ),
  );
  eq(del.deleted, true, "deleted");
  const gone = await bodyOf(
    await handleControlWave3Request(
      req("/control/drafts?key=site:faq"),
      deps,
    ),
  );
  eq(gone.draft, null, "gone after delete");
});

Deno.test("drafts: الأسرار مرفوضة في المفتاح والقيمة، والنص الطويل العادي بيعدي", async () => {
  const { deps } = makeDeps();
  const secretKey = await handleControlWave3Request(
    req("/control/drafts?key=support:api_token", "PUT", { text: "نص" }),
    deps,
  );
  eq(secretKey?.status, 400, "secret-ish key rejected");
  eq((await bodyOf(secretKey)).error, "secret_not_allowed", "secret key error");

  const badValues = [
    "password: hunter2",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3AAAAA",
    "sk-abcdefghijklmnopqrstuvwxyz0123456789",
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  ];
  for (const v of badValues) {
    const res = await handleControlWave3Request(
      req("/control/drafts?key=channel:post1", "PUT", { text: v }),
      deps,
    );
    eq(res?.status, 400, `secret value rejected: ${v.slice(0, 12)}…`);
    eq((await bodyOf(res)).error, "secret_like_content", "secret value error");
  }
  const longText = "منشور جديد: وصلتنا باقات جديدة بأسعار أحسن، " +
    "والتفاصيل كاملة في البوت. ".repeat(10);
  const good = await handleControlWave3Request(
    req("/control/drafts?key=channel:post1", "PUT", { text: longText }),
    deps,
  );
  eq(good?.status, 200, "long normal Arabic text accepted");

  const badKey = await handleControlWave3Request(
    req("/control/drafts?key=wallet:main", "PUT", { text: "نص" }),
    deps,
  );
  eq(badKey?.status, 400, "non-editor key rejected");
});

Deno.test("drafts: تعارض base_updated_at = 409 بوقت النسخة الحالية", async () => {
  const { deps } = makeDeps();
  const first = await bodyOf(
    await handleControlWave3Request(
      req("/control/drafts?key=support:reply1", "PUT", { text: "أهلًا بيك" }),
      deps,
    ),
  );
  const ts = (first.draft as Record<string, unknown>).updated_at;
  const stale = await handleControlWave3Request(
    req("/control/drafts?key=support:reply1", "PUT", {
      text: "تعديل",
      base_updated_at: "2020-01-01T00:00:00Z",
    }),
    deps,
  );
  eq(stale?.status, 409, "stale base = 409");
  eq(
    (await bodyOf(stale)).current_updated_at,
    ts,
    "current timestamp returned",
  );
  const fresh = await handleControlWave3Request(
    req("/control/drafts?key=support:reply1", "PUT", {
      text: "تعديل",
      base_updated_at: ts,
    }),
    deps,
  );
  eq(fresh?.status, 200, "matching base writes fine");
});

// ---------------------------------------------------------------- ٢٠
Deno.test("impact supplier: منتجات مربوطة وطلبات مفتوحة مثبتة بس", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/impact?kind=supplier&id=bunny"),
      deps,
    ),
  );
  const neo = b.new_purchases as Record<string, unknown>;
  const linked = neo.linked_products as Record<string, unknown>[];
  eq(linked.map((p) => p.id), ["p1"], "only bunny-linked product proven");
  eq(neo.supplier_listings_count, 2, "supplier listings counted");
  const ex = b.existing_orders as Record<string, unknown>;
  const open = ex.open_orders as Record<string, unknown>[];
  eq(
    open.map((o) => o.id),
    ["o1"],
    "only the open bunny order (delivered excluded)",
  );
  eq(b.unknowns, [], "no unknowns when linkage is visible");
  const nf = await handleControlWave3Request(
    req("/control/impact?kind=supplier&id=ghost"),
    deps,
  );
  eq(nf?.status, 404, "unknown supplier = 404");
});

Deno.test("impact supplier: غياب حقول الربط = unknowns صريحة بدل اختراع", async () => {
  const { deps, bot } = makeDeps();
  bot.catalogProducts = [{ id: "p9", name: "X", status: "published" }];
  bot.botOrders = [{ id: "o9", status: "processing" }];
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/impact?kind=supplier&id=bunny"),
      deps,
    ),
  );
  const unknowns = b.unknowns as string[];
  ok(unknowns.length >= 2, "linkage + orders unknowns declared");
  const neo = b.new_purchases as Record<string, unknown>;
  eq(neo.linked_products, [], "nothing claimed without proof");
});

Deno.test("impact product + paymethod: أسطح وطلبات قائمة منفصلة", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/impact?kind=product&id=p1"),
      deps,
    ),
  );
  const np = b.new_purchases as Record<string, unknown>;
  eq(np.bot_surface_live, true, "bot surface live (published)");
  eq(np.site_surface_live, true, "site surface live (sku in catalog)");
  eq(np.site_price, 300, "site price proven");
  const ex = b.existing_orders as Record<string, unknown>;
  eq((ex.open_bot_orders as unknown[]).length, 1, "one open bot order");
  eq(
    (ex.open_store_orders as unknown[]).length,
    1,
    "one open store order via sku items",
  );

  const pm = await bodyOf(
    await handleControlWave3Request(
      req("/control/impact?kind=paymethod&id=vodafone"),
      deps,
    ),
  );
  const pex = pm.existing_orders as Record<string, unknown>;
  eq(pex.pending_store_topups_count, 1, "pending topups on the method counted");
  eq(
    (pm.new_purchases as Record<string, unknown>).store_surface_enabled,
    true,
    "store surface enabled",
  );
  ok(
    (pm.unknowns as string[]).some((u) => u.includes("البوت")),
    "bot-side enablement declared unknown",
  );
  const nf = await handleControlWave3Request(
    req("/control/impact?kind=paymethod&id=cash"),
    deps,
  );
  eq(nf?.status, 404, "unknown paymethod = 404");
});

// ---------------------------------------------------------------- ٢١
Deno.test("bulk: أي فعل فلوس أو فعل غريب مرفوض صراحة", async () => {
  const { deps } = makeDeps();
  for (
    const action of [
      "wallet.adjust",
      "topup.approve",
      "orders.refund",
      "catalog.delete",
      "",
    ]
  ) {
    const res = await handleControlWave3Request(
      req("/control/bulk", "POST", { action, ids: ["x"] }),
      deps,
    );
    eq(res?.status, 400, `action ${action || "(empty)"} rejected`);
    eq((await bodyOf(res)).error, "action_not_allowed", "plain error");
  }
  const badIds = await handleControlWave3Request(
    req("/control/bulk", "POST", { action: "coupons.stop", ids: [] }),
    deps,
  );
  eq(badIds?.status, 400, "empty ids rejected");
});

Deno.test("bulk catalog.archive: نتيجة لكل عنصر عبر مسار الحفظ القائم", async () => {
  const { deps, bot } = makeDeps();
  bot.saveRejectIds.add("p2");
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/bulk", "POST", {
        action: "catalog.archive",
        ids: ["p1", "p3", "nope", "p2"],
      }),
      deps,
    ),
  );
  const results = b.results as Record<string, unknown>[];
  eq(results.map((r) => [r.id, r.ok]), [
    ["p1", true],
    ["p3", true],
    ["nope", false],
    ["p2", false],
  ], "per-item outcomes");
  eq(results[1].already, true, "already-archived reported, not re-saved");
  eq(results[2].error, "not_found", "missing product fails alone");
  eq(results[3].error, "state_changed", "bot rejection surfaces per item");
  eq(b.succeeded, 2, "succeeded count");
  eq(b.failed, 2, "failed count");
  const save = bot.calls.find((c) =>
    c.path === "/api/control/catalog-product-save" &&
    c.body?.product_id === "p1"
  );
  ok(save !== undefined, "existing save flow used");
  eq(save?.body?.status, "archived", "archive via status");
  eq(save?.body?.name, "Gemini Pro", "current fields preserved in the save");
});

Deno.test("bulk coupons.stop: إيقاف بنفس قيم الكوبون + already + not_found", async () => {
  const { deps, couponWrites, coupons } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/bulk", "POST", {
        action: "coupons.stop",
        ids: ["MIGO10", "OLD5", "NOPE"],
      }),
      deps,
    ),
  );
  const results = b.results as Record<string, unknown>[];
  eq(results.map((r) => [r.id, r.ok]), [
    ["MIGO10", true],
    ["OLD5", true],
    ["NOPE", false],
  ], "per-item outcomes");
  eq(results[1].already, true, "inactive coupon already");
  eq(couponWrites.length, 1, "one write only");
  eq(couponWrites[0].code, "MIGO10", "write target");
  const patch = couponWrites[0].patch as Record<string, unknown>;
  eq(patch.active, false, "stopped");
  eq(patch.discount, 10, "discount preserved (percent at panel boundary)");
  eq(coupons.get("MIGO10")?.active, false, "coupon now inactive");
});

// ---------------------------------------------------------------- ٢٢
Deno.test("product-preview: جهتين جنب بعض وقائمة بيضاء لحقول البوت", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/product-preview?id=p1"),
      deps,
    ),
  );
  const botSide = b.bot as Record<string, unknown>;
  eq(botSide.available, true, "bot side available");
  const prev = botSide.preview as Record<string, unknown>;
  eq(prev.text, "بطاقة المنتج", "bot preview text");
  eq(prev.internal_note, undefined, "non-display fields never pass through");
  const siteSide = b.site as Record<string, unknown>;
  eq(siteSide.available, true, "site side available");
  eq(
    (siteSide.presentation as Record<string, unknown>).price,
    300,
    "site price",
  );
});

Deno.test("product-preview: غياب جهة بيتصرح بيه بسببها — مفيش محاكاة", async () => {
  const { deps } = makeDeps();
  const b = await bodyOf(
    await handleControlWave3Request(
      req("/control/product-preview?id=p2"),
      deps,
    ),
  );
  eq((b.bot as Record<string, unknown>).available, true, "bot side fine");
  const siteSide = b.site as Record<string, unknown>;
  eq(siteSide.available, false, "site side unavailable");
  eq(siteSide.reason, "no_identity_link", "reason: no identity link");

  const bx = await bodyOf(
    await handleControlWave3Request(
      req("/control/product-preview?id=px"),
      deps,
    ),
  );
  eq(
    (bx.bot as Record<string, unknown>).available,
    false,
    "bot side unavailable",
  );
  eq(
    (bx.bot as Record<string, unknown>).reason,
    "product_not_found",
    "bot reason passes through",
  );
});

// ---------------------------------------------------------------- نقي
Deno.test("pure: كشف الأسرار والممرات والمزوّد", () => {
  eq(draftKeyLooksSecret("support:api_token"), true, "token word in key");
  eq(draftKeyLooksSecret("site:monkey"), false, "monkey is not a secret word");
  eq(draftKeyLooksSecret("channel:post1"), false, "plain editor key");
  eq(
    looksLikeSecretText("منشور عادي طويل عن العروض الجديدة"),
    false,
    "plain text",
  );
  eq(
    looksLikeSecretText("-----BEGIN RSA PRIVATE KEY-----"),
    true,
    "private key",
  );
  eq(
    laneOn({ lanes: { sms_auto: { enabled: false } } }, "sms_auto"),
    false,
    "lane object shape",
  );
  eq(
    laneOn({ components: [{ key: "stars", on: true }] }, "stars"),
    true,
    "components shape",
  );
  eq(laneOn({}, "stars"), null, "absent lane = unknown");
  eq(
    providerSlugOf({ executing: { provider_slug: "bunny" } }),
    "bunny",
    "executing slug",
  );
  eq(
    providerSlugOf({ name: "x" }),
    "",
    "no provider field = empty, not invented",
  );
});
