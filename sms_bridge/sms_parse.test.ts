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
