// لوحة التحكم (المرحلة م٢): الطلبات + الطابور اليدوي + المحادثة
// الحية — تمرير خادمي لكل نقاط البوت الداخلية الخاصة بالطلبات
// والمهام اليدوية والمحادثات (نفس نمط م١-ب/ج بالحرف)، وقراءة طلبات
// الموقع من قاعدة المتجر نفسها مع تغيير حالة مضبوط بمفردات حالات
// الموقع الحالية فقط، وكل تغيير حالة بيتدقق في سجل البوت الموحد
// وبيتصرح بفشل التدقيق (audit_failed). مسار الفلوس الوحيد هنا هو
// رجوع مبلغ طلب مدفوع من محفظة الموقع عند إلغائه/استرداده: بيتم
// عبر دالة المحفظة الداخلية الحالية wallet_adjust_internal بنفس
// مبلغ قيد الدفع الأصلي ومرجع عدم تكرار، فمفيش مسار فلوس جديد.
// ترتيب الإلغاء/الاسترداد «حجز أولًا»: الحالة بتتكتب بشرط الحالة
// المتوقعة قبل أي رجوع مبلغ، فمفيش نافذة يتلغي فيها الطلب وفلوسه
// ترجع وبعدين منفّذ المتجر يسلّمه — الخسارة من الناحيتين مستحيلة.

import type { BotControlProxyClient, BotProxyResult } from "./customers.ts";

// ------------------------------------------------------------ طلبات الموقع
export interface StoreOrderRow {
  id: string;
  order_ref: string | null;
  customer_email: string | null;
  items: unknown;
  total_text: string | null;
  server_total: number | string | null;
  status: string;
  payment: string | null;
  customer_id: string | null;
  created_at: string | null;
}

export interface WalletPayDebit {
  customerId: string;
  amountEgp: number; // قيمة موجبة: اللي اتخصم فعليًا من محفظة الموقع
}

export interface ControlOrdersClient {
  listOrders(
    status: string | null,
    limit: number,
  ): Promise<StoreOrderRow[]>;
  getOrder(id: string): Promise<StoreOrderRow | null>;
  // الكتابة مشروطة بالحالة المتوقعة (اللي اتقرت قبلها): صف راجع =
  // اتكتب، صفر = الحالة اتغيّرت تحتنا (سباق) والمعالج بيفرّق بصوت
  // عالي بدل ما يكتب فوق حالة أجدد.
  setOrderStatus(
    id: string,
    status: string,
    expectedStatus: string,
  ): Promise<StoreOrderRow | null>;
  // قيد دفع المحفظة الأصلي للطلب (ref = wallet-pay:<order_ref>) —
  // هو الدليل الوحيد إن الطلب اتدفع من محفظة الموقع وبكام.
  findWalletPayDebit(orderRef: string): Promise<WalletPayDebit | null>;
  // قيد ردّ موجود أصلًا بمرجع اللوحة الثابت (panel-order-cancel:<ref>)
  // — دليل إن مبلغ الطلب ده اتردّ للمحفظة خلاص، أيًا كان مين كتبه.
  hasWalletRefund(orderRef: string): Promise<boolean>;
  // رجوع المبلغ لمحفظة العميل عبر دالة المحفظة الداخلية الحالية،
  // بمرجع عدم تكرار ثابت لكل طلب: التكرار بيرجع already من غير حركة.
  refundWalletPay(
    customerId: string,
    amountEgp: number,
    orderRef: string,
  ): Promise<{ already: boolean }>;
}

