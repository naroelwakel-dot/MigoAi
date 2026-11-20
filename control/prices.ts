// لوحة التحكم (المرحلة م٣): أسعار الموقع — مقارنة أسعار ملفات
// العرض الثابتة بأسعار قاعدة البيانات (السلطة اللي الخادم بيحسب
// بيها إجمالي أي طلب)، وتشغيل مُطبِّق حد الأسعار الأدنى القائم
// (price_floors/mod.ts) من اللوحة بدل المجدول الخارجي، وقراءة حالة
// منفّذ طلبات الموقع. مفيش مسار فلوس جديد هنا: المُطبِّق نفسه هو
// اللي بيكتب في القاعدة بدالته الذرّية، ودور الوحدة دي نداءه
// وتدقيقه في سجل البوت الموحد بس.
//
// مفاتيح المقارنة هي أسماء عناصر السلة نفسها اللي الواجهة بتبنيها
// وقت الشراء (app.js) — لأن اسم عنصر السلة هو نفسه مفتاح صف
// الكتالوج في القاعدة:
//   - أدوات الذكاء والاشتراكات: «اسم المنتج (المدة أو اسم الباقة)»
//   - الألعاب والبث والبطاقات الافتراضية وخدمات السوشيال:
//     «الاسم - اسم الباقة/الخدمة» (نموذج تأكيد الطلب بيبنيها كده)
//   - عملات تيك توك: «تيك توك كوينز - <العدد> عملة»
//   - نجوم تليجرام: «نجوم تليجرام - <العدد> نجمة»
// أي صف ما لقاش نظيره بنفس الاسم بالحرف بيظهر «في القاعدة فقط» أو
// «في الملف فقط» — مفيش مطابقة بالتخمين.

import type {
  BotControlProxyClient,
  BotProxyResult,
} from "./customers.ts";
import type { PriceFloorRunReport } from "../price_floors/mod.ts";

// ------------------------------------------------------- أسماء السلة
// نفس بنية أسماء عناصر السلة في app.js بالحرف — أي تغيير هناك لازم
// ينعكس هنا، واختبارات الوحدة دي بتثبّت الصيغ دي.

/** «اسم المنتج (المدة أو اسم الباقة)» — أدوات الذكاء والاشتراكات. */
export function parenSku(
  productName: string,
  pkg: { name?: string; duration?: string },
): string {
  return `${productName} (${pkg.duration || pkg.name || ""})`;
}

/** «الاسم - اسم الباقة/الخدمة» — الألعاب والبث والبطاقات والسوشيال. */
export function dashSku(productName: string, pkgLabel: string): string {
  return `${productName} - ${pkgLabel}`;
}

/** اسم سلة عملات تيك توك زي ما نموذج التأكيد بيبنيه. */
export function tiktokSku(coins: number): string {
  return `تيك توك كوينز - ${coins} عملة`;
}

/** اسم سلة نجوم تليجرام زي ما نموذج التأكيد بيبنيه. */
export function telegramSku(stars: number): string {
  return `نجوم تليجرام - ${stars} نجمة`;
}

// ------------------------------------------------- قراءة ملفات العرض
export interface FilePriceRow {
  sku: string;
  price: number;
  /** خدمة سوشيال: السعر لكل ١٠٠٠، ونظيره في القاعدة kind = smm_rate بس. */
  smm: boolean;
}

/** نهاية نص حرفي (سلسلة) يبدأ عند i — بيتعامل مع الهروب بالشرطة المائلة. */
function scanStringEnd(text: string, i: number): number {
  const q = text[i];
  let j = i + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    j++;
  }
  return text.length;
}

/** تخطّي الفراغات والتعليقات من عند i. */
function skipTrivia(text: string, i: number): number {
  let j = i;
  while (j < text.length) {
    const c = text[j];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      j++;
      continue;
    }
    if (c === "/" && text[j + 1] === "/") {
      const nl = text.indexOf("\n", j);
      j = nl === -1 ? text.length : nl + 1;
      continue;
    }
    if (c === "/" && text[j + 1] === "*") {
      const end = text.indexOf("*/", j + 2);
      j = end === -1 ? text.length : end + 2;
      continue;
    }
    break;
  }
  return j;
}

