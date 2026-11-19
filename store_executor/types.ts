/**
 * أنواع منفّذ الشراء التلقائي للموقع (الحزمة 6) — العقد المشترك.
 *
 * المرآة TypeScript لقواعد محرك البوت (الحزم 1–5): نفس سجل المصدر، نفس
 * الفحوصات، نفس تصنيف النتائج، نفس التسوية غير المتزامنة، نفس التسليم
 * بالعلامة البيضاء. لا منطق توريد منفصل للموقع — الاختلاف الوحيد هو
 * وقت التشغيل (Deno بدل Python) وقاعدة البيانات (إنتاج المتجر بدل
 * قاعدة البوت)، فالقواعد بتتنسخ كمرآة مختبَرة بنفس السيناريوهات.
 */

// ------------------------------------------------------------------ الطلب
export interface StoreOrderItem {
  /** SKU كتالوج المتجر كما هو في جدول catalog (اسم العرض العربي في الإنتاج). */
  sku: string;
  qty: number;
  /** سعر البيع للوحدة بالجنيه وقت إنشاء الطلب (من create_order الخادمي). */
  price_egp: number;
}

export interface StoreOrder {
  order_ref: string;
  /** حالة الطلب في المتجر: pending / paid (مؤكد الدفع) / fulfilled / cancelled ... */
  status: string;
  customer_email: string | null;
  sender_account: string | null;
  /** وسيلة دفع العميل كما سجلها create_order (اختياري — بيعدّي لصف التزام الاسترداد كما هو، وممنوع تأليفه). */
  payment_method?: string | null;
  items: StoreOrderItem[];
  server_total_egp: number;
  idempotency_key: string | null;
}

// ------------------------------------------------------------- سجل المصدر
/**
 * صف سجل المصدر كما يستهلكه المنفّذ — نفس حقول القسم 1.1 في المواصفة.
 * العقد ده بيتبني من سجل المصدر الآلي (الحزمة 2) وبيتوزّع على خلفية
 * المتجر كملف JSON موقّع بالتوليد (generated_at) — المنفّذ ما بيخترعش
 * مصادر: منتج مش موجود في السجل أو من غير مورد سجل نشط = برّه التغطية.
 */
export interface ProvenanceRecord {
  product_key: string;
  /** SKU المتجر المطابق لهذا المنتج (خطوة مطابقة المفاتيح في بوابة المالك). */
  store_sku: string;
  /** مورد السجل النشط الوحيد. */
  supplier_key: string;
  /** معرّف الإدراج عند المورد (SKU المورد). */
  listing_ref: string;
  /** آخر تكلفة معروفة بالدولار — بتتأكد حيًا من لقطة المورد قبل التنفيذ. */
  cost_usd: number;
  /** سعر بيعنا الحالي على المتجر بالجنيه. */
  store_price_egp: number;
  /** استثناء هامش موثّق بقرار مالك (نمط Google Student) — خارج قاعدة ×1.5. */
  margin_exception?: boolean;
  /** المنتج مقفول سعريًا (تحويل جارٍ) — ممنوع أي تنفيذ في الفجوة. */
  price_locked?: boolean;
}

export interface RegistrySnapshot {
  feed: string; // ثابت: "migo-provenance"
  version: number; // 1
  generated_at: string; // ISO UTC — أساس حساب القدم (Fail-Closed)
  records: ProvenanceRecord[];
}

// ---------------------------------------------------------------- التنفيذ
export type ExecutionStatus =
  | "claimed" // اتحجز للتنفيذ ولسه ما اتبعتش حاجة للمورد
  | "awaiting_supplier_funds" // رصيد المورد مش كافي/مش مقروء: وقف آمن معلن
  | "processing" // اتبعت والمورد لسه بيجهّز (تسوية غير متزامنة)
  | "delivered" // المورد أكّد التسليم والبيانات اتحفظت
  | "failed" // رفض نهائي مؤكد من المورد قبل/عند التنفيذ
  | "refunded" // الفشل النهائي اتقفل باسترداد عبر مسار المتجر نفسه
  | "manual_review" // نتيجة غامضة: ممنوع إعادة شراء وممنوع استرداد أعمى
  | "escalated" // عدّى نافذة التسوية من غير حسم: تصعيد أدمن صريح
  | "skipped"; // برّه التغطية/البوابات قافلة — الطلب نفسه ما اتلمسش

export interface DeliveryItem {
  label: string;
  value: string;
}

