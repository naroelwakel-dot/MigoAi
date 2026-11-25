// اختبارات الموجة التانية من خطة إنستينكت (بنود ١/٢/٣/٤/٥/٦/٧/١١/١٢/١٣) —
// `deno test control/wave2.test.ts`
// المنطق النقي عايش جوه سكربت اللوحة في control.html بين علامتي
// PURE-WAVE2 — الاختبارات بتقراه من هناك حرفيًا وبتشغّله،
// وباقي الاختبارات فحوص ساكنة على توصيل الواجهة (الشريط،
// المزيد، البطاقات، المعاينات) من غير أي نداء حي.
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
  MORE_GROUPS: { title: string; screens: [string, string][] }[];
  moreScreensFlat: () => { view: string; name: string; group: string }[];
  filterMoreScreens: (q: string) => { view: string; name: string; group: string }[];
  HOME_QUEUE_TARGETS: Record<string, unknown>;
  homeQueueTarget: (key: string) => Record<string, unknown> | null;
  sortHomeCases: <T extends { sev: string; oldestAt?: string | null }>(cases: T[]) => T[];
  couponRestrictionsText: (c: Record<string, unknown> | null) => string;
  channelPreviewLines: (body: Record<string, unknown>, isEdit: boolean) => string[];
  sitePreviewLines: (kind: string, value: Record<string, unknown>) => string[];
  orderActionsForState: (
    kind: string,
    status: string,
  ) => Record<string, { ok: boolean; reason: string }>;
  adminNextStep: (kind: string, status: string) => string;
  stopWord: (active: boolean, feminine?: boolean) => string;
  ratingText: (rating: unknown) => string;
  ltrWrap: (s: unknown) => string;
}

const PB = "/*PURE-WAVE2-BEGIN*/";
const PE = "/*PURE-WAVE2-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure wave2 block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { MORE_GROUPS, moreScreensFlat, filterMoreScreens, HOME_QUEUE_TARGETS, homeQueueTarget, sortHomeCases, couponRestrictionsText, channelPreviewLines, sitePreviewLines, orderActionsForState, adminNextStep, stopWord, ratingText, ltrWrap };",
) as () => PureApi)();

// ---------- بند ١: الشريط السفلي خمسة بس، والأحداث برّه ----------
Deno.test("الشريط السفلي: خمسة مداخل نصية بالترتيب ومن غير أحداث", () => {
  const navStart = html.indexOf('<nav class="bottom"');
  const nav = html.slice(navStart, html.indexOf("</nav>", navStart));
  const labels = [...nav.matchAll(/data-nav="([a-z]+)">([^<]+)</g)].map((m) => [m[1], m[2]]);
  eq(labels, [
    ["home", "مهامي"], ["orders", "الطلبات"], ["customers", "العملاء"],
    ["chats", "المحادثات"], ["more", "المزيد"],
  ], "five text entries in plan order");
  ok(!nav.includes('data-nav="events"'), "events left the bar");
});

Deno.test("الأحداث: اختصار ثابت أعلى مهامي + وصلة في المزيد", () => {
  const homeStart = html.indexOf('<main id="homeMain"');
  const homeEnd = html.indexOf('<main id="customersMain"');
  const home = html.slice(homeStart, homeEnd);
  ok(home.indexOf('id="eventsShortcutCard"') >= 0, "shortcut card on home");
  ok(home.indexOf('id="eventsShortcutCard"') < home.indexOf('id="queueWrap"'),
    "shortcut sits above the decision queues");
  ok(html.includes('$("homeEventsBtn").addEventListener("click"'), "shortcut wired");
  ok(pure.moreScreensFlat().some((s) => s.view === "events"), "events linked in المزيد");
});

// ---------- بند ٢: خريطة المزيد ----------
Deno.test("المزيد: ٣ مجموعات بالترتيب والمحتوى المضبوطين في الخطة", () => {
  eq(pure.MORE_GROUPS.map((g) => g.title),
    ["البيع", "العملاء والمحتوى", "التشغيل والحماية"], "group titles");
  eq(pure.moreScreensFlat().map((s) => s.view), [
    "prices", "catalog", "suppliers", "partners", "coupons", "merchants",
    "events", "channel", "site", "reviews", "adminUsers", "preview", "visitors",
    "health", "guards", "settings",
  ], "16 more-screens in plan order");
  eq(pure.moreScreensFlat().map((s) => s.name), [
    "الأسعار", "الكتالوج", "الموردون", "توريد الشركاء", "الكوبونات", "التجار",
    "الأحداث", "القناة", "الموقع", "التقييمات", "حسابات الموقع",
    "شوف كما يراه العميل", "الزوار", "صحة النظام", "الحراس", "إعدادات البوت",
  ], "screen names");
  const covered = new Set(pure.moreScreensFlat().map((s) => s.view));
  ["home", "orders", "customers", "chats"].forEach((v) => covered.add(v));
  eq(covered.size, 20, "all 20 screens have an explicit place (bar + more)");
});

