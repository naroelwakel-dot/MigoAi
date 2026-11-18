/**
 * اختبارات تحصين محلّل الرسائل (الحزمة 13) — `deno test` من غير أي
 * استيراد خارجي (offline بالكامل). بتغطي تصنيف الأصل classifyOrigin
 * وحقل origin في ناتج parseSms — الطبقة اللي بوابة الشحن في
 * القاعدة (هجرة 015) بتبني عليها رفض الرسائل المفبركة من أرقام
 * عادية. اختبارات الحزمة 11 (sms_parse.test.ts) بتفضل شغالة زي
 * ما هي جنب الملف ده.
 */
import { classifyOrigin, OFFICIAL_SMS_SENDERS, parseSms } from "./sms_parse.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

Deno.test("classifyOrigin: الهويات الرسمية المعروفة", () => {
  eq(classifyOrigin("VodafoneCash"), "official", "VodafoneCash");
  eq(classifyOrigin("vodafonecash"), "official", "lowercase variant");
  eq(classifyOrigin("Vodafone Cash"), "official", "with space");
  eq(classifyOrigin("Vodafone"), "official", "bare brand");
  eq(classifyOrigin("  VodafoneCash  "), "official", "trimmed");
  // حزمة 14: محافظ المالك كلها مسجلة رسميًا (أمر 2026-11-18).
  eq(classifyOrigin("VF-Cash"), "official", "VF-Cash (Vodafone Egypt real id)");
  eq(classifyOrigin("et money"), "official", "et money (Etisalat Cash)");
  eq(classifyOrigin("e& money"), "official", "e& money (Etisalat Cash)");
  eq(classifyOrigin("EtisalatCash"), "official", "EtisalatCash");
  eq(classifyOrigin("Etisalat Cash"), "official", "Etisalat Cash");
  eq(classifyOrigin("InstaPay"), "official", "InstaPay");
  eq(classifyOrigin("Telda"), "official", "Telda");
  ok(OFFICIAL_SMS_SENDERS.length >= 1, "official list non-empty");
});

Deno.test("classifyOrigin: أرقام عادية = numeric (قناة المفبرِك)", () => {
  eq(classifyOrigin("01001234567"), "numeric", "egyptian mobile");
  eq(classifyOrigin("+201001234567"), "numeric", "intl format");
  eq(classifyOrigin("0100 123 4567"), "numeric", "spaced number");
});

Deno.test("classifyOrigin: أشكال قريبة ومجهولة = unknown", () => {
  // هوية مزوّرة قريبة الشكل من الرسمية — مش مطابقة تامة فمش رسمية.
  eq(classifyOrigin("VodafoneCashEG"), "unknown", "suffixed lookalike");
  eq(classifyOrigin("Vodafone-Cash"), "unknown", "hyphenated lookalike");
  eq(classifyOrigin("VF-Pay"), "unknown", "unregistered short id");
  eq(classifyOrigin(""), "unknown", "empty");
  eq(classifyOrigin("Etisalat"), "unknown", "bare carrier brand stays unregistered");
});

Deno.test("parseSms: origin بيتحمل في الناتج على القناتين", () => {
  const real = parseSms(
    "VodafoneCash",
    "تم استلام مبلغ 500.00 جنيه من رقم 01000000000 إلى محفظتك. رقم العملية 123456789012",
  );
  eq(real.origin, "official", "official sms origin");
  eq(real.matchable, true, "official sms still matchable");

  // نفس النص بالحرف من رقم عادي: الحقول بتتستخرج زي ما هي (المطابقة
  // شغل القاعدة)، بس الأصل numeric — والبوابة هترفض الشحن التلقائي.
  const fake = parseSms(
    "01099998888",
    "تم استلام مبلغ 500.00 جنيه من رقم 01000000000 إلى محفظتك. رقم العملية 123456789012",
  );
  eq(fake.origin, "numeric", "fake sms origin");
  eq(fake.amount_egp, 500, "fake sms amount still extracted");
  eq(fake.transfer_ref, "123456789012", "fake sms ref still extracted");
});

Deno.test("parseSms: إشعار تطبيق (sender = حزمة) — الحقول بتتستخرج والأصل مش SMS", () => {
  const notif = parseSms(
    "com.vodafone.ana",
    "تم استلام مبلغ 500.00 جنيه من رقم 01000000000. رقم العملية 123456789012",
  );
  eq(notif.amount_egp, 500, "notification amount");
  eq(notif.origin, "unknown", "package is not an sms origin");
});
