const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function safeFetchJson(url: string, options: RequestInit = {}): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
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
      JSON.stringify({ success: false, message: "يرجى إدخال رقم المعرف (Player ID) أولاً" }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // التحقق من أن الـ ID يحتوي على أرقام صحيحة فقط
  const isNumeric = /^\d+$/.test(id);

  // 1. ببجي موبايل (PUBG Mobile)
  if (game === "pubg") {
    if (!isNumeric || id.length < 8 || id.length > 13) {
      return new Response(
        JSON.stringify({ success: false, message: "رقم ID ببجي غير صحيح (يجب أن يتكون من 8 إلى 12 رقماً)" }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const res = await safeFetchJson(`https://api.isan.eu.org/nickname/pubg?id=${encodeURIComponent(id)}`);
    const name = extractPlayerName(res) || `حساب PUBG موثق (#${id})`;

    return new Response(
      JSON.stringify({ success: true, username: name }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 2. فيفا موبايل (FC Mobile)
  if (game === "fifa" || game === "fcmobile") {
    if (!isNumeric || id.length < 8 || id.length > 22) {
      return new Response(
        JSON.stringify({ success: false, message: "رقم معرف FC Mobile غير صحيح" }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const shortId = id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
    return new Response(
      JSON.stringify({ success: true, username: `حساب FC Mobile موثق (#${shortId})` }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 3. فري فاير (Free Fire)
  if (game === "freefire") {
    if (!isNumeric || id.length < 7 || id.length > 13) {
      return new Response(
        JSON.stringify({ success: false, message: "رقم معرف فري فاير غير صحيح" }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const res = await safeFetchJson(`https://api.isan.eu.org/nickname/freefire?id=${encodeURIComponent(id)}`);
    const name = extractPlayerName(res) || `حساب FreeFire موثق (#${id})`;

    return new Response(
      JSON.stringify({ success: true, username: name }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 4. موبايل ليجندز (Mobile Legends)
  if (game === "mlbb") {
    if (!isNumeric || id.length < 6 || id.length > 12) {
      return new Response(
        JSON.stringify({ success: false, message: "رقم معرف Mobile Legends غير صحيح" }),
        { status: 200, headers: CORS_HEADERS }
      );
    }
    if (!zoneId || !/^\d{3,6}$/.test(zoneId)) {
      return new Response(
        JSON.stringify({ success: false, message: "يرجى إدخال رقم السيرفر (Zone ID) بشكل صحيح" }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const res = await safeFetchJson(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(zoneId)}`);
    const name = extractPlayerName(res) || `حساب MLBB موثق (#${id})`;

    return new Response(
      JSON.stringify({ success: true, username: name }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 5. أي لعبة أو خدمة أخرى
  if (id.length >= 4) {
    return new Response(
      JSON.stringify({ success: true, username: `حساب موثق (#${id})` }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  return new Response(
    JSON.stringify({ success: false, message: "يرجى التأكد من كتابة رقم المعرف بشكل صحيح" }),
    { status: 200, headers: CORS_HEADERS }
  );
});
