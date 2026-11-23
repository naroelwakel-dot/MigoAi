-- =====================================================================
-- Rollback for migration 037: restores the migration 018
-- definitions of bot_exchange_candidates + bot_exchange_claim and
-- the migration 019 definition of bot_exchange_unclaim verbatim,
-- then drops the two receipt columns 037 added. The consumption
-- marker matched_bot_topup_id is untouched, so no event becomes
-- re-consumable by rolling back. (Receipts of claims made under
-- 037 are lost — rollback is an emergency action.)
-- =====================================================================

create or replace function public.bot_exchange_candidates(
  p_limit int default 100
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_rate_raw text;
  v_rate numeric;
  v_events jsonb;
begin
  -- السعر الحي (قراءة دفاعية زي البوابات: قيمة خربانة = لا سعر،
  -- والبوت من غير سعر ما بيقرّرش حاجة).
  select value into v_rate_raw from public.wallet_settings
  where key = 'usdt_egp_rate';
  v_rate := case when v_rate_raw ~ '^\d+(\.\d+)?$'
                 then v_rate_raw::numeric else null end;

  select coalesce(jsonb_agg(jsonb_build_object(
      'event_id', c.id,
      'rail', c.rail,
      'exchange_ref', c.exchange_ref,
      'tx_hash', c.tx_hash,
      'amount_usdt', c.amount_usdt::text,
      'asset', c.asset,
      'created_at', c.created_at
    ) order by c.created_at asc), '[]'::jsonb)
  into v_events
  from (
    select e.*
    from public.wallet_deposit_events e
    where e.asset = 'USDT'
      and e.outcome in ('no_matching_intent', 'intent_expired')
      and e.claim_id is null
      and e.matched_bot_topup_id is null
      and e.created_at > now() - interval '96 hours'
      and not exists (
        select 1 from public.wallet_deposit_claims wc
        where wc.rail = e.rail
          and (wc.exchange_ref = e.exchange_ref
               or (e.tx_hash is not null
                   and wc.exchange_ref = e.tx_hash))
      )
      and not exists (
        select 1 from public.order_exchange_claims oc
        where oc.exchange_ref = e.exchange_ref
           or (e.tx_hash is not null
               and oc.exchange_ref = e.tx_hash)
           or oc.deposit_event_id = e.id
      )
    order by e.created_at asc
    limit v_limit
  ) c;

  return jsonb_build_object(
    'rate', case when v_rate is null then null else v_rate::text end,
    'events', coalesce(v_events, '[]'::jsonb));
end;
$$;

create or replace function public.bot_exchange_claim(
  p_event_id uuid,
  p_bot_topup_id text,
  p_expected_egp numeric,
  p_topup_created_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_deposit_events;
  v_ref text := btrim(coalesce(p_bot_topup_id, ''));
  v_rate_raw text;
  v_rate numeric;
  v_amount_egp numeric(12,2);
begin
  if char_length(v_ref) < 1 or char_length(v_ref) > 64 then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_topup_ref');
  end if;
  if p_expected_egp is null or p_expected_egp <= 0 then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_expected_amount');
  end if;
  if p_topup_created_at is null then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_topup_time');
  end if;

  select * into v_event
  from public.wallet_deposit_events
  where id = p_event_id
  for update;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;

  -- اتحجز للبوت قبل كده (حتى لو القيد عند البوت ما كمّلش: العلامة
  -- هي الاستهلاك، وأي محاولة تانية لنفس الحدث مرفوضة بنيويًا).
  if v_event.matched_bot_topup_id is not null then
    return jsonb_build_object('claimed', false,
                              'reason', 'already_decided',
                              'bot_topup_id', v_event.matched_bot_topup_id);
  end if;
  -- الحدث اتشحن قبل كده (نية أو مطالبة أو طلب): مفيش حركة تانية.
  if v_event.outcome = 'credited' then
    return jsonb_build_object('claimed', false,
                              'reason', 'already_credited',
                              'event_id', v_event.id);
  end if;
  -- حدث استثناء بنيوي من 011: مش إيداع قابل للربط أصلًا.
  if v_event.outcome = 'invalid_amount' then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_amount',
                              'event_id', v_event.id);
  end if;
  -- أصل غير USDT: السكك دي USDT بس — مفيش استهلاك ومفيش قيد.
  if v_event.asset is distinct from 'USDT' then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_asset',
                              'event_id', v_event.id);
  end if;
  if v_event.outcome not in ('no_matching_intent', 'intent_expired')
     or v_event.claim_id is not null then
    -- 'received' العابرة أو حالة غير متوقعة: مش بنخمّن — الطلب
    -- يفضل معلّق والدورة الجاية/الأدمن يحسم.
    return jsonb_build_object('claimed', false,
                              'reason', 'event_not_bindable',
                              'event_id', v_event.id,
                              'outcome', v_event.outcome);
  end if;

  -- استهلاك عابر للأسطح: مطالبة محفظة على نفس (السكة، المرجع) —
  -- بأي حالة — بتقفل الباب (مرآة فحص order_bind_exchange_event).
  if exists (
    select 1 from public.wallet_deposit_claims wc
    where wc.rail = v_event.rail
      and (wc.exchange_ref = v_event.exchange_ref
           or (v_event.tx_hash is not null
               and wc.exchange_ref = v_event.tx_hash))
  ) then
    return jsonb_build_object('claimed', false,
                              'reason', 'already_claimed',
                              'surface', 'wallet_claim',
                              'event_id', v_event.id);
  end if;
  -- ومطالبة طلب شراء على نفس المرجع/البصمة/الحدث بتقفل الباب
  -- بنفس الطريقة (جدولها فريد على exchange_ref لكل الطلبات).
  if exists (
    select 1 from public.order_exchange_claims oc
    where oc.exchange_ref = v_event.exchange_ref
       or (v_event.tx_hash is not null
           and oc.exchange_ref = v_event.tx_hash)
       or oc.deposit_event_id = v_event.id
  ) then
    return jsonb_build_object('claimed', false,
                              'reason', 'already_claimed',
                              'surface', 'order_claim',
                              'event_id', v_event.id);
  end if;

  -- نافذة ±48 ساعة بين تسجيل التحويل وإنشاء الطلب (created_at
  -- هو طابع التسجيل عند المراقب — شوف ترويسة الهجرة).
  if v_event.created_at not between
       p_topup_created_at - interval '48 hours'
       and p_topup_created_at + interval '48 hours' then
    return jsonb_build_object('claimed', false,
                              'reason', 'outside_window',
                              'event_id', v_event.id);
  end if;

  -- التسعير بسعر لحظة الحجز الحالي (مرآة مطالبات 014/015).
  select value into v_rate_raw from public.wallet_settings
  where key = 'usdt_egp_rate';
  v_rate := case when v_rate_raw ~ '^\d+(\.\d+)?$'
                 then v_rate_raw::numeric else null end;
  if v_rate is null or v_rate <= 0 then
    return jsonb_build_object('claimed', false,
                              'reason', 'rate_not_set',
                              'event_id', v_event.id);
  end if;
  v_amount_egp := round(v_event.amount_usdt * v_rate, 2);
  if v_amount_egp is null or v_amount_egp <= 0 then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_amount',
                              'event_id', v_event.id);
  end if;

  -- قاعدة المبلغ: قيمة الإيداع بالجنيه لازم تساوي مبلغ الطلب
  -- المتوقع بالظبط — اختلاف = لا استهلاك ولا قيد (مرآة 015).
  if v_amount_egp <> p_expected_egp then
    return jsonb_build_object('claimed', false,
                              'reason', 'amount_mismatch',
                              'event_id', v_event.id,
                              'amount_egp', v_amount_egp);
  end if;

  -- الحسم: علامة الاستهلاك الموحّدة + علامة البوت، معاملة واحدة.
  update public.wallet_deposit_events
  set outcome = 'credited',
      matched_bot_topup_id = v_ref
  where id = v_event.id;

  return jsonb_build_object(
    'claimed', true,
    'event_id', v_event.id,
    'rail', v_event.rail,
    'exchange_ref', v_event.exchange_ref,
    'bot_topup_id', v_ref,
    'amount_usdt', v_event.amount_usdt,
    'amount_egp', v_amount_egp,
    'rate', v_rate);
