/**
 * طبقة قاعدة المتجر للمنفّذ.
 *
 * تنفيذان لنفس العقد:
 * - `MemoryStoreDb`: ذاكرة بشكل Staging الحقيقي (أعمدة orders اللي
 *   اتحققت من مشروع lbbzsfwfgesizufatwwc) — للاختبارات والتدريبات.
 *   القيد الفريد (order_ref, sku) مفروض فيها زي قاعدة البيانات.
 * - `PostgrestStoreDb`: تنفيذ الإنتاج ضد PostgREST (orders +
 *   store_executions من هجرة 007) — بيتركب وقت بوابة المالك بس.
 *
 * قاعدة الفلوس (7.2): الطبقة دي ما بتعملش أي حركة فلوس — الاسترداد
 * بيتم عبر خطاف refundOrder المحقون من مسارات المتجر نفسه.
 */

import type {
  ExecutionRecord,
  StoreDb,
  StoreOrder,
} from "./types.ts";
import type { RefundRpcResult } from "./refund.ts";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ============================================================ Memory (Staging-shaped)
export interface RefundRow {
  order_ref: string;
  reason: string;
  at: string;
}

/** صف التزام استرداد — مرآة جدول store_refunds في هجرة 008 بالحرف. */
export interface RefundObligation {
  id: string;
  order_ref: string;
  execution_id: string;
  amount_egp: number;
  payment_method: string | null;
  sender_account: string | null;
  reason: string;
  idempotency_key: string;
  state: "obligation_recorded" | "paid_back" | "cancelled";
  created_at: string;
}

export class MemoryStoreDb implements StoreDb {
  orders = new Map<string, StoreOrder>();
  executions = new Map<string, ExecutionRecord>();
  /** سجل استردادات مكتوب عبر خطاف المتجر — لتدقيق الفلوس في التدريبات. */
  refunds: RefundRow[] = [];
  /** صفوف التزام الاسترداد — مرآة store_refunds (هجرة 008) للتدقيق. */
  refundObligations: RefundObligation[] = [];
  private refundSeq = 0;
  private seq = 0;
  private nowFn: () => Date;
  constructor(nowFn: () => Date = () => new Date()) {
    this.nowFn = nowFn;
  }
  private nowIso(): string {
    return this.nowFn().toISOString();
  }
  addOrder(order: StoreOrder): void {
    this.orders.set(order.order_ref, clone(order));
  }
  async getOrder(orderRef: string): Promise<StoreOrder | null> {
    const o = this.orders.get(orderRef);
    return o ? clone(o) : null;
  }
  async listConfirmedOrders(limit: number): Promise<StoreOrder[]> {
    return [...this.orders.values()]
      .filter((o) => o.status === "paid")
      .slice(0, limit)
      .map(clone);
  }
  async claimExecution(input: {
    order_ref: string;
    sku: string;
    product_key: string;
    supplier_key: string;
    listing_ref: string;
    reference: string;
    sell_egp: number;
    quantity: number;
  }): Promise<{ execution: ExecutionRecord; created: boolean }> {
    for (const ex of this.executions.values()) {
      if (ex.order_ref === input.order_ref && ex.sku === input.sku) {
        return { execution: clone(ex), created: false };
      }
    }
    const now = this.nowIso();
    const ex: ExecutionRecord = {
      id: `exec-${++this.seq}`,
      order_ref: input.order_ref,
      sku: input.sku,
      product_key: input.product_key,
      supplier_key: input.supplier_key,
      listing_ref: input.listing_ref,
      reference: input.reference,
      status: "claimed",
      cost_usd: null,
      sell_egp: input.sell_egp,
      quantity: input.quantity,
      external_ref: null,
      delivery: null,
      delivery_notified_at: null,
      delivery_attempts: 0,
      delivery_last_attempt_at: null,
      poll_count: 0,
      first_poll_at: null,
      last_poll_at: null,
      refund_state: "none",
      admin_alerted: false,
      last_error: null,
      skip_reason: null,
      created_at: now,
      updated_at: now,
    };
    this.executions.set(ex.id, ex);
    return { execution: clone(ex), created: true };
  }
  async getExecution(id: string): Promise<ExecutionRecord | null> {
    const ex = this.executions.get(id);
    return ex ? clone(ex) : null;
  }
  async getExecutionByOrderSku(
    orderRef: string,
    sku: string,
  ): Promise<ExecutionRecord | null> {
    for (const ex of this.executions.values()) {
      if (ex.order_ref === orderRef && ex.sku === sku) return clone(ex);
    }
    return null;
  }
  async listOpenExecutions(limit: number): Promise<ExecutionRecord[]> {
    const open = new Set([
      "claimed", "awaiting_supplier_funds", "processing", "manual_review", "escalated",
    ]);
    return [...this.executions.values()]
      .filter((e) => open.has(e.status))
      .slice(0, limit)
      .map(clone);
  }
  async listUnnotifiedDeliveries(limit: number): Promise<ExecutionRecord[]> {
    return [...this.executions.values()]
      .filter((e) => e.status === "delivered" && !e.delivery_notified_at)
      .slice(0, limit)
      .map(clone);
  }
  async updateExecution(
    id: string,
    patch: Partial<ExecutionRecord>,
  ): Promise<ExecutionRecord> {
    const ex = this.executions.get(id);
    if (!ex) throw new Error(`execution not found: ${id}`);
    Object.assign(ex, clone(patch), { updated_at: this.nowIso() });
    return clone(ex);
  }
  async transitionExecution(
    id: string,
    from: ExecutionRecord["status"][],
    patch: Partial<ExecutionRecord>,
  ): Promise<ExecutionRecord | null> {
    const ex = this.executions.get(id);
    if (!ex || !from.includes(ex.status)) return null;
    Object.assign(ex, clone(patch), { updated_at: this.nowIso() });
    return clone(ex);
  }
  async setOrderStatus(
    orderRef: string,
    status: string,
    _note?: string,
  ): Promise<void> {
    const o = this.orders.get(orderRef);
    if (o) o.status = status;
  }
  async listExecutions(limit: number): Promise<ExecutionRecord[]> {
    return [...this.executions.values()].slice(0, limit).map(clone);
  }

