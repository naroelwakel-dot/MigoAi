/**
 * اختبارات هجرة 030 (حفظ بيانات العميل لكل عنصر — FC) —
 * `deno test fc_codashop/` من غير أي استيراد خارجي. الهجرة SQL
 * خالص، فالاختبارات بتحرس القواعد على النص — نفس فلسفة
 * migration_028/029. الثقب: checkout بيجمع مدخلات العميل لكل
 * عنصر (معرّف لاعب اللعبة UID) في `details` بس buildItems كانت
 * بتبعت {sku, qty} بس وcreate_order بيعيد بناء العناصر المخزّنة
 * من غيرها، فالـ UID عمره ما وصل قاعدة البيانات (طلب MG-100034).
 * التغيير في 030 محصور في موضعين موسومين: سطر DECLARE مضاف،
 * وكتلة موسومة جوه حلقة العناصر بتقرأ e->>'details' بعد تعقيمها
 * (حذف محارف التحكم + سقف 200 حرف + الفراغ = غياب المفتاح).
 * الاختبارات بتثبّت: الهوية البايتية الكاملة خارج الموضعين ضد
 * تعريف ما قبل 030 الحي (المضمّن في ملف التراجع من
 * pg_get_functiondef)، وبصمة عدم التكرار مبنية من {qty, sku}
 * بس ومتلمستش، وقراءة التفاصيل معقّمة ومحكومة، وغياب التفاصيل
 * بيخلي العنصر المخزّن مطابق بايتيًا لشكل ما قبل 030.
 */
import MIGRATION from "./migration_030_order_item_details.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_030_order_item_details.rollback.sql" with {
  type: "text",
};
import INDEX_HTML from "../index.html" with { type: "text" };

function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}
function has(text: string, needle: string, label: string) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
  }
}
function lacks(text: string, needle: string, label: string) {
  if (text.includes(needle)) {
    throw new Error(`${label}: should not contain ${JSON.stringify(needle)}`);
  }
}
function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** تعريف create_order من ملف هجرة (من CREATE لحد end $function$). */
function orderDef(sql: string): string {
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.create_order",
  );
  if (start < 0) throw new Error("create_order def not found");
  const endMark = "end $function$";
  const end = sql.indexOf(endMark, start);
  if (end < 0) throw new Error("create_order def unterminated");
  return sql.slice(start, end + endMark.length);
}

const NEW_DEF = orderDef(MIGRATION);
const OLD_DEF = orderDef(ROLLBACK);

// الموضعان المتغيّران بالحرف: سطر الإعلان المضاف وكتلة الحلقة.
const OLD_DECLARE = "  v_fp text; v_items_canon jsonb; v_ex_fp text;\n";
const NEW_DECLARE = OLD_DECLARE + "  v_details text;\n";
const OLD_ENRICHED = "    total := total + v_line;\n" +
  "    enriched := enriched || jsonb_build_object(\n" +
  "      'name', v_sku, 'price', v_line, 'unit_price', v_price,\n" +
  "      'qty', v_qty);\n";
const SANITIZE = "    v_details := nullif(btrim(left(regexp_replace(\n" +
  "      coalesce(e->>'details', ''), '[[:cntrl:]]', '', 'g'), 200)), '');\n";
const NEW_ENRICHED = "    total := total + v_line;\n" +
  "    -- >>> FC-030 item details (the only added statements)\n" +
  "    -- Persist the client's per-item details string (for game\n" +
  "    -- top-ups this is where the player UID the customer typed\n" +
  "    -- lands, e.g. the FC Mobile UID). Sanitized here, never\n" +
  "    -- trusted: control characters stripped, capped at 200\n" +
  "    -- chars, blank becomes NULL and the key is then omitted\n" +
  "    -- entirely, so an order without details stores items\n" +
  "    -- byte-identical to the pre-030 shape. The idempotency\n" +
  "    -- fingerprint above is built from {qty, sku} only and does\n" +
  "    -- NOT read details, so a retry with or without details\n" +
  "    -- replays to the same order.\n" +
  SANITIZE +
  "    enriched := enriched || (\n" +
  "      jsonb_build_object(\n" +
  "        'name', v_sku, 'price', v_line, 'unit_price', v_price,\n" +
  "        'qty', v_qty)\n" +
  "      || case when v_details is null then '{}'::jsonb\n" +
  "              else jsonb_build_object('details', v_details) end);\n" +
  "    -- <<< FC-030 item details (end of added statements)\n";

