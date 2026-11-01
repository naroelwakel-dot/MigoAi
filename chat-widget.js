// ==============================================================================
// Migo AI Solution - chat-widget.js
// الواجهة العائمة لشات المتجر (مساعد Migo). الردود بتيجي من خدمة Deno
// (api.ts) اللي بتكلّم Gemini بمفتاح محفوظ على السيرفر - مش هنا في المتصفح.
// ==============================================================================
(function () {
  var API = 'https://migoai-72.naroelwakel-dot.deno.net/chat';
  var WA = 'https://wa.me/201060934020';
  var history = [];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function build() {
    if (document.getElementById('migoChat')) return;
    var root = el('div', 'migo-chat');
    root.id = 'migoChat';
    root.innerHTML =
      '<button class="migo-chat__btn" type="button" aria-label="اسأل مساعد ميجو">💬</button>' +
      '<div class="migo-chat__panel" hidden>' +
        '<div class="migo-chat__head"><span>مساعد Migo</span>' +
          '<button class="migo-chat__x" type="button" aria-label="إغلاق">×</button></div>' +
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

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t, history: past })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var reply = d && d.reply ? d.reply : 'معلش حصلت مشكلة، جرّب تاني أو كلّمنا واتساب.';
          pending.textContent = reply;
          bodyEl.scrollTop = bodyEl.scrollHeight;
          history.push({ role: 'model', text: reply });
        })
        .catch(function () {
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
