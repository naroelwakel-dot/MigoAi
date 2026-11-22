-- =====================================================================
-- هجرة 031: حالة «اتسوّى يدويًا» لأحداث الإيداع (لوحة التحكم — م٤)
-- =====================================================================
-- المشكلة: حدث إيداع اتسوّى برّه المنصة بالكامل (العميل دفع فعلًا
-- وخد حسابه يدويًا — حالة Bybit int-41014455، ‏5 USDT، 2026-11-18)
-- ما يقدرش يخرج من حالة «ينتظر» في صندوق الأحداث: نتيجته الحالية
-- no_matching_intent، ومفيش مسار ائتمان حقيقي يستهلكه (مفيش مطالبة
-- ولا نية ولا شحنة بوت — التسوية حصلت برّه النظام)، وعلّمه
-- credited كان هيزوّر الدفتر (مفيش محفظة اتشحنت)، واختراع صف
-- مطالبة/نية كان هيخترع فعل عميل ما حصلش.
--
-- الإصلاح (الأصغر والأصدق): قيمة نتيجة جديدة واحدة
-- 'manually_settled' في قيد نتائج wallet_deposit_events — بتقول
-- بالحرف إن الحدث اتقفل بتسوية يدوية خارج المنصة بقرار المالك.
-- مفيش أي تغيير تاني في المخطط: لا عمود جديد، لا دالة جديدة،
-- لا جدول جديد.
--
-- أمان بنيوي: مسارات الائتمان القائمة مش بتقبل القيمة دي أصلًا —
-- bot_exchange_candidates / bot_exchange_claim (هجرة 018) بيقبلوا
-- no_matching_intent / intent_expired بس، فالحدث المتسوّي يدويًا
-- مستحيل يتحجز أو يتشحن بعد كده بأي سطح. الكتابة نفسها بتحصل من
-- طبقة اللوحة (control/events.ts: settleDepositEvent) بكتابة
-- محروسة بالحالة الحالية وبالروابط الفاضية، على عمود outcome بس.
--
-- القيد بيتفكّ بنفس أسلوب هجرة 022 (بلا اسم ثابت): أي قيد فحص على
-- الجدول تعريفه بيحتوي 'no_matching_intent' — وهو قيد النتائج
-- وحده — وبعدين بيتبني من جديد باسمه المعروف وبالمجموعة الأصلية
-- + القيمة الجديدة. أي قيمة نتيجة موجودة فعليًا برّه المجموعة دي
-- بتوقّع التطبيق بصوت عالي وقت إضافة القيد (فشل آمن مسموع).
-- =====================================================================

-- ---------------------------------------------------------------------
-- توسيع قيد نتائج أحداث الإيداع (إضافة 'manually_settled')
-- ---------------------------------------------------------------------
do $$
declare
  v_con record;
begin
  for v_con in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.wallet_deposit_events'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%no_matching_intent%'
  loop
    execute format(
      'alter table public.wallet_deposit_events drop constraint %I',
      v_con.conname);
  end loop;
end $$;

alter table public.wallet_deposit_events
  add constraint wallet_deposit_events_outcome_check
  check (outcome in ('received', 'credited', 'no_matching_intent',
                     'intent_expired', 'invalid_asset', 'invalid_amount',
                     'manually_settled'));

notify pgrst, 'reload schema';
