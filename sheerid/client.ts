/**
 * عميل واجهة تحقق SheerID عند المورد — منفذ TypeScript مطابق لعميل
 * البوت (sheerid/client.py):
 *
 * - المفتاح بيتبعت في ترويسة `X-API-Key` بس، وعمره ما بيظهر في أي خطأ
 *   أو لوج (الأخطاء بتتكوّن من الحالة ومسار الطلب بس).
 * - الردود شكلها مظروف: {"ok": true, "data": {...}} — أي رد من غير
 *   `ok` حقيقي أو فيه حالة HTTP فاشلة بيترفع كـ `SheerIDError`.
 * - النقل قابل للحقن عشان الاختبارات والتدريبات تشتغل على وهمي بس،
 *   من غير أي شبكة ومن غير ما تلمس الخدمة الحقيقية أبدًا.
 *
 * وضع الجسر (bridgeToken مضبوط): نفس العمليات ونفس المظروف، لكن
 * التنفيذ بيتم عبر نقطة البوت الداخلية /api/sheerid-bridge — POST
 * واحد بجسم {"action": ...} وترويسة `x-bridge-token` — والبوت بينفّذ
 * بمفتاح المورد اللي عنده. الموقع في الوضع ده ما يعرفش مفتاح المورد
 * أصلًا، وسلوك الأخطاء والإقفال مطابق للوضع المباشر حرفيًا.
 */

import {
  baseUrl as configBaseUrl,
  BRIDGE_PATH,
  PATH_BALANCE,
  PATH_STATUS,
  PATH_VERIFY,
  REQUEST_TIMEOUT_MS,
} from "./config.ts";

export class SheerIDError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheerIDError";
  }
}

export interface TransportRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface TransportResponse {
  status: number;
  text: string;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export const fetchTransport: Transport = async (req) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
};

export class SheerIDClient {
  private key: string;
  private bridgeToken: string;
  private base: string;
  private transport: Transport;

  constructor(opts: {
    apiKey: string;
    baseUrl?: string;
    transport?: Transport;
    /** توكن جسر البوت — وجوده بيبدّل النقل لوضع الجسر (الأولوية له
     * على النداءات، والمفتاح المباشر بيبقى هو الاحتياطي النظري). */
    bridgeToken?: string;
  }) {
    this.key = (opts.apiKey || "").trim();
    this.bridgeToken = (opts.bridgeToken || "").trim();
    this.base = (opts.baseUrl || configBaseUrl(() => undefined)).replace(
      /\/+$/,
      "",
    );
    this.transport = opts.transport || fetchTransport;
  }

  get hasKey(): boolean {
    return !!(this.key || this.bridgeToken);
  }

  /** وضع الجسر شغّال؟ (التوكن موجود — التنفيذ عند البوت مش المورد). */
  get viaBridge(): boolean {
    return !!this.bridgeToken;
  }

  private async call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.key) throw new SheerIDError("مفتاح خدمة التحقق مش مضبوط");
    const headers: Record<string, string> = {
      "X-API-Key": this.key,
      "Accept": "application/json",
    };
    let payload: string | undefined;
    if (body !== undefined) {
      payload = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    return this.execute({
      url: this.base + path,
      method,
      headers,
      body: payload,
    });
  }

  /** نداء جسر واحد: POST للأفعال على نقطة البوت الداخلية. */
  private async bridgeCall(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.bridgeToken) {
      throw new SheerIDError("مفتاح خدمة التحقق مش مضبوط");
    }
    return this.execute({
      url: this.base + BRIDGE_PATH,
      method: "POST",
      headers: {
        "x-bridge-token": this.bridgeToken,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  /** النقل + فك المظروف — مشترك بين الوضع المباشر ووضع الجسر. */
  private async execute(
    req: TransportRequest,
  ): Promise<Record<string, unknown>> {
    let res: TransportResponse;
    try {
      res = await this.transport(req);
    } catch (e) {
      if (e instanceof SheerIDError) throw e;
      throw new SheerIDError("تعذّر الاتصال بخدمة التحقق");
    }
    let parsed: unknown = null;
    if (res.text && res.text.trim()) {
      try {
        parsed = JSON.parse(res.text);
      } catch {
        parsed = null;
      }
    }
    if (
      res.status >= 400 || parsed === null || typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new SheerIDError(`خدمة التحقق رجّعت رد غير صالح (${res.status})`);
    }
    const envelope = parsed as Record<string, unknown>;
    if (!envelope["ok"]) {
      // رسالة المورد بتتحفظ للسجل/الإدارة بس — الخدمة ما بتعدّيهاش
      // للعميل أبدًا (نصوص العميل ثابتة عندنا).
      const message = String(envelope["message"] || "الطلب اترفض");
      throw new SheerIDError(`خدمة التحقق رفضت الطلب: ${message.slice(0, 200)}`);
    }
    const data = envelope["data"];
    return (data && typeof data === "object" && !Array.isArray(data))
      ? (data as Record<string, unknown>)
      : {};
  }

  /** رصيد محفظة الخدمة عند المورد وحالة توفّرها. */
  balance(): Promise<Record<string, unknown>> {
    if (this.viaBridge) return this.bridgeCall({ action: "balance" });
    return this.call("GET", PATH_BALANCE);
  }

  /** يبعت رابط تحقق واحد للتنفيذ. بيرجّع بيانات العملية (job_id...). */
  verify(
    url: string,
    webhook = "",
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { url: String(url || "") };
    const hook = (webhook || "").trim();
    if (hook) body["webhook_url"] = hook;
    if (this.viaBridge) return this.bridgeCall({ action: "verify", ...body });
    return this.call("POST", PATH_VERIFY, body);
  }

  /** حالة عملية تحقق عند المورد (processing/completed/refunded...). */
  status(jobId: string): Promise<Record<string, unknown>> {
    if (this.viaBridge) {
      return this.bridgeCall({
        action: "status",
        job_id: String(jobId || ""),
      });
    }
    const path = PATH_STATUS.replace(
      "%s",
      encodeURIComponent(String(jobId || "")),
    );
    return this.call("GET", path);
  }
}
