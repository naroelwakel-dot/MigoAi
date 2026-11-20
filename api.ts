// control phase م١-ب (2026-11-20): /control money endpoints (bot + store money settings, lost topups/events search, manual topup match proxy) in control/money.ts
// control phase م١-أ (2026-11-19): /control customers + wallets endpoints (store customer file, topup decisions, wallet adjust, bot proxies, unified search) in control/customers.ts
// control phase 0 (2026-11-19): GET /control/home aggregation endpoint for the control panel (control.html) + x-migo-admin added to CORS allow-headers
// redeploy trigger 2026-11-19b: force Deno promotion of merge #14 (provenance feed DB-only) after the 15/hour deploy cap blocked its first attempts
// env refresh 2026-11-18d: DRAYIK_API_KEY added + Gmail joined the auto-buy allowlist
// env refresh 2026-11-18c: Package 6 Deno steps complete (10/10) - executor armed for outlook-hotmail-accounts
// env refresh 2026-11-18b: SUPABASE_SERVICE_ROLE_KEY set by owner (Package 6 step 1)
// Migo AI Solution - Deno service (verification + /chat). Rebuild marker: chat-live-7
// env refresh 2026-11-18: LOG_WRITE_KEY rotated (owner set the new value in Deno; DB hash updated to match) — redeploy so the running isolate picks up the new env snapshot.
// build marker 2026-10-31T07:10Z: add a fire-and-forget usage counter (one row per provider attempt
// in Supabase public.verification_calls) so we can measure real per-source usage (free vs Volsever).
// Also: free sources (isan/jollymax) are tried before the metered Volsever route for the games they
// cover (pubg/freefire/mlbb/codm/valorant/genshin). Normal fallback order otherwise unchanged.
// ==============================================================================
// Migo AI Solution - Verification Engine API (Deno Server)
// Real account lookup only. No fabricated / placeholder names.
// Provider chain per game: Volsever gateway (VOLSEVER_API_KEY) -> NeferByte
// (NEFERBYTE_API_KEY) -> free fallbacks (isan / JollyMax / official). If a game
// has no reachable source, we return an honest, non-alarming "type it manually"
// and the storefront lets the customer continue.

// ---------------------------------------------------------------------------
// الحزمة 11 — جسر رسائل إيداع المحفظة (SMS Bridge).
// تطبيق على موبايل المالك بيبعت رسائل «استلام فلوس» (فودافون كاش…)
// لـ POST /wallet/sms بهيدر x-migo-sms-key (SMS_BRIDGE_KEY في البيئة —
// اعتماد ضيّق للموبايل بس، مش ADMIN_TOKEN). الخلفية بتحلّل الرسالة
// وبتنادي wallet_ingest_sms بمفتاح الخدمة: المطابقة مع طلبات شحن
// المحفظة والشحن التلقائي بيحصلوا في القاعدة (هجرة 013).
// غياب أي سر من الاتنين = المسار مقفول (503) — مفيش إدخال مجهول.
// ---------------------------------------------------------------------------
import { handleSmsRequest, PostgrestSmsClient, type SmsDeps } from "./sms_bridge/mod.ts";
import { handleBotSmsRequest, PostgrestBotSmsClient, type BotSmsDeps } from "./bot_sms/mod.ts";
import { handleBotExchangeRequest, PostgrestBotExchangeClient, type BotExchangeDeps } from "./bot_exchange/mod.ts";
import {
  handlePriceFloorRequest,
  PostgrestPriceFloorClient,
  type PriceFloorDeps,
} from "./price_floors/mod.ts";
import {
  BridgeBotControlClient,
  type ControlDeps,
  handleControlHomeRequest,
  PostgrestControlClient,
} from "./control/mod.ts";
import {
  BridgeBotControlProxyClient,
  type ControlCustomersDeps,
  handleControlCustomersRequest,
  PostgrestControlCustomersClient,
} from "./control/customers.ts";
import {
  type ControlMoneyDeps,
  handleControlMoneyRequest,
  PostgrestControlMoneyClient,
} from "./control/money.ts";
import { bridgeBaseUrl } from "./sheerid/config.ts";
import { makeAdminChecker, tokenEquals } from "./admin_auth.ts";

let _smsDeps: SmsDeps | null = null;
function getSmsDeps(): SmsDeps {
  if (_smsDeps) return _smsDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  _smsDeps = {
    client: new PostgrestSmsClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    bridgeKeyOf: () => env("SMS_BRIDGE_KEY"),
    logError,
  };
  return _smsDeps;
}

// ---------------------------------------------------------------------------
// إيصالات رسائل لشحن محفظة البوت (هجرة 017): مرشّحون + حجز ذرّي
// لممر الشحن التلقائي في بوت التليجرام. المصادقة = توكن الجسر
// القائم بين النظامين (نفس قيمة جسر SheerID: متغير البيئة أولًا،
// وإلا صف backend_config — مصدر الحقيقة اللي اتزرع في هجرة 019).
// ---------------------------------------------------------------------------
let _botSmsDeps: BotSmsDeps | null = null;
function getBotSmsDeps(): BotSmsDeps {
  if (_botSmsDeps) return _botSmsDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  _botSmsDeps = {
    client: new PostgrestBotSmsClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    bridgeTokenOf: async () => {
      const fromEnv = env("SHEERID_BRIDGE_TOKEN");
      if (fromEnv) return fromEnv;
      try {
        const key = env("SUPABASE_SERVICE_ROLE_KEY");
        const res = await fetch(
          `${SB_URL}/rest/v1/backend_config?key=eq.sheerid_bridge_token&select=value`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        if (!res.ok) return "";
        const rows = await res.json();
        return (Array.isArray(rows) && rows[0]?.value)
          ? String(rows[0].value)
          : "";
      } catch {
        return "";
      }
    },
    logError,
  };
  return _botSmsDeps;
}

// ---------------------------------------------------------------------------
// إيداعات منصات لشحن محفظة البوت (هجرة 018): مرشّحون + حجز ذرّي
// لممر شحن المنصات التلقائي في البوت. المصادقة = توكن الجسر
// القائم بين النظامين (نفس مصدر نسخة الإيصالات فوق بالحرف:
// متغير البيئة أولًا، وإلا صف backend_config).
// ---------------------------------------------------------------------------
let _botExchangeDeps: BotExchangeDeps | null = null;
function getBotExchangeDeps(): BotExchangeDeps {
  if (_botExchangeDeps) return _botExchangeDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  _botExchangeDeps = {
    client: new PostgrestBotExchangeClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    bridgeTokenOf: async () => {
      const fromEnv = env("SHEERID_BRIDGE_TOKEN");
      if (fromEnv) return fromEnv;
      try {
        const key = env("SUPABASE_SERVICE_ROLE_KEY");
        const res = await fetch(
          `${SB_URL}/rest/v1/backend_config?key=eq.sheerid_bridge_token&select=value`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        if (!res.ok) return "";
        const rows = await res.json();
        return (Array.isArray(rows) && rows[0]?.value)
          ? String(rows[0].value)
          : "";
      } catch {
        return "";
      }
    },
    logError,
  };
  return _botExchangeDeps;
}

// ---------------------------------------------------------------------------
// لوحة التحكم (المرحلة م٠): تجميع رئيسية «مهامي الآن» — عدّادات
// الموقع من قاعدته بمفتاح الخدمة، وعدّادات البوت بنداء خادمي لنقطة
// البوت /api/control/home بنفس اعتماد الجسر القائم (الرابط من
// SHEERID_BRIDGE_URL بفرض https، والتوكن بنفس حلّال نسختي
// bot-sms/bot-exchange فوق: البيئة أولًا وإلا backend_config).
// المصادقة على النقطة نفسها = فاحص x-migo-admin المشترك (isAdmin).
// ---------------------------------------------------------------------------
let _controlDeps: ControlDeps | null = null;
function getControlDeps(): ControlDeps {
  if (_controlDeps) return _controlDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  const bridgeTokenOf = async (): Promise<string> => {
    const fromEnv = env("SHEERID_BRIDGE_TOKEN");
    if (fromEnv) return fromEnv;
    try {
      const key = env("SUPABASE_SERVICE_ROLE_KEY");
      const res = await fetch(
        `${SB_URL}/rest/v1/backend_config?key=eq.sheerid_bridge_token&select=value`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) return "";
      const rows = await res.json();
      return (Array.isArray(rows) && rows[0]?.value)
        ? String(rows[0].value)
        : "";
    } catch {
      return "";
    }
  };
  _controlDeps = {
    client: new PostgrestControlClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    botClient: new BridgeBotControlClient({
      baseUrlOf: () => bridgeBaseUrl((n) => Deno.env.get(n)),
      bridgeTokenOf,
    }),
    isAdmin,
    corsOf: (r: Request) => corsHeaders(r),
    logError,
  };
  return _controlDeps;
}

// ---------------------------------------------------------------------------
// لوحة التحكم (المرحلة م١-أ): العملاء والمحافظ — ملف عميل الموقع من
// قاعدته (وهويته من GoTrue Admin)، وقرارات الشحن وتعديل الرصيد
// بدوال القاعدة الداخلية (هجرة 022)، وأفعال البوت بتمرير خادمي
// لنقاطه الداخلية بنفس اعتماد الجسر (الرابط والتوكن زي رئيسية
// اللوحة فوق بالظبط). المصادقة = فاحص x-migo-admin المشترك جوه
// المعالج نفسه.
// ---------------------------------------------------------------------------
let _controlCustomersDeps: ControlCustomersDeps | null = null;
function getControlCustomersDeps(): ControlCustomersDeps {
  if (_controlCustomersDeps) return _controlCustomersDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  const bridgeTokenOf = async (): Promise<string> => {
    const fromEnv = env("SHEERID_BRIDGE_TOKEN");
    if (fromEnv) return fromEnv;
    try {
      const key = env("SUPABASE_SERVICE_ROLE_KEY");
      const res = await fetch(
        `${SB_URL}/rest/v1/backend_config?key=eq.sheerid_bridge_token&select=value`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) return "";
      const rows = await res.json();
      return (Array.isArray(rows) && rows[0]?.value)
        ? String(rows[0].value)
        : "";
    } catch {
      return "";
    }
  };
  _controlCustomersDeps = {
    client: new PostgrestControlCustomersClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    botClient: new BridgeBotControlProxyClient({
      baseUrlOf: () => bridgeBaseUrl((n) => Deno.env.get(n)),
      bridgeTokenOf,
    }),
    isAdmin,
    corsOf: (r: Request) => corsHeaders(r),
    logError,
  };
  return _controlCustomersDeps;
}

// ---------------------------------------------------------------------------
// لوحة التحكم (المرحلة م١-ب): إعدادات الفلوس + بحث الشحنة الضايعة —
// إعدادات المتجر من wallet_settings نفسها بتحقق لكل مفتاح، وإعدادات
// البوت والمطابقة اليدوية بتمرير خادمي لنقاطه الداخلية، والتدقيق
// بيتبعت لسجل البوت الموحد. اعتماد الجسر والمصادقة زي م١-أ بالظبط.
// ---------------------------------------------------------------------------
let _controlMoneyDeps: ControlMoneyDeps | null = null;
function getControlMoneyDeps(): ControlMoneyDeps {
  if (_controlMoneyDeps) return _controlMoneyDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  const bridgeTokenOf = async (): Promise<string> => {
    const fromEnv = env("SHEERID_BRIDGE_TOKEN");
    if (fromEnv) return fromEnv;
    try {
      const key = env("SUPABASE_SERVICE_ROLE_KEY");
      const res = await fetch(
        `${SB_URL}/rest/v1/backend_config?key=eq.sheerid_bridge_token&select=value`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) return "";
      const rows = await res.json();
      return (Array.isArray(rows) && rows[0]?.value)
        ? String(rows[0].value)
        : "";
    } catch {
      return "";
    }
  };
  _controlMoneyDeps = {
    client: new PostgrestControlMoneyClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    botClient: new BridgeBotControlProxyClient({
      baseUrlOf: () => bridgeBaseUrl((n) => Deno.env.get(n)),
      bridgeTokenOf,
    }),
    isAdmin,
    corsOf: (r: Request) => corsHeaders(r),
    logError,
  };
  return _controlMoneyDeps;
}

// ---------------------------------------------------------------------------
// منفّذ حدّ الأسعار الأدنى للمتجر (Price-Floor Applier) — نقطة إدارية
// POST /catalog/apply-price-floors بيندهها مجدول خارجي (نفس نمط
// /exec/sweep ومسارات المحفظة): بترفع سعر كتالوج المتجر لأرضية سجل
// المصدر (ceil(cost × 82.5)) لو نزل تحتها، ومش بتخفّض أبدًا. مصدر
// الخريطة والتكلفة هو تغذية المصدر المقروءة من السيرفر نفسه —
// المعالج ما بيقراش جسم الطلب أصلًا فمفيش تكلفة من المستدعي بتعدّي
// (تقوية اللجنة، الحزمة التانية). مصدر التغذية الوحيد: جدول
// provenance_feed في قاعدة المتجر (هجرة 021 — الملف الثابت
// المنشور كان في مستودع عام فخريطة الموردين والتكاليف كانت مكشوفة،
// F-01/D-05؛ الاحتياطي بالرابط العام اتشال بعد إثبات مسار القاعدة
// حيًا). جدول فاضي/غايب/لقطة قديمة = المصدر بيرجّع null والجولة
// بتتجهض Fail-Closed من غير أي كتابة. والكتابة الوحيدة عبر RPC
// ‏apply_price_floor (هجرة 017) بمفتاح الخدمة. التفاصيل في
// price_floors/mod.ts.
// ---------------------------------------------------------------------------
let _priceFloorDeps: PriceFloorDeps | null = null;
function getPriceFloorDeps(): PriceFloorDeps {
  if (_priceFloorDeps) return _priceFloorDeps;
  const env = (n: string) => Deno.env.get(n) || "";
  _priceFloorDeps = {
    registry: new JsonRegistrySource(dbFeedLoader({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    })),
    client: new PostgrestPriceFloorClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    }),
    logError,
  };
  return _priceFloorDeps;
}

