// اختبارات زر «رجوع» المرئي في كل قسم ونافذة (طلب المالك
// ٢٠٢٦-١١-٢٣: «ليه مفيش زر رجوع للخلف في أي قسم أو نافذة») —
// `deno test control/backbtn.test.ts`
// بند ٨ كان بيحفظ حالة القوائم والتمرير بس من غير أي زر مرئي.
// الزر ده هو الطبقة المرئية فوقه: نفس شكل وموضع أزرار رجوع
// التفاصيل القائمة (ملف العميل/الطلب/المحادثة)، وبيودّي لنفس
// مكان الرجوع. منطق الوجهة النقي عايش جوه control.html بين
// علامتي PURE-BACKBTN والاختبارات بتقراه من هناك حرفيًا.
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
  SUB_VIEWS: Record<string, number>;
  backRecordOf: (
    from: unknown,
    to: unknown,
    isBackNav: unknown,
  ) => { view: string; backTo: string } | null;
  backTargetOf: (map: unknown, view: string) => string;
}

const PB = "/*PURE-BACKBTN-BEGIN*/";
const PE = "/*PURE-BACKBTN-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure backbtn block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { SUB_VIEWS, backRecordOf, backTargetOf };",
) as () => PureApi)();

function seg(from: string, to: string): string {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("segment not found: " + from);
  return html.slice(a, b);
}

const SUBS = [
  "prices", "catalog", "suppliers", "events", "settings", "channel",
  "visitors", "preview", "health", "guards", "reviews", "adminUsers",
  "coupons", "merchants", "site",
];
const ROOTS = ["home", "customers", "orders", "chats"];

// ---------- منطق الوجهة النقي ----------
Deno.test("زر الرجوع: خريطة الشاشات الفرعية هي شاشات «المزيد» الـ١٥ بالظبط", () => {
  eq(Object.keys(pure.SUB_VIEWS).sort(), [...SUBS].sort(), "sub view set");
  // مطابقة حية مع خريطة «المزيد» الرسمية (PURE-WAVE2): أي شاشة
  // جديدة تدخل الخريطة لازم تدخل هنا، والعكس.
  const w2b = html.indexOf("/*PURE-WAVE2-BEGIN*/");
  const w2e = html.indexOf("/*PURE-WAVE2-END*/");
  ok(w2b >= 0 && w2e > w2b, "wave2 pure block present");
  const w2 = (new Function(
    html.slice(w2b, w2e) + "\nreturn { moreScreensFlat };",
  ) as () => { moreScreensFlat: () => { view: string }[] })();
  eq(
    w2.moreScreensFlat().map((s) => s.view).sort(),
    [...SUBS].sort(),
    "SUB_VIEWS == MORE_GROUPS screens",
  );
});

Deno.test("زر الرجوع: التنقّل العادي لشاشة فرعية بيسجّل مصدره", () => {
  eq(pure.backRecordOf("home", "catalog", false), { view: "catalog", backTo: "home" }, "home->catalog");
  eq(pure.backRecordOf("orders", "events", false), { view: "events", backTo: "orders" }, "orders->events");
  eq(pure.backRecordOf("catalog", "suppliers", false), { view: "suppliers", backTo: "catalog" }, "sub->sub");
});

Deno.test("زر الرجوع: مفيش تسجيل لشاشة جذرية أو نفس الشاشة أو أثناء الرجوع نفسه", () => {
  eq(pure.backRecordOf("home", "orders", false), null, "root target");
  eq(pure.backRecordOf("home", "home", false), null, "same view");
  eq(pure.backRecordOf("catalog", "catalog", false), null, "same sub view");
  eq(pure.backRecordOf("catalog", "home", true), null, "back nav never records");
  eq(pure.backRecordOf("home", "catalog", true), null, "back nav to sub never records");
  eq(pure.backRecordOf("", "catalog", false), null, "empty from");
  eq(pure.backRecordOf(undefined, "catalog", false), null, "undefined from");
  eq(pure.backRecordOf("home", "", false), null, "empty to");
});