export interface ExecutionRecord {
  id: string;
  order_ref: string;
  sku: string;
  product_key: string;
  supplier_key: string;
  listing_ref: string;
  /** مرجع الإيدمبوتنسي اللي بيتبعت للمورد (custom_id عند Drayik ونظائره). */
  reference: string;
  status: ExecutionStatus;
  /** التكلفة الحية بالدولار وقت التنفيذ (من لقطة المورد). */
  cost_usd: number | null;
  sell_egp: number;
  quantity: number;
  external_ref: string | null;
  /** بيانات التسليم بعد التنقية — ده بس اللي ممكن يوصل للعميل. */
  delivery: DeliveryItem[] | null;
  delivery_notified_at: string | null;
  delivery_attempts: number;
  delivery_last_attempt_at: string | null;
  poll_count: number;
  first_poll_at: string | null;
  last_poll_at: string | null;
  refund_state: "none" | "requested" | "confirmed" | "unavailable";
  admin_alerted: boolean;
  last_error: string | null;
  skip_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------- نتائج المحوّلات
/** نتيجة شراء منظّمة من المحوّل — مرآة `_order_result` عند البوت. */
export interface PurchaseOutcome {
  kind: "delivered" | "processing" | "failed" | "canceled" | "refunded";
  external_ref: string;
  /** عناصر تسليم مستخرجة من الرد بمفاتيح معروفة بس — من غير أي تأليف. */
  delivery: DeliveryItem[];
  /** لقطة الرد بعد تنقية الأسرار (للتخزين الداخلي بس — مش للعميل). */
  raw: unknown;
}

/** رفض نهائي مؤكد: الطلب ما اتعملش عند المورد أصلًا → استرداد آمن. */
export class DefiniteRejection extends Error {
  /** true لو الرفض حصل قبل أي POST شراء (فحص رصيد/توفر) — مؤكد قطعًا. */
  beforeSubmit: boolean;
  constructor(message: string, beforeSubmit = false) {
    super(message);
    this.name = "DefiniteRejection";
    this.beforeSubmit = beforeSubmit;
  }
}

/** نتيجة غير معروفة (429/5xx/شبكة/مهلة/رد مش مفهوم) → manual_review. */
export class AmbiguousOutcome extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousOutcome";
  }
}

/** بوابة قافلة (مخزون/هامش/قفل سعر/تغذية) — وقف آمن قبل أي حركة فلوس. */
export class GateBlocked extends Error {
  reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = "GateBlocked";
    this.reason = reason;
  }
}

export interface BalanceResult {
  /** الرصيد المتاح بالدولار (USDT عند Drayik/TunVN = دولار 1:1). */
  balance_usd: number;
  currency: string;
}

/** إعلان حقل إدخال عميل على variant عند المورد — الشكل الموحّد (مرآة providers/inputs.py عند البوت). */
export interface SupplierInputField {
  key: string;
  type: string;
  label: string;
  required: boolean;
}

export interface SnapshotResult {
  cost_usd: number | null;
  stock: number | null;
  /** توفر ثنائي (Wasmou) — null لو المورد بيقدّم عددًا رقميًا بدلًا منه. */
  available: boolean | null;
  /** حقول إدخال العميل المعلنة على الـ variant (Wasmou) — غيابها = مفيش إدخال مطلوب. */
  input_fields?: SupplierInputField[];
  /** المنتج بيعلن احتياج إدخال حتى لو حقوله مش مفهومة — فشل مقفول عند الشراء. */
  requires_input?: boolean;
}

// ------------------------------------------------------------- النقل HTTP
export interface HttpResult {
  status: number | null;
  json?: unknown;
  text?: string;
  error?: string;
}

export interface HttpTransport {
  request(
    method: string,
    url: string,
    opts?: { headers?: Record<string, string>; body?: unknown },
  ): Promise<HttpResult>;
}

/** عقد المحوّل — مرآة `ProviderAdapter` عند البوت. */
export interface SupplierAdapter {
  key: string;
  /**
   * قيم سرية معروفة (مفتاح الـ API) — المنفّذ بينقّي بيها نصوص أخطاء
   * المورد قبل ما تتخزن في last_error أو توصل سجل الأخطاء، فالمفتاح
   * لو اتسرّب في جسم خطأ من المورد ما يتلقّطش في أي سطح عندنا.
   */
  secretValues?(): string[];
  getBalance(): Promise<BalanceResult>;
  getSnapshot(listingRef: string): Promise<SnapshotResult>;
  submitPurchase(input: {
    listingRef: string;
    quantity: number;
    reference: string;
    cost_usd: number;
    /**
     * إيميل العميل كما هو مسجل على طلب المتجر نفسه (customer_email) —
     * مصدر قيم حقول الإدخال من نوع email عند الموردين اللي بيحتاجوها
     * (Wasmou). غيابه/عدم سلامته مع منتج بيحتاج إدخال = رفض نهائي قبل
     * أي إرسال (فشل مقفول). المحوّلات اللي مش بتحتاج إدخال بتتجاهله.
     */
    customer_email?: string | null;
  }): Promise<PurchaseOutcome>;
  getPurchaseStatus(externalRef: string): Promise<PurchaseOutcome>;
}

