-- =====================================================================
-- هجرة 021: تحصين رجل «المُرسل الموثوق» في بوابات الرسائل — Trusted-Leg
-- Hardening (إصلاح F-02 من تدقيق سلامة الفلوس، 2026-11-19 مساءً)
-- =====================================================================
-- بتتطبق بعد هجرات 013–017 (بوابات 015/016 ومرآة البوت 017).
-- متوافقة مع 019 (فك الحجز): 019 بتضيف دالتي فك بس ومش بتلمس أي
-- دالة هنا، وجسم bot_sms_claim هنا هو جسم 017 + إضافات الثقة —
-- أثر bot_claim اللي الفك بيعتمد عليه مش بيتغيّر.
--
-- المشكلة (F-02): رجل الثقة في البوابات التلاتة كانت بتحسب تاريخ
-- المُرسل من أي شحنة credited — والاعتماد اليدوي بيعدّي عليها
-- (تعليق 015/016 نفسه: «بأي مسار تأكيد: أدمن أو تلقائي»). شحنتان
-- صغيرتان حقيقيتان + اعتماد أدمن عادي = رقم «موثوق»، وبعدها رسالة
-- بنكية بهوية مُرسل منتحلة (sender-ID spoofing سلعة جاهزة) على
-- موبايل المالك بتتشحن تلقائيًا لحد سقف 500 جنيه على تلات أسطح
-- (محفظة الموقع + طلبات الشراء + شحنات البوت)، وتتكرر بمرجع جديد
-- كل مرة من غير سقف سرعة ولا أي تنبيه.
--
-- التحصين (رجل الثقة بس — القناة المزدوجة زي ما هي بالحرف):
--   1) التاريخ المؤكد نظاميًا بس: العدّاد بقى يعدّ الشحنات اللي
--      حدث رسالتها شايل أساس بوابة (autocredit_basis) — أي شحنة
--      أطلقها النظام بدليل قناة. الاعتماد اليدوي (قرار بشر على
--      سكرين شوت) مش دليل إن قناة الرسائل سليمة، فبرّه الحساب.
--   2) سقف خاص برجل الثقة: إعداد جديد sms_trusted_cap_egp
--      (افتراضي 200 جنيه) بيحكم رجل الثقة في البوابات التلاتة
--      بدل السقف العام 500. السقف العام بيضل سقف ممر البوت
--      الخارجي زي ما هو (بييجي في حمولة المرشّحين cap_egp).
--   3) سقف سرعة يومي: sms_trusted_daily_max (افتراضي 3) — أقصى
--      عدد شحنات بأساس الثقة لكل sender_account في اليوم (بتوقيت
--      القاهرة) عبر الأسطح التلاتة مجتمعة. العدّ من جدول التنبيهات
--      نفسه (مصدر واحد)، والفحص الحاسم تحت قفل استشاري لكل مُرسل
--      (sms_trusted_velocity_lock) فسباق سطحين على نفس المُرسل
--      بيتحسم تسلسليًا لحد نهاية المعاملة.
--   4) تنبيه مرئي: كل شحنة/تأكيد/حجز بأساس الثقة بيكتب صف في
--      sms_trust_alerts في نفس معاملة القيد — وبيتقرا بدالة
--      sms_trust_alerts_recent المحكومة بـ is_store_admin (نفس
--      نمط wallet_sms_recent) فالمالك يشوف أول شحنة موثوقة في
--      يومها. ملحوظة مقصودة: حجز بوت اتفك بعدين (019) بيضل صفه —
--      التنبيه سجل تدقيق، والعدّ بيضل متحفظ (فشل آمن).
--   5) رقم العملية إلزامي على رجل الثقة لما الرسالة شايلاه:
--      في بوابة الشحن، حدث بمرجع لا يأكد على رجل الثقة إلا طلبًا
--      شايل نفس المرجع (مسار المبلغ+المُرسل المرجّح بقى ممنوع
--      للثقة مع وجود مرجع). وفي بوابة الطلبات أقسى بنيويًا:
--      الطلب معندهوش مرجع يقارن بيه، فحدث بمرجع لا يأكد طلبًا
--      على رجل الثقة أصلًا. (سطح البوت بيفرض مساواة المرجع في
--      مطابقته من 017/ممر البوت نفسه.)
--
-- تغيّرات سلوك لعملاء شرعيين (مقصودة وموثّقة):
--   • مُرسل تاريخه اعتماد يدوي بس بيبدأ من صفر في عدّاد الثقة
--     لحد ما يجمع شحنات مؤكدة نظاميًا (قناة مزدوجة بتعدّي).
--   • شحنات الثقة فوق 200 جنيه بتستنى قناة مزدوجة أو الأدمن.
--   • طلب شراء برسالة شايلة مرجع بيحتاج قناة مزدوجة أو أدمن
--     للتأكيد التلقائي (الإشعار التطبيقي بيخلي المزدوجة هي
--     المسار الشائع أصلًا).
--   • رابع شحنة موثوقة في نفس اليوم لنفس الرقم بتتحسم للأدمن.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) إعدادا رجل الثقة (wallet_settings — نفس نمط 015: قيم نصية
--    بيظبطها المالك، والقراءة في الدوال المساعدة دفاعية).
-- ---------------------------------------------------------------------
insert into public.wallet_settings (key, value, note) values
  ('sms_trusted_cap_egp', '200',
   'سقف رجل «المُرسل الموثوق» بس بالجنيه (هجرة 021): شحنة/طلب أكبر من كده بيحتاج قناة مزدوجة أو اعتماد الأدمن. السقف العام sms_autocredit_cap_egp بيضل سقف ممر البوت الخارجي. بيظبطه المالك.'),
  ('sms_trusted_daily_max', '3',
   'أقصى عدد شحنات تلقائية بأساس «مُرسل موثوق» لكل رقم مُرسل في اليوم (بتوقيت القاهرة) عبر أسطح الموقع والبوت مجتمعة (هجرة 021). 0 = رجل الثقة مقفولة. بيظبطه المالك.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2) سجل تنبيهات رجل الثقة: صف لكل شحنة/تأكيد/حجز بأساس الثقة،
--    مكتوب في نفس معاملة القيد. هو في نفس الوقت عدّاد السرعة
--    (مصدر العدّ الوحيد لكل الأسطح) وسطح التدقيق اللي المالك
--    بيراجعه — تنبيه وعدّاد من نفس الصف فمستحيل يختلفوا.
-- ---------------------------------------------------------------------
create table if not exists public.sms_trust_alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  surface text not null
    check (surface in ('wallet_topup', 'order', 'bot_topup')),
  sender_account text not null,
  amount_egp numeric(12,2) not null,
  event_id uuid not null references public.wallet_sms_events (id),
  topup_id uuid references public.wallet_topups (id),
  order_id bigint references public.orders (id),
  bot_topup_id text,
  basis text not null default 'trusted_sender'
    check (basis in ('trusted_sender'))
);

