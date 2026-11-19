-- =====================================================================
-- تدريب الحزمة 15 — 03: تحقق ختامي (قراءة + تأكيدات إجمالية)
-- =====================================================================
-- بيتنفذ بعد 02_cases.sql. بيلخّص حالة كل طلبات التدريب وبيأكد
-- الثوابت الإجمالية: المدفوع هو المقصود بالظبط، ومفيش فلوس
-- محفظة اتحركت في أي حالة.
-- =====================================================================

select order_ref, status, payment
from public.orders
where order_ref like 'DRILL15-%'
order by order_ref;

do $$
declare
  v_paid text[];
  v_new int;
  v_audit int;
  v_tx int;
  v_topup_status text;
begin
  select coalesce(array_agg(order_ref order by order_ref), '{}'::text[])
    into v_paid
  from public.orders
  where order_ref like 'DRILL15-%' and status = 'payment_confirmed';
  if v_paid <> array['DRILL15-O01', 'DRILL15-OX1', 'DRILL15-OX3', 'DRILL15-OX7']::text[] then
    raise exception 'VERIFY FAIL: paid set = %', v_paid;
  end if;

  select count(*) into v_new
  from public.orders
  where order_ref like 'DRILL15-%' and status = 'new';
  if v_new <> 13 then
    raise exception 'VERIFY FAIL: % drill orders still new (expected 13)', v_new;
  end if;

  -- التدقيق: 4 صفوف بالظبط (1 رسائل + 3 منصات)
  select count(*) into v_audit
  from public.order_payment_matches m
  join public.orders o on o.id = m.order_id
  where o.order_ref like 'DRILL15-%';
  if v_audit <> 4 then
    raise exception 'VERIFY FAIL: audit rows = % (expected 4)', v_audit;
  end if;

  -- مفيش أي حركة محفظة لعميل التدريب في أي حالة
  select count(*) into v_tx
  from public.wallet_transactions
  where customer_id = '11111111-1111-4111-8111-111111111111';
  if v_tx <> 0 then
    raise exception 'VERIFY FAIL: % wallet ledger rows for drill customer', v_tx;
  end if;

  -- شحنة حالة 5 لسه معلّقة (اتربطت بالحدث held، ما اتشحنتش)
  select status into v_topup_status
  from public.wallet_topups
  where customer_id = '11111111-1111-4111-8111-111111111111'
    and sender_account = '01001500005';
  if v_topup_status <> 'pending' then
    raise exception 'VERIFY FAIL: drill topup status = %', v_topup_status;
  end if;

  raise notice 'DRILL15 VERIFY ok: paid set exact, 4 audit rows, zero wallet movement';
end $$;
