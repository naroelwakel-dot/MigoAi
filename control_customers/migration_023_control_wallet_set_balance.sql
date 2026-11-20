-- =====================================================================
-- هجرة 023: إصلاحات مراجعة م١-أ المستقلة (Migo Control)
-- =====================================================================
-- إصلاحين على دوال هجرة 022، من غير لمس أي دالة تانية:
--
--   أ) `wallet_adjust_internal` — حارس تعارض الـ ref: نسخة 022 كانت
--      بتلاقي أي قيد بنفس الـ ref وترجع {already} برصيد العميل
--      الحالي، حتى لو القيد ده بتاع عميل تاني أصلًا (مفتاح
--      إيدمبوتنسي اتعاد استخدامه عبر عميلين) — نجاح وهمي من غير
--      حركة. دلوقتي: قيد موجود بعميل مختلف = استثناء 'ref_conflict'
--      (المعالج بيحوّله 409). جسم الدالة نسخة حرفية من 022 + الحارس.
--
--   ب) `wallet_set_balance_internal(uuid, numeric, text, text, text)`
--      — «اضبط على» الذرّية: نسخة 022 ما كانش فيها ضبط أصلًا، فطبقة
--      Deno كانت بتقرا الرصيد وتحسب الفرق وتبعته لـ adjust — سباق
--      مع أي حركة محفظة متزامنة (الفرق بيتحسب على رصيد قديم)،
--      وحالة «الهدف = الرصيد الحالي» كانت بترجع نجاح من غير ما
--      تستهلك الـ ref (إعادة نفس الطلب بعد حركة رصيد كانت هتتحرك).
--      الدالة الجديدة: بتقفل صف المحفظة، وبتفحص الـ ref تحت القفل
--      (تعارض عميل = 'ref_conflict'، ونفس العميل = {already})،
--      وبتحسب الفرق = الهدف − الرصيد المقفول، وبتحرّك وتقيّد
--      بقيد واحد — ولو الفرق صفر بتقيّد قيد صفر بنفس الـ ref
--      (بيستهلكه؛ دفتر الموقع مفيهوش قيد على amount — متأكد منه)
--      بملحوظة بتنتهي بـ ' [set-noop]' عشان القيد يفضل مفهوم.
--
-- الصلاحيات: الدالتين service_role بس، زي باقي الدوال الداخلية —
-- النداء الوحيد من خادم اللوحة بعد بوابة الأدمن بتاعته.
-- =====================================================================

-- ---------------------------------------------------------------------
-- أ) تعديل رصيد إداري مباشر — نسخة 022 + حارس تعارض الـ ref
-- ---------------------------------------------------------------------
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

  -- قفل صف المحفظة الأول: كل تعديلات العميل الواحد بتتصفّى هنا،
  -- ففحص الـ ref اللي بعده محمي من أي سباق على نفس العميل.
  select balance_egp into v_balance
  from public.customer_wallets
  where customer_id = p_customer_id
  for update;

  -- إيدمبوتنسي: نفس الـ ref اتنفّذ قبل كده = نفس النتيجة، من غير
  -- قيد تاني ولا حركة رصيد (والقيد الفريد على ref ضمان بنيوي
  -- إضافي: أي إدخال مكرر بيصطدم بيه وبيفشل بصوت عالي). بس الـ ref
  -- مربوط بعميل واحد: قيد موجود لعميل تاني = تعارض، مش إعادة.
  select * into v_existing
  from public.wallet_transactions
  where ref = p_ref;
  if found then
    if v_existing.customer_id <> p_customer_id then
      raise exception 'ref_conflict';
    end if;
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

-- ---------------------------------------------------------------------
-- ب) اضبط الرصيد على هدف — الفرق بيتحسب جوه القاعدة تحت قفل الصف.
--    p_target هو الرصيد النهائي المطلوب (>= 0). قيد الدفتر بيحمل
--    الفرق الموقّع بنوع 'admin_' || p_kind؛ والفرق الصفر بيستهلك
--    الـ ref بقيد صفر بملحوظة ' [set-noop]'.
-- ---------------------------------------------------------------------
create or replace function public.wallet_set_balance_internal(
  p_customer_id uuid,
  p_target numeric,
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
  v_delta numeric(12,2);
begin
  if p_customer_id is null then
    raise exception 'customer required';
  end if;
  if p_kind is null
     or p_kind not in ('deposit', 'compensation', 'correction') then
    raise exception 'invalid kind';
  end if;
  if p_target is null or p_target < 0 then
    raise exception 'invalid target';
  end if;
  if p_ref is null or btrim(p_ref) = '' then
    raise exception 'ref required';
  end if;

  insert into public.customer_wallets (customer_id, balance_egp)
  values (p_customer_id, 0)
  on conflict (customer_id) do nothing;

  -- قفل صف المحفظة الأول: حساب الفرق لازم يتم على الرصيد المقفول،
  -- وفحص الـ ref اللي بعده محمي من أي سباق على نفس العميل.
  select balance_egp into v_balance
  from public.customer_wallets
  where customer_id = p_customer_id
  for update;

  -- نفس اتفاق الـ ref في adjust: موجود لنفس العميل = {already}،
  -- وموجود لعميل تاني = تعارض.
  select * into v_existing
  from public.wallet_transactions
  where ref = p_ref;
  if found then
    if v_existing.customer_id <> p_customer_id then
      raise exception 'ref_conflict';
    end if;
    return jsonb_build_object(
      'already', true,
      'balance_after', coalesce(v_balance, 0)
    );
  end if;

  v_delta := p_target - v_balance;

  if v_delta <> 0 then
    update public.customer_wallets
    set balance_egp = balance_egp + v_delta
    where customer_id = p_customer_id
    returning balance_egp into v_balance;

    insert into public.wallet_transactions
      (customer_id, kind, amount_egp, ref, note)
    values
      (p_customer_id, 'admin_' || p_kind, v_delta, p_ref, p_note);
  else
    -- فرق صفر: مفيش حركة رصيد، بس الـ ref لازم يستهلك بقيد —
    -- من غيره إعادة نفس الطلب بعد أي حركة رصيد هتتحرك من جديد.
    insert into public.wallet_transactions
      (customer_id, kind, amount_egp, ref, note)
    values
      (p_customer_id, 'admin_' || p_kind, 0, p_ref,
       coalesce(p_note, '') || ' [set-noop]');
  end if;

  return jsonb_build_object(
    'adjusted', v_delta <> 0,
    'balance_after', coalesce(v_balance, 0)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- الصلاحيات: تنفيذ للخدمة بس (اللوحة بتنادي بمفتاح الخدمة بعد
-- بوابة الأدمن بتاعتها؛ مفيش أي نداء متصفح مباشر).
-- ---------------------------------------------------------------------
revoke all on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  from public;
revoke all on function
  public.wallet_set_balance_internal(uuid, numeric, text, text, text)
  from public;
grant execute on function
  public.wallet_adjust_internal(uuid, numeric, text, text, text)
  to service_role;
grant execute on function
  public.wallet_set_balance_internal(uuid, numeric, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
