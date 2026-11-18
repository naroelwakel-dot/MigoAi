/**
 * خدمة إشعار العميل (قرار المالك 2026-11-18: إشعار واتساب/إيميل).
 *
 * بتنفّذ عقد `notifyCustomer` القائم في المنفّذ (NotifyEvent → boolean)
 * بقناتين ورا تهيئة بيئة:
 *   - **إيميل عبر Brevo API** (المفتاح من `BREVO_API_KEY` بس): المرسل
 *     orders@migoai.shop باسم «Migo Ai»، والمستلم هو إيميل العميل
 *     المسجل على الطلب نفسه. طلب من غير إيميل = القناة بتتخطى بنضافة
 *     وبتتسجّل — ممنوع تأليف عنوان أبدًا.
 *   - **واتساب عبر Cloud API** (شكل Meta الموثّق): المنصة مش مهيأة
 *     عندنا لسه، فالقناة **مقفولة افتراضيًا** (`WHATSAPP_NOTIFY_ENABLED`)
 *     ومش بتتنفّذ في أي اختبار/تدريب إلا بنقل وهمي. التفعيل لاحقًا =
 *     متغيرات بيئة بس. ملحوظة إنتاج موثقة: رسائل النص الحر برّه نافذة
 *     خدمة الـ 24 ساعة بتترفض من Meta — الإنتاج الحقيقي بيحتاج قوالب
 *     (templates) معتمدة لنفس النصوص دي قبل تفعيل العلم.
 *
 * الأحداث اللي ليها إرسال عميل: delivered (التسليم جاهز — بنفس عناصر
 * التسليم المنقّاة اللي المنفّذ بوّبها أصلًا) و failed_refunded (فشل
 * نهائي + استرداد اتعالج) و admin_update (نص الأدمن المنقّى — درس
 * MR!66: لازم يوصل العميل فعلًا). باقي الأنواع (awaiting_funds /
 * escalated / delayed) سطحها في v1 هو حالة الطلب في القاعدة + تنبيه
 * الأدمن، فبيرجع true من غير إرسال.
 *
 * قواعد صارمة:
 *   - الإشعار **ممنوع يكسر تنفيذًا**: أي فشل قناة بيتسجّل بـ logError
 *     وبيتلخّص في القيمة الراجعة — مفيش استثناء بيعدّي برّه أبدًا.
 *   - القيمة الراجعة (عقد MR!68): true لو مفيش قناة قابلة للتطبيق
 *     (اتخطّت بنضافة — سطح الفاتورة/الحالة هو التأكيد) أو قناة واحدة
 *     على الأقل أكدت. false بس لو قناة قابلة للتطبيق حاولت وفشلت —
 *     المنفّذ بيعيد المحاولة وقتها بنفس ضمان التسليم.
 *   - علامة بيضاء: النصوص صياغتنا إحنا بس، وبتعدّي على findLeaks قبل
 *     أي إرسال — أي تسريب بيوقف الإرسال وبيتسجّل (بوابة مزدوجة فوق
 *     بوابة المنفّذ).
 */

import type {
  HttpTransport,
  NotifyEvent,
  StoreDb,
  StoreOrder,
} from "./types.ts";
import { findLeaks } from "./sanitize.ts";

export const NOTIFY_SENDER_EMAIL = "orders@migoai.shop";
export const NOTIFY_SENDER_NAME = "Migo Ai";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const GRAPH_BASE = "https://graph.facebook.com";

export interface WhatsAppConfig {
  enabled: boolean;
  token: string | null;
  phoneNumberId: string | null;
  apiVersion: string;
}

export interface NotifyConfig {
  brevoApiKey: string | null;
  whatsapp: WhatsAppConfig;
}

export function notifyConfigFromEnv(
  env: (name: string) => string | undefined,
): NotifyConfig {
  const get = (n: string) => (env(n) || "").trim();
  return {
    brevoApiKey: get("BREVO_API_KEY") || null,
    whatsapp: {
      enabled: get("WHATSAPP_NOTIFY_ENABLED") === "1",
      token: get("WHATSAPP_TOKEN") || null,
      phoneNumberId: get("WHATSAPP_PHONE_NUMBER_ID") || null,
      apiVersion: get("WHATSAPP_API_VERSION") || "v21.0",
    },
  };
}

type LogError = (
  source: string,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
) => void;

export interface NotifyDeps {
  store: StoreDb;
  config: NotifyConfig;
  http: HttpTransport;
  logError: LogError;
}

interface ComposedMessage {
  subject: string;
  text: string;
}

const SENDABLE_KINDS = new Set(["delivered", "failed_refunded", "admin_update"]);

function composeMessage(event: NotifyEvent): ComposedMessage | null {
  if (event.kind === "delivered") {
    const items = (event.delivery ?? [])
      .map((d) => `${d.label}: ${d.value}`)
      .join("\n");
    return {
      subject: "تم تنفيذ طلبك بنجاح — Migo Ai",
      text:
        `أهلًا بيك،\nطلبك رقم ${event.order_ref} اتنفذ بنجاح وبيانات التفعيل جاهزة:\n${items}\n\n` +
        "تقدر تشوف بيانات طلبك في أي وقت من صفحة الفاتورة على موقعنا.\nشكرًا لثقتك — فريق Migo Ai",
    };
  }
  if (event.kind === "failed_refunded") {
    return {
      subject: "تعذّر تنفيذ طلبك وتمت معالجة استرداد مبلغك — Migo Ai",
      text:
        `أهلًا بيك،\nللأسف تعذّر تنفيذ طلبك رقم ${event.order_ref}، وتمت معالجة استرداد كامل للمبلغ — ` +
        "هيرجع لك على نفس وسيلة الدفع اللي دفعت بيها.\n" +
        "لو احتجت أي مساعدة رد على الرسالة دي أو كلمنا من صفحة التواصل على موقعنا.\nفريق Migo Ai",
    };
  }
  if (event.kind === "admin_update") {
    return {
      subject: `تحديث على طلبك ${event.order_ref} — Migo Ai`,
      text: `أهلًا بيك،\n${event.note ?? ""}\n\nفريق Migo Ai`,
    };
  }
  return null;
}

