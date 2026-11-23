// اختبارات واجهة الموجة التالتة من خطة إنستينكت (بنود ١٥–٢٢ + ٢٤) —
// `deno test control/wave3ui.test.ts`
// المنطق النقي عايش جوه سكربت اللوحة في control.html بين علامتي
// PURE-WAVE3UI — الاختبارات بتقراه من هناك حرفيًا وبتشغّله،
// وباقي الاختبارات فحوص ساكنة على توصيل الواجهة (التنبيهات،
// البحث، المتابعات، الفحص، المسودات، الأثر، الجماعي،
// المعاينة المترابطة، المساعدة) من غير أي نداء حي.
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
  searchSourceWord: (s: string) => string;
  searchGroupLabel: (g: string) => string;
  diagnoseStateWord: (s: string) => [string, string];
  diagnoseFirstKey: (
    cps: { key: string; state: string }[],
    first: string | null,
  ) => string | null;
  draftKeyAllowed: (k: string) => boolean;
  draftKeyFor: (p: string, n: string) => string;
  draftSourceIsNewer: (a: string | null, b: string | null) => boolean;
  BULK_ACTIONS_W3: string[];
  bulkActionAllowed: (a: string) => boolean;
  impactLines: (d: Record<string, unknown>) => string[];
  previewReasonWord: (r: string) => string;
  followupKindLabel: (k: string) => string;
  ACTION_HELP: Record<string, { does: string; avoid: string }>;
  actionHelpOf: (k: string) => { does: string; avoid: string } | null;
}

const PB = "/*PURE-WAVE3UI-BEGIN*/";
const PE = "/*PURE-WAVE3UI-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure wave3ui block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { searchSourceWord, searchGroupLabel, diagnoseStateWord, diagnoseFirstKey, draftKeyAllowed, draftKeyFor, draftSourceIsNewer, BULK_ACTIONS_W3, bulkActionAllowed, impactLines, previewReasonWord, followupKindLabel, ACTION_HELP, actionHelpOf };",
) as () => PureApi)();

function seg(from: string, to: string): string {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("segment not found: " + from);
  return html.slice(a, b);
}

// ---------- بند ١٦: مصادر ومجموعات البحث ----------
Deno.test("البحث الموحد: كلمة المصدر والمجموعات الخمس", () => {
  eq(pure.searchSourceWord("bot"), "البوت", "bot source");
  eq(pure.searchSourceWord("bot_topup"), "البوت", "bot topup source");
  eq(pure.searchSourceWord("site"), "الموقع", "site source");
  eq(pure.searchSourceWord("sms"), "الموقع", "sms event source is site side");
  eq(pure.searchSourceWord("binance"), "الموقع", "deposit source is site side");
  eq(
    ["orders", "events", "customers", "products", "merchants"].map((g) =>
      pure.searchGroupLabel(g)
    ),
    ["طلبات", "أحداث", "عملاء", "منتجات", "تجار"],
    "five groups in plan order",
  );
  ok(html.includes('id="w3SearchQ"'), "search entry at top of home");
  ok(
    html.includes("ابحث برقم طلب أو تحويل أو اسم منتج أو تاجر"),
    "search placeholder names the identifier kinds",
  );
  ok(html.includes('api("/control/search?q="'), "search calls the unified endpoint");
  ok(html.includes('id="moreUnifiedSearchBtn"'), "search entry inside المزيد");
  ok(html.includes("openEntityById(kindMap[parts[0]], hit.id, hit.source)"),
    "hits open by id through the existing openers");
});

// ---------- بند ١٥: التنبيهات ----------
Deno.test("التنبيهات: بلوك في مهامي بيتقرا حية وبيفتح الحالة", () => {
  ok(html.includes('id="notifCard"') && html.includes("<h2>تنبيهات</h2>"),
    "notifications block on home");
  ok(html.includes('api("/control/notifications")'), "fed by the notifications endpoint");
  ok(html.includes("الحالة اللي تتحل بتختفي من هنا لوحدها"),
    "resolved cases disappear by themselves — stated on the block");
  ok(html.includes("data-notif-open"), "each item opens its target");
  ok(html.includes('id="sectionStatus-notifs"'), "section-state line for notifications");
  ok(html.includes('if (key === "notifs") { loadNotifications(); return; }'),
    "retry reloads only the notifications section");
});

