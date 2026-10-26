// ==============================================================================
// قائمة الألعاب الـ 18 الرسمية بالكامل وسجل المعرفات الشامل
// ==============================================================================

const allGames = [
    { key: 'pubg', name: "بابجي موبايل (PUBG)", tag: "Midasbuy", pkgs: [{l: "60 UC", p: 62}, {l: "325 UC", p: 310}, {l: "660 UC", p: 620}, {l: "1800 UC", p: 1550}, {l: "3850 UC", p: 3100}, {l: "8100 UC", p: 6200}] },
    { key: 'freefire', name: "فري فاير (Free Fire)", tag: "فوري بالـ ID", pkgs: [{l: "110 Diamonds", p: 55}, {l: "231 Diamonds", p: 110}, {l: "583 Diamonds", p: 265}, {l: "1188 Diamonds", p: 530}, {l: "2420 Diamonds", p: 1050}] },
    { key: 'efootball', name: "إي فوتبول (eFootball)", tag: "Konami ID", pkgs: [{l: "130 Coins", p: 95}, {l: "550 Coins", p: 365}, {l: "1040 Coins", p: 690}, {l: "2130 Coins", p: 1380}] },
    { key: 'roblox', name: "روبلوكس (Roblox)", tag: "Codashop", pkgs: [{l: "80 Robux", p: 62}, {l: "400 Robux", p: 310}, {l: "800 Robux", p: 620}, {l: "1700 Robux", p: 1240}] },
    { key: 'pool8', name: "8 Ball Pool", tag: "Miniclip", pkgs: [{l: "حزمة 50 كاش", p: 115}, {l: "حزمة 150 كاش", p: 290}] },
    { key: 'mlbb', name: "موبايل ليجندز (MLBB)", tag: "Zone ID", pkgs: [{l: "86 Diamonds", p: 55}, {l: "172 Diamonds", p: 110}, {l: "257 Diamonds", p: 160}, {l: "706 Diamonds", p: 425}, {l: "2195 Diamonds", p: 1320}] },
    { key: 'clash', name: "كلاش أوف كلانس", tag: "Supercell", pkgs: [{l: "80 جواهر", p: 60}, {l: "500 جواهر", p: 285}, {l: "1200 جواهر", p: 620}, {l: "تذكرة ذهبية Gold Pass", p: 430}] },
    { key: 'fifa', name: "فيفا موبايل (FC Mobile)", tag: "EA Sports", pkgs: [{l: "40 Points", p: 35}, {l: "100 Points", p: 88}, {l: "500 Points", p: 430}, {l: "حزمة إضافية", p: 230}] },
    { key: 'brawl', name: "براول ستارز", tag: "Supercell", pkgs: [{l: "30 جواهر", p: 115}, {l: "80 جواهر", p: 285}, {l: "170 جواهر", p: 570}, {l: "Brawl Pass", p: 530}] },
    { key: 'genshin', name: "جينشين إمباكت", tag: "UID", pkgs: [{l: "60 كريستال", p: 62}, {l: "300 كريستال", p: 310}, {l: "980 كريستال", p: 950}, {l: "بركة القمر (Welkin)", p: 305}] },
    { key: 'codm', name: "كول أوف ديوتي (CODM)", tag: "Activision", pkgs: [{l: "80 CP", p: 62}, {l: "420 CP", p: 265}, {l: "880 CP", p: 530}, {l: "2400 CP", p: 1350}] },
    { key: 'valorant', name: "فالورانت (VALORANT)", tag: "Riot", pkgs: [{l: "475 VP", p: 160}, {l: "1000 VP", p: 315}, {l: "2050 VP", p: 630}, {l: "5350 VP", p: 1550}] },
    { key: 'fortnite', name: "فورتنايت (Fortnite)", tag: "Epic", pkgs: [{l: "1000 V-Bucks", p: 315}, {l: "2800 V-Bucks", p: 790}, {l: "5000 V-Bucks", p: 1380}] },
    { key: 'farlight', name: "فارلايت 84 (Farlight)", tag: "ID", pkgs: [{l: "حزمة ألماس أساسية", p: 110}, {l: "حزمة ألماس متقدمة", p: 310}, {l: "حزمة النخبة", p: 620}] },
    { key: 'wildrift', name: "وايلد ريفت (Wild Rift)", tag: "Riot", pkgs: [{l: "425 Wild Cores", p: 170}, {l: "1000 Wild Cores", p: 365}, {l: "2050 Wild Cores", p: 730}] },
    { key: 'arena', name: "أرينا بريك آوت (Arena)", tag: "Level Infinite", pkgs: [{l: "باقة أساسية", p: 105}, {l: "باقة النخبة", p: 530}, {l: "باقة كبار الشخصيات", p: 1050}] },
    { key: 'honor', name: "هونر أوف كينجز", tag: "Tencent", pkgs: [{l: "باقة مبتدئين", p: 105}, {l: "باقة محترفين", p: 265}, {l: "باقة ماسية", p: 530}] },
    { key: 'topeleven', name: "توب إلفن (Top Eleven)", tag: "Nordeus", pkgs: [{l: "رموز أساسية", p: 105}, {l: "رموز مميزة", p: 265}, {l: "حزمة الموسم", p: 530}] }
];

