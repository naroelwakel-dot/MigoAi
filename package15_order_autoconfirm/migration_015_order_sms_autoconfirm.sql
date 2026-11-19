-- =====================================================================
-- هجرة 015 (الحزمة 15): تأكيد دفع الطلبات تلقائيًا — Order Auto-Confirm
-- =====================================================================
-- بتتطبق بعد هجرات 009–016 (آخرها 016 الحزمة 14). قرار المالك
-- (2026-11-19): «اربط ياباشا بزر أكد الدفع ولو فشل رسالة صغيرة فوق
-- زر انتظر ٣٠ ثانية واضغط مرة أخرى» + «كمان عندك بينانس و باي بيت
-- تأكيد تلقائى» + إضافة Bybit وسيلة دفع رسمية بزرها في الواجهة.
--
-- المشكلة: دفع الطلبات النقدي عند إتمام الشراء كان بينتهي برسالة
-- واتساب يدوية، رغم إن بنية الإثبات موجودة وشغالة من الحزم 10–14:
--   • سكك المحمول (فودافون/إنستاباي/اتصالات): جسر الرسائل بيقرأ
--     رسالة البنك الرسمية على موبايل المالك (wallet_sms_events).
--   • سكك المنصات (Binance/Bybit): مراقب الإيداعات بيسجل الإيداع
--     المؤكد من سجل المنصة نفسه (wallet_deposit_events) ومسار
--     المطالبات (014) بيحوّله لرصيد محفظة.
-- الهجرة دي بتمدّ نفس الأدلة لنفس الطلبات: «أكّد الدفع» في صفحة
-- الدفع بيأكد الطلب نفسه — من غير واتساب، ومن غير أي مسار فلوس
-- جديد: الحالة الوحيدة اللي بتتغير هي orders.status.
--
-- حقائق حية اتحققت قبل الكتابة (Management API + pg_get_functiondef):
--   • حالة «مدفوع» الحقيقية في القاعدة هي 'payment_confirmed'
--     (قيد orders_status_domain لا يعرف 'paid' أصلًا، و
--     wallet_pay_order بيكتب 'payment_confirmed'، والمنفّذ
--     STORE_EXEC_TRIGGER_STATUS مضبوط عليها). أي كتابة 'paid'
--     كانت هتصطدم بالقيد فورًا — فالهجرة بتستخدم الاسم الحي.
--   • قاعدة مقارنة المُرسل في مسار الشحن (013/015/016) هي:
--     القيم متشالة الأطراف وقت الكتابة (btrim/trim) والمقارنة
--     مساواة تامة — مفيش أي تطبيع تاني. الهجرة بتستخدم نفس
--     القاعدة بالحرف (btrim على الطرفين + مساواة).
--   • مبلغ الطلب الموثوق = orders.server_total (نفس مرجعية
--     wallet_pay_order؛ ولو غاب بيتحسب من total_text بنفس صيغته).
--
-- مبادئ الأمان (نفس دروس الحزم السابقة):
--   • حدث رسالة واحد = تأكيد واحد كحد أقصى عبر السطحين: عمود
--     matched_order_id + قيد فرادة order_payment_matches.event_id
--     + حالة الحدث 'matched' بيقفلوا إعادة الاستخدام بنيويًا.
--   • بوابة الطلبات (order_sms_autocredit_gate) مرآة بوابة الشحن
--     (016) بالحرف: أصل قناة رسمي + قناة مزدوجة أو مُرسل موثوق
--     جوّه السقف — بنفس مفاتيح الإعدادات ونفس دلالاتها.
--   • فشل البوابة مش بيستهلك الحدث (بيفضل unmatched مع تلميح
--     order_hint للأدمن) — عكس مسار الشحن اللي بيربطه held: هنا
--     وصول قناة تانية متأخر لازم يلاقي الحدث لسه متاح.
--   • الغموض (مرشحون/أحداث متعددة) عمره ما بيدفع — بيترجع
--     'ambiguous' والعميل بيترشّد إنه قيد المراجعة.
--   • إيداع منصة واحد = استخدام واحد عبر السطحين: علامة
--     الاستهلاك هي wallet_deposit_events.outcome='credited'
--     نفسها (علامة مسار النوايا) + order_exchange_claims
--     .deposit_event_id — مصدر حقيقة واحد، و claim_id بيضل
--     خاص بمطالبات المحفظة (قيد إحالة) فمش بيتحط عليه معرف طلب.
--   • قاعدة مبلغ المنصات للطلبات: قيمة الإيداع بالجنيه
--     round(amount_usdt × usdt_egp_rate, 2) — نفس تقريب مسار
--     المطالبات (014) — لازم تساوي server_total بالظبط؛ الطلب
--     مبلغه متفق عليه مسبقًا (زي النوايا اللي بتطلب مبلغًا فريدًا
--     بالظبط)، فأي اختلاف = pending من غير استهلاك للحدث.
--     (مسار مطالبة المحفظة نفسه بلا مقارنة مبلغ لأنه بيحوّل
--     أي إيداع لرصيد — الفرق مقصود وموثّق هنا.)
--   • RPCs العميل (order_confirm_payment /
--     order_claim_exchange_payment) بنظام «الحالة JSON دايمًا»:
--     إثبات المعرفة = (order_ref + sender_account كما سجّله
--     create_order) وأي اختلاف = 'not_found' واحدة لا تكشف شيئًا.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ربط حدث الرسالة بالطلب اللي أكّده (بديل/فوق matched_topup_id).
-- ---------------------------------------------------------------------
alter table public.wallet_sms_events
  add column if not exists matched_order_id bigint
    references public.orders (id);

