/**
 * اختبارات مصدر تغذية المصدر من قاعدة البيانات + الاحتياطي الانتقالي
 * (إصلاح F-01/D-05 — هجرة 021): `deno test feed_source.test.ts`
 * من غير أي استيراد خارجي (بتشتغل offline بالكامل).
 *
 * الشكل المُختبَر هو نفس وثيقة migo-provenance v1 الحية (نفس المنتجات
 * والتكاليف اللي في الملف المنشور النهاردة) عشان إثبات «حساب الأرضية
 * ما اتغيّرش» يبقى على بيانات حقيقية مش أرقام مخترعة:
 *   - القراءة من الجدول بترجّع الوثيقة المخزّنة بحذافيرها.
 *   - الجدول فاضي/غايب/مفتاح غايب = المصدر بيرجّع null والاحتياطي
 *     (الرابط) بيخدم نفس اللقطة — المستهلك عمره ما يشوف فراغ.
 *   - لقطة قاعدة قديمة (> 24 ساعة) بتتخطّى للرابط الطازج.
 *   - منفّذ الأسعار بيحسب نفس الأرضيات بالظبط من مسار القاعدة ومن
 *     مسار الرابط على نفس البيانات (1.49→123 · 4.65→384 · 0.04→4).
 */
import {
  dbFeedLoader,
  FallbackRegistrySource,
  JsonRegistrySource,
} from "./registry.ts";
import type { RegistrySnapshot } from "./types.ts";
import {
  type ApplyPriceFloorArgs,
  runPriceFloorApplier,
} from "../price_floors/mod.ts";

// مساعدات تأكيد صغيرة (بديل std/assert عشان الاختبار يشتغل offline).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ------------------------------------------------------------ البيانات

const GENERATED_AT = "2026-11-19T00:00:00Z";
const NOW = new Date("2026-11-19T01:00:00Z"); // بعد التوليد بساعة

/** نفس سجلات التغذية الحية (8 منتجات مربوطة) — الشكل والقيم حرفيًا. */
function fixtureFeed(generatedAt = GENERATED_AT): RegistrySnapshot {
  return {
    feed: "migo-provenance",
    version: 1,
    generated_at: generatedAt,
    records: [
      { product_key: "duolingo-super-12m", store_sku: "Duolingo Super (12 شهر)", supplier_key: "bunny", listing_ref: "12", cost_usd: 1.49, store_price_egp: 123 },
      { product_key: "figma-pro-edu-2y", store_sku: "Figma Pro Edu (سنتان)", supplier_key: "bunny", listing_ref: "44", cost_usd: 3.99, store_price_egp: 330 },
      { product_key: "gemini-pro-12m", store_sku: "Google Gemini Pro (12 شهر (FW))", supplier_key: "bunny", listing_ref: "93", cost_usd: 0.65, store_price_egp: 63 },
      { product_key: "gmail-accounts", store_sku: "حسابات Gmail جاهزة (حساب دائم)", supplier_key: "drayik", listing_ref: "fresh_gmail_accoun_e780", cost_usd: 0.75, store_price_egp: 62 },
      { product_key: "grok-plus-1m", store_sku: "Super Grok (xAI) (Grok Plus — شهر واحد)", supplier_key: "drayik", listing_ref: "grok_plus_1_month_53d6", cost_usd: 4.65, store_price_egp: 349 },
      { product_key: "notion-plus-1y", store_sku: "Notion Plus (سنة واحدة)", supplier_key: "bunny", listing_ref: "91", cost_usd: 2.8, store_price_egp: 231 },
      { product_key: "outlook-hotmail-accounts", store_sku: "حسابات Outlook / Hotmail (حساب دائم)", supplier_key: "bunny", listing_ref: "29", cost_usd: 0.04, store_price_egp: 6 },
      { product_key: "spotify-premium", store_sku: "Spotify Premium (3 أشهر (رابط))", supplier_key: "bunny", listing_ref: "11", cost_usd: 1.0, store_price_egp: 82.5 },
    ],
  };
}

// ------------------------------------------------------------ وهميات

interface FetchCall {
  url: string;
  headers: Record<string, string>;
}

/** fetch وهمي بيحاكي PostgREST: بيرد بصفوف ثابتة وبيسجّل النداءات. */
function fakePostgrest(
  rows: unknown,
  status = 200,
): { fetchFn: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchFn = ((input: unknown, init?: { headers?: Record<string, string> }) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(rows),
    });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

function dbSource(rows: unknown, status = 200, key = "test-service-key") {
  const { fetchFn, calls } = fakePostgrest(rows, status);
  const loader = dbFeedLoader({
    baseUrl: "https://store-ref.supabase.co",
    keyOf: () => key,
    fetchFn,
  });
  return { source: new JsonRegistrySource(loader, () => NOW), calls };
}

function urlSource(feed: RegistrySnapshot | null) {
  return new JsonRegistrySource(
    () => feed ? Promise.resolve(feed) : Promise.reject(new Error("feed http 404")),
    () => NOW,
  );
}

// ------------------------------------------------------------ الاختبارات

