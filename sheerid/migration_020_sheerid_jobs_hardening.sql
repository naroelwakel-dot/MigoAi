-- هجرة 020 (مقترحة — ⚠️ لم تُطبَّق، وبقرار المالك بس):
-- تقوية جدول sheerid_jobs المرافقة لحزمة إصلاحات لجنة المراجعة
-- (2026-11-19). جزئين:
--
-- (أ) توسيع قيد حالة العملية بقيمة `refund_pending` — إصلاح اللجنة
--     #4 بيكتب الحالة دي (فشل اتسوّى واسترداده لسه مش مؤكد،
--     والمسح بيعيد محاولته). هجرة 018 قيّدت العمود بالقيم الست
--     الأصلية، فالكود الجديد هيفشل على قاعدة لسه على قيد 018.
--     ⚠️ ترتيب النشر مهم: الهجرة دي تتطبّق قبل نشر كود الحزمة
--     أو معاه في نفس خطوة المالك — مش بعده.
--
-- (ب) فهرس فريد جزئي على job_id (إصلاح اللجنة #14): معرّف عملية
--     المورد غير الفاضي لازم يبقى فريد بنيويًا، عشان getByProviderJobId
--     ما يبقاش غامض أبدًا. الفهرس غير الفريد sheerid_jobs_provider_idx
--     من هجرة 018 بيبقى زائد بعد ده — حذفه قرار مالك منفصل.

-- (أ) توسيع قيد الحالة:
alter table public.sheerid_jobs
    drop constraint if exists sheerid_jobs_status_check;
alter table public.sheerid_jobs
    add constraint sheerid_jobs_status_check
    check (status in ('awaiting_link','submitting','processing',
                      'completed','refunded','failed','refund_pending'));

-- (ب) فرادة معرّف عملية المورد (غير الفاضي):
create unique index if not exists sheerid_jobs_job_id_unique_idx
    on public.sheerid_jobs (job_id)
    where job_id <> '';
