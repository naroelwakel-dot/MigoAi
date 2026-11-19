-- =====================================================================
-- هجرة 018: شحن محفظة البوت التلقائي من إيداعات المنصات — Bot Exchange Claim
-- =====================================================================
-- قرار المالك (2026-11-19): «بايبت وباينانس لازم يكونوا اتوماتيك في
-- بوت — دول معاك API» — شحنات الموقع من المنصات بتتقيّد تلقائيًا من
-- نفس أحداث الإيداع (الحزم 10/12/15)، وشحنات البوت على نفس السكك
-- فضلت يدوية. الهجرة دي بتفتح لأحداث الإيداع سطح استهلاك رابع —
-- طلبات شحن البوت — بنفس انضباط الأسطح القائمة (نية محفظة / مطالبة
-- محفظة / مطالبة طلب شراء)، ومن غير أي منطق فلوس جديد هنا: القيد
-- نفسه بيحصل في البوت بمسار قرار محفظته القائم، ودور القاعدة هنا
-- حاجتين بس:
--
--   1) `bot_exchange_candidates`: قراءة مرشّحين — أحداث إيداع USDT
--      في حالة قابلة للربط (`no_matching_intent`/`intent_expired`
--      بنفس تعريف 014/015) ولسه ما اتستهلكتش في أي سطح: لا نية
--      اتشحنت، ولا مطالبة محفظة بأي حالة، ولا مطالبة طلب شراء
--      بأي حالة، ولا حجز بوت سابق — مع السعر الحي
--      (`usdt_egp_rate`) عشان البوت يحسب المطابقة بنفس القاعدة.
--   2) `bot_exchange_claim`: حجز ذرّي — بيقفل صف الحدث وبيعيد
--      التحقق من كل شرط تحت القفل (قابلية الربط، غياب المطالبات
--      على المرجع/البصمة، الأصل USDT، نافذة ±48 ساعة بين تسجيل
--      التحويل وإنشاء الطلب، و`round(amount_usdt × السعر الحي، 2)`
--      = مبلغ الطلب المتوقع بالجنيه بالظبط)، وبيعلّمه `credited`
--      + `matched_bot_topup_id` — نفس علامة الاستهلاك اللي كل
--      الأسطح بتحترمها. حجز فشل = البوت ما بيقيّدش، نقطة — فإيداع
--      واحد مستحيل يقيّد رصيدين عبر الأسطح الأربعة مهما تزامنت
--      الحلقات.
--
-- ملاحظات مقصودة:
--   • وقت التحويل: أحداث الإيداع ما بتحملش طابع المنصة الزمني —
--     `created_at` هو وقت تسجيل المراقب للحدث (دورة 60 ثانية من
--     قراءة موقّعة نافذتها 30 يوم)، فالنافذة بتتقاس عليه في
--     المطابقة والحجز سوا. الاتجاه آمن: تسجيل متأخر (توقف مراقب)
--     بيضيّق النافذة وبيسيب الطلب للأدمن، مش بيوسّعها أبدًا.
--   • مطالبة بأي حالة بتقفل الباب (مرآة فحص
--     `order_bind_exchange_event` لمطالبات المحفظة): المطالبة
--     المعلّقة عند الموقع ممكن تتحسم في أي لحظة، فالبوت ما
--     يزاحمهاش على نفس الإيداع — والسباق المعاكس محسوم بعلامة
--     `credited` اللي مسارات الربط بترجع بيها `already_credited`.
--   • البصمة (`tx_hash`) مفتاح مطالبات بديل عند الموقع (العميل
--     أوقات بيلصق الـ txId)، ففحوص المطالبات بتشملها في الاتجاهين
--     عشان الاستهلاك يبقى بمفتاح موحّد زي مسارات 014/015.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) علامة استهلاك البوت: معرّف طلب شحن البوت (UUID كنص) اللي حجز
--    الحدث ده. matched_intent_id/claim_id بيضلوا لأسطح الموقع —
--    مصدر حقيقة واحد لكل استهلاك، والاستهلاك نفسه بيتعلّم كمان
--    بـ outcome='credited' زي كل الأسطح.
-- ---------------------------------------------------------------------
alter table public.wallet_deposit_events
  add column if not exists matched_bot_topup_id text;

create index if not exists wallet_deposit_events_bot_topup_idx
  on public.wallet_deposit_events (matched_bot_topup_id)
  where matched_bot_topup_id is not null;

comment on column public.wallet_deposit_events.matched_bot_topup_id is
  'هجرة 018: طلب شحن محفظة البوت (topup_requests في قاعدة البوت) اللي حجز الحدث ده للشحن التلقائي (bot_exchange_claim). حدث واحد = استهلاك واحد عبر الأسطح الأربعة.';

-- ---------------------------------------------------------------------
-- 2) مرشّحو البوت: أحداث قابلة للربط ولسه ما اتستهلكتش + السعر
--    الحي (قراءة بس — الحسم النهائي في الحجز تحت القفل).
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

-- ---------------------------------------------------------------------
-- 3) الحجز الذرّي: حدث واحد بيتحجز لطلب شحن بوت واحد — أو ما
--    بيتحجزش خالص. كل الشروط بتتعاد تحت قفل الصف، وبنفس ترتيب
--    فحوص مسارات الربط القائمة (014/015) قدر الإمكان.
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

-- ---------------------------------------------------------------------
-- 4) الصلاحيات: الدالتان service_role بس (خلفية الموقع بتناديهم
--    لممر البوت المصرّح بتوكن الجسر — مفيش أي سطح عميل هنا).
-- ---------------------------------------------------------------------
revoke all on function public.bot_exchange_candidates(int) from public;
revoke all on function public.bot_exchange_claim(uuid, text, numeric, timestamptz) from public;

grant execute on function public.bot_exchange_candidates(int) to service_role;
grant execute on function public.bot_exchange_claim(uuid, text, numeric, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
