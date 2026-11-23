-- =====================================================================
-- Rollback for migration 035 (SMS claim gate, W11 #2)
-- =====================================================================
-- DELIBERATE USE ONLY. Restores bot_sms_claim to its migration-021
-- definition verbatim (embedded below). Rolling back re-opens the
-- W11 #2 hole: the claim trusts the caller's basis again.
-- =====================================================================

create or replace function public.bot_sms_claim(
  p_event_id uuid,
  p_bot_topup_id text,
  p_partner_id uuid default null,
  p_basis text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_sms_events;
  v_partner public.wallet_sms_events;
  v_ref text := btrim(coalesce(p_bot_topup_id, ''));
begin
  if char_length(v_ref) < 1 or char_length(v_ref) > 64 then
    return jsonb_build_object('claimed', false,
                              'reason', 'invalid_topup_ref');
  end if;
  if p_basis is not null
     and p_basis not in ('dual_channel', 'trusted_sender') then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_basis');
  end if;

  select * into v_event
  from public.wallet_sms_events
  where id = p_event_id
  for update;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;
  if v_event.match_state <> 'unmatched'
     or v_event.matched_topup_id is not null
     or v_event.matched_order_id is not null
     or v_event.matched_bot_topup_id is not null
     or v_event.corroborated_by is not null then
    return jsonb_build_object('claimed', false,
                              'reason', 'already_decided',
                              'match_state', v_event.match_state);
  end if;

  -- تحصين 021: حجز بأساس الثقة بيعيد فحص سقف السرعة اليومي تحت
  -- قفل المُرسل — العدّ اللي شافه المرشّحون ممكن يكون اتغيّر بين
  -- القراءة والحجز، والحجز هو نقطة الالتزام الفعلية لسطح البوت.
  if p_basis = 'trusted_sender' then
    perform public.sms_trusted_velocity_lock(v_event.sender_account);
    if public.sms_trusted_today_count(v_event.sender_account)
         >= public.sms_trusted_daily_max() then
      return jsonb_build_object('claimed', false,
                                'reason', 'trusted_velocity');
    end if;
  end if;

  if p_partner_id is not null then
    -- الشريك بيتحقق من جديد تحت القفل بنفس معايير بوابة 016
    -- بالحرف: لو اختفى أو اتستهلك أو بطّل شريك، الحجز كله بيقف.
    select * into v_partner
    from public.wallet_sms_events
    where id = p_partner_id
    for update;
    if not found
       or v_partner.match_state <> 'unmatched'
       or v_partner.matched_topup_id is not null
       or v_partner.matched_order_id is not null
       or v_partner.matched_bot_topup_id is not null
       or v_partner.corroborated_by is not null
       or v_partner.amount_egp is distinct from v_event.amount_egp
       or not (
         (v_event.source = 'sms'
           and v_partner.source = 'app_notification'
           and public.wallet_app_package_allowed(v_partner.package_name))
         or
         (v_event.source = 'app_notification'
           and v_partner.source = 'sms'
           and coalesce(v_partner.parsed ->> 'origin', '') = 'official')
       )
       or not (
         v_partner.sender_account = v_event.sender_account
         or (v_partner.transfer_ref is not null
             and v_event.transfer_ref is not null
             and v_partner.transfer_ref = v_event.transfer_ref)
       )
       or coalesce(v_partner.received_at, v_partner.ingested_at)
            not between coalesce(v_event.received_at, v_event.ingested_at)
                          - interval '15 minutes'
                    and coalesce(v_event.received_at, v_event.ingested_at)
                          + interval '15 minutes'
    then
      return jsonb_build_object('claimed', false,
                                'reason', 'partner_unavailable');
    end if;

    update public.wallet_sms_events
    set match_state = 'matched',
        matched_bot_topup_id = v_ref,
        corroborated_by = v_event.id,
        parsed = coalesce(parsed, '{}'::jsonb)
                 || jsonb_build_object(
                      'bot_claim', jsonb_build_object(
                        'topup_id', v_ref,
                        'role', 'corroboration_partner'))
    where id = v_partner.id;
  end if;

  update public.wallet_sms_events
  set match_state = 'matched',
      matched_bot_topup_id = v_ref,
      corroborated_by = case when p_partner_id is not null
                             then p_partner_id else corroborated_by end,
      parsed = coalesce(parsed, '{}'::jsonb)
               || jsonb_build_object(
                    'bot_claim', jsonb_build_object(
                      'topup_id', v_ref,
                      'basis', p_basis,
                      'surface', 'bot_wallet'))
  where id = v_event.id;

  -- تنبيه رجل الثقة (021): صف التدقيق بيتحط هنا — نفس معاملة
  -- الحجز ونفس لحظة عدّ السرعة، فالعدّاد والتنبيه مصدر واحد.
  if p_basis = 'trusted_sender'
     and v_event.sender_account is not null then
    insert into public.sms_trust_alerts
      (surface, sender_account, amount_egp, event_id, bot_topup_id)
    values ('bot_topup', v_event.sender_account, v_event.amount_egp,
            v_event.id, v_ref);
  end if;

  return jsonb_build_object('claimed', true,
                            'event_id', v_event.id,
                            'bot_topup_id', v_ref);
end;
$$;

notify pgrst, 'reload schema';
