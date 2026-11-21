// اختبارات رصيد الموردين في قائمة المحرك —
// `deno test control/suppliers_panel.test.ts`
// المنطق النقي عايش جوه سكربت اللوحة في control.html بين
// علامتي PURE-SUPPLIERS — الاختبارات دي بتقراه من هناك
// حرفيًا وبتشغّله. خلفية الإصلاح: قائمة الموردين ما كانتش
// بتعرض أي رصيد (الرصيد كان بيظهر بس بزر جوه صفحة كل مورد)،
// فبقى الرصيد بيتقرأ تلقائيًا مع فتح الشاشة وبيظهر في الصف.
// الأشكال اللي تحت منقولة من ردود عملية الرصيد الحية.
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
  supplierBalanceOf: (
    d: unknown,
  ) => { amount: number; currency: string } | null;
}

const PB = "/*PURE-SUPPLIERS-BEGIN*/";
const PE = "/*PURE-SUPPLIERS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure suppliers block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) + "\nreturn { supplierBalanceOf };",
) as () => PureApi)();

Deno.test("supplierBalanceOf: أصغر وحدة لقيمة رئيسية زي رد البوت الحي", () => {
  // رد Bunny الحي: {result: {balance: 212, currency: "USD"}} = $2.12.
  eq(pure.supplierBalanceOf({ ok: true, result: { balance: 212, currency: "USD" } }),
    { amount: 2.12, currency: "دولار" }, "bunny 212 -> 2.12 دولار");
  eq(pure.supplierBalanceOf({ result: { balance: 0, currency: "USD" } }),
    { amount: 0, currency: "دولار" }, "zero balance is a real balance");
  eq(pure.supplierBalanceOf({ result: { balance: 1050, currency: "EUR" } }),
    { amount: 10.5, currency: "EUR" }, "non-USD keeps its code");
  eq(pure.supplierBalanceOf({ result: { balance: 300 } }),
    { amount: 3, currency: "دولار" }, "missing currency defaults to USD label");
});

Deno.test("supplierBalanceOf: أشكال فاسدة = null (الصف بيكتب مش متاح)", () => {
  eq(pure.supplierBalanceOf(null), null, "null body");
  eq(pure.supplierBalanceOf({}), null, "no result");
  eq(pure.supplierBalanceOf({ result: null }), null, "null result");
  eq(pure.supplierBalanceOf({ result: { balance: "abc" } }), null, "non-numeric");
  eq(pure.supplierBalanceOf({ result: {} }), null, "no balance field");
});

Deno.test("التوصيل: الرصيد بيتقرأ مع التحميل وبيظهر في صف المورد", () => {
  ok(html.includes("fetchSupplierBalances();"), "loadSuppliers triggers balance fetch");
  ok(html.includes("function fetchSupplierBalances(){"), "fetcher defined");
  ok(html.includes('op: "balance"'), "balance op used");
  ok(html.includes("supplierBalanceLine(s.slug)"), "row renders the balance line");
  ok(html.includes("الرصيد: بيتقرأ دلوقتي…"), "loading wording present");
  ok(html.includes("الرصيد: مش متاح دلوقتي"), "failure wording present");
});
