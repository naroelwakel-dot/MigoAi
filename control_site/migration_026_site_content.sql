-- 026: محتوى الموقع (م٥-هـ) — جدول site_content جديد في قاعدة
-- الموقع: مفاتيح محتوى قابلة للتحرير من لوحة التحكم (شريط
-- الإعلان، نص الشروط البديل، الأسئلة الشائعة، إظهار/إخفاء أقسام
-- الصفحة الرئيسية، وضع الصيانة). الباك إند الحالي بيقرأ الجدول
-- عبر نقطة عامة واحدة (GET /site/content)، وأي مفتاح غايب أو
-- قيمته تالفة بيرجع للنص الثابت الحالي في الصفحات — الموقع ما
-- بينكسرش أبدًا بغياب المحتوى.
--
-- أشكال القيم (jsonb، كائن لكل مفتاح):
--   announcement: {"enabled": bool, "text": string, "url": string}
--   terms:        {"text": string}  — فاضي = صفحة الشروط الثابتة
--                 الحالية هي اللي بتظهر (النص البديل بيظهر كنص
--                 عادي مكان أقسام الصفحة المنسّقة؛ قرار موثّق).
--   faq:          {"items": [{"q": string, "a": string}]}
--   sections:     {"<معرّف القسم>": bool} — المعرّفات العشرة
--                 الثابتة في index.html؛ غياب معرّف = ظاهر.
--   maintenance:  {"enabled": bool, "message": string}
--
-- البذور = القيم الحية الحالية بالحرف: مفيش شريط إعلان على
-- الموقع اليوم (معطّل)، الأسئلة هي الستة الظاهرة في الصفحة
-- الرئيسية، كل الأقسام ظاهرة، والصيانة مطفية — فتفعيل الجدول
-- ما بيغيّرش أي حاجة شايفها العميل. الشروط مش مزروعة بنص: صف
-- {"text": ""} بيحمل معنى «لا بديل» الموثّق فوق، وصفحة الشروط
-- الثابتة الحالية هي الاحتياطي حتى أول حفظ من اللوحة.
--
-- الوصول: RLS مفعّل، لا صلاحيات لـ anon/authenticated — القراءة
-- العامة بتمر عبر الباك إند بمفتاح الخدمة بس، والكتابة من
-- اللوحة عبر الباك إند برضه (بوابة أدمن + تدقيق عند البوت).

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.site_content is
  'محتوى الموقع القابل للتحرير من اللوحة (م٥-هـ): announcement/terms/faq/sections/maintenance — غياب أو تلف أي مفتاح يرجع بالنقطة العامة للنص الثابت في الصفحات';

alter table public.site_content enable row level security;
revoke all on public.site_content from anon, authenticated;
grant all on public.site_content to service_role;

insert into public.site_content (key, value) values
  ('announcement', '{"enabled": false, "text": "", "url": ""}'::jsonb),
  ('terms', '{"text": ""}'::jsonb),
  ('faq', '{"items": [
    {"q": "كيف يصلني الشحن؟", "a": "إلى معرّف اللاعب (ID) خلال 2 إلى 5 دقائق دون كلمة مرور."},
    {"q": "هل الاشتراكات والأدوات رسمية؟", "a": "نعم، تفعيل رسمي على بريدك مع ضمان سلامة التفعيل والتسليم من طرفنا."},
    {"q": "ما طرق الدفع المتاحة؟", "a": "فودافون كاش، إنستاباي، باينانس، والبطاقات البنكية."},
    {"q": "هل أحتاج مشاركة كلمة مروري؟", "a": "لا، يكفي معرّف اللاعب أو تاج الحساب فقط."},
    {"q": "هل الأسعار بالجنيه المصري؟", "a": "نعم، كل الأسعار بالجنيه المصري (EGP)."},
    {"q": "هل يوجد دعم فني؟", "a": "نعم، دعم مباشر عبر واتساب يومياً."}
  ]}'::jsonb),
  ('sections', '{"sec-ai": true, "sec-games": true, "sec-coins": true, "sec-live": true, "sec-social": true, "sec-entertainment": true, "sec-productivity": true, "sec-vcc": true, "reviews": true, "sec-faq": true}'::jsonb),
  ('maintenance', '{"enabled": false, "message": "الموقع متوقف مؤقتًا للصيانة والتحديث — راجعين لكم قريبًا. لو عندك طلب شغال، تواصل معنا واتساب وهنكمله معاك."}'::jsonb)
on conflict (key) do nothing;
