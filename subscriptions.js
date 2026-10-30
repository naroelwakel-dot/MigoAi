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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c92f1e4493084dc78b3f3ad926b6b0d9.svg",
    description: "حساب رسمي ببريد خاص Gmail NW لتفعيل فوري وآمن.",
    packages: [
      { id: "chatgpt_1m", name: "شهر واحد — 747 ج.م", duration: "شهر واحد", price: 747 },
      { id: "chatgpt_plus_1m", name: "ChatGPT Plus 1M (باقة خاصة) — 890 ج.م", duration: "شهر واحد", price: 890 }
    ]
  },
  {
    id: "chatgpt_api_codex",
    name: "ChatGPT / API Codex",
    provider: "OpenAI Developer",
    category: "ai",
    badge: "باقات المطورين ⚡",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c92f1e4493084dc78b3f3ad926b6b0d9.svg",
    description: "باقات API المتقدمة لتشغيل الأكواد والذكاء الاصطناعي.",
    packages: [
      { id: "codex_50m", name: "API CODEX 50M T 2D — 370 ج.م", duration: "يومان", price: 370 },
      { id: "codex_100m", name: "API CODEX 100M T 3D — 240 ج.م", duration: "3 أيام", price: 240 }
    ]
  },
  {
    id: "claude_ai_api",
    name: "Claude AI (API Packages)",
    provider: "Anthropic الرسمي",
    category: "ai",
    badge: "قوة تحليلية فائقة 🧠",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/100ac4a7db2c447ba6f9de54488d22cf.webp",
    description: "باقات رصيد ومفاتيح API لنموذج Claude المتقدم.",
    packages: [
      { id: "claude_10m_1d", name: "API CLAUDE 10M t 1D — 138 ج.م", duration: "يوم واحد", price: 138 },
      { id: "claude_50m_2d", name: "API Claude 50M T 2D — 168 ج.م", duration: "يومان", price: 168 },
      { id: "claude_100s_30d", name: "100$ API Claude 30D — 281 ج.م", duration: "30 يوماً", price: 281 },
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
      { id: "gemini_18m", name: "Gemini AI Pro — 18 شهر — 281 ج.م", duration: "18 شهر", price: 281 },
      { id: "gemini_ai_pro_12m", name: "Google AI Pro — 12 شهر (FW) — 63 ج.م", duration: "12 شهر (FW)", price: 63 },
      { id: "gemini_ai_plus_3m", name: "Google AI Plus — 3 شهور (FW) — 41 ج.م", duration: "3 شهور (FW)", price: 41 }
    ]
  },
  {
    id: "super_grok",
    name: "Super Grok",
    provider: "xAI الرسمي",
    category: "ai",
    badge: "أحدث إصدار ⚡",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/03f5b628901b449db08f2324c261591c.webp",
    description: "أحدث نموذج ذكاء اصطناعي فائق الذكاء من منصة xAI.",
    packages: [
      { id: "grok_7d", name: "7 أيام — 232 ج.م", duration: "7 أيام", price: 232 }
    ]
  },
  {
    id: "elevenlabs",
    name: "Elevenlabs Credits",
    provider: "Elevenlabs الرسمي",
    category: "ai",
    badge: "صوتيات احترافية 🎙️",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/529ca13527f64a13a3be22f9877b1a49.webp",
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
      { id: "capcut_7d", name: "7 أيام — 62 ج.م", duration: "7 أيام", price: 62 },
      { id: "capcut_1m", name: "شهر واحد — 187 ج.م", duration: "شهر واحد", price: 187 },
      { id: "capcut_credits", name: "CapCut PRO 1600 CREDITS — 249 ج.م", duration: "رصيد رويال", price: 249 }
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
      { id: "lovable_12m", name: "12 شهر (سنة) — 608 ج.م", duration: "سنة واحدة", price: 608 }
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
      { id: "framer_1y", name: "سنة واحدة (Framer AI 1Y) — 439 ج.م", duration: "سنة واحدة", price: 439 }
    ]
  },
  {
    id: "muse_ai",
    name: "Muse AI",
    provider: "Muse الرسمي",
    category: "ai",
    badge: "ذكاء اصطناعي متقدم 🧠",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/184bc93a2e234e0a9dc3202ccf8b9b48.webp",
    description: "مساعد فيديو ووسائط متقدم مدعوم بنماذج الذكاء الاصطناعي.",
    packages: [
      { id: "muse_full", name: "اشتراك كامل — 126 ج.م", duration: "اشتراك كامل", price: 126 }
    ]
  },

  // --- 2. برامج التصميم والإنتاجية (Design & Productivity) ---
  {
    id: "adobe_cc",
    name: "Adobe Creative Cloud",
    provider: "Adobe الرسمي",
    category: "design",
    badge: "الحزمة الشاملة 🎨",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c7a2727caff84a7c817fba117db722f0.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/8b753d99ae234bcd9cfc240b31b2a501.png",
    description: "رابط تفعيل رسمي مباشر لإنشاء تصاميم السوشيال ميديا بسرعة.",
    packages: [
      { id: "adobe_exp_12m", name: "12 شهر (Adobe Express 12M) — 107 ج.م", duration: "12 شهر", price: 107 }
    ]
  },
  {
    id: "figma_pro",
    name: "Figma Pro Edu",
    provider: "Figma الرسمي",
    category: "design",
    badge: "تصميم واجهات UI/UX 📐",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/de174b6d7b5f45c1a08e97f448f304c5.svg",
    description: "خطة سنتين مع رصيد لتصميم المواقع والتطبيقات.",
    packages: [
      { id: "figma_2y", name: "Figma Pro Edu 2yrs — 314 ج.م", duration: "سنتان", price: 314 }
    ]
  },
  {
    id: "canva_pro",
    name: "Canva Pro",
    provider: "Canva الرسمي",
    category: "design",
    badge: "الأكثر مبيعاً 🖌️",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/e7762a1448a842cfa100a6ec0abf95ee.png",
    description: "خيارات متعددة للتفعيل لفتح كافة الميزات والقوالب المدفوعة.",
    packages: [
      { id: "canva_2yrs", name: "Canva Pro 2 yrs — 56 ج.م", duration: "سنتان", price: 56 },
      { id: "canva_2y_fw", name: "سنتان (FW) — 119 ج.م", duration: "سنتان (FW)", price: 119 },
      { id: "canva_1m_pers", name: "شهر شخصي — 119 ج.م", duration: "شهر شخصي", price: 119 },
      { id: "canva_admin", name: "حساب Admin — 313 ج.م", duration: "حساب Admin", price: 313 },
      { id: "canva_pro_inv_1y", name: "Canva Pro Invitation — سنة (Full) — 439 ج.م", duration: "سنة (Invitation Full)", price: 439 },
      { id: "canva_edu_inv_1y", name: "Canva Education Invitation — سنة — 4 ج.م", duration: "سنة (Education)", price: 4 },
      { id: "canva_edu_admin_500", name: "Canva Edu Admin — 500 دعوة — 313 ج.م", duration: "Edu Admin (500 دعوة)", price: 313 }
    ]
  },
  {
    id: "notion_plus",
    name: "Notion Plus",
    provider: "Notion Labs",
    category: "productivity",
    badge: "إدارة المشاريع 📖",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/af6f9a608e9e4ceba231b0caedbc5f96.svg",
    description: "إدارة المهام والملاحظات وقواعد البيانات باحترافية تامة.",
    packages: [
      { id: "notion_1y", name: "Notion Plus 12M — 124 ج.م", duration: "سنة واحدة", price: 124 },
      { id: "notion_biz_coupon_3m", name: "Notion Business Coupon — 3 شهور — 68 ج.م", duration: "3 شهور", price: 68 }
    ]
  },
  {
    id: "ms_office_365",
    name: "Microsoft Office 365",
    provider: "Microsoft الرسمي",
    category: "productivity",
    badge: "حزمة أوفيس كاملة 📊",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/03b29d161cfc422fa333ffb35e463417.webp",
    description: "جميع برامج أوفيس الرسمية (Word, Excel, PowerPoint) وتخزين سحابي.",
    packages: [
      { id: "office_1y", name: "Office 365 Plus 1year — 147 ج.م", duration: "سنة واحدة", price: 147 }
    ]
  },
  {
    id: "ilovepdf",
    name: "iLovePDF Premium",
    provider: "iLovePDF الرسمي",
    category: "productivity",
    badge: "أدوات PDF شاملة 📄",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/43a233e6b34c4ca5a1e978fe69e5a89e.png",
    description: "تعديل وتحويل ودمج وضغط ملفات الـ PDF بلا قيود.",
    packages: [
      { id: "ilovepdf_1y", name: "iLovePdf Premium 1Y — 94 ج.م", duration: "سنة واحدة", price: 94 }
    ]
  },
  {
    id: "linkedin_career",
    name: "LinkedIn Career",
    provider: "LinkedIn الرسمي",
    category: "productivity",
    badge: "تطوير مهني وتوظيف 💼",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/034e4c1e460345938ab2d8808cf14780.svg",
    description: "ترقية الحساب للحصول على ميزات التوظيف ودورات التعلم.",
    packages: [
      { id: "linkedin_3m", name: "3 أشهر — 168 ج.م", duration: "3 أشهر", price: 168 }
    ]
  },
  {
    id: "duolingo_super",
    name: "Duolingo Super",
    provider: "Duolingo الرسمي",
    category: "productivity",
    badge: "تعلم لغات 🗣️",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/d78b2cbd15994994b36703f413356a22.webp",
    description: "تعلم اللغات بدون إعلانات وبقلوب غير محدودة ومراجعة الأخطاء.",
    packages: [
      { id: "duolingo_12m", name: "12 شهر — 100 ج.م", duration: "12 شهر", price: 100 }
    ]
  },
  {
    id: "miro_panel",
    name: "Miro Lifetime Panel",
    provider: "Miro الرسمي",
    category: "productivity",
    badge: "لوحة عمل مدى الحياة 📋",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/7aaf1d1b17e14defa5dd83f3b57a5cc5.webp",
    description: "لوحة عمل مرئية وتفاعلية للعصف الذهني والفرق ومدى الحياة.",
    packages: [
      { id: "miro_life", name: "Miro Lifetime Panel — 628 ج.م", duration: "مدى الحياة", price: 628 }
    ]
  },
  {
    id: "gmail_accounts",
    name: "حسابات Gmail جاهزة",
    provider: "Google الموثق",
    category: "productivity",
    badge: "حساب موثق ✉️",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/d89171ae3ea144f6b7ba09e29e84ecb7.webp",
    description: "حساب جاهز وموثق بالكامل للتسليم الفوري والاستخدام المباشر.",
    packages: [
      { id: "gmail_1acc", name: "Gmails Accounts — 50 ج.م", duration: "حساب دائم", price: 50 }
    ]
  },
  {
    id: "outlook_accounts",
    name: "حسابات Outlook / Hotmail",
    provider: "Microsoft الموثق",
    category: "productivity",
    badge: "تفعيل فوري 📭",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b7ab794e00a34eb1a44553ac187d5425.svg",
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
      { id: "shahid_7m", name: "Shahid VIP 7M — 144 ج.م", duration: "7 أشهر", price: 144 },
      { id: "shahid_1m", name: "شهر واحد — 205 ج.م", duration: "شهر واحد", price: 205 }
    ]
  },
  {
    id: "youtube_premium",
    name: "YouTube Premium",
    provider: "Google / YouTube",
    category: "entertainment",
    badge: "بدون إعلانات ▶️",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/cd96d463270d4b19907ad500617d444e.webp",
    description: "مشاهدة بدون فواصل إعلانية، تشغيل في الخلفية، واشتراك Music.",
    packages: [
      { id: "yt_1m", name: "شهر واحد — 82 ج.م", duration: "شهر واحد", price: 82 },
      { id: "yt_3m", name: "3 أشهر — 250 ج.م", duration: "3 أشهر", price: 250 }
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
      { id: "prime_6m", name: "Prime Video 6M — 251 ج.م", duration: "6 أشهر", price: 251 }
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
      { id: "apple_music_5m", name: "5 أشهر — 161 ج.م", duration: "5 أشهر", price: 161 }
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
      { id: "spotify_1m", name: "Spotify premium 1M — 94 ج.م", duration: "شهر واحد", price: 94 },
      { id: "spotify_3m_link", name: "3 أشهر (رابط) — 56 ج.م", duration: "3 أشهر (رابط)", price: 56 },
      { id: "spotify_1m_acc", name: "شهر واحد (حساب) — 125 ج.م", duration: "شهر واحد (حساب)", price: 125 }
    ]
  },
  {
    id: "netflix_premium",
    name: "Netflix Premium",
    provider: "Netflix الرسمي",
    category: "entertainment",
    badge: "حساب Admin بضمان 🎬",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/37dc17a54125435ca7797d4892c5d446.svg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b882c8ea8fe0466ab53cbdbb4dc70605.webp",
    description: "تصفح آمن وسريع مع خوادم عالمية فائقة السرعة.",
    packages: [
      { id: "express_1m", name: "ExpressVPN 1M — 100 ج.م", duration: "شهر واحد", price: 100 }
    ]
  },
  {
    id: "nordvpn",
    name: "NordVPN",
    provider: "NordVPN الرسمي",
    category: "productivity",
    badge: "حماية وVPN 🔒",
    banner: "",
    description: "اشتراك NordVPN لكود تفعيل ثلاث شهور.",
    packages: [
      { id: "nordvpn_coupon_3m", name: "NordVPN Coupon — 3 شهور — 154 ج.م", duration: "3 شهور (Coupon)", price: 154 },
      { id: "nordvpn_basic_3m", name: "NordVPN Basic — 3 شهور — 250 ج.م", duration: "3 شهور (Basic)", price: 250 }
    ]
  },
  {
    id: "coursera_premium",
    name: "Coursera Premium",
    provider: "Coursera",
    category: "productivity",
    badge: "تعلم وكورسات 📚",
    banner: "",
    description: "اشتراك Coursera Premium للوصول لكل الكورسات والشهادات.",
    packages: [
      { id: "coursera_12m", name: "Coursera Premium — 12 شهر — 250 ج.م", duration: "12 شهر", price: 250 }
    ]
  }
];

// إتاحة البيانات للواجهة
if (typeof module !== "undefined" && module.exports) {
  module.exports = { subscriptionsData };
} else {
  window.subscriptionsData = subscriptionsData;
}
