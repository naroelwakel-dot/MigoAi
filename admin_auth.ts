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
 * المقارنة بنفس أسلوب الكود الحالي (مساواة مباشرة على قيمة الترويسة).
 */

export type AdminChecker = (req: Request) => boolean;

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
    if (specific && presented === specific) return true;
    return !!shared && presented === shared;
  };
}