Deno.test("db loader returns the stored feed document verbatim, service-key headers sent", async () => {
  const feed = fixtureFeed();
  const { fetchFn, calls } = fakePostgrest([{ feed }]);
  const loader = dbFeedLoader({
    baseUrl: "https://store-ref.supabase.co",
    keyOf: () => "test-service-key",
    fetchFn,
  });
  const raw = await loader();
  eq(raw, feed, "stored document returned verbatim");
  eq(calls.length, 1, "one PostgREST call");
  ok(calls[0].url.includes("/rest/v1/provenance_feed?id=eq.1"), "singleton row queried");
  eq(calls[0].headers["Authorization"], "Bearer test-service-key", "service key presented");
});

Deno.test("db source is null when the table is empty, missing, or the key is unset", async () => {
  eq(await dbSource([]).source.snapshot(), null, "no row → null");
  eq(await dbSource({ message: "not found" }, 404).source.snapshot(), null, "404 (no table yet) → null");
  eq(await dbSource([{ feed: fixtureFeed() }], 200, "").source.snapshot(), null, "no service key → null");
});

Deno.test("fallback serves the URL snapshot when the DB table is empty", async () => {
  const feed = fixtureFeed();
  const src = new FallbackRegistrySource(dbSource([]).source, urlSource(feed));
  const snap = await src.snapshot();
  eq(snap, feed, "URL snapshot served during transition");
  const rec = await src.resolve("grok-plus-1m");
  eq(rec?.cost_usd, 4.65, "resolve works on the fallback snapshot");
});

Deno.test("fallback prefers the DB snapshot when the table is populated", async () => {
  const dbFeed = fixtureFeed("2026-11-19T00:30:00Z");
  dbFeed.records = dbFeed.records.map((r) =>
    r.product_key === "grok-plus-1m" ? { ...r, cost_usd: 5.0 } : r
  );
  const src = new FallbackRegistrySource(
    dbSource([{ feed: dbFeed }]).source,
    urlSource(fixtureFeed()),
  );
  const snap = await src.snapshot();
  eq(snap?.generated_at, "2026-11-19T00:30:00Z", "DB snapshot wins");
  eq((await src.resolve("grok-plus-1m"))?.cost_usd, 5.0, "DB record wins");
});

Deno.test("stale DB snapshot (>24h) falls back to a fresh URL snapshot", async () => {
  const stale = fixtureFeed("2026-11-17T00:00:00Z"); // يومين قبل NOW
  const fresh = fixtureFeed();
  const src = new FallbackRegistrySource(
    new JsonRegistrySource(dbFeedLoader({
      baseUrl: "https://store-ref.supabase.co",
      keyOf: () => "test-service-key",
      fetchFn: fakePostgrest([{ feed: stale }]).fetchFn,
    }), () => NOW),
    urlSource(fresh),
  );
  const snap = await src.snapshot();
  eq(snap?.generated_at, GENERATED_AT, "fresh URL snapshot served, stale DB ignored");
});

Deno.test("both sources unavailable → null (fail-closed, never an empty feed)", async () => {
  const src = new FallbackRegistrySource(dbSource([], 500).source, urlSource(null));
  eq(await src.snapshot(), null, "null snapshot");
  eq(await src.resolve("grok-plus-1m"), null, "resolve is null too");
});

Deno.test("price floors from the DB path are identical to the URL path on the same fixture", async () => {
  const feed = fixtureFeed();
  const run = async (registry: FallbackRegistrySource | JsonRegistrySource) => {
    const calls: ApplyPriceFloorArgs[] = [];
    const report = await runPriceFloorApplier({
      registry,
      client: {
        applyPriceFloor: (args: ApplyPriceFloorArgs) => {
          calls.push(args);
          return Promise.resolve("already_at_or_above" as const);
        },
      },
      logError: () => {},
    });
    return { calls, report };
  };

  const viaDb = await run(new FallbackRegistrySource(
    dbSource([{ feed }]).source,
    urlSource(null), // الرابط واقع: القاعدة لوحدها لازم تكفي
  ));
  const viaUrl = await run(urlSource(feed));

  eq(viaDb.report.ok, true, "DB-path run ok");
  eq(viaDb.report.feed_generated_at, GENERATED_AT, "DB-path feed stamp");
  eq(viaDb.calls, viaUrl.calls, "identical RPC args from both paths");
  eq(viaDb.calls.length, 8, "all 8 mapped records applied");

  const floorOf = (calls: ApplyPriceFloorArgs[], key: string) =>
    calls.find((c) => c.p_product_key === key)?.p_floor_egp;
  eq(floorOf(viaDb.calls, "duolingo-super-12m"), 123, "duolingo floor 1.49 → 123");
  eq(floorOf(viaDb.calls, "grok-plus-1m"), 384, "grok floor 4.65 → 384");
  eq(floorOf(viaDb.calls, "outlook-hotmail-accounts"), 4, "outlook floor 0.04 → 4");
  eq(floorOf(viaDb.calls, "spotify-premium"), 83, "spotify floor 1.00 → 83");
});