/**
 * تطبيع رقم واتساب من حساب مرسل الطلب: أرقام بس، والمحلي المصري
 * (01xxxxxxxxx) بيتحوّل دولي (+20). أي شكل مش واضح = null (تخطّي نضيف).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^01\d{9}$/.test(digits)) digits = `20${digits.slice(1)}`;
  if (!/^\d{10,15}$/.test(digits)) return null;
  return digits;
}

export function createNotifyCustomer(
  deps: NotifyDeps,
): (event: NotifyEvent) => Promise<boolean> {
  const log: LogError = (source, message, error, context) => {
    try {
      deps.logError(source, message, error, context);
    } catch {
      // سجل الأخطاء نفسه ممنوع يكسر الإشعار (نفس قاعدة المنفّذ).
    }
  };

  async function sendEmail(
    to: string,
    msg: ComposedMessage,
  ): Promise<boolean> {
    const res = await deps.http.request("POST", BREVO_URL, {
      headers: {
        "api-key": deps.config.brevoApiKey as string,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: {
        sender: { email: NOTIFY_SENDER_EMAIL, name: NOTIFY_SENDER_NAME },
        to: [{ email: to }],
        subject: msg.subject,
        textContent: msg.text,
      },
    });
    if (res.error || res.status == null || res.status < 200 || res.status >= 300) {
      throw new Error(`brevo send failed: ${res.error ?? `http ${res.status}`}`);
    }
    return true;
  }

  async function sendWhatsApp(
    to: string,
    msg: ComposedMessage,
  ): Promise<boolean> {
    const wa = deps.config.whatsapp;
    const url = `${GRAPH_BASE}/${wa.apiVersion}/${wa.phoneNumberId}/messages`;
    const res = await deps.http.request("POST", url, {
      headers: {
        "Authorization": `Bearer ${wa.token}`,
        "Content-Type": "application/json",
      },
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: msg.text },
      },
    });
    if (res.error || res.status == null || res.status < 200 || res.status >= 300) {
      throw new Error(`whatsapp send failed: ${res.error ?? `http ${res.status}`}`);
    }
    return true;
  }

  return async (event: NotifyEvent): Promise<boolean> => {
    try {
      if (!SENDABLE_KINDS.has(event.kind)) return true; // سطح القاعدة بس
      const msg = composeMessage(event);
      if (!msg) return true;
      // بوابة التسريب على النص النهائي قبل أي إرسال (فوق بوابة المنفّذ).
      const leaks = findLeaks([{ label: "notify", value: msg.text }]);
      if (leaks.length > 0) {
        log("store_exec.notify", "outgoing notification blocked by leak gate", undefined, {
          order_ref: event.order_ref,
          kind: event.kind,
          leaks,
        });
        return true; // سطح الفاتورة/الحالة بيضل هو التأكيد — ممنوع إرسال ملوّث
      }
      let order: StoreOrder | null = null;
      try {
        order = await deps.store.getOrder(event.order_ref);
      } catch (e) {
        log("store_exec.notify", "order lookup for notification failed", e, {
          order_ref: event.order_ref,
        });
      }
      let applicable = 0;
      let succeeded = 0;

      // --- قناة الإيميل (Brevo)
      if (deps.config.brevoApiKey) {
        const email = order?.customer_email?.trim() || null;
        if (!email) {
          log("store_exec.notify", "email channel skipped: no customer email on order", undefined, {
            order_ref: event.order_ref,
            kind: event.kind,
          });
        } else {
          applicable++;
          try {
            if (await sendEmail(email, msg)) succeeded++;
          } catch (e) {
            log("store_exec.notify", "email send failed", e, {
              order_ref: event.order_ref,
              kind: event.kind,
            });
          }
        }
      }

      // --- قناة واتساب (مقفولة افتراضيًا — قرار تهيئة صريح بس بيفتحها)
      const wa = deps.config.whatsapp;
      if (wa.enabled && wa.token && wa.phoneNumberId) {
        const phone = normalizePhone(order?.sender_account);
        if (!phone) {
          log("store_exec.notify", "whatsapp channel skipped: no usable phone on order", undefined, {
            order_ref: event.order_ref,
            kind: event.kind,
          });
        } else {
          applicable++;
          try {
            if (await sendWhatsApp(phone, msg)) succeeded++;
          } catch (e) {
            log("store_exec.notify", "whatsapp send failed", e, {
              order_ref: event.order_ref,
              kind: event.kind,
            });
          }
        }
      }

      if (applicable === 0) return true; // تخطّي نضيف — مفيش قناة قابلة للتطبيق
      return succeeded > 0;
    } catch (e) {
      // الإشعار ممنوع يكسر أي تنفيذ — أي فشل غير متوقع بيتسجّل وبيتلخّص.
      log("store_exec.notify", "notification service failure (contained)", e, {
        order_ref: event.order_ref,
        kind: event.kind,
      });
      return false;
    }
  };
}
