/**
 * محوّلات الموردين (TypeScript) — مرايا محوّلات البوت (الحزم 1 و5).
 *
 * القواعد المنسوخة بالحرف من محوّلات Python المثبتة:
 * - تصنيف HTTP: ‏400/401/403/404 = رفض نهائي مؤكد (مفيش طلب اتعمل →
 *   استرداد آمن). أي حاجة تانية (408/409/425/429/5xx/شبكة/مهلة) =
 *   نتيجة غير معروفة → manual_review من غير استرداد ولا إعادة شراء.
 * - فحص الرصيد قبل أي POST شراء: رصيد ناقص أو قراءة فاشلة = الرفض
 *   نهائي مؤكد لأن مفيش حاجة اتبعتت أصلًا (beforeSubmit=true).
 * - التسليم مش بيتألّف: `delivered` بتتقال بس على عناصر تسليم فعلية
 *   أو حالة نهائية صريحة من المورد؛ موافقة المظروف لوحدها = processing.
 * - الأسرار بتوصل كدالة جلب (من البيئة في الإنتاج) — ما بتتخزنش في
 *   الكائن ولا في أي لوج، وبتتشال من أي نص راجع.
 */

import {
  AmbiguousOutcome,
  type BalanceResult,
  DefiniteRejection,
  type HttpResult,
  type HttpTransport,
  type PurchaseOutcome,
  type SnapshotResult,
  type SupplierAdapter,
} from "./types.ts";
import { deliveryFromRaw, extractDeliveryItems, sanitizeRaw } from "./sanitize.ts";

/** كودات الرفض النهائي المؤكد — نفس config.DEFINITE_REJECTION_STATUSES. */
export const DEFINITE_REJECTION_STATUSES = new Set([400, 401, 403, 404]);

/** خريطة حالات المورد لحالاتنا — نفس config.DEFAULT_STATUS_MAP. */
export const DEFAULT_STATUS_MAP: Record<string, string> = {
  new: "processing",
  created: "processing",
  pending: "processing",
  in_progress: "processing",
  processing: "processing",
  queued: "processing",
  completed: "delivered",
  complete: "delivered",
  done: "delivered",
  success: "delivered",
  delivered: "delivered",
  failed: "failed",
  error: "failed",
  rejected: "failed",
  canceled: "canceled",
  cancelled: "canceled",
  refunded: "refunded",
};

export function mapSupplierState(raw: unknown): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "";
  return DEFAULT_STATUS_MAP[key] ?? ([
    "awaiting_funds", "queued", "submitted", "processing", "delivered",
    "failed", "manual_review", "refunded", "canceled",
  ].includes(key) ? key : "processing");
}

