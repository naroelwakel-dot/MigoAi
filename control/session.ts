// لوحة التحكم (المرحلة م٦-هـ): جلسة اللوحة والتحقق بخطوتين
// (TOTP). السرّ والتحقق وعدّاد المحاولات والقفل عند البوت (نفس
// معمارية الرقم السري م٦-د)؛ الموقع هنا بيعمل حاجتين بس:
//   ١) تمرير حرفي لنقاط حالة/تفعيل/إيقاف/تأكيد التحقق بخطوتين.
//   ٢) نقطة دخول الجلسة: بتمرّر رمز التطبيق للبوت، ونجاحه بيتبدّل
//      بجلسة موقعة من التوكن المشترك (admin_auth.ts) فاللوحة
//      تخزّن الجلسة بدل التوكن الخام.
// الدخول بالتوكن الخام بس — جلسة قائمة ما تعملش دخول جديد أبدًا.

import {
  isSessionShaped,
  makeSessionToken,
  SESSION_TTL_SECONDS,
} from "../admin_auth.ts";
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlSessionDeps {
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  /** التوكن المشترك اللي الجلسة بتتوقّع بيه (ADMIN_TOKEN). */
  adminToken: string;
  /** وقت دلوقتي بثواني Unix — قابل للحقن في الاختبارات. */
  nowSeconds: () => number;
}

/**
 * معالج جلسة اللوحة والتحقق بخطوتين — بيتركب في api.ts على
 * مسارات /control/*. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlSessionRequest(
  req: Request,
  deps: ControlSessionDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        // ردود الجلسة والتحقق بخطوتين ممنوع تتخزّن في أي كاش —
        // نفس قاعدة وكلاء م٥.
        "Cache-Control": "no-store",
        ...deps.corsOf(req),
      },
    });

  const LOGIN_PATH = "/control/session-login";
  const BOT_PROXIES: Record<string, { method: string; botPath: string }> = {
    "/control/session-status": {
      method: "GET",
      botPath: "/api/control/totp-status",
    },
    "/control/bot-totp-enroll": {
      method: "POST",
      botPath: "/api/control/totp-enroll",
    },
    "/control/bot-totp-disable": {
      method: "POST",
      botPath: "/api/control/totp-disable",
    },
    "/control/bot-totp-verify": {
      method: "POST",
      botPath: "/api/control/totp-verify",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين.
  const suffix = Object.keys(BOT_PROXIES)
    .sort((a, b) => b.length - a.length)
    .find((s) => path.endsWith(s));
  const isLogin = path.endsWith(LOGIN_PATH);
  if (!suffix && !isLogin) return null;

  const proxyBot = async (
    method: string,
    botPath: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult | Response> => {
    try {
      return await deps.botClient.proxy(method, botPath, body);
    } catch (e) {
      deps.logError("control.session", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  };

  const readBody = async (): Promise<Record<string, unknown> | null> => {
    const parsed = await req.json().catch(() => null);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : null;
  };

  // ------------------------------------------------ دخول الجلسة
  // بالتوكن الخام بس: أي ترويسة شكلها جلسة بتترفض صراحة قبل أي
  // فحص، والفاحص العادي على التوكن الخام بيحكم بعد كده.
  if (isLogin) {
    // الطريقة الغلط 405 قبل البوابة وأي نداء (نمط الوحدات).
    if (req.method !== "POST") {
      return json({ ok: false, error: "method" }, 405);
    }
    const presented = req.headers.get("x-migo-admin") || "";
    if (isSessionShaped(presented)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    const r = await proxyBot("POST", "/api/control/totp-verify", body);
    if (r instanceof Response) return r;
    // رد البوت مش نجاح (رمز غلط/قفل/مش مفعّل) بيعدّي بحالته
    // وجسمه زي ما هو — مفيش جلسة بتتولد على فشل.
    if (r.status >= 400 || !r.body || r.body.ok !== true) {
      return json(r.body, r.status);
    }
    try {
      const now = deps.nowSeconds();
      const session = await makeSessionToken(deps.adminToken, now);
      return json({
        ok: true,
        session,
        expires_at: new Date((now + SESSION_TTL_SECONDS) * 1000)
          .toISOString(),
      });
    } catch (e) {
      deps.logError("control.session", "session signing failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  }

  // ------------------------------------------ وكلاء التحقق بخطوتين
  // الطريقة الغلط 405 قبل بوابة الأدمن وأي نداء (نمط الوحدات).
  const route = BOT_PROXIES[suffix as string];
  if (req.method !== route.method) {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (route.method === "GET") {
    const r = await proxyBot("GET", `${route.botPath}${url.search}`);
    if (r instanceof Response) return r;
    return json(r.body, r.status);
  }
  const body = await readBody();
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  const r = await proxyBot("POST", route.botPath, body);
  if (r instanceof Response) return r;
  return json(r.body, r.status);
}
