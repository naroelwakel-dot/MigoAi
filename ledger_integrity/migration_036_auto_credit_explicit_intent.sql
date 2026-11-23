-- =====================================================================
-- Migration 036: wallet_auto_credit_deposit explicit intent (W9 #2)
-- =====================================================================
-- The hole (website audit W9, finding #2): the panel's deposit
-- approve flow knows EXACTLY which topup intent the customer
-- declared -- it validates the intent (status open, rail match,
-- unique-amount match) and passes intentId to the backend -- but
-- wallet_auto_credit_deposit had no parameter to receive it. The
-- credit matched by AMOUNT alone, so the validated intent and the
-- credited intent could be two different rows (two open intents
-- sharing a unique amount on one rail, or the declared intent
-- expiring between validation and credit while a same-amount
-- intent took the money).
--
-- Base body: this function exists in NO repo migration (it was
-- defined out of band; migration 020 mentions it in a comment
-- only). The base body embedded in the rollback is the LIVE
-- production definition, read back from the database on
-- 2026-11-23 via pg_get_functiondef (md5 of the canonical text:
-- ba540e65b5d8a506f44923d740d46676). The new body is that text
-- verbatim plus the marked M1-036 changes: a sixth parameter
-- p_intent_id (uuid, default null -- existing 5-argument callers
-- are source-compatible through the named-argument RPC), an
-- explicit-intent branch in the matching section, and the expiry
-- refusal scoped to the automatic path.
--
-- A signature change needs DROP + CREATE (CREATE OR REPLACE
-- cannot add a parameter). DROP removes the live ACL, so it is
-- re-asserted explicitly below in its exact live shape
-- (postgres owner; EXECUTE to anon, authenticated, service_role;
-- nothing to PUBLIC).
--
-- COMPANION (ships only AFTER this migration is applied -- do not
-- land it first; PostgREST would reject the unknown argument and
-- break deposit approve): in control/events.ts,
-- PostgrestControlEventsClient.callAutoCreditDeposit gains
-- `intentId?: string` (already declared on the interface) and
-- forwards it:
--     const { intentId, ...rpcArgs } = args;
--     return this.rpc("wallet_auto_credit_deposit", {
--       ...rpcArgs,
--       ...(intentId ? { p_intent_id: intentId } : {}),
--     });
--
-- Rollback: drops the 6-argument version and recreates the live
-- 5-argument definition verbatim, with its ACL.
--
-- APPLICATION NOTE (032 pattern): strip the trailing
-- `notify pgrst, 'reload schema';` from the submitted copy -- the
-- Management API query endpoint rejects it (42601). The new
-- argument DOES need the schema reload to become visible to
-- PostgREST, so run `notify pgrst, 'reload schema';` as a
-- separate statement after applying.
-- =====================================================================

drop function if exists
  public.wallet_auto_credit_deposit(text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.wallet_auto_credit_deposit(p_rail text, p_exchange_ref text, p_asset text, p_amount_usdt numeric, p_tx_hash text DEFAULT NULL::text, p_intent_id uuid DEFAULT NULL::uuid)
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

  -- >>> M1-036 explicit intent (W9 #2): when the caller names the
  -- intent -- the panel's deposit-approve path has already
  -- validated the customer's declared intent and passes its id --
  -- that exact intent is authoritative, subject to the same
  -- rail/amount equality the amount-match enforces, plus: an
  -- already-settled intent refuses, and an EXPIRED intent may
  -- still be credited on this path only, because the human
  -- approval IS the decision (the automatic watcher path keeps
  -- refusing expired intents exactly as before). With no
  -- p_intent_id the original amount-match below runs unchanged.
  if p_intent_id is not null then
    select * into v_intent
    from public.wallet_topup_intents
    where id = p_intent_id
    for update;
    if not found then
      update public.wallet_deposit_events
      set outcome = 'no_matching_intent' where id = v_event.id;
      return jsonb_build_object('credited', false,
                                'reason', 'intent_not_found',
                                'event_id', v_event.id);
    end if;
    if v_intent.rail <> p_rail then
      update public.wallet_deposit_events
      set outcome = 'no_matching_intent' where id = v_event.id;
      return jsonb_build_object('credited', false,
                                'reason', 'intent_rail_mismatch',
                                'event_id', v_event.id,
                                'intent_id', v_intent.id);
    end if;
    if v_intent.status not in ('open', 'expired') then
      return jsonb_build_object('credited', false,
                                'reason', 'intent_already_settled',
                                'event_id', v_event.id,
                                'intent_id', v_intent.id);
    end if;
    if v_intent.unique_amount <> p_amount_usdt then
      update public.wallet_deposit_events
      set outcome = 'no_matching_intent' where id = v_event.id;
      return jsonb_build_object('credited', false,
                                'reason', 'intent_amount_mismatch',
                                'event_id', v_event.id,
                                'intent_id', v_intent.id);
    end if;
  else
    -- المطابقة: نية مفتوحة على نفس السكة بمبلغ فريد مطابق بالحرف.
    select * into v_intent
    from public.wallet_topup_intents
    where rail = p_rail and status = 'open' and unique_amount = p_amount_usdt
    for update;
  end if;
  -- <<< M1-036 explicit intent (end of added block)

  -- M1-036: the expiry refusal below guards the automatic
  -- amount-match path only; the explicit path already
  -- accepted open-or-expired above, on the approver's word.
  if p_intent_id is null and found and v_intent.expires_at <= now() then
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
  public.wallet_auto_credit_deposit(text, text, text, numeric, text, uuid)
  from public;
grant execute on function
  public.wallet_auto_credit_deposit(text, text, text, numeric, text, uuid)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