/** نهاية قيمة متوازنة ([ أو {) تبدأ عند i — واعية بالسلاسل والتعليقات. */
function scanBalancedEnd(text: string, i: number): number {
  let depth = 0;
  let j = i;
  while (j < text.length) {
    const c = text[j];
    if (c === '"' || c === "'" || c === "`") {
      j = scanStringEnd(text, j);
      continue;
    }
    if (c === "/" && (text[j + 1] === "/" || text[j + 1] === "*")) {
      j = skipTrivia(text, j);
      continue;
    }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  return text.length;
}

/** نهاية أي قيمة تبدأ عند i (سلسلة/متوازنة/بدائية لحد الفاصلة). */
function scanValueEnd(text: string, i: number, limit: number): number {
  const c = text[i];
  if (c === '"' || c === "'" || c === "`") return scanStringEnd(text, i);
  if (c === "[" || c === "{") return scanBalancedEnd(text, i);
  let j = i;
  while (j < limit && text[j] !== ",") j++;
  return j;
}

/** نص الإسناد الحرفي لمتغير معلن (const/let/var الاسم = [...] أو {...}). */
export function extractNamedLiteral(
  text: string,
  name: string,
): string | null {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`);
  const m = re.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < text.length && text[i] !== "[" && text[i] !== "{") i++;
  if (i >= text.length) return null;
  return text.slice(i, scanBalancedEnd(text, i));
}

/** عناصر مصفوفة حرفية ككائنات: بيرجع نص كل كائن من المستوى الأول. */
export function arrayObjects(literal: string): string[] {
  const out: string[] = [];
  if (!literal || literal[0] !== "[") return out;
  const end = literal.length - 1; // قبل ] الأخيرة
  let i = 1;
  while (i < end) {
    i = skipTrivia(literal, i);
    if (i >= end) break;
    if (literal[i] === ",") {
      i++;
      continue;
    }
    if (literal[i] === "{") {
      const e = scanBalancedEnd(literal, i);
      out.push(literal.slice(i, e));
      i = e;
      continue;
    }
    i = scanValueEnd(literal, i, end);
  }
  return out;
}

/** فك هروب سلسلة جافاسكربت حرفية (من غير علاماتها) — نفس دلالات اللغة. */
function unescapeJsString(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c !== "\\") {
      out += c;
      i++;
      continue;
    }
    const n = raw[i + 1];
    if (n === undefined) break;
    switch (n) {
      case "n": out += "\n"; i += 2; break;
      case "t": out += "\t"; i += 2; break;
      case "r": out += "\r"; i += 2; break;
      case "b": out += "\b"; i += 2; break;
      case "f": out += "\f"; i += 2; break;
      case "v": out += "\v"; i += 2; break;
      case "0": out += "\0"; i += 2; break;
      case "x": {
        const hex = raw.slice(i + 2, i + 4);
        out += /^[0-9a-fA-F]{2}$/.test(hex)
          ? String.fromCharCode(parseInt(hex, 16))
          : "x";
        i += /^[0-9a-fA-F]{2}$/.test(hex) ? 4 : 2;
        break;
      }
      case "u": {
        if (raw[i + 2] === "{") {
          const close = raw.indexOf("}", i + 3);
          const hex = close === -1 ? "" : raw.slice(i + 3, close);
          const cp = parseInt(hex, 16);
          out += hex && Number.isFinite(cp) ? String.fromCodePoint(cp) : "u";
          i = close === -1 ? i + 2 : close + 1;
        } else {
          const hex = raw.slice(i + 2, i + 6);
          out += /^[0-9a-fA-F]{4}$/.test(hex)
            ? String.fromCharCode(parseInt(hex, 16))
            : "u";
          i += /^[0-9a-fA-F]{4}$/.test(hex) ? 6 : 2;
        }
        break;
      }
      default:
        // أي حرف مهروب تاني (\\ \' \" \+ ...) = الحرف نفسه.
        out += n;
        i += 2;
    }
  }
  return out;
}

/** حقول كائن حرفي من المستوى الأول: اسم الحقل ← نص قيمته الخام. */
export function objectFields(objText: string): Map<string, string> {
  const fields = new Map<string, string>();
  if (!objText || objText[0] !== "{") return fields;
  const end = objText.length - 1; // قبل } الأخيرة
  let i = 1;
  while (i < end) {
    i = skipTrivia(objText, i);
    if (i >= end) break;
    if (objText[i] === ",") {
      i++;
      continue;
    }
    let key: string;
    if (objText[i] === '"' || objText[i] === "'") {
      const e = scanStringEnd(objText, i);
      key = unescapeJsString(objText.slice(i + 1, e - 1));
      i = e;
    } else {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(objText.slice(i, end));
      if (!m) {
        i++;
        continue;
      }
      key = m[0];
      i += m[0].length;
    }
    i = skipTrivia(objText, i);
    if (objText[i] !== ":") continue;
    i++;
    i = skipTrivia(objText, i);
    if (i >= end) break;
    const e = scanValueEnd(objText, i, end);
    if (!fields.has(key)) fields.set(key, objText.slice(i, e).trim());
    i = e;
  }
  return fields;
}

function readString(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (t.length < 2 || (t[0] !== '"' && t[0] !== "'")) return null;
  return unescapeJsString(t.slice(1, -1));
}

function readNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

/** منتجات بباقات (name + packages) ← صفوف أسعار بصيغة الاسم المطلوبة. */
function rowsFromProducts(
  objects: string[],
  form: "paren" | "dash",
): FilePriceRow[] {
  const rows: FilePriceRow[] = [];
  for (const objText of objects) {
    const f = objectFields(objText);
    const prodName = readString(f.get("name"));
    if (!prodName) continue;
    const pkgsRaw = f.get("packages");
    if (pkgsRaw && pkgsRaw.trim().startsWith("[")) {
      for (const pkgText of arrayObjects(pkgsRaw)) {
        const pf = objectFields(pkgText);
        const price = readNumber(pf.get("price"));
        if (price === null) continue;
        const pkgName = readString(pf.get("name")) || "";
        const sku = form === "paren"
          ? parenSku(prodName, {
            name: pkgName,
            duration: readString(pf.get("duration")) || undefined,
          })
          : dashSku(prodName, pkgName);
        rows.push({ sku, price, smm: false });
      }
      continue;
    }
    // منتج من غير قائمة باقات: سعره المباشر هو سعر باقته الوحيدة
    // الضمنية (نفس احتياطي الواجهة: priceEgp للبطاقات، وtag للذكاء).
    const direct = readNumber(f.get("priceEgp")) ??
      readNumber(f.get("price"));
    if (direct === null) continue;
    if (form === "paren") {
      const tag = readString(f.get("tag")) || prodName;
      rows.push({
        sku: parenSku(prodName, { name: tag, duration: tag }),
        price: direct,
        smm: false,
      });
    } else {
      rows.push({ sku: dashSku(prodName, prodName), price: direct, smm: false });
    }
  }
  return rows;
}

/** قائمة مفردة بباقات عملات/نجوم (tiktokCoinsList / telegramStarsList). */
function rowsFromCoinList(
  objText: string,
  kind: "tiktok" | "telegram",
): FilePriceRow[] {
  const rows: FilePriceRow[] = [];
  const f = objectFields(objText);
  const pkgsRaw = f.get("packages");
  if (!pkgsRaw || !pkgsRaw.trim().startsWith("[")) return rows;
  for (const pkgText of arrayObjects(pkgsRaw)) {
    const pf = objectFields(pkgText);
    const price = readNumber(pf.get("price"));
    if (price === null) continue;
    if (kind === "tiktok") {
      const coins = readNumber(pf.get("coins"));
      if (coins === null) continue;
      rows.push({ sku: tiktokSku(coins), price, smm: false });
    } else {
      const stars = readNumber(pf.get("stars"));
      if (stars === null) continue;
      rows.push({ sku: telegramSku(stars), price, smm: false });
    }
  }
  return rows;
}

/** ملف smm.js: البطاقات الافتراضية + منصات السوشيال وخدماتها الموسّعة. */
function rowsFromSmmFile(text: string): FilePriceRow[] {
  const rows: FilePriceRow[] = [];
  const vccLit = extractNamedLiteral(text, "vccData");
  if (vccLit) rows.push(...rowsFromProducts(arrayObjects(vccLit), "dash"));

  const platLit = extractNamedLiteral(text, "smmPlatforms");
  const nameById = new Map<string, string>();
  if (platLit) {
    for (const objText of arrayObjects(platLit)) {
      const f = objectFields(objText);
      const platId = readString(f.get("id"));
      const platName = readString(f.get("name"));
      if (!platName) continue;
      if (platId) nameById.set(platId, platName);
      const servicesRaw = f.get("services");
      if (!servicesRaw || !servicesRaw.trim().startsWith("[")) continue;
      for (const srvText of arrayObjects(servicesRaw)) {
        const sf = objectFields(srvText);
        const srvName = readString(sf.get("name"));
        const price = readNumber(sf.get("pricePer1k"));
        if (!srvName || price === null) continue;
        rows.push({ sku: dashSku(platName, srvName), price, smm: true });
      }
    }
  }
  // الخدمات الموسّعة بتندمج في المنصات وقت التحميل بمعرّف المنصة —
  // نفس الدمج هنا عشان المقارنة تشوف نفس اللي العميل بيشوفه.
  const extLit = extractNamedLiteral(text, "smmExtendedServices");
  if (extLit) {
    for (const objText of arrayObjects(extLit)) {
      const f = objectFields(objText);
      const platName = nameById.get(readString(f.get("platform")) || "");
      const srvName = readString(f.get("name"));
      const price = readNumber(f.get("pricePer1k"));
      if (!platName || !srvName || price === null) continue;
      rows.push({ sku: dashSku(platName, srvName), price, smm: true });
    }
  }
  return rows;
}

/** استخراج صفوف أسعار ملف عرض واحد باسمه. */
export function parseStorefrontFile(
  file: string,
  text: string,
): FilePriceRow[] {
  switch (file) {
    case "ai-tools.js": {
      const lit = extractNamedLiteral(text, "aiProducts");
      return lit ? rowsFromProducts(arrayObjects(lit), "paren") : [];
    }
    case "subscriptions.js": {
      const lit = extractNamedLiteral(text, "subscriptionsData");
      return lit ? rowsFromProducts(arrayObjects(lit), "paren") : [];
    }
    case "games.js": {
      const lit = extractNamedLiteral(text, "gamesData");
      return lit ? rowsFromProducts(arrayObjects(lit), "dash") : [];
    }
    case "live-coins.js": {
      const rows: FilePriceRow[] = [];
      const liveLit = extractNamedLiteral(text, "liveCoinsData");
      if (liveLit) rows.push(...rowsFromProducts(arrayObjects(liveLit), "dash"));
      const ttLit = extractNamedLiteral(text, "tiktokCoinsList");
      if (ttLit) rows.push(...rowsFromCoinList(ttLit, "tiktok"));
      const tgLit = extractNamedLiteral(text, "telegramStarsList");
      if (tgLit) rows.push(...rowsFromCoinList(tgLit, "telegram"));
      return rows;
    }
    case "smm.js":
      return rowsFromSmmFile(text);
    default:
      return [];
  }
}

// ------------------------------------------------------- المقارنة
export interface CatalogDbRow {
  sku: string;
  price: number;
  kind: string;
}

export type CompareState = "match" | "drift" | "db_only" | "file_only";

export interface CompareItem {
  sku: string;
  db_price: number | null;
  file_price: number | null;
  state: CompareState;
}

export interface CompareResult {
  items: CompareItem[];
  counts: Record<CompareState, number>;
}

const STATE_ORDER: Record<CompareState, number> = {
  drift: 0,
  db_only: 1,
  file_only: 2,
  match: 3,
};

/**
 * مقارنة صفوف القاعدة بصفوف الملفات بنفس اسم السلة بالحرف. صفوف
 * السوشيال من الملف ما بتقابلش غير صفوف القاعدة من نوع smm_rate،
 * وصفوف القاعدة من نوع smm_rate ما بتتقارنش بغيرها — اختلاف النوع
 * بنفس الاسم بيظهر صفّين منفصلين (واحد لكل جهة) بدل مطابقة غلط.
 */
export function buildComparison(
  dbRows: CatalogDbRow[],
  fileRows: FilePriceRow[],
): CompareResult {
  const dbBySku = new Map<string, CatalogDbRow>();
  for (const r of dbRows) {
    if (r && r.sku && !dbBySku.has(r.sku)) dbBySku.set(r.sku, r);
  }
  const fileBySku = new Map<string, FilePriceRow>();
  for (const r of fileRows) {
    if (r && r.sku && !fileBySku.has(r.sku)) fileBySku.set(r.sku, r);
  }
  const items: CompareItem[] = [];
  const matchedDb = new Set<string>();
  for (const [sku, fr] of fileBySku) {
    const db = dbBySku.get(sku);
    const compatible = !!db &&
      (fr.smm ? db.kind === "smm_rate" : db.kind !== "smm_rate");
    if (db && compatible) {
      matchedDb.add(sku);
      const same = Math.round(db.price * 100) === Math.round(fr.price * 100);
      items.push({
        sku,
        db_price: db.price,
        file_price: fr.price,
        state: same ? "match" : "drift",
      });
    } else {
      items.push({ sku, db_price: null, file_price: fr.price, state: "file_only" });
    }
  }
  for (const [sku, db] of dbBySku) {
    if (matchedDb.has(sku)) continue;
    items.push({ sku, db_price: db.price, file_price: null, state: "db_only" });
  }
  items.sort((a, b) =>
    (STATE_ORDER[a.state] - STATE_ORDER[b.state]) ||
    (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0)
  );
  const counts: Record<CompareState, number> = {
    match: 0,
    drift: 0,
    db_only: 0,
    file_only: 0,
  };
  for (const it of items) counts[it.state]++;
  return { items, counts };
}

// ------------------------------------------------------------ العميل
export interface ControlPricesClient {
  /** كتالوج القاعدة بنفس مسار getCatalog القائم (RPC ‏get_catalog). */
  getCatalog(): Promise<CatalogDbRow[]>;
  /** عدد صفوف جدول — لحالة منفّذ الموقع (قراءة بس). */
  countRows(table: "store_executions" | "store_refunds"): Promise<number>;
}

interface PgOptions {
  baseUrl: string; // https://<ref>.supabase.co
  keyOf: () => string; // مفتاح الخدمة من البيئة — ما بيتحفظش هنا
}

/** عميل PostgREST لوحدة أسعار الموقع، بنفس نمط باقي العملاء. */
export class PostgrestControlPricesClient implements ControlPricesClient {
  private opts: PgOptions;
  constructor(opts: PgOptions) {
    this.opts = opts;
  }

  private headers(): Record<string, string> {
    return {
      "apikey": this.opts.keyOf(),
      "Authorization": `Bearer ${this.opts.keyOf()}`,
      "Accept": "application/json",
    };
  }

  async getCatalog(): Promise<CatalogDbRow[]> {
    const res = await fetch(`${this.opts.baseUrl}/rest/v1/rpc/get_catalog`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: "{}",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `control prices catalog http ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    // جسم مش مصفوفة (خطأ RPC بشكل JSON مثلًا) = فشل قراءة صريح،
    // مش كتالوج فاضي: الرجوع بـ [] كان بيحوّل العطل لمقارنة وهمية
    // كل صفوفها «في الملف فقط».
    if (!Array.isArray(parsed)) {
      throw new Error(
        `control prices catalog: unexpected non-array body: ${
          text.slice(0, 200)
        }`,
      );
    }
    return parsed.map((r) => {
      const row = (r || {}) as Record<string, unknown>;
      return {
        sku: String(row.sku || ""),
        price: Number(row.price),
        kind: String(row.kind || ""),
      };
    }).filter((r) => r.sku && Number.isFinite(r.price));
  }

  async countRows(
    table: "store_executions" | "store_refunds",
  ): Promise<number> {
    const res = await fetch(
      `${this.opts.baseUrl}/rest/v1/${table}?select=id&limit=1`,
      { headers: { ...this.headers(), "Prefer": "count=exact" } },
    );
    if (!res.ok) {
      throw new Error(`control prices count ${table} http ${res.status}`);
    }
    const range = res.headers.get("content-range") || "";
    const m = /\/(\d+)\s*$/.exec(range);
    if (!m) throw new Error(`control prices count ${table}: no content-range`);
    return Number(m[1]);
  }
}

