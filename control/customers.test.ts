/**
 * اختبارات عملاء/محافظ لوحة التحكم (المرحلة م١-أ) —
 * `deno test control/` من غير أي استيراد خارجي (offline بالكامل):
 * عميل موقع وعميل بوت وهميان، والمعالج بيتركب عليهم مباشرة.
 *
 * التغطية: بوابة الأدمن قبل أي نداء على كل المسارات، ملف عميل
 * الموقع (id + إيميل)، فشل حل الإيميل = 404 صادق، قرار شحنة
 * محسوم = 409، «اضبط على» بيتنفّذ بدالة الضبط الذرّية (الهدف
 * بيعدّي زي ما هو، ومفيش قراءة رصيد في طبقة Deno)، خصم فوق
 * الرصيد = 422، تعارض ref = 409، مبالغ ملوّثة النوع أو أعمق من
 * قرشين = 400، تمرير أخطاء البوت بحالتها (409/422)، فشل اتصال
 * البوت = bot_unavailable، وأشكال البحث الموحد.
 */
import {
  type AuthUser,
  type BotControlProxyClient,
  type BotProxyResult,
  type ControlCustomersClient,
  type ControlCustomersDeps,
  handleControlCustomersRequest,
  type SenderAccountMatch,
  type StoreCustomerData,
} from "./customers.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const TOPUP_ID = "33333333-3333-4333-8333-333333333333";

const CUSTOMER_DATA: StoreCustomerData = {
  customer: { id: CUSTOMER_ID, email: "cust@example.com", balance_egp: 100 },
  topups: [{
    id: TOPUP_ID,
    amount_egp: 200,
    payment_method: "vodafone",
    sender_account: "01001500005",
    status: "pending",
    created_at: "2026-11-19T18:00:00.000Z",
  }],
  transactions: [{
    id: "44444444-4444-4444-8444-444444444444",
    kind: "topup",
    amount_egp: 100,
    ref: "topup:x",
    created_at: "2026-11-19T17:00:00.000Z",
  }],
  orders: [],
};

class FakeCustomersClient implements ControlCustomersClient {
  calls: string[] = [];
  balance = 100;
  user: AuthUser | null = { id: CUSTOMER_ID, email: "cust@example.com" };
  resolveResult: AuthUser | null = {
    id: CUSTOMER_ID,
    email: "cust@example.com",
  };
  creditResult: Record<string, unknown> = {
    credited: true,
    amount_egp: 200,
    balance_after: 300,
  };
  rejectResult: Record<string, unknown> = { rejected: true };
  adjustResult: Record<string, unknown> = {
    adjusted: true,
    balance_after: 250,
  };
  adjustError: Error | null = null;
  lastAdjust: Record<string, unknown> | null = null;
  setResult: Record<string, unknown> = {
    adjusted: true,
    balance_after: 250,
  };
  setError: Error | null = null;
  lastSet: Record<string, unknown> | null = null;
  senderMatches: SenderAccountMatch[] = [];

  resolveEmail(_email: string): Promise<AuthUser | null> {
    this.calls.push("resolveEmail");
    return Promise.resolve(this.resolveResult);
  }
  getUserById(_id: string): Promise<AuthUser | null> {
    this.calls.push("getUserById");
    return Promise.resolve(this.user);
  }
  walletBalance(_customerId: string): Promise<number> {
    this.calls.push("walletBalance");
    return Promise.resolve(this.balance);
  }
  fetchStoreCustomer(
    id: string,
    email: string | null,
  ): Promise<StoreCustomerData> {
    this.calls.push("fetchStoreCustomer");
    return Promise.resolve({
      ...CUSTOMER_DATA,
      customer: { id, email, balance_egp: this.balance },
    });
  }
  creditTopupInternal(
    _topupId: string,
    _note: string | null,
  ): Promise<Record<string, unknown>> {
    this.calls.push("creditTopupInternal");
    return Promise.resolve(this.creditResult);
  }
  rejectTopupInternal(
    _topupId: string,
    _note: string | null,
  ): Promise<Record<string, unknown>> {
    this.calls.push("rejectTopupInternal");
    return Promise.resolve(this.rejectResult);
  }
  adjustInternal(args: {
    customerId: string;
    delta: number;
    kind: string;
    ref: string;
    note: string;
  }): Promise<Record<string, unknown>> {
    this.calls.push("adjustInternal");
    this.lastAdjust = { ...args };
    if (this.adjustError) return Promise.reject(this.adjustError);
    return Promise.resolve(this.adjustResult);
  }
  setBalanceInternal(args: {
    customerId: string;
    target: number;
    kind: string;
    ref: string;
    note: string;
  }): Promise<Record<string, unknown>> {
    this.calls.push("setBalanceInternal");
    this.lastSet = { ...args };
    if (this.setError) return Promise.reject(this.setError);
    return Promise.resolve(this.setResult);
  }
  searchBySenderAccount(_q: string): Promise<SenderAccountMatch[]> {
    this.calls.push("searchBySenderAccount");
    return Promise.resolve(this.senderMatches);
  }
}

