// لوحة التحكم (المرحلة م٦-د): حماية اللوحة — الرقم السري (PIN)
// وتراجع الإعدادات. تمرير خادمي لنقاط البوت: ضبط/تحقق/حالة الرقم
// السري، وتراجع تغيير إعداد من سجل التغييرات. مفيش منطق حماية
// هنا: التخزين بالهاش وعدّاد المحاولات والقفل والبوابة على
// الأفعال الحساسة كلها عند البوت، واللوحة بتمرّر الرد بحالته
// وجسمه زي ما هو (نمط وكلاء م٥ بالحرف).

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlSecurityDeps {
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
}

/**
 * معالج حماية اللوحة — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlSecurityRequest(
  req: Request,
  deps: ControlSecurityDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        // ردود اللوحة ممنوع تتخزّن في أي كاش وسيط أو متصفح —
        // نفس قاعدة وكلاء م٥.
        "Cache-Control": "no-store",
        ...deps.corsOf(req),
      },
    });

  const BOT_PROXIES: Record<string, { method: string; botPath: string }> = {
    "/control/bot-pin-set": {
      method: "POST",
      botPath: "/api/control/pin-set",
    },
    "/control/bot-pin-verify": {
      method: "POST",
      botPath: "/api/control/pin-verify",
    },
    "/control/bot-pin-status": {
      method: "GET",
      botPath: "/api/control/pin-status",
    },
    "/control/bot-settings-undo": {
      method: "POST",
      botPath: "/api/control/settings-undo",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين.
  const suffix = Object.keys(BOT_PROXIES)
    .sort((a, b) => b.length - a.length)
    .find((s) => path.endsWith(s));
  if (!suffix) return null;

  // الطريقة الغلط 405 قبل بوابة الأدمن وأي نداء (نمط الوحدات).
  const route = BOT_PROXIES[suffix];
  if (req.method !== route.method) {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const proxyBot = async (
    method: string,
    botPath: string,
    body?: Record<string, unknown>,
  ): Promise<Response> => {
    try {
      const r: BotProxyResult = await deps.botClient.proxy(
        method,
        botPath,
        body,
      );
      return json(r.body, r.status);
    } catch (e) {
      deps.logError("control.security", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  };

  if (route.method === "GET") {
    return await proxyBot("GET", `${route.botPath}${url.search}`);
  }
  const parsed = await req.json().catch(() => null);
  const body = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : null;
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  return await proxyBot("POST", route.botPath, body);
}
