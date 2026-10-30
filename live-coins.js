// ==============================================================================
// Migo AI Solution - live-coins.js
// قاعدة بيانات تطبيقات البث والعملات والنجوم - مطابقة 100% للمتجر الحي
// ==============================================================================

// 1. باقات كوينز تيك توك الرسمية بالجنيه المصري (مع البانر المخصص)
const tiktokCoinsList = {
  banner: "images (6).jpeg",
  packages: [
    { coins: 100, price: 95 },
    { coins: 300, price: 235 },
    { coins: 500, price: 381 },
    { coins: 1000, price: 717 },
    { coins: 1500, price: 1075 },
    { coins: 2500, price: 1792 },
    { coins: 3500, price: 2509 },
    { coins: 5000, price: 3584 },
    { coins: 10000, price: 7168 },
    { coins: 15000, price: 10752 },
    { coins: 30000, price: 21504 },
    { coins: 50000, price: 35840 },
    { coins: 100000, price: 71680 }
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

// 3. تطبيقات البث المباشر الـ 6 المعتمدة بالبانرات المحلية المطابقة للمستودع تماماً (مع تصحيح الأسعار الحقيقية)
const liveCoinsData = [
  {
    id: "bigo",
    name: "BIGO Live",
    provider: "شحن بالـ ID",
    banner: "bigolive.png",
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
    banner: "chamet.jpeg",
    badge: "تسليم فوري بالمعرّف ⚡",
    hasZoneId: false,
    apiServiceId: "chamet",
    idPlaceholder: "أدخل معرّف حساب Chamet ID",
    packages: [
      { id: "chamet_4500", name: "4500 Diamonds", price: 120 },
      { id: "chamet_9000", name: "9000 Diamonds", price: 240 },
      { id: "chamet_22500", name: "22500 Diamonds", price: 580 },
      { id: "chamet_45000", name: "45000 Diamonds", price: 1150 }
    ]
  },
  {
    id: "poppo",
    name: "Poppo Live",
    provider: "شحن فوري بالمعرف",
    banner: "poppoplive.jpeg",
    badge: "شحن فوري ⚡",
    hasZoneId: false,
    apiServiceId: "poppo_live",
    idPlaceholder: "أدخل معرف Poppo ID",
    packages: [
      { id: "poppo_7000", name: "7000 Coins", price: 45 },
      { id: "poppo_14000", name: "14000 Coins", price: 90 },
      { id: "poppo_35000", name: "35000 Coins", price: 220 },
      { id: "poppo_70000", name: "70000 Coins", price: 440 },
      { id: "poppo_140000", name: "140000 Coins", price: 880 }
    ]
  },
  {
    id: "yallaludo",
    name: "Yalla Ludo (يلا لودو)",
    provider: "يلا لودو الرسمي",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/e3281d94ce634af8a7743d9f5094dc15.webp",
    badge: "شحن ماسات فوري ⚡",
    hasZoneId: false,
    apiServiceId: "yalla_ludo",
    idPlaceholder: "أدخل معرّف يلا لودو (User ID)",
    packages: [
      { id: "yl_50", name: "50 Diamonds", price: 60 },
      { id: "yl_250", name: "250 Diamonds", price: 290 },
      { id: "yl_500", name: "500 Diamonds", price: 580 },
      { id: "yl_1000", name: "1000 Diamonds", price: 1150 },
      { id: "yl_2500", name: "2500 Diamonds", price: 2850 }
    ]
  },
  {
    id: "sugo",
    name: "SUGO (سوجو)",
    provider: "سوجو الرسمي",
    banner: "sugo.png",
    badge: "تسليم فوري ⚡",
    hasZoneId: false,
    apiServiceId: "sugo",
    idPlaceholder: "أدخل معرّف الحساب (Sugo ID)",
    packages: [
      { id: "sugo_42", name: "42 Coins", price: 48 },
      { id: "sugo_297", name: "297 Coins", price: 340 },
      { id: "sugo_848", name: "848 Coins", price: 980 },
      { id: "sugo_3818", name: "3818 Coins", price: 4400 }
    ]
  },
  {
    id: "meyo",
    name: "MeYo (ميو)",
    provider: "ميو الرسمي",
    banner: "meyo.jpeg",
    badge: "تسليم فوري ⚡",
    hasZoneId: false,
    apiServiceId: "meyo",
    idPlaceholder: "أدخل معرّف الحساب (MeYo ID)",
    packages: [
      { id: "meyo_42", name: "42 Coins", price: 48 },
      { id: "meyo_297", name: "297 Coins", price: 340 },
      { id: "meyo_848", name: "848 Coins", price: 980 },
      { id: "meyo_3818", name: "3818 Coins", price: 4400 }
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
