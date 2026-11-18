/**
 * نقطة دخول منفّذ شراء الموقع (الحزمة 6) لخلفية Deno.
 *
 * التركيب في api.ts موثّق في api_patch/ — هنا بنبني المنفّذ من
 * التبعيات وبنعرّف معالج الطلبات اللي الباتش بيضيفه:
 *   POST /exec/order   {order_ref}   → محاولة تنفيذ فورية لطلب مؤكد
 *   POST /exec/sweep                  → كنس (طلبات جديدة + تسوية + إشعارات)
 * الحماية بنفس نمط api.ts القائم: ترويسة x-migo-admin == ADMIN_TOKEN
 * (isAdmin) — المجدول الخارجي (نمط sheerid-sweep) بيبعت نفس الترويسة.
 */

export * from "./types.ts";
export * from "./sanitize.ts";
export * from "./adapters.ts";
export * from "./registry.ts";
export * from "./flags.ts";
export * from "./store_db.ts";
export * from "./refund.ts";
export * from "./notify.ts";
export * from "./executor.ts";

import type { ExecutorDeps } from "./types.ts";
import { StoreExecutor } from "./executor.ts";

export function createExecutor(deps: ExecutorDeps): StoreExecutor {
  return new StoreExecutor(deps);
}

/** معالج طلبات التنفيذ — بيتركب في api.ts قبل مسار التحقق (انظر الباتش). */
export async function handleExecRequest(
  req: Request,
  executor: StoreExecutor,
  isAuthorized: (req: Request) => boolean,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isOrder = path.endsWith("/exec/order");
  const isSweep = path.endsWith("/exec/sweep");
  if (!isOrder && !isSweep) return null;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!isAuthorized(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    if (isSweep) {
      const summary = await executor.runSweep(50);
      return json({
        ok: true,
        executed: summary.executed.map((r) => ({
          sku: r.sku,
          status: r.execution?.status ?? null,
          skipped: r.skipped,
        })),
        polled: summary.polled.map((e) => ({ id: e.id, status: e.status })),
        notified: summary.notified,
      });
    }
    const body = (await req.json().catch(() => ({}))) as { order_ref?: string };
    const orderRef = String(body.order_ref || "").trim();
    if (!orderRef) return json({ ok: false, error: "order_ref_required" }, 400);
    const results = await executor.executeOrder(orderRef);
    return json({
      ok: true,
      results: results.map((r) => ({
        sku: r.sku,
        status: r.execution?.status ?? null,
        skipped: r.skipped,
      })),
    });
  } catch (e) {
    // أي خطأ هنا بيتسجّل من المنفّذ نفسه في السجل المركزي قبل ما يوصل.
    return json({ ok: false, error: (e as Error)?.name || "exception" }, 500);
  }
}
