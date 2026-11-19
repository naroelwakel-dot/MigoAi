/**
 * اختبارات التوكنات الإدارية الخاصة بكل مجموعة مسارات —
 * `deno test admin_auth.test.ts` (offline بالكامل، طلبات وهمية).
 */
import { makeAdminChecker, tokenEquals } from "./admin_auth.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

function reqWith(token?: string): Request {
  return new Request("https://api.example/admin", {
    headers: token ? { "x-migo-admin": token } : {},
  });
}

const SHARED = "shared-master";
const SHEERID = "tok-sheerid";
const WALLET = "tok-wallet";
const CATALOG = "tok-catalog";

const sheeridCheck = makeAdminChecker(SHARED, SHEERID);
const walletCheck = makeAdminChecker(SHARED, WALLET);
const catalogCheck = makeAdminChecker(SHARED, CATALOG);

Deno.test("route token is accepted on its own route", () => {
  eq(sheeridCheck(reqWith(SHEERID)), true, "sheerid token on sheerid route");
  eq(walletCheck(reqWith(WALLET)), true, "wallet token on wallet route");
  eq(catalogCheck(reqWith(CATALOG)), true, "catalog token on catalog route");
});

Deno.test("route token is rejected on every other route", () => {
  eq(walletCheck(reqWith(SHEERID)), false, "sheerid token on wallet route");
  eq(catalogCheck(reqWith(SHEERID)), false, "sheerid token on catalog route");
  eq(sheeridCheck(reqWith(WALLET)), false, "wallet token on sheerid route");
  eq(catalogCheck(reqWith(WALLET)), false, "wallet token on catalog route");
  eq(sheeridCheck(reqWith(CATALOG)), false, "catalog token on sheerid route");
  eq(walletCheck(reqWith(CATALOG)), false, "catalog token on wallet route");
});

Deno.test("shared token fallback works on all routes (existing callers keep working)", () => {
  eq(sheeridCheck(reqWith(SHARED)), true, "shared on sheerid route");
  eq(walletCheck(reqWith(SHARED)), true, "shared on wallet route");
  eq(catalogCheck(reqWith(SHARED)), true, "shared on catalog route");
  // وحتى من غير أي توكن خاص مضبوط أصلًا (حالة الإنتاج اليوم):
  const sharedOnly = makeAdminChecker(SHARED, "");
  eq(sharedOnly(reqWith(SHARED)), true, "shared accepted when no route token set");
  eq(sharedOnly(reqWith(SHEERID)), false, "route token meaningless when unset");
});

Deno.test("missing or wrong header is rejected; nothing configured = fail-closed", () => {
  eq(sheeridCheck(reqWith()), false, "no header");
  eq(sheeridCheck(reqWith("nope")), false, "wrong token");
  eq(makeAdminChecker("", "")(reqWith(SHARED)), false, "nothing configured at all");
  eq(makeAdminChecker("", SHEERID)(reqWith(SHEERID)), true, "route-only config still opens its route");
  eq(makeAdminChecker("", SHEERID)(reqWith(SHARED)), false, "route-only config rejects the (unset) shared");
});

Deno.test("tokenEquals: exact match only — no prefix, length, or case shortcuts", () => {
  eq(tokenEquals("tok-sheerid", "tok-sheerid"), true, "identical tokens");
  eq(tokenEquals("tok-sheerid", "tok-sheeriX"), false, "same length, last char differs");
  eq(tokenEquals("tok-sheeri", "tok-sheerid"), false, "presented is a prefix of expected");
  eq(tokenEquals("tok-sheerid-longer", "tok-sheerid"), false, "expected is a prefix of presented");
  eq(tokenEquals("", "tok-sheerid"), false, "empty presented");
  eq(tokenEquals("tok-sheerid", ""), false, "empty expected never accepts (fail-closed)");
  eq(tokenEquals("", ""), false, "both empty");
  eq(tokenEquals("توكن-سري-١٢٣", "توكن-سري-١٢٣"), true, "non-ASCII tokens compare by UTF-8 bytes");
  eq(tokenEquals("توكن-سري-١٢٣", "توكن-سري-١٢٤"), false, "non-ASCII near-miss rejected");
});

Deno.test("checker rejects near-miss tokens (truncated / extended / case-changed)", () => {
  eq(sheeridCheck(reqWith("tok-sheeri")), false, "truncated route token");
  eq(sheeridCheck(reqWith("tok-sheerid2")), false, "extended route token");
  eq(sheeridCheck(reqWith("TOK-SHEERID")), false, "case-changed route token");
  eq(sheeridCheck(reqWith("shared-maste")), false, "truncated shared token");
  eq(walletCheck(reqWith("tok-wallett")), false, "extended wallet token");
});
