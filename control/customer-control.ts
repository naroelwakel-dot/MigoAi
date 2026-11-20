// لوحة التحكم (المرحلة م١-ج): تحكم العميل — أعلام البوت (تجميد/
// منع شراء/حظر) والملاحظات والوسوم وتعليق المبالغ وربط الهوية
// بتمرير خادمي لنقاط البوت الداخلية (نفس نمط م١-ب بالحرف)، وحظر
// الموقع عبر حظر Supabase Auth الأصلي (ban_duration) — بيمنع تسجيل
// الدخول فعليًا من غير جداول جديدة في قاعدة المتجر. تدقيق الحظر
// بيتبعت لسجل البوت الموحد وبيتصرح بفشله (audit_failed).

import type { BotControlProxyClient, BotProxyResult } from "./customers.ts";

export interface StoreAuthUser {
  id: string;
  banned_until: string | null;
}

export interface StoreAuthAdminClient {
  getUser(customerId: string): Promise<StoreAuthUser | null>;
  setBan(customerId: string, banned: boolean): Promise<StoreAuthUser | null>;
}

export interface ControlCustomerControlDeps {
  client: StoreAuthAdminClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

// ------------------------------------------------------------ عميل GoTrue
export class GoTrueAdminClient implements StoreAuthAdminClient {
  private opts: { baseUrl: string; keyOf: () => string };
  constructor(opts: { baseUrl: string; keyOf: () => string }) {
    this.opts = opts;
  }

  private async call(
    method: string,
    customerId: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const key = this.opts.keyOf();
    if (!key) throw new Error("service key not configured");
    const res = await fetch(
      `${this.opts.baseUrl}/auth/v1/admin/users/${encodeURIComponent(customerId)}`,
      {
        method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`gotrue admin ${method} -> ${res.status}`);
    const json = await res.json().catch(() => null);
    return (json && typeof json === "object" && !Array.isArray(json))
      ? json as Record<string, unknown>
      : null;
  }

  private shape(row: Record<string, unknown> | null): StoreAuthUser | null {
    if (!row || typeof row.id !== "string") return null;
    return {
      id: row.id,
      banned_until: typeof row.banned_until === "string"
        ? row.banned_until
        : null,
    };
  }

  async getUser(customerId: string): Promise<StoreAuthUser | null> {
    return this.shape(await this.call("GET", customerId));
  }

  async setBan(
    customerId: string,
    banned: boolean,
  ): Promise<StoreAuthUser | null> {
    // حظر فعّال عمليًا بلا نهاية قريبة، والفكّ بـ "none" (عقد GoTrue).
    return this.shape(await this.call("PUT", customerId, {
      ban_duration: banned ? "876000h" : "none",
    }));
  }
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// الحظر نشط بس لو تاريخ انتهائه لسه في المستقبل — قيمة قديمة
// (حظر مؤقت انتهى) مش حظر. قيمة مش بتتقرأ كتاريخ بتتعامل كحظر
// (المحافظة أولى من فكّ حظر بالغلط).
export function isBanned(user: StoreAuthUser): boolean {
  if (!user.banned_until) return false;
  const until = Date.parse(user.banned_until);
  return Number.isNaN(until) ? true : until > Date.now();
}

// ------------------------------------------------------------- المعالج
export async function handleControlCustomerControlRequest(
  req: Request,
  deps: ControlCustomerControlDeps,
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
    "/control/bot-customer-control": {
      method: "GET",
      botPath: "/api/control/customer-control",
    },
    "/control/bot-customer-flag-set": {
      method: "POST",
      botPath: "/api/control/customer-flag-set",
    },
    "/control/bot-customer-note-add": {
      method: "POST",
      botPath: "/api/control/customer-note-add",
    },
    "/control/bot-customer-tag": {
      method: "POST",
      botPath: "/api/control/customer-tag",
    },
    "/control/bot-wallet-hold": {
      method: "POST",
      botPath: "/api/control/wallet-hold",
    },
    "/control/bot-wallet-hold-release": {
      method: "POST",
      botPath: "/api/control/wallet-hold-release",
    },
    "/control/bot-customer-link": {
      method: "POST",
      botPath: "/api/control/customer-link",
    },
  };
  const suffix = Object.keys(BOT_PROXIES).find((s) => path.endsWith(s));
  const isStoreBan = path.endsWith("/control/store-customer-ban");
  if (!suffix && !isStoreBan) return null;

  const readBody = async (): Promise<Record<string, unknown> | null> => {
    const parsed = await req.json().catch(() => null);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? parsed as Record<string, unknown>
      : null;
  };

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
      deps.logError("control.customer_control", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  };

  // ------------------------------------------------ تمرير تحكم البوت
  if (suffix) {
    const route = BOT_PROXIES[suffix];
    if (req.method !== route.method) {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    if (route.method === "GET") {
      return await proxyBot("GET", `${route.botPath}${url.search}`);
    }
    const body = await readBody();
    if (!body) return json({ ok: false, error: "bad_body" }, 400);
    return await proxyBot("POST", route.botPath, body);
  }

  // ------------------------------------------------ حظر الموقع
  if (req.method === "GET") {
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const customerId = (url.searchParams.get("customer_id") || "").trim();
    if (!UUID_RE.test(customerId)) {
      return json({ ok: false, error: "invalid_customer" }, 400);
    }
    try {
      const user = await deps.client.getUser(customerId);
      if (!user) return json({ ok: false, error: "customer_not_found" }, 404);
      return json({
        ok: true,
        customer_id: user.id,
        banned: isBanned(user),
        banned_until: user.banned_until,
      });
    } catch (e) {
      deps.logError("control.customer_control", "auth user read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const body = await readBody();
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  const customerId = typeof body.customer_id === "string"
    ? body.customer_id.trim()
    : "";
  if (!UUID_RE.test(customerId)) {
    return json({ ok: false, error: "invalid_customer" }, 400);
  }
  const banned = body.banned;
  if (typeof banned !== "boolean") {
    return json({ ok: false, error: "invalid_value" }, 400);
  }
  const reason = typeof body.reason === "string"
    ? body.reason.trim().slice(0, 500)
    : "";
  let before: StoreAuthUser | null;
  try {
    before = await deps.client.getUser(customerId);
  } catch (e) {
    deps.logError("control.customer_control", "auth user read failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
  if (!before) return json({ ok: false, error: "customer_not_found" }, 404);
  let after: StoreAuthUser | null;
  try {
    after = await deps.client.setBan(customerId, banned);
  } catch (e) {
    deps.logError("control.customer_control", "auth ban write failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
  if (!after) return json({ ok: false, error: "customer_not_found" }, 404);

  // التدقيق في السجل الموحد عند البوت — فشله بيظهر ومش بيخفي نجاح
  // الحظر (الحالة اتغيّرت فعلًا؛ الإخفاء أخطر).
  let auditFailed = false;
  try {
    const r = await deps.botClient.proxy("POST", "/api/control/audit-log", {
      action: banned ? "store_customer_ban" : "store_customer_unban",
      entity_type: "store_customer",
      entity_ref: customerId,
      before: { banned_until: before.banned_until },
      after: { banned_until: after.banned_until },
      reason,
    });
    if (r.status < 200 || r.status >= 300 || r.body?.ok === false) {
      auditFailed = true;
    }
  } catch (e) {
    auditFailed = true;
    deps.logError("control.customer_control", "ban audit failed", e);
  }

  return json({
    ok: true,
    customer_id: customerId,
    banned: isBanned(after),
    banned_until: after.banned_until,
    audit_failed: auditFailed,
  });
}
