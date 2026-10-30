// build marker 2026-10-30T13:30Z: rebuild after VOLSEVER_API_KEY set
// ==============================================================================
// Migo AI Solution - Verification Engine API (Deno Server)
// Real account lookup only. No fabricated / placeholder names.
// If a game has no reachable free source, we return an honest "not found"
// and the storefront lets the customer type their name and continue.
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
// Last-resort (free, no key): JollyMax public top-up gateway (PUBG Mobile UID -> nickname)
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
// Best-effort free source: isan.eu.org (Mobile Legends / Free Fire nickname)
// ----------------------------------------------------------------------------
async function lookupIsan(path: string): Promise<string> {
  const d = await getJson(`https://api.isan.eu.org/nickname/${path}`, { headers: { "User-Agent": UA } }, 6000);
  if (d && d.success === false) return "";
  return extractPlayerName(d);
}

// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Keyed Game-ID providers (PUBG Mobile UID -> nickname).
// Set ANY ONE of these as a Deno environment variable and it is tried first:
//   VOLSEVER_API_KEY    (https://volsever.com/checker/pubg-mobile)
//   NEFERBYTE_API_KEY   (Telegram @idgamecheckerbot -> https://api.neferbyte.com)
//   RAPIDAPI_KEY        (rapidapi.com -> id-game-checker)
// No key is hard-coded in this file. With none set, only JollyMax is tried.
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

async function lookupPubgVolsever(id: string, key: string): Promise<string> {
  const d = await getJson(
    `https://gate.volsever.com/proxy/api/game/pubg-mobile-global?id=${encodeURIComponent(id)}`,
    { headers: { "X-API-Key": key, "Accept": "application/json", "User-Agent": UA } },
    8000,
  );
  const u = d?.data?.username ?? d?.username;
  return typeof u === "string" ? u.trim() : "";
}

async function lookupPubgNeferbyte(id: string, key: string): Promise<string> {
  const d = await getJson(
    `https://api.neferbyte.com/game-id-checker/pubgm-global/${encodeURIComponent(id)}`,
    { headers: { "x-api-key": key, "Accept": "application/json", "User-Agent": UA } },
    8000,
  );
  const u = d?.data?.username ?? d?.username;
  return typeof u === "string" ? u.trim() : "";
}

async function lookupPubgRapidApi(id: string, key: string): Promise<string> {
  for (const path of ["pubgm-global", "pubgm"]) {
    const d = await getJson(
      `https://id-game-checker.p.rapidapi.com/${path}?id=${encodeURIComponent(id)}`,
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
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return "";
}

async function lookupPubg(id: string): Promise<string> {
  const vol = envKey("VOLSEVER_API_KEY", "PUBG_VOLSEVER_KEY");
  const nef = envKey("NEFERBYTE_API_KEY", "PUBG_NEFERBYTE_KEY");
  const rap = envKey("RAPIDAPI_KEY", "RAPIDAPI_PUBG_KEY");

  const tries: Array<() => Promise<string>> = [];
  if (vol) tries.push(() => lookupPubgVolsever(id, vol));
  if (nef) tries.push(() => lookupPubgNeferbyte(id, nef));
  if (rap) tries.push(() => lookupPubgRapidApi(id, rap));
  for (const t of tries) {
    const name = await t();
    if (name) return name;
  }
  return await lookupPubgJollyMax(id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const game = (url.searchParams.get("game") || "").toLowerCase().trim();
  const id = (url.searchParams.get("id") || "").trim();
  const zoneId = (url.searchParams.get("zoneId") || "").trim();

  if (!game || !id) {
    return new Response(
      JSON.stringify({ success: false, message: "يرجى تحديد اللعبة ورقم المعرف (Player ID)" }),
      { status: 200, headers: CORS_HEADERS },
    );
  }

  let foundName = "";
  let avatarUrl = "";
  const isNumeric = /^\d+$/.test(id);

  try {
    // ---- TikTok ----
    if (game === "tiktok") {
      const r = await resolveTikTokUser(id);
      foundName = r.name;
      avatarUrl = r.avatar;
    } // ---- Telegram Stars ----
    else if (game === "telegram" || game === "telegramstars") {
      const r = await resolveTelegramUser(id);
      foundName = r.name;
      avatarUrl = r.avatar;
    } // ---- Roblox (official) ----
    else if (game === "roblox") {
      if (isNumeric) foundName = await lookupRoblox(id);
    } // ---- Genshin Impact (Enka) ----
    else if (game === "genshin" || game === "genshinimpact") {
      if (isNumeric) foundName = await lookupGenshin(id);
    } // ---- PUBG Mobile (JollyMax) ----
    else if (game === "pubg" || game === "pubgmobile" || game === "pubg_mobile") {
      if (isNumeric) foundName = await lookupPubg(id);
    } // ---- Free Fire (isan, best effort) ----
    else if (game === "freefire" || game === "free_fire") {
      if (isNumeric) foundName = await lookupIsan(`freefire?id=${encodeURIComponent(id)}`);
    } // ---- Mobile Legends (isan, needs zone) ----
    else if (game === "mlbb" || game === "mobilelegends" || game === "mobile_legends") {
      if (!zoneId) {
        return new Response(
          JSON.stringify({ success: false, message: "لعبة Mobile Legends تتطلب إدخال رقم السيرفر (Zone ID)" }),
          { status: 200, headers: CORS_HEADERS },
        );
      }
      foundName = await lookupIsan(`ml?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(zoneId)}`);
    }

    // Everything else: no free real source available yet -> honest "not found".
    if (foundName) {
      return new Response(
        JSON.stringify({ success: true, username: foundName, name: foundName, avatar: avatarUrl || undefined }),
        { status: 200, headers: CORS_HEADERS },
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        message: "تم التحقق من المدخلات، ولم نجد الاسم تلقائياً. اكتب اسم حسابك يدوياً واضغط متابعة لإتمام طلبك.",
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (_) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "اكتب اسم حسابك يدوياً واضغط متابعة لإتمام طلبك فوراً.",
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
});

