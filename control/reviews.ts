// لوحة التحكم: إدارة تقييمات العملاء (سجل تقييمات المتجر).
// التقييمات بتتكتب من واجهة المتجر عبر submit_review وبتتولد
// بحالة pending، والموقع بيعرض للعملاء المقبولة بس (دالة
// get_reviews بتقرا status='approved' فقط) — فقرار اللوحة هنا
// هو بوابة النشر نفسها: موافقة = التقييم يظهر في الموقع،
// رفض = يفضل مخفي. الجدول: public.reviews (id/order_ref/
// display_name/rating/body/product_label/status/created_at/
// moderated_at) — وحالة الصف من قيد القاعدة نفسها:
// pending|approved|rejected. إيميل العميل مش في جدول التقييمات؛
// بيتحلّ من طلب الموقع صاحب نفس order_ref، وغيابه = null
// (مش بيتم اختراعه أبدًا).

export interface ReviewRow {
  id: number | string;
  order_ref: string;
  display_name: string;
  rating: number;
  body: string;
  product_label: string | null;
  status: string;
  created_at: string | null;
  moderated_at: string | null;
}

export interface ReviewListItem extends ReviewRow {
  customer_email: string | null;
}

export interface ControlReviewsClient {
  listReviews(
    status: string | null,
    limit: number,
  ): Promise<ReviewRow[]>;
  getReview(id: string): Promise<ReviewRow | null>;
  setReviewStatus(
    id: string,
    decision: string,
    moderatedAtIso: string,
  ): Promise<ReviewRow | null>;
  /** order_ref (زي ما هو متخزن) ← إيميل العميل من طلبات الموقع. */
  orderEmails(orderRefs: string[]): Promise<Map<string, string>>;
}

export interface ControlReviewsDeps {
  client: ControlReviewsClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    source: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  /** وقت دلوقتي بصيغة ISO — قابل للحقن في الاختبارات. */
  nowIso: () => string;
}

// ------------------------------------------------- عميل PostgREST
interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

const REVIEW_SELECT =
  "id,order_ref,display_name,rating,body,product_label,status,created_at,moderated_at";

/** عميل قراءة/كتابة PostgREST بنفس نمط عملاء الوحدات التانية. */
export class PostgrestReviewsClient implements ControlReviewsClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }

  private headers(): Record<string, string> {
    const key = this.opts.keyOf();
    return {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Accept": "application/json",
    };
  }

  private async get(path: string): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/${path}`, {
      headers: this.headers(),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control reviews read http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async listReviews(
    status: string | null,
    limit: number,
  ): Promise<ReviewRow[]> {
    let path = `reviews?select=${REVIEW_SELECT}` +
      `&order=created_at.desc&limit=${limit}`;
    if (status) path += `&status=eq.${encodeURIComponent(status)}`;
    return await this.get(path) as unknown as ReviewRow[];
  }

  async getReview(id: string): Promise<ReviewRow | null> {
    const rows = await this.get(
      `reviews?id=eq.${encodeURIComponent(id)}&select=${REVIEW_SELECT}&limit=1`,
    );
    return (rows[0] as unknown as ReviewRow) ?? null;
  }

  async setReviewStatus(
    id: string,
    decision: string,
    moderatedAtIso: string,
  ): Promise<ReviewRow | null> {
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          status: decision,
          moderated_at: moderatedAtIso,
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control reviews write http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    // التمثيل الراجع هو دليل الكتابة: صفر صفوف = التقييم مش
    // موجود (اتمسح بين القراءة والكتابة) والمعالج بيرد 404.
    const rows = Array.isArray(parsed) ? parsed : [];
    return (rows[0] as unknown as ReviewRow) ?? null;
  }

  async orderEmails(orderRefs: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const refs = [...new Set(orderRefs.filter((r) => !!r))];
    if (!refs.length) return out;
    const inList = refs
      .map((r) => `"${r.replace(/"/g, "")}"`)
      .join(",");
    const rows = await this.get(
      `orders?select=order_ref,customer_email&order_ref=in.(${inList})`,
    );
    for (const row of rows) {
      const ref = typeof row.order_ref === "string" ? row.order_ref : "";
      const email = typeof row.customer_email === "string"
        ? row.customer_email
        : "";
      if (ref && email && !out.has(ref)) out.set(ref, email);
    }
    return out;
  }
}

// ------------------------------------------------------------- المعالج
const LIST_STATUSES = ["pending", "approved", "rejected", "all"];
const DECISIONS = ["approved", "rejected"];
const LIST_LIMIT = 100;

/** معرّف تقييم سليم: عدد صحيح موجب (نص أو رقم) — غير كده 400. */
export function parseReviewId(raw: unknown): string | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw > 0 ? String(raw) : null;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    return /^[1-9][0-9]*$/.test(t) ? t : null;
  }
  return null;
}

/**
 * معالج تقييمات اللوحة — بيتركب في api.ts على مسارات /control/*.
 * بيرجع null لو المسار مش بتاعه.
 */
export async function handleControlReviewsRequest(
  req: Request,
  deps: ControlReviewsDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...deps.corsOf(req),
      },
    });

  const isList = path.endsWith("/control/reviews");
  const isDecision = path.endsWith("/control/reviews-decision");
  if (!isList && !isDecision) return null;

  // ------------------------------------------------ قائمة التقييمات
  if (isList) {
    if (req.method !== "GET") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const statusParam = (url.searchParams.get("status") || "pending")
      .trim().toLowerCase();
    if (!LIST_STATUSES.includes(statusParam)) {
      return json({ ok: false, error: "invalid_status" }, 400);
    }
    try {
      const rows = await deps.client.listReviews(
        statusParam === "all" ? null : statusParam,
        LIST_LIMIT,
      );
      // إيميل العميل تحسين عرض بس: فشل حلّه بيتلجّ وبيفضل null
      // بدل ما يوقع قائمة الإدارة كلها.
      let emails = new Map<string, string>();
      try {
        emails = await deps.client.orderEmails(
          rows.map((r) => r.order_ref),
        );
      } catch (e) {
        deps.logError("control.reviews", "order email lookup failed", e);
      }
      const reviews: ReviewListItem[] = rows.map((r) => ({
        ...r,
        customer_email: emails.get(r.order_ref) ?? null,
      }));
      return json({ ok: true, status: statusParam, reviews });
    } catch (e) {
      deps.logError("control.reviews", "reviews list failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // ------------------------------------------------ قرار إدارة
  if (req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const parsed = await req.json().catch(() => null);
  const body = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : null;
  if (!body) return json({ ok: false, error: "bad_body" }, 400);

  const id = parseReviewId(body.id);
  if (!id) return json({ ok: false, error: "invalid_id" }, 400);
  const decision = typeof body.decision === "string"
    ? body.decision.trim().toLowerCase()
    : "";
  if (!DECISIONS.includes(decision)) {
    return json({ ok: false, error: "invalid_decision" }, 400);
  }

  try {
    const existing = await deps.client.getReview(id);
    if (!existing) {
      return json({ ok: false, error: "review_not_found" }, 404);
    }
    const updated = await deps.client.setReviewStatus(
      id,
      decision,
      deps.nowIso(),
    );
    if (!updated) {
      return json({ ok: false, error: "review_not_found" }, 404);
    }
    return json({ ok: true, review: updated });
  } catch (e) {
    deps.logError("control.reviews", "review decision failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }
}
