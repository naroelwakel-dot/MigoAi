-- تراجع هجرة 017 (شحن محفظة البوت التلقائي من إيصالات الرسائل).
-- بيشيل الدالتين والعمود. أي حدث اتحجز للبوت قبل التراجع بيرجع
-- لحالته الطبيعية بشيل العمود نفسه (الحجز كان علامة بس — القيد
-- حصل في قاعدة البوت وبيفضل سليم هناك).

drop function if exists public.bot_sms_claim(uuid, text, uuid, text);
drop function if exists public.bot_sms_candidates(int);

drop index if exists public.wallet_sms_events_bot_topup_idx;
alter table public.wallet_sms_events
  drop column if exists matched_bot_topup_id;

notify pgrst, 'reload schema';
