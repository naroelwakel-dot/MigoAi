-- 04: تنظيف التدريب (Staging بس) — بيحذف بمراجع DRILL-SH- بس.
DELETE FROM public.sheerid_jobs WHERE order_ref LIKE 'DRILL-SH-%';
DELETE FROM public.wallet_transactions WHERE order_ref LIKE 'DRILL-SH-%';
DELETE FROM public.store_refunds WHERE order_ref LIKE 'DRILL-SH-%';
DELETE FROM public.store_executions WHERE order_ref LIKE 'DRILL-SH-%';
DELETE FROM public.orders WHERE order_ref LIKE 'DRILL-SH-%';
DELETE FROM public.customer_wallets
WHERE customer_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.catalog WHERE sku = 'Google Student (سنة كاملة)';

-- اختياري (فعّله يدويًا بس لو التدريب خلّص ومش هيتعاد):
-- DROP TABLE IF EXISTS public.sheerid_jobs;
