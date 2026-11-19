/**
 * منفّذ الشراء التلقائي للموقع (الحزمة 6) — نفس سلسلة القسم 2.1:
 *
 *   طلب مؤكد الدفع → مورد السجل → فحص محفظة → فحص مخزون حي → هامش
 *   → شراء عبر API المورد → تسليم أبيض → تحقق في قاعدة البيانات
 *
 * قواعد مفروضة هنا ومرآتها في محرك البوت (الحزم 1–5):
 * - إيدمبوتنسي: تنفيذ واحد لكل (طلب، SKU) بقيد فريد؛ إعادة النداء
 *   بترجع التنفيذ القائم — لا خصم مزدوج ولا شراء مزدوج (درس MR!64).
 * - نقطة اللاعودة هي لحظة إرسال POST الشراء: قبلها بنعلّم التنفيذ
 *   `processing/submit_in_flight`، فأي انقطاع بعدها = manual_review
 *   من غير إعادة شراء ولا استرداد أعمى — أبدًا.
 * - الرفض النهائي المؤكد بس هو اللي بيحرّك الاسترداد، والاسترداد
 *   بيتم عبر مسار المتجر نفسه (خطاف refundOrder) وبيتأكد في القاعدة.
 * - التسوية غير المتزامنة بنمط SheerID (MR!65/67/68): فحص +20s و+40s
 *   وبعده كنس كل 20s لحد 20 دقيقة، وبعدها تصعيد صريح للأدمن — والتسليم
 *   اللي اتبعت ما يتبعتش تاني، واللي ما اتبعتش بيُعاد لحد 24 ساعة.
 * - أي فشل: حالة آمنة معلنة + رسالة عميل عامة بصياغتنا + تنبيه أدمن
 *   + سطر في سجل الأخطاء المركزي. مفيش فشل صامت ومفيش خطوة عميل
 *   بتستنى إنسان.
 */

import {
  AmbiguousOutcome,
  DefiniteRejection,
  type ExecutionRecord,
  type ExecutorDeps,
  GateBlocked,
  type ProvenanceRecord,
  type PurchaseOutcome,
  type SnapshotResult,
  type StoreOrder,
  type StoreOrderItem,
  type SupplierAdapter,
} from "./types.ts";
import { isEnabled } from "./flags.ts";
import { customerSafeDelivery, sanitizeText } from "./sanitize.ts";

/** الحد الأدنى بالجنيه = التكلفة × 55 × 1.5 = التكلفة × 82.5 (القسم 3.1). */
export const FLOOR_PER_USD = 82.5;
/** نافذة التسوية قبل التصعيد (القسم 7.3). */
export const SETTLEMENT_WINDOW_MS = 20 * 60_000;
/** أفق إعادة محاولات إشعار التسليم (ضمان التسليم MR!68). */
export const DELIVERY_RETRY_HORIZON_MS = 24 * 3600_000;

/**
 * قيم أسرار المحوّل لتنقية نصوص أخطائه قبل الحفظ/التسجيل: جسم خطأ
 * من المورد ممكن يردّد مفتاح الـ API، فالمفتاح ما يتلقّطش في
 * last_error ولا في سجل الأخطاء المركزي.
 */
function adapterSecrets(adapter: SupplierAdapter): string[] {
  try {
    return adapter.secretValues?.() ?? [];
  } catch {
    return [];
  }
}

export interface ItemResult {
  sku: string;
  product_key: string | null;
  execution: ExecutionRecord | null;
  skipped: string | null;
}

