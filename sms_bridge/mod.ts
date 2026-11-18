/**
 * جسر رسائل إيداع المحفظة (الحزمة 11) — نقطة POST /wallet/sms.
 *
 * تطبيق الموبايل على تليفون المالك بيبعت كل رسالة «استلام فلوس»
 * واصلة من مرسلين متظبطين (فودافون كاش…) لهنا. النقطة دي:
 *   1) بتتحقق من هيدر سرّي مخصص للجسر بس (x-migo-sms-key مقابل
 *      SMS_BRIDGE_KEY في البيئة) — مش توكن الأدمن: الموبايل شايل
 *      اعتماد ضيّق قابل للسحب لوحده، صلاحيته إدخال رسائل بس.
 *   2) بتحلّل النص (sms_parse.ts) وبتحسب مفتاح منع التكرار.
 *   3) بتنادي RPC ‏wallet_ingest_sms بمفتاح الخدمة — المطابقة
 *      والشحن بيحصلوا في القاعدة في نفس المعاملة.
 *   4) بتنادي wallet_sms_rematch انتهازيًا: أي رسالة جديدة بتلحق
 *      أحداث قديمة فضلت unmatched (عميل قدّم طلبه بعد الرسالة).
 *
 * الأسرار من البيئة بس. غياب SMS_BRIDGE_KEY أو مفتاح الخدمة =
 * النقطة مقفولة (503) — مفيش إدخال مجهول أبدًا.
 *
 * الحزمة 13 — قناة تانية + أصل: الحمولة بتقبل source
 * ('sms' افتراضي، أو 'app_notification' لإشعارات تطبيق المحفظة
 * الرسمي اللي بيقراها مستمع الإشعارات في التطبيق) و package_name
 * (حزمة التطبيق الناشر — إلزامية مع الإشعارات). تصنيف أصل المُرسل
 * (origin من sms_parse) بيتحفظ في parsed وبيوصل لبوابة الشحن في
 * القاعدة (هجرة 015): النقطة دي مش بتقرر الشحن — بتوصّل الأدلة
 * زي ما هي، والبوابة في القاعدة هي اللي بتحكم.
 */
import { computeDedupeKey, parseSms } from "./sms_parse.ts";

// ------------------------------------------------------------- عميل RPC
export interface SmsRpcClient {
  callIngestSms(args: {
    p_sender_id: string;
    p_body: string;
    p_amount: number | null;
    p_sender_account: string | null;
    p_transfer_ref: string | null;
    p_received_at: string;
    p_dedupe_key: string;
    p_parsed: Record<string, unknown>;
    p_source: string;
    p_package_name: string | null;
  }): Promise<Record<string, unknown>>;
  callRematch(limit: number): Promise<Record<string, unknown>>;
}

interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

