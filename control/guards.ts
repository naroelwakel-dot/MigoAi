// لوحة التحكم: شاشة الحراس — تمرير خادمي لنقطتي البوت
// GET /api/control/guards (حالة كل حارس: اسمه الثابت وآخر فحص
// وحكم آخر فحص) وPOST /api/control/guards-wake (زر «فوّق الكل
// دلوقتي» — بيعدّي جسم الطلب زي ما هو، وبوابة الـ PIN عند البوت
// نفسه بـ require_pin). التمرير حرفي للحالة والجسم (نمط وكلاء
// الصحة م٥-ج): اللوحة ما بتجمعش حالة ولا بتخترع أوقات — البوت
// هو مصدر الحقيقة الوحيد من سجل الحراس الرسمي عنده. فشل نداء
// البوت = 502 bot_unavailable والواجهة بتعرض «غير متاحة».

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlGuardsDeps {
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
 * معالج شاشة الحراس — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlGuardsRequest(
  req: Request,
  deps: ControlGuardsDeps,
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

  const isWake = path.endsWith("/control/guards-wake");
  const isList = path.endsWith("/control/guards");
  if (!isList && !isWake) return null;

  // الطريقة الغلط 405 قبل بوابة الأدمن وأي نداء (نمط الوحدات).
  if (isList && req.method !== "GET") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (isWake && req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    if (isList) {
      const r: BotProxyResult = await deps.botClient.proxy(
        "GET",
        "/api/control/guards",
      );
      return json(r.body, r.status);
    }
    // جسم التفويق بيعدّي زي ما هو (الـ PIN جواه لو اللوحة
    // بعتته) — البوت هو اللي بيتحقق منه ويتصرف.
    let body: Record<string, unknown> = {};
    try {
      const parsed: unknown = await req.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return json({ ok: false, error: "bad_request" }, 400);
    }
    const r: BotProxyResult = await deps.botClient.proxy(
      "POST",
      "/api/control/guards-wake",
      body,
    );
    return json(r.body, r.status);
  } catch (e) {
    deps.logError("control.guards", "bot proxy failed", e);
    return json(
      { ok: false, error: "bot_unavailable", bot_unavailable: true },
      502,
    );
  }
}
