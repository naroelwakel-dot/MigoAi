-- =====================================================================
-- Migration 037: bot_exchange_claim recovery — idempotent re-claim +
-- stale-claim expiry (Instinct audit S12 #5/#5b, STORE half)
-- =====================================================================
-- The hole (bot audit sector 12, item 5 + 5b; site-side follow-up
-- verified 2026-11-23): migration 018's claim marks a deposit event
-- consumed (outcome='credited' + matched_bot_topup_id) and answers
-- EVERY later claim for it with {claimed:false,
-- reason:'already_decided'} — even to the claim's own owner. Two
-- doors lead to the same permanent orphan:
--   (5)  the bot process dies after the claim commits and before
--        its wallet decide runs — compensation (unclaim) only ever
--        runs in-process after a claim whose response arrived;
--   (5b) the claim commits but its HTTP response is lost — the bot
--        retries from the next pass, gets 'already_decided', and
--        (pre-MR!206) treated it as a foreign refusal.
-- The bot-side half is fixed (MR!206: an own-id echo is treated as
-- claimed). The store half owed, and fixed here:
--   1) IDEMPOTENT RE-CLAIM: a repeat claim by the SAME owner for
--      the SAME event returns the original claim outcome
--      (claimed:true + the stored receipt), so the settle proceeds
--      to decide instead of stalling. No bot change is needed: the
--      bot consumes claimed/rail/exchange_ref from the response
--      (wallet/exchange_auto.py _settle) and credits from its own
--      top-up row.
--   2) STALE-CLAIM EXPIRY (TTL 24 hours): a claim that was
--      committed but never settled stops blocking the event after
--      24 hours. The bot's auto pass cycles every 60 seconds and
--      claim -> decide is synchronous inside one pass, so a claim
--      still unsettled after 24h has certainly lost its decide
--      (process death, lost response, dead bot) — 24h is ~1440
--      pass cycles, far beyond any deploy/restart/outage, while
--      leaving an expired event up to 72h of claimable life inside
--      the candidates' 96h horizon.
--
-- Why no other surface can double-credit through the expiry:
-- expiry is LAZY and LOCK-HELD. It is evaluated only inside
-- bot_exchange_claim while holding the event row FOR UPDATE (the
-- same row lock 018 takes and 034 mirrored), and the stale marker
-- is never cleared on its own: release happens only inside the
-- single settle UPDATE of a NEW claim that first re-passes the
-- FULL original battery (cross-surface wallet/order claim checks,
-- claim_id still null, USDT asset, the ±48h window against the
-- NEW top-up's creation time, and the exact amount at the LIVE
-- rate). If any check refuses, nothing is written and the stale
-- claim stands untouched. The stored outcome therefore never
-- returns to a bindable state outside a bot-claim transaction, so
-- the deposit watcher's auto-credit and order_bind_exchange_event
-- (034: settles only while matched_bot_topup_id IS NULL, under
-- the row lock) can never observe the event as consumable while
-- a bot claim exists or is being recovered. Candidates merely
-- LISTS a stale-claimed event again (same payload shape — the
-- bot's amount/window matching needs no change); listing writes
-- nothing.
--
-- Claim receipt: two new columns. bot_claimed_at is written by
-- every claim from 037 on; bot_claim stores the original outcome
-- ({topup_id, amount_egp, rate, recovered_from}) that the
-- idempotent path returns verbatim. PRE-037 CLAIMS: they carry
-- neither column value, and they NEVER expire (bot_claimed_at is
-- null -> the stale test fails closed) — they stay exactly as
-- manual as today. A same-owner idempotent return for such a
-- legacy claim yields amount_egp/rate = null (no receipt was
-- stored); the bot does not consume those fields (see above).
--
-- bot_exchange_unclaim (019) is re-issued with one marked change:
-- it clears the receipt together with the marker, so the claim
-- state triple (matched_bot_topup_id, bot_claimed_at, bot_claim)
-- is always written and cleared atomically.
--
-- CREATE OR REPLACE with unchanged signatures preserves the live
-- ACLs (service_role only, per 018/019); no grant changes are
-- needed or made.
--
-- Rollback: restores the 018 candidates + claim definitions and
-- the 019 unclaim definition verbatim, then drops the two columns
-- (receipts of claims made under 037 are lost; the consumption
-- marker matched_bot_topup_id is untouched, so no event becomes
-- re-consumable by rolling back).
--
-- APPLICATION NOTE (032 pattern): strip the trailing
-- `notify pgrst, 'reload schema';` from the submitted copy — the
-- Management API query endpoint rejects it (42601).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Claim trace: when the bot claimed the event + the original
--    claim outcome (receipt). Pre-037 claims stay null on purpose
--    (see header: they never expire).
-- ---------------------------------------------------------------------
alter table public.wallet_deposit_events
  add column if not exists bot_claimed_at timestamptz,
  add column if not exists bot_claim jsonb;

comment on column public.wallet_deposit_events.bot_claimed_at is
  'هجرة 037: وقت حجز البوت للحدث ده (bot_exchange_claim). فاضي = الحدث مش محجوز للبوت، أو حجز قبل 037 (ما بيتنتهيش أبدًا).';
comment on column public.wallet_deposit_events.bot_claim is
  'هجرة 037: إيصال حجز البوت {topup_id, amount_egp, rate, recovered_from} — نتيجة الحجز الأصلية اللي بترجع في إعادة الحجز الأيدمبوتنت من نفس المالك.';

-- ---------------------------------------------------------------------
-- 2) Candidates: the 018 definition verbatim + the marked M1-037
--    stale-claim branch (a stale bot claim re-enters the pool).
-- ---------------------------------------------------------------------
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
      and e.claim_id is null
      and e.created_at > now() - interval '96 hours'
      and (
        (e.outcome in ('no_matching_intent', 'intent_expired')
         and e.matched_bot_topup_id is null)
        -- >>> M1-037: حجز بوت عتيق (اتسجّل وماتسوّاش وعدّى TTL)
        -- بيرجع لقايمة المرشّحين عشان ممر البوت يعيد محاولته —
        -- الصف نفسه مش بيتفك هنا ولا نتيجته بتتغيّر؛ الحسم كله
        -- عند bot_exchange_claim تحت قفل الصف.
        or (e.outcome = 'credited'
            and e.matched_bot_topup_id is not null
            and e.bot_claimed_at is not null
            and e.bot_claimed_at < now() - interval '24 hours')
        -- <<< M1-037
      )
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

