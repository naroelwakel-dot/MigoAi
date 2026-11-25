// اختبارات قسم توريد الشركاء في اللوحة —
// `deno test control/partners_panel.test.ts`
// المنطق النقي عايش جوه سكربت اللوحة في control.html بين
// علامتي PURE-PARTNERS — الاختبارات دي بتقراه من هناك
// حرفيًا وبتشغّله، وبتتأكد من توصيل الشاشة (القائمة والتفاصيل
// والأوراق) بمسارات الخادم الجديدة. الأشكال اللي تحت على
// عقد نقاط البوت /api/control/partners و/api/control/partner
// و/api/control/servers المتفق عليه.
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

interface PureApi {
  usdTextOf: (cents: unknown) => string | null;
  serverStatusText: (status: unknown) => string;
  partnerReasonText: (reason: unknown) => string;
  partnerOrderStatusText: (order: unknown) => string;
  partnerTxText: (tx: unknown) => string;
}

const PB = "/*PURE-PARTNERS-BEGIN*/";
const PE = "/*PURE-PARTNERS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure partners block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { usdTextOf, serverStatusText, partnerReasonText, partnerOrderStatusText, partnerTxText };",
) as () => PureApi)();

Deno.test("usdTextOf: سنتات -> نص دولار بخانتين", () => {
  eq(pure.usdTextOf(1840), "18.40", "1840 -> 18.40");
  eq(pure.usdTextOf(0), "0.00", "zero is a real value");
  eq(pure.usdTextOf(20), "0.20", "20 -> 0.20");
  eq(pure.usdTextOf(-4), "-0.04", "negative correction keeps its sign");
  eq(pure.usdTextOf(null), null, "null -> null");
  eq(pure.usdTextOf("abc"), null, "non-numeric -> null");
  eq(pure.usdTextOf(undefined), null, "undefined -> null");
});

Deno.test("serverStatusText: كلمات الحالة التلاتة بكلام واضح", () => {
  eq(pure.serverStatusText("ok"), "شغال", "ok");
  eq(pure.serverStatusText("pressure"), "عليه ضغط", "pressure");
  eq(pure.serverStatusText("down"), "متوقف", "down");
  eq(pure.serverStatusText("???"), "مش معروف", "unknown falls back");
});

Deno.test("partnerOrderStatusText: الحالات والأسباب بكلام واضح", () => {
  eq(pure.partnerOrderStatusText({ status: "delivered" }), "اتسلّم", "delivered");
  eq(pure.partnerOrderStatusText({ status: "processing" }), "شغال دلوقتي", "processing");
  eq(pure.partnerOrderStatusText({ status: "awaiting_code" }), "مستني الكود", "awaiting_code");
  eq(pure.partnerOrderStatusText({ status: "awaiting_customer" }), "مستني العميل", "awaiting_customer");
  eq(pure.partnerOrderStatusText({ status: "queued" }), "في الانتظار", "other status");
  eq(pure.partnerOrderStatusText({ status: "failed", failure_reason: "account_ineligible" }),
    "فشل — الحساب مش مؤهل", "account_ineligible");
  eq(pure.partnerOrderStatusText({ status: "failed", failure_reason: "code_rejected" }),
    "فشل — الكود اترفض", "code_rejected");
  eq(pure.partnerOrderStatusText({ status: "failed", failure_reason: "verification_failed" }),
    "فشل — التحقق فشل", "verification_failed");
  eq(pure.partnerOrderStatusText({ status: "failed", failure_reason: "expired" }),
    "فشل — انتهت المهلة", "expired");
  eq(pure.partnerOrderStatusText({ status: "failed", failure_reason: "something_new" }),
    "فشل", "unknown reason shows plain failure");
  eq(pure.partnerOrderStatusText(null), "في الانتظار", "null order");
});

Deno.test("partnerTxText: أسماء الحركات بكلام واضح", () => {
  eq(pure.partnerTxText({ type: "credit" }), "إضافة رصيد", "credit");
  eq(pure.partnerTxText({ type: "charge" }), "خصم تفعيلة اتسلّمت", "charge");
  eq(pure.partnerTxText({ type: "price_correction" }), "تصحيح سعر", "price_correction");
  eq(pure.partnerTxText({ kind: "refund" }), "رجوع رصيد", "kind fallback + refund");
  eq(pure.partnerTxText({}), "حركة محفظة", "unknown type");
  eq(pure.partnerTxText(null), "حركة محفظة", "null tx");
});

Deno.test("التوصيل: الشاشة والبطاقات والأزرار موجودة ومتوصلة", () => {
  ok(html.includes('<main id="partnersMain" class="hidden">'), "partners main exists");
  ok(html.includes('data-back-from="partners"'), "unified back button");
  ok(html.includes('id="serversBody"'), "servers card body");
  ok(html.includes('id="partnersList"'), "partner list body");
  ok(html.includes('id="partnerBalanceBody"'), "balance body");
  ok(html.includes('id="partnerOrdersBody"'), "orders body");
  ok(html.includes('id="partnerTxBody"'), "transactions body");
  ok(html.includes('id="partnerReceiptsBody"'), "receipts body");
  ok(html.includes("function ensurePartnersLoaded(){"), "ensure loader defined");
  ok(html.includes("partners: ensurePartnersLoaded"), "more-menu ensure wired");
  ok(html.includes('api("/control/servers")'), "servers endpoint used");
  ok(html.includes('api("/control/partners")'), "list endpoint used");
  ok(html.includes('api("/control/partner?id="'), "detail endpoint used");
  ok(html.includes('api("/control/partner-credit"'), "credit endpoint used");
  ok(html.includes('api("/control/partner-received"'), "received endpoint used");
  ok(html.includes('partners: "توريد الشركاء"'), "view title present");
  ok(html.includes('["partners", "توريد الشركاء"]'), "more-menu entry present");
  ok(html.includes("تعذر جلب البيانات"), "degraded wording present");
});
