// Migo AI Solution - Deno service (verification + /chat). Rebuild marker: chat-live-3
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
// ==============================================================================

const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
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
    const p = fetch(`${SB_URL}/rest/v1/verification_calls`, {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ game, provider, ok }),
    }).catch(() => {});
    // Deno Deploy: keep the isolate alive until the write settles.
    (globalThis as any).EdgeRuntime?.waitUntil?.(p);
  } catch (_) {}
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

// ----------------------------------------------------------------------------
// Real source: TikTok profile (scrape)
// ----------------------------------------------------------------------------
async function resolveTikTokUser(username: string): Promise<{ name: string; avatar: string }> {
  const clean = username.replace(/^@/, "").trim().toLowerCase();
  try {
    const res = await fetchWithTimeout(`https://www.tiktok.com/@${clean}`, {
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
            return { name: nickname, avatar };
          }
        } catch (_) {}
      }
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogTitle && ogTitle[1]) nickname = ogTitle[1].replace(/\s*\(@[^)]+\).*$/, "").replace(/\| TikTok$/, "").trim();
      if (ogImage && ogImage[1]) avatar = ogImage[1].replace(/&amp;/g, "&");
      if (nickname) return { name: nickname, avatar };
    }
  } catch (_) {}
  return { name: "", avatar: "" };
}

// ----------------------------------------------------------------------------
// Real source: Telegram public profile (scrape)
// ----------------------------------------------------------------------------
async function resolveTelegramUser(username: string): Promise<{ name: string; avatar: string }> {
  const clean = username.replace(/^@/, "").trim();
  try {
    const res = await fetchWithTimeout(`https://t.me/${clean}`, { headers: { "User-Agent": UA } }, 5000);
    if (res.ok) {
      const html = await res.text();
      let name = "";
      let avatar = "";
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogTitle && ogTitle[1]) name = ogTitle[1].trim();
      if (ogImage && ogImage[1]) avatar = ogImage[1].replace(/&amp;/g, "&");
      if (name) return { name, avatar };
    }
  } catch (_) {}
  return { name: "", avatar: "" };
}

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
// Free best-effort: Codashop public "check ID" (no key). GATED: only runs when
// force=cosh is passed, so it never affects normal traffic until verified.
// ----------------------------------------------------------------------------
type CodaCfg = { type: string; svc?: string; ppid?: string; zone?: boolean; shop: string };
const CODA_CFG: Record<string, CodaCfg> = {
  freefire: { type: "FREEFIRE", ppid: "270288", shop: "id_ID" },
  mlbb: { type: "MOBILE_LEGENDS", ppid: "5199", zone: true, shop: "id_ID" },
  genshin: { type: "GENSHIN_IMPACT", ppid: "338498", zone: true, shop: "id_ID" },
  valorant: { type: "VALORANT", ppid: "950525", shop: "id_ID" },
  codm: { type: "CALL_OF_DUTY", ppid: "270251", shop: "id_ID" },
};

async function codashopLookup(cfg: CodaCfg, id: string, zoneId: string): Promise<{ name: string; info: string }> {
  const body = new URLSearchParams();
  body.set("type", cfg.type);
  body.set("id", id);
  if (cfg.svc) body.set("service", cfg.svc);
  if (cfg.ppid) body.set("pricePointId", cfg.ppid);
  body.set("shopLang", cfg.shop);
  if (cfg.zone && zoneId) body.set("zoneId", zoneId);
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
  return { name, info: `cosh:${cfg.type}:code=${d?.errorCode ?? d?.error ?? (d ? "json" : "nil")}:${name ? "ok" : "none"}` };
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
  ],
  codm: [
    { p: "isan", path: "codm" },
    { p: "vol", slug: "call-of-duty-mobile-indonesia" },
    { p: "vol", slug: "codm-us" },
    { p: "nef", slug: "cod-mobile" },
  ],
  valorant: [
    { p: "isan", path: "valo" },
    { p: "vol", slug: "valorant-indonesia" },
    { p: "vol", slug: "valorant-singapore" },
    { p: "nef", slug: "valorant" },
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
    case "cosh":
      return codashopLookup({ type: (step.slug || ""), svc: step.svc, ppid: step.ppid, zone: step.zone, shop: step.shop || "id_ID" }, id, zoneId);
    default:
      return Promise.resolve({ name: "", info: "unknown-step" });
  }
}


// ============================================================================
// Store chat assistant (Gemini). The Gemini API key lives ONLY here (Deno env),
// never in the browser. Answers come from the store's own prices (public.catalog).
// ============================================================================
const GEMINI_MODEL = "gemini-flash-latest";
const SITE_URL = "https://naroelwakel-dot.github.io/MigoAi/";
const WHATSAPP = "https://wa.me/201060934020";

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

