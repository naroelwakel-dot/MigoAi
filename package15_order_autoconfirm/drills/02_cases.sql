-- =====================================================================
-- تدريب الحزمة 15 — 02: الحالات (تأكيدات صارمة: أي فشل = استثناء)
-- =====================================================================
-- بيتنفذ بعد 01_seed.sql. الحالات 1–10 سكك المحمول، 11–17 سكك
-- المنصات، 18 مسح حسم المطالبات. الترتيب مهم: الحالات بتستهلك
-- بذرتها بالترتيب المكتوب (1 قبل 7/8، و5 قبل ما أي مسح عام يشتغل).
-- =====================================================================

-- ---------------------------------------------------------------------
-- حالة 1: مُرسل+مبلغ+فرادة تامة + قناة مزدوجة → مدفوع + تدقيق +
-- حدث مستهلَك وشريك مربوط.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
  v_audit int;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e01a'));
  if (v_res ->> 'confirmed')::boolean is not true then
    raise exception 'CASE 1 FAIL: expected confirmed, got %', v_res;
  end if;
  if v_res ->> 'basis' <> 'dual_channel' then
    raise exception 'CASE 1 FAIL: expected dual_channel basis, got %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O01';
  if v_status <> 'payment_confirmed' then
    raise exception 'CASE 1 FAIL: order status = %', v_status;
  end if;
  select count(*) into v_audit
  from public.order_payment_matches m
  join public.orders o on o.id = m.order_id
  where o.order_ref = 'DRILL15-O01'
    and m.basis = 'sms_sender_amount' and m.gate = 'dual_channel';
  if v_audit <> 1 then
    raise exception 'CASE 1 FAIL: audit rows = %', v_audit;
  end if;
  if not exists (
    select 1 from public.wallet_sms_events
    where dedupe_key = 'drill15-e01a' and match_state = 'matched'
      and matched_order_id = (select id from public.orders where order_ref = 'DRILL15-O01')
      and autocredit_basis = 'dual_channel'
  ) then
    raise exception 'CASE 1 FAIL: event not consumed as matched/dual_channel';
  end if;
  if not exists (
    select 1 from public.wallet_sms_events a
    join public.wallet_sms_events b on b.id = a.corroborated_by
    where a.dedupe_key = 'drill15-e01a' and b.dedupe_key = 'drill15-e01b'
  ) then
    raise exception 'CASE 1 FAIL: corroboration pair not linked';
  end if;
  raise notice 'PASS case 1: unique dual-channel match -> paid + audit + event consumed';
end $$;

-- ---------------------------------------------------------------------
-- حالة 7: order_confirm_payment بمُرسل غلط → not_found (لا كشف).
-- ---------------------------------------------------------------------
do $$
declare v_res jsonb;
begin
  v_res := public.order_confirm_payment('DRILL15-O02', '01009999999');
  if v_res ->> 'status' <> 'not_found' then
    raise exception 'CASE 7 FAIL: expected not_found, got %', v_res;
  end if;
  v_res := public.order_confirm_payment('DRILL15-NOPE', '01001500002');
  if v_res ->> 'status' <> 'not_found' then
    raise exception 'CASE 7 FAIL: unknown ref must be not_found too, got %', v_res;
  end if;
  raise notice 'PASS case 7: wrong sender / unknown ref -> not_found';
end $$;

-- ---------------------------------------------------------------------
-- حالة 8: تأكيد على طلب مدفوع أصلًا → confirmed (إيدمبوتنت).
-- ---------------------------------------------------------------------
do $$
declare v_res jsonb;
begin
  v_res := public.order_confirm_payment('DRILL15-O01', '01001500001');
  if v_res ->> 'status' <> 'confirmed' then
    raise exception 'CASE 8 FAIL: expected confirmed, got %', v_res;
  end if;
  raise notice 'PASS case 8: confirm on already-paid -> confirmed (idempotent)';
end $$;

