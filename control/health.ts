// لوحة التحكم: صحة النظام والحراس — تمرير خادمي لنقطة البوت
// GET /api/control/system-health (قراءة بس). البوت بيجمع حالة
// نفسه (اتصال/ويب هوك) وحلقات السيرفر وسجلات الحراس، واللوحة
// بتمرّر الرد بحالته وجسمه زي ما هو (نمط وكلاء القناة م٥-ج
// بالحرف) — باستثناء إلحاق واحد: رد البوت بيحمل رصيد Pixel
// Verification بس، فأرصدة موردي المحرك الشغالين بتتلحق هنا
// من عملية الرصيد الجاهزة عند البوت (supplier-engine) بنفس
// شكل Pixel {balance, currency} وبقيمة رئيسية (العملية بترجع
// أصغر وحدة: 212 = $2.12). فشل رصيد أي مورد بيعدّي من غير
// رصيد (تخطٍّ هادي) ومش بيوقع الرد كله. فشل النداء الأصلي =
// 502 bot_unavailable، والواجهة بتعرض «حالة النظام غير متاحة
// الآن» بدل ما تخترع حالة.

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";

// موردون بييجوا برصيدهم جاهز من البوت نفسه — ما بنسألش
// المحرك عنهم (Pixel مش مورد محرك أصلًا).
const BALANCE_READY_KEYS = new Set(["pixel-verification"]);

/**
 * قيمة رصيد عملية المحرك: الرد {result: {balance, currency}}
 * والرصيد بأصغر وحدة — بنرجّع القيمة الرئيسية وشكل عملة زي
 * Pixel بالظبط ("$" للدولار)، أو null لو الشكل مش سليم.
 */
export function engineBalanceOf(
  body: unknown,
): { balance: number; currency: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const result = (body as Record<string, unknown>).result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }
  const minor = Number((result as Record<string, unknown>).balance);
  if (!Number.isFinite(minor)) return null;
  const code = (result as Record<string, unknown>).currency;
  const currency = typeof code === "string" && code
    ? (code === "USD" ? "$" : code)
    : "$";
  return { balance: Math.round(minor) / 100, currency };
}

/**
 * إلحاق أرصدة موردي المحرك الشغالين برد الصحة، في مكانهم:
 * أي مورد شغال ولسه مالوش رصيد بيتسأل عنه بعملية الرصيد،
 * وأي فشل (نداء/حالة/شكل) بيعدّي من غير ما يمس الصف.
 */
async function enrichProviderBalances(
  body: unknown,
  deps: ControlHealthDeps,
): Promise<void> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  const providers = (body as Record<string, unknown>).providers;
  if (!Array.isArray(providers)) return;
  await Promise.all(providers.map(async (p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return;
    const entry = p as Record<string, unknown>;
    if (entry.active !== true) return;
    if (typeof entry.balance === "number" ||
      typeof entry.balance === "string") return;
    const key = typeof entry.key === "string"
      ? entry.key
      : (typeof entry.slug === "string" ? entry.slug : "");
    if (!key || BALANCE_READY_KEYS.has(key)) return;
    try {
      const r = await deps.botClient.proxy(
        "POST",
        "/api/control/supplier-engine",
        { slug: key, op: "balance" },
      );
      if (r.status !== 200) return;
      const bal = engineBalanceOf(r.body);
      if (bal) {
        entry.balance = bal.balance;
        entry.currency = bal.currency;
      }
    } catch {
      // تخطٍّ هادي: الصف بيعدّي من غير رصيد زي ما جه.
    }
  }));
}

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
    if (r.status === 200) {
      await enrichProviderBalances(r.body, deps);
    }
    return json(r.body, r.status);
  } catch (e) {
    deps.logError("control.health", "bot proxy failed", e);
    return json(
      { ok: false, error: "bot_unavailable", bot_unavailable: true },
      502,
    );
  }
}