/** نقل إنتاجي: fetch بمهلة — أي فشل شبكي بيرجع error مش بيترمي. */
export class FetchTransport implements HttpTransport {
  timeoutMs: number;
  constructor(timeoutMs = 15000) {
    this.timeoutMs = timeoutMs;
  }
  async request(
    method: string,
    url: string,
    opts: { headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<HttpResult> {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Accept": "application/json", ...(opts.headers ?? {}) },
        body: opts.body != null ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      return { status: res.status, json, text };
    } catch (e) {
      return { status: null, error: (e as Error)?.name || "network_error" };
    }
  }
}

function usd(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** تصنيف فشل نداء شراء: نهائي مؤكد أو غامض — القاعدة الموحّدة لكل المحوّلات. */
export function classifySubmitFailure(
  result: HttpResult,
  what: string,
): DefiniteRejection | AmbiguousOutcome {
  const message = `${what} (${result.status ?? result.error ?? "غير معروف"}): ${
    String(result.text ?? "").slice(0, 200)
  }`;
  if (result.status != null && DEFINITE_REJECTION_STATUSES.has(result.status)) {
    return new DefiniteRejection(message);
  }
  return new AmbiguousOutcome(message);
}

function outcomeFromPayload(
  payload: unknown,
  stateKeys: string[],
  secrets: string[],
): PurchaseOutcome {
  const merged: Record<string, unknown> = { ...asRecord(payload) };
  for (const nest of ["order", "data"]) {
    const inner = asRecord(merged[nest]);
    for (const [k, v] of Object.entries(inner)) {
      if (!(k in merged)) merged[k] = v;
    }
  }
  const itemTexts = extractDeliveryItems(merged);
  let status = "";
  for (const key of stateKeys) {
    const mapped = mapSupplierState(merged[key]);
    if (mapped) {
      status = mapped;
      break;
    }
  }
  if (!status) {
    const envelope = String(merged["status"] ?? "").trim().toLowerCase();
    if (envelope === "failed" || envelope === "error" || envelope === "rejected") {
      status = "failed";
    } else if (envelope === "canceled" || envelope === "cancelled") {
      status = "canceled";
    } else if (envelope === "refunded") {
      status = "refunded";
    } else if (itemTexts.length > 0) {
      status = "delivered";
    } else {
      status = "processing";
    }
  }
  const kind = (["delivered", "failed", "canceled", "refunded"].includes(status)
    ? status
    : "processing") as PurchaseOutcome["kind"];
  return {
    kind,
    external_ref: String(merged["order_id"] ?? merged["id"] ?? "").trim(),
    delivery: kind === "delivered" ? deliveryFromRaw(sanitizeRaw(merged, { secrets })) : [],
    raw: sanitizeRaw(payload, { secrets }),
  };
}

const STATE_KEYS = [
  "order_status", "state", "delivery_status", "fulfillment_status", "order_state",
];

abstract class BaseAdapter implements SupplierAdapter {
  key = "base";
  protected transport: HttpTransport;
  protected secretOf: () => string;
  protected constructor(transport: HttpTransport, secretOf: () => string) {
    this.transport = transport;
    this.secretOf = secretOf;
  }
  protected secrets(): string[] {
    try {
      const k = this.secretOf();
      return k && k.length >= 4 ? [k] : [];
    } catch {
      return [];
    }
  }
  protected apiKey(): string {
    const key = this.secretOf();
    if (!key) throw new DefiniteRejection("مفتاح المورد مش مضبوط في البيئة", true);
    return key;
  }
  abstract getBalance(): Promise<BalanceResult>;
  abstract getSnapshot(listingRef: string): Promise<SnapshotResult>;
  abstract submitPurchase(input: {
    listingRef: string;
    quantity: number;
    reference: string;
    cost_usd: number;
  }): Promise<PurchaseOutcome>;
  abstract getPurchaseStatus(externalRef: string): Promise<PurchaseOutcome>;
}

// ================================================================= Drayik
/** مرآة adapters/drayik.py: مفتاح من البيئة، رصيد قبل الشراء، custom_id مرجعنا. */
export class DrayikAdapter extends BaseAdapter {
  override key = "drayik";
  baseUrl: string;
  constructor(
    transport: HttpTransport,
    secretOf: () => string,
    baseUrl = "https://drayik.shop/api",
  ) {
    super(transport, secretOf);
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }
  private call(method: string, path: string, body?: unknown): Promise<HttpResult> {
    return this.transport.request(method, this.baseUrl + path, {
      headers: { "X-API-Key": this.apiKey(), "Content-Type": "application/json" },
      body,
    });
  }
  private balanceOf(payload: unknown): number | null {
    const root = asRecord(payload);
    const user = asRecord(root["user"]);
    for (const src of [user, root]) {
      for (const k of ["available_balance", "balance"]) {
        const v = num(src[k]);
        if (v != null) return v;
      }
    }
    return null;
  }
  override async getBalance(): Promise<BalanceResult> {
    const result = await this.call("GET", "/v1/me");
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome(
        `تعذّرت قراءة رصيد المورد (${result.status ?? result.error ?? "غير معروف"})`,
      );
    }
    const balance = this.balanceOf(result.json);
    if (balance == null) throw new AmbiguousOutcome("رد الرصيد مش مفهوم");
    return { balance_usd: usd(balance), currency: "USD" };
  }
  override async getSnapshot(listingRef: string): Promise<SnapshotResult> {
    const result = await this.call("GET", "/v1/products");
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة كتالوج المورد");
    }
    const items = asRecord(result.json)["products"];
    if (!Array.isArray(items)) throw new AmbiguousOutcome("رد الكتالوج مش مفهوم");
    for (const row of items) {
      const r = asRecord(row);
      if (String(r["service_id"] ?? "").trim() !== listingRef) continue;
      const stock = num(r["stock"]);
      return {
        cost_usd: num(r["price"]),
        stock: stock != null ? Math.trunc(stock) : null,
        available: null,
      };
    }
    throw new AmbiguousOutcome("المنتج مش موجود في كتالوج المورد دلوقتي");
  }
  /** فحص الرصيد قبل أي POST — فشله رفض نهائي مؤكد (مفيش حاجة اتبعتت). */
  private async checkSpendable(costUsd: number, quantity: number): Promise<void> {
    let balance: BalanceResult;
    try {
      balance = await this.getBalance();
    } catch {
      throw new DefiniteRejection("تعذّر التحقق من رصيد حساب المورد قبل الشراء", true);
    }
    if (balance.balance_usd < usd(costUsd * quantity)) {
      throw new DefiniteRejection("رصيد حساب المورد مش كافي لإتمام الشراء ده", true);
    }
  }
  override async submitPurchase(input: {
    listingRef: string;
    quantity: number;
    reference: string;
    cost_usd: number;
  }): Promise<PurchaseOutcome> {
    await this.checkSpendable(input.cost_usd, input.quantity);
    const result = await this.call("POST", "/v1/order", {
      service_id: input.listingRef,
      quantity: input.quantity,
      custom_id: input.reference,
    });
    if (result.error || result.status == null || result.status >= 300) {
      throw classifySubmitFailure(result, "إرسال طلب الشراء فشل");
    }
    return outcomeFromPayload(result.json, STATE_KEYS, this.secrets());
  }
  override async getPurchaseStatus(externalRef: string): Promise<PurchaseOutcome> {
    if (!externalRef) throw new AmbiguousOutcome("مفيش معرّف طلب عند المورد للمتابعة");
    const result = await this.call(
      "GET",
      "/v1/order/" + encodeURIComponent(externalRef),
    );
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome(
        `تعذّرت قراءة حالة الطلب (${result.status ?? result.error ?? "غير معروف"})`,
      );
    }
    return outcomeFromPayload(result.json, STATE_KEYS, this.secrets());
  }
}

