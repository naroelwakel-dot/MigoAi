/**
 * اختبارات منطق شاشة الحراس النقي في اللوحة —
 * `deno test control/guards_panel.test.ts`
 * المنطق النقي عايش جوه سكربت اللوحة في control.html بين علامتي
 * PURE-GUARDS — الاختبارات دي بتقراه من هناك حرفيًا وبتشغّله،
 * فاللي بيتختبر هو نفس الكود اللي المتصفح بيشغّله بالظبط.
 * القاعدة الحاكمة: الحارس اللي مالوش فحص لسه بيظهر «لسه مفيش
 * فحص مسجل» — مفيش وقت مخترع أبدًا.
 */
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

interface GuardRow {
  id?: string;
  status?: string;
  last_check_at?: number | null;
  verdict?: string | null;
  group?: string;
}
interface PureApi {
  guardStatusView: (
    g: GuardRow | null,
  ) => { key: string; word: string; dot: string };
  guardRelText: (epochSec: number | null, nowMs: number) => string | null;
  guardWhenText: (g: GuardRow | null, nowMs: number) => string;
  guardsSummaryOf: (
    payload: { guards?: GuardRow[] } | null,
  ) => { ok: number; problem: number; unknown: number };
  GUARD_GROUP_TITLES: [string, string][];
}

const PB = "/*PURE-GUARDS-BEGIN*/";
const PE = "/*PURE-GUARDS-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure guards block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { guardStatusView, guardRelText, guardWhenText, guardsSummaryOf, GUARD_GROUP_TITLES };",
) as () => PureApi)();

const NOW_MS = 1795302900 * 1000;

Deno.test("حالة الحارس بتترجم لكلمة ولون نقطة", () => {
  eq(pure.guardStatusView({ status: "ok" }).dot, "ok", "ok = green");
  eq(pure.guardStatusView({ status: "ok" }).word, "يعمل", "ok word");
  eq(
    pure.guardStatusView({ status: "problem" }).dot,
    "bad",
    "problem = red",
  );
  eq(
    pure.guardStatusView({ status: "unknown" }).dot,
    "",
    "unknown = grey",
  );
  eq(pure.guardStatusView(null).key, "unknown", "null = unknown");
  eq(
    pure.guardStatusView({}).key,
    "unknown",
    "missing status = unknown",
  );
});

Deno.test("مفيش فحص لسه = نص صريح، مش وقت مخترع", () => {
  eq(
    pure.guardWhenText({ last_check_at: null }, NOW_MS),
    "لسه مفيش فحص مسجل",
    "null stamp",
  );
  eq(pure.guardWhenText({}, NOW_MS), "لسه مفيش فحص مسجل", "no stamp");
  eq(pure.guardWhenText(null, NOW_MS), "لسه مفيش فحص مسجل", "no guard");
});

Deno.test("وقت آخر فحص: نسبي ومطلق مع بعض", () => {
  const text = pure.guardWhenText(
    { last_check_at: 1795302900 - 600 },
    NOW_MS,
  );
  ok(text.startsWith("آخر فحص: منذ 10 دقيقة"), "relative part: " + text);
  ok(text.includes("·"), "absolute part present: " + text);
  eq(
    pure.guardRelText(1795302900 - 30, NOW_MS),
    "دلوقتي",
    "fresh = now",
  );
  eq(
    pure.guardRelText(1795302900 - 7200, NOW_MS),
    "منذ 2 ساعة",
    "hours",
  );
  eq(pure.guardRelText(null, NOW_MS), null, "null stays null");
});

Deno.test("ملخص الأعداد بيعدّ الحالات التلاتة", () => {
  const counts = pure.guardsSummaryOf({
    guards: [
      { status: "ok" },
      { status: "ok" },
      { status: "problem" },
      { status: "unknown" },
      {},
    ],
  });
  eq(counts, { ok: 2, problem: 1, unknown: 2 }, "counts");
  eq(
    pure.guardsSummaryOf(null),
    { ok: 0, problem: 0, unknown: 0 },
    "null payload",
  );
});

Deno.test("ترتيب المجموعات: سيرفر ثم سحابة ثم متابعة", () => {
  eq(
    pure.GUARD_GROUP_TITLES.map((p) => p[0]),
    ["vps", "cloudflare", "agent"],
    "group order",
  );
  for (const [, title] of pure.GUARD_GROUP_TITLES) {
    ok(title.length > 0, "group title present");
  }
});
