/**
 * منفّذ حدّ الأسعار الأدنى للمتجر (Price-Floor Applier).
 *
 * المشكلة اللي بيقفلها: سجل المصدر (Provenance) بيعيد تسعير المنتج
 * لأرضيته جوه `complete_failover` (ceil(cost × 82.5))، لكن سعر كتالوج
 * المتجر نفسه (`catalog.price` في قاعدة المتجر) عمره ما بيتبع — بيتحرك
 * بتعديلات يدوية بس. أي تحويل مورد أو غلاء تكلفة يرفع الأرضية فوق سعر
 * المتجر الحالي كان هيبيع بخسارة في صمت (حادثة Grok: متجر 349 مقابل
 * أرضية 384). قاعدة المالك المطلقة: ممنوع البيع بخسارة أبدًا، والسعر
 * المعروض لازم دايمًا شايل الهامش.
 *
 * التصميم (نفس أنماط الخلفية الحالية بالحرف):
 *   - نقطة إدارية واحدة `POST /catalog/apply-price-floors` محمية
 *     بـ isAdmin (هيدر x-migo-admin) — بيندهها مجدول خارجي زي ما
 *     /exec/sweep ومسارات المحفظة بتتنادى من بره. مفيش مجدول داخلي
 *     في Deno أصلًا في المشروع ده.
 *   - مصدر الحقيقة الوحيد: تغذية المصدر `migo-provenance` — نفس
 *     اللقطة اللي المنفّذ بيستهلكها (JsonRegistrySource بيفرض الاسم
 *     والنسخة وقدم ≤ 24 ساعة، Fail-Closed). كل سجل فيها شايل
 *     product_key + store_sku + cost_usd للمورد النشط — دي خريطة
 *     الربط الصريحة القابلة للفحص. منتج مش في التغذية = مش مربوط
 *     بالآلية دي وممنوع لمسه.
 *   - الأرضية = ceil(cost_usd × 82.5) (هامش ×1.5 عند 55 ج/دولار) —
 *     نفس معادلة إعادة التسعير في السجل، وبتتحسب هنا بصحيحات عشرية
 *     آمنة، والقاعدة بتعيد التحقق منها رقميًا جوه RPC (هجرة 017)
 *     وبترفض أي أرضية مش مطابقة للمعادلة (invalid_floor).
 *   - الكتابة الوحيدة: RPC ‏`apply_price_floor` (هجرة 017) — ذرّية:
 *     `UPDATE ... WHERE price < floor` + صف تدقيق في نفس المعاملة.
 *     رفع بس: مستحيل تخفيض أي سعر من هنا، لا من الكود ولا من القاعدة.
 *   - Fail-Closed في كل خطوة: تغذية غايبة/قديمة/فاسدة = إجهاض كامل
 *     للجولة. سجل من غير SKU أو من غير تكلفة صالحة، أو SKU مكرر في
 *     التغذية، أو منتج مقفول سعريًا (تحويل جارٍ)، أو استثناء هامش
 *     موثّق بقرار مالك (margin_exception) = تخطّي + تسجيل، من غير
 *     أي تخمين.
 *   - الأسرار من البيئة بس (SUPABASE_SERVICE_ROLE_KEY) — غيابها =
 *     كل نداء RPC بيفشل وبيتعدّ خطأ، ومفيش كتابة بتحصل.
 */

import type {
  ProvenanceRecord,
  RegistrySnapshot,
} from "../store_executor/types.ts";

// ------------------------------------------------------------ المعادلة

/**
 * الأرضية بالجنيه = ceil(cost_usd × 82.5).
 *
 * بتتحسب بصحيحات (micro-USD بدقة 4 خانات عشرية — تكاليف السجل
 * أصلًا ≤ 4 خانات) عشان نتفادى انحراف الفاصلة العائمة: 1.20 × 82.5
 * بـ float بتدي 99.00000000000001 وسقفها 100 غلط، بينما الأرضية
 * الحقيقية 99. الأمثلة المتحقق منها ضد قيم السجل الفعلية:
 * 1.49→123 · 4.65→384 · 1.20→99 · 10.467→864 · 0.04→4 · 2.80→231.
 * تكلفة غايبة/صفر/سالبة = null (مفيش أرضية — تخطّي Fail-Closed).
 */
