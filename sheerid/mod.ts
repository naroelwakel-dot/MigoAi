/**
 * نقطة دخول أتمتة تحقق SheerID على الموقع (مرآة api/sheerid.py عند
 * البوت + نمط معالجات api.ts القائمة).
 *
 * المسارات (بتتركب في Deno.serve قبل مسار التحقق من الألعاب):
 *   POST /sheerid/status   {order_ref, sender_account}
 *     → حالة التحقق الآمنة للعميل لصفحة الفاتورة. إثبات الملكية هو
 *       نفس إثبات get_invoice: رقم الطلب + حساب المُرسل يطابقوا الطلب.
 *   POST /sheerid/submit   {order_ref, sender_account, url}
 *     → إرسال رابط التحقق (استطلاع جوه الطلب عند +20/+40 ثانية).
 *   POST /sheerid/callback {job_id | data.job_id | job.id}
 *     → إشعار المورد: بناخد المعرّف بس، والقرار دايمًا من سؤال حالة
 *       خادمي. لما SHEERID_CALLBACK_SECRET مضبوط، النداء لازم يحمل
 *       ترويسة x-sheerid-callback-secret مطابقة وإلا بيترفض 401
 *       (ضبط الترويسة عند المورد خطوة مالك)؛ وكل المسارات عليها
 *       حدّ معدل لكل IP فوق حدّ api.ts العام.
 *   POST /sheerid/sweep    (ترويسة x-migo-admin — نفس حماية /exec/)
 *     → المسح الدوري: تحديث الجاري + ضمان التسليم + فتح عمليات جديدة.
 *
 * مصدر التنفيذ: جسر البوت افتراضيًا — توكن الجسر بيتقرا من جدول
 * backend_config (أو من SHEERID_BRIDGE_TOKEN في البيئة كتجاوز)،
 * والبوت بينفّذ بمفتاح المورد اللي عنده. ولو اتضبط SHEERID_API_KEY
 * في بيئة Deno بيشتغل الوضع المباشر القديم كتجاوز بأولوية أعلى.
 * غياب أي مصدر تنفيذ = الميزة مقفولة fail-closed: الحالة بترجع
 * «disabled» بصياغة المسار اليدوي، والإرسال بيترفض بنفس الصياغة،
 * والمسح بيعدّي من غير أي نداء خارجي.
 */

export * from "./config.ts";
export * from "./client.ts";
export * from "./texts.ts";
export * from "./repo.ts";
export * from "./service.ts";

import {
  apiKey as envApiKey,
  baseUrl as envBaseUrl,
  BRIDGE_CONFIG_TABLE,
  BRIDGE_TOKEN_KEY,
  bridgeBaseUrl,
  bridgeTokenFromEnv,
  SITE_CALLBACK_URL,
  webhookUrl as envWebhookUrl,
} from "./config.ts";
import {
  fetchTransport,
  SheerIDClient,
  SheerIDError,
} from "./client.ts";
import type { Transport } from "./client.ts";
import {
  PostgrestSheeridRepository,
  StoreOrderPort,
  type OrderPort,
} from "./repo.ts";
import { SheeridService, findVerifyUrl } from "./service.ts";
import type { CustomerState, EmailOutcome } from "./service.ts";
import * as texts from "./texts.ts";
import { PostgrestStoreDb } from "../store_executor/store_db.ts";
import { PostgrestRefundClient } from "../store_executor/refund.ts";
import {
  NOTIFY_SENDER_EMAIL,
  NOTIFY_SENDER_NAME,
  notifyConfigFromEnv,
} from "../store_executor/notify.ts";
import type { StoreOrder } from "../store_executor/types.ts";

type LogError = (
  source: string,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
) => void;

// ------------------------------------------------------------ إيميل العميل
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * إشعار إيميل العميل عبر نفس مسار المتجر القائم (Brevo من
 * orders@migoai.shop — نفس تهيئة notify.ts ونفس متغير BREVO_API_KEY).
 * غياب المفتاح أو غياب إيميل على الطلب = "unavailable" (تخطٍّ نضيف:
 * صفحة الفاتورة هي سطح التأكيد زي ما المنفّذ بيعمل بالظبط).
 */