-- ---------------------------------------------------------------------
-- حالة 2: اختلاف المبلغ → لا دفع (no_candidate)، الطلب والحدث
-- على حالهم.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
  v_state text;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e02'));
  if (v_res ->> 'confirmed')::boolean is true
     or v_res ->> 'reason' <> 'no_candidate' then
    raise exception 'CASE 2 FAIL: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O02';
  select match_state into v_state from public.wallet_sms_events where dedupe_key = 'drill15-e02';
  if v_status <> 'new' or v_state <> 'unmatched' then
    raise exception 'CASE 2 FAIL: order=% event=%', v_status, v_state;
  end if;
  raise notice 'PASS case 2: amount mismatch -> not paid';
end $$;

-- ---------------------------------------------------------------------
-- حالة 3: اختلاف المُرسل → لا دفع.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e03'));
  if (v_res ->> 'confirmed')::boolean is true
     or v_res ->> 'reason' <> 'no_candidate' then
    raise exception 'CASE 3 FAIL: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O03';
  if v_status <> 'new' then
    raise exception 'CASE 3 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 3: sender mismatch -> not paid';
end $$;

-- ---------------------------------------------------------------------
-- حالة 4: طلبان معلّقان بنفس (المُرسل، المبلغ) وحدث واحد →
-- ambiguous، ولا واحد فيهم بيتدفع — لا من المحاولة ولا من التأكيد.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_paid int;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e04'));
  if (v_res ->> 'confirmed')::boolean is true
     or v_res ->> 'reason' <> 'ambiguous' then
    raise exception 'CASE 4 FAIL: %', v_res;
  end if;
  v_res := public.order_confirm_payment('DRILL15-O04A', '01001500004');
  if v_res ->> 'status' <> 'ambiguous' then
    raise exception 'CASE 4 FAIL: confirm must be ambiguous, got %', v_res;
  end if;
  select count(*) into v_paid from public.orders
  where order_ref in ('DRILL15-O04A', 'DRILL15-O04B')
    and status = 'payment_confirmed';
  if v_paid <> 0 then
    raise exception 'CASE 4 FAIL: % orders paid', v_paid;
  end if;
  raise notice 'PASS case 4: two orders / one event -> ambiguous, neither paid';
end $$;

-- ---------------------------------------------------------------------
-- حالة 4ب: حدثان رسميان (نفس القناة) لطلب واحد → ambiguous في
-- الاتجاه المعاكس برضه.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e11a'));
  if (v_res ->> 'confirmed')::boolean is true
     or v_res ->> 'reason' <> 'ambiguous' then
    raise exception 'CASE 4B FAIL: %', v_res;
  end if;
  v_res := public.order_confirm_payment('DRILL15-O11', '01001500011');
  if v_res ->> 'status' <> 'ambiguous' then
    raise exception 'CASE 4B FAIL: confirm must be ambiguous, got %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O11';
  if v_status <> 'new' then
    raise exception 'CASE 4B FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 4b: two events / one order -> ambiguous, not paid';
end $$;

-- ---------------------------------------------------------------------
-- حالة 5: حدث اتستهلك في مسار شحنة المحفظة → مش قابل لإعادة
-- الاستخدام لطلب شراء (الطلب يفضل new والتأكيد pending).
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_state text;
  v_topup uuid;
  v_status text;
begin
  -- مسار الشحن الأول (نفس ما ingest بيعمل): الحدث بيتربط بالشحنة
  -- (held_for_admin لأن الأدلة أحادية) وبيخرج من unmatched.
  v_res := public.wallet_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e05'));
  select match_state, matched_topup_id into v_state, v_topup
  from public.wallet_sms_events where dedupe_key = 'drill15-e05';
  if v_state <> 'matched' or v_topup is null then
    raise exception 'CASE 5 FAIL: topup path did not consume event (state=%, topup=%)', v_state, v_topup;
  end if;
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e05'));
  if (v_res ->> 'confirmed')::boolean is true then
    raise exception 'CASE 5 FAIL: consumed event confirmed an order: %', v_res;
  end if;
  v_res := public.order_confirm_payment('DRILL15-O05', '01001500005');
  if v_res ->> 'status' <> 'pending' then
    raise exception 'CASE 5 FAIL: confirm must stay pending, got %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O05';
  if v_status <> 'new' then
    raise exception 'CASE 5 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 5: event consumed by a topup is not reusable for an order';
