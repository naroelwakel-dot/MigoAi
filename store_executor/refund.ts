/**
 * ربط الاسترداد التلقائي الكامل (قرار المالك 2026-11-18) — جهة العميل.
 *
 * المنفّذ بينده خطاف `refundOrder(order_ref, reason)` القائم من قبل
 * (ExecutorDeps) — الموديول ده هو تنفيذ الخطاف الرسمي:
 *   - `PostgrestRefundClient`: بينده RPC ‏`refund_order` من هجرة 008
 *     عبر PostgREST بمفتاح الخدمة. الـ RPC هو صاحب آلة الحالات كله
 *     (بوابة failed → refunded + صف التزام store_refunds + حالة الطلب).
 *   - `refundOrderHook`: بيقرأ الطلب (عشان وسيلة الدفع المسجلة عليه)،
 *     بينده العميل، وبيعرض النتيجة كـ boolean للمنفّذ: true = الاسترداد
 *     اتأكد في القاعدة (بما فيه إعادة النداء الإيدمبوتنت)، وأي حاجة
 *     تانية = المنفّذ بيعلّم refund_state=requested + تنبيه أدمن
 *     (سلوكه القائم — مفيش «refunded» بيتقال من غير تأكيد قاعدة).
 *
 * قاعدة الفلوس (7.2) زي ما هي: الموديول ده ما بيحوّلش فلوس ولا بينده
 * أي بوابة دفع (مفيش بوابة — دفع المتجر تحويل يدوي). التحويل النقدي
 * الراجع بينفّذه المالك من صف الالتزام الدقيق اللي الـ RPC كتبه.
 */

import type { StoreDb } from "./types.ts";

/** ناتج RPC الاسترداد كما هو في هجرة 008 — مرآة jsonb الراجع. */
export interface RefundRpcResult {
  ok: boolean;
  /** true لو النداء ده إعادة إيدمبوتنت لاسترداد تم قبل كده. */
  already_refunded?: boolean;
  /** عدد صفوف الالتزام للطلب بعد النداء. */
  obligations?: number;
  /** كود رفض صريح: order_not_found / no_failed_execution / rpc_http_NNN. */
  error?: string;
}

export interface RefundRpcClient {
  callRefundOrder(
    orderRef: string,
    reason: string,
    paymentMethod: string | null,
  ): Promise<RefundRpcResult>;
}

// ------------------------------------------------------------ PostgREST
interface RefundClientOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

export class PostgrestRefundClient implements RefundRpcClient {
  private opts: RefundClientOptions;
  constructor(opts: RefundClientOptions) {
    this.opts = opts;
  }
  async callRefundOrder(
    orderRef: string,
    reason: string,
    paymentMethod: string | null,
  ): Promise<RefundRpcResult> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/rpc/refund_order`, {
      method: "POST",
      headers: {
        "apikey": this.opts.keyOf(),
        "Authorization": `Bearer ${this.opts.keyOf()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_order_ref: orderRef,
        p_reason: reason,
        p_payment_method: paymentMethod,
      }),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: `rpc_http_${res.status}` };
    }
    const row = (json ?? {}) as Record<string, unknown>;
    return {
      ok: row["ok"] === true,
      already_refunded: row["already_refunded"] === true,
      obligations: typeof row["obligations"] === "number"
        ? (row["obligations"] as number)
        : undefined,
      error: typeof row["error"] === "string"
        ? (row["error"] as string)
        : undefined,
    };
  }
}

// ------------------------------------------------------------ الخطاف
/**
 * بيبني خطاف `refundOrder` للمنفّذ من مخزن + عميل RPC.
 * بيمرّر وسيلة الدفع من قراءة الطلب نفسها (null لو الطلب مش شايلها —
 * الـ RPC بيخزنها كما هي وممنوع تأليفها). أي استثناء من العميل بيتحول
 * لـ false: المنفّذ بيتعامل معاه بمسار «requested + تنبيه أدمن» الآمن.
 */
export function refundOrderHook(
  store: StoreDb,
  client: RefundRpcClient,
): (order_ref: string, reason: string) => Promise<boolean> {
  return async (orderRef: string, reason: string): Promise<boolean> => {
    try {
      const order = await store.getOrder(orderRef);
      const result = await client.callRefundOrder(
        orderRef,
        reason,
        order?.payment_method ?? null,
      );
      return result.ok === true;
    } catch {
      return false;
    }
  };
}
