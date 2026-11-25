// لوحة التحكم: توريد الشركاء — شركاء بيشتروا مننا تفعيلات
// ويدفعوا مقدمًا في محفظة عندنا (الرصيد الفعلي وشرائح الأسعار
// والمستحق عليهم وطلباتهم وحركات محفظتهم)، وحالة السيرفرين
// اللي الشغل شغال عليهم (ألفا وبرافو ٢). تمرير خادمي لنقاط
// البوت الداخلية الخاصة بالشركاء والسيرفرات (نفس نمط الموردين
// في suppliers.ts بالحرف): بوابة الأدمن هنا أولًا، وبعدين
// الجسم بيعدّي زي ما هو، ورد البوت (نجاح أو خطأ بحالته)
// بيرجع زي ما هو. البوت هو اللي بيكتب وبيتدقّق في سجل التدقيق
// الموحد عنده، فمفيش تدقيق من جهة الموقع هنا. مفيش أي مسار
// حذف في الوحدة دي — إضافة الرصيد وتسجيل الدفعات اللي وصلت
// قيود بتتسجل عند البوت، مش تعديلات بتمسح حاجة.

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlPartnersDeps {
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

// ------------------------------------------------------------- المعالج
export async function handleControlPartnersRequest(
  req: Request,
  deps: ControlPartnersDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...deps.corsOf(req),
      },
    });

  const BOT_PROXIES: Record<string, { method: string; botPath: string }> = {
    "/control/partners": {
      method: "GET",
      botPath: "/api/control/partners",
    },
    "/control/partner": {
      method: "GET",
      botPath: "/api/control/partner",
    },
    "/control/partner-credit": {
      method: "POST",
      botPath: "/api/control/partner-credit",
    },
    "/control/partner-received": {
      method: "POST",
      botPath: "/api/control/partner-received",
    },
    "/control/servers": {
      method: "GET",
      botPath: "/api/control/servers",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين
  // (خصوصًا /control/partners و/control/partner — الأول أطول
  // فلازم يتجرب الأول).
  const suffix = Object.keys(BOT_PROXIES)
    .sort((a, b) => b.length - a.length)
    .find((s) => path.endsWith(s));
  if (!suffix) return null;
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
      deps.logError("control.partners", "bot proxy failed", e);
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
  const body = (parsed && typeof parsed === "object" &&
      !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : null;
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  return await proxyBot("POST", route.botPath, body);
}