-- ---------------------------------------------------------------------
-- 3) Claim: the 018 definition verbatim + the marked M1-037
--    recovery regions (declare, already_decided replacement, the
--    two stale-aware guards, the receipt-writing settle).
-- ---------------------------------------------------------------------
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
  -- >>> M1-037 claim recovery (S12 #5/#5b, store half)
  v_stale_claim boolean := false;
  -- <<< M1-037
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

  -- >>> M1-037 claim recovery (S12 #5/#5b, store half)
  -- اتحجز للبوت قبل كده. في 018 كان أي حجز قائم = رفض already_decided
  -- حتى لصاحبه نفسه: ردّ حجز ضايع بعد ما الحجز اتسجّل (5b) أو موت
  -- عملية بين الحجز والقرار (5) كان بيعلّق الحدث والطلب للأبد من
  -- غير أي استرداد آلي. حالتين استرداد هنا، والباقي رفض زي ما هو:
  -- (أ) نفس المالك بيطالب بنفس الحدث من جديد: الحجز بتاعه — بنرجّع
  --     نتيجة الحجز الأصلية نفسها من إيصال bot_claim (claimed:true)
  --     فالبوت يكمّل للقرار بدل ما يسيب الطلب معلّقًا على حجز يتيم.
  -- (ب) مالك تاني والحجز عتيق (bot_claimed_at أقدم من TTL ولسه ما
  --     اتسوّاش): بنعلّمه قابلًا للاستبدال وبنكمّل كل فحوص الحجز
  --     الجديد تحت القفل؛ الاستبدال الفعلي ما بيحصلش إلا في تحديث
  --     الحسم لو كل الفحوص عدّت — مفيش حالة «مفكوك» بتتثبّت لوحدها
  --     أبدًا، فمفيش سطح تاني يقدر يشوف الحدث قابلًا للربط في النص.
  --     حجوزات ما قبل 037 (bot_claimed_at فاضية) ما بتتقادمش
  --     أبدًا: بتفضل already_decided ويدوية زي ما هي بالظبط.
  if v_event.matched_bot_topup_id is not null then
    if v_event.matched_bot_topup_id = v_ref then
      return jsonb_build_object(
        'claimed', true,
        'idempotent', true,
        'event_id', v_event.id,
        'rail', v_event.rail,
        'exchange_ref', v_event.exchange_ref,
        'bot_topup_id', v_ref,
        'amount_usdt', v_event.amount_usdt,
        'amount_egp', (v_event.bot_claim ->> 'amount_egp')::numeric,
        'rate', (v_event.bot_claim ->> 'rate')::numeric);
    end if;
    if v_event.bot_claimed_at is null
       or v_event.bot_claimed_at > now() - interval '24 hours' then
      return jsonb_build_object('claimed', false,
                                'reason', 'already_decided',
                                'bot_topup_id', v_event.matched_bot_topup_id);
    end if;
    v_stale_claim := true;
  end if;
  -- <<< M1-037
  -- الحدث اتشحن قبل كده (نية أو مطالبة أو طلب): مفيش حركة تانية.
  if v_event.outcome = 'credited' and not v_stale_claim then -- M1-037: نتيجة 'credited' بتاعة الحجز العتيق نفسه مش استهلاك أجنبي
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
  if (v_event.outcome not in ('no_matching_intent', 'intent_expired')
       and not v_stale_claim) -- M1-037: العتيق نتيجته 'credited' من حجزه نفسه؛ فحص claim_id بيضل مطلق
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
      matched_bot_topup_id = v_ref,
      -- >>> M1-037: طابع الحجز وإيصاله — الإيصال هو اللي بيرجع في
      -- إعادة الحجز الأيدمبوتنت من نفس المالك، والطابع هو أساس
      -- انتهاء الصلاحية. recovered_from بيأرشف صاحب الحجز العتيق
      -- اللي اتستبدل (أو فاضي لحجز جديد).
      bot_claimed_at = now(),
      bot_claim = jsonb_build_object(
        'topup_id', v_ref,
        'amount_egp', v_amount_egp,
        'rate', v_rate,
        'recovered_from', case when v_stale_claim
                               then v_event.matched_bot_topup_id
                               else null end)
      -- <<< M1-037
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

-- ---------------------------------------------------------------------
-- 4) Unclaim: the 019 definition verbatim + the marked M1-037
--    receipt clearing (claim state is a triple, cleared together).
-- ---------------------------------------------------------------------
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
      matched_bot_topup_id = null,
      -- >>> M1-037: حالة الحجز ثلاثية (علامة + طابع + إيصال) —
      -- بتتكتب مع بعض في الحجز وبتتمسح مع بعض في الفك.
      bot_claimed_at = null,
      bot_claim = null
      -- <<< M1-037
  where id = v_event.id;

  return jsonb_build_object('unclaimed', true,
                            'event_id', v_event.id,
                            'bot_topup_id', v_ref);
end;
$$;

notify pgrst, 'reload schema';
