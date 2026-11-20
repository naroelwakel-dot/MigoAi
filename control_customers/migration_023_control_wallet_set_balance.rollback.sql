-- تراجع هجرة 023 (إصلاحات مراجعة م١-أ).
-- بيشيل دالة «اضبط على» الداخلية، وبيعيد wallet_adjust_internal
-- لنسخة هجرة 022 بالظبط (نفس الجسم من غير حارس تعارض الـ ref).
-- قيود الدفتر اللي اتكتبت قبل التراجع بتفضل زي ما هي (الدفتر
-- append-only) — بما فيها قيود الصفر بملحوظة ' [set-noop]'.

drop function if exists
  public.wallet_set_balance_internal(uuid, numeric, text, text, text);

create or replace function public.wallet_adjust_internal(
  p_customer_id uuid,
  p_delta numeric,
  p_kind text,
  p_ref text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(12,2);
  v_existing public.wallet_transactions;
begin
  if p_customer_id is null then
    raise exception 'customer required';
  end if;
  if p_kind is null
     or p_kind not in ('deposit', 'compensation', 'correction') then
    raise exception 'invalid kind';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid delta';
  end if;
  if p_ref is null or btrim(p_ref) = '' then
    raise exception 'ref required';
  end if;

  insert into public.customer_wallets (customer_id, balance_egp)
  values (p_customer_id, 0)
  on conflict (customer_id) do nothing;

  select balance_egp into v_balance
  from public.customer_wallets
  where customer_id = p_customer_id
  for update;

  select * into v_existing
  from public.wallet_transactions
  where ref = p_ref;
  if found then
    return jsonb_build_object(
      'already', true,
      'balance_after', coalesce(v_balance, 0)
    );
  end if;

  if v_balance + p_delta < 0 then
    raise exception 'insufficient';
  end if;

  update public.customer_wallets
  set balance_egp = balance_egp + p_delta
  where customer_id = p_customer_id
  returning balance_egp into v_balance;

  insert into public.wallet_transactions
    (customer_id, kind, amount_egp, ref, note)
  values
    (p_customer_id, 'admin_' || p_kind, p_delta, p_ref, p_note);

  return jsonb_build_object(
    'adjusted', true,
    'balance_after', v_balance
  );
end;
$$;

revoke all on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  from public;
grant execute on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
