/* E-003 (Package 8) — storefront client-error reporter. PREPARED PATCH, not deployed.
 *
 * Purpose: real browser errors on customer devices currently vanish
 * (~19 silent catches in app.js; nothing is reported anywhere). This
 * snippet reports uncaught errors + unhandled promise rejections to
 * the store backend, which writes them into the central error_log
 * (migration 006) with source "storefront.client" — the signature the
 * unified error reader links to register item E-003.
 *
 * Hard rules baked in:
 * - NEVER breaks the page: every step is wrapped; a failed report is
 *   dropped silently (reporting must not become a new error source).
 * - No PII, no form values, no query strings: only the error message,
 *   its type, a trimmed stack, the page PATH, and the UA family.
 * - Bounded: max 5 reports per page view, identical messages deduped,
 *   payload fields capped to the log_error RPC limits
 *   (message <= 300, error_text <= 500 chars).
 * - Kill switch: set window.MIGO_CLIENT_ERROR_REPORTING = false before
 *   this script loads, or remove the script tag — no other wiring.
 */
(function () {
  "use strict";
  if (window.MIGO_CLIENT_ERROR_REPORTING === false) return;

  var ENDPOINT = "https://migoai-72.naroelwakel-dot.deno.net/client-error";
  var MAX_REPORTS = 5;
  var sent = 0;
  var seen = {};

  function clean(text, cap) {
    text = String(text == null ? "" : text);
    // Strip anything that looks like a URL query string or a token.
    text = text.replace(/https?:\/\/[^\s"']+/g, function (u) {
      return u.split("?")[0];
    });
    text = text.replace(/[A-Za-z0-9_\-]{32,}/g, "***");
    return text.slice(0, cap);
  }

  function report(message, error) {
    try {
      if (sent >= MAX_REPORTS) return;
      var msg = clean(message || (error && error.message) || "unknown error", 300);
      if (!msg || seen[msg]) return;
      seen[msg] = true;
      sent += 1;
      var payload = {
        message: msg,
        error_type: (error && error.name) || "Error",
        error_text: clean((error && error.stack) || (error && error.message) || "", 500),
        context: {
          page: location.pathname,
          ua: (navigator.userAgent || "").slice(0, 120)
        }
      };
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        }).catch(function () { /* reporting failure is dropped by design */ });
      }
    } catch (_ignored) {
      /* the reporter must never throw into the page */
    }
  }

  window.addEventListener("error", function (event) {
    report(event.message, event.error);
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    report((reason && reason.message) || "unhandled promise rejection", reason);
  });
})();
