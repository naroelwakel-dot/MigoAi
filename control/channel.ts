// لوحة التحكم (المرحلة م٥-ج): قناة التليجرام — تمرير خادمي لنقاط
// قناة البوت الخمس (قائمة الطابور/منشور جديد/تعديل مسودة أو
// مجدول/حذف/تعديل منشور منشور). مفيش منطق قناة هنا: الطابور
// وحالاته والجدولة والنشر والتعديل على المنشور الفعلي عند البوت،
// واللوحة بتمرّر الردود بحالتها وجسمها زي ما هي (نمط وكلاء
// م٥-أ بالحرف).

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlChannelDeps {
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
 * معالج قناة اللوحة (م٥-ج) — بيتركب في api.ts على مسارات
 * /control/*. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlChannelRequest(
  req: Request,
  deps: ControlChannelDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        // ردود اللوحة (وفيها سرّ تدوير مفتاح بيظهر مرة واحدة)
        // ممنوع تتخزّن في أي كاش وسيط أو متصفح — نفس قاعدة البوت.
        "Cache-Control": "no-store",
        ...deps.corsOf(req),
      },
    });

  const BOT_PROXIES: Record<string, { method: string; botPath: string }> = {
    "/control/bot-channel-queue": {
      method: "GET",
      botPath: "/api/control/channel-queue",
    },
    "/control/bot-channel-post": {
      method: "POST",
      botPath: "/api/control/channel-post",
    },
    "/control/bot-channel-update": {
      method: "POST",
      botPath: "/api/control/channel-update",
    },
    "/control/bot-channel-delete": {
      method: "POST",
      botPath: "/api/control/channel-delete",
    },
    "/control/bot-channel-edit-published": {
      method: "POST",
      botPath: "/api/control/channel-edit-published",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين
  // (bot-channel لاحقة مشتركة لكل المسارات بالاسم).
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
      deps.logError("control.channel", "bot proxy failed", e);
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
