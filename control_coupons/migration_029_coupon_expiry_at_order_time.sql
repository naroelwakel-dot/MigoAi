-- =====================================================================
-- Migration 029: coupon expiry enforced at order time (M6-A)
-- =====================================================================
-- Hole found during the M6-A build: create_order resolves the
-- discount through internal_coupon_discount, whose final lookup
-- checks only `active = true`. It never looks at expires_at, so a
-- coupon that has expired but is still flagged active still
-- discounts when presented directly at order time. The cart-time
-- validate_coupon DOES check expiry (expires_at <= now() -> null),
-- so the two server paths disagreed: the advisory check refused
-- what the enforcement path granted.
--
-- Fix: the smallest possible change. The function body below is
-- the LIVE definition verbatim (pg_get_functiondef, 2026-11-20)
-- with exactly one statement changed -- the final coupon lookup
-- gains the expiry guard in validate_coupon's own semantics:
--   and (expires_at is null or expires_at > now())
-- expires_at NULL still means "no expiry"; a coupon whose
-- expires_at has passed now matches no row, v_disc stays null,
-- the function returns null, and create_order raises
-- 'invalid coupon' -- indistinguishable from an inactive or
-- unknown code, exactly as before for those cases.
--
-- Everything else is untouched by construction: the brute-force
-- throttle (per-bucket advisory lock, attempt counting, hashed
-- guesses in coupon_attempts) runs before the lookup exactly as
-- it did, so an expired-code guess still burns throttle budget
-- like any other guess. CREATE OR REPLACE preserves the live
-- ACL ({postgres, service_role}); no grant changes are needed
-- or made. migration_029.test.ts proves byte-identity of
-- everything outside the guarded statement against the rollback
-- file's embedded pre-029 definition.
-- =====================================================================

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
   where upper(code) = v_code and active = true
     and (expires_at is null or expires_at > now()) limit 1;
  return v_disc;
end $function$;

notify pgrst, 'reload schema';
