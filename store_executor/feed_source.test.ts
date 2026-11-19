/**
 * اختبارات مصدر تغذية المصدر من قاعدة البيانات فقط (إصلاح
 * F-01/D-05 — هجرة 021، خطوة الإغلاق النهائية): `deno test
 * feed_source.test.ts` من غير أي استيراد خارجي (offline بالكامل).
 *
 * التغذية كانت ملفًا ثابتًا منشورًا في مستودع عام + احتياطي بالرابط
 * في مرحلة التحويل؛ بعد إثبات مسار القاعدة حيًا اتشال الملف العام
 * والاحتياطي، والمصدر الوحيد هو جدول `provenance_feed`:
 *   - القراءة من الجدول بترجّع الوثيقة المخزّنة بحذافيرها.
 *   - الجدول فاضي/غايب/مفتاح غايب/خطأ HTTP = المصدر بيرجّع null
 *     (Fail-Closed: مفيش تغذية = مفيش أرضيات ومفيش تنفيذ شراء).
 *   - لقطة قاعدة قديمة (> 24 ساعة) = null برضه — مفيش أي مسار تاني.
 *   - منفّذ الأسعار بيحسب الأرضيات الصح من مسار القاعدة على نفس
 *     بيانات التغذية الحية (1.49→123 · 4.65→384 · 0.04→4).
 */
import {
  dbFeedLoader,
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
  eq(await dbSource({ message: "not found" }, 404).source.snapshot(), null, "404 (no table) → null");
  eq(await dbSource([{ feed: fixtureFeed() }], 200, "").source.snapshot(), null, "no service key → null");
});

Deno.test("db source is null on a PostgREST error — fail-closed, resolve is null too", async () => {
  const src = dbSource([], 500).source;
  eq(await src.snapshot(), null, "500 → null snapshot");
  eq(await src.resolve("grok-plus-1m"), null, "resolve is null too");
  eq(await src.resolveBySku("Super Grok (xAI) (Grok Plus — شهر واحد)"), null, "resolveBySku is null too");
});

Deno.test("populated DB snapshot serves and resolves by key and by SKU", async () => {
  const feed = fixtureFeed();
  const src = dbSource([{ feed }]).source;
  const snap = await src.snapshot();
  eq(snap, feed, "DB snapshot served verbatim");
  eq((await src.resolve("grok-plus-1m"))?.cost_usd, 4.65, "resolve by product_key");
  eq(
    (await src.resolveBySku("حسابات Gmail جاهزة (حساب دائم)"))?.product_key,
    "gmail-accounts",
    "resolve by store SKU",
  );
});

Deno.test("stale DB snapshot (>24h) is unavailable — null, no other path", async () => {
  const stale = fixtureFeed("2026-11-17T00:00:00Z"); // يومين قبل NOW
  const src = dbSource([{ feed: stale }]).source;
  eq(await src.snapshot(), null, "stale snapshot → null");
  eq(await src.resolve("grok-plus-1m"), null, "stale snapshot resolves nothing");
});

Deno.test("price floors from the DB path are exact on the live fixture", async () => {
  const feed = fixtureFeed();
  const calls: ApplyPriceFloorArgs[] = [];
  const report = await runPriceFloorApplier({
    registry: dbSource([{ feed }]).source,
    client: {
      applyPriceFloor: (args: ApplyPriceFloorArgs) => {
        calls.push(args);
        return Promise.resolve("already_at_or_above" as const);
      },
    },
    logError: () => {},
  });

  eq(report.ok, true, "DB-path run ok");
  eq(report.feed_generated_at, GENERATED_AT, "DB-path feed stamp");
  eq(report.already_at_or_above, 8, "all 8 mapped records at/above");
  eq(report.errors.length, 0, "no errors");
  eq(calls.length, 8, "all 8 mapped records applied");

  const floorOf = (key: string) =>
    calls.find((c) => c.p_product_key === key)?.p_floor_egp;
  eq(floorOf("duolingo-super-12m"), 123, "duolingo floor 1.49 → 123");
  eq(floorOf("grok-plus-1m"), 384, "grok floor 4.65 → 384");
  eq(floorOf("outlook-hotmail-accounts"), 4, "outlook floor 0.04 → 4");
  eq(floorOf("spotify-premium"), 83, "spotify floor 1.00 → 83");
});
