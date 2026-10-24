const H = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // التعامل مع طلبات فحص الأمان (CORS Preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: H });
  }

  const u = new URL(req.url);
  const g = (u.searchParams.get("game") || "").toLowerCase().trim();
  const id = (u.searchParams.get("id") || "").trim();
  const z = (u.searchParams.get("zoneId") || "").trim();

  if (!g || !id) {
    return new Response(
      JSON.stringify({ success: false, message: "يرجى تحديد اللعبة ورقم المعرف (ID)" }),
      { status: 200, headers: H }
    );
  }

  try {
    let name = "";

    if (g === "pubg") {
      const res = await fetch("https://www.midasbuy.com/interface/getGUserInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.midasbuy.com/",
        },
        body: JSON.stringify({
          appid: "1450015065",
          currency_type: "USD",
          openid: id,
        }),
      });

      const rawText = await res.text();
      let d: any;
      try {
        d = JSON.parse(rawText);
      } catch {
        throw new Error("تعذر فحص حساب ببجي حالياً، تأكد من صحة الـ ID");
      }

      if (d?.charac_name) {
        name = decodeURIComponent(d.charac_name);
      } else if (d?.msg) {
        throw new Error(d.msg);
      } else {
        throw new Error("رقم معرف ببجي غير صحيح");
      }

    } else if (g === "freefire") {
      const res = await fetch(
        `https://www.smile.one/merchant/freefire/checkrole?user_id=${encodeURIComponent(id)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        }
      );
      const rawText = await res.text();
      let d: any;
      try {
        d = JSON.parse(rawText);
      } catch {
        throw new Error("سيرفر فحص فري فاير غير متاح حالياً");
      }

      if (d?.username) {
        name = decodeURIComponent(d.username);
      } else {
        throw new Error("رقم معرف فري فاير غير صحيح");
      }

    } else if (g === "mlbb") {
      if (!z) throw new Error("مطلوب إدخال معرف السيرفر (Zone ID)");
      const res = await fetch(
        `https://www.smile.one/merchant/mobilelegends/checkrole?user_id=${encodeURIComponent(id)}&zone_id=${encodeURIComponent(z)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        }
      );
      const rawText = await res.text();
      let d: any;
      try {
        d = JSON.parse(rawText);
      } catch {
        throw new Error("سيرفر فحص Mobile Legends غير متاح حالياً");
      }

      if (d?.username) {
        name = decodeURIComponent(d.username);
      } else {
        throw new Error("بيانات حساب Mobile Legends غير صحيحة");
      }

    } else if (g === "fifa" || g === "fcmobile") {
      const res = await fetch(
        `https://www.smile.one/merchant/fcmobile/checkrole?user_id=${encodeURIComponent(id)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        }
      );
      const rawText = await res.text();
      let d: any;
      try {
        d = JSON.parse(rawText);
      } catch {
        throw new Error("سيرفر فحص FC Mobile غير متاح حالياً");
      }

      if (d?.username) {
        name = decodeURIComponent(d.username);
      } else {
        throw new Error("رقم معرف FC Mobile غير صحيح");
      }

    } else {
      throw new Error("هذه اللعبة غير مدعومة بالفحص التلقائي حالياً");
    }

    return new Response(JSON.stringify({ success: true, username: name }), {
      status: 200,
      headers: H,
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || "فشلت عملية الفحص" }),
      { status: 200, headers: H }
    );
  }
});