// ---------- بند ١٧: المتابعات ----------
Deno.test("المتابعات: إضافة من التفاصيل وقائمة وإغلاق في مهامي", () => {
  ok(html.includes('id="followupCard"') && html.includes("<h2>متابعاتي</h2>"),
    "follow-ups block on home");
  ok(html.includes('api("/control/followups?status=open")'), "open follow-ups listed");
  ok(html.includes('api("/control/followups-close"'), "close goes to the close endpoint");
  ok(html.includes('api("/control/followups", { method: "POST"'),
    "create goes to the followups endpoint");
  ok(html.includes("حالة العنصر نفسه وفلوسه ما بيتغيروش"),
    "closing never touches the case or its money — stated");
  eq(pure.followupKindLabel("order"), "طلب", "order kind label");
  eq(pure.followupKindLabel("topup"), "شحنة", "topup kind label");
  ok((html.match(/أضف متابعة/g) || []).length >= 5,
    "add-follow-up entries on order/event/topup/chat/customer surfaces");
  ok(html.includes("المطلوب بعد كده"), "note field is the next step");
});

// ---------- بند ١٨: افحص السبب ----------
Deno.test("افحص السبب: كلمات الحالة وأول نقطة غير مؤكدة", () => {
  eq(pure.diagnoseStateWord("confirmed"), ["مؤكد", "ok"], "confirmed word");
  eq(pure.diagnoseStateWord("unconfirmed"), ["مش مؤكد", "warn"], "unconfirmed word");
  eq(pure.diagnoseStateWord("unknown"), ["مش معروف", "mut"], "unknown word");
  eq(pure.diagnoseFirstKey([
    { key: "payment", state: "confirmed" },
    { key: "provider", state: "unknown" },
    { key: "delivery", state: "unconfirmed" },
  ], null), "delivery", "first unconfirmed wins over unknown");
  eq(pure.diagnoseFirstKey([
    { key: "payment", state: "confirmed" },
    { key: "provider", state: "unknown" },
  ], null), "provider", "unknown is the fallback first point");
  eq(pure.diagnoseFirstKey([{ key: "payment", state: "confirmed" }], null), null,
    "all confirmed = no first point");
  ok(html.includes('api("/control/diagnose?kind="'), "diagnose endpoint wired");
  ok((html.match(/افحص السبب/g) || []).length >= 4,
    "diagnose buttons on order detail, event cards and topup rows");
  ok(html.includes("runDiagnoseAction"), "suggested action opens an existing flow");
});

// ---------- بند ١٩: المسودات ----------
Deno.test("المسودات: مفاتيح النصوص الطويلة بس والأسرار مرفوضة", () => {
  eq(pure.draftKeyFor("channel", "composer"), "channel:composer", "channel key");
  eq(pure.draftKeyFor("support", "chat-123"), "support:chat-123", "support key");
  ok(pure.draftKeyAllowed("channel:composer"), "channel draft allowed");
  ok(pure.draftKeyAllowed("site:announcement"), "site draft allowed");
  ok(pure.draftKeyAllowed("faq:main"), "faq draft allowed");
  ok(pure.draftKeyAllowed("support:chat-42"), "support draft allowed");
  ok(!pure.draftKeyAllowed("site:api-key"), "api-key component rejected");
  ok(!pure.draftKeyAllowed("channel:my-secret"), "secret component rejected");
  ok(!pure.draftKeyAllowed("site:token"), "token component rejected");
  ok(!pure.draftKeyAllowed("wallet:adjust"), "money prefix rejected");
  ok(!pure.draftKeyAllowed("channel:"), "empty name rejected");
  ok(pure.draftKeyAllowed("site:monkey"), "monkey is not a secret word");
  eq(pure.draftSourceIsNewer("2026-11-23T10:00:00Z", "2026-11-23T09:00:00Z"), true,
    "source newer than draft = stale warning");
  eq(pure.draftSourceIsNewer("2026-11-23T09:00:00Z", "2026-11-23T10:00:00Z"), false,
    "draft newer = no warning");
  eq(pure.draftSourceIsNewer(null, "2026-11-23T10:00:00Z"), false,
    "no source timestamp = no invented warning");
  ok(html.includes("المحتوى الأصلي اتغيّر بعد المسودة"), "stale-draft warning wording");
  ok(html.includes("مسودة غير منشورة"), "unpublished-draft badge wording");
});

