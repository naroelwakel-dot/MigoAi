// اختبارات موجة Instinct الرابعة — تقوية البند ١٤: الردان اللي
// شايلين سرّ لمرة واحدة عبر وكلاء البوت —
//   POST /control/bot-merchant-key-rotate  (control/merchants.ts)
//   POST /control/bot-totp-enroll          (control/session.ts)
// — لازم يطلعوا بـ Cache-Control: no-store من طبقة Deno نفسها
// بنيويًا، مهما البوت رجّع.
//
// نتيجة الفحص قبل أي كود: عقد الوكيل هنا BotProxyResult =
// {status, body} بس — مفيش ترويسات أصلًا في العقد، فالمستدعي
// الوهمي تحت «بيحذف» الترويسة بطبيعته: أي no-store على رد Deno
// مصدره الوحيد الممكن هو بانية الرد المحلية (json) في الوحدتين،
// والاتنين بيحطوها ثابتة. فالتقوية دي إثبات بالاختبار، ومفيش
// تغيير إنتاجي اتعمل (ولا محتوى الردود ولا سير التدفقات اتلمس).
import { tokenEquals } from "../admin_auth.ts";
import type { BotProxyResult } from "./customers.ts";
import {
  type ControlMerchantsDeps,
  handleControlMerchantsRequest,
} from "./merchants.ts";
import {
  type ControlSessionDeps,
  handleControlSessionRequest,
} from "./session.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

// بوت وهمي «من غير ترويسات»: بيرجع الحالة والجسم بس — ده شكل
// العقد الحقيقي بالحرف، فهو نموذج أمين لمصدر بيحذف أي ترويسة.
class BareBotClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  result: BotProxyResult = { status: 200, body: { ok: true } };
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

