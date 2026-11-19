-- =====================================================================
-- هجرة 017: شحن محفظة البوت التلقائي من إيصالات الرسائل — Bot SMS Claim
-- =====================================================================
-- قرار المالك (2026-11-19): «ظبط موقع وبوت بربط رصيد تلقائيا عند دفع
-- عميل عشان ميحصلش زي ما حصل مع عميل من شوية» — طلب شحن InstaPay في
-- بوت التليجرام فضل معلّق لحد الاعتماد اليدوي، بينما شحنات الموقع
-- بتتقيّد تلقائيًا من نفس الإيصالات (الحزم 11/13/14). الهجرة دي
-- بتفتح للإيصالات سطح استهلاك تالت — طلبات شحن البوت — بنفس انضباط
-- السطحين القائمين (شحنة محفظة / طلب شراء)، من غير أي منطق فلوس
-- جديد هنا: القيد نفسه بيحصل في البوت بمسار قرار محفظته القائم،
-- ودور القاعدة هنا حاجتين بس:
--
--   1) `bot_sms_candidates`: قراءة مرشّحين — أحداث `unmatched` لسه
--      ما اتستهلكتش في أي سطح، بحقائق بوابة جاهزة (أساس قناة مزدوجة
--      + معرّف الشريك، أو مُرسل موثوق) محسوبة بمرآة قراءة-بس لبوابة
--      الشحن (`wallet_sms_autocredit_gate` نسخة 016) — من غير أي
--      كتابة: الربط الفعلي للقناة المزدوجة بيحصل وقت الحجز بس.
--   2) `bot_sms_claim`: حجز ذرّي — بيقفل صف الحدث، وبيتحقق إنه
--      لسه غير مستهلك في أي سطح (لا شحنة ولا طلب ولا حجز بوت)،
--      وبيعلّمه `matched` + `matched_bot_topup_id`، وشريك القناة
--      المزدوجة بيتحجز معاه في نفس المعاملة بنفس العلامة. حجز
--      فاشل = البوت ما بيقيّدش، نقطة — فإيصال واحد مستحيل يقيّد
--      رصيدين عبر الأسطح الثلاثة مهما تزامنت الحلقات.
--
-- ملاحظات مقصودة:
--   • ممثّل الزوج المزدوج في المرشّحين هو حدث الـ SMS دايمًا،
--     والشريك (إشعار التطبيق) بييجي `partner_id` بس — التحويلة
--     الواحدة بتظهر للبوت مرة واحدة، وإلا كانت الفرادة في اتجاه
--     (طلب × إيصال) مستحيلة بنيويًا.
--   • رجل «المُرسل الموثوق» هنا بتتحسب من سجل الشحنات المؤكدة
--     لحساب مُرسل الحدث نفسه (نفس مصدر 016 الوحيد لكل رقم) —
--     البوابة بتحكم على موثوقية الإيصال، وهوية العميل بيحسمها
--     رقم العملية/فرادة المطابقة عند البوت.
--   • سقف البوابة (`sms_autocredit_cap_egp`) بيتبعت للبوت مع
--     المرشّحين وبيتطبق عنده على كل الشحنات التلقائية (قرار
--     التصميم للبوت: السقف على التلقائي كله، مش على رجل الثقة بس).
--   • الأحداث المرتبطة أصلًا بزوج (`corroborated_by`) برّه
--     المرشّحين وبرّه الحجز: الربط ده أثر مسار موقع بدأ فعلًا.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) علامة استهلاك البوت: معرّف طلب شحن البوت (UUID كنص) اللي حجز
--    الحدث ده. matched_topup_id/matched_order_id بيضلوا لسطحي
--    الموقع بس — مصدر حقيقة واحد لكل استهلاك.
-- ---------------------------------------------------------------------
alter table public.wallet_sms_events
  add column if not exists matched_bot_topup_id text;

create index if not exists wallet_sms_events_bot_topup_idx
  on public.wallet_sms_events (matched_bot_topup_id)
  where matched_bot_topup_id is not null;

comment on column public.wallet_sms_events.matched_bot_topup_id is
  'هجرة 017: طلب شحن محفظة البوت (topup_requests في قاعدة البوت) اللي حجز الحدث ده للشحن التلقائي (bot_sms_claim). حدث واحد = استهلاك واحد عبر الأسطح الثلاثة.';

-- ---------------------------------------------------------------------
-- 2) مرشّحو البوت: أحداث غير مستهلكة + حقائق بوابة (قراءة بس).
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3) الحجز الذرّي: حدث (+ شريكه لو قناة مزدوجة) بيتحجز لطلب شحن
--    بوت واحد — أو ما بيتحجزش خالص. إعادة الحجز لنفس الحدث بترجع
--    already_decided من غير أي كتابة.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4) الصلاحيات: الدالتان service_role بس (خلفية الموقع بتناديهم
--    لممر البوت المصرّح بتوكن الجسر — مفيش أي سطح عميل هنا).
-- ---------------------------------------------------------------------
revoke all on function public.bot_sms_candidates(int) from public;
revoke all on function public.bot_sms_claim(uuid, text, uuid, text) from public;

grant execute on function public.bot_sms_candidates(int) to service_role;
grant execute on function public.bot_sms_claim(uuid, text, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
