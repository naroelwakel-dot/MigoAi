-- =====================================================================
-- Migo Store — Migration 017: Price-floor audit + atomic raise-only RPC
-- Package: Store-side price propagation (owner NO-LOSS rule, 2026-11-18:
-- «مينفعش ابدا نخسر في اى حال من الأحوال لازم دايما نحدث ومكسب طبقا
-- المعروض» — never sell at a loss; displayed prices must always carry
-- the margin, floor = ceil(cost_usd × 82.5) = cost ×1.5 at 55 EGP/USD).
--
-- What this adds (additive only — no existing object is altered):
--   1) public.price_floor_audit — one row per ACTUAL price raise the
--      applier performs (old price, new price, cost basis, feed stamp).
--      Skips and no-ops never write here, so a re-run's idempotency is
--      provable from this table alone (audit count must not grow).
--   2) public.apply_price_floor(...) — the ONLY write path the Deno
--      applier (POST /catalog/apply-price-floors) uses. Atomic and
--      raise-only by construction:
--        * refuses any floor that is not exactly ceil(cost × 82.5)
--          recomputed in exact numeric arithmetic ('invalid_floor');
--        * refuses unknown SKUs ('sku_not_found') and SKUs matching
--          more than one catalog row ('sku_ambiguous');
--        * updates ONLY when current price < floor, in the same
--          transaction as the audit insert, under a row lock;
--        * can therefore never lower a price, whatever the caller asks.
--      Outcomes: 'raised' | 'already_at_or_above' | 'sku_not_found' |
--      'sku_ambiguous' | 'invalid_floor'.
--
-- Posture mirrors the wallet migrations: SECURITY DEFINER, pinned
-- search_path, EXECUTE revoked from public and granted to service_role
-- only (the Deno backend calls with SUPABASE_SERVICE_ROLE_KEY). The
-- audit table has RLS on with no policies — service-role access only,
-- same as reviews / error_log.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Audit table
-- ---------------------------------------------------------------------
create table if not exists public.price_floor_audit (
  id                bigint generated always as identity primary key,
  sku               text        not null,
  product_key       text        not null,
  supplier_key      text,
  cost_usd          numeric     not null,
  floor_egp         numeric     not null,
  old_price         numeric     not null,
  new_price         numeric     not null,
  feed_generated_at timestamptz,
  applied_at        timestamptz not null default now()
);

alter table public.price_floor_audit enable row level security;

create index if not exists price_floor_audit_sku_idx
  on public.price_floor_audit (sku, applied_at desc);

-- ---------------------------------------------------------------------
-- 2) Atomic raise-only applier RPC
-- ---------------------------------------------------------------------
create or replace function public.apply_price_floor(
  p_sku               text,
  p_floor_egp         numeric,
  p_product_key       text,
  p_supplier_key      text,
  p_cost_usd          numeric,
  p_feed_generated_at timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count    integer;
  v_old      numeric;
  v_expected numeric;
begin
  -- Fail-closed on any missing/invalid basis.
  if p_sku is null or btrim(p_sku) = ''
     or p_product_key is null or btrim(p_product_key) = ''
     or p_cost_usd is null or p_cost_usd <= 0
     or p_floor_egp is null or p_floor_egp <= 0 then
    return 'invalid_floor';
  end if;

  -- The floor is not caller-asserted: it must equal the owner's formula
  -- recomputed exactly (numeric arithmetic — no float drift).
  v_expected := ceil(p_cost_usd * 82.5);
  if p_floor_egp <> v_expected then
    return 'invalid_floor';
  end if;

  select count(*), min(price)
    into v_count, v_old
    from public.catalog
   where sku = p_sku;

  if v_count = 0 then
    return 'sku_not_found';
  end if;
  if v_count > 1 then
    return 'sku_ambiguous';
  end if;

  -- Re-read under a row lock so two concurrent runs cannot interleave
  -- (the count probe above is not the locked value).
  select price into v_old
    from public.catalog
   where sku = p_sku
   for update;

  if v_old >= p_floor_egp then
    return 'already_at_or_above';
  end if;

  update public.catalog
     set price = p_floor_egp,
         updated_at = now()
   where sku = p_sku;

  insert into public.price_floor_audit (
    sku, product_key, supplier_key, cost_usd, floor_egp,
    old_price, new_price, feed_generated_at
  ) values (
    p_sku, p_product_key, p_supplier_key, p_cost_usd, p_floor_egp,
    v_old, p_floor_egp, p_feed_generated_at
  );

  return 'raised';
end;
$$;

revoke all on function public.apply_price_floor(text, numeric, text, text, numeric, timestamptz) from public;
grant execute on function public.apply_price_floor(text, numeric, text, text, numeric, timestamptz) to service_role;
