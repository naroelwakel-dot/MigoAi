/**
 * لوحة التحكم — المرحلة م٠: نقطة تجميع الرئيسية «مهامي الآن».
 *   GET /control/home — عدّادات حقيقية من قاعدة الموقع + عدّادات
 *     البوت، في رد واحد يرسم شاشة «مهامي الآن» في control.html.
 *
 * المصادقة: ترويسة x-migo-admin بنفس فاحص باقي مسارات الإدارة في
 * api.ts (يُمرَّر كدالة isAdmin) — مفيش سر جديد ومفيش مفتاح عميل.
 *
 * مصادر عدّادات الموقع (قراءة بس بمفتاح الخدمة، نفس نمط باقي
 * الوحدات):
 *   - شحنات المحفظة المنتظرة: wallet_topups بحالة pending (نفس
 *     طابور wallet-admin) + أحدث ١٠ صفوف للقائمة.
 *   - رسائل دفع لسه متربطتش: wallet_sms_events بحالة
 *     match_state='unmatched' وكل علامات الاستهلاك فاضية والمبلغ
 *     معروف (نفس تعريف «لسه ما اتستهلكتش» في مرشّحي هجرة 017).
 *   - طلبات موقع جديدة: orders بحالة 'new'.
 *   - إيداعات منصات لسه متربطتش: wallet_deposit_events بنتائج
 *     received/no_matching_intent/intent_expired ومن غير أي حجز
 *     (claim_id فاضي وmatched_bot_topup_id فاضي) — وصلت ولسه ما
 *     اتشحنتش لحد.
 *   - آخر رسالة تليفون وصلت: أكبر ingested_at في wallet_sms_events.
 *   - آخر إيداع منصة وصل: أكبر created_at في wallet_deposit_events.
 *
 * عدّادات البوت: نداء خادمي لنقطة البوت GET /api/control/home
 * بنفس اعتماد جسر SheerID القائم بين النظامين (الرابط من
 * SHEERID_BRIDGE_URL والتوكن من SHEERID_BRIDGE_TOKEN أو صف
 * backend_config ‏sheerid_bridge_token — بيتحلّوا في api.ts
 * ويتجابوا هنا كدوال). الرد بيعدّي زي ما هو في حقل bot. فشل
 * النداء لأي سبب = bot: null وعلم bot_unavailable — ممنوع اختراع
 * أرقام بوت أبدًا.
 *
 * شكل رد البوت المتوقع (بيتبني على ناحية البوت):
 *   { ok: true, generated_at, pending_topups, flagged_topups,
 *     failed_orders, unanswered_conversations, manual_orders }
 * أي حقل ناقص من ناحية البوت بيظهر في الواجهة «غير متاح» — مش صفر.
 */

// ------------------------------------------------------------- البيانات
export interface PendingTopupRow {
  id: string;
  amount_egp: number | string | null;
  payment_method: string | null;
  sender_account: string | null;
  transfer_ref: string | null;
  created_at: string | null;
}

export interface ControlStoreData {
  pending_topups_count: number;
  pending_topups: PendingTopupRow[];
  unmatched_sms: number;
  new_orders: number;
  unmatched_exchange: number;
  latest_sms_at: string | null;
  latest_deposit_at: string | null;
}

export interface ControlStoreClient {
  fetchStoreData(): Promise<ControlStoreData>;
}

