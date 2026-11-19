-- =====================================================================
-- تراجع هجرة 021 (تحصين رجل «المُرسل الموثوق»)
-- =====================================================================
-- بيرجّع أجسام 015/016/017 بالحرف (البوابتان + محاولتا المطابقة +
-- مرشّحو البوت وحجزه + عرض إحصاءات المُرسلين)، وبيشيل كائنات 021
-- الجديدة (جدول التنبيهات + قارئه + الدوال المساعدة + الإعدادان).
-- صلاحيات الدوال المسترجعة محفوظة بنيويًا: create or replace مش
-- بيغيّر الـ ACL، وحالة ما قبل 021 هي نفسها (البوابات والمحاولات
-- داخلية، والمرشّحون والحجز service_role).
-- ⚠️ التراجع تراجع كود مش تراجع فلوس: شحنات اتقيّدت بقواعد 021
-- بتضل مقيّدة، وصفوف sms_trust_alerts بتتشال مع جدولها (أرشيفها
-- التشغيلي مسؤولية اللي بينفّذ التراجع لو احتاجها).
-- =====================================================================

create or replace view public.wallet_sms_sender_stats as
select
  t.sender_account,
  count(*) filter (where t.status = 'credited') as confirmed_credits,
  count(*) filter (where t.status = 'pending') as pending_topups,
  count(*) as total_topups,
  max(t.decided_at) filter (where t.status = 'credited') as last_confirmed_at
from public.wallet_topups t
where t.sender_account is not null
group by t.sender_account;