class FakeBotProxy implements BotControlProxyClient {
  calls: string[] = [];
  fail = false;
  result: BotProxyResult = { status: 200, body: { ok: true } };
  lastPath = "";
  proxy(
    _method: string,
    path: string,
    _body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push("proxy");
    this.lastPath = path;
    if (this.fail) return Promise.reject(new Error("bot boom"));
    return Promise.resolve(this.result);
  }
}

function deps(
  client: FakeCustomersClient,
  bot: FakeBotProxy,
): ControlCustomersDeps {
  return {
    client,
    botClient: bot,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(
  path: string,
  opts: { key?: string; method?: string; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = {};
  if (opts.key) headers["x-migo-admin"] = opts.key;
  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`https://api.example${path}`, init);
}

const ALL_ROUTES: Array<[string, { method?: string; body?: unknown }]> = [
  [`/control/store-customer?id=${CUSTOMER_ID}`, {}],
  ["/control/store-topup-decide", {
    method: "POST",
    body: { topup_id: TOPUP_ID, action: "approve" },
  }],
  ["/control/store-wallet-adjust", {
    method: "POST",
    body: {
      customer_id: CUSTOMER_ID,
      mode: "add",
      amount_egp: 50,
      kind: "deposit",
      reason: "تصحيح",
      idempotency_key: "k-1",
    },
  }],
  ["/control/bot-customer?ref=123", {}],
  ["/control/bot-topup-decide", { method: "POST", body: { request_id: "x" } }],
  ["/control/bot-wallet-adjust", { method: "POST", body: {} }],
  ["/control/bot-wallet-transfer", { method: "POST", body: {} }],
  ["/control/bot-wallet-reverse", { method: "POST", body: {} }],
  ["/control/customers/search?q=123", {}],
];

Deno.test("foreign paths return null", async () => {
  const d = deps(new FakeCustomersClient(), new FakeBotProxy());
  eq(
    await handleControlCustomersRequest(
      req("/control/home", { key: ADMIN_KEY }),
      d,
    ),
    null,
    "home path is not ours",
  );
  eq(
    await handleControlCustomersRequest(
      req("/wallet/sms", { key: ADMIN_KEY }),
      d,
    ),
    null,
    "foreign path",
  );
});

Deno.test("admin gate blocks every route before any call", async () => {
  for (const [path, opts] of ALL_ROUTES) {
    const client = new FakeCustomersClient();
    const bot = new FakeBotProxy();
    const res = await handleControlCustomersRequest(
      req(path, { ...opts, key: "wrong-key" }),
      deps(client, bot),
    );
    eq(res?.status, 401, `401 for ${path}`);
    eq(client.calls.length, 0, `store untouched for ${path}`);
    eq(bot.calls.length, 0, `bot untouched for ${path}`);
  }
});

Deno.test("wrong method is 405 on read and write routes", async () => {
  const d = deps(new FakeCustomersClient(), new FakeBotProxy());
  const postOnRead = await handleControlCustomersRequest(
    req(`/control/store-customer?id=${CUSTOMER_ID}`, {
      key: ADMIN_KEY,
      method: "POST",
      body: {},
    }),
    d,
  );
  eq(postOnRead?.status, 405, "POST on a GET route");
  const getOnWrite = await handleControlCustomersRequest(
    req("/control/bot-wallet-adjust", { key: ADMIN_KEY }),
    d,
  );
  eq(getOnWrite?.status, 405, "GET on a POST route");
});

Deno.test("store customer by id returns the full file", async () => {
  const res = await handleControlCustomersRequest(
    req(`/control/store-customer?id=${CUSTOMER_ID}`, { key: ADMIN_KEY }),
    deps(new FakeCustomersClient(), new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.customer.id, CUSTOMER_ID, "customer id");
  eq(body.customer.email, "cust@example.com", "email from auth");
  eq(body.customer.balance_egp, 100, "balance");
  eq(body.topups.length, 1, "topups listed");
  eq(body.transactions.length, 1, "transactions listed");
});

Deno.test("store customer by email resolves through auth", async () => {
  const res = await handleControlCustomersRequest(
    req("/control/store-customer?email=cust@example.com", { key: ADMIN_KEY }),
    deps(new FakeCustomersClient(), new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.customer.id, CUSTOMER_ID, "resolved id");
});

Deno.test("unresolvable email is an honest 404", async () => {
  const client = new FakeCustomersClient();
  client.resolveResult = null;
  const res = await handleControlCustomersRequest(
    req("/control/store-customer?email=ghost@example.com", { key: ADMIN_KEY }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 404, "status");
  const body = await res!.json();
  eq(body.error, "not_found", "error");
  ok(!client.calls.includes("fetchStoreCustomer"), "no file fabricated");
});

Deno.test("store topup approve credits through the internal rpc", async () => {
  const client = new FakeCustomersClient();
  const res = await handleControlCustomersRequest(
    req("/control/store-topup-decide", {
      key: ADMIN_KEY,
      method: "POST",
      body: { topup_id: TOPUP_ID, action: "approve" },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.credited, true, "credited flag passes through");
  ok(client.calls.includes("creditTopupInternal"), "credit rpc called");
});

Deno.test("store topup decide on a decided topup is 409", async () => {
  const client = new FakeCustomersClient();
  client.creditResult = { already: true, status: "credited" };
  const res = await handleControlCustomersRequest(
    req("/control/store-topup-decide", {
      key: ADMIN_KEY,
      method: "POST",
      body: { topup_id: TOPUP_ID, action: "approve" },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 409, "status");
  const body = await res!.json();
  eq(body.error, "already_decided", "error");
  eq(body.status, "credited", "current status reported");
});

Deno.test("store wallet adjust set mode calls the atomic set rpc", async () => {
  const client = new FakeCustomersClient();
  const res = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 250,
        kind: "correction",
        reason: "تسوية",
        idempotency_key: "k-set-1",
      },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  // الهدف بيعدّي زي ما هو — الفرق بيتحسب جوه القاعدة (هجرة 023)،
  // فمفيش لا قراءة رصيد ولا نداء adjust من طبقة Deno.
  eq(client.lastSet?.target, 250, "target passes through untouched");
  eq(client.lastSet?.ref, "panel:k-set-1", "ref carries the panel key");
  eq(client.lastSet?.note, "[correction] تسوية", "note carries kind+reason");
  ok(!client.calls.includes("walletBalance"), "no TS-side balance read");
  ok(!client.calls.includes("adjustInternal"), "adjust rpc not used for set");
  const body = await res!.json();
  eq(body.adjusted, true, "adjusted");
  eq(body.balance_after, 250, "balance after");
});

Deno.test("store wallet adjust set downwards passes the lower target", async () => {
  const client = new FakeCustomersClient();
  client.setResult = { adjusted: true, balance_after: 40 };
  const res = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 40,
        kind: "correction",
        reason: "خصم زيادة",
        idempotency_key: "k-set-2",
      },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  eq(client.lastSet?.target, 40, "lower target passes through");
  const body = await res!.json();
  eq(body.adjusted, true, "adjusted");
  eq(body.balance_after, 40, "balance after");
});

Deno.test("store wallet adjust set to the current balance still consumes the ref", async () => {
  const client = new FakeCustomersClient();
  client.setResult = { adjusted: false, balance_after: 100 };
  const res = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 100,
        kind: "correction",
        reason: "تثبيت",
        idempotency_key: "k-set-3",
      },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.adjusted, false, "no movement");
  eq(body.balance_after, 100, "balance after");
  // الفرق عن نسخة 022: الدالة بتتنادى حتى لو الهدف = الرصيد، عشان
  // الـ ref يستهلك في القاعدة (قيد [set-noop]) وإعادة الطلب ما
  // تتحركش بعد أي حركة رصيد لاحقة.
  ok(client.calls.includes("setBalanceInternal"), "set rpc consumes the ref");
});

Deno.test("store wallet adjust set replay returns already", async () => {
  const client = new FakeCustomersClient();
  client.setResult = { already: true, balance_after: 250 };
  const res = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 250,
        kind: "correction",
        reason: "تسوية",
        idempotency_key: "k-set-1",
      },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.already, true, "already flag");
  eq(body.balance_after, 250, "balance after");
});

Deno.test("store wallet adjust ref conflict is 409 on both paths", async () => {
  const conflict = new Error(
    'rpc wallet_adjust_internal http 400: {"code":"P0001","message":"ref_conflict"}',
  );
  const addClient = new FakeCustomersClient();
  addClient.adjustError = conflict;
  const addRes = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "add",
        amount_egp: 50,
        kind: "deposit",
        reason: "شحن",
        idempotency_key: "k-shared",
      },
    }),
    deps(addClient, new FakeBotProxy()),
  );
  eq(addRes?.status, 409, "add path status");
  eq((await addRes!.json()).error, "ref_conflict", "add path error");

  const setClient = new FakeCustomersClient();
  setClient.setError = new Error(
    'rpc wallet_set_balance_internal http 400: {"code":"P0001","message":"ref_conflict"}',
  );
  const setRes = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 250,
        kind: "correction",
        reason: "تسوية",
        idempotency_key: "k-shared",
      },
    }),
    deps(setClient, new FakeBotProxy()),
  );
  eq(setRes?.status, 409, "set path status");
  eq((await setRes!.json()).error, "ref_conflict", "set path error");
});

