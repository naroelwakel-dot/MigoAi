// اختبارات وحدة قسم الموقع (م٥-هـ) — `deno test control/site.test.ts`
// عملاء وهميون بالكامل: مفيش شبكة ولا قاعدة حقيقية. العقد:
// القراءة العامة من غير مصادقة وبرجوع للثوابت عند أي تلف أو
// فشل، وبوابة أدمن قبل أي لمس للقاعدة في مسارات اللوحة، وتحقق
// صارم قبل الكتابة، وتدقيق بيتصرح بفشله. واختبار الإساءة
// الصريح: الصيانة شغالة واللوحة ومسارات الأدمن شغالين عادي —
// لأن اللوحة ما بتقراش محتوى الموقع العام أصلًا. والمنطق النقي
// لشاشة الموقع (PURE-SITE) ولواجهة المتجر (PURE-SITE-CONSUME)
// بيتقروا من control.html وapp.js حرفيًا.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlSiteClient,
  type ControlSiteDeps,
  DEFAULT_FAQ_ITEMS,
  handleControlSiteRequest,
  handleSiteContentPublicRequest,
  normalizePublicSiteContent,
  type PaymentMethodRow,
  type SiteContentPublicDeps,
  type SiteContentRow,
  validatePaymentMethodInput,
  validateSiteContentInput,
} from "./site.ts";
import { handleControlCouponsRequest } from "./coupons.ts";
import html from "../control.html" with { type: "text" };
import appJs from "../app.js" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ------------------------------------------------------------- عملاء وهميون
class FakeSiteClient implements ControlSiteClient {
  contentRows: SiteContentRow[] = [];
  methods: PaymentMethodRow[] = [];
  fail = false;
  calls = 0;

