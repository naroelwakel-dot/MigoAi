// اختبارات محتوى البوت (م٥-ب) — `deno test control/content.test.ts`
// المنطق النقي (تطبيع الردود الجاهزة وأخواته) عايش جوه سكربت
// اللوحة في control.html بين علامتي PURE-CONTENT — الاختبارات
// دي بتقراه من هناك حرفيًا وبتشغّله، فاللي بيتختبر هو نفس
// الكود اللي المتصفح بيشغّله بالظبط، من غير نسخة تانية تنحرف.
import { handleControlSettingsRequest } from "./settings.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

interface SavedReply {
  id: string;
  title: string;
  text: string;
}
interface PureApi {
  isTextEntry: (e: unknown) => boolean;
  setRepliesValueOf: (
    d: Record<string, unknown>,
    entries: Record<string, unknown>[],
  ) => unknown[] | null;
  normalizeSavedReplies: (raw: unknown) => SavedReply[];
  nextReplyId: (list: SavedReply[]) => string;
  savedRepliesProblem: (list: SavedReply[]) => string;
}

const PB = "/*PURE-CONTENT-BEGIN*/";
const PE = "/*PURE-CONTENT-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure content block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { isTextEntry, setRepliesValueOf, normalizeSavedReplies, nextReplyId, savedRepliesProblem };",
) as () => PureApi)();

// ------------------------------------------------------------- isTextEntry
Deno.test("isTextEntry: نوع text بس، والسرّي برّه", () => {
  eq(pure.isTextEntry({ key: "welcome_text", kind: "text" }), true, "kind text");
  eq(pure.isTextEntry({ key: "help_text", type: "text" }), true, "type text");
  eq(pure.isTextEntry({ key: "x", kind: "text", secret: true }), false, "secret text");
  eq(pure.isTextEntry({ key: "x", kind: "secret" }), false, "secret kind");
  eq(pure.isTextEntry({ key: "support_whatsapp", kind: "string" }), false, "string");
  eq(pure.isTextEntry({ key: "saved_replies", kind: "json" }), false, "json");
  eq(pure.isTextEntry(null), false, "null");
  eq(pure.isTextEntry({}), false, "no key");
});

// -------------------------------------------------------- setRepliesValueOf
Deno.test("setRepliesValueOf: من الصف أو العلوي، ونص JSON بيتحلّل", () => {
  const arr = [{ id: "r1", title: "أ", text: "ب" }];
  eq(
    pure.setRepliesValueOf({}, [{ key: "saved_replies", value: arr }]),
    arr,
    "from entry",
  );
  eq(
    pure.setRepliesValueOf({}, [{ key: "saved_replies", value: JSON.stringify(arr) }]),
    arr,
    "entry value as JSON string",
  );
  eq(
    pure.setRepliesValueOf({ saved_replies: arr }, []),
    arr,
    "top-level fallback",
  );
  eq(pure.setRepliesValueOf({}, []), null, "absent = null");
  eq(
    pure.setRepliesValueOf({}, [{ key: "saved_replies", value: { nope: 1 } }]),
    null,
    "non-array = null",
  );
  eq(
    pure.setRepliesValueOf({}, [{ key: "saved_replies", value: "{bad json" }]),
    null,
    "broken JSON string = null",
  );
});

// ----------------------------------------------------- normalizeSavedReplies
Deno.test("normalizeSavedReplies: الشكل المعتمد بيعدّي زي ما هو", () => {
  eq(
    pure.normalizeSavedReplies([
      { id: "a1", title: "ترحيب", text: "أهلًا بيك" },
      { id: "a2", title: "وداع", text: "مع السلامة" },
    ]),
    [
      { id: "a1", title: "ترحيب", text: "أهلًا بيك" },
      { id: "a2", title: "وداع", text: "مع السلامة" },
    ],
    "canonical shape untouched",
  );
});

Deno.test("normalizeSavedReplies: أشكال بديلة (body/name/message/id رقمي)", () => {
  eq(
    pure.normalizeSavedReplies([
      { title: "سؤال", body: "نص الجسم" },
      { id: 7, name: "اسم بديل", message: "نص الرسالة" },
    ]),
    [
      { id: "r1", title: "سؤال", text: "نص الجسم" },
      { id: "7", title: "اسم بديل", text: "نص الرسالة" },
    ],
    "body->text, name->title, message->text, numeric id stringified",
  );
});

Deno.test("normalizeSavedReplies: id ناقص أو مكرر بياخد id جديد ثابت", () => {
  const out = pure.normalizeSavedReplies([
    { id: "r2", title: "أ", text: "١" },
    { id: "r2", title: "ب", text: "٢" },
    { title: "ج", text: "٣" },
  ]);
  eq(out[0].id, "r2", "first keeps its id");
  eq(out[1].id, "r3", "duplicate gets fresh id above max");
  eq(out[2].id, "r4", "missing id gets the next fresh id");
  const ids = out.map((r) => r.id);
  eq(new Set(ids).size, 3, "all ids unique");
  // الثبات: إعادة التطبيع على الناتج ما تغيّرش أي id.
  eq(pure.normalizeSavedReplies(out), out, "re-normalize is stable");
});

