/**
 * اختبارات هجرة 029 (انتهاء الكوبون وقت الطلب — م٦-أ) —
 * `deno test control_coupons/` من غير أي استيراد خارجي. الهجرة
 * SQL خالص، فالاختبارات بتحرس القواعد على النص — نفس فلسفة
 * migration_028. الثقب: internal_coupon_discount (مسار الخصم
 * جوه create_order) كانت بتشيك `active = true` بس ومتشوفش
 * expires_at، فكوبون منتهي ولسه مفعّل كان بيخصم وقت الطلب رغم
 * إن validate_coupon عند السلة بترفضه. التغيير الوحيد في 029
 * هو حارس انتهاء في جملة البحث الأخيرة، والاختبارات بتثبّته:
 * الحارس موجود بصياغة validate_coupon نفسها، وباقي التعريف
 * مطابق بايتيًا لتعريف ما قبل 029 (المضمّن في ملف التراجع —
 * وهو التعريف الحي حرفيًا من pg_get_functiondef)، وسلوك
 * الخنق ضد التخمين (قفل استشاري + عدّ محاولات + تخمينات
 * مهشّمة) ما اتلمسش، وصلاحيات الدالة ما اتغيّرتش.
 */
import MIGRATION from "./migration_029_coupon_expiry_at_order_time.sql" with {
  type: "text",
};
import ROLLBACK from "./migration_029_coupon_expiry_at_order_time.rollback.sql" with {
  type: "text",
};

function ok(cond: boolean, label: string) {
  if (!cond) throw new Error(`${label}: expected truthy`);
}
function has(text: string, needle: string, label: string) {
  if (!text.includes(needle)) {
    throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
  }
}
function lacks(text: string, needle: string, label: string) {
  if (text.includes(needle)) {
    throw new Error(`${label}: should not contain ${JSON.stringify(needle)}`);
  }
}
function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** تعريف internal_coupon_discount من ملف هجرة (من CREATE لحد end $function$). */
function couponDef(sql: string): string {
  const start = sql.indexOf(
    "CREATE OR REPLACE FUNCTION public.internal_coupon_discount",
  );
  if (start < 0) throw new Error("internal_coupon_discount def not found");
  const endMark = "end $function$";
  const end = sql.indexOf(endMark, start);
  if (end < 0) throw new Error("internal_coupon_discount def unterminated");
  return sql.slice(start, end + endMark.length);
}

const NEW_DEF = couponDef(MIGRATION);
const OLD_DEF = couponDef(ROLLBACK);
// الجملة الوحيدة المتغيّرة: بحث الخصم الأخير قبل 029 وبعده.
const UNGUARDED = "  select discount into v_disc from public.coupons\n" +
  "   where upper(code) = v_code and active = true limit 1;";
const GUARDED = "  select discount into v_disc from public.coupons\n" +
  "   where upper(code) = v_code and active = true\n" +
  "     and (expires_at is null or expires_at > now()) limit 1;";
const GUARD = "expires_at is null or expires_at > now()";

Deno.test("029 adds the expiry guard to the order-time lookup exactly once", () => {
  ok(count(NEW_DEF, GUARDED) === 1, "guarded lookup present exactly once");
  lacks(NEW_DEF, UNGUARDED, "unguarded lookup is gone from the new definition");
  ok(count(OLD_DEF, UNGUARDED) === 1, "pre-029 lookup present in the rollback");
  lacks(OLD_DEF, GUARD, "pre-029 definition has no expiry guard");
  // الانتهاء مذكور في التعريف الجديد جوّه الحارس بس — مفيش لمسة تانية.
  ok(count(NEW_DEF, "expires_at") === 2, "expires_at appears only in the guard");
  ok(count(OLD_DEF, "expires_at") === 0, "pre-029 definition never read expires_at");
});

