/**
 * إعدادات أتمتة تحقق SheerID على الموقع — مرآة إعدادات البوت حرفيًا
 * (sheerid/config.py في مستودع البوت) مع تكييف أسماء الحقول لسطح الويب.
 *
 * المفتاح بيتقرا من البيئة وقت التشغيل بس، وعمره ما بيتحفظ في الكود ولا
 * بيظهر في أي لوج أو رد. من غير مفتاح، الميزة كلها مقفولة (fail-closed)
 * والمنتج بيبان للعميل بمسار يدوي معلن — زي البوت بالظبط.
 *
 * ⚠️ مفتاح الموقع منفصل عن مفتاح البوت: متغير البيئة هنا هو
 * SHEERID_API_KEY في بيئة Deno (بيضبطه المالك من موبايله) — ممنوع
 * إعادة استخدام أي مفتاح محفوظ في مكان تاني.
 */

// ------------------------------------------------------------------ البيئة
export const ENV_API_KEY = "SHEERID_API_KEY";
export const ENV_WEBHOOK_URL = "SHEERID_WEBHOOK_URL";
export const ENV_BASE_URL = "SHEERID_BASE_URL";

// عنوان خدمة التحقق (نفس عنوان واجهة المورد العامة اللي البوت بيستخدمها).
export const BASE_URL = "https://bunnytoolsbot.tech";

export const PATH_BALANCE = "/api/v1/sheerid/balance";
export const PATH_VERIFY = "/api/v1/sheerid/verify";
export const PATH_STATUS = "/api/v1/sheerid/status/%s";

// رابط التحقق اللي العميل بيبعته لازم يكون من نطاق SheerID الرسمي نفسه.
export const VERIFY_URL_HOST = "services.sheerid.com";
export const VERIFY_URL_PREFIX = "https://services.sheerid.com/verify/";

// ------------------------------------------------------------------ المنتج
// منتج Google Student على الموقع: سعر ثابت بقرار المالك (280 ج) واسم
// السلة/الكتالوج واحد في كل الأسطح (ai-tools.js + صف catalog).
export const STUDENT_SKU = "Google Student (سنة كاملة)";
export const STUDENT_PRODUCT_KEY = "google-student";
export const STUDENT_PRICE_EGP = 280;
// supplier_key على صف التنفيذ اللي بيتنشأ عند الفشل بس — بيمنع منفّذ
// الشراء العام من لمس تنفيذات التحقق (مفيش محوّل مسجّل بالمفتاح ده).
export const STUDENT_SUPPLIER_KEY = "sheerid";

// ------------------------------------------------------------------ التخزين
export const TABLE_JOBS = "sheerid_jobs";

// حالات عملية التحقق عندنا (نفس حالات البوت بالحرف):
export const STATUS_AWAITING_LINK = "awaiting_link";
export const STATUS_SUBMITTING = "submitting";
export const STATUS_PROCESSING = "processing";
export const STATUS_COMPLETED = "completed";
export const STATUS_REFUNDED = "refunded";
export const STATUS_FAILED = "failed";

export const STATUSES = [
  STATUS_AWAITING_LINK, STATUS_SUBMITTING, STATUS_PROCESSING,
  STATUS_COMPLETED, STATUS_REFUNDED, STATUS_FAILED,
] as const;
export type JobStatus = typeof STATUSES[number];
export const TERMINAL_STATUSES: readonly string[] = [
  STATUS_COMPLETED, STATUS_REFUNDED, STATUS_FAILED,
];

// ------------------------------------------------------------------ الاستطلاع
// نفس جدول البوت: فحص عند +20 ثانية وفحص تاني عند +40 ثانية جوه نفس
// الطلب، والمسح الدوري بيبدأ يراجع العملية من عمر 40 ثانية.
export const POLL_DELAYS_SECONDS = [20, 20] as const;
export const IN_FLIGHT_STATUSES: readonly string[] = [
  STATUS_SUBMITTING, STATUS_PROCESSING,
];
export const SWEEP_MAX_AGE_MINUTES = 20;
export const SWEEP_MIN_AGE_SECONDS = 40;

// ------------------------------------------------------------------ تسليم النتيجة
// نفس فواصل البوت: بعد المحاولة 1 ← 60 ثانية، بعد 2 ← 180 ثانية، ومن
// 3 وطالع ← كل 10 دقايق، لحد ما العملية تكمل 24 ساعة من إنشائها.
export const DELIVERY_GAP_FIRST_SECONDS = 60;
export const DELIVERY_GAP_SECOND_SECONDS = 180;
export const DELIVERY_GAP_STEADY_SECONDS = 600;
export const DELIVERY_MAX_AGE_HOURS = 24;

// مهلة طلب HTTP واحد للمورد.
export const REQUEST_TIMEOUT_MS = 15_000;

export function apiKey(env: (n: string) => string | undefined): string {
  return (env(ENV_API_KEY) || "").trim();
}

export function webhookUrl(env: (n: string) => string | undefined): string {
  return (env(ENV_WEBHOOK_URL) || "").trim();
}

export function baseUrl(env: (n: string) => string | undefined): string {
  return ((env(ENV_BASE_URL) || "").trim() || BASE_URL).replace(/\/+$/, "");
}