Deno.test("normalizeSavedReplies: مدخلات تالفة بترجع قائمة فاضية أو عناصر آمنة", () => {
  eq(pure.normalizeSavedReplies(null), [], "null");
  eq(pure.normalizeSavedReplies(42), [], "number");
  eq(pure.normalizeSavedReplies("{bad"), [], "broken JSON string");
  eq(
    pure.normalizeSavedReplies(JSON.stringify([{ title: "أ", text: "ب" }])),
    [{ id: "r1", title: "أ", text: "ب" }],
    "JSON string parsed",
  );
  eq(
    pure.normalizeSavedReplies([null, "نص", 5]),
    [
      { id: "r1", title: "", text: "" },
      { id: "r2", title: "", text: "" },
      { id: "r3", title: "", text: "" },
    ],
    "non-object items become empty replies with fresh ids",
  );
});

// -------------------------------------------------------------- nextReplyId
Deno.test("nextReplyId: فوق أكبر رقم موجود ومن غير تصادم", () => {
  eq(pure.nextReplyId([]), "r1", "empty list");
  eq(
    pure.nextReplyId([{ id: "r3", title: "", text: "" }]),
    "r4",
    "above max r-number",
  );
  eq(
    pure.nextReplyId([
      { id: "r1", title: "", text: "" },
      { id: "r2", title: "", text: "" },
    ]),
    "r3",
    "sequence continues",
  );
  eq(
    pure.nextReplyId([{ id: "abc", title: "", text: "" }]),
    "r1",
    "foreign ids ignored",
  );
});

// --------------------------------------------------------- savedRepliesProblem
Deno.test("savedRepliesProblem: نص فاضي يمنع، والسليم يعدّي", () => {
  eq(pure.savedRepliesProblem([]), "", "empty list is fine");
  eq(
    pure.savedRepliesProblem([{ id: "r1", title: "", text: "نص" }]),
    "",
    "title may be empty, text present",
  );
  ok(
    pure.savedRepliesProblem([{ id: "r1", title: "أ", text: "   " }]) !== "",
    "whitespace-only text blocked",
  );
  ok(
    pure.savedRepliesProblem([
      { id: "r1", title: "أ", text: "تمام" },
      { id: "r2", title: "ب", text: "" },
    ]) !== "",
    "one empty text blocks the whole save",
  );
});

// ------------------------------------------------- بنية شاشة محتوى البوت
Deno.test("شاشة الإعدادات فيها قسم محتوى البوت وحاوياته ونداءات حفظه", () => {
  ok(html.includes("<h2>محتوى البوت</h2>"), "section heading present");
  ok(html.includes('id="setContentSupport"'), "support container");
  ok(html.includes('id="setContentTexts"'), "texts container");
  ok(html.includes('id="setContentReplies"'), "replies container");
  ok(
    html.includes('saveSettingValue("support_whatsapp"'),
    "support saves through settings-set",
  );
  ok(
    html.includes('key: "saved_replies"'),
    "replies save through settings-set under saved_replies",
  );
  ok(html.includes("renderBotContent();"), "load renders the content section");
});

// --------------------------------------- تمرير حفظ المحتوى عبر الوكيل زي ما هو
Deno.test("الوكيل بيمرّر حفظ دعم واتساب والردود الجاهزة حرفيًا", async () => {
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const deps = {
    botClient: {
      proxy(method: string, path: string, body?: Record<string, unknown>) {
        calls.push({ method, path, body });
        return Promise.resolve({ status: 200, body: { ok: true } });
      },
    },
    isAdmin: () => true,
    corsOf: () => ({}),
    logError: () => {},
  };
  const post = (body: unknown) =>
    handleControlSettingsRequest(
      new Request("https://api.example/control/bot-settings-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      deps,
    );
  const supBody = { key: "support_whatsapp", value: "https://wa.me/201000000000" };
  const res1 = await post(supBody);
  eq(res1?.status, 200, "support set status");
  eq(calls[0].path, "/api/control/settings-set", "support set path");
  eq(calls[0].body, supBody, "support set body verbatim");

  const repBody = {
    key: "saved_replies",
    value: [
      { id: "r1", title: "ترحيب", text: "أهلًا بيك في متجرنا" },
      { id: "r2", title: "الشحن", text: "الشحن بياخد يومين" },
    ],
  };
  const res2 = await post(repBody);
  eq(res2?.status, 200, "replies set status");
  eq(calls[1].body, repBody, "replies set body verbatim ({id,title,text} list)");
});
