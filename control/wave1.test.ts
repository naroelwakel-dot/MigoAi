// اختبارات الموجة الأولى من خطة إنستينكت (بنود ٢٥/٢٦/٢٧/٩/١٠/٨) —
// `deno test control/wave1.test.ts`
// المنطق النقي عايش جوه سكربت اللوحة في control.html بين علامتي
// PURE-WAVE1 — الاختبارات بتقراه من هناك حرفيًا وبتشغّله،
// وباقي الاختبارات فحوص ساكنة على توصيل الواجهة (أزرار/باراميترات/
// عناوين تأكيد) من غير أي نداء حي.
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
  mergeEventsPage: (
    existing: { id?: unknown }[],
    incoming: { id?: unknown }[],
  ) => { id?: unknown }[];
  eventsHasMore: (fetched: number, total: number) => boolean;
  eventsPageLine: (shown: number, total: number) => string;
  lostDaysFromChoice: (choice: string, custom?: unknown) => number;
  storeOrderStatusParam: (key: string) => string;
  sectionStatusKind: (
    st: { loading?: boolean; failed?: boolean; hasData?: boolean; lastOk?: number } | null,
  ) => string;
  isUnknownOutcome: (e: unknown) => boolean;
  navEntryOf: (
    view: string,
    filters: Record<string, unknown>,
    scroll: number,
  ) => { view: string; filters: Record<string, unknown>; scroll: number };
}

const PB = "/*PURE-WAVE1-BEGIN*/";
const PE = "/*PURE-WAVE1-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure wave1 block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { mergeEventsPage, eventsHasMore, eventsPageLine, lostDaysFromChoice, storeOrderStatusParam, sectionStatusKind, isUnknownOutcome, navEntryOf };",
) as () => PureApi)();

// ---------- بند ٢٥: ترقيم الأحداث ----------
Deno.test("أحداث: دمج الصفحة الأقدم بيخصم المكرر بالمعرّف وبيحافظ على الترتيب", () => {
  const merged = pure.mergeEventsPage(
    [{ id: "a" }, { id: "b" }],
    [{ id: "b" }, { id: "c" }, { id: "d" }],
  );
  eq(merged.map((x) => x.id), ["a", "b", "c", "d"], "dedupe by id, order kept");
  eq(pure.mergeEventsPage([], [{ id: 1 }, { id: 1 }]).length, 1, "dup inside page dropped");
  eq(pure.mergeEventsPage([{ id: "x" }], [{}]).length, 2, "id-less item passes through");
});

Deno.test("أحداث: لسه فيه أقدم؟ وسطر «اتعرض N من M»", () => {
  eq(pure.eventsHasMore(100, 250), true, "more pages exist");
  eq(pure.eventsHasMore(250, 250), false, "all fetched");
  eq(pure.eventsHasMore(0, 0), false, "empty total");
  eq(pure.eventsPageLine(100, 250), "اتعرض 100 من 250", "page line wording");
});

Deno.test("أحداث: التوصيل — زر أقدم، offset بيتبعت، والتحديث بيصفّر الصفحة", () => {
  ok(html.includes('id="evMoreBtn"'), "older-events button exists");
  ok(html.includes("أحداث أقدم"), "older-events label");
  ok(html.includes('id="evPageLine"'), "page line element exists");
  ok(html.includes("evState.offset = 0; evState.received = 0;"), "fresh load resets paging");
  ok(html.includes('offset=" + nextOffset'), "next page sends offset");
  ok(html.includes("function loadMoreEvents(){"), "load-more defined");
  ok(html.includes("mergeEventsPage(evState.items, incoming)"), "append merges with dedupe");
  ok(html.includes('loadEvents(true)'), "more button loads next page");
});

// ---------- بند ٢٦: مدة الشحنة الضايعة ----------
Deno.test("شحنة ضايعة: تحويل اختيار المدة لأيام ضمن حدود الخادم", () => {
  eq(pure.lostDaysFromChoice("7"), 7, "week");
  eq(pure.lostDaysFromChoice("30"), 30, "month");
  eq(pure.lostDaysFromChoice("custom", "45"), 45, "custom in range");
  eq(pure.lostDaysFromChoice("custom", "900"), 365, "custom clamped to 365");
  eq(pure.lostDaysFromChoice("custom", "0"), 1, "custom clamped to 1");
  eq(pure.lostDaysFromChoice("custom", "abc"), 30, "bad custom falls back to 30");
  eq(pure.lostDaysFromChoice(""), 30, "empty falls back to 30");
});

Deno.test("شحنة ضايعة: التوصيل — اختيار المدة وdays بيتبعت للنقطتين", () => {
  ok(html.includes('id="lostDaysSeg"'), "duration selector exists");
  ok(html.includes("آخر أسبوع") && html.includes("آخر شهر") && html.includes("مدة بالأيام"),
    "duration choices labelled");
  ok(html.includes('id="lostDaysCustom"'), "custom days input exists");
  ok(html.includes('"&days=" + days'), "days plumbed from choice");
  ok(!html.includes('"&days=30"'), "no hardcoded 30 days left");
  ok(html.includes("مفيش نتائج في المدة دي"), "period empty-result wording");
});

// ---------- بند ٢٧: فلتر حالة طلبات الموقع ----------
Deno.test("طلبات الموقع: باراميتر الحالة — المعروف بيعدّي والكل فاضي", () => {
  eq(pure.storeOrderStatusParam("new"), "new", "new passes");
  eq(pure.storeOrderStatusParam("refunded"), "refunded", "refunded passes");
  eq(pure.storeOrderStatusParam(""), "", "all = empty (param omitted)");
  eq(pure.storeOrderStatusParam("bogus"), "", "unknown = empty");
});

