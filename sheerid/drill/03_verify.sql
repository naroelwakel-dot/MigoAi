-- 03: التحقق النهائي — القيم المتوقعة في تعليق كل استعلام.

-- A1: رصيد محفظة العميل الوهمي = 280 (الاسترداد رجع له كامل).
SELECT balance_egp FROM public.customer_wallets
WHERE customer_id = '11111111-1111-1111-1111-111111111111';

-- A2: حركة استرداد واحدة بس للطلب (kind=refund, ref=wallet-refund:<exec>).
SELECT kind, amount_egp, ref, order_ref FROM public.wallet_transactions
WHERE order_ref = 'DRILL-SH-001';

-- A3+B1: الالتزامات — محفظة paid_back، نقدي obligation_recorded،
-- وكل واحد بالمبلغ 280 وحساب المُرسل الصح.
SELECT order_ref, amount_egp, payment_method, sender_account, state
FROM public.store_refunds
WHERE order_ref IN ('DRILL-SH-001','DRILL-SH-002')
ORDER BY order_ref;

-- A4+B2: الطلبات refunded والتنفيذات refunded.
SELECT order_ref, status FROM public.orders
WHERE order_ref IN ('DRILL-SH-001','DRILL-SH-002') ORDER BY order_ref;
SELECT order_ref, status, refund_state, supplier_key FROM public.store_executions
WHERE order_ref IN ('DRILL-SH-001','DRILL-SH-002') ORDER BY order_ref;

-- D1: عملية التحقق اكتملت واتعلّمت مسلّمة.
SELECT order_ref, status, job_id, delivered_at IS NOT NULL AS delivered
FROM public.sheerid_jobs WHERE order_ref = 'DRILL-SH-002';
