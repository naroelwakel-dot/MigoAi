/**
 * اختبارات منفّذ حدّ الأسعار الأدنى — `deno test price_floors.test.ts`
 * من غير أي استيراد خارجي (بتشتغل offline بالكامل).
 *
 * العميل الوهمي هنا بيحاكي دلالات RPC ‏apply_price_floor (هجرة 017)
 * بالحرف على كتالوج وهمي في الذاكرة + سجل تدقيق وهمي، فالحالات دي
 * هي نفس حالات تمرين الستاجينج على القاعدة الحقيقية:
 *   (a) SKU تحت الأرضية → بيترفع للأرضية بالظبط + صف تدقيق واحد.
 *   (b) SKU فوق الأرضية → ما بيتلعبش فيه ولا بيكتب تدقيق.
 *   (c) SKU في الكتالوج من غير سجل تغذية (غير مربوط) → ممنوع لمسه.
 *   (d) إعادة التشغيل → Idempotent: صفر رفع جديد، التدقيق ما بيكبرش.
 * وكل حالات الفشل المغلق: تغذية قديمة/غايبة، تكلفة مفقودة، SKU مكرر،
 * استثناء هامش، قفل سعري، وSKU في التغذية مش موجود في الكتالوج.
 */
import {
  type ApplyOutcome,
  type ApplyPriceFloorArgs,
  computeFloorEgp,
  DEFAULT_PRICE_FLOOR_FEED_URL,
  handlePriceFloorRequest,
  type PriceFloorClient,
  type PriceFloorDeps,
  resolvePriceFloorFeedUrl,
  runPriceFloorApplier,
} from "./mod.ts";
import type {
  ProvenanceRecord,
  RegistrySnapshot,
} from "../store_executor/types.ts";

// مساعدات تأكيد صغيرة (بديل std/assert عشان الاختبار يشتغل offline).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ------------------------------------------------------------ وهميات

interface AuditRow extends ApplyPriceFloorArgs {
  old_price: number;
  new_price: number;
}

/** بيحاكي هجرة 017 دلاليًا: نفس النتائج ونفس شرط الأرضية ونفس التدقيق. */
class FakePriceFloorClient implements PriceFloorClient {
  catalog = new Map<string, number>();
  audit: AuditRow[] = [];
  calls: ApplyPriceFloorArgs[] = [];

  applyPriceFloor(args: ApplyPriceFloorArgs): Promise<ApplyOutcome> {
    this.calls.push(args);
    const expected = computeFloorEgp(args.p_cost_usd);
    if (
      expected === null || expected !== args.p_floor_egp ||
      !args.p_sku || !args.p_product_key
    ) {
      return Promise.resolve("invalid_floor");
    }
    const rows = [...this.catalog.keys()].filter((k) => k === args.p_sku);
    if (rows.length === 0) return Promise.resolve("sku_not_found");
    if (rows.length > 1) return Promise.resolve("sku_ambiguous");
    const current = this.catalog.get(args.p_sku)!;
    if (current >= args.p_floor_egp) {
      return Promise.resolve("already_at_or_above");
    }
    this.catalog.set(args.p_sku, args.p_floor_egp);
    this.audit.push({ ...args, old_price: current, new_price: args.p_floor_egp });
    return Promise.resolve("raised");
  }
}

function rec(partial: Partial<ProvenanceRecord>): ProvenanceRecord {
  return {
    product_key: "p",
    store_sku: "SKU",
    supplier_key: "bunny",
    listing_ref: "1",
    cost_usd: 1,
    store_price_egp: 83,
    ...partial,
  };
}

function depsWith(
  records: ProvenanceRecord[] | null,
  client: FakePriceFloorClient,
  logs: Array<{ source: string; message: string }> = [],
): PriceFloorDeps {
  return {
    registry: {
      snapshot: () =>
        Promise.resolve(
          records === null
            ? null
            : ({
              feed: "migo-provenance",
              version: 1,
              generated_at: "2026-11-18T08:11:56Z",
              records,
            } as RegistrySnapshot),
        ),
    },
    client,
    logError: (source, message) => {
      logs.push({ source, message });
    },
  };
}

