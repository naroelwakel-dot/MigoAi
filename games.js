// ==============================================================================
// Migo AI Solution - games.js
// (نسخة معدّلة: تصحيح مراجع الصور + تحديث أسعار الموردين ×1.12 — 2026-10-30)
// ==============================================================================

const gamesData = [
  {
    id: "pubg",
    name: "بابجي موبايل (PUBG)",
    provider: "Midasbuy الرسمي",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/5eb3d9b4c59e4090909ba416495335fc.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/fbe4174056414e5b9225737052c72f32.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/374acfb645a7407bbc54aa120810cccd.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/828842279ce6497b8d2d00bde7f9675e.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/dd85bc5bf05747dea02cc777e033dce7.webp",
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "fc_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (UID)",
    packages: [
      { id: "fc_40", name: "40 FC Points", price: 22 },
      { id: "fc_100", name: "100 FC Points", price: 56 },
      { id: "fc_520", name: "520 FC Points", price: 280 },
      { id: "fc_1070", name: "1070 FC Points", price: 560 },
      { id: "fc_2200", name: "2200 FC Points", price: 1120 }
    ]
  },
  {
    id: "brawlstars",
    name: "براول ستارز (Brawl Stars)",
    provider: "Supercell ID",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b49a6d6bbbda43089e5e84ac112fb95a.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/414ca1edebdb488b8f506a74be290205.webp",
    badge: "يتطلب اختيار السيرفر 🌐",
    hasZoneId: true,
    zoneLabel: "اختر السيرفر (Server)",
    zoneOptions: ["Asia", "America", "Europe", "TW/HK/MO"],
    apiServiceId: "genshin_impact",
    idPlaceholder: "أدخل معرّف اللعبة (UID)",
    packages: [
      { id: "gi_60", name: "60 كريستال", price: 62 },
      { id: "gi_330", name: "300+30 كريستال", price: 313 },
      { id: "gi_moon", name: "بركة القمر (Welkin Moon)", price: 313 },
      { id: "gi_1090", name: "980+110 كريستال", price: 941 }
    ]
  },
  {
    id: "mlbb",
    name: "موبايل ليجندز (MLBB)",
    provider: "تسليم فوري",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/6303f479a08f4c46ac8b02a8d8f5f8d8.webp",
    badge: "يتطلب Zone ID 🎯",
    hasZoneId: true,
    zoneLabel: "معرّف السيرفر (Zone ID)",
    zonePlaceholder: "مثال: 1234",
    apiServiceId: "mobile_legends",
    idPlaceholder: "أدخل معرّف اللاعب (User ID)",
    packages: [
      { id: "ml_155", name: "155 Diamonds", price: 155 },
      { id: "ml_311", name: "311 Diamonds", price: 310 },
      { id: "ml_949", name: "949 Diamonds", price: 929 },
      { id: "ml_1617", name: "1617 Diamonds", price: 1550 },
      { id: "ml_3331", name: "3331 Diamonds", price: 3099 },
      { id: "ml_4997", name: "4997 Diamonds", price: 4648 }
    ]
  },
  {
    id: "codm",
    name: "كول أوف ديوتي (CODM)",
    provider: "Activision",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/cce297c1efc74e628d5e250deeb6d3ea.webp",
    badge: "شحن CP فوري ⚡",
    hasZoneId: false,
    apiServiceId: "cod_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    packages: [
      { id: "cod_80", name: "80 CP", price: 50 },
      { id: "cod_420", name: "420 CP", price: 252 },
      { id: "cod_880", name: "880 CP", price: 504 },
      { id: "cod_2400", name: "2400 CP", price: 1260 }
    ]
  },
  {
    id: "valorant",
    name: "فالورانت (VALORANT)",
    provider: "Riot Games",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c9a6bebcd58c4587a5d057794891669a.webp",
    badge: "نقاط فالورانت VP ⚡",
    hasZoneId: false,
    apiServiceId: "valorant",
    idPlaceholder: "أدخل Riot ID مع التاج (Name#TAG)",
    packages: [
      { id: "val_475", name: "475 VP", price: 269 },
      { id: "val_1000", name: "1000 VP", price: 538 },
      { id: "val_2050", name: "2050 VP", price: 1075 },
      { id: "val_3650", name: "3650 VP", price: 1904 }
    ]
  },
  {
    id: "fortnite",
    name: "فورتنايت (Fortnite)",
    provider: "Epic Games",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b9284e0934c04b2d996214a6fe91764f.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/2cab796756134e6faef15afe56a2ef3c.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/05416cc14dd54258987de423659dfe74.webp",
    badge: "تسليم فوري بالمعرّف ⚡",
    hasZoneId: false,
    apiServiceId: "arena_breakout",
    idPlaceholder: "أدخل معرّف اللاعب (Character ID)",
    packages: [
      { id: "ab_60", name: "60 Bonds", price: 63 },
      { id: "ab_310", name: "310 Bonds", price: 316 },
      { id: "ab_630", name: "630 Bonds", price: 632 },
      { id: "ab_1580", name: "1580 Bonds", price: 1579 },
      { id: "ab_3200", name: "3200 Bonds", price: 3158 },
      { id: "ab_6500", name: "6500 Bonds", price: 6318 }
    ]
  },
  {
    id: "honorofkings",
    name: "هونر أوف كينجز (Honor of Kings)",
    provider: "Tencent Games",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/6e12ae5a3a084502b42fb6b6a5580934.webp",
    badge: "شحن توكنز رسمي ⚡",
    hasZoneId: false,
    apiServiceId: "honor_of_kings",
    idPlaceholder: "أدخل UID الحساب",
    packages: [
      { id: "hok_80", name: "80 Tokens", price: 72 },
      { id: "hok_240", name: "240 Tokens", price: 197 },
      { id: "hok_400", name: "400 Tokens", price: 326 },
      { id: "hok_560", name: "560 Tokens", price: 451 },
      { id: "hok_830", name: "830 Tokens", price: 645 },
      { id: "hok_1245", name: "1245 Tokens", price: 948 }
    ]
  },
  {
    id: "diablo",
    name: "ديابلو إيمورتال (Diablo)",
    provider: "Blizzard",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/be7f83b3937945d2904ba58cd5aa7035.webp",
    badge: "شحن أوربس وسيرفرات ⚡",
    hasZoneId: true,
    zoneLabel: "اسم السيرفر (Server Name)",
    apiServiceId: "diablo_immortal",
    idPlaceholder: "أدخل BattleTag أو UID",
    packages: [
      { id: "db_60", name: "60 Eternal Orbs", price: 54 },
      { id: "db_320", name: "320 Eternal Orbs", price: 269 },
      { id: "db_650", name: "650 Eternal Orbs", price: 538 },
      { id: "db_1650", name: "1650 Eternal Orbs", price: 1344 },
      { id: "db_3450", name: "3450 Eternal Orbs", price: 2688 },
      { id: "db_7200", name: "7200 Eternal Orbs", price: 5432 }
    ]
  },
  {
    id: "topeleven",
    name: "توب إلفن (Top Eleven)",
    provider: "Nordeus",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/ea3108f73884437481b1acec95c01a59.webp",
    badge: "رموز وتوكنز فورية ⚡",
    hasZoneId: false,
    apiServiceId: "top_eleven",
    idPlaceholder: "أدخل معرّف المدرب (Manager ID)",
    packages: [
      { id: "te_14", name: "14 Tokens", price: 112 },
      { id: "te_37", name: "37 Tokens", price: 280 },
      { id: "te_80", name: "80 Tokens", price: 560 },
      { id: "te_176", name: "176 Tokens", price: 1120 },
      { id: "te_500", name: "500 Tokens", price: 2800 },
      { id: "te_1031", name: "1031 Tokens", price: 5600 }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { gamesData };
} else {
  window.gamesData = gamesData;
}
