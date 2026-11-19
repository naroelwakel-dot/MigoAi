-- =====================================================================
-- هجرة 019: فك حجز البوت (تعويض الحجز) — Bot Unclaim Compensation
-- =====================================================================
-- إصلاح F-07 من تدقيق سلامة الفلوس (2026-11-19 مساءً): في ممرّي
-- الشحن التلقائي (رسائل 017 / منصات 018) الحجز بيحصل في قاعدة
-- الموقع أولًا وبعده القيد في قاعدة البوت. لو القيد فشل بعد حجز
-- ناجح (خطأ RPC، نشر في نص الدورة، هزّة قاعدة) فضل الإيصال/
-- الإيداع محجوزًا للأبد لطلب ما اتقيّدش أبدًا — إثبات العميل
-- بيتحرق والطلب يفضل معلّق من غير دليله.
--
-- الهجرة دي بتضيف دالتي فك الحجز التعويضيتين بس — مفيش أي منطق
-- فلوس هنا، ومفيش استرداد عميل من أي نوع: فك الحجز بيرجّع الحدث
-- لحالته قبل الحجز بالظبط (مرشّح تاني للدورة الجاية أو للقرار
-- اليدوي)، والقيد اللي فشل ما حصلش أصلًا فمفيش حاجة تتعوّض
-- ماليًا. قاعدة المالك الحاكمة: التعويض بيرجّع الإثبات للمحاولة
-- تاني — ومفيش أي استرداد بيخرج قبل ما جهة المورّد تتسوّى.
--
-- الانضباط (مرآة الحجز، بالعكس):
--   • الفك بيتم بس لو الصف لسه في حالة «محجوز للبوت ده» بالحرف:
--     نفس علامة الاستهلاك + نفس معرّف طلب الشحن + أثر الحجز
--     بتاعنا، ومن غير أي استهلاك سطح تاني ظهر في النص. أي حالة
--     غير كده = رفض من غير أي كتابة (never force).
--   • حدث الرسائل: الشريك (القناة المزدوجة) بيتفك مع الحدث في
--     نفس المعاملة — فك جزئي مستحيل بنيويًا.
--   • حدث المنصات: النتيجة قبل الحجز بتتسترّجع حتميًا من
--     `matched_intent_id` (نية منتهية = intent_expired، غيابها =
--     no_matching_intent — نفس اقتران 011)، وبيتعاد فحص غياب
--     مطالبات الأسطح على المرجع/البصمة تحت القفل.
--   • أثر تدقيق: علامة `bot_claim` بتتشال وبتتحط علامة
--     `bot_unclaim` بدلها — تاريخ الحدث بيقول إنه اتحجز واتفك،
--     مش بيتمسح كأنه ما حصلش.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) فك حجز إيصال رسائل: حدث (+ شريكه لو قناة مزدوجة) بيرجع
--    `unmatched` بعلامات فاضية — أو ما بيحصلش خالص.
-- ---------------------------------------------------------------------
create or replace function public.bot_sms_unclaim(
  p_event_id uuid,
  p_bot_topup_id text,
  p_partner_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_sms_events;
  v_partner public.wallet_sms_events;
  v_ref text := btrim(coalesce(p_bot_topup_id, ''));
  v_partner_id uuid;
begin
  if char_length(v_ref) < 1 or char_length(v_ref) > 64 then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'invalid_topup_ref');
  end if;

  select * into v_event
  from public.wallet_sms_events
  where id = p_event_id
  for update;
  if not found then
    return jsonb_build_object('unclaimed', false, 'reason', 'not_found');
  end if;

  -- الحالة المحجوزة للبوت دي بالحرف بس هي اللي بتتفك: matched +
  -- علامة البوت = الطلب ده + أثر حجزنا (topup_id/surface) + مفيش
  -- أي استهلاك سطح موقع. غير كده الحدث اتحسم خلاص — رفض بلا كتابة.
  if v_event.match_state <> 'matched'
     or v_event.matched_bot_topup_id is distinct from v_ref
     or v_event.matched_topup_id is not null
     or v_event.matched_order_id is not null
     or coalesce(v_event.parsed -> 'bot_claim' ->> 'topup_id', '')
          is distinct from v_ref
     or coalesce(v_event.parsed -> 'bot_claim' ->> 'surface', '')
          is distinct from 'bot_wallet' then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'not_bot_claimed',
                              'match_state', v_event.match_state);
  end if;

  -- الشريك بيتحدد من أثر الربط اللي الحجز حطّه على الحدث نفسه
  -- (corroborated_by) — ولو المستدعي بعت معرّف شريك لازم يطابقه:
  -- اختلاف = الحالة اتغيّرت، رفض كامل من غير فك جزئي.
  v_partner_id := v_event.corroborated_by;
  if p_partner_id is not null
     and v_partner_id is distinct from p_partner_id then
    return jsonb_build_object('unclaimed', false,
                              'reason', 'partner_mismatch');
  end if;

  if v_partner_id is not null then
    select * into v_partner
    from public.wallet_sms_events
    where id = v_partner_id
    for update;
    if not found
       or v_partner.match_state <> 'matched'
       or v_partner.matched_bot_topup_id is distinct from v_ref
       or v_partner.matched_topup_id is not null
       or v_partner.matched_order_id is not null
       or v_partner.corroborated_by is distinct from v_event.id
       or coalesce(v_partner.parsed -> 'bot_claim' ->> 'topup_id', '')
            is distinct from v_ref
       or coalesce(v_partner.parsed -> 'bot_claim' ->> 'role', '')
            is distinct from 'corroboration_partner' then
      return jsonb_build_object('unclaimed', false,
                                'reason', 'partner_state_changed');
    end if;

    update public.wallet_sms_events
    set match_state = 'unmatched',
        matched_bot_topup_id = null,
        corroborated_by = null,
        parsed = (coalesce(parsed, '{}'::jsonb) - 'bot_claim')
                 || jsonb_build_object(
                      'bot_unclaim', jsonb_build_object(
                        'topup_id', v_ref,
                        'role', 'corroboration_partner'))
    where id = v_partner.id;
  end if;

  update public.wallet_sms_events
  set match_state = 'unmatched',
      matched_bot_topup_id = null,
      corroborated_by = null,
      parsed = (coalesce(parsed, '{}'::jsonb) - 'bot_claim')
               || jsonb_build_object(
                    'bot_unclaim', jsonb_build_object(
                      'topup_id', v_ref,
                      'surface', 'bot_wallet'))
  where id = v_event.id;

  return jsonb_build_object('unclaimed', true,
                            'event_id', v_event.id,
                            'bot_topup_id', v_ref);
end;
$$;

-- ---------------------------------------------------------------------
-- 2) فك حجز إيداع منصات (حجز هجرة 018): الحدث بيرجع لنتيجته قبل
--    الحجز وعلامة البوت بتتشال — أو ما بيحصلش خالص. مفيش شريك
--    هنا: حدث الإيداع صف واحد بطبيعته.
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
      matched_bot_topup_id = null
  where id = v_event.id;

  return jsonb_build_object('unclaimed', true,
                            'event_id', v_event.id,
                            'bot_topup_id', v_ref);
end;
$$;

-- ---------------------------------------------------------------------
-- 3) الصلاحيات: الدالتان service_role بس (نفس بوابة 017/018 —
--    خلفية الموقع بتناديهم لممر البوت المصرّح بتوكن الجسر).
-- ---------------------------------------------------------------------
revoke all on function public.bot_sms_unclaim(uuid, text, uuid) from public;
revoke all on function public.bot_exchange_unclaim(uuid, text) from public;

grant execute on function public.bot_sms_unclaim(uuid, text, uuid)
  to service_role;
grant execute on function public.bot_exchange_unclaim(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
