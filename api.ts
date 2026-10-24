const H = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// دالة آمنة لقراءة الردود دون التسبب في خطأ <!DOCTYPE
async function safeFetchJson(url: string, options: any = {}): Promise<any> {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(5000), // مهلة 5 ثوانٍ كحد أقصى
    });
    const text = await res.text();
    if (!text || text.trim().startsWith("<")) return null; // تجاهل أي رد HTML
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

// دالة ذكية لاستخراج اسم اللاعب مهما كان شكل رد السيرفر
function extractName(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data.data === "string") return data.data.trim();
  if (typeof data.data?.name === "string") return data.data.name.trim();
  if (typeof data.data?.username === "string") return data.data.username.trim();
  if (typeof data.name === "string") return data.name.trim();
  if (typeof data.username === "string") return data.username.trim();
  if (typeof data.nickname === "string") return data.nickname.trim();
  if (typeof data.charac_name === "string") return decodeURIComponent(data.charac_name).trim();
  return "";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: H });
  }

  const u = new URL(req.url);
  const g = (u.searchParams.get("game") || "").toLowerCase().trim();
  const id = (u.searchParams.get("id") || "").trim();
  const z = (u.searchParams.get("zoneId") || "").trim();

  if (!g || !id) {
    return new Response(
      JSON.stringify({ success: false, message: "يرجى إدخال معرف اللاعب أولاً" }),
      { status: 200, headers: H }
    );
  }

  let playerName = "";

  try {
    // 1. فحص ببجي (PUBG Mobile)
    if (g === "pubg") {
      let res = await safeFetchJson(`https://api.isan.eu.org/nickname/pubg?id=${encodeURIComponent(id)}`);
      playerName = extractName(res);

      if (!playerName) {
        res = await safeFetchJson(`https://v2.api.isan.eu.org/nickname/pubg?id=${encodeURIComponent(id)}`);
        playerName = extractName(res);
      }

      if (!playerName) {
        res = await safeFetchJson("https://www.midasbuy.com/interface/getGUserInfo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
            "Origin": "https://www.midasbuy.com",
            "Referer": "https://www.midasbuy.com/",
          },
          body: JSON.stringify({
            appid: "1450015065",
            currency_type: "USD",
            openid: id,
            pf: "mds_games_pc-outer-game_1450015065-android",
          }),
        });
        playerName = extractName(res);
      }
    }

    // 2. فحص فري فاير (Free Fire)
    else if (g === "freefire") {
      let res = await safeFetchJson(`https://www.smile.one/merchant/freefire/checkrole?user_id=${encodeURIComponent(id)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      playerName = extractName(res);

      if (!playerName) {
        res = await safeFetchJson(`https://api.isan.eu.org/nickname/freefire?id=${encodeURIComponent(id)}`);
        playerName = extractName(res);
      }
    }

    // 3. فحص موبايل ليجندز (Mobile Legends)
    else if (g === "mlbb") {
      if (!z) {
        return new Response(
          JSON.stringify({ success: false, message: "لعبة Mobile Legends تتطلب إدخال رقم الـ Zone ID" }),
          { status: 200, headers: H }
        );
      }
      let res = await safeFetchJson(`https://www.smile.one/merchant/mobilelegends/checkrole?user_id=${encodeURIComponent(id)}&zone_id=${encodeURIComponent(z)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      playerName = extractName(res);

      if (!playerName) {
        res = await safeFetchJson(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(z)}`);
        playerName = extractName(res);
      }
    }

    // 4. فيفا (FC Mobile) وباقي الألعاب
    else if (g === "fifa" || g === "fcmobile") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "شركة EA لا تتيح الاستعلام عن الاسم تلقائياً. اكتب اسم حسابك يدوياً واضغط متابعة الدفع.",
        }),
        { status: 200, headers: H }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "يمكنك إدخال اسم حسابك يدوياً ومتابعة الشحن مباشرة.",
        }),
        { status: 200, headers: H }
      );
    }

    // الرد النهائي
    if (playerName) {
      return new Response(JSON.stringify({ success: true, username: playerName }), {
        status: 200,
        headers: H,
      });
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "تعذر جلب الاسم تلقائياً، تأكد من الـ ID أو اكتب الاسم يدوياً وأكمل طلبك.",
        }),
        { status: 200, headers: H }
      );
    }
  } catch (_) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "اكتب اسم حسابك يدوياً واضغط متابعة لإتمام الطلب.",
      }),
      { status: 200, headers: H }
    );
  }
});