  listSiteContent(): Promise<SiteContentRow[]> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("db down"));
    return Promise.resolve(this.contentRows);
  }
  upsertSiteContent(key: string, value: unknown): Promise<SiteContentRow> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("db down"));
    const row: SiteContentRow = {
      key,
      value,
      updated_at: "2026-11-20T00:00:00.000Z",
    };
    const i = this.contentRows.findIndex((r) => r.key === key);
    if (i >= 0) this.contentRows[i] = row;
    else this.contentRows.push(row);
    return Promise.resolve(row);
  }
  listPaymentMethods(): Promise<PaymentMethodRow[]> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("db down"));
    return Promise.resolve(this.methods);
  }
  getPaymentMethod(value: string): Promise<PaymentMethodRow | null> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("db down"));
    return Promise.resolve(
      this.methods.find((m) => m.value === value) ?? null,
    );
  }
  updatePaymentMethod(
    originalValue: string,
    patch: { value: string; active: boolean; note: string },
  ): Promise<PaymentMethodRow | null> {
    this.calls++;
    if (this.fail) return Promise.reject(new Error("db down"));
    const i = this.methods.findIndex((m) => m.value === originalValue);
    if (i < 0) return Promise.resolve(null);
    this.methods[i] = { ...patch };
    return Promise.resolve(this.methods[i]);
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
  client: FakeSiteClient,
  bot: FakeBotClient,
  admin = true,
): ControlSiteDeps {
  return {
    client,
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function publicDepsOf(
  client: FakeSiteClient,
): SiteContentPublicDeps {
  return { client, corsOf: () => ({}), logError: () => {} };
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

function seedMethod(patch: Partial<PaymentMethodRow> = {}): PaymentMethodRow {
  return { value: "📱 فودافون كاش", active: true, note: "زر فودافون", ...patch };
}

// ------------------------------------------------------- تحقق المحتوى
Deno.test("validateSiteContentInput: قبول ورفض لكل مفتاح", () => {
  eq(
    validateSiteContentInput("unknown", {}),
    { error: "bad_key" },
    "unknown key",
  );
  eq(validateSiteContentInput("announcement", "نص"), { error: "bad_value" }, "non-object");
  const ann = validateSiteContentInput("announcement", {
    enabled: true,
    text: " عرض جديد ",
    url: "https://migoai.shop",
  });
  ok("value" in ann, "announcement accepted");
  if ("value" in ann) {
    eq(ann.value, { enabled: true, text: "عرض جديد", url: "https://migoai.shop" }, "announcement trimmed");
  }
  eq(
    validateSiteContentInput("announcement", { enabled: true, text: "" }),
    { error: "bad_value" },
    "enabled announcement needs text",
  );
  eq(
    validateSiteContentInput("announcement", { enabled: false, text: "x", url: "ftp://x" }),
    { error: "bad_value" },
    "non-http url refused",
  );
  eq(
    validateSiteContentInput("announcement", { enabled: false, text: "x".repeat(301) }),
    { error: "bad_value" },
    "long announcement refused",
  );

  ok("value" in validateSiteContentInput("terms", { text: "" }), "empty terms = static fallback, accepted");
  eq(
    validateSiteContentInput("terms", { text: "x".repeat(20001) }),
    { error: "bad_value" },
    "huge terms refused",
  );

  const faq = validateSiteContentInput("faq", {
    items: [{ q: " س؟ ", a: " ج " }],
  });
  ok("value" in faq, "faq accepted");
  if ("value" in faq) {
    eq(faq.value, { items: [{ q: "س؟", a: "ج" }] }, "faq trimmed");
  }
  eq(validateSiteContentInput("faq", { items: [] }), { error: "bad_value" }, "empty faq refused");
  eq(
    validateSiteContentInput("faq", { items: [{ q: "", a: "ج" }] }),
    { error: "bad_value" },
    "blank question refused",
  );

  const sec = validateSiteContentInput("sections", { "sec-ai": false });
  ok("value" in sec, "partial sections accepted");
  eq(
    validateSiteContentInput("sections", { "sec-nope": true }),
    { error: "bad_value" },
    "unknown section refused",
  );
  eq(
    validateSiteContentInput("sections", { "sec-ai": "yes" }),
    { error: "bad_value" },
    "non-boolean section refused",
  );

  eq(
    validateSiteContentInput("maintenance", { enabled: true, message: "" }),
    { error: "bad_value" },
    "enabled maintenance needs a message",
  );
  // enabled غير المنطقي مرفوض في المفتاحين — التحويل الصامت
  // لـ false كان ممكن يطفي إعلان أو صيانة شغالة من غير أثر.
  eq(
    validateSiteContentInput("announcement", { enabled: "true", text: "x", url: "" }),
    { error: "bad_value" },
    "non-boolean announcement enabled refused",
  );
  eq(
    validateSiteContentInput("maintenance", { enabled: 1, message: "x" }),
    { error: "bad_value" },
    "non-boolean maintenance enabled refused",
  );
  const maint = validateSiteContentInput("maintenance", {
    enabled: false,
    message: "",
  });
  ok("value" in maint, "disabled maintenance with empty message accepted");
});

// ------------------------------------------------------- تحقق طرق الدفع
Deno.test("validatePaymentMethodInput: تطبيع ورفض", () => {
  const good = validatePaymentMethodInput({
    original_value: " 📱 فودافون كاش ",
    value: "📱 فودافون كاش",
    active: false,
    note: " ملحوظة ",
  });
  ok("patch" in good, "valid accepted");
  if ("patch" in good) {
    eq(good.originalValue, "📱 فودافون كاش", "original trimmed");
    eq(good.patch.active, false, "active kept");
    eq(good.patch.note, "ملحوظة", "note trimmed");
  }
  eq(validatePaymentMethodInput({ value: "x", active: true }), { error: "bad_value" }, "missing original");
  eq(
    validatePaymentMethodInput({ original_value: "x", value: " ", active: true }),
    { error: "bad_value" },
    "blank new name",
  );
  eq(
    validatePaymentMethodInput({ original_value: "x", value: "y", active: "yes" }),
    { error: "bad_value" },
    "non-boolean active",
  );
  eq(
    validatePaymentMethodInput({ original_value: "x", value: "y", active: true, note: 5 }),
    { error: "bad_value" },
    "non-string note",
  );
});

// ------------------------------------------------- تطبيع القراءة العامة
Deno.test("normalizePublicSiteContent: غياب وتلف ورجوع للثوابت", () => {
  const d = normalizePublicSiteContent([]);
  eq(d.announcement, { enabled: false, text: "", url: "" }, "default announcement");
  eq(d.terms, { text: "" }, "default terms = static page");
  eq(d.faq.items, DEFAULT_FAQ_ITEMS, "default faq = live items");
  eq(d.sections["sec-ai"], true, "default section visible");
  eq(d.maintenance.enabled, false, "default maintenance off");

  const corrupt = normalizePublicSiteContent([
    { key: "announcement", value: "مش كائن", updated_at: null },
    { key: "faq", value: { items: "مش قائمة" }, updated_at: null },
    { key: "sections", value: { "sec-ai": "مش منطقي" }, updated_at: null },
    { key: "maintenance", value: 42, updated_at: null },
    { key: "terms", value: { text: 7 }, updated_at: null },
  ]);
  eq(corrupt, d, "every corrupt key falls back to defaults");

  const mixed = normalizePublicSiteContent([
    {
      key: "announcement",
      value: { enabled: true, text: "", url: "" },
      updated_at: null,
    },
    {
      key: "sections",
      value: { "sec-games": false, "sec-unknown": false },
      updated_at: null,
    },
    {
      key: "faq",
      value: { items: [{ q: "س", a: "ج" }, { q: "", a: "ج" }, "زبالة"] },
      updated_at: null,
    },
    {
      key: "maintenance",
      value: { enabled: true, message: "" },
      updated_at: null,
    },
  ]);
  eq(mixed.announcement.enabled, false, "enabled without text shows nothing");
  eq(mixed.sections["sec-games"], false, "hidden section respected");
  eq(mixed.sections["sec-ai"], true, "unlisted section stays visible");
  eq(mixed.faq.items, [{ q: "س", a: "ج" }], "faq cleaned");
  eq(mixed.maintenance.enabled, true, "maintenance on");
  ok(mixed.maintenance.message.length > 0, "empty maintenance message gets the default");

  // رابط إعلان بمخطط خطير (صف مكتوب مباشرة في القاعدة) بيتصفّر
  // في القراءة العامة — الحفظ الصارم بيرفضه، والقراءة ما تقدّمهوش.
  const evil = normalizePublicSiteContent([
    {
      key: "announcement",
      value: { enabled: true, text: "عرض", url: "javascript:alert(1)" },
      updated_at: null,
    },
  ]);
  eq(evil.announcement.url, "", "javascript: url blanked on public read");
  eq(evil.announcement.text, "عرض", "announcement text kept");
  const good = normalizePublicSiteContent([
    {
      key: "announcement",
      value: { enabled: true, text: "عرض", url: "https://migoai.shop/x" },
      updated_at: null,
    },
  ]);
  eq(good.announcement.url, "https://migoai.shop/x", "https url kept");
});

// ------------------------------------------------------- المعالج العام
Deno.test("المعالج العام: مسار و405 وقراءة من غير مصادقة وفشل قاعدة", async () => {
  const client = new FakeSiteClient();
  const pd = publicDepsOf(client);
  eq(await handleSiteContentPublicRequest(req("/catalog/prices"), pd), null, "other path null");

  const wrong = await handleSiteContentPublicRequest(
    req("/site/content", "POST", {}),
    pd,
  );
  eq(wrong?.status, 405, "POST is 405");

  client.contentRows = [{
    key: "maintenance",
    value: { enabled: true, message: "بنحدّث" },
    updated_at: null,
  }];
  const res = await handleSiteContentPublicRequest(req("/site/content"), pd);
  eq(res?.status, 200, "public read ok without any admin gate");
  const body = await bodyOf(res);
  const content = body.content as { maintenance: { enabled: boolean } };
  eq(content.maintenance.enabled, true, "maintenance served");

  client.fail = true;
  const failed = await handleSiteContentPublicRequest(req("/site/content"), pd);
  eq(failed?.status, 200, "db failure still 200 — the site never breaks");
  const failedBody = await bodyOf(failed);
  const fc = failedBody.content as { maintenance: { enabled: boolean } };
  eq(fc.maintenance.enabled, false, "db failure serves defaults");
});

// ------------------------------------------------------- معالج اللوحة
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeSiteClient(), new FakeBotClient());
  eq(await handleControlSiteRequest(req("/control/store-coupons"), d), null, "coupons");
  eq(await handleControlSiteRequest(req("/control/site-content-x"), d), null, "suffix-x");
});

