/**
 * إيداعات منصات لشحن محفظة البوت — ثلاث نقط ضيّقة لممر البوت:
 *   POST /wallet/bot-exchange-candidates — أحداث إيداع USDT قابلة
 *     للربط ولسه ما اتستهلكتش في أي سطح + السعر الحي (هجرة 018:
 *     bot_exchange_candidates).
 *   POST /wallet/bot-exchange-claim — حجز ذرّي لحدث إيداع واحد
 *     لطلب شحن بوت واحد (bot_exchange_claim): الحجز بيعلّم الحدث
 *     `credited` + `matched_bot_topup_id`، فإيداع واحد مستحيل
 *     يقيّد رصيدين عبر الأسطح الأربعة (نية/مطالبة محفظة/مطالبة
 *     طلب/شحن بوت).
 *   POST /wallet/bot-exchange-unclaim — فك حجز تعويضي (هجرة 019:
 *     bot_exchange_unclaim، إصلاح F-07): لو القيد عند البوت فشل
 *     بعد حجز ناجح، الفك بيرجّع الحدث لنتيجته قبل الحجز وبيشيل
 *     علامة البوت، فيفضل إثبات العميل حيًّا للمحاولة الجاية/
 *     القرار اليدوي. مش استرداد فلوس: مفيش قيد حصل أصلًا،
 *     والفك بيترفض لو الحالة مش «محجوز للبوت ده» بالحرف.
 *
 * المستدعي الوحيد هو ممر شحن المنصات التلقائي في بوت التليجرام
 * (wallet/exchange_auto)، والمصادقة هي توكن الجسر القائم بين
 * النظامين أصلًا (x-bridge-token مقابل SHEERID_BRIDGE_TOKEN / صف
 * backend_config ‏sheerid_bridge_token — نفس اعتماد جسر SheerID
 * وإيصالات البوت، فمفيش سر جديد). النقطتان مش بيقرروا أي فلوس:
 * المرشّحون حقائق إيداع جاهزة من قراءات المنصات الموقّعة، والحجز
 * علامة استهلاك بيعيد التحقق من المبلغ/النافذة تحت القفل — قرار
 * القيد نفسه عند البوت بمسار محفظته القائم.
 *
 * فشل مقفول: التوكن مش مضبوط = 503، غلط/غايب = 401، جسم الحجز
 * الخربان = 400 قبل أي RPC، وأي فشل قاعدة = 502 والممر بيأجّل
 * لدورته الجاية — مفيش حجز نص-نص أبدًا (الـ RPC معاملة واحدة).
 */

// ------------------------------------------------------------- عميل RPC
export interface BotExchangeRpcClient {
  callCandidates(limit: number): Promise<Record<string, unknown>>;
  callClaim(args: {
    p_event_id: string;
    p_bot_topup_id: string;
    p_expected_egp: string;
    p_topup_created_at: string;
  }): Promise<Record<string, unknown>>;
  callUnclaim(args: {
    p_event_id: string;
    p_bot_topup_id: string;
  }): Promise<Record<string, unknown>>;
}

interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

/** عميل PostgREST بنفس نمط PostgrestBotSmsClient في إيصالات البوت. */
export class PostgrestBotExchangeClient implements BotExchangeRpcClient {
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
  callCandidates(limit: number) {
    return this.rpc("bot_exchange_candidates", { p_limit: limit });
  }
  callClaim(args: Parameters<BotExchangeRpcClient["callClaim"]>[0]) {
    return this.rpc("bot_exchange_claim", { ...args });
  }
  callUnclaim(args: Parameters<BotExchangeRpcClient["callUnclaim"]>[0]) {
    return this.rpc("bot_exchange_unclaim", { ...args });
  }
}

/** مقارنة زمنية ثابتة للسر (نفس مساعد إيصالات البوت). */
function secretEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// مبلغ جنيه كنص بخانتين كحد أقصى (قاعدة الحزمة 10: المبلغ كنص
// دايمًا — مفيش float بيعدّي على حدود الفلوس).
const EGP_RE = /^\d+(\.\d{1,2})?$/;

// ------------------------------------------------------------- المعالج
export interface BotExchangeDeps {
  client: BotExchangeRpcClient;
  bridgeTokenOf: () => Promise<string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
}

/**
 * معالج طلبات ممر البوت — بيتركب في api.ts على مسارات
 * /wallet/bot-exchange-*. بيرجع null لو المسار مش بتاعه (نفس نمط
 * handleBotSmsRequest).
 */
export async function handleBotExchangeRequest(
  req: Request,
  deps: BotExchangeDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isCandidates = path.endsWith("/wallet/bot-exchange-candidates");
  const isClaim = path.endsWith("/wallet/bot-exchange-claim");
  const isUnclaim = path.endsWith("/wallet/bot-exchange-unclaim");
  if (!isCandidates && !isClaim && !isUnclaim) return null;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  // بوابة الجسر: نفس اعتماد النظامين القائم — مش توكن أدمن ومش
  // مفتاح عميل. غياب الضبط = النقطة مقفولة تمامًا.
  const expected = (await deps.bridgeTokenOf()) || "";
  if (!expected) {
    return json({ ok: false, error: "bridge_not_configured" }, 503);
  }
  if (!secretEquals(req.headers.get("x-bridge-token") || "", expected)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    event_id?: unknown;
    bot_topup_id?: unknown;
    expected_egp?: unknown;
    topup_created_at?: unknown;
  };

  try {
    if (isCandidates) {
      const rawLimit = typeof body.limit === "number" ? body.limit : 100;
      const limit = Math.min(Math.max(Math.trunc(rawLimit) || 100, 1), 200);
      const result = await deps.client.callCandidates(limit);
      return json({ ok: true, ...result });
    }

    // الحجز/فكه: تحقق شكلي صارم قبل الـ RPC (الـ RPC بيتحقق دلاليًا).
    const eventId = String(body.event_id || "").trim();
    const topupId = String(body.bot_topup_id || "").trim();
    if (isUnclaim) {
      // فك الحجز التعويضي: معرّفان بس — والـ RPC بيحسم الحالة
      // (بيفك بس لو لسه محجوز للبوت ده بالحرف — غير كده رفض).
      if (!UUID_RE.test(eventId) || !topupId || topupId.length > 64) {
        return json({ ok: false, error: "invalid_body" }, 400);
      }
      const result = await deps.client.callUnclaim({
        p_event_id: eventId,
        p_bot_topup_id: topupId,
      });
      // نتيجة الـ RPC حرفيًا (unclaimed / reason …).
      return json({ ok: true, ...result });
    }
    const expectedEgp = typeof body.expected_egp === "number"
      ? String(body.expected_egp)
      : String(body.expected_egp || "").trim();
    const topupCreatedAt = String(body.topup_created_at || "").trim();
    if (!UUID_RE.test(eventId) || !topupId || topupId.length > 64) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    if (!EGP_RE.test(expectedEgp) || Number(expectedEgp) <= 0) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    if (
      !topupCreatedAt || topupCreatedAt.length > 64 ||
      Number.isNaN(Date.parse(topupCreatedAt))
    ) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    const result = await deps.client.callClaim({
      p_event_id: eventId,
      p_bot_topup_id: topupId,
      p_expected_egp: expectedEgp,
      p_topup_created_at: topupCreatedAt,
    });
    // نتيجة الـ RPC حرفيًا (claimed / reason …).
    return json({ ok: true, ...result });
  } catch (e) {
    deps.logError("wallet.bot_exchange", "bot exchange route failed", e, {
      path,
    });
    return json({ ok: false, error: "rpc_failed" }, 502);
  }
}
