// ==============================================================================
// ملف 3: تطبيقات البث المباشر والدردشة (8 تطبيقات) وعملات تيك توك ونجوم تليجرام
// ==============================================================================

const liveAndCoinsData = {
  streamingApps: [
    {
      id: "bigolive",
      name: "بيجو لايف (Bigo Live)",
      badge: "⭐ شحن بالـ ID",
      requireZone: false,
      packages: [
        { name: "باقة جواهر بيجو الأساسية", price: 100 }
      ]
    },
    {
      id: "bubolive",
      name: "بوبو لايف (Bubo Live)",
      badge: "🎥 شحن فوري",
      requireZone: false,
      packages: [
        { name: "عملات بوبو لايف", price: 100 }
      ]
    },
    {
      id: "tangolive",
      name: "تانجو لايف (Tango Live)",
      badge: "🌟 جواهر تانجو",
      requireZone: false,
      packages: [
        { name: "جواهر تانجو لايف", price: 100 }
      ]
    },
    {
      id: "likee",
      name: "لايكي (Likee)",
      badge: "💎 الماس لايكي",
      requireZone: false,
      packages: [
        { name: "الماس لايكي", price: 100 }
      ]
    },
    {
      id: "chamet",
      name: "تشاميت (Chamet)",
      badge: "💬 شحن بالـ ID",
      requireZone: false,
      packages: [
        { name: "رصيد تشاميت", price: 100 }
      ]
    },
    {
      id: "yallaludo",
      name: "يلا لودو (Yalla Ludo)",
      badge: "🎲 جواهر وخدمات لودو",
      requireZone: false,
      packages: [
        { name: "جواهر يلا لودو", price: 100 }
      ]
    },
    {
      id: "sugo",
      name: "سوجو (SuGO)",
      badge: "🎤 غرف الصوت",
      requireZone: false,
      packages: [
        { name: "عملات سوجو", price: 100 }
      ]
    },
    {
      id: "mico",
      name: "ميو (Mico)",
      badge: "🌍 دردشة وبث",
      requireZone: false,
      packages: [
        { name: "عملات ميو", price: 100 }
      ]
    }
  ],
  coinsAndStars: [
    {
      id: "tiktok_coins",
      name: "عملات تيك توك (TikTok Coins)",
      badge: "🎵 شحن فوري",
      packages: [
        { name: "70 كوينز", price: 50 },
        { name: "350 كوينز", price: 240 },
        { name: "700 كوينز", price: 480 },
        { name: "1400 كوينز", price: 950 }
      ]
    },
    {
      id: "telegram_stars",
      name: "نجوم تليجرام (Telegram Stars)",
      badge: "⭐ نجوم رسمية",
      packages: [
        { name: "50 نجمة", price: 60 },
        { name: "100 نجمة", price: 120 },
        { name: "250 نجمة", price: 300 },
        { name: "500 نجمة", price: 580 }
      ]
    }
  ]
};
