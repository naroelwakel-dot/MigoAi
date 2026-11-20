/**
 * اختبارات هجرة 027 (قفل صلاحيات الدوال الداخلية — م٦-أ) —
 * `deno test control_hardening/` من غير أي استيراد خارجي (offline
 * بالكامل). الهجرة SQL خالص (منح/سحب صلاحيات)، فالاختبارات بتحرس
 * القواعد على نص الهجرة نفسه — نفس فلسفة migration_022.test.ts.
 * سلوك القاعدة نفسه (رفض نداء anon) بيتحقق منه حيًا بعد التطبيق
 * باستعلام الـ ACL الموثّق في ترويسة الهجرة + تجربة النداء
 * بالمفتاح المنشور (قبول م٦-أ) — هنا بنثبّت إن النص بيوصّل لكده:
 * سحب كامل من التلاتة، منح خدمة مؤكد، ونطاق ضيّق بلا سحب أعمى.
 */
import MIGRATION from "./migration_027_internal_grant_lockdown.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_027_internal_grant_lockdown.rollback.sql" with {
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
/** طيّ الفراغات عشان مطابقة الجمل عبر كسرات السطور. */
function flat(text: string): string {
  return text.replace(/\s+/g, " ");
}

const FIVE: [string, string][] = [
  ["wallet_adjust_internal", "(uuid, numeric, text, text, text)"],
  ["wallet_set_balance_internal", "(uuid, numeric, text, text, text)"],
  ["wallet_credit_topup_internal", "(uuid, text)"],
  ["wallet_reject_topup_internal", "(uuid, text)"],
  ["ledger_reconcile", "()"],
];

Deno.test("027 revokes anon+authenticated+public on the internal five", () => {
  const sql = flat(MIGRATION);
  for (const [name, sig] of FIVE) {
    has(
      sql,
      `revoke execute on function public.${name}${sig} from anon, authenticated, public;`,
      `${name} revoked from anon/authenticated/public`,
    );
  }
});

Deno.test("027 re-asserts the service_role grant on the five", () => {
  const sql = flat(MIGRATION);
  for (const [name, sig] of FIVE) {
    has(
      sql,
      `grant execute on function public.${name}${sig} to service_role;`,
      `${name} granted to service_role`,
    );
  }
});

Deno.test("027 touches nothing else — no blind revoke", () => {
  // أي اسم دالة برّه الخمسة في نص الهجرة = تجاوز نطاق الدفعة
  // المصنّفة في المصفوفة (سكك حزمة 15 وواجهة المتجر برّه 027).
  const others = [
    "create_order",
    "validate_coupon",
    "bot_sms_claim",
    "bot_exchange_claim",
    "order_confirm_payment",
    "wallet_ingest_sms",
    "apply_price_floor",
    "get_catalog",
    "get_invoice",
    "submit_review",
    "wallet_admin_credit_topup",
    "wallet_my_balance",
    "wallet_pay_order",
    "refund_order",
  ];
  for (const name of others) {
    lacks(MIGRATION, name, `027 must not touch ${name}`);
  }
  lacks(flat(MIGRATION), "revoke all", "027 revokes execute only, precisely");
  has(MIGRATION, "notify pgrst, 'reload schema';", "027 reloads PostgREST");
});

Deno.test("027 rollback restores the pre-027 ACL on the five", () => {
  const sql = flat(ROLLBACK);
  for (const [name, sig] of FIVE) {
    has(
      sql,
      `grant execute on function public.${name}${sig} to anon, authenticated;`,
      `rollback re-grants ${name} to anon+authenticated`,
    );
  }
  has(ROLLBACK, "notify pgrst, 'reload schema';", "rollback reloads");
});

Deno.test("panel wallet paths unchanged — service key at the RPC hop", async () => {
  // انحدار مسارات اللوحة: النداءات الشرعية الوحيدة للخمسة لسه
  // موجودة في عميلَي اللوحة، والتوصيل لسه بمفتاح الخدمة — يعني
  // السحب ما بيكسرش قرارات اللوحة الأربعة (اعتماد/رفض/تعديل/ضبط)
  // ولا رجوع إلغاء طلب المحفظة.
  const customers = await Deno.readTextFile(
    new URL("../control/customers.ts", import.meta.url),
  );
  const orders = await Deno.readTextFile(
    new URL("../control/orders.ts", import.meta.url),
  );
  const api = await Deno.readTextFile(
    new URL("../api.ts", import.meta.url),
  );
  for (
    const name of [
      "wallet_credit_topup_internal",
      "wallet_reject_topup_internal",
      "wallet_adjust_internal",
      "wallet_set_balance_internal",
    ]
  ) {
    has(customers, `this.rpc("${name}"`, `customers client still calls ${name}`);
  }
  has(
    orders,
    "/rest/v1/rpc/wallet_adjust_internal",
    "orders client still refunds via wallet_adjust_internal",
  );
  ok(
    api.includes("PostgrestControlCustomersClient") &&
      api.includes("PostgrestControlOrdersClient") &&
      api.includes('keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY")'),
    "api.ts still wires both panel clients to the service role key",
  );
});
