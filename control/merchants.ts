// لوحة التحكم (المرحلة م٥-د): التجار — تمرير خادمي لنقاط تجار
// البوت الست (قائمة التجار/تفاصيل تاجر/تعديل حالة تاجر/تعديل حالة
// مفتاح/قائمة العناوين المسموحة لمفتاح/تدوير مفتاح). مفيش منطق
// تجار هنا: التجار ومفاتيحهم وطلباتهم وتدوير الأسرار عند البوت،
// واللوحة بتمرّر الردود بحالتها وجسمها زي ما هي (نمط وكلاء م٥-ج
// بالحرف). سرّ التدوير الجديد بيعدّي في رد البوت زي ما هو عشان
// اللوحة تعرضه مرة واحدة — الخادم ده لا بيخزّنه ولا بيسجّله.

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlMerchantsDeps {
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
 * معالج تجار اللوحة (م٥-د) — بيتركب في api.ts على مسارات
 * /control/*. بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlMerchantsRequest(
  req: Request,
  deps: ControlMerchantsDeps,
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
    "/control/bot-merchants": {
      method: "GET",
      botPath: "/api/control/merchants",
    },
    "/control/bot-merchant": {
      method: "GET",
      botPath: "/api/control/merchant",
    },
    "/control/bot-merchant-set": {
      method: "POST",
      botPath: "/api/control/merchant-set",
    },
    "/control/bot-merchant-key-set": {
      method: "POST",
      botPath: "/api/control/merchant-key-set",
    },
    "/control/bot-merchant-key-allowlist": {
      method: "POST",
      botPath: "/api/control/merchant-key-allowlist",
    },
    "/control/bot-merchant-key-rotate": {
      method: "POST",
      botPath: "/api/control/merchant-key-rotate",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين
  // (bot-merchant لاحقة مشتركة لكل المسارات بالاسم).
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
      deps.logError("control.merchants", "bot proxy failed", e);
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