export function createBrevoNotifier(opts: {
  env: (n: string) => string | undefined;
  http?: Transport;
  logError?: LogError;
}): (
  input: { order: StoreOrder; kind: "completed" | "failed" | "fallback" | "refund_pending"; job: { activation_url: string } },
) => Promise<EmailOutcome> {
  const config = notifyConfigFromEnv(opts.env);
  const http: Transport = opts.http || (async (req) => {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    return { status: res.status, text: await res.text() };
  });
  return async ({ order, kind, job }) => {
    const to = (order.customer_email || "").trim();
    if (!config.brevoApiKey || !to) return "unavailable";
    let subject = "";
    let text = "";
    if (kind === "completed") {
      subject = "تم تنفيذ طلبك بنجاح — Migo Ai";
      text = `أهلًا بيك،\n${texts.completedText(job.activation_url)}\n\n` +
        `تقدر تشوف حالة طلبك في أي وقت من صفحة الفاتورة على موقعنا برقم الطلب ${order.order_ref}.\nشكرًا لثقتك — فريق Migo Ai`;
    } else if (kind === "failed") {
      subject = "تعذّر إتمام التحقق وتمت معالجة استرداد مبلغك — Migo Ai";
      text = `أهلًا بيك،\n${texts.failedText()}\n\nفريق Migo Ai`;
    } else if (kind === "refund_pending") {
      // الاسترداد لسه قيد المعالجة — العنوان والنص صادقين (لجنة #4).
      subject = "تعذّر إتمام التحقق وجارٍ معالجة استرداد مبلغك — Migo Ai";
      text = `أهلًا بيك،\n${texts.refundPendingText()}\n\nفريق Migo Ai`;
    } else {
      subject = `تحديث على طلبك ${order.order_ref} — Migo Ai`;
      text = `أهلًا بيك،\n${texts.manualFallbackText()}\n\nفريق Migo Ai`;
    }
    try {
      const res = await http({
        url: BREVO_URL,
        method: "POST",
        headers: {
          "api-key": config.brevoApiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          sender: { email: NOTIFY_SENDER_EMAIL, name: NOTIFY_SENDER_NAME },
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
      });
      if (res.status >= 200 && res.status < 300) return "sent";
      opts.logError?.("sheerid.email", `brevo http ${res.status}`, undefined, {
        order_ref: order.order_ref,
        kind,
      });
      return "failed";
    } catch (e) {
      opts.logError?.("sheerid.email", "brevo send failed", e, {
        order_ref: order.order_ref,
        kind,
      });
      return "failed";
    }
  };
}

// ------------------------------------------------------------ بناء الخدمة
export interface SheeridWiring {
  service: SheeridService;
  orders: OrderPort;
}

/**
 * بيقرا توكن الجسر من جدول backend_config عبر PostgREST بمفتاح
 * الخدمة — نفس نمط وصول repo.ts بالظبط. فشل آمن تمامًا: أي خطأ أو
 * غياب للصف أو لمفتاح الخدمة بيرجّع "" (الميزة مقفولة fail-closed)،
 * وعمره ما بيرفع. القيمة ما بتتطبعش ولا بتتلجّش في أي مكان.
 */
export async function fetchBridgeToken(opts: {
  sbUrl: string;
  keyOf: () => string;
  transport?: Transport;
}): Promise<string> {
  const key = (opts.keyOf() || "").trim();
  if (!key || !opts.sbUrl) return "";
  const http: Transport = opts.transport || fetchTransport;
  try {
    const res = await http({
      url: `${opts.sbUrl.replace(/\/+$/, "")}/rest/v1/${BRIDGE_CONFIG_TABLE}` +
        `?key=eq.${encodeURIComponent(BRIDGE_TOKEN_KEY)}&select=value`,
      method: "GET",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Accept": "application/json",
      },
    });
    if (res.status < 200 || res.status >= 300 || !res.text) return "";
    const rows: unknown = JSON.parse(res.text);
    if (!Array.isArray(rows) || !rows.length) return "";
    const row = rows[0] as Record<string, unknown>;
    return String(row["value"] || "").trim();
  } catch {
    return "";
  }
}

interface BuildOpts {
  env: (n: string) => string | undefined;
  sbUrl: string;
  logError: LogError;
  transport?: Transport;
}

/** التركيب المشترك: بيبني الخدمة حوالين عميل جاهز (مباشر أو جسر). */
function buildSheeridWiring(
  opts: BuildOpts,
  client: SheerIDClient,
  webhookUrl: string,
): SheeridWiring {
  const env = opts.env;
  const keyOf = () => env("SUPABASE_SERVICE_ROLE_KEY") || "";
  const storeDb = new PostgrestStoreDb({
    baseUrl: opts.sbUrl,
    keyOf,
    triggerStatus: env("STORE_EXEC_TRIGGER_STATUS") || "payment_confirmed",
  });
  const orders = new StoreOrderPort(
    storeDb,
    new PostgrestRefundClient({ baseUrl: opts.sbUrl, keyOf }),
  );
  const repo = new PostgrestSheeridRepository({ baseUrl: opts.sbUrl, keyOf });
  const log = (m: string, e?: unknown) =>
    opts.logError("sheerid.service", m, e);
  const service = new SheeridService({
    repo,
    client,
    orders,
    sendEmail: createBrevoNotifier({ env, logError: opts.logError }),
    alertAdmin: (text) =>
      opts.logError("sheerid.admin_alert", text, undefined, {}),
    log,
    webhookUrl,
    paidStatuses: [
      env("STORE_EXEC_TRIGGER_STATUS") || "payment_confirmed",
      "payment_confirmed",
      "paid",
    ],
  });
  return { service, orders };
}