// ------------------------------------------------------------- المعالج
export interface ControlPricesDeps {
  client: ControlPricesClient;
  botClient: BotControlProxyClient;
  isAdmin: (req: Request) => boolean;
  corsOf: (req: Request) => Record<string, string>;
  logError: (
    scope: string,
    msg: string,
    err?: unknown,
    context?: Record<string, unknown>,
  ) => void;
  /** جلب نص ملف من أصل الموقع — قابل للحقن في الاختبارات. */
  fetchText: (url: string) => Promise<string>;
  /** تشغيل مُطبِّق حد الأسعار القائم نفسه (runPriceFloorApplier). */
  runFloors: () => Promise<PriceFloorRunReport>;
  /** أصل الموقع اللي بتتقرأ منه ملفات العرض. افتراضي migoai.shop. */
  siteBaseOf?: () => string;
}

export const STOREFRONT_PRICE_FILES = [
  "ai-tools.js",
  "subscriptions.js",
  "games.js",
  "live-coins.js",
  "smm.js",
] as const;

const FILE_CACHE_MS = 5 * 60 * 1000;
let _fileCache: { at: number; rows: FilePriceRow[]; failed: string[] } | null =
  null;

/** تصفير كاش الملفات — دعم اختبارات بس (الكاش نفسه ٥ دقايق في الإنتاج). */
export function resetStorePricesFileCache(): void {
  _fileCache = null;
}

