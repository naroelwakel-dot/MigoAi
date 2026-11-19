-- =====================================================================
-- تدريب الحزمة 15 — 04: التنظيف (بيرجّع القاعدة لحالة ما قبل 01)
-- =====================================================================
-- بيشيل كل صفوف التدريب بالمعرّفات الموسومة، ويرجّع الإعدادات
-- الأربعة لقيمها المحفوظة في _drill15_state (أو يحذفها لو مكانتش
-- موجودة أصلًا)، وبيشيل جدول الحالة نفسه. آمن لإعادة التشغيل.
-- =====================================================================

-- التدقيق والمطالبات أولًا (مفاتيح إحالة لطلبات التدريب)
delete from public.order_payment_matches
where order_id in (
  select id from public.orders where order_ref like 'DRILL15-%');

delete from public.order_exchange_claims
where order_id in (
  select id from public.orders where order_ref like 'DRILL15-%');

-- مطالبات المحفظة اللي التدريب عملها/زرعها (حالة 12 + حالة 13)
delete from public.wallet_deposit_claims
where exchange_ref like 'DRILL15-%';

-- أحداث الإيداع والرسائل الوهمية
delete from public.wallet_deposit_events
where exchange_ref like 'DRILL15-%';

delete from public.wallet_sms_events
where dedupe_key like 'drill15-%';

-- شحنة المحفظة الوهمية ومحفظة عميل التدريب (لو اتعملت)
delete from public.wallet_topups
where customer_id = '11111111-1111-4111-8111-111111111111';

delete from public.wallet_transactions
where customer_id = '11111111-1111-4111-8111-111111111111';

delete from public.customer_wallets
where customer_id = '11111111-1111-4111-8111-111111111111';

-- طلبات التدريب نفسها
delete from public.orders
where order_ref like 'DRILL15-%';

-- ترجيع الإعدادات: قيمة محفوظة = ترجيع، غيابها = الصف اتعمل في
-- البذرة وبيتحذف.
do $$
declare
  r record;
  v_keys text[] := array['sms_autocredit_cap_egp',
                         'sms_trusted_min_confirmed',
                         'wallet_app_package',
                         'usdt_egp_rate'];
  v_key text;
  v_old text;
begin
  foreach v_key in array v_keys loop
    select v into v_old from public._drill15_state
    where k = 'setting:' || v_key;
    if v_old is not null then
      update public.wallet_settings set value = v_old where key = v_key;
    else
      delete from public.wallet_settings where key = v_key;
    end if;
  end loop;
end $$;

-- مستخدم التدريب الوهمي وجدول الحالة
delete from auth.users
where id = '11111111-1111-4111-8111-111111111111';

drop table if exists public._drill15_state;

-- تأكيد نهائي: مفيش أي أثر موسوم فاضل.
do $$
begin
  if exists (select 1 from public.orders where order_ref like 'DRILL15-%')
     or exists (select 1 from public.wallet_sms_events where dedupe_key like 'drill15-%')
     or exists (select 1 from public.wallet_deposit_events where exchange_ref like 'DRILL15-%')
     or exists (select 1 from public.wallet_deposit_claims where exchange_ref like 'DRILL15-%')
     or exists (select 1 from public.order_exchange_claims
                where exchange_ref like 'DRILL15-%') then
    raise exception 'DRILL15 CLEANUP FAIL: drill rows remain';
  end if;
  raise notice 'DRILL15 CLEANUP ok: no drill rows remain — compare counts with 00_inspect baseline';
end $$;
