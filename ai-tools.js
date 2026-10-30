// ==============================================================================
// Migo AI Solution - ai-tools.js
// برامج وأدوات الذكاء الاصطناعي + مفاتيح API للمطورين
// تنظيم موحّد: كل منتج في بطاقة واحدة بقائمة باقات (مدد/أحجام)، مثل باقي المتجر.
// مفاتيح الـAPI (ai_api_*) تُعرض في قسم «API Token» المنفصل، والباقي في قسم الذكاء.
// (لا تغيير في أي سعر أو اسم منتج — فقط دمج العائلات في بطاقة واحدة)
// ==============================================================================

const aiProducts = [
    // عائلة كلود (Claude AI) - بطاقة واحدة بكل الباقات
    {
        id: 'ai_claude',
        name: 'Claude AI',
        tag: 'اشتراكات Claude الرسمية',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/d99cf566a7da4d708a8a098131d41e2d.webp',
        desc: 'حساب خاص مفعل على بريدك وبدون VPN.',
        packages: [
            { id: 'ai_claude_pro', name: 'Claude AI Pro — شهر واحد — 1,200 ج.م', duration: 'شهر واحد', price: 1200 },
            { id: 'ai_claude_max5', name: 'Claude Max 5x — 4,340 ج.م', duration: '5 أضعاف Pro', price: 4340 },
            { id: 'ai_claude_max20', name: 'Claude Max 20x — 9,200 ج.م', duration: 'الاستخدام الأقصى 20x', price: 9200 },
            { id: 'ai_claude_team', name: 'Claude Team Workspace — 2,900 ج.م', duration: 'فريق عمل حتى 5 أعضاء', price: 2900 }
        ]
    },

    // محركات ومساعدات المطورين والبحث
    {
        id: 'ai_github_copilot',
        name: 'GitHub Copilot (شهر)',
        tag: 'مساعد البرمجة الذكي',
        price: 420,
        desc: 'إكمال الأكواد البرمجية وتحليل الأخطاء داخل VS Code مباشرة',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/bf02f412d40949c2ac6719a1320eba06.webp'
    },
    {
        id: 'ai_cursor_pro',
        name: 'Cursor AI Pro',
        tag: 'محرر المبرمجين الذكي',
        price: 1250,
        desc: 'أقوى IDE برمجي مدعوم بالذكاء الاصطناعي لكتابة المشاريع',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/73d3263cbf8441a2a1b87b35fcdc1c48.webp'
    },
    {
        id: 'ai_chatgpt',
        name: 'ChatGPT Plus (شهر)',
        tag: 'GPT-4o الأصلي',
        price: 753,
        desc: 'حساب مفعل بكامل مميزات التحليل، التصفح وتوليد الصور DALL-E',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c884d2c3b3e045d3b24846f091971179.webp'
    },
    {
        id: 'ai_perplexity_pro',
        name: 'Perplexity Pro',
        tag: 'محرك البحث الذكي',
        price: 739,
        desc: 'بحث علمي وتحليلي متقدم مع Claude 3.5 و GPT-4o',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/a0ff493f2cee4e57854fc2a6ae51142f.webp'
    },
    {
        id: 'ai_super_grok',
        name: 'Super Grok (xAI)',
        tag: 'إيلون ماسك الذكي',
        price: 980,
        desc: 'اشتراك رسمي في أقوى نماذج Grok غير المقيدة',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/999850f6036c469ca4e35b46a0c7b04e.webp'
    },

    // الصوت، الموسيقى، والصور
    {
        id: 'ai_midjourney',
        name: 'Midjourney',
        tag: 'توليد الصور الاحترافي',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/4f44340d5ad8435b8b99745e574a5c3d.webp',
        desc: 'اشتراكات Midjourney الرسمية لتوليد الصور بالذكاء الاصطناعي.',
        packages: [
            { id: 'ai_midjourney_std', name: 'Midjourney Standard — 1,850 ج.م', duration: 'Standard (Fast + Relax)', price: 1850 },
            { id: 'ai_midjourney_pro', name: 'Midjourney Pro — 3,700 ج.م', duration: 'Pro + وضع التخفي', price: 3700 }
        ]
    },
    {
        id: 'ai_suno_pro',
        name: 'Suno AI Pro (شهر)',
        tag: 'إنتاج الأغاني والموسيقى',
        price: 620,
        desc: '2,500 نقطة (500 أغنية) مع حقوق الملكية التجارية الكاملة',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/4a2281e6d06548abaecbd27397784419.webp'
    },
    {
        id: 'ai_elevenlabs',
        name: 'ElevenLabs Creator',
        tag: 'دوبلاج وأصوات AI',
        price: 1350,
        desc: '100,000 حرف شهرياً واستنساخ الأصوات بدقة بشرية فائقة',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/3eb6d55812d041bd812fb5c4f2af3206.webp'
    },
    {
        id: 'ai_muse',
        name: 'Muse AI',
        tag: 'توليد ومونتاج ذكي',
        price: 140,
        desc: 'حساب كامل مخصص للإنتاج المرئي',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/21a79a5ca4364734bb912e5ae4d7dd17.webp'
    },

    // عائلة جوجل (Google Gemini)
    {
        id: 'gemini_pro',
        name: 'Google Gemini Pro',
        tag: 'عرض حصري ⚡',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/38b1d79e7a0b440b8633f3325acf7659.webp',
        desc: 'اشتراك رسمي متكامل مع وصول دائم لأحدث النماذج المتقدمة.',
        packages: [
            { id: 'gemini_18m', name: 'Gemini AI Pro — 18 شهر — 281 ج.م', duration: '18 شهر', price: 281 },
            { id: 'gemini_ai_pro_12m', name: 'Google AI Pro — 12 شهر (FW) — 63 ج.م', duration: '12 شهر (FW)', price: 63 },
            { id: 'gemini_ai_plus_3m', name: 'Google AI Plus — 3 شهور (FW) — 41 ج.م', duration: '3 شهور (FW)', price: 41 }
        ]
    },

    // المونتاج وبناء المواقع بالذكاء الاصطناعي
    {
        id: 'capcut_pro',
        name: 'CapCut Pro + AI',
        tag: 'مونتاج وذكاء اصطناعي 🎬',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/48e19b8264184f42ba554c6749c00d94.webp',
        desc: 'مونتاج فيديو احترافي، إزالة خلفيات، وفلاتر ذكية بلا حدود.',
        packages: [
            { id: 'capcut_7d', name: '7 أيام — 62 ج.م', duration: '7 أيام', price: 62 },
            { id: 'capcut_1m', name: 'شهر واحد — 187 ج.م', duration: 'شهر واحد', price: 187 },
            { id: 'capcut_credits', name: 'CapCut PRO 1600 CREDITS — 249 ج.م', duration: 'رصيد رويال', price: 249 }
        ]
    },
    {
        id: 'lovable_pro',
        name: 'Lovable Pro Lite',
        tag: 'تطوير ويب بالذكاء 💻',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/d69a7b542229484d901ee20d97be6a31.webp',
        desc: 'بناء وتطوير تطبيقات ومواقع كاملة عبر الأوامر النصية المباشرة.',
        packages: [
            { id: 'lovable_12m', name: '12 شهر (سنة) — 608 ج.م', duration: 'سنة واحدة', price: 608 }
        ]
    },
    {
        id: 'framer_ai',
        name: 'Framer AI',
        tag: 'تصميم مواقع تفاعلية 🌐',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/eca35f63ab46467791a56bf1c6e313ba.webp',
        desc: 'تصميم ونشر مواقع ويب حديثة وسريعة الاستجابة بالذكاء الاصطناعي.',
        packages: [
            { id: 'framer_1y', name: 'سنة واحدة (Framer AI 1Y) — 439 ج.م', duration: 'سنة واحدة', price: 439 }
        ]
    },

    // --------------------------------------------------------------------------
    // مفاتيح الـ API للمطورين (قسم «API Token» المنفصل) - ai_api_*
    // --------------------------------------------------------------------------
    {
        id: 'ai_api_claude',
        name: 'API Claude Tokens',
        tag: 'مفاتيح Claude للمطورين',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/d99cf566a7da4d708a8a098131d41e2d.webp',
        desc: 'مفاتيح API رسمية تُسلَّم فوراً ومخصصة للبرمجة.',
        packages: [
            { id: 'ai_api_claude10', name: '10M Tokens — 75 ج.م', duration: 'يومي', price: 75 },
            { id: 'ai_api_claude50', name: '50M Tokens — 210 ج.م', duration: 'يومان', price: 210 },
            { id: 'ai_api_claude_100', name: '30D رصيد $100 — 150 ج.م', duration: '30 يوماً', price: 150 }
        ]
    },
    {
        id: 'ai_api_codex',
        name: 'API CODEX Tokens',
        tag: 'مفاتيح CODEX للمطورين',
        banner: 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c884d2c3b3e045d3b24846f091971179.webp',
        desc: 'مفاتيح API مخصصة لمحررات الأكواد والمطورين.',
        packages: [
            { id: 'ai_api_codex10', name: '10M Tokens — 75 ج.م', duration: 'يومي', price: 75 },
            { id: 'ai_api_codex50', name: '50M Tokens — 185 ج.م', duration: 'يومان', price: 185 },
            { id: 'ai_api_codex100', name: '100M Tokens — 310 ج.م', duration: '3 أيام', price: 310 }
        ]
    }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { aiProducts };
} else {
  window.aiProducts = aiProducts;
}

