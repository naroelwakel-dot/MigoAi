// اختبارات وحدة تجار اللوحة (م٥-د) — `deno test control/merchants.test.ts`
// عميل بوت وهمي (نمط channel.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. الوحدة دي تمرير خالص: العقد هو 405 قبل البوابة،
// 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم، وفشل البوت 502.
// والمنطق النقي بتاع شاشة التجار عايش جوه سكربت اللوحة بين علامتي
// PURE-MERCHANTS — الاختبارات بتقراه من control.html حرفيًا وبتشغّله،
// وأهم عقوده: سرّ كامل ما بيظهرش أبدًا في العرض المقنّع، وتحقق
// شكل CIDR قبل أي حفظ.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlMerchantsDeps,
  handleControlMerchantsRequest,
} from "./merchants.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ---------------------------------------------------------------- بوت وهمي
class FakeBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  result: BotProxyResult = { status: 200, body: { ok: true, echoed: true } };
  fail = false;

  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.fail) return Promise.reject(new Error("bot down"));
    return Promise.resolve(this.result);
  }
}

function depsOf(bot: FakeBotClient, admin = true): ControlMerchantsDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(
  path: string,
  method = "GET",
  body?: unknown,
): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: body !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

const ALL_PATHS: [string, string][] = [
  ["/control/bot-merchants", "GET"],
  ["/control/bot-merchant", "GET"],
  ["/control/bot-merchant-set", "POST"],
  ["/control/bot-merchant-key-set", "POST"],
  ["/control/bot-merchant-key-allowlist", "POST"],
  ["/control/bot-merchant-key-rotate", "POST"],
  ["/control/bot-merchant-key-grant", "POST"],
];

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlMerchantsRequest(req("/control/bot-merchantx"), d), null, "merchantx");
  eq(await handleControlMerchantsRequest(req("/control/bot-merchants-list"), d), null, "merchants-list");
  eq(await handleControlMerchantsRequest(req("/control/bot-channel-queue"), d), null, "channel");
  eq(await handleControlMerchantsRequest(req("/control/bot-settings"), d), null, "settings");
  eq(await handleControlMerchantsRequest(req("/control/store-coupons"), d), null, "coupons");
});

