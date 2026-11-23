/**
 * اختبارات هجرة 034 (قفل صف الحدث + تسوية مشروطة في
 * order_bind_exchange_event — مراجعة الموقع W11 #1) —
 * `deno test package15_order_autoconfirm/` من غير أي استيراد
 * خارجي. الهجرة SQL خالص، فالاختبارات بتحرس القواعد على النص —
 * نفس فلسفة migration_032. الفكرة: مسار البوت (bot_exchange_claim
 * 018) بيقفل صف الحدث FOR UPDATE وبيسوّي بتحديث محروس بالحالة،
 * ومسار المتجر كان بيقرا الحدث من غير قفل وبيسوّي برقم الصف بس —
 * فسباق متزامن يقدر يستهلك نفس الإيداع مرتين. الاختبارات
 * بتثبّت: قفلين جداد على قراءتي الحدث، التسوية الحاسمة مشروطة
 * بالحالة القابلة للربط، وباقي الجسم مطابق بايتيًا لتعريف 015
 * (المضمّن في ملف التراجع).
 */
import MIGRATION from "./migration_034_bind_event_lock.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_034_bind_event_lock.rollback.sql" with {
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

/** تعريف الدالة من ملف هجرة (من create لحد $$; الختامية). */
function bindDef(sql: string): string {
  const start = sql.indexOf(
    "create or replace function public.order_bind_exchange_event(",
  );
  if (start < 0) throw new Error("bind def not found");
  const endMark = "\n$$;";
  const end = sql.indexOf(endMark, start);
  if (end < 0) throw new Error("bind def unterminated");
  return sql.slice(start, end + endMark.length);
}

const NEW_DEF = bindDef(MIGRATION);
const OLD_DEF = bindDef(ROLLBACK);

Deno.test("034 locks the event row on both lookup paths", () => {
  ok(count(OLD_DEF, "for update") === 2, "015 locks claim + order only");
  ok(count(NEW_DEF, "for update") === 4, "034 adds the two event locks");
  has(
    NEW_DEF,
    "where rail = v_claim.rail and exchange_ref = v_claim.exchange_ref\n  for update;",
    "exchange_ref lookup locked",
  );
  has(
    NEW_DEF,
    "limit 1\n    for update;",
    "tx_hash lookup locked",
  );
  ok(count(NEW_DEF, "-- >>> M1-034") === 1, "exactly one M1-034 block");
});

Deno.test("034 settle is conditional on the bindable state", () => {
  has(
    NEW_DEF,
    "and outcome in ('no_matching_intent', 'intent_expired')",
    "outcome guard",
  );
  has(NEW_DEF, "and claim_id is null", "claim guard");
  has(NEW_DEF, "and matched_bot_topup_id is null", "bot topup guard");
  has(NEW_DEF, "'reason', 'event_not_bindable'", "lost race returns pending");
  lacks(
    NEW_DEF,
    "set outcome = 'credited'\n  where id = v_event.id;",
    "id-only settle gone",
  );
  has(
    OLD_DEF,
    "set outcome = 'credited'\n  where id = v_event.id;",
    "rollback keeps the id-only settle",
  );
});

Deno.test("034 body is 015 verbatim outside the marked changes", () => {
  let stripped = NEW_DEF;
  // إزالة تعليق القفل الافتتاحي
  const noteStart = stripped.indexOf("  -- >>> M1-034 event-row lock");
  const noteEnd = stripped.indexOf("  select * into v_event", noteStart);
  ok(noteStart > 0 && noteEnd > noteStart, "lock note found");
  stripped = stripped.slice(0, noteStart) + stripped.slice(noteEnd);
  // فكّ القفلين
  stripped = stripped.replace(
    "where rail = v_claim.rail and exchange_ref = v_claim.exchange_ref\n  for update;",
    "where rail = v_claim.rail and exchange_ref = v_claim.exchange_ref;",
  );
  stripped = stripped.replace("limit 1\n    for update;", "limit 1;");
  // استبدال التسوية المشروطة بالتسوية الأصلية
  const settleStart = stripped.indexOf(
    "  update public.wallet_deposit_events\n  set outcome = 'credited'",
  );
  const settleEndMark = "(end of changes)";
  const settleEnd = stripped.indexOf(settleEndMark, settleStart) +
    settleEndMark.length + 1;
  ok(settleStart > 0 && settleEnd > settleStart, "settle span found");
  stripped = stripped.slice(0, settleStart) +
    "  update public.wallet_deposit_events\n  set outcome = 'credited'\n  where id = v_event.id;\n" +
    stripped.slice(settleEnd);
  ok(stripped === OLD_DEF, "byte-identical to the 015 definition");
});
