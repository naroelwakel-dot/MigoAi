const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
    const u = new URL(req.url);
    const g = (u.searchParams.get("game") || "").toLowerCase().trim();
    const id = (u.searchParams.get("id") || "").trim();
    const z = (u.searchParams.get("zoneId") || "").trim();
    if (!g || !id) return new Response(JSON.stringify({ success: false, message: "Missing data" }), { headers: H });
    try {
      let name = "";
      if (g === "pubg") {
        const r = await fetch("https://www.midasbuy.com/interface/getGUserInfo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appid: "1450015065", currency_type: "USD", openid: id }) });
        const d = await r.json();
        if (d?.charac_name) name = decodeURIComponent(d.charac_name);
        else throw new Error("Invalid PUBG ID");
      } else if (g === "freefire") {
        const r = await fetch("https://www.smile.one/merchant/freefire/checkrole?user_id=" + id);
        const d = await r.json();
        if (d?.username) name = decodeURIComponent(d.username);
        else throw new Error("Invalid Free Fire ID");
      } else if (g === "mlbb") {
        if (!z) throw new Error("Zone ID required");
        const r = await fetch("https://www.smile.one/merchant/mobilelegends/checkrole?user_id=" + id + "&zone_id=" + z);
        const d = await r.json();
        if (d?.username) name = decodeURIComponent(d.username);
        else throw new Error("Invalid MLBB ID");
      } else if (g === "fifa" || g === "fcmobile") {
        const r = await fetch("https://www.smile.one/merchant/fcmobile/checkrole?user_id=" + id);
        const d = await r.json();
        if (d?.username) name = decodeURIComponent(d.username);
        else throw new Error("Invalid FC Mobile ID");
      } else {
        throw new Error("Unsupported game");
      }
      return new Response(JSON.stringify({ success: true, username: name }), { headers: H });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, message: e.message || "Failed" }), { headers: H });
    }
  }
};