Deno.test("القوائم: 405 قبل البوابة، و401 قبل أي لمس للقاعدة", async () => {
  const client = new FakeSiteClient();
  client.methods = [seedMethod()];
  const bot = new FakeBotClient();

  const wrong = await handleControlSiteRequest(
    req("/control/site-payment-methods", "POST", {}),
    depsOf(client, bot, false),
  );
  eq(wrong?.status, 405, "method check beats the gate");

  const denied = await handleControlSiteRequest(
    req("/control/site-payment-methods"),
    depsOf(client, bot, false),
  );
  eq(denied?.status, 401, "gate status");
  eq((await bodyOf(denied)).error, "unauthorized", "gate error");
  eq(client.calls, 0, "gate fires before any db touch");

  const res = await handleControlSiteRequest(
    req("/control/site-payment-methods"),
    depsOf(client, bot),
  );
  eq(res?.status, 200, "list status");
  eq((await bodyOf(res)).methods, [seedMethod()], "methods verbatim");

  client.fail = true;
  const failed = await handleControlSiteRequest(
    req("/control/site-content"),
    depsOf(client, bot),
  );
  eq(failed?.status, 502, "db failure status");
  eq((await bodyOf(failed)).error, "store_failed", "db failure error");
});

Deno.test("حفظ المحتوى: تحقق قبل الكتابة + تدقيق + تصريح بفشله", async () => {
  const client = new FakeSiteClient();
  const bot = new FakeBotClient();
  const d = depsOf(client, bot);

  const bad = await handleControlSiteRequest(
    req("/control/site-content-save", "POST", {
      key: "announcement",
      value: { enabled: true, text: "" },
    }),
    d,
  );
  eq(bad?.status, 400, "invalid status");
  eq((await bodyOf(bad)).error, "bad_value", "invalid error");
  eq(client.contentRows.length, 0, "invalid write never landed");

  const badKey = await handleControlSiteRequest(
    req("/control/site-content-save", "POST", { key: "nope", value: {} }),
    d,
  );
  eq((await bodyOf(badKey)).error, "bad_key", "unknown key error");

  const res = await handleControlSiteRequest(
    req("/control/site-content-save", "POST", {
      key: "announcement",
      value: { enabled: true, text: "عرض", url: "" },
    }),
    d,
  );
  eq(res?.status, 200, "save status");
  eq((await bodyOf(res)).audit_failed, false, "audit ok");
  eq(bot.calls.length, 1, "one audit call");
  eq(bot.calls[0].path, "/api/control/audit-log", "audit path");
  eq(bot.calls[0].body?.action, "site_content_save", "audit action");
  eq(bot.calls[0].body?.entity_type, "site_content", "audit entity");
  eq(bot.calls[0].body?.entity_ref, "announcement", "audit ref");
  eq(bot.calls[0].body?.before, null, "audit before = absent");
  eq(client.contentRows.length, 1, "row landed");

  bot.fail = true;
  const res2 = await handleControlSiteRequest(
    req("/control/site-content-save", "POST", {
      key: "maintenance",
      value: { enabled: false, message: "قريبًا" },
    }),
    d,
  );
  eq(res2?.status, 200, "save still succeeds when audit fails");
  eq((await bodyOf(res2)).audit_failed, true, "audit failure disclosed");
});

