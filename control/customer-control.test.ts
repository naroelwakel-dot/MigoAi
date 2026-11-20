/**
 * اختبارات تحكم العميل (المرحلة م١-ج) — `deno test control/`:
 * عميل بوت وعميل مصادقة موقع وهميان. التغطية: بوابة الأدمن قبل أي
 * نداء، تمرير مسارات البوت السبعة بحالاتها، فشل البوت =
 * bot_unavailable، وحظر الموقع: تحقق UUID/قيمة، 404 لعميل مش
 * موجود، الحظر بيعدّي على GoTrue بـ ban_duration، والتدقيق بيتبعت
 * وبيتصرح بفشله (audit_failed) من غير ما يخفي نجاح الحظر.
 */
import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import {
  type ControlCustomerControlDeps,
  handleControlCustomerControlRequest,
  type StoreAuthAdminClient,
  type StoreAuthUser,
} from "./customer-control.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}

const ADMIN_KEY = "admin-key-for-tests";
const STORE_ID = "123e4567-e89b-12d3-a456-426614174000";

class FakeBotClient implements BotControlProxyClient {
  calls: { method: string; path: string; body?: Record<string, unknown> }[] =
    [];
  failNext = false;
  auditStatus = 200;
  async proxy(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<BotProxyResult> {
    this.calls.push({ method, path, body });
    if (this.failNext) {
      this.failNext = false;
      throw new Error("bot down");
    }
    if (path === "/api/control/audit-log") {
      return { status: this.auditStatus, body: { ok: this.auditStatus < 300 } };
    }
    return { status: 200, body: { ok: true, proxied: path } };
  }
}

class FakeAuthClient implements StoreAuthAdminClient {
  users = new Map<string, StoreAuthUser>();
  banCalls: { id: string; banned: boolean }[] = [];
  async getUser(customerId: string): Promise<StoreAuthUser | null> {
    return this.users.get(customerId) ?? null;
  }
  async setBan(
    customerId: string,
    banned: boolean,
  ): Promise<StoreAuthUser | null> {
    const user = this.users.get(customerId);
    if (!user) return null;
    this.banCalls.push({ id: customerId, banned });
    user.banned_until = banned ? "2126-01-01T00:00:00Z" : null;
    return user;
  }
}

function makeDeps() {
  const bot = new FakeBotClient();
  const auth = new FakeAuthClient();
  auth.users.set(STORE_ID, { id: STORE_ID, banned_until: null });
  const deps: ControlCustomerControlDeps = {
    client: auth,
    botClient: bot,
    isAdmin: (req) => req.headers.get("x-migo-admin") === ADMIN_KEY,
    corsOf: () => ({}),
    logError: () => {},
  };
  return { deps, bot, auth };
}

function req(
  path: string,
  method = "GET",
  body?: unknown,
  admin = true,
): Request {
  return new Request(`https://api.example${path}`, {
    method,
    headers: {
      ...(admin ? { "x-migo-admin": ADMIN_KEY } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.test("foreign paths return null", async () => {
  const { deps } = makeDeps();
  eq(await handleControlCustomerControlRequest(
    req("/control/bot-money-settings"), deps), null, "null for money path");
});

Deno.test("bot proxies pass through with admin gate", async () => {
  const { deps, bot } = makeDeps();
  const denied = await handleControlCustomerControlRequest(
    req("/control/bot-customer-flag-set", "POST", {}, false), deps);
  eq(denied?.status, 401, "no admin = 401");
  eq(bot.calls.length, 0, "no bot call before admin");

  const res = await handleControlCustomerControlRequest(
    req("/control/bot-customer-flag-set", "POST", {
      customer_ref: "500", flag: "bot_banned", value: true,
    }), deps);
  eq(res?.status, 200, "proxy status");
  eq(bot.calls[0].path, "/api/control/customer-flag-set", "bot path");
  eq(bot.calls[0].method, "POST", "bot method");

  const get = await handleControlCustomerControlRequest(
    req("/control/bot-customer-control?ref=500"), deps);
  eq(get?.status, 200, "get proxy status");
  eq(bot.calls[1].path, "/api/control/customer-control?ref=500",
    "query passes through");

  const wrong = await handleControlCustomerControlRequest(
    req("/control/bot-wallet-hold", "GET"), deps);
  eq(wrong?.status, 405, "wrong method 405");
});

Deno.test("bot failure surfaces as bot_unavailable", async () => {
  const { deps, bot } = makeDeps();
  bot.failNext = true;
  const res = await handleControlCustomerControlRequest(
    req("/control/bot-customer-tag", "POST", { customer_ref: "5" }), deps);
  eq(res?.status, 502, "502");
  const body = await res!.json();
  eq(body.error, "bot_unavailable", "error code");
});

Deno.test("store ban: validation, 404, ban + audit, unban", async () => {
  const { deps, bot, auth } = makeDeps();
  const bad = await handleControlCustomerControlRequest(
    req("/control/store-customer-ban", "POST", {
      customer_id: "nope", banned: true,
    }), deps);
  eq(bad?.status, 400, "bad uuid 400");

  const missing = await handleControlCustomerControlRequest(
    req("/control/store-customer-ban", "POST", {
      customer_id: "123e4567-e89b-12d3-a456-426614174999", banned: true,
    }), deps);
  eq(missing?.status, 404, "unknown user 404");
  eq(auth.banCalls.length, 0, "no ban write for missing user");

  const res = await handleControlCustomerControlRequest(
    req("/control/store-customer-ban", "POST", {
      customer_id: STORE_ID, banned: true, reason: "احتيال",
    }), deps);
  eq(res?.status, 200, "ban 200");
  const body = await res!.json();
  eq(body.banned, true, "banned true");
  eq(body.audit_failed, false, "audit ok");
  eq(auth.banCalls[0].banned, true, "gotrue ban called");
  const audit = bot.calls.find((c) => c.path === "/api/control/audit-log");
  ok(audit, "audit sent");
  eq(audit!.body?.action, "store_customer_ban", "audit action");
  eq(audit!.body?.entity_ref, STORE_ID, "audit ref");

  const state = await handleControlCustomerControlRequest(
    req(`/control/store-customer-ban?customer_id=${STORE_ID}`), deps);
  eq((await state!.json()).banned, true, "state shows banned");

  const un = await handleControlCustomerControlRequest(
    req("/control/store-customer-ban", "POST", {
      customer_id: STORE_ID, banned: false,
    }), deps);
  eq((await un!.json()).banned, false, "unbanned");
});

Deno.test("store ban: audit failure is disclosed, ban still succeeds", async () => {
  const { deps, bot } = makeDeps();
  bot.auditStatus = 500;
  const res = await handleControlCustomerControlRequest(
    req("/control/store-customer-ban", "POST", {
      customer_id: STORE_ID, banned: true,
    }), deps);
  const body = await res!.json();
  eq(body.ok, true, "ban ok");
  eq(body.audit_failed, true, "audit_failed disclosed");
});
