/**
 * محلّل رسائل إيداع المحفظة (الحزمة 11) — دوال نقية، قابلة للاختبار.
 *
 * بيحوّل نص رسالة SMS واردة على موبايل المالك (تأكيد استلام فودافون
 * كاش / إنستاباي / بنك) لحقول منظمة: مبلغ + حساب مُرسل + رقم عملية
 * + اتجاه (وارد/صادر). نقطة /wallet/sms بتنادي parseSms وتمرر
 * الناتج لـ RPC ‏wallet_ingest_sms — المطابقة والشحن في القاعدة.
 *
 * ⚠️ صياغة الرسائل الحية: القوالب دي مكتوبة على الأشكال الشائعة
 * الموثقة لرسائل فودافون كاش في مصر (عربي + إنجليزي) وأشكال
 * إنستاباي/البنوك العامة. الصياغة الحرفية اللي بتوصل على خط المالك
 * لازم تتأكد من رسالة حقيقية وقت التفعيل وتتظبط التعابير عليها
 * (شوف NOTES.md + العينات في sms_parse.test.ts). أي رسالة مش
 * بتطابق قالب وارد بتطلع direction/amount فاضي → الحدث بيتسجل
 * 'ignored' في القاعدة ومش بيحرّك فلوس أبدًا — الفشل هنا صوته
 * عالي (عدّادات unmatched/ignored عند الأدمن) مش صامت.
 *
 * الحزمة 13 — تصنيف الأصل (classifyOrigin): التحليل بيطلع كمان
 * «أصل» هوية المُرسل: official (هوية أبجدية رسمية معروفة) /
 * numeric (رقم عادي) / unknown. الأصل بيتحفظ في parsed وبيوصل
 * لبوابة الشحن في القاعدة (هجرة 015): حدث SMS أصله مش official
 * مستحيل يفتح شحنًا تلقائيًا مهما طابق — لأن أي حد يقدر يبعت
 * رسالة مفبركة من رقم عادي. التصنيف فلتر ضروري مش دليل كفاية:
 * الهويات الأبجدية نفسها قابلة للتزوير عبر بوابات مشبوهة، وعشان
 * كده البوابة بتطلب قناة مزدوجة أو تاريخ مُرسل موثوق فوقه.
 */

/** ناتج التحليل — بيتبعت للقاعدة كـ parsed وبيتستخرج منه الحقول. */
export interface SmsParseResult {
  /** القالب اللي طلّع المبلغ (أو 'none'). */
  template: "vodafone_ar" | "vodafone_en" | "instapay_generic" | "etisalat_money" | "generic" | "none";
  /** اتجاه الحركة كما فهمه المحلّل من صياغة الرسالة. */
  direction: "received" | "sent" | "unknown";
  /** المبلغ بالجنيه (رقم عشري دقيق لحد قرشين) أو null. */
  amount_egp: number | null;
  /** حساب المُرسل (رقم موبايل مصري غالبًا) أو null. */
  sender_account: string | null;
  /** رقم العملية/المرجع كما ظهر في الرسالة أو null. */
  transfer_ref: string | null;
  /** قابل للمطابقة: وارد + مبلغ موجود. الباقي بيتسجل للتدقيق بس. */
  matchable: boolean;
  /**
   * تصنيف أصل هوية المُرسل (الحزمة 13): official / numeric /
   * unknown — من classifyOrigin. بوابة القاعدة بتقرأه من parsed.
   */
  origin: SmsOrigin;
}

// ---------------------------------------------------------------------
// تصنيف أصل المُرسل (الحزمة 13)
// ---------------------------------------------------------------------

/** أصل هوية المُرسل كما يظهر على موبايل المالك. */
export type SmsOrigin = "official" | "numeric" | "unknown";

