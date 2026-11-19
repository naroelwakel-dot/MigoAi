-- =====================================================================
-- تدريب الحزمة 15 — 01: البذرة (بيانات وهمية بالكامل — مراجع DRILL15-)
-- =====================================================================
-- ⚠️ راجع ناتج 00_inspect.sql الأول. كل الصفوف هنا وهمية وموسومة،
-- والتنظيف (04) بيشيلها بالمعرّفات دي بالظبط ويرجّع الإعدادات
-- لقيمها المحفوظة هنا في _drill15_state.
-- =====================================================================

-- حالة التدريب: قيم الإعدادات الأصلية عشان التنظيف يرجّعها،
-- ومعرّفات وقت التشغيل اللي الحالات بتتبادلها (claim ids).
create table if not exists public._drill15_state (
  k text primary key,
  v text
);

-- ---------------------------------------------------------------------
-- إعدادات بوابة الرسائل + سعر USDT: بنحفظ الأصلي وبنثبّت قيم
-- التدريب الحتمية (سقف 500، حد ثقة 2، حزمة تطبيق وهمية مسموحة،
-- سعر 50 ج/USDT عشان حسابات المنصات تبقى أرقامًا صحيحة).
-- ---------------------------------------------------------------------
insert into public._drill15_state (k, v)
select 'setting:' || key, value from public.wallet_settings
where key in ('sms_autocredit_cap_egp', 'sms_trusted_min_confirmed',
              'wallet_app_package', 'usdt_egp_rate')
on conflict (k) do nothing;

insert into public.wallet_settings (key, value, note) values
  ('sms_autocredit_cap_egp', '500', 'drill15'),
  ('sms_trusted_min_confirmed', '2', 'drill15'),
  ('usdt_egp_rate', '50', 'drill15')
on conflict (key) do update set value = excluded.value;

-- حزمة محفظة التدريب بتنضم لقائمة الحزم المسموحة (مع الحفاظ على
-- القائمة الأصلية محفوظة فوق للترجيع).
update public.wallet_settings
set value = case
    when coalesce(value, '') = '' then 'com.drill.wallet'
    when position('com.drill.wallet' in value) > 0 then value
    else value || ',com.drill.wallet'
  end
where key = 'wallet_app_package';
insert into public.wallet_settings (key, value, note)
select 'wallet_app_package', 'com.drill.wallet', 'drill15'
where not exists (
  select 1 from public.wallet_settings where key = 'wallet_app_package');

-- ---------------------------------------------------------------------
-- عميل تدريب وهمي (لحالات المحفظة/المطالبات) — نفس تقنية تدريب
-- الحزمة 11 في إنشاء مستخدم auth وهمي.
-- ---------------------------------------------------------------------
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'drill15@example.invalid',
  '', now(), 'authenticated', 'authenticated',
  '{}'::jsonb, '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- طلبات الشراء الوهمية (إدخال مباشر — التدريب بيختبر المطابقة
-- والتأكيد، مش create_order). كلها 'new' ما عدا ما تلاحظه الحالات.
-- ---------------------------------------------------------------------
insert into public.orders
  (order_ref, status, items, total_text, server_total, payment,
   sender_account, customer_email, idempotency_key, created_at)