// ------------------------------------------------------------ التبعيات
export interface NotifyEvent {
  kind:
    | "delivered"
    | "failed_refunded"
    | "delayed"
    | "awaiting_funds"
    | "escalated"
    | "admin_update";
  order_ref: string;
  product_key: string;
  /** بيانات تسليم منقّاة — موجودة في حدث delivered بس. */
  delivery?: DeliveryItem[];
  /** نص أدمن/ملحوظة منقّاة (حدث admin_update) — صياغتنا إحنا بس. */
  note?: string;
}

export interface ExecutorDeps {
  store: StoreDb;
  registry: RegistrySource;
  availability: AvailabilitySource;
  adapters: Map<string, SupplierAdapter>;
  flags: RolloutFlags;
  /** سجل الأخطاء المركزي (في الإنتاج: logError بتاعة api.ts → log_error RPC). */
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  /** إشعار العميل عبر سطح المتجر (إيميل رسمي/صفحة حالة الطلب) — قناة واحدة موثّقة. */
  notifyCustomer: (event: NotifyEvent) => Promise<boolean>;
  /** تنبيه أدمن (إخباري فقط — مفيش خطوة عميل بتستنى إنسان). */
  alertAdmin: (message: string, context?: Record<string, unknown>) => Promise<void>;
  /**
   * استرداد عبر مسارات المتجر نفسه بس (قاعدة 7.2). بيرجع true لو
   * الاسترداد اتأكد. غيابه = المنفّذ ما بيخترعش طريق فلوس: التنفيذ
   * بيقف refund_state=unavailable + تنبيه أدمن.
   */
  refundOrder?: (order_ref: string, reason: string) => Promise<boolean>;
  now: () => Date;
}

export interface RolloutFlags {
  /** مفتاح القتل العام — افتراضيًا مقفول. */
  globalEnabled: boolean;
  /** منتجات مفعّلة للشراء التلقائي — افتراضيًا فاضية. */
  enabledProducts: Set<string>;
}

export interface RegistrySource {
  /** سجل المصدر أو null لو التغذية واقعة/قديمة/مش صالحة (Fail-Closed). */
  snapshot(): Promise<RegistrySnapshot | null>;
}

export interface AvailabilitySource {
  /** true بس لو التغذية صالحة وطازجة والمنتج orderable فيها. */
  isOrderable(productKey: string): Promise<boolean>;
}

// --------------------------------------------------------- قاعدة المتجر
export interface StoreDb {
  getOrder(orderRef: string): Promise<StoreOrder | null>;
  /** طلبات مؤكدة الدفع فيها SKU مفعّل ولسه من غير تنفيذ — لمسح التنفيذ. */
  listConfirmedOrders(limit: number): Promise<StoreOrder[]>;
  /**
   * حجز تنفيذ لطلب+SKU. القيد الفريد (order_ref, sku) بيخلي الحجز
   * ذرّيًا: لو فيه تنفيذ قائم بيرجع هو نفسه (إيدمبوتنسي) — ممنوع تنفيذين.
   */
  claimExecution(input: {
    order_ref: string;
    sku: string;
    product_key: string;
    supplier_key: string;
    listing_ref: string;
    reference: string;
    sell_egp: number;
    quantity: number;
  }): Promise<{ execution: ExecutionRecord; created: boolean }>;
  getExecution(id: string): Promise<ExecutionRecord | null>;
  getExecutionByOrderSku(
    orderRef: string,
    sku: string,
  ): Promise<ExecutionRecord | null>;
  listOpenExecutions(limit: number): Promise<ExecutionRecord[]>;
  /** تنفيذات اتسلّمت بس إشعار العميل لسه ما اتأكدش — لضمان التسليم (MR!68). */
  listUnnotifiedDeliveries(limit: number): Promise<ExecutionRecord[]>;
  updateExecution(
    id: string,
    patch: Partial<ExecutionRecord>,
  ): Promise<ExecutionRecord>;
  /**
   * انتقال ذرّي مشروط (Compare-And-Swap): بيطبّق الباتش بس لو الحالة
   * الحالية ضمن `from`، وإلا بيرجع null. ده اللي بيمنع منفّذَين
   * متزامنين (نقطة فورية + كنس) من إرسال شراءين لنفس التنفيذ.
   */
  transitionExecution(
    id: string,
    from: ExecutionStatus[],
    patch: Partial<ExecutionRecord>,
  ): Promise<ExecutionRecord | null>;
  /** تحديث حالة الطلب على سطح المتجر (التسليم بيبان للعميل من هنا). */
  setOrderStatus(
    orderRef: string,
    status: string,
    note?: string,
  ): Promise<void>;
  /** سجل تنفيذات مرئي للأدمن (نفس بيانات store_executions). */
  listExecutions(limit: number): Promise<ExecutionRecord[]>;
}
