-- تراجع هجرة 027 (قفل صلاحيات الدوال الداخلية — م٦-أ).
-- بيرجّع منح التنفيذ لـ anon وauthenticated على الدوال الخمسة زي
-- ما كان الـ ACL الحي قبل 027 بالظبط ({postgres, anon,
-- authenticated, service_role}) — منح postgres وservice_role ما
-- اتلمسوش في 027 فمش محتاجين إعادة. التراجع ده بيرجّع الثقب
-- الموثّق في ترويسة 027، فما يتنفّذش إلا بقرار صريح.

grant execute on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  to anon, authenticated;
grant execute on function
  public.wallet_set_balance_internal(uuid, numeric, text, text, text)
  to anon, authenticated;
grant execute on function public.wallet_credit_topup_internal(uuid, text)
  to anon, authenticated;
grant execute on function public.wallet_reject_topup_internal(uuid, text)
  to anon, authenticated;
grant execute on function public.ledger_reconcile()
  to anon, authenticated;

notify pgrst, 'reload schema';