end $$;

-- ---------------------------------------------------------------------
-- حالة 6: فشل البوابة (قناة واحدة + فوق السقف + بلا تاريخ) →
-- لا دفع، والحدث يفضل unmatched مع تلميح الطلب للأدمن، والتأكيد
-- من العميل pending.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_state text;
  v_hint text;
  v_status text;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e06'));
  if (v_res ->> 'confirmed')::boolean is true
     or v_res ->> 'reason' <> 'gate' then
    raise exception 'CASE 6 FAIL: %', v_res;
  end if;
  select match_state, parsed ->> 'order_hint' into v_state, v_hint
  from public.wallet_sms_events where dedupe_key = 'drill15-e06';
  if v_state <> 'unmatched' or v_hint <> 'DRILL15-O06' then
    raise exception 'CASE 6 FAIL: event state=% hint=%', v_state, v_hint;
  end if;
  v_res := public.order_confirm_payment('DRILL15-O06', '01001500006');
  if v_res ->> 'status' <> 'pending' then
    raise exception 'CASE 6 FAIL: confirm must be pending, got %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O06';
  if v_status <> 'new' then
    raise exception 'CASE 6 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 6: gate fail -> not paid, event unmatched with order hint';
end $$;

-- ---------------------------------------------------------------------
-- حالة 9: طلب وسيلته برّه سكك المحمول (Cards) مع حدث مطابق
-- شكلًا → لا يتأكد أبدًا من الرسائل.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e09'));
  if (v_res ->> 'confirmed')::boolean is true then
    raise exception 'CASE 9 FAIL: non-rail order confirmed: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O09';
  if v_status <> 'new' then
    raise exception 'CASE 9 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 9: non-rail method never matched by SMS';
end $$;

-- ---------------------------------------------------------------------
-- حالة 10: حدث أقدم/أحدث من نافذة ±48 ساعة حوالين الطلب → لا
-- مطابقة.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
begin
  v_res := public.order_sms_try_match(
    (select id from public.wallet_sms_events where dedupe_key = 'drill15-e10'));
  if (v_res ->> 'confirmed')::boolean is true
     or v_res ->> 'reason' <> 'no_candidate' then
    raise exception 'CASE 10 FAIL: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-O10';
  if v_status <> 'new' then
    raise exception 'CASE 10 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 10: event outside the 48h window -> no match';
end $$;

-- ---------------------------------------------------------------------
-- حالة 11: مطالبة منصة دقيقة (10 USDT × 50 = 500 = إجمالي الطلب)
-- → مدفوع + مطالبة محسومة + حدث مستهلَك + تدقيق exchange:binance.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
  v_claim uuid;
  v_outcome text;
  v_audit int;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX1', 'payid-drill-1', 'binance', 'DRILL15-BIN-001');
  if v_res ->> 'status' <> 'confirmed' then
    raise exception 'CASE 11 FAIL: %', v_res;
  end if;
  v_claim := (v_res ->> 'claim_id')::uuid;
  insert into public._drill15_state (k, v)
  values ('claim:ox1', v_claim::text)
  on conflict (k) do update set v = excluded.v;
  select status into v_status from public.orders where order_ref = 'DRILL15-OX1';
  if v_status <> 'payment_confirmed' then
    raise exception 'CASE 11 FAIL: order status = %', v_status;
  end if;
  if not exists (
    select 1 from public.order_exchange_claims
    where id = v_claim and status = 'confirmed' and resolved_at is not null
      and deposit_event_id = (select id from public.wallet_deposit_events
                              where rail = 'binance' and exchange_ref = 'DRILL15-BIN-001')
  ) then
    raise exception 'CASE 11 FAIL: claim not confirmed/linked';
  end if;
  select outcome into v_outcome from public.wallet_deposit_events
  where rail = 'binance' and exchange_ref = 'DRILL15-BIN-001';
  if v_outcome <> 'credited' then
    raise exception 'CASE 11 FAIL: deposit event outcome = %', v_outcome;
  end if;
  select count(*) into v_audit
  from public.order_payment_matches m
  join public.orders o on o.id = m.order_id
  where o.order_ref = 'DRILL15-OX1' and m.basis = 'exchange:binance';
  if v_audit <> 1 then
    raise exception 'CASE 11 FAIL: audit rows = %', v_audit;
  end if;
  raise notice 'PASS case 11: exact exchange claim -> paid + event consumed + audit';
