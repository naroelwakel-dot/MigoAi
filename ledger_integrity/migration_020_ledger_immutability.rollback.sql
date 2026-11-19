-- تراجع هجرة 020 (دفتر محفظة المتجر append-only + دالة المطابقة).
-- بيشيل الزنادين والدالتين بس — مفيش أي تعديل على بيانات الدفتر
-- أو الأرصدة، فالتراجع نفسه آمن في أي وقت.

drop trigger if exists wallet_transactions_no_truncate
    on public.wallet_transactions;
drop trigger if exists wallet_transactions_append_only
    on public.wallet_transactions;
drop function if exists public.wallet_transactions_append_only();
drop function if exists public.ledger_reconcile();

notify pgrst, 'reload schema';
