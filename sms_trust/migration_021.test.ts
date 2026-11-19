/**
 * اختبارات تحصين رجل «المُرسل الموثوق» (هجرة 021 — إصلاح F-02) —
 * `deno test sms_trust/` من غير أي استيراد خارجي (offline بالكامل).
 *
 * منطق الهجرة SQL خالص (بوابات القاعدة)، فالاختبارات دي بتحرس
 * القواعد الخمس على نص الهجرة نفسه — نفس فلسفة بوابات القاعدة:
 * أي تعديل مستقبلي يفكّ قاعدة منهم (أو يرجّع عدّاد «أي تأكيد»)
 * بيوقع اختبار هنا قبل ما يوصل للإنتاج. أجسام الدوال بتتقطع
 * بعلامات ثابتة، وكل بوابة من التلاتة بتتفحص لوحدها. نصوص
 * الهجرة والتراجع بتتستورد كنص (type: "text") فالمجموعة بتشتغل
 * بـ deno test من غير أي أعلام أذونات.
 */
import MIGRATION from "./migration_021_sms_trusted_leg_hardening.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_021_sms_trusted_leg_hardening.rollback.sql" with {
  type: "text",
};

// مساعدات تأكيد صغيرة (نفس نمط bot_sms / sms_bridge).
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

/** قسم رجل الثقة في بوابة: من عنوانه لآخر الجسم. */
function trustedSection(gateBody: string): string {
  const start = gateBody.indexOf("-- ج)");
  if (start < 0) throw new Error("trusted section marker not found");
  return gateBody.slice(start);
}

/** قسم القناة المزدوجة: من عنوانه لحد رجوعه — لازم يفضل نقي. */
function dualSection(gateBody: string): string {
  const start = gateBody.indexOf("-- ب)");
  const end = gateBody.indexOf("return 'dual_channel'", start);
  if (start < 0 || end < 0) throw new Error("dual section markers not found");
  return gateBody.slice(start, end);
}

interface Parts {
  migration: string;
  rollback: string;
  walletGate: string;
  orderGate: string;
  candidates: string;
  claim: string;
  walletTry: string;
  orderTry: string;
}

const PARTS: Parts = {
  migration: MIGRATION,
  rollback: ROLLBACK,
  walletGate: fnBody(MIGRATION, "wallet_sms_autocredit_gate"),
  orderGate: fnBody(MIGRATION, "order_sms_autocredit_gate"),
  candidates: fnBody(MIGRATION, "bot_sms_candidates"),
  claim: fnBody(MIGRATION, "bot_sms_claim"),
  walletTry: fnBody(MIGRATION, "wallet_sms_try_match"),
  orderTry: fnBody(MIGRATION, "order_sms_try_match"),
};

function sqlTest(name: string, fn: (p: Parts) => void) {
  Deno.test(name, () => fn(PARTS));
}

// ---------------------------------------------------------------------
sqlTest("021: settings seed the trusted cap (200) and daily max (3)", (p) => {
  has(p.migration, "('sms_trusted_cap_egp', '200',", "trusted cap setting");
  has(p.migration, "('sms_trusted_daily_max', '3',", "daily max setting");
  has(p.migration, "on conflict (key) do nothing", "settings idempotent");
  // القراءة الدفاعية: غياب/خربان = الافتراضيات الموثقة نفسها.
  const cap = fnBody(p.migration, "sms_trusted_cap");
  has(cap, "else 200 end", "cap fallback is 200");
  has(cap, "key = 'sms_trusted_cap_egp'", "cap reads its setting");
  const max = fnBody(p.migration, "sms_trusted_daily_max");
  has(max, "else 3 end", "daily max fallback is 3");
  has(max, "key = 'sms_trusted_daily_max'", "max reads its setting");
});

// ---------------------------------------------------------------------
sqlTest("021: trust counts ONLY system-verified credits (manual approvals excluded)", (p) => {
  const counter = fnBody(p.migration, "sms_sender_verified_count");
  // العلامة النظامية: حدث الشحنة شايل أساس بوابة.
  has(counter, "e.autocredit_basis is not null", "verified marker is the gate basis");
  has(counter, "e.matched_topup_id = t.id", "marker binds the firing event");
  has(counter, "t.status = 'credited'", "only credited topups count");
  // البوابات التلاتة بتعدّ بالمساعد نفسه — مفيش عدّاد inline قديم.
  for (const [label, body] of [
    ["wallet gate", p.walletGate],
    ["order gate", p.orderGate],
    ["bot candidates", p.candidates],
  ] as const) {
    has(body, "sms_sender_verified_count(", `${label} uses verified counter`);
    lacks(body, "from public.wallet_topups t\n", `${label} has no raw topup count`);
  }
  // بوابة الشحن بتستبعد الطلب الحالي نفسه من تاريخه (دلالة 016).
  has(p.walletGate, "v_topup.sender_account, v_topup.id)", "wallet gate excludes the current topup");
  // تعليق القاعدة القديمة («بأي مسار تأكيد») برّه أي جسم دالة:
  // مكانه الوحيد المسموح هو ترويسة الهجرة الوصفية.
  const firstCreate = p.migration.indexOf("create or replace function");
  const phraseAt = p.migration.indexOf("بأي مسار تأكيد");
  ok(phraseAt < 0 || phraseAt < firstCreate, "old any-path rule lives in no function body");
});

