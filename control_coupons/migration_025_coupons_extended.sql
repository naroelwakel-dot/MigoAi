-- 025: توسيع كوبونات الموقع (م٥-ج) — أعمدة جديدة بس على جدول
-- coupons القائم (code/discount/active/created_at)، وتحديث
-- validate_coupon عشان تحترم الأعمدة الجديدة، وعدّاد استخدامات
-- بيعدّ من طلبات العملاء نفسها. مفيش أي تغيير في معنى الأعمدة
-- القديمة: discount كسر عشري زي ما هو متخزّن حيًا وزي ما واجهة
-- المتجر بتستخدمه (0.10 = ١٠٪؛ الصفوف الحية MIGO5 بـ 0.05
-- وMIGO10 بـ 0.10 وMIGO15 بـ 0.15 هي مصدر الحقيقة — الواجهة
-- بتعرض «الكسر × 100»٪ وبتحسب الخصم «الإجمالي × الكسر»).
-- كتابة بنسبة بشرية (10 بدل 0.10) تلف: بيمنعها قيد القاعدة
-- وفحص الدالة تحت.
--
-- عقد validate_coupon: بترجّع نسبة الخصم لكوبون صالح و null
-- لغير الصالح — مفيش مكان لرسائل رفض مميزة في العقد ده (الواجهة
-- بتقرأ رقم أو null بس)، فأسباب الرفض الجديدة (انتهاء/حد
-- استخدام/حد أدنى للطلب) بترجع null زي أي كوبون غير صالح،
-- وده موثّق هنا بقرار: الرفض العام هو المتاح في العقد الحالي.
--
-- التوقيع: الدالة القديمة validate_coupon(text) بتتشال وبتتخلق
-- validate_coupon(text, numeric default null) — النداء القديم
-- من الواجهة بـ p_code بس بيكمل شغال زي ما هو بالظبط (المعامل
-- التاني له قيمة افتراضية)، والحد الأدنى للطلب بيتفحص بس لما
-- المتصل يبعت إجمالي الطلب فعلًا.
--
-- تشديدات بوابة مراجعة م٥ (بعد مراجعة خارجية مزدوجة):
-- - الحد الأدنى: كوبون له min_order_egp مضبوط بيترفض (null) لو
--   المتصل ما بعتش الإجمالي أصلًا — فشل مغلق. قبل كده الشرط كان
--   بيتخطّى بصمت من غير إجمالي، والواجهة الحية نفسها ما بتبعتش
--   الإجمالي، فالحد ما كانش بيتنفّذ أبدًا. الواجهة بقت تبعت
--   إجمالي السلة مع النداء فالميزة بتشتغل فعليًا.
-- - نسبة الخصم: قيد قاعدة coupons_discount_range (0 < discount
--   <= 1 — كسر عشري، مش نقاط مئوية) + فحص داخل الدالة نفسها —
--   صف تالف بقيمة برّه نطاق الكسر (زي 10 المكتوبة كنسبة بشرية)
--   أو null بيترفض بدل ما يعدّي لحساب الدفع.
-- - التفعيل: `active is not true` — قبل 025 الأصل كان
--   `active = true` في الـ WHERE (مغلق على null)، وصياغة 025
--   الأولى `not r.active` كانت بتعدّي صف active = null لأن
--   not null = null. رجعنا للسلوك المغلق.
-- - عدّاد الاستخدام: فشله بقى بيترفع بـ raise warning (بيظهر
--   في سجلات القاعدة) بدل الابتلاع الصامت — من غير ما يعطّل
--   إتمام الطلب أبدًا (العقد الموثّق تحت زي ما هو).
--
-- عدّاد الاستخدام: uses_count بيزيد بتريجر بعد إدخال طلب شايل
-- كود كوبون — الدالة security definer ومحاطة بمعالج استثناءات،
-- فعدّ الاستخدام عمره ما يعطّل إتمام طلب عميل لو فشل لأي سبب.

alter table public.coupons
  add column if not exists expires_at timestamptz,
  add column if not exists max_uses integer,
  add column if not exists uses_count integer not null default 0,
  add column if not exists min_order_egp numeric;

do $$
begin
  alter table public.coupons
    add constraint coupons_max_uses_positive
    check (max_uses is null or max_uses > 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.coupons
    add constraint coupons_uses_count_nonneg
    check (uses_count >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.coupons
    add constraint coupons_min_order_nonneg
    check (min_order_egp is null or min_order_egp >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.coupons
    add constraint coupons_discount_range
    check (discount > 0 and discount <= 1);
exception when duplicate_object then null;
end $$;

comment on column public.coupons.discount is
  'نسبة الخصم كسر عشري (0.10 = ١٠٪): التخزين الحي وواجهة المتجر على الكسر، وvalidate_coupon بترجّع الكسر زي ما هو — النسبة البشرية بتتحوّل عند حدود لوحة التحكم بس';
comment on column public.coupons.expires_at is
  'وقت انتهاء الكوبون (م٥-ج): بعده validate_coupon بترفضه — null = ملوش انتهاء';
comment on column public.coupons.max_uses is
  'أقصى عدد استخدامات (م٥-ج): validate_coupon بترفض بعده — null = ملوش حد';
comment on column public.coupons.uses_count is
  'عدد مرات استخدام الكوبون فعليًا (م٥-ج): بيزيد بتريجر orders_coupon_count من طلبات العملاء';
comment on column public.coupons.min_order_egp is
  'حد أدنى لإجمالي الطلب بالجنيه (م٥-ج): validate_coupon بترفض طلب أصغر منه، وبترفض أصلًا لو المتصل ما بعتش الإجمالي (فشل مغلق) — null = ملوش حد أدنى';

-- ---------------------------------------------------- validate_coupon
drop function if exists public.validate_coupon(text);

create or replace function public.validate_coupon(
  p_code text,
  p_subtotal numeric default null
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.coupons%rowtype;
begin
  select * into r
    from public.coupons
   where upper(code) = upper(trim(p_code))
   limit 1;
  if not found then return null; end if;
  if r.active is not true then return null; end if;
  if r.discount is null or r.discount <= 0 or r.discount > 1 then
    return null;
  end if;
  if r.expires_at is not null and r.expires_at <= now() then
    return null;
  end if;
  if r.max_uses is not null and r.uses_count >= r.max_uses then
    return null;
  end if;
  if r.min_order_egp is not null
     and (p_subtotal is null or p_subtotal < r.min_order_egp) then
    return null;
  end if;
  return r.discount;
end;
$function$;

revoke execute on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric)
  to anon, authenticated, service_role;

-- ------------------------------------------------- عدّاد الاستخدام
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