Deno.test("زر الرجوع: الوجهة هي آخر مصدر مسجّل، والغياب = مهامي", () => {
  eq(pure.backTargetOf({ catalog: "home" }, "catalog"), "home", "recorded home");
  eq(pure.backTargetOf({ catalog: "orders" }, "catalog"), "orders", "recorded orders");
  eq(pure.backTargetOf({}, "catalog"), "home", "no record -> home");
  eq(pure.backTargetOf(null, "catalog"), "home", "null map -> home");
  eq(pure.backTargetOf({ catalog: "catalog" }, "catalog"), "home", "self record ignored");
  eq(pure.backTargetOf({ catalog: "" }, "catalog"), "home", "empty record ignored");
});

Deno.test("زر الرجوع: محاكاة رحلة كاملة — فتح ورجوع وإعادة فتح من مكان تاني", () => {
  const map: Record<string, string> = {};
  // مهامي -> الكتالوج (من «المزيد»): التسجيل والمصدر
  let rec = pure.backRecordOf("home", "catalog", false);
  if (rec) map[rec.view] = rec.backTo;
  eq(pure.backTargetOf(map, "catalog"), "home", "catalog returns to home");
  // الرجوع نفسه (isBackNav) ما يغيّرش أي تسجيل — مفيش لفة
  rec = pure.backRecordOf("catalog", pure.backTargetOf(map, "catalog"), true);
  eq(rec, null, "the back trip itself records nothing");
  eq(pure.backTargetOf(map, "catalog"), "home", "record survives the back trip");
  // إعادة الفتح من الطلبات بتحدّث الوجهة
  rec = pure.backRecordOf("orders", "catalog", false);
  if (rec) map[rec.view] = rec.backTo;
  eq(pure.backTargetOf(map, "catalog"), "orders", "reopen from orders retargets");
});

// ---------- الزر في كل شاشة فرعية ----------
Deno.test("زر الرجوع: أول عنصر في كل شاشة فرعية، وبنفس الشكل الموحّد", () => {
  for (const v of SUBS) {
    const main = seg(`<main id="${v}Main"`, `<div class="msg"`);
    ok(
      main.includes(
        `<button class="btn secondary back view-back-btn" type="button" data-back-from="${v}">رجوع</button>`,
      ),
      `${v}: unified back button pinned at the top of the view`,
    );
  }
  eq((html.match(/class="btn secondary back view-back-btn"/g) || []).length, SUBS.length, "exactly one back button per sub view");
});

Deno.test("زر الرجوع: الشاشات الجذرية الأربع من غير زر (الشريط السفلي تنقّلها)", () => {
  for (const v of ROOTS) {
    const main = seg(`<main id="${v}Main"`, "</main>");
    ok(!main.includes("view-back-btn"), `${v}: root view has no back button`);
  }
  ok(html.includes('.btn{') && html.includes("min-height:50px"), "back button touch target >= 44px via .btn");
});

// ---------- الأوراق: رجوع من فوق = نفس إغلاق تحت ----------
Deno.test("زر الرجوع: ورقة «المزيد» وورقة الأفعال فيهم رجوع من فوق بنفس الإغلاق", () => {
  const sheet = seg('<div class="sheet" id="sheet">', "</div>\n\n<div class=\"sheet-veil\" id=\"actVeil\"");
  ok(sheet.includes('<button class="btn secondary back" id="sheetBack" type="button">رجوع</button>'), "sheet has top back");
  ok(sheet.indexOf('id="sheetBack"') < sheet.indexOf('id="sheetTitle"'), "sheet back is above the title");
  const act = seg('<div class="sheet form" id="actSheet">', "</div>\n\n<nav");
  ok(act.includes('<button class="btn secondary back" id="actBack" type="button">رجوع</button>'), "act sheet has top back");
  ok(act.indexOf('id="actBack"') < act.indexOf('id="actTitle"'), "act back is above the title");
  // نفس معالج الإغلاق بالحرف — مش مسار إغلاق تاني
  ok(html.includes('$("sheetBack").addEventListener("click", closeSheet);'), "sheet back == closeSheet");
  ok(html.includes('$("sheetClose").addEventListener("click", closeSheet);'), "sheet close unchanged");
  ok(html.includes('$("actBack").addEventListener("click", closeActSheet);'), "act back == closeActSheet");
  ok(html.includes('$("actCancel").addEventListener("click", closeActSheet);'), "act cancel unchanged");
});

