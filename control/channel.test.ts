// اختبارات وحدة قناة اللوحة (م٥-ج) — `deno test control/channel.test.ts`
// عميل بوت وهمي (نمط settings.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. الوحدة دي تمرير خالص: العقد هو 405 قبل البوابة،
// 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم، وفشل البوت 502.
// والمنطق النقي بتاع شاشة القناة عايش جوه سكربت اللوحة بين علامتي
// PURE-CHANNEL — الاختبارات بتقراه من control.html حرفيًا وبتشغّله.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlChannelDeps,
  handleControlChannelRequest,
} from "./channel.ts";
import html from "../control.html" with { type: "text" };

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// ---------------------------------------------------------------- بوت وهمي
class FakeBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  result: BotProxyResult = { status: 200, body: { ok: true, echoed: true } };
  fail = false;

  proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.fail) return Promise.reject(new Error("bot down"));
    return Promise.resolve(this.result);
  }
}

function depsOf(bot: FakeBotClient, admin = true): ControlChannelDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(
  path: string,
  method = "GET",
  body?: unknown,
): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: body !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

const ALL_PATHS: [string, string][] = [
  ["/control/bot-channel-queue", "GET"],
  ["/control/bot-channel-post", "POST"],
  ["/control/bot-channel-update", "POST"],
  ["/control/bot-channel-delete", "POST"],
  ["/control/bot-channel-edit-published", "POST"],
];

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlChannelRequest(req("/control/bot-channel"), d), null, "bare channel");
  eq(await handleControlChannelRequest(req("/control/bot-settings"), d), null, "settings");
  eq(await handleControlChannelRequest(req("/control/store-coupons"), d), null, "coupons");
  eq(await handleControlChannelRequest(req("/control/bot-channel-queue-x"), d), null, "queue suffix-x");
  eq(await handleControlChannelRequest(req("/control/bot-channel-posts"), d), null, "posts plural");
});

