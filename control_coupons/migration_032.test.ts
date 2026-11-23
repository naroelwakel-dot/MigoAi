/**
 * اختبارات هجرة 032 (إعادة فحص الحد الأدنى للكوبون وقت إنشاء الطلب —
 * مراجعة الموقع W1 #5) — `deno test control_coupons/` من غير أي
 * استيراد خارجي. الهجرة SQL خالص، فالاختبارات بتحرس القواعد على
 * النص — نفس فلسفة migration_028/029. الفحص نفسه خاصية بنائية في
 * النص (استعلام وجودي واحد على صف الكوبون، بيقارن الإجمالي اللي
 * السيرفر حسبه بنفسه بالحد الأدنى)، والاختبارات بتثبّته: كتلة
 * موسومة واحدة بس، مكانها بعد حلّ الخصم وقبل تطبيقه وقبل كتلة
 * الاستهلاك الذرّي، وباقي جسم create_order مطابق بايتيًا لتعريف
 * ما قبل 032 (تعريف هجرة 030 الحي، المضمّن في ملف التراجع).
 */
import MIGRATION from "./migration_032_coupon_min_order_at_order_time.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_032_coupon_min_order_at_order_time.rollback.sql" with {
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
const BLOCK_START = NEW_DEF.indexOf("  -- >>> M7-032");
const BLOCK_END_MARK =
  "-- <<< M7-032 coupon minimum re-check at order time (end of added block)";
const BLOCK_END = NEW_DEF.indexOf(BLOCK_END_MARK) + BLOCK_END_MARK.length;

Deno.test("032 adds exactly one marked block to create_order", () => {
  ok(BLOCK_START > 0, "added block start marker present");
  ok(BLOCK_END > BLOCK_START, "added block end marker present");
  ok(count(NEW_DEF, "-- >>> M7-032") === 1, "exactly one M7-032 block");
  has(
    NEW_DEF,
    "raise exception 'coupon minimum order not met'",
    "minimum error",
  );
});

Deno.test("032 leaves the rest of create_order byte-identical", () => {
  // شيل الكتلة المضافة (من سطر بدايتها لنهاية سطر نهايتها + السطر
  // الجديد اللي بعدها) — الباقي لازم يطابق تعريف ما قبل 032 حرفيًا.
  const stripped = NEW_DEF.slice(0, BLOCK_START) +
    NEW_DEF.slice(BLOCK_END + 1);
  ok(
    stripped === OLD_DEF,
    "create_order outside the added block matches the pre-032 (030) definition",
  );
});

Deno.test("minimum check mirrors validate_coupon's rule on the server total", () => {
  const block = NEW_DEF.slice(BLOCK_START, BLOCK_END);
  has(
    block,
    "where upper(code) = upper(trim(p_coupon))",
    "check matches the order's coupon code (025/028's own rule)",
  );
  has(block, "and min_order_egp is not null", "coupons without a minimum are untouched");
  has(
    block,
    "and total < min_order_egp",
    "compares the server-computed total, never a client number",
  );
  // الحد الأدنى بيظهر في التعريف كله جوّه الكتلة دي بس (مرتين في
  // تعليقها ومرتين في كودها)، وتعريف ما قبل 032 ما كانش بيلمسه أصلًا.
  ok(count(NEW_DEF, "min_order_egp") === 4, "min_order_egp only inside the added block");
  ok(count(OLD_DEF, "min_order_egp") === 0, "pre-032 body never read min_order_egp");
});

Deno.test("minimum check runs after discount resolution, before application and consume", () => {
  const discAt = NEW_DEF.indexOf("disc := public.internal_coupon_discount(p_coupon);");
  const finalAt = NEW_DEF.indexOf("final_total := round(total * (1 - disc), 2);");
  const consumeAt = NEW_DEF.indexOf("-- >>> M6A-028");
  ok(discAt > 0 && discAt < BLOCK_START, "check is after discount resolution");
  ok(BLOCK_END < finalAt, "check is before the discount is applied");
  ok(BLOCK_END < consumeAt, "check is before the atomic consume block");
});

Deno.test("032 touches nothing else: no discount-function redefinition, no grants", () => {
  lacks(
    MIGRATION,
    "FUNCTION public.internal_coupon_discount",
    "internal_coupon_discount stays at its 029 definition",
  );
  lacks(MIGRATION, "grant execute", "no grant changes");
  lacks(MIGRATION, "revoke execute", "no revoke changes");
  has(MIGRATION, "notify pgrst, 'reload schema';", "schema reload notified");
});