Deno.test("حفظ وسيلة الدفع: غياب 404 وتصادم اسم 409 ونجاح مدقّق", async () => {
  const client = new FakeSiteClient();
  client.methods = [
    seedMethod(),
    seedMethod({ value: "⚡ إنستاباي (InstaPay)", note: "" }),
  ];
  const bot = new FakeBotClient();
  const d = depsOf(client, bot);

  const missing = await handleControlSiteRequest(
    req("/control/site-payment-method-save", "POST", {
      original_value: "مش موجودة",
      value: "مش موجودة",
      active: true,
      note: "",
    }),
    d,
  );
  eq(missing?.status, 404, "missing status");
  eq((await bodyOf(missing)).error, "not_found", "missing error");

  const clash = await handleControlSiteRequest(
    req("/control/site-payment-method-save", "POST", {
      original_value: "📱 فودافون كاش",
      value: "⚡ إنستاباي (InstaPay)",
      active: true,
      note: "",
    }),
    d,
  );
  eq(clash?.status, 409, "clash status");
  eq((await bodyOf(clash)).error, "method_exists", "clash error");
  eq(client.methods[0].value, "📱 فودافون كاش", "clash never wrote");

  const res = await handleControlSiteRequest(
    req("/control/site-payment-method-save", "POST", {
      original_value: "📱 فودافون كاش",
      value: "📱 فودافون كاش",
      active: false,
      note: "موقوفة مؤقتًا",
    }),
    d,
  );
  eq(res?.status, 200, "save status");
  eq(client.methods[0].active, false, "method deactivated");
  eq(bot.calls[0].body?.action, "site_payment_method_save", "audit action");
  eq(bot.calls[0].body?.entity_type, "site_payment_method", "audit entity");
});

