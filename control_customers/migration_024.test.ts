/**
 * اختبارات هجرة 024 (قفل العميل الوهمي في تعديلات محفظة المتجر) —
 * `deno test control_customers/` من غير أي استيراد خارجي (offline
 * بالكامل). نفس فلسفة migration_023.test.ts: القواعد بتتحرس على
 * نص الهجرة نفسه لأن التنفيذ في القاعدة بس.
 */
import MIGRATION from "./migration_024_control_wallet_customer_exists.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_024_control_wallet_customer_exists.rollback.sql" with {
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

/** جسم دالة من نص SQL (من تعريفها لحد نهاية $$;). */
function fnBody(sql: string, name: string): string {
  const start = sql.indexOf(`function public.${name}(`);
  if (start < 0) throw new Error(`function ${name} not found`);
  const end = sql.indexOf("\n$$;", start);
  if (end < 0) throw new Error(`function ${name} unterminated`);
  return sql.slice(start, end);
}

const FN_NAMES = ["wallet_adjust_internal", "wallet_set_balance_internal"];

for (const name of FN_NAMES) {
  Deno.test(`${name} refuses a customer missing from auth.users`, () => {
    const body = fnBody(MIGRATION, name);
    has(body, "security definer", `${name} is security definer`);
    has(body, "from auth.users", `${name} checks auth.users`);
    has(
      body,
      "raise exception 'customer_not_found'",
      `${name} raises customer_not_found`,
    );
    // الفحص لازم يسبق إنشاء صف المحفظة — غير كده العميل الوهمي
    // بياخد صف محفظة حتى لو الحركة اترفضت بعدها.
    ok(
      body.indexOf("raise exception 'customer_not_found'") <
        body.indexOf("insert into public.customer_wallets"),
      `${name} existence check precedes wallet insert`,
    );
    // منطق 023 زي ما هو: حارس تعارض الـ ref لسه موجود.
    has(body, "raise exception 'ref_conflict'", `${name} keeps ref guard`);
  });
}

Deno.test("migration 024 touches only the two adjust functions", () => {
  lacks(
    MIGRATION,
    "wallet_credit_topup_internal",
    "credit path untouched",
  );
  lacks(
    MIGRATION,
    "wallet_reject_topup_internal",
    "reject path untouched",
  );
  has(
    MIGRATION,
    "grant execute on function\n  public.wallet_adjust_internal",
    "adjust grant kept",
  );
  has(
    MIGRATION,
    "grant execute on function\n  public.wallet_set_balance_internal",
    "set grant kept",
  );
});

Deno.test("rollback 024 restores the 023 definitions verbatim", () => {
  lacks(ROLLBACK, "customer_not_found", "rollback has no existence check");
  for (const name of FN_NAMES) {
    const body = fnBody(ROLLBACK, name);
    lacks(body, "auth.users", `${name} rollback body does not read auth.users`);
    has(body, "raise exception 'ref_conflict'", `${name} 023 guard present`);
    has(
      body,
      "insert into public.customer_wallets",
      `${name} 023 wallet insert present`,
    );
  }
});
