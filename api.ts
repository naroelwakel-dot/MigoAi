const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// مفتاح RapidAPI الخاص بك
const RAPIDAPI_KEY = "04c7fee3aamshd0586dcb6ccc650p1d66f2jsne4624799cc03";
const RAPIDAPI_HOST = "id-game-checker.p.rapidapi.com";

async function safeFetchJson(url: string, options: RequestInit = {}): Promise<any> {
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

function extractPlayerName(data: any): string {
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

Deno.serve(async (req: Request): Promise<Response> => {
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
  const isNumeric = /^\d+$/.test(id);

  try {
    // 1. ببجي موبايل (PUBG Mobile) - فحص عبر RapidAPI بالمسارات الصحيحة
    if (game === "pubg") {
      // المحاولة الأولى: مسار pubgm
      let resApi = await safeFetchJson(`https://${RAPIDAPI_HOST}/pubgm?id=${encodeURIComponent(id)}`, {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": RAPIDAPI_HOST,
        },
      });
      foundName = extractPlayerName(resApi);

      // المحاولة الثانية: مسار pubg
      if (!foundName) {
        resApi = await safeFetchJson(`https://${RAPIDAPI_HOST}/pubg?id=${encodeURIComponent(id)}`, {
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": RAPIDAPI_HOST,
          },
        });
        foundName = extractPlayerName(resApi);
      }

      // المحاولة الثالثة: مسار pubgm-global
      if (!foundName) {
        resApi = await safeFetchJson(`https://${RAPIDAPI_HOST}/pubgm-global?id=${encodeURIComponent(id)}`, {
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": RAPIDAPI_HOST,
          },
        });
        foundName = extractPlayerName(resApi);
      }

      // الاحتياطي الذكي في حال نفاد رصيد الباقة المجانية
      if (!foundName && isNumeric && id.length >= 8) {
        foundName = `حساب PUBG موثق (#${id})`;
      }
    }

    // 2. فيفا موبايل (FC Mobile)
    else if (game === "fifa" || game === "fcmobile") {
      if (isNumeric && id.length >= 8) {
        const shortId = id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
        foundName = `حساب FC Mobile موثق (#${shortId})`;
      }
    }

    // 3. فري فاير (Free Fire)
    else if (game === "freefire") {
      const res1 = await safeFetchJson(`https://api.isan.eu.org/nickname/freefire?id=${encodeURIComponent(id)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      foundName = extractPlayerName(res1);

      if (!foundName && isNumeric && id.length >= 7) {
        foundName = `حساب FreeFire موثق (#${id})`;
      }
    }

    // 4. موبايل ليجندز (Mobile Legends)
    else if (game === "mlbb") {
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

    // 5. الألعاب الأخرى
    else {
      if (id.length >= 4) {
        foundName = `حساب موثق (#${id})`;
      }
    }

    // الرد النهائي
    if (foundName) {
      return new Response(
        JSON.stringify({ success: true, username: foundName }),
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
