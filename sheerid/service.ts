/**
 * خدمة أتمتة تحقق SheerID على الموقع — منفذ TypeScript لمنطق البوت
 * (sheerid/service.py) بنفس الدورة والتسويات والضمانات:
 *
 * - طلب مدفوع فيه منتج Google Student → `expectLink` بتفتح عملية
 *   «مستنية الرابط» (واحدة بس لكل طلب، بنيويًا).
 * - العميل يبعت رابط التحقق من صفحة فاتورته → `submit`: تحقق صارم من
 *   الرابط، بوابة رصيد/توفّر عند المورد، إرسال، واستطلاع جوه الطلب
 *   بفحصين عند +20 و+40 ثانية.
 * - التسوية: نجاح = رابط التفعيل محفوظ على العملية وبيظهر للعميل في
 *   صفحة فاتورته (تسليم متتبَّع زي البوت) والطلب fulfilled لو كل بنوده
 *   هي منتج التحقق؛ فشل/استرداد من المورد = استرداد بآليات المتجر
 *   نفسها (تنفيذ failed + ‏refund_order: محفظة → رصيد المحفظة فورًا،
 *   غيرها → التزام استرداد مسجّل).
 * - أي عطل في الأتمتة بيحوّل الطلب لمسار يدوي بإشعار للإدارة — طلب
 *   مدفوع عمره ما يفضل متعلّق بصمت.
 * - حارس التكرار: عملية في حالة submitting/processing أو منتهية ما
 *   بتتبعتش للمورد تاني أبدًا — مفيش خصم مزدوج.
 *
 * تكييفات الويب الموثّقة: «تسليم» نتيجة النجاح على الويب = إيميل
 * العميل اتبعت (قناة الدفع) أو غياب قناة الإيميل أصلًا (ساعتها
 * صفحة الفاتورة هي التسليم) — وده اللي بيعلّم delivered_at وبيمنع
 * أي إعادة إرسال، بنفس فواصل إعادة المحاولة وحد الـ24 ساعة بتوع
 * البوت. مشاهدة العميل للنتيجة في صفحة فاتورته بتعرض له الرابط
 * لكنها ما بتعلّمش التسليم (إصلاح اللجنة #11: المشاهدة ≠ تسليم،
 * عشان إعادة محاولات الإيميل ما تقفش على مجرد فتح الصفحة).
 */

import {
  DELIVERY_GAP_FIRST_SECONDS,
  DELIVERY_GAP_SECOND_SECONDS,
  DELIVERY_GAP_STEADY_SECONDS,
  DELIVERY_MAX_AGE_HOURS,
  IN_FLIGHT_STATUSES,
  POLL_DELAYS_SECONDS,
  REFUND_RETRY_GAP_SECONDS,
  STATUS_AWAITING_LINK,
  STATUS_COMPLETED,
  STATUS_FAILED,
  STATUS_PROCESSING,
  STATUS_REFUND_PENDING,
  STATUS_REFUNDED,
  STATUS_SUBMITTING,
  STUDENT_SKU,
  SWEEP_MAX_AGE_MINUTES,
  SWEEP_MIN_AGE_SECONDS,
  SWEEP_STUCK_MAX_AGE_HOURS,
  TERMINAL_STATUSES,
  VERIFY_URL_HOST,
} from "./config.ts";
import { SheerIDError } from "./client.ts";
import type { SheerIDClient } from "./client.ts";
import type { OrderPort, SheeridJob, SheeridRepository } from "./repo.ts";
import { studentItemOf } from "./repo.ts";
import type { StoreOrder } from "../store_executor/types.ts";
import * as texts from "./texts.ts";

/**
 * الحالات اللي انتقال التسوية النهائي يقدر يبدأ منها — الانتقال نفسه
 * مشروط ذرّيًا بواحدة منها (إصلاح اللجنة #2)، فمتسابق واحد بس بيكسب
 * التسوية وبيبعت إيميلاتها وتنبيهاتها.
 */
const SETTLEABLE_STATUSES: readonly string[] = [
  STATUS_AWAITING_LINK, STATUS_SUBMITTING, STATUS_PROCESSING,
  STATUS_REFUND_PENDING,
];

