/**
 * اختبارات هجرة 023 (إصلاحات مراجعة م١-أ: حارس تعارض الـ ref +
 * «اضبط على» الذرّية) — `deno test control_customers/` من غير أي
 * استيراد خارجي (offline بالكامل). نفس فلسفة migration_022.test.ts:
 * القواعد بتتحرس على نص الهجرة نفسه لأن التنفيذ في القاعدة بس.
 */
import MIGRATION from "./migration_023_control_wallet_set_balance.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_023_control_wallet_set_balance.rollback.sql" with {
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

Deno.test("adjust internal refuses a ref owned by another customer", () => {
  const body = fnBody(MIGRATION, "wallet_adjust_internal");
  lacks(body, "is_store_admin", "internal adjust has no uid gate");
  has(body, "security definer", "adjust is security definer");
  has(body, "where ref = p_ref", "adjust looks the ref up");
  has(body, "v_existing.customer_id <> p_customer_id",
    "adjust compares the ref owner");
  has(body, "raise exception 'ref_conflict'", "adjust raises on conflict");
  // الحارس لازم يسبق رد الـ already — غير كده التعارض بيعدّي كإعادة.
  ok(
    body.indexOf("raise exception 'ref_conflict'") <
      body.indexOf("'already', true"),
    "conflict raise precedes the already return",
  );
  // وباقي ضمانات 022 لسه موجودة: القفل قبل فحص الـ ref، والكفاية
  // قبل تحديث الرصيد.
  ok(
    body.indexOf("for update") < body.indexOf("where ref = p_ref"),
    "wallet row lock precedes the ref check",
  );
  has(body, "raise exception 'insufficient'", "adjust raises under zero");
  ok(
    body.indexOf("raise exception 'insufficient'") <
      body.indexOf("set balance_egp = balance_egp + p_delta"),
    "insufficient check precedes the balance update",
  );
  has(body, "'admin_' || p_kind", "ledger kind carries the admin_ prefix");
});

Deno.test("set balance validates kind, target and ref", () => {
  const body = fnBody(MIGRATION, "wallet_set_balance_internal");
  lacks(body, "is_store_admin", "internal set has no uid gate");
  has(body, "security definer", "set is security definer");
  has(body, "p_kind not in ('deposit', 'compensation', 'correction')",
    "set whitelists the panel kinds");
  has(body, "raise exception 'invalid kind'", "set raises on bad kind");
  has(body, "p_target is null or p_target < 0", "set refuses a bad target");
  has(body, "raise exception 'invalid target'", "set raises on bad target");
  has(body, "raise exception 'ref required'", "set requires a ref");
});

Deno.test("set balance computes the delta inside, under the wallet lock", () => {
  const body = fnBody(MIGRATION, "wallet_set_balance_internal");
  has(body, "v_delta := p_target - v_balance",
    "delta computed from the locked balance");
  // القفل لازم يسبق فحص الـ ref وحساب الفرق — غير كده السباق اللي
  // الهجرة دي بتقضي عليه بيرجع.
  ok(
    body.indexOf("for update") < body.indexOf("where ref = p_ref"),
    "wallet row lock precedes the ref check",
  );
  ok(
    body.indexOf("for update") <
      body.indexOf("v_delta := p_target - v_balance"),
    "wallet row lock precedes the delta computation",
  );
  has(body, "set balance_egp = balance_egp + v_delta",
    "balance moves by the in-rpc delta");
  has(body, "'admin_' || p_kind, v_delta, p_ref, p_note",
    "ledger row carries the signed delta");
  has(body, "v_existing.customer_id <> p_customer_id",
    "set compares the ref owner");
  has(body, "raise exception 'ref_conflict'", "set raises on conflict");
  has(body, "'already', true", "set returns already on a duplicate ref");
  has(body, "'adjusted', v_delta <> 0", "adjusted flag follows the delta");
});

Deno.test("set balance consumes the ref even on a zero delta", () => {
  const body = fnBody(MIGRATION, "wallet_set_balance_internal");
  has(body, "' [set-noop]'", "zero-delta rows are marked as set-noop");
  has(body, "'admin_' || p_kind, 0, p_ref",
    "zero-delta ledger row carries amount 0 and the ref");
});

Deno.test("both functions are service-role only", () => {
  has(MIGRATION,
    "revoke all on function\n  public.wallet_set_balance_internal(uuid, numeric, text, text, text)",
    "set revoked from public");
  has(MIGRATION,
    "grant execute on function\n  public.wallet_set_balance_internal(uuid, numeric, text, text, text)",
    "set granted");
  has(MIGRATION,
    "grant execute on function\n  public.wallet_adjust_internal(uuid, numeric, text, text, text)",
    "adjust re-granted");
  has(MIGRATION, "to service_role", "grants target service_role");
  lacks(MIGRATION, "to authenticated", "no browser-role grants");
});

Deno.test("rollback drops set balance and restores the 022 adjust", () => {
  has(ROLLBACK, "drop function if exists", "rollback drops functions");
  has(ROLLBACK,
    "wallet_set_balance_internal(uuid, numeric, text, text, text)",
    "rollback drops set balance");
  has(ROLLBACK, "function public.wallet_adjust_internal(",
    "rollback recreates adjust");
  lacks(ROLLBACK, "ref_conflict",
    "restored adjust is the 022 body (no conflict guard)");
  has(ROLLBACK, "'already', true", "restored adjust keeps already semantics");
});
