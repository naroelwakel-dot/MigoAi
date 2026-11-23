-- =====================================================================
-- Rollback for migration 036 (explicit intent, W9 #2)
-- =====================================================================
-- DELIBERATE USE ONLY. Drops the 6-argument
-- wallet_auto_credit_deposit and recreates the LIVE 5-argument
-- definition verbatim (read from production 2026-11-23 via
-- pg_get_functiondef; md5 ba540e65b5d8a506f44923d740d46676),
-- with its live ACL. Rolling back re-opens the W9 #2 hole: panel
-- deposit approve goes back to amount-only matching. If the
-- events.ts companion change has landed, revert it FIRST --
-- it would pass an argument this signature does not accept.
-- =====================================================================

drop function if exists
  public.wallet_auto_credit_deposit(text, text, text, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.wallet_auto_credit_deposit(p_rail text, p_exchange_ref text, p_asset text, p_amount_usdt numeric, p_tx_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event public.wallet_deposit_events;
  v_intent public.wallet_topup_intents;
  v_claim public.wallet_deposit_claims;
  v_bind jsonb;
  v_balance numeric(12,2);
begin
  if p_rail is null or p_rail not in ('binance', 'bybit') then
    raise exception 'invalid rail';
  end if;
  if p_exchange_ref is null or btrim(p_exchange_ref) = '' then
    raise exception 'invalid exchange ref';
  end if;

  -- الإيدمبوتنسي أولًا: نفس الحدث اتعالج قبل كده = رجّع نتيجته
  -- من غير أي حركة. القيد الفريد (rail, exchange_ref) هو الحسم.
  insert into public.wallet_deposit_events
    (rail, exchange_ref, asset, amount_usdt, tx_hash)
  values
    (p_rail, btrim(p_exchange_ref), coalesce(p_asset, ''), p_amount_usdt, p_tx_hash)
  on conflict (rail, exchange_ref) do nothing
  returning * into v_event;
  if v_event.id is null then
    select * into v_event
    from public.wallet_deposit_events
    where rail = p_rail and exchange_ref = btrim(p_exchange_ref);
    return jsonb_build_object(
      'already', true,
      'credited', v_event.outcome = 'credited',
      'outcome', v_event.outcome,
      'event_id', v_event.id
    );
  end if;

  -- إعادة تحقق على السيرفر (المراقب بيصفّي أصلًا، بس الـ RPC
  -- ما بتثقش في أي مرسل): أصل غير USDT أو مبلغ غير موجب = حدث
  -- استثناء متسجل، من غير شحن.
  if p_asset is distinct from 'USDT' then
    update public.wallet_deposit_events
    set outcome = 'invalid_asset' where id = v_event.id;
    return jsonb_build_object('credited', false, 'reason', 'invalid_asset',
                              'event_id', v_event.id);
  end if;
  if p_amount_usdt is null or p_amount_usdt <= 0 then
    update public.wallet_deposit_events
    set outcome = 'invalid_amount' where id = v_event.id;
    return jsonb_build_object('credited', false, 'reason', 'invalid_amount',
                              'event_id', v_event.id);
  end if;

  -- المطابقة: نية مفتوحة على نفس السكة بمبلغ فريد مطابق بالحرف.
  select * into v_intent
  from public.wallet_topup_intents
  where rail = p_rail and status = 'open' and unique_amount = p_amount_usdt
  for update;

  if found and v_intent.expires_at <= now() then
    -- النية موجودة بس صلاحيتها خلصت قبل وصول الإيداع: بتتقفل
    -- والحدث استثناء — مفيش شحن تلقائي على نية ميتة.
    update public.wallet_topup_intents
    set status = 'expired' where id = v_intent.id;
    update public.wallet_deposit_events
    set outcome = 'intent_expired', matched_intent_id = v_intent.id
    where id = v_event.id;
    return jsonb_build_object('credited', false, 'reason', 'intent_expired',
                              'event_id', v_event.id,
                              'intent_id', v_intent.id);
  end if;

  if not found then
    -- =============================================================
    -- الحزمة 12 — حارس المطالبات (الإضافة الوحيدة على جسم 011):
    -- قبل ما الحدث يتحسم «لا توجد نية»، لو عليه مطالبة معلّقة
    -- بنفس (السكة، مرجع المنصة) فالمطالبة بتسبق أي نية منتهية
    -- بنفس المبلغ وبتاخد الحدث عبر مسار الربط المشترك. مفيش
    -- مطالبة = سلوك 011 الأصلي بالحرف تحت.
    -- =============================================================
    select * into v_claim
    from public.wallet_deposit_claims
    where rail = p_rail
      and exchange_ref = btrim(p_exchange_ref)
      and status = 'pending'
    for update;
    if found then
      update public.wallet_deposit_events
      set outcome = 'no_matching_intent' where id = v_event.id;
      v_bind := public.wallet_bind_claim_to_event(v_claim.id, v_event.id);
      return jsonb_build_object(
        'credited', (v_bind ->> 'status') = 'credited',
        'reason', case when (v_bind ->> 'status') = 'credited'
                       then 'claim_bound'
                       else coalesce(v_bind ->> 'status', 'claim_pending') end,
        'claim_id', v_claim.id,
        'event_id', v_event.id) || coalesce(v_bind, '{}'::jsonb);
    end if;

    -- مفيش نية مفتوحة بالمبلغ ده. لو فيه نية منتهية بنفس المبلغ
    -- فالحدث «وصل متأخر» مش «مجهول» — بنفرّق بينهم للأدمن.
    select * into v_intent
    from public.wallet_topup_intents
    where rail = p_rail and status = 'expired'
      and unique_amount = p_amount_usdt
    order by created_at desc
    limit 1;
    if found then
      update public.wallet_deposit_events
      set outcome = 'intent_expired', matched_intent_id = v_intent.id
      where id = v_event.id;
      return jsonb_build_object('credited', false, 'reason', 'intent_expired',
                                'event_id', v_event.id,
                                'intent_id', v_intent.id);
    end if;
    update public.wallet_deposit_events
    set outcome = 'no_matching_intent' where id = v_event.id;
    return jsonb_build_object('credited', false, 'reason', 'no_matching_intent',
                              'event_id', v_event.id);
  end if;

  -- الشحن: بمبلغ الجنيه المتفق عليه في النية — مش بإعادة تحويل.
  insert into public.customer_wallets (customer_id, balance_egp)
  values (v_intent.customer_id, 0)
  on conflict (customer_id) do nothing;

  update public.customer_wallets
  set balance_egp = balance_egp + v_intent.amount_egp
  where customer_id = v_intent.customer_id
  returning balance_egp into v_balance;

  insert into public.wallet_transactions
    (customer_id, kind, amount_egp, ref, note)
  values
    (v_intent.customer_id, 'topup', v_intent.amount_egp,
     'deposit:' || p_rail || ':' || btrim(p_exchange_ref),
     'شحن تلقائي — إيداع USDT مؤكد (' ||
       case p_rail when 'binance' then 'Binance' else 'Bybit' end || ')');

  update public.wallet_topup_intents
  set status = 'credited', credited_event_id = v_event.id, credited_at = now()
  where id = v_intent.id;

  update public.wallet_deposit_events
  set outcome = 'credited', matched_intent_id = v_intent.id
  where id = v_event.id;

  return jsonb_build_object(
    'credited', true,
    'customer_id', v_intent.customer_id,
    'amount_egp', v_intent.amount_egp,
    'amount_usdt', p_amount_usdt,
    'intent_id', v_intent.id,
    'event_id', v_event.id,
    'balance_after', v_balance
  );
end;
$function$

revoke all on function
  public.wallet_auto_credit_deposit(text, text, text, numeric, text)
  from public;
grant execute on function
  public.wallet_auto_credit_deposit(text, text, text, numeric, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