Deno.test("بحث المزيد: بيصفي بأسماء الشاشات بس", () => {
  eq(pure.filterMoreScreens("الأحداث").map((s) => s.view), ["events"], "by name");
  eq(pure.filterMoreScreens("صحة").map((s) => s.view), ["health"], "partial name");
  eq(pure.filterMoreScreens("").length, 16, "empty = all");
  eq(pure.filterMoreScreens("مش موجود").length, 0, "no match = none");
  ok(html.includes("دور على شاشة") && html.includes('id="moreSearch"'),
    "search field labelled and present");
  ok(html.includes("filterMoreScreens(searchInp.value)"), "search wired to the pure filter");
  ok(html.includes('data-more-view="'), "more entries rendered from the map");
});

// ---------- بند ٣: مهامي بداية شغل ----------
Deno.test("مهامي: ترتيب الأقسام — قرار، محادثات بلا رد، تشغيل مختصر", () => {
  const homeStart = html.indexOf('<main id="homeMain"');
  const home = html.slice(homeStart, html.indexOf('<main id="customersMain"'));
  const iq = home.indexOf('id="queueWrap"');
  const ic = home.indexOf('id="homeChatsCard"');
  const io = home.indexOf('id="compCard"');
  ok(iq >= 0 && ic > iq && io > ic, "decisions, then chats, then ops status");
  ok(html.includes("مفيش حاجة مستنية قرارك"), "empty-decisions wording");
  ok(html.includes("مش قادرين نجيب الحالات"), "home read-failure wording");
  ok(html.includes('data-queue-target="') || html.includes("data-queue-target"),
    "queue cards carry review targets");
  ok(html.includes("راجع الحالة"), "review-case button label");
});

Deno.test("مهامي: ترتيب الحالات بخطر التأخير وبعدين الأقدم — من غير إنفاق", () => {
  const sorted = pure.sortHomeCases([
    { sev: "amber", oldestAt: "2026-01-02T00:00:00Z", tag: "amber-newer" },
    { sev: "red", oldestAt: "2026-01-03T00:00:00Z", tag: "red" },
    { sev: "amber", oldestAt: "2026-01-01T00:00:00Z", tag: "amber-oldest" },
    { sev: "blue", oldestAt: null, tag: "blue" },
  ] as never);
  eq((sorted as unknown as { tag: string }[]).map((c) => c.tag),
    ["red", "amber-oldest", "amber-newer", "blue"], "severity then oldest first");
});

Deno.test("مهامي: وجهات راجع الحالة بتوصل للقوائم الحقيقية بفلاترها", () => {
  eq(pure.homeQueueTarget("sheerid_needs_review"),
    { view: "orders", queue: "intervention", surface: "sheerid" }, "sheerid filtered orders");
  eq(pure.homeQueueTarget("bot_pending_topups"), { anchor: "botTopupCard" }, "bot topups on home");
  eq(pure.homeQueueTarget("store_pending_topups"), { anchor: "topupCard" }, "store topups on home");
  eq(pure.homeQueueTarget("unmatched_sms"), { view: "events" }, "unmatched goes to events");
  eq(pure.homeQueueTarget("nope"), null, "unknown key = null");
  ok(html.includes("function goQueueTarget(key){"), "target executor defined");
  ok(html.includes('data-home-bot-topup') && html.includes('data-home-store-topup'),
    "home topup rows open the exact case");
});

// ---------- بند ٧: مفيش إيموجي/صور رمزية في الملف كله ----------
Deno.test("أيقونات: فحص رموز مصورة على الملف كله = صفر", () => {
  const pat = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F]/gu;
  const hits = html.match(pat) || [];
  eq(hits.length, 0, "zero pictographs in control.html");
  ok(!html.includes("أعد المحاولة"), "no retry-execution wording anywhere");
});