export class StoreExecutor {
  private deps: ExecutorDeps;
  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }
  private now(): Date {
    return this.deps.now();
  }
  private log(
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ): void {
    try {
      this.deps.logError(source, message, error, context);
    } catch {
      // سجل الأخطاء نفسه ممنوع يكسر أي مسار (قاعدة logError القائمة).
    }
  }
  private async alert(message: string, context?: Record<string, unknown>): Promise<void> {
    try {
      await this.deps.alertAdmin(message, context);
    } catch (e) {
      this.log("store_exec.alert", "admin alert failed", e, context);
    }
  }

  // ============================================================ الدخول
  /** تنفيذ طلب واحد مؤكد الدفع — بيرجع نتيجة لكل بند في الطلب. */
  async executeOrder(orderRef: string): Promise<ItemResult[]> {
    const order = await this.deps.store.getOrder(orderRef);
    if (!order) return [];
    const results: ItemResult[] = [];
    for (const item of order.items) {
      results.push(await this.executeItem(order, item));
    }
    return results;
  }

  /** دفعة الكنس: طلبات مؤكدة لسه من غير تنفيذ + متابعة المفتوح. */
  async runSweep(limit = 50): Promise<{
    executed: ItemResult[];
    polled: ExecutionRecord[];
    notified: number;
  }> {
    const executed: ItemResult[] = [];
    const orders = await this.deps.store.listConfirmedOrders(limit);
    for (const order of orders) {
      for (const item of order.items) {
        const existing = await this.deps.store.getExecutionByOrderSku(
          order.order_ref,
          item.sku,
        );
        if (!existing) executed.push(await this.executeItem(order, item));
      }
    }
    const polled: ExecutionRecord[] = [];
    const open = await this.deps.store.listOpenExecutions(limit);
    for (const ex of open) {
      const after = await this.pollExecution(ex.id);
      if (after) polled.push(after);
    }
    let notified = 0;
    const pending = await this.deps.store.listUnnotifiedDeliveries(limit);
    for (const ex of pending) {
      if (await this.retryDeliveryNotification(ex)) notified++;
    }
    return { executed, polled, notified };
  }

  // ====================================================== تنفيذ بند واحد
  async executeItem(order: StoreOrder, item: StoreOrderItem): Promise<ItemResult> {
    const { store, registry } = this.deps;
    // بوابات ما قبل الحجز: قافلة = البند برّه التنفيذ التلقائي دلوقتي
    // والطلب بيكمل يدوي زي النهاردة — من غير صف تنفيذ ومن غير لمس فلوس.
    if (!this.deps.flags.globalEnabled) {
      return { sku: item.sku, product_key: null, execution: null, skipped: "kill_switch_off" };
    }
    const snap = await registry.snapshot();
    if (!snap) {
      this.log("store_exec.registry", "provenance snapshot unavailable/stale", undefined, {
        order_ref: order.order_ref,
      });
      return { sku: item.sku, product_key: null, execution: null, skipped: "registry_unavailable" };
    }
    const record = snap.records.find((r) => r.store_sku === item.sku) ?? null;
    if (!record) {
      return { sku: item.sku, product_key: null, execution: null, skipped: "not_in_registry" };
    }
    if (!isEnabled(this.deps.flags, record.product_key)) {
      return { sku: item.sku, product_key: record.product_key, execution: null, skipped: "product_not_enabled" };
    }
    if (record.price_locked) {
      this.log("store_exec.gate", "price-locked product in confirmed order", undefined, {
        order_ref: order.order_ref,
        product_key: record.product_key,
      });
      return { sku: item.sku, product_key: record.product_key, execution: null, skipped: "price_locked" };
    }
    const adapter = this.deps.adapters.get(record.supplier_key);
    if (!adapter) {
      this.log("store_exec.registry", "no adapter for supplier of record", undefined, {
        order_ref: order.order_ref,
        supplier: record.supplier_key,
      });
      return { sku: item.sku, product_key: record.product_key, execution: null, skipped: "no_adapter" };
    }

    // الحجز الذرّي: تنفيذ واحد لكل (طلب، SKU) — إعادة النداء بترجع القائم.
    const reference = `store-${order.order_ref}-${record.product_key}`;
    const { execution, created } = await store.claimExecution({
      order_ref: order.order_ref,
      sku: item.sku,
      product_key: record.product_key,
      supplier_key: record.supplier_key,
      listing_ref: record.listing_ref,
      reference,
      sell_egp: item.price_egp,
      quantity: item.qty,
    });
    if (!created && execution.status !== "claimed" &&
      execution.status !== "awaiting_supplier_funds") {
      // تنفيذ قائم في حالة متقدمة: بنرجّعه زي ما هو — ممنوع تنفيذ تاني.
      return { sku: item.sku, product_key: record.product_key, execution, skipped: null };
    }
    const after = await this.attemptExecution(execution, record, order);
    return { sku: item.sku, product_key: record.product_key, execution: after, skipped: null };
  }

  /**
   * محاولة تنفيذ كاملة لتنفيذ محجوز: فحوصات حية → شراء → تصنيف.
   * بتتنداه من executeItem ومن الكنس لإعادة محاولة claimed/awaiting.
   */
  async attemptExecution(
    execution: ExecutionRecord,
    record: ProvenanceRecord,
    order: StoreOrder,
  ): Promise<ExecutionRecord> {
    const { store } = this.deps;
    const adapter = this.deps.adapters.get(record.supplier_key);
    if (!adapter) return execution;
    let ex = execution;
    try {
      // --- فحص التوفر من التغذية (حقيقة مخزون الحزمة 3) — Fail-Closed.
      const orderable = await this.deps.availability.isOrderable(record.product_key);
      if (!orderable) {
        ex = await store.updateExecution(ex.id, {
          last_error: "out_of_stock_or_feed_closed",
        });
        return ex; // بيضل claimed — الكنس بيعيد المحاولة لما المخزون يرجع
      }
      // --- لقطة حية من المورد: مخزون + تكلفة لحظة التنفيذ.
      // فشل القراءة هنا قبل أي إرسال: وقف آمن قابل لإعادة المحاولة —
      // مش manual_review (مفيش شراء حصل أصلًا) ومش فشل (مفيش رفض).
      let snap: SnapshotResult;
      try {
        snap = await adapter.getSnapshot(record.listing_ref);
      } catch (e) {
        this.log("store_exec.snapshot", "supplier snapshot unreadable — stays claimed", e, {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
        });
        ex = await store.updateExecution(ex.id, {
          last_error: "snapshot_unreadable",
        });
        return ex;
      }
      if (snap.available === false || (snap.stock != null && snap.stock < ex.quantity)) {
        ex = await store.updateExecution(ex.id, { last_error: "supplier_out_of_stock" });
        return ex;
      }
      const liveCost = snap.cost_usd ?? record.cost_usd;
      // --- حارس الهامش عند التنفيذ (3.1 نقطة 3): على التكلفة الحية.
      if (!record.margin_exception) {
        const floor = liveCost * FLOOR_PER_USD;
        if (ex.sell_egp + 1e-9 < floor) {
          ex = await store.updateExecution(ex.id, {
            cost_usd: liveCost,
            last_error: "margin_blocked",
          });
          this.log("store_exec.margin", "execution blocked: sell below live floor", undefined, {
            order_ref: ex.order_ref,
            product_key: ex.product_key,
            sell_egp: ex.sell_egp,
            floor_egp: floor,
          });
          await this.alert("منتج سعره تحت حد هامشه بالتكلفة الحية — التنفيذ واقف لحد قرار", {
            order_ref: ex.order_ref,
            product_key: ex.product_key,
          });
          return ex;
        }
      }
      // --- فحص كفاية محفظة المورد (2.3): ناقص/مش مقروء = وقف آمن معلن.
      let balance: number | null = null;
      try {
        balance = (await adapter.getBalance()).balance_usd;
      } catch {
        balance = null;
      }
      if (balance == null || balance < liveCost * ex.quantity) {
        // الانتقال لـ awaiting بيتم بـ CAS من claimed بس: اللي قلب
        // الحالة هو اللي بيبلّغ — مفيش إشعار عميل مكرر من منفّذَين.
        const flipped = await store.transitionExecution(ex.id, ["claimed"], {
          status: "awaiting_supplier_funds",
          cost_usd: liveCost,
          last_error: balance == null ? "supplier_balance_unreadable" : "supplier_balance_insufficient",
        });
        if (flipped) {
          ex = flipped;
          await this.notify({
            kind: "awaiting_funds",
            order_ref: ex.order_ref,
            product_key: ex.product_key,
          });
          await this.alert("محفظة مورد مش كافية/مش مقروءة — طلب واقف بانتظار التمويل", {
            order_ref: ex.order_ref,
            product_key: ex.product_key,
            supplier: ex.supplier_key,
          });
        } else {
          ex = (await store.getExecution(ex.id)) ?? ex;
        }
        return ex;
      }
      // --- نقطة اللاعودة: حق الإرسال بيتحسم بـ CAS قبل الـ POST —
      // منفّذ واحد بس بيعدّي، وأي انقطاع بعده = غامض (manual_review).
      const claimedSend = await store.transitionExecution(
        ex.id,
        ["claimed", "awaiting_supplier_funds"],
        {
          status: "processing",
          cost_usd: liveCost,
          last_error: "submit_in_flight",
          first_poll_at: ex.first_poll_at ?? this.now().toISOString(),
        },
      );
      if (!claimedSend) {
        return (await store.getExecution(ex.id)) ?? ex;
      }
      ex = claimedSend;
      const outcome = await adapter.submitPurchase({
        listingRef: record.listing_ref,
        quantity: ex.quantity,
        reference: ex.reference,
        cost_usd: liveCost,
        // إيميل العميل من طلب المتجر نفسه: مصدر حقول إدخال المورد
        // (Wasmou) — غيابه مع منتج بيحتاج إدخال = رفض نهائي قبل الإرسال.
        customer_email: order.customer_email ?? null,
      });
      return await this.applyOutcome(ex, outcome, order);
    } catch (e) {
      if (e instanceof DefiniteRejection) {
        // رفض نهائي مؤكد (قبل الإرسال أو بكود نهائي): الطلب ما اتعملش.
        ex = await store.updateExecution(ex.id, {
          status: "failed",
          last_error: sanitizeText(e.message, { secrets: adapterSecrets(adapter) }).slice(0, 300),
        });
        this.log("store_exec.purchase", "definite supplier rejection", e, {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
        });
        return await this.refundPath(ex, "supplier_rejected");
      }
      if (e instanceof AmbiguousOutcome || e instanceof GateBlocked) {
        ex = await store.updateExecution(ex.id, {
          status: "manual_review",
          last_error: sanitizeText(e.message, { secrets: adapterSecrets(adapter) }).slice(0, 300),
        });
        this.log("store_exec.purchase", "ambiguous supplier outcome — manual review", e, {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
        });
        await this.alert("نتيجة شراء غامضة — مراجعة يدوية، ممنوع إعادة شراء أو استرداد", {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
        });
        return ex;
      }
      // خطأ غير متوقع بعد نقطة اللاعودة المحتملة = غامض بنفس القاعدة.
      ex = await store.updateExecution(ex.id, {
        status: ex.status === "processing" ? "manual_review" : ex.status,
        last_error: sanitizeText(String((e as Error)?.message ?? e), { secrets: adapterSecrets(adapter) }).slice(0, 300),
      });
      this.log("store_exec.purchase", "unexpected execution error", e, {
        order_ref: ex.order_ref,
        product_key: ex.product_key,
      });
      return ex;
    }
  }

  // ======================================================== تطبيق نتيجة
  private async applyOutcome(
    ex: ExecutionRecord,
    outcome: PurchaseOutcome,
    order: StoreOrder,
  ): Promise<ExecutionRecord> {
    const { store } = this.deps;
    if (outcome.kind === "delivered") {
      const { safe, dropped } = customerSafeDelivery(outcome.delivery);
      if (safe.length === 0) {
        // المورد قال اتسلّم بس مفيش بيانات نضيفة توصل العميل: ممنوع
        // نخترع تسليم وممنوع نسرّب — مراجعة يدوية معلنة.
        const updated = await store.updateExecution(ex.id, {
          status: "manual_review",
          external_ref: outcome.external_ref || ex.external_ref,
          last_error: dropped > 0 ? "delivery_blocked_leak_gate" : "delivered_without_items",
        });
        this.log("store_exec.delivery", "delivered without customer-safe items", undefined, {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
          dropped,
        });
        await this.alert("تسليم مورد من غير بيانات آمنة للعميل — مراجعة يدوية", {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
        });
        return updated;
      }
      let updated = await store.updateExecution(ex.id, {
        status: "delivered",
        external_ref: outcome.external_ref || ex.external_ref,
        delivery: safe,
        last_error: null,
      });
      updated = await this.notifyDelivery(updated);
      await this.maybeFulfillOrder(order);
      return updated;
    }
    if (outcome.kind === "failed" || outcome.kind === "canceled" ||
      outcome.kind === "refunded") {
      const updated = await store.updateExecution(ex.id, {
        status: "failed",
        external_ref: outcome.external_ref || ex.external_ref,
        last_error: `supplier_state_${outcome.kind}`,
      });
      return await this.refundPath(updated, `supplier_${outcome.kind}`);
    }
    // processing: بيضل تحت التسوية (+20s/+40s/كنس).
    return await store.updateExecution(ex.id, {
      status: "processing",
      external_ref: outcome.external_ref || ex.external_ref,
      last_error: null,
    });
  }

  // ============================================================ التسوية
  /** فحص تسوية واحد لتنفيذ مفتوح — بيتنداه من الكنس بنبضة 20 ثانية. */
  async pollExecution(executionId: string): Promise<ExecutionRecord | null> {
    const { store } = this.deps;
    let ex = await store.getExecution(executionId);
    if (!ex) return null;
    if (ex.status === "claimed" || ex.status === "awaiting_supplier_funds") {
      const current = ex;
      const order = await store.getOrder(current.order_ref);
      const snap = await this.deps.registry.snapshot();
      const record = snap?.records.find((r) => r.product_key === current.product_key);
      if (!order || !record) return ex;
      return await this.attemptExecution(ex, record, order);
    }
    if (
      ex.status !== "processing" && ex.status !== "manual_review" &&
      ex.status !== "escalated"
    ) {
      return ex;
    }
    if (!ex.external_ref) {
      // اتعلّم submit_in_flight ومفيش مرجع مورد: ممكن الـ POST يكون
      // وصل — ممنوع إعادة الشراء قطعًا؛ مراجعة يدوية صريحة.
      if (ex.status === "processing") {
        ex = await store.updateExecution(ex.id, {
          status: "manual_review",
          last_error: "submit_outcome_unknown_no_ref",
        });
        await this.alert("طلب اتبعت ونتيجته مش معروفة (مفيش مرجع) — مراجعة يدوية", {
          order_ref: ex.order_ref,
          product_key: ex.product_key,
        });
      }
      return ex;
    }
    const adapter = this.deps.adapters.get(ex.supplier_key);
    if (!adapter) return ex;
    const externalRef = ex.external_ref;
    const now = this.now();
    ex = await store.updateExecution(ex.id, {
      poll_count: ex.poll_count + 1,
      last_poll_at: now.toISOString(),
    });
    let outcome: PurchaseOutcome;
    try {
      outcome = await adapter.getPurchaseStatus(externalRef);
    } catch (e) {
      // فشل قراءة حالة مش نتيجة: بيضل مفتوح وبيتعاد — مش فشل ومش نجاح.
      this.log("store_exec.poll", "status read failed — stays open", e, {
        order_ref: ex.order_ref,
        product_key: ex.product_key,
      });
      return await this.maybeEscalate(ex);
    }
    const order = await store.getOrder(ex.order_ref);
    if (!order) return ex;
    if (outcome.kind === "processing") {
      return await this.maybeEscalate(ex);
    }
    // حسم متأخر (اتسلّم/فشل صريح) بيعدّي من نفس تطبيق النتيجة — بما
    // فيه manual_review اللي اتحسمت: التسليم المضمون بيوصّلها.
    const settled = await this.applyOutcome(ex, outcome, order);
    return settled;
  }

  private async maybeEscalate(ex: ExecutionRecord): Promise<ExecutionRecord> {
    const started = ex.first_poll_at ? Date.parse(ex.first_poll_at) : NaN;
    if (!started || this.now().getTime() - started <= SETTLEMENT_WINDOW_MS) {
      return ex;
    }
    if (ex.status === "escalated") return ex;
    const updated = await this.deps.store.updateExecution(ex.id, {
      status: "escalated",
      admin_alerted: true,
    });
    await this.notify({
      kind: "escalated",
      order_ref: ex.order_ref,
      product_key: ex.product_key,
    });
    await this.alert("طلب عدّى نافذة التسوية (20 دقيقة) من غير حسم — تصعيد", {
      order_ref: ex.order_ref,
      product_key: ex.product_key,
    });
    this.log("store_exec.poll", "settlement window exceeded — escalated", undefined, {
      order_ref: ex.order_ref,
      product_key: ex.product_key,
    });
    return updated;
  }

  // =========================================================== الاسترداد
  /** الاسترداد عبر مسار المتجر نفسه بس — وبيتأكد قبل ما يتقال «refunded». */
  private async refundPath(
    ex: ExecutionRecord,
    reason: string,
  ): Promise<ExecutionRecord> {
    const { store } = this.deps;
    if (!this.deps.refundOrder) {
      const updated = await store.updateExecution(ex.id, {
        refund_state: "unavailable",
        admin_alerted: true,
      });
      await this.alert("فشل تنفيذ نهائي ومفيش مسار استرداد مربوط — استرداد يدوي مطلوب", {
        order_ref: ex.order_ref,
        product_key: ex.product_key,
        reason,
      });
      this.log("store_exec.refund", "no refund path wired", undefined, {
        order_ref: ex.order_ref,
        product_key: ex.product_key,
      });
      return updated;
    }
    let ok = false;
    try {
      ok = await this.deps.refundOrder(ex.order_ref, reason);
    } catch (e) {
      this.log("store_exec.refund", "refund hook failed", e, {
        order_ref: ex.order_ref,
        product_key: ex.product_key,
      });
    }
    if (!ok) {
      const updated = await store.updateExecution(ex.id, {
        refund_state: "requested",
        admin_alerted: true,
      });
      await this.alert("طلب استرداد ما اتأكدش — متابعة يدوية مطلوبة", {
        order_ref: ex.order_ref,
        product_key: ex.product_key,
      });
      return updated;
    }
    const updated = await store.updateExecution(ex.id, {
      status: "refunded",
      refund_state: "confirmed",
    });
    await this.notify({
      kind: "failed_refunded",
      order_ref: ex.order_ref,
      product_key: ex.product_key,
    });
    return updated;
  }

  // ============================================================= الإشعار
  private async notify(event: {
    kind: "delivered" | "failed_refunded" | "delayed" | "awaiting_funds" | "escalated" | "admin_update";
    order_ref: string;
    product_key: string;
    delivery?: ExecutionRecord["delivery"];
    note?: string;
  }): Promise<boolean> {
    try {
      return await this.deps.notifyCustomer({
        kind: event.kind,
        order_ref: event.order_ref,
        product_key: event.product_key,
        delivery: event.delivery ?? undefined,
        note: event.note,
      });
    } catch (e) {
      this.log("store_exec.notify", "customer notify failed", e, {
        order_ref: event.order_ref,
        kind: event.kind,
      });
      return false;
    }
  }

  /** إشعار التسليم: ما بيتحسبش مبعوت غير بتأكيد القناة (MR!68). */
  private async notifyDelivery(ex: ExecutionRecord): Promise<ExecutionRecord> {
    if (ex.delivery_notified_at || !ex.delivery) return ex;
    const ok = await this.notify({
      kind: "delivered",
      order_ref: ex.order_ref,
      product_key: ex.product_key,
      delivery: ex.delivery,
    });
    return await this.deps.store.updateExecution(ex.id, {
      delivery_attempts: ex.delivery_attempts + 1,
      delivery_last_attempt_at: this.now().toISOString(),
      delivery_notified_at: ok ? this.now().toISOString() : null,
    });
  }

  /** إعادة إشعار تسليم من الكنس: 3 محاولات متباعدة ثم كل 10 دقائق لحد 24 ساعة. */
  async retryDeliveryNotification(ex: ExecutionRecord): Promise<boolean> {
    if (ex.status !== "delivered" || ex.delivery_notified_at) return false;
    const deliveredAt = Date.parse(ex.updated_at);
    if (deliveredAt && this.now().getTime() - deliveredAt > DELIVERY_RETRY_HORIZON_MS) {
      return false;
    }
    const last = ex.delivery_last_attempt_at
      ? Date.parse(ex.delivery_last_attempt_at)
      : 0;
    const backoff = ex.delivery_attempts <= 1
      ? 0
      : ex.delivery_attempts === 2
      ? 60_000
      : ex.delivery_attempts === 3
      ? 300_000
      : 600_000;
    if (last && this.now().getTime() - last < backoff) return false;
    const after = await this.notifyDelivery(ex);
    return Boolean(after.delivery_notified_at);
  }

  /** الطلب بيبقى fulfilled بس لما كل بنوده (المغطاة وغيرها) اتسلّمت فعليًا. */
  private async maybeFulfillOrder(order: StoreOrder): Promise<void> {
    const { store } = this.deps;
    for (const item of order.items) {
      const ex = await store.getExecutionByOrderSku(order.order_ref, item.sku);
      if (!ex || ex.status !== "delivered") return;
    }
    await store.setOrderStatus(order.order_ref, "fulfilled");
  }

  // ================================================ مسار الأدمن (MR!66)
  /**
   * نظير الموقع لدرس MR!66: تحديث أدمن (حالة/نص عادي) لازم يوصل العميل
   * فعلًا عبر نفس السلسلة — ممنوع أي Discard صامت. النص بيتنقّى قبل
   * ما يعدّي، والإشعار لو فشل بيتسجّل وبيرجع false للأدمن.
   */
  async forwardAdminUpdate(
    orderRef: string,
    newStatus: string,
    note?: string,
  ): Promise<{ forwarded: boolean }> {
    const { store } = this.deps;
    const order = await store.getOrder(orderRef);
    if (!order) return { forwarded: false };
    await store.setOrderStatus(orderRef, newStatus, note);
    const cleanNote = note ? sanitizeText(note).slice(0, 500) : undefined;
    const ex = (await store.listExecutions(200)).find(
      (e) => e.order_ref === orderRef,
    );
    const ok = await this.notify({
      kind: "admin_update",
      order_ref: orderRef,
      product_key: ex?.product_key ?? "",
      note: cleanNote,
    });
    if (!ok) {
      this.log("store_exec.admin", "admin update NOT forwarded to customer", undefined, {
        order_ref: orderRef,
        new_status: newStatus,
      });
    }
    return { forwarded: ok };
  }
}
