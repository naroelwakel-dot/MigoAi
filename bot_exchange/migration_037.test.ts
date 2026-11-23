/**
 * اختبارات هجرة 037 (استرداد حجز البوت: إعادة حجز أيدمبوتنت +
 * انتهاء الحجز العتيق — النصف التابع للمتجر من S12 #5/#5b) —
 * `deno test bot_exchange/` من غير أي استيراد خارجي. الهجرة SQL
 * خالص، فالاختبارات بتحرس القواعد على النص — نفس فلسفة
 * migration_034/035. الفكرة: حجز 018 كان بيجاوب already_decided
 * حتى على صاحبه، ومفيش طابع زمني للحجز فمفيش انتهاء ولا تسوية —
 * حجز يتيم = حدث مستهلك وطلب معلّق للأبد. الاختبارات بتثبّت:
 * العمودين الجداد، فرع العتيق في المرشّحين، مناطق M1-037 في
 * الحجز (إعلان + استبدال already_decided + حارسين واعيين بالعتيق
 * + تحديث حسم بيكتب الإيصال)، مسح الإيصال في فك الحجز، وإن باقي
 * الأجسام مطابقة بايتيًا لتعريفات 018/019 (المضمّنة في التراجع،
 * والمثبتة هنا ضد ملفات 018/019 نفسها).
 */
