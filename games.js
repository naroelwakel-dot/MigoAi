// ==============================================================================
// بيانات الألعاب الرسمية الشاملة (18 لعبة بالكامل مع البانرات والأيقونات الرسمية)
// ==============================================================================

const allGames = [
  {
    id: "pubg",
    name: "بابجي موبايل (PUBG)",
    badge: "🔥 الأكثر طلباً",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Icon_PUBGM.jpg/250px-Icon_PUBGM.jpg",
    accent: "purple",
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
    badge: "⚡ فوري بالمعرف",
    banner: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Garena_Free_Fire_logo.png/250px-Garena_Free_Fire_logo.png",
    accent: "amber",
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
    id: "efmc",
    name: "إي فوتبول (eFootball PES)",
    badge: "⚽ رسمي كوانمي",
    banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/EFootball_logo.svg/250px-EFootball_logo.svg.png",
    accent: "sky",
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
    badge: "💎 تسليم باليوزر",
    banner: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Roblox_player_icon_black.svg/240px-Roblox_player_icon_black.svg.png",
    accent: "rose",
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
    banner: "https://images.unsplash.com/photo-1580234811497-9df7fd2f357e?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/8_Ball_Pool_Logo.png/220px-8_Ball_Pool_Logo.png",
    accent: "blue",
    requireZone: false,
    packages: [
      { name: "110 كاش", price: 65 },
      { name: "250 كاش", price: 135 },
      { name: "550 كاش", price: 270 },
      { name: "1200 كاش", price: 540 }
    ]
  },
  {
    id: "mlbb",
    name: "موبايل ليجندز (Mobile Legends)",
    badge: "🛡️ معتمد بالـ Zone ID",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Mobile_Legends_Bang_Bang_logo.png/250px-Mobile_Legends_Bang_Bang_logo.png",
    accent: "purple",
    requireZone: true,
    packages: [
      { name: "86 ماسة", price: 65 },
      { name: "257 ماسة", price: 185 },
      { name: "706 ماسات", price: 490 },
      { name: "2195 ماسة", price: 1450 }
    ]
  },
  {
    id: "coc",
    name: "كلاش أوف كلانس (Clash of Clans)",
    badge: "⚔️ سوبر سيل",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/Clash_of_Clans_Logo.png/250px-Clash_of_Clans_Logo.png",
    accent: "amber",
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
    banner: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/EA_Sports_FC_Mobile_logo.svg/250px-EA_Sports_FC_Mobile_logo.svg.png",
    accent: "emerald",
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
    banner: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Brawl_Stars_logo.png/250px-Brawl_Stars_logo.png",
    accent: "yellow",
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
    badge: "✨ كريستال بالـ Zone",
    banner: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Genshin_Impact_logo.svg/250px-Genshin_Impact_logo.svg.png",
    accent: "cyan",
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
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Call_of_Duty_Mobile_logo.png/250px-Call_of_Duty_Mobile_logo.png",
    accent: "orange",
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
    banner: "https://images.unsplash.com/photo-1542751110-97427bbecf20?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/250px-Valorant_logo_-_pink_color_version.svg.png",
    accent: "rose",
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
    banner: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/FortniteLogo.svg/250px-FortniteLogo.svg.png",
    accent: "blue",
    requireZone: false,
    packages: [
      { name: "1000 V-Bucks", price: 490 },
      { name: "2800 V-Bucks", price: 1150 },
      { name: "5000 V-Bucks", price: 1850 },
      { name: "13500 V-Bucks", price: 4600 }
    ]
  },
  {
    id: "farlight84",
    name: "فارلايت 84 (Farlight 84)",
    badge: "🚀 شحن مباشر",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Farlight_84_logo.png/250px-Farlight_84_logo.png",
    accent: "emerald",
    requireZone: false,
    packages: [
      { name: "60 ماسة", price: 65 },
      { name: "300+30 ماسة", price: 270 },
      { name: "680+70 ماسة", price: 540 },
      { name: "1380+150 ماسة", price: 1050 }
    ]
  },
  {
    id: "wildrift",
    name: "وايلد ريفت (Wild Rift)",
    badge: "⚔️ Wild Cores",
    banner: "https://images.unsplash.com/photo-1542751110-97427bbecf20?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/League_of_Legends_Wild_Rift_logo.png/250px-League_of_Legends_Wild_Rift_logo.png",
    accent: "sky",
    requireZone: false,
    packages: [
      { name: "500 Wild Cores", price: 270 },
      { name: "1050 Wild Cores", price: 540 },
      { name: "2175 Wild Cores", price: 1050 },
      { name: "3600 Wild Cores", price: 1750 }
    ]
  },
  {
    id: "arenabreakout",
    name: "أرينا بريك آوت (Arena Breakout)",
    badge: "🔫 Bonds فوري",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Arena_Breakout_Logo.png/250px-Arena_Breakout_Logo.png",
    accent: "amber",
    requireZone: false,
    packages: [
      { name: "60 Bonds", price: 65 },
      { name: "310 Bonds", price: 270 },
      { name: "630 Bonds", price: 540 },
      { name: "1300 Bonds", price: 1050 }
    ]
  },
  {
    id: "honorofkings",
    name: "هونر أوف كينجز (Honor of Kings)",
    badge: "👑 توكنز فوري",
    banner: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Honor_of_Kings_logo.png/250px-Honor_of_Kings_logo.png",
    accent: "purple",
    requireZone: false,
    packages: [
      { name: "80 توكنز", price: 65 },
      { name: "240+17 توكنز", price: 185 },
      { name: "400+32 توكنز", price: 290 },
      { name: "800+65 توكنز", price: 560 }
    ]
  },
  {
    id: "top_eleven",
    name: "توب إلفن (Top Eleven)",
    badge: "⚽ توكنز المدرب",
    banner: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800&auto=format&fit=crop",
    icon: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b2/Top_Eleven_Football_Manager_logo.png/250px-Top_Eleven_Football_Manager_logo.png",
    accent: "teal",
    requireZone: false,
    packages: [
      { name: "37 توكنز", price: 130 },
      { name: "80 توكنز", price: 270 },
      { name: "176 توكنز", price: 540 },
      { name: "370 توكنز", price: 1050 }
    ]
  }
];

