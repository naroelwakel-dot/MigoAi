// ==============================================================================
// Migo AI Solution - subscriptions.js
// قاعدة بيانات الاشتراكات والبرامج الشاملة (جميع الخدمات القديمة والجديدة)
// ==============================================================================

const subscriptionsData = [
  // --- 1. برامج وأدوات الذكاء الاصطناعي (AI Tools & APIs) ---
  {
    id: "chatgpt",
    name: "ChatGPT Plus",
    provider: "OpenAI الرسمي",
    category: "ai",
    badge: "الأكثر طلباً 🔥",
    banner: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
    description: "حساب رسمي ببريد خاص Gmail NW لتفعيل فوري وآمن.",
    packages: [
      { id: "chatgpt_1m", name: "شهر واحد — 835 ج.م", duration: "شهر واحد", price: 835 },
      { id: "chatgpt_plus_1m", name: "ChatGPT Plus 1M (باقة خاصة) — 890 ج.م", duration: "شهر واحد", price: 890 }
    ]
  },
  {
    id: "chatgpt_api_codex",
    name: "ChatGPT / API Codex",
    provider: "OpenAI Developer",
    category: "ai",
    badge: "باقات المطورين ⚡",
    banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    description: "باقات API المتقدمة لتشغيل الأكواد والذكاء الاصطناعي.",
    packages: [
      { id: "codex_50m", name: "API CODEX 50M T 2D — 140 ج.م", duration: "يومان", price: 140 },
      { id: "codex_100m", name: "API CODEX 100M T 3D — 240 ج.م", duration: "3 أيام", price: 240 }
    ]
  },
  {
    id: "claude_ai_api",
    name: "Claude AI (API Packages)",
    provider: "Anthropic الرسمي",
    category: "ai",
    badge: "قوة تحليلية فائقة 🧠",
    banner: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
    description: "باقات رصيد ومفاتيح API لنموذج Claude المتقدم.",
    packages: [
      { id: "claude_10m_1d", name: "API CLAUDE 10M t 1D — 56 ج.م", duration: "يوم واحد", price: 56 },
      { id: "claude_50m_2d", name: "API Claude 50M T 2D — 168 ج.م", duration: "يومان", price: 168 },
      { id: "claude_100s_30d", name: "100$ API Claude 30D — 112 ج.م", duration: "30 يوماً", price: 112 },
      { id: "claude_500s_30d", name: "500$ API Claude 30D — 336 ج.م", duration: "30 يوماً", price: 336 }
    ]
  },
  {
    id: "gemini_pro",
    name: "Google Gemini Pro",
    provider: "Google الرسمي",
    category: "ai",
    badge: "عرض حصري ⚡",
    banner: "Geminipro.png",
    description: "اشتراك رسمي متكامل مع وصول دائم لأحدث النماذج المتقدمة.",
    packages: [
      { id: "gemini_18m", name: "18 شهر — 245 ج.م", duration: "18 شهر", price: 245 }
    ]
  },
  {
    id: "super_grok",
    name: "Super Grok",
    provider: "xAI الرسمي",
    category: "ai",
    badge: "أحدث إصدار ⚡",
    banner: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80",
    description: "أحدث نموذج ذكاء اصطناعي فائق الذكاء من منصة xAI.",
    packages: [
      { id: "grok_7d", name: "7 أيام — 410 ج.م", duration: "7 أيام", price: 410 }
    ]
  },
  {
    id: "elevenlabs",
    name: "Elevenlabs Credits",
    provider: "Elevenlabs الرسمي",
    category: "ai",
    badge: "صوتيات احترافية 🎙️",
    banner: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
    description: "توليد أصوات بشرية طبيعية ومحاكاة النبرات بأعلى دقة.",
    packages: [
      { id: "eleven_10k", name: "رصيد 10k Credits — 110 ج.م", duration: "رصيد دائم", price: 110 }
    ]
  },
  {
    id: "capcut_pro",
    name: "CapCut Pro + AI",
    provider: "Bytedance / CapCut",
    category: "ai",
    badge: "مونتاج وذكاء اصطناعي 🎬",
    banner: "capcut.png",
    description: "مونتاج فيديو احترافي، إزالة خلفيات، وفلاتر ذكية بلا حدود.",
    packages: [
      { id: "capcut_7d", name: "7 أيام — 55 ج.م", duration: "7 أيام", price: 55 },
      { id: "capcut_1m", name: "شهر واحد — 84 ج.م", duration: "شهر واحد", price: 84 },
      { id: "capcut_credits", name: "CapCut PRO 1600 CREDITS — 112 ج.م", duration: "رصيد رويال", price: 112 }
    ]
  },
  {
    id: "lovable_pro",
    name: "Lovable Pro Lite",
    provider: "Lovable AI",
    category: "ai",
    badge: "تطوير ويب بالذكاء 💻",
    banner: "lovable.png",
    description: "بناء وتطوير تطبيقات ومواقع كاملة عبر الأوامر النصية المباشرة.",
    packages: [
      { id: "lovable_12m", name: "12 شهر (سنة) — 665 ج.م", duration: "سنة واحدة", price: 665 }
    ]
  },
  {
    id: "framer_ai",
    name: "Framer AI",
    provider: "Framer الرسمي",
    category: "ai",
    badge: "تصميم مواقع تفاعلية 🌐",
    banner: "framerai.jpg",
    description: "تصميم ونشر مواقع ويب حديثة وسريعة الاستجابة بالذكاء الاصطناعي.",
    packages: [
      { id: "framer_1y", name: "سنة واحدة (Framer AI 1Y) — 392 ج.م", duration: "سنة واحدة", price: 392 }
    ]
  },
  {
    id: "muse_ai",
    name: "Muse AI",
    provider: "Muse الرسمي",
    category: "ai",
    badge: "ذكاء اصطناعي متقدم 🧠",
    banner: "https://images.unsplash.com/photo-1534972195531-d756b9cfa9f2?auto=format&fit=crop&w=1200&q=80",
    description: "مساعد فيديو ووسائط متقدم مدعوم بنماذج الذكاء الاصطناعي.",
    packages: [
      { id: "muse_full", name: "اشتراك كامل — 140 ج.م", duration: "اشتراك كامل", price: 140 }
    ]
  },

  // --- 2. برامج التصميم والإنتاجية (Design & Productivity) ---
  {
    id: "adobe_cc",
    name: "Adobe Creative Cloud",
    provider: "Adobe الرسمي",
    category: "design",
    badge: "الحزمة الشاملة 🎨",
    banner: "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=1200&q=80",
    description: "جميع برامج أدوبي الرسمية مع تفعيل خاص واشتراكات مدعومة.",
    packages: [
      { id: "adobe_1m", name: "شهر واحد (خاص) — 699 ج.م", duration: "شهر واحد", price: 699 },
      { id: "adobe_3m", name: "3 شهور (خاص) — 1099 ج.م", duration: "3 شهور", price: 1099 },
      { id: "adobe_4m", name: "4 شهور (خاص) — 1399 ج.م", duration: "4 شهور", price: 1399 },
      { id: "adobe_5m", name: "5 شهور (خاص) — 1799 ج.م", duration: "5 شهور", price: 1799 },
      { id: "adobe_6m", name: "6 شهور (خاص) — 2199 ج.م", duration: "6 شهور", price: 2199 },
      { id: "adobe_shared_4m", name: "اشتراك Shared (جهاز واحد - 4 شهور) — 899 ج.م", duration: "4 شهور Shared", price: 899 }
    ]
  },
  {
    id: "adobe_express",
    name: "Adobe Express",
    provider: "Adobe الرسمي",
    category: "design",
    badge: "تفعيل رسمي مباشر ✒️",
    banner: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80",
    description: "رابط تفعيل رسمي مباشر لإنشاء تصاميم السوشيال ميديا بسرعة.",
    packages: [
      { id: "adobe_exp_12m", name: "12 شهر (Adobe Express 12M) — 34 ج.م", duration: "12 شهر", price: 34 }
    ]
  },
  {
    id: "figma_pro",
    name: "Figma Pro Edu",
    provider: "Figma الرسمي",
    category: "design",
    badge: "تصميم واجهات UI/UX 📐",
    banner: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80",
    description: "خطة سنتين مع رصيد لتصميم المواقع والتطبيقات.",
    packages: [
      { id: "figma_2y", name: "Figma Pro Edu 2yrs — 280 ج.م", duration: "سنتان", price: 280 }
    ]
  },
  {
    id: "canva_pro",
    name: "Canva Pro",
    provider: "Canva الرسمي",
    category: "design",
    badge: "الأكثر مبيعاً 🖌️",
    banner: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80",
    description: "خيارات متعددة للتفعيل لفتح كافة الميزات والقوالب المدفوعة.",
    packages: [
      { id: "canva_2yrs", name: "Canva Pro 2 yrs — 56 ج.م", duration: "سنتان", price: 56 },
      { id: "canva_2y_fw", name: "سنتان (FW) — 130 ج.م", duration: "سنتان (FW)", price: 130 },
      { id: "canva_1m_pers", name: "شهر شخصي — 130 ج.م", duration: "شهر شخصي", price: 130 },
      { id: "canva_admin", name: "حساب Admin — 345 ج.م", duration: "حساب Admin", price: 345 }
    ]
  },
  {
    id: "notion_plus",
    name: "Notion Plus",
    provider: "Notion Labs",
    category: "productivity",
    badge: "إدارة المشاريع 📖",
    banner: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80",
    description: "إدارة المهام والملاحظات وقواعد البيانات باحترافية تامة.",
    packages: [
      { id: "notion_1y", name: "Notion Plus 12M — 90 ج.م", duration: "سنة واحدة", price: 90 }
    ]
  },
  {
    id: "ms_office_365",
    name: "Microsoft Office 365",
    provider: "Microsoft الرسمي",
    category: "productivity",
    badge: "حزمة أوفيس كاملة 📊",
    banner: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
    description: "جميع برامج أوفيس الرسمية (Word, Excel, PowerPoint) وتخزين سحابي.",
    packages: [
      { id: "office_1y", name: "Office 365 Plus 1year — 28 ج.م", duration: "سنة واحدة", price: 28 }
    ]
  },
  {
    id: "ilovepdf",
    name: "iLovePDF Premium",
    provider: "iLovePDF الرسمي",
    category: "productivity",
    badge: "أدوات PDF شاملة 📄",
    banner: "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1200&q=80",
    description: "تعديل وتحويل ودمج وضغط ملفات الـ PDF بلا قيود.",
    packages: [
      { id: "ilovepdf_1y", name: "iLovePdf Premium 1Y — 56 ج.م", duration: "سنة واحدة", price: 56 }
    ]
  },
  {
    id: "linkedin_career",
    name: "LinkedIn Career",
    provider: "LinkedIn الرسمي",
    category: "productivity",
    badge: "تطوير مهني وتوظيف 💼",
    banner: "https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=1200&q=80",
    description: "ترقية الحساب للحصول على ميزات التوظيف ودورات التعلم.",
    packages: [
      { id: "linkedin_3m", name: "3 أشهر — 185 ج.م", duration: "3 أشهر", price: 185 }
    ]
  },
  {
    id: "duolingo_super",
    name: "Duolingo Super",
    provider: "Duolingo الرسمي",
    category: "productivity",
    badge: "تعلم لغات 🗣️",
    banner: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=1200&q=80",
    description: "تعلم اللغات بدون إعلانات وبقلوب غير محدودة ومراجعة الأخطاء.",
    packages: [
      { id: "duolingo_12m", name: "12 شهر — 110 ج.م", duration: "12 شهر", price: 110 }
    ]
  },
  {
    id: "miro_panel",
    name: "Miro Lifetime Panel",
    provider: "Miro الرسمي",
    category: "productivity",
    badge: "لوحة عمل مدى الحياة 📋",
    banner: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80",
    description: "لوحة عمل مرئية وتفاعلية للعصف الذهني والفرق ومدى الحياة.",
    packages: [
      { id: "miro_life", name: "Miro Lifetime Panel — 560 ج.م", duration: "مدى الحياة", price: 560 }
    ]
  },
  {
    id: "gmail_accounts",
    name: "حسابات Gmail جاهزة",
    provider: "Google الموثق",
    category: "productivity",
    badge: "حساب موثق ✉️",
    banner: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=1200&q=80",
    description: "حساب جاهز وموثق بالكامل للتسليم الفوري والاستخدام المباشر.",
    packages: [
      { id: "gmail_1acc", name: "Gmails Accounts — 45 ج.م", duration: "حساب دائم", price: 45 }
    ]
  },
  {
    id: "outlook_accounts",
    name: "حسابات Outlook / Hotmail",
    provider: "Microsoft الموثق",
    category: "productivity",
    badge: "تفعيل فوري 📭",
    banner: "https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=1200&q=80",
    description: "حساب مايكروسوفت رسمي جاهز وموثق للتسليم الفوري.",
    packages: [
      { id: "outlook_1acc", name: "Emails Outlook/hotmail — 6 ج.م", duration: "حساب دائم", price: 6 }
    ]
  },

  // --- 3. خدمات البث والترفيه (Entertainment & Streaming) ---
  {
    id: "shahid_vip",
    name: "شاهد VIP",
    provider: "MBC / Shahid الرسمي",
    category: "entertainment",
    badge: "بث ترفيهي عربي 📺",
    banner: "shahidvib.webp",
    description: "اشتراك رسمي لمتابعة أحدث الأعمال والمسلسلات العربية الحصرية.",
    packages: [
      { id: "shahid_7m", name: "Shahid VIP 7M — 129 ج.م", duration: "7 أشهر", price: 129 },
      { id: "shahid_1m", name: "شهر واحد — 205 ج.م", duration: "شهر واحد", price: 205 }
    ]
  },
  {
    id: "youtube_premium",
    name: "YouTube Premium",
    provider: "Google / YouTube",
    category: "entertainment",
    badge: "بدون إعلانات ▶️",
    banner: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1200&q=80",
    description: "مشاهدة بدون فواصل إعلانية، تشغيل في الخلفية، واشتراك Music.",
    packages: [
      { id: "yt_1m", name: "شهر واحد — 115 ج.م", duration: "شهر واحد", price: 115 },
      { id: "yt_3m", name: "3 أشهر — 275 ج.م", duration: "3 أشهر", price: 275 }
    ]
  },
  {
    id: "prime_video",
    name: "Amazon Prime Video",
    provider: "Amazon الرسمي",
    category: "entertainment",
    badge: "أفلام ومسلسلات 🍿",
    banner: "amazonvideo.jpeg",
    description: "مكتبة سينمائية ضخمة بجودة 4K على حساب رسمي ومضمون.",
    packages: [
      { id: "prime_6m", name: "Prime Video 6M — 224 ج.م", duration: "6 أشهر", price: 224 }
    ]
  },
  {
    id: "apple_music",
    name: "Apple Music",
    provider: "Apple الرسمي",
    category: "entertainment",
    badge: "صوت مكاني فائق 🎧",
    banner: "apallemusic.jpeg",
    description: "استماع لملايين المقاطع الموسيقية بنقاء Spatial Audio وبدون إعلانات.",
    packages: [
      { id: "apple_music_5m", name: "5 أشهر — 175 ج.م", duration: "5 أشهر", price: 175 }
    ]
  },
  {
    id: "spotify_premium",
    name: "Spotify Premium",
    provider: "Spotify الرسمي",
    category: "entertainment",
    badge: "موسيقى بدون قيود 🎵",
    banner: "spotify.png",
    description: "استماع وتحميل بلا اتصال بالإنترنت وتخطي لا محدود للمسارات.",
    packages: [
      { id: "spotify_1m", name: "Spotify premium 1M — 84 ج.م", duration: "شهر واحد", price: 84 },
      { id: "spotify_3m_link", name: "3 أشهر (رابط) — 60 ج.م", duration: "3 أشهر (رابط)", price: 60 },
      { id: "spotify_1m_acc", name: "شهر واحد (حساب) — 140 ج.م", duration: "شهر واحد (حساب)", price: 140 }
    ]
  },
  {
    id: "netflix_premium",
    name: "Netflix Premium",
    provider: "Netflix الرسمي",
    category: "entertainment",
    badge: "حساب Admin بضمان 🎬",
    banner: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=1200&q=80",
    description: "حساب مسؤول Admin رسمي كامل بدقة Ultra HD 4K مع ضمان الاستمرارية.",
    packages: [
      { id: "netflix_full", name: "حساب كامل — 310 ج.م", duration: "حساب كامل", price: 310 }
    ]
  },

  // --- 4. خدمات الحماية والـ VPN ---
  {
    id: "express_vpn",
    name: "ExpressVPN",
    provider: "ExpressVPN الرسمي",
    category: "productivity",
    badge: "حماية فائقة 🔒",
    banner: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80",
    description: "تصفح آمن وسريع مع خوادم عالمية فائقة السرعة.",
    packages: [
      { id: "express_1m", name: "ExpressVPN 1M — 90 ج.م", duration: "شهر واحد", price: 90 }
    ]
  }
];

// إتاحة البيانات للواجهة
if (typeof module !== "undefined" && module.exports) {
  module.exports = { subscriptionsData };
} else {
  window.subscriptionsData = subscriptionsData;
}