/**
 * الهويات الأبجدية الرسمية المعروفة لرسائل فودافون كاش في مصر.
 * ⚠️ تُتحقق وقت التفعيل من رسائل حقيقية على خط المالك، والقائمة
 * بتتقلّص للهوية/الهويات اللي بتظهر فعليًا بس — أي هوية زيادة هنا
 * هي سطح هجوم زيادة (بوابات التزوير بتبعت بأسماء قريبة الشكل).
 * ملحوظة: رسائل التسويق ممكن تيجي من نفس الهويات — المحلّل بيفرّق
 * بالاتجاه/القالب، والتصنيف هنا للهوية بس مش لطبيعة الرسالة.
 */
export const OFFICIAL_SMS_SENDERS: readonly string[] = [
  "VodafoneCash",
  "Vodafone Cash",
  "Vodafone",
  // حزمة 14 (2026-11-18، أمر المالك: كل المحافظ): الهويات اللي
  // بتظهر فعليًا على الخطوط المصرية — فودافون كاش بتظهر VF-Cash،
  // واتصالات كاش بقى اسمها e& money. «Etisalat» العارية برّه
  // القائمة قصدًا (هوية الشركة العامة: تسويق وخدمات، مش المحفظة).
  // التقليص النهائي للهويات الظاهرة فعليًا بيتم وقت المعايرة.
  "VF-Cash",
  "et money",
  "e& money",
  "EtisalatCash",
  "Etisalat Cash",
  "InstaPay",
  "Telda",
];

/**
 * بيصنّف هوية المُرسل:
 *   • 'official' — مطابقة تامة (من غير حساسية لحالة الأحرف) لأي
 *     هوية في OFFICIAL_SMS_SENDERS.
 *   • 'numeric' — رقم هاتف عادي (اختياريًا بـ + وكود دولة): دي
 *     قناة المهاجم المفبرِك — أصلها مش بيفتح شحنًا أبدًا.
 *   • 'unknown' — أي حاجة تانية (هوية أبجدية مش معروفة، قصيرة،
 *     فاضية): برّه الثقة لحد ما تتسجل رسميًا وقت التفعيل.
 */
export function classifyOrigin(senderId: string): SmsOrigin {
  const sid = String(senderId || "").trim();
  if (!sid) return "unknown";
  const lower = sid.toLowerCase();
  if (OFFICIAL_SMS_SENDERS.some((s) => s.toLowerCase() === lower)) {
    return "official";
  }
  if (/^\+?\d[\d\s-]{5,}$/.test(sid)) return "numeric";
  return "unknown";
}

// ---------------------------------------------------------------------
// تطبيع: أرقام عربية مشرقية (٠١٢٣) و«٫» فاصلة عشرية و«٬» فاصل آلاف —
// رسائل مصرية كتير بتوصل بيهم، وكل التعابير تحت بتشتغل على اللاتيني.
// وكمان طيّ همزات الألف (إ/أ/آ → ا): رسائل e& money الحقيقية بتكتب
// «إستلام» بالهمزة بينما علامات الاتجاه والقوالب مكتوبة بالألف
// العادية «استلام» — من غير الطيّ الاتجاه بيطلع unknown والرسالة
// بتتسجل ignored رغم إن المبلغ والمرسل بيتقروا صح.
// وكمان حذف التشكيل (U+064B–U+0652 وU+0670): الطيّ لوحده مش كفاية —
// «أُضيف» بعد الطيّ بتبقى «اُضيف» والضمة فاصلة بين الحروف فعلامة
// الاتجاه «اضيف» مش بتلقطها؛ بعد حذف التشكيل بتبقى «اضيف» متصلة.
// ---------------------------------------------------------------------
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const HAMZA_ALEFS: Record<string, string> = { "إ": "ا", "أ": "ا", "آ": "ا" };
export function normalizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const idx = AR_DIGITS.indexOf(ch);
    if (idx >= 0) { out += String(idx); continue; }
    if (ch === "٫") { out += "."; continue; }   // فاصلة عشرية عربية
    if (ch === "٬") { out += ","; continue; }   // فاصل آلاف عربي
    const cp = ch.codePointAt(0) ?? 0;
    if ((cp >= 0x064B && cp <= 0x0652) || cp === 0x0670) continue; // تشكيل → يُحذف
    const folded = HAMZA_ALEFS[ch];
    if (folded) { out += folded; continue; }   // همزة ألف → ألف عادية
    out += ch;
  }
  return out;
}