// ------------------------------------------------------------ المعادلة

Deno.test("floor formula matches the registry's own rebased values", () => {
  // قيم حقيقية من سجل المصدر بعد إعادة التسعير الفعلية (2026-11-18).
  eq(computeFloorEgp(1.49), 123, "duolingo bunny cost");
  eq(computeFloorEgp(4.65), 384, "grok drayik cost");
  eq(computeFloorEgp(1.20), 99, "claude api tunvn cost — float trap case");
  eq(computeFloorEgp(10.467), 864, "adobe wasmou cost");
  eq(computeFloorEgp(0.04), 4, "outlook bunny cost");
  eq(computeFloorEgp(2.80), 231, "notion bunny cost");
  eq(computeFloorEgp(1.00), 83, "spotify bunny cost");
  eq(computeFloorEgp(0.75), 62, "gmail drayik cost");
  eq(computeFloorEgp(21.70), 1791, "claude pro drayik cost");
  eq(computeFloorEgp(0.50), 42, "linkedin drayik cost");
  eq(computeFloorEgp(2.75), 227, "figma drayik cost");
  eq(computeFloorEgp(1.10), 91, "prime drayik cost");
  eq(computeFloorEgp(1.39), 115, "capcut tunvn cost");
  eq(computeFloorEgp(7.95), 656, "chatgpt plus drayik cost");
  eq(computeFloorEgp(0.65), 54, "gemini 12m bunny cost");
  eq(computeFloorEgp(0), null, "zero cost has no floor");
  eq(computeFloorEgp(-3), null, "negative cost has no floor");
  eq(computeFloorEgp(Number.NaN), null, "NaN cost has no floor");
});

// ------------------------------------------------------------ التمرين

Deno.test("(a) below-floor SKU is raised to the exact floor, one audit row", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("Super Grok (xAI) (Grok Plus — شهر واحد)", 349);
  const deps = depsWith(
    [rec({
      product_key: "grok-plus-1m",
      store_sku: "Super Grok (xAI) (Grok Plus — شهر واحد)",
      supplier_key: "drayik",
      cost_usd: 4.65,
    })],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.ok, true, "run ok");
  eq(report.raised.length, 1, "one raise");
  eq(report.raised[0].floor_egp, 384, "raised to floor 384");
  eq(
    client.catalog.get("Super Grok (xAI) (Grok Plus — شهر واحد)"),
    384,
    "catalog now at floor",
  );
  eq(client.audit.length, 1, "exactly one audit row");
  eq(client.audit[0].old_price, 349, "audit old price");
  eq(client.audit[0].new_price, 384, "audit new price");
});

Deno.test("(b) above-floor SKU is untouched and writes no audit", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("ChatGPT Plus (شهر) (GPT-4o الأصلي)", 753);
  const deps = depsWith(
    [rec({
      product_key: "chatgpt-plus-1m",
      store_sku: "ChatGPT Plus (شهر) (GPT-4o الأصلي)",
      supplier_key: "drayik",
      cost_usd: 7.95, // floor 656 < 753
    })],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.raised.length, 0, "no raise");
  eq(report.already_at_or_above, 1, "counted as above floor");
  eq(client.catalog.get("ChatGPT Plus (شهر) (GPT-4o الأصلي)"), 753, "price unchanged — never lowered");
  eq(client.audit.length, 0, "no audit row");
});

Deno.test("(c) catalog SKU with no feed record (unmapped) is never touched", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("منتج يدوي بلا مورد", 10); // cheap, but unmapped
  client.catalog.set("Duolingo Super (12 شهر)", 100); // below floor 123
  const deps = depsWith(
    [rec({
      product_key: "duolingo-super-12m",
      store_sku: "Duolingo Super (12 شهر)",
      cost_usd: 1.49,
    })],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.raised.length, 1, "only the mapped SKU raised");
  eq(client.catalog.get("منتج يدوي بلا مورد"), 10, "unmapped SKU untouched");
  ok(
    client.calls.every((c) => c.p_sku !== "منتج يدوي بلا مورد"),
    "applier never even calls the RPC for an unmapped SKU",
  );
});

