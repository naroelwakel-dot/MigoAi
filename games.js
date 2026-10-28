// ==============================================================================
// Migo AI Solution - games.js (محدث بالأيقونات البصرية الخفيفة SVG للبنرات)
// ==============================================================================

const gamesData = [
  {
    id: "pubg",
    name: "بابجي موبايل (PUBG)",
    provider: "Midasbuy الرسمي",
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "pubg_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-amber-900 via-yellow-700 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <div class="absolute inset-0 opacity-25 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <svg class="w-20 h-20 text-amber-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.121 2.121 0 0021 17.25l-5.83-5.83m-3.75 3.75l-3.5-3.5a2.121 2.121 0 013-3l3.5 3.5m-3.75 3.75l3.5 3.5"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-amber-500/40">PUBG MOBILE</span>
    </div>`,
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
    badge: "شحن فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "roblox",
    idPlaceholder: "أدخل معرّف أو اسم المستخدم",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-red-900 via-rose-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-16 h-16 text-rose-400 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" transform="rotate(15 12 12)" opacity="0.8"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-rose-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-rose-500/40">ROBLOX</span>
    </div>`,
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
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "free_fire",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-orange-900 via-amber-700 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-20 h-20 text-orange-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-orange-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-orange-500/40">FREE FIRE</span>
    </div>`,
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
    badge: "شحن آمن بالـ Tag ⚡",
    hasZoneId: false,
    apiServiceId: "clash_of_clans",
    idPlaceholder: "أدخل علامة اللاعب (Player Tag مثل #XXXXXX)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-yellow-900 via-amber-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-yellow-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-yellow-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-yellow-500/40">CLASH OF CLANS</span>
    </div>`,
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
    badge: "تسليم فوري بالـ ID ⚡",
    hasZoneId: false,
    apiServiceId: "fc_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (UID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-cyan-900 via-blue-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-cyan-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m9-9H3"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-cyan-500/40">FC MOBILE</span>
    </div>`,
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
    badge: "شحن فوري بالـ Tag ⚡",
    hasZoneId: false,
    apiServiceId: "brawl_stars",
    idPlaceholder: "أدخل Player Tag",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-purple-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-purple-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-purple-500/40">BRAWL STARS</span>
    </div>`,
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
    badge: "يتطلب اختيار السيرفر 🌐",
    hasZoneId: true,
    zoneLabel: "اختر السيرفر (Server)",
    zoneOptions: ["Asia", "America", "Europe", "TW/HK/MO"],
    apiServiceId: "genshin_impact",
    idPlaceholder: "أدخل معرّف اللعبة (UID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-sky-900 via-teal-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-teal-300 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-teal-200 bg-slate-950/80 px-2 py-0.5 rounded-md border border-teal-500/40">GENSHIN IMPACT</span>
    </div>`,
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
    badge: "يتطلب Zone ID 🎯",
    hasZoneId: true,
    zoneLabel: "معرّف السيرفر (Zone ID)",
    zonePlaceholder: "مثال: 1234",
    apiServiceId: "mobile_legends",
    idPlaceholder: "أدخل معرّف اللاعب (User ID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-blue-950 via-indigo-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-blue-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-blue-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-blue-500/40">MOBILE LEGENDS</span>
    </div>`,
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
    badge: "شحن CP فوري ⚡",
    hasZoneId: false,
    apiServiceId: "cod_mobile",
    idPlaceholder: "أدخل معرّف اللاعب (Player ID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-stone-900 via-neutral-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-stone-300 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-stone-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-stone-500/40">CALL OF DUTY</span>
    </div>`,
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
    badge: "نقاط فالورانت VP ⚡",
    hasZoneId: false,
    apiServiceId: "valorant",
    idPlaceholder: "أدخل Riot ID مع التاج (Name#TAG)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-rose-950 via-red-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-rose-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-rose-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-rose-500/40">VALORANT</span>
    </div>`,
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
    badge: "شحن فيبوكس V-Bucks ⚡",
    hasZoneId: false,
    apiServiceId: "fortnite",
    idPlaceholder: "أدخل Epic Account ID",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-indigo-950 via-purple-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-indigo-300 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.38 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-indigo-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-indigo-500/40">FORTNITE</span>
    </div>`,
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
    badge: "شحن Wild Cores فوري ⚡",
    hasZoneId: false,
    apiServiceId: "wild_rift",
    idPlaceholder: "أدخل Riot ID (Username#TAG)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-sky-950 via-blue-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-sky-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-sky-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-sky-500/40">WILD RIFT</span>
    </div>`,
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
    badge: "تسليم فوري بالمعرّف ⚡",
    hasZoneId: false,
    apiServiceId: "arena_breakout",
    idPlaceholder: "أدخل معرّف اللاعب (Character ID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-amber-950 via-stone-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-amber-500 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-amber-500/40">ARENA BREAKOUT</span>
    </div>`,
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
    badge: "شحن توكنز رسمي ⚡",
    hasZoneId: false,
    apiServiceId: "honor_of_kings",
    idPlaceholder: "أدخل UID الحساب",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-yellow-950 via-amber-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-amber-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.982-3.172m-5.007 0c-.826 0-1.5-.674-1.5-1.5V5.25a1.5 1.5 0 011.5-1.5h13.5a1.5 1.5 0 011.5 1.5v4.35c0 .826-.674 1.5-1.5 1.5h-3.75"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-amber-500/40">HONOR OF KINGS</span>
    </div>`,
    packages: [
      { id: "hok_starter", name: "باقة المبتدئين", price: 105 },
      { id: "hok_pro", name: "باقة المحترفين", price: 265 }
    ]
  },
  {
    id: "diablo",
    name: "ديابلو إيمورتال (Diablo)",
    provider: "Blizzard",
    badge: "شحن أوربس وسيرفرات ⚡",
    hasZoneId: true,
    zoneLabel: "اسم السيرفر (Server Name)",
    apiServiceId: "diablo_immortal",
    idPlaceholder: "أدخل BattleTag أو UID",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-red-950 via-stone-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-red-500 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-red-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-red-500/40">DIABLO IMMORTAL</span>
    </div>`,
    packages: [
      { id: "db_small", name: "حزمة صغيرة", price: 105 },
      { id: "db_big", name: "حزمة كبيرة", price: 315 }
    ]
  },
  {
    id: "topeleven",
    name: "توب إلفن (Top Eleven)",
    provider: "Nordeus",
    badge: "رموز وتوكنز فورية ⚡",
    hasZoneId: false,
    apiServiceId: "top_eleven",
    idPlaceholder: "أدخل معرّف المدرب (Manager ID)",
    svgBanner: `<div class="w-full h-full bg-gradient-to-tr from-emerald-950 via-teal-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
      <svg class="w-18 h-18 text-emerald-400 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.982-3.172m-5.007 0c-.826 0-1.5-.674-1.5-1.5V5.25a1.5 1.5 0 011.5-1.5h13.5a1.5 1.5 0 011.5 1.5v4.35c0 .826-.674 1.5-1.5 1.5h-3.75"/></svg>
      <span class="absolute bottom-2 right-3 text-xs font-black text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">TOP ELEVEN</span>
    </div>`,
    packages: [
      { id: "te_basic", name: "رموز أساسية", price: 105 },
      { id: "te_prem", name: "رموز مميزة", price: 265 }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { gamesData };
} else {
  window.gamesData = gamesData;
}
