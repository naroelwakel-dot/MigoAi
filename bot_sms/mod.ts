/**
 * إيصالات رسائل لشحن محفظة البوت — نقطتان ضيّقتان لممر البوت:
 *   POST /wallet/bot-sms-candidates — إيصالات موثّقة لسه ما
 *     اتستهلكتش في أي سطح (هجرة 017: bot_sms_candidates).
 *   POST /wallet/bot-sms-claim — حجز ذرّي لإيصال واحد لطلب شحن
 *     بوت واحد (bot_sms_claim): الحجز هو علامة الاستهلاك نفسها،
 *     فإيصال واحد مستحيل يقيّد رصيدين عبر الأسطح الثلاثة.
 *
 * المستدعي الوحيد هو ممر الشحن التلقائي في بوت التليجرام
 * (wallet/sms_auto)، والمصادقة هي توكن الجسر القائم بين النظامين
 * أصلًا (x-bridge-token مقابل SHEERID_BRIDGE_TOKEN / صف
 * backend_config ‏sheerid_bridge_token — نفس اعتماد جسر SheerID،
 * فمفيش سر جديد). النقطتان مش بيقرروا أي فلوس: المرشّحون حقائق
 * بوابة جاهزة، والحجز علامة استهلاك — قرار القيد نفسه عند البوت
 * بمسار محفظته القائم.
 *
 * فشل مقفول: التوكن مش مضبوط = 503، غلط/غايب = 401، وأي فشل
 * قاعدة = 502 والممر بيأجّل لدورته الجاية — مفيش حجز نص-نص أبدًا
 * (الـ RPC معاملة واحدة).
 */

// ------------------------------------------------------------- عميل RPC
export interface BotSmsRpcClient {
  callCandidates(limit: number): Promise<Record<string, unknown>>;
  callClaim(args: {
    p_event_id: string;
    p_bot_topup_id: string;
    p_partner_id: string | null;
    p_basis: string | null;
  }): Promise<Record<string, unknown>>;
}

interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

/** عميل PostgREST بنفس نمط PostgrestSmsClient في جسر الرسائل. */
export class PostgrestBotSmsClient implements BotSmsRpcClient {
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
    return this.rpc("bot_sms_candidates", { p_limit: limit });
  }
  callClaim(args: Parameters<BotSmsRpcClient["callClaim"]>[0]) {
    return this.rpc("bot_sms_claim", { ...args });
  }
}

/** مقارنة زمنية ثابتة للسر (نفس مساعد جسر الرسائل). */
function secretEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ------------------------------------------------------------- المعالج
export interface BotSmsDeps {
  client: BotSmsRpcClient;
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
 * /wallet/bot-sms-*. بيرجع null لو المسار مش بتاعه (نفس نمط
 * handleSmsRequest).
 */
export async function handleBotSmsRequest(
  req: Request,
  deps: BotSmsDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isCandidates = path.endsWith("/wallet/bot-sms-candidates");
  const isClaim = path.endsWith("/wallet/bot-sms-claim");
  if (!isCandidates && !isClaim) return null;
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
    partner_id?: unknown;
    basis?: unknown;
  };

  try {
    if (isCandidates) {
      const rawLimit = typeof body.limit === "number" ? body.limit : 100;
      const limit = Math.min(Math.max(Math.trunc(rawLimit) || 100, 1), 200);
      const result = await deps.client.callCandidates(limit);
      return json({ ok: true, ...result });
    }

    // الحجز: تحقق شكلي صارم قبل الـ RPC (الـ RPC بيتحقق دلاليًا).
    const eventId = String(body.event_id || "").trim();
    const topupId = String(body.bot_topup_id || "").trim();
    const partnerRaw = body.partner_id
      ? String(body.partner_id).trim()
      : "";
    const basisRaw = body.basis ? String(body.basis).trim() : "";
    if (!UUID_RE.test(eventId) || !topupId || topupId.length > 64) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    if (partnerRaw && !UUID_RE.test(partnerRaw)) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    if (basisRaw && basisRaw !== "dual_channel" &&
      basisRaw !== "trusted_sender") {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    const result = await deps.client.callClaim({
      p_event_id: eventId,
      p_bot_topup_id: topupId,
      p_partner_id: partnerRaw || null,
      p_basis: basisRaw || null,
    });
    // نتيجة الـ RPC حرفيًا (claimed / reason …).
    return json({ ok: true, ...result });
  } catch (e) {
    deps.logError("wallet.bot_sms", "bot sms route failed", e, {
      path,
    });
    return json({ ok: false, error: "rpc_failed" }, 502);
  }
}