Deno.test("(d) re-run is idempotent — no second change, audit stays at one", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("Duolingo Super (12 شهر)", 100);
  const deps = depsWith(
    [rec({
      product_key: "duolingo-super-12m",
      store_sku: "Duolingo Super (12 شهر)",
      cost_usd: 1.49,
    })],
    client,
  );
  const first = await runPriceFloorApplier(deps);
  eq(first.raised.length, 1, "first run raises");
  eq(client.catalog.get("Duolingo Super (12 شهر)"), 123, "at floor after first run");
  const second = await runPriceFloorApplier(deps);
  eq(second.raised.length, 0, "second run raises nothing");
  eq(second.already_at_or_above, 1, "second run sees it at floor");
  eq(client.audit.length, 1, "audit still exactly one row");
  eq(client.catalog.get("Duolingo Super (12 شهر)"), 123, "price stable");
});

// ------------------------------------------------------------ فشل مغلق

Deno.test("stale/unavailable feed aborts the whole run — zero calls", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("Duolingo Super (12 شهر)", 100);
  const logs: Array<{ source: string; message: string }> = [];
  const report = await runPriceFloorApplier(depsWith(null, client, logs));
  eq(report.ok, false, "run not ok");
  eq(report.aborted, "feed_unavailable_or_stale", "abort reason");
  eq(client.calls.length, 0, "no RPC calls at all");
  eq(client.catalog.get("Duolingo Super (12 شهر)"), 100, "nothing written");
  eq(logs.length, 1, "abort is logged");
});

Deno.test("record with missing cost is skipped, never guessed", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("SKU-X", 10);
  const deps = depsWith(
    [rec({ product_key: "x", store_sku: "SKU-X", cost_usd: 0 })],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.raised.length, 0, "no raise");
  eq(report.skipped.length, 1, "one skip");
  eq(report.skipped[0].reason, "missing_or_invalid_cost", "skip reason");
  eq(client.calls.length, 0, "no RPC call");
});

Deno.test("duplicate store_sku in the feed skips both records", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("SKU-DUP", 10);
  const deps = depsWith(
    [
      rec({ product_key: "a", store_sku: "SKU-DUP", cost_usd: 4.65 }),
      rec({ product_key: "b", store_sku: "SKU-DUP", cost_usd: 4.65 }),
    ],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.raised.length, 0, "no raise on ambiguity");
  eq(report.skipped.length, 2, "both skipped");
  ok(
    report.skipped.every((s) => s.reason === "duplicate_store_sku"),
    "duplicate reason",
  );
  eq(client.calls.length, 0, "no RPC call for ambiguous SKU");
});

Deno.test("margin_exception and price_locked records are skipped by design", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("SKU-E", 10);
  client.catalog.set("SKU-L", 10);
  const deps = depsWith(
    [
      rec({ product_key: "e", store_sku: "SKU-E", cost_usd: 4.65, margin_exception: true }),
      rec({ product_key: "l", store_sku: "SKU-L", cost_usd: 4.65, price_locked: true }),
    ],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.raised.length, 0, "no raises");
  eq(
    report.skipped.map((s) => s.reason).sort(),
    ["margin_exception", "price_locked"],
    "both skip reasons present",
  );
  eq(client.calls.length, 0, "no RPC calls");
});

Deno.test("feed SKU missing from the catalog is reported, not fatal", async () => {
  const client = new FakePriceFloorClient();
  const deps = depsWith(
    [rec({ product_key: "ghost", store_sku: "SKU-GHOST", cost_usd: 4.65 })],
    client,
  );
  const report = await runPriceFloorApplier(deps);
  eq(report.ok, true, "run still ok");
  eq(report.raised.length, 0, "no raise");
  eq(report.skipped.length, 1, "one skip");
  eq(report.skipped[0].reason, "sku_not_found", "skip reason from RPC outcome");
  eq(client.audit.length, 0, "no audit");
});

// ------------------------------------------------------------ تقوية اللجنة (الحزمة التانية): ثقة التكلفة

