/**
 * اختبارات تدقيق W4 لمحلّل الرسائل — `deno test sms_parse_w4.test.ts`
 * من غير أي استيراد خارجي (offline بالكامل).
 *
 * بتثبّت الأمثلة التلاتة اللي Instinct شغّلها على المحلّل الحي
 * وطلعت إيداعات وهمية/خاطئة:
 *   ١. رسالة فشل («لم يتم استلام…») كانت بتتصنف وارد + قابلة
 *      للمطابقة بمبلغ 500.
 *   ٢. إعلان فودافون («اشحن 50 وهتوصلك…») كان بيتصنف وارد +
 *      قابل للمطابقة بمبلغ 50 (علامة «وصل» جوه «هتوصلك»).
 *   ٣. رسالة فيها رسوم وإيداع كانت بتلقط الرسوم (2) بدل مبلغ
 *      الإيداع (498) لأن قاعدة «كلمة المبلغ» كانت بترجع أول
 *      مرشّح من غير فحص سياق.
 * وبتثبّت كمان إصلاح المرجع/مفتاح التكرار: رقم حساب ثابت في
 * الرسالة ما يبقاش مرجع عملية، وإيداعان مختلفان بنفس «المرجع»
 * الثابت ما يتصادموش على نفس مفتاح منع التكرار.
 */
import { computeDedupeKey, parseSms } from "./sms_parse.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// مثال Instinct ١ — رسالة فشل استلام من فودافون.
const FAILURE_SMS =
  "عميلنا العزيز، لم يتم استلام مبلغ 500 جنيه من رقم 01012345678. برجاء إعادة المحاولة.";

// مثال Instinct ٢ — إعلان فودافون.
const AD_SMS =
  "عروض فودافون: اشحن 50 جنيه وهتوصلك رسالة بالهدية فورًا";

// مثال Instinct ٣ — رسوم + إيداع في رسالة واحدة.
const FEE_AND_DEPOSIT_SMS =
  "تم خصم رسوم بقيمة 2 جنيه. تم ايداع مبلغ 498 جنيه في حسابك بنجاح";

Deno.test("W4-1: رسالة فشل الاستلام مش واردة ومش قابلة للمطابقة", () => {
  const r = parseSms("Vodafone", FAILURE_SMS);
  eq(r.direction, "unknown", "direction (النفي بيخفي علامة الاستلام)");
  eq(r.matchable, false, "matchable");
  eq(r.origin, "official", "origin (الهوية رسمية — الخطر كان في الاتجاه)");
});

Deno.test("W4-2: إعلان «هتوصلك» مش وارد ومش قابل للمطابقة", () => {
  const r = parseSms("Vodafone", AD_SMS);
  eq(r.direction, "unknown", "direction («وصل» ما بتطابقش جوه «هتوصلك»)");
  eq(r.matchable, false, "matchable");
});

Deno.test("W4-3: المبلغ الملتقط هو الإيداع 498 مش الرسوم 2", () => {
  const r = parseSms("VodafoneCash", FEE_AND_DEPOSIT_SMS);
  eq(r.direction, "received", "direction");
  eq(r.amount_egp, 498, "amount (مش رسوم 2)");
  eq(r.matchable, true, "matchable");
});

Deno.test("W4-3b: رسالة رسوم لوحدها مش قابلة للمطابقة أبدًا", () => {
  const r = parseSms(
    "VodafoneCash",
    "تم خصم رسوم بقيمة 2 جنيه من محفظتك مقابل الخدمة",
  );
  // مفيش علامة وارد أصلًا → الاتجاه مش received → الحدث بيتسجل
  // ignored في الجسر (p_amount = null) مهما كان المبلغ الملتقط.
  eq(r.direction, "unknown", "direction");
  eq(r.matchable, false, "matchable");
});

Deno.test("W4-4: رقم حساب ثابت في الرسالة ما بيبقاش مرجع عملية", () => {
  const r = parseSms(
    "InstaPay",
    "تم ايداع مبلغ 700 جنيه في حسابك 123456789012 بنجاح",
  );
  eq(r.amount_egp, 700, "amount");
  eq(r.transfer_ref, null, "ref (رقم الحساب مش مرجع)");
  ok(r.matchable, "matchable");
});

Deno.test("W4-5: إيداعان مختلفان بنفس الرقم الثابت ما يتصادموش في مفتاح التكرار", async () => {
  const a = parseSms(
    "InstaPay",
    "تم ايداع مبلغ 700 جنيه في حسابك 123456789012 بنجاح",
  );
  const b = parseSms(
    "InstaPay",
    "تم ايداع مبلغ 900 جنيه في حسابك 123456789012 بنجاح",
  );
  const ka = await computeDedupeKey({
    sender_id: "InstaPay",
    body: "تم ايداع مبلغ 700 جنيه في حسابك 123456789012 بنجاح",
    received_at_iso: "2026-11-23T04:00:00.000Z",
    amount_egp: a.amount_egp,
    transfer_ref: a.transfer_ref,
  });
  const kb = await computeDedupeKey({
    sender_id: "InstaPay",
    body: "تم ايداع مبلغ 900 جنيه في حسابك 123456789012 بنجاح",
    received_at_iso: "2026-11-23T04:05:00.000Z",
    amount_egp: b.amount_egp,
    transfer_ref: b.transfer_ref,
  });
  ok(ka !== kb, "distinct deposits → distinct dedupe keys");
});

Deno.test("W4-6: وارد حقيقي بصيغة «وصلك» لسه بيتصنف وارد (regression)", () => {
  const r = parseSms("VodafoneCash", "وصلك مبلغ 150 جنيه من رقم 01009998877");
  eq(r.direction, "received", "direction");
  eq(r.amount_egp, 150, "amount");
  ok(r.matchable, "matchable");
});
