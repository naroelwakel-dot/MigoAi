// اختبارات وحدة جلسة اللوحة والتحقق بخطوتين (المرحلة م٦-هـ) —
// `deno test control/session.test.ts`
// عميل بوت وهمي (نمط security.test.ts) — مفيش أي نداء شبكة ولا
// قاعدة حقيقية. العقد: 405 قبل البوابة، 401 قبل أي نداء بوت،
// تمرير حرفي للحالة والجسم، فشل البوت 502 — والدخول بالتوكن
// الخام بس: ناجح بيبدّل رمز البوت بجلسة موقعة بتتأكد بفاحص
// admin_auth نفسه، وفاشل بيعدّي رد البوت من غير أي جلسة.
import {
  isSessionShaped,
  tokenEquals,
  verifySessionToken,
} from "../admin_auth.ts";
import type { BotProxyResult } from "./customers.ts";
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

const ADMIN = "shared-master";
const NOW = 1_800_000_000;

function depsOf(bot: FakeBotClient, admin = true): ControlSessionDeps {
  return {
    botClient: bot,
    isAdmin: (r: Request) =>
      admin && tokenEquals(r.headers.get("x-migo-admin") || "", ADMIN),
    corsOf: () => ({}),
    logError: () => {},
    adminToken: ADMIN,
    nowSeconds: () => NOW,
  };
}

