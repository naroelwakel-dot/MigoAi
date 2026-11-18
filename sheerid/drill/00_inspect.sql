-- 00: فحص قبل التدريب — أعمدة الجداول المعنية + وجود الدوال/الجداول.
SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders','catalog','store_executions','store_refunds',
                     'customer_wallets','wallet_transactions','sheerid_jobs')
GROUP BY table_name
ORDER BY table_name;

SELECT proname FROM pg_proc
WHERE proname IN ('refund_order','create_order','get_invoice','wallet_pay_order')
ORDER BY proname;
