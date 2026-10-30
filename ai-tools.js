// ==============================================================================
// Migo AI Solution - ai-tools.js
// باقات الذكاء الاصطناعي و مفاتيح APIs المتقدمة - متطابقة مع تصميم الألعاب والترفيه
// ==============================================================================

const aiProducts = [
    {
        id: "chatgpt",
        name: "ChatGPT Plus & Pro",
        provider: "OpenAI الرسمي",
        category: "ai",
        badge: "الأكثر طلباً 🔥",
        banner: "chatgptplus.jpeg",
        description: "حساب مفعل بكامل مميزات التحليل، التصفح وتوليد الصور DALL-E.",
        packages: [
            { id: "ai_chatgpt_1m", name: "ChatGPT Plus (شهر) — 480 ج.م", duration: "شهر واحد", price: 480 }
        ]
    },
    {
        id: "claude_ai",
        name: "Claude AI Solutions",
        provider: "Anthropic الرسمي",
        category: "ai",
        badge: "قوة تحليلية فائقة 🧠",
        banner: "claudai.jpeg",
        description: "تفعيل رسمي على إيميلك الشخصي مباشرة وبدون VPN.",
        packages: [
            { id: "ai_claude_pro", name: "Claude AI Pro (شهر) — 1,200 ج.م", duration: "شهر واحد", price: 1200 },
            { id: "ai_claude_max5", name: "Claude Max 5x — 4,340 ج.م", duration: "5 أضعاف Pro", price: 4340 },
            { id: "ai_claude_max20", name: "Claude Max 20x — 9,200 ج.م", duration: "20x أقصى استخدام", price: 9200 },
            { id: "ai_claude_team", name: "Claude Team Workspace — 2,900 ج.م", duration: "فريق عمل 5 أعضاء", price: 2900 }
        ]
    },
    {
        id: "claude_api_pack",
        name: "API Claude & Codex",
        provider: "Developer APIs",
        category: "ai",
        badge: "مفاتيح المطورين ⚡",
        banner: "claudapi.jpeg",
        description: "مفاتيح وتوكنز API مخصصة للبرمجة والمشاريع الكبيرة.",
        packages: [
            { id: "ai_api_claude10", name: "API Claude 10M Tokens — 75 ج.م", duration: "يومي", price: 75 },
            { id: "ai_api_claude50", name: "API Claude 50M Tokens — 210 ج.م", duration: "يومان", price: 210 },
            { id: "ai_api_claude_100", name: "API Claude 30D $100 — 150 ج.م", duration: "شهر كامل", price: 150 },
            { id: "ai_api_codex10", name: "API CODEX 10M Tokens — 75 ج.م", duration: "مطورين", price: 75 },
            { id: "ai_api_codex50", name: "API CODEX 50M Tokens — 185 ج.م", duration: "يومان", price: 185 },
            { id: "ai_api_codex100", name: "API CODEX 100M Tokens — 310 ج.م", duration: "3 أيام", price: 310 }
        ]
    },
    {
        id: "github_cursor",
        name: "GitHub Copilot & Cursor AI",
        provider: "Developer IDE",
        category: "ai",
        badge: "مساعد المبرمجين 💻",
        banner: "github.png",
        description: "أقوى محررات وأدوات الذكاء الاصطناعي لكتابة وتصحيح الأكواد.",
        packages: [
            { id: "ai_github_copilot", name: "GitHub Copilot (شهر) — 420 ج.م", duration: "شهر واحد", price: 420 },
            { id: "ai_cursor_pro", name: "Cursor AI Pro — 1,250 ج.م", duration: "اشتراك احترافي", price: 1250 }
        ]
    },
    {
        id: "midjourney",
        name: "Midjourney Standard & Pro",
        provider: "Midjourney الرسمي",
        category: "ai",
        badge: "توليد الصور 🎨",
        banner: "midjourny.jpeg",
        description: "توليد صور احترافية بدقة فائقة مع خيارات وضع التخفي.",
        packages: [
            { id: "ai_midjourney_std", name: "Midjourney Standard — 1,850 ج.م", duration: "ساعات Fast", price: 1850 },
            { id: "ai_midjourney_pro", name: "Midjourney Pro (Stealth) — 3,700 ج.م", duration: "وضع سري", price: 3700 }
        ]
    },
    {
        id: "suno_ai",
        name: "Suno AI Pro",
        provider: "Suno الرسمي",
        category: "ai",
        badge: "إنتاج الموسيقى والأغاني 🎶",
        banner: "sunoai.jpeg",
        description: "2,500 نقطة (500 أغنية) مع حقوق الملكية التجارية الكاملة.",
        packages: [
            { id: "ai_suno_pro", name: "Suno AI Pro (شهر) — 620 ج.م", duration: "شهر واحد", price: 620 }
        ]
    },
    {
        id: "elevenlabs",
        name: "ElevenLabs Creator",
        provider: "ElevenLabs الرسمي",
        category: "ai",
        badge: "دوبلاج وأصوات AI 🎙️",
        banner: "elevenlabs.jpeg",
        description: "100,000 حرف شهرياً واستنساخ الأصوات بدقة بشرية فائقة.",
        packages: [
            { id: "ai_elevenlabs", name: "ElevenLabs Creator — 1,350 ج.م", duration: "شهر واحد", price: 1350 }
        ]
    },
    {
        id: "perplexity_grok",
        name: "Perplexity Pro & Super Grok",
        provider: "Search & xAI",
        category: "ai",
        badge: "بحث وعصري متقدم 🔍",
        banner: "perplexirty.webp",
        description: "بحث علمي ذكي ونماذج إيلون ماسك غير المقيدة.",
        packages: [
            { id: "ai_perplexity_pro", name: "Perplexity Pro — 450 ج.م", duration: "شهر واحد", price: 450 },
            { id: "ai_super_grok", name: "Super Grok (xAI) — 980 ج.م", duration: "اشتراك رسمي", price: 980 }
        ]
    },
    {
        id: "muse_ai",
        name: "Muse AI",
        provider: "Muse الرسمي",
        category: "ai",
        badge: "مونتاج ذكي 🎬",
        banner: "museai.jpeg",
        description: "حساب كامل مخصص للإنتاج المرئي والمونتاج بالذكاء الاصطناعي.",
        packages: [
            { id: "ai_muse", name: "Muse AI (حساب كامل) — 140 ج.م", duration: "اشتراك كامل", price: 140 }
        ]
    }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { aiProducts };
} else {
  window.aiProducts = aiProducts;
}