const URL_RE = /https:\/\/services\.sheerid\.com\/verify\/[^\s<>"']+/;
const TRAILING = ").,;!؟?…";

export function findVerifyUrl(text: string): string {
  const m = URL_RE.exec(String(text || ""));
  if (!m) return "";
  let url = m[0];
  while (url && TRAILING.includes(url[url.length - 1])) url = url.slice(0, -1);
  return url;
}

/**
 * تحقق صارم: https + نطاق SheerID الرسمي + مسار /verify/ بس.
 * أي حاجة تانية بتترفض بـ SheerIDError نصه جاهز يتبعت للعميل زي ما هو.
 */
export function validateVerifyUrl(url: string): string {
  const value = String(url || "").trim();
  let parsed: URL | null = null;
  try {
    parsed = new URL(value);
  } catch {
    parsed = null;
  }
  if (
    !parsed || parsed.protocol !== "https:" ||
    parsed.host !== VERIFY_URL_HOST || !parsed.pathname.startsWith("/verify/")
  ) {
    // نصنا الثابت — آمن يظهر للعميل زي ما هو (customerSafe).
    throw new SheerIDError(texts.invalidLinkText(), { customerSafe: true });
  }
  return value;
}

export type EmailOutcome = "sent" | "unavailable" | "failed";

export interface SheeridDeps {
  repo: SheeridRepository;
  client: SheerIDClient;
  orders: OrderPort;
  /** إيميل العميل (Brevo) — "unavailable" = مفيش قناة (مفتاح/إيميل غايب). */
  sendEmail?: (input: {
    order: StoreOrder;
    kind: "completed" | "failed" | "fallback" | "refund_pending";
    job: SheeridJob;
  }) => Promise<EmailOutcome>;
  alertAdmin?: (text: string) => void;
  log?: (message: string, error?: unknown) => void;
  sleeper?: (seconds: number) => Promise<void>;
  now?: () => Date;
  webhookUrl?: string;
  /** حالات الطلب اللي تعني «الدفع مؤكد» (بتتظبط من نفس متغير المنفّذ). */
  paidStatuses?: readonly string[];
}

export interface CustomerState {
  state:
    | "disabled"
    | "awaiting_payment"
    | "awaiting_link"
    | "processing"
    | "completed"
    | "failed"
    | "manual_fallback"
    | "invalid_link";
  message: string;
  activation_url?: string;
}

export interface SweepCounts {
  checked: number;
  settled: number;
  still_processing: number;
  errors: number;
  delivery_retried: number;
  delivery_delivered: number;
  opened: number;
  refund_recovered: number;
  stuck: number;
}

function epoch(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t / 1000;
}

export class SheeridService {
  private deps: SheeridDeps;
  private log: (m: string, e?: unknown) => void;
  private sleeper: (s: number) => Promise<void>;
  private nowFn: () => Date;
  private paidStatuses: readonly string[];

  constructor(deps: SheeridDeps) {
    this.deps = deps;
    this.log = deps.log || (() => {});
    this.sleeper = deps.sleeper ||
      ((s) => new Promise((r) => setTimeout(r, s * 1000)));
    this.nowFn = deps.now || (() => new Date());
    this.paidStatuses = deps.paidStatuses ||
      ["payment_confirmed", "paid"];
  }

  enabled(): boolean {
    return !!this.deps.client && this.deps.client.hasKey;
  }

  private isPaid(order: StoreOrder): boolean {
    return this.paidStatuses.includes(order.status);
  }

  // ------------------------------------------------------------ التهيئة
  /**
   * تفتح عملية «مستنية الرابط» لطلب جديد، أو ترجّع المفتوحة له.
   * بوابة دفع صلبة (إصلاح اللجنة #1): عملية جديدة ما تتفتحش لطلب
   * غير مؤكد الدفع أبدًا — أي استدعاء من مسار عميل لطلب غير مدفوع
   * بيترفض هنا حتى لو نسي المستدعي يفحص.
   */
  async expectLink(order: StoreOrder): Promise<SheeridJob> {
    const existing = await this.deps.repo.findForOrder(order.order_ref);
    if (existing) return existing;
    if (!this.isPaid(order)) {
      throw new SheerIDError(texts.awaitingPaymentText(), {
        customerSafe: true,
      });
    }
    return this.deps.repo.createJob({
      order_ref: order.order_ref,
      customer_email: order.customer_email ?? null,
      status: STATUS_AWAITING_LINK,
    });
  }

  jobForOrder(orderRef: string): Promise<SheeridJob | null> {
    return this.deps.repo.findForOrder(orderRef);
  }

  // ------------------------------------------------------------ حالة العميل
  /**
   * الحالة الآمنة للعميل لطلب واحد (صفحة الفاتورة). بترجع null لو
   * الطلب مش فيه منتج التحقق أصلًا. مفيش أي حقل مورد بيرجع هنا.
   */
  async stateForOrder(order: StoreOrder): Promise<CustomerState | null> {
    if (!studentItemOf(order)) return null;
    if (!this.enabled()) {
      return { state: "disabled", message: texts.manualFallbackText() };
    }
    let job = await this.deps.repo.findForOrder(order.order_ref);
    if (!job) {
      if (!this.isPaid(order)) {
        return {
          state: "awaiting_payment",
          message: texts.awaitingPaymentText(),
        };
      }
      job = await this.expectLink(order);
    }
    return this.stateForJob(job);
  }

  private async stateForJob(job: SheeridJob): Promise<CustomerState> {
    switch (job.status) {
      case STATUS_COMPLETED: {
        // المشاهدة بتعرض الرابط بس — delivered_at مسؤولية مسار
        // التسليم المتتبَّع (deliverActivation) لوحده (لجنة #11).
        return {
          state: "completed",
          message: texts.completedText(job.activation_url),
          activation_url: job.activation_url || undefined,
        };
      }
      case STATUS_REFUND_PENDING:
        // الفشل حصل لكن الاسترداد لسه قيد المعالجة — صياغة صادقة
        // (إصلاح اللجنة #4): ممنوع ادعاء استرداد تم قبل تأكيده.
        return { state: "failed", message: texts.refundPendingText() };
      case STATUS_REFUNDED:
      case STATUS_FAILED:
        return { state: "failed", message: texts.failedText() };
      case STATUS_SUBMITTING:
      case STATUS_PROCESSING:
        if (job.manual_fallback) {
          // عملية عالقة اتعلّمت مسار يدوي (مسح الـ24 ساعة) — العميل
          // ما يفضلش شايف «لسه شغّال» للأبد.
          return {
            state: "manual_fallback",
            message: texts.manualFallbackText(),
          };
        }
        return { state: "processing", message: texts.stillProcessingText() };
      default:
        if (job.manual_fallback) {
          return {
            state: "manual_fallback",
            message: texts.manualFallbackText(),
          };
        }
        return { state: "awaiting_link", message: texts.guidanceText() };
    }
  }

  // ------------------------------------------------------------ الإرسال
  /**
   * يبعت رابط العميل للمورد ويستطلع لحد التسوية أو نفاد الميزانية.
   * خطأ التحقق من الرابط بس هو اللي بيترفع (نصه جاهز للعميل)؛ أي فشل
   * بعد كده بيتحوّل لمسار يدوي بإشعارات، مش استثناء.
   */
  async submit(order: StoreOrder, url: string): Promise<CustomerState> {
    const clean = validateVerifyUrl(url);
    if (!studentItemOf(order)) {
      throw new SheerIDError(texts.invalidLinkText(), { customerSafe: true });
    }
    // بوابة الدفع أولًا (إصلاح اللجنة #1 — حرج): طلب غير مؤكد الدفع
    // ما يستهلكش أي نداء مورد ولا يتفتح له عملية، مهما كان الإثبات
    // المقدَّم صحيح. الحالة «مستنية الدفع» وبس.
    if (!this.isPaid(order)) {
      return {
        state: "awaiting_payment",
        message: texts.awaitingPaymentText(),
      };
    }
    let job = await this.deps.repo.findForOrder(order.order_ref);
    if (!job) job = await this.expectLink(order);
    if (TERMINAL_STATUSES.includes(job.status)) {
      return this.stateForJob(job);
    }
    if (
      job.status === STATUS_SUBMITTING || job.status === STATUS_PROCESSING
    ) {
      // حارس التكرار: عملية جارية = مفيش إرسال تاني للمورد أبدًا.
      return { state: "processing", message: texts.stillProcessingText() };
    }

    const [ready, reason] = await this.providerReady();
    if (!ready) {
      await this.manualFallback(order, job, reason);
      return { state: "manual_fallback", message: texts.manualFallbackText() };
    }

    // حجز ذرّي (إصلاح اللجنة #2): الانتقال لـ submitting مشروط بأن
    // العملية لسه awaiting_link في القاعدة لحظة التحديث — متسابقين
    // على نفس الطلب واحد بس بيكسب الحجز وبيكلّم المورد، والخاسر
    // بيرجع بالحالة الحالية من غير أي نداء (مفيش خصم مزدوج).
    const claimed = await this.deps.repo.updateJobIf(job.id, {
      status: STATUS_SUBMITTING,
      sheerid_url: clean,
      manual_fallback: false,
    }, { statuses: [STATUS_AWAITING_LINK] });
    if (!claimed) {
      const current = (await this.deps.repo.getJob(job.id)) || job;
      return this.stateForJob(current);
    }
    job = claimed;
    let data: Record<string, unknown>;
    try {
      data = await this.deps.client.verify(
        clean,
        this.deps.webhookUrl || "",
      );
    } catch (e) {
      this.log("sheerid verify failed", e);
      const reset = await this.deps.repo.updateJobIf(job.id, {
        status: STATUS_AWAITING_LINK,
      }, { statuses: [STATUS_SUBMITTING] });
      if (reset) job = reset;
      await this.manualFallback(order, job, "تعذّر إرسال طلب التحقق للمورد");
      return { state: "manual_fallback", message: texts.manualFallbackText() };
    }

    const providerJobId = String(data["job_id"] || "");
    if (!providerJobId) {
      this.log("sheerid verify returned no job id", new Error(String(data).slice(0, 200)));
      const reset = await this.deps.repo.updateJobIf(job.id, {
        status: STATUS_AWAITING_LINK,
      }, { statuses: [STATUS_SUBMITTING] });
      if (reset) job = reset;
      await this.manualFallback(order, job, "المورد لم يرجّع معرّف عملية للتحقق");
      return { state: "manual_fallback", message: texts.manualFallbackText() };
    }

    const moved = await this.deps.repo.updateJobIf(job.id, {
      status: STATUS_PROCESSING,
      job_id: providerJobId,
      charged_usd: Number(data["charged_usd"] ?? job.charged_usd ?? 0) || 0,
    }, { statuses: [STATUS_SUBMITTING] });
    if (!moved) {
      // إحنا حاجزين العملية فده ما بيحصلش عمليًا — حماية بس: الحالة
      // اتغيّرت من ورانا، فبنرجع بالحالة الحالية من غير تسوية مكررة.
      const current = (await this.deps.repo.getJob(job.id)) || job;
      return this.stateForJob(current);
    }
    job = moved;
    const settled = await this.applyStatus(job, data);
    if (settled) return this.stateForJob(settled);
    return this.poll(job);
  }

  private async poll(job: SheeridJob): Promise<CustomerState> {
    for (const delay of POLL_DELAYS_SECONDS) {
      await this.sleeper(delay);
      let data: Record<string, unknown>;
      try {
        data = await this.deps.client.status(job.job_id);
      } catch (e) {
        // غلطة عابرة في سؤال واحد ما توقفش الاستطلاع كله.
        this.log("sheerid status poll failed", e);
        continue;
      }
      const settled = await this.applyStatus(job, data);
      if (settled) return this.stateForJob(settled);
    }
    return { state: "processing", message: texts.stillProcessingText() };
  }

  // ------------------------------------------------------------ التحديث
  /**
   * سؤال حالة واحد + تسوية (للإشعار الخارجي والمسح الدوري).
   * القرار دايمًا من سؤال الخدمة نفسها هنا، مش من جسم الإشعار.
   */
  async refresh(providerJobId: string): Promise<SheeridJob | null> {
    const job = await this.deps.repo.getByProviderJobId(
      String(providerJobId || ""),
    );
    if (!job) return null;
    if (TERMINAL_STATUSES.includes(job.status)) return job;
    if (!job.job_id || !this.enabled()) return job;
    let data: Record<string, unknown>;
    try {
      data = await this.deps.client.status(job.job_id);
    } catch (e) {
      this.log("sheerid refresh failed", e);
      return job;
    }
    const settled = await this.applyStatus(job, data);
    return settled ?? (await this.deps.repo.getJob(job.id)) ?? job;
  }

  // ------------------------------------------------------------ المسح الدوري
  /**
   * مراجعة دورية بنفس منطق البوت: تحديث العمليات الجارية (من عمر 40
   * ثانية لحد 20 دقيقة) + مرور تسليم النتائج المكتملة غير المؤكدة +
   * فتح عمليات لطلبات مدفوعة جديدة لسه من غير عملية.
   */
  async sweep(now?: Date): Promise<SweepCounts> {
    const counts: SweepCounts = {
      checked: 0, settled: 0, still_processing: 0, errors: 0,
      delivery_retried: 0, delivery_delivered: 0, opened: 0,
      refund_recovered: 0, stuck: 0,
    };
    const at = now || this.nowFn();
    // فتح عمليات لطلبات مدفوعة فيها المنتج ولسه من غير عملية.
    if (this.enabled()) {
      try {
        const orders = await this.deps.orders.listConfirmedOrders(50);
        for (const order of orders) {
          if (!studentItemOf(order) || !this.isPaid(order)) continue;
          const existing = await this.deps.repo.findForOrder(order.order_ref);
          if (!existing) {
            await this.expectLink(order);
            counts.opened++;
          }
        }
      } catch (e) {
        this.log("sheerid sweep open-scan failed", e);
        counts.errors++;
      }
    }
    let jobs: SheeridJob[] = [];
    try {
      jobs = await this.deps.repo.listInflight(
        IN_FLIGHT_STATUSES,
        new Date(at.getTime() - SWEEP_MAX_AGE_MINUTES * 60_000).toISOString(),
        new Date(at.getTime() - SWEEP_MIN_AGE_SECONDS * 1000).toISOString(),
      );
    } catch (e) {
      this.log("sheerid sweep list failed", e);
      counts.errors++;
    }
    for (const job of jobs) {
      if (!job.job_id) continue;
      counts.checked++;
      try {
        const updated = await this.refresh(job.job_id);
        if (!updated) counts.errors++;
        else if (TERMINAL_STATUSES.includes(updated.status)) counts.settled++;
        else counts.still_processing++;
      } catch (e) {
        this.log("sheerid sweep refresh failed", e);
        counts.errors++;
      }
    }
    // عمليات عالقة نهائيًا (إصلاح اللجنة #12): أي عملية جارية أقدم
    // من الحد الأقصى (24 ساعة) بتتعلّم manual_fallback + تنبيه
    // إدارة بدل ما تخرج من نافذة المسح وتتنسي للأبد.
    let stuckJobs: SheeridJob[] = [];
    try {
      stuckJobs = await this.deps.repo.listInflight(
        IN_FLIGHT_STATUSES,
        new Date(0).toISOString(),
        new Date(at.getTime() - SWEEP_STUCK_MAX_AGE_HOURS * 3600_000)
          .toISOString(),
      );
    } catch (e) {
      this.log("sheerid stuck list failed", e);
      counts.errors++;
    }
    for (const job of stuckJobs) {
      if (job.manual_fallback) continue; // متعلّمة أصلًا — من غير تنبيه مكرر
      try {
        const flagged = await this.deps.repo.updateJobIf(job.id, {
          manual_fallback: true,
        }, { statuses: IN_FLIGHT_STATUSES });
        if (flagged) {
          counts.stuck++;
          this.alertAdmin(texts.adminFallbackText(
            job.order_ref,
            "عملية تحقق عالقة من أكثر من 24 ساعة من غير تسوية — " +
              "اتعلّمت مسار يدوي وتحتاج متابعة",
          ));
        }
      } catch (e) {
        this.log("sheerid stuck flag failed", e);
        counts.errors++;
      }
    }
    // إعادة محاولة الاستردادات المعلّقة (إصلاح اللجنة #4): كل
    // refund_pending عدّى عليها فاصل إعادة المحاولة بتتحاول تاني.
    let pendings: SheeridJob[] = [];
    try {
      pendings = await this.deps.repo.listRefundPending();
    } catch (e) {
      this.log("sheerid refund-pending list failed", e);
      counts.errors++;
    }
    for (const job of pendings) {
      const updatedAt = epoch(job.updated_at);
      if (
        updatedAt !== null &&
        at.getTime() / 1000 - updatedAt < REFUND_RETRY_GAP_SECONDS
      ) {
        continue;
      }
      try {
        if (await this.retryRefund(job)) counts.refund_recovered++;
      } catch (e) {
        this.log("sheerid refund retry failed", e);
        counts.errors++;
      }
    }
    let undelivered: SheeridJob[] = [];
    try {
      undelivered = await this.deps.repo.listUndelivered(
        new Date(at.getTime() - DELIVERY_MAX_AGE_HOURS * 3600_000)
          .toISOString(),
      );
    } catch (e) {
      this.log("sheerid delivery list failed", e);
      counts.errors++;
      undelivered = [];
    }
    for (const job of undelivered) {
      if (!this.deliveryDue(job, at)) continue;
      counts.delivery_retried++;
      try {
        const outcome = await this.deliverActivation(job);
        if (outcome === "delivered") counts.delivery_delivered++;
      } catch (e) {
        this.log("sheerid delivery retry failed", e);
        counts.errors++;
      }
    }
    return counts;
  }

  // ------------------------------------------------------------ التسوية
  private async applyStatus(
    job: SheeridJob,
    data: Record<string, unknown>,
  ): Promise<SheeridJob | null> {
    const status = String(data["status"] || "").trim().toLowerCase();
    if (status === "completed") return this.settleCompleted(job, data);
    if (status === "refunded") {
      return this.settleFailure(job, STATUS_REFUNDED);
    }
    if (["failed", "expired", "canceled", "cancelled", "error"].includes(status)) {
      return this.settleFailure(job, STATUS_FAILED);
    }
    return null;
  }

  private async settleCompleted(
    job: SheeridJob,
    data: Record<string, unknown>,
  ): Promise<SheeridJob> {
    const fresh = (await this.deps.repo.getJob(job.id)) || job;
    if (TERMINAL_STATUSES.includes(fresh.status)) return fresh;
    const activation = String(
      data["activation_url"] || fresh.activation_url || "",
    );
    // حجز التسوية ذرّيًا (إصلاح اللجنة #2): أول منتقل لحالة نهائية
    // بيكسب — أي تسوية متزامنة تانية بتلاقي الحجز مقفول وبترجع
    // بالصف الحالي من غير إيميل/تنفيذ مكرر.
    const updated = await this.deps.repo.updateJobIf(fresh.id, {
      status: STATUS_COMPLETED,
      activation_url: activation,
      manual_fallback: false,
    }, { statuses: SETTLEABLE_STATUSES });
    if (!updated) return (await this.deps.repo.getJob(fresh.id)) || fresh;
    const order = await this.orderFor(fresh);
    if (order && order.items.every((it) => it.sku === STUDENT_SKU)) {
      // بوابة الدفع (إصلاح اللجنة #1): اكتمال عند المورد ما بيعلّمش
      // طلب fulfilled إلا لو الدفع مؤكد — طلب غير مدفوع بيتنبّه عليه
      // الإدارة للمراجعة اليدوية بدل ما يتسلّم بصمت.
      if (!this.isPaid(order)) {
        this.log(
          "sheerid completed for UNPAID order — fulfil blocked",
          new Error(`order ${order.order_ref} status ${order.status}`),
        );
        this.alertAdmin(texts.adminFallbackText(
          order.order_ref,
          "اكتمل التحقق عند المورد لكن الطلب غير مؤكد الدفع — " +
            "لم يُعلَّم fulfilled ويحتاج مراجعة يدوية فورية",
        ));
      } else {
        // مرآة قاعدة المنفّذ: الطلب fulfilled بس لما كل بنوده اتسلّمت —
        // وده بيتحقق هنا لما الطلب كله هو منتج التحقق.
        try {
          await this.deps.orders.setOrderStatus(order.order_ref, "fulfilled");
        } catch (e) {
          this.log("sheerid order fulfil failed", e);
        }
      }
    }
    await this.deliverActivation(updated);
    this.alertAdmin(texts.adminCompletedText(fresh.order_ref, updated));
    return updated;
  }

  private async settleFailure(
    job: SheeridJob,
    targetStatus: string,
  ): Promise<SheeridJob> {
    const fresh = (await this.deps.repo.getJob(job.id)) || job;
    if (TERMINAL_STATUSES.includes(fresh.status)) return fresh;
    const order = await this.orderFor(fresh);
    // الاسترداد أولًا (إصلاح اللجنة #4): محاولة الاسترداد بآليات
    // المتجر بتتم قبل أي تثبيت نهائي، ونص العميل ما يدّعيش إن
    // الاسترداد «تم» إلا لو اتأكد فعلًا في القاعدة.
    let refundConfirmed = false;
    if (order) {
      try {
        refundConfirmed = await this.deps.orders.refundOnFailure(
          order,
          "اتلغى: التحقق ماكتملش، والاسترداد اتعالج بمسار المتجر",
        );
      } catch (e) {
        this.log("sheerid refund failed", e);
      }
    }
    if (!refundConfirmed) {
      // الاسترداد لسه مش مؤكد: العملية بتروح refund_pending (حالة
      // غير نهائية) والمسح الدوري بيعيد المحاولة لحد التأكيد،
      // والعميل بياخد الصياغة الصادقة «جارٍ معالجة الاسترداد».
      const pending = await this.deps.repo.updateJobIf(fresh.id, {
        status: STATUS_REFUND_PENDING,
      }, { statuses: SETTLEABLE_STATUSES });
      if (!pending) return (await this.deps.repo.getJob(fresh.id)) || fresh;
      if (order) await this.tryEmail(order, "refund_pending", pending);
      this.alertAdmin(
        texts.adminFailedText(fresh.order_ref, pending, false),
      );
      return pending;
    }
    // الاسترداد اتأكد: التثبيت النهائي بحجز ذرّي (إصلاح اللجنة #2)
    // وبعدين إيميل الفشل اللي بيعلن الاسترداد — وهو دلوقتي حقيقي.
    const updated = await this.deps.repo.updateJobIf(fresh.id, {
      status: targetStatus,
    }, { statuses: SETTLEABLE_STATUSES });
    if (!updated) return (await this.deps.repo.getJob(fresh.id)) || fresh;
    if (order) await this.tryEmail(order, "failed", updated);
    this.alertAdmin(
      texts.adminFailedText(fresh.order_ref, updated, true),
    );
    return updated;
  }

  /**
   * إعادة محاولة استرداد معلّق من المسح الدوري: نجاح المحاولة
   * بيقفل العملية نهائيًا (refunded لو المورد ردّها كده، وإلا
   * failed) وبيبعت للعميل إيميل الفشل المؤكد الاسترداد.
   */
  private async retryRefund(job: SheeridJob): Promise<boolean> {
    const order = await this.orderFor(job);
    if (!order) return false;
    let confirmed = false;
    try {
      confirmed = await this.deps.orders.refundOnFailure(
        order,
        "اتلغى: التحقق ماكتملش، والاسترداد اتعالج بمسار المتجر",
      );
    } catch (e) {
      this.log("sheerid refund retry call failed", e);
      return false;
    }
    if (!confirmed) return false;
    let target: string = STATUS_FAILED;
    if (job.job_id && this.enabled()) {
      try {
        const data = await this.deps.client.status(job.job_id);
        if (
          String(data["status"] || "").trim().toLowerCase() === "refunded"
        ) {
          target = STATUS_REFUNDED;
        }
      } catch (e) {
        this.log("sheerid refund retry status check failed", e);
      }
    }
    const updated = await this.deps.repo.updateJobIf(job.id, {
      status: target,
    }, { statuses: [STATUS_REFUND_PENDING] });
    if (!updated) return false;
    await this.tryEmail(order, "failed", updated);
    this.alertAdmin(texts.adminFailedText(job.order_ref, updated, true));
    return true;
  }

  // ------------------------------------------------------------ تسليم النتيجة
  /**
   * تسليم نتيجة النجاح مع تتبّع المحاولة على العملية (ضمان تسليم
   * البوت): delivered_at متعبّي = ممنوع أي إرسال تاني أبدًا. القناة
   * الأولى هي إيميل العميل؛ غياب القناة أصلًا (مفيش مفتاح Brevo أو
   * مفيش إيميل على الطلب) بيخلي صفحة الفاتورة هي التسليم نفسه.
   */
  async deliverActivation(
    job: SheeridJob,
  ): Promise<"delivered" | "already_delivered" | "failed"> {
    const fresh = (await this.deps.repo.getJob(job.id)) || job;
    if (fresh.delivered_at) return "already_delivered";
    if (fresh.status !== STATUS_COMPLETED) return "failed";
    const attemptsBefore = Number(fresh.delivery_attempts) || 0;
    const attempts = attemptsBefore + 1;
    // حجز محاولة التسليم ذرّيًا (إصلاح اللجنة #2): الانتقال من عدد
    // المحاولات الحالي للي بعده (CAS على القيمة نفسها) بيتم لصف
    // واحد بس — متسابقين متزامنين واحد بس بيبعت الإيميل، والباقي
    // بيرجع already_delivered من غير إرسال مكرر.
    const attemptClaim = await this.deps.repo.updateJobIf(fresh.id, {
      delivery_attempts: attempts,
      last_delivery_attempt_at: this.nowFn().toISOString(),
    }, {
      statuses: [STATUS_COMPLETED],
      deliveredNull: true,
      deliveryAttempts: attemptsBefore,
    });
    if (!attemptClaim) return "already_delivered";
    const order = await this.orderFor(fresh);
    let outcome: EmailOutcome = "unavailable";
    if (order) {
      outcome = await this.tryEmail(order, "completed", fresh);
    }
    if (outcome === "failed") {
      if (attempts === 3) {
        this.alertAdmin(
          texts.adminDeliveryAlertText(fresh.order_ref, fresh),
        );
      }
      return "failed";
    }
    // "sent" = الإيميل وصل قناة الدفع؛ "unavailable" = مفيش قناة دفع
    // أصلًا فصفحة الفاتورة هي التسليم (الرابط محفوظ وبيظهر للعميل).
    // تعليم التسليم نفسه مشروط بأن delivered_at لسه null.
    const doneClaim = await this.deps.repo.updateJobIf(fresh.id, {
      delivered_at: this.nowFn().toISOString(),
    }, { deliveredNull: true });
    return doneClaim ? "delivered" : "already_delivered";
  }

  private deliveryDue(job: SheeridJob, now: Date): boolean {
    if (job.delivered_at) return false;
    const attempts = Number(job.delivery_attempts) || 0;
    if (attempts < 1) return false;
    const nowSec = now.getTime() / 1000;
    const created = epoch(job.created_at);
    if (created === null) return false;
    if (nowSec - created > DELIVERY_MAX_AGE_HOURS * 3600) return false;
    const gap = attempts === 1
      ? DELIVERY_GAP_FIRST_SECONDS
      : attempts === 2
      ? DELIVERY_GAP_SECOND_SECONDS
      : DELIVERY_GAP_STEADY_SECONDS;
    const last = epoch(job.last_delivery_attempt_at);
    const reference = last !== null ? last : created;
    return nowSec - reference >= gap;
  }

  // ------------------------------------------------------------ مساعدات
  private async providerReady(): Promise<[boolean, string]> {
    let data: Record<string, unknown>;
    try {
      data = await this.deps.client.balance();
    } catch (e) {
      this.log("sheerid balance check failed", e);
      return [false, "تعذّر قراءة حالة خدمة التحقق عند المورد"];
    }
    if (!data["service_available"]) {
      return [false, "خدمة التحقق متوقفة عند المورد حاليًا"];
    }
    const possible = data["possible_verifications"];
    if (possible !== undefined && possible !== null) {
      const n = Number(possible);
      if (!Number.isNaN(n) && n < 1) {
        return [false, "رصيد خدمة التحقق عند المورد لا يكفي لعملية واحدة"];
      }
      return [true, ""];
    }
    const balance = Number(data["wallet_balance_usd"] || 0);
    const price = Number(data["price_per_link_usd"] || 0);
    if (!Number.isNaN(balance) && !Number.isNaN(price) && price > 0 && balance < price) {
      return [false, "رصيد خدمة التحقق عند المورد لا يكفي لعملية واحدة"];
    }
    return [true, ""];
  }

  private async manualFallback(
    order: StoreOrder,
    job: SheeridJob,
    reason: string,
  ): Promise<void> {
    this.log(`sheerid manual fallback: ${reason}`);
    await this.deps.repo.updateJob(job.id, { manual_fallback: true })
      .catch((e) => this.log("sheerid fallback mark failed", e));
    await this.tryEmail(order, "fallback", job);
    this.alertAdmin(texts.adminFallbackText(order.order_ref, reason));
  }

  private async orderFor(job: SheeridJob): Promise<StoreOrder | null> {
    try {
      return await this.deps.orders.getOrder(job.order_ref);
    } catch (e) {
      this.log("sheerid order lookup failed", e);
      return null;
    }
  }

  private async tryEmail(
    order: StoreOrder,
    kind: "completed" | "failed" | "fallback" | "refund_pending",
    job: SheeridJob,
  ): Promise<EmailOutcome> {
    if (!this.deps.sendEmail) return "unavailable";
    try {
      return await this.deps.sendEmail({ order, kind, job });
    } catch (e) {
      this.log("sheerid email send failed", e);
      return "failed";
    }
  }

  private alertAdmin(text: string): void {
    if (!this.deps.alertAdmin) {
      this.log(`sheerid admin note: ${text}`);
      return;
    }
    try {
      this.deps.alertAdmin(text);
    } catch (e) {
      this.log("sheerid admin notify failed", e);
    }
  }
}