create index if not exists sms_trust_alerts_sender_day_idx
  on public.sms_trust_alerts (sender_account, created_at desc);
create index if not exists sms_trust_alerts_created_idx
  on public.sms_trust_alerts (created_at desc);

comment on table public.sms_trust_alerts is
  'هجرة 021: كل شحنة تلقائية بأساس «مُرسل موثوق» على أي سطح (محفظة/طلب/بوت) — تنبيه للمالك وعدّاد سقف السرعة اليومي في نفس الوقت.';

-- RLS: مفيش سياسات عملاء خالص — الجدول للخدمة والتدقيق بس (نفس
-- وضعية wallet_sms_events و order_payment_matches).
alter table public.sms_trust_alerts enable row level security;
revoke all on public.sms_trust_alerts from anon, authenticated;
grant all on public.sms_trust_alerts to service_role;

-- ---------------------------------------------------------------------
-- 3) دوال مساعدة داخلية (مفيش أي grant لأدوار API — بتتنادى من
--    دوال SECURITY DEFINER بس، نفس وضعية البوابات نفسها).
-- ---------------------------------------------------------------------

-- سقف رجل الثقة بالجنيه: غياب/خربان = الافتراضي الموثّق 200.
create or replace function public.sms_trusted_cap()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when v ~ '^\d+(\.\d{1,2})?$' then v::numeric else 200 end
  from (
    select coalesce(
      (select value from public.wallet_settings
       where key = 'sms_trusted_cap_egp'), '200') as v
  ) s;
