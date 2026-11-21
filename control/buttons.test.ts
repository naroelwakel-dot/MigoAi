// اختبارات أزرار قائمة البوت (خيار ب) — `deno test control/buttons.test.ts`
// المنطق النقي (تطبيع الأزرار المخصصة والتجاوزات والتحقق منها)
// عايش جوه سكربت اللوحة في control.html بين علامتي PURE-BUTTONS —
// الاختبارات دي بتقراه من هناك حرفيًا وبتشغّله، فاللي بيتختبر هو
// نفس الكود اللي المتصفح بيشغّله بالظبط.
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

interface MenuButton {
  id: string;
  label: string;
  emoji: string;
  action: string;
  url: string;
  text: string;
  target: string;
  wide: boolean;
}
interface PureApi {
  menuScreenOptions: () => { value: string; name: string }[];
  menuCoreButtons: () => { key: string; name: string; emoji: string; noHide: boolean }[];
  setMenuButtonsValueOf: (
    d: Record<string, unknown>,
    entries: Record<string, unknown>[],
  ) => unknown[] | null;
  setMenuOverridesValueOf: (
    d: Record<string, unknown>,
    entries: Record<string, unknown>[],
  ) => Record<string, unknown> | null;
  normalizeMenuButtons: (raw: unknown) => MenuButton[];
  nextMenuButtonId: (list: MenuButton[]) => string;
  menuButtonsProblem: (list: MenuButton[]) => string;
  menuOverridesValue: (
    overrides: Record<string, unknown>,
  ) => Record<string, unknown>;
  normalizeMenuOverrides: (
    raw: unknown,
  ) => Record<string, { label: string; emoji: string; hidden: boolean }>;
}

const PB = "/*PURE-BUTTONS-BEGIN*/";
const PE = "/*PURE-BUTTONS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure buttons block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { menuScreenOptions, menuCoreButtons, setMenuButtonsValueOf, setMenuOverridesValueOf, normalizeMenuButtons, nextMenuButtonId, menuButtonsProblem, menuOverridesValue, normalizeMenuOverrides };",
) as () => PureApi)();

function btn(partial: Partial<MenuButton>): MenuButton {
  return {
    id: "b1", label: "زر", emoji: "", action: "url",
    url: "https://example.com", text: "", target: "", wide: true,
    ...partial,
  };
}

// ------------------------------------------------------------ القوائم الثابتة
Deno.test("القوائم الثابتة: شاشات بيضاء معروفة وأزرار أساسية محمية", () => {
  const screens = pure.menuScreenOptions().map((s) => s.value);
  ok(screens.includes("wallet:show"), "wallet screen whitelisted");
  ok(screens.includes("pay:menu"), "topup screen whitelisted");
  ok(!screens.some((s) => s.startsWith("shop:buy")), "no buy target");
  ok(!screens.some((s) => s.startsWith("tp:")), "no admin target");
  ok(!screens.some((s) => s.startsWith("pay:stars")), "no stars target");
  const core = pure.menuCoreButtons();
  eq(core.length, 10, "ten core buttons");
  const byKey = Object.fromEntries(core.map((c) => [c.key, c]));
  eq(byKey.wallet.noHide, true, "wallet cannot hide");
  eq(byKey.topup.noHide, true, "topup cannot hide");
  ok(!("gemini" in byKey) && !("pixel" in byKey), "gemini/pixel excluded");
});

// ------------------------------------------------------------ التطبيع
Deno.test("normalizeMenuButtons: ids ناقصة/مكررة بتتولد، والفعل الغلط يرجع url", () => {
  const out = pure.normalizeMenuButtons([
    { label: "أ", action: "text", text: "نص" },
    { id: "b1", label: "ب", action: "bogus" },
    { id: "b1", label: "ج", action: "screen", target: "wallet:show" },
  ]);
  eq(out.length, 3, "three rows");
  ok(out[0].id !== out[1].id && out[1].id !== out[2].id, "ids unique");
  eq(out[1].action, "url", "unknown action falls back to url");
  eq(out[2].target, "wallet:show", "screen target kept");
  eq(pure.nextMenuButtonId(out).startsWith("b"), true, "next id shape");
});

