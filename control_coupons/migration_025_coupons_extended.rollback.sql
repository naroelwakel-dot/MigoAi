-- تراجع 025: بيشيل تريجر ودالة عدّ الاستخدام، وبيرجّع
-- validate_coupon لتعريفها الأصلي قبل 025 حرفيًا (توقيع text
-- واحد وجسم select discount)، وبيشيل الأعمدة الأربعة الجديدة
-- وقيد نطاق الخصم اللي 025 ضافه على عمود discount القائم.
-- صلاحية التنفيذ بترجع لوضع ما قبل 025 الموثّق في BRG-0013:
-- anon/authenticated (وservice_role بيوصل دايمًا بمفتاح الخدمة).

alter table public.coupons
  drop constraint if exists coupons_discount_range;

drop trigger if exists orders_coupon_count on public.orders;
drop function if exists public.coupons_count_use();

drop function if exists public.validate_coupon(text, numeric);

create or replace function public.validate_coupon(p_code text)
 returns numeric language sql security definer set search_path to 'public'
as $function$
  select discount from public.coupons
   where upper(code) = upper(trim(p_code)) and active = true limit 1;
$function$;

revoke execute on function public.validate_coupon(text) from public;
grant execute on function public.validate_coupon(text)
  to anon, authenticated, service_role;

alter table public.coupons
  drop column if exists expires_at,
  drop column if exists max_uses,
  drop column if exists uses_count,
  drop column if exists min_order_egp;
