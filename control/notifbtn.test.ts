// اختبارات زر «الإشعارات» في ترويسة اللوحة (طلب المالك ٢٠٢٦-١١-٢٣:
// «خليها بزر جوا») — `deno test control/notifbtn.test.ts`
// الزر مدخل لقائمة تنبيهات بند ١٥ القائمة نفسها (#notifCard في مهامي،
// من GET /control/notifications) — مش قائمة تانية. منطق الشارة النقي
// عايش جوه control.html بين علامتي PURE-NOTIFBTN والاختبارات بتقراه
// من هناك حرفيًا وبتشغّله، وباقي الفحوص ساكنة على التوصيل.
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
  notifBadgeOf: (
    readOk: boolean,
    count: unknown,
  ) => { show: boolean; text: string };
}

const PB = "/*PURE-NOTIFBTN-BEGIN*/";
const PE = "/*PURE-NOTIFBTN-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure notifbtn block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { notifBadgeOf };",
) as () => PureApi)();

function seg(from: string, to: string): string {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("segment not found: " + from);
  return html.slice(a, b);
}

// ---------- منطق الشارة النقي ----------
Deno.test("شارة الإشعارات: صفر حالات = مفيش شارة (حالة هادية)", () => {
  eq(pure.notifBadgeOf(true, 0), { show: false, text: "" }, "zero count");
});

Deno.test("شارة الإشعارات: حالات مفتوحة بعد قراءة ناجحة = الرقم نفسه", () => {
  eq(pure.notifBadgeOf(true, 1), { show: true, text: "1" }, "one case");
  eq(pure.notifBadgeOf(true, 7), { show: true, text: "7" }, "seven cases");
  eq(pure.notifBadgeOf(true, 23), { show: true, text: "23" }, "many cases");
});

Deno.test("شارة الإشعارات: قراءة فاشلة = مفيش شارة أبدًا (مفيش رقم غلط)", () => {
  eq(pure.notifBadgeOf(false, 0), { show: false, text: "" }, "failed, zero");
  eq(pure.notifBadgeOf(false, 5), { show: false, text: "" }, "failed, stale 5");
});

Deno.test("شارة الإشعارات: قيم شاذة بتتعامل كصفر", () => {
  eq(pure.notifBadgeOf(true, -3), { show: false, text: "" }, "negative");
  eq(pure.notifBadgeOf(true, NaN), { show: false, text: "" }, "NaN");
  eq(pure.notifBadgeOf(true, "4"), { show: false, text: "" }, "string");
  eq(pure.notifBadgeOf(true, undefined), { show: false, text: "" }, "undef");
  eq(pure.notifBadgeOf(true, 2.9), { show: true, text: "2" }, "fraction floor");
});

// ---------- الزر في الترويسة ----------
Deno.test("زر الإشعارات: موجود في الترويسة بنص واضح وشارة مخفية ابتداءً", () => {
  const header = seg('<header class="top">', "</header>");
  const btn = seg('<button class="pill" id="notifBtn"', "</button>");
  ok(header.includes('id="notifBtn"'), "button lives in the global header");
  ok(btn.includes('class="pill"'), "button reuses the header pill style");
  ok(btn.includes("الإشعارات"), "button labelled الإشعارات in plain text");
  ok(btn.includes('id="notifCount"'), "count badge inside the button");
  ok(btn.includes("hidden"), "badge starts hidden (calm at zero)");
  ok(
    html.includes(".pill{") && html.includes("min-height:44px"),
    "pill touch target stays >= 44px",
  );
});

Deno.test("زر الإشعارات: الشريط السفلي فضل ٥ مداخل زي خطة التخطيط", () => {
  const nav = seg('<nav class="bottom" id="bottomNav">', "</nav>");
  eq((nav.match(/data-nav=/g) || []).length, 5, "bottom bar still 5 entries");
});

// ---------- التوصيل: نفس مصدر بند ١٥، نفس القائمة ----------
Deno.test("زر الإشعارات: الضغط بيودّي لقائمة مهامي القائمة وبيحدّثها", () => {
  const handler = seg('$("notifBtn").addEventListener', "homeEventsBtn");
  ok(handler.includes('showView("home")'), "tap goes to مهامي");
  ok(handler.includes("loadNotifications()"), "tap refreshes the feed");
  ok(handler.includes('$("notifCard")'), "tap targets the existing feed card");
  ok(handler.includes("scrollIntoView"), "tap scrolls to the feed");
  eq(
    (html.match(/id="notifCard"/g) || []).length,
    1,
    "exactly one notifications feed card (no duplicate feed)",
  );
  eq(
    (html.match(/"\/control\/notifications"/g) || []).length,
    1,
    "exactly one notifications endpoint call site (same source)",
  );
});

Deno.test("زر الإشعارات: الشارة بتتغذى من نفس قراءة القائمة وتنطفي مع الفشل", () => {
  const feed = seg(
    "function updateNotifBadge",
    "// ---------------- ١٦) البحث الموحد ----------------",
  );
  ok(feed.includes("notifState.items.length"), "count = feed items length");
  ok(feed.includes("updateNotifBadge(true)"), "success read updates badge");
  ok(feed.includes("updateNotifBadge(false)"), "failed read clears badge");
  const render = seg("function renderNotifications(){", "function doUnifiedSearch");
  ok(
    render.indexOf("updateNotifBadge(true)") <
      render.indexOf('var box = $("notifBody")'),
    "badge updates as part of the feed render",
  );
});

// ---------- أيقونات: صفر رموز مصورة لسه ----------
Deno.test("أيقونات: فحص رموز مصورة على الملف كله = صفر (زر الإشعارات)", () => {
  const pat = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F]/gu;
  const hits = html.match(pat) || [];
  eq(hits.length, 0, "zero pictographs in control.html after notif button");
});
