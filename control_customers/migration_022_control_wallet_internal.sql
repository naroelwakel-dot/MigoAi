-- =====================================================================
-- هجرة 022: دوال محفظة داخلية للوحة التحكم (Migo Control — مرحلة م١-أ)
-- =====================================================================
-- اللوحة (خادم Deno بمفتاح الخدمة + بوابة x-migo-admin) محتاجة تنفّذ
-- قرارات شحن وتعديلات رصيد على محفظة الموقع من غير ما تعدّي على
-- بوابة `is_store_admin()` المبنية على جلسة متصفح (auth.uid) — نفس
-- سبب وجود `wallet_credit_topup_internal` الحي أصلًا: نسخة داخلية
-- بلا فحص uid، والبوابة بتتطبق في طبقة النداء. الهجرة دي بتضيف
-- النسختين الداخليتين الناقصتين بس، من غير لمس أي دالة قائمة:
--
--   1) `wallet_reject_topup_internal(uuid, text)` — مرآة حرفية
--      لـ `wallet_admin_reject_topup` (هجرة 009) من غير سطر
--      `is_store_admin()`: قفل صف الطلب، وpending بس اللي بيترفض،
--      وأي حالة تانية بترجع {already} بحالتها — قرار مكرر مستحيل
--      يدوس على قرار أقدم.
--   2) `wallet_adjust_internal(uuid, numeric, text, text, text)` —
--      تعديل رصيد إداري مباشر (إيداع/تعويض/تصحيح) بقيد دفتر واحد:
--      الـ ref هو مفتاح الإيدمبوتنسي (نفس اتفاق الدفتر: ref فريد) —
--      إعادة نفس العملية بترجع {already} من غير قيد تاني ولا حركة
--      رصيد. نتيجة سالبة = استثناء 'insufficient' قبل أي كتابة
--      (مفيش رصيد موقع سالب — نفس قيد customer_wallets نفسه).
--
-- توسيع قيد الأنواع: قيد هجرة 009 على `wallet_transactions.kind`
-- بيقبل ('topup','debit','refund','adjust') بس، وقيود التعديل
-- الإداري لازم تتميّز في الدفتر بنوعها ('admin_deposit' /
-- 'admin_compensation' / 'admin_correction') — فالقيد بيتبني من
-- جديد بنفس المجموعة الأصلية + التلاتة الجداد. أي نوع موجود فعليًا
-- في صفوف الدفتر برّه المجموعة دي بيوقّع التطبيق بصوت عالي وقت
-- إضافة القيد (فشل آمن مسموع، مش كسر صامت).
--
-- الصلاحيات: الدالتين service_role بس (زي باقي الدوال الداخلية) —
-- المتصفح ما بيناديهمش أبدًا؛ النداء الوحيد من خادم اللوحة بعد
-- بوابة الأدمن بتاعته.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) توسيع قيد أنواع دفتر المحفظة (إضافة أنواع التعديل الإداري)
-- ---------------------------------------------------------------------
do $$
declare
  v_con record;
begin
  for v_con in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.wallet_transactions'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format(
      'alter table public.wallet_transactions drop constraint %I',
      v_con.conname);
  end loop;
end $$;

alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('topup', 'debit', 'refund', 'adjust',
                  'admin_deposit', 'admin_compensation',
                  'admin_correction'));

-- ---------------------------------------------------------------------
-- 2) رفض طلب شحن — النسخة الداخلية (مرآة wallet_admin_reject_topup
--    من غير فحص is_store_admin؛ البوابة في طبقة النداء)
-- ---------------------------------------------------------------------
create or replace function public.wallet_reject_topup_internal(
  p_topup_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topup public.wallet_topups;
begin
  select * into v_topup
  from public.wallet_topups
  where id = p_topup_id
  for update;
  if not found then
    raise exception 'topup not found';
  end if;
  if v_topup.status <> 'pending' then
    return jsonb_build_object('already', true, 'status', v_topup.status);
  end if;

  update public.wallet_topups
  set status = 'rejected', decided_at = now(), decision_note = p_note
  where id = v_topup.id;

  return jsonb_build_object('rejected', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 3) تعديل رصيد إداري مباشر — قيد دفتر واحد بـ ref إيدمبوتنسي
--    p_kind: 'deposit' | 'compensation' | 'correction' (بيتخزن في
--    الدفتر 'admin_' || p_kind). p_delta موقّع: موجب = إضافة،
--    سالب = خصم. النتيجة السالبة ممنوعة بنيويًا.
-- ---------------------------------------------------------------------
create or replace function public.wallet_adjust_internal(
  p_customer_id uuid,
  p_delta numeric,
  p_kind text,
  p_ref text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(12,2);
  v_existing public.wallet_transactions;
begin
  if p_customer_id is null then
    raise exception 'customer required';
  end if;
  if p_kind is null
     or p_kind not in ('deposit', 'compensation', 'correction') then
    raise exception 'invalid kind';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid delta';
  end if;
  if p_ref is null or btrim(p_ref) = '' then
    raise exception 'ref required';
  end if;

  insert into public.customer_wallets (customer_id, balance_egp)
  values (p_customer_id, 0)
  on conflict (customer_id) do nothing;

  -- قفل صف المحفظة الأول: كل تعديلات العميل الواحد بتتصفّى هنا،
  -- ففحص الـ ref اللي بعده محمي من أي سباق على نفس العميل.
  select balance_egp into v_balance
  from public.customer_wallets
  where customer_id = p_customer_id
  for update;

  -- إيدمبوتنسي: نفس الـ ref اتنفّذ قبل كده = نفس النتيجة، من غير
  -- قيد تاني ولا حركة رصيد (والقيد الفريد على ref ضمان بنيوي
  -- إضافي: أي إدخال مكرر بيصطدم بيه وبيفشل بصوت عالي).
  select * into v_existing
  from public.wallet_transactions
  where ref = p_ref;
  if found then
    return jsonb_build_object(
      'already', true,
      'balance_after', coalesce(v_balance, 0)
    );
  end if;

  if v_balance + p_delta < 0 then
    raise exception 'insufficient';
  end if;

  update public.customer_wallets
  set balance_egp = balance_egp + p_delta
  where customer_id = p_customer_id
  returning balance_egp into v_balance;

  insert into public.wallet_transactions
    (customer_id, kind, amount_egp, ref, note)
  values
    (p_customer_id, 'admin_' || p_kind, p_delta, p_ref, p_note);

  return jsonb_build_object(
    'adjusted', true,
    'balance_after', v_balance
  );
end;
$$;

-- ---------------------------------------------------------------------
-- الصلاحيات: تنفيذ للخدمة بس (اللوحة بتنادي بمفتاح الخدمة بعد
-- بوابة الأدمن بتاعتها؛ مفيش أي نداء متصفح مباشر).
-- ---------------------------------------------------------------------
revoke all on function public.wallet_reject_topup_internal(uuid, text)
  from public;
revoke all on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  from public;
grant execute on function public.wallet_reject_topup_internal(uuid, text)
  to service_role;
grant execute on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
