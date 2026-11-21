// لوحة التحكم: صحة النظام والحراس — تمرير خادمي لنقطة البوت
// GET /api/control/system-health (قراءة بس). مفيش أي منطق صحة
// هنا: البوت بيجمع حالة نفسه (اتصال/ويب هوك) وحلقات السيرفر
// وأرصدة الموردين وسجلات الحراس، واللوحة بتمرّر الرد بحالته
// وجسمه زي ما هو (نمط وكلاء القناة م٥-ج بالحرف). فشل النداء =
// 502 bot_unavailable، والواجهة بتعرض «حالة النظام غير متاحة
// الآن» بدل ما تخترع حالة.

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlHealthDeps {
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
 * معالج صحة النظام — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlHealthRequest(
  req: Request,
  deps: ControlHealthDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        // حالة تشغيلية لحظية — ممنوع تتخزّن في أي كاش.
        "Cache-Control": "no-store",
        ...deps.corsOf(req),
      },
    });

  if (!path.endsWith("/control/system-health")) return null;

  // الطريقة الغلط 405 قبل بوابة الأدمن وأي نداء (نمط الوحدات).
  if (req.method !== "GET") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const r: BotProxyResult = await deps.botClient.proxy(
      "GET",
      "/api/control/system-health",
    );
    return json(r.body, r.status);
  } catch (e) {
    deps.logError("control.health", "bot proxy failed", e);
    return json(
      { ok: false, error: "bot_unavailable", bot_unavailable: true },
      502,
    );
  }
}