end;
$$;

create or replace function public.bot_exchange_unclaim(
  p_event_id uuid,
  p_bot_topup_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_deposit_events;
  v_ref text := btrim(coalesce(p_bot_topup_id, ''));
begin
  if char_length(v_ref) < 1 or char_length(v_ref) > 64 then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'invalid_topup_ref');
  end if;

  select * into v_event
  from public.wallet_deposit_events
  where id = p_event_id
  for update;
  if not found then
    return jsonb_build_object('unclaimed', false, 'reason', 'not_found');
  end if;

  -- الحالة المحجوزة للبوت دي بالحرف بس: credited بعلامة البوت =
  -- الطلب ده (توقيع حجز 018 وحده — أسطح الموقع ما بتكتبش العلامة
  -- دي أبدًا) + مفيش مطالبة استهلاك (claim_id) ظهرت. matched_intent_id
  -- مش جزء من الرفض: حدث intent_expired المحجوز للبوت شايل معرّف
  -- نيته المنتهية من معالجة 011، وهو نفسه مفتاح الاسترجاع تحت.
  if v_event.outcome <> 'credited'
     or v_event.matched_bot_topup_id is distinct from v_ref
     or v_event.claim_id is not null then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'not_bot_claimed',
                              'outcome', v_event.outcome);
  end if;

  -- استهلاك عابر للأسطح ظهر بعد الحجز؟ مطالبة محفظة/طلب على نفس
  -- المرجع/البصمة/الحدث بتقفل باب الفك كمان (مرآة فحوص حجز 018):
  -- الحدث بيتحسم في مساره الجديد، مش بيرجع مرشّح من ورانا.
  if exists (
    select 1 from public.wallet_deposit_claims wc
    where wc.rail = v_event.rail
      and (wc.exchange_ref = v_event.exchange_ref
           or (v_event.tx_hash is not null
               and wc.exchange_ref = v_event.tx_hash))
  ) then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'surface_claim_exists',
                              'surface', 'wallet_claim',
                              'event_id', v_event.id);
  end if;
  if exists (
    select 1 from public.order_exchange_claims oc
    where oc.exchange_ref = v_event.exchange_ref
       or (v_event.tx_hash is not null
           and oc.exchange_ref = v_event.tx_hash)
       or oc.deposit_event_id = v_event.id
  ) then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'surface_claim_exists',
                              'surface', 'order_claim',
                              'event_id', v_event.id);
  end if;

  -- الاسترجاع: علامة البوت بتتشال، والنتيجة بترجع لما قبل الحجز
  -- حتميًا من matched_intent_id (اقتران 011: intent_expired
  -- دايمًا مكتوبة مع معرّف النية المنتهية، وno_matching_intent
  -- دايمًا من غيره) — فالحدث بيرجع مرشّح بنفس حالته الأصلية.
  update public.wallet_deposit_events
  set outcome = case when v_event.matched_intent_id is not null
                     then 'intent_expired' else 'no_matching_intent' end,
      matched_bot_topup_id = null
  where id = v_event.id;

  return jsonb_build_object('unclaimed', true,
                            'event_id', v_event.id,
                            'bot_topup_id', v_ref);
end;
$$;

alter table public.wallet_deposit_events
  drop column if exists bot_claim,
  drop column if exists bot_claimed_at;

notify pgrst, 'reload schema';