// ==============================================================================

// ---------------------------------------------------------------------------
// الحزمة 6 — منفّذ الشراء التلقائي للموقع (إطلاق تدريجي، افتراضيًا مقفول).
// نفس سجل المصدر ونفس فحوصات محرك البوت، بمرآة TypeScript مختبَرة.
// التفعيل بمتغيرات البيئة بس: STORE_AUTO_BUY_ENABLED=1 + قائمة منتجات.
// الأسرار من البيئة بس (أسماءها في OWNER-GATE.md) — ممنوع أي قيمة هنا.
// ---------------------------------------------------------------------------
import {
  createExecutor,
  createNotifyCustomer,
  dbFeedLoader,
  DrayikAdapter,
  FeedAvailabilitySource,
  FetchTransport,
  flagsFromEnv,
  GenericHttpAdapter,
  handleExecRequest,
  JsonRegistrySource,
  notifyConfigFromEnv,
  PostgrestRefundClient,
  PostgrestStoreDb,
  refundOrderHook,
  TunVNAdapter,
  urlLoader,
  WasmouAdapter,
  type StoreExecutor,
} from "./store_executor/mod.ts";

// ---------------------------------------------------------------------------
// تحقق SheerID على الموقع (منتج Google Student) — نفس أتمتة البوت
// بنفس العقد والتسويات: حالة/إرسال للعميل من صفحة الفاتورة بإثبات
// ملكية الطلب، إشعار مورد، ومسح دوري بترويسة الأدمن. التنفيذ عبر
// جسر البوت (توكن الجسر من جدول backend_config — البوت بينفّذ بمفتاح
// المورد اللي عنده)، وSHEERID_API_KEY في بيئة Deno تجاوز مباشر اختياري.
// غياب أي مصدر تنفيذ = الميزة مقفولة fail-closed والطلبات بتتكمّل
// يدويًا بصياغة معلنة.
// ---------------------------------------------------------------------------
import {
  buildSheeridFromEnvAsync,
  handleSheeridRequest,
  type SheeridHandlerDeps,
} from "./sheerid/mod.ts";

let _sheeridDeps: SheeridHandlerDeps | null = null;
let _sheeridDepsPromise: Promise<SheeridHandlerDeps> | null = null;
async function getSheeridDeps(): Promise<SheeridHandlerDeps> {
  if (_sheeridDeps) return _sheeridDeps;
  if (!_sheeridDepsPromise) {
    _sheeridDepsPromise = (async () => {
      const wiring = await buildSheeridFromEnvAsync({
        env: (n: string) => Deno.env.get(n) || "",
        sbUrl: SB_URL,
        logError,
      });
      _sheeridDeps = {
        service: wiring.service,
        orders: wiring.orders,
        isAuthorized: isSheeridAdmin,
        headersOf: (req: Request) => corsHeaders(req),
        logError,
        // سر إشعار المورد (إصلاح اللجنة #6): فاضي = callback بالسلوك
        // القديم + تحذير سجل — الضبط عند المورد خطوة مالك.
        callbackSecret: Deno.env.get("SHEERID_CALLBACK_SECRET") || "",
      };
      return _sheeridDeps;
    })();
    // إصلاح اللجنة #8: وعد بناء مرفوض ما يفضلش متخزّن للأبد —
    // بنصفّيه عشان الطلب الجاي يعيد البناء بدل ما المسارات تفضل
    // مكسورة لعمر الـ isolate كله.
    _sheeridDepsPromise.catch(() => {
      if (!_sheeridDeps) _sheeridDepsPromise = null;
    });
  }
  return _sheeridDepsPromise;
}


let _executor: StoreExecutor | null = null;
function getExecutor(): StoreExecutor {
  if (_executor) return _executor;
  const env = (n: string) => Deno.env.get(n) || "";
  const transport = new FetchTransport(15000);
  const adapters = new Map();
  // Bunny: المحوّل العام بنفس تهيئة صف المورد في قاعدة البوت (الأجزاء
  // غير السرية في BUNNY_ADAPTER_CONFIG كـ JSON، والسر في BUNNY_API_KEY).
  try {
    const bunnyCfg = JSON.parse(env("BUNNY_ADAPTER_CONFIG") || "null");
    if (bunnyCfg) {
      adapters.set("bunny", new GenericHttpAdapter(
        transport, () => env("BUNNY_API_KEY"), bunnyCfg, "bunny"));
    }
  } catch (e) { logError("store_exec.init", "bunny adapter config invalid", e); }
  if (env("DRAYIK_API_KEY")) {
    adapters.set("drayik", new DrayikAdapter(transport, () => env("DRAYIK_API_KEY")));
  }
  if (env("TUNVN_API_KEY")) {
    adapters.set("tunvn", new TunVNAdapter(transport, () => env("TUNVN_API_KEY")));
  }
  if (env("WASMU_API_KEY")) {
    adapters.set("wasmou", new WasmouAdapter(transport, () => env("WASMU_API_KEY")));
  }
  const storeDb = new PostgrestStoreDb({
    baseUrl: SB_URL,
    // مفتاح خدمة من البيئة بس — SB_KEY الحالية publishable وما تكفيش
    // لكتابة التنفيذات؛ غياب المفتاح = المنفّذ مش هيتركب أصلًا.
    keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    triggerStatus: env("STORE_EXEC_TRIGGER_STATUS") || "paid",
  });
  _executor = createExecutor({
    store: storeDb,
    // سجل المصدر: جدول provenance_feed فقط (هجرة 021) — نفس تركيب
    // منفّذ الأسعار فوق. لقطة غايبة/قديمة = registry_unavailable
    // والبند بيتخطّى من غير تنفيذ (Fail-Closed).
    registry: new JsonRegistrySource(dbFeedLoader({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    })),
    availability: new FeedAvailabilitySource(
      urlLoader(env("AVAILABILITY_FEED_URL") || "https://migoai.shop/availability.json")),
    adapters,
    flags: flagsFromEnv((n) => Deno.env.get(n)),
    logError,
    // إشعار العميل (قرار المالك 2026-11-18: واتساب/إيميل): خدمة
    // notify.ts — إيميل Brevo من orders@migoai.shop لإيميل العميل
    // المسجل على الطلب (غياب BREVO_API_KEY أو غياب إيميل على الطلب =
    // تخطّي نضيف وسطح الفاتورة/الحالة هو التأكيد زي v1)، وواتساب
    // Cloud API ورا WHATSAPP_NOTIFY_ENABLED (مقفول افتراضيًا لحد ما
    // المنصة تتهيأ). فشل أي قناة بيتسجّل ومش بيكسر تنفيذًا أبدًا.
    notifyCustomer: createNotifyCustomer({
      store: storeDb,
      config: notifyConfigFromEnv((n) => Deno.env.get(n)),
      http: transport,
      logError,
    }),
    alertAdmin: async (message, context) => {
      logError("store_exec.admin_alert", message, undefined, context);
    },
    // الاسترداد (قرار المالك 2026-11-18: تلقائي كامل): خطاف refund.ts
    // بينده RPC ‏refund_order (هجرة 008) — الفشل النهائي بيتحول
    // refunded مؤكد في القاعدة + صف التزام استرداد دقيق في
    // store_refunds بينفّذ المالك التحويل النقدي الراجع منه بخطوة
    // واحدة (دفع المتجر تحويل يدوي — مفيش بوابة ومفيش نداء بوابة).
    refundOrder: refundOrderHook(storeDb, new PostgrestRefundClient({
      baseUrl: SB_URL,
      keyOf: () => env("SUPABASE_SERVICE_ROLE_KEY"),
    })),
    now: () => new Date(),
  });
  return _executor;
}