Deno.test("store wallet adjust unknown customer is 404 on both paths", async () => {
  // إصلاح تجربة قبول م١-أ (هجرة 024): عميل مش موجود في auth.users
  // كان بيتعمل له محفظة وبيتقيّد له رصيد — دلوقتي رفض 404.
  const addClient = new FakeCustomersClient();
  addClient.adjustError = new Error(
    'rpc wallet_adjust_internal http 400: {"code":"P0001","message":"customer_not_found"}',
  );
  const addRes = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "add",
        amount_egp: 50,
        kind: "deposit",
        reason: "شحن",
        idempotency_key: "k-ghost",
      },
    }),
    deps(addClient, new FakeBotProxy()),
  );
  eq(addRes?.status, 404, "add path status");
  eq((await addRes!.json()).error, "customer_not_found", "add path error");

  const setClient = new FakeCustomersClient();
  setClient.setError = new Error(
    'rpc wallet_set_balance_internal http 400: {"code":"P0001","message":"customer_not_found"}',
  );
  const setRes = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 250,
        kind: "correction",
        reason: "تسوية",
        idempotency_key: "k-ghost",
      },
    }),
    deps(setClient, new FakeBotProxy()),
  );
  eq(setRes?.status, 404, "set path status");
  eq((await setRes!.json()).error, "customer_not_found", "set path error");
});

