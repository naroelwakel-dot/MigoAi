const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// فحص وقراءة آمنة تتجاهل صفحات الحجب وأخطاء السيرفرات الخارجية
async function safeFetchJson(url: string, options: RequestInit = {}): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const raw = await res.text();
    if (!raw || raw.trim().startsWith("<") || raw.includes("<!DOCTYPE")) {
      return null;
    }

    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// استخراج اسم اللاعب بدقة من مختلف التنسيقات
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

  try {
    // 1. ببجي موبايل (PUBG Mobile)
    if (game === "pubg") {
      const resMidas = await safeFetchJson("https://www.midasbuy.com/interface/getGUserInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Origin": "https://www.midasbuy.com",
          "Referer": "https://www.midasbuy.com/midasbuy/ot/buy/pubgm",
          "Cookie": "country=eg; lang=ar; zone=GLOBAL;",
        },
        body: JSON.stringify({
          appid: "1450015065",
          currency_type: "USD",
          openid: id,
          pf: "mds_games_pc-outer-game_1450015065-android",
        }),
      });
      foundName = extractPlayerName(resMidas);

      if (!foundName) {
        const res1 = await safeFetchJson(`https://api.isan.eu.org/nickname/pubg?id=${encodeURIComponent(id)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        foundName = extractPlayerName(res1);
      }

      if (!foundName) {
        const res2 = await safeFetchJson(`https://v2.api.isan.eu.org/nickname/pubg?id=${encodeURIComponent(id)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        foundName = extractPlayerName(res2);
      }
    }

    // 2. فيفا موبايل (EA Sports FC Mobile)
    else if (game === "fifa" || game === "fcmobile") {
      const resFifa1 = await safeFetchJson(
        `https://www.smile.one/merchant/fifamobile/checkrole?user_id=${encodeURIComponent(id)}`,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
      );
      foundName = extractPlayerName(resFifa1);

      if (!foundName) {
        const resFifa2 = await safeFetchJson(
          `https://www.smile.one/merchant/eafcmobile/checkrole?user_id=${encodeURIComponent(id)}`,
          { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
        );
        foundName = extractPlayerName(resFifa2);
      }

      if (!foundName) {
        const resFifa3 = await safeFetchJson(
          `https://www.smile.one/merchant/eafc/checkrole?user_id=${encodeURIComponent(id)}`,
          { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
        );
        foundName = extractPlayerName(resFifa3);
      }

      if (!foundName) {
        const resFifa4 = await safeFetchJson(`https://api.isan.eu.org/nickname/eafc?id=${encodeURIComponent(id)}`);
        foundName = extractPlayerName(resFifa4);
      }
    }

    // 3. فري فاير (Free Fire)
    else if (game === "freefire") {
      const res1 = await safeFetchJson(`https://api.isan.eu.org/nickname/freefire?id=${encodeURIComponent(id)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      foundName = extractPlayerName(res1);

      if (!foundName) {
        const res2 = await safeFetchJson(`https://www.smile.one/merchant/freefire/checkrole?user_id=${encodeURIComponent(id)}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        foundName = extractPlayerName(res2);
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

      if (!foundName) {
        const res2 = await safeFetchJson(
          `https://www.smile.one/merchant/mobilelegends/checkrole?user_id=${encodeURIComponent(id)}&zone_id=${encodeURIComponent(zoneId)}`,
          { headers: { "User-Agent": "Mozilla/5.0" } }
        );
        foundName = extractPlayerName(res2);
      }
    }

    // 5. الألعاب الأخرى
    else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "يمكنك إدخال اسم حسابك يدوياً ومتابعة الشحن مباشرة.",
        }),
        { status: 200, headers: CORS_HEADERS }
      );
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
          message: "تعذر التحقق من الحساب آلياً. يرجى كتابة اسم حسابك يدوياً والمتابعة.",
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