end $$;

-- ---------------------------------------------------------------------
-- حالة 12: مرجع عليه مطالبة محفظة سابقة → already_claimed،
-- والطلب مش بيتدفع.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX2', 'payid-drill-2', 'binance', 'DRILL15-BIN-002');
  if v_res ->> 'status' <> 'already_claimed' then
    raise exception 'CASE 12 FAIL: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-OX2';
  if v_status <> 'new' then
    raise exception 'CASE 12 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 12: ref held by a wallet claim -> already_claimed, not paid';
end $$;

-- ---------------------------------------------------------------------
-- حالة 13: مطالبة طلب بتستهلك الحدث → مطالبة محفظة لاحقة على
-- نفس المرجع بتاخد already_credited ومفيش أي رصيد بيتحرك.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_tx int;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX3', 'payid-drill-3', 'binance', 'DRILL15-BIN-003');
  if v_res ->> 'status' <> 'confirmed' then
    raise exception 'CASE 13 FAIL (order claim): %', v_res;
  end if;
  -- محاكاة هوية عميل المحفظة (تقنية تدريب الحزمة 11).
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', false);
  v_res := public.wallet_claim_deposit('binance', 'DRILL15-BIN-003');
  perform set_config('request.jwt.claims', '{}', false);
  if v_res ->> 'status' <> 'already_credited' then
    raise exception 'CASE 13 FAIL: wallet claim must be already_credited, got %', v_res;
  end if;
  select count(*) into v_tx from public.wallet_transactions
  where ref = 'deposit:binance:DRILL15-BIN-003';
  if v_tx <> 0 then
    raise exception 'CASE 13 FAIL: % wallet ledger rows moved money', v_tx;
  end if;
  raise notice 'PASS case 13: order claim consumes event -> later wallet claim already_credited, no credit';
end $$;

-- ---------------------------------------------------------------------
-- حالة 14: اختلاف مبلغ المنصة (9 USDT × 50 = 450 ≠ 500) →
-- pending (amount_mismatch)، لا دفع، والحدث مش بيستهلك.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
  v_outcome text;
  v_claim_status text;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX4', 'payid-drill-4', 'binance', 'DRILL15-BIN-004');
  if v_res ->> 'status' <> 'pending'
     or v_res ->> 'reason' <> 'amount_mismatch' then
    raise exception 'CASE 14 FAIL: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-OX4';
  select outcome into v_outcome from public.wallet_deposit_events
  where rail = 'binance' and exchange_ref = 'DRILL15-BIN-004';
  select status into v_claim_status from public.order_exchange_claims
  where exchange_ref = 'DRILL15-BIN-004';
  if v_status <> 'new' or v_outcome <> 'no_matching_intent'
     or v_claim_status <> 'pending' then
    raise exception 'CASE 14 FAIL: order=% outcome=% claim=%',
      v_status, v_outcome, v_claim_status;
  end if;
  raise notice 'PASS case 14: exchange amount mismatch -> pending, not paid, event untouched';
end $$;