// ------------------------------------------- اختبار الإساءة: الصيانة
Deno.test("الصيانة شغالة: اللوحة ومسارات الأدمن شغالين عادي", async () => {
  const client = new FakeSiteClient();
  client.contentRows = [{
    key: "maintenance",
    value: { enabled: true, message: "بنحدّث الموقع" },
    updated_at: null,
  }];
  client.methods = [seedMethod()];
  const bot = new FakeBotClient();
  const d = depsOf(client, bot);

  // الواجهة العامة شايفة الصيانة…
  const pub = await handleSiteContentPublicRequest(
    req("/site/content"),
    publicDepsOf(client),
  );
  const pubBody = await bodyOf(pub);
  eq(
    (pubBody.content as { maintenance: { enabled: boolean } }).maintenance
      .enabled,
    true,
    "public sees maintenance on",
  );

  // …واللوحة بتقرأ وبتكتب عادي في نفس اللحظة (إيقاف الصيانة نفسه
  // بيتم من اللوحة وهي شغالة).
  const list = await handleControlSiteRequest(
    req("/control/site-payment-methods"),
    d,
  );
  eq(list?.status, 200, "panel list works during maintenance");
  const off = await handleControlSiteRequest(
    req("/control/site-content-save", "POST", {
      key: "maintenance",
      value: { enabled: false, message: "بنحدّث الموقع" },
    }),
    d,
  );
  eq(off?.status, 200, "panel can turn maintenance off during maintenance");

  // ومسار أدمن تاني مستقل (الكوبونات) بوابته شغالة زي ما هي.
  const couponsDeps = {
    client: {
      listCoupons: () => Promise.resolve([]),
      getCoupon: () => Promise.resolve(null),
      insertCoupon: () => Promise.reject(new Error("unused")),
      updateCoupon: () => Promise.resolve(null),
      deleteCoupon: () => Promise.resolve(false),
    },
    botClient: bot,
    isAdmin: () => false,
    corsOf: () => ({}),
    logError: () => {},
  };
  const denied = await handleControlCouponsRequest(
    req("/control/store-coupons"),
    couponsDeps,
  );
  eq(denied?.status, 401, "other admin routes still gate during maintenance");

  // واللوحة نفسها ما بتقراش محتوى الموقع العام أصلًا — مفيش
  // أي جلب لـ /site/content جوّه control.html.
  ok(!html.includes("/site/content"), "panel never fetches public site content");
});

// ------------------------------------------------- منطق شاشة الموقع النقي
interface PureSite {
  siteRowValue: (
    rows: unknown,
    key: string,
  ) => Record<string, unknown> | null;
  paymentMethodStatusText: (r: unknown) => string;
  paymentMethodPreviewLines: (
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) => string[];
  faqItemsClean: (items: unknown) => { q: string; a: string }[];
}

const PB = "/*PURE-SITE-BEGIN*/";
const PE = "/*PURE-SITE-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure site block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { siteRowValue, paymentMethodStatusText, paymentMethodPreviewLines, faqItemsClean };",
) as () => PureSite)();

