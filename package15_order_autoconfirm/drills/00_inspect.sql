-- =====================================================================
-- تدريب الحزمة 15 — 00: فحص تمهيدي (قراءة فقط)
-- =====================================================================
-- بيتنفذ بعد تطبيق هجرة 015 وقبل البذرة. بيأكد وجود كل كائنات
-- الهجرة وبيطبع خط الأساس (عدّادات الجداول المتأثرة) اللي التنظيف
-- (04) لازم يرجّع القاعدة له. أي نقص = استثناء بيوقف التدريب.
-- =====================================================================

do $$
begin
  -- الجداول والأعمدة
  if to_regclass('public.order_payment_matches') is null then
    raise exception 'DRILL15 ABORT: apply migration 015 first (order_payment_matches missing)';
  end if;
  if to_regclass('public.order_exchange_claims') is null then
    raise exception 'DRILL15 ABORT: apply migration 015 first (order_exchange_claims missing)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallet_sms_events'
      and column_name = 'matched_order_id'
  ) then
    raise exception 'DRILL15 ABORT: wallet_sms_events.matched_order_id missing (migration 015)';
  end if;

  -- الدوال بتوقيعاتها الدقيقة
  if to_regprocedure('public.order_sms_autocredit_gate(bigint, uuid)') is null
     or to_regprocedure('public.order_sms_try_match(uuid)') is null
     or to_regprocedure('public.order_sms_rematch(integer)') is null
     or to_regprocedure('public.order_confirm_payment(text, text)') is null
     or to_regprocedure('public.order_bind_exchange_event(uuid)') is null
     or to_regprocedure('public.order_claim_exchange_payment(text, text, text, text)') is null
     or to_regprocedure('public.order_resolve_exchange_claims(integer)') is null then
    raise exception 'DRILL15 ABORT: one or more package-15 functions missing — apply migration 015';
  end if;

  -- وسيلة Bybit الرسمية موجودة ونشطة (create_order بيتحقق منها)
  if not exists (
    select 1 from public.payment_methods
    where value = '🟡 باي بيت (Bybit Pay)' and active
  ) then
    raise exception 'DRILL15 ABORT: Bybit payment_methods row missing/inactive (migration 015)';
  end if;

  -- مجال حالات الطلبات يعرف الحالة الهدف
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_domain'
      and pg_get_constraintdef(oid) like '%payment_confirmed%'
  ) then
    raise exception 'DRILL15 ABORT: orders_status_domain lacks payment_confirmed';
  end if;

  -- مفيش بقايا تشغيل سابق
  if exists (select 1 from public.orders where order_ref like 'DRILL15-%')
     or exists (select 1 from public.wallet_sms_events where dedupe_key like 'drill15-%')
     or exists (select 1 from public.wallet_deposit_events where exchange_ref like 'DRILL15-%')
     or to_regclass('public._drill15_state') is not null then
    raise exception 'DRILL15 ABORT: leftovers from a previous run — run drills/04_cleanup.sql first';
  end if;

  raise notice 'DRILL15 PREFLIGHT ok: migration 015 objects present, no leftovers';
end $$;

-- خط الأساس: التنظيف لازم يرجّع العدّادات دي زي ما هي.
select
  (select count(*) from public.orders) as orders_rows,
  (select count(*) from public.wallet_sms_events) as sms_events_rows,
  (select count(*) from public.wallet_deposit_events) as deposit_events_rows,
  (select count(*) from public.wallet_deposit_claims) as wallet_claims_rows,
  (select count(*) from public.order_exchange_claims) as order_claims_rows,
  (select count(*) from public.order_payment_matches) as order_matches_rows,
  (select count(*) from public.wallet_topups) as topups_rows;