create or replace function public.wallet_sms_autocredit_gate(
  p_topup_id uuid,
  p_event_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_sms_events;
  v_topup public.wallet_topups;
  v_pkg text;
  v_cap_raw text;
  v_min_raw text;
  v_cap numeric;
  v_min int;
  v_corr public.wallet_sms_events;
  v_confirmed int;
begin
  select * into v_event from public.wallet_sms_events where id = p_event_id;
  if not found then return null; end if;
  select * into v_topup from public.wallet_topups where id = p_topup_id;
  if not found then return null; end if;

  -- إعدادات (قراءة دفاعية: قيمة خربانة = الباب المقفول، مش خطأ
  -- يكسر إدخال الرسالة كلها).
  select value into v_pkg from public.wallet_settings
  where key = 'wallet_app_package';
  select value into v_cap_raw from public.wallet_settings
  where key = 'sms_autocredit_cap_egp';
  select value into v_min_raw from public.wallet_settings
  where key = 'sms_trusted_min_confirmed';
  v_cap := case when v_cap_raw ~ '^\d+(\.\d{1,2})?$'
                then v_cap_raw::numeric else 0 end;
  v_min := greatest(
    case when v_min_raw ~ '^\d+$' then v_min_raw::int else 2 end, 1);

  -- أ) أصل القناة المُطلِقة
  if v_event.source = 'sms' then
    if coalesce(v_event.parsed ->> 'origin', '') <> 'official' then
      return null;
    end if;
  elsif v_event.source = 'app_notification' then
    if not public.wallet_app_package_allowed(v_event.package_name) then
      return null;
    end if;
  else
    return null;
  end if;

  -- ب) القناة المزدوجة: الشريك من القناة التانية، بهوية قناته هو
  --    كمان (رسالة رسمية الأصل أو إشعار من الحزمة الرسمية).
  select * into v_corr
  from public.wallet_sms_events e
  where e.id <> v_event.id
    and e.corroborated_by is null
    and v_event.corroborated_by is null
    and (
      (v_event.source = 'sms'
        and e.source = 'app_notification'
        and public.wallet_app_package_allowed(e.package_name))
      or
      (v_event.source = 'app_notification'
        and e.source = 'sms'
        and coalesce(e.parsed ->> 'origin', '') = 'official')
    )
    and e.amount_egp = v_event.amount_egp
    and (
      e.sender_account = v_event.sender_account
      or (e.transfer_ref is not null
          and v_event.transfer_ref is not null
          and e.transfer_ref = v_event.transfer_ref)
    )
    and (e.matched_topup_id is null or e.matched_topup_id = p_topup_id)
    and coalesce(e.received_at, e.ingested_at)
          between coalesce(v_event.received_at, v_event.ingested_at)
                    - interval '15 minutes'
              and coalesce(v_event.received_at, v_event.ingested_at)
                    + interval '15 minutes'
  order by e.ingested_at asc
  limit 1
  for update;

  if found then
    update public.wallet_sms_events
    set corroborated_by = v_corr.id
    where id = v_event.id;
    update public.wallet_sms_events
    set corroborated_by = v_event.id
    where id = v_corr.id;
    return 'dual_channel';
  end if;

  -- ج) المُرسل الموثوق: عدّاد الشحنات المؤكدة لرقم التليفون ده
  --    (بأي مسار تأكيد: أدمن أو تلقائي) + سقف المبلغ.
  if v_topup.amount_egp <= v_cap then
    select count(*) into v_confirmed
    from public.wallet_topups t
    where t.sender_account = v_topup.sender_account
      and t.status = 'credited'
      and t.id <> v_topup.id;
    if v_confirmed >= v_min then
      return 'trusted_sender';
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.wallet_sms_try_match(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_sms_events;
  v_topup public.wallet_topups;
  v_candidates uuid[];
  v_res jsonb;
  v_basis text;
begin
  select * into v_event
  from public.wallet_sms_events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'sms event not found';
  end if;
  if v_event.match_state <> 'unmatched' then
    return jsonb_build_object(
      'credited', false, 'match_state', v_event.match_state,
      'event_id', v_event.id, 'note', 'event already decided');
  end if;
  if v_event.amount_egp is null or v_event.amount_egp <= 0 then
    return jsonb_build_object(
      'credited', false, 'match_state', v_event.match_state,
      'event_id', v_event.id, 'note', 'no amount to match on');
  end if;

  -- ---------------------------------------------------------------
  -- أ) مسار رقم العملية (قيد 012 الفريد: الرقم على طلب واحد بس).
  -- ---------------------------------------------------------------
  if v_event.transfer_ref is not null then
    select * into v_topup
    from public.wallet_topups
    where transfer_ref = v_event.transfer_ref
    for update;

    if found and v_topup.status = 'pending' then
      if v_topup.amount_egp = v_event.amount_egp then
        -- مطابقة تامة بالمرجع — بس المرجع نفسه مش دليل (بيتنسخ من
        -- إيصال حقيقي): قرار الشحن عند البوابة.
        v_basis := public.wallet_sms_autocredit_gate(v_topup.id, v_event.id);
        if v_basis is not null then
          v_res := public.wallet_credit_topup_internal(
            v_topup.id, 'auto: sms ' || v_event.id::text);
          update public.wallet_sms_events
          set match_state = 'matched',
              matched_topup_id = v_topup.id,
              autocredit_basis = v_basis,
              parsed = coalesce(parsed, '{}'::jsonb)
                       || jsonb_build_object(
                            'match_basis', 'ref',
                            'credit_basis', v_basis)
          where id = v_event.id;
          return jsonb_build_object(
            'credited', (v_res ->> 'credited')::boolean is true,
            'match_state', 'matched', 'match_basis', 'ref',
            'credit_basis', v_basis,
            'event_id', v_event.id, 'topup_id', v_topup.id,
            'balance_after', v_res ->> 'balance_after');
        end if;
        -- أدلة مش كفاية: الحدث بيتربط بالطلب كتلميح قوي للأدمن،
        -- والطلب يفضل معلّق — مفيش شحن.
        update public.wallet_sms_events
        set match_state = 'matched',
            matched_topup_id = v_topup.id,
            parsed = coalesce(parsed, '{}'::jsonb)
                     || jsonb_build_object(
                          'match_basis', 'ref',
                          'credit', 'held_for_admin',
                          'reason', 'insufficient_corroboration')
        where id = v_event.id;
        return jsonb_build_object(
          'credited', false,
          'match_state', 'matched', 'match_basis', 'ref',
          'held_for_admin', true,
          'reason', 'insufficient_corroboration',
          'event_id', v_event.id, 'topup_id', v_topup.id);
      end if;
      -- الرقم بيشاور على الطلب ده بس المبلغ مختلف: غموض للأدمن
      -- (زي 013 — البوابة مش بتتنده: مفيش شحنة مطروحة أصلًا).
      update public.wallet_sms_events
      set match_state = 'ambiguous',
          matched_topup_id = v_topup.id,
          parsed = coalesce(parsed, '{}'::jsonb)
                   || jsonb_build_object(
                        'match_basis', 'ref',
                        'match_note', 'amount_mismatch',
                        'claimed_amount_egp', v_topup.amount_egp,
                        'sms_amount_egp', v_event.amount_egp)
      where id = v_event.id;
      return jsonb_build_object(
        'credited', false, 'match_state', 'ambiguous',
        'reason', 'ref_amount_mismatch',
        'event_id', v_event.id, 'topup_id', v_topup.id);
    end if;

    if found and v_topup.status = 'credited' then
      update public.wallet_sms_events
      set match_state = 'matched',
          matched_topup_id = v_topup.id,
          parsed = coalesce(parsed, '{}'::jsonb)
                   || jsonb_build_object(
                        'match_basis', 'ref', 'already_credited', true)
      where id = v_event.id;
      return jsonb_build_object(
        'credited', false, 'already_credited', true,
        'match_state', 'matched', 'match_basis', 'ref',
        'event_id', v_event.id, 'topup_id', v_topup.id);
    end if;

    if found and v_topup.status = 'rejected' then
      update public.wallet_sms_events
      set match_state = 'ignored',
          matched_topup_id = v_topup.id,
          parsed = coalesce(parsed, '{}'::jsonb)
                   || jsonb_build_object(
                        'match_basis', 'ref',
                        'match_note', 'ref_belongs_to_rejected_topup')
      where id = v_event.id;
      return jsonb_build_object(
        'credited', false, 'match_state', 'ignored',
        'reason', 'ref_belongs_to_rejected_topup',
        'event_id', v_event.id, 'topup_id', v_topup.id);
    end if;
    -- مش موجود أصلًا برقم العملية ده → كمّل للمسار المرجّح.
  end if;

  -- ---------------------------------------------------------------
  -- ب) المسار المرجّح: مبلغ + حساب مُرسل + نافذة ±24 ساعة.
  -- ---------------------------------------------------------------
  if v_event.sender_account is not null then
    select coalesce(array_agg(id), '{}'::uuid[]) into v_candidates
    from (
      select id from public.wallet_topups
      where status = 'pending'
        and amount_egp = v_event.amount_egp
        and sender_account = v_event.sender_account
        and created_at between
              coalesce(v_event.received_at, v_event.ingested_at)
                - interval '24 hours'
          and coalesce(v_event.received_at, v_event.ingested_at)
                + interval '24 hours'
      order by created_at
    ) c;

    if coalesce(array_length(v_candidates, 1), 0) = 1 then
      v_topup := null;
      select * into v_topup
      from public.wallet_topups
      where id = v_candidates[1]
      for update;
      if v_topup.status <> 'pending' then
        update public.wallet_sms_events
        set match_state = case when v_topup.status = 'credited'
                               then 'matched' else 'ignored' end,
            matched_topup_id = v_topup.id,
            parsed = coalesce(parsed, '{}'::jsonb)
                     || jsonb_build_object(
                          'match_basis', 'amount_sender_window',
                          'already_credited',
                          v_topup.status = 'credited')
        where id = v_event.id;
        return jsonb_build_object(
          'credited', false,
          'already_credited', v_topup.status = 'credited',
          'match_state', case when v_topup.status = 'credited'
                              then 'matched' else 'ignored' end,
          'match_basis', 'amount_sender_window',
          'event_id', v_event.id, 'topup_id', v_topup.id);
      end if;
      -- مرشّح وحيد — قرار الشحن عند البوابة برضه.
      v_basis := public.wallet_sms_autocredit_gate(v_topup.id, v_event.id);
      if v_basis is not null then
        v_res := public.wallet_credit_topup_internal(
          v_topup.id, 'auto: sms ' || v_event.id::text);
        update public.wallet_sms_events
        set match_state = 'matched',
            matched_topup_id = v_topup.id,
            autocredit_basis = v_basis,
            parsed = coalesce(parsed, '{}'::jsonb)
                     || jsonb_build_object(
                          'match_basis', 'amount_sender_window',
                          'credit_basis', v_basis)
        where id = v_event.id;
        return jsonb_build_object(
          'credited', (v_res ->> 'credited')::boolean is true,
          'match_state', 'matched',
          'match_basis', 'amount_sender_window',
          'credit_basis', v_basis,
          'event_id', v_event.id, 'topup_id', v_topup.id,
          'balance_after', v_res ->> 'balance_after');
      end if;
      update public.wallet_sms_events
      set match_state = 'matched',
          matched_topup_id = v_topup.id,
          parsed = coalesce(parsed, '{}'::jsonb)
                   || jsonb_build_object(
                        'match_basis', 'amount_sender_window',
                        'credit', 'held_for_admin',
                        'reason', 'insufficient_corroboration')
      where id = v_event.id;
      return jsonb_build_object(
        'credited', false,
        'match_state', 'matched',
        'match_basis', 'amount_sender_window',
        'held_for_admin', true,
        'reason', 'insufficient_corroboration',
        'event_id', v_event.id, 'topup_id', v_topup.id);
    end if;

    if coalesce(array_length(v_candidates, 1), 0) > 1 then
      update public.wallet_sms_events
      set match_state = 'ambiguous',
          parsed = coalesce(parsed, '{}'::jsonb)
                   || jsonb_build_object(
                        'match_basis', 'amount_sender_window',
                        'match_candidates',
                        to_jsonb(v_candidates))
      where id = v_event.id;
      return jsonb_build_object(
        'credited', false, 'match_state', 'ambiguous',
        'reason', 'multiple_candidates',
        'event_id', v_event.id,
        'candidates', to_jsonb(v_candidates));
    end if;
  end if;

  return jsonb_build_object(
    'credited', false, 'match_state', 'unmatched',
    'event_id', v_event.id);