$$;

-- سقف السرعة اليومي لكل مُرسل: غياب/خربان = 3. صفر = الرجل مقفولة.
create or replace function public.sms_trusted_daily_max()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when v ~ '^\d+$' then v::int else 3 end
  from (
    select coalesce(
      (select value from public.wallet_settings
       where key = 'sms_trusted_daily_max'), '3') as v
  ) s;
$$;

-- عدّاد التاريخ المؤكد نظاميًا: شحنات credited اللي حدث رسالتها
-- شايل أساس بوابة (autocredit_basis) — أي النظام نفسه أطلقها
-- بدليل قناة. الاعتماد اليدوي معندهوش الأساس ده فبرّه الحساب.
create or replace function public.sms_sender_verified_count(
  p_sender_account text,
  p_exclude_topup_id uuid default null
) returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.wallet_topups t
  where p_sender_account is not null
    and t.sender_account = p_sender_account
    and t.status = 'credited'
    and (p_exclude_topup_id is null or t.id <> p_exclude_topup_id)
    and exists (
      select 1 from public.wallet_sms_events e
      where e.matched_topup_id = t.id
        and e.autocredit_basis is not null
    );
$$;

-- عدّاد اليوم (بتوقيت القاهرة) من سجل التنبيهات: كل الأسطح
-- بتكتب فيه في معاملة قيدها، فالعدّ ده هو الحقيقة المشتركة.
create or replace function public.sms_trusted_today_count(
  p_sender_account text
) returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.sms_trust_alerts a
  where p_sender_account is not null
    and a.sender_account = p_sender_account
    and a.created_at >= (date_trunc('day', now() at time zone 'Africa/Cairo')
                         at time zone 'Africa/Cairo');
$$;

-- قفل استشاري لكل مُرسل بيعيش لآخر المعاملة: بيخلّي «فحص العدّ
-- + القيد + كتابة التنبيه» ذرّيًا عبر الأسطح التلاتة. تصادم
-- بصمة نادر بين رقمين مختلفين بيكلّف تسلسل زايد بس — مش غلط.
create or replace function public.sms_trusted_velocity_lock(
  p_sender_account text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext('sms_trusted_leg:' || coalesce(p_sender_account, ''))::bigint);
end;
$$;

revoke all on function public.sms_trusted_cap() from public;
revoke all on function public.sms_trusted_daily_max() from public;
revoke all on function public.sms_sender_verified_count(text, uuid) from public;
revoke all on function public.sms_trusted_today_count(text) from public;
revoke all on function public.sms_trusted_velocity_lock(text) from public;

-- ---------------------------------------------------------------------
-- 4) إحصاءات المُرسلين: نفس أعمدة 015 بالترتيب + عمود أخير
--    verified_credits بعدّاد 021 — عشان صورة الأدمن تفرّق بين
--    «اتأكد» و«اتأكد نظاميًا» زي البوابات بالظبط.
-- ---------------------------------------------------------------------
create or replace view public.wallet_sms_sender_stats as
select
  t.sender_account,
  count(*) filter (where t.status = 'credited') as confirmed_credits,
  count(*) filter (where t.status = 'pending') as pending_topups,
  count(*) as total_topups,
  max(t.decided_at) filter (where t.status = 'credited') as last_confirmed_at,
  -- 021: المؤكد نظاميًا بس (نفس عدّاد sms_sender_verified_count —
  -- حدث الشحنة شايل أساس بوابة). الاعتماد اليدوي برّه العدد ده.
  count(*) filter (where t.status = 'credited' and exists (
    select 1 from public.wallet_sms_events e
    where e.matched_topup_id = t.id
      and e.autocredit_basis is not null
  )) as verified_credits
