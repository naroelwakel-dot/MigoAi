-- تراجع هجرة 019 (فك حجز البوت — تعويض الحجز F-07).
-- بيشيل دالتي فك الحجز بس. أي حدث في حالة محجوزة وقت التراجع
-- بيضل زي ما هو (الحجز علامة استهلاك سليمة في 017/018) — التراجع
-- بيسحب آلية التعويض، مش بيفك حجوزات قائمة.

drop function if exists public.bot_sms_unclaim(uuid, text, uuid);
drop function if exists public.bot_exchange_unclaim(uuid, text);

notify pgrst, 'reload schema';