Deno.test("بوابة الأدمن على مسارات التجار السبعة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  for (const [p, m] of ALL_PATHS) {
    const res = await handleControlMerchantsRequest(
      req(p, m, m === "POST" ? {} : undefined),
      d,
    );
    eq(res?.status, 401, `${p} status`);
    eq((await bodyOf(res)).error, "unauthorized", `${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const cases: [string, string][] = [
    ["/control/bot-merchants", "POST"],
    ["/control/bot-merchant", "POST"],
    ["/control/bot-merchant-set", "GET"],
    ["/control/bot-merchant-key-set", "DELETE"],
    ["/control/bot-merchant-key-allowlist", "GET"],
    ["/control/bot-merchant-key-rotate", "PUT"],
    ["/control/bot-merchant-key-grant", "GET"],
  ];
  for (const [p, m] of cases) {
    const res = await handleControlMerchantsRequest(req(p, m), d);
    eq(res?.status, 405, `${p} ${m}`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("التمريرات الستة حرفية وبنفس الحالة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);

  bot.result = {
    status: 200,
    body: {
      ok: true,
      merchants: [{ id: 7, name: "متجر النور", active: true, keys_count: 2, orders_count: 5 }],
    },
  };
  let res = await handleControlMerchantsRequest(req("/control/bot-merchants"), d);
  eq(res?.status, 200, "list status");
  eq(bot.calls[0].method, "GET", "list method");
  eq(bot.calls[0].path, "/api/control/merchants", "list path");
  eq((await bodyOf(res)).merchants,
    [{ id: 7, name: "متجر النور", active: true, keys_count: 2, orders_count: 5 }],
    "list body verbatim");

  bot.result = {
    status: 200,
    body: {
      ok: true,
      merchant: { id: 7, name: "متجر النور", active: true },
      keys: [{ id: 3, prefix: "mgk_", last4: "9f2a", active: true, allowlist: ["203.0.113.0/24"] }],
      orders: [{ id: 11, status: "done" }],
    },
  };
  res = await handleControlMerchantsRequest(req("/control/bot-merchant?id=7"), d);
  eq(res?.status, 200, "detail status");
  eq(bot.calls[1].method, "GET", "detail method");
  eq(bot.calls[1].path, "/api/control/merchant?id=7", "detail path+query verbatim");

  const setBody = { id: 7, active: false };
  bot.result = { status: 200, body: { ok: true } };
  res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-set", "POST", setBody),
    d,
  );
  eq(bot.calls[2].path, "/api/control/merchant-set", "merchant-set path");
  eq(bot.calls[2].body, setBody, "merchant-set body verbatim");

  const keySetBody = { merchant_id: 7, key_id: 3, id: 3, active: false };
  res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-set", "POST", keySetBody),
    d,
  );
  eq(bot.calls[3].path, "/api/control/merchant-key-set", "key-set path");
  eq(bot.calls[3].body, keySetBody, "key-set body verbatim");

  const allowBody = { merchant_id: 7, key_id: 3, id: 3, allowlist: ["203.0.113.0/24", "198.51.100.7"] };
  bot.result = { status: 400, body: { ok: false, error: "bad_value" } };
  res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-allowlist", "POST", allowBody),
    d,
  );
  eq(res?.status, 400, "bot 400 status passthrough");
  eq((await bodyOf(res)).error, "bad_value", "bot error verbatim");
  eq(bot.calls[4].path, "/api/control/merchant-key-allowlist", "allowlist path");
  eq(bot.calls[4].body, allowBody, "allowlist body verbatim");

  const rotateBody = { merchant_id: 7, key_id: 3, id: 3 };
  bot.result = { status: 200, body: { ok: true, new_key: "mgk_newsecretvalue1234" } };
  res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-rotate", "POST", rotateBody),
    d,
  );
  eq(res?.status, 200, "rotate status");
  eq(bot.calls[5].path, "/api/control/merchant-key-rotate", "rotate path");
  eq(bot.calls[5].body, rotateBody, "rotate body verbatim");
  eq((await bodyOf(res)).new_key, "mgk_newsecretvalue1234", "rotated secret passes through for the one-time display");
});

Deno.test("تمرير المنح حرفي: الجسم والرد والحالات", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const grantBody = { customer_ref: "7484779006", reason: "شريك" };
  bot.result = {
    status: 200,
    body: {
      ok: true,
      granted: true,
      key_prefix: "migo_live_ab",
      delivery: "sent",
      api_enabled: false,
      merchant: { id: "m-1", customer_ref: "7484779006" },
    },
  };
  let res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-grant", "POST", grantBody),
    d,
  );
  eq(res?.status, 200, "grant status");
  eq(bot.calls[0].method, "POST", "grant method");
  eq(bot.calls[0].path, "/api/control/merchant-key-grant", "grant path");
  eq(bot.calls[0].body, grantBody, "grant body verbatim");
  const out = await bodyOf(res);
  eq(out.key_prefix, "migo_live_ab", "grant prefix passthrough");
  eq(out.delivery, "sent", "grant delivery passthrough");
  // رد المنح مفيهوش أي سرّ خام من الأساس — البادئة بس اللي بتعدّي.
  ok(!("api_key" in out), "grant response carries no raw key field");

  bot.result = { status: 404, body: { ok: false, error: "customer_not_found" } };
  res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-grant", "POST", { customer_ref: "1" }),
    d,
  );
  eq(res?.status, 404, "grant 404 passthrough");
  eq((await bodyOf(res)).error, "customer_not_found", "grant error verbatim");
});

Deno.test("جسم POST مش كائن = 400 من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const arrReq = new Request("https://api.example/control/bot-merchant-set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([1, 2, 3]),
  });
  const res = await handleControlMerchantsRequest(arrReq, d);
  eq(res?.status, 400, "array body status");
  eq((await bodyOf(res)).error, "bad_body", "array body error");
  eq(bot.calls.length, 0, "zero bot calls on bad bodies");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlMerchantsRequest(req("/control/bot-merchants"), d);
  eq(res?.status, 502, "GET status");
  eq((await bodyOf(res)).error, "bot_unavailable", "GET error");
  const res2 = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-rotate", "POST", { key_id: 3 }),
    d,
  );
  eq(res2?.status, 502, "POST status");
  eq((await bodyOf(res2)).error, "bot_unavailable", "POST error");
});

Deno.test("ردود التجار ممنوعة من الكاش (no-store) — سرّ التدوير خصوصًا", async () => {
  const bot = new FakeBotClient();
  bot.result = {
    status: 200,
    body: { ok: true, key: { id: "k1" }, api_key: "raw-secret-once" },
  };
  const d = depsOf(bot);
  const res = await handleControlMerchantsRequest(
    req("/control/bot-merchant-key-rotate", "POST", { key_id: "k1" }),
    d,
  );
  eq(res?.status, 200, "rotate status");
  eq(res?.headers.get("Cache-Control"), "no-store", "rotate no-store");
  const list = await handleControlMerchantsRequest(
    req("/control/bot-merchants"),
    d,
  );
  eq(list?.headers.get("Cache-Control"), "no-store", "list no-store");
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureMerchants {
  merchantsItemsOf: (d: Record<string, unknown> | null) => unknown[];
  merchantDetailOf: (d: Record<string, unknown> | null) => Record<string, unknown> | null;
  merchantKeysOf: (d: Record<string, unknown> | null, m: Record<string, unknown> | null) => unknown[];
  merchantOrdersOf: (d: Record<string, unknown> | null, m: Record<string, unknown> | null) => unknown[];
  merchantActiveOf: (m: Record<string, unknown> | null) => boolean;
  merchantKeysCountOf: (m: Record<string, unknown> | null) => number | null;
  merchantOrdersCountOf: (m: Record<string, unknown> | null) => number | null;
  maskedKeyText: (k: Record<string, unknown> | null) => string;
  keyAllowlistOf: (k: Record<string, unknown> | null) => string[];
  allowlistText: (raw: unknown) => string;
  validCidrLine: (line: string) => boolean;
  parseAllowlist: (text: string) => { list: string[] | null; problem: string };
  rotatedSecretOf: (d: Record<string, unknown> | null) => string;
  merchantGrantOutcome: (
    d: Record<string, unknown> | null,
  ) => { kind: string; text: string } | null;
}

const PB = "/*PURE-MERCHANTS-BEGIN*/";
const PE = "/*PURE-MERCHANTS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure merchants block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { merchantsItemsOf, merchantDetailOf, merchantKeysOf, merchantOrdersOf, merchantActiveOf, merchantKeysCountOf, merchantOrdersCountOf, maskedKeyText, keyAllowlistOf, allowlistText, validCidrLine, parseAllowlist, rotatedSecretOf, merchantGrantOutcome };",
) as () => PureMerchants)();

Deno.test("merchantsItemsOf و merchantDetailOf: أول شكل معروف", () => {
  eq(pure.merchantsItemsOf({ merchants: [1] }), [1], "merchants");
  eq(pure.merchantsItemsOf({ items: [2] }), [2], "items");
  eq(pure.merchantsItemsOf({}), [], "none");
  eq(pure.merchantsItemsOf(null), [], "null");
  eq(pure.merchantDetailOf({ merchant: { id: 1 } }), { id: 1 }, "merchant field");
  eq(pure.merchantDetailOf({ id: 2, name: "x" }), { id: 2, name: "x" }, "bare object");
  eq(pure.merchantDetailOf(null), null, "null detail");
  eq(pure.merchantKeysOf({ keys: [{ id: 1 }] }, null), [{ id: 1 }], "keys top-level");
  eq(pure.merchantKeysOf({}, { api_keys: [{ id: 2 }] }), [{ id: 2 }], "api_keys on merchant");
  eq(pure.merchantOrdersOf({ orders: [{ id: 9 }] }, null), [{ id: 9 }], "orders top-level");
  eq(pure.merchantOrdersOf({}, {}), [], "no orders");
});

Deno.test("merchantActiveOf والعدّادات", () => {
  eq(pure.merchantActiveOf({ active: false }), false, "active false");
  eq(pure.merchantActiveOf({ enabled: true }), true, "enabled true");
  eq(pure.merchantActiveOf({ status: "suspended" }), false, "status suspended");
  eq(pure.merchantActiveOf({ status: "active" }), true, "status active");
  eq(pure.merchantActiveOf({}), true, "no flags defaults active");
  eq(pure.merchantActiveOf(null), false, "null");
  eq(pure.merchantKeysCountOf({ keys_count: 3 }), 3, "keys_count");
  eq(pure.merchantKeysCountOf({ keys: [1, 2] }), 2, "keys array length");
  eq(pure.merchantKeysCountOf({}), null, "keys unknown");
  eq(pure.merchantOrdersCountOf({ orders_count: "5" }), 5, "orders_count string");
  eq(pure.merchantOrdersCountOf({}), null, "orders unknown");
});

Deno.test("maskedKeyText: بادئة وآخر ٤ بس — سرّ كامل مستحيل يظهر", () => {
  eq(pure.maskedKeyText({ prefix: "mgk_", last4: "9f2a" }), "mgk_…9f2a", "prefix+last4");
  eq(pure.maskedKeyText({ key_prefix: "mgk_live_", last_four: "ab12" }), "mgk_live_…ab12", "alt field names");
  const raw = "mgk_live_0123456789abcdefSECRET";
  const shown = pure.maskedKeyText({ key: raw });
  ok(shown !== raw, "raw secret never shown whole");
  ok(!shown.includes("0123456789abcdef"), "raw middle never leaks");
  ok(shown.endsWith("CRET"), "last4 from raw tail");
  const shown2 = pure.maskedKeyText({ secret: raw, prefix: "mgk_" });
  ok(!shown2.includes("0123456789abcdef"), "secret field masked too");
  eq(pure.maskedKeyText({}), "مفتاح دخول", "no fields");
  eq(pure.maskedKeyText(null), "مفتاح دخول", "null key");
});

Deno.test("validCidrLine و parseAllowlist: شكل CIDR قبل الحفظ", () => {
  eq(pure.validCidrLine("203.0.113.0/24"), true, "ipv4 cidr");
  eq(pure.validCidrLine("203.0.113.7"), true, "bare ipv4");
  eq(pure.validCidrLine("203.0.113.0/33"), false, "prefix too big");
  eq(pure.validCidrLine("203.0.113.256"), false, "octet too big");
  eq(pure.validCidrLine("203.0.113"), false, "three octets");
  eq(pure.validCidrLine("example.com"), false, "hostname refused");
  eq(pure.validCidrLine("2001:db8::/32"), true, "ipv6 cidr");
  eq(pure.validCidrLine("2001:db8::1"), true, "bare ipv6");
  eq(pure.validCidrLine("2001:db8::/129"), false, "ipv6 prefix too big");
  eq(pure.validCidrLine(""), false, "empty");

  eq(pure.parseAllowlist(""), { list: [], problem: "" }, "empty text = open list");
  eq(pure.parseAllowlist("  \n\n"), { list: [], problem: "" }, "blank lines");
  eq(
    pure.parseAllowlist("203.0.113.0/24\n198.51.100.7\n203.0.113.0/24"),
    { list: ["203.0.113.0/24", "198.51.100.7"], problem: "" },
    "two entries, duplicate dropped",
  );
  const bad = pure.parseAllowlist("203.0.113.0/24\nمش عنوان");
  eq(bad.list, null, "bad line refuses the whole save");
  ok(bad.problem.length > 0, "bad line explains");
});

Deno.test("keyAllowlistOf و allowlistText و rotatedSecretOf", () => {
  eq(pure.keyAllowlistOf({ allowlist: ["203.0.113.0/24"] }), ["203.0.113.0/24"], "allowlist array");
  eq(pure.keyAllowlistOf({ ip_allowlist: "203.0.113.0/24, 198.51.100.7" }),
    ["203.0.113.0/24", "198.51.100.7"], "ip_allowlist string splits");
  eq(pure.keyAllowlistOf({}), [], "no allowlist");
  eq(pure.allowlistText(["a", "b"]), "a\nb", "array to lines");
  eq(pure.allowlistText(null), "", "null to empty");
  eq(pure.rotatedSecretOf({ new_key: "mgk_x" }), "mgk_x", "new_key");
  eq(pure.rotatedSecretOf({ secret: "mgk_y" }), "mgk_y", "secret fallback");
  eq(pure.rotatedSecretOf({ ok: true }), "", "no secret field");
  eq(pure.rotatedSecretOf(null), "", "null response");
});

Deno.test("merchantGrantOutcome: حالات المنح الأربع برسائل واضحة", () => {
  const sent = pure.merchantGrantOutcome(
    { granted: true, delivery: "sent", api_enabled: true });
  eq(sent?.kind, "ok", "sent kind");
  ok(sent!.text.includes("اتبعت للعميل في البوت"), "sent text says delivered");

  const sentFlagOff = pure.merchantGrantOutcome(
    { granted: true, delivery: "sent", api_enabled: false });
  eq(sentFlagOff?.kind, "ok", "sent+flag off kind");
  ok(sentFlagOff!.text.includes("مقفول حاليًا"), "flag-off warning present");

  const undelivered = pure.merchantGrantOutcome(
    { granted: true, delivery: "undelivered",
      issued_but_undelivered: true });
  eq(undelivered?.kind, "warn", "undelivered kind is a warning");
  ok(undelivered!.text.includes("ما وصلتش للعميل"), "undelivered text");

  const already = pure.merchantGrantOutcome(
    { already_open: true, key_prefix: "migo_live_ab" });
  eq(already?.kind, "ok", "already_open kind");
  ok(already!.text.includes("migo_live_ab"), "already_open shows prefix");
  ok(already!.text.includes("ما اتعملش مفتاح جديد"), "already_open no new key");

  const audited = pure.merchantGrantOutcome(
    { granted: true, delivery: "sent", api_enabled: true,
      audit_failed: true });
  ok(audited!.text.includes("سجل التغييرات فشل"), "audit failure noted");

  eq(pure.merchantGrantOutcome(null), null, "null response");
  eq(pure.merchantGrantOutcome({ ok: true }), null, "shapeless response");
});
