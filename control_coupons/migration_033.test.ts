/**
 * اختبارات هجرة 033 (بقاء محاولات الكوبون الفاشلة بعد create_order —
 * مراجعة الموقع W12 #2) — `deno test control_coupons/` من غير أي
 * استيراد خارجي. الهجرة SQL خالص، فالاختبارات بتحرس القواعد على
 * النص — نفس فلسفة migration_032. الفكرة: internal_coupon_discount
 * بيزرع صف المحاولة في نفس معاملة RPC، ورفع استثناء 'invalid
 * coupon' كان بيرجّع المعاملة كلها فالصف بيموت معاها وعدّاد
 * الخنق (029) مش بيتراكم أبدًا. الإصلاح بيحوّل الرفع لرجوع طبيعي
 * بجسم خطأ — المعاملة بتتلتزم، الصف بيعيش، ومفيش طلب بيتكتب.
 * الاختبارات بتثبّت: تغيير موسوم واحد بس، باقي الجسم مطابق
 * بايتيًا لتعريف 032 (المضمّن في ملف التراجع)، والرجوع موجود
 * والرفع غايب، والمكان بعد حلّ الخصم وقبل فحص الحد الأدنى M7-032.
 */
import MIGRATION from "./migration_033_coupon_attempt_persistence.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_033_coupon_attempt_persistence.rollback.sql" with {
  type: "text",
};

function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}
function has(text: string, needle: string, label: string) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
  }
}
function lacks(text: string, needle: string, label: string) {
  if (text.includes(needle)) {
    throw new Error(`${label}: should not contain ${JSON.stringify(needle)}`);
  }
}
function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** تعريف create_order من ملف هجرة (من CREATE لحد end $function$). */
function orderDef(sql: string): string {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.create_order");
  if (start < 0) throw new Error("create_order def not found");
  const endMark = "end $function$";
  const end = sql.indexOf(endMark, start);
  if (end < 0) throw new Error("create_order def unterminated");
  return sql.slice(start, end + endMark.length);
}

const NEW_DEF = orderDef(MIGRATION);
const OLD_DEF = orderDef(ROLLBACK);
const BLOCK_START = NEW_DEF.indexOf("      -- >>> M1-033");
const BLOCK_END_MARK =
  "-- <<< M1-033 coupon attempt persistence (end of changed block)";
const BLOCK_END = NEW_DEF.indexOf(BLOCK_END_MARK) + BLOCK_END_MARK.length;

Deno.test("033 changes exactly one marked block in create_order", () => {
  ok(BLOCK_START > 0, "changed block start marker present");
  ok(BLOCK_END > BLOCK_START, "changed block end marker present");
  ok(count(NEW_DEF, "-- >>> M1-033") === 1, "exactly one M1-033 block");
  ok(count(NEW_DEF, "-- <<< M1-033") === 1, "exactly one M1-033 end marker");
});

Deno.test("033 returns the error object instead of raising", () => {
  has(
    NEW_DEF,
    "return jsonb_build_object('ok', false, 'error', 'invalid coupon');",
    "error-object return",
  );
  lacks(NEW_DEF, "raise exception 'invalid coupon'", "no raise remains");
  has(OLD_DEF, "raise exception 'invalid coupon'", "rollback keeps the raise");
});

Deno.test("033 body is 032 verbatim outside the marked block", () => {
  const stripped = NEW_DEF.slice(0, BLOCK_START) +
    "      raise exception 'invalid coupon';" +
    NEW_DEF.slice(BLOCK_END);
  ok(stripped === OLD_DEF, "byte-identical to the 032 definition");
});

Deno.test("033 block sits after discount resolution, before M7-032", () => {
  const discAt = NEW_DEF.indexOf("disc := public.internal_coupon_discount");
  const minAt = NEW_DEF.indexOf("-- >>> M7-032");
  ok(discAt > 0 && discAt < BLOCK_START, "after discount resolution");
  ok(minAt > BLOCK_END, "before the M7-032 minimum block");
});