// متجر Migo: نسمح بطلبات المتصفح من أصل موقعنا بس (مش "*") عشان مانخليش أي موقع
// تاني يستدعي الـ API من متصفح الزوار. الموقعان (MigoAi و MigoStore) على نفس الأصل.
// ملاحظة: الـ CORS بيتحكم في متصفحات الزوار فقط؛ النداءات من السيرفر (البوت) مش متأثرة.
const ALLOWED_ORIGINS = ["https://migoai.shop", "https://www.migoai.shop", "https://naroelwakel-dot.github.io"];
function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-migo-admin",
    "Vary": "Origin",
  };
}

// --------------------------------------------------------------------------
// حدّ بسيط لعدد الطلبات لكل IP (في الذاكرة، لكل isolate). بيقلل إساءة استخدام
// الـ quota (Volsever/NeferByte/RapidAPI/Gemini) من غير ما يحتاج خدمة خارجية.
// --------------------------------------------------------------------------
const RATE_LIMIT = 60;          // أقصى عدد طلبات
const RATE_WINDOW = 60_000;     // في الدقيقة لكل IP
const RATE_MAP = new Map<string, { n: number; t: number }>();
function rateLimited(req: Request): boolean {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    if (RATE_MAP.size > 5000) RATE_MAP.clear(); // تخلص من النمو الزايد
    const rec = RATE_MAP.get(ip);
    if (!rec || now - rec.t > RATE_WINDOW) { RATE_MAP.set(ip, { n: 1, t: now }); return false; }
    rec.n++;
    return rec.n > RATE_LIMIT;
  } catch (_) { return false; }
}

// أدوات التشخيص (force/debug) متاحة بس لما هيدر x-migo-admin يطابق ADMIN_TOKEN في البيئة.
const ADMIN_TOKEN = (globalThis as any).Deno?.env?.get?.("ADMIN_TOKEN") || "";
function isAdmin(req: Request): boolean {
  const presented = req.headers.get("x-migo-admin");
  return !!ADMIN_TOKEN && !!presented && tokenEquals(presented, ADMIN_TOKEN);
}

// توكنات إدارية خاصة اختيارية لكل مجموعة مسارات (تقوية اللجنة —
// الحزمة التانية؛ الدلالات الكاملة في admin_auth.ts): كل مجموعة
// بتقبل توكنها الخاص أو التوكن المشترك، فالمستدعون الحاليون
// بالترويسة المشتركة (وحدات المسح) بيكملوا شغالين زي ما هم.
const envAdmin = (n: string) => (globalThis as any).Deno?.env?.get?.(n) || "";
const isSheeridAdmin = makeAdminChecker(ADMIN_TOKEN, envAdmin("ADMIN_TOKEN_SHEERID"));
const isWalletAdmin = makeAdminChecker(ADMIN_TOKEN, envAdmin("ADMIN_TOKEN_WALLET"));
const isCatalogAdmin = makeAdminChecker(ADMIN_TOKEN, envAdmin("ADMIN_TOKEN_CATALOG"));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  let res: Response;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
  if (!res.body) {
    clearTimeout(timeoutId);
    return res;
  }
  // Keep the timeout armed until the body has been fully read: a body that
  // stalls mid-download must abort too, not hang the caller forever.
  const body = res.body.pipeThrough(
    new TransformStream({ flush: () => clearTimeout(timeoutId) }),
  );
  return new Response(body, res);
}

// Returns parsed JSON, or null on any error / non-JSON / HTML response.
async function getJson(url: string, options: RequestInit = {}, ms = 6000): Promise<any> {
  try {
    const res = await fetchWithTimeout(url, options, ms);
    const raw = await res.text();
    if (!raw || raw.trim().startsWith("<") || raw.includes("<!DOCTYPE")) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Fire-and-forget usage counter. Records one row per provider attempt in
// Supabase (public.verification_calls) so real usage per source can be measured
// (free vs the metered Volsever route). Never awaited, never throws, and has no
// effect on the response path. Public URL + publishable key (same key the
// storefront already ships in app.js).
// ----------------------------------------------------------------------------
const SB_URL = "https://qjlivjzgrqyitqxcdtlk.supabase.co";
const SB_KEY = "sb_publishable_ezC_W2lpGW88bSbjBRJFfw_reCr3vlw";
function logCall(game: string, provider: string, ok: boolean): void {
  try {
    const key = Deno.env.get("LOG_WRITE_KEY") || "";
    if (!key) {
      // Misconfiguration must be visible in Deno Deploy logs — and must
      // never become an empty-key RPC attempt (the database rejects
      // empty keys anyway). The secret itself is never logged.
      console.warn("logCall skipped: LOG_WRITE_KEY is not set");
      return;
    }
    const p = fetch(`${SB_URL}/rest/v1/rpc/log_verification_call`, {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        p_game: game,
        p_provider: provider,
        p_ok: ok,
        p_key: key,
      }),
    }).then((r) => {
      // Observability without secrets: surface only the HTTP status.
      if (!r.ok) console.warn("logCall RPC failed with status", r.status);
    }).catch((e) => {
      // Network-level failure (DNS, connection refused/reset, timeout).
      // BRG-0011: this used to be an empty catch — network failures
      // vanished silently. Log ONLY the error name: never the key, the
      // request body, or headers.
      console.warn("logCall network error:", (e && e.name) || "unknown");
    });
    // Deno Deploy: keep the isolate alive until the write settles.
    (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  } catch (e) {
    // logCall must never throw into the request handler; it still
    // leaves a trace (error name only) instead of an empty catch.
    console.warn("logCall unexpected error:", (e && (e as Error).name) || "unknown");
  }
}

// ----------------------------------------------------------------------------
// Central error log (public.error_log via the key-gated log_error RPC —
// migration 006, same LOG_WRITE_KEY as logCall). The verify chain's outer
// catch used to swallow every unexpected error silently; now it leaves a
// permanent, reviewable row. Never awaited, never throws, no effect on the
// response path. Only the error name + a scrubbed, capped message are sent:
// never the write key, request bodies, or headers.
// ----------------------------------------------------------------------------
function logError(source: string, message: string, error?: unknown, context?: Record<string, unknown>): void {
  try {
    const key = Deno.env.get("LOG_WRITE_KEY") || "";
    if (!key) {
      console.warn("logError skipped: LOG_WRITE_KEY is not set");
      return;
    }
    const err = error as Error | undefined;
    let errorText: string | null = null;
    if (error != null) {
      errorText = String((err && err.message) || error)
        .split(key).join("***")
        .split(SB_KEY).join("***")
        .slice(0, 500);
    }
    const p = fetch(`${SB_URL}/rest/v1/rpc/log_error`, {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        p_source: String(source || "").slice(0, 64),
        p_message: String(message || "").slice(0, 300),
        p_error_type: err?.name ? String(err.name).slice(0, 128) : null,
        p_error_text: errorText,
        p_context: context || {},
        p_key: key,
      }),
    }).then((r) => {
      if (!r.ok) console.warn("logError RPC failed with status", r.status);
    }).catch((e) => {
      console.warn("logError network error:", (e && e.name) || "unknown");
    });
    (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  } catch (e) {
    console.warn("logError unexpected error:", (e && (e as Error).name) || "unknown");
  }
}

// Pull the first plausible nickname out of an unknown JSON shape.
function extractPlayerName(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  const paths: any[] = [
    data.nickname, data.name, data.username, data.nickName, data.nick_name,
    data.displayName, data.result, data.data,
  ];
  for (const p of paths) {
    if (typeof p === "string" && p.trim()) return p.trim();
    if (p && typeof p === "object") {
      const inner = p.nickname ?? p.name ?? p.username ?? p.nickName ?? p.nick_name ?? p.displayName;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
      const deep = p.data;
      if (deep && typeof deep === "object") {
        const dd = deep.nickname ?? deep.name ?? deep.username ?? deep.nickName ?? deep.nick_name;
        if (typeof dd === "string" && dd.trim()) return dd.trim();
      }
    }
  }
  return "";
}

// أسماء العرض راجعة من منصات خارجية (نيكنيم TikTok/Telegram) وبتتعرض في
// واجهة المتجر — بنشيل منها محارف الـ markup عند حدّ الكاشط نفسه، فمفيش
// اسم مصمم يقدر يشيل <>&"' لأي مستهلك بعد كده (دفاع على طبقتين مع
// الـ escaping في الواجهة).
function cleanDisplayName(name: string): string {
  return String(name || "").replace(/[<>&"']/g, "").trim();
}

// ----------------------------------------------------------------------------
// Real source: TikTok profile (scrape)
// ----------------------------------------------------------------------------
async function resolveTikTokUser(username: string): Promise<{ name: string; avatar: string }> {
  const clean = username.replace(/^@/, "").trim().toLowerCase();
  try {
    const res = await fetchWithTimeout(`https://www.tiktok.com/@${encodeURIComponent(clean)}`, {
      headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9" },
    }, 5000);
    if (res.ok) {
      const html = await res.text();
      let nickname = "";
      let avatar = "";
      const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
      if (scriptMatch && scriptMatch[1]) {
        try {
          const parsed = JSON.parse(scriptMatch[1]);
          const userObj = parsed?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo?.user;
          if (userObj) {
            nickname = userObj.nickname || userObj.uniqueId || clean;
            avatar = userObj.avatarLarger || userObj.avatarMedium || userObj.avatarThumb || "";
            return { name: cleanDisplayName(nickname), avatar };
          }
        } catch (_) {}
      }
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogTitle && ogTitle[1]) nickname = ogTitle[1].replace(/\s*\(@[^)]+\).*$/, "").replace(/\| TikTok$/, "").trim();
      if (ogImage && ogImage[1]) avatar = ogImage[1].replace(/&amp;/g, "&");
      if (nickname) return { name: cleanDisplayName(nickname), avatar };
    }
  } catch (_) {}
  return { name: "", avatar: "" };
}