Deno.test("store wallet adjust rejects non-number and sub-piaster amounts", async () => {
  // إصلاح مراجعة م١-أ: التحويل الضمني كان بيعدّي "" و null و false
  // كـ 0 و true كـ 1، وكسور أعمق من قرشين بتتقصّ بصمت في القاعدة.
  const badAmounts: unknown[] = ["", null, true, false, "10", 0.004, 10.005];
  for (const amount of badAmounts) {
    const client = new FakeCustomersClient();
    const res = await handleControlCustomersRequest(
      req("/control/store-wallet-adjust", {
        key: ADMIN_KEY,
        method: "POST",
        body: {
          customer_id: CUSTOMER_ID,
          mode: "add",
          amount_egp: amount,
          kind: "deposit",
          reason: "شحن",
          idempotency_key: "k-bad-amt",
        },
      }),
      deps(client, new FakeBotProxy()),
    );
    eq(res?.status, 400, `amount ${JSON.stringify(amount)} rejected`);
    eq((await res!.json()).error, "bad_amount", "error");
    ok(!client.calls.includes("adjustInternal"), "rpc untouched");
  }
  const goodAmounts = [10, 10.5, 10.25];
  for (const amount of goodAmounts) {
    const client = new FakeCustomersClient();
    const res = await handleControlCustomersRequest(
      req("/control/store-wallet-adjust", {
        key: ADMIN_KEY,
        method: "POST",
        body: {
          customer_id: CUSTOMER_ID,
          mode: "add",
          amount_egp: amount,
          kind: "deposit",
          reason: "شحن",
          idempotency_key: "k-good-amt",
        },
      }),
      deps(client, new FakeBotProxy()),
    );
    eq(res?.status, 200, `amount ${amount} accepted`);
    eq(client.lastAdjust?.delta, amount, "delta passes through");
  }
});

