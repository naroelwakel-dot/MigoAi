/**
 * اختبارات هجرة 031 (حالة «اتسوّى يدويًا» لأحداث الإيداع — م٤) —
 * `deno test control_events/` من غير أي استيراد خارجي (offline
 * بالكامل). منطق الهجرة SQL خالص (قيد قاعدة)، فالاختبارات بتحرس
 * القواعد على نص الهجرة نفسه — نفس فلسفة migration_022.test.ts:
 * أي تعديل مستقبلي يفكّ قاعدة بيوقّع اختبار هنا قبل الإنتاج.
 */
import MIGRATION from "./migration_031_deposit_manually_settled.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_031_deposit_manually_settled.rollback.sql" with {
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

Deno.test("outcome check is widened with all six original values preserved", () => {
  has(MIGRATION, "'received', 'credited', 'no_matching_intent'",
    "original outcome values kept (1)");
  has(MIGRATION, "'intent_expired', 'invalid_asset', 'invalid_amount'",
    "original outcome values kept (2)");
  has(MIGRATION, "'manually_settled'", "manually_settled added");
  has(MIGRATION, "add constraint wallet_deposit_events_outcome_check",
    "widened constraint carries the known name");
});

Deno.test("the drop is scoped to the outcome check on deposit events only", () => {
  has(MIGRATION, "con.conrelid = 'public.wallet_deposit_events'::regclass",
    "drop is scoped to wallet_deposit_events");
  has(MIGRATION, "con.contype = 'c'", "drop targets check constraints only");
  has(MIGRATION, "pg_get_constraintdef(con.oid) ilike '%no_matching_intent%'",
    "drop matches only the outcome check definition");
  has(MIGRATION, "drop constraint %I", "dropped constraint name comes from the catalog");
});

Deno.test("migration 031 is constraint-only DDL — no other schema change", () => {
  lacks(MIGRATION, "create table", "no new table");
  lacks(MIGRATION, "create or replace function", "no function created");
  lacks(MIGRATION, "create function", "no function created (plain)");
  lacks(MIGRATION, "add column", "no new column");
  lacks(MIGRATION, "insert into", "no data writes");
  lacks(MIGRATION, "update public", "no row updates");
  lacks(MIGRATION, "delete from", "no row deletes");
  // الجدول الوحيد اللي بيتلمّس هو wallet_deposit_events.
  const alters = MIGRATION.toLowerCase().split("alter table").length - 1;
  const depAlters = MIGRATION.split("wallet_deposit_events").length - 1;
  ok(alters >= 1 && depAlters >= alters, "every alter targets deposit events");
});

Deno.test("rollback restores the exact six-value check and guards settled rows", () => {
  has(ROLLBACK, "drop constraint if exists wallet_deposit_events_outcome_check",
    "rollback drops the widened check");
  has(ROLLBACK, "check (outcome in ('received', 'credited', 'no_matching_intent',",
    "rollback restores the original set (1)");
  has(ROLLBACK, "'intent_expired', 'invalid_asset',",
    "rollback restores the original set (2)");
  has(ROLLBACK, "'invalid_amount'))", "rollback check ends at invalid_amount");
  has(ROLLBACK, "outcome = 'manually_settled'",
    "rollback checks for settled rows before narrowing");
  has(ROLLBACK, "manually_settled deposit events exist",
    "rollback refuses to narrow under existing settled rows");
});