// ----------------------------------------------------------------------------
// Real source: Telegram public profile (scrape)
// ----------------------------------------------------------------------------
// [gemini-fix-1] BEGIN telegram template guard
// t.me serves a generic preview page for usernames that do NOT exist:
// og:title is the fixed template "Telegram: Contact @<username>" — the
// requested handle echoed back — and og:image is Telegram's default
// placeholder "https://telegram.org/img/t_logo_2x.png". A real account
// returns its own display name (e.g. "Pavel Durov") and, when a photo is
// set, a CDN photo URL instead (verified live 2026-11-17 against a
// nonexistent handle and @durov). Treating the template as a found
// account made the ID check report nonexistent Telegram usernames as
// "verified", so it is rejected here and the caller falls back to the
// honest success:false manual-name path.
const TELEGRAM_DEFAULT_AVATAR = "https://telegram.org/img/t_logo_2x.png";
function isTelegramGenericTemplate(name: string, avatar: string, clean: string): boolean {
  const n = name.trim();
  const handle = clean.toLowerCase();
  // The fixed t.me template, with the requested handle echoed into it.
  if (/^telegram:\s*contact\s+@/i.test(n)) return true;
  if (n.toLowerCase() === `telegram: contact @${handle}`) return true;
  // The "name" is nothing but the requested handle echoed back.
  if (n === clean || n === `@${clean}`) return true;
  // Default placeholder avatar + a name that is only the echoed handle.
  if (avatar === TELEGRAM_DEFAULT_AVATAR && n.replace(/^@/, "").toLowerCase() === handle) return true;
  return false;
}

async function resolveTelegramUser(username: string): Promise<{ name: string; avatar: string }> {
  const clean = username.replace(/^@/, "").trim();
  try {
    const res = await fetchWithTimeout(`https://t.me/${encodeURIComponent(clean)}`, { headers: { "User-Agent": UA } }, 5000);
    if (res.ok) {
      const html = await res.text();
      let name = "";
      let avatar = "";
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogTitle && ogTitle[1]) name = ogTitle[1].trim();
      if (ogImage && ogImage[1]) avatar = ogImage[1].replace(/&amp;/g, "&");
      if (name && !isTelegramGenericTemplate(name, avatar, clean)) return { name: cleanDisplayName(name), avatar };
    }
  } catch (_) {}
  return { name: "", avatar: "" };
}
// [gemini-fix-1] END telegram template guard

// ----------------------------------------------------------------------------
// Real source: Roblox official user API
// ----------------------------------------------------------------------------
async function lookupRoblox(id: string): Promise<string> {
  const d = await getJson(`https://users.roblox.com/v1/users/${encodeURIComponent(id)}`);
  if (d && typeof d.name === "string" && d.name.trim()) {
    const display = typeof d.displayName === "string" && d.displayName.trim() && d.displayName !== d.name
      ? d.displayName
      : "";
    return display ? `${display} (@${d.name})` : d.name;
  }
  return "";
}

// ----------------------------------------------------------------------------
// Real source: Enka.Network (Genshin Impact UID -> player nickname)
// ----------------------------------------------------------------------------
async function lookupGenshin(id: string): Promise<string> {
  const d = await getJson(`https://enka.network/api/uid/${encodeURIComponent(id)}`, {
    headers: { "User-Agent": "MigoAI/1.0" },
  });
  const nick = d?.playerInfo?.nickname;
  if (typeof nick === "string" && nick.trim()) return nick.trim();
  return "";
}

// ----------------------------------------------------------------------------
// Free fallback (no key): JollyMax public top-up gateway (PUBG Mobile UID -> nickname)
// ----------------------------------------------------------------------------
async function lookupPubgJollyMax(id: string): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": UA,
    "Origin": "https://www.jollymax.com",
    "Referer": "https://www.jollymax.com/",
    "Accept": "application/json, text/plain, */*",
  };
  try {
    const tokenRes = await getJson("https://api.jollymax.com/aggregate-pay-gate/api/gateway", {
      method: "POST",
      headers,
      body: JSON.stringify({
        terminalType: "PC_H5",
        accessTokenType: "access_token",
        bizType: "userLogin",
        deviceId: "b7f8c2e1-3a4d-4e5f-9a1b-2c3d4e5f6a7b",
        loginType: "visitor",
        loginInfo: { country: "tr", language: "en", deviceType: "mobile" },
        version: "1.0",
        domain: "www.jollymax.com",
      }),
    });
    const token = tokenRes?.data?.data?.token || tokenRes?.data?.token;
    if (!token) return "";

    const check = await getJson("https://topup-center.shoplay365.com/shareit-topup-center/order/check-uid", {
      method: "POST",
      headers,
      body: JSON.stringify({
        token,
        userId: id,
        appId: "APP20220811034444301",
        country: "tr",
        language: "en",
        appAlias: "pubg",
        goodsId: "G20230718123400139",
        payTypeId: "698832",
        domain: "www.jollymax.com",
      }),
    });
    const nick = check?.data?.data?.nickName || check?.data?.nickName;
    return typeof nick === "string" ? nick.trim() : "";
  } catch (_) {
    return "";
  }
}

// ----------------------------------------------------------------------------
// Best-effort free source: isan.eu.org (nickname finder, no key)
// e.g. ff?id=, ml?id=&server=, codm?id=, valo?id=Tag, gi?id=
// ----------------------------------------------------------------------------
async function isanLookup(path: string): Promise<{ name: string; info: string }> {
  const d = await getJson(`https://api.isan.eu.org/nickname/${path}`, { headers: { "User-Agent": UA } }, 6000);
  const name = (d && d.success === false) ? "" : extractPlayerName(d);
  return { name, info: `isan:${path.split("?")[0]}:${d?.message ?? (name ? "ok" : "none")}` };
}

// ----------------------------------------------------------------------------
// Free source (no key): Osirion Fortnite public API (open in beta).
// Epic Account ID (32 hex) -> display name, or display name -> account.
// ----------------------------------------------------------------------------
async function lookupFortnite(q: string): Promise<{ name: string; info: string }> {
  const clean = q.trim();
  const details = (d: any): string => {
    const a = d?.accountDetails ?? d?.accounts?.[0]?.accountDetails;
    if (!a) return "";
    const n = a.epic || a.psn || a.xbl || a.steam || a.nintendo;
    return typeof n === "string" ? n.trim() : "";
  };
  const isHexId = /^[0-9a-fA-F]{32}$/.test(clean);
  if (isHexId) {
    const d = await getJson(
      `https://fnapi.osirion.gg/v1/accounts/lookup-by-account-id-bulk?accountIds=${encodeURIComponent(clean)}`,
      { headers: { "User-Agent": UA, "Accept": "application/json" } },
      8000,
    );
    const name = details(d);
    return { name, info: `osirion-id:${d?.success ? "ok" : "none"}:${name ? "found" : "missing"}` };
  }
  const d = await getJson(
    `https://fnapi.osirion.gg/v1/accounts/lookup-by-display-name?displayName=${encodeURIComponent(clean)}`,
    { headers: { "User-Agent": UA, "Accept": "application/json" } },
    8000,
  );
  const name = details(d);
  return { name, info: `osirion-name:${d?.success ? "ok" : "none"}:${name ? "found" : "missing"}` };
}

// ----------------------------------------------------------------------------
// Keyed Game-ID providers. Set ANY ONE key as a Deno environment variable:
//   VOLSEVER_API_KEY    gateway: https://gate.volsever.com/proxy/api/game/<slug>?id=&zone=
//   NEFERBYTE_API_KEY   https://api.neferbyte.com/game-id-checker/<slug>/<id>[/<server>]
//   RAPIDAPI_KEY        https://id-game-checker.p.rapidapi.com/<slug>?id=<id>
// No key is hard-coded in this file.
// ----------------------------------------------------------------------------
function envKey(...names: string[]): string {
  for (const n of names) {
    try {
      const v = Deno.env.get(n);
      if (v && v.trim()) return v.trim();
    } catch (_) {}
  }
  return "";
}

async function volseverLookup(slug: string, id: string, zone: string): Promise<{ name: string; info: string }> {
  const key = envKey("VOLSEVER_API_KEY", "VOLSEVER_KEY");
  if (!key) return { name: "", info: `vol:${slug}:no-key` };
  const qs = new URLSearchParams();
  qs.set("id", id);
  if (zone) qs.set("zone", zone);
  const d = await getJson(
    `https://gate.volsever.com/proxy/api/game/${slug}?${qs.toString()}`,
    { headers: { "X-API-Key": key, "Accept": "application/json", "User-Agent": UA } },
    8000,
  );
  const u = d?.data?.username ?? d?.username ?? d?.data?.name;
  const name = typeof u === "string" ? u.trim() : "";
  const info = `vol:${slug}:code=${d?.code ?? "-"}:msg=${d?.message ?? "-"}:err=${d?.error ?? "-"}`;
  return { name, info };
}

async function neferbyteLookup(slug: string, id: string, server: string): Promise<{ name: string; info: string }> {
  const key = envKey("NEFERBYTE_API_KEY", "NEFERBYTE_KEY");
  if (!key) return { name: "", info: `nef:${slug}:no-key` };
  let url = `https://api.neferbyte.com/game-id-checker/${slug}/${encodeURIComponent(id)}`;
  if (server) url += `/${encodeURIComponent(server)}`;
  const d = await getJson(
    url,
    { headers: { "x-api-key": key, "Accept": "application/json", "User-Agent": UA } },
    8000,
  );
  const u = d?.data?.username ?? d?.username;
  const name = typeof u === "string" ? u.trim() : "";
  return { name, info: `nef:${slug}:msg=${d?.msg ?? (d?.error ? "error" : "none")}` };
}

async function rapidApiLookup(slugs: string[], id: string): Promise<{ name: string; info: string }> {
  const key = envKey("RAPIDAPI_KEY", "RAPIDAPI_KEY_GAME");
  if (!key) return { name: "", info: `rap:${slugs.join(",")}:no-key` };
  let info = "";
  for (const slug of slugs) {
    const d = await getJson(
      `https://id-game-checker.p.rapidapi.com/${slug}?id=${encodeURIComponent(id)}`,
      {
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": "id-game-checker.p.rapidapi.com",
          "Accept": "application/json",
          "User-Agent": UA,
        },
      },
      8000,
    );
    const u = d?.data?.username ?? d?.username ?? d?.data?.nickname ?? d?.nickname;
    if (typeof u === "string" && u.trim()) return { name: u.trim(), info: `rap:${slug}:ok` };
    info = `rap:${slug}:msg=${d?.message ?? d?.msg ?? "none"}`;
  }
  return { name: "", info };
}

