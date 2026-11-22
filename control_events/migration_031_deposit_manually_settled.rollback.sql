-- تراجع هجرة 031 (حالة «اتسوّى يدويًا» لأحداث الإيداع — م٤).
-- بيضيّق قيد نتائج wallet_deposit_events لمجموعة القيم الست
-- الأصلية — التضييق ده بيتم بس لو مفيش أي حدث إيداع نتيجته
-- 'manually_settled' فعلًا (الصفوف مش بتتمسح؛ لو فيه أحداث
-- متسوّية يدويًا التضييق بيعدّي بتخطّي وتنبيه بدل ما يفشل أو
-- يكسر التاريخ).

do $$
begin
  if exists (
    select 1 from public.wallet_deposit_events
    where outcome = 'manually_settled'
  ) then
    raise notice
      'migration 031 rollback: manually_settled deposit events exist — outcome check left widened';
  else
    alter table public.wallet_deposit_events
      drop constraint if exists wallet_deposit_events_outcome_check;
    alter table public.wallet_deposit_events
      add constraint wallet_deposit_events_outcome_check
      check (outcome in ('received', 'credited', 'no_matching_intent',
                         'intent_expired', 'invalid_asset',
                         'invalid_amount'));
  end if;
end $$;

notify pgrst, 'reload schema';