import MIGRATION from "./migration_037_bot_exchange_claim_recovery.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_037_bot_exchange_claim_recovery.rollback.sql" with {
  type: "text",
};
import BASE_018 from "./migration_018_bot_exchange_claim.sql" with {
  type: "text",
};
import BASE_019 from "../bot_sms/migration_019_bot_unclaim.sql" with {
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

/** تعريف دالة من ملف هجرة (من create لحد $$; الختامية). */
function defOf(sql: string, fname: string): string {
  const start = sql.indexOf(`create or replace function public.${fname}(`);
  if (start < 0) throw new Error(`def not found: ${fname}`);
  const endMark = "\n$$;";
  const end = sql.indexOf(endMark, start);
  if (end < 0) throw new Error(`def unterminated: ${fname}`);
  return sql.slice(start, end + endMark.length);
}

const NEW_CAND = defOf(MIGRATION, "bot_exchange_candidates");
const NEW_CLAIM = defOf(MIGRATION, "bot_exchange_claim");
const NEW_UNCLAIM = defOf(MIGRATION, "bot_exchange_unclaim");
const OLD_CAND = defOf(ROLLBACK, "bot_exchange_candidates");
const OLD_CLAIM = defOf(ROLLBACK, "bot_exchange_claim");
const OLD_UNCLAIM = defOf(ROLLBACK, "bot_exchange_unclaim");

Deno.test("037 rollback restores the true 018/019 definitions verbatim", () => {
  ok(OLD_CAND === defOf(BASE_018, "bot_exchange_candidates"),
    "rollback candidates == 018");
  ok(OLD_CLAIM === defOf(BASE_018, "bot_exchange_claim"),
    "rollback claim == 018");
  ok(OLD_UNCLAIM === defOf(BASE_019, "bot_exchange_unclaim"),
    "rollback unclaim == 019");
});

Deno.test("037 adds the claim receipt columns; rollback drops them", () => {
  has(MIGRATION, "add column if not exists bot_claimed_at timestamptz",
    "claimed_at column");
  has(MIGRATION, "add column if not exists bot_claim jsonb",
    "receipt column");
  has(ROLLBACK, "drop column if exists bot_claim,", "rollback drops receipt");
  has(ROLLBACK, "drop column if exists bot_claimed_at;",
    "rollback drops timestamp");
});

Deno.test("037 candidates: stale bot claims re-enter the pool, TTL 24h", () => {
  has(NEW_CAND, "e.bot_claimed_at < now() - interval '24 hours'",
    "stale branch reads the claim timestamp");
  has(NEW_CAND, "e.outcome = 'credited'", "stale branch is claim-shaped");
  has(NEW_CAND, "e.matched_bot_topup_id is not null",
    "stale branch requires a bot marker");
  ok(count(MIGRATION, "interval '24 hours'") === 2,
    "TTL literal appears exactly twice (candidates + claim)");
  // فكّ التعديل: استبدال جملة WHERE الجديدة بالأصلية بتاعة 018.
  const whereStart = NEW_CAND.indexOf("    where e.asset = 'USDT'");
  const whereEnd = NEW_CAND.indexOf("\n      and not exists (", whereStart);
  ok(whereStart > 0 && whereEnd > whereStart, "candidates WHERE span found");
  const stripped = NEW_CAND.slice(0, whereStart) +
    "    where e.asset = 'USDT'\n" +
    "      and e.outcome in ('no_matching_intent', 'intent_expired')\n" +
    "      and e.claim_id is null\n" +
    "      and e.matched_bot_topup_id is null\n" +
    "      and e.created_at > now() - interval '96 hours'" +
    NEW_CAND.slice(whereEnd);
  ok(stripped === OLD_CAND, "candidates body is 018 outside the WHERE change");
});

Deno.test("037 claim: same-owner re-claim returns the original outcome", () => {
  has(NEW_CLAIM, "if v_event.matched_bot_topup_id = v_ref then",
    "owner comparison under the row lock");
  has(NEW_CLAIM, "'claimed', true,", "idempotent path claims");
  has(NEW_CLAIM, "'idempotent', true", "idempotent flag");
  has(NEW_CLAIM, "(v_event.bot_claim ->> 'amount_egp')::numeric",
    "original amount returned from the receipt");
  has(NEW_CLAIM, "(v_event.bot_claim ->> 'rate')::numeric",
    "original rate returned from the receipt");
});

Deno.test("037 claim: stale evaluation is fail-closed and lock-held", () => {
  has(NEW_CLAIM, "v_event.bot_claimed_at is null",
    "legacy claims (no timestamp) never expire");
  has(NEW_CLAIM,
    "v_event.bot_claimed_at > now() - interval '24 hours'",
    "fresh foreign claims still refuse already_decided");
  has(NEW_CLAIM, "v_stale_claim := true;", "stale flag set only past the TTL");
  has(NEW_CLAIM,
    "if v_event.outcome = 'credited' and not v_stale_claim then",
    "already_credited guard is stale-aware");
  has(NEW_CLAIM, "and not v_stale_claim)",
    "bindable guard is stale-aware");
  has(NEW_CLAIM, "or v_event.claim_id is not null then",
    "claim_id guard stays absolute");
});

Deno.test("037 claim: settle writes the receipt; nothing else changed", () => {
  has(NEW_CLAIM, "bot_claimed_at = now(),", "settle stamps the claim");
  has(NEW_CLAIM, "'recovered_from', case when v_stale_claim",
    "recovery archives the stale owner");
  let stripped = NEW_CLAIM;
  // R1: شيل إعلان العلم الموسوم.
  const r1 = "  -- >>> M1-037 claim recovery (S12 #5/#5b, store half)\n" +
    "  v_stale_claim boolean := false;\n  -- <<< M1-037\n";
  ok(stripped.includes(r1), "R1 declare block found");
  stripped = stripped.replace(r1, "");
  // R2: استبدال كتلة الاسترداد بكتلة already_decided الأصلية (018).
  const r2Start = stripped.indexOf(
    "  -- >>> M1-037 claim recovery (S12 #5/#5b, store half)");
  const r2EndMark = "  -- <<< M1-037\n";
  const r2End = stripped.indexOf(r2EndMark, r2Start) + r2EndMark.length;
  ok(r2Start > 0 && r2End > r2Start, "R2 recovery block found");
  stripped = stripped.slice(0, r2Start) +
    "  -- اتحجز للبوت قبل كده (حتى لو القيد عند البوت ما كمّلش: العلامة\n" +
    "  -- هي الاستهلاك، وأي محاولة تانية لنفس الحدث مرفوضة بنيويًا).\n" +
    "  if v_event.matched_bot_topup_id is not null then\n" +
    "    return jsonb_build_object('claimed', false,\n" +
    "                              'reason', 'already_decided',\n" +
    "                              'bot_topup_id', v_event.matched_bot_topup_id);\n" +
    "  end if;\n" +
    stripped.slice(r2End);
  // R3 + R4: رجوع الحارسين لصيغة 018.
  stripped = stripped.replace(
    "if v_event.outcome = 'credited' and not v_stale_claim then -- M1-037: نتيجة 'credited' بتاعة الحجز العتيق نفسه مش استهلاك أجنبي",
    "if v_event.outcome = 'credited' then");
  stripped = stripped.replace(
    "  if (v_event.outcome not in ('no_matching_intent', 'intent_expired')\n" +
      "       and not v_stale_claim) -- M1-037: العتيق نتيجته 'credited' من حجزه نفسه؛ فحص claim_id بيضل مطلق\n" +
      "     or v_event.claim_id is not null then",
    "  if v_event.outcome not in ('no_matching_intent', 'intent_expired')\n" +
      "     or v_event.claim_id is not null then");
  // R5: رجوع تحديث الحسم لصيغة 018.
  const r5Start = stripped.indexOf(
    "  update public.wallet_deposit_events\n  set outcome = 'credited',");
  const r5EndMark = "  where id = v_event.id;";
  const r5End = stripped.indexOf(r5EndMark, r5Start) + r5EndMark.length;
  ok(r5Start > 0 && r5End > r5Start, "R5 settle span found");
  stripped = stripped.slice(0, r5Start) +
    "  update public.wallet_deposit_events\n" +
    "  set outcome = 'credited',\n" +
    "      matched_bot_topup_id = v_ref\n" +
    "  where id = v_event.id;" +
    stripped.slice(r5End);
  ok(stripped === OLD_CLAIM, "claim body is 018 verbatim outside M1-037");
});

Deno.test("037 unclaim: receipt cleared together with the marker", () => {
  has(NEW_UNCLAIM, "bot_claimed_at = null,", "unclaim clears the timestamp");
  has(NEW_UNCLAIM, "bot_claim = null", "unclaim clears the receipt");
  const uStart = NEW_UNCLAIM.indexOf(
    "  update public.wallet_deposit_events\n  set outcome = case when");
  const uEndMark = "  where id = v_event.id;";
  const uEnd = NEW_UNCLAIM.indexOf(uEndMark, uStart) + uEndMark.length;
  ok(uStart > 0 && uEnd > uStart, "unclaim update span found");
  const stripped = NEW_UNCLAIM.slice(0, uStart) +
    "  update public.wallet_deposit_events\n" +
    "  set outcome = case when v_event.matched_intent_id is not null\n" +
    "                     then 'intent_expired' else 'no_matching_intent' end,\n" +
    "      matched_bot_topup_id = null\n" +
    "  where id = v_event.id;" +
    NEW_UNCLAIM.slice(uEnd);
  ok(stripped === OLD_UNCLAIM, "unclaim body is 019 verbatim outside M1-037");
  lacks(NEW_UNCLAIM, "bot_sms_unclaim", "SMS unclaim untouched by 037");
});