/**
 * بيبني الخدمة من البيئة + عناوين القاعدة. مفتاح الخدمة
 * (SUPABASE_SERVICE_ROLE_KEY) غايب = التركيب بيرفع — زي المنفّذ،
 * والراوتر بيبنيه كسولًا جوّه try عشان غيابه ما يكسرش أي مسار تاني.
 *
 * النسخة المتزامنة دي هي الوضع المباشر القديم (SHEERID_API_KEY من
 * بيئة Deno) — الراوتر بيستخدم النسخة غير المتزامنة اللي تحت عشان
 * تقدر تحلّ توكن الجسر من القاعدة.
 */
export function buildSheeridFromEnv(opts: BuildOpts): SheeridWiring {
  const env = opts.env;
  const base = envBaseUrl(env);
  if (!base) {
    // مفيش عنوان مورّد في البيئة (إصلاح اللجنة #10: مفيش افتراضي
    // مكتوب في الكود) — الوضع المباشر مقفول fail-closed.
    opts.logError(
      "sheerid.config",
      "SHEERID_BASE_URL not set — direct mode disabled (fail-closed)",
    );
  }
  const client = new SheerIDClient({
    apiKey: base ? envApiKey(env) : "",
    baseUrl: base,
    transport: opts.transport,
  });
  return buildSheeridWiring(opts, client, envWebhookUrl(env));
}

/**
 * التركيب اللي الراوتر بيستخدمه فعليًا — بيحلّ مصدر التنفيذ بالترتيب:
 * 1. ‏SHEERID_API_KEY في البيئة → الوضع المباشر القديم من غير أي تغيير.
 * 2. ‏SHEERID_BRIDGE_TOKEN في البيئة → وضع الجسر بالتوكن ده مباشرة.
 * 3. جدول backend_config → وضع الجسر بالتوكن المحفوظ (الحالة العادية).
 * مفيش مصدر = عميل من غير توكن = الميزة مقفولة fail-closed زي ما هي.
 * في وضع الجسر، رابط الإشعار الافتراضي هو رابط الموقع نفسه
 * (SITE_CALLBACK_URL) إلا لو اتضبط SHEERID_WEBHOOK_URL صراحة.
 */
export async function buildSheeridFromEnvAsync(
  opts: BuildOpts,
): Promise<SheeridWiring> {
  const env = opts.env;
  if (envApiKey(env)) {
    // تحذير صريح (إصلاح اللجنة #13): مفتاح مباشر وتوكن جسر مضبوطين
    // في البيئة مع بعض = الوضع المباشر بيكسب والجسر بيتلغي بصمت —
    // لازم يبان في السجل عشان ما يبقاش تجاوز مخفي.
    if (bridgeTokenFromEnv(env)) {
      opts.logError(
        "sheerid.config",
        "SHEERID_API_KEY and SHEERID_BRIDGE_TOKEN are both set — " +
          "direct mode overrides the bridge; remove one of them",
      );
    }
    return buildSheeridFromEnv(opts);
  }
  let token = bridgeTokenFromEnv(env);
  if (!token) {
    token = await fetchBridgeToken({
      sbUrl: opts.sbUrl,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY") || "",
      transport: opts.transport,
    });
  }
  const bridgeUrl = bridgeBaseUrl(env);
  if (token && !bridgeUrl) {
    // رابط جسر مرفوض (مش https) أو غايب: إقفال fail-closed — التوكن
    // ما يتبعتش لأي عنوان تاني أبدًا.
    opts.logError(
      "sheerid.config",
      "bridge base URL missing or not https — service disabled (fail-closed)",
    );
    token = "";
  }
  const client = new SheerIDClient({
    apiKey: "",
    baseUrl: bridgeUrl,
    bridgeToken: token,
    transport: opts.transport,
  });
  const webhook = envWebhookUrl(env) || SITE_CALLBACK_URL;
  return buildSheeridWiring(opts, client, webhook);
}

