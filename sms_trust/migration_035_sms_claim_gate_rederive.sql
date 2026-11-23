-- =====================================================================
-- Migration 035: bot_sms_claim re-derives its gate (W11 #2)
-- =====================================================================
-- The hole (website audit W11, finding #2): bot_sms_claim is the
-- write side of the trusted SMS auto-credit leg, but it never
-- re-checked WHY the caller believed the event was creditable. It
-- trusted p_basis blindly: 'dual_channel' with a NULL partner id
-- claimed (the partner re-verification below only runs when a
-- partner IS supplied), a NULL basis claimed, and the
-- trusted_sender preconditions -- official channel, the
-- sms_trusted_cap() amount cap, and the systemic-history minimum
-- (sms_sender_verified_count) -- were enforced only inside the
-- read-side bot_sms_candidates, never at claim time. Any caller
-- able to invoke the RPC could bypass every gate by naming a
-- basis.
--
-- Fix: the body below is migration 021's body verbatim, plus ONE
-- marked block (M1-035) inserted immediately after the
-- already_decided check (the event row is already locked FOR
-- UPDATE at that point). The block re-derives, from the locked
-- row and mirroring bot_sms_candidates exactly: the channel gate
-- (official SMS origin, or a wallet-app notification from an
-- allowed package), rail derivability, basis presence, the
-- dual_channel partner requirement, and -- for trusted_sender --
-- sender presence, the trust cap, and the configured history
-- minimum (wallet_settings 'sms_trusted_min_confirmed', default
-- 2, same parsing as the candidates function). Refusals return
-- {claimed:false, reason: gate_channel | gate_rail |
-- basis_required | partner_required | trusted_gate} and write
-- nothing. The existing partner re-verification and the velocity
-- lock below are untouched, as is every other function.
--
-- CREATE OR REPLACE with an unchanged signature preserves the
-- live ACL; no grant changes are needed or made.
--
-- Rollback: restores the 021 definition verbatim (the claim goes
-- back to trusting the caller's basis).
--
-- APPLICATION NOTE (032 pattern): strip the trailing
-- `notify pgrst, 'reload schema';` from the submitted copy -- the
-- Management API query endpoint rejects it (42601).
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

  -- >>> M1-035 gate re-derivation under the lock (W11 #2): the
  -- claim used to TRUST the caller's p_basis. A 'dual_channel'
  -- basis with NO partner id claimed successfully, a NULL basis
  -- claimed successfully, and the trusted_sender conditions
  -- (official channel, trust cap, systemic history) lived only
  -- in the read-side bot_sms_candidates. Everything the
  -- candidates function requires is re-derived HERE, from the
  -- locked event row, before any claim is written. The existing
  -- partner re-verification (below) and the trusted daily-cap
  -- velocity lock (below) are unchanged.
  declare
    v_channel_ok boolean;
    v_rail text;
    v_min_raw text;
    v_min_confirmed int;
  begin
    v_channel_ok :=
      (v_event.source = 'sms'
        and coalesce(v_event.parsed ->> 'origin', '') = 'official')
      or (v_event.source = 'app_notification'
        and public.wallet_app_package_allowed(v_event.package_name));
    if not v_channel_ok then
      return jsonb_build_object('claimed', false, 'reason', 'gate_channel');
    end if;
    v_rail := case
      when v_event.parsed ->> 'template' in ('vodafone_ar', 'vodafone_en')
        then 'vodafone'
      when v_event.parsed ->> 'template' = 'instapay_generic' then 'instapay'
      when v_event.parsed ->> 'template' = 'etisalat_money' then 'etisalat'
      when v_event.package_name = 'com.vodafone.ana' then 'vodafone'
      when v_event.package_name in ('com.etisalat.flous', 'com.etisalat')
        then 'etisalat'
      when v_event.package_name = 'com.egyptianbanks.instapay' then 'instapay'
      else null end;
    if v_rail is null then
      return jsonb_build_object('claimed', false, 'reason', 'gate_rail');
    end if;
    if p_basis is null then
      return jsonb_build_object('claimed', false,
                                'reason', 'basis_required');
    end if;
    if p_basis = 'dual_channel' and p_partner_id is null then
      return jsonb_build_object('claimed', false,
                                'reason', 'partner_required');
    end if;
    if p_basis = 'trusted_sender' then
      select value into v_min_raw
      from public.wallet_settings where key = 'sms_trusted_min_confirmed';
      v_min_confirmed := greatest(
        case when v_min_raw ~ '^\d+$' then v_min_raw::int else 2 end, 1);
      if v_event.sender_account is null
         or v_event.amount_egp is null
         or v_event.amount_egp > public.sms_trusted_cap()
         or public.sms_sender_verified_count(v_event.sender_account)
              < v_min_confirmed then
        return jsonb_build_object('claimed', false,
                                  'reason', 'trusted_gate');
      end if;
    end if;
  end;
  -- <<< M1-035 gate re-derivation (end of added block)

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