// ---------- تفاصيل التاجر: التفصيلة الوحيدة اللي كانت من غير رجوع ----------
Deno.test("زر الرجوع: تفاصيل التاجر فيها رجوع بيقفل التفاصيل ويرجع للقائمة", () => {
  const card = seg('<section class="card hidden" id="mchDetailCard">', "</section>");
  ok(card.includes('<button class="btn secondary back" id="mchBack" type="button">رجوع لقائمة التجار</button>'), "merchant detail has back at its top");
  ok(card.indexOf('id="mchBack"') < card.indexOf('id="mchDetailTitle"'), "merchant back above the title");
  const fn = seg("function closeMerchantDetail(){", '$("mchBack")');
  ok(fn.includes("merchantsState.detail = null"), "close clears the detail");
  ok(fn.includes("renderMerchantDetail()"), "close re-renders (card hides)");
  ok(html.includes('$("mchBack").addEventListener("click", closeMerchantDetail);'), "merchant back wired");
});

// ---------- أزرار رجوع التفاصيل القائمة لسه موجودة زي ما هي ----------
Deno.test("زر الرجوع: أزرار التفاصيل القائمة (عميل/طلب/محادثة) لم تتغيّر", () => {
  ok(html.includes('id="fileBack">رجوع لنتائج البحث</button>'), "customer file back present");
  ok(html.includes('id="ordBack">رجوع لقائمة الطلبات</button>'), "order detail back present");
  ok(html.includes('id="chatBack">رجوع لقائمة المحادثات</button>'), "chat thread back present");
});

// ---------- التوصيل مع showView وبند ٨ ----------
Deno.test("زر الرجوع: showView بيسجّل المصدر وgoBackFrom بيرجع بنفس ذاكرة بند ٨", () => {
  const sv = seg("function showView(name){", "function refreshVisibleView()");
  ok(sv.includes("backRecordOf("), "showView records the back source");
  ok(sv.includes("viewBackTo[brec.view] = brec.backTo"), "record stored per view");
  const gb = seg("function goBackFrom(view){", 'document.querySelectorAll(".view-back-btn")');
  ok(gb.includes("backTargetOf(viewBackTo, view)"), "back target resolved by the pure rule");
  ok(gb.includes("viewNavBack = true;") && gb.includes("viewNavBack = false;"), "back trip flagged (no double record)");
  ok(gb.indexOf("viewNavBack = true;") < gb.indexOf("showView(target)"), "flag set before navigating");
  ok(gb.indexOf("showView(target)") < gb.indexOf("viewNavBack = false;"), "flag cleared after navigating");
  ok(gb.includes("navMemory[target]"), "scroll restored from item-8 nav memory");
  ok(gb.includes("window.scrollTo({ top: e.scroll })"), "restores the exact saved scroll");
  ok(
    html.includes('b.addEventListener("click", function(){ goBackFrom(b.getAttribute("data-back-from")); })'),
    "every view back button wired to goBackFrom",
  );
});

// ---------- أيقونات: صفر رموز مصورة لسه ----------
Deno.test("أيقونات: فحص رموز مصورة على الملف كله = صفر (زر الرجوع)", () => {
  const pat = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F]/gu;
  const hits = html.match(pat) || [];
  eq(hits.length, 0, "zero pictographs in control.html after back button");
});