// ----------------------------------------------------------------------------
// Free best-effort LAST-RESORT fallback: Codashop public "check ID" (no key).
// Runs as the final step of the routes for the games below (and via the
// admin-only force=cosh probe). Payload format is the current Struts-style
// contract, verified live 2026-11-17 (the old flat type/id/pricePointId
// format now returns errorCode 202 for everything). Price points are
// Indonesia-shop ones, so non-ID-region accounts answer errorCode 24
// (region blocked) and the chain ends with the graceful fallback — no
// regression, and ID-region accounts still resolve during provider outages.
// ----------------------------------------------------------------------------
type CodaCfg = { type: string; ppid: string; price: string; zone?: boolean; shop: string };
const CODA_CFG: Record<string, CodaCfg> = {
  freefire: { type: "FREEFIRE", ppid: "270288", price: "200000.0000", shop: "id_ID" },
  mlbb: { type: "MOBILE_LEGENDS", ppid: "5199", price: "68543.0000", zone: true, shop: "id_ID" },
  genshin: { type: "GENSHIN_IMPACT", ppid: "272113", price: "29700.0000", zone: true, shop: "id_ID" },
  valorant: { type: "VALORANT", ppid: "950525", price: "75000.0000", shop: "id_ID" },
  codm: { type: "CALL_OF_DUTY", ppid: "270251", price: "20000.0000", shop: "id_ID" },
};

async function codashopLookup(cfg: CodaCfg, id: string, zoneId: string): Promise<{ name: string; info: string }> {
  const body = new URLSearchParams();
  body.set("voucherPricePoint.id", cfg.ppid);
  body.set("voucherPricePoint.price", cfg.price);
  body.set("voucherPricePoint.variablePrice", "0");
  body.set("user.userId", id);
  if (cfg.zone && zoneId) body.set("user.zoneId", zoneId);
  body.set("voucherTypeName", cfg.type);
  body.set("shopLang", cfg.shop);
  const d = await getJson("https://order-sg.codashop.com/initPayment.action", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Origin": "https://www.codashop.com",
      "Referer": "https://www.codashop.com/",
      "Accept": "application/json, text/plain, */*",
    },
    body: body.toString(),
  }, 8000);
  const cf = d?.confirmationFields;
  const raw = cf?.username || (Array.isArray(cf?.roles) && cf.roles[0] && (cf.roles[0].role || cf.roles[0].roleName)) || "";
  const name = typeof raw === "string" ? raw.trim() : "";
  return { name, info: `cosh:${cfg.type}:code=${d?.errorCode ?? d?.RESULT_CODE ?? d?.error ?? (d ? "json" : "nil")}:${name ? "ok" : "none"}` };
}

// ----------------------------------------------------------------------------
// Provider routes per store game id.
//   vol = Volsever gateway slug (uses id + optional zone)
//   nef = NeferByte slug (uses id + optional server)
//   rap = RapidAPI id-game-checker slugs
//   isan = free isan.eu.org path
//   jollymax = free PUBG fallback
//   enka = official Genshin lookup
// ----------------------------------------------------------------------------
type Step = { p: "vol" | "nef" | "rap" | "isan" | "jollymax" | "enka" | "osirion" | "cosh"; slug?: string; zone?: boolean; path?: string; svc?: string; ppid?: string; shop?: string };

const ROUTES: Record<string, Step[]> = {
  pubg: [
    { p: "vol", slug: "pubg-mobile-global" },
    { p: "jollymax" },
    { p: "nef", slug: "pubgm-global" },
    { p: "rap", slug: "pubgm-global" },
  ],
  // Free source first (isan is Codashop-backed): it answers SEA/ID-registered
  // ids for free, so the metered Volsever daily budget is spent only when the
  // free source finds nothing. Order of the remaining steps is unchanged.
  freefire: [
    { p: "isan", path: "ff" },
    { p: "vol", slug: "free-fire-global" },
    { p: "nef", slug: "free-fire" },
    { p: "cosh", slug: "freefire" },
  ],
  clashofclans: [{ p: "vol", slug: "clash-of-clans" }],
  brawlstars: [{ p: "vol", slug: "brawl-stars" }],
  fcmobile: [
    { p: "vol", slug: "ea-sports-fc-mobile-indonesia" },
  ],
  mlbb: [
    { p: "isan", path: "ml", zone: true },
    { p: "vol", slug: "mobile-legends", zone: true },
    { p: "nef", slug: "mobile-legends", zone: true },
    { p: "cosh", slug: "mlbb" },
  ],
  codm: [
    { p: "isan", path: "codm" },
    { p: "vol", slug: "call-of-duty-mobile-indonesia" },
    { p: "vol", slug: "codm-us" },
    { p: "nef", slug: "cod-mobile" },
    { p: "cosh", slug: "codm" },
  ],
  valorant: [
    { p: "isan", path: "valo" },
    { p: "vol", slug: "valorant-indonesia" },
    { p: "vol", slug: "valorant-singapore" },
    { p: "nef", slug: "valorant" },
    { p: "cosh", slug: "valorant" },
  ],
  wildrift: [{ p: "vol", slug: "league-of-legends-wild-rift" }],
  arenabreakout: [
    { p: "vol", slug: "arena-breakout" },
    { p: "nef", slug: "arena-breakout" },
  ],
  honorofkings: [
    { p: "vol", slug: "honor-of-kings" },
    { p: "nef", slug: "honor-of-kings" },
  ],
  diablo: [{ p: "vol", slug: "diablo-immortal", zone: true }],
  topeleven: [{ p: "vol", slug: "top-eleven" }],
  fortnite: [{ p: "osirion" }],
  // ---- live apps ----
  bigo: [{ p: "vol", slug: "bigo-live" }, { p: "nef", slug: "bigo-live" }],
  chamet: [{ p: "vol", slug: "chamet" }],
  poppo: [{ p: "vol", slug: "poppo-live" }],
  yallaludo: [{ p: "vol", slug: "yalla-ludo" }],
  sugo: [{ p: "vol", slug: "sugo" }],
  meyo: [{ p: "vol", slug: "meyo" }],
};

// Normalise the many id/apIServiceId spellings the storefront may send.
const ALIASES: Record<string, string> = {
  pubgmobile: "pubg", pubg_mobile: "pubg",
  free_fire: "freefire",
  clash_of_clans: "clashofclans",
  fc_mobile: "fcmobile",
  brawl_stars: "brawlstars",
  genshinimpact: "genshin", genshin_impact: "genshin",
  mobilelegends: "mlbb", mobile_legends: "mlbb",
  cod_mobile: "codm",
  wild_rift: "wildrift",
  arena_breakout: "arenabreakout",
  honor_of_kings: "honorofkings",
  diablo_immortal: "diablo",
  top_eleven: "topeleven",
  bigo_live: "bigo",
  poppo_live: "poppo",
  yalla_ludo: "yallaludo",
};

function runStep(step: Step, id: string, zoneId: string): Promise<{ name: string; info: string }> {
  switch (step.p) {
    case "vol":
      return volseverLookup(step.slug!, id, step.zone ? zoneId : "");
    case "nef":
      return neferbyteLookup(step.slug!, id, step.zone ? zoneId : "");
    case "rap":
      return rapidApiLookup([step.slug!], id);
    case "isan":
      return isanLookup(
        step.zone
          ? `${step.path}?id=${encodeURIComponent(id)}&server=${encodeURIComponent(zoneId)}`
          : `${step.path}?id=${encodeURIComponent(id)}`,
      );
    case "jollymax":
      return lookupPubgJollyMax(id).then((n) => ({ name: n, info: `jollymax:${n ? "ok" : "none"}` }));
    case "enka":
      return lookupGenshin(id).then((n) => ({ name: n, info: `enka:${n ? "ok" : "none"}` }));
    case "osirion":
      return lookupFortnite(id);
    case "cosh": {
      const cfg = CODA_CFG[step.slug || ""];
      return cfg ? codashopLookup(cfg, id, zoneId) : Promise.resolve({ name: "", info: "cosh:no-config" });
    }
    default:
      return Promise.resolve({ name: "", info: "unknown-step" });
  }
}


// ============================================================================
// Store chat assistant (Gemini). The Gemini API key lives ONLY here (Deno env),
// never in the browser. Answers come from the store's own prices (public.catalog).
// ============================================================================
const GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
// Free provider #2: Groq (OpenAI-compatible). Load-balanced with Gemini and used
// as its fallback (see providers[] in handleChat). Key = Deno env var GROQ_API_KEY.
// qwen الأول عن قصد: اتجرّب وطلعت دقيق في الأسعار؛ gpt-oss كان بيخترع أسعار، فسايبينه الثاني بس.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
const SITE_URL = "https://migoai.shop/";
const WHATSAPP = "https://wa.me/201060934020";

// Store-chat personalities. The widget picks one per visitor and sends its id as
// `persona`; replies keep that name + gender grammar so the customer always talks to
// the same character. Keep these ids in sync with chat-widget.js.
const PERSONAS: Record<string, { name: string; gender: "m" | "f"; style: string }> = {
  omar: { name: "عمر", gender: "m", style: "ودود وبسيط وسريع، بتحب تساعد على طول وبتتكلم باختصار ولطف." },
  karim: { name: "كريم", gender: "m", style: "محترف ومرتّب وهادي، بترد باحترافية وبتأكد على الأسعار والأرقام بدقة." },
  mirna: { name: "ميرنا", gender: "f", style: "دافئة وحنينة، بتشرح بخطوات واضحة وبتتأكد إن العميل فهم ومطمن." },
  habiba: { name: "حبيبة", gender: "f", style: "شبابية وحيوية وحماسية، بتتكلم ببساطة وود وبتستخدم إيموجي خفيفة." },
};

// لو العميل طلب في الشات يتكلّم مع حد من الفريق/موظف/وكيل: نسلمه رقم الواتساب
// ونبدّله لشخصية تانية (الزميل التاني)، وكمان نسيبه لو حابب يكمل استفساره هنا.
const HANDOFF_RE =
  /(خدمة\s*العملاء|خدمه\s*العملاء|خدمة\s*عملاء|أكلم\s*حد|اكلم\s*حد|عا[ييو]ز\s*(أ|ا)?كلم|كلّ?م\s*حد|أكلم\s*مين|اكلم\s*مين|موظف|بني\s*آدم|بنى\s*ادم|حد\s*من\s*الفريق|وكيل|مسؤول|مسئول|أشتكي|اشتكي|شكوى|شكوه|حوّ?لني|مش\s*بوت|إنسان|انسان|agent|human|support|representative)/i;

const WHATSAPP_NUM = "01060934020"; // نفس رقم الواتساب (بصيغة محلية مصرية) للعرض في الرسالة

