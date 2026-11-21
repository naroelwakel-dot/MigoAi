// اختبارات توصيل تحديث الشاشات عند رجوع التطبيق للمقدمة —
// `deno test control/panel_refresh.test.ts`
// خلفية الإصلاح: شاشات اللوحة كانت بتجيب بياناتها مرة واحدة
// وقت أول فتح، وأندرويد بيخلي الصفحة حية في الخلفية، فالمستخدم
// كان بيشوف لقطة عمرها ساعات كأنها حية (أحدث زائر باين من
// ٦ ساعات وهو واصل من دقايق). الإصلاح: الشاشة الظاهرة
// (رئيسية/زوار/موردون/إعدادات البوت) بيتعاد تحميلها لما
// الصفحة ترجع باينة أو تاخد التركيز أو تتفتح من جديد.
import html from "../control.html" with { type: "text" };

function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

Deno.test("التوصيل: أحداث الرجوع مربوطة بمحدّث الشاشة الظاهرة", () => {
  ok(html.includes('document.addEventListener("visibilitychange"'),
    "visibilitychange listener wired");
  ok(html.includes('window.addEventListener("focus", refreshVisibleView)'),
    "focus listener wired");
  ok(html.includes("function refreshVisibleView(){"), "refresher defined");
  ok(html.includes("currentViewName = name;"), "showView tracks the visible view");
  ok(html.includes("refreshVisibleView();"), "showView refreshes on open");
});

Deno.test("التوصيل: المحدّث بيروح للشاشات الأربع بس وبنفس محمّلاتها", () => {
  const start = html.indexOf("function refreshVisibleView(){");
  ok(start >= 0, "refresher found");
  const body = html.slice(start, start + 1600);
  ok(body.includes('name === "visitors"') && body.includes("loadVisitors()"),
    "visitors -> loadVisitors");
  ok(body.includes('name === "suppliers"') && body.includes("loadSuppliers()"),
    "suppliers -> loadSuppliers");
  ok(body.includes('name === "settings"') && body.includes("loadSettings()"),
    "settings -> loadSettings");
  ok(body.includes('name === "home"') && body.includes("load();"),
    "home -> load");
  ok(body.includes("suppliersState.loaded") && body.includes("setState.loaded"),
    "first open stays with the ensure-loaders");
  ok(body.includes("3000"), "debounce window present");
});