Deno.test("store wallet adjust rejects non-number and sub-piaster targets", async () => {
  // أخطر حالة: target_egp فاضي كان بيتحوّل 0 = «اضبط على صفر»
  // (تصفير المحفظة كاملة) — دلوقتي 400 قبل أي نداء.
  const badTargets: unknown[] = ["", null, true, false, "10", 0.004, 10.005];
  for (const target of badTargets) {
    const client = new FakeCustomersClient();
    const res = await handleControlCustomersRequest(
      req("/control/store-wallet-adjust", {
        key: ADMIN_KEY,
        method: "POST",
        body: {
          customer_id: CUSTOMER_ID,
          mode: "set",
          target_egp: target,
          kind: "correction",
          reason: "تسوية",
          idempotency_key: "k-bad-target",
        },
      }),
      deps(client, new FakeBotProxy()),
    );
    eq(res?.status, 400, `target ${JSON.stringify(target)} rejected`);
    eq((await res!.json()).error, "bad_target", "error");
    ok(!client.calls.includes("setBalanceInternal"), "rpc untouched");
  }
  const zeroRes = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "set",
        target_egp: 0,
        kind: "correction",
        reason: "تصفير مقصود",
        idempotency_key: "k-zero-target",
      },
    }),
    deps(new FakeCustomersClient(), new FakeBotProxy()),
  );
  eq(zeroRes?.status, 200, "an explicit numeric zero target is legitimate");
});

Deno.test("store wallet adjust replay returns already without new movement", async () => {
  const client = new FakeCustomersClient();
  client.adjustResult = { already: true, balance_after: 250 };
  const res = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "add",
        amount_egp: 150,
        kind: "deposit",
        reason: "شحن يدوي",
        idempotency_key: "k-set-1",
      },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.already, true, "already flag");
  eq(body.balance_after, 250, "balance after");
});

Deno.test("store wallet adjust under zero is 422 insufficient", async () => {
  const client = new FakeCustomersClient();
  client.adjustError = new Error(
    'rpc wallet_adjust_internal http 400: {"code":"P0001","message":"insufficient"}',
  );
  const res = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "deduct",
        amount_egp: 999,
        kind: "correction",
        reason: "خصم",
        idempotency_key: "k-ded-1",
      },
    }),
    deps(client, new FakeBotProxy()),
  );
  eq(res?.status, 422, "status");
  const body = await res!.json();
  eq(body.error, "insufficient", "error");
});

Deno.test("store wallet adjust validates before touching the rpc", async () => {
  const client = new FakeCustomersClient();
  const d = deps(client, new FakeBotProxy());
  const noReason = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "add",
        amount_egp: 10,
        kind: "deposit",
        reason: "  ",
        idempotency_key: "k",
      },
    }),
    d,
  );
  eq(noReason?.status, 400, "reason required");
  const badKind = await handleControlCustomersRequest(
    req("/control/store-wallet-adjust", {
      key: ADMIN_KEY,
      method: "POST",
      body: {
        customer_id: CUSTOMER_ID,
        mode: "add",
        amount_egp: 10,
        kind: "gift",
        reason: "سبب",
        idempotency_key: "k",
      },
    }),
    d,
  );
  eq(badKind?.status, 400, "kind whitelist");
  ok(!client.calls.includes("adjustInternal"), "rpc untouched");
});