  /**
   * مرآة RPC ‏`refund_order` (هجرة 008) بنفس آلة الحالات حرفيًا —
   * عشان الاختبارات والتدريبات تدرّب نفس المنطق اللي هيشتغل على
   * Staging/الإنتاج، مش نسخة مخففة منه:
   * failed → refunded + صف التزام (إيدمبوتنسي بمفتاح refund:<exec>)،
   * رفض صريح على الحالات الغلط، وإعادة النداء بترجع already_refunded.
   */
  async callRefundOrder(
    orderRef: string,
    reason: string,
    paymentMethod: string | null,
  ): Promise<RefundRpcResult> {
    const order = this.orders.get(orderRef);
    if (!order) return { ok: false, error: "order_not_found" };
    let created = 0;
    for (const ex of this.executions.values()) {
      if (ex.order_ref !== orderRef || ex.status !== "failed") continue;
      const key = `refund:${ex.id}`;
      if (!this.refundObligations.some((o) => o.execution_id === ex.id)) {
        this.refundObligations.push({
          id: `refund-${++this.refundSeq}`,
          order_ref: orderRef,
          execution_id: ex.id,
          amount_egp: ex.sell_egp * ex.quantity,
          payment_method: paymentMethod,
          sender_account: order.sender_account ?? null,
          reason,
          idempotency_key: key,
          state: "obligation_recorded",
          created_at: this.nowIso(),
        });
      }
      ex.status = "refunded";
      ex.refund_state = "confirmed";
      ex.updated_at = this.nowIso();
      created++;
    }
    const total = this.refundObligations.filter(
      (o) => o.order_ref === orderRef,
    ).length;
    if (created === 0) {
      if (total > 0) {
        return { ok: true, already_refunded: true, obligations: total };
      }
      return { ok: false, error: "no_failed_execution" };
    }
    const execs = [...this.executions.values()].filter(
      (e) => e.order_ref === orderRef,
    );
    if (execs.length > 0 && execs.every((e) => e.status === "refunded")) {
      order.status = "refunded";
    }
    return { ok: true, already_refunded: false, obligations: total };
  }
}

// ============================================================ PostgREST (Production)
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
  triggerStatus?: string; // حالة تأكيد الدفع (افتراضي paid)
}

function rowToOrder(row: Record<string, unknown>): StoreOrder {
  const items = Array.isArray(row["items"]) ? row["items"] : [];
  return {
    order_ref: String(row["order_ref"] ?? ""),
    status: String(row["status"] ?? ""),
    customer_email: (row["customer_email"] as string) ?? null,
    sender_account: (row["sender_account"] as string) ?? null,
    payment_method: (row["payment_method"] as string) ??
      (row["payment"] as string) ?? null,
    items: items.map((it) => {
      const r = it as Record<string, unknown>;
      return {
        sku: String(r["sku"] ?? r["name"] ?? ""),
        qty: Number(r["qty"] ?? r["quantity"] ?? 1),
        price_egp: Number(r["price"] ?? r["price_egp"] ?? 0),
      };
    }),
    server_total_egp: Number(row["server_total"] ?? 0),
    idempotency_key: (row["idempotency_key"] as string) ?? null,
  };
}

function rowToExecution(row: Record<string, unknown>): ExecutionRecord {
  return {
    ...(row as unknown as ExecutionRecord),
    sell_egp: Number(row["sell_egp"] ?? 0),
    quantity: Number(row["quantity"] ?? 1),
    delivery_attempts: Number(row["delivery_attempts"] ?? 0),
    poll_count: Number(row["poll_count"] ?? 0),
  };
}