// مفردات حالات طلبات الموقع زي ما هي مكتوبة في كود المتجر نفسه:
// 'new' من إنشاء الطلب، و'payment_confirmed' هي حالة «مدفوع»
// الحقيقية في القاعدة (دوال تأكيد الدفع والمنفّذ بيكتبوها)،
// و'fulfilled' و'refunded' بيكتبهم منفّذ المتجر، و'cancelled'
// حالة الصفوف الملغية الحالية. أي حالة بره القائمة دي بتترفض —
// الشاشة ما بتخترعش حالات جديدة.
export const STORE_ORDER_STATUSES = [
  "new",
  "payment_confirmed",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;

// خريطة الانتقالات المسموحة بين حالات طلبات الموقع — نفس دورة حياة
// الطلب الحقيقية في المتجر (تأكيد دفع ثم تنفيذ). الحالات النهائية
// ما بيطلعش منها حاجة: طلب اتسلّم ما يتلغاش (إلغاؤه كان هيرجّع
// فلوسه وهو متسلّم)، وطلب اتردّ/اتلغى ما يرجعش «منفّذ». الاستثناء
// الوحيد هو تكرار نفس الحالة النهائية (cancelled→cancelled
// وrefunded→refunded): دي إعادة محاولة آمنة بعد رد ضايع — الرجوع
// بيتدقّق بعدم التكرار وبيتبلّغ بـ already، فالرد بيصرّح بنتيجة
// الرجوع من غير أي حركة جديدة. أي انتقال برّه الخريطة = 409.
export const STORE_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  new: ["payment_confirmed", "cancelled"],
  payment_confirmed: ["fulfilled", "cancelled", "refunded"],
  fulfilled: [],
  cancelled: ["cancelled"],
  refunded: ["refunded"],
};

export interface ControlOrdersDeps {
  client: ControlOrdersClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (scope: string, msg: string, err?: unknown) => void;
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const ORDER_SELECT =
  "id,order_ref,customer_email,items,total_text,server_total,status," +
  "payment,customer_id,created_at";

/** عميل قراءة/كتابة PostgREST لطلبات المتجر، بنفس نمط باقي العملاء. */
export class PostgrestControlOrdersClient implements ControlOrdersClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }

  private headers(): Record<string, string> {
    return {
      "apikey": this.opts.keyOf(),
      "Authorization": `Bearer ${this.opts.keyOf()}`,
      "Accept": "application/json",
    };
  }

  private async get(path: string): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      headers: this.headers(),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control orders read http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async listOrders(
    status: string | null,
    limit: number,
  ): Promise<StoreOrderRow[]> {
    let path = `orders?select=${ORDER_SELECT}&order=created_at.desc` +
      `&limit=${limit}`;
    if (status) path += `&status=eq.${encodeURIComponent(status)}`;
    return await this.get(path) as unknown as StoreOrderRow[];
  }

  async getOrder(id: string): Promise<StoreOrderRow | null> {
    const rows = await this.get(
      `orders?id=eq.${encodeURIComponent(id)}&select=${ORDER_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as StoreOrderRow) ?? null;
  }

  async setOrderStatus(
    id: string,
    status: string,
    expectedStatus: string,
  ): Promise<StoreOrderRow | null> {
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(id)}` +
        `&status=eq.${encodeURIComponent(expectedStatus)}`,
      {
        method: "PATCH",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ status }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control orders write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    // التمثيل الراجع هو دليل الكتابة: صف واحد = اتكتب، صفر = الصف
    // ما طابقش شرط الحالة المتوقعة (اتغيّرت تحتنا أو اتمسح)،
    // والمعالج بيفرّق بينهم بصوت عالي.
    const rows = Array.isArray(parsed) ? parsed : [];
    return (rows[0] as unknown as StoreOrderRow) ?? null;
  }

  async findWalletPayDebit(
    orderRef: string,
  ): Promise<WalletPayDebit | null> {
    const rows = await this.get(
      `wallet_transactions?select=customer_id,amount_egp` +
        `&ref=eq.${encodeURIComponent("wallet-pay:" + orderRef)}&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const customerId = typeof row.customer_id === "string"
      ? row.customer_id
      : "";
    const amount = Math.abs(Number(row.amount_egp));
    if (!customerId || !Number.isFinite(amount) || amount <= 0) return null;
    return { customerId, amountEgp: amount };
  }

  async hasWalletRefund(orderRef: string): Promise<boolean> {
    const rows = await this.get(
      `wallet_transactions?select=id` +
        `&ref=eq.${encodeURIComponent("panel-order-cancel:" + orderRef)}` +
        `&limit=1`,
    );
    return rows.length > 0;
  }

  async refundWalletPay(
    customerId: string,
    amountEgp: number,
    orderRef: string,
  ): Promise<{ already: boolean }> {
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/rpc/wallet_adjust_internal`,
      {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_customer_id: customerId,
          p_delta: amountEgp,
          p_kind: "compensation",
          p_ref: "panel-order-cancel:" + orderRef,
          p_note: "إلغاء طلب من لوحة التحكم — رجوع مبلغ محفظة الموقع",
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control orders refund http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    let parsed: Record<string, unknown> | null = null;
    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object" && !Array.isArray(j)) parsed = j;
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.adjusted !== true && parsed.already !== true)) {
      throw new Error("control orders refund: unexpected rpc result");
    }
    return { already: parsed.already === true };
  }
}

