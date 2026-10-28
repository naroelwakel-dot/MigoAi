// ==============================================================================
// Migo AI Solution - live-coins.js
// قاعدة بيانات تطبيقات البث والعملات والنجوم - مطابقة 100% للمتجر الحي
// ==============================================================================

// 1. باقات كوينز تيك توك الرسمية بالجنيه المصري (مع البانر المخصص)
const tiktokCoinsList = {
  banner: "images (6).jpeg",
  packages: [
    { coins: 70, price: 65 },
    { coins: 350, price: 325 },
    { coins: 700, price: 650 },
    { coins: 1400, price: 1300 },
    { coins: 3500, price: 3250 },
    { coins: 7000, price: 6500 },
    { coins: 17500, price: 16250 }
  ]
};

// 2. باقات نجوم تليجرام الرسمية بالجنيه المصري (مع البانر المخصص)
const telegramStarsList = {
  banner: "telegram.jpeg",
  packages: [
    { stars: 50, price: 55 },
    { stars: 100, price: 110 },
    { stars: 150, price: 165 },
    { stars: 250, price: 275 },
    { stars: 500, price: 550 },
    { stars: 1000, price: 1100 },
    { stars: 2500, price: 2750 }
  ]
};

// 3. تطبيقات البث المباشر الـ 6 المعتمدة بكامل باقاتها وبانراتها
const liveCoinsData = [
  {
    id: "bigo",
    name: "BIGO Live",
    provider: "شحن بالـ ID",
    banner: "https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "bigo_live",
    idPlaceholder: "أدخل معرّف BIGO ID",
    packages: [
      { id: "bigo_42", name: "42 Diamonds", price: 52 },
      { id: "bigo_297", name: "297 Diamonds", price: 370 },
      { id: "bigo_848", name: "848 Diamonds", price: 1050 },
      { id: "bigo_3818", name: "3818 Diamonds", price: 4750 }
    ]
  },
  {
    id: "chamet",
    name: "Chamet",
    provider: "تسليم فوري",
    banner: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري بالمعرّف ⚡",
    hasZoneId: false,
    apiServiceId: "chamet",
    idPlaceholder: "أدخل معرّف حساب Chamet ID",
    packages: [
      { id: "chamet_4500", name: "4500 Diamonds", price: 52 },
      { id: "chamet_9000", name: "9000 Diamonds", price: 105 },
      { id: "chamet_22500", name: "22500 Diamonds", price: 265 },
      { id: "chamet_45000", name: "45000 Diamonds", price: 530 }
    ]
  },
  {
    id: "poppo",
    name: "Poppo Live",
    provider: "شحن فوري بالمعرف",
    banner: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن فوري ⚡",
    hasZoneId: false,
    apiServiceId: "poppo_live",
    idPlaceholder: "أدخل معرف Poppo ID",
    packages: [
      { id: "poppo_7000", name: "7000 Coins", price: 52 },
      { id: "poppo_14000", name: "14000 Coins", price: 105 },
      { id: "poppo_35000", name: "35000 Coins", price: 265 },
      { id: "poppo_70000", name: "70000 Coins", price: 530 },
      { id: "poppo_140000", name: "140000 Coins", price: 1050 }
    ]
  },
  {
    id: "yallaludo",
    name: "Yalla Ludo (يلا لودو)",
    provider: "يلا لودو الرسمي",
    banner: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن ماسات فوري ⚡",
    hasZoneId: false,
    apiServiceId: "yalla_ludo",
    idPlaceholder: "أدخل معرّف يلا لودو (User ID)",
    packages: [
      { id: "yl_50", name: "50 Diamonds", price: 52 },
      { id: "yl_250", name: "250 Diamonds", price: 265 },
      { id: "yl_500", name: "500 Diamonds", price: 530 },
      { id: "yl_1000", name: "1000 Diamonds", price: 1050 },
      { id: "yl_2500", name: "2500 Diamonds", price: 2650 }
    ]
  },
  {
    id: "sugo",
    name: "SUGO (سوجو)",
    provider: "سوجو الرسمي",
    banner: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري ⚡",
    hasZoneId: false,
    apiServiceId: "sugo",
    idPlaceholder: "أدخل معرّف الحساب (Sugo ID)",
    packages: [
      { id: "sugo_42", name: "42 Coins", price: 52 },
      { id: "sugo_297", name: "297 Coins", price: 370 },
      { id: "sugo_848", name: "848 Coins", price: 1050 },
      { id: "sugo_3818", name: "3818 Coins", price: 4750 }
    ]
  },
  {
    id: "meyo",
    name: "MeYo (ميو)",
    provider: "ميو الرسمي",
    banner: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري ⚡",
    hasZoneId: false,
    apiServiceId: "meyo",
    idPlaceholder: "أدخل معرّف الحساب (MeYo ID)",
    packages: [
      { id: "meyo_42", name: "42 Coins", price: 52 },
      { id: "meyo_297", name: "297 Coins", price: 370 },
      { id: "meyo_848", name: "848 Coins", price: 1050 },
      { id: "meyo_3818", name: "3818 Coins", price: 4750 }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { tiktokCoinsList, telegramStarsList, liveCoinsData };
} else {
  window.tiktokCoinsList = tiktokCoinsList;
  window.telegramStarsList = telegramStarsList;
  window.liveCoinsData = liveCoinsData;
}