Deno.test("029 leaves the rest of the definition byte-identical", () => {
  // إرجاع الجملة المحروسة لأصلها لازم يرجّع التعريف الحي قبل 029 حرفيًا.
  ok(
    NEW_DEF.replace(GUARDED, UNGUARDED) === OLD_DEF,
    "definition outside the guarded statement matches the pre-029 definition",
  );
  // الترويسة ومسار البحث محفوظين حرفيًا في الاتنين.
  has(NEW_DEF, "SET search_path TO 'public', 'extensions'", "new def search_path");
  has(OLD_DEF, "SET search_path TO 'public', 'extensions'", "old def search_path");
  has(NEW_DEF, " SECURITY DEFINER", "new def stays SECURITY DEFINER");
});

Deno.test("guard matches validate_coupon expiry semantics", () => {
  // validate_coupon: ‏expires_at is not null and expires_at <= now()‎‏
  // يعني منتهي ويرجع null. نفيها بالظبط: صالح لو مفيش انتهاء
  // (null) أو الانتهاء لسه في المستقبل (> now()).
  has(NEW_DEF, `and (${GUARD})`, "guard is validate_coupon's expiry rule negated");
  lacks(NEW_DEF, "expires_at < now()", "no inverted expiry comparison");
  lacks(NEW_DEF, "expires_at >= now()", "no off-by-direction expiry comparison");
  // كوبون منتهي = مفيش صف = v_disc بتفضل null = الدالة ترجع null
  // وcreate_order ترفع 'invalid coupon' زي غير المفعّل بالظبط.
  has(
    NEW_DEF,
    "select discount into v_disc from public.coupons",
    "discount still resolved into v_disc (null when no row matches)",
  );
});

Deno.test("throttle behaviour is untouched — and still runs before the lookup", () => {
  const throttleLines = [
    "perform pg_advisory_xact_lock(",
    "hashtextextended('coupon-bucket:' || v_bucket, 0));",
    "v_limit  := case when auth.uid() is not null then 20 else 300 end;",
    "delete from public.coupon_attempts",
    "select count(*) into v_attempts from public.coupon_attempts",
    "if v_attempts >= v_limit then",
    "return null;  -- throttled: indistinguishable from an invalid code",
    "insert into public.coupon_attempts (bucket, code_guess)",
    "values (v_bucket, encode(extensions.digest(v_code, 'sha256'), 'hex'));",
  ];
  for (const line of throttleLines) {
    has(NEW_DEF, line, `throttle line in new def: ${line}`);
    has(OLD_DEF, line, `throttle line in old def: ${line}`);
  }
  ok(
    count(NEW_DEF, "coupon_attempts") === count(OLD_DEF, "coupon_attempts"),
    "coupon_attempts touchpoints unchanged",
  );
  // ترتيب التنفيذ زي ما هو: تسجيل المحاولة (حرق ميزانية الخنق)
  // بيحصل قبل بحث الخصم — تخمين كود منتهي بيتحاسب زي أي تخمين.
  ok(
    NEW_DEF.indexOf("insert into public.coupon_attempts") <
      NEW_DEF.indexOf(GUARDED),
    "attempt is recorded before the guarded lookup",
  );
});

Deno.test("029 changes no grants — CREATE OR REPLACE preserves the live ACL", () => {
  lacks(MIGRATION, "grant execute on function", "029 grants nothing");
  lacks(MIGRATION, "revoke execute on function", "029 revokes nothing");
  lacks(ROLLBACK, "grant execute on function", "rollback grants nothing");
  lacks(ROLLBACK, "revoke execute on function", "rollback revokes nothing");
  has(MIGRATION, "notify pgrst, 'reload schema';", "029 reloads PostgREST");
  has(ROLLBACK, "notify pgrst, 'reload schema';", "rollback reloads PostgREST");
});

Deno.test("029 rollback restores the unguarded pre-029 definition", () => {
  has(ROLLBACK, UNGUARDED, "rollback embeds the pre-029 lookup verbatim");
  lacks(ROLLBACK, GUARD, "rollback contains no expiry guard anywhere");
  has(
    ROLLBACK,
    "deliberate-decision rollback only",
    "rollback is marked deliberate-only (it re-opens the hole)",
  );
});