Deno.test("المسودات: مربوطة بمحررات النصوص بس — ولا حقل سر أو فلوس", () => {
  const wired = [...html.matchAll(/draftTextBinding\("([^"]+)", "([^"]+)"/g)]
    .map((m) => [m[1], m[2]]);
  eq(wired, [
    ["channel:composer", "chnText"],
    ["site:announcement", "siteAnnText"],
    ["site:terms", "siteTermsText"],
    ["site:maintenance", "siteMaintMsg"],
  ], "only the long-text editors are draft-wired");
  ok(html.includes('draftRegister("faq:main"'), "faq editor draft-wired");
  ok(html.includes('draftKeyFor("support", "chat-"'), "support reply draft-wired per chat");
  const allKeys = [...html.matchAll(/draft(?:TextBinding|Register|KeyFor|Delete|Check)\("?([^",)]+)/g)]
    .map((m) => m[1]);
  ok(allKeys.length > 0, "draft call sites found");
  for (const k of allKeys) {
    ok(!/secret|token|password|passwd|api-key|pin|otp|totp/i.test(k),
      "no secret-ish draft key: " + k);
  }
  ok(!/draft\w*\([^)]*(adjAmt|adjReason|trAmt|setVal|mchNewSecret|totp)/.test(html),
    "no money/secret field is ever passed to a draft function");
  ok(html.includes('draftDelete("channel:composer")'),
    "channel draft deleted after a successful real save");
  ok(html.includes("SITE_DRAFT_KEYS[key]) draftDelete"),
    "site drafts deleted after a successful real save");
});

// ---------- بند ٢٠: أثر التغيير ----------
Deno.test("أثر التغيير: فصل القائم عن الجديد والمجهول صريح", () => {
  const lines = pure.impactLines({
    existing_orders: { open_orders: [{ id: "o1" }, { id: "o2" }] },
    new_purchases: { linked_products: [{ id: "p1", title: "منتج" }], supplier_listings_count: 3 },
    unknowns: ["أثر س مش قابل للإثبات"],
  });
  ok(lines.some((l) => l.startsWith("طلبات بوت مفتوحة قائمة")), "existing orders separated");
  ok(lines.some((l) => l.includes("مشتريات الجديدة") || l.includes("المشتريات الجديدة")),
    "new purchases separated");
  eq(lines[lines.length - 1], "مش معروف: أثر س مش قابل للإثبات", "unknowns listed plainly");
  ok(html.includes('api("/control/impact?kind="'), "impact endpoint wired");
  ok(html.includes("تعذّر التحقق من أثر التغيير ده دلوقتي"),
    "failed impact read is declared in the confirm, never silent zero");
  ok(html.includes("openSupplierDisableConfirm"), "supplier disable goes through impact");
  ok(html.includes('fetchImpactHtml("paymethod"'), "paymethod disable goes through impact");
  ok(html.includes('fetchImpactHtml("product"'), "product archive goes through impact");
});

// ---------- بند ٢١: الجماعي ----------
Deno.test("الجماعي: فعلان لغير الفلوس بس ومعاينة ونتيجة لكل عنصر", () => {
  eq(pure.BULK_ACTIONS_W3, ["catalog.archive", "coupons.stop"], "bulk whitelist is exactly two");
  ok(pure.bulkActionAllowed("catalog.archive"), "archive allowed");
  ok(pure.bulkActionAllowed("coupons.stop"), "coupon stop allowed");
  ok(!pure.bulkActionAllowed("wallet.adjust"), "wallet adjust rejected");
  ok(!pure.bulkActionAllowed("orders.refund"), "refund rejected");
  ok(!pure.bulkActionAllowed("catalog.delete"), "delete rejected");
  ok(html.includes('id="catBulkBtn"') && html.includes("أرشفة المحدد"), "catalog bulk archive entry");
  ok(html.includes('id="cpnBulkBtn"') && html.includes("إيقاف المحدد"), "coupons bulk stop entry");
  ok(html.includes('api("/control/bulk"'), "bulk endpoint wired");
  ok(html.includes("data-cat-sel") && html.includes("data-cpn-sel"), "multi-select in both lists");
  ok(html.includes("openBulkResults"), "per-item results sheet exists");
  const bulkSeg = seg("function openBulkPreview", "// ---------------- ٢٢)");
  ok(!bulkSeg.includes("wallet") && !bulkSeg.includes("refund"),
    "bulk flow never references a money action");
});

