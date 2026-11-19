/**
 * اختبارات محلّل الرسائل (الحزمة 11) — `deno test sms_parse.test.ts`
 * من غير أي استيراد خارجي (بتشتغل offline بالكامل).
 *
 * ⚠️ العينات دي مكتوبة على الأشكال الشائعة الموثقة لرسائل فودافون
 * كاش/إنستاباي في مصر — مش منقولة من موبايل المالك. وقت التفعيل:
 * خد رسالة حقيقية واحدة من كل سكة، حطّها هنا كعينة، وظبّط القوالب
 * في sms_parse.ts لحد ما العينات الحقيقية تعدّي. أرقام الموبايل
 * والمراجع هنا وهمية (01000000000 style) عمدًا.
 */
import { computeDedupeKey, normalizeDigits, parseSms } from "./sms_parse.ts";

// مساعدات تأكيد صغيرة (بديل std/assert عشان الاختبار يشتغل offline).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ---------------------------------------------------------------------
// العينات (fixtures)
// ---------------------------------------------------------------------

/** فودافون كاش — عربي، وارد، بمرجع. */
export const FIXTURE_VODAFONE_AR =
  "تم استلام مبلغ 500.00 جنيه من رقم 01000000000 إلى محفظة فودافون كاش الخاصة بك. رصيدك الحالي 1,750.00 جنيه. رقم العملية 123456789012 بتاريخ 18/11/2026 الساعة 10:30";

/** فودافون كاش — إنجليزي، وارد، بمرجع. */
export const FIXTURE_VODAFONE_EN =
  "You have received EGP 250.50 from 01001112222. Your new balance is EGP 2,000.50. Transaction ID: 998877665544";

/** فودافون كاش — عربي بأرقام مشرقية (٠١٢٣) وفاصلة عربية. */
export const FIXTURE_VODAFONE_AR_INDIC =
  "تم استلام مبلغ ٣٠٠٫٠٠ جنيه من رقم ٠١٠٠١١١٢٢٢٢ الى محفظتك. رقم المرجع ٧٧٨٨٩٩٠٠١١٢٢";

/** إنستاباي/بنك — عربي، إيداع وارد برقم مرجعي. */
export const FIXTURE_INSTAPAY_AR =
  "عميلنا العزيز، تم إيداع مبلغ 1,200.00 جنيه في حسابك من 01003334444. الرقم المرجعي للعملية: 2026111800123456";

/** صادر (تحويل من محفظة المالك لحد) — لازم يطلع مش قابل للمطابقة. */
export const FIXTURE_VODAFONE_SENT =
  "تم تحويل مبلغ 400.00 جنيه بنجاح إلى رقم 01005556666 من محفظتك. رقم العملية 555444333222";

/** رسالة ترويجية — مفيش مبلغ وارد ولا مرجع عملية. */
export const FIXTURE_PROMO =
  "عرض خاص من فودافون: اشترك دلوقتي واكسب هدايا! للاشتراك اتصل بينا. تطبق الشروط والأحكام";

/**
 * اتصالات كاش (e& money) — وارد، بصيغة الرسالة الحقيقية اللي وصلت
 * 2026-11-19 (الاسم مستبدل بـ Test User): «إستلام» بالهمزة، مبلغ
 * بـ«ج.م»، رصيد بعده، وذيل إعلاني فيه أسعار تانية (160/225).
 * رقم المُرسل هو رقم محفظة المتجر العلني المنشور على الموقع.
 */
export const FIXTURE_ETISALAT_RECEIPT =
  "تم إستلام مبلغ 100.00 ج.م من رقم 01020323432 المسجل باسم Test User بنجاح. رصيد محفظتك الحالى 100.39 ج.م.\nاستخدم etisalat money هتكسب و العب هتكسب هدايا تانية كتير http://spr.ly/Spin_The_Wheel\n وكمان تقدر تستمتع بخصم  %30على وجبة كومبو من Buffalo Burger ب 160 جنيه بدل225 لما تدفع ب http://spr.ly/BuffaloBurger2 etisalat money";

/** اتصالات كاش — رسالة ترويجية من نفس الهوية: لازم تفضل ignored. */
export const FIXTURE_ETISALAT_PROMO =
  "مبروووك! كسبت هدية من etisalat money. دوس على اللينك دلوقتى والعب واكسب عشان تستلم هديتك.";

/**
 * فودافون كاش — صيغة المالك الحقيقية (الاسم مستبدل بـ Test User):
 * «جنيه» مش «ج.م»، «رصيدك الحالي» بنقطتين، ورقم عملية صريح.
 */
