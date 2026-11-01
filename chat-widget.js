// ==============================================================================
// Migo AI Solution - chat-widget.js
// الواجهة العائمة لشات المتجر (مساعد Migo). الردود بتيجي من خدمة Deno
// (api.ts) اللي بتكلّم Gemini بمفتاح محفوظ على السيرفر - مش هنا في المتصفح.
// ==============================================================================
(function () {
  var API = 'https://migoai-72.naroelwakel-dot.deno.net/chat';
  var WA = 'https://wa.me/201060934020';
  var history = [];
  var REPLY_TIMEOUT_MS = 20000;   // أقصى وقت نستنى فيه رد السيرفر
  var TICKER_MS = 60000;          // سطر الذكر يتغيّر كل دقيقة

  // سطر الذكر والصلاة فوق المحادثة. عدّل الكلمات من هنا وهو مش محتاج أي حاجة تانية.
  var TICKER = [
    'اذكر الله، تطمئن القلوب 🤍',
    'اللهم صلِّ وسلّم على نبينا محمد ﷺ',
    'هل صليت اليوم؟ متأجّلش الصلاة',
    'سبحان الله وبحمده، سبحان الله العظيم',
    'لا تنسَ أذكار الصباح والمساء',
    'أستغفر الله العظيم وأتوب إليه',
    'تبسّم، فتبسّمك في وجه أخيك صدقة',
    'الحمد لله على كل حال'
  ];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  // شعار Migo المتحرك (نفس شعار الهيدر) - معرّف تدرّج مختلف عشان مايتعارضش مع شعار الصفحة
  function logoSVG(id) {
    return '<svg viewBox="0 0 48 48" role="img" aria-label="Migo AI Solution">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#f2d27a"/><stop offset="1" stop-color="#b8860b"/></linearGradient></defs>' +
      '<circle cx="24" cy="24" r="8.5" fill="url(#' + id + ')" class="migo-core"/>' +
      '<circle cx="24" cy="24" r="16.5" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.6"/>' +
      '<circle cx="24" cy="24" r="16.5" fill="none" stroke="url(#' + id + ')" stroke-width="2.2" stroke-linecap="round" class="migo-ring"/>' +
      '<g class="migo-spin"><circle cx="24" cy="7.5" r="3" fill="#ffe9a8"/></g>' +
    '</svg>';
  }

  // سطر الذكر: يعرض أول جملة فورًا، وبعدها يتغيّر كل دقيقة بتلاشي ناعم.
  function startTicker(node) {
    if (!node || !TICKER.length) return;
    var i = 0;
    node.textContent = TICKER[i];
    node.classList.add('is-in');
    i++;
    setInterval(function () {
      node.classList.remove('is-in');
      setTimeout(function () {
        node.textContent = TICKER[i % TICKER.length];
        node.classList.add('is-in');
        i++;
      }, 420);
    }, TICKER_MS);
  }

  function build() {
    if (document.getElementById('migoChat')) return;
    var root = el('div', 'migo-chat');
    root.id = 'migoChat';
    root.innerHTML =
      '<button class="migo-chat__btn" type="button" aria-label="اسأل مساعد ميجو">' + logoSVG('migoOrbitFab') + '</button>' +
      '<div class="migo-chat__panel" hidden>' +
        '<div class="migo-chat__head"><span>مساعد Migo</span>' +
          '<button class="migo-chat__x" type="button" aria-label="إغلاق المحادثة">إغلاق <b>✕</b></button></div>' +
        '<div class="migo-chat__ticker" aria-live="polite"></div>' +
        '<div class="migo-chat__body"></div>' +
        '<form class="migo-chat__form">' +
          '<input class="migo-chat__in" type="text" placeholder="اسأل عن أي سعر أو خدمة..." autocomplete="off" maxlength="400" />' +
          '<button type="submit">إرسال</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(root);

    var panel = root.querySelector('.migo-chat__panel');
    var bodyEl = root.querySelector('.migo-chat__body');
    var input = root.querySelector('.migo-chat__in');
    var form = root.querySelector('.migo-chat__form');
    var fab = root.querySelector('.migo-chat__btn');

    function bubble(text, who) {
      var b = el('div', 'migo-chat__msg migo-chat__msg--' + who, text);
      bodyEl.appendChild(b);
      bodyEl.scrollTop = bodyEl.scrollHeight;
      return b;
    }

    bubble('أهلاً! 👋 اسألني عن أي سعر أو خدمة وأنا أرد عليك في ثانية.', 'bot');
    startTicker(root.querySelector('.migo-chat__ticker'));

    fab.addEventListener('click', function () {
      panel.hidden = false;
      fab.style.display = 'none';
      input.focus();
    });
    root.querySelector('.migo-chat__x').addEventListener('click', function () {
      panel.hidden = true;
      fab.style.display = '';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = input.value.trim();
      if (!t) return;
      input.value = '';
      bubble(t, 'me');
      var past = history.slice(-6);
      history.push({ role: 'user', text: t });
      var pending = bubble('...', 'bot');
      var settled = false;
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;

      // مؤقت أمان: مهما حصل، البابل مش هيفضل "..." للأبد.
      var guard = setTimeout(function () {
        if (settled) return;
        settled = true;
        if (ctrl) ctrl.abort();
        pending.textContent = 'الرد بيتأخر شوية. جرّب تسأل تاني، أو كلّمنا على واتساب ونساعدك فورًا: ' + WA;
        bodyEl.scrollTop = bodyEl.scrollHeight;
      }, REPLY_TIMEOUT_MS);

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, history: past }),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          var reply = d && d.reply ? d.reply : 'معلش حصلت مشكلة، جرّب تاني أو كلّمنا واتساب.';
          pending.textContent = reply;
          bodyEl.scrollTop = bodyEl.scrollHeight;
          history.push({ role: 'model', text: reply });
        })
        .catch(function () {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          pending.textContent = 'معلش فيه مشكلة في الاتصال دلوقتي. كلّمنا على واتساب: ' + WA;
          bodyEl.scrollTop = bodyEl.scrollHeight;
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