// ---------- بند ٢٢: المعاينة المترابطة ----------
Deno.test("المعاينة المترابطة: الجهتين متسميين وغياب أي جهة بسبب مفهوم", () => {
  eq(pure.previewReasonWord("no_identity_link"),
    "المنتج ده مالوش اسم مربوط في الموقع — مفيش نسخة موقع تتعرض.", "no link reason");
  ok(pure.previewReasonWord("bot_unavailable").includes("البوت مش بيرد"), "bot down reason");
  ok(pure.previewReasonWord("sku_not_on_site").includes("مش موجود في كتالوج الموقع"),
    "missing sku reason");
  ok(html.includes('api("/control/product-preview?id="'), "linked preview endpoint wired");
  ok(html.includes('id="pvLinkedBtn"') && html.includes("معاينة البوت والموقع"),
    "linked preview entry inside شوف كما يراه العميل");
  ok(html.includes('id="pfLinkedBtn"'), "linked preview entry in the catalog product view");
  const lpSeg = seg("function loadLinkedPreview", "// ---------------- ١٩)");
  ok(!lpSeg.includes('method: "POST"'), "linked preview is a pure GET — no actions");
  ok(lpSeg.includes("linkedPreviewHtml"), "both presentations rendered stacked");
});

// ---------- بند ٢٤: مساعدة الأفعال ----------
Deno.test("مساعدة الأفعال: اللي هيحصل وإمتى ما تستخدمش — للأفعال الستة", () => {
  const keys = [
    "wallet_adjust", "order_refund", "supplier_transfer",
    "identity_link", "merchant_key_issue", "merchant_key_rotate",
  ];
  for (const k of keys) {
    const h = pure.actionHelpOf(k);
    ok(h !== null, "help exists: " + k);
    ok(h!.does.length > 40 && h!.avoid.length > 20, "two real blocks: " + k);
  }
  ok(pure.actionHelpOf("order_refund")!.does.includes("بعد ما المورد يؤكد"),
    "refund help states the supplier-confirmation rule as implemented");
  ok(pure.actionHelpOf("wallet_adjust")!.does.includes("منع التكرار"),
    "adjust help claims idempotency only where the sheet implements it");
  ok(pure.actionHelpOf("merchant_key_issue")!.does.includes("مش بيظهر هنا في اللوحة"),
    "grant help states the key never reaches the panel");
  ok(!JSON.stringify(pure.ACTION_HELP).includes("sales_enabled"),
    "help text carries no raw setting keys");
  ok((html.match(/actionHelpHtml\("/g) || []).length >= 6,
    "help toggles wired next to the sensitive actions");
  ok(html.includes("إيه اللي هيحصل؟"), "help toggle label present");
  ok(html.includes('actionHelpHtml("wallet_adjust")'), "wallet adjust help wired");
  ok(html.includes('actionHelpHtml("order_refund")'), "order refund help wired");
  ok(html.includes('actionHelpHtml("supplier_transfer")'), "supplier transfer help wired");
  ok(html.includes('actionHelpHtml("identity_link")'), "identity link help wired");
  ok(html.includes('actionHelpHtml("merchant_key_issue")'), "merchant key issue help wired");
  ok(html.includes('actionHelpHtml("merchant_key_rotate")'), "merchant key rotate help wired");
});

// ---------- أيقونات: صفر رموز مصورة لسه ----------
Deno.test("أيقونات: فحص رموز مصورة على الملف كله = صفر (موجة ٣)", () => {
  const pat = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F]/gu;
  const hits = html.match(pat) || [];
  eq(hits.length, 0, "zero pictographs in control.html after wave 3 UI");
});