function pickRelevant(msg: string, cat: { sku: string; price: number }[], limit = 16) {
  const words = (msg || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  if (!words.length) return [] as { sku: string; price: number }[];
  return cat
    .map((r) => {
      const s = r.sku.toLowerCase();
      let sc = 0;
      for (const w of words) if (s.includes(w)) sc += w.length >= 4 ? 2 : 1;
      return { r, sc };
    })
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, limit)
    .map((x) => x.r);
}

function buildSystem(cat: { sku: string; price: number }[], msg: string): string {
  const rel = pickRelevant(msg, cat, 16);
  const priceLines = rel.map((r) => `- ${r.sku} : ${r.price} ج.م`).join("\n");
  return `أنت "مساعد Migo"، مساعد الدعم في متجر Migo AI Solution (شحن ألعاب وخدمات رقمية بالـ ID في مصر).
قواعد:
- ردّ بالعربي، بأسلوب ودود ومبسّط، في 3 أسطر كحد أقصى، وبدون مقدمات إنشائية.
- أعطِ السعر والمدة فوراً من القائمة أدناه بالضبط. لا تخترع أي سعر أو مدة أبداً.
- كل الأسعار بالجنيه المصري (ج.م)، والتسليم عادةً من 2 إلى 5 دقائق بعد الدفع.
- لو المعلومة مش موجودة في القائمة، قول بصراحة إنها مش متاحة هنا، ووجّه العميل لواتساب: ${WHATSAPP}
- لما يحب يشتري، اطلب منه رقم الـ ID (معرّف اللعبة/الحساب) وطريقة الدفع.
- متتكلمش عن أسعار الموردين ولا أي حاجة مش من المتجر.
صفحة كل الأسعار: ${SITE_URL}catalog.html
${priceLines ? "أسعار من المتجر تطابق سؤال العميل:\n" + priceLines : "(مفيش منتج مطابق واضح لسؤال العميل في القائمة.)"}`;
}

async function handleChat(req: Request): Promise<Response> {
  const key = Deno.env.get("GEMINI_API_KEY") || "";
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: "no-key" }), { status: 200, headers: CORS_HEADERS });
  }
  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const message = String(body.message || "").slice(0, 800).trim();
  if (!message) {
    return new Response(JSON.stringify({ ok: false, error: "empty" }), { status: 200, headers: CORS_HEADERS });
  }
  const hist = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const cat = await getCatalog();
  const contents = [
    ...hist.map((h: any) => ({
      role: h && h.role === "model" ? "model" : "user",
      parts: [{ text: String((h && h.text) || "").slice(0, 500) }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];
  const payload = {
    systemInstruction: { parts: [{ text: buildSystem(cat, message) }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 320 },
  };
  let gStatus = 0;
  let gBody = "";
  let res: any = null;
  try {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(payload) },
      15000,
    );
    gStatus = r.status;
    gBody = await r.text();
    res = JSON.parse(gBody);
  } catch (e) {
    gBody = "ERR:" + String(e).slice(0, 300);
  }
  const text = res?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  if (!text) {
    try {
      const dbg = (gBody || "").split(key).join("[key]").slice(0, 1500);
      const lp = fetch(`${SB_URL}/rest/v1/chat_debug`, {
        method: "POST",
        headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ status: gStatus, note: "key-present", body: dbg }),
      }).catch(() => {});
      (globalThis as any).EdgeRuntime?.waitUntil?.(lp);
    } catch (_) {}
    return new Response(
      JSON.stringify({ ok: true, reply: `معلش مش قادر أجاوب دلوقتي. كلّمنا على واتساب: ${WHATSAPP}`, fallback: true }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
  return new Response(JSON.stringify({ ok: true, reply: String(text).trim() }), { status: 200, headers: CORS_HEADERS });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname.replace(/\/+$/, "").endsWith("/chat")) {
    return await handleChat(req);
  }
  let game = (url.searchParams.get("game") || "").toLowerCase().trim();
  const id = (url.searchParams.get("id") || "").trim();
  const zoneId = (url.searchParams.get("zoneId") || "").trim();

  if (ALIASES[game]) game = ALIASES[game];

  if (!game || !id) {
    return new Response(
      JSON.stringify({ success: false, message: "يرجى تحديد اللعبة ورقم المعرف (Player ID)" }),
      { status: 200, headers: CORS_HEADERS },
    );
  }

  let foundName = "";
  let avatarUrl = "";
  const isNumeric = /^\d+$/.test(id);
  const debug = url.searchParams.get("debug") === "1";
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
      const force = (url.searchParams.get("force") || "").trim().toLowerCase();
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
        { status: 200, headers: CORS_HEADERS },
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        message: "تعذّر الفحص التلقائي لهذا المعرّف الآن، وهذا لا يمنع إتمام طلبك: اكتب اسم حسابك ثم اضغط متابعة.",
        trace: debug ? trace : undefined,
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (_) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "اكتب اسم حسابك ثم اضغط متابعة لإتمام طلبك فوراً.",
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
});

