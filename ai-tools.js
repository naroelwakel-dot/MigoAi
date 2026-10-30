// ==============================================================================
// Migo AI Solution - ai-tools.js
// باقات الذكاء الاصطناعي و مفاتيح APIs المتقدمة (كل منتج في بطاقة مستقلة تماماً)
// (نسخة معدّلة: تصحيح اسمَي ملفَي الصور فقط — لا تغيير في أي بيانات أو أسعار)
// ==============================================================================

const aiProducts = [
    // عائلة كلود (Claude AI)
    {
        id: 'ai_claude_max5',
        name: 'Claude Max 5x',
        tag: '5 أضعاف Pro',
        price: 4340,
        desc: 'حساب خاص مفعل على بريدك وبدون VPN',
        banner: 'claudai.jpeg'
    },
    {
        id: 'ai_claude_max20',
        name: 'Claude Max 20x',
        tag: 'الاستخدام الأقصى 20x',
        price: 9200,
        desc: 'أعلى باقة للشركات بدون حدود إرسال',
        banner: 'claudai.jpeg'
    },
    {
        id: 'ai_claude_pro',
        name: 'Claude AI Pro',
        tag: 'شهر واحد',
        price: 1200,
        desc: 'تفعيل رسمي على إيميلك الشخصي مباشرة',
        banner: 'claudai.jpeg'
    },
    {
        id: 'ai_claude_team',
        name: 'Claude Team Workspace',
        tag: 'فريق عمل',
        price: 2900,
        desc: 'مساحة عمل مخصصة لفريقك حتى 5 أعضاء',
        banner: 'claudai.jpeg'
    },

    // مفاتيح الـ API للمطورين
    {
        id: 'ai_api_claude10',
        name: 'API Claude 10M Tokens',
        tag: 'يومي للمطورين',
        price: 75,
        desc: 'تسليم فوري للمفتاح مخصص للبرمجة',
        banner: 'claudapi.jpeg'
    },
    {
        id: 'ai_api_claude50',
        name: 'API Claude 50M Tokens',
        tag: 'توكنز مرتفعة',
        price: 210,
        desc: 'صلاحية يومين للاستخدام المكثف',
        banner: 'claudapi.jpeg'
    },
    {
        id: 'ai_api_claude_100',
        name: 'API Claude 30D $100',
        tag: 'رصيد 100 دولار',
        price: 150,
        desc: 'صلاحية شهر كامل لدعم مشاريعك',
        banner: 'claudapi.jpeg'
    },
    {
        id: 'ai_api_codex10',
        name: 'API CODEX 10M Tokens',
        tag: 'أكواد وبرمجة',
        price: 75,
        desc: 'مخصص لمحررات الأكواد والمطورين',
        banner: 'gbtcodex.jpeg'
    },
    {
        id: 'ai_api_codex50',
        name: 'API CODEX 50M Tokens',
        tag: 'توكنز برمجية 50M',
        price: 185,
        desc: 'صلاحية يومين مع دعم كامل',
        banner: 'gbtcodex.jpeg'
    },
    {
        id: 'ai_api_codex100',
        name: 'API CODEX 100M Tokens',
        tag: 'توكنز برمجية 100M',
        price: 310,
        desc: 'صلاحية 3 أيام للمشاريع الكبيرة',
        banner: 'gbtcodex.jpeg'
    },

    // محركات ومساعدات المطورين والبحث
    {
        id: 'ai_github_copilot',
        name: 'GitHub Copilot (شهر)',
        tag: 'مساعد البرمجة الذكي',
        price: 420,
        desc: 'إكمال الأكواد البرمجية وتحليل الأخطاء داخل VS Code مباشرة',
        banner: 'github.png'
    },
    {
        id: 'ai_cursor_pro',
        name: 'Cursor AI Pro',
        tag: 'محرر المبرمجين الذكي',
        price: 1250,
        desc: 'أقوى IDE برمجي مدعوم بالذكاء الاصطناعي لكتابة المشاريع',
        banner: 'github.png'
    },
    {
        id: 'ai_chatgpt',
        name: 'ChatGPT Plus (شهر)',
        tag: 'GPT-4o الأصلي',
        price: 753,
        desc: 'حساب مفعل بكامل مميزات التحليل، التصفح وتوليد الصور DALL-E',
        banner: 'chatgptplus.jpeg'
    },
    {
        id: 'ai_perplexity_pro',
        name: 'Perplexity Pro',
        tag: 'محرك البحث الذكي',
        price: 739,
        desc: 'بحث علمي وتحليلي متقدم مع Claude 3.5 و GPT-4o',
        banner: 'Perplexity.webp'
    },
    {
        id: 'ai_super_grok',
        name: 'Super Grok (xAI)',
        tag: 'إيلون ماسك الذكي',
        price: 980,
        desc: 'اشتراك رسمي في أقوى نماذج Grok غير المقيدة',
        banner: 'supergrok.webp'
    },

    // الصوت، الموسيقى، والصور
    {
        id: 'ai_midjourney_std',
        name: 'Midjourney Standard',
        tag: 'توليد الصور الاحترافي',
        price: 1850,
        desc: 'ساعات Fast كاملة وتوليد صور غير محدود في وضع Relax',
        banner: 'midjourny.jpeg'
    },
    {
        id: 'ai_midjourney_pro',
        name: 'Midjourney Pro',
        tag: 'وضع التخفي (Stealth)',
        price: 3700,
        desc: 'الوضع السري وحرية تجارية كاملة للمصممين والشركات',
        banner: 'midjourny.jpeg'
    },
    {
        id: 'ai_suno_pro',
        name: 'Suno AI Pro (شهر)',
        tag: 'إنتاج الأغاني والموسيقى',
        price: 620,
        desc: '2,500 نقطة (500 أغنية) مع حقوق الملكية التجارية الكاملة',
        banner: 'sunoai.jpeg'
    },
    {
        id: 'ai_elevenlabs',
        name: 'ElevenLabs Creator',
        tag: 'دوبلاج وأصوات AI',
        price: 1350,
        desc: '100,000 حرف شهرياً واستنساخ الأصوات بدقة بشرية فائقة',
        banner: 'elevenlabs.jpeg'
    },
    {
        id: 'ai_muse',
        name: 'Muse AI',
        tag: 'توليد ومونتاج ذكي',
        price: 140,
        desc: 'حساب كامل مخصص للإنتاج المرئي',
        banner: 'musai.jpeg'
    },

    // عائلة جوجل (Google Gemini)
    {
        id: 'gemini_pro',
        name: 'Google Gemini Pro',
        tag: 'عرض حصري ⚡',
        banner: 'Geminipro.png',
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
        banner: 'capcut.png',
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
        banner: 'lovable.png',
        desc: 'بناء وتطوير تطبيقات ومواقع كاملة عبر الأوامر النصية المباشرة.',
        packages: [
            { id: 'lovable_12m', name: '12 شهر (سنة) — 608 ج.م', duration: 'سنة واحدة', price: 608 }
        ]
    },
    {
        id: 'framer_ai',
        name: 'Framer AI',
        tag: 'تصميم مواقع تفاعلية 🌐',
        banner: 'framerai.jpg',
        desc: 'تصميم ونشر مواقع ويب حديثة وسريعة الاستجابة بالذكاء الاصطناعي.',
        packages: [
            { id: 'framer_1y', name: 'سنة واحدة (Framer AI 1Y) — 439 ج.م', duration: 'سنة واحدة', price: 439 }
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