Deno.test("بوابة الأدمن على مسارات القناة الخمسة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  for (const [p, m] of ALL_PATHS) {
    const res = await handleControlChannelRequest(
      req(p, m, m === "POST" ? {} : undefined),
      d,
    );
    eq(res?.status, 401, `${p} status`);
    eq((await bodyOf(res)).error, "unauthorized", `${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const cases: [string, string][] = [
    ["/control/bot-channel-queue", "POST"],
    ["/control/bot-channel-post", "GET"],
    ["/control/bot-channel-update", "DELETE"],
    ["/control/bot-channel-delete", "GET"],
    ["/control/bot-channel-edit-published", "PUT"],
  ];
  for (const [p, m] of cases) {
    const res = await handleControlChannelRequest(req(p, m), d);
    eq(res?.status, 405, `${p} ${m}`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("التمريرات الخمسة حرفية وبنفس الحالة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);

  bot.result = {
    status: 200,
    body: {
      ok: true,
      items: [{ id: 3, text: "أهلًا", status: "pending", pin: true }],
    },
  };
  let res = await handleControlChannelRequest(
    req("/control/bot-channel-queue?limit=20"),
    d,
  );
  eq(res?.status, 200, "queue status");
  eq(bot.calls[0].method, "GET", "queue method");
  eq(bot.calls[0].path, "/api/control/channel-queue?limit=20", "queue path+query");
  eq((await bodyOf(res)).items, [{ id: 3, text: "أهلًا", status: "pending", pin: true }], "queue body verbatim");

  const postBody = {
    text: "عرض جديد",
    photo_url: "https://example.com/x.jpg",
    buttons: [{ text: "اطلب", url: "https://t.me/example" }],
    scheduled_at: "2026-12-01T10:00:00.000Z",
    pin: true,
  };
  bot.result = { status: 200, body: { ok: true, id: 9 } };
  res = await handleControlChannelRequest(
    req("/control/bot-channel-post", "POST", postBody),
    d,
  );
  eq(res?.status, 200, "post status");
  eq(bot.calls[1].method, "POST", "post method");
  eq(bot.calls[1].path, "/api/control/channel-post", "post path");
  eq(bot.calls[1].body, postBody, "post body verbatim");

  const updBody = { id: 9, text: "نص معدّل", buttons: null, scheduled_at: null, pin: false };
  res = await handleControlChannelRequest(
    req("/control/bot-channel-update", "POST", updBody),
    d,
  );
  eq(bot.calls[2].path, "/api/control/channel-update", "update path");
  eq(bot.calls[2].body, updBody, "update body verbatim");

  bot.result = { status: 400, body: { ok: false, error: "already_published" } };
  res = await handleControlChannelRequest(
    req("/control/bot-channel-update", "POST", { id: 9, text: "x" }),
    d,
  );
  eq(res?.status, 400, "bot 400 status passthrough");
  eq((await bodyOf(res)).error, "already_published", "bot error verbatim");

  res = await handleControlChannelRequest(
    req("/control/bot-channel-delete", "POST", { id: 9 }),
    d,
  );
  eq(bot.calls[4].path, "/api/control/channel-delete", "delete path");
  eq(bot.calls[4].body, { id: 9 }, "delete body verbatim");

  const editBody = { id: 9, text: "نص المنشور الجديد" };
  bot.result = { status: 200, body: { ok: true } };
  res = await handleControlChannelRequest(
    req("/control/bot-channel-edit-published", "POST", editBody),
    d,
  );
  eq(res?.status, 200, "edit-published status");
  eq(bot.calls[5].path, "/api/control/channel-edit-published", "edit-published path");
  eq(bot.calls[5].body, editBody, "edit-published body verbatim");
});

Deno.test("جسم POST مش كائن = 400 من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const arrReq = new Request("https://api.example/control/bot-channel-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([1, 2, 3]),
  });
  const res = await handleControlChannelRequest(arrReq, d);
  eq(res?.status, 400, "array body status");
  eq((await bodyOf(res)).error, "bad_body", "array body error");
  eq(bot.calls.length, 0, "zero bot calls on bad bodies");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlChannelRequest(
    req("/control/bot-channel-queue"),
    d,
  );
  eq(res?.status, 502, "GET status");
  eq((await bodyOf(res)).error, "bot_unavailable", "GET error");
  const res2 = await handleControlChannelRequest(
    req("/control/bot-channel-post", "POST", { text: "x" }),
    d,
  );
  eq(res2?.status, 502, "POST status");
  eq((await bodyOf(res2)).error, "bot_unavailable", "POST error");
});

Deno.test("ردود القناة ممنوعة من الكاش (no-store)", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlChannelRequest(
    req("/control/bot-channel-queue"),
    d,
  );
  eq(res?.status, 200, "queue status");
  eq(res?.headers.get("Cache-Control"), "no-store", "queue no-store");
});

// ------------------------------------------------------- المنطق النقي للشاشة
interface PureChannel {
  parseChannelButtons: (
    text: string,
  ) => { buttons: { text: string; url: string }[] | null; problem: string };
  channelButtonsText: (raw: unknown) => string;
  channelStatusOf: (
    item: Record<string, unknown> | null,
  ) => { key: string; label: string };
  channelItemsOf: (d: Record<string, unknown> | null) => unknown[];
}

const PB = "/*PURE-CHANNEL-BEGIN*/";
const PE = "/*PURE-CHANNEL-END*/";
const begin = html.indexOf(PB);
const end = html.indexOf(PE);
if (begin < 0 || end <= begin) {
  throw new Error("pure channel block markers not found in control.html");
}
const pure = (new Function(
  html.slice(begin, end) +
    "\nreturn { parseChannelButtons, channelButtonsText, channelStatusOf, channelItemsOf };",
) as () => PureChannel)();

Deno.test("parseChannelButtons: أسطر سليمة وفاضية ومكسورة", () => {
  eq(pure.parseChannelButtons(""), { buttons: [], problem: "" }, "empty");
  eq(pure.parseChannelButtons("  \n\n"), { buttons: [], problem: "" }, "blank lines");
  eq(
    pure.parseChannelButtons("اطلب | https://t.me/bot\nالموقع | https://migoai.shop"),
    {
      buttons: [
        { text: "اطلب", url: "https://t.me/bot" },
        { text: "الموقع", url: "https://migoai.shop" },
      ],
      problem: "",
    },
    "two buttons",
  );
  const noPipe = pure.parseChannelButtons("زر من غير رابط");
  eq(noPipe.buttons, null, "missing pipe refuses");
  ok(noPipe.problem.length > 0, "missing pipe explains");
  const badUrl = pure.parseChannelButtons("زر | t.me/bot");
  eq(badUrl.buttons, null, "scheme-less url refuses");
  const emptySide = pure.parseChannelButtons(" | https://x.example");
  eq(emptySide.buttons, null, "empty text refuses");
});

Deno.test("channelButtonsText: صفوف البوت بتتفكك لأسطر", () => {
  eq(pure.channelButtonsText(null), "", "null");
  eq(pure.channelButtonsText([]), "", "empty");
  eq(
    pure.channelButtonsText([[{ text: "أ", url: "https://a" }, { text: "ب", url: "https://b" }]]),
    "أ | https://a\nب | https://b",
    "one row of two flattens",
  );
  eq(
    pure.channelButtonsText([[{ text: "أ", url: "https://a" }], [{ text: "ب", url: "https://b" }]]),
    "أ | https://a\nب | https://b",
    "two rows",
  );
  eq(
    pure.channelButtonsText([{ text: "أ", url: "https://a" }]),
    "أ | https://a",
    "flat array tolerated",
  );
});

Deno.test("channelStatusOf: الحالات بلغة اللوحة", () => {
  eq(pure.channelStatusOf({ status: "posted" }).key, "published", "posted");
  eq(pure.channelStatusOf({ status: "posting" }).key, "posting", "posting");
  eq(pure.channelStatusOf({ status: "failed" }).key, "failed", "failed");
  const future = new Date(Date.now() + 3600_000).toISOString();
  eq(
    pure.channelStatusOf({ status: "pending", scheduled_at: future }).key,
    "scheduled",
    "pending with future schedule",
  );
  const past = new Date(Date.now() - 3600_000).toISOString();
  eq(
    pure.channelStatusOf({ status: "pending", scheduled_at: past }).key,
    "draft",
    "pending with past schedule is a draft",
  );
  eq(pure.channelStatusOf({ status: "pending" }).key, "draft", "plain pending");
  eq(pure.channelStatusOf(null).key, "draft", "null item");
});

Deno.test("channelItemsOf: أول مصفوفة معروفة", () => {
  eq(pure.channelItemsOf({ items: [1] }), [1], "items");
  eq(pure.channelItemsOf({ queue: [2] }), [2], "queue");
  eq(pure.channelItemsOf({ posts: [3] }), [3], "posts");
  eq(pure.channelItemsOf({}), [], "none");
  eq(pure.channelItemsOf(null), [], "null");
});