export function computeFloorEgp(costUsd: number): number | null {
  if (typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd <= 0) {
    return null;
  }
  const micro = Math.round(costUsd * 10_000);
  if (micro <= 0) return null;
  // floor = ceil(micro / 10^4 × 82.5) = ceil(micro × 825 / 100_000)
  const num = micro * 825;
  const den = 100_000;
  return Math.floor((num + den - 1) / den);
}

// ------------------------------------------------------------ العقود

/** نتائج RPC ‏apply_price_floor (هجرة 017) — أي قيمة تانية = خطأ. */
export type ApplyOutcome =
  | "raised"
  | "already_at_or_above"
  | "sku_not_found"
  | "sku_ambiguous"
  | "invalid_floor";

const APPLY_OUTCOMES: readonly string[] = [
  "raised",
  "already_at_or_above",
  "sku_not_found",
  "sku_ambiguous",
  "invalid_floor",
];

export interface ApplyPriceFloorArgs {
  p_sku: string;
  p_floor_egp: number;
  p_product_key: string;
  p_supplier_key: string;
  p_cost_usd: number;
  p_feed_generated_at: string;
}

export interface PriceFloorClient {
  applyPriceFloor(args: ApplyPriceFloorArgs): Promise<ApplyOutcome>;
}

/** مصدر لقطة السجل — JsonRegistrySource من الحزمة 6 بيحقّق العقد ده. */
export interface RegistrySnapshotSource {
  snapshot(): Promise<RegistrySnapshot | null>;
}

export interface PriceFloorDeps {
  registry: RegistrySnapshotSource;
  client: PriceFloorClient;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
}

export interface SkippedRecord {
  product_key: string;
  store_sku: string;
  reason: string;
}

export interface RaisedRecord {
  product_key: string;
  store_sku: string;
  floor_egp: number;
}

export interface PriceFloorRunReport {
  ok: boolean;
  /** سبب الإجهاض الكامل (التغذية) — موجود بس لما ok=false. */
  aborted: string | null;
  feed_generated_at: string | null;
  raised: RaisedRecord[];
  already_at_or_above: number;
  skipped: SkippedRecord[];
  errors: Array<{ product_key: string; store_sku: string; error: string }>;
}

// ------------------------------------------------------------ عميل RPC

interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

