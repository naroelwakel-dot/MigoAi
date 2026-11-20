// لوحة التحكم (المرحلة م٥-أ): سجل إعدادات البوت — تمرير خادمي
// لنقاط إعدادات البوت الخمس (القائمة/الحفظ/سجل التغييرات/النسخة
// الاحتياطية/الاستيراد). مفيش منطق إعدادات هنا: السجل والتحقق
// والتدقيق وسجل التغييرات عند البوت، واللوحة بتمرّر الردود
// بحالتها وجسمها زي ما هي (نمط وكلاء م٤ بالحرف).

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlSettingsDeps {
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
 * معالج إعدادات اللوحة (م٥-أ) — بيتركب في api.ts على مسارات
 * /control/*. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlSettingsRequest(
  req: Request,
  deps: ControlSettingsDeps,
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
    "/control/bot-settings": {
      method: "GET",
      botPath: "/api/control/settings",
    },
    "/control/bot-settings-set": {
      method: "POST",
      botPath: "/api/control/settings-set",
    },
    "/control/bot-settings-history": {
      method: "GET",
      botPath: "/api/control/settings-history",
    },
    "/control/bot-settings-backup": {
      method: "GET",
      botPath: "/api/control/settings-backup",
    },
    "/control/bot-settings-import": {
      method: "POST",
      botPath: "/api/control/settings-import",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين
  // (bot-settings لاحقة لكل المسارات التانية أصلًا بالاسم).
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
      deps.logError("control.settings", "bot proxy failed", e);
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
