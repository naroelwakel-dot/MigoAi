/**
 * اختبارات هجرة 036 (نقل معرّف النية صراحةً إلى
 * wallet_auto_credit_deposit — مراجعة الموقع W9 #2) —
 * `deno test ledger_integrity/` من غير أي استيراد خارجي. الهجرة
 * SQL خالص، فالاختبارات بتحرس القواعد على النص — نفس فلسفة
 * migration_032. ملحوظة الأساس: الدالة دي مش موجودة في أي هجرة
 * في الريبو (اتعرّفت بره النظام)؛ جسم الأساس المضمّن في ملف
 * التراجع هو التعريف الحي المقروء من قاعدة الإنتاج 2026-11-23
 * عبر pg_get_functiondef (md5: ba540e65b5d8a506f44923d740d46676).
 * الفكرة: اعتماد اللوحة كان بيطابق بالمبلغ بس رغم إن اللوحة
 * اتحققت من نية بعينها؛ المعامل السادس بيخلي النية المتحقق
 * منها هي المعتمدة فعليًا — بنفس مساواة السكة/المبلغ، ورفض
 * للنية المتسوّية، وقبول للمنتهية على مسار الاعتماد البشري بس.
 * الاختبارات بتثبّت: تغيير التوقيع DROP+CREATE، الكتلة
 * الموسومة، نطاق رفض الانتهاء، وباقي الجسم مطابق بايتيًا
 * للتعريف الحي.
 */
import MIGRATION from "./migration_036_auto_credit_explicit_intent.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_036_auto_credit_explicit_intent.rollback.sql" with {
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

/** تعريف الدالة من ملف هجرة (من CREATE لحد $function$ الختامية —
 * التعريف الحي بصيغة pg_get_functiondef: الجسم بين زوج $function$). */
function creditDef(sql: string): string {
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.wallet_auto_credit_deposit",
  );
  if (start < 0) throw new Error("credit def not found");
  const open = sql.indexOf("$function$", start);
  const close = sql.indexOf("$function$", open + 1);
  if (open < 0 || close < 0) throw new Error("credit def unterminated");
  return sql.slice(start, close + "$function$".length);
}

const NEW_DEF = creditDef(MIGRATION);
const OLD_DEF = creditDef(ROLLBACK);
const OLD_SIG =
  "(p_rail text, p_exchange_ref text, p_asset text, p_amount_usdt numeric, p_tx_hash text DEFAULT NULL::text)";
const NEW_SIG =
  "(p_rail text, p_exchange_ref text, p_asset text, p_amount_usdt numeric, p_tx_hash text DEFAULT NULL::text, p_intent_id uuid DEFAULT NULL::uuid)";

Deno.test("036 changes the signature via drop + create, ACL re-asserted", () => {
  has(
    MIGRATION,
    "drop function if exists\n  public.wallet_auto_credit_deposit(text, text, text, numeric, text);",
    "5-arg drop",
  );
  has(NEW_DEF, NEW_SIG, "6-arg signature");
  has(OLD_DEF, OLD_SIG, "rollback restores the 5-arg signature");
  lacks(OLD_DEF, "p_intent_id", "rollback body has no intent parameter");
  has(
    MIGRATION,
    "public.wallet_auto_credit_deposit(text, text, text, numeric, text, uuid)",
    "6-arg ACL lines",
  );
  has(MIGRATION, "to anon, authenticated, service_role;", "live ACL shape");
});

Deno.test("036 explicit branch guards rail, status and amount", () => {
  ok(count(NEW_DEF, "-- >>> M1-036") === 1, "exactly one M1-036 block");
  has(NEW_DEF, "'reason', 'intent_not_found'", "missing intent refused");
  has(NEW_DEF, "'reason', 'intent_rail_mismatch'", "rail mismatch refused");
  has(
    NEW_DEF,
    "'reason', 'intent_already_settled'",
    "settled intent refused",
  );
  has(
    NEW_DEF,
    "'reason', 'intent_amount_mismatch'",
    "amount mismatch refused",
  );
  has(
    NEW_DEF,
    "if v_intent.status not in ('open', 'expired') then",
    "open-or-expired acceptance",
  );
  has(
    NEW_DEF,
    "if p_intent_id is null and found and v_intent.expires_at <= now() then",
    "expiry refusal scoped to the automatic path",
  );
});

Deno.test("036 body is the live definition verbatim outside the marks", () => {
  let stripped = NEW_DEF.replace(NEW_SIG, OLD_SIG);
  // استبدال كتلة النية الصريحة باختيار المطابقة الأصلي
  const blockStart = stripped.indexOf("  -- >>> M1-036 explicit intent");
  const blockEndMark = "-- <<< M1-036 explicit intent (end of added block)";
  // +1: سطر نهاية الكتلة بينتهي بنهاية سطر مش موجودة في التعريف الحي.
  const blockEnd = stripped.indexOf(blockEndMark, blockStart) +
    blockEndMark.length + 1;
  ok(blockStart > 0 && blockEnd > blockStart, "explicit block found");
  stripped = stripped.slice(0, blockStart) +
    "  -- المطابقة: نية مفتوحة على نفس السكة بمبلغ فريد مطابق بالحرف.\n" +
    "  select * into v_intent\n" +
    "  from public.wallet_topup_intents\n" +
    "  where rail = p_rail and status = 'open' and unique_amount = p_amount_usdt\n" +
    "  for update;\n" +
    stripped.slice(blockEnd);
  // فكّ نطاق رفض الانتهاء
  const condStart = stripped.indexOf("  -- M1-036: the expiry refusal");
  const condEndMark = "if p_intent_id is null and found and v_intent.expires_at <= now() then";
  const condEnd = stripped.indexOf(condEndMark, condStart) +
    condEndMark.length;
  ok(condStart > 0 && condEnd > condStart, "expiry scope change found");
  stripped = stripped.slice(0, condStart) +
    "  if found and v_intent.expires_at <= now() then" +
    stripped.slice(condEnd);
  ok(stripped === OLD_DEF, "byte-identical to the live definition");
});