/** «1,250.50» → 1250.5 — بيرجع null لو مش رقم نضيف. */
function toAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const MOBILE_RE = /\b(01[0125]\d{8})\b/;                 // موبايل مصري
const REF_RE = /(?:رقم العملية|رقم المرجع|المرجع|رقم التحويلة|رقم المعاملة|transaction id|transaction no|reference(?:\s*(?:no|number|id))?|ref\.?(?:\s*(?:no|id))?)\s*[:：#]?\s*([0-9][0-9\- ]{5,}[0-9])/i;
const MONEY_RE = /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:جنيه(?:ًا|ا)?|ج\.م\.?|EGP|LE\b)/i;
const MONEY_PREFIX_RE = /(?:EGP|ج\.م\.?|جنيه(?:ًا|ا)?)\s*:?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i;
const AMOUNT_WORD_RE = /(?:مبلغ|بقيمة|قيمة)\s*:?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/;

// علامات الاتجاه — الوارد لازم يبقى صريح؛ الصادر الصريح بيتلغي.
// ⚠️ الحروف هنا مكتوبة بالأبجدية المطوية (ا مش إ/أ، والى مش إلى) ومن
// غير تشكيل، لأن العلامات دي بتشتغل على النص بعد normalizeDigits بس —
// أي صيغة غير مطوية هنا مش هتطابق أي نص حقيقي أبدًا.
const RECEIVED_MARKERS = /(?:استلام|استلمت|استقبلت|تم\s*(?:اضافة|ايداع)|(?<![\p{L}])وصل(?:ك|ت)?(?![\p{L}])|تحويل وارد|اضيف|اضيف الى حسابك|received|credited|deposit(?:ed)?)/iu;
const SENT_MARKERS = /(?:تم تحويل مبلغ.*(?:الى|لرقم)|قمت بتحويل|تم ارسال|you (?:have )?sent|payment (?:of|sent))/i;

// عبارات نفي الاستلام وصيغ المستقبل — دي مش إيصالات واردة أبدًا،
// وكانت بتتلقط كإيداع (تدقيق W4): «لم يتم استلام مبلغ 500» رسالة
// فشل، و«اشحن 50 وهتوصلك رسالة بالهدية» إعلان. بنخفيها من النص
// قبل اختبار علامات الاتجاه، وبنقيّد «وصل» بحدود كلمة كمان عشان
// ما تطابقش جوه «توصلك/هتوصلك» حتى من غير إخفاء.
const NEGATED_RECEIPT_RE = /(?:لم|لن)\s+(?:يتم\s+)?(?:استلام|استلم|اضافة|ايداع|وصول)/g;
const FUTURE_RECEIPT_RE = /(?:هتوصلك|هتوصل(?:ك)?|هيوصلك|سيصلك|سوف\s+يصلك)/g;

function maskNonReceipts(body: string): string {
  return body
    .replace(NEGATED_RECEIPT_RE, " ")
    .replace(FUTURE_RECEIPT_RE, " ");
}

function detectDirection(body: string): "received" | "sent" | "unknown" {
  const b = maskNonReceipts(body);
  if (RECEIVED_MARKERS.test(b)) return "received";
  if (SENT_MARKERS.test(b)) return "sent";
  return "unknown";
}