// ---------------------------------------------------------------------
sqlTest("021: trusted leg uses its own 200 cap in all three gates", (p) => {
  has(trustedSection(p.walletGate), "v_topup.amount_egp <= v_trusted_cap", "wallet trusted cap");
  has(trustedSection(p.orderGate), "v_total <= v_trusted_cap", "order trusted cap");
  has(p.candidates, "p.amount_egp <= v_trusted_cap", "candidates trusted cap");
  // السقف العام بيضل حمولة البوت الخارجية زي ما هي + الجديد جنبها.
  has(p.candidates, "'cap_egp', v_cap", "candidates keep general cap payload");
  has(p.candidates, "'trusted_cap_egp', v_trusted_cap", "candidates expose trusted cap");
});

// ---------------------------------------------------------------------
sqlTest("021: dual-channel leg is untouched by the trusted-leg rules", (p) => {
  for (const [label, body] of [
    ["wallet gate", p.walletGate],
    ["order gate", p.orderGate],
  ] as const) {
    const dual = dualSection(body);
    lacks(dual, "sms_trusted", `${label} dual section has no trusted helpers`);
    lacks(dual, "v_trusted_cap", `${label} dual section has no trusted cap`);
    lacks(dual, "sms_trust_alerts", `${label} dual section writes no alerts`);
    has(dual, "corroborated_by is null", `${label} dual pairing intact`);
    has(dual, "for update", `${label} dual partner lock intact`);
  }
  // ومرآة البوت: أساس القناة المزدوجة بيتحسب قبل رجل الثقة دايمًا.
  ok(
    p.candidates.indexOf("'dual_channel'") <
      p.candidates.indexOf("'trusted_sender'"),
    "candidates decide dual before trusted",
  );
});

// ---------------------------------------------------------------------
sqlTest("021: per-sender daily velocity ceiling (3/day) enforced at the match layer", (p) => {
  const counter = fnBody(p.migration, "sms_trusted_today_count");
  has(counter, "from public.sms_trust_alerts", "velocity counts the central alert ledger");
  has(counter, "Africa/Cairo", "velocity day is Cairo-local");
  has(counter, "a.sender_account = p_sender_account", "velocity is per sender");
  // البوابتان + المرشحون: عدّ اليوم تحت الحد قبل إصدار الأساس.
  has(trustedSection(p.walletGate), "sms_trusted_today_count(v_topup.sender_account)", "wallet gate velocity");
  has(trustedSection(p.walletGate), "< v_daily_max", "wallet gate velocity bound");
  has(trustedSection(p.orderGate), "sms_trusted_today_count(v_event.sender_account)", "order gate velocity");
  has(trustedSection(p.orderGate), "< v_daily_max", "order gate velocity bound");
  has(p.candidates, "sms_trusted_today_count(p.sender_account)", "candidates velocity");
  has(p.candidates, "< v_daily_max", "candidates velocity bound");
  // الحجز (نقطة الالتزام للبوت) بيعيد الفحص ويرفض عند السقف.
  has(p.claim, "sms_trusted_today_count(v_event.sender_account)", "claim re-checks velocity");
  has(p.claim, ">= public.sms_trusted_daily_max()", "claim bound is the daily max");
  has(p.claim, "'trusted_velocity'", "claim refusal reason");
  // والقفل الاستشاري بيسبق العدّ في نقاط الحسم (تسلسل عبر الأسطح).
  for (const [label, body] of [
    ["wallet gate", trustedSection(p.walletGate)],
    ["order gate", trustedSection(p.orderGate)],
    ["bot claim", p.claim],
  ] as const) {
    ok(
      body.indexOf("sms_trusted_velocity_lock(") <
        body.indexOf("sms_trusted_today_count("),
      `${label} locks before counting`,
    );
  }
});

