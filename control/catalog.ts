// لوحة التحكم (المرحلة م٣-ب): كتالوج البوت + خريطة الهوية —
// تمرير خادمي لنقاط البوت الداخلية الخاصة بالكتالوج والتسعير
// (نفس نمط م٢ في orders.ts بالحرف): بوابة الأدمن هنا أولًا، وبعدين
// الجسم بيعدّي زي ما هو، ورد البوت (نجاح أو خطأ بحالته) بيرجع زي
// ما هو. البوت هو اللي بيكتب وبيتدقّق في سجل التدقيق الموحد
// عنده، فمفيش تدقيق من جهة الموقع هنا — والنجاح في الشاشة ما
// بيظهرش إلا بعد رد سليم من البوت نفسه.

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

export interface ControlCatalogDeps {
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

// ------------------------------------------------------------- المعالج
export async function handleControlCatalogRequest(
  req: Request,
  deps: ControlCatalogDeps,
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
    "/control/bot-catalog-products": {
      method: "GET",
      botPath: "/api/control/catalog-products",
    },
    "/control/bot-catalog-identity": {
      method: "GET",
      botPath: "/api/control/catalog-identity",
    },
    "/control/bot-catalog-product-suppliers": {
      method: "GET",
      botPath: "/api/control/catalog-product-suppliers",
    },
    "/control/bot-catalog-product-save": {
      method: "POST",
      botPath: "/api/control/catalog-product-save",
    },
    "/control/bot-catalog-price-batch": {
      method: "POST",
      botPath: "/api/control/catalog-price-batch",
    },
    "/control/bot-catalog-price-batch-undo": {
      method: "POST",
      botPath: "/api/control/catalog-price-batch-undo",
    },
    "/control/bot-catalog-category-save": {
      method: "POST",
      botPath: "/api/control/catalog-category-save",
    },
    "/control/bot-catalog-identity-save": {
      method: "POST",
      botPath: "/api/control/catalog-identity-save",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين.
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
      deps.logError("control.catalog", "bot proxy failed", e);
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