from public.wallet_topups t
where t.sender_account is not null
group by t.sender_account;

-- ---------------------------------------------------------------------
-- 5) بوابة الشحن (جسم 016 بالحرف ما عدا رجل الثقة والإعدادات):
--    القناة المزدوجة وأصل القناة بلا أي تغيير.
-- ---------------------------------------------------------------------
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
  v_min_raw text;
  v_min int;
  v_trusted_cap numeric;
  v_daily_max int;
  v_corr public.wallet_sms_events;
begin
  select * into v_event from public.wallet_sms_events where id = p_event_id;
  if not found then return null; end if;
  select * into v_topup from public.wallet_topups where id = p_topup_id;
  if not found then return null; end if;

  -- إعدادات (قراءة دفاعية: قيمة خربانة = الباب المقفول، مش خطأ
  -- يكسر إدخال الرسالة كلها).
  select value into v_pkg from public.wallet_settings
  where key = 'wallet_app_package';
  select value into v_min_raw from public.wallet_settings
  where key = 'sms_trusted_min_confirmed';
  v_trusted_cap := public.sms_trusted_cap();
  v_daily_max := public.sms_trusted_daily_max();
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

  -- ج) المُرسل الموثوق (محصّن في 021 — إصلاح F-02): التاريخ
  --    بيتحسب من الشحنات المؤكدة نظاميًا بس (حدثها شايل أساس
  --    بوابة — الاعتماد اليدوي برّه الحساب)، والسقف هو سقف رجل
  --    الثقة الخاصة (sms_trusted_cap_egp) مش السقف العام، وفيه
  --    سقف سرعة يومي لكل مُرسل عبر الأسطح التلاتة، ورقم العملية
  --    لازم يطابق لو الرسالة شايلة واحد.
  if v_topup.amount_egp <= v_trusted_cap then
    if v_event.transfer_ref is null
       or v_topup.transfer_ref = v_event.transfer_ref then
      perform public.sms_trusted_velocity_lock(v_topup.sender_account);
      if public.sms_trusted_today_count(v_topup.sender_account)
           < v_daily_max
         and public.sms_sender_verified_count(
               v_topup.sender_account, v_topup.id) >= v_min then
        return 'trusted_sender';
      end if;
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) محاولة مطابقة الشحن (جسم تحصين 015 بالحرف + كتابة التنبيه
--    عند شحنة الثقة في المسارين: المرجع والمُرجّح).
-- ---------------------------------------------------------------------
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
          if v_basis = 'trusted_sender'
             and (v_res ->> 'credited')::boolean is true then
            insert into public.sms_trust_alerts
              (surface, sender_account, amount_egp, event_id, topup_id)
            values ('wallet_topup', v_topup.sender_account,
                    v_topup.amount_egp, v_event.id, v_topup.id);
          end if;
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
        if v_basis = 'trusted_sender'
           and (v_res ->> 'credited')::boolean is true then
          insert into public.sms_trust_alerts
            (surface, sender_account, amount_egp, event_id, topup_id)
          values ('wallet_topup', v_topup.sender_account,
                  v_topup.amount_egp, v_event.id, v_topup.id);
        end if;
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

