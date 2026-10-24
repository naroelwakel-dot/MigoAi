const H = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

  try {
    let name = "";

    if (g === "pubg") {
      // فحص ببجي عبر نقطة Midasbuy الرسمية الموثقة
      const res = await fetch("https://www.midasbuy.com/interface/getGUserInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Origin": "https://www.midasbuy.com",
          "Referer": "https://www.midasbuy.com/midasbuy/ot/buy/pubgm",
          "Accept": "application/json, text/plain, */*",
        },
        body: JSON.stringify({
          appid: "1450015065",
          currency_type: "USD",
          openid: id,
        }),
      });

      const raw = await res.text();
      let d: any = null;
      try {
        d = JSON.parse(raw);
      } catch (_) {
        // في حال كان الرد نصياً غير مهيأ
      }

      if (d?.charac_name) {
        name = decodeURIComponent(d.charac_name);
      } else if (d?.msg && d.msg !== "SUCCESS") {
        throw new Error(d.msg);
      } else {
        throw new Error("لم يتم العثور على اسم اللاعب، تأكد من صحة رقم الـ ID");
      }

    } else if (g === "freefire") {
      const res = await fetch(`https://www.smile.one/merchant/freefire/checkrole?user_id=${encodeURIComponent(id)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const d = await res.json();
      if (d?.username) name = decodeURIComponent(d.username);
      else throw new Error("رقم معرف فري فاير غير صحيح");

    } else if (g === "mlbb") {
      if (!z) throw new Error("مطلوب إدخال Zone ID");
      const res = await fetch(`https://www.smile.one/merchant/mobilelegends/checkrole?user_id=${encodeURIComponent(id)}&zone_id=${encodeURIComponent(z)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const d = await res.json();
      if (d?.username) name = decodeURIComponent(d.username);
      else throw new Error("بيانات حساب Mobile Legends غير صحيحة");

    } else if (g === "fifa" || g === "fcmobile") {
      const res = await fetch(`https://www.smile.one/merchant/fcmobile/checkrole?user_id=${encodeURIComponent(id)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const d = await res.json();
      if (d?.username) name = decodeURIComponent(d.username);
      else throw new Error("رقم معرف FC Mobile غير صحيح");

    } else {
      throw new Error("اللعبة غير مدعومة بالفحص التلقائي");
    }

    return new Response(JSON.stringify({ success: true, username: name }), {
      status: 200,
      headers: H,
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || "تعذر التحقق من الحساب" }),
      { status: 200, headers: H }
    );
  }
});