/** عميل PostgREST بنفس نمط PostgrestRefundClient في الحزمة 6. */
export class PostgrestSmsClient implements SmsRpcClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }
  private async rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "apikey": this.opts.keyOf(),
        "Authorization": `Bearer ${this.opts.keyOf()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      throw new Error(`rpc ${fn} http ${res.status}: ${text.slice(0, 200)}`);
    }
    return (json && typeof json === "object")
      ? json as Record<string, unknown>
      : { value: json };
  }
  callIngestSms(args: Parameters<SmsRpcClient["callIngestSms"]>[0]) {
    return this.rpc("wallet_ingest_sms", { ...args });
  }
  callRematch(limit: number) {
    return this.rpc("wallet_sms_rematch", { p_limit: limit });
  }
}

// ------------------------------------------------------------- حدّ المعدل
// حدّ بسيط في الذاكرة لكل isolate: 60 رسالة/دقيقة كحد أقصى للمسار
// كله (المرسل الشرعي الوحيد هو موبايل واحد). تجاوزه = 429 والموبايل
// بيأجّل وبيعيد المحاولة من طابوره المحلي — مفيش رسالة بتضيع.
const SMS_RATE_MAX = 60;
const SMS_RATE_WINDOW_MS = 60_000;
let smsWindowStart = 0;
let smsWindowCount = 0;
export function smsRateLimited(now = Date.now()): boolean {
  if (now - smsWindowStart > SMS_RATE_WINDOW_MS) {
    smsWindowStart = now;
    smsWindowCount = 0;
  }
  smsWindowCount++;
  return smsWindowCount > SMS_RATE_MAX;
}

/** مقارنة زمنية ثابتة للسر (تجنّب تسريب الطول بالتوقيت قدر الإمكان). */
function secretEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------- المعالج
export interface SmsDeps {
  client: SmsRpcClient;
  bridgeKeyOf: () => string;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  now?: () => Date;
}

/**
 * معالج طلبات الجسر — بيتركب في api.ts على POST /wallet/sms.
 * بيرجع null لو المسار مش بتاعه (نفس نمط handleExecRequest).
 */
export async function handleSmsRequest(
  req: Request,
  deps: SmsDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/wallet/sms")) return null;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  // بوابة الجسر: اعتماد مخصص ضيّق — مش توكن الأدمن ومش مفتاح عميل.
  const expected = deps.bridgeKeyOf();
  if (!expected) {
    return json({ ok: false, error: "bridge_not_configured" }, 503);
  }
  if (!secretEquals(req.headers.get("x-migo-sms-key") || "", expected)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (smsRateLimited()) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  const body = (await req.json().catch(() => ({}))) as {
    sender_id?: string;
    body?: string;
    received_at?: string | number;
    client_dedupe_key?: string;
    source?: string;
    package_name?: string;
  };
  // القناة: أي قيمة مش 'app_notification' بتتطبّع لـ 'sms' (التوافق
  // الخلفي مع تطبيق الحزمة 11 اللي مش بيبعت source أصلًا).
  const source = body.source === "app_notification"
    ? "app_notification"
    : "sms";
  const packageName = String(body.package_name || "").trim() || null;
  // هوية الحدث: للرسائل هي مُرسل الرسالة؛ للإشعارات هي حزمة
  // التطبيق الناشر (هوية بيفرضها النظام) — ولو التطبيق بعت
  // sender_id صريح بيُحترم زي ما هو.
  let senderId = String(body.sender_id || "").trim();
  if (!senderId && source === "app_notification" && packageName) {
    senderId = packageName;
  }
  const smsBody = String(body.body || "");
  if (!senderId || !smsBody.trim()) {
    return json({ ok: false, error: "sender_id_and_body_required" }, 400);
  }
  if (source === "app_notification" && !packageName) {
    return json({ ok: false, error: "package_name_required" }, 400);
  }
  if (smsBody.length > 2000) {
    return json({ ok: false, error: "body_too_long" }, 400);
  }

  // وقت الوصول كما أبلغه الموبايل (ISO أو epoch ms) — أي قيمة
  // خربانة بتقع لـ«دلوقتي» بدل ما تكسر الإدخال.
  let receivedAt = (deps.now ? deps.now() : new Date()).toISOString();
  if (typeof body.received_at === "number" && body.received_at > 0) {
    receivedAt = new Date(body.received_at).toISOString();
  } else if (typeof body.received_at === "string" && body.received_at) {
    const parsed = new Date(body.received_at);
    if (!Number.isNaN(parsed.getTime())) receivedAt = parsed.toISOString();
  }

  try {
    const parsed = parseSms(senderId, smsBody);
    const dedupeKey = await computeDedupeKey({
      sender_id: senderId,
      body: smsBody,
      received_at_iso: receivedAt,
      amount_egp: parsed.amount_egp,
      transfer_ref: parsed.transfer_ref,
    });
    const result = await deps.client.callIngestSms({
      p_sender_id: senderId,
      p_body: smsBody,
      // مش قابل للمطابقة (صادر/مجهول الاتجاه) → مبلغ null عمدًا:
      // الحدث بيتسجل 'ignored' في القاعدة بدل ما يطابق بالغلط.
      p_amount: parsed.matchable ? parsed.amount_egp : null,
      p_sender_account: parsed.sender_account,
      p_transfer_ref: parsed.transfer_ref,
      p_received_at: receivedAt,
      p_dedupe_key: dedupeKey,
      p_parsed: {
        template: parsed.template,
        direction: parsed.direction,
        matchable: parsed.matchable,
        // أصل الهوية (الحزمة 13): بوابة القاعدة بتقرأه — حدث SMS
        // أصله مش official مستحيل يفتح شحنًا تلقائيًا.
        origin: parsed.origin,
        source,
        package_name: packageName,
        client_dedupe_key: body.client_dedupe_key || null,
      },
      p_source: source,
      p_package_name: packageName,
    });

    // إعادة مطابقة انتهازية: أحداث قديمة unmatched ممكن تكون
    // بقت قابلة للمطابقة بعد ما عميل قدّم طلبه. فشلها مش بيكسر
    // الرد على الرسالة الحالية أبدًا.
    let rematch: Record<string, unknown> | null = null;
    try {
      rematch = await deps.client.callRematch(50);
    } catch (e) {
      deps.logError("wallet_sms.rematch", "rematch pass failed", e);
    }

    return json({ ok: true, ...result, rematch });
  } catch (e) {
    // فشل الإدخال نفسه (قاعدة/شبكة): 502 → الموبايل بيحتفظ بالرسالة
    // في طابوره وبيعيد المحاولة — ومفتاح التكرار بيمنع الشحن مرتين.
    deps.logError("wallet_sms.ingest", "ingest failed", e, { senderId });
    return json({ ok: false, error: "ingest_failed" }, 502);
  }
}
