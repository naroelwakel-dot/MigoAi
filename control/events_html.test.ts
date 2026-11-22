// اختبارات عرض حالة شحنة البوت في شاشة الأحداث —
// `deno test control/events_html.test.ts`
// خلفية الإصلاح: statusTxt بترجع HTML جاهز (وسم span مغلّف
// ونصّه متهرّب أصلًا جوّه الدالة)، وبطاقة شحنة البوت في شاشة
// الأحداث كانت بتغلّف نتيجتها بـ esc() مرة تانية، فالوسم كان
// بيظهر كنص حرفي في القائمة (<span class="status-txt st-ok">
// بدل شارة ملوّنة). الإصلاح: الإدراج الخام زي كل مواضع النداء
// التانية في الملف، من غير أي تغيير سلوك تاني.
import html from "../control.html" with { type: "text" };

function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

Deno.test("الأحداث: مفيش تهريب مزدوج لنتيجة statusTxt في أي موضع", () => {
  ok(!html.includes("esc(statusTxt("), "no esc(statusTxt( anywhere");
});

Deno.test("الأحداث: بطاقة شحنة البوت بتدرج حالة statusTxt خام", () => {
  const start = html.indexOf("function botTopupCard(");
  ok(start >= 0, "botTopupCard found");
  const body = html.slice(start, start + 1400);
  ok(
    body.includes('" · " + statusTxt(BOT_TOPUP_STATUS, t.status)'),
    "botTopupCard inserts statusTxt unescaped",
  );
});

Deno.test("الأحداث: شارة «اتسوّى يدويًا» للإيداع المتسوّي يدويًا بس", () => {
  const start = html.indexOf("function storeEventCard(");
  ok(start >= 0, "storeEventCard found");
  const body = html.slice(start, start + 1600);
  ok(
    body.includes('it.outcome === "manually_settled"'),
    "badge gated on the manually_settled outcome",
  );
  ok(body.includes("اتسوّى يدويًا"), "manually settled badge label");
  ok(body.includes("badge ok"), "manually settled badge is the ok badge");
});

Deno.test("الأحداث: زر «تسوية يدوية» على بطاقات الإيداع المعلّقة بس", () => {
  ok(
    html.includes('data-ev-act="settle_manually"'),
    "settle button carries the settle_manually action",
  );
  ok(html.includes("تسوية يدوية"), "settle button label");
});

Deno.test("الأحداث: فعل التسوية بيعدّي على ورقة تأكيد ونص نجاح صريح", () => {
  const start = html.indexOf("function runStoreEventAction(");
  ok(start >= 0, "runStoreEventAction found");
  const body = html.slice(start, start + 4000);
  ok(
    body.includes('action === "settle_manually"'),
    "settle action handled explicitly",
  );
  ok(body.includes("تسوية إيداع يدويًا"), "settle confirmation sheet title");
  ok(
    body.includes("الحدث اتسوّى يدويًا واتقفل — من غير أي شحن."),
    "settle success message states no credit happened",
  );
});

Deno.test("الأحداث: statusTxt نفسها لسه بتهرّب نص الشارة جوّه الوسم", () => {
  const start = html.indexOf("function statusTxt(");
  ok(start >= 0, "statusTxt found");
  const body = html.slice(start, start + 400);
  ok(body.includes("esc(m[0])"), "statusTxt escapes its label");
  ok(
    body.includes("'<span class=\"status-txt '"),
    "statusTxt wraps in status-txt span",
  );
});
