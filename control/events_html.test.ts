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
