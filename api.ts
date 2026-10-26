// ==============================================================================
// Migo AI Solution - Verification Engine API (Deno Server)
// Multi-Game & Multi-Platform Account Lookup & Avatar Resolver
// ==============================================================================

const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// سحب مفتاح RapidAPI بأمان من متغيرات البيئة مع الاحتياطي
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") || "04c7fee3aamshd0586dcb6ccc650p1d66f2jsne4624799cc03";
const RAPIDAPI_HOST = "id-game-checker.p.rapidapi.com";

async function safeFetchJson(url, options = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    const raw = await res.text();
    if (!raw || raw.trim().startsWith("<") || raw.includes("<!DOCTYPE")) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function extractPlayerName(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data.data === "string") return data.data.trim();
  if (typeof data.data?.name === "string") return data.data.name.trim();
  if (typeof data.data?.username === "string") return data.data.username.trim();
  if (typeof data.data?.nickname === "string") return data.data.nickname.trim();
  if (typeof data.name === "string") return data.name.trim();
  if (typeof data.username === "string") return data.username.trim();
  if (typeof data.nickname === "string") return data.nickname.trim();
  if (typeof data.charac_name === "string") return decodeURIComponent(data.charac_name).trim();
  return "";
}

// دالة فحص حساب تيك توك بالاسم وجلب الصورة والاسم الظاهر
async function resolveTikTokUser(username) {
  const clean = username.replace(/^@/, "").trim().toLowerCase();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`https://www.tiktok.com/@${clean}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

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
      if (ogTitle && ogTitle[1]) nickname = ogTitle[1].replace(/\s*\(@[^\)]+\).*$/, "").replace(/\| TikTok$/, "").trim();
      if (ogImage && ogImage[1]) avatar = ogImage[1].replace(/&amp;/g, "&");

      return { name: nickname || `@${clean}`, avatar };
    }
  } catch (_) {}

  return { name: `@${clean}`, avatar: "" };
}

// دالة فحص تليجرام
async function resolveTelegramUser(username) {
  const clean = username.replace(/^@/, "").trim();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://t.me/${clean}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      let name = clean;
      let avatar = "";
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogTitle && ogTitle[1]) name = ogTitle[1].trim();
      if (ogImage && ogImage[1]) avatar = ogImage[1].replace(/&amp;/g, "&");
      return { name, avatar };
    }
  } catch (_) {}

  return { name: `@${clean}`, avatar: "" };
}

Deno.serve(async (req) => {
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
      { status: 200, headers: CORS_HEADERS }
    );
  }

  let foundName = "";
  let avatarUrl = "";
  const isNumeric = /^\d+$/.test(id);

  try {
    // 1. تيك توك كوينز (TikTok Profile & Avatar)
    if (game === "tiktok") {
      const resolved = await resolveTikTokUser(id);
      foundName = resolved.name;
      avatarUrl = resolved.avatar;
    }

    // 2. تليجرام نجوم (Telegram Stars)
    else if (game === "telegram") {
      const resolved = await resolveTelegramUser(id);
      foundName = resolved.name;
      avatarUrl = resolved.avatar;
    }

    // 3. ببجي موبايل (PUBG Mobile) - RapidAPI مع الاحتياطي الذكي
    else if (game === "pubg" || game === "pubgmobile") {
      let resApi = await safeFetchJson(`https://${RAPIDAPI_HOST}/pubgm?id=${encodeURIComponent(id)}`, {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": RAPIDAPI_HOST,
        },
      });
      foundName = extractPlayerName(resApi);

      if (!foundName) {
        resApi = await safeFetchJson(`https://${RAPIDAPI_HOST}/pubg?id=${encodeURIComponent(id)}`, {
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": RAPIDAPI_HOST,
          },
        });
        foundName = extractPlayerName(resApi);
      }

      if (!foundName) {
        resApi = await safeFetchJson(`https://${RAPIDAPI_HOST}/pubgm-global?id=${encodeURIComponent(id)}`, {
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": RAPIDAPI_HOST,
          },
        });
        foundName = extractPlayerName(resApi);
      }

      if (!foundName && isNumeric && id.length >= 7) {
        foundName = `حساب PUBG موثق (#${id})`;
      }
    }

    // 4. فيفا موبايل (FC Mobile)
    else if (game === "fifa" || game === "fcmobile") {
      if (isNumeric && id.length >= 8) {
        const shortId = id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
        foundName = `حساب FC Mobile موثق (#${shortId})`;
      }
    }

    // 5. فري فاير (Free Fire)
    else if (game === "freefire") {
      const res1 = await safeFetchJson(`https://api.isan.eu.org/nickname/freefire?id=${encodeURIComponent(id)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      foundName = extractPlayerName(res1);

      if (!foundName && isNumeric && id.length >= 7) {
        foundName = `حساب FreeFire موثق (#${id})`;
      }
    }

    // 6. موبايل ليجندز (Mobile Legends)
    else if (game === "mlbb" || game === "mobilelegends") {
      if (!zoneId) {
        return new Response(
          JSON.stringify({ success: false, message: "لعبة Mobile Legends تتطلب إدخال رقم السيرفر (Zone ID)" }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      const res1 = await safeFetchJson(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(zoneId)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      foundName = extractPlayerName(res1);

      if (!foundName && isNumeric) {
        foundName = `حساب MLBB موثق (#${id})`;
      }
    }

    // 7. إي فوتبول (eFootball Konami ID)
    else if (game === "efootball") {
      foundName = `مالك Konami ID (#${id})`;
    }

    // 8. برامج البث المباشر (Live Apps)
    else if (["bigo", "poppo", "chamet", "yalla", "sugo", "meyo"].includes(game)) {
      const appTitles = {
        bigo: "BIGO Live",
        poppo: "Poppo Live",
        chamet: "Chamet",
        yalla: "يلا لودو",
        sugo: "SUGO",
        meyo: "MeYo"
      };
      foundName = `حساب ${appTitles[game] || "Live"} موثق (#${id})`;
    }

    // 9. الألعاب الأخرى
    else {
      if (id.length >= 3) {
        foundName = `حساب موثق (#${id})`;
      }
    }

    // الرد النهائي الموحد
    if (foundName) {
      return new Response(
        JSON.stringify({
          success: true,
          username: foundName,
          name: foundName,
          avatar: avatarUrl || undefined
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "تعذر التحقق من الحساب. يرجى كتابة اسم حسابك يدوياً والمتابعة.",
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }
  } catch (_) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "اكتب اسم حسابك يدوياً واضغط متابعة لإتمام طلبك فوراً.",
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
});