async function loadFileRows(
  deps: ControlPricesDeps,
): Promise<{ rows: FilePriceRow[]; failed: string[] }> {
  const now = Date.now();
  if (_fileCache && now - _fileCache.at < FILE_CACHE_MS) {
    return { rows: _fileCache.rows, failed: _fileCache.failed };
  }
  const base = (deps.siteBaseOf ? deps.siteBaseOf() : "https://migoai.shop")
    .replace(/\/+$/, "");
  const rows: FilePriceRow[] = [];
  const failed: string[] = [];
  for (const file of STOREFRONT_PRICE_FILES) {
    try {
      const text = await deps.fetchText(`${base}/${file}`);
      rows.push(...parseStorefrontFile(file, text));
    } catch (e) {
      failed.push(file);
      deps.logError("control.prices", `storefront file read failed: ${file}`, e);
    }
  }
  // الكاش بيتحفظ بس لو كل الملفات اتقرت: نتيجة ناقصة (ملف فشل)
  // ما تتخزّنش، فالمقارنة الجاية تعيد المحاولة بدل ما تفضّل
  // ناقصة خمس دقايق كاملة.
  if (failed.length === 0) {
    _fileCache = { at: now, rows, failed };
  }
  return { rows, failed };
}

/** ملحوظة حالة المنفّذ المعروضة في اللوحة — وصف صريح من غير تجميل. */
export const EXECUTOR_NOTE =
  "المنفّذ لسه ما اتفعّلش في الإنتاج وتشغيله قرار منفصل للمالك. " +
  "ملحوظة معروفة في إعداده: حالة الدفع اللي بيبدأ منها التنفيذ " +
  "مكتوبة في كوده «paid» وهي مش من حالات طلبات الموقع الحالية.";

