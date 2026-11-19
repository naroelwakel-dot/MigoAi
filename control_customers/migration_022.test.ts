/**
 * اختبارات هجرة 022 (دوال محفظة داخلية للوحة التحكم — م١-أ) —
 * `deno test control_customers/` من غير أي استيراد خارجي (offline
 * بالكامل). منطق الهجرة SQL خالص (بوابات قاعدة)، فالاختبارات بتحرس
 * القواعد على نص الهجرة نفسه — نفس فلسفة migration_021.test.ts:
 * أي تعديل مستقبلي يفكّ قاعدة بيوقّع اختبار هنا قبل الإنتاج.
 * سلوكيات التشغيل نفسها (الرفع عند النزول تحت الصفر، والـ already)
 * بتتثبّت من أجسام الدوال كنص لأنها بتتنفّذ في القاعدة بس.
 */
import MIGRATION from "./migration_022_control_wallet_internal.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_022_control_wallet_internal.rollback.sql" with {
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

Deno.test("reject internal mirrors the admin reject without the uid gate", () => {
  const body = fnBody(MIGRATION, "wallet_reject_topup_internal");
  lacks(body, "is_store_admin", "internal reject has no uid gate");
  has(body, "security definer", "reject is security definer");
  has(body, "for update", "reject locks the topup row");
  has(body, "raise exception 'topup not found'", "reject raises on missing");
  has(body, "v_topup.status <> 'pending'", "reject is pending-only");
  has(body, "'already', true", "reject returns already on decided topups");
  has(body, "status = 'rejected', decided_at = now(), decision_note = p_note",
    "reject writes status + decided_at + note");
  has(body, "'rejected', true", "reject success shape");
});

Deno.test("adjust internal enforces kind, delta, ref and the floor", () => {
  const body = fnBody(MIGRATION, "wallet_adjust_internal");
  lacks(body, "is_store_admin", "internal adjust has no uid gate");
  has(body, "security definer", "adjust is security definer");
  has(body, "p_kind not in ('deposit', 'compensation', 'correction')",
    "adjust whitelists the panel kinds");
  has(body, "raise exception 'invalid kind'", "adjust raises on bad kind");
  has(body, "p_delta = 0", "adjust refuses a zero delta");
  has(body, "raise exception 'invalid delta'", "adjust raises on zero delta");
  has(body, "raise exception 'ref required'", "adjust requires a ref");
  has(body, "raise exception 'insufficient'", "adjust raises under zero");
  // فحص الكفاية لازم يسبق أي تحديث رصيد.
  ok(
    body.indexOf("raise exception 'insufficient'") <
      body.indexOf("set balance_egp = balance_egp + p_delta"),
    "insufficient check precedes the balance update",
  );
  has(body, "'admin_' || p_kind", "ledger kind carries the admin_ prefix");
  has(body, "'adjusted', true", "adjust success shape");
});

Deno.test("adjust internal is idempotent on ref, checked under the wallet lock", () => {
  const body = fnBody(MIGRATION, "wallet_adjust_internal");
  has(body, "where ref = p_ref", "adjust looks the ref up");
  has(body, "'already', true", "adjust returns already on a duplicate ref");
  // قفل صف المحفظة لازم يسبق فحص الـ ref — غير كده سباق نداءين
  // بنفس الـ ref ممكن يعدّي الفحص عند الاتنين.
  ok(
    body.indexOf("for update") < body.indexOf("where ref = p_ref"),
    "wallet row lock precedes the ref check",
  );
});

Deno.test("kind check is widened with the original kinds preserved", () => {
  has(MIGRATION, "'topup', 'debit', 'refund', 'adjust'",
    "original ledger kinds kept");
  has(MIGRATION, "'admin_deposit', 'admin_compensation'",
    "admin deposit/compensation kinds added");
  has(MIGRATION, "'admin_correction'", "admin correction kind added");
  has(MIGRATION, "add constraint wallet_transactions_kind_check",
    "widened constraint is named");
});

Deno.test("both functions are service-role only", () => {
  has(MIGRATION,
    "revoke all on function public.wallet_reject_topup_internal(uuid, text)",
    "reject revoked from public");
  has(MIGRATION,
    "grant execute on function public.wallet_reject_topup_internal(uuid, text)",
    "reject granted");
  has(MIGRATION, "to service_role", "grants target service_role");
  lacks(MIGRATION, "to authenticated", "no browser-role grants");
});

Deno.test("rollback drops both functions and can restore the 009 kinds", () => {
  has(ROLLBACK, "drop function if exists", "rollback drops functions");
  has(ROLLBACK, "wallet_adjust_internal(uuid, numeric, text, text, text)",
    "rollback drops adjust");
  has(ROLLBACK, "wallet_reject_topup_internal(uuid, text)",
    "rollback drops reject");
  has(ROLLBACK, "check (kind in ('topup', 'debit', 'refund', 'adjust'))",
    "rollback restores the original kind set");
  has(ROLLBACK, "admin_* ledger rows exist",
    "rollback refuses to narrow under existing admin rows");
});
