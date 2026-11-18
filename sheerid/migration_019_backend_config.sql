-- هجرة 019: جدول backend_config — إعدادات سرّية بيقراها خادم المتجر
-- نفسه (service-role فقط).
--
-- ليه جدول جديد مش backend_secrets؟ جدول backend_secrets بيخزّن
-- بصمات أحادية الاتجاه (key_hash) لمفاتيح تحقق واردة — الخادم بيقارن
-- البصمة بس وعمره ما بيحتاج القيمة الأصلية (زي LOG_WRITE_KEY). لكن
-- فيه قيم لازم الخادم يبعتها بنفسه لخدمة تانية، وأولها توكن جسر
-- SheerID (sheerid_bridge_token): خادم الموقع بيبعته في ترويسة
-- x-bridge-token لنقطة البوت الداخلية /api/sheerid-bridge، والبوت
-- بينفّذ بمفتاح المورد اللي في بيئته. البصمة ما تنفعش هنا — فالقيمة
-- الأصلية بتتحفظ في الجدول ده.
--
-- الأمان: RLS مفعّل ومن غير أي سياسات — الـ anon والـ public ما
-- يقدروش يقرأوا ولا يكتبوا أي صف، والوصول الوحيد بخدمة
-- الـ service role (نفس نمط sheerid_jobs في هجرة 018). القيم اللي
-- هنا ما بتظهرش في أي رد عميل ولا لوج.
--
-- حالة التطبيق: اتطبّقت على الإنتاج بتاريخ 2026-11-18 مع زرع صف
-- sheerid_bridge_token في نفس خطوة ضبط متغير البيئة
-- SHEERID_BRIDGE_TOKEN عند البوت (قيمة واحدة في المخزنين، اتولّدت
-- واتحطت برمجيًا من غير ما تظهر في أي سجل).
-- التدوير: توليد قيمة جديدة → تحديث متغير بيئة البوت + تحديث الصف
-- هنا → إعادة نشر البوت وإعادة تشغيل/نشر خادم الموقع.

create table if not exists public.backend_config (
    key        text primary key,
    value      text not null,
    note       text,
    updated_at timestamptz not null default now()
);

alter table public.backend_config enable row level security;