/** عميل PostgREST بنفس نمط PostgrestSmsClient في الحزمة 11. */
export class PostgrestPriceFloorClient implements PriceFloorClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }

  async applyPriceFloor(args: ApplyPriceFloorArgs): Promise<ApplyOutcome> {
    const key = this.opts.keyOf();
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/rpc/apply_price_floor`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`rpc apply_price_floor http ${res.status}: ${text.slice(0, 200)}`);
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = text;
    }
    if (typeof value === "string" && APPLY_OUTCOMES.includes(value)) {
      return value as ApplyOutcome;
    }
    throw new Error(`unexpected apply_price_floor outcome: ${String(value).slice(0, 100)}`);
  }
}

// ------------------------------------------------------------ الجولة

/**
 * جولة تطبيق واحدة: بتقرأ لقطة السجل، ولكل سجل مربوط بتحسب الأرضية
 * وبتنادي RPC. مفيش أي قراءة أو كتابة مباشرة لجدول الكتالوج من هنا —
 * قرار الرفع نفسه ذرّي جوه القاعدة. الجولة Idempotent: إعادة تشغيلها
 * على نفس الحالة بترجع already_at_or_above لكل حاجة ومش بتكتب تدقيق
 * تاني.
 */
export async function runPriceFloorApplier(
  deps: PriceFloorDeps,
): Promise<PriceFloorRunReport> {
  const report: PriceFloorRunReport = {
    ok: false,
    aborted: null,
    feed_generated_at: null,
    raised: [],
    already_at_or_above: 0,
    skipped: [],
    errors: [],
  };

  let snap: RegistrySnapshot | null = null;
  try {
    snap = await deps.registry.snapshot();
  } catch {
    snap = null;
  }
  if (!snap) {
    // التغذية غايبة/قديمة/فاسدة — إجهاض كامل، صفر كتابات (Fail-Closed).
    report.aborted = "feed_unavailable_or_stale";
    deps.logError(
      "price_floors.apply",
      "provenance feed unavailable or stale — run aborted, nothing written",
    );
    return report;
  }
  report.ok = true;
  report.feed_generated_at = snap.generated_at;

  // تجميع حسب SKU المتجر: التكرار = غموض = تخطّي الكل لنفس الـ SKU.
  const bySku = new Map<string, ProvenanceRecord[]>();
  for (const rec of snap.records || []) {
    const sku = String(rec?.store_sku || "").trim();
    const key = String(rec?.product_key || "");
    if (!sku) {
      report.skipped.push({ product_key: key, store_sku: "", reason: "missing_store_sku" });
      continue;
    }
    if (rec.margin_exception === true) {
      // استثناء هامش موثّق بقرار مالك (نمط Google Student) — برّه القاعدة.
      report.skipped.push({ product_key: key, store_sku: sku, reason: "margin_exception" });
      continue;
    }
    if (rec.price_locked === true) {
      // تحويل مورد جارٍ — complete_failover نفسه بيعيد التسعير ذرّيًا.
      report.skipped.push({ product_key: key, store_sku: sku, reason: "price_locked" });
      continue;
    }
    const arr = bySku.get(sku) || [];
    arr.push(rec);
    bySku.set(sku, arr);
  }

  for (const [sku, recs] of bySku) {
    if (recs.length > 1) {
      for (const r of recs) {
        report.skipped.push({
          product_key: String(r.product_key || ""),
          store_sku: sku,
          reason: "duplicate_store_sku",
        });
      }
      deps.logError(
        "price_floors.apply",
        "duplicate store_sku in provenance feed — SKU skipped",
        undefined,
        { store_sku: sku, product_keys: recs.map((r) => r.product_key) },
      );
      continue;
    }
    const rec = recs[0];
    const floor = computeFloorEgp(rec.cost_usd);
    if (floor === null) {
      report.skipped.push({
        product_key: String(rec.product_key || ""),
        store_sku: sku,
        reason: "missing_or_invalid_cost",
      });
      continue;
    }
    try {
      const outcome = await deps.client.applyPriceFloor({
        p_sku: sku,
        p_floor_egp: floor,
        p_product_key: String(rec.product_key || ""),
        p_supplier_key: String(rec.supplier_key || ""),
        p_cost_usd: rec.cost_usd,
        p_feed_generated_at: snap.generated_at,
      });
      if (outcome === "raised") {
        report.raised.push({
          product_key: String(rec.product_key || ""),
          store_sku: sku,
          floor_egp: floor,
        });
      } else if (outcome === "already_at_or_above") {
        report.already_at_or_above++;
      } else {
        // sku_not_found / sku_ambiguous / invalid_floor — شذوذ بيتلاحظ.
        report.skipped.push({
          product_key: String(rec.product_key || ""),
          store_sku: sku,
          reason: outcome,
        });
        deps.logError(
          "price_floors.apply",
          `apply_price_floor returned ${outcome}`,
          undefined,
          { store_sku: sku, product_key: rec.product_key, floor_egp: floor },
        );
      }
    } catch (e) {
      report.errors.push({
        product_key: String(rec.product_key || ""),
        store_sku: sku,
        error: String((e as Error)?.message || e).slice(0, 200),
      });
      deps.logError("price_floors.apply", "apply_price_floor rpc failed", e, {
        store_sku: sku,
        product_key: rec.product_key,
      });
    }
  }
  return report;
}

// ------------------------------------------------------------ المعالج

/** معالج مسار المنفّذ — بيتركب في api.ts جنب فروع /exec/ و/wallet/. */
export async function handlePriceFloorRequest(
  req: Request,
  deps: PriceFloorDeps,
  isAuthorized: (req: Request) => boolean,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/catalog/apply-price-floors")) return null;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!isAuthorized(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const report = await runPriceFloorApplier(deps);
    return json(
      {
        ok: report.ok,
        aborted: report.aborted,
        feed_generated_at: report.feed_generated_at,
        raised: report.raised,
        already_at_or_above: report.already_at_or_above,
        skipped: report.skipped,
        errors: report.errors,
      },
      report.ok ? 200 : 503,
    );
  } catch (e) {
    deps.logError("price_floors.route", "unhandled price-floor applier error", e);
    return json({ ok: false, error: "exception" }, 500);
  }
}
