// اختبارات وحدة معاينة اللوحة «شوف كما يراه العميل» (المرحلة
// م٦-هـ) — `deno test control/preview.test.ts`
// عميل بوت وهمي (نمط visitors.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. الوحدة دي تمرير قراءة بس: العقد هو 405 قبل
// البوابة، 401 قبل أي نداء بوت، تمرير حرفي للحالة والجسم
// (بما فيه سلسلة الاستعلام لمعاينة منتج)، وفشل البوت 502.
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlPreviewDeps,
  handleControlPreviewRequest,
} from "./preview.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
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

function depsOf(bot: FakeBotClient, admin = true): ControlPreviewDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

function req(path: string, method = "GET"): Request {
  return new Request(`https://api.example${path}`, { method });
}

async function bodyOf(
  res: Response | null,
): Promise<Record<string, unknown>> {
  if (!res) throw new Error("expected a response, got null");
  return await res.json() as Record<string, unknown>;
}

// ---------------------------------------------------------------- المسارات
Deno.test("مسارات غريبة بترجع null", async () => {
  const d = depsOf(new FakeBotClient());
  eq(await handleControlPreviewRequest(req("/control/bot-preview"), d), null, "preview alone");
  eq(await handleControlPreviewRequest(req("/control/bot-preview-menux"), d), null, "suffix-x");
  eq(await handleControlPreviewRequest(req("/control/bot-visitors"), d), null, "visitors");
  eq(await handleControlPreviewRequest(req("/control/home"), d), null, "home");
});

Deno.test("بوابة الأدمن: 401 قبل أي نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const res = await handleControlPreviewRequest(
    req("/control/bot-preview-menu"),
    d,
  );
  eq(res?.status, 401, "status");
  eq((await bodyOf(res)).error, "unauthorized", "error");
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  for (const p of ["/control/bot-preview-menu", "/control/bot-preview-product"]) {
    const res = await handleControlPreviewRequest(req(p, "POST"), d);
    eq(res?.status, 405, `POST ${p} status`);
    eq((await bodyOf(res)).error, "method", `POST ${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("معاينة القائمة: تمرير حرفي للنص والأزرار", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 200,
    body: {
      ok: true,
      text: "أهلًا بيك في متجر ميجو",
      buttons: [[{ label: "المنتجات", has_icon: true }]],
    },
  };
  const res = await handleControlPreviewRequest(
    req("/control/bot-preview-menu"),
    d,
  );
  eq(res?.status, 200, "status");
  eq(bot.calls.length, 1, "one bot call");
  eq(bot.calls[0].method, "GET", "method");
  eq(bot.calls[0].path, "/api/control/preview-menu", "bot path");
  eq(bot.calls[0].body, undefined, "GET has no body");
  const body = await bodyOf(res);
  eq(body.text, "أهلًا بيك في متجر ميجو", "text verbatim");
  eq(body.buttons, [[{ label: "المنتجات", has_icon: true }]], "buttons verbatim");
});

Deno.test("معاينة منتج: سلسلة الاستعلام بتعدّي و404 بيعدّي", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 200,
    body: { ok: true, text: "بطاقة المنتج", has_photo: true, caption_mode: true, buttons: [] },
  };
  const res = await handleControlPreviewRequest(
    req("/control/bot-preview-product?product_id=p%2042"),
    d,
  );
  eq(res?.status, 200, "status");
  eq(
    bot.calls[0].path,
    "/api/control/preview-product?product_id=p%2042",
    "query string forwarded verbatim",
  );
  eq((await bodyOf(res)).caption_mode, true, "caption_mode verbatim");

  bot.result = { status: 404, body: { ok: false, error: "product_not_found" } };
  const res2 = await handleControlPreviewRequest(
    req("/control/bot-preview-product?product_id=nope"),
    d,
  );
  eq(res2?.status, 404, "not-found status passthrough");
  eq((await bodyOf(res2)).error, "product_not_found", "not-found verbatim");
});

Deno.test("فشل البوت في التمرير = 502 bot_unavailable", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlPreviewRequest(
    req("/control/bot-preview-menu"),
    d,
  );
  eq(res?.status, 502, "status");
  const body = await bodyOf(res);
  eq(body.error, "bot_unavailable", "error");
  eq(body.bot_unavailable, true, "flag");
});

Deno.test("ردود المعاينة ممنوعة من الكاش (no-store)", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlPreviewRequest(
    req("/control/bot-preview-menu"),
    d,
  );
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store on 200");
  const denied = await handleControlPreviewRequest(
    req("/control/bot-preview-menu"),
    depsOf(bot, false),
  );
  eq(denied?.headers.get("Cache-Control"), "no-store", "no-store on 401");
});