-- ---------------------------------------------------------------------
-- حالة 15: مرجع Binance بيتدّعى على سكة Bybit → لا تأكيد
-- (الحدث على سكته الأصلية زي ما هو، والطلب Bybit مش بيتدفع).
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
  v_outcome text;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX6', 'uid-drill-6', 'bybit', 'DRILL15-X-006');
  if v_res ->> 'status' = 'confirmed' then
    raise exception 'CASE 15 FAIL: wrong-rail claim confirmed: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-OX6';
  select outcome into v_outcome from public.wallet_deposit_events
  where rail = 'binance' and exchange_ref = 'DRILL15-X-006';
  if v_status <> 'new' or v_outcome <> 'no_matching_intent' then
    raise exception 'CASE 15 FAIL: order=% outcome=%', v_status, v_outcome;
  end if;
  raise notice 'PASS case 15: wrong rail -> not confirmed';
end $$;

-- ---------------------------------------------------------------------
-- حالة 16: إيداع غير USDT → invalid_asset، المطالبة بتترفض،
-- والطلب مش بيتدفع.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
  v_claim_status text;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX5', 'payid-drill-5', 'binance', 'DRILL15-BIN-007');
  if v_res ->> 'status' <> 'invalid_asset' then
    raise exception 'CASE 16 FAIL: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-OX5';
  select status into v_claim_status from public.order_exchange_claims
  where exchange_ref = 'DRILL15-BIN-007';
  if v_status <> 'new' or v_claim_status <> 'rejected' then
    raise exception 'CASE 16 FAIL: order=% claim=%', v_status, v_claim_status;
  end if;
  raise notice 'PASS case 16: non-USDT deposit -> invalid_asset, claim rejected, not paid';
end $$;

-- ---------------------------------------------------------------------
-- حالة 17: إعادة ضغط بنفس (الطلب، المرجع) → نفس المطالبة ونفس
-- الحالة، صف واحد بس.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_rows int;
  v_first uuid;
begin
  select v::uuid into v_first from public._drill15_state where k = 'claim:ox1';
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX1', 'payid-drill-1', 'binance', 'DRILL15-BIN-001');
  if v_res ->> 'status' <> 'confirmed' then
    raise exception 'CASE 17 FAIL: %', v_res;
  end if;
  select count(*) into v_rows from public.order_exchange_claims
  where order_id = (select id from public.orders where order_ref = 'DRILL15-OX1');
  if v_rows <> 1 then
    raise exception 'CASE 17 FAIL: % claim rows for one order+ref', v_rows;
  end if;
  if not exists (
    select 1 from public.order_exchange_claims
    where id = v_first and status = 'confirmed'
  ) then
    raise exception 'CASE 17 FAIL: original claim row changed';
  end if;
  raise notice 'PASS case 17: re-press idempotent -> one claim row, same status';
end $$;

-- ---------------------------------------------------------------------
-- حالة 18: مطالبة قبل وصول الإيداع (pending) + حدث بييجي بعده →
-- مسح الحسم (order_resolve_exchange_claims) بيأكد الطلب.
-- ---------------------------------------------------------------------
do $$
declare
  v_res jsonb;
  v_status text;
begin
  v_res := public.order_claim_exchange_payment(
    'DRILL15-OX7', 'payid-drill-7', 'binance', 'DRILL15-BIN-008');
  if v_res ->> 'status' <> 'pending' then
    raise exception 'CASE 18 FAIL: claim before deposit must be pending, got %', v_res;
  end if;
  insert into public.wallet_deposit_events
    (rail, exchange_ref, asset, amount_usdt, tx_hash, outcome)
  values
    ('binance', 'DRILL15-BIN-008', 'USDT', 10, null, 'no_matching_intent')
  on conflict (rail, exchange_ref) do nothing;
  v_res := public.order_resolve_exchange_claims(50);
  if (v_res ->> 'confirmed')::int < 1 then
    raise exception 'CASE 18 FAIL: resolve sweep confirmed nothing: %', v_res;
  end if;
  select status into v_status from public.orders where order_ref = 'DRILL15-OX7';
  if v_status <> 'payment_confirmed' then
    raise exception 'CASE 18 FAIL: order status = %', v_status;
  end if;
  raise notice 'PASS case 18: pending claim + late deposit -> resolve sweep confirms';
end $$;