values
  -- سكك المحمول
  ('DRILL15-O01', 'new', '[{"name":"drill","qty":1,"price":300}]'::jsonb, '300', 300,
   '📱 فودافون كاش', '01001500001', 'drill15@example.invalid', 'drill15-o01', now()),
  ('DRILL15-O02', 'new', '[{"name":"drill","qty":1,"price":310}]'::jsonb, '310', 310,
   '📱 فودافون كاش', '01001500002', 'drill15@example.invalid', 'drill15-o02', now()),
  ('DRILL15-O03', 'new', '[{"name":"drill","qty":1,"price":320}]'::jsonb, '320', 320,
   '📱 فودافون كاش', '01001500003', 'drill15@example.invalid', 'drill15-o03', now()),
  ('DRILL15-O04A', 'new', '[{"name":"drill","qty":1,"price":330}]'::jsonb, '330', 330,
   '⚡ إنستاباي (InstaPay)', '01001500004', 'drill15@example.invalid', 'drill15-o04a', now()),
  ('DRILL15-O04B', 'new', '[{"name":"drill","qty":1,"price":330}]'::jsonb, '330', 330,
   '⚡ إنستاباي (InstaPay)', '01001500004', 'drill15@example.invalid', 'drill15-o04b', now()),
  ('DRILL15-O05', 'new', '[{"name":"drill","qty":1,"price":340}]'::jsonb, '340', 340,
   '🟢 اتصالات كاش', '01001500005', 'drill15@example.invalid', 'drill15-o05', now()),
  ('DRILL15-O06', 'new', '[{"name":"drill","qty":1,"price":600}]'::jsonb, '600', 600,
   '📱 فودافون كاش', '01001500006', 'drill15@example.invalid', 'drill15-o06', now()),
  ('DRILL15-O09', 'new', '[{"name":"drill","qty":1,"price":350}]'::jsonb, '350', 350,
   '💳 فيزا وماستركارد (Cards)', '01001500009', 'drill15@example.invalid', 'drill15-o09', now()),
  ('DRILL15-O10', 'new', '[{"name":"drill","qty":1,"price":360}]'::jsonb, '360', 360,
   '📱 فودافون كاش', '01001500010', 'drill15@example.invalid', 'drill15-o10',
   now() - interval '49 hours'),
  ('DRILL15-O11', 'new', '[{"name":"drill","qty":1,"price":370}]'::jsonb, '370', 370,
   '🟢 اتصالات كاش', '01001500011', 'drill15@example.invalid', 'drill15-o11', now()),
  -- سكك المنصات (الإجمالي 500 = 10 USDT × سعر التدريب 50)
  ('DRILL15-OX1', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باينانس باي (Binance Pay)', 'payid-drill-1', 'drill15@example.invalid', 'drill15-ox1', now()),
  ('DRILL15-OX2', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باينانس باي (Binance Pay)', 'payid-drill-2', 'drill15@example.invalid', 'drill15-ox2', now()),
  ('DRILL15-OX3', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باينانس باي (Binance Pay)', 'payid-drill-3', 'drill15@example.invalid', 'drill15-ox3', now()),
  ('DRILL15-OX4', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باينانس باي (Binance Pay)', 'payid-drill-4', 'drill15@example.invalid', 'drill15-ox4', now()),
  ('DRILL15-OX5', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باينانس باي (Binance Pay)', 'payid-drill-5', 'drill15@example.invalid', 'drill15-ox5', now()),
  ('DRILL15-OX6', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باي بيت (Bybit Pay)', 'uid-drill-6', 'drill15@example.invalid', 'drill15-ox6', now()),
  ('DRILL15-OX7', 'new', '[{"name":"drill","qty":1,"price":500}]'::jsonb, '500', 500,
   '🟡 باينانس باي (Binance Pay)', 'payid-drill-7', 'drill15@example.invalid', 'drill15-ox7', now())
on conflict (order_ref) do nothing;

-- طلب شحن محفظة معلّق (حالة 5): الحدث بتاعه هيتستهلك في مسار
-- الشحن الأول، فطلب الشراء بنفس (المُرسل، المبلغ) مش هيلاقيه.
insert into public.wallet_topups
  (customer_id, amount_egp, payment_method, sender_account, status)
values
  ('11111111-1111-4111-8111-111111111111', 340,
   '🟢 اتصالات كاش', '01001500005', 'pending');

-- ---------------------------------------------------------------------
-- أحداث الرسائل الوهمية (بأشكال المحلّل الحقيقية: parsed.origin
-- و source و package_name زي ما الجسر بيبعت بالظبط).
-- ---------------------------------------------------------------------
insert into public.wallet_sms_events
  (received_at, sender_id, body, parsed, amount_egp, sender_account,
   transfer_ref, dedupe_key, source, package_name)
values
  -- حالة 1: رسالة رسمية + إشعار تطبيق رسمي (قناة مزدوجة)
  (now(), 'VodafoneCash', 'drill15 sms body e01a',
   '{"origin":"official","template":"drill"}'::jsonb,
   300, '01001500001', null, 'drill15-e01a', 'sms', null),
  (now(), 'com.drill.wallet', 'drill15 app body e01b',
   '{"origin":"official","template":"drill"}'::jsonb,
   300, '01001500001', null, 'drill15-e01b', 'app_notification', 'com.drill.wallet'),
  -- حالة 2: مبلغ مختلف عن الطلب (999 مقابل 310)
  (now(), 'VodafoneCash', 'drill15 sms body e02',
   '{"origin":"official","template":"drill"}'::jsonb,
   999, '01001500002', null, 'drill15-e02', 'sms', null),
  -- حالة 3: مُرسل مختلف (01001509999 مقابل 01001500003)
  (now(), 'VodafoneCash', 'drill15 sms body e03',
   '{"origin":"official","template":"drill"}'::jsonb,
   320, '01001509999', null, 'drill15-e03', 'sms', null),
  -- حالة 4: حدث واحد لطلبين متطابقين
  (now(), 'InstaPay', 'drill15 sms body e04',
   '{"origin":"official","template":"drill"}'::jsonb,
   330, '01001500004', null, 'drill15-e04', 'sms', null),
  -- حالة 4ب: حدثان رسميان لطلب واحد (نفس المُرسل والمبلغ)
  (now(), 'etisalat', 'drill15 sms body e11a',
   '{"origin":"official","template":"drill"}'::jsonb,
   370, '01001500011', null, 'drill15-e11a', 'sms', null),
  (now(), 'etisalat', 'drill15 sms body e11b',
   '{"origin":"official","template":"drill"}'::jsonb,
   370, '01001500011', null, 'drill15-e11b', 'sms', null),
  -- حالة 5: حدث هيتستهلك في مسار الشحن
  (now(), 'etisalat', 'drill15 sms body e05',
   '{"origin":"official","template":"drill"}'::jsonb,
   340, '01001500005', null, 'drill15-e05', 'sms', null),
  -- حالة 6: قناة واحدة + فوق السقف (600 > 500) + مُرسل بلا تاريخ
  (now(), 'VodafoneCash', 'drill15 sms body e06',
   '{"origin":"official","template":"drill"}'::jsonb,
   600, '01001500006', null, 'drill15-e06', 'sms', null),
  -- حالة 9: حدث مطابق لطلب وسيلته برّه السكك (Cards)
  (now(), 'VodafoneCash', 'drill15 sms body e09',
   '{"origin":"official","template":"drill"}'::jsonb,
   350, '01001500009', null, 'drill15-e09', 'sms', null),
  -- حالة 10: حدث «دلوقتي» لطلب اتعمل من 49 ساعة (برّه النافذة)
  (now(), 'VodafoneCash', 'drill15 sms body e10',
   '{"origin":"official","template":"drill"}'::jsonb,
   360, '01001500010', null, 'drill15-e10', 'sms', null);

-- ---------------------------------------------------------------------
-- أحداث إيداع منصات وهمية + مطالبة محفظة سابقة (حالة 12).
-- ---------------------------------------------------------------------
insert into public.wallet_deposit_events
  (rail, exchange_ref, asset, amount_usdt, tx_hash, outcome)
values
  ('binance', 'DRILL15-BIN-001', 'USDT', 10, null, 'no_matching_intent'),
  ('binance', 'DRILL15-BIN-002', 'USDT', 10, null, 'no_matching_intent'),
  ('binance', 'DRILL15-BIN-003', 'USDT', 10, null, 'no_matching_intent'),
  ('binance', 'DRILL15-BIN-004', 'USDT', 9,  null, 'no_matching_intent'),
  ('binance', 'DRILL15-X-006',   'USDT', 10, null, 'no_matching_intent'),
  ('binance', 'DRILL15-BIN-007', 'USDC', 10, null, 'no_matching_intent')
on conflict (rail, exchange_ref) do nothing;

insert into public.wallet_deposit_claims
  (customer_id, rail, exchange_ref, status)
values
  ('11111111-1111-4111-8111-111111111111', 'binance', 'DRILL15-BIN-002', 'pending')
on conflict (rail, exchange_ref) do nothing;

select 'DRILL15 SEED ok' as drill15;