export interface BotHomeClient {
  fetchHome(): Promise<Record<string, unknown>>;
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

/**
 * بيقرا الإجمالي من ترويسة Content-Range بتاعة PostgREST
 * (شكلها «0-0/123»). غياب/خربانة = الرقم الاحتياطي.
 */
export function parseCountRange(
  header: string | null,
  fallback: number,
): number {
  if (!header) return fallback;
  const slash = header.lastIndexOf("/");
  if (slash < 0) return fallback;
  const total = Number(header.slice(slash + 1));
  return Number.isFinite(total) && total >= 0 ? total : fallback;
}

/** عميل قراءة PostgREST بنفس نمط عملاء الوحدات التانية. */
export class PostgrestControlClient implements ControlStoreClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }

  private async get(
    path: string,
    countExact: boolean,
  ): Promise<{ rows: Record<string, unknown>[]; total: number | null }> {
    const headers: Record<string, string> = {
      "apikey": this.opts.keyOf(),
      "Authorization": `Bearer ${this.opts.keyOf()}`,
      "Accept": "application/json",
    };
    if (countExact) headers["Prefer"] = "count=exact";
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      headers,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`control read http ${res.status}: ${text.slice(0, 200)}`);
    }
    let rows: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) rows = parsed as Record<string, unknown>[];
    } catch {
      rows = [];
    }
    return {
      rows,
      total: countExact
        ? parseCountRange(res.headers.get("content-range"), rows.length)
        : null,
    };
  }

  private async count(path: string): Promise<number> {
    const { total } = await this.get(`${path}&limit=1`, true);
    return total ?? 0;
  }

  async fetchStoreData(): Promise<ControlStoreData> {
    // أحدث ١٠ شحنات منتظرة + العدّ الإجمالي من ترويسة نفس النداء.
    const pending = await this.get(
      "wallet_topups?status=eq.pending" +
        "&select=id,amount_egp,payment_method,sender_account,transfer_ref,created_at" +
        "&order=created_at.desc&limit=10",
      true,
    );
    const pendingItems = pending.rows as unknown as PendingTopupRow[];

    const [unmatchedSms, newOrders, unmatchedExchange, latestSms, latestDep] =
      await Promise.all([
        this.count(
          "wallet_sms_events?match_state=eq.unmatched" +
            "&matched_topup_id=is.null&matched_order_id=is.null" +
            "&matched_bot_topup_id=is.null&amount_egp=not.is.null&select=id",
        ),
        this.count("orders?status=eq.new&select=id"),
        this.count(
          "wallet_deposit_events?outcome=in.(received,no_matching_intent,intent_expired)" +
            "&claim_id=is.null&matched_bot_topup_id=is.null&select=id",
        ),
        this.get(
          "wallet_sms_events?select=ingested_at&order=ingested_at.desc&limit=1",
          false,
        ),
        this.get(
          "wallet_deposit_events?select=created_at&order=created_at.desc&limit=1",
          false,
        ),
      ]);

    return {
      pending_topups_count: pending.total ?? pending.rows.length,
      pending_topups: pendingItems,
      unmatched_sms: unmatchedSms,
      new_orders: newOrders,
      unmatched_exchange: unmatchedExchange,
      latest_sms_at: (latestSms.rows[0]?.ingested_at as string) || null,
      latest_deposit_at: (latestDep.rows[0]?.created_at as string) || null,
    };
  }
}

// ------------------------------------------------- عميل البوت (الجسر)
export interface BotBridgeOptions {
  baseUrlOf: () => string; // SHEERID_BRIDGE_URL بعد فرض https (sheerid/config)
  bridgeTokenOf: () => Promise<string>; // env أولًا وإلا backend_config
  timeoutMs?: number;
}

/**
 * بينده نقطة البوت الداخلية GET /api/control/home بنفس اعتماد
 * الجسر القائم (ترويسة x-bridge-token). أي فشل (ضبط ناقص/شبكة/
 * حالة/رد مش سليم) بيترفع كاستثناء — المعالج بيحوّله لـ bot: null.
 */
export class BridgeBotControlClient implements BotHomeClient {
  private opts: BotBridgeOptions;
  constructor(opts: BotBridgeOptions) {
    this.opts = opts;
  }
  async fetchHome(): Promise<Record<string, unknown>> {
    const base = (this.opts.baseUrlOf() || "").replace(/\/+$/, "");
    const token = (await this.opts.bridgeTokenOf()) || "";
    if (!base || !token) throw new Error("bot bridge not configured");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? 8000,
    );
    try {
      const res = await fetch(`${base}/api/control/home`, {
        method: "GET",
        headers: {
          "x-bridge-token": token,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`bot control home http ${res.status}`);
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new Error("bot control home bad response");
      }
      const obj = json as Record<string, unknown>;
      if (obj.ok !== true) throw new Error("bot control home not ok");
      return obj;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ------------------------------------------------------------- المعالج
export interface ControlDeps {
  client: ControlStoreClient;
  botClient: BotHomeClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
}

/**
 * معالج رئيسية اللوحة — بيتركب في api.ts على GET /control/home.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlHomeRequest(
  req: Request,
  deps: ControlDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/control/home")) return null;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...deps.corsOf(req),
      },
    });
  if (req.method !== "GET") return json({ ok: false, error: "method" }, 405);
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let store: ControlStoreData;
  try {
    store = await deps.client.fetchStoreData();
  } catch (e) {
    deps.logError("control.home", "store data failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }

  // البوت اختياري في الرد: فشله بيعلّم بعلم بس — أرقامه ما بتتخترعش.
  let bot: Record<string, unknown> | null = null;
  let botUnavailable = false;
  try {
    bot = await deps.botClient.fetchHome();
  } catch (e) {
    botUnavailable = true;
    deps.logError("control.home", "bot home unavailable", e);
  }

  return json({
    ok: true,
    generated_at: new Date().toISOString(),
    store,
    bot,
    bot_unavailable: botUnavailable,
  });
}
