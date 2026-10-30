// ==============================================================================
// Migo AI Solution - subscriptions.js
// قاعدة بيانات الاشتراكات والبرامج الشاملة (جميع الخدمات القديمة والجديدة)
// ==============================================================================

const subscriptionsData = [
  // --- 2. برامج التصميم والإنتاجية (Design & Productivity) ---
  {
    id: "adobe_cc",
    name: "Adobe Creative Cloud",
    provider: "Adobe الرسمي",
    category: "design",
    badge: "الحزمة الشاملة 🎨",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/6f07d686124444b4a7f5487f8988e9ae.png",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/8c72b04b9a2049a7a88e9215f126bce4.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/9d53751c9b344e0da71a2c4ea6a9d675.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/7aa52bc207244312a28617412c89bfb6.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/1008505ac2b14334999a0b5badb07b64.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/33b05b0ed9c947f8ae26816445926ce5.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/697eabf0f5d140dbb3f4a85cd3cc9b88.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/2c44165f2ad54ed194492913ef003747.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/fdba027716f347fa92f65663291f1990.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/4287af7b2cb3431fb594e8a82c82b8cd.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/0f85ae8c477b46bbb6ccad4fe547613f.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b3a952c56c944e188f49bbe9a36a893d.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/2ce38f6791624306a8e128cb94a3e328.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/e3138241574f4b93a96cbdae6a4c866f.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/1dd3cdf4551948598ca2d92efa484127.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/55efadcce9fd41c788fd34ab9be94f8b.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/ea18110bdad54f1dbb7215ba0b6a37ba.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c8f26e7868124783a48e14c69a8d3734.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/91073fbe96f4448a8a7cf90fc4727396.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/451aedb7788344e39ccdaf7a9616d403.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/56174c34f4aa4d289b661553d54e7c40.webp",
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
