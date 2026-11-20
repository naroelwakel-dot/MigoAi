/**
 * اختبارات هجرة 026 (محتوى الموقع) — `deno test control_site/`
 * من غير أي استيراد خارجي (offline بالكامل). نفس فلسفة
 * migration_025.test.ts: القواعد بتتحرس على نص الهجرة نفسه
 * لأن التنفيذ في القاعدة بس.
 */
import MIGRATION from "./migration_026_site_content.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_026_site_content.rollback.sql" with {
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

Deno.test("migration 026 creates only the site_content table, locked down", () => {
  has(MIGRATION, "create table if not exists public.site_content", "table");
  has(MIGRATION, "key text primary key", "key pk");
  has(MIGRATION, "value jsonb not null", "value jsonb");
  has(MIGRATION, "updated_at timestamptz not null default now()", "updated_at");
  has(MIGRATION, "alter table public.site_content enable row level security", "rls");
  has(MIGRATION, "revoke all on public.site_content from anon, authenticated", "revoke public");
  has(MIGRATION, "grant all on public.site_content to service_role", "grant service");
  // إضافات بس: مفيش إسقاط ولا تعديل على أي كائن قائم.
  lacks(MIGRATION, "drop table", "no table drops");
  lacks(MIGRATION, "drop column", "no column drops");
  lacks(MIGRATION, "alter table public.coupons", "coupons untouched");
  lacks(MIGRATION, "alter table public.payment_methods", "payment_methods untouched");
});

Deno.test("migration 026 seeds the five keys with today's live values", () => {
  for (const key of ["announcement", "terms", "faq", "sections", "maintenance"]) {
    has(MIGRATION, `('${key}'`, `seed ${key}`);
  }
  has(MIGRATION, "on conflict (key) do nothing", "seeds never overwrite edits");
  // الإعلان معطّل (مفيش شريط على الموقع اليوم) والصيانة مطفية.
  has(MIGRATION, '\'{"enabled": false, "text": "", "url": ""}\'', "announcement off");
  // الأسئلة الستة الحية من الصفحة الرئيسية بالحرف.
  for (const q of [
    "كيف يصلني الشحن؟",
    "هل الاشتراكات والأدوات رسمية؟",
    "ما طرق الدفع المتاحة؟",
    "هل أحتاج مشاركة كلمة مروري؟",
    "هل الأسعار بالجنيه المصري؟",
    "هل يوجد دعم فني؟",
  ]) {
    has(MIGRATION, q, `faq seed: ${q}`);
  }
  // كل أقسام الصفحة الرئيسية العشرة مزروعة ظاهرة.
  for (const id of [
    "sec-ai", "sec-games", "sec-coins", "sec-live", "sec-social",
    "sec-entertainment", "sec-productivity", "sec-vcc", "reviews",
    "sec-faq",
  ]) {
    has(MIGRATION, `"${id}": true`, `section seed ${id}`);
  }
});

Deno.test("rollback 026 drops only site_content", () => {
  has(ROLLBACK, "drop table if exists public.site_content", "rollback drop");
  lacks(ROLLBACK, "coupons", "rollback leaves coupons");
  lacks(ROLLBACK, "payment_methods", "rollback leaves payment_methods");
  ok(ROLLBACK.trim().split("\n").filter((l) => l.includes("drop")).length === 1, "single drop");
});