const GAMES_REGISTRY = [
    { key: 'tiktok', label: 'تيك توك كوينز (TikTok Username)', hasZone: false, isUser: true },
    { key: 'telegram', label: 'تليجرام (Telegram Username)', hasZone: false, isUser: true },
    { key: 'pubg', label: 'بابجي موبايل (PUBG Mobile)', hasZone: false },
    { key: 'freefire', label: 'فري فاير (Free Fire)', hasZone: false },
    { key: 'efootball', label: 'إي فوتبول (eFootball Konami ID)', hasZone: false },
    { key: 'roblox', label: 'روبلوكس (Roblox)', hasZone: false },
    { key: 'pool8', label: '8 Ball Pool (Miniclip ID)', hasZone: false },
    { key: 'mlbb', label: 'موبايل ليجندز (Mobile Legends)', hasZone: true },
    { key: 'clash', label: 'كلاش أوف كلانس (Player Tag)', hasZone: false },
    { key: 'fifa', label: 'فيفا موبايل (FC Mobile)', hasZone: false },
    { key: 'brawl', label: 'براول ستارز (Player Tag)', hasZone: false },
    { key: 'genshin', label: 'جينشين إمباكت (Genshin UID)', hasZone: true },
    { key: 'codm', label: 'كول أوف ديوتي (Player ID)', hasZone: false },
    { key: 'valorant', label: 'فالورانت (VALORANT Riot ID)', hasZone: false },
    { key: 'fortnite', label: 'فورتنايت (Fortnite Epic ID)', hasZone: false },
    { key: 'farlight', label: 'فارلايت 84 (Farlight ID)', hasZone: false },
    { key: 'wildrift', label: 'وايلد ريفت (Wild Rift Riot ID)', hasZone: false },
    { key: 'arena', label: 'أرينا بريك آوت (Arena Breakout ID)', hasZone: false },
    { key: 'honor', label: 'هونر أوف كينجز (Honor of Kings ID)', hasZone: false },
    { key: 'topeleven', label: 'توب إلفن (Top Eleven Manager ID)', hasZone: false },
    { key: 'bigo', label: 'بيجو لايف (BIGO ID)', hasZone: false },
    { key: 'poppo', label: 'بوبو لايف (Poppo ID)', hasZone: false },
    { key: 'tango', label: 'تانجو لايف (Tango ID)', hasZone: false },
    { key: 'likee', label: 'لايكي (Likee ID)', hasZone: false },
    { key: 'chamet', label: 'تشاميت (Chamet ID)', hasZone: false },
    { key: 'yalla', label: 'يلا لودو (User ID)', hasZone: false },
    { key: 'sugo', label: 'سوجو (SUGO ID)', hasZone: false },
    { key: 'meyo', label: 'ميو (MeYo ID)', hasZone: false }
];
