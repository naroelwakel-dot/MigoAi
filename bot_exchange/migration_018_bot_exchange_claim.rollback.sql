-- تراجع هجرة 018 (شحن محفظة البوت التلقائي من إيداعات المنصات).
-- بيشيل الدالتين والعمود. أي حدث اتحجز للبوت قبل التراجع: شيل
-- العمود بيشيل علامة البوت، بس outcome='credited' بتفضل زي ما هي
-- (الاستهلاك حصل فعلًا والقيد اتكتب في قاعدة البوت) — التراجع
-- بيرجع «سطح» البوت بس، مش بيحرّر إيداعات اتشحنت.

drop function if exists public.bot_exchange_claim(uuid, text, numeric, timestamptz);
drop function if exists public.bot_exchange_candidates(int);

drop index if exists public.wallet_deposit_events_bot_topup_idx;
alter table public.wallet_deposit_events
  drop column if exists matched_bot_topup_id;

notify pgrst, 'reload schema';