function postReq(path: string, body: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token !== undefined) headers["x-migo-admin"] = token;
  return new Request(`https://api.example${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ------------------------------------------------- تدوير مفتاح تاجر
function merchantsDeps(bot: BareBotClient, admin = true): ControlMerchantsDeps {
  return {
    botClient: bot,
    isAdmin: () => admin,
    corsOf: () => ({}),
    logError: () => {},
  };
}

Deno.test("١٤/تدوير: no-store من طبقة Deno رغم إن البوت ما بعتش أي ترويسة", async () => {
  const bot = new BareBotClient();
  bot.result = {
    status: 200,
    body: { ok: true, new_key: "mgk_fake_rotated_secret_for_test" },
  };
  const res = await handleControlMerchantsRequest(
    postReq("/control/bot-merchant-key-rotate", { key_id: "k1" }),
    merchantsDeps(bot),
  );
  eq(res?.status, 200, "status passthrough");
  eq(res?.headers.get("Cache-Control"), "no-store", "Deno layer sets no-store");
  const body = await res!.json() as Record<string, unknown>;
  eq(body.new_key, "mgk_fake_rotated_secret_for_test",
    "secret body passes verbatim — flow content untouched");
  eq(bot.calls[0].path, "/api/control/merchant-key-rotate", "bot path");
});

Deno.test("١٤/تدوير: no-store على خطأ البوت وعلى فشله وعلى رفض البوابة", async () => {
  const bot = new BareBotClient();
  bot.result = { status: 400, body: { ok: false, error: "bad_value" } };
  const errRes = await handleControlMerchantsRequest(
    postReq("/control/bot-merchant-key-rotate", { key_id: "k1" }),
    merchantsDeps(bot),
  );
  eq(errRes?.status, 400, "bot error status passthrough");
  eq(errRes?.headers.get("Cache-Control"), "no-store", "no-store on bot error");

  bot.fail = true;
  const downRes = await handleControlMerchantsRequest(
    postReq("/control/bot-merchant-key-rotate", { key_id: "k1" }),
    merchantsDeps(bot),
  );
  eq(downRes?.status, 502, "bot down = 502");
  eq(downRes?.headers.get("Cache-Control"), "no-store", "no-store on 502");

  const denied = await handleControlMerchantsRequest(
    postReq("/control/bot-merchant-key-rotate", { key_id: "k1" }),
    merchantsDeps(new BareBotClient(), false),
  );
  eq(denied?.status, 401, "gate closed = 401");
  eq(denied?.headers.get("Cache-Control"), "no-store", "no-store on 401");
});

// ------------------------------------------------- تفعيل التحقق بخطوتين
const ADMIN = "shared-master";

function sessionDeps(bot: BareBotClient, admin = true): ControlSessionDeps {
  return {
    botClient: bot,
    isAdmin: (r: Request) =>
      admin && tokenEquals(r.headers.get("x-migo-admin") || "", ADMIN),
    corsOf: () => ({}),
    logError: () => {},
    adminToken: ADMIN,
    nowSeconds: () => 1_800_000_000,
  };
}

Deno.test("١٤/تفعيل: no-store من طبقة Deno رغم إن البوت ما بعتش أي ترويسة", async () => {
  const bot = new BareBotClient();
  bot.result = {
    status: 200,
    body: {
      ok: true,
      secret_b32: "FAKEENROLLSECRET32",
      otpauth_uri: "otpauth://totp/fake",
    },
  };
  const res = await handleControlSessionRequest(
    postReq("/control/bot-totp-enroll", { pin: "fake-pin" }, ADMIN),
    sessionDeps(bot),
  );
  eq(res?.status, 200, "status passthrough");
  eq(res?.headers.get("Cache-Control"), "no-store", "Deno layer sets no-store");
  const body = await res!.json() as Record<string, unknown>;
  eq(body.secret_b32, "FAKEENROLLSECRET32",
    "enroll secret passes verbatim — flow content untouched");
  eq(bot.calls[0].path, "/api/control/totp-enroll", "bot path");
});

Deno.test("١٤/تفعيل: no-store على خطأ البوت وعلى فشله وعلى رفض البوابة والطريقة", async () => {
  const bot = new BareBotClient();
  bot.result = { status: 409, body: { ok: false, error: "totp_already_active" } };
  const errRes = await handleControlSessionRequest(
    postReq("/control/bot-totp-enroll", { pin: "fake-pin" }, ADMIN),
    sessionDeps(bot),
  );
  eq(errRes?.status, 409, "bot error status passthrough");
  eq(errRes?.headers.get("Cache-Control"), "no-store", "no-store on bot error");

  bot.fail = true;
  const downRes = await handleControlSessionRequest(
    postReq("/control/bot-totp-enroll", { pin: "fake-pin" }, ADMIN),
    sessionDeps(bot),
  );
  eq(downRes?.status, 502, "bot down = 502");
  eq(downRes?.headers.get("Cache-Control"), "no-store", "no-store on 502");

  const denied = await handleControlSessionRequest(
    postReq("/control/bot-totp-enroll", { pin: "fake-pin" }, ADMIN),
    sessionDeps(new BareBotClient(), false),
  );
  eq(denied?.status, 401, "gate closed = 401");
  eq(denied?.headers.get("Cache-Control"), "no-store", "no-store on 401");

  const wrong = await handleControlSessionRequest(
    new Request("https://api.example/control/bot-totp-enroll", {
      method: "GET",
      headers: { "x-migo-admin": ADMIN },
    }),
    sessionDeps(new BareBotClient()),
  );
  eq(wrong?.status, 405, "wrong method = 405");
  eq(wrong?.headers.get("Cache-Control"), "no-store", "no-store on 405");
});

Deno.test("١٤: فحص ساكن — no-store ثابتة في بانية الرد المحلية للوحدتين، مش تمرير ترويسات", async () => {
  // الإثبات البنيوي: الترويسة مكتوبة حرفيًا جوه دالة json المحلية
  // في كل وحدة، ومفيش أي نسخ لترويسات رد البوت في أي ملف وكيل —
  // عقد BotProxyResult نفسه مفيهوش ترويسات من الأساس.
  const merchantsSrc = await Deno.readTextFile(
    new URL("./merchants.ts", import.meta.url),
  );
  const sessionSrc = await Deno.readTextFile(
    new URL("./session.ts", import.meta.url),
  );
  ok(merchantsSrc.includes('"Cache-Control": "no-store"'),
    "merchants json builder hardcodes no-store");
  ok(sessionSrc.includes('"Cache-Control": "no-store"'),
    "session json builder hardcodes no-store");
  const customersSrc = await Deno.readTextFile(
    new URL("./customers.ts", import.meta.url),
  );
  ok(customersSrc.includes("body: Record<string, unknown>"),
    "proxy result contract is status+body only");
  ok(!merchantsSrc.includes("headers.get(\"cache-control\")") &&
    !sessionSrc.includes("headers.get(\"cache-control\")"),
    "neither module copies an upstream cache header");
});