// ==============================================================================
// توحيد البيانات (منع التضارب):
// كل منتجات وباقات الذكاء الاصطناعي تُكتب هنا فقط (ai-tools.js) بمصدر واحد.
// ولأن البحث في الموقع يقرأ subscriptionsData فقط، نُسجّل نفس الباقات فيها
// تلقائياً بلا أي كتابة يدوية، فتظهر نتيجة البحث بنفس سعر البطاقة تماماً.
// لا تُعد كتابة أسعار الذكاء الاصطناعي داخل subscriptions.js بعد الآن.
// ==============================================================================
if (typeof subscriptionsData !== 'undefined' && Array.isArray(subscriptionsData)) {
  aiProducts.forEach(function (p) {
    if (subscriptionsData.some(function (s) { return s.id === p.id; })) return;
    subscriptionsData.push({
      id: p.id,
      name: p.name,
      category: 'ai',
      description: p.description || p.desc || '',
      packages: p.packages || [{ id: p.id, name: p.tag || p.name, duration: p.tag, price: p.price }]
    });
  });
}

// ==============================================================================
// قسم «API Token» المنفصل — يُبنى وقت التحميل من غير تعديل app.js أو index.html.
// يفصل مفاتيح ai_api_* عن برامج الذكاء في قسم مستقل، ويضيف القسم إلى الشريط
// العلوي ومركز الأقسام والقائمة الجانبية، ويسجّل باقات رصيد API في البحث.
// ==============================================================================
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var CDN = 'https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/';

  function cardHtml(a) {
    var pkgs = a.packages || [{ name: a.tag || a.name, price: a.price, duration: a.tag }];
    var p0 = calculateAutoPrice(pkgs[0].price);
    var banner = a.banner || (CDN + 'd99cf566a7da4d708a8a098131d41e2d.webp');
    var opts = pkgs.map(function (pkg, i) {
      return '<option value="' + i + '" data-price="' + pkg.price + '">' + pkg.name + '</option>';
    }).join('');
    return '<div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">' +
      '<div class="h-28 sm:h-32 relative bg-cover bg-center" style="background-image: url(\'' + banner + '\');">' +
        '<div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">' +
          '<span class="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-bold w-fit">' + (a.badge || a.tag || 'API') + '</span>' +
          '<h4 class="font-extrabold text-sm sm:text-base text-white drop-shadow-md">' + a.name + '</h4>' +
        '</div>' +
      '</div>' +
      '<div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">' +
        '<p class="text-[10px] text-gray-400 mb-2">' + (a.description || a.desc || '') + '</p>' +
        '<div>' +
          '<div class="flex justify-between items-center mb-1.5">' +
            '<label class="text-[11px] font-bold text-gray-300" for="ai_pkg_' + a.id + '">اختر الباقة:</label>' +
            '<span id="ai_price_' + a.id + '" class="text-xs font-extrabold text-amber-400 font-mono">' + p0.toLocaleString() + ' ج.م</span>' +
          '</div>' +
          '<select id="ai_pkg_' + a.id + '" onchange="updateCardPriceDisplay(\'ai\', \'' + a.id + '\')" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-indigo-300 font-bold outline-none mb-2">' + opts + '</select>' +
        '</div>' +
        '<div class="pt-2 border-t border-slate-800 flex gap-2">' +
          '<button onclick="handleAIAction(\'' + a.id + '\', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow">شحن فوري ⚡</button>' +
          '<button onclick="handleAIAction(\'' + a.id + '\', false)" class="sky-btn font-bold text-xs px-3 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>' +
        '</div>' +
      '</div></div>';
  }

  function injectCss() {
    if (document.getElementById('migoApiCss')) return;
    var s = document.createElement('style');
    s.id = 'migoApiCss';
    s.textContent = '#apiTokensContainer .sky-card > div:first-child{height:auto!important;aspect-ratio:1/1!important;background-size:cover!important;background-repeat:no-repeat!important;background-position:center!important;background-color:transparent!important;}';
    document.head.appendChild(s);
  }

  function cloneLink(anchor, href, inner) {
    var c = anchor.cloneNode(true);
    c.setAttribute('href', href);
    c.innerHTML = inner;
    anchor.parentNode.insertBefore(c, anchor.nextSibling);
  }

  function ensureRegistered() {
    if (typeof subscriptionsData === 'undefined' || !Array.isArray(subscriptionsData)) return;
    aiProducts.forEach(function (p) {
      if (subscriptionsData.some(function (s) { return s.id === p.id; })) return;
      subscriptionsData.push({
        id: p.id, name: p.name, category: 'ai',
        description: p.description || p.desc || '',
        packages: p.packages || [{ id: p.id, name: p.tag || p.name, duration: p.tag, price: p.price }]
      });
    });
    [
      { id: 'api_10', name: 'API Credit Starter ($10)', duration: '$10 رصيد', price: 620 },
      { id: 'api_30', name: 'API Credit Pro ($30)', duration: '$30 رصيد', price: 1860 },
      { id: 'api_125', name: 'API Credit Business ($125)', duration: '$125 رصيد', price: 7750 }
    ].forEach(function (b) {
      if (subscriptionsData.some(function (s) { return s.id === b.id; })) return;
      subscriptionsData.push({ id: b.id, name: b.name, category: 'api', description: 'باقة رصيد API للمطورين', packages: [{ id: b.id, name: b.name, duration: b.duration, price: b.price }] });
    });
  }

  function renderCards() {
    var ai = (typeof aiProducts !== 'undefined' && aiProducts) ? aiProducts : null;
    if (!ai || !ai.length || typeof calculateAutoPrice !== 'function') return false;
    var aiC = document.getElementById('aiCardsContainer');
    var apiC = document.getElementById('apiTokensContainer');
    if (!aiC || !apiC) return false;
    var isApi = function (p) { return /^ai_api_/.test(p.id); };
    aiC.innerHTML = ai.filter(function (p) { return !isApi(p); }).map(cardHtml).join('');
    apiC.innerHTML = ai.filter(isApi).map(cardHtml).join('');
    return true;
  }

  function construct() {
    if (document.getElementById('sec-apitoken')) return true;
    var aiSection = document.getElementById('sec-ai');
    if (!aiSection) return false;

    var sec = document.createElement('section');
    sec.id = 'sec-apitoken';
    sec.className = 'sky-surface p-5 sm:p-6 scroll-mt-24';
    sec.innerHTML =
      '<div class="mb-4">' +
        '<span class="pill-badge font-mono-code">API TOKENS</span>' +
        '<h2 class="text-lg font-bold text-white mt-1">مفاتيح API ورصيد المطورين</h2>' +
      '</div>' +
      '<div id="apiTokensContainer" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5"></div>';

    // move the existing rates / API-credit panel (direct child of #sec-ai) into the new section
    var panel = null;
    for (var i = 0; i < aiSection.children.length; i++) {
      var ch = aiSection.children[i];
      if (ch.className && ch.className.indexOf('sky-card') !== -1) { panel = ch; break; }
    }
    if (panel) sec.appendChild(panel);
    aiSection.parentNode.insertBefore(sec, aiSection.nextSibling);

    // links: clone the AI ones (top pill, hub card, hamburger)
    var links = document.querySelectorAll('a[href="#sec-ai"]');
    for (var j = 0; j < links.length; j++) {
      var a = links[j];
      if (a.className && a.className.indexOf('sky-card') !== -1) {
        cloneLink(a, '#sec-apitoken',
          '<span class="sec-ic" aria-hidden="true">🔑</span>' +
          '<span class="text-xs font-bold text-white">API Token</span>' +
          '<span class="text-[10px] text-slate-400">مفاتيح ورصيد المطورين</span>');
      } else if (a.getAttribute('onclick') && a.getAttribute('onclick').indexOf('toggleSidebar') !== -1) {
        cloneLink(a, '#sec-apitoken', '<span>مفاتيح API والرصيد</span>');
      } else {
        cloneLink(a, '#sec-apitoken', 'API Token');
      }
    }
    // rename the AI links (drop the "APIs" wording)
    var aiLinks = document.querySelectorAll('a[href="#sec-ai"]');
    for (var k = 0; k < aiLinks.length; k++) {
      var l = aiLinks[k];
      if (l.className && l.className.indexOf('sky-card') !== -1) continue;
      if (l.getAttribute('onclick') && l.getAttribute('onclick').indexOf('toggleSidebar') !== -1) {
        if (l.textContent.indexOf('APIs') !== -1) l.innerHTML = '<span>الذكاء الاصطناعي</span>';
      } else if (l.textContent.indexOf('AI & APIs') !== -1) {
        l.textContent = 'الذكاء الاصطناعي';
      }
    }
    var aiH2 = aiSection.querySelector('h2');
    if (aiH2 && aiH2.textContent.indexOf('API') !== -1) aiH2.textContent = 'الذكاء الاصطناعي';

    injectCss();
    return true;
  }

  function tick() {
    var ai = (typeof aiProducts !== 'undefined' && aiProducts) ? aiProducts : null;
    if (!ai || !ai.length || typeof calculateAutoPrice !== 'function') return false;
    ensureRegistered();
    construct();
    return renderCards();
  }

  function start() {
    var tries = 0;
    (function attempt() {
      tries++;
      var ok = false;
      try { ok = tick(); } catch (e) { ok = false; }
      if (!ok && tries <= 60) { setTimeout(attempt, 150); }
      else {
        // a couple of late passes to override app.js's own render if it lands after us
        setTimeout(function () { try { tick(); } catch (e) {} }, 500);
        setTimeout(function () { try { tick(); } catch (e) {} }, 1500);
      }
    })();
  }
  window.addEventListener('load', function () { setTimeout(start, 250); });
})();
