/**
 * أعلام الإطلاق التدريجي (القسم 8 + نطاق الحزمة 6).
 *
 * الافتراضي الآمن: كل حاجة مقفولة. التفعيل بيحصل بمتغيرات بيئة بس —
 * مفيش تفعيل من كود ولا من قاعدة بيانات، ومفتاح القتل العام بيغلب
 * أي علم منتج. تغيير علم = إعادة نشر/إعادة تشغيل واعية من المالك.
 */

import type { RolloutFlags } from "./types.ts";

export function flagsFromEnv(env: (name: string) => string | undefined): RolloutFlags {
  const globalEnabled = (env("STORE_AUTO_BUY_ENABLED") || "").trim() === "1";
  const list = (env("STORE_AUTO_BUY_PRODUCTS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { globalEnabled, enabledProducts: new Set(list) };
}

export function flagsOff(): RolloutFlags {
  return { globalEnabled: false, enabledProducts: new Set() };
}

export function isEnabled(flags: RolloutFlags, productKey: string): boolean {
  return flags.globalEnabled && flags.enabledProducts.has(productKey);
}