// مراجع سداسية (hex) بعد وسم صريح — صيغة بنك المشرق لمعاملات IPN
// (مثال: «رقم المعاملة 68d913e5»). لازم حرف ورقم على الأقل عشان
// منلقطش كلمات عادية، والوسم الصريح شرط.
const HEX_REF_RE = /(?:رقم المعاملة|رقم العملية|transaction(?:\s*(?:id|no))?|reference(?:\s*(?:no|number|id))?|ref\.?(?:\s*(?:no|id))?)\s*[:：#]?\s*([0-9a-fA-F]{6,16})/i;

function extractRef(body: string): string | null {
  const m = body.match(REF_RE);
  if (m) return m[1].replace(/[\s-]/g, "");
  const hx = body.match(HEX_REF_RE);
  if (hx && /[0-9]/.test(hx[1]) && /[a-fA-F]/.test(hx[1])) return hx[1];
  // احتياطي: أول سلسلة أرقام (8+) مش رقم موبايل — مرشّح مرجع.
  // بس مش من سياق حساب/محفظة/بطاقة: أرقام الحسابات والمحافظ
  // ثابتة وبتتطبع في كل رسالة من نفس المرسل، واعتبارها «مرجع
  // عملية» بيخلي إيداعات مختلفة تتشارك نفس المرجع (تدقيق W4).
  const runs = body.match(/\d{8,}/g) || [];
  for (const run of runs) {
    if (/^01[0125]\d{8}$/.test(run)) continue;
    const idx = body.indexOf(run);
    const before = body.slice(Math.max(0, idx - 24), idx);
    if (/(?:حساب|محفظة|بطاقة|account|wallet)/i.test(before)) continue;
    return run;
  }
  return null;
}

function extractSender(body: string): string | null {
  // «من رقم X» / «من X» / «from X» — السياق أولًا، وبعدين أي موبايل.
  const ctx = body.match(/(?:من(?:\s+رقم)?|from)\s*:?\s*(01[0125]\d{8})/i);
  if (ctx) return ctx[1];
  const any = body.match(MOBILE_RE);
  return any ? any[1] : null;
}

function extractAmount(body: string): number | null {
  // مسار «كلمة المبلغ»: بنعدّي على كل المرشّحين مش أول واحد بس —
  // مرشّح في جملة رسوم/خصم/رصيد (من آخر فاصل جُمَل قبله لحد
  // المرشّح) مش مبلغ الإيداع فبنتخطاه للي بعده. الحادثة (تدقيق
  // W4): «تم خصم رسوم بقيمة 2 جنيه. تم ايداع مبلغ 498 جنيه» كانت
  // بترجع 2 (الرسوم) بدل 498 (الإيداع) لأن أول مرشّح كان بيترجع
  // فورًا من غير أي فحص سياق.
  const isFeeOrBalanceCtx = (idx: number) => {
    const before = body.slice(0, idx);
    const cut = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("،"),
      before.lastIndexOf("؛"),
      before.lastIndexOf("\n"),
    );
    return /(?:رسوم|خصم|مصاريف|عمولة|رصيد|balance)/i.test(before.slice(cut + 1));
  };
  const wordFlags = AMOUNT_WORD_RE.flags.includes("g")
    ? AMOUNT_WORD_RE.flags
    : AMOUNT_WORD_RE.flags + "g";
  for (const m of body.matchAll(new RegExp(AMOUNT_WORD_RE.source, wordFlags))) {
    if (isFeeOrBalanceCtx(m.index ?? 0)) continue;
    const v = toAmount(m[1]);
    if (v != null) return v;
  }
  // أرقام «الرصيد» لازم تتبعد: أي مرشّح من جملة رصيد بيتخطى للي بعده.
  const isBalanceCtx = (idx: number) =>
    /(?:رصيد|balance)/i.test(body.slice(Math.max(0, idx - 30), idx));
  for (const re of [MONEY_RE, MONEY_PREFIX_RE]) {
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    for (const m of body.matchAll(new RegExp(re.source, flags))) {
      if (isBalanceCtx(m.index ?? 0)) continue;
      const v = toAmount(m[1]);
      if (v != null) return v;
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// القوالب
// ---------------------------------------------------------------------

/**
 * فودافون كاش — عربي. الشكل الشائع:
 * «تم استلام مبلغ 500.00 جنيه من رقم 01000000000 … رقم العملية 123456789012»
 */
function parseVodafoneAr(body: string): Partial<SmsParseResult> | null {
  if (!/(?:استلام|استلمت)/.test(body)) return null;
  const amount = extractAmount(body);
  if (amount == null) return null;
  return {
    template: "vodafone_ar",
    amount_egp: amount,
    sender_account: extractSender(body),
    transfer_ref: extractRef(body),
  };
}

/** فودافون كاش — إنجليزي: «You have received EGP 500.00 from 01… Transaction ID: …» */
function parseVodafoneEn(body: string): Partial<SmsParseResult> | null {
  if (!/received/i.test(body)) return null;
  const amount = extractAmount(body);
  if (amount == null) return null;
  return {
    template: "vodafone_en",
    amount_egp: amount,
    sender_account: extractSender(body),
    transfer_ref: extractRef(body),
  };
}

/**
 * اتصالات كاش (e& money) — عربي. الصيغة الحقيقية (اتأكدت من رسالة
 * وصلت فعليًا 2026-11-19):
 * «تم إستلام مبلغ 100.00 ج.م من رقم 01020323432 المسجل باسم …
 * بنجاح. رصيد محفظتك الحالى 100.39 ج.م.» + ذيل إعلاني فيه أسعار
 * تانية. البوابة: «استلام» + «مبلغ» بعد التطبيع (الهمزة مطوية).
 * المبلغ من extractAmount: مرشّح «مبلغ» بيكسب قبل رقم الرصيد
 * وأسعار الإعلانات. مفيش رقم عملية في الصيغة دي → المرجع null.
 * القالب مقيد بهوية المُرسل بس (شوف parseSms) — صياغة فودافون
 * العربية شبهها بالظبط ولازم تفضل باسمها.
 */
function parseEtisalatMoney(body: string): Partial<SmsParseResult> | null {
  if (!body.includes("استلام") || !body.includes("مبلغ")) return null;
  const amount = extractAmount(body);
  if (amount == null) return null;
  return {
    template: "etisalat_money",
    amount_egp: amount,
    sender_account: extractSender(body),
    transfer_ref: extractRef(body),
  };
}

/**
 * إنستاباي/بنك — عام: إشعار إيداع/تحويل وارد فيه مبلغ ورقم مرجعي.
 * تغطية إنستاباي الفعلية معتمدة على سلوك بنك المالك في الرسائل
 * (بنوك كتير بتبعت «تم إيداع مبلغ … رقم مرجعي …»).
 */
function parseInstapayGeneric(body: string): Partial<SmsParseResult> | null {
  if (!RECEIVED_MARKERS.test(body)) return null;
  const amount = extractAmount(body);
  if (amount == null) return null;
  return {
    template: "instapay_generic",
    amount_egp: amount,
    sender_account: extractSender(body),
    transfer_ref: extractRef(body),
  };
}

/** احتياطي عام: مبلغ لابس عملة + أي مرجع طويل — من غير ادعاء قالب. */
function parseGeneric(body: string): Partial<SmsParseResult> | null {
  const amount = extractAmount(body);
  if (amount == null) return null;
  return {
    template: "generic",
    amount_egp: amount,
    sender_account: extractSender(body),
    transfer_ref: extractRef(body),
  };
}

// ---------------------------------------------------------------------
// الدالة الرئيسية
// ---------------------------------------------------------------------

/**
 * بيحلّل رسالة واحدة. اختيار القالب: بهوية المُرسل أولًا (فودافون
 * من مرسل فودافون، إلخ) وبعدين بالترتيب العام. الاتجاه بيتحسب من
 * الصياغة نفسها — وقالب «وارد» مش بيشتغل على رسالة صادر حتى لو
 * مرسلها فودافون (حركة صادرة من محفظة المالك مش إيداع عميل).
 */
export function parseSms(senderId: string, rawBody: string): SmsParseResult {
  const body = normalizeDigits(String(rawBody || ""));
  const direction = detectDirection(body);
  const origin = classifyOrigin(senderId);
  const sid = String(senderId || "").toLowerCase();

  const attempts: Array<() => Partial<SmsParseResult> | null> = [];
  if (sid.includes("et money") || sid.includes("e& money") || sid.includes("etisalat")) {
    attempts.push(() => parseEtisalatMoney(body));
  }
  if (sid.includes("vodafone") || sid.includes("vf-")) {
    attempts.push(() => parseVodafoneAr(body), () => parseVodafoneEn(body));
  }
  if (sid.includes("instapay") || sid.includes("bank") || sid.includes("بنك")) {
    attempts.push(() => parseInstapayGeneric(body));
  }
  attempts.push(
    () => parseVodafoneAr(body),
    () => parseVodafoneEn(body),
    () => parseInstapayGeneric(body),
    () => parseGeneric(body),
  );

  let hit: Partial<SmsParseResult> | null = null;
  for (const attempt of attempts) {
    hit = attempt();
    if (hit && hit.amount_egp != null) break;
    hit = null;
  }

  if (!hit) {
    return {
      template: "none",
      direction,
      amount_egp: null,
      sender_account: extractSender(body),
      transfer_ref: extractRef(body),
      matchable: false,
      origin,
    };
  }

  const amount = hit.amount_egp ?? null;
  return {
    template: hit.template || "generic",
    direction,
    amount_egp: amount,
    sender_account: hit.sender_account ?? extractSender(body),
    transfer_ref: hit.transfer_ref ?? extractRef(body),
    // الصادر/المجهول مش قابل للمطابقة حتى لو فيه مبلغ: فلوس طالعة
    // من محفظة المالك مش إيداع داخل لها.
    matchable: direction === "received" && amount != null,
    origin,
  };
}

/**
 * مفتاح منع التكرار (بيتحسب على الخادم — والموبايل بيحسب نظيره
 * المحلي لإدارة طابوره هو؛ شوف NOTES عن الطبقتين):
 *   • فيه مرجع: بصمة (sender_id + transfer_ref + المبلغ + بصمة
 *     النص) — المبلغ والنص جوه البصمة قصدًا (تدقيق W4): مرجع
 *     ثابت/مكرر عبر رسائل مختلفة (رقم حساب اتلقط كمرجع مثلًا)
 *     ما يقدرش يخلي إيداعين مختلفين يتصادموا على نفس المفتاح.
 *     إعادة تسليم نفس الرسالة حرفيًا لسه بتتصادم (نفس النص
 *     والمبلغ والمرجع) فمنع التكرار الحقيقي ما اتلمسش.
 *   • مفيش: بصمة (sender_id + المبلغ + دقيقة الوصول + بصمة النص)
 */
export async function computeDedupeKey(input: {
  sender_id: string;
  body: string;
  received_at_iso: string;
  amount_egp: number | null;
  transfer_ref: string | null;
}): Promise<string> {
  const enc = new TextEncoder();
  const digest = async (s: string) => {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  if (input.transfer_ref) {
    const bodyHash = await digest(input.body);
    return "ref:" + (await digest(
      input.sender_id + "|" + input.transfer_ref + "|" +
        (input.amount_egp ?? "") + "|" + bodyHash,
    ));
  }
  const minute = (input.received_at_iso || "").slice(0, 16); // لحد الدقيقة
  const bodyHash = await digest(input.body);
  return "auto:" + (await digest(
    input.sender_id + "|" + (input.amount_egp ?? "") + "|" + minute + "|" + bodyHash,
  ));
}
