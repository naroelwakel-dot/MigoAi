-- 038: متابعات ومسودات لوحة التحكم (خطة Instinct — البنود ١٧ و١٩،
-- الموجة التالتة) — جدولان جديدان في قاعدة الموقع لبيانات اللوحة
-- الداخلية بس:
--   control_followups: متابعة داخلية على حالة واحدة (طلب/حدث/
--     شحنة/محادثة/عميل/منتج/تاجر) — «المطلوب بعد كده» وميعاد
--     الرجوع لها. إغلاق المتابعة بيكتب في الجدول ده بس: حالة
--     العنصر نفسه وفلوسه ما بيتمسّوش أبدًا (مفيش أي مفتاح خارجي
--     ولا دالة ولا تريجر بيربط الجدول ده بأي جدول تشغيل).
--   control_drafts: مسودة نص طويل واحد لكل مفتاح محرر (منشور
--     قناة/أسئلة شائعة/نص موقع/نص دعم) — استرجاع بعد خروج غلط.
--     المفاتيح والأسرار ممنوعة هنا بقاعدة الخادم (control/
--     wave3.ts بيرفض أي مفتاح أو قيمة شكلها سر)، والجدول ده
--     مش مكان اعتماد بأي شكل.
--
-- ليه جدول جديد مش wallet_settings/site_content؟ الاتنين صف
-- مفتاح/قيمة واحد بيتحوّل JSON كامل في كل كتابة (نمط إعدادات
-- وكلمات مستبعدة ومحتوى موقع) — متابعات كتير بصفوف مستقلة
-- وحالات إغلاق محروسة هتتخانق على نفس الصف وتفقد كتابات،
-- وخلط بيانات تشغيل اللوحة بجدول إعدادات الفلوس أو محتوى
-- العملاء مخاطرة بلا لازمة. الجدول المنفصل هو نفس قرار 026
-- (site_content) بالحرف.
--
-- الوصول: RLS مفعّل، لا صلاحيات لـ anon/authenticated — القراءة
-- والكتابة عبر الباك إند بمفتاح الخدمة بس من ورا بوابة الأدمن.

create table if not exists public.control_followups (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null
    check (entity_kind in
      ('order', 'event', 'topup', 'chat', 'customer', 'product', 'merchant')),
  entity_id text not null check (length(entity_id) between 1 and 200),
  note text not null check (length(note) between 1 and 1000),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

comment on table public.control_followups is
  'متابعات لوحة التحكم الداخلية (038): ملحوظة «المطلوب بعد كده» على حالة واحدة — إغلاقها ما بيغيّرش حالة العنصر ولا فلوسه أبدًا';

create index if not exists control_followups_open_due_idx
  on public.control_followups (status, due_at);
create index if not exists control_followups_entity_idx
  on public.control_followups (entity_kind, entity_id);

alter table public.control_followups enable row level security;
revoke all on public.control_followups from anon, authenticated;
grant all on public.control_followups to service_role;

create table if not exists public.control_drafts (
  key text primary key check (length(key) between 1 and 120),
  text text not null check (length(text) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.control_drafts is
  'مسودات نصوص طويلة للوحة التحكم (038): منشور قناة/أسئلة/نص موقع/نص دعم بس — مفاتيح وأسرار وأكواد تحقق ممنوعة بقاعدة الخادم قبل أي كتابة';

alter table public.control_drafts enable row level security;
revoke all on public.control_drafts from anon, authenticated;
grant all on public.control_drafts to service_role;
