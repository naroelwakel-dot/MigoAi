/**
 * اختبارات هجرة 025 (توسيع كوبونات الموقع) — `deno test
 * control_coupons/` من غير أي استيراد خارجي (offline بالكامل).
 * نفس فلسفة migration_024.test.ts: القواعد بتتحرس على نص الهجرة
 * نفسه لأن التنفيذ في القاعدة بس.
 */
import MIGRATION from "./migration_025_coupons_extended.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_025_coupons_extended.rollback.sql" with {
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

/** جسم دالة من نص SQL (من تعريفها لحد نهاية $function$;). */
function fnBody(sql: string, name: string): string {
  const start = sql.indexOf(`function public.${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const end = sql.indexOf("$function$;", start);
  if (end < 0) throw new Error(`function ${name} unterminated`);
  return sql.slice(start, end);
}

Deno.test("migration 025 adds exactly the four new coupon columns", () => {
  has(MIGRATION, "add column if not exists expires_at timestamptz", "expires_at");
  has(MIGRATION, "add column if not exists max_uses integer", "max_uses");
  has(
    MIGRATION,
    "add column if not exists uses_count integer not null default 0",
    "uses_count",
  );
  has(MIGRATION, "add column if not exists min_order_egp numeric", "min_order_egp");
  has(MIGRATION, "coupons_max_uses_positive", "max_uses check");
  has(MIGRATION, "coupons_uses_count_nonneg", "uses_count check");
  has(MIGRATION, "coupons_min_order_nonneg", "min_order check");
  has(MIGRATION, "coupons_discount_range", "discount range check");
  has(
    MIGRATION,
    "check (discount > 0 and discount <= 1)",
    "discount bounded to a stored fraction in (0, 1]",
  );
  // معنى الخصم موثّق ككسر من الصفوف الحية، مش نقاط مئوية.
  has(MIGRATION, "MIGO15", "live fraction rows cited as source of truth");
  has(MIGRATION, "0.10 = ١٠٪", "fraction meaning documented");
  lacks(MIGRATION, "discount <= 100", "no percent-point bound anywhere");
  lacks(MIGRATION, "discount > 100", "no percent-point guard anywhere");
  lacks(MIGRATION, "لسه نسبة مئوية", "no percent-point storage claim");
  // إضافات بس: مفيش إسقاط ولا تعديل على أعمدة قائمة.
  lacks(MIGRATION, "drop column", "no column drops");
  lacks(MIGRATION, "drop table", "no table drops");
  lacks(MIGRATION, "alter column", "no column alterations");
});

Deno.test("validate_coupon keeps the old contract and respects the new columns", () => {
  has(
    MIGRATION,
    "drop function if exists public.validate_coupon(text);",
    "old signature dropped",
  );
  const body = fnBody(MIGRATION, "validate_coupon");
  has(body, "p_subtotal numeric default null", "defaulted subtotal param");
  has(body, "security definer", "security definer");
  has(body, "upper(code) = upper(trim(p_code))", "same code matching as before");
  has(body, "if r.active is not true then return null", "inactive/null-active refused");
  has(
    body,
    "r.discount <= 0 or r.discount > 1",
    "corrupt discount refused: zero/negative and > 1 (e.g. percent-point 10) never returned raw",
  );
  has(body, "r.expires_at <= now()", "expiry respected");
  has(body, "r.uses_count >= r.max_uses", "max uses respected");
  has(body, "p_subtotal < r.min_order_egp", "min order respected");
  has(
    body,
    "(p_subtotal is null or p_subtotal < r.min_order_egp)",
    "min order fails closed when no subtotal is given",
  );
  has(body, "return r.discount", "still returns the stored discount");
  ok(
    body.indexOf("return r.discount") > body.indexOf("r.min_order_egp"),
    "discount returned only after all checks",
  );
  has(
    MIGRATION,
    "grant execute on function public.validate_coupon(text, numeric)",
    "execute granted on the new signature",
  );
});

Deno.test("usage counter trigger counts from real orders and can never block one", () => {
  const body = fnBody(MIGRATION, "coupons_count_use");
  has(body, "security definer", "counter is security definer");
  has(body, "uses_count = uses_count + 1", "counter increments");
  has(body, "upper(code) = upper(trim(new.coupon))", "matches the order coupon text");
  has(body, "exception", "counter has an exception guard");
  has(body, "return new", "failure still returns the order row");
  has(
    body,
    "raise warning 'coupons_count_use failed",
    "counter failure is logged, never silent",
  );
  has(MIGRATION, "create trigger orders_coupon_count", "trigger created");
  has(MIGRATION, "after insert on public.orders", "trigger on orders insert");
});

Deno.test("rollback 025 restores the pre-025 world", () => {
  has(ROLLBACK, "drop trigger if exists orders_coupon_count", "trigger dropped");
  has(
    ROLLBACK,
    "drop constraint if exists coupons_discount_range",
    "discount range check dropped",
  );
  has(ROLLBACK, "drop function if exists public.coupons_count_use()", "counter dropped");
  has(
    ROLLBACK,
    "drop function if exists public.validate_coupon(text, numeric)",
    "new signature dropped",
  );
  const body = fnBody(ROLLBACK, "validate_coupon");
  has(
    body,
    "select discount from public.coupons",
    "original body restored",
  );
  has(
    body,
    "upper(code) = upper(trim(p_code)) and active = true limit 1",
    "original predicate verbatim",
  );
  lacks(body, "p_subtotal", "no subtotal param after rollback");
  lacks(body, "expires_at", "no new-column checks after rollback");
  has(ROLLBACK, "drop column if exists expires_at", "expires dropped");
  has(ROLLBACK, "drop column if exists max_uses", "max_uses dropped");
  has(ROLLBACK, "drop column if exists uses_count", "uses_count dropped");
  has(ROLLBACK, "drop column if exists min_order_egp", "min_order dropped");
});
