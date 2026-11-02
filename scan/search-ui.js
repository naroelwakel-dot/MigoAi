// ==============================================================================
// Migo AI Solution - search-ui.js
// Collapsible header search: while the page is scrolled the big search bar
// becomes a small icon next to the menu button; tapping it reveals the field
// again. Nothing here changes the search logic itself - only where it sits.
// ==============================================================================
(function () {
  function init() {
    var header = document.querySelector('header.sticky') || document.querySelector('header');
    var input = document.getElementById('liveSearchInput');
    if (!header || !input) return;

    // The bar lives in the row that wraps the search input.
    var row = input.closest('div.mt-3') || input.closest('div.relative');
    if (row && !row.id) row.id = 'searchRow';

    // Put the small icon right beside the menu (sidebar) button in the top row.
    var anchor = document.querySelector('button[onclick="toggleSidebar()"]');
    if (!anchor || document.getElementById('searchToggleBtn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'searchToggleBtn';
    btn.setAttribute('aria-label', 'بحث');
    btn.setAttribute('aria-expanded', 'false');
    btn.className = 'w-9 h-9 rounded-xl border border-white/15 bg-[#171c24] flex items-center justify-center text-slate-200 hover:text-white hover:border-white/30 transition cursor-pointer';
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass text-xs"></i>';
    anchor.insertAdjacentElement('afterend', btn);

    var open = false;
    function setOpen(v) {
      open = v;
      header.classList.toggle('search-open', v);
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) setTimeout(function () { input.focus(); }, 30);
    }

    btn.addEventListener('click', function (e) { e.preventDefault(); setOpen(!open); });

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var scrolled = y > 120;
      header.classList.toggle('is-scrolled', scrolled);
      if (!scrolled && open) setOpen(false); // back at the top: the full bar is shown again
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Tapping anywhere outside closes it back to the icon.
    document.addEventListener('click', function (e) {
      if (!open || !e.target.closest) return;
      if (e.target.closest('#searchRow') || e.target.closest('#searchToggleBtn')) return;
      setOpen(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==== مصدر احتياطي مجاني لفحص الأيدي ====
   لو السيرفر الأساسي للموقع (migoai-72) ما قدرش يتحقق من اللعبة، بنجرب مصدر
   مجاني بيجمع أكتر من API في مكان واحد (نفس المصادر اللي البوت بيستخدمها).
   الملف ده بيُحمَّل بعد app.js فبيغلّف fetch من غير ما نلمس المنطق الأصلي. */
(function () {
  var SHARED = "https://migostore-bot.naroelwakel-dot.deno.net/id";
  if (!window.fetch || window.__migoIdFallback) return;
  window.__migoIdFallback = true;
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url) || "";
    var p = origFetch(input, init);
    if (url.indexOf("migoai-72.naroelwakel-dot.deno.net") === -1) return p;
    return p.then(function (res) {
      return res.clone().json().then(function (d) {
        var nm = d && (d.username || d.name || (d.data && (d.data.username || d.data.name)));
        if (d && d.success && nm) return res;
        if (url.indexOf("game=") === -1) return res;
        var q;
        try { q = new URL(url, location.href).searchParams; } catch (e) { return res; }
        var fbUrl = SHARED + "?game=" + encodeURIComponent(q.get("game") || "") +
          "&id=" + encodeURIComponent(q.get("id") || "") +
          (q.get("zoneId") ? "&zoneId=" + encodeURIComponent(q.get("zoneId")) : "");
        return origFetch(fbUrl).then(function (r) { return r.json(); }).then(function (fd) {
          if (fd && fd.success && fd.username) {
            return new Response(JSON.stringify({ success: true, username: fd.username }), {
              status: 200, headers: { "content-type": "application/json" }
            });
          }
          return res;
        }).catch(function () { return res; });
      }).catch(function () { return res; });
    });
  };
})();