// ---------- بند ٦: أسماء موحدة وكلمات حالة ----------
Deno.test("أسماء موحدة: مهامي/الموقع/مستني مراجعة/متوقف", () => {
  ok(html.includes('home: "مهامي"'), "home title unified");
  ok(html.includes('site: "الموقع"'), "site title unified");
  ok(html.includes('pending: ["مستني مراجعة", "st-pending"]'), "topup pending wording");
  ok(html.includes('pending: "مستني مراجعة"'), "event pending wording");
  ok(!html.includes('"واقف"'), "no stray واقف status word");
  eq(pure.stopWord(true), "شغال", "active word");
  eq(pure.stopWord(false), "متوقف", "stopped word");
  eq(pure.ratingText(4), "التقييم: 4 من 5", "rating as words");
  eq(pure.ltrWrap("<a@b>"), '<span class="ltr">&lt;a@b&gt;</span>', "LTR wrap escapes");
});

// ---------- بند ٥: بطاقات بفعل أساسي واحد ----------
Deno.test("بطاقات: إجراءات أخرى وتفاصيل موجودة ولمس ٤٤ بكسل", () => {
  ok((html.match(/إجراءات أخرى/g) || []).length >= 6, "grouped secondary actions");
  ok((html.match(/<details class="more-details"><summary>تفاصيل<\/summary>/g) || []).length >= 2,
    "long details collapse under تفاصيل");
  ok(html.includes(".btn.small{display:inline-block; width:auto; min-height:44px;"),
    "small buttons at least 44px");
  ok(html.includes("min-height:44px; display:inline-flex; align-items:center;"),
    "filter chips at least 44px");
  ok(html.includes('id="sheetClose" type="button">إغلاق</button>'), "sheet close is a word");
});

// ---------- بند ١١: ٣ مداخل لنفس الحالة ----------
Deno.test("تفاصيل الطلب: الأفعال الصالحة لحالته بس وبأسباب للباقي", () => {
  const done = pure.orderActionsForState("shop", "fulfilled");
  eq(done["shop-done"].ok, false, "delivered order cannot be delivered again");
  ok(done["shop-done"].reason.length > 0, "invalid action carries a plain reason");
  eq(done["cancel-refund"].ok, false, "no cancel-refund on a closed order");
  eq(done.force.ok, true, "force stays available as the override");
  const pend = pure.orderActionsForState("shop", "pending");
  eq(pend["shop-done"].ok, true, "pending can be delivered");
  eq(pend["shop-proc"].ok, true, "pending can move to processing");
  const shP = pure.orderActionsForState("sheerid", "pending");
  eq(shP["sh-settle"].ok, true, "settle check open while pending");
  eq(shP["sh-resend"].ok, false, "no resend before any delivery exists");
  const shD = pure.orderActionsForState("sheerid", "fulfilled");
  eq(shD["sh-resend"].ok, true, "resend opens after delivery");
  eq(pure.orderActionsForState("provider", "failed")["prov-check"].ok, true,
    "provider verify available on failed");
  ok(html.includes("آخر خطوة مؤكدة") && html.includes("المطلوب منك دلوقتي"),
    "detail shows last confirmed step and the admin's next step");
  ok(html.includes("adminNextStep(kind, o.status)"), "next step derived from state");
  eq(pure.adminNextStep("shop", "fulfilled"), "مفيش حاجة مطلوبة — الطلب اتسلّم واتقفل.",
    "closed order needs nothing");
  ok(pure.adminNextStep("provider", "failed").includes("تحقق من حالة التنفيذ"),
    "failed order points at verify-first");
});

Deno.test("ملف العميل: المحفظتين منفصلتين الأول وبعدها الطلبات والشحنات والمحادثة والتحقق", () => {
  const start = html.indexOf("function renderFile(){");
  const seg = html.slice(start, html.indexOf("// ---------------- التحكم في العميل", start));
  const order = [
    'walletCardHtml("bot")', 'walletCardHtml("store")',
    "botOrdersHtml()", "botTopupsHtml()", "chatSectionHtml()", "botSheerHtml()",
  ].map((needle) => seg.indexOf(needle));
  ok(order.every((i) => i >= 0), "all file sections present");
  ok(order.every((v, i) => i === 0 || v > order[i - 1]), "sections in the item-11 order");
});

Deno.test("الحدث: مصدر الفلوس وهل اتستخدم والربط المؤكد ظاهرين", () => {
  ok(html.includes("مصدر الفلوس: "), "money source labelled");
  ok(html.includes("اتستخدم: أيوه — اتربط بـ: "), "used + confirmed link shown");
  ok(html.includes("اتستخدم: لسه ما اتستخدمش"), "unused state shown in words");
});