function req(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
  token?: string,
): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token !== undefined) headers["x-migo-admin"] = token;
  return new Request(`https://api.example${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
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
  eq(await handleControlSessionRequest(req("/control/session"), d), null, "session alone");
  eq(await handleControlSessionRequest(req("/control/session-loginx"), d), null, "login-x");
  eq(await handleControlSessionRequest(req("/control/bot-totp"), d), null, "totp alone");
  eq(await handleControlSessionRequest(req("/control/bot-pin-status"), d), null, "pin status");
  eq(await handleControlSessionRequest(req("/control/home"), d), null, "home");
});

Deno.test("بوابة الأدمن: 401 قبل أي نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const res = await handleControlSessionRequest(
    req("/control/session-status", "GET", undefined, ADMIN),
    d,
  );
  eq(res?.status, 401, "status GET");
  eq((await bodyOf(res)).error, "unauthorized", "error");
  const res2 = await handleControlSessionRequest(
    req("/control/bot-totp-enroll", "POST", { pin: "1234" }, ADMIN),
    d,
  );
  eq(res2?.status, 401, "status POST");
  const res3 = await handleControlSessionRequest(
    req("/control/session-login", "POST", { code: "123456" }, ADMIN),
    d,
  );
  eq(res3?.status, 401, "login with gate closed");
  eq(bot.calls.length, 0, "zero bot calls behind the gate");
});

Deno.test("405 قبل البوابة وقبل أي نداء", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot, false);
  const wrong: [string, string][] = [
    ["/control/session-status", "POST"],
    ["/control/session-login", "GET"],
    ["/control/bot-totp-enroll", "GET"],
    ["/control/bot-totp-disable", "GET"],
    ["/control/bot-totp-verify", "GET"],
    ["/control/session-status", "DELETE"],
  ];
  for (const [p, m] of wrong) {
    const res = await handleControlSessionRequest(req(p, m), d);
    eq(res?.status, 405, `${m} ${p} status`);
    eq((await bodyOf(res)).error, "method", `${m} ${p} error`);
  }
  eq(bot.calls.length, 0, "zero bot calls on 405");
});

Deno.test("حالة التحقق بخطوتين: وكيل حرفي لـ totp-status", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = { status: 200, body: { ok: true, active: true } };
  const res = await handleControlSessionRequest(
    req("/control/session-status", "GET", undefined, ADMIN),
    d,
  );
  eq(res?.status, 200, "status");
  eq(bot.calls.length, 1, "one bot call");
  eq(bot.calls[0].method, "GET", "method");
  eq(bot.calls[0].path, "/api/control/totp-status", "bot path");
  eq(bot.calls[0].body, undefined, "GET has no body");
  eq((await bodyOf(res)).active, true, "active verbatim");
});

Deno.test("التفعيل والإيقاف والتأكيد: وكلاء حرفيون", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 200,
    body: { ok: true, secret_b32: "JBSWY3DPEHPK3PXP", otpauth_uri: "otpauth://totp/x" },
  };
  const res = await handleControlSessionRequest(
    req("/control/bot-totp-enroll", "POST", { pin: "2468" }, ADMIN),
    d,
  );
  eq(res?.status, 200, "enroll status");
  eq(bot.calls[0].path, "/api/control/totp-enroll", "enroll bot path");
  eq(bot.calls[0].body, { pin: "2468" }, "enroll body verbatim");
  eq((await bodyOf(res)).secret_b32, "JBSWY3DPEHPK3PXP", "secret verbatim");

  bot.result = { status: 409, body: { ok: false, error: "totp_already_active" } };
  const res2 = await handleControlSessionRequest(
    req("/control/bot-totp-enroll", "POST", { pin: "2468" }, ADMIN),
    d,
  );
  eq(res2?.status, 409, "already-active status passthrough");
  eq((await bodyOf(res2)).error, "totp_already_active", "already-active verbatim");

  bot.result = { status: 200, body: { ok: true } };
  const res3 = await handleControlSessionRequest(
    req("/control/bot-totp-disable", "POST", { pin: "2468", code: "123456" }, ADMIN),
    d,
  );
  eq(res3?.status, 200, "disable status");
  eq(bot.calls[2].path, "/api/control/totp-disable", "disable bot path");
  eq(bot.calls[2].body, { pin: "2468", code: "123456" }, "disable body verbatim");

  const res4 = await handleControlSessionRequest(
    req("/control/bot-totp-verify", "POST", { code: "123456" }, ADMIN),
    d,
  );
  eq(res4?.status, 200, "verify-proxy status");
  eq(bot.calls[3].path, "/api/control/totp-verify", "verify bot path");
  eq(bot.calls[3].body, { code: "123456" }, "verify body verbatim");
});

// ---------------------------------------------------------------- الدخول
Deno.test("الدخول الناجح: جلسة موقعة صالحة بدل رمز البوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = { status: 200, body: { ok: true, active: true } };
  const res = await handleControlSessionRequest(
    req("/control/session-login", "POST", { code: "123456" }, ADMIN),
    d,
  );
  eq(res?.status, 200, "login status");
  eq(bot.calls.length, 1, "one bot call");
  eq(bot.calls[0].path, "/api/control/totp-verify", "code went to bot verify");
  eq(bot.calls[0].body, { code: "123456" }, "code verbatim");
  const body = await bodyOf(res);
  eq(body.ok, true, "ok");
  const session = body.session as string;
  ok(isSessionShaped(session), "session is session-shaped");
  eq(
    await verifySessionToken(session, ADMIN, NOW),
    true,
    "session verifies with the shared token",
  );
  eq(
    await verifySessionToken(session, "other-secret", NOW),
    false,
    "session does not verify with another secret",
  );
  eq(body.expires_at, new Date((NOW + 8 * 3600) * 1000).toISOString(), "expires_at is now + 8h");
});

Deno.test("الدخول برمز غلط أو من غير رمز: رد البوت بيعدّي ومفيش جلسة", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  bot.result = {
    status: 401,
    body: { ok: false, error: "totp_wrong", attempts_left: 4 },
  };
  const res = await handleControlSessionRequest(
    req("/control/session-login", "POST", { code: "000000" }, ADMIN),
    d,
  );
  eq(res?.status, 401, "wrong code status passthrough");
  const body = await bodyOf(res);
  eq(body.error, "totp_wrong", "wrong code verbatim");
  eq(body.attempts_left, 4, "attempts_left verbatim");
  eq(body.session, undefined, "no session on failure");

  bot.result = { status: 423, body: { ok: false, error: "totp_locked" } };
  const res2 = await handleControlSessionRequest(
    req("/control/session-login", "POST", {}, ADMIN),
    d,
  );
  eq(res2?.status, 423, "no-code/locked status passthrough");
  eq((await bodyOf(res2)).error, "totp_locked", "locked verbatim");
  eq(bot.calls[1].body, {}, "empty body forwarded as-is");
});

Deno.test("الدخول بجلسة بدل التوكن الخام = 401 صريح من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  // الفاحص هنا بيقبل أي حاجة عشان نثبت إن الرفض من شكل الجلسة
  // نفسه جوه المعالج، مش من الفاحص.
  const d = depsOf(bot);
  d.isAdmin = () => true;
  const res = await handleControlSessionRequest(
    req("/control/session-login", "POST", { code: "123456" }, "v1.9999999999.fakesig"),
    d,
  );
  eq(res?.status, 401, "session-shaped login rejected");
  eq((await bodyOf(res)).error, "unauthorized", "error");
  eq(bot.calls.length, 0, "zero bot calls");
});

Deno.test("جسم POST فاسد = 400 من غير نداء بوت", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlSessionRequest(
    new Request("https://api.example/control/session-login", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json", "x-migo-admin": ADMIN },
    }),
    d,
  );
  eq(res?.status, 400, "status");
  eq((await bodyOf(res)).error, "bad_body", "error");
  eq(bot.calls.length, 0, "zero bot calls on bad body");
});

Deno.test("فشل البوت = 502 bot_unavailable (حالة ودخول)", async () => {
  const bot = new FakeBotClient();
  bot.fail = true;
  const d = depsOf(bot);
  const res = await handleControlSessionRequest(
    req("/control/session-status", "GET", undefined, ADMIN),
    d,
  );
  eq(res?.status, 502, "status proxy");
  eq((await bodyOf(res)).error, "bot_unavailable", "error");
  const res2 = await handleControlSessionRequest(
    req("/control/session-login", "POST", { code: "123456" }, ADMIN),
    d,
  );
  eq(res2?.status, 502, "login proxy");
  eq((await bodyOf(res2)).bot_unavailable, true, "flag");
});

Deno.test("ردود الجلسة ممنوعة من الكاش (no-store)", async () => {
  const bot = new FakeBotClient();
  const d = depsOf(bot);
  const res = await handleControlSessionRequest(
    req("/control/session-status", "GET", undefined, ADMIN),
    d,
  );
  eq(res?.headers.get("Cache-Control"), "no-store", "no-store on 200");
  const denied = await handleControlSessionRequest(
    req("/control/session-status", "GET", undefined, ADMIN),
    depsOf(bot, false),
  );
  eq(denied?.headers.get("Cache-Control"), "no-store", "no-store on 401");
});
