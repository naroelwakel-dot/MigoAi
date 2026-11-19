-- =====================================================================
-- تراجع هجرة 015 (الحزمة 15): تأكيد دفع الطلبات تلقائيًا
-- =====================================================================
-- بيشيل كل كائنات الهجرة: الدوال، الجدولين، عمود الربط، وصفّ
-- وسيلة Bybit. ⚠️ التراجع تراجع كود مش تراجع فلوس: أي طلب اتأكد
-- (payment_confirmed) عبر المسارات دي بيضل مؤكدًا — عكس تأكيد
-- حقيقي قرار تشغيلي منفصل، وصفوف التدريب بيشيلها تنظيف التدريب
-- (drills/04_cleanup.sql) مش التراجع.
-- =====================================================================

drop function if exists public.order_resolve_exchange_claims(int);
drop function if exists public.order_claim_exchange_payment(text, text, text, text);
drop function if exists public.order_bind_exchange_event(uuid);
drop function if exists public.order_confirm_payment(text, text);
drop function if exists public.order_sms_rematch(int);
drop function if exists public.order_sms_try_match(uuid);
drop function if exists public.order_sms_autocredit_gate(bigint, uuid);

drop table if exists public.order_exchange_claims;
drop table if exists public.order_payment_matches;

alter table public.wallet_sms_events
  drop column if exists matched_order_id;

delete from public.payment_methods
where value = '🟡 باي بيت (Bybit Pay)';

notify pgrst, 'reload schema';