-- ---------------------------------------------------------------------
-- 7) بوابة الطلبات (جسم 015 بالحرف ما عدا رجل الثقة والإعدادات).
-- ---------------------------------------------------------------------
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
  v_min_raw text;
  v_min int;
  v_trusted_cap numeric;
  v_daily_max int;
  v_total numeric;
  v_corr public.wallet_sms_events;
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
  select value into v_min_raw from public.wallet_settings
  where key = 'sms_trusted_min_confirmed';
  v_trusted_cap := public.sms_trusted_cap();
  v_daily_max := public.sms_trusted_daily_max();
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

  -- ج) المُرسل الموثوق (محصّن في 021 — إصلاح F-02): نفس تحصين
  --    بوابة الشحن بالحرف (تاريخ مؤكد نظاميًا بس من سجل المحفظة،
  --    سقف رجل الثقة الخاصة على إجمالي الطلب، سقف سرعة يومي).
  --    وشرط المرجع هنا أقسى بنيويًا: الطلب معندهوش رقم عملية
  --    يقارن بيه، فحدث شايل رقم عملية مستحيل يأكد طلبًا على رجل
  --    الثقة — مكانه سطح الشحنات اللي بيقارن المرجع نفسه.
  if v_total <= v_trusted_cap then
    if v_event.transfer_ref is null then
      perform public.sms_trusted_velocity_lock(v_event.sender_account);
      if public.sms_trusted_today_count(v_event.sender_account)
           < v_daily_max
         and public.sms_sender_verified_count(
               v_event.sender_account) >= v_min then
        return 'trusted_sender';
      end if;
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) محاولة مطابقة الطلبات (جسم 015 بالحرف + كتابة التنبيه عند
--    تأكيد بأساس الثقة).
-- ---------------------------------------------------------------------
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

  -- تنبيه رجل الثقة (021): كل تأكيد بأساس الثقة بيسيب صف تدقيق.
  if v_basis = 'trusted_sender' then
    insert into public.sms_trust_alerts
      (surface, sender_account, amount_egp, event_id, order_id)
    values ('order', v_event.sender_account, v_event.amount_egp,
            v_event.id, v_order.id);
  end if;

  return jsonb_build_object(
    'confirmed', true, 'match_state', 'matched',
    'event_id', v_event.id,
    'order_id', v_order.id, 'order_ref', v_order.order_ref,
    'basis', v_basis);
end;
$$;

-- ---------------------------------------------------------------------
-- 9) مرآة البوت (أجسام 017 بالحرف + تحصين الثقة): المرشّحون
--    بيحسبوا الأساس بقواعد 021، والحجز بيعيد فحص سقف السرعة تحت
--    القفل وبيكتب التنبيه في نفس معاملته.
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
  v_trusted_cap numeric;
  v_daily_max int;
  v_events jsonb;
begin
  -- إعدادات (قراءة دفاعية زي البوابات: قيمة خربانة = الباب المقفول).
  select value into v_cap_raw from public.wallet_settings
  where key = 'sms_autocredit_cap_egp';
  select value into v_min_raw from public.wallet_settings
  where key = 'sms_trusted_min_confirmed';
  v_cap := case when v_cap_raw ~ '^\d+(\.\d{1,2})?$'
                then v_cap_raw::numeric else 0 end;
  v_trusted_cap := public.sms_trusted_cap();
  v_daily_max := public.sms_trusted_daily_max();
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
             and p.amount_egp <= v_trusted_cap
             and public.sms_trusted_today_count(p.sender_account)
                   < v_daily_max
             and public.sms_sender_verified_count(p.sender_account)
                   >= v_min
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
    'trusted_cap_egp', v_trusted_cap,
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

-- ---------------------------------------------------------------------
-- 10) قراءة التنبيهات للأدمن (بوابة is_store_admin زي
--     wallet_sms_recent بالحرف): أحدث شحنات رجل الثقة على كل
--     الأسطح — أول شحنة منتحلة هتظهر هنا في يومها.
-- ---------------------------------------------------------------------
create or replace function public.sms_trust_alerts_recent(
  p_limit int default 50
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_rows jsonb;
begin
  if not public.is_store_admin() then
    raise exception 'admins only';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select
      a.id,
      a.created_at,
      a.surface,
      a.sender_account,
      a.amount_egp,
      a.event_id,
      a.topup_id,
      a.order_id,
      a.bot_topup_id,
      a.basis
    from public.sms_trust_alerts a
    order by a.created_at desc
    limit v_limit
  ) x;

  return v_rows;
end;
$$;

revoke all on function public.sms_trust_alerts_recent(int) from public;
grant execute on function public.sms_trust_alerts_recent(int)
  to authenticated, service_role;

notify pgrst, 'reload schema';