// ================================================================== TunVN
const TUNVN_DEFINITE_HINTS = [
  "insufficient", "not enough", "balance", "out of stock",
  "not found", "invalid", "unavailable", "sold out",
];

/** مرآة adapters/tunvn.py: شراء /api/buy بعملة usdt ومتابعة من سجل الطلبات. */
export class TunVNAdapter extends BaseAdapter {
  override key = "tunvn";
  baseUrl: string;
  constructor(
    transport: HttpTransport,
    secretOf: () => string,
    baseUrl = "https://tunvnmmo.duckdns.org",
  ) {
    super(transport, secretOf);
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }
  private call(method: string, path: string, body?: unknown): Promise<HttpResult> {
    return this.transport.request(method, this.baseUrl + path, {
      headers: { "X-API-Key": this.apiKey(), "Content-Type": "application/json" },
      body,
    });
  }
  override async getBalance(): Promise<BalanceResult> {
    const result = await this.call("GET", "/api/balance");
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة رصيد المورد");
    }
    const root = asRecord(result.json);
    const data = asRecord(root["data"]);
    const usdt = num(data["usdt"] ?? data["balance_usdt"] ?? root["usdt"] ?? root["balance"]);
    if (usdt == null) throw new AmbiguousOutcome("تعذّرت قراءة رصيد USDT عند المورد");
    return { balance_usd: usd(usdt), currency: "USD" };
  }
  override async getSnapshot(listingRef: string): Promise<SnapshotResult> {
    const result = await this.call("GET", "/api/products");
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة كتالوج المورد");
    }
    const root = asRecord(result.json);
    const items = (Array.isArray(root["products"]) ? root["products"] : root["data"]) as unknown;
    if (!Array.isArray(items)) throw new AmbiguousOutcome("رد الكتالوج مش مفهوم");
    for (const row of items) {
      const r = asRecord(row);
      const id = String(r["id"] ?? r["product_id"] ?? "").trim();
      if (id !== listingRef) continue;
      const stock = num(r["stock"]);
      return {
        cost_usd: num(r["price_usdt"] ?? r["price"]),
        stock: stock != null ? Math.trunc(stock) : null,
        available: null,
      };
    }
    throw new AmbiguousOutcome("المنتج مش موجود في كتالوج المورد دلوقتي");
  }
  private async checkSpendable(costUsd: number, quantity: number): Promise<void> {
    let balance: BalanceResult;
    try {
      balance = await this.getBalance();
    } catch {
      throw new DefiniteRejection("تعذّر التحقق من رصيد حساب المورد قبل الشراء", true);
    }
    if (balance.balance_usd < usd(costUsd * quantity)) {
      throw new DefiniteRejection("رصيد حساب المورد مش كافي لإتمام الشراء ده", true);
    }
  }
  override async submitPurchase(input: {
    listingRef: string;
    quantity: number;
    reference: string;
    cost_usd: number;
  }): Promise<PurchaseOutcome> {
    if (input.quantity < 1 || input.quantity > 100) {
      throw new DefiniteRejection("كمية الطلب برّه حد المورد الموثّق (1–100)", true);
    }
    await this.checkSpendable(input.cost_usd, input.quantity);
    const result = await this.call("POST", "/api/buy", {
      product_id: input.listingRef,
      quantity: input.quantity,
      currency: "usdt",
    });
    if (result.error || result.status == null || result.status >= 300) {
      throw classifySubmitFailure(result, "إرسال طلب الشراء فشل");
    }
    const payload = asRecord(result.json);
    const envelope = String(payload["status"] ?? "").trim().toLowerCase();
    if (envelope === "error" || envelope === "failed" || payload["success"] === false) {
      const message = String(
        payload["message"] ?? payload["error"] ?? "فشل مش موصوف",
      ).slice(0, 200);
      const lowered = message.toLowerCase();
      if (TUNVN_DEFINITE_HINTS.some((h) => lowered.includes(h))) {
        throw new DefiniteRejection(`المورد رفض الطلب قبل التنفيذ: ${message}`);
      }
      throw new AmbiguousOutcome(`المورد رجّع فشل مش محسوم السبب: ${message}`);
    }
    return outcomeFromPayload(result.json, STATE_KEYS, this.secrets());
  }
  override async getPurchaseStatus(externalRef: string): Promise<PurchaseOutcome> {
    // مفيش مسار طلب مفرد موثّق: المتابعة بمطابقة سجل طلبات الحساب.
    const result = await this.call("GET", "/api/orders");
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة سجل طلبات المورد");
    }
    const root = asRecord(result.json);
    const items = (Array.isArray(root["orders"]) ? root["orders"] : root["data"]) as unknown;
    if (!Array.isArray(items)) throw new AmbiguousOutcome("رد سجل الطلبات مش مفهوم");
    for (const row of items) {
      const r = asRecord(row);
      const id = String(r["id"] ?? r["order_id"] ?? "").trim();
      if (id && id === externalRef) {
        return outcomeFromPayload(r, STATE_KEYS, this.secrets());
      }
    }
    throw new AmbiguousOutcome("الطلب مش موجود في سجل طلبات المورد لسه");
  }
}

