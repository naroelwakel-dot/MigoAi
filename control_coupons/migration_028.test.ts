/**
 * اختبارات هجرة 028 (استهلاك كوبون ذرّي جوه create_order — م٦-أ) —
 * `deno test control_coupons/` من غير أي استيراد خارجي. الهجرة
 * SQL خالص، فالاختبارات بتحرس القواعد على النص — نفس فلسفة
 * migration_022/025. ذرّية الاستهلاك نفسها خاصية بنائية في النص
 * (تحديث شرطي واحد = قفل صف + إعادة فحص تحت READ COMMITTED)،
 * والاختبارات بتثبّتها: جملة واحدة، شرطها فيها، مكانها بعد نجاح
 * الإدخال وبعد مخارج الإعادة، وباقي جسم create_order مطابق
 * بايتيًا لتعريف ما قبل 028 (المضمّن في ملف التراجع). التجربة
 * الحية (كوبون حدّه 1 + محاولتان متزامنتان = استخدام واحد) جزء
 * من قبول م٦-أ عند النشر.
 */
import MIGRATION from "./migration_028_coupon_atomic_consume.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_028_coupon_atomic_consume.rollback.sql" with {
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
const BLOCK_START = NEW_DEF.indexOf("  -- >>> M6A-028");
const BLOCK_END_MARK = "-- <<< M6A-028 atomic coupon consume (end of added block)";
const BLOCK_END = NEW_DEF.indexOf(BLOCK_END_MARK) + BLOCK_END_MARK.length;

Deno.test("028 adds exactly one marked block to create_order", () => {
  ok(BLOCK_START > 0, "added block start marker present");
  ok(BLOCK_END > BLOCK_START, "added block end marker present");
  has(NEW_DEF, "raise exception 'coupon usage limit reached'", "limit error");
});

Deno.test("028 leaves the rest of create_order byte-identical", () => {
  // شيل الكتلة المضافة (من سطر بدايتها لنهاية سطر نهايتها + السطر
  // الجديد اللي بعدها) — الباقي لازم يطابق تعريف ما قبل 028 حرفيًا.
  const stripped = NEW_DEF.slice(0, BLOCK_START) +
    NEW_DEF.slice(BLOCK_END + 1);
  ok(
    stripped === OLD_DEF,
    "create_order outside the added block matches the pre-028 definition",
  );
});

Deno.test("consume is a single conditional update — atomic by construction", () => {
  const block = NEW_DEF.slice(BLOCK_START, BLOCK_END);
  has(block, "update public.coupons", "consume updates coupons");
  has(block, "set uses_count = uses_count + 1", "consume increments");
  has(
    block,
    "and (max_uses is null or uses_count < max_uses);",
    "limit guard inside the same UPDATE statement",
  );
  has(
    block,
    "where upper(code) = upper(trim(p_coupon))",
    "consume matches the order's coupon code (trigger's own rule)",
  );
  // مفيش نمط «اقرأ العدّاد وبعدين حدّث» — العدّاد بيظهر في الكتلة
  // بس، وكل ظهوراته جوّه جملة التحديث الشرطية الواحدة.
  ok(count(NEW_DEF, "uses_count") === 3, "uses_count only inside the update");
  ok(count(OLD_DEF, "uses_count") === 0, "pre-028 body never touched the counter");
  // فشل الشرط = استثناء يلغي المعاملة كلها (والطلب معاها).
  ok(
    block.indexOf("update public.coupons") <
      block.indexOf("if not found then") &&
      block.indexOf("if not found then") <
        block.indexOf("raise exception 'coupon usage limit reached'"),
    "no-row update raises after the update",
  );
});

Deno.test("consume re-validates active and expiry — inside the added block only", () => {
  const block = NEW_DEF.slice(BLOCK_START, BLOCK_END);
  has(block, "and active = true", "consume re-checks the coupon is still active");
  has(
    block,
    "and (expires_at is null or expires_at > now())",
    "consume re-checks the coupon has not expired",
  );
  // الشرطان جوّه نفس جملة التحديث الواحدة، بعد مطابقة الكود وقبل
  // حارس الحد — فيُعاد فحصهما ذرّيًا تحت قفل الصف، وكوبون اتعطّل
  // أو انتهى بعد فحص الخصم الاستشاري يفشل الطلب كله.
  const whereAt = block.indexOf("where upper(code) = upper(trim(p_coupon))");
  ok(
    whereAt < block.indexOf("and active = true") &&
      block.indexOf("and active = true") <
        block.indexOf("and (expires_at is null or expires_at > now())") &&
      block.indexOf("and (expires_at is null or expires_at > now())") <
        block.indexOf("and (max_uses is null or uses_count < max_uses);"),
    "active and expiry sit inside the same UPDATE, before the limit guard",
  );
  // كل شرط بيظهر مرة واحدة بس في التعريف كله — وجوّه الكتلة بس:
  // الباقي مطابق بايتيًا لما قبل 028 (اختبار الهوية فوق)، وتعريف
  // التراجع نفسه مفيهوش أي واحد فيهم أصلًا.
  ok(count(NEW_DEF, "active = true") === 1, "active check appears exactly once");
  ok(
    count(NEW_DEF, "(expires_at is null or expires_at > now())") === 1,
    "expiry check appears exactly once",
  );
  lacks(OLD_DEF, "active = true", "pre-028 body had no consume-time active check");
  lacks(OLD_DEF, "expires_at", "pre-028 body never referenced expires_at");
});

Deno.test("consume runs only after a successful insert — replays never burn a use", () => {
  const insertAt = NEW_DEF.indexOf("returning id into new_id");
  const conflictReturnAt = NEW_DEF.indexOf(
    "'replayed', true",
    NEW_DEF.indexOf("if new_id is null"),
  );
  const finalReturnAt = NEW_DEF.indexOf(
    "return jsonb_build_object('order_id', new_id",
  );
  ok(insertAt > 0 && insertAt < BLOCK_START, "consume is after the insert");
  ok(
    conflictReturnAt > insertAt && conflictReturnAt < BLOCK_START,
    "the ON CONFLICT twin return precedes the consume",
  );
  ok(BLOCK_END < finalReturnAt, "consume precedes the success return");
  // مخرج الإعادة المبكر (نفس المفتاح + نفس البصمة) قبل الاستهلاك:
  const earlyReplayAt = NEW_DEF.indexOf("'replayed', true");
  ok(earlyReplayAt > 0 && earlyReplayAt < BLOCK_START, "early replay precedes consume");
  // والاستهلاك مشروط بوجود كوبون فعلي على الطلب.
  has(
    NEW_DEF.slice(BLOCK_START, BLOCK_END),
    "if nullif(trim(coalesce(p_coupon, '')), '') is not null then",
    "consume only when the order carries a coupon",
  );
});

Deno.test("028 retires the trigger counter in the same migration", () => {
  has(
    MIGRATION,
    "drop trigger if exists orders_coupon_count on public.orders;",
    "trigger dropped",
  );
  has(
    MIGRATION,
    "drop function if exists public.coupons_count_use();",
    "counter function dropped",
  );
  lacks(NEW_DEF, "coupons_count_use", "create_order never calls the old counter");
  has(MIGRATION, "notify pgrst, 'reload schema';", "028 reloads PostgREST");
});

Deno.test("028 rollback restores the trigger counter and its warning contract", () => {
  has(
    ROLLBACK,
    "create trigger orders_coupon_count",
    "rollback recreates the trigger",
  );
  has(
    ROLLBACK,
    "after insert on public.orders",
    "rollback trigger is AFTER INSERT on orders",
  );
  has(
    ROLLBACK,
    "raise warning 'coupons_count_use failed for coupon %: %'",
    "rollback restores the never-silent counter (025 contract)",
  );
  has(
    ROLLBACK,
    "revoke execute on function public.coupons_count_use() from public;",
    "rollback restores the 025 grant posture",
  );
});