function handoffReply(currentId: string): { reply: string; persona: string } {
  const ids = Object.keys(PERSONAS);
  const others = ids.filter((x) => x !== currentId);
  const nextId = others.length ? others[Math.floor(Math.random() * others.length)] : (ids[0] || "omar");
  const p = PERSONAS[nextId] || PERSONAS.omar;
  return {
    persona: nextId,
    reply:
      `تمام، أنا ${p.name} ومعاك 👋 لو حابب تكلم حد من الفريق، كلّمنا على واتساب: ${WHATSAPP_NUM} (${WHATSAPP}) ونساعدك فورًا. ` +
      `ولو استفسارك عن سعر أو خدمة أقدر أساعدك حالًا.`,
  };
}

let __catalog: { sku: string; price: number; kind: string }[] | null = null;
let __catalogAt = 0;
async function getCatalog(): Promise<{ sku: string; price: number; kind: string }[]> {
  const now = Date.now();
  if (__catalog && now - __catalogAt < 10 * 60 * 1000) return __catalog;
  const rows = await getJson(`${SB_URL}/rest/v1/rpc/get_catalog`, {
    method: "POST",
    headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: "{}",
  }, 6000);
  if (Array.isArray(rows) && rows.length) {
    __catalog = rows.map((r: any) => ({ sku: String(r.sku), price: Number(r.price), kind: String(r.kind || "") }));
    __catalogAt = now;
  }
  return __catalog || [];
}

// --- تفاصيل الخدمات من ملفات المتجر: وصف ومتطلبات ومددة فقط، بدون أي سعر ---
const DETAILS_URL = "https://migoai.shop/details.json";
let __details: any[] | null = null;
let __detailsAt = 0;
async function getDetails(): Promise<any[]> {
  const now = Date.now();
  if (__details && now - __detailsAt < 10 * 60 * 1000) return __details;
  try {
    const rows = await getJson(DETAILS_URL, {}, 6000);
    if (Array.isArray(rows) && rows.length) {
      __details = rows;
      __detailsAt = now;
    }
  } catch (_) {
    // الملف مش متاح؟ البوت يشتغل زي ما هو بالظبط، من غير تفاصيل.
  }
  return __details || [];
}