end;
$$;

create or replace function public.order_sms_autocredit_gate(
  p_order_id bigint,
  p_event_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_sms_events;
  v_order public.orders;
  v_cap_raw text;
  v_min_raw text;
  v_cap numeric;
  v_min int;
  v_total numeric;
  v_corr public.wallet_sms_events;
  v_confirmed int;
begin
  select * into v_event from public.wallet_sms_events where id = p_event_id;
  if not found then return null; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then return null; end if;

  -- المبلغ الموثوق (مرجعية wallet_pay_order بالحرف).
  v_total := coalesce(
    v_order.server_total,
    nullif(regexp_replace(coalesce(v_order.total_text, ''), '[^0-9.]', '', 'g'), '')::numeric
  );
  if v_total is null or v_total <= 0 then return null; end if;

  -- إعدادات (قراءة دفاعية زي 015/016: قيمة خربانة = الباب المقفول).
  select value into v_cap_raw from public.wallet_settings
  where key = 'sms_autocredit_cap_egp';
  select value into v_min_raw from public.wallet_settings
  where key = 'sms_trusted_min_confirmed';
  v_cap := case when v_cap_raw ~ '^\d+(\.\d{1,2})?$'
                then v_cap_raw::numeric else 0 end;
  v_min := greatest(
    case when v_min_raw ~ '^\d+$' then v_min_raw::int else 2 end, 1);

  -- أ) أصل القناة المُطلِقة (نفس قاعدة 016 بالحرف).
  if v_event.source = 'sms' then
    if coalesce(v_event.parsed ->> 'origin', '') <> 'official' then
      return null;
    end if;
  elsif v_event.source = 'app_notification' then
    if not public.wallet_app_package_allowed(v_event.package_name) then
      return null;
    end if;
  else
    return null;
  end if;

  -- ب) القناة المزدوجة: نفس معايير 016، وربط الزوج بيحصل هنا وتحت
  --    قفل صف الشريك — زوج واحد = تأكيد واحد عبر النظام كله.
  select * into v_corr
  from public.wallet_sms_events e
  where e.id <> v_event.id
    and e.corroborated_by is null
    and v_event.corroborated_by is null
    and (
      (v_event.source = 'sms'
        and e.source = 'app_notification'
        and public.wallet_app_package_allowed(e.package_name))
      or
      (v_event.source = 'app_notification'
        and e.source = 'sms'
        and coalesce(e.parsed ->> 'origin', '') = 'official')
    )
    and e.amount_egp = v_event.amount_egp
    and (
      e.sender_account = v_event.sender_account
      or (e.transfer_ref is not null
          and v_event.transfer_ref is not null
          and e.transfer_ref = v_event.transfer_ref)
    )
    and e.matched_topup_id is null
    and (e.matched_order_id is null or e.matched_order_id = p_order_id)
    and coalesce(e.received_at, e.ingested_at)
          between coalesce(v_event.received_at, v_event.ingested_at)
                    - interval '15 minutes'
              and coalesce(v_event.received_at, v_event.ingested_at)
                    + interval '15 minutes'
  order by e.ingested_at asc
  limit 1
  for update;

  if found then
    update public.wallet_sms_events
    set corroborated_by = v_corr.id
    where id = v_event.id;
    update public.wallet_sms_events
    set corroborated_by = v_event.id
    where id = v_corr.id;
    return 'dual_channel';
  end if;

  -- ج) المُرسل الموثوق: عدّاد الشحنات المؤكدة لرقم التليفون ده من
  --    سجل المحفظة (مصدر 016 نفسه) + سقف المبلغ على إجمالي الطلب.
  if v_total <= v_cap then
    select count(*) into v_confirmed
    from public.wallet_topups t
    where t.sender_account = v_order.sender_account
      and t.status = 'credited';
    if v_confirmed >= v_min then
      return 'trusted_sender';
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.order_sms_try_match(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.wallet_sms_events;
  v_order public.orders;
  v_candidates bigint[];
  v_event_count int;
  v_basis text;
  v_anchor timestamptz;
begin
  select * into v_event
  from public.wallet_sms_events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'sms event not found';
  end if;
  if v_event.match_state <> 'unmatched' then
    return jsonb_build_object(
      'confirmed', false, 'match_state', v_event.match_state,
      'event_id', v_event.id, 'note', 'event already decided');
  end if;
  if v_event.amount_egp is null or v_event.amount_egp <= 0 then
    return jsonb_build_object(
      'confirmed', false, 'match_state', v_event.match_state,
      'event_id', v_event.id, 'note', 'no amount to match on');
  end if;
  if v_event.sender_account is null then
    return jsonb_build_object(
      'confirmed', false, 'reason', 'no_candidate',
      'match_state', 'unmatched', 'event_id', v_event.id);
  end if;
  v_anchor := coalesce(v_event.received_at, v_event.ingested_at);

  -- المرشّحون: طلبات 'new' على سكك المحمول الثلاث، بنفس المُرسل
  -- (قاعدة 013: btrim + مساواة تامة) ونفس المبلغ، واتعملت في
  -- نافذة ±48 ساعة من وقت الرسالة كما أبلغه الموبايل.
  select coalesce(array_agg(id), '{}'::bigint[]) into v_candidates
  from (
    select id from public.orders
    where status = 'new'
      and payment in ('📱 فودافون كاش',
                      '⚡ إنستاباي (InstaPay)',
                      '🟢 اتصالات كاش')
      and sender_account is not null
      and btrim(sender_account) = btrim(v_event.sender_account)
      and server_total = v_event.amount_egp
      and created_at between v_anchor - interval '48 hours'
                         and v_anchor + interval '48 hours'
    order by created_at
  ) c;

  if coalesce(array_length(v_candidates, 1), 0) = 0 then
    return jsonb_build_object(
      'confirmed', false, 'reason', 'no_candidate',
      'match_state', 'unmatched', 'event_id', v_event.id);
  end if;
  if coalesce(array_length(v_candidates, 1), 0) > 1 then
    return jsonb_build_object(
      'confirmed', false, 'reason', 'ambiguous',
      'match_state', 'unmatched', 'event_id', v_event.id,
      'candidates', to_jsonb(v_candidates));
  end if;

  -- قفل الطلب الفائز وإعادة التحقق من حالته تحت القفل (سباق
  -- محاولتين على نفس الطلب بيتحسم هنا).
  select * into v_order
  from public.orders
  where id = v_candidates[1]
  for update;
  if v_order.status <> 'new' then
    return jsonb_build_object(
      'confirmed', false, 'reason', 'order_decided',
      'match_state', 'unmatched', 'event_id', v_event.id,
      'order_id', v_order.id, 'order_ref', v_order.order_ref);
  end if;

  -- الفرادة في الاتجاه المعاكس: أحداث unmatched تانية بنفس
  -- (المُرسل، المبلغ) حوالين نفس الطلب = مش عارفين أنهي تحويلة
  -- هي بتاعة الطلب ده — غموض، مفيش دفع. استثناء واحد مقصود:
  -- شريك القناة المزدوجة للحدث الحالي (نفس التحويلة من القناة
  -- التانية بمعايير البوابة نفسها) مش «تحويلة تانية» — هو نفس
  -- الدليل مرتين، فبيتستبعد من العدّ وإلا القناة المزدوجة
  -- مستحيلة بنيويًا لأي طلب.
  select count(*) into v_event_count
  from public.wallet_sms_events e
  where e.match_state = 'unmatched'
    and e.amount_egp = v_order.server_total
    and e.sender_account is not null
    and btrim(e.sender_account) = btrim(v_order.sender_account)
    and v_order.created_at between
          coalesce(e.received_at, e.ingested_at) - interval '48 hours'
      and coalesce(e.received_at, e.ingested_at) + interval '48 hours'
    and not (
      e.id <> v_event.id
      and e.corroborated_by is null
      and v_event.corroborated_by is null
      and (
        (v_event.source = 'sms'
          and e.source = 'app_notification'
          and public.wallet_app_package_allowed(e.package_name))
        or
        (v_event.source = 'app_notification'
          and e.source = 'sms'
          and coalesce(e.parsed ->> 'origin', '') = 'official')
      )
      and (
        e.sender_account = v_event.sender_account
        or (e.transfer_ref is not null
            and v_event.transfer_ref is not null
            and e.transfer_ref = v_event.transfer_ref)
      )
      and coalesce(e.received_at, e.ingested_at)
            between v_anchor - interval '15 minutes'
                and v_anchor + interval '15 minutes'
    );
  if v_event_count <> 1 then
    return jsonb_build_object(
      'confirmed', false, 'reason', 'ambiguous',
      'match_state', 'unmatched', 'event_id', v_event.id,
      'order_id', v_order.id, 'order_ref', v_order.order_ref,
      'matching_events', v_event_count);
  end if;

  v_basis := public.order_sms_autocredit_gate(v_order.id, v_event.id);
  if v_basis is null then
    -- أدلة مش كفاية: الحدث مش بيستهلك (بيفضل unmatched عشان قناة
    -- تانية توصل بعده تلحقه)، وبيتعلّم بتلميح الطلب المرجّح عشان
    -- قائمة رسائل الأدمن تبين الربط المحتمل.
    update public.wallet_sms_events
    set parsed = coalesce(parsed, '{}'::jsonb)
                 || jsonb_build_object('order_hint', v_order.order_ref)
    where id = v_event.id;
    return jsonb_build_object(
      'confirmed', false, 'reason', 'gate',
      'match_state', 'unmatched', 'event_id', v_event.id,
      'order_id', v_order.id, 'order_ref', v_order.order_ref);
  end if;

  -- التأكيد: حالة الطلب + صف تدقيق + استهلاك الحدث — معاملة واحدة.
  update public.orders
  set status = 'payment_confirmed'
  where id = v_order.id;

  insert into public.order_payment_matches (order_id, event_id, basis, gate)
  values (v_order.id, v_event.id, 'sms_sender_amount', v_basis);

  update public.wallet_sms_events
  set match_state = 'matched',
      matched_order_id = v_order.id,
      autocredit_basis = v_basis,
      parsed = coalesce(parsed, '{}'::jsonb)
               || jsonb_build_object(
                    'match_basis', 'amount_sender_window',
                    'credit_basis', v_basis,
                    'order_ref', v_order.order_ref)
  where id = v_event.id;

  return jsonb_build_object(
    'confirmed', true, 'match_state', 'matched',
    'event_id', v_event.id,
    'order_id', v_order.id, 'order_ref', v_order.order_ref,
    'basis', v_basis);
end;
$$;

create or replace function public.bot_sms_candidates(
  p_limit int default 100
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_cap_raw text;
  v_min_raw text;
  v_cap numeric;
  v_min int;
  v_events jsonb;
begin
  -- إعدادات (قراءة دفاعية زي البوابات: قيمة خربانة = الباب المقفول).
  select value into v_cap_raw from public.wallet_settings
  where key = 'sms_autocredit_cap_egp';
  select value into v_min_raw from public.wallet_settings
  where key = 'sms_trusted_min_confirmed';
  v_cap := case when v_cap_raw ~ '^\d+(\.\d{1,2})?$'
                then v_cap_raw::numeric else 0 end;
  v_min := greatest(
    case when v_min_raw ~ '^\d+$' then v_min_raw::int else 2 end, 1);

  with base as (
    select e.*,
      case
        when e.parsed ->> 'template' in ('vodafone_ar', 'vodafone_en')
          then 'vodafone'
        when e.parsed ->> 'template' = 'instapay_generic' then 'instapay'
        when e.parsed ->> 'template' = 'etisalat_money' then 'etisalat'
        when e.package_name = 'com.vodafone.ana' then 'vodafone'
        when e.package_name in ('com.etisalat.flous', 'com.etisalat')
          then 'etisalat'
        when e.package_name = 'com.egyptianbanks.instapay' then 'instapay'
        else null
      end as rail,
      case
        when e.source = 'sms'
             and coalesce(e.parsed ->> 'origin', '') = 'official' then true
        when e.source = 'app_notification'
             and public.wallet_app_package_allowed(e.package_name) then true
        else false
      end as channel_ok
    from public.wallet_sms_events e
    where e.match_state = 'unmatched'
      and e.matched_topup_id is null
      and e.matched_order_id is null
      and e.matched_bot_topup_id is null
      and e.corroborated_by is null
      and e.amount_egp is not null and e.amount_egp > 0
      and coalesce(e.received_at, e.ingested_at)
            > now() - interval '96 hours'
  ),
  partnered as (
    select b.*,
      (select p.id
       from public.wallet_sms_events p
       where p.id <> b.id
         and p.match_state = 'unmatched'
         and p.matched_topup_id is null
         and p.matched_order_id is null
         and p.matched_bot_topup_id is null
         and p.corroborated_by is null
         and b.corroborated_by is null
         and (
           (b.source = 'sms'
             and p.source = 'app_notification'
             and public.wallet_app_package_allowed(p.package_name))
           or
           (b.source = 'app_notification'
             and p.source = 'sms'
             and coalesce(p.parsed ->> 'origin', '') = 'official')
         )
         and p.amount_egp = b.amount_egp
         and (
           p.sender_account = b.sender_account
           or (p.transfer_ref is not null
               and b.transfer_ref is not null
               and p.transfer_ref = b.transfer_ref)
         )
         and coalesce(p.received_at, p.ingested_at)
               between coalesce(b.received_at, b.ingested_at)
                         - interval '15 minutes'
                   and coalesce(b.received_at, b.ingested_at)
                         + interval '15 minutes'
       order by p.ingested_at asc
       limit 1) as partner_id
    from base b
    where b.rail is not null
  ),
  decided as (
    select p.*,
      case
        when not p.channel_ok then null
        when p.partner_id is not null then 'dual_channel'
        when p.sender_account is not null
             and p.amount_egp <= v_cap
             and (select count(*) from public.wallet_topups t
                  where t.sender_account = p.sender_account
                    and t.status = 'credited') >= v_min
          then 'trusted_sender'
        else null
      end as gate_basis
    from partnered p
    -- ممثّل الزوج: حدث الـ SMS هو الواجهة، والشريك partner_id بس.
    where not (p.source = 'app_notification' and p.partner_id is not null)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'event_id', c.id,
      'rail', c.rail,
      'amount_egp', c.amount_egp,
      'transfer_ref', c.transfer_ref,
      'sender_account', c.sender_account,
      'received_at', coalesce(c.received_at, c.ingested_at),
      'source', c.source,
      'gate_basis', c.gate_basis,
      'partner_id', c.partner_id
    ) order by coalesce(c.received_at, c.ingested_at) asc), '[]'::jsonb)
  into v_events
  from (
    select * from decided
    order by coalesce(received_at, ingested_at) asc
    limit v_limit
  ) c;

  return jsonb_build_object(
    'cap_egp', v_cap,
    'events', coalesce(v_events, '[]'::jsonb));
end;
$$;

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

  return jsonb_build_object('claimed', true,
                            'event_id', v_event.id,
                            'bot_topup_id', v_ref);
end;
$$;

drop function if exists public.sms_trust_alerts_recent(int);
drop function if exists public.sms_trusted_velocity_lock(text);
drop function if exists public.sms_trusted_today_count(text);
drop function if exists public.sms_sender_verified_count(text, uuid);
drop function if exists public.sms_trusted_daily_max();
drop function if exists public.sms_trusted_cap();

drop table if exists public.sms_trust_alerts;

delete from public.wallet_settings
where key in ('sms_trusted_cap_egp', 'sms_trusted_daily_max');

notify pgrst, 'reload schema';