// ------------------------------------------------------------ حدّ المعدل
export interface SheeridRateLimits {
  statusPerMinute: number;
  submitPerMinute: number;
  callbackPerMinute: number;
}

/**
 * حدود افتراضية واسعة عمدًا: استطلاع صفحة الفاتورة الشرعي (كل كام
 * ثانية) وإشعارات المورد الطبيعية عمرها ما توصل لها — الغرض سدّ
 * الإغراق/التخمين بس (إصلاح اللجنة #6)، فوق حدّ api.ts العام أصلًا.
 */
export const DEFAULT_SHEERID_RATE_LIMITS: SheeridRateLimits = {
  statusPerMinute: 120,
  submitPerMinute: 20,
  callbackPerMinute: 120,
};

/** حدّ معدل في الذاكرة لكل (مسار + IP) — نفس نمط rateLimited في api.ts. */
export class SheeridRateLimiter {
  private map = new Map<string, { n: number; t: number }>();
  private limits: SheeridRateLimits;
  private nowFn: () => number;
  constructor(
    limits: SheeridRateLimits = DEFAULT_SHEERID_RATE_LIMITS,
    nowFn: () => number = Date.now,
  ) {
    this.limits = limits;
    this.nowFn = nowFn;
  }
  /** true = الطلب يعدّي؛ false = تجاوز الحد في الدقيقة دي. */
  allow(route: "status" | "submit" | "callback", ip: string): boolean {
    const limit = route === "status"
      ? this.limits.statusPerMinute
      : route === "submit"
      ? this.limits.submitPerMinute
      : this.limits.callbackPerMinute;
    const now = this.nowFn();
    if (this.map.size > 5000) this.map.clear();
    const key = `${route}:${ip}`;
    const rec = this.map.get(key);
    if (!rec || now - rec.t > 60_000) {
      this.map.set(key, { n: 1, t: now });
      return true;
    }
    rec.n++;
    return rec.n <= limit;
  }
}

let _defaultRateLimiter: SheeridRateLimiter | null = null;
function defaultRateLimiter(): SheeridRateLimiter {
  if (!_defaultRateLimiter) _defaultRateLimiter = new SheeridRateLimiter();
  return _defaultRateLimiter;
}
let _callbackSecretWarned = false;

// ------------------------------------------------------------ المعالج
export interface SheeridHandlerDeps {
  service: SheeridService;
  orders: OrderPort;
  isAuthorized: (req: Request) => boolean;
  /** ترويسات الرد (CORS من api.ts) — اختيارية. */
  headersOf?: (req: Request) => Record<string, string>;
  logError?: LogError;
  /**
   * سر إشعار المورد (env ‏SHEERID_CALLBACK_SECRET): لما يبقى مضبوط،
   * الـ callback لازم يحمل ترويسة x-sheerid-callback-secret مطابقة
   * وإلا بيترفض. فاضي = السلوك القديم (قبول الكل) + تحذير في السجل
   * — ضبطه عند المورد خطوة مالك موثّقة في الـ PR.
   */
  callbackSecret?: string;
  /** حدّ معدل المسارات — الافتراضي المشترك لو ما اتحقنش. */
  rateLimiter?: SheeridRateLimiter;
}

function extractJobId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const data = (p["data"] && typeof p["data"] === "object")
    ? (p["data"] as Record<string, unknown>)
    : {};
  const job = (p["job"] && typeof p["job"] === "object")
    ? (p["job"] as Record<string, unknown>)
    : {};
  for (const candidate of [p["job_id"], data["job_id"], job["id"]]) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
}

