-- =====================================================================
-- هجرة 027: قفل صلاحيات الدوال الداخلية في قاعدة الموقع (م٦-أ)
-- =====================================================================
-- الانحراف الحي اللي بتقفله الهجرة دي (مسح م٦، اتأكد حيًا يوم
-- 2026-11-20 من pg_proc.proacl على قاعدة الإنتاج): خمس دوال
-- داخلية بلا أي فحص داخلي بالتصميم — البوابة في طبقة النداء زي ما
-- ترويسة هجرة 022 نفسها بتقول — وصلاحيتها الحية اتوسّعت برّه نص
-- هجراتها: التنفيذ مفتوح لـ anon وauthenticated رغم إن 022 و020
-- كتبوا service_role بس وسحبوا الكل من public. والمفتاح العام
-- (anon) منشور بالتصميم في واجهة المتجر، فأي زائر يقدر ينادي
-- الدوال دي من PostgREST مباشرة ويعدّل/يضبط رصيد محفظة موقع.
--
-- النداء الشرعي الوحيد للخمسة (مصفوفة النداء×المفتاح الكاملة في
-- M6A-CALLER-KEY-MATRIX.md):
--   - الأربع دوال محفظة: خادم اللوحة (Deno) بمفتاح الخدمة بعد
--     بوابة x-migo-admin — control/customers.ts (اعتماد/رفض/
--     تعديل/ضبط) وcontrol/orders.ts (رجوع إلغاء طلب المحفظة)،
--     والتوصيل في api.ts بمفتاح الخدمة صراحة للعميلين.
--   - ledger_reconcile: كرون money-watchdog بس، عبر Management
--     API (دور postgres) — لا نداء PostgREST أصلًا.
-- فالسحب من anon/authenticated لا يكسر أي مسار شرعي معروف،
-- وبيقرّب الخمسة من نمط internal_coupon_discount السليم
-- ({postgres, service_role} بس).
--
-- النطاق مقصود وضيّق: خمس دوال بس. باقي جرد تنفيذ anon (~57
-- دالة) مصنّف في المصفوفة (واجهة متجر عامة بالتصميم / سكك حية
-- بمفتاح خدمة لسه إثبات نداءاتها عبر الأنظمة مش مكتمل / سطح
-- أدمن قديم محروس / دوال تريغر خاملة المنح) — ممنوع السحب
-- الأعمى: دوال الادعاء/التأكيد ليها نداءات إنتاجية حية وأي سحب
-- غلط بيكسر سكك حزمة 15.
--
-- التحقق بعد التطبيق:
--   select proname, proacl::text from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname in
--     ('wallet_adjust_internal', 'wallet_set_balance_internal',
--      'wallet_credit_topup_internal', 'wallet_reject_topup_internal',
--      'ledger_reconcile');
--   -- المتوقع لكل واحدة: {postgres=X/postgres,
--   --   service_role=X/postgres} — بلا anon وبلا authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- سحب التنفيذ من العام والمجهول والمصادق، وإعادة تأكيد منح الخدمة
-- ---------------------------------------------------------------------
revoke execute on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  from anon, authenticated, public;
grant execute on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  to service_role;

revoke execute on function
  public.wallet_set_balance_internal(uuid, numeric, text, text, text)
  from anon, authenticated, public;
grant execute on function
  public.wallet_set_balance_internal(uuid, numeric, text, text, text)
  to service_role;

revoke execute on function public.wallet_credit_topup_internal(uuid, text)
  from anon, authenticated, public;
grant execute on function public.wallet_credit_topup_internal(uuid, text)
  to service_role;

revoke execute on function public.wallet_reject_topup_internal(uuid, text)
  from anon, authenticated, public;
grant execute on function public.wallet_reject_topup_internal(uuid, text)
  to service_role;

revoke execute on function public.ledger_reconcile()
  from anon, authenticated, public;
grant execute on function public.ledger_reconcile()
  to service_role;

notify pgrst, 'reload schema';