create index if not exists wallet_sms_events_order_idx
  on public.wallet_sms_events (matched_order_id)
  where matched_order_id is not null;

comment on column public.wallet_sms_events.matched_order_id is
  'الحزمة 15: الطلب اللي حدث الرسالة ده أكّد دفعه تلقائيًا (order_sms_try_match). حدث واحد لا يؤكد إلا طلبًا واحدًا أو شحنة واحدة.';

-- ---------------------------------------------------------------------
-- 2) سجل تدقيق تأكيدات الطلبات: كل تأكيد تلقائي (رسائل أو منصة)
--    بيترك صفًا هنا. فرادة event_id عبر السطحين = حزام أخير ضد
--    تأكيدين من نفس الدليل. event_id هنا هو معرف حدث الرسائل في
--    تأكيدات الرسائل، ومعرف حدث الإيداع في تأكيدات المنصات —
--    والأساس (basis) بيفرّق بينهم.
-- ---------------------------------------------------------------------
create table if not exists public.order_payment_matches (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id),
  event_id uuid not null,
  basis text not null,
  gate text,
  created_at timestamptz not null default now(),
  unique (event_id)
);

comment on table public.order_payment_matches is
  'الحزمة 15: تدقيق تأكيدات دفع الطلبات التلقائية. basis: sms_sender_amount لسكك المحمول، exchange:<rail> لسكك المنصات. gate: أساس بوابة الرسائل (dual_channel/trusted_sender) أو NULL للمنصات.';

-- RLS: مفيش سياسات عملاء خالص — الجدول للخدمة والتدقيق بس (نفس
-- وضعية wallet_sms_events و reviews/error_log).
alter table public.order_payment_matches enable row level security;
revoke all on public.order_payment_matches from anon, authenticated;
grant all on public.order_payment_matches to service_role;

-- ---------------------------------------------------------------------
-- 3) مطالبات منصات مربوطة بطلبات (مرآة wallet_deposit_claims
--    للحزمة 12 لكن على مستوى الطلب): المطالبة ادعاء، والربط ضد
--    سجل المنصة (wallet_deposit_events) هو الإثبات الوحيد.
--    فرادة exchange_ref على الجدول كله (أقصر من (rail, ref) في
--    المحفظة عمدًا: مرجع واحد لا يؤكد إلا طلبًا واحدًا هنا).
-- ---------------------------------------------------------------------
create table if not exists public.order_exchange_claims (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders (id),
  rail text not null check (rail in ('binance', 'bybit')),
  exchange_ref text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  deposit_event_id uuid references public.wallet_deposit_events (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (exchange_ref)
);

create index if not exists order_exchange_claims_pending_idx
  on public.order_exchange_claims (status, created_at)
  where status = 'pending';
create index if not exists order_exchange_claims_order_idx
  on public.order_exchange_claims (order_id, created_at desc);

comment on table public.order_exchange_claims is
  'الحزمة 15: مطالبات العملاء بإيداعات Binance/Bybit مربوطة بطلبات شراء — التأكيد بيحرّك orders.status لـ payment_confirmed، والاستهلاك بيترك أثره على حدث الإيداع نفسه (outcome=credited) فلا يُعاد استخدامه في المحفظة.';

alter table public.order_exchange_claims enable row level security;
revoke all on public.order_exchange_claims from anon, authenticated;
grant all on public.order_exchange_claims to service_role;

-- ---------------------------------------------------------------------
-- 4) وسيلة Bybit الرسمية: create_order بيتحقق من payment_methods،
--    وتسمية الواجهة لازم تساوي قيمة الصف بالحرف.
-- ---------------------------------------------------------------------
insert into public.payment_methods (value, active, note)
values ('🟡 باي بيت (Bybit Pay)', true,
        'الحزمة 15: دفع Bybit عند إتمام الشراء — تأكيد تلقائي بمطالبة رقم العملية (order_claim_exchange_payment).')