// مصفوفة الفحص الشاملة للربط مع سيرفر التحقق (Deno API)
const GAMES_REGISTRY = [
  { id: "pubg", name: "بابجي موبايل (PUBG)", category: "ألعاب", requireZone: false },
  { id: "freefire", name: "فري فاير (Free Fire)", category: "ألعاب", requireZone: false },
  { id: "efmc", name: "إي فوتبول (eFootball PES)", category: "ألعاب", requireZone: false },
  { id: "roblox", name: "روبلوكس (Roblox Robux)", category: "ألعاب", requireZone: false },
  { id: "pool8", name: "8 Ball Pool", category: "ألعاب", requireZone: false },
  { id: "mlbb", name: "موبايل ليجندز (Mobile Legends)", category: "ألعاب", requireZone: true },
  { id: "coc", name: "كلاش أوف كلانس (Clash of Clans)", category: "ألعاب", requireZone: false },
  { id: "fifam", name: "فيفا موبايل (EA SPORTS FC)", category: "ألعاب", requireZone: false },
  { id: "brawlstars", name: "براول ستارز (Brawl Stars)", category: "ألعاب", requireZone: false },
  { id: "genshin", name: "جينشين إمباكت (Genshin Impact)", category: "ألعاب", requireZone: true },
  { id: "codm", name: "كول أوف ديوتي موبايل (CODM)", category: "ألعاب", requireZone: false },
  { id: "valorant", name: "فالورانت (Valorant VP)", category: "ألعاب", requireZone: false },
  { id: "fortnite", name: "فورتنايت (Fortnite V-Bucks)", category: "ألعاب", requireZone: false },
  { id: "farlight84", name: "فارلايت 84 (Farlight 84)", category: "ألعاب", requireZone: false },
  { id: "wildrift", name: "وايلد ريفت (Wild Rift)", category: "ألعاب", requireZone: false },
  { id: "arenabreakout", name: "أرينا بريك آوت (Arena Breakout)", category: "ألعاب", requireZone: false },
  { id: "honorofkings", name: "هونر أوف كينجز (Honor of Kings)", category: "ألعاب", requireZone: false },
  { id: "top_eleven", name: "توب إلفن (Top Eleven)", category: "ألعاب", requireZone: false },
  { id: "tiktok", name: "تيك توك كوينز (TikTok)", category: "عملات", requireZone: false },
  { id: "telegram", name: "نجوم تليجرام (Telegram Stars)", category: "عملات", requireZone: false },
  { id: "bigo", name: "بيجو لايف (BIGO Live)", category: "لايف", requireZone: false },
  { id: "poppo", name: "بوبو لايف (Poppo Live)", category: "لايف", requireZone: false },
  { id: "tango", name: "تانجو لايف (Tango Live)", category: "لايف", requireZone: false },
  { id: "likee", name: "لايكي (Likee)", category: "لايف", requireZone: false },
  { id: "chamet", name: "تشاميت (Chamet)", category: "لايف", requireZone: false },
  { id: "yalla", name: "يلا لودو (Yalla Ludo)", category: "لايف", requireZone: false },
  { id: "sugo", name: "سوجو (SUGO)", category: "لايف", requireZone: false },
  { id: "meyo", name: "ميو (MeYo)", category: "لايف", requireZone: false }
];