Deno.test("setMenuButtonsValueOf / setMenuOverridesValueOf: من الصف أو العلوي", () => {
  const arr = [{ id: "b1", label: "أ" }];
  eq(pure.setMenuButtonsValueOf({}, [{ key: "menu_custom_buttons", value: arr }]),
    arr, "from entry");
  eq(pure.setMenuButtonsValueOf({ menu_custom_buttons: arr }, []), arr, "top level");
  eq(pure.setMenuButtonsValueOf({}, []), null, "absent = null");
  const ov = { support: { hidden: true } };
  eq(pure.setMenuOverridesValueOf({}, [{ key: "menu_button_overrides", value: ov }]),
    ov, "overrides from entry");
  eq(pure.setMenuOverridesValueOf({}, [{ key: "menu_button_overrides", value: [1] }]),
    null, "array overrides rejected");
});

// ------------------------------------------------------------ مشاكل الحفظ
Deno.test("menuButtonsProblem: الحالات المانعة بس", () => {
  eq(pure.menuButtonsProblem([btn({})]), "", "valid url button");
  ok(pure.menuButtonsProblem([btn({ label: "  " })]) !== "", "empty label");
  ok(pure.menuButtonsProblem([btn({ label: "ز".repeat(33) })]) !== "", "long label");
  ok(pure.menuButtonsProblem([btn({ url: "http://x" })]) !== "", "http url");
  ok(pure.menuButtonsProblem([btn({ action: "text", text: " " })]) !== "",
    "empty page text");
  ok(pure.menuButtonsProblem([btn({ action: "product", target: "" })]) !== "",
    "missing target");
  eq(pure.menuButtonsProblem(
    [btn({ action: "text", text: "كلام" })]), "", "valid text button");
  const nine = Array.from({ length: 9 }, (_, i) => btn({ id: "b" + i }));
  ok(pure.menuButtonsProblem(nine) !== "", "more than 8");
});

// ------------------------------------------------------------ التجاوزات
Deno.test("menuOverridesValue: المعروف بس، والمحمي ما بيختفيش", () => {
  const value = pure.menuOverridesValue({
    support: { label: "  كلمنا ", emoji: "", hidden: true },
    wallet: { label: "رصيدي", emoji: "", hidden: true },
    gemini: { label: "مزيف", emoji: "", hidden: false },
    shop: { label: "", emoji: "", hidden: false },
  });
  eq(value, {
    wallet: { label: "رصيدي" },
    support: { label: "كلمنا", hidden: true },
  }, "cleaned overrides");
});

Deno.test("normalizeMenuOverrides: شكل المحرر من قيمة مخزنة", () => {
  const out = pure.normalizeMenuOverrides({
    support: { label: "كلمنا", hidden: true },
    topup: { hidden: true },
    nope: { label: "x" },
  });
  eq(out.support, { label: "كلمنا", emoji: "", hidden: true }, "support kept");
  eq(out.topup.hidden, false, "topup hidden forced off");
  ok(!("nope" in out), "unknown key dropped");
  eq(pure.normalizeMenuOverrides("مش كائن"), {}, "garbage = empty");
});

// ------------------------------------------------------------ وجود المحرر
Deno.test("المحرر موجود في الصفحة ومربوط بمسار الحفظ", () => {
  ok(html.includes('id="setContentButtons"'), "editor container exists");
  ok(html.includes("menu_custom_buttons"), "custom key wired");
  ok(html.includes("menu_button_overrides"), "overrides key wired");
  ok(html.includes("استعادة القائمة الافتراضية"), "restore action exists");
});
