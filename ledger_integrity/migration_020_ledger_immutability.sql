-- =====================================================================
-- هجرة 020: دفتر محفظة المتجر append-only + دالة مطابقة (تدقيق F-05)
-- =====================================================================
-- نتيجة تدقيق سلامة الفلوس (2026-11-19، F-05): عدم قابلية دفتر
-- `wallet_transactions` للتعديل كانت محمية بالكود بس — أي حامل لمفتاح
-- الخدمة يقدر يعمل UPDATE/DELETE على صفوف الدفتر ويعيد كتابة التاريخ
-- بصمت، وبعدين يظبط `customer_wallets.balance_egp` على التاريخ
-- الجديد من غير ما أي فحص يكتشفه. الحماية هنا بتنزل لمستوى القاعدة.
--
-- اللي هنا:
--   1) زناد BEFORE UPDATE OR DELETE على `wallet_transactions` بيرفع
--      استثناء دايمًا (الدفتر append-only)، وزناد BEFORE TRUNCATE
--      بيقفل باب الالتفاف البديهي على زناد الحذف.
--   2) دالة `ledger_reconcile()` قراءة-بس: بترجع العملاء اللي رصيدهم
--      المخزّن في `customer_wallets` ≠ مجموع دفترهم. نتيجة فاضية =
--      الدفتر سليم. دي اللي أي فحص مجدول هيناديها.
--
-- فحص الشرعية قبل ما نكتب (اتعمل على الكود الحي وقاعدة الإنتاج):
--   - الجدول ده هو دفتر محفظة العميل الوحيد في المتجر، وكل كتاباته
--     INSERT بس جوه دوال القاعدة: `wallet_credit_topup_internal`
--     و`wallet_auto_credit_deposit` و`wallet_bind_claim_to_event`
--     (kind='topup')، و`refund_order` (kind='refund')، و
--     `wallet_pay_order` (kind='debit') — مراجعة حية لأجسام الدوال
--     الستة اللي بتلمس الجدول أكدت: INSERT/SELECT بس، صفر UPDATE
--     وصفر DELETE على صفوف الدفتر (الـ UPDATEs اللي فيهم على جداول
--     النوايا/الطلبات/الأرصدة، ودي لازم تفضل قابلة للتعديل).
--   - كود المتجر (Deno + الموقع) مش بيذكر اسم الجدول أصلًا — كل
--     الوصول بيعدي على الـ RPCs دي.
--   - اصطلاح الإشارة: `amount_egp` بيتخزن موقّع أصلًا — 'topup'
--     و'refund' موجب، و'debit' بيتخزن سالب (جسم `wallet_pay_order`) —
--     فالمجموع الموقّع هو sum(amount_egp) على طول من غير تحويل.
-- =====================================================================

-- ------------------------------------------------- زناد append-only
create or replace function public.wallet_transactions_append_only()
returns trigger
language plpgsql
as $$
begin
    raise exception
        'wallet_transactions is append-only (migration 020): % is not allowed',
        tg_op
        using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists wallet_transactions_append_only
    on public.wallet_transactions;
create trigger wallet_transactions_append_only
    before update or delete on public.wallet_transactions
    for each row
    execute function public.wallet_transactions_append_only();

drop trigger if exists wallet_transactions_no_truncate
    on public.wallet_transactions;
create trigger wallet_transactions_no_truncate
    before truncate on public.wallet_transactions
    for each statement
    execute function public.wallet_transactions_append_only();

-- ------------------------------------------------------- المطابقة
-- الاستدعاء:  select * from public.ledger_reconcile();
-- صفوف راجعة = عملاء مخالفين بس؛ صفر صفوف = كل الأرصدة مطابقة.
create or replace function public.ledger_reconcile()
returns table (
    customer_id    uuid,
    stored_balance numeric,
    ledger_balance numeric,
    difference     numeric
)
language sql
stable
as $$
    select w.customer_id,
           w.balance_egp,
           coalesce(sum(t.amount_egp), 0) as ledger_balance,
           (w.balance_egp - coalesce(sum(t.amount_egp), 0)) as difference
    from public.customer_wallets w
    left join public.wallet_transactions t
        on t.customer_id = w.customer_id
    group by w.customer_id, w.balance_egp
    having w.balance_egp <> coalesce(sum(t.amount_egp), 0);
$$;

revoke all on function public.ledger_reconcile() from public;
grant execute on function public.ledger_reconcile() to service_role;

notify pgrst, 'reload schema';