Deno.test("feed URL resolution: dedicated env wins, shared env next, published default last", () => {
  const envOf = (m: Record<string, string>) => (n: string) => m[n] || "";
  eq(
    resolvePriceFloorFeedUrl(envOf({
      PRICE_FLOOR_FEED_URL: "https://a.example/feed.json",
      PROVENANCE_FEED_URL: "https://b.example/feed.json",
    })),
    "https://a.example/feed.json",
    "PRICE_FLOOR_FEED_URL has priority",
  );
  eq(
    resolvePriceFloorFeedUrl(envOf({
      PROVENANCE_FEED_URL: "https://b.example/feed.json",
    })),
    "https://b.example/feed.json",
    "falls back to PROVENANCE_FEED_URL",
  );
  eq(
    resolvePriceFloorFeedUrl(envOf({})),
    DEFAULT_PRICE_FLOOR_FEED_URL,
    "falls back to the published default",
  );
  ok(
    DEFAULT_PRICE_FLOOR_FEED_URL.startsWith("https://migoai.shop/prov-"),
    "default is the published prov-* provenance feed",
  );
});

function pfReq(body: unknown, admin = true): Request {
  return new Request("https://api.example/catalog/apply-price-floors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(admin ? { "x-migo-admin": "adm" } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}
const pfAuth = (r: Request) => r.headers.get("x-migo-admin") === "adm";

Deno.test("handler: forged caller cost in the request body is IGNORED — feed cost rules", async () => {
  const client = new FakePriceFloorClient();
  const SKU = "Super Grok (xAI) (Grok Plus — شهر واحد)";
  client.catalog.set(SKU, 349);
  const deps = depsWith(
    [rec({
      product_key: "grok-plus-1m",
      store_sku: SKU,
      supplier_key: "drayik",
      cost_usd: 4.65, // أرضية التغذية الحقيقية: 384
    })],
    client,
  );
  // جسم هجومي: تكلفة مزوّرة برخص التراب + أرضية مزوّرة 1 جنيه.
  const res = await handlePriceFloorRequest(
    pfReq({
      costs: { [SKU]: 0.01 },
      items: [{ sku: SKU, cost_usd: 0.01, floor_egp: 1 }],
    }),
    deps,
    pfAuth,
  );
  eq(res!.status, 200, "handler ok");
  const body = await res!.json();
  eq(body.ok, true, "run ok");
  eq(body.raised.length, 1, "one raise");
  eq(body.raised[0].floor_egp, 384, "raised to the FEED floor, not the forged 1");
  eq(client.calls.length, 1, "one RPC call");
  eq(client.calls[0].p_cost_usd, 4.65, "RPC got the feed cost, never the caller's");
  eq(client.calls[0].p_floor_egp, 384, "RPC got the feed-derived floor");
  eq(client.catalog.get(SKU), 384, "catalog at the feed floor");
});

Deno.test("handler: feed unavailable → 503, aborted, ZERO price changes", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("Duolingo Super (12 شهر)", 100);
  const res = await handlePriceFloorRequest(
    pfReq({}),
    depsWith(null, client),
    pfAuth,
  );
  eq(res!.status, 503, "fail-closed status");
  const body = await res!.json();
  eq(body.ok, false, "not ok");
  eq(body.aborted, "feed_unavailable_or_stale", "abort reason in response");
  eq(client.calls.length, 0, "zero RPC calls");
  eq(client.catalog.get("Duolingo Super (12 شهر)"), 100, "price untouched");
});

Deno.test("handler: unauthorized caller → 401 and zero RPC calls", async () => {
  const client = new FakePriceFloorClient();
  client.catalog.set("Duolingo Super (12 شهر)", 100);
  const deps = depsWith(
    [rec({
      product_key: "duolingo-super-12m",
      store_sku: "Duolingo Super (12 شهر)",
      cost_usd: 1.49,
    })],
    client,
  );
  const res = await handlePriceFloorRequest(pfReq({}, false), deps, pfAuth);
  eq(res!.status, 401, "unauthorized");
  eq(client.calls.length, 0, "no RPC call without auth");
  eq(client.catalog.get("Duolingo Super (12 شهر)"), 100, "price untouched");
});