// ================================================================= Wasmou
/**
 * مرآة adapters/wasmou.py: شراء ذرّي موثّق (فشل العملية = مفيش خصم)،
 * وتسليم بس على حالة نهائية أو مفتاح فعلي (has_key).
 * مفيش مسار رصيد في الـ API: الرصيد بييجي من قارئ خارجي محقون
 * (قارئ صفحة الحساب — الحزمة 5)؛ من غيره فحص الرصيد = غامض (وقف آمن).
 */
export class WasmouAdapter extends BaseAdapter {
  override key = "wasmou";
  baseUrl: string;
  private balanceReader: (() => Promise<BalanceResult>) | null;
  constructor(
    transport: HttpTransport,
    secretOf: () => string,
    opts: {
      baseUrl?: string;
      balanceReader?: () => Promise<BalanceResult>;
    } = {},
  ) {
    super(transport, secretOf);
    this.baseUrl = (opts.baseUrl ?? "https://api.wasmou.net").replace(/\/+$/, "");
    this.balanceReader = opts.balanceReader ?? null;
  }
  private call(method: string, path: string, body?: unknown): Promise<HttpResult> {
    return this.transport.request(method, this.baseUrl + path, {
      headers: { "X-API-Key": this.apiKey(), "Content-Type": "application/json" },
      body,
    });
  }
  override async getBalance(): Promise<BalanceResult> {
    if (!this.balanceReader) {
      throw new AmbiguousOutcome("لا مسار رصيد في API المورد — الفحص من صفحة الحساب");
    }
    return await this.balanceReader();
  }
  override async getSnapshot(listingRef: string): Promise<SnapshotResult> {
    const result = await this.call("GET", "/api/products");
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة كتالوج المورد");
    }
    const root = asRecord(result.json);
    const items = (Array.isArray(root["products"]) ? root["products"] : root["data"]) as unknown;
    if (!Array.isArray(items)) throw new AmbiguousOutcome("رد الكتالوج مش مفهوم");
    for (const row of items) {
      const r = asRecord(row);
      const variants = Array.isArray(r["variants"]) ? r["variants"] : [];
      for (const v of variants) {
        const vr = asRecord(v);
        if (String(vr["id"] ?? "").trim() !== listingRef) continue;
        return {
          cost_usd: num(vr["price"]),
          stock: null,
          available: vr["is_available"] === true,
        };
      }
      if (String(r["id"] ?? "").trim() === listingRef) {
        const anyAvailable = variants.some(
          (v) => asRecord(v)["is_available"] === true,
        );
        return { cost_usd: num(r["price"]), stock: null, available: anyAvailable };
      }
    }
    throw new AmbiguousOutcome("المنتج مش موجود في كتالوج المورد دلوقتي");
  }
  /** تحقق قبل الشراء من الكتالوج الحي: غياب/عدم توفر = رفض نهائي قبل أي إرسال. */
  private async verifyBeforePurchase(listingRef: string): Promise<void> {
    let snap: SnapshotResult;
    try {
      snap = await this.getSnapshot(listingRef);
    } catch (e) {
      if (e instanceof DefiniteRejection) throw e;
      throw new DefiniteRejection("تعذّر التحقق من توفر المنتج قبل الشراء", true);
    }
    if (snap.available === false) {
      throw new DefiniteRejection("المنتج مش متاح عند المورد دلوقتي", true);
    }
  }
  override async submitPurchase(input: {
    listingRef: string;
    quantity: number;
    reference: string;
    cost_usd: number;
  }): Promise<PurchaseOutcome> {
    if (input.quantity < 1 || input.quantity > 50) {
      throw new DefiniteRejection("كمية الطلب برّه حد المورد الموثّق (1–50)", true);
    }
    await this.verifyBeforePurchase(input.listingRef);
    const path = "/api/products/purchase/" + encodeURIComponent(input.listingRef);
    const result = await this.call("POST", path, { quantity: input.quantity });
    if (result.error || result.status == null || result.status >= 300) {
      throw classifySubmitFailure(result, "إرسال طلب الشراء فشل");
    }
    const payload = asRecord(result.json);
    const envelope = String(payload["status"] ?? "").trim().toLowerCase();
    if (envelope === "error" || envelope === "failed" || payload["success"] === false) {
      // ذرّية المورد الموثّقة: فشل العملية = مفيش خصم حصل → رفض نهائي آمن.
      const message = String(payload["message"] ?? payload["error"] ?? "فشل").slice(0, 200);
      throw new DefiniteRejection(`المورد رفض الطلب قبل التنفيذ: ${message}`);
    }
    return this.orderResult(payload);
  }
  override async getPurchaseStatus(externalRef: string): Promise<PurchaseOutcome> {
    if (!externalRef) throw new AmbiguousOutcome("مفيش معرّف طلب عند المورد للمتابعة");
    const result = await this.call(
      "GET",
      "/api/products/order/" + encodeURIComponent(externalRef),
    );
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة حالة الطلب");
    }
    return this.orderResult(asRecord(result.json));
  }
  private orderResult(payload: Record<string, unknown>): PurchaseOutcome {
    const outcome = outcomeFromPayload(payload, STATE_KEYS, this.secrets());
    // قاعدة Wasmou الموثّقة: حالة نهائية بس has_key لسه false = لسه ماشي.
    const merged = { ...payload, ...asRecord(payload["data"]) };
    if (
      outcome.kind !== "delivered" &&
      (merged["has_key"] === true || merged["key"])
    ) {
      const items = deliveryFromRaw(sanitizeRaw(merged, { secrets: this.secrets() }));
      if (items.length > 0) return { ...outcome, kind: "delivered", delivery: items };
    }
    if (outcome.kind === "delivered" && merged["has_key"] === false && outcome.delivery.length === 0) {
      return { ...outcome, kind: "processing" };
    }
    return outcome;
  }
}