on conflict (value) do nothing;

-- ---------------------------------------------------------------------
-- 5) بوابة التأكيد التلقائي للطلبات (داخلية — مفيش أي grant
--    لأدوار API). مرآة wallet_sms_autocredit_gate (نسخة 016) بنفس
--    الطبقات والترتيب والإعدادات، مع استبدالين فقط:
--      • مبلغ المقارنة بالسقف = server_total الطلب (بمرجعية
--        wallet_pay_order: server_total وإلا تحليل total_text).
--      • تاريخ «المُرسل الموثوق» بيتحسب من wallet_topups المؤكدة
--        (نفس مصدر البوابة الأصلية — سجل الدفعات المؤكدة الوحيد
--        لكل رقم في النظام؛ مفيش استبعاد لصف الطلب لأنه مش شحنة).
--    وشرط إضافي واحد أشد على حدث الشريك في القناة المزدوجة:
--    e.matched_topup_id is null — حدث استُخدم لتأكيد شحنة محفظة
--    لا يؤكد طلبًا (في عالم الشحن وحده لم تكن الحالة موجودة).
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

-- ---------------------------------------------------------------------
-- 6) محاولة مطابقة حدث واحد بطلب (service_role عبر دوال DEFINER
--    بس). مسار واحد بس — مبلغ + مُرسل + نافذة ±48 ساعة (طلبات
--    الشراء مفيهاش رقم عملية عند العميل زي الشحنات). قاعدة
--    الفرادة مزدوجة الاتجاه زي ما طلب التصميم: مرشّح وحيد للحدث
--    وحدث وحيد للطلب — أي تعدد = غموض من غير دفع ومن غير تغيير
--    حالة (الحدث بيضل unmatched لمراجعة الأدمن أو محاولة أعدل).
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

  return jsonb_build_object(
    'confirmed', true, 'match_state', 'matched',
    'event_id', v_event.id,
    'order_id', v_order.id, 'order_ref', v_order.order_ref,
    'basis', v_basis);
end;
$$;

