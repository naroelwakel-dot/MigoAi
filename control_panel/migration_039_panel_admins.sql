-- 039: هويات مسؤولي اللوحة وأدوارهم (خطة Instinct — البند ٢٣،
-- الموجة الرابعة) — جدول جديد واحد في قاعدة الموقع:
--   control_admins: سجل مسؤولي لوحة التحكم نفسهم (مش حسابات
--     عملاء الموقع — ديك في control/admin_users.ts وGoTrue):
--     الاسم والدور (owner/support/catalog) وحالة الإيقاف ونسخة
--     التوكن (token_version) اللي زيادتها هي ذراع إلغاء جلسات
--     المسؤول ده عند التفعيل المستقبلي.
--
-- خاملة بالتصميم (DORMANT): الهجرة دي إضافية ومحايدة سلوكيًا —
-- مفيش أي مسار قائم بيقرا الجدول ده، ودخول اللوحة وجلساتها
-- (control/session.ts + admin_auth.ts) بيكملوا زي النهاردة
-- بالحرف من غير أي صف هنا. المسؤول الحالي المصادَق هو الـ
-- owner ضمنيًا، والجدول ده هو سجل الأسماء للتفعيل اللي جاي:
-- أول ما الأدوار تتفعّل بجد، requireRole في control/admins.ts
-- بيتبنى فوق الصفوف دي ونسخة التوكن بتبقى قاعدة إلغاء الجلسة.
--
-- الوصول: RLS مفعّل، لا صلاحيات لـ anon/authenticated — القراءة
-- والكتابة عبر الباك إند بمفتاح الخدمة بس من ورا بوابة الأدمن
-- (نفس اتفاقيات 038 بالحرف).

create table if not exists public.control_admins (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  role text not null
    check (role in ('owner', 'support', 'catalog')),
  disabled boolean not null default false,
  token_version integer not null default 1 check (token_version >= 1),
  created_at timestamptz not null default now()
);

comment on table public.control_admins is
  'مسؤولو لوحة التحكم وأدوارهم (039، بند ٢٣): سجل خامل للتفعيل المستقبلي — الدخول الحالي لا يعتمد عليه، وtoken_version هو ذراع إلغاء الجلسات عند التفعيل';

create index if not exists control_admins_role_idx
  on public.control_admins (role);

alter table public.control_admins enable row level security;
revoke all on public.control_admins from anon, authenticated;
grant all on public.control_admins to service_role;