export const FIXTURE_VODAFONE_OWNER =
  "تم استلام مبلغ 19.00 جنيه من رقم 01146691073 المسجل بإسم Test User على رقم محفظتك  01020323432.\nرصيدك الحالي: 19.00 جنيه\nتاريخ العملية: 07:52 26-10-22\nرقم العملية: 024972825468\nتابع كل مصروفاتك من تاريخ المعاملات على أبلكيشن أنا فودافون http://vf.eg/vfcash";

/** فودافون كاش — نفس الصيغة العربية بس «إستلام» بالهمزة. */
export const FIXTURE_VODAFONE_HAMZA =
  "تم إستلام مبلغ 250.00 جنيه من رقم 01004445555 إلى محفظة فودافون كاش الخاصة بك. رصيدك الحالي 900.00 جنيه. رقم العملية 777888999000";

/** إنستاباي — إيداع بصيغة «أُضيف» (همزة + ضمة): regression للتشكيل. */
export const FIXTURE_INSTAPAY_UDIF =
  "أُضيف مبلغ 300.00 جنيه إلى حسابك بنجاح";

/** فودافون كاش — صادر بصيغة «تم إرسال» بالهمزة: regression للاتجاه. */
export const FIXTURE_VODAFONE_IRSAL =
  "تم إرسال مبلغ 200.00 جنيه إلى رقم 01001112222 من محفظتك";

// ---------------------------------------------------------------------
// الاختبارات
// ---------------------------------------------------------------------

Deno.test("normalizeDigits: أرقام مشرقية وفواصل عربية", () => {
  eq(normalizeDigits("٣٠٠٫٥٠"), "300.50", "indic amount");
  eq(normalizeDigits("١٬٢٥٠"), "1,250", "indic thousands");
});

Deno.test("vodafone ar: مبلغ + مرسل + مرجع + قابل للمطابقة", () => {
  const r = parseSms("VodafoneCash", FIXTURE_VODAFONE_AR);
  eq(r.template, "vodafone_ar", "template");
  eq(r.direction, "received", "direction");
  eq(r.amount_egp, 500, "amount (مش الرصيد 1750)");
  eq(r.sender_account, "01000000000", "sender");
  eq(r.transfer_ref, "123456789012", "ref");
  ok(r.matchable, "matchable");
});

Deno.test("vodafone en: مبلغ + مرسل + مرجع", () => {
  const r = parseSms("VodafoneCash", FIXTURE_VODAFONE_EN);
  eq(r.template, "vodafone_en", "template");
  eq(r.amount_egp, 250.5, "amount");
  eq(r.sender_account, "01001112222", "sender");
  eq(r.transfer_ref, "998877665544", "ref");
  ok(r.matchable, "matchable");
});

Deno.test("vodafone ar indic: الأرقام المشرقية بتتطبع قبل التحليل", () => {
  const r = parseSms("VodafoneCash", FIXTURE_VODAFONE_AR_INDIC);
  eq(r.amount_egp, 300, "amount");
  eq(r.sender_account, "01001112222", "sender");
  eq(r.transfer_ref, "778899001122", "ref");
  ok(r.matchable, "matchable");
});

Deno.test("instapay ar: إيداع بنكي برقم مرجعي", () => {
  const r = parseSms("InstaPay", FIXTURE_INSTAPAY_AR);
  eq(r.amount_egp, 1200, "amount");
  eq(r.sender_account, "01003334444", "sender");
  eq(r.transfer_ref, "2026111800123456", "ref");
  ok(r.matchable, "matchable");
});

Deno.test("mashreq ipn: تحويل لحظي وارد بمرجع سداسي (صيغة المالك الحقيقية)", () => {
  const r = parseSms(
    "instapay",
    "لقد استقبلت تحويل لحظي على 4446 بمبلغ 357.15 جم عبر IPN من InstaPay top-up يوم 2026-04-01 الساعة 23:19 رقم المعاملة 68d913e5 للمساعدة www.mashreq.com/mashreqipn",
  );
  eq(r.direction, "received", "direction");
  eq(r.amount_egp, 357.15, "amount");
  eq(r.transfer_ref, "68d913e5", "hex ref");
  eq(r.sender_account, null, "no sender account in bank format");
  ok(r.matchable, "matchable");
});

Deno.test("mashreq ipn: صادر «قمت بتحويل» مش قابل للمطابقة", () => {
  const r = parseSms(
    "instapay",
    "قمت بتحويل لحظي من حسابك بمبلغ 328.58 جم عبر IPN يوم 2026-04-01 الساعة 23:20 رقم المعاملة 12ab34cd",
  );
  eq(r.direction, "sent", "direction");
  ok(!r.matchable, "not matchable");
});

Deno.test("sent: صادر مش قابل للمطابقة حتى لو فيه مبلغ ومرجع", () => {
  const r = parseSms("VodafoneCash", FIXTURE_VODAFONE_SENT);
  eq(r.direction, "sent", "direction");
  eq(r.matchable, false, "matchable");
});

