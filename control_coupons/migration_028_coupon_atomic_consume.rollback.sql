-- Rollback of migration 028 (atomic coupon consume -- M6-A).
-- Restores the pre-028 state exactly: the live create_order
-- definition as it was before 028 (embedded verbatim below),
-- the coupons_count_use() trigger function and the
-- orders_coupon_count trigger from migration 025, and the 025
-- uses_count column comment. Rolling back re-opens the
-- documented max_uses race (advisory validate + trigger count),
-- so it is a deliberate-decision rollback only.

CREATE OR REPLACE FUNCTION public.create_order(p_items jsonb, p_payment text, p_sender_account text, p_coupon text, p_customer_email text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e jsonb; v_sku text; v_qty int; v_price numeric; total numeric := 0;
  v_kind text; v_line numeric;
  disc numeric := 0; final_total numeric; ref text; new_id bigint;
  enriched jsonb := '[]'::jsonb; v_email text;
  v_key text; v_ex_id bigint; v_ex_ref text; v_ex_total text;
  v_fp text; v_items_canon jsonb; v_ex_fp text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid items payload';
  end if;
  if p_payment is null or length(trim(p_payment)) not between 1 and 64 then
    raise exception 'invalid payment';
  end if;
  -- Server-side allowlist (BRG-0011): the payment label must be one the
  -- store actually offers (section E2), not any string the client sends.
  if not exists (select 1 from public.payment_methods m
                  where m.value = trim(p_payment) and m.active) then
    raise exception 'invalid payment method';
  end if;
  if p_sender_account is null
     or length(trim(p_sender_account)) not between 1 and 128 then
    raise exception 'invalid sender_account';
  end if;
  v_email := nullif(trim(coalesce(p_customer_email, '')), '');
  if v_email is not null
     and (length(v_email) > 200 or position('@' in v_email) < 2) then
    raise exception 'invalid customer_email';
  end if;
  v_key := nullif(trim(coalesce(p_idempotency_key, '')), '');
  if v_key is not null and length(v_key) > 128 then
    raise exception 'invalid idempotency key';
  end if;
  -- Transitional-guard contract (file 004): mark this transaction as
  -- "inside create_order" so the legacy_order_guard trigger exempts
  -- this function's own INSERT. The marker is transaction-local and can
  -- only be set by executing SQL — a direct PostgREST table INSERT has
  -- no way to set it, which is exactly what makes it a reliable
  -- discriminator between the RPC path and the legacy path. (Role-based
  -- discrimination cannot work: PostgREST itself uses SET ROLE, so
  -- session_user/current_user do not separate the two paths.)
  perform set_config('app.via_create_order', '1', true);
  -- Idempotency binding (BRG-0012), encoding fixed in BRG-0014
  -- (DEF-FP-001, Critical/Confirmed): the BRG-0012 fingerprint was naive
  -- text concatenation (sku:qty pairs joined by ',', fields by '|'),
  -- which let a DIFFERENT payload collide with a stored fingerprint
  -- through crafted separator text inside a sku, and hashed qty as raw
  -- text, so the identical request written with qty '01' instead of 1
  -- produced a different fingerprint and a false conflict. The
  -- fingerprint is now the sha256 of a CANONICAL JSON object: typed
  -- values, encoder-escaped strings, items as an array of {qty, sku}
  -- objects sorted by (sku, qty) — with qty NORMALIZED to its integer
  -- value first (a non-integer qty text becomes JSON null, which no
  -- validated order can contain, so malformed items can never collide
  -- with a stored fingerprint either). Field semantics are unchanged
  -- (same owner/email/payment/sender/coupon normalization as BRG-0012);
  -- only the encoding changed. sha256() is a PostgreSQL built-in (14+),
  -- so no extension and no search_path change is needed. The client
  -- contract (frontend proposal §2d) is that a retry resubmits the
  -- IDENTICAL payload under the same key; the fingerprint is what lets
  -- the server tell "the same checkout again" apart from "a different
  -- order that happens to carry a used key". Tests IB8/IB9.
  select jsonb_agg(
           jsonb_build_object(
             'qty', case when coalesce(fe->>'qty', '') ~ '^[0-9]{1,9}$'
                         then (fe->>'qty')::int else null end,
             'sku', fe->>'sku')
           order by (fe->>'sku'),
                    case when coalesce(fe->>'qty', '') ~ '^[0-9]{1,9}$'
                         then (fe->>'qty')::int else null end)
    into v_items_canon
    from jsonb_array_elements(p_items) fe;
  v_fp := encode(sha256(convert_to(jsonb_build_object(
      'coupon', upper(trim(coalesce(p_coupon, ''))),
      'email', lower(coalesce(v_email, '')),
      'items', coalesce(v_items_canon, '[]'::jsonb),
      'payment', trim(p_payment),
      'sender', trim(p_sender_account),
      'uid', coalesce(auth.uid()::text, 'guest'))::text, 'UTF8')), 'hex');
  -- Idempotent replay (BRG-0011), bound by the fingerprint (BRG-0012):
  -- if this checkout already produced an order, return THAT order —
  -- but only when the stored fingerprint matches this request. A key
  -- replayed with a different owner or payload is a conflict and is
  -- rejected, never silently answered with the earlier order. Checked
  -- before coupon resolution on purpose — a network retry must neither
  -- create a duplicate nor burn coupon-throttle budget, and a conflict
  -- must not burn it either. The response gains 'replayed': true.
  if v_key is not null then
    select id, order_ref, total_text, request_fingerprint
      into v_ex_id, v_ex_ref, v_ex_total, v_ex_fp
      from public.orders where idempotency_key = v_key;
    if found then
      if v_ex_fp is distinct from v_fp then
        raise exception 'idempotency key conflict';
      end if;
      return jsonb_build_object('order_id', v_ex_id, 'order_ref', v_ex_ref,
                                'total', v_ex_total::numeric,
                                'replayed', true);
    end if;
  end if;
  for e in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e) <> 'object' then
      raise exception 'invalid order item';
    end if;
    v_sku := e->>'sku';
    if v_sku is null or length(v_sku) not between 1 and 200
       or (e->>'qty') is null or (e->>'qty') !~ '^[0-9]{1,9}$' then
      raise exception 'invalid order item';
    end if;
    v_qty := (e->>'qty')::int;
    select c.price, c.kind into v_price, v_kind
      from public.catalog c where c.sku = v_sku;
    if v_price is null then
      raise exception 'invalid sku: %', v_sku;
    end if;
    if v_kind = 'smm_rate' then
      -- SMM (BRG-0015, decided path): catalog.price is the rate per
      -- 1000 units and qty is the number of units. The line total is
      -- computed HERE from the catalog — the client's computed total
      -- is never read, so the browser cannot set the price. Rounding
      -- is to the cent (0.01 EGP), half away from zero, and
      -- orders_verify uses the identical formula, so server_total and
      -- the stamped verify agree with create_order's total.
      if v_qty not between 1 and 100000000 then
        raise exception 'invalid order item';
      end if;
      v_line := round(v_price * v_qty / 1000.0, 2);
    else
      if v_qty not between 1 and 1000 then
        raise exception 'invalid order item';
      end if;
      v_line := v_price * v_qty;
    end if;
    total := total + v_line;
    enriched := enriched || jsonb_build_object(
      'name', v_sku, 'price', v_line, 'unit_price', v_price,
      'qty', v_qty);
  end loop;
  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    disc := public.internal_coupon_discount(p_coupon);
    if disc is null then
      raise exception 'invalid coupon';
    end if;
    if disc < 0 or disc > 1 then
      raise exception 'invalid coupon discount';
    end if;
  end if;
  -- Rounding/overflow guard (BRG-0010): numeric arithmetic in PostgreSQL
  -- is arbitrary-precision, but a sanity bound keeps absurd catalog data
  -- or payload abuse from producing absurd orders. The largest real
  -- basket (1000 x the 71,680 EGP maximum SKU) is far below this bound.
  if total < 0 or total > 100000000 then
    raise exception 'total out of range';
  end if;
  final_total := round(total * (1 - disc), 2);
  ref := 'MG-' || nextval('public.order_ref_seq')::text;
  insert into public.orders
    (items, customer_email, payment, sender_account, total_text, coupon,
     status, order_ref, customer_id, idempotency_key, request_fingerprint)
  values
    (enriched,
     coalesce((select email from auth.users where id = auth.uid()), v_email),
     trim(p_payment), trim(p_sender_account),
     final_total::text, nullif(trim(coalesce(p_coupon, '')), ''), 'new', ref,
     auth.uid(), v_key, v_fp)
  on conflict (idempotency_key) do nothing
  returning id into new_id;
  if new_id is null then
    -- A concurrent twin carrying the same key committed first (the
    -- unique index arbitrated): return its order instead of erroring,
    -- so the customer's retry still ends with exactly one order — under
    -- the same fingerprint binding as the replay path (BRG-0012): if
    -- the twin's request was a DIFFERENT order, this is a conflict.
    select id, order_ref, total_text, request_fingerprint
      into v_ex_id, v_ex_ref, v_ex_total, v_ex_fp
      from public.orders where idempotency_key = v_key;
    if v_ex_fp is distinct from v_fp then
      raise exception 'idempotency key conflict';
    end if;
    return jsonb_build_object('order_id', v_ex_id, 'order_ref', v_ex_ref,
                              'total', v_ex_total::numeric,
                              'replayed', true);
  end if;
  return jsonb_build_object('order_id', new_id, 'order_ref', ref,
                            'total', final_total);
end $function$;

create or replace function public.coupons_count_use()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.coupon is not null and length(trim(new.coupon)) > 0 then
    update public.coupons
       set uses_count = uses_count + 1
     where upper(code) = upper(trim(new.coupon));
  end if;
  return new;
exception
  when others then
    -- العدّاد عمره ما يعطّل طلب عميل (العقد الموثّق)، بس فشله
    -- ممنوع يبقى صامت: raise warning بيوصله لسجلات القاعدة
    -- فالمراجعة الأسبوعية تقدر تلاحظ أي عدّ ناقص وتصلّحه.
    raise warning 'coupons_count_use failed for coupon %: %',
      new.coupon, sqlerrm;
    return new;
end;
$function$;

revoke execute on function public.coupons_count_use() from public;

drop trigger if exists orders_coupon_count on public.orders;
create trigger orders_coupon_count
  after insert on public.orders
  for each row execute function public.coupons_count_use();

comment on column public.coupons.uses_count is
  'Actual coupon use count (M5-C): incremented by the orders_coupon_count trigger from customer orders';

notify pgrst, 'reload schema';