Deno.test("طلبات الموقع: التوصيل — أزرار الحالة والباراميتر والملحوظة", () => {
  ok(html.includes('id="storeOrdStatusSeg"'), "status segment exists");
  for (const lbl of ["الكل", "جديد", "مدفوع", "منفذ", "ملغي", "مسترد"]) {
    ok(html.includes(lbl), "status choice labelled: " + lbl);
  }
  ok(html.includes('"&status=" + encodeURIComponent(stParam)'), "status param sent");
  ok(html.includes("دي أحدث طلبات مطابقة للحالة"), "newest-matching note present");
  ok(html.includes("ordState.storeStatus"), "filter state kept on ordState");
});

// ---------- بند ٩: حالات الأقسام الصريحة ----------
Deno.test("أقسام: نوع الحالة من علم التحميل/الفشل/البيانات", () => {
  eq(pure.sectionStatusKind(null), "idle", "no state = idle");
  eq(pure.sectionStatusKind({ loading: true }), "loading", "loading");
  eq(pure.sectionStatusKind({ failed: true, hasData: false }), "failed", "failed empty");
  eq(pure.sectionStatusKind({ failed: true, hasData: true, lastOk: 5 }), "stale", "failed after success = stale");
  eq(pure.sectionStatusKind({ lastOk: 5 }), "ok", "success remembered");
});

Deno.test("أقسام: نتيجة مش مؤكدة = رد ضايع أو خطأ خادم بس", () => {
  eq(pure.isUnknownOutcome(new Error("network")), true, "no status = unknown");
  eq(pure.isUnknownOutcome({ status: 502 }), true, "502 = unknown");
  eq(pure.isUnknownOutcome({ status: 400 }), false, "400 = definite rejection");
  eq(pure.isUnknownOutcome({ status: 401 }), false, "401 = definite");
  eq(pure.isUnknownOutcome({ userText: "اكتب مبلغ" }), false, "local validation = definite");
});

Deno.test("أقسام: التوصيل — حالة لكل قسم وزر حاول تاني بيخصّه وزر تحقق من الحالة", () => {
  for (const k of ["home", "topups", "events", "botOrders", "storeOrders", "customers", "chats"]) {
    ok(html.includes('id="sectionStatus-' + k + '"'), "status element: " + k);
    ok(html.includes('sectionBegin("' + k + '")') || html.includes('sectionOk("' + k + '")'),
      "loader wired: " + k);
  }
  ok(html.includes("data-section-retry"), "per-section retry button");
  ok(html.includes("function sectionRetry(key){"), "retry dispatches per section");
  ok(html.includes("المعروض قديم — آخر قراءة ناجحة"), "stale wording with last-success time");
  ok(html.includes('id="actCheck"') && html.includes("تحقق من الحالة"), "verify-state offered on lost response");
  ok(html.includes("function verifyCurrentState(){"), "verify re-reads the entity");
  ok(html.includes("ما تعيدش التنفيذ"), "sheet warns against re-executing");
});

// ---------- بند ١٠: وضوح تأكيدات الفلوس ----------
Deno.test("فلوس: عناوين تأكيد مسماة بالفعل وأرصدة تقديرية معلّمة", () => {
  for (const lbl of [
    "أكّد الاعتماد", "أكّد الرفض", "أكّد التعويض", "أكّد التصحيح",
    "أكّد الإيداع", "أكّد النقل", "أكّد العكس", "أكّد الإلغاء والاسترداد",
  ]) {
    ok(html.includes(lbl), "confirm label present: " + lbl);
  }
  ok(!html.includes('"شغّل المطابقة"'), "generic match label replaced");
  ok(!html.includes('"تنفيذ القرار"'), "generic decide label replaced");
  ok(html.includes("تقديري — الرقم النهائي بيأكده الخادم"), "estimate label on after-balances");
  ok(html.includes("DECIDE_CONFIRM") && html.includes("ADJ_CONFIRM"), "per-action confirm maps");
  ok(html.includes("محفظة البوت — جنيه مصري") && html.includes("محفظة الموقع — جنيه مصري"),
    "wallet + currency named in confirms");
});

// ---------- بند ٨: الرجوع لمكانك ----------
Deno.test("تنقّل: لقطة القائمة بتحفظ الشاشة والفلاتر والتمرير", () => {
  eq(pure.navEntryOf("orders", { queue: "all" }, 420),
    { view: "orders", filters: { queue: "all" }, scroll: 420 }, "entry shape");
  eq(pure.navEntryOf("orders", null, "x").scroll, 0, "bad scroll becomes 0");
});

Deno.test("تنقّل: التوصيل — فتح التفاصيل بيحفظ المكان والرجوع بيرجّعه والروابط بالمعرّف", () => {
  ok(html.includes("function rememberListReturn("), "remember helper defined");
  ok(html.includes("function restoreListScroll("), "restore helper defined");
  ok(html.includes('rememberListReturn("customer", "customers")'), "customer detail remembers list");
  ok(html.includes('rememberListReturn("order", "orders")'), "order detail remembers list");
  ok(html.includes('rememberListReturn("chat", "chats")'), "chat remembers list");
  ok(html.includes('data-oa="open-customer"'), "order detail cross-links to customer file by id");
  ok(html.includes("data-ev-cust"), "event topup cross-links to customer file by id");
});
