/**
 * تخزين عمليات تحقق SheerID على الموقع + منفذ الطلبات/الاسترداد.
 *
 * - `SheeridJob` هو مرآة صف `sheerid_jobs` في قاعدة المتجر (هجرة 018)
 *   بنفس حقول جدول البوت، مع `order_ref` بدل معرّف طلب البوت.
 * - `MemorySheeridRepository`: للاختبارات والتدريبات — نفس سلوك
 *   PostgREST في البحث والتحديث.
 * - `PostgrestSheeridRepository`: تنفيذ الإنتاج بمفتاح الخدمة.
 * - منفذ الطلبات (`OrderPort`): قراءة الطلب وتحديث حالته + الاسترداد
 *   عند الفشل بآليات المتجر نفسها حرفيًا — تنفيذ فاشل على
 *   `store_executions` ثم RPC ‏`refund_order` (هجرة 008 + فرع المحفظة
 *   في 010): طلب المحفظة بيُسترد لمحفظة العميل فورًا في نفس المعاملة،
 *   وأي وسيلة تانية بتولّد صف التزام استرداد دقيق للمالك. مفيش أي
 *   منطق استرداد جديد هنا.
 */

import type { StoreDb, StoreOrder } from "../store_executor/types.ts";
import type { RefundRpcResult } from "../store_executor/refund.ts";
import {
  MemoryStoreDb,
  PostgrestStoreDb,
} from "../store_executor/store_db.ts";
import { PostgrestRefundClient } from "../store_executor/refund.ts";
import { STUDENT_PRODUCT_KEY, STUDENT_SKU, STUDENT_SUPPLIER_KEY, TABLE_JOBS } from "./config.ts";

