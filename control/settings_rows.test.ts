// اختبارات حالة مفاتيح التشغيل/الإيقاف في صفوف إعدادات البوت —
// `deno test control/settings_rows.test.ts`
// المنطق النقي عايش جوه سكربت اللوحة في control.html بين علامتي
// PURE-SETTINGS — الاختبارات دي بتقراه من هناك حرفيًا وبتشغّله،
// فاللي بيتختبر هو نفس الكود اللي المتصفح بيشغّله بالظبط.
// خلفية الإصلاح: مفاتيح إظهار أزرار القائمة التلاتة
// (menu_show_webapp / menu_show_report / menu_show_channel)
// قيمتها عند البوت null (عمرها ما اتظبطت)، والبوت بيقراها
// بافتراضي «شغال» (get_bool(key, True) في botkit/views.py:
// الزر بيظهر ما لم يُخفَ صراحةً) — واللوحة كانت بترسم أي قيمة
// غير true «واقف»، فالمفاتيح التلاتة كانت باينة مطفية وهي
// شغالة فعليًا. القيم اللي تحت منقولة من رد البوت الحي نفسه.
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

interface PureApi {
  setBoolOnOf: (e: { key?: string; value?: unknown } | null) => boolean;
  SET_BOOL_UNSET_DEFAULTS: Record<string, boolean>;
}

const PB = "/*PURE-SETTINGS-BEGIN*/";
const PE = "/*PURE-SETTINGS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure settings block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { setBoolOnOf, SET_BOOL_UNSET_DEFAULTS };",
) as () => PureApi)();

// ------------------------------------------------- حالة البوت الحية
Deno.test("مفاتيح إظهار أزرار القائمة: القيمة الفاضية عند البوت = شغال", () => {
  // كده بالحرف من رد GET /control/bot-settings الحي: التلاتة null.
  eq(pure.setBoolOnOf({ key: "menu_show_webapp", value: null }), true, "webapp unset = on");
  eq(pure.setBoolOnOf({ key: "menu_show_report", value: null }), true, "report unset = on");
  eq(pure.setBoolOnOf({ key: "menu_show_channel", value: null }), true, "channel unset = on");
  // والقيمة الغايبة أصلًا (مفيش حقل value) زي الفاضية.
  eq(pure.setBoolOnOf({ key: "menu_show_webapp" }), true, "webapp missing = on");
});

Deno.test("القيمة الصريحة بتكسب دايمًا على الافتراضي", () => {
  eq(pure.setBoolOnOf({ key: "menu_show_webapp", value: false }), false, "explicit false hides");
  eq(pure.setBoolOnOf({ key: "menu_show_report", value: "false" }), false, "string false hides");
  eq(pure.setBoolOnOf({ key: "menu_show_channel", value: true }), true, "explicit true shows");
  eq(pure.setBoolOnOf({ key: "menu_show_channel", value: "true" }), true, "string true shows");
});

Deno.test("باقي المفاتيح: الصريح زي ما هو، والفاضي لمفتاح افتراضيه مش معروف يفضل واقف", () => {
  // الشحن التلقائي والنجوم قيمهم الصريحة true في الرد الحي.
  eq(pure.setBoolOnOf({ key: "topup_auto_sms_enabled", value: true }), true, "sms auto on");
  eq(pure.setBoolOnOf({ key: "topup_auto_exchange_enabled", value: true }), true, "exchange auto on");
  eq(pure.setBoolOnOf({ key: "stars_topup_enabled", value: true }), true, "stars on");
  eq(pure.setBoolOnOf({ key: "sales_enabled", value: true }), true, "sales on");
  // افتراضي مفاتيح الشحن عند البوت «واقف» أصلًا (default:false في
  // رد إعدادات الفلوس)، فالفاضي هنا لازم يفضل واقف — مفيش قاعدة
  // عامة «الفاضي = شغال».
  eq(pure.setBoolOnOf({ key: "topup_auto_sms_enabled", value: null }), false, "sms unset stays off");
  eq(pure.setBoolOnOf({ key: "sales_enabled", value: null }), false, "unknown default stays off");
  eq(pure.setBoolOnOf({ key: "whatever_new_key", value: null }), false, "new key unset off");
  eq(pure.setBoolOnOf(null), false, "null entry off");
  eq(pure.setBoolOnOf({}), false, "empty entry off");
});

Deno.test("جدول الافتراضيات: مفاتيح القائمة التلاتة بس", () => {
  eq(Object.keys(pure.SET_BOOL_UNSET_DEFAULTS).sort(),
    ["menu_show_channel", "menu_show_report", "menu_show_webapp"],
    "defaults table keys");
});

// ------------------------------------------------------------ التوصيل
Deno.test("صفوف الإعدادات بتستخدم الاستنتاج المصحح", () => {
  ok(html.includes("var on = setBoolOnOf(e);"), "renderSettingRows wired");
  ok(!html.includes('var on = e.value === true || e.value === "true";'),
    "old null-blind derivation gone");
});
