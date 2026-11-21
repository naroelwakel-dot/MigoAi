/**
 * مصادقة إدارية بترويسة x-migo-admin مع توكنات خاصة اختيارية لكل
 * مجموعة مسارات (تقوية اللجنة — الحزمة التانية):
 *
 *   ADMIN_TOKEN           — التوكن المشترك (سلوك اليوم، بيفتح الكل).
 *   ADMIN_TOKEN_SHEERID   — خاص بمسارات SheerID الإدارية (المسح).
 *   ADMIN_TOKEN_WALLET    — خاص بمسارات إدارة المحفظة.
 *   ADMIN_TOKEN_CATALOG   — خاص بمسارات الكتالوج (منفّذ حدّ الأسعار).
 *
 * دلالات القبول لكل مجموعة مسارات:
 *   - التوكن الخاص بالمجموعة (لو مضبوط في البيئة) بيفتح مجموعته بس —
 *     فيقدر يتسلّم لمستدعٍ واحد (وحدة مجدولة مثلًا) من غير ما يبقى
 *     معاه المفتاح الرئيسي لباقي المسارات.
 *   - التوكن المشترك بيفتح أي مجموعة دايمًا — فالمستدعون الحاليون
 *     (وحدات المسح على الـ VM بالترويسة المشتركة) بيكملوا شغالين
 *     زي ما هم من غير أي تغيير، سواء التوكنات الخاصة اتظبطت ولا لأ.
 *   - ولا توكن مضبوط أصلًا = الكل مرفوض (fail-closed زي اليوم).
 *
 * المقارنة بزمن ثابت (constant-time) عبر `tokenEquals` — مش مساواة
 * مباشرة — فزمن الرد مش بيكشف طول أطول بادئة متطابقة من التوكن.
 */

export type AdminChecker = (req: Request) => boolean;

const encoder = new TextEncoder();

/**
 * مقارنة توكنات بزمن ثابت: بتقارن بايتات UTF-8 للطرفين كلها من غير
 * أي خروج مبكر عند أول اختلاف، فالزمن المستغرق مش بيدي إشارة عن
 * طول أطول بادئة متطابقة. توكن متوقع فاضي = رفض دايمًا (fail-closed)،
 * وتوكن معروض فاضي = رفض.
 */
export function tokenEquals(presented: string, expected: string): boolean {
  const a = encoder.encode(String(presented || ""));
  const b = encoder.encode(String(expected || ""));
  if (b.length === 0) return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** بيبني فاحص ترويسة x-migo-admin لمجموعة مسارات واحدة. */
export function makeAdminChecker(
  sharedToken: string,
  routeToken: string,
): AdminChecker {
  const shared = String(sharedToken || "");
  const specific = String(routeToken || "");
  return (req: Request): boolean => {
    const presented = req.headers.get("x-migo-admin");
    if (!presented) return false;
    if (specific && tokenEquals(presented, specific)) return true;
    return !!shared && tokenEquals(presented, shared);
  };
}

// ---------------------------------------------------------------------------
// جلسة اللوحة الموقعة (المرحلة م٦-هـ): بعد ما دخول اللوحة يعدّي
// التحقق بخطوتين عند البوت، اللوحة بتخزّن جلسة موقعة بدل التوكن
// الخام: `v1.<exp>.<sig>` — ‏exp وقت انتهاء Unix بالثواني، وsig
// ‏HMAC-SHA256(ADMIN_TOKEN, "migo-panel-session." + exp) بصيغة
// base64url. التوقيع بالتوكن المشترك نفسه فمفيش سرّ بيئة جديد،
// والجلسة بتتسلّم في نفس ترويسة x-migo-admin وبتتميّز بشكلها.
//
// قرار التصميم (من موجز م٦-هـ): `makeAdminChecker` والفاحصات
// الحالية متزامنة وبتفضل متزامنة زي ما هي بالحرف — التحقق من
// الجلسة غير متزامن لوحده (WebCrypto)، فنقطة الدخول في api.ts
// بتستدعي `verifySessionToken` قبل الفاحصات لما الترويسة شكلها
// جلسة (`isSessionShaped`)، ولو الجلسة سليمة بتبدّل الترويسة
// داخليًا بالتوكن المشترك فالفاحصات الحالية بتحكم بعد كده زي
// النهاردة بالظبط. التوكن اللي شكله مش جلسة ما بيعدّيش من هنا
// أصلًا وبيتحكم عليه بالفاحصات الحالية مباشرة.
// ---------------------------------------------------------------------------

/** عمر جلسة اللوحة بالثواني (٨ ساعات). */
export const SESSION_TTL_SECONDS = 30 * 24 * 3600;

/** بادئة رسالة التوقيع — بتفصل توقيعات الجلسة عن أي استخدام تاني للتوكن. */
export const SESSION_SIGNING_PREFIX = "migo-panel-session.";

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sessionSignature(
  adminToken: string,
  exp: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(adminToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(SESSION_SIGNING_PREFIX + exp),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

/** الشكل العام لتوكن الجلسة: يبدأ بـ "v1." و٣ أجزاء مفصولة بنقط. */
export function isSessionShaped(presented: string): boolean {
  const p = String(presented || "");
  if (!p.startsWith("v1.")) return false;
  return p.split(".").length === 3;
}

/**
 * بيبني توكن جلسة جديد من التوكن المشترك ووقت دلوقتي (ثواني
 * Unix) — الانتهاء = دلوقتي + SESSION_TTL_SECONDS. توكن مشترك
 * فاضي = رفض (بيرمي) عشان ما تتولدش جلسة موقعة بسرّ فاضي.
 */
export async function makeSessionToken(
  adminToken: string,
  nowSeconds: number,
): Promise<string> {
  const token = String(adminToken || "");
  if (!token) throw new Error("cannot sign a session without an admin token");
  const exp = Math.floor(nowSeconds) + SESSION_TTL_SECONDS;
  const sig = await sessionSignature(token, String(exp));
  return `v1.${exp}.${sig}`;
}

/**
 * تحقق جلسة غير متزامن: الشكل سليم، والانتهاء رقم وصالح
 * (أكبر من دلوقتي)، والتوقيع بيطابق توقيع التوكن المشترك على
 * نفس الانتهاء — المقارنة بزمن ثابت عبر `tokenEquals` على
 * نص التوقيع. توكن مشترك فاضي = رفض دايمًا (fail-closed).
 */
export async function verifySessionToken(
  presented: string,
  adminToken: string,
  nowSeconds: number,
): Promise<boolean> {
  const token = String(adminToken || "");
  if (!token) return false;
  const p = String(presented || "");
  if (!isSessionShaped(p)) return false;
  const parts = p.split(".");
  const exp = parts[1];
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || !Number.isInteger(expNum)) return false;
  if (expNum <= Math.floor(nowSeconds)) return false;
  const expected = await sessionSignature(token, exp);
  return tokenEquals(parts[2], expected);
}
