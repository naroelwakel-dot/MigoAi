-- هجرة 018 (مقترحة): عمليات تحقق SheerID الآلية على الموقع
-- (منتج Google Student — مرآة جدول البوت sheerid_jobs من هجرتيه
-- 0008 + 0011، مكيّفة لقاعدة المتجر).
-- ⚠️ لم تُطبَّق في أي مكان. التطبيق بقرار المالك: Staging أولًا
-- (مع تدريب drill/ المرافق) ثم الإنتاج، بنفس تسلسل بوابات الحزم.
--
-- كل عملية مربوطة بطلب متجر واحد (order_ref فريد بنيويًا — عملية
-- واحدة لكل طلب مهما تكررت الأحداث) وتبدأ `awaiting_link` وبتتحرّك:
-- submitting → processing → completed (رابط التفعيل اتحفظ وبيظهر
-- للعميل في صفحة فاتورته) أو refunded/failed (الاسترداد اتعالج
-- بمسار المتجر نفسه: تنفيذ failed + ‏refund_order).
-- `job_id` و`charged_usd` بيانات داخلية عن عملية المورد — ما بتظهرش
-- للعميل أبدًا (قاعدة العلامة البيضاء).

create table if not exists public.sheerid_jobs (
    id             uuid primary key default gen_random_uuid(),
    order_ref      text not null unique,
    customer_email text,
    sheerid_url    text not null default '' check (char_length(sheerid_url) <= 2000),
    job_id         text not null default '' check (char_length(job_id) <= 120),
    status         text not null default 'awaiting_link'
                   check (status in ('awaiting_link','submitting','processing',
                                     'completed','refunded','failed')),
    activation_url text not null default '' check (char_length(activation_url) <= 2000),
    charged_usd    numeric(10,2) not null default 0 check (charged_usd >= 0),
    -- الأتمتة وقعت للمسار اليدوي للطلب ده (العميل يقدر يعيد إرسال
    -- رابطه والأتمتة بتحاول تاني — نفس سلوك البوت).
    manual_fallback boolean not null default false,
    -- تتبّع تسليم نتيجة النجاح (ضمان تسليم البوت MR!68): المحاولات
    -- وآخر محاولة ووقت التأكيد. delivered_at متعبّي = النتيجة وصلت
    -- العميل (إيميل أو مشاهدة في صفحة الفاتورة) وممنوع أي إعادة.
    delivery_attempts        int not null default 0,
    delivered_at             timestamptz,
    last_delivery_attempt_at timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists sheerid_jobs_status_idx
    on public.sheerid_jobs (status, created_at);
create index if not exists sheerid_jobs_provider_idx
    on public.sheerid_jobs (job_id) where job_id <> '';
-- فهرس جزئي لاستعلام المسح الدوري عن المكتمل غير المسلّم.
create index if not exists sheerid_jobs_undelivered_idx
    on public.sheerid_jobs (last_delivery_attempt_at)
    where status = 'completed' and delivered_at is null;

alter table public.sheerid_jobs enable row level security;
-- مفيش سياسات عامة: الوصول بخدمة الخلفية (service role) بس، زي
-- store_executions في هجرة 007 — صفحة الفاتورة بتقرا الحالة من
-- خلفية Deno بعد إثبات ملكية الطلب، مش من الجدول مباشرة.
