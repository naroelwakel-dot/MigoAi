-- تراجع هجرة 022 (دوال محفظة داخلية للوحة التحكم — م١-أ).
-- بيشيل الدالتين الداخليتين بس، وبيضيّق قيد أنواع الدفتر لمجموعة
-- هجرة 009 الأصلية — التضييق ده بيتم بس لو مفيش أي قيد دفتر بنوع
-- إداري اتكتب فعلًا (الدفتر append-only من هجرة 020 فالصفوف مش
-- بتتمسح؛ لو فيه قيود admin_* التضييق بيعدّي بتخطّي وتنبيه بدل
-- ما يفشل أو يكسر التاريخ).

drop function if exists
  public.wallet_adjust_internal(uuid, numeric, text, text, text);
drop function if exists public.wallet_reject_topup_internal(uuid, text);

do $$
begin
  if exists (
    select 1 from public.wallet_transactions
    where kind in ('admin_deposit', 'admin_compensation',
                   'admin_correction')
  ) then
    raise notice
      'migration 022 rollback: admin_* ledger rows exist — kind check left widened';
  else
    alter table public.wallet_transactions
      drop constraint if exists wallet_transactions_kind_check;
    alter table public.wallet_transactions
      add constraint wallet_transactions_kind_check
      check (kind in ('topup', 'debit', 'refund', 'adjust'));
  end if;
end $$;

notify pgrst, 'reload schema';