export class PostgrestStoreDb implements StoreDb {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }
  private async req(
    method: string,
    path: string,
    body?: unknown,
    prefer?: string,
  ): Promise<{ status: number; json: unknown }> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        "apikey": this.opts.keyOf(),
        "Authorization": `Bearer ${this.opts.keyOf()}`,
        "Content-Type": "application/json",
        ...(prefer ? { "Prefer": prefer } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json };
  }
  async getOrder(orderRef: string): Promise<StoreOrder | null> {
    const { json } = await this.req(
      "GET",
      `orders?order_ref=eq.${encodeURIComponent(orderRef)}&select=*`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? rowToOrder(rows[0] as Record<string, unknown>) : null;
  }
  async listConfirmedOrders(limit: number): Promise<StoreOrder[]> {
    const trigger = this.opts.triggerStatus || "paid";
    const { json } = await this.req(
      "GET",
      `orders?status=eq.${encodeURIComponent(trigger)}&select=*&order=created_at.asc&limit=${limit}`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.map((r) => rowToOrder(r as Record<string, unknown>));
  }
  async claimExecution(input: {
    order_ref: string;
    sku: string;
    product_key: string;
    supplier_key: string;
    listing_ref: string;
    reference: string;
    sell_egp: number;
    quantity: number;
  }): Promise<{ execution: ExecutionRecord; created: boolean }> {
    const { status, json } = await this.req(
      "POST",
      "store_executions",
      { ...input, status: "claimed" },
      "return=representation",
    );
    if (status >= 200 && status < 300) {
      const rows = Array.isArray(json) ? json : [json];
      return {
        execution: rowToExecution(rows[0] as Record<string, unknown>),
        created: true,
      };
    }
    // 409 = القيد الفريد: تنفيذ قائم لنفس الطلب+SKU — بيرجع هو نفسه.
    const existing = await this.getExecutionByOrderSku(input.order_ref, input.sku);
    if (existing) return { execution: existing, created: false };
    throw new Error(`claimExecution failed with status ${status}`);
  }
  async getExecution(id: string): Promise<ExecutionRecord | null> {
    const { json } = await this.req(
      "GET",
      `store_executions?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? rowToExecution(rows[0] as Record<string, unknown>) : null;
  }
  async getExecutionByOrderSku(
    orderRef: string,
    sku: string,
  ): Promise<ExecutionRecord | null> {
    const { json } = await this.req(
      "GET",
      `store_executions?order_ref=eq.${encodeURIComponent(orderRef)}&sku=eq.${
        encodeURIComponent(sku)
      }&select=*`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? rowToExecution(rows[0] as Record<string, unknown>) : null;
  }
  async listOpenExecutions(limit: number): Promise<ExecutionRecord[]> {
    const { json } = await this.req(
      "GET",
      `store_executions?status=in.(claimed,awaiting_supplier_funds,processing,manual_review,escalated)&select=*&order=created_at.asc&limit=${limit}`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.map((r) => rowToExecution(r as Record<string, unknown>));
  }
  async listUnnotifiedDeliveries(limit: number): Promise<ExecutionRecord[]> {
    const { json } = await this.req(
      "GET",
      `store_executions?status=eq.delivered&delivery_notified_at=is.null&select=*&order=created_at.asc&limit=${limit}`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.map((r) => rowToExecution(r as Record<string, unknown>));
  }
  async updateExecution(
    id: string,
    patch: Partial<ExecutionRecord>,
  ): Promise<ExecutionRecord> {
    const { status, json } = await this.req(
      "PATCH",
      `store_executions?id=eq.${encodeURIComponent(id)}`,
      patch,
      "return=representation",
    );
    if (status < 200 || status >= 300) {
      throw new Error(`updateExecution failed with status ${status}`);
    }
    const rows = Array.isArray(json) ? json : [json];
    return rowToExecution(rows[0] as Record<string, unknown>);
  }
  async transitionExecution(
    id: string,
    from: ExecutionRecord["status"][],
    patch: Partial<ExecutionRecord>,
  ): Promise<ExecutionRecord | null> {
    const list = from.map((s) => encodeURIComponent(s)).join(",");
    const { status, json } = await this.req(
      "PATCH",
      `store_executions?id=eq.${encodeURIComponent(id)}&status=in.(${list})`,
      patch,
      "return=representation",
    );
    if (status < 200 || status >= 300) {
      throw new Error(`transitionExecution failed with status ${status}`);
    }
    const rows = Array.isArray(json) ? json : [];
    return rows.length
      ? rowToExecution(rows[0] as Record<string, unknown>)
      : null;
  }
  async setOrderStatus(
    orderRef: string,
    status: string,
  ): Promise<void> {
    // إصلاح W5 #4: حالة HTTP كانت بتتبلع — كتابة فاشلة كانت بتعدّي
    // كأنها نجحت (fulfilled وهمي + تحديث أدمن «ناجح» ما حصلش). نفس
    // انضباط updateExecution/transitionExecution: غير 2xx = رمي.
    const { status: httpStatus } = await this.req(
      "PATCH",
      `orders?order_ref=eq.${encodeURIComponent(orderRef)}`,
      { status },
      "return=minimal",
    );
    if (httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`setOrderStatus failed with status ${httpStatus}`);
    }
  }
  async listExecutions(limit: number): Promise<ExecutionRecord[]> {
    const { json } = await this.req(
      "GET",
      `store_executions?select=*&order=created_at.desc&limit=${limit}`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.map((r) => rowToExecution(r as Record<string, unknown>));
  }
}
