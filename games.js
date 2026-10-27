// ==============================================================================
// Migo AI Solution - games.js
// قاعدة بيانات الألعاب الـ 16 المعتمدة بالكامل - مطابقة 100% للمتجر الحي
// ==============================================================================

const gamesData = [
  {
    id: "pubg",
    name: "بابجي موبايل (PUBG)",
    provider: "Midasbuy الرسمي",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "pubg_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    packages: [
      { id: "pubg_60", name: "60 UC", price: 62 },
      { id: "pubg_325", name: "325 UC", price: 310 },
      { id: "pubg_660", name: "660 UC", price: 620 },
      { id: "pubg_1800", name: "1800 UC", price: 1550 },
      { id: "pubg_3850", name: "3850 UC", price: 3100 },
      { id: "pubg_8100", name: "8100 UC", price: 6200 }
    ]
  },
  {
    id: "roblox",
    name: "روبلوكس (Roblox)",
    provider: "Codashop / Razer",
    banner: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "roblox",
    idPlaceholder: "أدخل معرّف أو اسم المستخدم",
    packages: [
      { id: "rbx_80", name: "80 Robux", price: 62 },
      { id: "rbx_400", name: "400 Robux", price: 310 },
      { id: "rbx_800", name: "800 Robux", price: 620 },
      { id: "rbx_1700", name: "1700 Robux", price: 1240 }
    ]
  },
  {
    id: "freefire",
    name: "فري فاير (Free Fire)",
    provider: "تسليم فوري بالـ ID",
    banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "free_fire",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    packages: [
      { id: "ff_110", name: "110 Diamonds", price: 55 },
      { id: "ff_231", name: "231 Diamonds", price: 110 },
      { id: "ff_583", name: "583 Diamonds", price: 265 },
      { id: "ff_1188", name: "1188 Diamonds", price: 530 },
      { id: "ff_2420", name: "2420 Diamonds", price: 1050 }
    ]
  },
  {
    id: "clashofclans",
    name: "كلاش أوف كلانس (Clash of Clans)",
    provider: "Supercell الرسمي",
    banner: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن آمن بالـ Tag ⚡",
    hasZoneId: false,
    apiServiceId: "clash_of_clans",
    idPlaceholder: "أدخل علامة اللاعب (Player Tag مثل #XXXXXX)",
    packages: [
      { id: "coc_80", name: "80 جواهر", price: 60 },
      { id: "coc_500", name: "500 جواهر", price: 285 },
      { id: "coc_1200", name: "1200 جواهر", price: 570 },
      { id: "coc_pass", name: "تذكرة ذهبية Gold Pass", price: 430 }
    ]
  },
  {
    id: "fcmobile",
    name: "فيفا موبايل (FC Mobile)",
    provider: "EA Sports",
    banner: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "fc_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (UID)",
    packages: [
      { id: "fc_40", name: "40 FC Points", price: 35 },
      { id: "fc_100", name: "100 FC Points", price: 88 },
      { id: "fc_small", name: "حزمة صغيرة (إضافية)", price: 115 },
      { id: "fc_med", name: "حزمة متوسطة (إضافية)", price: 230 },
      { id: "fc_big", name: "حزمة كبيرة (إضافية)", price: 345 }
    ]
  },
  {
    id: "brawlstars",
    name: "براول ستارز (Brawl Stars)",
    provider: "Supercell ID",
    banner: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن فوري بالـ Tag ⚡",
    hasZoneId: false,
    apiServiceId: "brawl_stars",
    idPlaceholder: "أدخل Player Tag",
    packages: [
      { id: "bs_30", name: "30 جواهر", price: 115 },
      { id: "bs_80", name: "80 جواهر", price: 285 },
      { id: "bs_170", name: "170 جواهر", price: 570 },
      { id: "bs_pass", name: "Brawl Pass الفوري", price: 530 }
    ]
  },
  {
    id: "genshin",
    name: "جينشين إمباكت (Genshin Impact)",
    provider: "Codashop المعتمد",
    banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    badge: "يتطلب اختيار السيرفر 🌐",
    hasZoneId: true,
    zoneLabel: "اختر السيرفر (Server)",
    zoneOptions: ["Asia", "America", "Europe", "TW/HK/MO"],
    apiServiceId: "genshin_impact",
    idPlaceholder: "أدخل معرّف اللعبة (UID)",
    packages: [
      { id: "gi_60", name: "60 كريستال", price: 62 },
      { id: "gi_330", name: "300+30 كريستال", price: 310 },
      { id: "gi_moon", name: "بركة القمر (Welkin Moon)", price: 305 },
      { id: "gi_1090", name: "980+110 كريستال", price: 950 }
    ]
  },
  {
    id: "mlbb",
    name: "موبايل ليجندز (MLBB)",
    provider: "تسليم فوري",
    banner: "https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=80",
    badge: "يتطلب Zone ID 🎯",
    hasZoneId: true,
    zoneLabel: "معرّف السيرفر (Zone ID)",
    zonePlaceholder: "مثال: 1234",
    apiServiceId: "mobile_legends",
    idPlaceholder: "أدخل معرّف اللاعب (User ID)",
    packages: [
      { id: "ml_86", name: "86 Diamonds", price: 55 },
      { id: "ml_172", name: "172 Diamonds", price: 110 },
      { id: "ml_257", name: "257 Diamonds", price: 160 },
      { id: "ml_706", name: "706 Diamonds", price: 425 }
    ]
  },
  {
    id: "codm",
    name: "كول أوف ديوتي (CODM)",
    provider: "Activision",
    banner: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن CP فوري ⚡",
    hasZoneId: false,
    apiServiceId: "cod_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    packages: [
      { id: "cod_80", name: "80 CP", price: 62 },
      { id: "cod_420", name: "420 CP", price: 265 },
      { id: "cod_880", name: "880 CP", price: 530 },
      { id: "cod_2400", name: "2400 CP", price: 1250 }
    ]
  },
  {
    id: "valorant",
    name: "فالورانت (VALORANT)",
    provider: "Riot Games",
    banner: "https://images.unsplash.com/photo-1624138784614-87fd1b6528f8?auto=format&fit=crop&w=1200&q=80",
    badge: "نقاط فالورانت VP ⚡",
    hasZoneId: false,
    apiServiceId: "valorant",
    idPlaceholder: "أدخل Riot ID مع التاج (Name#TAG)",
    packages: [
      { id: "val_475", name: "475 VP", price: 160 },
      { id: "val_1000", name: "1000 VP", price: 315 },
      { id: "val_2050", name: "2050 VP", price: 630 },
      { id: "val_3650", name: "3650 VP", price: 1050 }
    ]
  },
  {
    id: "fortnite",
    name: "فورتنايت (Fortnite)",
    provider: "Epic Games",
    banner: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن فيبوكس V-Bucks ⚡",
    hasZoneId: false,
    apiServiceId: "fortnite",
    idPlaceholder: "أدخل Epic Account ID",
    packages: [
      { id: "fn_1000", name: "1000 V-Bucks", price: 315 },
      { id: "fn_2800", name: "2800 V-Bucks", price: 790 },
      { id: "fn_5000", name: "5000 V-Bucks", price: 1250 }
    ]
  },
  {
    id: "wildrift",
    name: "وايلد ريفت (LoL Wild Rift)",
    provider: "Riot ID",
    banner: "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن Wild Cores فوري ⚡",
    hasZoneId: false,
    apiServiceId: "wild_rift",
    idPlaceholder: "أدخل Riot ID (Username#TAG)",
    packages: [
      { id: "wr_425", name: "425 Wild Cores", price: 170 },
      { id: "wr_1000", name: "1000 Wild Cores", price: 365 },
      { id: "wr_2050", name: "2050 Wild Cores", price: 720 }
    ]
  },
  {
    id: "arenabreakout",
    name: "أرينا بريك آوت (Arena)",
    provider: "Level Infinite",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    badge: "تسليم فوري بالمعرّف ⚡",
    hasZoneId: false,
    apiServiceId: "arena_breakout",
    idPlaceholder: "أدخل معرّف اللاعب (Character ID)",
    packages: [
      { id: "ab_basic", name: "باقة أساسية", price: 105 },
      { id: "ab_tac", name: "باقة تكتيكية", price: 265 },
      { id: "ab_elite", name: "باقة النخبة", price: 530 }
    ]
  },
  {
    id: "honorofkings",
    name: "هونر أوف كينجز (Honor of Kings)",
    provider: "Tencent Games",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن توكنز رسمي ⚡",
    hasZoneId: false,
    apiServiceId: "honor_of_kings",
    idPlaceholder: "أدخل UID الحساب",
    packages: [
      { id: "hok_starter", name: "باقة المبتدئين", price: 105 },
      { id: "hok_pro", name: "باقة المحترفين", price: 265 }
    ]
  },
  {
    id: "diablo",
    name: "ديابلو إيمورتال (Diablo)",
    provider: "Blizzard",
    banner: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    badge: "شحن أوربس وسيرفرات ⚡",
    hasZoneId: true,
    zoneLabel: "اسم السيرفر (Server Name)",
    apiServiceId: "diablo_immortal",
    idPlaceholder: "أدخل BattleTag أو UID",
    packages: [
      { id: "db_small", name: "حزمة صغيرة", price: 105 },
      { id: "db_big", name: "حزمة كبيرة", price: 315 }
    ]
  },
  {
    id: "topeleven",
    name: "توب إلفن (Top Eleven)",
    provider: "Nordeus",
    banner: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    badge: "رموز وتوكنز فورية ⚡",
    hasZoneId: false,
    apiServiceId: "top_eleven",
    idPlaceholder: "أدخل معرّف المدرب (Manager ID)",
    packages: [
      { id: "te_basic", name: "رموز أساسية", price: 105 },
      { id: "te_prem", name: "رموز مميزة", price: 265 }
    ]
  }
];

// تصدير أو إتاحة البيانات عالمياً للاستخدام في المتجر
if (typeof module !== "undefined" && module.exports) {
  module.exports = { gamesData };
} else {
  window.gamesData = gamesData;
}
