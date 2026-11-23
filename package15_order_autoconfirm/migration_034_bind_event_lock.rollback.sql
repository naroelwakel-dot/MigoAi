-- =====================================================================
-- Rollback for migration 034 (bind event lock, W11 #1)
-- =====================================================================
-- DELIBERATE USE ONLY. Restores order_bind_exchange_event to its
-- migration-015 definition verbatim (embedded below). Rolling back
-- re-opens the W11 #1 double-consume window between the store bind
-- path and the bot's bot_exchange_claim.
-- =====================================================================

create or replace function public.order_bind_exchange_event(
  p_claim_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.order_exchange_claims;
  v_event public.wallet_deposit_events;
  v_order public.orders;
  v_rate numeric;
  v_amount_egp numeric(12,2);
begin
  select * into v_claim
  from public.order_exchange_claims
  where id = p_claim_id
  for update;
  if not found then
    raise exception 'order claim not found';
  end if;
  if v_claim.status <> 'pending' then
    return jsonb_build_object(
      'status', v_claim.status, 'claim_id', v_claim.id);
  end if;

  select * into v_order
  from public.orders
  where id = v_claim.order_id
  for update;
  if not found then
    raise exception 'order not found';
  end if;

  -- إعادة استخدام عبر الأسطح ممنوعة: مطالبة محفظة على نفس
  -- (السكة، المرجع) — بأي حالة — بتقفل الباب (مرآة ردّ
  -- wallet_claim_deposit على قيد الفرادة: already_claimed).
  if exists (
    select 1 from public.wallet_deposit_claims c
    where c.rail = v_claim.rail
      and c.exchange_ref = v_claim.exchange_ref
  ) then
    return jsonb_build_object(
      'status', 'already_claimed', 'claim_id', v_claim.id);
  end if;

  -- الحدث بالمرجع الرسمي، وإلا ببصمة المعاملة على السلسلة
  -- (العميل أوقات بيلزق الـ txId — مرآة wallet_claim_deposit:
  -- المطالبة بتتوحّد على المرجع الرسمي).
  select * into v_event
  from public.wallet_deposit_events
  where rail = v_claim.rail and exchange_ref = v_claim.exchange_ref;
  if not found then
    select * into v_event
    from public.wallet_deposit_events
    where rail = v_claim.rail and tx_hash = v_claim.exchange_ref
    order by created_at asc
    limit 1;
    if found then
      begin
        update public.order_exchange_claims
        set exchange_ref = v_event.exchange_ref
        where id = v_claim.id
        returning * into v_claim;
      exception when unique_violation then
        return jsonb_build_object(
          'status', 'already_claimed', 'claim_id', v_claim.id);
      end;
    end if;
  end if;

  if v_event.id is null then
    -- لسه مفيش حدث: المراقب هيوصّله، والحسم بييجي من ضغطة تانية
    -- أو من order_resolve_exchange_claims.
    return jsonb_build_object(
      'status', 'pending', 'claim_id', v_claim.id);
  end if;

  -- الحدث اتشحن قبل كده (نية أو طلب): مفيش حركة تانية.
  if v_event.outcome = 'credited' then
    return jsonb_build_object(
      'status', 'already_credited',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  -- حدث استثناء بنيوي من 011: مش إيداع قابل للربط — المطالبة
  -- بتفضل pending لعين الأدمن (مرآة 014).
  if v_event.outcome = 'invalid_amount' then
    return jsonb_build_object(
      'status', 'pending', 'reason', 'invalid_amount',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  -- أصل غير USDT: المطالبة بتتحسم رفضًا (مرآة 014).
  if v_event.asset is distinct from 'USDT' then
    update public.order_exchange_claims
    set status = 'rejected', resolved_at = now(),
        deposit_event_id = v_event.id
    where id = v_claim.id;
    return jsonb_build_object(
      'status', 'invalid_asset',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  if v_event.outcome not in ('no_matching_intent', 'intent_expired')
     or v_event.claim_id is not null then
    -- claim_id متعلّم = مطالبة محفظة ربطته خلاص (already_claimed)،
    -- وأي حالة تانية غير متوقعة = مش بنخمن (pending للأدمن).
    return jsonb_build_object(
      'status', case when v_event.claim_id is not null
                     then 'already_claimed' else 'pending' end,
      'reason', 'event_not_bindable',
      'claim_id', v_claim.id, 'event_id', v_event.id,
      'outcome', v_event.outcome);
  end if;

  -- التسعير بسعر لحظة الربط الحالي (مرآة مطالبات 014).
  select value::numeric into v_rate
  from public.wallet_settings where key = 'usdt_egp_rate';
  if v_rate is null or v_rate <= 0 then
    return jsonb_build_object(
      'status', 'rate_not_set',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  v_amount_egp := round(v_event.amount_usdt * v_rate, 2);
  if v_amount_egp is null or v_amount_egp <= 0 then
    update public.wallet_deposit_events
    set outcome = 'invalid_amount' where id = v_event.id;
    return jsonb_build_object(
      'status', 'pending', 'reason', 'invalid_amount',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;

  -- قاعدة مبلغ الطلب: الإيداع لازم يغطي إجمالي الطلب بالظبط.
  if v_amount_egp <> v_order.server_total then
    return jsonb_build_object(
      'status', 'pending', 'reason', 'amount_mismatch',
      'claim_id', v_claim.id, 'event_id', v_event.id,
      'amount_egp', v_amount_egp);
  end if;

  if v_order.status = 'payment_confirmed' then
    -- اتأكد من مسار تاني قبل الربط: المطالبة بتتحسم على حالها
    -- والحدث بيضل زي ما هو لمراجعة الأدمن (مش بيتلتهم صامتًا).
    update public.order_exchange_claims
    set status = 'confirmed', resolved_at = now(),
        deposit_event_id = v_event.id
    where id = v_claim.id;
    return jsonb_build_object(
      'status', 'confirmed', 'reason', 'order_already_paid',
      'claim_id', v_claim.id, 'event_id', v_event.id,
      'order_ref', v_order.order_ref);
  end if;
  if v_order.status <> 'new' then
    return jsonb_build_object(
      'status', 'pending', 'reason', 'order_not_payable',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;

  -- الحسم: حدث مستهلَك + طلب مؤكد + تدقيق + مطالبة محسومة،
  -- معاملة واحدة.
  update public.wallet_deposit_events
  set outcome = 'credited'
  where id = v_event.id;

  update public.orders
  set status = 'payment_confirmed'
  where id = v_order.id;

  insert into public.order_payment_matches (order_id, event_id, basis, gate)
  values (v_order.id, v_event.id, 'exchange:' || v_claim.rail, null);

  update public.order_exchange_claims
  set status = 'confirmed', resolved_at = now(),
      deposit_event_id = v_event.id
  where id = v_claim.id;

  return jsonb_build_object(
    'status', 'confirmed',
    'claim_id', v_claim.id,
    'event_id', v_event.id,
    'order_ref', v_order.order_ref,
    'amount_egp', v_amount_egp,
    'amount_usdt', v_event.amount_usdt);
end;
$$;

notify pgrst, 'reload schema';
