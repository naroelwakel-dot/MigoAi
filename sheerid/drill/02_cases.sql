-- 02: حالات طبقة القاعدة — نفس الخطوات اللي خدمة Deno بتعملها عند
-- فشل التحقق (تنفيذ failed بمفتاح المورد sheerid ثم refund_order).

-- ---------- الحالة A: طلب المحفظة ----------
insert into public.store_executions
  (order_ref, sku, product_key, supplier_key, listing_ref, reference,
   status, sell_egp, quantity)
values
  ('DRILL-SH-001', 'Google Student (سنة كاملة)', 'google-student',
   'sheerid', '', '', 'failed', 280, 1);

SELECT public.refund_order('DRILL-SH-001',
  'اتلغى: التحقق ماكتملش، والاسترداد اتعالج بمسار المتجر',
  '💰 محفظة الموقع') AS case_a_result;
-- متوقع: {"ok": true, "already_refunded": false, "obligations": 1}

-- ---------- الحالة B: طلب التحويل النقدي ----------
insert into public.store_executions
  (order_ref, sku, product_key, supplier_key, listing_ref, reference,
   status, sell_egp, quantity)
values
  ('DRILL-SH-002', 'Google Student (سنة كاملة)', 'google-student',
   'sheerid', '', '', 'failed', 280, 1);

SELECT public.refund_order('DRILL-SH-002',
  'اتلغى: التحقق ماكتملش، والاسترداد اتعالج بمسار المتجر',
  'فودافون كاش') AS case_b_result;
-- متوقع: {"ok": true, "already_refunded": false, "obligations": 1}

-- ---------- الحالة C: إيدمبوتنسي ----------
SELECT public.refund_order('DRILL-SH-001',
  'اتلغى: التحقق ماكتملش، والاسترداد اتعالج بمسار المتجر',
  '💰 محفظة الموقع') AS case_c_result;
-- متوقع: {"ok": true, "already_refunded": true, "obligations": 1}
-- وعدد حركات محفظة الاسترداد للطلب يفضل 1 بس (قيد ref الفريد).

-- ---------- الحالة D: دورة حياة عملية التحقق ----------
insert into public.sheerid_jobs (order_ref, customer_email, status)
values ('DRILL-SH-002', 'drill-cash@example.com', 'awaiting_link');

update public.sheerid_jobs
set status = 'processing', job_id = 'DRILL-JOB-1', sheerid_url =
  'https://services.sheerid.com/verify/drill'
where order_ref = 'DRILL-SH-002';

update public.sheerid_jobs
set status = 'completed',
    activation_url = 'https://activate.example/drill',
    delivered_at = now(), delivery_attempts = 1,
    last_delivery_attempt_at = now()
where order_ref = 'DRILL-SH-002';

-- محاولة عملية تانية لنفس الطلب: لازم تفشل بالقيد الفريد (order_ref).
-- (شغّلها لوحدها وتأكد من رسالة الخطأ — فشلها هو النجاح هنا.)
-- insert into public.sheerid_jobs (order_ref, status)
-- values ('DRILL-SH-002', 'awaiting_link');
