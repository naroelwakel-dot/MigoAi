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
