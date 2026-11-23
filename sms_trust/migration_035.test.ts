/**
 * اختبارات هجرة 035 (إعادة اشتقاق بوابة الحجز داخل bot_sms_claim —
 * مراجعة الموقع W11 #2) — `deno test sms_trust/` من غير أي
 * استيراد خارجي. الهجرة SQL خالص، فالاختبارات بتحرس القواعد على
 * النص — نفس فلسفة migration_032. الفكرة: الحجز كان بيثق في
 * p_basis اللي المتصل بيبعته: 'dual_channel' من غير شريك كان
 * بيعدي، وأساس فاضي كان بيعدي، وشروط المُرسل الموثوق (قناة
 * رسمية + سقف ثقة + حد أدنى للتاريخ النظامي) كانت عايشة في
 * دالة القراءة bot_sms_candidates بس. الكتلة الجديدة بتشتق كل
 * ده من صف الحدث المقفول نفسه. الاختبارات بتثبّت: كتلة موسومة
 * واحدة مُدخلة، مكانها بعد فحص already_decided وقبل قفل السرعة
 * الموجود، وباقي الجسم مطابق بايتيًا لتعريف 021 (المضمّن في
 * ملف التراجع).
 */
import MIGRATION from "./migration_035_sms_claim_gate_rederive.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_035_sms_claim_gate_rederive.rollback.sql" with {
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
function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** تعريف الدالة من ملف هجرة (من create لحد $$; الختامية). */
function claimDef(sql: string): string {
  const start = sql.indexOf("create or replace function public.bot_sms_claim(");
  if (start < 0) throw new Error("claim def not found");
  const endMark = "\n$$;";
  const end = sql.indexOf(endMark, start);
  if (end < 0) throw new Error("claim def unterminated");
  return sql.slice(start, end + endMark.length);
}

const NEW_DEF = claimDef(MIGRATION);
const OLD_DEF = claimDef(ROLLBACK);
const BLOCK_START = NEW_DEF.indexOf("\n  -- >>> M1-035");
const BLOCK_END_MARK = "-- <<< M1-035 gate re-derivation (end of added block)";
// +1: سطر الكتلة بينتهي بنهاية سطر مش موجودة في تعريف 021 الأصلي.
const BLOCK_END = NEW_DEF.indexOf(BLOCK_END_MARK) + BLOCK_END_MARK.length + 1;
const BLOCK = NEW_DEF.slice(BLOCK_START, BLOCK_END);

Deno.test("035 adds exactly one marked block to bot_sms_claim", () => {
  ok(BLOCK_START > 0, "added block start marker present");
  ok(BLOCK_END > BLOCK_START, "added block end marker present");
  ok(count(NEW_DEF, "-- >>> M1-035") === 1, "exactly one M1-035 block");
});

Deno.test("035 block re-derives every gate the candidates require", () => {
  has(BLOCK, "wallet_app_package_allowed", "app channel gate");
  has(BLOCK, "parsed ->> 'origin', '') = 'official'", "official SMS gate");
  has(BLOCK, "'reason', 'gate_channel'", "channel refusal");
  has(BLOCK, "'reason', 'gate_rail'", "rail refusal");
  has(BLOCK, "'reason', 'basis_required'", "NULL basis refused");
  has(BLOCK, "'reason', 'partner_required'", "partnerless dual refused");
  has(BLOCK, "'reason', 'trusted_gate'", "trusted gate refusal");
  has(BLOCK, "public.sms_trusted_cap()", "trust cap re-checked");
  has(BLOCK, "public.sms_sender_verified_count(", "history re-checked");
  has(BLOCK, "'sms_trusted_min_confirmed'", "configured minimum read");
});

Deno.test("035 block sits after already_decided, before the velocity lock", () => {
  const decidedAt = NEW_DEF.indexOf("'reason', 'already_decided'");
  const velocityAt = NEW_DEF.indexOf("sms_trusted_velocity_lock");
  ok(decidedAt > 0 && decidedAt < BLOCK_START, "after already_decided");
  ok(velocityAt > BLOCK_END, "before the existing velocity lock");
});

Deno.test("035 body is 021 verbatim outside the added block", () => {
  const stripped = NEW_DEF.slice(0, BLOCK_START) + NEW_DEF.slice(BLOCK_END);
  ok(stripped === OLD_DEF, "byte-identical to the 021 definition");
});
