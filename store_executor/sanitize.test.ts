/**
 * اختبارات بوابة التسليم في sanitize.ts —
 * `deno test store_executor/sanitize.test.ts`، من غير أي استيراد
 * خارجي (بتشتغل offline بالكامل — ممنوع أي نداء حي).
 *
 * التغطية:
 * 1. بوابة المخططات (F-06): عناصر التسليم اللي قيمتها URL بمخطط غير
 *    ويب (javascript:/data:/vbscript:/file:) بتتحذف من التسليم الآمن،
 *    وروابط http/https بتعدي زي ما هي (تحليل نصي خالص — مفيش فتح).
 * 2. القيم النصية العادية (كود/إيميل حساب) مش URLs فبتعدي زي ما هي.
 * 3. بوابة التسريب الأصلية لسه شغالة: عنصر فيه بصمة مورد بيتحذف.
 * 4. تنقية الأسرار (F-07): secretValues() عند المحوّل بترجع المفتاح،
 *    و sanitizeText بـ { secrets } بتشيل المفتاح من نص خطأ مردّده.
 */
import { customerSafeDelivery, hasNonWebScheme, sanitizeText } from "./sanitize.ts";
import { DrayikAdapter } from "./adapters.ts";
import type { HttpTransport } from "./types.ts";

// مساعدات تأكيد صغيرة (بديل std/assert عشان الاختبار يشتغل offline).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(value: unknown, label: string) {
  if (!value) throw new Error(`${label}: expected truthy, got ${value}`);
}

Deno.test("scheme gate: non-web scheme delivery items are dropped", () => {
  const items = [
    { label: "الرابط", value: "javascript:alert(1)" },
    { label: "الرابط", value: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" },
    { label: "الرابط", value: "vbscript:msgbox(1)" },
    { label: "الرابط", value: "file:///etc/passwd" },
    { label: "الرابط", value: "java\tscript:alert(1)" },
  ];
  const { safe, dropped } = customerSafeDelivery(items);
  eq(safe.length, 0, "no non-web item survives");
  eq(dropped, items.length, "all non-web items dropped");
});

Deno.test("scheme gate: http/https links pass through untouched", () => {
  const items = [
    { label: "رابط التفعيل", value: "https://supplier.example/activate?token=abc123" },
    { label: "الرابط", value: "http://example.com/deliver/42" },
    { label: "الرابط", value: "HTTPS://EXAMPLE.COM/Path" },
  ];
  const { safe, dropped } = customerSafeDelivery(items);
  eq(dropped, 0, "web links are not dropped");
  eq(safe, items, "web links pass byte-identical (never opened, never rewritten)");
});

Deno.test("scheme gate: plain codes and accounts are not URLs and pass", () => {
  const items = [
    { label: "كود التفعيل", value: "ABCD-1234-EFGH" },
    { label: "الحساب", value: "user@example.com" },
    { label: "كلمة المرور", value: "p@ss:w0rd" },
  ];
  const { safe, dropped } = customerSafeDelivery(items);
  eq(dropped, 0, "plain values are not dropped");
  eq(safe.length, items.length, "plain values all pass");
  eq(hasNonWebScheme("ABCD-1234-EFGH"), false, "code is not a URL");
  eq(hasNonWebScheme("javascript:alert(1)"), true, "javascript scheme flagged");
  eq(hasNonWebScheme("https://example.com"), false, "https is a web scheme");
});

Deno.test("leak gate still applies alongside the scheme gate", () => {
  const items = [
    { label: "رابط التفعيل", value: "https://drayik.shop/activate/1" },
    { label: "رابط التفعيل", value: "https://example.com/activate/1" },
  ];
  const { safe, dropped } = customerSafeDelivery(items);
  eq(dropped, 1, "supplier-host item dropped by the leak gate");
  eq(safe.length, 1, "clean item survives");
  eq(safe[0].value, "https://example.com/activate/1", "survivor is the clean item");
});

Deno.test("secrets: adapter secretValues feeds sanitizeText on error paths", () => {
  const transport: HttpTransport = {
    request: () => Promise.reject(new Error("no network in tests")),
  };
  const adapter = new DrayikAdapter(transport, () => "TESTKEY-1234567890");
  const secrets = adapter.secretValues();
  eq(secrets, ["TESTKEY-1234567890"], "adapter exposes its key for scrubbing");
  const echoed = "upstream 401: invalid api key TESTKEY-1234567890 supplied";
  const cleaned = sanitizeText(echoed, { secrets });
  ok(!cleaned.includes("TESTKEY-1234567890"), "echoed key never survives sanitizing");
  ok(cleaned.includes("***"), "key replaced with mask");
});