// ==================================================== Generic HTTP (Bunny)
/**
 * المحوّل العام المضبوط بالتهيئة — مرآة adapters/generic_http.py اللي
 * Bunny شغال عليه في البوت: endpoints + response paths + field_map +
 * status_map من تهيئة المورد (الأجزاء غير السرية)، والمصادقة سر محقون.
 */
export interface GenericAdapterConfig {
  base_url: string;
  auth?: { style: "api_key_header" | "bearer" | "query_param" | "none"; name?: string };
  endpoints: {
    balance?: { method?: string; path: string };
    price?: { method?: string; path: string };
    purchase: { method?: string; path: string; body?: Record<string, unknown> };
    order_status: { method?: string; path: string };
  };
  response?: {
    balance?: string;
    cost?: string;
    stock?: string;
    status?: string;
    external_ref?: string;
  };
  status_map?: Record<string, string>;
  currency?: string;
}

function dig(data: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  let cur: unknown = data;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
}

function fillBody(
  body: Record<string, unknown> | undefined,
  values: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    out[k] = typeof v === "string" ? fill(v, values) : v;
  }
  return out;
}

export class GenericHttpAdapter extends BaseAdapter {
  override key = "generic";
  cfg: GenericAdapterConfig;
  constructor(
    transport: HttpTransport,
    secretOf: () => string,
    cfg: GenericAdapterConfig,
    key = "bunny",
  ) {
    super(transport, secretOf);
    this.cfg = cfg;
    this.key = key;
  }
  private call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<HttpResult> {
    const base = this.cfg.base_url.replace(/\/+$/, "");
    let url = path.startsWith("https://") ? path : base + path;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = this.cfg.auth ?? { style: "none" as const };
    if (auth.style === "api_key_header") {
      headers[auth.name || "X-API-Key"] = this.apiKey();
    } else if (auth.style === "bearer") {
      headers["Authorization"] = `Bearer ${this.apiKey()}`;
    } else if (auth.style === "query_param") {
      url += (url.includes("?") ? "&" : "?") +
        `${encodeURIComponent(auth.name || "api_key")}=${encodeURIComponent(this.apiKey())}`;
    }
    return this.transport.request(method, url, { headers, body });
  }
  override async getBalance(): Promise<BalanceResult> {
    const ep = this.cfg.endpoints.balance;
    if (!ep) throw new AmbiguousOutcome("مسار الرصيد مش مضبوط في تهيئة المورد");
    const result = await this.call(ep.method || "GET", ep.path);
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة رصيد المورد");
    }
    const value = num(dig(result.json, this.cfg.response?.balance || "balance"));
    if (value == null) throw new AmbiguousOutcome("رد الرصيد مش مفهوم");
    return { balance_usd: usd(value), currency: this.cfg.currency || "USD" };
  }
  override async getSnapshot(listingRef: string): Promise<SnapshotResult> {
    const ep = this.cfg.endpoints.price;
    if (!ep) return { cost_usd: null, stock: null, available: null };
    const path = fill(ep.path, { external_id: listingRef });
    const result = await this.call(ep.method || "GET", path);
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة لقطة المنتج");
    }
    const stock = num(dig(result.json, this.cfg.response?.stock || "stock"));
    return {
      cost_usd: num(dig(result.json, this.cfg.response?.cost || "price")),
      stock: stock != null ? Math.trunc(stock) : null,
      available: null,
    };
  }
  override async submitPurchase(input: {
    listingRef: string;
    quantity: number;
    reference: string;
    cost_usd: number;
  }): Promise<PurchaseOutcome> {
    const ep = this.cfg.endpoints.purchase;
    const values = {
      external_id: input.listingRef,
      quantity: String(input.quantity),
      reference: input.reference,
      idempotency_key: input.reference,
    };
    const result = await this.call(
      ep.method || "POST",
      fill(ep.path, values),
      fillBody(ep.body, values),
    );
    if (result.error || result.status == null || result.status >= 300) {
      throw classifySubmitFailure(result, "إرسال طلب الشراء فشل");
    }
    return this.orderResult(result.json);
  }
  override async getPurchaseStatus(externalRef: string): Promise<PurchaseOutcome> {
    const ep = this.cfg.endpoints.order_status;
    const result = await this.call(
      ep.method || "GET",
      fill(ep.path, { order_id: externalRef, external_ref: externalRef }),
    );
    if (result.error || result.status == null || result.status >= 300) {
      throw new AmbiguousOutcome("تعذّرت قراءة حالة الطلب");
    }
    return this.orderResult(result.json);
  }
  private orderResult(payload: unknown): PurchaseOutcome {
    const outcome = outcomeFromPayload(payload, STATE_KEYS, this.secrets());
    const rawStatus = dig(payload, this.cfg.response?.status || "status");
    const mapped = this.cfg.status_map?.[String(rawStatus ?? "").toLowerCase()] ??
      mapSupplierState(rawStatus);
    if (mapped && mapped !== outcome.kind) {
      const kind = (["delivered", "failed", "canceled", "refunded"].includes(mapped)
        ? mapped
        : "processing") as PurchaseOutcome["kind"];
      return { ...outcome, kind };
    }
    return outcome;
  }
}