Deno.test("promo: مفيش مبلغ → قالب none ومش قابل للمطابقة", () => {
  const r = parseSms("VodafoneCash", FIXTURE_PROMO);
  eq(r.template, "none", "template");
  eq(r.amount_egp, null, "amount");
  eq(r.matchable, false, "matchable");
});

Deno.test("normalizeDigits: طيّ همزات الألف (إ/أ/آ → ا) وحذف التشكيل", () => {
  eq(normalizeDigits("إستلام"), "استلام", "hamza below");
  eq(normalizeDigits("أضاف"), "اضاف", "hamza above");
  eq(normalizeDigits("آمن"), "امن", "madda folds");
  eq(normalizeDigits("أُضيف"), "اضيف", "damma stripped, word contiguous");
  eq(normalizeDigits("جنيهًا"), "جنيها", "fathatan stripped");
});

Deno.test("etisalat money: وارد بالهمزة — مبلغ «مبلغ» يكسب على الرصيد والإعلانات", () => {
  const r = parseSms("et money", FIXTURE_ETISALAT_RECEIPT);
  eq(r.template, "etisalat_money", "template");
  eq(r.direction, "received", "direction (مش unknown رغم همزة إستلام)");
  eq(r.amount_egp, 100, "amount (مش الرصيد 100.39 ولا أسعار الإعلان 160/225)");
  eq(r.sender_account, "01020323432", "sender");
  eq(r.transfer_ref, null, "no ref in etisalat format");
  eq(r.origin, "official", "origin");
  ok(r.matchable, "matchable");
});

Deno.test("etisalat money: رسالة ترويجية من نفس الهوية تفضل ignored", () => {
  const r = parseSms("et money", FIXTURE_ETISALAT_PROMO);
  eq(r.template, "none", "template");
  eq(r.amount_egp, null, "amount");
  eq(r.matchable, false, "matchable");
});

Deno.test("vodafone owner format: صيغة المالك الحقيقية تعدّي كاملة (regression)", () => {
  const r = parseSms("VF-Cash", FIXTURE_VODAFONE_OWNER);
  eq(r.template, "vodafone_ar", "template");
  eq(r.direction, "received", "direction");
  eq(r.amount_egp, 19, "amount");
  eq(r.sender_account, "01146691073", "sender");
  eq(r.transfer_ref, "024972825468", "ref");
  ok(r.matchable, "matchable");
});

Deno.test("vodafone hamza: «إستلام» بالهمزة من مرسل فودافون تعدّي وارد (regression)", () => {
  const r = parseSms("VodafoneCash", FIXTURE_VODAFONE_HAMZA);
  eq(r.template, "vodafone_ar", "template");
  eq(r.direction, "received", "direction (مش unknown)");
  eq(r.amount_egp, 250, "amount");
  eq(r.sender_account, "01004445555", "sender");
  eq(r.transfer_ref, "777888999000", "ref");
  ok(r.matchable, "matchable");
});

Deno.test("instapay udif: «أُضيف» بالهمزة والتشكيل تعدّي وارد وقابلة للمطابقة (regression)", () => {
  const r = parseSms("InstaPay", FIXTURE_INSTAPAY_UDIF);
  eq(r.direction, "received", "direction (مش unknown رغم الهمزة والضمة)");
  eq(r.amount_egp, 300, "amount");
  ok(r.matchable, "matchable");
});

Deno.test("vodafone irsal: «تم إرسال» بالهمزة تفضل صادر مش unknown (regression)", () => {
  const r = parseSms("VodafoneCash", FIXTURE_VODAFONE_IRSAL);
  eq(r.direction, "sent", "direction (مش unknown)");
  eq(r.matchable, false, "matchable");
});

Deno.test("dedupe: بمرجع ثابت لنفس (مرسل+مرجع)، وبيختلف باختلاف المرجع", async () => {
  const base = {
    sender_id: "VodafoneCash",
    body: FIXTURE_VODAFONE_AR,
    received_at_iso: "2026-11-18T08:30:00.000Z",
    amount_egp: 500,
    transfer_ref: "123456789012",
  };
  const k1 = await computeDedupeKey(base);
  const k2 = await computeDedupeKey({ ...base, body: "نص مختلف تمامًا" });
  eq(k1, k2, "ref-based key ignores body");
  const k3 = await computeDedupeKey({ ...base, transfer_ref: "999" });
  ok(k1 !== k3, "different ref → different key");
  const k4 = await computeDedupeKey({ ...base, transfer_ref: null });
  ok(k4.startsWith("auto:"), "no ref → auto key");
});