-- ---------------------------------------------------------------------
-- 7) إعادة مطابقة الطلبات (service_role بس): مرآة
--    wallet_sms_rematch بنفس الانضباط (أقدم الأحداث أولًا، حد
--    مضغوط 1..200). الخلفية بتناديها بعد كل إدخال رسالة (بعد
--    إعادة مطابقة الشحنات)، وبتغطي الترتيبين: رسالة وصلت قبل
--    الطلب أو بعده.
-- ---------------------------------------------------------------------
create or replace function public.order_sms_rematch(
  p_limit int default 50
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_id uuid;
  v_res jsonb;
  v_checked int := 0;
  v_confirmed int := 0;
  v_ambiguous int := 0;
  v_gate int := 0;
begin
  for v_id in
    select id from public.wallet_sms_events
    where match_state = 'unmatched' and amount_egp is not null
    order by ingested_at asc
    limit v_limit
  loop
    v_checked := v_checked + 1;
    v_res := public.order_sms_try_match(v_id);
    if (v_res ->> 'confirmed')::boolean is true then
      v_confirmed := v_confirmed + 1;
    elsif v_res ->> 'reason' = 'ambiguous' then
      v_ambiguous := v_ambiguous + 1;
    elsif v_res ->> 'reason' = 'gate' then
      v_gate := v_gate + 1;
    end if;
  end loop;
  return jsonb_build_object(
    'checked', v_checked,
    'confirmed', v_confirmed,
    'ambiguous', v_ambiguous,
    'gate_held', v_gate,
    'still_unmatched', v_checked - v_confirmed - v_ambiguous - v_gate
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8) تأكيد العميل عند ضغط «أكّد الدفع» (anon + authenticated —
--    الدفع كضيف لازم يشتغل). إثبات المعرفة = رقم الطلب + حساب
--    المُرسل كما سجّله create_order؛ أي اختلاف = not_found واحدة.
--    الرد دايمًا JSON بحالة — مش استثناءات — عشان الواجهة تعرض
--    رسالة بشرية لكل حالة.
-- ---------------------------------------------------------------------
create or replace function public.order_confirm_payment(
  p_order_ref text,
  p_sender_account text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := btrim(coalesce(p_order_ref, ''));
  v_sender text := btrim(coalesce(p_sender_account, ''));
  v_order public.orders;
  v_events uuid[];
  v_res jsonb;
begin
  -- سقوف إدخال بنفس مقاس create_order (مرجع ≤64، مُرسل ≤128).
  if char_length(v_ref) < 1 or char_length(v_ref) > 64
     or char_length(v_sender) < 1 or char_length(v_sender) > 128 then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_order
  from public.orders
  where order_ref = v_ref;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_order.sender_account is null
     or btrim(v_order.sender_account) <> v_sender then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_order.status = 'payment_confirmed' then
    return jsonb_build_object(
      'status', 'confirmed', 'order_ref', v_order.order_ref);
  end if;
  if v_order.status <> 'new' then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- وسائل برّه سكك المحمول مش بتتأكد من الرسائل أبدًا — الرد
  -- pending محايد (الواجهة أصلًا مش بتنادي الدالة دي لغير السكك).
  if v_order.payment not in ('📱 فودافون كاش',
                             '⚡ إنستاباي (InstaPay)',
                             '🟢 اتصالات كاش') then
    return jsonb_build_object(
      'status', 'pending', 'order_ref', v_order.order_ref);
  end if;

  -- أحداث مرشّحة للطلب ده (نفس قاعدة المحاولة في القسم 6):
  -- صفر = لسه موصلش دليل (pending)، واحد = بنحاول مطابقته،
  -- أكتر = المحاولة نفسها بترجع ambiguous بقاعدة الفرادة.
  select coalesce(array_agg(id order by ingested_at asc), '{}'::uuid[])
    into v_events
  from public.wallet_sms_events e
  where e.match_state = 'unmatched'
    and e.amount_egp is not null
    and e.amount_egp = v_order.server_total
    and e.sender_account is not null
    and btrim(e.sender_account) = v_sender
    and v_order.created_at between
          coalesce(e.received_at, e.ingested_at) - interval '48 hours'
      and coalesce(e.received_at, e.ingested_at) + interval '48 hours';

  if coalesce(array_length(v_events, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'pending', 'order_ref', v_order.order_ref);
  end if;

  v_res := public.order_sms_try_match(v_events[1]);
  if (v_res ->> 'confirmed')::boolean is true then
    return jsonb_build_object(
      'status', 'confirmed', 'order_ref', v_order.order_ref);
  elsif v_res ->> 'reason' = 'ambiguous' then
    return jsonb_build_object(
      'status', 'ambiguous', 'order_ref', v_order.order_ref);
  end if;
  -- gate / order_decided / سباق اتحسم: كلها «لسه» من منظور العميل.
  return jsonb_build_object(
    'status', 'pending', 'order_ref', v_order.order_ref);
end;
$$;

-- ---------------------------------------------------------------------
-- 9) ربط مطالبة طلب بحدث إيداع مسجل (داخلية — مفيش أي grant
--    لأدوار API). مرآة wallet_bind_claim_to_event (014) بنفس ترتيب
--    الفحوص ونفس مفردات الحالات، مع اختلافين مقصودين:
--      • الناتج مش رصيد محفظة — هو orders.status →
--        'payment_confirmed' + صف تدقيق، والحدث بيتحسم
--        outcome='credited' (نفس علامة الاستهلاك) فمسار المحفظة
--        بيرجع already_credited لأي مطالبة لاحقة على نفس الإيداع.
--      • قاعدة مبلغ: قيمة الإيداع بالجنيه (round × السعر، نفس
--        تقريب 014) لازم تساوي server_total الطلب بالظبط —
--        اختلاف = pending من غير استهلاك (الأدمن/المراقب يحسم).
--    حالة خاصة موثّقة: طلب اتأكد من مسار تاني (أدمن يدويًا) قبل
--    ربط مطالبته — المطالبة بتتحسم confirmed من غير لمس الحدث:
--    مفيش أكل صامت لإيداع ممكن يكون دفعًا مكررًا يستحق المراجعة.
-- ---------------------------------------------------------------------
create or replace function public.order_bind_exchange_event(
  p_claim_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.order_exchange_claims;
  v_event public.wallet_deposit_events;
  v_order public.orders;
  v_rate numeric;
  v_amount_egp numeric(12,2);
begin
  select * into v_claim
  from public.order_exchange_claims
  where id = p_claim_id
  for update;
  if not found then
    raise exception 'order claim not found';
  end if;
  if v_claim.status <> 'pending' then
    return jsonb_build_object(
      'status', v_claim.status, 'claim_id', v_claim.id);
  end if;

  select * into v_order
  from public.orders
  where id = v_claim.order_id
  for update;
  if not found then
    raise exception 'order not found';
  end if;

  -- إعادة استخدام عبر الأسطح ممنوعة: مطالبة محفظة على نفس
  -- (السكة، المرجع) — بأي حالة — بتقفل الباب (مرآة ردّ
  -- wallet_claim_deposit على قيد الفرادة: already_claimed).
  if exists (
    select 1 from public.wallet_deposit_claims c
    where c.rail = v_claim.rail
      and c.exchange_ref = v_claim.exchange_ref
  ) then
    return jsonb_build_object(
      'status', 'already_claimed', 'claim_id', v_claim.id);
  end if;

  -- الحدث بالمرجع الرسمي، وإلا ببصمة المعاملة على السلسلة
  -- (العميل أوقات بيلزق الـ txId — مرآة wallet_claim_deposit:
  -- المطالبة بتتوحّد على المرجع الرسمي).
  select * into v_event
  from public.wallet_deposit_events
  where rail = v_claim.rail and exchange_ref = v_claim.exchange_ref;
  if not found then
    select * into v_event
    from public.wallet_deposit_events
    where rail = v_claim.rail and tx_hash = v_claim.exchange_ref
    order by created_at asc
    limit 1;
    if found then
      begin
        update public.order_exchange_claims
        set exchange_ref = v_event.exchange_ref
        where id = v_claim.id
        returning * into v_claim;
      exception when unique_violation then
        return jsonb_build_object(
          'status', 'already_claimed', 'claim_id', v_claim.id);
      end;
    end if;
  end if;

  if v_event.id is null then
    -- لسه مفيش حدث: المراقب هيوصّله، والحسم بييجي من ضغطة تانية
    -- أو من order_resolve_exchange_claims.
    return jsonb_build_object(
      'status', 'pending', 'claim_id', v_claim.id);
  end if;

  -- الحدث اتشحن قبل كده (نية أو طلب): مفيش حركة تانية.
  if v_event.outcome = 'credited' then
    return jsonb_build_object(
      'status', 'already_credited',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  -- حدث استثناء بنيوي من 011: مش إيداع قابل للربط — المطالبة
  -- بتفضل pending لعين الأدمن (مرآة 014).
  if v_event.outcome = 'invalid_amount' then
    return jsonb_build_object(
      'status', 'pending', 'reason', 'invalid_amount',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  -- أصل غير USDT: المطالبة بتتحسم رفضًا (مرآة 014).
  if v_event.asset is distinct from 'USDT' then
    update public.order_exchange_claims
    set status = 'rejected', resolved_at = now(),
        deposit_event_id = v_event.id
    where id = v_claim.id;
    return jsonb_build_object(
      'status', 'invalid_asset',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  if v_event.outcome not in ('no_matching_intent', 'intent_expired')
     or v_event.claim_id is not null then
    -- claim_id متعلّم = مطالبة محفظة ربطته خلاص (already_claimed)،
    -- وأي حالة تانية غير متوقعة = مش بنخمن (pending للأدمن).
    return jsonb_build_object(
      'status', case when v_event.claim_id is not null
                     then 'already_claimed' else 'pending' end,
      'reason', 'event_not_bindable',
      'claim_id', v_claim.id, 'event_id', v_event.id,
      'outcome', v_event.outcome);
  end if;

  -- التسعير بسعر لحظة الربط الحالي (مرآة مطالبات 014).
  select value::numeric into v_rate
  from public.wallet_settings where key = 'usdt_egp_rate';
  if v_rate is null or v_rate <= 0 then
    return jsonb_build_object(
      'status', 'rate_not_set',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;
  v_amount_egp := round(v_event.amount_usdt * v_rate, 2);
  if v_amount_egp is null or v_amount_egp <= 0 then
    update public.wallet_deposit_events
    set outcome = 'invalid_amount' where id = v_event.id;
    return jsonb_build_object(
      'status', 'pending', 'reason', 'invalid_amount',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;

  -- قاعدة مبلغ الطلب: الإيداع لازم يغطي إجمالي الطلب بالظبط.
  if v_amount_egp <> v_order.server_total then
    return jsonb_build_object(
      'status', 'pending', 'reason', 'amount_mismatch',
      'claim_id', v_claim.id, 'event_id', v_event.id,
      'amount_egp', v_amount_egp);
  end if;

  if v_order.status = 'payment_confirmed' then
    -- اتأكد من مسار تاني قبل الربط: المطالبة بتتحسم على حالها
    -- والحدث بيضل زي ما هو لمراجعة الأدمن (مش بيتلتهم صامتًا).
    update public.order_exchange_claims
    set status = 'confirmed', resolved_at = now(),
        deposit_event_id = v_event.id
    where id = v_claim.id;
    return jsonb_build_object(
      'status', 'confirmed', 'reason', 'order_already_paid',
      'claim_id', v_claim.id, 'event_id', v_event.id,
      'order_ref', v_order.order_ref);
  end if;
  if v_order.status <> 'new' then
    return jsonb_build_object(
      'status', 'pending', 'reason', 'order_not_payable',
      'claim_id', v_claim.id, 'event_id', v_event.id);
  end if;

  -- الحسم: حدث مستهلَك + طلب مؤكد + تدقيق + مطالبة محسومة،
  -- معاملة واحدة.
  update public.wallet_deposit_events
  set outcome = 'credited'
  where id = v_event.id;

  update public.orders
  set status = 'payment_confirmed'
  where id = v_order.id;

  insert into public.order_payment_matches (order_id, event_id, basis, gate)
  values (v_order.id, v_event.id, 'exchange:' || v_claim.rail, null);

  update public.order_exchange_claims
  set status = 'confirmed', resolved_at = now(),
      deposit_event_id = v_event.id
  where id = v_claim.id;

  return jsonb_build_object(
    'status', 'confirmed',
    'claim_id', v_claim.id,
    'event_id', v_event.id,
    'order_ref', v_order.order_ref,
    'amount_egp', v_amount_egp,
    'amount_usdt', v_event.amount_usdt);
end;
$$;

-- ---------------------------------------------------------------------
-- 10) مطالبة عميل بطلب + رقم عملية منصة (anon + authenticated):
--     إنشاء المطالبة + محاولة ربط فورية. نفس انضباط
--     order_confirm_payment في إثبات المعرفة و not_found، ونفس
--     مفردات حالات مسار المحفظة (014/__walletClaimStatusAr).
--     إعادة الضغط بنفس (الطلب، المرجع) بترجع نفس المطالبة —
--     إيدمبوتنت بنيويًا.
-- ---------------------------------------------------------------------
create or replace function public.order_claim_exchange_payment(
  p_order_ref text,
  p_sender_account text,
  p_rail text,
  p_exchange_ref text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := btrim(coalesce(p_order_ref, ''));
  v_sender text := btrim(coalesce(p_sender_account, ''));
  v_exref text := btrim(coalesce(p_exchange_ref, ''));
  v_order public.orders;
  v_claim public.order_exchange_claims;
  v_expected_label text;
  v_res jsonb;
begin
  if char_length(v_ref) < 1 or char_length(v_ref) > 64
     or char_length(v_sender) < 1 or char_length(v_sender) > 128 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if p_rail is null or p_rail not in ('binance', 'bybit') then
    return jsonb_build_object('status', 'invalid_rail');
  end if;
  -- نفس حدود مرجع 014 (6..128) ونفس الرد.
  if char_length(v_exref) < 6 or char_length(v_exref) > 128 then
    return jsonb_build_object('status', 'invalid_ref');
  end if;

  select * into v_order
  from public.orders
  where order_ref = v_ref;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_order.sender_account is null
     or btrim(v_order.sender_account) <> v_sender then
    return jsonb_build_object('status', 'not_found');
  end if;
  -- السكة لازم تطابق وسيلة الطلب نفسه: إيداع Binance لا يؤكد
  -- طلب فودافون، ومرجع Binance لا يؤكد طلب Bybit.
  v_expected_label := case p_rail
    when 'binance' then '🟡 باينانس باي (Binance Pay)'
    else '🟡 باي بيت (Bybit Pay)' end;
  if v_order.payment <> v_expected_label then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_order.status = 'payment_confirmed' then
    return jsonb_build_object(
      'status', 'confirmed', 'order_ref', v_order.order_ref);
  end if;
  if v_order.status <> 'new' then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- إيدمبوتنسي لكل (طلب، مرجع): نفس المطالبة بترجع بحالتها.
  select * into v_claim
  from public.order_exchange_claims
  where order_id = v_order.id and exchange_ref = v_exref;
  if not found then
    begin
      insert into public.order_exchange_claims
        (order_id, rail, exchange_ref)
      values
        (v_order.id, p_rail, v_exref)
      returning * into v_claim;
    exception when unique_violation then
      -- المرجع ده على مطالبة طلب تاني (قيد الفرادة على الجدول
      -- كله): ردّ واحد لا يكشف شيئًا عن صاحبه.
      return jsonb_build_object('status', 'already_claimed');
    end;
  end if;

  if v_claim.status = 'confirmed' then
    return jsonb_build_object(
      'status', 'confirmed', 'order_ref', v_order.order_ref,
      'claim_id', v_claim.id);
  end if;
  if v_claim.status = 'rejected' then
    -- الرفض الوحيد في المسار ده هو أصل غير USDT.
    return jsonb_build_object(
      'status', 'invalid_asset', 'claim_id', v_claim.id);
  end if;

  v_res := public.order_bind_exchange_event(v_claim.id);
  return coalesce(v_res, jsonb_build_object('status', 'pending'))
         || jsonb_build_object('order_ref', v_order.order_ref);
end;
$$;

-- ---------------------------------------------------------------------
-- 11) حسم جماعي للمطالبات المعلّقة (service_role بس — حلقة
--     مراقب الإيداعات بتناديها بعد ما تسجل أحداث جديدة): أقدم
--     المطالبات أولًا، بنفس منطق الربط الفوري بالحرف.
-- ---------------------------------------------------------------------
create or replace function public.order_resolve_exchange_claims(
  p_limit int default 50
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_id uuid;
  v_res jsonb;
  v_checked int := 0;
  v_confirmed int := 0;
begin
  for v_id in
    select id from public.order_exchange_claims
    where status = 'pending'
    order by created_at asc
    limit v_limit
  loop
    v_checked := v_checked + 1;
    v_res := public.order_bind_exchange_event(v_id);
    if v_res ->> 'status' = 'confirmed' then
      v_confirmed := v_confirmed + 1;
    end if;
  end loop;
  return jsonb_build_object(
    'checked', v_checked,
    'confirmed', v_confirmed,
    'still_pending', v_checked - v_confirmed
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 12) الصلاحيات: نفس فلسفة عائلات 013/014 — المطابقات وإعادة
--     المطابقة والحسم service_role بس، والبوابة والربط داخليات
--     بلا أي grant لأدوار API، وتأكيد العميل anon+authenticated
--     (الدفع كضيف) مع إثبات المعرفة جوّه الدالة.
-- ---------------------------------------------------------------------
revoke all on function public.order_sms_autocredit_gate(bigint, uuid) from public;
revoke all on function public.order_sms_try_match(uuid) from public;
revoke all on function public.order_sms_rematch(int) from public;
revoke all on function public.order_confirm_payment(text, text) from public;
revoke all on function public.order_bind_exchange_event(uuid) from public;
revoke all on function public.order_claim_exchange_payment(text, text, text, text) from public;
revoke all on function public.order_resolve_exchange_claims(int) from public;

grant execute on function public.order_sms_try_match(uuid) to service_role;
grant execute on function public.order_sms_rematch(int) to service_role;
grant execute on function public.order_resolve_exchange_claims(int) to service_role;
-- order_sms_autocredit_gate و order_bind_exchange_event: من غير
-- أي grant لأدوار الـ API عمدًا — سطحهم هو دوال الـ SECURITY
-- DEFINER اللي بتناديهم بس.
grant execute on function public.order_confirm_payment(text, text)
  to anon, authenticated, service_role;
grant execute on function public.order_claim_exchange_payment(text, text, text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
