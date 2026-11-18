/**
 * مصادر الحقيقة الخارجية للمنفّذ: سجل المصدر + تغذية التوفر.
 *
 * الاتنين Fail-Closed بنفس قواعد باتش الحزمة 3 (api-order-guard.ts):
 * ملف واقعة/قديمة (> 5 دقائق)/نسخة مش معروفة/شكل مش صالح = مفيش
 * تنفيذ. المنفّذ ما بيحسبش توفر ولا مصادر بنفسه أبدًا — بيستهلك
 * العقدين اللي بتولّدهم خلفية البوت من سجل المصدر الواحد.
 */

import type {
  AvailabilitySource,
  ProvenanceRecord,
  RegistrySnapshot,
  RegistrySource,
} from "./types.ts";

export const MAX_FEED_AGE_MS = 5 * 60_000;
const CACHE_MS = 30_000;

type Loader = () => Promise<unknown>;

function isFresh(generatedAt: string, now: Date): boolean {
  const t = Date.parse(generatedAt || "");
  if (!t) return false;
  return now.getTime() - t <= MAX_FEED_AGE_MS;
}

/**
 * مصدر سجل مصدر من محمّل JSON (ملف ثابت على الموقع/قراءة مباشرة).
 * نافذة القدم هنا 24 ساعة عن قصد: السجل تهيئة بتتغيّر بقرارات مالك
 * بس، وحداثة قرارات الفلوس بيفرضها فحص التوفر (5 دقائق) + اللقطة
 * الحية من المورد لحظة التنفيذ — مش تاريخ توليد ملف التهيئة.
 */
export class JsonRegistrySource implements RegistrySource {
  private load: Loader;
  private nowFn: () => Date;
  private maxAgeMs: number;
  private cache: { at: number; snap: RegistrySnapshot } | null = null;
  constructor(
    load: Loader,
    nowFn: () => Date = () => new Date(),
    maxAgeMs: number = 24 * 3600_000,
  ) {
    this.load = load;
    this.nowFn = nowFn;
    this.maxAgeMs = maxAgeMs;
  }
  async snapshot(): Promise<RegistrySnapshot | null> {
    const now = this.nowFn();
    if (this.cache && now.getTime() - this.cache.at < CACHE_MS) {
      return this.cache.snap;
    }
    let raw: unknown;
    try {
      raw = await this.load();
    } catch {
      return null;
    }
    const snap = raw as RegistrySnapshot;
    const generated = Date.parse(snap?.generated_at || "");
    if (
      !snap || snap.feed !== "migo-provenance" || snap.version !== 1 ||
      !Array.isArray(snap.records) || !generated ||
      now.getTime() - generated > this.maxAgeMs
    ) {
      return null;
    }
    this.cache = { at: now.getTime(), snap };
    return snap;
  }
  async resolve(productKey: string): Promise<ProvenanceRecord | null> {
    const snap = await this.snapshot();
    if (!snap) return null;
    return snap.records.find((r) => r.product_key === productKey) ?? null;
  }
  async resolveBySku(storeSku: string): Promise<ProvenanceRecord | null> {
    const snap = await this.snapshot();
    if (!snap) return null;
    return snap.records.find((r) => r.store_sku === storeSku) ?? null;
  }
}

interface AvailabilityFeed {
  feed: string;
  version: number;
  generated_at: string;
  items: Array<{ sku: string; orderable: boolean; reason: string }>;
}

/** مصدر توفر من تغذية migo-availability v1 — نفس قواعد حارس الحزمة 3. */
export class FeedAvailabilitySource implements AvailabilitySource {
  private load: Loader;
  private nowFn: () => Date;
  private cache: { at: number; bySku: Map<string, boolean> } | null = null;
  constructor(load: Loader, nowFn: () => Date = () => new Date()) {
    this.load = load;
    this.nowFn = nowFn;
  }
  private async map(): Promise<Map<string, boolean> | null> {
    const now = this.nowFn();
    if (this.cache && now.getTime() - this.cache.at < CACHE_MS) {
      return this.cache.bySku;
    }
    let raw: unknown;
    try {
      raw = await this.load();
    } catch {
      return null;
    }
    const feed = raw as AvailabilityFeed;
    if (
      !feed || feed.feed !== "migo-availability" || feed.version !== 1 ||
      !Array.isArray(feed.items) || !isFresh(feed.generated_at, now)
    ) {
      return null;
    }
    const bySku = new Map<string, boolean>();
    for (const item of feed.items) bySku.set(item.sku, item.orderable === true);
    this.cache = { at: now.getTime(), bySku };
    return bySku;
  }
  async isOrderable(productKey: string): Promise<boolean> {
    const bySku = await this.map();
    if (!bySku) return false;
    return bySku.get(productKey) === true;
  }
}

/** محمّل ملف/رابط JSON بسيط للإنتاج (بيتولّد من خلفية البوت وبيتنشر ثابتًا). */
export function urlLoader(url: string): Loader {
  return async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`feed http ${res.status}`);
    return await res.json();
  };
}