export async function handleControlPricesRequest(
  req: Request,
  deps: ControlPricesDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isCompare = path.endsWith("/control/store-prices");
  const isApply = path.endsWith("/control/store-prices-apply-floors");
  const isExecState = path.endsWith("/control/store-executor-state");
  if (!isCompare && !isApply && !isExecState) return null;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...deps.corsOf(req),
      },
    });

  // ------------------------------------------------ جدول المقارنة
  if (isCompare) {
    if (req.method !== "GET") return json({ ok: false, error: "method" }, 405);
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    let dbRows: CatalogDbRow[];
    try {
      dbRows = await deps.client.getCatalog();
    } catch (e) {
      deps.logError("control.prices", "catalog read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
    const { rows: fileRows, failed } = await loadFileRows(deps);
    const { items, counts } = buildComparison(dbRows, fileRows);
    return json({ ok: true, items, counts, file_errors: failed });
  }

  // ------------------------------------------------ حالة المنفّذ
  if (isExecState) {
    if (req.method !== "GET") return json({ ok: false, error: "method" }, 405);
    if (!deps.isAdmin(req)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    try {
      const executions = await deps.client.countRows("store_executions");
      const refunds = await deps.client.countRows("store_refunds");
      return json({ ok: true, executions, refunds, note: EXECUTOR_NOTE });
    } catch (e) {
      deps.logError("control.prices", "executor state read failed", e);
      return json({ ok: false, error: "store_failed" }, 502);
    }
  }

  // --------------------------------------- تطبيق حد الأسعار الأدنى
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!deps.isAdmin(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const parsedBody = await req.json().catch(() => null);
  const body = (parsedBody && typeof parsedBody === "object" &&
      !Array.isArray(parsedBody))
    ? parsedBody as Record<string, unknown>
    : null;
  if (!body) return json({ ok: false, error: "bad_body" }, 400);
  const reason = typeof body.reason === "string"
    ? body.reason.trim().slice(0, 500)
    : "";
  if (!reason) return json({ ok: false, error: "reason_required" }, 400);

  let report: PriceFloorRunReport;
  try {
    report = await deps.runFloors();
  } catch (e) {
    deps.logError("control.prices", "price floor applier failed", e);
    return json({ ok: false, error: "store_failed" }, 502);
  }

  // التدقيق في السجل الموحد عند البوت — فشله بيظهر ومش بيخفي نتيجة
  // التشغيل (التشغيل حصل فعلًا؛ الإخفاء أخطر).
  let auditFailed = false;
  try {
    const r: BotProxyResult = await deps.botClient.proxy(
      "POST",
      "/api/control/audit-log",
      {
        action: "store_price_floors_apply",
        entity_type: "store_catalog",
        entity_ref: "price_floors",
        before: null,
        after: {
          ok: report.ok,
          aborted: report.aborted,
          raised_count: report.raised.length,
          raised_skus: report.raised.map((x) => x.store_sku),
          already_at_or_above: report.already_at_or_above,
          skipped_count: report.skipped.length,
          errors_count: report.errors.length,
          feed_generated_at: report.feed_generated_at,
        },
        reason,
      },
    );
    if (r.status < 200 || r.status >= 300 || r.body?.ok === false) {
      auditFailed = true;
    }
  } catch (e) {
    auditFailed = true;
    deps.logError("control.prices", "price floors audit failed", e);
  }

  const payload = {
    raised: report.raised,
    already_at_or_above: report.already_at_or_above,
    skipped: report.skipped,
    errors: report.errors,
    feed_generated_at: report.feed_generated_at,
    audit_failed: auditFailed,
  };
  if (!report.ok) {
    // التغذية غايبة/قديمة: الجولة اتجهضت من المُطبِّق نفسه قبل أي
    // كتابة — الرد بيقول كده بصوت عالي بدل ما يعدّي كأنه نجاح.
    return json({
      ok: false,
      error: "feed_unavailable",
      aborted: report.aborted,
      ...payload,
    }, 503);
  }
  return json({ ok: true, ...payload });
}