Deno.test("bot proxy passes bot errors through with their status", async () => {
  for (const status of [409, 422, 404]) {
    const bot = new FakeBotProxy();
    bot.result = { status, body: { ok: false, error: `bot-${status}` } };
    const res = await handleControlCustomersRequest(
      req("/control/bot-wallet-adjust", {
        key: ADMIN_KEY,
        method: "POST",
        body: { customer_ref: "123", mode: "deduct" },
      }),
      deps(new FakeCustomersClient(), bot),
    );
    eq(res?.status, status, `status ${status} passes through`);
    const body = await res!.json();
    eq(body.error, `bot-${status}`, "bot error body passes through");
    eq(bot.lastPath, "/api/control/wallet-adjust", "bot path mapped");
  }
});

Deno.test("bot proxy success passes through and maps paths", async () => {
  const bot = new FakeBotProxy();
  bot.result = { status: 200, body: { ok: true, credited: true } };
  const res = await handleControlCustomersRequest(
    req("/control/bot-topup-decide", {
      key: ADMIN_KEY,
      method: "POST",
      body: { request_id: "abc", action: "approve" },
    }),
    deps(new FakeCustomersClient(), bot),
  );
  eq(res?.status, 200, "status");
  eq(bot.lastPath, "/api/control/topup-decide", "decide path");
  const body = await res!.json();
  eq(body.credited, true, "bot body verbatim");
});

Deno.test("bot connection failure is an honest bot_unavailable", async () => {
  const bot = new FakeBotProxy();
  bot.fail = true;
  const res = await handleControlCustomersRequest(
    req("/control/bot-customer?ref=123", { key: ADMIN_KEY }),
    deps(new FakeCustomersClient(), bot),
  );
  eq(res?.status, 502, "status");
  const body = await res!.json();
  eq(body.error, "bot_unavailable", "error");
  eq(body.bot_unavailable, true, "flag");
});

Deno.test("unified search merges bot results and store matches", async () => {
  const bot = new FakeBotProxy();
  bot.result = {
    status: 200,
    body: {
      ok: true,
      results: [{ ref: "123", balance_egp: 55, last_at: "2026-11-19T10:00:00Z" }],
    },
  };
  const client = new FakeCustomersClient();
  client.senderMatches = [{ id: CUSTOMER_ID, balance_egp: 100 }];
  const res = await handleControlCustomersRequest(
    req("/control/customers/search?q=01001500005", { key: ADMIN_KEY }),
    deps(client, bot),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.bot.length, 1, "bot results");
  eq(body.bot[0].ref, "123", "bot ref");
  eq(body.bot_unavailable, false, "bot available");
  eq(body.store.length, 1, "store matches");
  eq(body.store[0].id, CUSTOMER_ID, "store customer id");
  eq(body.store[0].email, "cust@example.com", "store email enriched");
  eq(bot.lastPath, "/api/control/customers/search?q=01001500005", "bot path");
});

Deno.test("unified search with the bot down still answers from the store", async () => {
  const bot = new FakeBotProxy();
  bot.fail = true;
  const client = new FakeCustomersClient();
  const res = await handleControlCustomersRequest(
    req("/control/customers/search?q=cust@example.com", { key: ADMIN_KEY }),
    deps(client, bot),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.bot, null, "bot null — never fabricated");
  eq(body.bot_unavailable, true, "flag");
  eq(body.store.length, 1, "store still answers");
  eq(body.store[0].email, "cust@example.com", "email match");
});

Deno.test("unified search by uuid finds the store customer", async () => {
  const res = await handleControlCustomersRequest(
    req(`/control/customers/search?q=${CUSTOMER_ID}`, { key: ADMIN_KEY }),
    deps(new FakeCustomersClient(), new FakeBotProxy()),
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.store.length, 1, "one store match");
  eq(body.store[0].id, CUSTOMER_ID, "id");
});