Deno.test("siteRowValue: بيجيب قيمة المفتاح وبيتجاهل التالف", () => {
  const rows = [
    { key: "announcement", value: { enabled: true, text: "عرض" } },
    { key: "terms", value: "مش كائن" },
  ];
  eq(pure.siteRowValue(rows, "announcement"), { enabled: true, text: "عرض" }, "found");
  eq(pure.siteRowValue(rows, "terms"), null, "corrupt treated as absent");
  eq(pure.siteRowValue(rows, "faq"), null, "missing key");
  eq(pure.siteRowValue(null, "faq"), null, "no rows");
});

Deno.test("paymentMethodStatusText وPreviewLines: قبل/بعد واضح", () => {
  eq(pure.paymentMethodStatusText({ active: true }), "شغالة", "active");
  eq(pure.paymentMethodStatusText({ active: false }), "موقوفة", "inactive");
  eq(pure.paymentMethodStatusText(null), "موقوفة", "null");

  const same = pure.paymentMethodPreviewLines(
    { value: "أ", active: true, note: "" },
    { value: "أ", active: true, note: "" },
  );
  eq(same, ["مفيش تغييرات عن المحفوظ."], "no changes");

  const renamed = pure.paymentMethodPreviewLines(
    { value: "أ", active: true, note: "" },
    { value: "ب", active: false, note: "ن" },
  );
  eq(renamed.length, 4, "rename + warning + status + note lines");
  ok(renamed[1].includes("تنبيه"), "rename carries the button-name warning");
  ok(renamed[2].includes("هيقف فورًا"), "deactivation spelled out");
});

Deno.test("faqItemsClean: تنضيف وإسقاط الفاضي", () => {
  eq(
    pure.faqItemsClean([
      { q: " س ", a: " ج " },
      { q: "", a: "ج" },
      { q: "س", a: " " },
      null,
    ]),
    [{ q: "س", a: "ج" }],
    "cleaned",
  );
  eq(pure.faqItemsClean("مش قائمة"), [], "non-array");
});

// ------------------------------------------- منطق استهلاك الواجهة النقي
interface PureConsume {
  normalizePublicSiteContent: (raw: unknown) => Record<string, unknown>;
  announcementOf: (
    c: unknown,
  ) => { text: string; url: string } | null;
  maintenanceOf: (c: unknown) => string | null;
  hiddenSectionIds: (c: unknown) => string[];
  faqItemsOf: (c: unknown) => { q: string; a: string }[];
}

const CB = "/*PURE-SITE-CONSUME-BEGIN*/";
const CE = "/*PURE-SITE-CONSUME-END*/";
const cBegin = appJs.indexOf(CB);
const cEnd = appJs.indexOf(CE);
if (cBegin < 0 || cEnd <= cBegin) {
  throw new Error("pure site-consume block markers not found in app.js");
}
const consume = (new Function(
  appJs.slice(cBegin, cEnd) +
    "\nreturn { normalizePublicSiteContent, announcementOf, maintenanceOf, hiddenSectionIds, faqItemsOf };",
) as () => PureConsume)();

Deno.test("استهلاك الواجهة: تلف = ثوابت، وقيم سليمة بتتطبق", () => {
  const d = consume.normalizePublicSiteContent(null);
  eq(consume.announcementOf(d), null, "no bar by default");
  eq(consume.maintenanceOf(d), null, "no maintenance by default");
  eq(consume.hiddenSectionIds(d), [], "nothing hidden by default");
  eq(consume.faqItemsOf(d).length, 6, "default faq = the live six");

  const garbage = consume.normalizePublicSiteContent({
    announcement: 5,
    sections: [],
    faq: { items: {} },
    maintenance: "x",
  });
  eq(garbage, d, "garbage normalizes to defaults");

  const live = consume.normalizePublicSiteContent({
    announcement: { enabled: true, text: "خصم اليوم", url: "" },
    sections: { "sec-coins": false, reviews: false },
    maintenance: { enabled: true, message: "راجعين قريبًا" },
    faq: { items: [{ q: "س١", a: "ج١" }] },
  });
  eq(consume.announcementOf(live), { text: "خصم اليوم", url: "" }, "bar on");
  eq(consume.maintenanceOf(live), "راجعين قريبًا", "maintenance message");
  eq(consume.hiddenSectionIds(live), ["sec-coins", "reviews"], "hidden ids");
  eq(consume.faqItemsOf(live), [{ q: "س١", a: "ج١" }], "faq replaced");
});