// ------------------------------------------------------------- المعالج
export async function handleControlOrdersRequest(
  req: Request,
  deps: ControlOrdersDeps,
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
    "/control/bot-orders": {
      method: "GET",
      botPath: "/api/control/orders",
    },
    "/control/bot-order": {
      method: "GET",
      botPath: "/api/control/order",
    },
    "/control/bot-manual-tasks": {
      method: "GET",
      botPath: "/api/control/manual-tasks",
    },
    "/control/bot-order-shop-decide": {
      method: "POST",
      botPath: "/api/control/order-shop-decide",
    },
    "/control/bot-order-provider-action": {
      method: "POST",
      botPath: "/api/control/order-provider-action",
    },
    "/control/bot-order-sheerid-resolve": {
      method: "POST",
      botPath: "/api/control/order-sheerid-resolve",
    },
    "/control/bot-order-force-status": {
      method: "POST",
      botPath: "/api/control/order-force-status",
    },
    "/control/bot-order-to-manual": {
      method: "POST",
      botPath: "/api/control/order-to-manual",
    },
    "/control/bot-order-create-behalf": {
      method: "POST",
      botPath: "/api/control/order-create-behalf",
    },
    "/control/bot-manual-task": {
      method: "POST",
      botPath: "/api/control/manual-task",
    },
    "/control/bot-order-lock": {
      method: "POST",
      botPath: "/api/control/order-lock",
    },
    "/control/bot-chats": {
      method: "GET",
      botPath: "/api/control/chats",
    },
    "/control/bot-chat-history": {
      method: "GET",
      botPath: "/api/control/chat-history",
    },
    "/control/bot-chat-send": {
      method: "POST",
      botPath: "/api/control/chat-send",
    },
    "/control/bot-chat-mode": {
      method: "POST",
      botPath: "/api/control/chat-mode",
    },
    "/control/bot-chat-send-saved": {
      method: "POST",
      botPath: "/api/control/chat-send-saved",
    },
    "/control/bot-chat-give": {
      method: "POST",
      botPath: "/api/control/chat-give",
    },
    "/control/bot-saved-replies": {
      method: "GET",
      botPath: "/api/control/saved-replies",
    },
  };
  // أطول لاحقة الأول عشان ما يحصلش تطابق جزئي غلط بين مسارين.
  const suffix = Object.keys(BOT_PROXIES)
    .sort((a, b) => b.length - a.length)
    .find((s) => path.endsWith(s));
  const isStoreOrders = path.endsWith("/control/store-orders");
  if (!suffix && !isStoreOrders) return null;

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
      deps.logError("control.orders", "bot proxy failed", e);
      return json(
        { ok: false, error: "bot_unavailable", bot_unavailable: true },
        502,
      );
    }
  };

  // ------------------------------------------------ تمرير نقاط البوت
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

  // ------------------------------------------------ طلبات الموقع
  if (req.method === "GET") {
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const status = (url.searchParams.get("status") || "").trim();
    if (
      status &&
      !(STORE_ORDER_STATUSES as readonly string[]).includes(status)
    ) {
      return json({ ok: false, error: "invalid_status" }, 400);
    }
    let limit = Number(url.searchParams.get("limit") || "50");
    if (!Number.isFinite(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    try {
      const orders = await deps.client.listOrders(status || null, limit);
      return json({ ok: true, orders });
    } catch (e) {
      deps.logError("control.orders", "store orders read failed", e);
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
  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  if (!orderId) {
    return json({ ok: false, error: "invalid_order" }, 400);
  }
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!(STORE_ORDER_STATUSES as readonly string[]).includes(status)) {
    return json({ ok: false, error: "invalid_status" }, 400);
  }
  const reason = typeof body.reason === "string"
    ? body.reason.trim().slice(0, 500)
    : "";
  let before: StoreOrderRow | null;
  try {
    before = await deps.client.getOrder(orderId);
  } catch (e) {
    deps.logError("control.orders", "store order read failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
  if (!before) return json({ ok: false, error: "order_not_found" }, 404);

  // بوابة الانتقالات: حالة برّه الخريطة من الحالة الحالية بتترفض
  // قبل أي حركة فلوس أو كتابة — طلب منفّذ ما يتلغاش وطلب مسترد
  // ما يتنفّذش. وتكرار نفس الحالة النهائية إعادة محاولة آمنة.
  const allowedTargets = STORE_ORDER_TRANSITIONS[before.status] ?? [];
  if (!allowedTargets.includes(status)) {
    return json({
      ok: false,
      error: "invalid_transition",
      from_status: before.status,
      to_status: status,
    }, 409);
  }
  // إلغاء/استرداد فعلي (مش تكرار نفس الحالة) لازم له سبب مكتوب —
  // هو اللي بيتحط في سجل التدقيق وبيفسّر حركة الفلوس.
  if ((status === "cancelled" || status === "refunded") &&
    before.status !== status && !reason) {
    return json({ ok: false, error: "reason_required" }, 400);
  }

  // الحجز أولًا: كتابة الحالة بشرط الحالة المتوقعة قبل أي حركة
  // فلوس. المنفّذ ممكن يسلّم الطلب في أي لحظة، فلو رجّعنا المبلغ
  // الأول وبعدين كتبنا، ممكن الطلب يتسلّم وفلوسه ترجع — خسارة من
  // الناحيتين. الكتابة المشروطة بتقفل السباق: بتكسب فالحالة بقت
  // بتاعتنا وبعدها الرجوع آمن، أو بتخسر فمفيش أي فلوس بتتحرك.
  let after: StoreOrderRow | null;
  try {
    after = await deps.client.setOrderStatus(
      orderId, status, before.status);
  } catch (e) {
    deps.logError("control.orders", "store order write failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
  if (!after) {
    // الحالة اتغيّرت بين القراءة والكتابة (سباق): مفيش كتابة حصلت
    // ومفيش أي رجوع اتعمل — الرد بيقول إن الحالة اتغيّرت بس.
    return json({
      ok: false,
      error: "state_changed",
      from_status: before.status,
      to_status: status,
    }, 409);
  }

  // إلغاء/استرداد طلب مدفوع من محفظة الموقع: الحالة اتحجزت خلاص
  // فوق، ودلوقتي المبلغ بيرجع للمحفظة عبر دالة المحفظة الداخلية
  // الحالية وبنفس مبلغ قيد الدفع الأصلي. الدالة آمنة ضد التكرار
  // بمرجع ثابت: لو الرجوع فشل بعد الحجز بنرجّع refund_failed مع
  // تصريح بالحالة الجديدة (الطلب اتلغى فعلًا والرجوع لسه معلّق)،
  // والاسترداد بيتم بإعادة نفس الطلب — تكرار نفس الحالة النهائية
  // انتقال مسموح وبيعيد تشغيل الرجوع، واللي اترجّع قبل كده بيرجع
  // already من غير حركة تانية.
  let refund: Record<string, unknown> | null = null;
  // إصلاح W7 #1: فشل خطوة الرجوع ما بقاش يرجّع قبل التدقيق — تغيير
  // الحالة الأصلي (اللي اتكتب واتحجز خلاص) لازم يتسجّل في سجل
  // التدقيق الموحد في كل الأحوال، ونتيجة الرجوع الفاشلة بتتحط في
  // حمولة التدقيق نفسها. رد الخطأ الأصلي بيتبعت بعد التدقيق بنفس
  // جسمه بالحرف.
  let refundError: Response | null = null;
  if (status === "cancelled" || status === "refunded") {
    refund = { applied: false, reason: "not_wallet_paid" };
    if (before.order_ref) {
      let debit: WalletPayDebit | null = null;
      try {
        debit = await deps.client.findWalletPayDebit(before.order_ref);
      } catch (e) {
        deps.logError("control.orders", "wallet pay lookup failed", e);
        refund = { applied: false, reason: "wallet_lookup_failed" };
        refundError = json({ ok: false, error: "store_failed" }, 502);
      }
      if (debit) {
        // إصلاح W7 #2: إعادة محاولة نفس الحالة (before == target)
        // بتفحص قيد الردّ القائم بمرجع اللوحة قبل ما تنادي الـ RPC
        // تاني — الـ RPC بيحسب سقوفه تراكميًا وممكن يطبّق من جديد
        // لو قيد الردّ الأولاني اتكتب بمرجع مختلف أو فحص already
        // بتاعه ما لقاش صف النجاح. قيد موجود = الرجوع حصل خلاص.
        let alreadyRefunded = false;
        if (before.status === status) {
          try {
            alreadyRefunded = await deps.client.hasWalletRefund(
              before.order_ref,
            );
          } catch (e) {
            // فشل الفحص نفسه مش دليل على حاجة: بنكمّل للـ RPC
            // (فحص already بتاعه هو خط الدفاع التاني زي ما هو).
            deps.logError("control.orders", "wallet refund check failed", e);
          }
        }
        if (alreadyRefunded) {
          refund = {
            applied: true,
            already: true,
            amount_egp: debit.amountEgp,
          };
        } else {
          try {
            const r = await deps.client.refundWalletPay(
              debit.customerId,
              debit.amountEgp,
              before.order_ref,
            );
            refund = {
              applied: true,
              already: r.already,
              amount_egp: debit.amountEgp,
            };
          } catch (e) {
            deps.logError("control.orders", "wallet refund failed", e);
            refund = { applied: false, reason: "refund_failed" };
            refundError = json({
              ok: false,
              error: "refund_failed",
              order_id: orderId,
              status: after.status,
            }, 502);
          }
        }
      }
    }
  }

  // التدقيق في السجل الموحد عند البوت — فشله بيظهر ومش بيخفي نجاح
  // تغيير الحالة (الحالة اتغيّرت فعلًا؛ الإخفاء أخطر).
  let auditFailed = false;
  try {
    const r = await deps.botClient.proxy("POST", "/api/control/audit-log", {
      action: "store_order_status",
      entity_type: "store_order",
      entity_ref: before.order_ref || orderId,
      before: { status: before.status },
      after: { status: after.status, ...(refund ? { refund } : {}) },
      reason,
    });
    if (r.status < 200 || r.status >= 300 || r.body?.ok === false) {
      auditFailed = true;
    }
  } catch (e) {
    auditFailed = true;
    deps.logError("control.orders", "order status audit failed", e);
  }

  // إصلاح W7 #1: التدقيق اتكتب خلاص — رد خطأ الرجوع الأصلي بيتبعت
  // دلوقتي بنفس جسمه (العميل/اللوحة بيشوفوا نفس النتيجة بالحرف).
  if (refundError) return refundError;

  return json({
    ok: true,
    order_id: orderId,
    order_ref: after.order_ref,
    status: after.status,
    ...(refund ? { refund } : {}),
    audit_failed: auditFailed,
  });
}
