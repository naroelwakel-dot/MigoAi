// ==============================================================================
// ملف 1: قاعدة بيانات الألعاب الرسمية الشاملة (18 لعبة بالبوسترات والشعارات الأصلية)
// ==============================================================================

const allGames = [
  {
    id: "pubg",
    name: "بابجي موبايل (PUBG Mobile)",
    badge: "🔥 الأكثر طلباً",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Battlegrounds_Mobile_India_logo.png/640px-Battlegrounds_Mobile_India_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Battlegrounds_Mobile_India_logo.png/200px-Battlegrounds_Mobile_India_logo.png",
    requireZone: false,
    packages: [
      { name: "60 UC", price: 55 },
      { name: "325 UC", price: 270 },
      { name: "660 UC", price: 540 },
      { name: "1800 UC", price: 1450 },
      { name: "3850 UC", price: 3100 },
      { name: "8100 UC", price: 6150 }
    ]
  },
  {
    id: "freefire",
    name: "فري فاير (Free Fire)",
    badge: "⚡ شحن فوري",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Garena_Free_Fire_Logo.png/640px-Garena_Free_Fire_Logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Garena_Free_Fire_Logo.png/200px-Garena_Free_Fire_Logo.png",
    requireZone: false,
    packages: [
      { name: "100+10 جوهرة", price: 65 },
      { name: "310+31 جوهرة", price: 185 },
      { name: "520+52 جوهرة", price: 310 },
      { name: "1060+106 جوهرة", price: 610 },
      { name: "2180+218 جوهرة", price: 1220 }
    ]
  },
  {
    id: "mlbb",
    name: "موبايل ليجندز (Mobile Legends)",
    badge: "🛡️ معتمد بالـ Zone",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Mobile_Legends_Bang_Bang_logo.png/640px-Mobile_Legends_Bang_Bang_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Mobile_Legends_Bang_Bang_logo.png/200px-Mobile_Legends_Bang_Bang_logo.png",
    requireZone: true,
    packages: [
      { name: "86 ماسة", price: 65 },
      { name: "257 ماسة", price: 185 },
      { name: "706 ماسات", price: 490 },
      { name: "2195 ماسة", price: 1450 }
    ]
  },
  {
    id: "efmc",
    name: "إي فوتبول (eFootball PES)",
    badge: "⚽ رسمي كوانمي",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/EFootball_logo.svg/640px-EFootball_logo.svg.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/EFootball_logo.svg/200px-EFootball_logo.svg.png",
    requireZone: false,
    packages: [
      { name: "130 كوينز", price: 65 },
      { name: "550 كوينز", price: 260 },
      { name: "1040 كوينز", price: 490 },
      { name: "2130 كوينز", price: 970 }
    ]
  },
  {
    id: "roblox",
    name: "روبلوكس (Roblox Robux)",
    badge: "💎 تسليم فوري",
    banner: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Roblox_player_icon_black.svg/640px-Roblox_player_icon_black.svg.png",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Roblox_player_icon_black.svg/200px-Roblox_player_icon_black.svg.png",
    requireZone: false,
    packages: [
      { name: "80 روبوكس", price: 65 },
      { name: "400 روبوكس", price: 270 },
      { name: "800 روبوكس", price: 530 },
      { name: "1700 روبوكس", price: 1050 }
    ]
  },
  {
    id: "pool8",
    name: "8 Ball Pool",
    badge: "🎱 كاش فوري",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/3/32/8_Ball_Pool_Logo.png/640px-8_Ball_Pool_Logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/3/32/8_Ball_Pool_Logo.png/200px-8_Ball_Pool_Logo.png",
    requireZone: false,
    packages: [
      { name: "110 كاش", price: 65 },
      { name: "250 كاش", price: 135 },
      { name: "550 كاش", price: 270 },
      { name: "1200 كاش", price: 540 }
    ]
  },
  {
    id: "coc",
    name: "كلاش أوف كلانس (Clash of Clans)",
    badge: "⚔️ سوبر سيل",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/7/74/Clash_of_Clans_Logo.png/640px-Clash_of_Clans_Logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/7/74/Clash_of_Clans_Logo.png/200px-Clash_of_Clans_Logo.png",
    requireZone: false,
    packages: [
      { name: "80 جوهرة", price: 65 },
      { name: "500 جوهرة", price: 270 },
      { name: "1200 جوهرة", price: 540 },
      { name: "2500 جوهرة", price: 1050 }
    ]
  },
  {
    id: "fifam",
    name: "فيفا موبايل (EA SPORTS FC)",
    badge: "🏆 FC Points",
    banner: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/EA_Sports_FC_Mobile_logo.svg/640px-EA_Sports_FC_Mobile_logo.svg.png",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/EA_Sports_FC_Mobile_logo.svg/200px-EA_Sports_FC_Mobile_logo.svg.png",
    requireZone: false,
    packages: [
      { name: "100 FC Points", price: 65 },
      { name: "500 FC Points", price: 270 },
      { name: "1050 FC Points", price: 530 },
      { name: "2200 FC Points", price: 1050 }
    ]
  },
  {
    id: "brawlstars",
    name: "براول ستارز (Brawl Stars)",
    badge: "💥 جواهر فورية",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Brawl_Stars_logo.png/640px-Brawl_Stars_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Brawl_Stars_logo.png/200px-Brawl_Stars_logo.png",
    requireZone: false,
    packages: [
      { name: "30 جوهرة", price: 110 },
      { name: "80 جوهرة", price: 270 },
      { name: "170 جوهرة", price: 540 },
      { name: "360 جوهرة", price: 1050 }
    ]
  },
  {
    id: "genshin",
    name: "جينشين إمباكت (Genshin Impact)",
    badge: "✨ كريستال رسمي",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Genshin_Impact_logo.svg/640px-Genshin_Impact_logo.svg.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Genshin_Impact_logo.svg/200px-Genshin_Impact_logo.svg.png",
    requireZone: true,
    packages: [
      { name: "60 كريستال", price: 65 },
      { name: "300+30 كريستال", price: 270 },
      { name: "980+110 كريستال", price: 820 },
      { name: "1980+260 كريستال", price: 1600 }
    ]
  },
  {
    id: "codm",
    name: "كول أوف ديوتي موبايل (CODM)",
    badge: "🎖️ CP فوري",
    banner: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Call_of_Duty_Mobile_logo.png/640px-Call_of_Duty_Mobile_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Call_of_Duty_Mobile_logo.png/200px-Call_of_Duty_Mobile_logo.png",
    requireZone: false,
    packages: [
      { name: "80 CP", price: 65 },
      { name: "420 CP", price: 270 },
      { name: "880 CP", price: 540 },
      { name: "2400 CP", price: 1350 }
    ]
  },
  {
    id: "valorant",
    name: "فالورانت (Valorant VP)",
    badge: "🎯 نقاط VP",
    banner: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/640px-Valorant_logo_-_pink_color_version.svg.png",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/200px-Valorant_logo_-_pink_color_version.svg.png",
    requireZone: false,
    packages: [
      { name: "475 VP", price: 270 },
      { name: "1000 VP", price: 540 },
      { name: "2050 VP", price: 1050 },
      { name: "3650 VP", price: 1800 }
    ]
  },
  {
    id: "fortnite",
    name: "فورتنايت (Fortnite V-Bucks)",
    badge: "⚡ في بوكس",
    banner: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/FortniteLogo.svg/640px-FortniteLogo.svg.png",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/FortniteLogo.svg/200px-FortniteLogo.svg.png",
    requireZone: false,
    packages: [
      { name: "1000 V-Bucks", price: 490 },
      { name: "2800 V-Bucks", price: 1150 },
      { name: "5000 V-Bucks", price: 1850 }
    ]
  },
  {
    id: "farlight84",
    name: "فارلايت 84 (Farlight 84)",
    badge: "🚀 شحن مباشر",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/3/36/Farlight_84_logo.png/640px-Farlight_84_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/3/36/Farlight_84_logo.png/200px-Farlight_84_logo.png",
    requireZone: false,
    packages: [
      { name: "60 ماسة", price: 65 },
      { name: "300+30 ماسة", price: 270 },
      { name: "680+70 ماسة", price: 540 }
    ]
  },
  {
    id: "wildrift",
    name: "وايلد ريفت (Wild Rift)",
    badge: "⚔️ Wild Cores",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/League_of_Legends_Wild_Rift_logo.png/640px-League_of_Legends_Wild_Rift_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/League_of_Legends_Wild_Rift_logo.png/200px-League_of_Legends_Wild_Rift_logo.png",
    requireZone: false,
    packages: [
      { name: "500 Wild Cores", price: 270 },
      { name: "1050 Wild Cores", price: 540 },
      { name: "2175 Wild Cores", price: 1050 }
    ]
  },
  {
    id: "arenabreakout",
    name: "أرينا بريك آوت (Arena Breakout)",
    badge: "🔫 Bonds فوري",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Arena_Breakout_logo.png/640px-Arena_Breakout_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Arena_Breakout_logo.png/200px-Arena_Breakout_logo.png",
    requireZone: false,
    packages: [
      { name: "60 Bonds", price: 65 },
      { name: "310 Bonds", price: 270 },
      { name: "630 Bonds", price: 540 }
    ]
  },
  {
    id: "honorofkings",
    name: "هونر أوف كينجز (Honor of Kings)",
    badge: "👑 توكنز فوري",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/Honor_of_Kings_logo.png/640px-Honor_of_Kings_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/Honor_of_Kings_logo.png/200px-Honor_of_Kings_logo.png",
    requireZone: false,
    packages: [
      { name: "80 توكنز", price: 65 },
      { name: "240+17 توكنز", price: 185 },
      { name: "400+32 توكنز", price: 290 }
    ]
  },
  {
    id: "top_eleven",
    name: "توب إلفن (Top Eleven)",
    badge: "⚽ توكنز المدرب",
    banner: "https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/Top_Eleven_Football_Manager_logo.png/640px-Top_Eleven_Football_Manager_logo.png",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/Top_Eleven_Football_Manager_logo.png/200px-Top_Eleven_Football_Manager_logo.png",
    requireZone: false,
    packages: [
      { name: "37 توكنز", price: 130 },
      { name: "80 توكنز", price: 270 },
      { name: "176 توكنز", price: 540 }
    ]
  }
];