Deno.test("030: outside the two marked changes the def is byte-identical to live pre-030", () => {
  has(NEW_DEF, NEW_DECLARE, "added declare line present");
  has(NEW_DEF, NEW_ENRICHED, "added loop block present");
  const undone = NEW_DEF.replace(NEW_DECLARE, OLD_DECLARE)
    .replace(NEW_ENRICHED, OLD_ENRICHED);
  ok(undone === OLD_DEF, "undoing both changes restores the live def exactly");
});

Deno.test("030: the pre-030 def never reads details at all", () => {
  ok(count(OLD_DEF, "details") === 0, "live def has zero 'details' occurrences");
});

Deno.test("030: idempotency fingerprint canon is {qty, sku} only, untouched", () => {
  for (const [label, def] of [["new", NEW_DEF], ["old", OLD_DEF]] as const) {
    const canonStart = def.indexOf("select jsonb_agg(");
    const canonEnd = def.indexOf("into v_items_canon");
    ok(canonStart >= 0 && canonEnd > canonStart, `${label}: canon block found`);
    const canon = def.slice(canonStart, canonEnd);
    has(canon, "'qty'", `${label}: canon carries qty`);
    has(canon, "'sku'", `${label}: canon carries sku`);
    lacks(canon, "details", `${label}: canon never reads details`);
    has(
      def,
      "'items', coalesce(v_items_canon, '[]'::jsonb)",
      `${label}: fingerprint consumes the canon unchanged`,
    );
  }
  const canonOf = (def: string) =>
    def.slice(def.indexOf("select jsonb_agg("), def.indexOf("into v_items_canon"));
  ok(canonOf(NEW_DEF) === canonOf(OLD_DEF), "canon block byte-identical");
});

Deno.test("030: details are read once, sanitized, capped, and blank-omitted", () => {
  ok(count(NEW_DEF, "e->>'details'") === 1, "details read exactly once");
  has(NEW_DEF, SANITIZE, "sanitize statement present verbatim");
  has(NEW_DEF, "'[[:cntrl:]]', '', 'g'", "control chars stripped");
  has(NEW_DEF, ", 200)", "200-char cap applied");
  has(
    NEW_DEF,
    "case when v_details is null then '{}'::jsonb",
    "blank details omit the key entirely",
  );
  has(
    NEW_DEF,
    "else jsonb_build_object('details', v_details) end",
    "details stored under the 'details' key",
  );
});

Deno.test("030: money math never reads details", () => {
  has(
    NEW_DEF,
    "total := total + v_line;",
    "line accumulation statement unchanged",
  );
  ok(
    count(NEW_DEF, "v_details") === 4,
    "v_details used only in declare + sanitize + the two case branches",
  );
  lacks(NEW_DEF, "total := total + v_details", "details never enter totals");
  lacks(NEW_DEF, "v_line := v_details", "details never become a line price");
});

Deno.test("030: coupon consume block (M6A-028) still present and unchanged", () => {
  for (const [label, def] of [["new", NEW_DEF], ["old", OLD_DEF]] as const) {
    has(def, "-- >>> M6A-028 atomic coupon consume (the only added block)", `${label}: 028 marker`);
    has(def, "raise exception 'coupon usage limit reached';", `${label}: 028 guard`);
  }
});

Deno.test("030: index.html buildItems carries details without touching aggregation", () => {
  has(INDEX_HTML, "var counts = {}, detailsByPlan = {}", "details collector declared");
  has(
    INDEX_HTML,
    "var det = (typeof x.details === 'string') ? x.details.trim() : '';",
    "entry details read defensively",
  );
  has(INDEX_HTML, "if (ds && ds.length) it.details = ds.join(' | ');", "details attached to the aggregated item");
  has(
    INDEX_HTML,
    "var it = { sku: k, qty: counts[k] };",
    "base item keeps the exact pre-030 {sku, qty} shape",
  );
  // itemsEqual / isValidItem still judge items by {sku, qty} only.
  has(INDEX_HTML, "if (sa[i].sku !== sb[i].sku || sa[i].qty !== sb[i].qty) return false;", "itemsEqual unchanged");
});

Deno.test("030: rollback restores the live def and drops nothing else", () => {
  has(ROLLBACK, "CREATE OR REPLACE FUNCTION public.create_order", "rollback carries the def");
  lacks(ROLLBACK, "DROP", "rollback drops no object");
  lacks(MIGRATION, "DROP FUNCTION", "migration drops no function");
  lacks(MIGRATION, "ALTER TABLE", "migration changes no table shape");
});
