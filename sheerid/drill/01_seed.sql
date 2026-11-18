-- 01: بذرة التدريب (Staging بس — المراجع DRILL-SH-).
-- ⚠️ راجع ناتج 00_inspect.sql الأول: الأعمدة هنا هي المؤكدة من هجرات
-- المتجر (008/010) ومن طبقة store_db — لو الفحص بيّن اختلاف، ظبّط هنا.

-- صف كتالوج منتج التحقق (نفس الصف اللي هيتنشر في الإنتاج عند الإطلاق):
insert into public.catalog (sku, price, kind)
values ('Google Student (سنة كاملة)', 280, 'sub')
on conflict (sku) do update set price = excluded.price, kind = excluded.kind;

-- عميل محفظة وهمي للتدريب + محفظته (رصيد صفري — الاسترداد هو اللي هيحرّكه):
insert into public.customer_wallets (customer_id, balance_egp)
values ('11111111-1111-1111-1111-111111111111', 0)
on conflict (customer_id) do update set balance_egp = 0;

-- طلب محفظة مدفوع (حالة مؤكدة + وسيلة محفظة الموقع + عميل مسجّل):
insert into public.orders
  (order_ref, status, items, server_total, payment, sender_account,
   customer_email, customer_id, idempotency_key)
values
  ('DRILL-SH-001', 'payment_confirmed',
   '[{"name":"Google Student (سنة كاملة)","qty":1,"price":280,"unit_price":280}]'::jsonb,
   280, '💰 محفظة الموقع', 'drill-wallet@example.com',
   'drill-wallet@example.com', '11111111-1111-1111-1111-111111111111',
   'drill-sh-001')
on conflict (order_ref) do nothing;

-- طلب تحويل نقدي مدفوع (فودافون كاش — من غير عميل محفظة):
insert into public.orders
  (order_ref, status, items, server_total, payment, sender_account,
   customer_email, idempotency_key)
values
  ('DRILL-SH-002', 'payment_confirmed',
   '[{"name":"Google Student (سنة كاملة)","qty":1,"price":280,"unit_price":280}]'::jsonb,
   280, 'فودافون كاش', '01000000000',
   'drill-cash@example.com', 'drill-sh-002')
on conflict (order_ref) do nothing;
