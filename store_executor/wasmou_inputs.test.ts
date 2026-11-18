/**
 * اختبارات تمرير إدخال العميل عند شراء Wasmou من منفّذ المتجر —
 * `deno test store_executor/wasmou_inputs.test.ts`، من غير أي استيراد
 * خارجي (بتشتغل offline بالكامل، نقل مزيّف بس — ممنوع أي نداء حي).
 *
 * السيناريو: variant ‏6148 (Canva Pro سنة) بيعلن input_fields فيها
 * إيميل التفعيل والمنتج requires_input. التغطية:
 * 1. إيميل العميل من الطلب بيتبعت في جسم الشراء بمفتاحه المعلن.
 * 2. من غير إيميل (أو بصيغة غلط) = DefiniteRejection قبل أي POST.
 * 3. منتج من غير حقول إدخال: الجسم {quantity} بالحرف زي ما كان.
 */
import { WasmouAdapter } from "./adapters.ts";
import {
  DefiniteRejection,
  type HttpResult,
  type HttpTransport,
} from "./types.ts";

// مساعدات تأكيد صغيرة (بديل std/assert عشان الاختبار يشتغل offline).
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(value: unknown, label: string) {
  if (!value) throw new Error(`${label}: expected truthy, got ${value}`);
}

const PRODUCTS = {
  status: "success",
  data: [
    {
      id: 1034, name: "Canva Pro", requires_input: true,
      variants: [{
        id: 6148, name: "1 year", price: 3.6575, is_available: true,
        input_fields: [{
          key: "customer_input", type: "email",
          label: "E-mail to upgrade", rules: "required|email",
        }],
      }],
    },
    {
      id: 15, name: "NordVPN", requires_input: false,
      variants: [{
        id: 501, name: "Basic 3M", price: 1.93, is_available: true,
        input_fields: [],
      }],
    },
  ],
};
const PURCHASE_OK = {
  status: "success",
  data: { id: 9001, status: "completed", has_key: true, key: "WS-CODE-9" },
};

class FakeTransport implements HttpTransport {
  calls: { method: string; url: string; body?: unknown }[] = [];
  request(
    method: string,
    url: string,
    opts?: { headers?: Record<string, string>; body?: unknown },
  ): Promise<HttpResult> {
    this.calls.push({ method, url, body: opts?.body });
    if (url.endsWith("/api/products")) {
      return Promise.resolve({ status: 200, json: PRODUCTS });
    }
    if (url.includes("/api/products/purchase/")) {
      return Promise.resolve({ status: 200, json: PURCHASE_OK });
    }
    return Promise.resolve({ status: 404, json: {} });
  }
  posts(): { method: string; url: string; body?: unknown }[] {
    return this.calls.filter((c) => c.method === "POST");
  }
}

function buildAdapter(transport: FakeTransport): WasmouAdapter {
  return new WasmouAdapter(transport, () => "wasmou-test-key");
}

Deno.test("wasmou: customer email is forwarded under the declared key", async () => {
  const transport = new FakeTransport();
  const adapter = buildAdapter(transport);
  const outcome = await adapter.submitPurchase({
    listingRef: "6148", quantity: 1, reference: "ref-1", cost_usd: 3.6575,
    customer_email: "buyer@example.com",
  });
  eq(outcome.kind, "delivered", "outcome kind");
  const posts = transport.posts();
  eq(posts.length, 1, "one purchase POST");
  eq(posts[0].body, { quantity: 1, customer_input: "buyer@example.com" },
    "purchase body carries the email");
});

Deno.test("wasmou: missing customer email refuses before any POST", async () => {
  const transport = new FakeTransport();
  const adapter = buildAdapter(transport);
  let caught: unknown = null;
  try {
    await adapter.submitPurchase({
      listingRef: "6148", quantity: 1, reference: "ref-2", cost_usd: 3.6575,
      customer_email: null,
    });
  } catch (e) {
    caught = e;
  }
  ok(caught instanceof DefiniteRejection, "definite rejection");
  eq((caught as DefiniteRejection).beforeSubmit, true, "before submit");
  eq(transport.posts().length, 0, "zero purchase POSTs");
});

Deno.test("wasmou: malformed customer email refuses before any POST", async () => {
  const transport = new FakeTransport();
  const adapter = buildAdapter(transport);
  let caught: unknown = null;
  try {
    await adapter.submitPurchase({
      listingRef: "6148", quantity: 1, reference: "ref-3", cost_usd: 3.6575,
      customer_email: "not-an-email",
    });
  } catch (e) {
    caught = e;
  }
  ok(caught instanceof DefiniteRejection, "definite rejection");
  eq(transport.posts().length, 0, "zero purchase POSTs");
});

Deno.test("wasmou: no-input variant body stays {quantity} exactly", async () => {
  const transport = new FakeTransport();
  const adapter = buildAdapter(transport);
  const outcome = await adapter.submitPurchase({
    listingRef: "501", quantity: 2, reference: "ref-4", cost_usd: 1.93,
    customer_email: "buyer@example.com",
  });
  eq(outcome.kind, "delivered", "outcome kind");
  const posts = transport.posts();
  eq(posts.length, 1, "one purchase POST");
  eq(posts[0].body, { quantity: 2 }, "body unchanged for no-input products");
});