// ---------- بند ١٢: معاينات وفصل تغيير البيانات عن التنفيذ ----------
Deno.test("قيود الكوبون بكلام مفهوم قبل الحفظ", () => {
  eq(pure.couponRestrictionsText({
    discount: 10, expires_at: null, max_uses: null, min_order_egp: null, active: true,
  }), "خصم 10٪ على الطلب · ملوش تاريخ انتهاء · عدد الاستخدامات مفتوح · ملوش حد أدنى لقيمة الطلب · الكوبون شغال",
    "open coupon in plain words");
  const t = pure.couponRestrictionsText({
    discount: 25, expires_at: "2030-01-01T00:00:00Z", max_uses: 5, min_order_egp: 100, active: false,
  });
  ok(t.includes("أقصى عدد استخدامات: 5") && t.includes("من 100 ج.م وطالع") &&
    t.includes("الكوبون متوقف دلوقتي"), "bounded coupon in plain words");
  ok(html.includes("معاينة الكوبون قبل الحفظ"), "coupon save goes through preview");
});

Deno.test("معاينة المنشور ومحتوى الموقع قبل الحفظ", () => {
  eq(pure.channelPreviewLines(
    { text: "أهلا", scheduled_at: null, photo_url: null, buttons: null, pin: false }, false),
    ["منشور جديد.", "النص: أهلا", "وقت النشر: على طول بعد الحفظ", "الصورة: مفيش",
      "الأزرار: شبكة الأزرار الافتراضية بتاعة القناة", "التثبيت: مش هيتثبّت"],
    "immediate post preview");
  const sched = pure.channelPreviewLines(
    { text: "عرض", scheduled_at: "2030-05-01T10:00:00Z", photo_url: "https://x/y.png", buttons: [1, 2], pin: true }, true);
  ok(sched[0].includes("تعديل منشور") && sched[2].includes("مجدول") &&
    sched[5].includes("هيتثبّت"), "scheduled pinned edit preview");
  eq(pure.sitePreviewLines("announcement", { text: "عرض", url: "", enabled: true }),
    ["النص: «عرض»", "الرابط عند الضغط: مفيش", "الحالة: ظاهر للعملاء"], "announcement preview");
  eq(pure.sitePreviewLines("terms", { text: "" }),
    ["النص فاضي — صفحة الشروط الحالية هتفضل هي اللي ظاهرة."], "empty terms preview");
  ok(html.includes("معاينة المنشور قبل الحفظ"), "channel save goes through preview");
  ok(html.includes("function saveSiteContent(key, value, okText){") &&
    html.includes("sitePreviewLines(key, value)"), "site saves go through preview");
  (globalThis as Record<string, unknown>).SITE_SECTION_LABELS =
    [["sec-ai", "الذكاء الاصطناعي"], ["sec-faq", "الأسئلة الشائعة"]];
  eq(pure.sitePreviewLines("sections", { "sec-ai": true, "sec-faq": false }),
    ["أقسام ظاهرة: الذكاء الاصطناعي", "أقسام مخفية: الأسئلة الشائعة"], "sections preview");
});

Deno.test("فصل تغيير البيانات عن تشغيل التنفيذ في البيع", () => {
  ok(html.includes('<div class="group-title">تغيير بيانات</div>'), "edit-data group exists");
  ok(html.includes('<div class="group-title">تشغيل تنفيذ</div>'), "execution group exists");
  ok(html.includes("تشغيل تنفيذ — انقل لمورد آخر"), "failover labelled as execution");
});

Deno.test("شوف كما يراه العميل: معاينة قراءة بس — مفيش أي إرسال من قسمها", () => {
  const start = html.indexOf("شوف كما يراه العميل (م٦-هـ)");
  const seg = html.slice(start, html.indexOf("// صحة النظام والحراس", start));
  ok(start >= 0 && seg.length > 100, "preview section found");
  ok(!seg.includes('method: "POST"'), "preview section issues no POST at all");
  ok(seg.includes("disabled"), "preview buttons are display-only");
});

// ---------- بند ١٣: فصل المعاني ----------
Deno.test("فصل المعاني: صحة/حراس/إعدادات/حسابات موقع/تجار", () => {
  ok(html.includes("محتاج تدخل: "), "health names the needed intervention");
  ok(html.includes("مش حسابات مسؤولي اللوحة دي"), "site accounts say they are customer logins");
  ok(html.includes("إعدادات الفلوس مكانها شاشة العملاء"), "bot settings point money to its only home");
  ok(html.includes('"إيقاف التاجر"') || html.includes("إيقاف التاجر"), "merchant stop exists");
  ok(html.includes("إيقاف مفتاح التاجر"), "key stop is a separate named action");
  ok(html.includes("أكّد إيقاف التاجر") && html.includes("أكّد إيقاف مفتاح التاجر"),
    "each stop has its own named confirm");
  ok(html.includes("مرتبين بآخر نشاط بس — دي شاشة نشاط تشغيلي"),
    "visitors declared operational activity only");
});