/** معالج مسارات التحقق — بيتركب في api.ts قبل مسار تحقق الألعاب. */
export async function handleSheeridRequest(
  req: Request,
  deps: SheeridHandlerDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isStatus = path.endsWith("/sheerid/status");
  const isSubmit = path.endsWith("/sheerid/submit");
  const isCallback = path.endsWith("/sheerid/callback");
  const isSweep = path.endsWith("/sheerid/sweep");
  if (!isStatus && !isSubmit && !isCallback && !isSweep) return null;

  const headers = {
    "Content-Type": "application/json",
    ...(deps.headersOf ? deps.headersOf(req) : {}),
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  const limiter = deps.rateLimiter || defaultRateLimiter();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";

  // إشعار المورد: الجسم مش مصدر قرار أبدًا — لكن النداء نفسه بقى
  // محمي (إصلاح اللجنة #6): حدّ معدل + ترويسة سر مشترك لما السر
  // مضبوط. من غير ضبط السر بيشتغل السلوك القديم مع تحذير سجل مرة.
  if (isCallback) {
    if (req.method !== "POST") return json({ ok: true });
    if (!limiter.allow("callback", ip)) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }
    const secret = (deps.callbackSecret || "").trim();
    if (secret) {
      if (req.headers.get("x-sheerid-callback-secret") !== secret) {
        deps.logError?.(
          "sheerid.callback",
          "callback rejected: missing/wrong secret header",
        );
        return json({ ok: false, error: "unauthorized" }, 401);
      }
    } else if (!_callbackSecretWarned) {
      _callbackSecretWarned = true;
      deps.logError?.(
        "sheerid.callback",
        "SHEERID_CALLBACK_SECRET not configured — callback stays " +
          "unauthenticated (legacy behavior); set it + the provider " +
          "webhook header to enforce",
      );
    }
    try {
      const payload = await req.json().catch(() => null);
      const jobId = extractJobId(payload);
      if (jobId) {
        await deps.service.refresh(jobId).catch((e) =>
          deps.logError?.("sheerid.callback", "refresh failed", e)
        );
      }
    } catch (e) {
      deps.logError?.("sheerid.callback", "unhandled callback error", e);
    }
    return json({ ok: true });
  }

  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  // المسح الدوري: حماية الأدمن زي /exec/ بالظبط.
  if (isSweep) {
    if (!deps.isAuthorized(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    try {
      const counts = await deps.service.sweep();
      return json({ ok: true, ...counts });
    } catch (e) {
      deps.logError?.("sheerid.sweep", "unhandled sweep error", e);
      return json({ ok: false, error: (e as Error)?.name || "exception" }, 500);
    }
  }

  // حدّ معدل مسارات العميل (إصلاح اللجنة #6) — قبل أي شغل قاعدة.
  if (!limiter.allow(isStatus ? "status" : "submit", ip)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  // مسارات العميل: إثبات الملكية = رقم الطلب + حساب المُرسل (نفس
  // إثبات get_invoice حرفيًا) — أي عدم تطابق = «مش موجود» من غير تفاصيل.
  const body = (await req.json().catch(() => ({}))) as {
    order_ref?: unknown;
    sender_account?: unknown;
    url?: unknown;
  };
  const orderRef = String(body.order_ref || "").trim();
  const sender = String(body.sender_account || "").trim();
  if (!orderRef || !sender) {
    return json({ ok: false, error: "order_ref_and_sender_required" }, 400);
  }
  const order = await deps.orders.getOrder(orderRef).catch(() => null);
  if (!order || String(order.sender_account || "").trim() !== sender) {
    return json({ ok: true, found: false });
  }

  const stateBody = (state: CustomerState) => ({
    ok: true,
    found: true,
    has_student: true,
    enabled: deps.service.enabled(),
    state: state.state,
    message: state.message,
    ...(state.activation_url
      ? { activation_url: state.activation_url }
      : {}),
  });

  try {
    if (isStatus) {
      const state = await deps.service.stateForOrder(order);
      if (!state) return json({ ok: true, found: true, has_student: false });
      return json(stateBody(state));
    }
    // isSubmit
    if (!deps.service.enabled()) {
      const state = await deps.service.stateForOrder(order);
      if (!state) return json({ ok: true, found: true, has_student: false });
      return json(stateBody(state));
    }
    const rawUrl = String(body.url || "");
    const extracted = findVerifyUrl(rawUrl) || rawUrl;
    try {
      const state = await deps.service.submit(order, extracted);
      return json(stateBody(state));
    } catch (e) {
      if (e instanceof SheerIDError && e.customerSafe) {
        // النص الوحيد اللي بيعدّي للعميل هو نصنا الثابت (رفض الرابط).
        return json({
          ok: true,
          found: true,
          has_student: true,
          enabled: true,
          state: "invalid_link",
          message: e.message,
        });
      }
      if (e instanceof SheerIDError) {
        // أي خطأ مورد/نقل تاني (إصلاح اللجنة #5): تفاصيله الخام
        // بتروح للسجل بس (detail)، والعميل بياخد صياغة عامة ثابتة
        // من غير اسم مورد ولا رصيد ولا معرّفات عمليات.
        deps.logError?.("sheerid.submit", "provider error sanitized", e, {
          order_ref: orderRef,
          detail: e.detail,
        });
        return json({
          ok: true,
          found: true,
          has_student: true,
          enabled: true,
          state: "manual_fallback",
          message: texts.manualFallbackText(),
        });
      }
      throw e;
    }
  } catch (e) {
    deps.logError?.("sheerid.route", "unhandled sheerid route error", e, {
      order_ref: orderRef,
    });
    return json({ ok: false, error: (e as Error)?.name || "exception" }, 500);
  }
}
