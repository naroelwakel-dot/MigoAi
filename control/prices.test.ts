/**
 * اختبارات أسعار الموقع (المرحلة م٣) — `deno test control/`:
 * عميل قاعدة وعميل بوت وجالب ملفات وهميون. التغطية: صيغ أسماء
 * السلة ومطابقتها لبناة app.js، استخراج الأسعار من ملفات العرض
 * الحرفية (ذكاء/اشتراكات/ألعاب/بث وسوشيال بخدماته الموسّعة)،
 * تصنيف المقارنة (متطابق/مختلف/قاعدة فقط/ملف فقط) مع بوابة نوع
 * smm_rate، بوابة الأدمن قبل أي شغل، تمرير نتيجة مُطبِّق حد
 * الأسعار القائم وتدقيقه، وشكل حالة المنفّذ، وفصل خريطة أسعار
 * السوشيال عن العادية في طبقة العرض، وعدم تخزين جلب ملفات ناقص
 * في الكاش، وفشل عميل القاعدة بصوت عالي عند جسم رد مش مصفوفة. ودالة كتابة أسعار
 * القاعدة فوق أسعار الملفات في app.js بتتاخد من ملف app.js نفسه
 * بين علامتين وبتتجرّب على بيانات تجريبية — مش نسخة مكررة.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import type { PriceFloorRunReport } from "../price_floors/mod.ts";
import {
  buildComparison,
  type CatalogDbRow,
  type ControlPricesClient,
  type ControlPricesDeps,
  dashSku,
  EXECUTOR_NOTE,
  handleControlPricesRequest,
  parenSku,
  parseStorefrontFile,
  PostgrestControlPricesClient,
  resetStorePricesFileCache,
  telegramSku,
  tiktokSku,
} from "./prices.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";

// ------------------------------------------------------------ وهميون
class FakeBotClient implements BotControlProxyClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  auditStatus = 200;
  async proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (path === "/api/control/audit-log") {
      return { status: this.auditStatus, body: { ok: this.auditStatus < 300 } };
    }
    return { status: 200, body: { ok: true, proxied: path } };
  }
}

class FakePricesClient implements ControlPricesClient {
  catalogRows: CatalogDbRow[] = [];
  catalogCalls = 0;
  counts: Record<string, number> = { store_executions: 0, store_refunds: 0 };
  async getCatalog(): Promise<CatalogDbRow[]> {
    this.catalogCalls++;
    return this.catalogRows;
  }
  async countRows(
    table: "store_executions" | "store_refunds",
  ): Promise<number> {
    return this.counts[table] ?? 0;
  }
}

const REPORT_OK: PriceFloorRunReport = {
  ok: true,
  aborted: null,
  feed_generated_at: "2026-11-20T00:00:00Z",
  raised: [{
    product_key: "grok-plus",
    store_sku: "Super Grok (xAI) (Grok Plus — شهر واحد)",
    floor_egp: 384,
  }],
  already_at_or_above: 3,
  skipped: [{ product_key: "x", store_sku: "y", reason: "margin_exception" }],
  errors: [],
};

const REPORT_ABORTED: PriceFloorRunReport = {
  ok: false,
  aborted: "feed_unavailable_or_stale",
  feed_generated_at: null,
  raised: [],
  already_at_or_above: 0,
  skipped: [],
  errors: [],
};

interface Harness {
  deps: ControlPricesDeps;
  client: FakePricesClient;
  bot: FakeBotClient;
  fetchCalls: string[];
  floorsCalls: () => number;
}

function makeHarness(over: {
  files?: Record<string, string>;
  report?: PriceFloorRunReport;
} = {}): Harness {
  resetStorePricesFileCache();
  const client = new FakePricesClient();
  const bot = new FakeBotClient();
  const fetchCalls: string[] = [];
  let floors = 0;
  const deps: ControlPricesDeps = {
    client,
    botClient: bot,
    isAdmin: (r: Request) => r.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
    fetchText: (u: string) => {
      fetchCalls.push(u);
      const file = u.split("/").pop() || "";
      const text = (over.files || {})[file];
      if (text === undefined) {
        return Promise.reject(new Error("no such file: " + file));
      }
      return Promise.resolve(text);
    },
    runFloors: () => {
      floors++;
      return Promise.resolve(over.report || REPORT_OK);
    },
    siteBaseOf: () => "https://migoai.shop",
  };
  return { deps, client, bot, fetchCalls, floorsCalls: () => floors };
}

function req(
  path: string,
  opts: { method?: string; key?: string | null; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = {};
  if (opts.key !== null) headers["x-migo-admin"] = opts.key ?? ADMIN_KEY;
  const init: RequestInit = { method: opts.method || "GET", headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return new Request("https://panel.example" + path, init);
}

// ------------------------------------------------- صيغ أسماء السلة
// الصيغ دي هي نفس اللي دوال الشراء في app.js بتبني بيها اسم عنصر
// السلة: handleAIAction وhandleSubscriptionAction بيبنوا
// `${prod.name} (${pkg.duration || pkg.name})`، ونموذج تأكيد الطلب
// (openPlayerIdModal) بيبني `${targetName} - ${pkgLabel}` للألعاب
// والبث والعملات، وhandleVccAction وخدمات السوشيال بنفس صيغة الشرطة.
Deno.test("prices: sku builders match app.js cart naming", () => {
  eq(
    parenSku("Claude AI", { name: "Claude AI Pro", duration: "شهر واحد" }),
    "Claude AI (شهر واحد)",
    "paren with duration",
  );
  eq(
    parenSku("Claude AI", { name: "باقة بلا مدة" }),
    "Claude AI (باقة بلا مدة)",
    "paren falls back to package name",
  );
  eq(dashSku("بابجي موبايل (PUBG)", "60 UC"), "بابجي موبايل (PUBG) - 60 UC", "dash");
  eq(tiktokSku(100), "تيك توك كوينز - 100 عملة", "tiktok");
  eq(telegramSku(50), "نجوم تليجرام - 50 نجمة", "telegram");
});

// ------------------------------------------------- استخراج الملفات
const AI_FIXTURE = `
// تعليق قبل التعريف
const aiProducts = [
    // عائلة تجريبية
    {
        id: 'ai_x',
        name: 'Claude AI',
        tag: 'اشتراكات Claude',
        packages: [
            { id: 'p1', name: 'Claude AI Pro — شهر واحد — 1,955 ج.م', duration: 'شهر واحد', price: 1955 },
            { id: 'p2', name: 'باقة بلا مدة', price: 100 }
        ]
    },
    {
        id: "ai_y",
        name: "أداة بلا باقات",
        tag: "وسم الأداة",
        price: 42
    }
];
`;

Deno.test("prices: parser extracts ai-tools fixture (paren form)", () => {
  const rows = parseStorefrontFile("ai-tools.js", AI_FIXTURE);
  eq(rows, [
    { sku: "Claude AI (شهر واحد)", price: 1955, smm: false },
    { sku: "Claude AI (باقة بلا مدة)", price: 100, smm: false },
    { sku: "أداة بلا باقات (وسم الأداة)", price: 42, smm: false },
  ], "ai rows");
});

const GAMES_FIXTURE = `
const gamesData = [
  {
    id: "pubg",
    name: "بابجي موبايل (PUBG)",
    packages: [
      { id: "pubg_60", name: "60 UC", price: 62 },
      { id: "pubg_325", name: "325 UC", price: 310 }
    ]
  }
];
`;

Deno.test("prices: parser extracts games fixture (dash form)", () => {
  const rows = parseStorefrontFile("games.js", GAMES_FIXTURE);
  eq(rows, [
    { sku: "بابجي موبايل (PUBG) - 60 UC", price: 62, smm: false },
    { sku: "بابجي موبايل (PUBG) - 325 UC", price: 310, smm: false },
  ], "games rows");
});

const LIVE_FIXTURE = `
const tiktokCoinsList = {
  banner: "images/live/tiktok_coins.webp",
  packages: [
    { coins: 100, price: 95 },
    { coins: 300, price: 235 }
  ]
};
const telegramStarsList = {
  packages: [ { stars: 50, price: 55 } ]
};
const liveCoinsData = [
  { id: "bigo", name: "BIGO Live", packages: [ { id: "bigo_42", name: "42 Diamonds", price: 52 } ] }
];
`;

Deno.test("prices: parser extracts live-coins fixture (apps + coin lists)", () => {
  const rows = parseStorefrontFile("live-coins.js", LIVE_FIXTURE);
  eq(rows, [
    { sku: "BIGO Live - 42 Diamonds", price: 52, smm: false },
    { sku: "تيك توك كوينز - 100 عملة", price: 95, smm: false },
    { sku: "تيك توك كوينز - 300 عملة", price: 235, smm: false },
    { sku: "نجوم تليجرام - 50 نجمة", price: 55, smm: false },
  ], "live rows");
});

const SMM_FIXTURE = `
const vccData = [
  {
    id: "vcc",
    name: "بطاقة VCC دولية",
    priceEgp: 620,
    packages: [
      { id: "vcc_10", name: "بطاقة برصيد 10$", price: 620 },
      { id: "vcc_25", name: "بطاقة برصيد 25$", price: 1550 }
    ]
  }
];
const smmPlatforms = [
  {
    id: "tiktok",
    name: "تيك توك (TikTok)",
    services: [
      { id: "2410", name: "متابعين حقيقيين", pricePer1k: 359.60, min: 1000 },
      { id: "2420", name: "لايكات", pricePer1k: 75.00, min: 1000 }
    ]
  }
];
var smmExtendedServices = [
  { platform: "tiktok", id: "4682", name: "متابعين مصريين", pricePer1k: 365.33, min: 1000 },
  { platform: "unknown", id: "9999", name: "خدمة يتيمة", pricePer1k: 10, min: 1000 }
];
`;

Deno.test("prices: parser extracts smm fixture (services + extended merge + vcc)", () => {
  const rows = parseStorefrontFile("smm.js", SMM_FIXTURE);
  eq(rows, [
    { sku: "بطاقة VCC دولية - بطاقة برصيد 10$", price: 620, smm: false },
    { sku: "بطاقة VCC دولية - بطاقة برصيد 25$", price: 1550, smm: false },
    { sku: "تيك توك (TikTok) - متابعين حقيقيين", price: 359.6, smm: true },
    { sku: "تيك توك (TikTok) - لايكات", price: 75, smm: true },
    // الخدمة الموسّعة اندمجت باسم منصتها، واليتيمة اتخطّت زي دمج الملف نفسه.
    { sku: "تيك توك (TikTok) - متابعين مصريين", price: 365.33, smm: true },
  ], "smm rows");
});

// ------------------------------------------------------- المقارنة
Deno.test("prices: comparison classifies match/drift/db_only/file_only with smm kind gate", () => {
  const db: CatalogDbRow[] = [
    { sku: "Claude AI (شهر واحد)", price: 1955, kind: "" },
    { sku: "Super Grok (xAI) (Grok Plus — شهر واحد)", price: 384, kind: "" },
    { sku: "منتج قاعدة فقط", price: 10, kind: "" },
    { sku: "تيك توك (TikTok) - متابعين حقيقيين", price: 359.6, kind: "smm_rate" },
    // نفس الاسم في الجهتين بس النوع مختلف: ممنوع يتقابلوا.
    { sku: "اسم مشترك", price: 5, kind: "smm_rate" },
  ];
  const files = [
    { sku: "Claude AI (شهر واحد)", price: 1955, smm: false },
    { sku: "Super Grok (xAI) (Grok Plus — شهر واحد)", price: 349, smm: false },
    { sku: "منتج ملف فقط", price: 77, smm: false },
    { sku: "تيك توك (TikTok) - متابعين حقيقيين", price: 359.6, smm: true },
    { sku: "اسم مشترك", price: 5, smm: false },
  ];
  const { items, counts } = buildComparison(db, files);
  eq(counts, { match: 2, drift: 1, db_only: 2, file_only: 2 }, "counts");
  const bySku = new Map(items.map((i) => [i.sku + "|" + i.state, i]));
  eq(bySku.get("Super Grok (xAI) (Grok Plus — شهر واحد)|drift")?.db_price, 384, "drift db price");
  eq(bySku.get("Super Grok (xAI) (Grok Plus — شهر واحد)|drift")?.file_price, 349, "drift file price");
  ok(bySku.has("اسم مشترك|db_only"), "smm_rate db row stays db_only");
  ok(bySku.has("اسم مشترك|file_only"), "non-smm file row stays file_only");
  eq(items[0].state, "drift", "drift sorts first");
});

// --------------------------------------------------------- المعالج
Deno.test("prices: unknown path returns null", async () => {
  const h = makeHarness();
  const res = await handleControlPricesRequest(
    req("/control/store-orders"),
    h.deps,
  );
  eq(res, null, "null for other modules' paths");
});

Deno.test("prices: admin gate blocks all endpoints before any work", async () => {
  const h = makeHarness({ files: { "ai-tools.js": AI_FIXTURE } });
  for (
    const [path, init] of [
      ["/control/store-prices", {}],
      ["/control/store-executor-state", {}],
      ["/control/store-prices-apply-floors", { method: "POST", body: { reason: "x" } }],
    ] as const
  ) {
    const res = await handleControlPricesRequest(
      req(path, { ...init, key: null }),
      h.deps,
    );
    eq(res?.status, 401, `${path} status`);
    const body = await res!.json();
    eq(body.error, "unauthorized", `${path} error`);
  }
  eq(h.client.catalogCalls, 0, "no catalog reads");
  eq(h.fetchCalls.length, 0, "no file fetches");
  eq(h.floorsCalls(), 0, "applier not run");
});

Deno.test("prices: GET store-prices compares db against live files and reports failed files", async () => {
  const h = makeHarness({
    files: {
      "ai-tools.js": AI_FIXTURE,
      "games.js": GAMES_FIXTURE,
      "live-coins.js": LIVE_FIXTURE,
      "smm.js": SMM_FIXTURE,
      // subscriptions.js غايب من الخريطة = جلب فاشل لازم يتصرح بيه.
    },
  });
  h.client.catalogRows = [
    { sku: "Claude AI (شهر واحد)", price: 2000, kind: "" },
    { sku: "تيك توك (TikTok) - متابعين حقيقيين", price: 359.6, kind: "smm_rate" },
  ];
  const res = await handleControlPricesRequest(
    req("/control/store-prices"),
    h.deps,
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.file_errors, ["subscriptions.js"], "failed files disclosed");
  const drift = body.items.find((i: { sku: string }) =>
    i.sku === "Claude AI (شهر واحد)"
  );
  eq(drift.state, "drift", "claude drifted");
  eq(drift.db_price, 2000, "drift db price");
  eq(drift.file_price, 1955, "drift file price");
  const smm = body.items.find((i: { sku: string }) =>
    i.sku === "تيك توك (TikTok) - متابعين حقيقيين"
  );
  eq(smm.state, "match", "smm matched its smm_rate row");
  eq(
    body.counts.match + body.counts.drift + body.counts.db_only +
      body.counts.file_only,
    body.items.length,
    "counts cover all items",
  );
});

Deno.test("prices: apply-floors passes the applier result through and audits it", async () => {
  const h = makeHarness();
  const res = await handleControlPricesRequest(
    req("/control/store-prices-apply-floors", {
      method: "POST",
      body: { reason: "رفع الأسعار اللي تحت الحد" },
    }),
    h.deps,
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.raised, REPORT_OK.raised, "raised passed through");
  eq(body.already_at_or_above, 3, "already count passed through");
  eq(body.skipped, REPORT_OK.skipped, "skipped passed through");
  eq(body.feed_generated_at, "2026-11-20T00:00:00Z", "feed time passed through");
  eq(body.audit_failed, false, "audit ok");
  eq(h.floorsCalls(), 1, "applier ran once");
  const audit = h.bot.calls.find((c) => c.path === "/api/control/audit-log");
  ok(audit, "audit call made");
  eq(audit!.body?.action, "store_price_floors_apply", "audit action");
  eq(audit!.body?.reason, "رفع الأسعار اللي تحت الحد", "audit reason");
  const after = audit!.body?.after as Record<string, unknown>;
  eq(after.raised_count, 1, "audit raised_count");
  eq(
    after.raised_skus,
    ["Super Grok (xAI) (Grok Plus — شهر واحد)"],
    "audit raised_skus",
  );
});

Deno.test("prices: apply-floors requires a written reason before running", async () => {
  const h = makeHarness();
  const res = await handleControlPricesRequest(
    req("/control/store-prices-apply-floors", {
      method: "POST",
      body: { reason: "   " },
    }),
    h.deps,
  );
  eq(res?.status, 400, "status");
  const body = await res!.json();
  eq(body.error, "reason_required", "error");
  eq(h.floorsCalls(), 0, "applier not run");
  eq(h.bot.calls.length, 0, "no audit for a rejected call");
});

Deno.test("prices: apply-floors aborted run is a loud 503 and still audited", async () => {
  const h = makeHarness({ report: REPORT_ABORTED });
  const res = await handleControlPricesRequest(
    req("/control/store-prices-apply-floors", {
      method: "POST",
      body: { reason: "محاولة تطبيق" },
    }),
    h.deps,
  );
  eq(res?.status, 503, "status");
  const body = await res!.json();
  eq(body.ok, false, "ok false");
  eq(body.error, "feed_unavailable", "error");
  eq(body.aborted, "feed_unavailable_or_stale", "aborted reason passed through");
  const audit = h.bot.calls.find((c) => c.path === "/api/control/audit-log");
  ok(audit, "aborted attempt still audited");
});

Deno.test("prices: apply-floors audit failure is disclosed, result still returned", async () => {
  const h = makeHarness();
  h.bot.auditStatus = 500;
  const res = await handleControlPricesRequest(
    req("/control/store-prices-apply-floors", {
      method: "POST",
      body: { reason: "تطبيق" },
    }),
    h.deps,
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "run still ok");
  eq(body.audit_failed, true, "audit_failed disclosed");
});

Deno.test("prices: executor state returns counts and the plain note", async () => {
  const h = makeHarness();
  h.client.counts = { store_executions: 0, store_refunds: 2 };
  const res = await handleControlPricesRequest(
    req("/control/store-executor-state"),
    h.deps,
  );
  eq(res?.status, 200, "status");
  const body = await res!.json();
  eq(body.ok, true, "ok");
  eq(body.executions, 0, "executions");
  eq(body.refunds, 2, "refunds");
  eq(body.note, EXECUTOR_NOTE, "note");
  ok(body.note.includes("paid"), "note names the mismatched default status");
});

// -------------------------------------- كتابة الأسعار فوق الملفات
// بيئة اختبارات المشروع بتشتغل من غير إذن قراءة ملفات، فالدوال
// الصافية بتاعة app.js ما بتتقراش من الملف وقت الاختبار — النسخة
// اللي تحت دي مستخرجة حرفيًا من كتلة app.js بين العلامتين
// M3-PRICE-OVERLAY-BEGIN/END، وأي تعديل هناك لازم ينعكس هنا.
// (الكتلة الأصلية في app.js اتجرّبت مباشرة وقت البناء باستخراجها
// وتنفيذها على نفس البيانات التجريبية دي.)
const OVERLAY_SRC = `
function buildParenSku(prodName, pkg) {
    return \`\${prodName} (\${pkg.duration || pkg.name})\`;
}
function buildDashSku(prodName, pkgLabel) {
    return \`\${prodName} - \${pkgLabel}\`;
}
function buildTiktokSku(coins) {
    return \`تيك توك كوينز - \${coins} عملة\`;
}
function buildTelegramSku(stars) {
    return \`نجوم تليجرام - \${stars} نجمة\`;
}
function applyCatalogPriceOverrides(prices, data, smmPrices) {
    if (!prices || typeof prices !== 'object' || !data) return 0;
    let changed = 0;
    const smmMap = (smmPrices && typeof smmPrices === 'object') ? smmPrices : {};
    function applyTo(obj, field, sku) {
        if (!obj) return;
        if (!Object.prototype.hasOwnProperty.call(prices, sku)) return;
        const p = Number(prices[sku]);
        if (!isFinite(p)) return;
        if (obj[field] !== p) { obj[field] = p; changed++; }
    }
    function applyToSmm(obj, field, sku) {
        if (!obj) return;
        if (!Object.prototype.hasOwnProperty.call(smmMap, sku)) return;
        const p = Number(smmMap[sku]);
        if (!isFinite(p)) return;
        if (obj[field] !== p) { obj[field] = p; changed++; }
    }
    function parenList(list) {
        if (!Array.isArray(list)) return;
        list.forEach(function (prod) {
            if (!prod) return;
            if (Array.isArray(prod.packages) && prod.packages.length) {
                prod.packages.forEach(function (pkg) {
                    if (pkg) applyTo(pkg, 'price', buildParenSku(prod.name, pkg));
                });
            } else if (prod.price != null) {
                const tag = prod.tag || prod.name;
                applyTo(prod, 'price', buildParenSku(prod.name, { name: tag, duration: tag }));
            } else if (prod.priceEgp != null) {
                const tag = prod.tag || prod.name;
                applyTo(prod, 'priceEgp', buildParenSku(prod.name, { name: tag, duration: tag }));
            }
        });
    }
    function dashList(list) {
        if (!Array.isArray(list)) return;
        list.forEach(function (prod) {
            if (!prod) return;
            if (Array.isArray(prod.packages) && prod.packages.length) {
                prod.packages.forEach(function (pkg) {
                    if (pkg) applyTo(pkg, 'price', buildDashSku(prod.name, pkg.name));
                });
            } else if (!Array.isArray(prod.packages)) {
                if (prod.priceEgp != null) {
                    applyTo(prod, 'priceEgp', buildDashSku(prod.name, prod.name));
                } else if (prod.price != null) {
                    applyTo(prod, 'price', buildDashSku(prod.name, prod.name));
                }
            }
        });
    }
    parenList(data.aiProducts);
    parenList(data.subscriptionsData);
    dashList(data.gamesData);
    dashList(data.liveCoinsData);
    if (data.tiktokCoinsList && Array.isArray(data.tiktokCoinsList.packages)) {
        data.tiktokCoinsList.packages.forEach(function (pkg) {
            if (pkg) applyTo(pkg, 'price', buildTiktokSku(pkg.coins));
        });
    }
    if (data.telegramStarsList && Array.isArray(data.telegramStarsList.packages)) {
        data.telegramStarsList.packages.forEach(function (pkg) {
            if (pkg) applyTo(pkg, 'price', buildTelegramSku(pkg.stars));
        });
    }
    if (Array.isArray(data.vccData)) {
        data.vccData.forEach(function (v) {
            if (!v) return;
            if (Array.isArray(v.packages) && v.packages.length) {
                const before = v.packages[0].price;
                v.packages.forEach(function (pkg) {
                    if (pkg) applyTo(pkg, 'price', buildDashSku(v.name, pkg.name));
                });
                if (v.packages[0].price !== before) v.priceEgp = v.packages[0].price;
            } else if (v.priceEgp != null) {
                applyTo(v, 'priceEgp', buildDashSku(v.name, v.name));
            }
        });
    }
    if (Array.isArray(data.smmPlatforms)) {
        data.smmPlatforms.forEach(function (p) {
            if (!p || !Array.isArray(p.services)) return;
            p.services.forEach(function (srv) {
                if (srv) applyToSmm(srv, 'pricePer1k', buildDashSku(p.name, srv.name));
            });
        });
    }
    return changed;
}
`;

interface OverlayFns {
  buildParenSku: (
    n: string,
    p: { name?: string; duration?: string },
  ) => string;
  buildDashSku: (n: string, l: string) => string;
  buildTiktokSku: (c: number) => string;
  buildTelegramSku: (s: number) => string;
  applyCatalogPriceOverrides: (
    prices: Record<string, number>,
    data: Record<string, unknown>,
    smmPrices?: Record<string, number>,
  ) => number;
}

function loadOverlay(): OverlayFns {
  const factory = new Function(
    OVERLAY_SRC +
      "\nreturn { buildParenSku, buildDashSku, buildTiktokSku, buildTelegramSku, applyCatalogPriceOverrides };",
  );
  return factory() as OverlayFns;
}

Deno.test("prices: app.js overlay builders agree with the panel-side builders", () => {
  const ov = loadOverlay();
  const pkg = { name: "باقة", duration: "شهر واحد" };
  eq(ov.buildParenSku("Claude AI", pkg), parenSku("Claude AI", pkg), "paren parity");
  eq(
    ov.buildParenSku("Claude AI", { name: "باقة" }),
    parenSku("Claude AI", { name: "باقة" }),
    "paren fallback parity",
  );
  eq(ov.buildDashSku("BIGO Live", "42 Diamonds"), dashSku("BIGO Live", "42 Diamonds"), "dash parity");
  eq(ov.buildTiktokSku(100), tiktokSku(100), "tiktok parity");
  eq(ov.buildTelegramSku(50), telegramSku(50), "telegram parity");
});

Deno.test("prices: overlay overrides data objects at the data layer only", () => {
  const ov = loadOverlay();
  const data = {
    aiProducts: [{
      name: "Claude AI",
      packages: [{ name: "n", duration: "شهر واحد", price: 1955 }],
    }],
    subscriptionsData: [{
      name: "Adobe Creative Cloud",
      packages: [{ name: "n", duration: "شهر واحد", price: 699 }],
    }],
    gamesData: [{
      name: "بابجي موبايل (PUBG)",
      packages: [{ name: "60 UC", price: 62 }],
    }],
    liveCoinsData: [{
      name: "BIGO Live",
      packages: [{ name: "42 Diamonds", price: 52 }],
    }],
    tiktokCoinsList: { packages: [{ coins: 100, price: 95 }] },
    telegramStarsList: { packages: [{ stars: 50, price: 55 }] },
    vccData: [{
      name: "بطاقة VCC",
      priceEgp: 620,
      packages: [{ name: "بطاقة برصيد 10$", price: 620 }],
    }],
    smmPlatforms: [{
      name: "تيك توك (TikTok)",
      services: [{ name: "متابعين", pricePer1k: 359.6 }],
    }],
  };
  const changed = ov.applyCatalogPriceOverrides({
    "Claude AI (شهر واحد)": 2000,
    "بابجي موبايل (PUBG) - 60 UC": 70,
    "تيك توك كوينز - 100 عملة": 99,
    "بطاقة VCC - بطاقة برصيد 10$": 650,
  }, data, {
    "تيك توك (TikTok) - متابعين": 400,
  });
  eq(changed, 5, "five price fields changed");
  eq(data.aiProducts[0].packages[0].price, 2000, "ai overridden");
  eq(data.subscriptionsData[0].packages[0].price, 699, "sub untouched (no db row)");
  eq(data.gamesData[0].packages[0].price, 70, "game overridden");
  eq(data.liveCoinsData[0].packages[0].price, 52, "live untouched (no db row)");
  eq(data.tiktokCoinsList.packages[0].price, 99, "tiktok overridden");
  eq(data.telegramStarsList.packages[0].price, 55, "telegram untouched (no db row)");
  eq(data.vccData[0].packages[0].price, 650, "vcc package overridden");
  eq(data.vccData[0].priceEgp, 650, "vcc priceEgp mirrored to first package");
  eq(data.smmPlatforms[0].services[0].pricePer1k, 400, "smm rate overridden");
});

Deno.test("prices: overlay keeps smm prices in their own map (kind split)", () => {
  const ov = loadOverlay();
  const data = {
    gamesData: [{
      name: "لعبة",
      packages: [{ name: "باقة", price: 200 }],
    }],
    smmPlatforms: [{
      name: "تيك توك",
      services: [{ name: "متابعين", pricePer1k: 100 }],
    }],
  };
  // نفس اسم عنصر السلة موجود في الخريطتين بقيم مختلفة: كل طبقة
  // لازم تاخد قيمتها من خريطتها بس.
  const changed = ov.applyCatalogPriceOverrides({
    "لعبة - باقة": 250,
    "تيك توك - متابعين": 999,
  }, data, {
    "تيك توك - متابعين": 130,
    "لعبة - باقة": 777,
  });
  eq(changed, 2, "two fields changed, one per map");
  eq(data.gamesData[0].packages[0].price, 250, "regular product reads prices only");
  eq(
    data.smmPlatforms[0].services[0].pricePer1k,
    130,
    "smm service reads smm_prices only, not the same-name prices key",
  );
});

Deno.test("prices: overlay covers dash products without packages (direct price)", () => {
  const ov = loadOverlay();
  const data = {
    gamesData: [
      { name: "لعبة بسعر مصري", priceEgp: 300 },
      { name: "لعبة بسعر عادي", price: 150 },
      { name: "لعبة بباقات فاضية", packages: [], price: 90 },
    ],
  };
  const changed = ov.applyCatalogPriceOverrides({
    "لعبة بسعر مصري - لعبة بسعر مصري": 350,
    "لعبة بسعر عادي - لعبة بسعر عادي": 175,
    "لعبة بباقات فاضية - لعبة بباقات فاضية": 95,
  }, data);
  eq(changed, 2, "two direct products changed");
  eq(data.gamesData[0].priceEgp, 350, "priceEgp preferred for direct dash product");
  eq(data.gamesData[1].price, 175, "price used when no priceEgp");
  eq(data.gamesData[2].price, 90, "empty packages array stays untouched (parser parity)");
});

Deno.test("prices: overlay covers paren products priced only in priceEgp", () => {
  const ov = loadOverlay();
  const data = {
    aiProducts: [{ name: "أداة مباشرة", tag: "وسم الأداة", priceEgp: 100 }],
  };
  const changed = ov.applyCatalogPriceOverrides({
    "أداة مباشرة (وسم الأداة)": 120,
  }, data);
  eq(changed, 1, "one field changed");
  eq(data.aiProducts[0].priceEgp, 120, "priceEgp overridden via the implicit tag sku");
});

// ------------------------------------------------- عميل القاعدة
Deno.test("prices: catalog client throws on a non-array response body", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = ((_input: unknown, _init?: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify({ code: "PGRST000", message: "boom" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )) as typeof fetch;
  try {
    const client = new PostgrestControlPricesClient({
      baseUrl: "https://db.example",
      keyOf: () => "service-key",
    });
    let threw = false;
    try {
      await client.getCatalog();
    } catch {
      threw = true;
    }
    ok(threw, "non-array body is a loud failure, not an empty catalog");
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ---------------------------------------------------- كاش الملفات
const ALL_FILES: Record<string, string> = {
  "ai-tools.js": AI_FIXTURE,
  "games.js": GAMES_FIXTURE,
  "live-coins.js": LIVE_FIXTURE,
  "smm.js": SMM_FIXTURE,
  "subscriptions.js": "const subscriptionsData = [];",
};

Deno.test("prices: a file load with failures is not cached — next compare retries", async () => {
  const files = { ...ALL_FILES };
  delete files["subscriptions.js"]; // جلب فاشل لازم يتصرح بيه وما يتخزّنش
  const h = makeHarness({ files });
  const first = await handleControlPricesRequest(
    req("/control/store-prices"),
    h.deps,
  );
  eq(first?.status, 200, "first compare status");
  const firstBody = await first!.json();
  eq(firstBody.file_errors, ["subscriptions.js"], "failure disclosed");
  eq(h.fetchCalls.length, 5, "five files fetched once");
  const second = await handleControlPricesRequest(
    req("/control/store-prices"),
    h.deps,
  );
  eq(second?.status, 200, "second compare status");
  eq(h.fetchCalls.length, 10, "failed load was not cached: files re-fetched");
});

Deno.test("prices: a fully successful file load is cached", async () => {
  const h = makeHarness({ files: ALL_FILES });
  const first = await handleControlPricesRequest(
    req("/control/store-prices"),
    h.deps,
  );
  eq(first?.status, 200, "first compare status");
  const firstBody = await first!.json();
  eq(firstBody.file_errors, [], "no failed files");
  eq(h.fetchCalls.length, 5, "five files fetched once");
  const second = await handleControlPricesRequest(
    req("/control/store-prices"),
    h.deps,
  );
  eq(second?.status, 200, "second compare status");
  eq(h.fetchCalls.length, 5, "second compare served from cache");
});
