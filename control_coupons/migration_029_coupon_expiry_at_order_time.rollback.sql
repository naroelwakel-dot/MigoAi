-- Rollback of migration 029 (coupon expiry at order time -- M6-A).
-- Restores internal_coupon_discount to its exact pre-029 live
-- definition (embedded verbatim below, pg_get_functiondef
-- 2026-11-20). Rolling back re-opens the order-time expiry hole
-- documented in migration 029's header -- an expired-but-active
-- coupon would discount again at order time -- so it is a
-- deliberate-decision rollback only. CREATE OR REPLACE preserves
-- the ACL either way; no grant changes are involved.

CREATE OR REPLACE FUNCTION public.internal_coupon_discount(p_code text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_bucket text; v_limit int; v_attempts int; v_disc numeric; v_code text;
begin
  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' or length(v_code) > 64 then
    return null;
  end if;
  v_bucket := case when auth.uid() is not null
                   then 'uid:' || auth.uid()::text else 'anon-global' end;
  v_limit  := case when auth.uid() is not null then 20 else 300 end;
  -- ATOMICITY (BRG-0011, review fix): serialize the count-check-insert
  -- sequence per bucket. In the BRG-0010 revision the three steps below
  -- were unprotected, so N concurrent requests could all read the same
  -- count before any of them inserted, and the limit was soft under
  -- parallelism. This transaction-scoped advisory lock makes the gate
  -- atomic per bucket; different buckets still proceed in parallel, and
  -- the lock is released automatically at the end of the caller's
  -- transaction (every API call is exactly one transaction).
  perform pg_advisory_xact_lock(
    hashtextextended('coupon-bucket:' || v_bucket, 0));
  -- Bounded opportunistic cleanup for this bucket (plus the standalone
  -- cleanup_coupon_attempts() below for a scheduled full sweep).
  delete from public.coupon_attempts
   where bucket = v_bucket and created_at < now() - interval '24 hours';
  select count(*) into v_attempts from public.coupon_attempts
   where bucket = v_bucket and created_at > now() - interval '10 minutes';
  if v_attempts >= v_limit then
    return null;  -- throttled: indistinguishable from an invalid code
  end if;
  -- Only the SHA-256 hash of the guess is stored (BRG-0010): raw coupon
  -- guesses are credentials-in-waiting and are never persisted.
  insert into public.coupon_attempts (bucket, code_guess)
  values (v_bucket, encode(extensions.digest(v_code, 'sha256'), 'hex'));
  select discount into v_disc from public.coupons
   where upper(code) = v_code and active = true limit 1;
  return v_disc;
end $function$;

notify pgrst, 'reload schema';