// ---------------------------------------------------------------------
sqlTest("021: every trusted-leg credit writes an owner-visible alert row", (p) => {
  // الجدول: الأسطح التلاتة + حقول التدقيق + RLS مقفولة.
  has(p.migration, "create table if not exists public.sms_trust_alerts", "alerts table");
  has(
    p.migration,
    "check (surface in ('wallet_topup', 'order', 'bot_topup'))",
    "alerts surfaces",
  );
  has(p.migration, "alter table public.sms_trust_alerts enable row level security", "alerts RLS");
  has(p.migration, "revoke all on public.sms_trust_alerts from anon, authenticated", "alerts revoked");
  // أربع مواقع كتابة بالظبط: مطابقة الشحن ×2 + الطلبات + حجز البوت.
  const inserts = p.migration.split("insert into public.sms_trust_alerts").length - 1;
  if (inserts !== 4) throw new Error(`expected 4 alert inserts, found ${inserts}`);
  has(p.walletTry, "values ('wallet_topup', v_topup.sender_account", "wallet alert (ref path)");
  has(p.orderTry, "values ('order', v_event.sender_account", "order alert");
  has(p.claim, "values ('bot_topup', v_event.sender_account", "bot claim alert");
  // كتابة الشحن مشروطة بنجاح القيد الفعلي وبأساس الثقة.
  const guard = "if v_basis = 'trusted_sender'";
  ok(p.walletTry.split(guard).length - 1 === 2, "wallet alerts guarded by trusted basis (x2)");
  has(p.walletTry, "(v_res ->> 'credited')::boolean is true", "wallet alert only on real credit");
  has(p.orderTry, guard, "order alert guarded by trusted basis");
  // القارئ محكوم ببوابة الأدمن زي wallet_sms_recent.
  const reader = fnBody(p.migration, "sms_trust_alerts_recent");
  has(reader, "public.is_store_admin()", "alerts reader is admin-gated");
  has(
    p.migration,
    "grant execute on function public.sms_trust_alerts_recent(int)",
    "alerts reader granted",
  );
});

// ---------------------------------------------------------------------
sqlTest("021: ref equality is required on the trusted leg when the SMS carries a ref", (p) => {
  const wt = trustedSection(p.walletGate);
  has(wt, "v_event.transfer_ref is null", "wallet trusted: ref-less events still allowed");
  has(wt, "v_topup.transfer_ref = v_event.transfer_ref", "wallet trusted: carried ref must match the topup ref");
  // الطلبات: مفيش مرجع طلب يقارن — الحدث الشايل مرجع برّه رجل الثقة.
  const ot = trustedSection(p.orderGate);
  has(ot, "v_event.transfer_ref is null", "order trusted: only ref-less events");
  ok(
    ot.indexOf("v_event.transfer_ref is null") < ot.indexOf("return 'trusted_sender'"),
    "order trusted basis is issued only under the ref-less guard",
  );
  ok(
    wt.indexOf("v_topup.transfer_ref = v_event.transfer_ref") <
      wt.indexOf("return 'trusted_sender'"),
    "wallet trusted basis is issued only under the ref guard",
  );
});

// ---------------------------------------------------------------------
sqlTest("021: internal helpers are not exposed to API roles", (p) => {
  for (const sig of [
    "sms_trusted_cap()",
    "sms_trusted_daily_max()",
    "sms_sender_verified_count(text, uuid)",
    "sms_trusted_today_count(text)",
    "sms_trusted_velocity_lock(text)",
  ]) {
    has(p.migration, `revoke all on function public.${sig} from public`, `helper revoked: ${sig}`);
    lacks(p.migration, `grant execute on function public.${sig}`, `helper never granted: ${sig}`);
  }
});

// ---------------------------------------------------------------------
sqlTest("021: rollback restores the pre-021 bodies and drops the new objects", (p) => {
  has(p.rollback, "بأي مسار تأكيد", "rollback restores the 016 counting rule");
  has(p.rollback, "drop table if exists public.sms_trust_alerts", "rollback drops alerts");
  has(p.rollback, "drop function if exists public.sms_trust_alerts_recent(int)", "rollback drops reader");
  has(p.rollback, "drop function if exists public.sms_sender_verified_count(text, uuid)", "rollback drops helpers");
  has(
    p.rollback,
    "where key in ('sms_trusted_cap_egp', 'sms_trusted_daily_max')",
    "rollback removes the new settings",
  );
  has(p.rollback, "create or replace function public.wallet_sms_autocredit_gate(", "rollback restores wallet gate");
  has(p.rollback, "create or replace function public.order_sms_autocredit_gate(", "rollback restores order gate");
  has(p.rollback, "create or replace function public.bot_sms_claim(", "rollback restores bot claim");
});
