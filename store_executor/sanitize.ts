/**
 * طبقة العلامة البيضاء (القسم 2.5) — شرط صلب على أي سطح.
 *
 * وظيفتين:
 * 1. استخراج بيانات التسليم من رد المورد بمفاتيح معروفة بس (مرآة
 *    `delivery_from_raw` عند البوت) — مفيش أي تأليف ولا نسخ أعمى للرد.
 * 2. تنقية أي نص ممكن يعدّي للعميل أو للوج من: أسماء/هويات الموردين،
 *    بصماتهم (Job IDs وأكواد داخلية وعناوين واجهاتهم)، التكاليف،
 *    الأرصدة، وأي قيمة سرية معروفة.
 */

import type { DeliveryItem } from "./types.ts";

/** مفاتيح التسليم المعروفة ووسومها بصياغتنا — نفس قائمة البوت بالترتيب. */
export const DELIVERY_KEYS: Array<[string, string]> = [
  ["activation_link", "رابط التفعيل"],
  ["activation_url", "رابط التفعيل"],
  ["delivery_code", "كود التسليم"],
  ["activation_code", "كود التفعيل"],
  ["license_key", "مفتاح الترخيص"],
  ["gift_code", "كود الهدية"],
  ["code", "الكود"],
  ["key", "المفتاح"],
  ["url", "الرابط"],
  ["link", "الرابط"],
  ["account", "الحساب"],
  ["password", "كلمة المرور"],
];

const LIST_KEYS = ["links", "codes", "delivery_links", "activation_links", "items"];

/** استخراج عناصر التسليم من رد المورد (قوائم/قيم مفردة/متداخلة) — من غير تأليف. */
export function extractDeliveryItems(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) take(item);
      return;
    }
    const text = String(value ?? "").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  };
  const obj = payload as Record<string, unknown>;
  for (const key of LIST_KEYS) take(obj[key]);
  for (const [key] of DELIVERY_KEYS) take(obj[key]);
  for (const nest of ["order", "data"]) {
    const inner = obj[nest];
    if (inner && typeof inner === "object") {
      for (const item of extractDeliveryItems(inner)) take(item);
    }
  }
  return out;
}

/** تحويل خام المورد لعناصر تسليم موسومة بصياغتنا (مرآة delivery_from_raw). */
export function deliveryFromRaw(raw: unknown): DeliveryItem[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  const lowered = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) lowered.set(k.toLowerCase(), v);
  const out: DeliveryItem[] = [];
  const seen = new Set<string>();
  for (const [key, label] of DELIVERY_KEYS) {
    const value = lowered.get(key);
    const text = value != null ? String(value).trim() : "";
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ label, value: text });
  }
  if (out.length === 0) {
    // الرد ممكن يحمل التسليم في قايمة links/codes بس (نمط Drayik).
    const items = extractDeliveryItems(raw);
    for (const item of items) {
      out.push({
        label: item.toLowerCase().startsWith("http") ? "رابط التفعيل" : "كود التفعيل",
        value: item,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------ التنقية
/** أسماء/هويات الموردين اللي ممنوع تظهر للعميل بأي شكل (تعميم قاعدة SheerID). */
export const SUPPLIER_FINGERPRINTS: string[] = [
  "drayik",
  "tunvn",
  "wasmou",
  "bunny",
  "bunnytoolsbot",
  "bunny-ai",
  "sheerid",
  "prehub",
  "scorpion",
  "panda store",
  "panda",
];

/** أنماط بصمات: معرّفات وظائف/طلبات داخلية عند الموردين وأسعار تكلفة. */
const FINGERPRINT_PATTERNS: RegExp[] = [
  /\bBNY-[A-Za-z0-9_-]+\b/g, // بصمة وظائف Bunny/SheerID الموثّقة
  /\bjob[_-]?id\s*[:=]?\s*\S+/gi,
  /\bcustom_id\s*[:=]?\s*\S+/gi,
  /https?:\/\/[^\s"']*(?:drayik|tunvn|wasmou|bunnytoolsbot)[^\s"']*/gi,
];

export interface SanitizeOptions {
  /** قيم سرية معروفة لازم تتشال حرفيًا (مفاتيح API ونحوها). */
  secrets?: string[];
  /** بصمات إضافية خاصة بمورد معين. */
  extraFingerprints?: string[];
}

/** تنقية نص واحد: أسرار → بصمات موردين → أنماط بصمات. */
export function sanitizeText(text: string, opts: SanitizeOptions = {}): string {
  let out = String(text ?? "");
  for (const secret of opts.secrets ?? []) {
    if (secret && secret.length >= 4) out = out.split(secret).join("***");
  }
  for (const pattern of FINGERPRINT_PATTERNS) out = out.replace(pattern, "***");
  const prints = [...SUPPLIER_FINGERPRINTS, ...(opts.extraFingerprints ?? [])];
  for (const print of prints) {
    if (!print) continue;
    const escaped = print.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "***");
  }
  return out;
}

/** تنقية لقطة رد كاملة (JSON) قبل التخزين — الأسرار ما بتتخزنش أصلًا. */
export function sanitizeRaw(raw: unknown, opts: SanitizeOptions = {}): unknown {
  let text: string;
  try {
    text = JSON.stringify(raw ?? null);
  } catch {
    text = String(raw);
  }
  text = sanitizeText(text, opts).slice(0, 20000);
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

/**
 * اختبار تسريب (Leak Test): بيرجع قايمة التسريبات لو أي عنصر تسليم أو
 * نص عميل فيه بصمة مورد. القايمة الفاضية = نضيف.
 */
export function findLeaks(
  items: DeliveryItem[],
  opts: SanitizeOptions = {},
): string[] {
  const leaks: string[] = [];
  const prints = [...SUPPLIER_FINGERPRINTS, ...(opts.extraFingerprints ?? [])];
  for (const item of items) {
    const hay = `${item.label} ${item.value}`.toLowerCase();
    for (const print of prints) {
      if (print && hay.includes(print.toLowerCase())) leaks.push(print);
    }
    for (const pattern of FINGERPRINT_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(item.value)) leaks.push(pattern.source);
    }
  }
  return leaks;
}

/**
 * بوابة التسليم للعميل: العناصر بتعدي بس لو نضيفة. عنصر ملوّث بيتحذف
 * وبيتسجّل — العميل بياخد الباقي النضيف، ولو الكل اتحذف فالتسليم
 * بيقف manual_review بدل ما يسرّب (بتتفرض في المنفّذ).
 */
export function customerSafeDelivery(
  items: DeliveryItem[],
  opts: SanitizeOptions = {},
): { safe: DeliveryItem[]; dropped: number } {
  const safe: DeliveryItem[] = [];
  let dropped = 0;
  for (const item of items) {
    const probe: DeliveryItem[] = [item];
    if (findLeaks(probe, opts).length === 0) safe.push(item);
    else dropped++;
  }
  return { safe, dropped };
}