// توحيد الكلام العربي: نشيل التشكيل والتطويل، ونوحّد الألف واليا والتاء المربوطة.
function normAr(s: string): string {
  return String(s || "").toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// مطابقة سؤال العميل بأسماء الخدمات: الاسم العربي، الإنجليزي، والكلمات البديلة.
function pickDetails(msg: string, details: any[], limit = 2): any[] {
  const q = normAr(msg);
  if (!q) return [];
  const qWords = q.split(" ").filter((w) => w.length >= 3);
  if (!qWords.length) return [];
  const scored = details.map((d) => {
    let sc = 0;
    for (const k of [d.name, d.ar, ...(d.aliases || [])].map(normAr)) {
      if (!k) continue;
      if (q.includes(k)) { sc = Math.max(sc, k.length + 4); continue; }
      const kW = k.split(" ").filter(Boolean);
      let hits = 0;
      for (const w of kW) if (w.length >= 3 && qWords.indexOf(w) !== -1) hits++;
      if (hits) sc = Math.max(sc, hits * 3 + (hits * 2 >= kW.length ? 2 : 0));
    }
    return { d, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
  if (!scored.length) return [];
  const top = scored[0].sc;
  return scored.filter((x) => x.sc >= top * 0.6).slice(0, limit).map((x) => x.d);
}

// آخر رسايل العميل، عشان «كم سعره؟» تعرف هي عن إيه.
function matchCtx(hist: any[], msg: string): string {
  const prev: string[] = [];
  for (let i = (hist || []).length - 1; i >= 0 && prev.length < 2; i--) {
    const h = hist[i];
    if (h && h.role === "user" && h.text) prev.unshift(String(h.text).slice(0, 120));
  }
  return [msg].concat(prev).join(" ");
}

// صف القايمة ده يخص الخدمة اللي طلعت من التفاصيل؟ نقارن كلمات اسم الخدمة
// بأول كلمات الـ sku، عشان العربي (نيتفليكس) يلاقي اللاتيني (Netflix Premium).
function linkSku(sku: string, det: any[]): boolean {
  const head = normAr(sku).split(" ").slice(0, 6);
  for (const d of det) {
    for (const k of [d.name, d.ar]) {
      const kt = normAr(k).split(" ").filter((w) => w.length >= 4);
      if (kt.length && kt.every((w) => head.indexOf(w) !== -1)) return true;
    }
  }
  return false;
}

function skuScore(msg: string, sku: string): number {
  const words = (msg || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  const s = String(sku || "").toLowerCase();
  let sc = 0;
  for (const w of words) if (s.includes(w)) sc += w.length >= 4 ? 2 : 1;
  return sc;
}

function pickRelevant(msg: string, cat: { sku: string; price: number }[], limit = 16) {
  return cat
    .map((r) => ({ r, sc: skuScore(msg, r.sku) }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, limit)
    .map((x) => x.r);
}

function buildSystem(
  cat: { sku: string; price: number }[],
  msg: string,
  personaId?: string,
  details: any[] = [],
  hist: any[] = [],
): string {
  const p = PERSONAS[personaId || ""] || PERSONAS.omar;
  const ctx = matchCtx(hist, msg);
  // الخدمة اللي العميل بيتكلم عنها. لو رسالته متابعة («كم سعره؟») ناخد آخر رسايله معاها.
  let det = pickDetails(msg, details, 2);
  if (!det.length) det = pickDetails(ctx, details, 2);
  const rel = pickRelevant(msg, cat, 16);
  if (det.length) {
    // صفوف أسعار نفس الخدمة من القايمة الحيّة (السعر دايمًا من القايمة، مش من هنا).
    const linked = cat.filter((r) => linkSku(r.sku, det))
      .map((r) => ({ r, sc: skuScore(msg, r.sku) }))
      .sort((a, b) => b.sc - a.sc)
      .map((x) => x.r);
    for (const r of linked) {
      if (rel.length >= 24) break;
      if (!rel.some((x) => x.sku === r.sku)) rel.push(r);
    }
  }
  const priceLines = rel.map((r) => `- ${r.sku} : ${r.price} ج.م`).join("\n");
  const detailLines = det.map((d) => {
    const pk = (d.packages && d.packages.length) ? "\n  المتاح: " + d.packages.join(" | ") : "";
    const nd = d.needs ? "\n  المطلوب من العميل: " + d.needs : "";
    return `- ${d.name}: ${d.desc || ""}${pk}${nd}`;
  }).join("\n");
  const who = p.gender === "f"
    ? 'بنت (أنثى)، واتكلم عن نفسك دايماً بصيغة المؤنث: "أنا مساعدة"، "أقدر أساعدك"، "أنا مبسوطة أساعدك".'
    : 'ولد (ذكر)، واتكلم عن نفسك دايماً بصيغة المذكر: "أنا مساعد"، "أقدر أساعدك"، "أنا مبسوط أساعدك".';
  return `أنت "${p.name}" من فريق دعم متجر Migo AI Solution (شحن ألعاب وخدمات رقمية بالـ ID في مصر).
هويتك: اسمك "${p.name}"، وأنت ${who} لو حد سألك مين إنت أو اسمك، عرّف نفسك باسمك "${p.name}" من فريق Migo.
طريقتك في الكلام: ${p.style}
قواعد:
- ردّ بالعربي، بأسلوب ودود ومبسّط، في 3 أسطر كحد أقصى، وبدون مقدمات إنشائية.
- السعر دايمًا من قائمة الأسعار أدناه بالضبط. ممنوع تغييره أو تخمينه أو مقارنته بأي سعر من بره المتجر.
- وصف الخدمة ومتطلباتها والمدد المتاحة من قسم «تفاصيل من المتجر» أدناه، ومتخترعش تفاصيل من عندك.
- كل الأسعار بالجنيه المصري (ج.م)، والتسليم عادةً من 2 إلى 5 دقائق بعد الدفع.
- لو المعلومة مش موجودة في القائمة، قول بصراحة إنها مش متاحة هنا، ووجّه العميل لواتساب: ${WHATSAPP}
- لما يحب يشتري، اطلب منه رقم الـ ID (معرّف اللعبة/الحساب) وطريقة الدفع.
- لو الرسالة فيها «صورة التحويل» (يعني العميل بعت صورة إيصال الدفع من الشات)، ردّ إن الصورة وصلت وإن الفريق هيراجعها ويأكدله، ولو لسه مفيش رقم ID اطلبه. ممنوع تقول إن الدفع اتأكد أو اتحقق منه، التأكيد من الفريق بس.
- متتكلمش عن أسعار الموردين ولا أي حاجة مش من المتجر.
صفحة كل الأسعار: ${SITE_URL}catalog.html
${priceLines ? "أسعار من المتجر تطابق سؤال العميل:\n" + priceLines : "(مفيش منتج مطابق واضح لسؤال العميل في القائمة.)"}
${detailLines ? "تفاصيل من المتجر عن اللي العميل بيسأل عنه (وصف ومتطلبات ومدة، وبدون أسعار):\n" + detailLines : ""}`;
}

// Groq (free, OpenAI-compatible). Same system prompt + history as Gemini; used
// alongside Gemini (load-balanced) and as its fallback. Returns "" on failure.
async function groqChat(
  groqKey: string,
  cat: { sku: string; price: number }[],
  hist: any[],
  message: string,
  personaId: string,
): Promise<{ text: string; model: string; note: string }> {
  const details = await getDetails();
  const messages = [
    { role: "system", content: buildSystem(cat, message, personaId, details, hist) },
    ...hist.map((h: any) => ({
      role: h && h.role === "model" ? "assistant" : "user",
      content: String((h && h.text) || "").slice(0, 500),
    })),
    { role: "user", content: message },
  ];
  let model = "";
  let note = "";
  for (const m of GROQ_MODELS) {
    model = m;
    try {
      const r = await fetchWithTimeout(
        GROQ_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
          body: JSON.stringify({ model: m, messages, temperature: 0.6, max_tokens: 400 }),
        },
        7000,
      );
      const raw = await r.text();
      const j: any = JSON.parse(raw);
      const t = j?.choices?.[0]?.message?.content || "";
      note = `groq:${m}:${r.status}:${t ? "ok" : "empty"}`;
      if (t) return { text: String(t).trim(), model: m, note };
    } catch (e) {
      note = `groq:${m}:EXC:${String(e).slice(0, 200)}`;
    }
  }
  return { text: "", model, note };
}

async function handleChat(req: Request): Promise<Response> {
  const key = Deno.env.get("GEMINI_API_KEY") || "";
  const groqKey = envKey("GROQ_API_KEY", "GROQ_KEY");
  if (!key && !groqKey) {
    return new Response(JSON.stringify({ ok: false, error: "no-key" }), { status: 200, headers: corsHeaders(req) });
  }
  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const message = String(body.message || "").slice(0, 800).trim();
  if (!message) {
    return new Response(JSON.stringify({ ok: false, error: "empty" }), { status: 200, headers: corsHeaders(req) });
  }
  const hist = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const persona = String(body.persona || "").slice(0, 24).trim();
  // طلب التحويل لحد من الفريق: نرد فوراً (من غير ما نكلّم الموديل) ونبدّل الشخصية.
  if (HANDOFF_RE.test(message)) {
    const ho = handoffReply(persona);
    return new Response(
      JSON.stringify({ ok: true, reply: ho.reply, handoff: true, persona: ho.persona }),
      { status: 200, headers: corsHeaders(req) },
    );
  }
  const cat = await getCatalog();
  const details = await getDetails();
  const contents = [
    ...hist.map((h: any) => ({
      role: h && h.role === "model" ? "model" : "user",
      parts: [{ text: String((h && h.text) || "").slice(0, 500) }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];
  const payload = {
    systemInstruction: { parts: [{ text: buildSystem(cat, message, persona, details, hist) }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 320 },
  };
  let text = "";
  let gStatus = 0;
  let gBody = "";
  let lastModel = "";
  const attempts: string[] = [];
  // Load-balance the two free providers: with both keys present, each request has an
  // even chance of starting on Gemini or Groq and falls back to the other if it fails,
  // so neither provider's daily quota runs out before the other's.
  const providers: string[] = [];
  if (key) providers.push("gemini");
  if (groqKey) providers.push("groq");
  if (providers.length === 2 && Math.random() < 0.5) providers.reverse();
  for (const prov of providers) {
    if (text) break;
    if (prov === "gemini") {
      for (const model of GEMINI_MODELS) {
        lastModel = model;
        try {
          const r = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(payload) },
            7000,
          );
          gStatus = r.status;
          gBody = await r.text();
          attempts.push(`${model}|${gStatus}|${gBody.slice(0, 180)}`);
          const j: any = JSON.parse(gBody);
          text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
          if (text) break;
        } catch (e) {
          gBody = "ERR:" + String(e).slice(0, 300);
          attempts.push(`${model}|EXC|${gBody}`);
        }
      }
    } else if (prov === "groq") {
      const g = await groqChat(groqKey, cat, hist, message, persona);
      attempts.push(g.note);
      text = g.text;
    }
  }
  if (!text) {
    try {
      const dbg = (attempts.join("\n") || gBody || "").split(key).join("[key]").slice(0, 1900);
      const lp = fetch(`${SB_URL}/rest/v1/chat_debug`, {
        method: "POST",
        headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ status: gStatus, note: "key-present:" + lastModel, body: dbg }),
      }).catch(() => {});
      (globalThis as any).EdgeRuntime?.waitUntil?.(lp);
    } catch (_) {}
    return new Response(
      JSON.stringify({ ok: true, reply: `معلش مش قادر أجاوب دلوقتي. كلّمنا على واتساب: ${WHATSAPP}`, fallback: true }),
      { status: 200, headers: corsHeaders(req) },
    );
  }
  return new Response(JSON.stringify({ ok: true, reply: String(text).trim() }), { status: 200, headers: corsHeaders(req) });
}

// E-003 (Package 8) — backend route for storefront client errors:
// POST /client-error writes through logError() into the production
// error_log with source "storefront.client". Fire-and-forget by design.
const clientErrorBuckets = new Map<string, { windowStart: number; count: number }>();

async function handleClientError(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if (clientErrorBuckets.size > 5000) clientErrorBuckets.clear(); // تخلص من النمو الزايد (نفس قاعدة RATE_MAP)
  const bucket = clientErrorBuckets.get(ip);
  if (bucket && now - bucket.windowStart < 60_000 && bucket.count >= 20) {
    return new Response(null, { status: 204 });
  }
  if (!bucket || now - bucket.windowStart >= 60_000) {
    clientErrorBuckets.set(ip, { windowStart: now, count: 1 });
  } else {
    bucket.count += 1;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const cap = (v: unknown, n: number) =>
    typeof v === "string" ? v.slice(0, n) : "";
  // نفس تنقية الأسرار اللي logError بيطبقها على errorText: الطريق ده
  // مفتوح من غير مصادقة، فرسالة العميل ما تدخلش سجل الأخطاء المركزي خام.
  const scrubSecrets = (s: string) => {
    let out = s;
    const writeKey = Deno.env.get("LOG_WRITE_KEY") || "";
    if (writeKey) out = out.split(writeKey).join("***");
    if (SB_KEY) out = out.split(SB_KEY).join("***");
    return out;
  };
  const message = scrubSecrets(cap(body.message, 300));
  if (!message) return new Response(null, { status: 204 });

  const context =
    body.context && typeof body.context === "object"
      ? (body.context as Record<string, unknown>)
      : {};
  logError(
    "storefront.client",
    message,
    { name: cap(body.error_type, 128) || "Error", message: cap(body.error_text, 500) },
    { page: cap(context.page, 200), ua: cap(context.ua, 120), via: "client-error-route" },
  );
  return new Response(null, { status: 204 });
}


// ---------------------------------------------------------------------------
// الحزمة 10 — تأكيد إيداع محفظة العميل التلقائي (Binance / Bybit).
// المراقب (deposit_watcher.py على الـ VM) بيقرأ إيداعات USDT الناجحة
// من APIs المنصتين الرسمية بمفاتيح قراءة-فقط، وبيبعت كل إيداع هنا؛
// الـ RPC (هجرة 011) هي اللي بتقرر: مطابقة مبلغ فريد لنية مفتوحة =
// شحن فوري بمبلغ الجنيه المتفق عليه، وغير كده = استثناء متسجل.
// الأسرار من البيئة بس — ممنوع أي قيمة هنا.
// ---------------------------------------------------------------------------
async function walletRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}

/** معالج مسارات المحفظة — بيتركب في Deno.serve جنب فرع /exec/. */
export async function handleWalletRequest(
  req: Request,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isCredit = path.endsWith("/wallet/auto-credit");
  const isExpire = path.endsWith("/wallet/expire-intents");
  const isPendingClaims = path.endsWith("/wallet/pending-claims");
  const isResolveClaim = path.endsWith("/wallet/resolve-claim");
  const isResolveOrderClaims = path.endsWith("/wallet/resolve-order-claims");
  if (
    !isCredit && !isExpire && !isPendingClaims && !isResolveClaim &&
    !isResolveOrderClaims
  ) {
    return null;
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!isWalletAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    if (isExpire) {
      const { status, data } = await walletRpc("wallet_expire_intents", {});
      if (status >= 300) {
        logError("wallet.expire", "expire intents RPC failed", undefined, {
          status,
        });
        return json({ ok: false, error: "rpc_failed" }, 502);
      }
      return json({ ok: true, expired: data });
    }
    if (isResolveOrderClaims) {
      // الحزمة 15: حسم مطالبات منصات مربوطة بطلبات شراء (المطالبة
      // اتعملت قبل ما الإيداع يوصل — المراقب بينادي هنا بعد ما سجّل
      // أحداث الإيداع الجديدة في نفس الدورة).
      const { status, data } = await walletRpc(
        "order_resolve_exchange_claims",
        { p_limit: 50 },
      );
      if (status >= 300) {
        logError(
          "wallet.order_claims",
          "resolve order claims RPC failed",
          undefined,
          { status },
        );
        return json({ ok: false, error: "rpc_failed" }, 502);
      }
      return json({ ok: true, resolved: data });
    }
    if (isPendingClaims) {
      const { status, data } = await walletRpc("wallet_pending_claims", {
        p_limit: 50,
      });
      if (status >= 300) {
        logError("wallet.claims", "pending claims RPC failed", undefined, {
          status,
        });
        return json({ ok: false, error: "rpc_failed" }, 502);
      }
      return json({ ok: true, claims: data });
    }
    if (isResolveClaim) {
      const cbody = (await req.json().catch(() => ({}))) as {
        claim_id?: unknown;
        amount_usdt?: unknown;
        tx_hash?: unknown;
        asset?: unknown;
        reject_reason?: unknown;
      };
      const claimId = String(cbody.claim_id || "").trim();
      // المبلغ كنص دايمًا (قاعدة الحزمة 10) — والرفض الموثّق
      // ممكن ييجي من غير مبلغ أصلًا.
      const camount = typeof cbody.amount_usdt === "number"
        ? String(cbody.amount_usdt)
        : String(cbody.amount_usdt || "").trim();
      const rejectReason = cbody.reject_reason
        ? String(cbody.reject_reason).trim()
        : "";
      if (
        !claimId ||
        (!rejectReason && !/^\d+(\.\d+)?$/.test(camount))
      ) {
        return json({ ok: false, error: "invalid_body" }, 400);
      }
      const { status, data } = await walletRpc("wallet_resolve_claim", {
        p_claim_id: claimId,
        p_amount_usdt: camount === "" ? null : camount,
        p_tx_id: cbody.tx_hash ? String(cbody.tx_hash) : null,
        p_asset: cbody.asset ? String(cbody.asset) : null,
        p_reject_reason: rejectReason === "" ? null : rejectReason,
      });
      if (status >= 300) {
        logError("wallet.resolve_claim", "resolve claim RPC failed",
          undefined, { status, claim_id: claimId });
        return json({ ok: false, error: "rpc_failed" }, 502);
      }
      // نتيجة الـ RPC حرفيًا (credited / rejected / status …).
      return json(data);
    }
    const body = (await req.json().catch(() => ({}))) as {
      rail?: unknown;
      exchange_ref?: unknown;
      asset?: unknown;
      amount_usdt?: unknown;
      tx_hash?: unknown;
    };
    const rail = String(body.rail || "");
    const exchangeRef = String(body.exchange_ref || "").trim();
    const asset = String(body.asset || "");
    // المبلغ كنص دايمًا (شوف ترويسة الباتش): بنقبل رقم JSON كمان
    // وبنحوّله بأقصر تمثيل عشري — بس المرجع هو النص.
    const amount = typeof body.amount_usdt === "number"
      ? String(body.amount_usdt)
      : String(body.amount_usdt || "").trim();
    if (
      !(rail === "binance" || rail === "bybit") || !exchangeRef ||
      !/^\d+(\.\d+)?$/.test(amount)
    ) {
      return json({ ok: false, error: "invalid_body" }, 400);
    }
    const { status, data } = await walletRpc("wallet_auto_credit_deposit", {
      p_rail: rail,
      p_exchange_ref: exchangeRef,
      p_asset: asset,
      p_amount_usdt: amount,
      p_tx_hash: body.tx_hash ? String(body.tx_hash) : null,
    });
    if (status >= 300) {
      logError("wallet.auto_credit", "auto credit RPC failed", undefined, {
        status,
        rail,
        exchange_ref: exchangeRef,
      });
      return json({ ok: false, error: "rpc_failed" }, 502);
    }
    // نتيجة الـ RPC حرفيًا (credited / already / reason …).
    return json(data);
  } catch (e) {
    logError("wallet.auto_credit", "unhandled wallet route error", e);
    return json({ ok: false, error: (e as Error)?.name || "exception" }, 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (rateLimited(req)) {
    return new Response(
      JSON.stringify({ success: false, message: "محاولات كتير في وقت قصير، جرّب تاني بعد شوية." }),
      { status: 429, headers: { ...corsHeaders(req), "Retry-After": "60" } },
    );
  }

  const url = new URL(req.url);

  // الحزمة 6: مسارات التنفيذ (محمية بـ isAdmin) — قبل /chat والتحقق.
  // الكنس بيتنادى من مجدول خارجي كل 20 ثانية (نمط sheerid-sweep) بنفس
  // ترويسة الأدمن؛ والتنفيذ الفوري بيتنادى بعد تأكيد دفع أي طلب.
  if (url.pathname.replace(/\/+$/, "").includes("/exec/")) {
    try {
      const execRes = await handleExecRequest(req, getExecutor(), isAdmin);
      if (execRes) return execRes;
    } catch (e) {
      logError("store_exec.route", "unhandled exec route error", e);
    }
  }


  // الحزمة 10: مسارات تأكيد إيداع المحفظة (محمية بفاحص المحفظة) —
  // المرسل الوحيد هو مراقب الإيداعات على الـ VM بترويسة الأدمن.
  if (url.pathname.replace(/\/+$/, "").includes("/wallet/")) {
    try {
      const walletRes = await handleWalletRequest(req);
      if (walletRes) return walletRes;
    } catch (e) {
      logError("wallet.route", "unhandled wallet route error", e);
    }
  }
  // منفّذ حدّ الأسعار الأدنى (محمي بفاحص الكتالوج جوه المعالج) —
  // بيتنادى من مجدول خارجي بترويسة الأدمن زي باقي المسارات.
  if (url.pathname.replace(/\/+$/, "").includes("/catalog/")) {
    try {
      const pfRes = await handlePriceFloorRequest(req, getPriceFloorDeps(), isCatalogAdmin);
      if (pfRes) return pfRes;
    } catch (e) {
      logError("price_floors.route", "unhandled price-floor route error", e);
    }
  }
  if (req.method === "POST" && url.pathname.replace(/\/+$/, "").endsWith("/wallet/sms")) {
    const smsRes = await handleSmsRequest(req, getSmsDeps());
    if (smsRes) return smsRes;
  }
  // إيصالات البوت (هجرة 017): مرشّحون/حجز لممر شحن البوت التلقائي —
  // المصادقة جوه المعالج بتوكن الجسر، والمتصل الوحيد هو البوت.
  if (req.method === "POST" && url.pathname.replace(/\/+$/, "").includes("/wallet/bot-sms-")) {
    const botSmsRes = await handleBotSmsRequest(req, getBotSmsDeps());
    if (botSmsRes) return botSmsRes;
  }
  // إيداعات البوت (هجرة 018): مرشّحون/حجز لممر شحن المنصات
  // التلقائي — المصادقة جوه المعالج بتوكن الجسر، والمتصل الوحيد
  // هو البوت.
  if (req.method === "POST" && url.pathname.replace(/\/+$/, "").includes("/wallet/bot-exchange-")) {
    const botExchangeRes = await handleBotExchangeRequest(req, getBotExchangeDeps());
    if (botExchangeRes) return botExchangeRes;
  }

  // لوحة التحكم (المرحلة م٠): رئيسية «مهامي الآن» — تجميع قراءة بس
  // محمي بفاحص الأدمن المشترك جوه المعالج، وبيتنادى من control.html.
  if (url.pathname.replace(/\/+$/, "").endsWith("/control/home")) {
    try {
      const controlRes = await handleControlHomeRequest(req, getControlDeps());
      if (controlRes) return controlRes;
    } catch (e) {
      logError("control.route", "unhandled control route error", e);
    }
  }

  // لوحة التحكم (المرحلة م١-أ): العملاء والمحافظ — ملف/قرارات/
  // تعديل رصيد الموقع + تمرير أفعال البوت + البحث الموحد. المعالج
  // بيرجع null لأي مسار مش بتاعه (بما فيه /control/home فوق).
  // المرحلة م١-ب: إعدادات الفلوس + بحث الشحنة الضايعة — معالج تانٍ
  // على نفس مسارات /control/، بيتنادى بعد العملاء وبياخد اللي
  // العملاء رجّعوا فيه null.
  if (url.pathname.replace(/\/+$/, "").includes("/control/")) {
    try {
      const customersRes = await handleControlCustomersRequest(
        req,
        getControlCustomersDeps(),
      );
      if (customersRes) return customersRes;
      const moneyRes = await handleControlMoneyRequest(
        req,
        getControlMoneyDeps(),
      );
      if (moneyRes) return moneyRes;
    } catch (e) {
      logError("control.customers.route", "unhandled customers route error", e);
    }
  }

  // تحقق SheerID: حالة/إرسال العميل + إشعار المورد + المسح الدوري
  // (الأخير بترويسة الأدمن زي /exec/ بالظبط، وبيتنادى من مجدول خارجي).
  if (url.pathname.replace(/\/+$/, "").includes("/sheerid/")) {
    try {
      const sheeridRes = await handleSheeridRequest(req, await getSheeridDeps());
      if (sheeridRes) return sheeridRes;
    } catch (e) {
      logError("sheerid.route", "unhandled sheerid route error", e);
    }
  }
  if (req.method === "POST" && url.pathname.replace(/\/+$/, "").endsWith("/client-error")) {
    return handleClientError(req);
  }
  if (req.method === "POST" && url.pathname.replace(/\/+$/, "").endsWith("/chat")) {
    try {
      return await handleChat(req);
    } catch (e) {
      logError("api.chat", "unhandled chat error", e);
      return new Response(
        JSON.stringify({ ok: false, error: "exception" }),
        { status: 200, headers: corsHeaders(req) },
      );
    }
  }
  let game = (url.searchParams.get("game") || "").toLowerCase().trim();
  const id = (url.searchParams.get("id") || "").trim();
  const zoneId = (url.searchParams.get("zoneId") || "").trim();

  if (ALIASES[game]) game = ALIASES[game];

  if (!game || !id) {
    return new Response(
      JSON.stringify({ success: false, message: "يرجى تحديد اللعبة ورقم المعرف (Player ID)" }),
      { status: 200, headers: corsHeaders(req) },
    );
  }

  let foundName = "";
  let avatarUrl = "";
  const isNumeric = /^\d+$/.test(id);
  const debug = url.searchParams.get("debug") === "1" && isAdmin(req);
  const trace: string[] = [];

  try {
    // ---- TikTok ----
    if (game === "tiktok") {
      const r = await resolveTikTokUser(id);
      foundName = r.name;
      avatarUrl = r.avatar;
      trace.push(`tiktok:${foundName ? "ok" : "none"}`);
      logCall("tiktok", "tiktok", !!foundName);
    } // ---- Telegram Stars ----
    else if (game === "telegram" || game === "telegramstars") {
      const r = await resolveTelegramUser(id);
      foundName = r.name;
      avatarUrl = r.avatar;
      trace.push(`telegram:${foundName ? "ok" : "none"}`);
      logCall("telegram", "telegram", !!foundName);
    } // ---- Roblox (official) ----
    else if (game === "roblox") {
      if (isNumeric) foundName = await lookupRoblox(id);
      trace.push(`roblox:${foundName ? "ok" : "none"}`);
      logCall("roblox", "roblox", !!foundName);
    } // ---- Genshin Impact: Enka first, then generic providers ----
    else if (game === "genshin") {
      if (isNumeric) foundName = await lookupGenshin(id);
      trace.push(`enka:${foundName ? "ok" : "none"}`);
      logCall("genshin", "enka", !!foundName);
      if (!foundName) {
        for (const step of [
          { p: "isan", path: "gi" } as Step,
          { p: "vol", slug: "genshin-impact-global" } as Step,
          { p: "cosh", slug: "genshin" } as Step,
        ]) {
          const r = await runStep(step, id, zoneId);
          trace.push(r.info);
          logCall("genshin", step.p, !!r.name);
          foundName = r.name;
          if (foundName) break;
        }
      }
    } // ---- Everything else: provider route table ----
    else {
      const force = isAdmin(req) ? (url.searchParams.get("force") || "").trim().toLowerCase() : "";
      if (force === "cosh") {
        const cfg = CODA_CFG[game];
        if (cfg) {
          const r = await codashopLookup(cfg, id, zoneId);
          trace.push(r.info);
          foundName = r.name;
        } else {
          trace.push(`cosh:${game}:no-config`);
        }
      } else {
        let steps = ROUTES[game] || [];
        if (force) steps = steps.filter((st) => st.p === force);
        // Free providers that only accept a numeric ID skip non-numeric input.
        for (const step of steps) {
          if (!isNumeric && step.p === "jollymax") continue;
          const r = await runStep(step, id, zoneId);
          trace.push(r.info);
          logCall(game, step.p, !!r.name);
          foundName = r.name;
          if (foundName) break;
        }
      }
    }

    if (foundName) {
      return new Response(
        JSON.stringify({ success: true, username: foundName, name: foundName, avatar: avatarUrl || undefined, trace: debug ? trace : undefined }),
        { status: 200, headers: corsHeaders(req) },
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        message: "تعذّر الفحص التلقائي لهذا المعرّف الآن، وهذا لا يمنع إتمام طلبك: اكتب اسم حسابك ثم اضغط متابعة.",
        trace: debug ? trace : undefined,
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  } catch (e) {
    // Last-resort net for the whole verify chain: the customer still gets
    // the graceful manual-name fallback, but the error now lands in the
    // central error log instead of vanishing (migration 006).
    logError("api.verify", "unhandled verify error", e, { game });
    return new Response(
      JSON.stringify({
        success: false,
        message: "اكتب اسم حسابك ثم اضغط متابعة لإتمام طلبك فوراً.",
      }),
      { status: 200, headers: corsHeaders(req) },
    );
  }
});