export interface SheeridJob {
  id: string;
  order_ref: string;
  customer_email: string | null;
  sheerid_url: string;
  /** معرّف العملية عند المورد — داخلي بس، ممنوع يظهر لأي عميل. */
  job_id: string;
  status: string;
  activation_url: string;
  charged_usd: number;
  /** الأتمتة وقعت للمسار اليدوي للطلب ده (العميل يقدر يعيد الإرسال). */
  manual_fallback: boolean;
  delivery_attempts: number;
  delivered_at: string | null;
  last_delivery_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SheeridRepository {
  createJob(input: {
    order_ref: string;
    customer_email: string | null;
    status: string;
  }): Promise<SheeridJob>;
  findForOrder(orderRef: string): Promise<SheeridJob | null>;
  getJob(id: string): Promise<SheeridJob | null>;
  getByProviderJobId(jobId: string): Promise<SheeridJob | null>;
  updateJob(id: string, patch: Partial<SheeridJob>): Promise<SheeridJob>;
  listInflight(
    statuses: readonly string[],
    createdAfterIso: string,
    createdBeforeIso: string,
  ): Promise<SheeridJob[]>;
  listUndelivered(createdAfterIso: string): Promise<SheeridJob[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ============================================================ Memory
export class MemorySheeridRepository implements SheeridRepository {
  jobs = new Map<string, SheeridJob>();
  private seq = 0;
  private nowFn: () => Date;
  constructor(nowFn: () => Date = () => new Date()) {
    this.nowFn = nowFn;
  }
  private now(): string {
    return this.nowFn().toISOString();
  }
  createJob(input: {
    order_ref: string;
    customer_email: string | null;
    status: string;
  }): Promise<SheeridJob> {
    const now = this.now();
    const job: SheeridJob = {
      id: `job-${++this.seq}`,
      order_ref: input.order_ref,
      customer_email: input.customer_email,
      sheerid_url: "",
      job_id: "",
      status: input.status,
      activation_url: "",
      charged_usd: 0,
      manual_fallback: false,
      delivery_attempts: 0,
      delivered_at: null,
      last_delivery_attempt_at: null,
      created_at: now,
      updated_at: now,
    };
    this.jobs.set(job.id, job);
    return Promise.resolve(clone(job));
  }
  findForOrder(orderRef: string): Promise<SheeridJob | null> {
    for (const j of this.jobs.values()) {
      if (j.order_ref === orderRef) return Promise.resolve(clone(j));
    }
    return Promise.resolve(null);
  }
  getJob(id: string): Promise<SheeridJob | null> {
    const j = this.jobs.get(id);
    return Promise.resolve(j ? clone(j) : null);
  }
  getByProviderJobId(jobId: string): Promise<SheeridJob | null> {
    if (!jobId) return Promise.resolve(null);
    for (const j of this.jobs.values()) {
      if (j.job_id === jobId) return Promise.resolve(clone(j));
    }
    return Promise.resolve(null);
  }
  updateJob(id: string, patch: Partial<SheeridJob>): Promise<SheeridJob> {
    const j = this.jobs.get(id);
    if (!j) throw new Error(`sheerid job not found: ${id}`);
    Object.assign(j, clone(patch), { updated_at: this.now() });
    return Promise.resolve(clone(j));
  }
  listInflight(
    statuses: readonly string[],
    createdAfterIso: string,
    createdBeforeIso: string,
  ): Promise<SheeridJob[]> {
    return Promise.resolve(
      [...this.jobs.values()]
        .filter((j) =>
          statuses.includes(j.status) &&
          j.created_at >= createdAfterIso && j.created_at <= createdBeforeIso
        )
        .map(clone),
    );
  }
  listUndelivered(createdAfterIso: string): Promise<SheeridJob[]> {
    return Promise.resolve(
      [...this.jobs.values()]
        .filter((j) =>
          j.status === "completed" && !j.delivered_at &&
          j.created_at >= createdAfterIso
        )
        .map(clone),
    );
  }
}

// ============================================================ PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

function rowToJob(row: Record<string, unknown>): SheeridJob {
  return {
    id: String(row["id"] ?? ""),
    order_ref: String(row["order_ref"] ?? ""),
    customer_email: (row["customer_email"] as string) ?? null,
    sheerid_url: String(row["sheerid_url"] ?? ""),
    job_id: String(row["job_id"] ?? ""),
    status: String(row["status"] ?? ""),
    activation_url: String(row["activation_url"] ?? ""),
    charged_usd: Number(row["charged_usd"] ?? 0),
    manual_fallback: row["manual_fallback"] === true,
    delivery_attempts: Number(row["delivery_attempts"] ?? 0),
    delivered_at: (row["delivered_at"] as string) ?? null,
    last_delivery_attempt_at: (row["last_delivery_attempt_at"] as string) ??
      null,
    created_at: String(row["created_at"] ?? ""),
    updated_at: String(row["updated_at"] ?? ""),
  };
}

export class PostgrestSheeridRepository implements SheeridRepository {
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
  async createJob(input: {
    order_ref: string;
    customer_email: string | null;
    status: string;
  }): Promise<SheeridJob> {
    const { status, json } = await this.req(
      "POST",
      TABLE_JOBS,
      { ...input },
      "return=representation",
    );
    if (status >= 200 && status < 300) {
      const rows = Array.isArray(json) ? json : [json];
      return rowToJob(rows[0] as Record<string, unknown>);
    }
    // 409 = القيد الفريد على order_ref: عملية قائمة للطلب — بترجع هي.
    const existing = await this.findForOrder(input.order_ref);
    if (existing) return existing;
    throw new Error(`createJob failed with status ${status}`);
  }
  async findForOrder(orderRef: string): Promise<SheeridJob | null> {
    const { json } = await this.req(
      "GET",
      `${TABLE_JOBS}?order_ref=eq.${encodeURIComponent(orderRef)}&select=*`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? rowToJob(rows[0] as Record<string, unknown>) : null;
  }
  async getJob(id: string): Promise<SheeridJob | null> {
    const { json } = await this.req(
      "GET",
      `${TABLE_JOBS}?id=eq.${encodeURIComponent(id)}&select=*`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? rowToJob(rows[0] as Record<string, unknown>) : null;
  }
  async getByProviderJobId(jobId: string): Promise<SheeridJob | null> {
    if (!jobId) return null;
    const { json } = await this.req(
      "GET",
      `${TABLE_JOBS}?job_id=eq.${encodeURIComponent(jobId)}&select=*`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? rowToJob(rows[0] as Record<string, unknown>) : null;
  }
  async updateJob(
    id: string,
    patch: Partial<SheeridJob>,
  ): Promise<SheeridJob> {
    const { status, json } = await this.req(
      "PATCH",
      `${TABLE_JOBS}?id=eq.${encodeURIComponent(id)}`,
      { ...patch, updated_at: nowIso() },
      "return=representation",
    );
    if (status < 200 || status >= 300) {
      throw new Error(`updateJob failed with status ${status}`);
    }
    const rows = Array.isArray(json) ? json : [json];
    return rowToJob(rows[0] as Record<string, unknown>);
  }
  async listInflight(
    statuses: readonly string[],
    createdAfterIso: string,
    createdBeforeIso: string,
  ): Promise<SheeridJob[]> {
    const list = statuses.map((s) => encodeURIComponent(s)).join(",");
    const { json } = await this.req(
      "GET",
      `${TABLE_JOBS}?status=in.(${list})&created_at=gte.${
        encodeURIComponent(createdAfterIso)
      }&created_at=lte.${encodeURIComponent(createdBeforeIso)}&select=*&order=created_at.asc`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.map((r) => rowToJob(r as Record<string, unknown>));
  }
  async listUndelivered(createdAfterIso: string): Promise<SheeridJob[]> {
    const { json } = await this.req(
      "GET",
      `${TABLE_JOBS}?status=eq.completed&delivered_at=is.null&created_at=gte.${
        encodeURIComponent(createdAfterIso)
      }&select=*&order=created_at.asc`,
    );
    const rows = Array.isArray(json) ? json : [];
    return rows.map((r) => rowToJob(r as Record<string, unknown>));
  }
}

// ============================================================ منفذ الطلبات
export interface OrderPort {
  getOrder(orderRef: string): Promise<StoreOrder | null>;
  setOrderStatus(orderRef: string, status: string): Promise<void>;
  listConfirmedOrders(limit: number): Promise<StoreOrder[]>;
  /**
   * استرداد فشل التحقق بآليات المتجر: تنفيذ «failed» خاص بالتحقق على
   * store_executions ثم refund_order. بيرجع true لو الاسترداد اتأكد
   * في القاعدة (بما فيه إعادة النداء الإيدمبوتنت).
   */
  refundOnFailure(order: StoreOrder, reason: string): Promise<boolean>;
}

/** بند Google Student في طلب، أو null. */
export function studentItemOf(order: StoreOrder | null) {
  if (!order) return null;
  return order.items.find((it) => it.sku === STUDENT_SKU) ?? null;
}

type RefundCaller = (
  orderRef: string,
  reason: string,
  paymentMethod: string | null,
) => Promise<RefundRpcResult>;

/**
 * منطق الاسترداد الواحد المشترك بين تنفيذ الإنتاج والذاكرة:
 * - تنفيذ قائم لنفس (طلب، SKU) بمفتاح مورد غير «sheerid» = مش بتاعنا —
 *   ممنوع لمسه (بيرجع false والخدمة بتنبّه الإدارة).
 * - غير كده: إنشاء/تحديث التنفيذ لحالة failed ثم نداء refund_order.
 */
export async function refundViaStoreMechanics(
  store: StoreDb,
  callRefund: RefundCaller,
  order: StoreOrder,
  reason: string,
): Promise<boolean> {
  const item = studentItemOf(order);
  if (!item) return false;
  let ex = await store.getExecutionByOrderSku(order.order_ref, STUDENT_SKU);
  if (!ex) {
    const claimed = await store.claimExecution({
      order_ref: order.order_ref,
      sku: STUDENT_SKU,
      product_key: STUDENT_PRODUCT_KEY,
      supplier_key: STUDENT_SUPPLIER_KEY,
      listing_ref: "",
      reference: "",
      sell_egp: item.price_egp,
      quantity: item.qty,
    });
    ex = claimed.execution;
  }
  if (ex.supplier_key !== STUDENT_SUPPLIER_KEY) return false;
  if (ex.status !== "failed" && ex.status !== "refunded") {
    await store.updateExecution(ex.id, { status: "failed" });
  }
  const result = await callRefund(
    order.order_ref,
    reason,
    order.payment_method ?? null,
  );
  return result.ok === true;
}

// ============================================================ تنفيذات المنفذ
/** منفذ الإنتاج: مخزن PostgREST + عميل refund_order الرسمي. */
export class StoreOrderPort implements OrderPort {
  private store: PostgrestStoreDb;
  private refundClient: PostgrestRefundClient;
  constructor(store: PostgrestStoreDb, refundClient: PostgrestRefundClient) {
    this.store = store;
    this.refundClient = refundClient;
  }
  getOrder(orderRef: string): Promise<StoreOrder | null> {
    return this.store.getOrder(orderRef);
  }
  setOrderStatus(orderRef: string, status: string): Promise<void> {
    return this.store.setOrderStatus(orderRef, status);
  }
  listConfirmedOrders(limit: number): Promise<StoreOrder[]> {
    return this.store.listConfirmedOrders(limit);
  }
  refundOnFailure(order: StoreOrder, reason: string): Promise<boolean> {
    return refundViaStoreMechanics(
      this.store,
      (r, rsn, pm) => this.refundClient.callRefundOrder(r, rsn, pm),
      order,
      reason,
    );
  }
}

/** منفذ الذاكرة للاختبارات والتدريبات (مرآة refund_order في MemoryStoreDb). */
export class MemoryOrderPort implements OrderPort {
  private store: MemoryStoreDb;
  constructor(store: MemoryStoreDb) {
    this.store = store;
  }
  getOrder(orderRef: string): Promise<StoreOrder | null> {
    return this.store.getOrder(orderRef);
  }
  setOrderStatus(orderRef: string, status: string): Promise<void> {
    return this.store.setOrderStatus(orderRef, status);
  }
  listConfirmedOrders(limit: number): Promise<StoreOrder[]> {
    return this.store.listConfirmedOrders(limit);
  }
  refundOnFailure(order: StoreOrder, reason: string): Promise<boolean> {
    return refundViaStoreMechanics(
      this.store,
      (r, rsn, pm) => this.store.callRefundOrder(r, rsn, pm),
      order,
      reason,
    );
  }
}
