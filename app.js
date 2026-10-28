// ==============================================================================
// Migo AI Solution - Complete Integrated app.js (Includes All Data & Engine)
// ==============================================================================

const USD_TO_EGP = 62; 
const USERS_STORAGE_KEY = 'migo_registered_users_v2';
const SESSION_STORAGE_KEY = 'migo_active_member_v2';
const CART_STORAGE_KEY = 'migo_cart_v2';
const DENO_API_URL = "https://migoai-72.naroelwakel-dot.deno.net";
const WHATSAPP_NUMBER = "201060934020";

let currentSMMPlatform = null;
let currentSlide = 0;
let cart = [];
let appliedCoupon = null;
let currentModalItem = null;
let isExpressModal = false;
let selectedVccItem = null;
let selectedPayment = null;

const validCoupons = {
    'SIAFFC15': { discount: 0.15 },
    'SIAF15': { discount: 0.15 },
    'SIAFGAMING15': { discount: 0.15 },
    'MIGO15': { discount: 0.15 },
    'WELCOME10': { discount: 0.10 }
};

// --- بيانات عملات تيك توك ونجوم تليجرام ---
const tiktokCoinsList = [
    { coins: 70, price: 65 },
    { coins: 350, price: 310 },
    { coins: 700, price: 620 },
    { coins: 1400, price: 1230 },
    { coins: 3500, price: 3050 },
    { coins: 7000, price: 6100 }
];

const telegramStarsList = [
    { stars: 50, price: 110 },
    { stars: 100, price: 215 },
    { stars: 250, price: 520 },
    { stars: 500, price: 1020 },
    { stars: 1000, price: 2000 }
];

// --- بيانات بطاقات VCC الدولية ---
const vccData = [
    { id: 'vcc_10', name: 'بطاقة افتراضية (10$ USD)', priceEgp: 620, badge: 'فوري وسريع', description: 'مناسبة لتفعيل الاشتراكات البسيطة والمشتريات المصغرة.' },
    { id: 'vcc_25', name: 'بطاقة افتراضية (25$ USD)', priceEgp: 1550, badge: 'الأكثر طلباً', description: 'مثالية للإعلانات الممولة وتفعيل شات جي بي تي وبرامج التصميم.' },
    { id: 'vcc_50', name: 'بطاقة افتراضية (50$ USD)', priceEgp: 3100, badge: 'صلاحية كاملة', description: 'لإدارة الحملات الإعلانية والمشتريات الكبرى من المتاجر العالمية.' },
    { id: 'vcc_100', name: 'بطاقة افتراضية (100$ USD)', priceEgp: 6200, badge: 'للشركات', description: 'مخصصة للمطورين وأصحاب الأعمال والميزانيات الإعلانية الضخمة.' }
];

// --- بيانات الألعاب الـ 16 ---
const gamesData = [
    {
        id: 'pubg',
        name: 'ببجي موبايل (PUBG Mobile)',
        badge: 'Midasbuy رسمي ⚡',
        banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '60 UC', price: 50 },
            { name: '325 UC', price: 250 },
            { name: '660 UC', price: 490 },
            { name: '1800 UC', price: 1350 },
            { name: '3850 UC', price: 3100 },
            { name: '8100 UC', price: 6150 }
        ]
    },
    {
        id: 'freefire',
        name: 'فري فاير (Free Fire)',
        badge: 'تسليم بالـ ID 💎',
        banner: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '100 جوهرة', price: 45 },
            { name: '310 جوهرة', price: 135 },
            { name: '520 جوهرة', price: 220 },
            { name: '1060 جوهرة', price: 440 },
            { name: '2180 جوهرة', price: 890 }
        ]
    },
    {
        id: 'roblox',
        name: 'روبلوكس (Roblox Robux)',
        badge: 'روبوكس فوري 🎮',
        banner: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '400 Robux', price: 210 },
            { name: '800 Robux', price: 410 },
            { name: '1700 Robux', price: 850 },
            { name: '4500 Robux', price: 2150 }
        ]
    },
    {
        id: 'mlbb',
        name: 'موبايل ليجند (Mobile Legends)',
        badge: 'Diamonds 💎',
        banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '86 الماسات', price: 65 },
            { name: '172 الماسات', price: 130 },
            { name: '257 الماسات', price: 195 },
            { name: '706 الماسات', price: 520 },
            { name: '2195 الماسات', price: 1550 }
        ]
    },
    {
        id: 'cod',
        name: 'كول أوف ديوتي (Call of Duty)',
        badge: 'CP رسمي 🔥',
        banner: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '80 CP', price: 60 },
            { name: '420 CP', price: 290 },
            { name: '880 CP', price: 580 },
            { name: '2400 CP', price: 1450 },
            { name: '5000 CP', price: 2900 }
        ]
    },
    {
        id: 'brawlstars',
        name: 'براول ستارز (Brawl Stars)',
        badge: 'Gems ⚡',
        banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '30 جوهرة', price: 90 },
            { name: '80 جوهرة', price: 220 },
            { name: '170 جوهرة', price: 430 },
            { name: '360 جوهرة', price: 890 }
        ]
    },
    {
        id: 'genshin',
        name: 'جينشين إمباكت (Genshin Impact)',
        badge: 'Crystals ✨',
        banner: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '60 كريستال', price: 55 },
            { name: '300 كريستال', price: 260 },
            { name: '980 كريستال', price: 790 },
            { name: '1980 كريستال', price: 1550 }
        ]
    },
    {
        id: 'valorant',
        name: 'فالورانت (Valorant Points)',
        badge: 'VP نقاط 🎯',
        banner: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '475 VP', price: 230 },
            { name: '1000 VP', price: 460 },
            { name: '2050 VP', price: 920 },
            { name: '3650 VP', price: 1600 }
        ]
    },
    {
        id: 'fortnite',
        name: 'فورتنايت (Fortnite V-Bucks)',
        badge: 'V-Bucks 🌴',
        banner: 'https://images.unsplash.com/photo-1589241062272-c0a000071dfa?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '1000 V-Bucks', price: 380 },
            { name: '2800 V-Bucks', price: 950 },
            { name: '5000 V-Bucks', price: 1500 }
        ]
    },
    {
        id: 'clashofclans',
        name: 'كلاش أوف كلانس (Clash of Clans)',
        badge: 'Gems 🛡️',
        banner: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '80 جوهرة', price: 60 },
            { name: '500 جوهرة', price: 320 },
            { name: '1200 جوهرة', price: 650 },
            { name: '2500 جوهرة', price: 1300 }
        ]
    },
    {
        id: 'fifa',
        name: 'إي إيه سبورتس فيفا (EA Sports FC)',
        badge: 'FIFA Points ⚽',
        banner: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '1050 Points', price: 450 },
            { name: '2200 Points', price: 920 },
            { name: '4600 Points', price: 1850 }
        ]
    },
    {
        id: 'wildrift',
        name: 'ليجندز وايلد ريفت (Wild Rift)',
        badge: 'Wild Cores 🌀',
        banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '500 Cores', price: 220 },
            { name: '1000 Cores', price: 430 },
            { name: '2000 Cores', price: 850 }
        ]
    },
    {
        id: 'arenabreakout',
        name: 'أرينا بريك آوت (Arena Breakout)',
        badge: 'Bonds 🔫',
        banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '60 Bonds', price: 55 },
            { name: '300 Bonds', price: 270 },
            { name: '680 Bonds', price: 590 }
        ]
    },
    {
        id: 'honorofkings',
        name: 'هونر أوف كينجز (Honor of Kings)',
        badge: 'Tokens 👑',
        banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '80 Tokens', price: 50 },
            { name: '240 Tokens', price: 150 },
            { name: '560 Tokens', price: 340 },
            { name: '1200 Tokens', price: 710 }
        ]
    },
    {
        id: 'diablo',
        name: 'ديابلو إيمورتال (Diablo Immortal)',
        badge: 'Eternal Orbs 🔮',
        banner: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '60 Orbs', price: 65 },
            { name: '315 Orbs', price: 320 },
            { name: '630 Orbs', price: 630 }
        ]
    },
    {
        id: 'topeleven',
        name: 'توب إلفن (Top Eleven Tokens)',
        badge: 'Tokens ⚽',
        banner: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '49 Tokens', price: 120 },
            { name: '105 Tokens', price: 240 },
            { name: '220 Tokens', price: 490 }
        ]
    }
];

// --- بيانات برامج اللايف الـ 6 ---
const liveCoinsData = [
    {
        id: 'bigo',
        name: 'بيجو لايف (BIGO LIVE)',
        badge: 'ماس فوري 🔴',
        banner: 'https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '210 ماسة', price: 75 },
            { name: '423 ماسة', price: 150 },
            { name: '848 ماسة', price: 300 },
            { name: '2120 ماسة', price: 740 },
            { name: '5300 ماسة', price: 1820 }
        ]
    },
    {
        id: 'chamet',
        name: 'شامت (Chamet)',
        badge: 'شحن بالـ ID ✨',
        banner: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '62,000 كوينز', price: 190 },
            { name: '310,000 كوينز', price: 920 },
            { name: '620,000 كوينز', price: 1820 }
        ]
    },
    {
        id: 'poppo',
        name: 'بوبو لايف (Poppo Live)',
        badge: 'كوينزات 🪙',
        banner: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '7,000 كوينز', price: 45 },
            { name: '35,000 كوينز', price: 210 },
            { name: '70,000 كوينز', price: 410 },
            { name: '350,000 كوينز', price: 2000 }
        ]
    },
    {
        id: 'yallaludo',
        name: 'يلا لودو (Yalla Ludo)',
        badge: 'جواهر وذهب 🎲',
        banner: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '107 جوهرة', price: 65 },
            { name: '319 جوهرة', price: 190 },
            { name: '660 جوهرة', price: 380 },
            { name: '2211 جوهرة', price: 1250 }
        ]
    },
    {
        id: 'sugo',
        name: 'سوجو (SUGO)',
        badge: 'عملات رسمية 🎙️',
        banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '500 عملة', price: 90 },
            { name: '2000 عملة', price: 350 },
            { name: '5000 عملة', price: 850 }
        ]
    },
    {
        id: 'meyo',
        name: 'مييو (MeYo)',
        badge: 'شحن فوري 💬',
        banner: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80',
        packages: [
            { name: '500 ماسة', price: 85 },
            { name: '1500 ماسة', price: 250 },
            { name: '5000 ماسة', price: 820 }
        ]
    }
];

// --- بيانات الاشتراكات والبرامج (الترفيه، الإنتاجية، الذكاء الاصطناعي) ---
const subscriptionsData = [
    {
        id: 'chatgpt_plus',
        name: 'ChatGPT Plus (شات جي بي تي)',
        category: 'ai',
        badge: 'رسمي 100%',
        banner: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80',
        description: 'تفعيل اشتراك GPT-4o على إيميلك الشخصي مع ضمان كامل طوال المدة.',
        packages: [
            { name: 'اشتراك شهر كامل', price: 650, duration: 'شهر' }
        ]
    },
    {
        id: 'gemini_advanced',
        name: 'Google Gemini Advanced',
        category: 'ai',
        badge: 'تفعيل شخصي ✨',
        banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        description: 'أقوى نموذج ذكاء اصطناعي من جوجل مع مساحة 2 تيرابايت.',
        packages: [
            { name: 'اشتراك شهري', price: 550, duration: 'شهر' },
            { name: 'باقة 18 شهر (توفير كبرى)', price: 1850, duration: '18 شهر' }
        ]
    },
    {
        id: 'claude_pro',
        name: 'Claude 3.5 Sonnet Pro',
        category: 'ai',
        badge: 'للمطورين 🧠',
        banner: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
        description: 'الحساب الأقوى للبرمجة وكتابة النصوص والأكواد بدقة متناهية.',
        packages: [
            { name: 'اشتراك شهر كامل', price: 720, duration: 'شهر' }
        ]
    },
    {
        id: 'midjourney',
        name: 'Midjourney AI (تصميم الصور)',
        category: 'ai',
        badge: 'تصميم احترافي 🎨',
        banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        description: 'توليد أروع الصور والتصاميم بالذكاء الاصطناعي.',
        packages: [
            { name: 'باقة Basic (شهر)', price: 450, duration: 'شهر' },
            { name: 'باقة Standard (شهر)', price: 850, duration: 'شهر' }
        ]
    },
    {
        id: 'canva_pro',
        name: 'Canva Pro (كانفا برو)',
        category: 'design',
        badge: 'أدوات التصميم 🖌️',
        banner: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=1200&q=80',
        description: 'صلاحيات التصميم المفتوحة وقوالب برو الاحترافية.',
        packages: [
            { name: 'اشتراك رسمي (سنة كاملة)', price: 250, duration: 'سنة' }
        ]
    },
    {
        id: 'adobe_cc',
        name: 'Adobe Creative Cloud',
        category: 'design',
        badge: 'برامج أدوبي 💻',
        banner: 'https://images.unsplash.com/photo-1542744094-3a31246a969f?auto=format&fit=crop&w=1200&q=80',
        description: 'جميع برامج أدوبي (فوتوشوب، بريمير، إليستريتور) رسمية.',
        packages: [
            { name: 'اشتراك شهر كامل', price: 950, duration: 'شهر' }
        ]
    },
    {
        id: 'netflix',
        name: 'Netflix Premium (نتفلكس)',
        category: 'entertainment',
        badge: 'شاشة خاصة 📺',
        banner: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=1200&q=80',
        description: 'جودة 4K Ultra HD مع شاشة خاصة برقم سري.',
        packages: [
            { name: 'شاشة خاصة (شهر)', price: 150, duration: 'شهر' },
            { name: 'حساب كامل (شهر)', price: 450, duration: 'شهر' }
        ]
    },
    {
        id: 'shahid_vip',
        name: 'Shahid VIP (شاهد)',
        category: 'entertainment',
        badge: 'مسلسلات وأفلام 🎬',
        banner: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
        description: 'اشتراك رسمي لمتابعة أحدث الأعمال العربية والعالمية.',
        packages: [
            { name: 'اشتراك شهر كامل', price: 120, duration: 'شهر' },
            { name: 'اشتراك 3 أشهر', price: 320, duration: '3 أشهر' }
        ]
    },
    {
        id: 'youtube_premium',
        name: 'YouTube Premium (يوتيوب بريميوم)',
        category: 'entertainment',
        badge: 'بدون إعلانات 🎵',
        banner: 'https://images.unsplash.com/photo-1611162617474-5baf9e8ba09a?auto=format&fit=crop&w=1200&q=80',
        description: 'يوتيوب بدون إعلانات مع تشغيل في الخلفية وميوزك.',
        packages: [
            { name: 'اشتراك شهر', price: 75, duration: 'شهر' },
            { name: 'اشتراك 6 أشهر', price: 350, duration: '6 أشهر' }
        ]
    },
    {
        id: 'spotify',
        name: 'Spotify Premium (سبوتيفاي)',
        category: 'entertainment',
        badge: 'موسيقى لاפו 🎧',
        banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
        description: 'استماع موسيقى بجودة عالية بدون إعلانات.',
        packages: [
            { name: 'اشتراك شهر', price: 80, duration: 'شهر' },
            { name: 'اشتراك 3 أشهر', price: 210, duration: '3 أشهر' }
        ]
    }
];

// --- بيانات منصات السوشيال ميديا الـ 18 ---
const smmPlatforms = [
    {
        id: 'tiktok',
        name: 'تيك توك (TikTok)',
        banner: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '101', name: 'متابعين تيك توك (جودة عالية)', category: 'متابعين', min: 100, max: 50000, pricePer1k: 95 },
            { id: '102', name: 'لايكات تيك توك متفاعلة', category: 'تفاعل', min: 100, max: 100000, pricePer1k: 35 },
            { id: '103', name: 'مشاهدات تيك توك (سريع جداً)', category: 'مشاهدات', min: 1000, max: 1000000, pricePer1k: 5 }
        ]
    },
    {
        id: 'instagram',
        name: 'انستقرام (Instagram)',
        banner: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '201', name: 'متابعين انستقرام ضمان 30 يوم', category: 'متابعين', min: 100, max: 20000, pricePer1k: 110 },
            { id: '202', name: 'لايكات منشورات انستقرام', category: 'تفاعل', min: 50, max: 50000, pricePer1k: 40 },
            { id: '203', name: 'مشاهدات ريلز انستقرام', category: 'مشاهدات', min: 500, max: 500000, pricePer1k: 10 }
        ]
    },
    {
        id: 'telegram',
        name: 'تليجرام (Telegram)',
        banner: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '301', name: 'أعضاء قناة تليجرام حقيقيين', category: 'متابعين', min: 100, max: 30000, pricePer1k: 130 },
            { id: '302', name: 'مشاهدات منشورات تليجرام', category: 'مشاهدات', min: 100, max: 100000, pricePer1k: 8 }
        ]
    },
    {
        id: 'youtube',
        name: 'يوتيوب (YouTube)',
        banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '401', name: 'مشتركين قناة يوتيوب', category: 'متابعين', min: 100, max: 10000, pricePer1k: 350 },
            { id: '402', name: 'ساعات مشاهدة يوتيوب (حقيقية)', category: 'تفاعل', min: 500, max: 4000, pricePer1k: 450 }
        ]
    },
    {
        id: 'facebook',
        name: 'فيسبوك (Facebook)',
        banner: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '501', name: 'متابعين صفحة فيسبوك', category: 'متابعين', min: 100, max: 20000, pricePer1k: 150 },
            { id: '502', name: 'لايكات منشور فيسبوك', category: 'تفاعل', min: 100, max: 10000, pricePer1k: 50 }
        ]
    },
    {
        id: 'twitter',
        name: 'إكس / تويتر (X)',
        banner: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '601', name: 'متابعين إكس (Twitter X)', category: 'متابعين', min: 100, max: 10000, pricePer1k: 180 }
        ]
    },
    {
        id: 'snapchat',
        name: 'سناب شات (Snapchat)',
        banner: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '701', name: 'مشتركين سناب شات', category: 'متابعين', min: 100, max: 10000, pricePer1k: 200 }
        ]
    },
    {
        id: 'twitch',
        name: 'تويتش (Twitch)',
        banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '801', name: 'متابعين قناة تويتش', category: 'متابعين', min: 100, max: 5000, pricePer1k: 120 }
        ]
    },
    {
        id: 'kwai',
        name: 'كواي (Kwai)',
        banner: 'https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '901', name: 'متابعين كواي', category: 'متابعين', min: 100, max: 10000, pricePer1k: 90 }
        ]
    },
    {
        id: 'linkedin',
        name: 'لينكد إن (LinkedIn)',
        banner: 'https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1001', name: 'متابعين حساب لينكد إن', category: 'متابعين', min: 50, max: 5000, pricePer1k: 250 }
        ]
    },
    {
        id: 'discord',
        name: 'ديسكورد (Discord)',
        banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1101', name: 'أعضاء سيرفر ديسكورد متفاعلين', category: 'متابعين', min: 100, max: 10000, pricePer1k: 140 }
        ]
    },
    {
        id: 'spotify_smm',
        name: 'سبوتيفاي (Spotify SMM)',
        banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1201', name: 'استماع أغاني سبوتيفاي', category: 'تفاعل', min: 1000, max: 100000, pricePer1k: 30 }
        ]
    },
    {
        id: 'soundcloud',
        name: 'ساوند كلاود (SoundCloud)',
        banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1301', name: 'استماع تراكات ساوند كلاود', category: 'تفاعل', min: 1000, max: 50000, pricePer1k: 25 }
        ]
    },
    {
        id: 'pinterest',
        name: 'بينترست (Pinterest)',
        banner: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1401', name: 'متابعين بينترست', category: 'متابعين', min: 100, max: 10000, pricePer1k: 110 }
        ]
    },
    {
        id: 'threads',
        name: 'ثريدز (Threads)',
        banner: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1501', name: 'متابعين ثريدز', category: 'متابعين', min: 100, max: 10000, pricePer1k: 100 }
        ]
    },
    {
        id: 'reddit',
        name: 'ريديت (Reddit)',
        banner: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1601', name: 'أعضاء ومتابعين ريديت', category: 'متابعين', min: 50, max: 5000, pricePer1k: 160 }
        ]
    },
    {
        id: 'kick',
        name: 'كيك (Kick)',
        banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1701', name: 'متابعين قناة كيك (Kick)', category: 'متابعين', min: 100, max: 10000, pricePer1k: 130 }
        ]
    },
    {
        id: 'trovo',
        name: 'تروفو (Trovo)',
        banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
        services: [
            { id: '1801', name: 'متابعين تروفو', category: 'متابعين', min: 100, max: 10000, pricePer1k: 110 }
        ]
    }
];

const SMM_ICONS = {
    tiktok: "fab fa-tiktok text-pink-400",
    facebook: "fab fa-facebook text-blue-500",
    instagram: "fab fa-instagram text-rose-400",
    youtube: "fab fa-youtube text-red-500",
    telegram: "fab fa-telegram text-sky-400",
    twitter: "fab fa-x-twitter text-gray-200",
    snapchat: "fab fa-snapchat text-yellow-400",
    twitch: "fab fa-twitch text-purple-400",
    kwai: "fas fa-video text-orange-400",
    linkedin: "fab fa-linkedin text-sky-600",
    discord: "fab fa-discord text-indigo-400",
    spotify_smm: "fab fa-spotify text-emerald-400",
    soundcloud: "fab fa-soundcloud text-amber-500",
    pinterest: "fab fa-pinterest text-red-600",
    threads: "fas fa-at text-gray-200",
    reddit: "fab fa-reddit text-orange-500",
    kick: "fas fa-play-circle text-emerald-400",
    trovo: "fas fa-gamepad text-green-500"
};

// --- بيانات وسائل الدفع المعتمدة (بدون أورانج كاش) ---
const PAYMENT_METHODS_DATA = {
    vodafone: { title: "فودافون كاش", type: "copy", value: "01020323432", instruction: "قم بالتحويل إلى رقم محفظة فودافون كاش المعتمد:" },
    etisalat: { title: "اتصالات كاش", type: "copy", value: "01146691073", instruction: "قم بالتحويل إلى رقم محفظة اتصالات كاش المعتمد:" },
    instapay: { title: "إنستاباي (InstaPay)", type: "copy", value: "01146691073", instruction: "قم بالتحويل عبر تطبيق إنستاباي إلى الرقم التالي:" },
    telda: { title: "تيلدا Telda", type: "copy", value: "@saherbeh", instruction: "قم بالتحويل عبر تطبيق تلدا إلى المعرّف الشخصي التالي:" },
    binance: { title: "باينانس باي", type: "html", html: `<div class="p-3 bg-slate-950 border border-amber-500/30 rounded-xl text-center"><p class="text-xs text-amber-300 font-bold">الدفع عبر Binance Pay متاح بالعملات الرقمية (USDT).</p></div>` },
    paypal: { title: "PayPal", type: "copy", value: "sahermohamed123456@gmail.com", instruction: "قم بالتحويل إلى بريد PayPal المعتمد:" },
    redotpay: { title: "RedotPay", type: "copy", value: "1217212555", instruction: "قم بالتحويل الداخلي عبر حساب RedotPay إلى المعرف:" },
    cards: { title: "بطاقة بنكية", type: "html", html: `<div class="p-2.5 bg-slate-950 rounded-xl text-center"><p class="text-xs text-sky-400 font-bold">Visa • Mastercard • Google Pay • Apple Pay</p></div>` },
    tamara: { title: "تمارة Tamara", type: "bnpl", text: "الشراء الآن والدفع لاحقاً عبر تمارة." },
    valu: { title: "فاليو valU", type: "bnpl", text: "خدمة تقسيط المشتريات عبر فاليو." },
    souhoola: { title: "سهولة", type: "bnpl", text: "خدمة التقسيط عبر سهولة." },
    tabby: { title: "تابي Tabby", type: "bnpl", text: "قسم مشترياتك على 4 دفعات بدون فوائد." },
    aman: { title: "أمان Aman", type: "bnpl", text: "خطط تقسيط أمان." },
    forsa: { title: "فرصة Forsa", type: "bnpl", text: "تقسيط فوري عبر فرصة." }
};

const verifiedReviews = [
    { name: "أحمد عبد الرحمن", service: "ChatGPT Plus", text: "التفعيل تم على إيميلي الشخصي في أقل من نص ساعة.", date: "أكتوبر 2026" },
    { name: "محمد طارق", service: "ببجي 3850 UC", text: "الشدات وصلت فوراً بعد التحويل بالـ ID.", date: "أكتوبر 2026" },
    { name: "محمود إبراهيم", service: "بطاقة VCC (50$)", text: "استلمت بيانات الكارت واشتغلت في إعلانات الفيسبوك بدون رفض.", date: "أكتوبر 2026" },
    { name: "سارة م.", service: "Canva Pro Admin", text: "الحساب شغال بصلاحيات الأدمن كاملة.", date: "أكتوبر 2026" }
];

const egyptianNames = ["أحمد م.", "محمد س.", "كريم ع.", "يوسف ط.", "عمر ح.", "سارة م.", "محمود خ."];
const purchaseTemplates = [
    { act: "طلب Google Gemini Pro", icon: '✨' },
    { act: "شحن 3850 UC ببجي موبايل", icon: '🎮' },
    { act: "طلب بطاقة افتراضية VCC", icon: '💳' },
    { act: "تفعيل اشتراك ChatGPT Plus", icon: '🤖' }
];

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all transform duration-300 -translate-x-full flex items-center gap-2 ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('-translate-x-full'), 10);
    setTimeout(() => { toast.classList.add('-translate-x-full'); setTimeout(() => toast.remove(), 300); }, 3200);
}

function initCountdown() {
    let totalSeconds = 5 * 3600 + 42 * 60 + 19;
    setInterval(() => {
        if (totalSeconds <= 0) totalSeconds = 6 * 3600;
        totalSeconds--;
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        const el = document.getElementById('promoCountdown');
        if (el) el.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function updateSlider() {
    const track = document.getElementById('sliderTrack');
    if (track) track.style.transform = `translateX(${currentSlide * 100}%)`;
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlide));
}

function goToSlide(index) { currentSlide = index; updateSlider(); }

function triggerSocialProof() {
    const popup = document.getElementById('socialProofPopup');
    if (!popup) return;
    const tpl = purchaseTemplates[Math.floor(Math.random() * purchaseTemplates.length)];
    const name = egyptianNames[Math.floor(Math.random() * egyptianNames.length)];
    const userEl = document.getElementById('proofUser');
    const actEl = document.getElementById('proofAction');
    const timeEl = document.getElementById('proofTime');
    const iconEl = document.getElementById('proofIcon');
    if (userEl) userEl.innerText = name;
    if (actEl) actEl.innerText = tpl.act;
    if (timeEl) timeEl.innerText = `منذ ${Math.floor(Math.random() * 45) + 5} ثانية`;
    if (iconEl) iconEl.innerText = tpl.icon;
    popup.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => popup.classList.add('translate-y-24', 'opacity-0'), 4500);
    setTimeout(triggerSocialProof, Math.floor(Math.random() * 10000) + 12000);
}

function initVisitorCounter() {
    let count = localStorage.getItem('migo_visitors_v4');
    if (!count) count = 1420 + Math.floor(Math.random() * 20);
    else count = parseInt(count, 10) + 1;
    localStorage.setItem('migo_visitors_v4', count);
    const counterEl = document.getElementById('visitorCount');
    if (counterEl) counterEl.innerText = Number(count).toLocaleString();
}

function loadCartFromStorage() {
    try { cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; } catch (e) { cart = []; }
    updateCartUI();
}

function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartUI();
}

function addToCart(item) {
    cart.push({ ...item, cartId: Date.now() + Math.random() });
    saveCartToStorage();
    showToast(`تمت إضافة "${item.name}" إلى السلة 🛒`);
}

function removeFromCart(cartId) {
    cart = cart.filter(i => i.cartId !== cartId);
    saveCartToStorage();
    showToast('تم حذف العنصر من السلة');
}

function openCartModal() {
    const m = document.getElementById('cartModal');
    if (!m) return;
    m.classList.remove('hidden'); m.classList.add('flex');
    updateCartUI();
}

function closeCartModal() {
    const m = document.getElementById('cartModal');
    if (!m) return;
    m.classList.add('hidden'); m.classList.remove('flex');
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    if (badge) badge.innerText = cart.length;
    const container = document.getElementById('cartItemsContainer');
    if (container) {
        if (cart.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">سلة المشتريات فارغة</div>';
        } else {
            container.innerHTML = cart.map(item => `
                <div class="bg-slate-950 border border-slate-700 rounded-xl p-2.5 flex justify-between items-center gap-2">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                        <div class="text-[10px] text-sky-400 truncate">${item.details || ''}</div>
                    </div>
                    <div class="text-left shrink-0">
                        <div class="text-xs font-black text-amber-400 font-mono">${Number(item.price).toLocaleString()} ج.م</div>
                        <button onclick="removeFromCart(${item.cartId})" class="text-[10px] text-red-400 cursor-pointer">حذف</button>
                    </div>
                </div>
            `).join('');
        }
    }
    calculateCartTotal();
}

function applyCartCoupon() {
    const inp = document.getElementById('cartCouponInput');
    if (!inp) return;
    const code = inp.value.trim().toUpperCase();
    const coupon = validCoupons[code];
    if (!coupon) return showToast('كود غير صالح', 'error');
    appliedCoupon = { code: code, discount: coupon.discount };
    const statusEl = document.getElementById('cartCouponStatus');
    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.className = 'text-[10px] font-bold text-emerald-400';
        statusEl.innerText = `✅ تم تطبيق خصم ${(coupon.discount * 100)}% بنجاح`;
    }
    calculateCartTotal();
}

function calculateCartTotal() {
    let subtotal = cart.reduce((sum, item) => sum + Number(item.price), 0);
    const subEl = document.getElementById('cartSubtotal');
    if (subEl) subEl.innerText = subtotal.toLocaleString() + ' ج.م';
    
    const discRow = document.getElementById('cartDiscountRow');
    const discAmtEl = document.getElementById('cartDiscountAmount');
    const totEl = document.getElementById('cartTotal');

    if (appliedCoupon && subtotal > 0) {
        let discountAmt = subtotal * appliedCoupon.discount;
        if (discRow) discRow.classList.remove('hidden');
        if (discAmtEl) discAmtEl.innerText = '-' + discountAmt.toLocaleString() + ' ج.م';
        if (totEl) totEl.innerText = (subtotal - discountAmt).toLocaleString() + ' ج.م';
    } else {
        if (discRow) discRow.classList.add('hidden');
        if (totEl) totEl.innerText = subtotal.toLocaleString() + ' ج.م';
    }
}

function renderCoinsAndStars() {
    const ttContainer = document.getElementById('tiktokCoinsGrid');
    if (ttContainer) {
        ttContainer.innerHTML = tiktokCoinsList.map(c => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-700">
                <span class="text-xs font-bold text-gray-200">🪙 ${c.coins.toLocaleString()} عملة</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-extrabold text-amber-400 font-mono">${c.price.toLocaleString()} ج.م</span>
                    <button onclick="openPlayerIdModal('تيك توك كوينز', '${c.coins} عملة', ${c.price}, true, 'tiktok')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                    <button onclick="openPlayerIdModal('تيك توك كوينز', '${c.coins} عملة', ${c.price}, false, 'tiktok')" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                </div>
            </div>
        `).join('');
    }
    const tgContainer = document.getElementById('telegramStarsGrid');
    if (tgContainer) {
        tgContainer.innerHTML = telegramStarsList.map(s => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-700">
                <span class="text-xs font-bold text-gray-200">⭐ ${s.stars.toLocaleString()} نجمة</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-extrabold text-amber-400 font-mono">${s.price.toLocaleString()} ج.م</span>
                    <button onclick="openPlayerIdModal('نجوم تليجرام', '${s.stars} نجمة', ${s.price}, true, 'telegram')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                    <button onclick="openPlayerIdModal('نجوم تليجرام', '${s.stars} نجمة', ${s.price}, false, 'telegram')" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                </div>
            </div>
        `).join('');
    }
}

function renderGames() {
    const container = document.getElementById('gamesCardsContainer');
    if (!container) return;
    container.innerHTML = gamesData.map(g => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
            <div class="h-28 sm:h-32 relative bg-cover bg-center" style="background-image: url('${g.banner}');">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                    <span class="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40 w-fit">${g.badge}</span>
                    <h3 class="font-extrabold text-sm sm:text-base text-white">${g.name}</h3>
                </div>
            </div>
            <div class="p-3 space-y-1.5 flex-1 bg-slate-900/60">
                ${g.packages.map(pkg => `
                    <div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span class="text-[11px] font-bold text-gray-200">${pkg.name}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.price.toLocaleString()} ج.م</span>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.name}', ${pkg.price}, true, '${g.id}')" class="bg-amber-500 text-slate-950 font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer">⚡</button>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.name}', ${pkg.price}, false, '${g.id}')" class="sky-btn font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer">🛒</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderLiveApps() {
    const container = document.getElementById('liveAppsContainer');
    if (!container) return;
    container.innerHTML = liveCoinsData.map(app => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
            <div class="h-28 sm:h-32 relative bg-cover bg-center" style="background-image: url('${app.banner}');">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                    <span class="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/40 w-fit">${app.badge}</span>
                    <h3 class="font-extrabold text-sm sm:text-base text-white">${app.name}</h3>
                </div>
            </div>
            <div class="p-3 space-y-1.5 flex-1 bg-slate-900/60">
                ${app.packages.map(pkg => `
                    <div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span class="text-[11px] font-bold text-gray-200">${pkg.name}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.price.toLocaleString()} ج.م</span>
                            <button onclick="openPlayerIdModal('${app.name}', '${pkg.name}', ${pkg.price}, true, '${app.id}')" class="bg-amber-500 text-slate-950 font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer">⚡</button>
                            <button onclick="openPlayerIdModal('${app.name}', '${pkg.name}', ${pkg.price}, false, '${app.id}')" class="sky-btn font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer">🛒</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderVccCards() {
    const container = document.getElementById('vccCardsContainer');
    if (!container) return;
    container.innerHTML = vccData.map(v => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
            <div class="h-28 relative bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80');">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                    <span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold w-fit">${v.badge}</span>
                    <h3 class="font-bold text-sm text-white">${v.name}</h3>
                </div>
            </div>
            <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                <p class="text-[10px] text-gray-400 mb-3">${v.description}</p>
                <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span class="text-sm font-extrabold text-amber-400 font-mono">${v.priceEgp.toLocaleString()} ج.م</span>
                    <button onclick="openVccModal('${v.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer">اطلب 💳</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openVccModal(vccId) {
    selectedVccItem = vccData.find(x => x.id === vccId);
    if (!selectedVccItem) return;
    const t = document.getElementById('vccModalTitle');
    const p = document.getElementById('vccModalPrice');
    if (t) t.innerText = selectedVccItem.name;
    if (p) p.innerText = `المبلغ: ${selectedVccItem.priceEgp.toLocaleString()} ج.م`;
    const m = document.getElementById('vccModal');
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

function closeVccModal() {
    const m = document.getElementById('vccModal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    selectedVccItem = null;
}

function submitVccModal(isExpress) {
    const em = document.getElementById('vccEmailInput');
    const email = em ? em.value.trim() : '';
    if (!email) return showToast('أدخل البريد الإلكتروني لاستلام بيانات البطاقة', 'error');
    const item = {
        id: selectedVccItem.id + '_' + Date.now(),
        name: selectedVccItem.name,
        type: 'vcc',
        price: selectedVccItem.priceEgp,
        details: `البريد: ${email}`
    };
    closeVccModal();
    if (isExpress) expressCheckout(item);
    else addToCart(item);
}

function renderProductivity() {
    const container = document.getElementById('productivityContainer');
    if (!container) return;
    const list = subscriptionsData.filter(s => s.category === 'design' || s.category === 'productivity');
    container.innerHTML = list.map(p => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
            <div class="h-24 relative bg-cover bg-center" style="background-image: url('${p.banner}');">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                    <span class="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold w-fit">${p.badge}</span>
                    <h3 class="font-bold text-xs sm:text-sm text-white">${p.name}</h3>
                </div>
            </div>
            <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                <p class="text-[10px] text-gray-400 mb-2">${p.description}</p>
                <select id="prod_pkg_${p.id}" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-[10px] text-sky-300 font-bold mb-2">
                    ${p.packages.map((pkg, idx) => `<option value="${idx}">${pkg.name} - ${pkg.price} ج.م</option>`).join('')}
                </select>
                <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span class="text-xs font-extrabold text-amber-400 font-mono">${p.packages[0].price.toLocaleString()} ج.م</span>
                    <div class="flex gap-1">
                        <button onclick="handleSubscriptionAction('${p.id}', true)" class="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                        <button onclick="handleSubscriptionAction('${p.id}', false)" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderEntertainment() {
    const container = document.getElementById('entertainmentCardsContainer');
    if (!container) return;
    const list = subscriptionsData.filter(s => s.category === 'entertainment');
    container.innerHTML = list.map(e => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
            <div class="h-24 relative bg-cover bg-center" style="background-image: url('${e.banner}');">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                    <span class="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold w-fit">${e.badge}</span>
                    <h4 class="font-bold text-xs sm:text-sm text-white">${e.name}</h4>
                </div>
            </div>
            <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                <p class="text-[10px] text-gray-400 mb-2">${e.description}</p>
                <select id="ent_pkg_${e.id}" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-[10px] text-purple-300 font-bold mb-2">
                    ${e.packages.map((pkg, idx) => `<option value="${idx}">${pkg.name} - ${pkg.price} ج.م</option>`).join('')}
                </select>
                <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span class="text-xs font-black text-amber-400 font-mono">${e.packages[0].price.toLocaleString()} ج.م</span>
                    <div class="flex gap-1.5">
                        <button onclick="handleSubscriptionAction('${e.id}', true)" class="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                        <button onclick="handleSubscriptionAction('${e.id}', false)" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAI() {
    const container = document.getElementById('aiCardsContainer');
    if (!container) return;
    const list = subscriptionsData.filter(s => s.category === 'ai');
    container.innerHTML = list.map(a => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
            <div class="h-24 relative bg-cover bg-center" style="background-image: url('${a.banner}');">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                    <span class="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold w-fit">${a.badge}</span>
                    <h4 class="font-bold text-xs sm:text-sm text-white">${a.name}</h4>
                </div>
            </div>
            <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                <p class="text-[10px] text-gray-400 mb-2">${a.description}</p>
                <select id="ai_pkg_${a.id}" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-[10px] text-indigo-300 font-bold mb-2">
                    ${a.packages.map((pkg, idx) => `<option value="${idx}">${pkg.name} - ${pkg.price} ج.م</option>`).join('')}
                </select>
                <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span class="text-xs font-black text-amber-400 font-mono">${a.packages[0].price.toLocaleString()} ج.م</span>
                    <div class="flex gap-1.5">
                        <button onclick="handleSubscriptionAction('${a.id}', true)" class="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                        <button onclick="handleSubscriptionAction('${a.id}', false)" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function handleSubscriptionAction(itemId, isExpress = false) {
    const item = subscriptionsData.find(s => s.id === itemId);
    if (!item) return;
    const selectEl = document.getElementById(`prod_pkg_${itemId}`) || document.getElementById(`ent_pkg_${itemId}`) || document.getElementById(`ai_pkg_${itemId}`);
    const pkgIndex = selectEl ? parseInt(selectEl.value, 10) : 0;
    const selectedPkg = item.packages[pkgIndex] || item.packages[0];

    const cartItem = {
        id: `${item.id}_${Date.now()}`,
        name: `${item.name} (${selectedPkg.name})`,
        type: item.category,
        price: selectedPkg.price,
        details: item.description
    };
    if (isExpress) expressCheckout(cartItem);
    else addToCart(cartItem);
}

function renderSMMPlatforms() {
    const grid = document.getElementById('smmPlatformsGrid');
    if (!grid || !smmPlatforms.length) return;
    if (!currentSMMPlatform) currentSMMPlatform = smmPlatforms[0];

    grid.innerHTML = smmPlatforms.map(p => {
        const iconClass = SMM_ICONS[p.id] || "fas fa-share-alt text-sky-400";
        const isActive = currentSMMPlatform && p.id === currentSMMPlatform.id;
        return `
            <button type="button" onclick="selectSMMPlatform('${p.id}')" class="p-2 rounded-xl ${isActive ? 'sky-active-tab' : 'sky-card border'} text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer">
                <i class="${iconClass} text-base"></i>
                <span class="text-[10px] font-bold text-white truncate">${p.name.split(' ')[0]}</span>
            </button>
        `;
    }).join('');
}

function selectSMMPlatform(pid) {
    currentSMMPlatform = smmPlatforms.find(p => p.id === pid) || smmPlatforms[0];
    renderSMMPlatforms();
    const titleEl = document.getElementById('selectedPlatformTitle');
    const iconContainer = document.getElementById('selectedPlatformIconContainer');
    const bannerImg = document.getElementById('selectedPlatformBannerImg');
    const catSelect = document.getElementById('smmCategorySelect');

    if (titleEl) titleEl.innerText = currentSMMPlatform.name;
    const iconClass = SMM_ICONS[currentSMMPlatform.id] || "fas fa-share-alt text-sky-400";
    if (iconContainer) iconContainer.innerHTML = `<i class="${iconClass} text-xl"></i>`;
    if (bannerImg && currentSMMPlatform.banner) bannerImg.src = currentSMMPlatform.banner;
    
    if (catSelect && currentSMMPlatform.services) {
        const categories = [...new Set(currentSMMPlatform.services.map(s => s.category || "عام"))];
        catSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
    onSMMCategoryChange();
}

function onSMMCategoryChange() {
    if (!currentSMMPlatform || !currentSMMPlatform.services) return;
    const catEl = document.getElementById('smmCategorySelect');
    const selectedCat = catEl ? catEl.value : null;
    const srvSelect = document.getElementById('smmServiceSelect');

    let availableServices = currentSMMPlatform.services;
    if (selectedCat) availableServices = currentSMMPlatform.services.filter(s => (s.category || "عام") === selectedCat);

    if (srvSelect) {
        srvSelect.innerHTML = availableServices.map(srv => `<option value="${srv.id}">#${srv.id} - ${srv.name} (${srv.pricePer1k} ج.م / 1k)</option>`).join('');
    }
    onSMMServiceChange();
}

function getCurrentSMMService() {
    if (!currentSMMPlatform || !currentSMMPlatform.services) return null;
    const srvEl = document.getElementById('smmServiceSelect');
    const selectedId = srvEl ? srvEl.value : null;
    return currentSMMPlatform.services.find(s => s.id === selectedId) || currentSMMPlatform.services[0];
}

function onSMMServiceChange() {
    const srv = getCurrentSMMService();
    if (!srv) return;
    const badgeId = document.getElementById('selectedServiceBadgeId');
    const limits = document.getElementById('smmLimitsNote');
    const meta = document.getElementById('smmServiceMeta');

    if (badgeId) badgeId.innerText = 'ID: #' + srv.id;
    if (limits) limits.innerText = `الحدود: ${srv.min} - ${srv.max}`;
    if (meta) {
        meta.innerHTML = `<span class="text-amber-400 font-mono font-bold">لكل 1,000: ${srv.pricePer1k} ج.م</span>`;
    }
    calculateSMMCost();
}

function calculateSMMCost() {
    const srv = getCurrentSMMService();
    if (!srv) return 0;
    const qtyInp = document.getElementById('smmQtyInput');
    const qty = Math.max(srv.min, parseFloat(qtyInp ? qtyInp.value : srv.min) || srv.min);
    const totalEGP = Math.round(((qty / 1000) * srv.pricePer1k) * 100) / 100;
    const priceEl = document.getElementById('smmPriceEGP');
    if (priceEl) priceEl.innerText = totalEGP.toFixed(2) + ' ج.م';
    return totalEGP;
}

function addSMMToCart() {
    const linkInp = document.getElementById('smmLinkInput');
    const qtyInp = document.getElementById('smmQtyInput');
    const link = linkInp ? linkInp.value.trim() : '';
    const qty = qtyInp ? parseFloat(qtyInp.value) : 0;
    const srv = getCurrentSMMService();
    if (!srv || !link) return showToast('أدخل الرابط أولاً', 'error');
    
    addToCart({ 
        id: 'smm_' + srv.id, 
        name: `${currentSMMPlatform.name} - ${srv.name}`, 
        type: 'smm', 
        price: calculateSMMCost(), 
        details: `الكمية: ${qty} | الرابط: ${link}` 
    });
}

function expressCheckoutSMM() {
    const linkInp = document.getElementById('smmLinkInput');
    const qtyInp = document.getElementById('smmQtyInput');
    const link = linkInp ? linkInp.value.trim() : '';
    const qty = qtyInp ? parseFloat(qtyInp.value) : 0;
    const srv = getCurrentSMMService();
    if (!srv || !link) return showToast('أدخل الرابط أولاً', 'error');
    
    expressCheckout({ 
        id: 'smm_' + srv.id, 
        name: `${currentSMMPlatform.name} - ${srv.name}`, 
        type: 'smm', 
        price: calculateSMMCost(), 
        details: `الكمية: ${qty} | الرابط: ${link}` 
    });
}

function populateModalGamesList() {
    const select = document.getElementById('modalSelectGame');
    if (!select) return;
    let optionsHtml = gamesData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    optionsHtml += liveCoinsData.map(app => `<option value="${app.id}">${app.name}</option>`).join('');
    optionsHtml += `<option value="tiktok">تيك توك كوينز</option><option value="telegram">نجوم تليجرام</option>`;
    select.innerHTML = optionsHtml;
}

function openPlayerIdModal(targetName, pkgLabel, price, isExpress = false, iconKey = 'pubg') {
    currentModalItem = { name: `${targetName} - ${pkgLabel}`, price: price, gameKey: iconKey };
    isExpressModal = isExpress;
    populateModalGamesList();
    
    const titleEl = document.getElementById('modalTargetTitle');
    const pkgEl = document.getElementById('modalTargetPkg');
    if (titleEl) titleEl.innerText = targetName;
    if (pkgEl) pkgEl.innerText = `الباقة: ${pkgLabel} (${price.toLocaleString()} ج.م)`;
    
    const select = document.getElementById('modalSelectGame');
    if (select) { select.value = iconKey; select.disabled = true; }
    
    const modal = document.getElementById('playerIdModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closePlayerIdModal() {
    const modal = document.getElementById('playerIdModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    currentModalItem = null;
}

function submitPlayerIdModal() {
    const idEl = document.getElementById('modalInputPlayerId');
    const playerId = idEl ? idEl.value.trim() : '';
    if (!playerId) return showToast('يرجى إدخال المعرف المطلوب!', 'error');

    const item = { 
        id: 'item_' + Date.now(), 
        name: currentModalItem.name, 
        type: 'game_coin', 
        price: currentModalItem.price, 
        details: `معرّف/حساب: ${playerId}` 
    };
    closePlayerIdModal();
    if (isExpressModal) expressCheckout(item);
    else addToCart(item);
}

function expressCheckout(item) {
    cart.push({ ...item, cartId: Date.now() + Math.random() });
    saveCartToStorage();
    proceedToCheckout();
}

function proceedToCheckout() {
    if (cart.length === 0) return showToast('السلة فارغة', 'error');
    const totTxt = document.getElementById('cartTotal');
    const chkTot = document.getElementById('checkoutTotalText');
    if (chkTot && totTxt) chkTot.innerText = totTxt.innerText;
    closeCartModal();
    const modal = document.getElementById('checkoutModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    selectedPayment = null;
}

function selectPaymentMethod(methodKey, displayName, btnElement) {
    selectedPayment = displayName;
    document.querySelectorAll('.pay-method-btn').forEach(btn => btn.classList.remove('border-sky-400', 'bg-slate-800'));
    if (btnElement) btnElement.classList.add('border-sky-400', 'bg-slate-800');
    
    const box = document.getElementById('checkoutDetailsBox');
    const title = document.getElementById('checkoutPayTitle');
    const content = document.getElementById('checkoutPayContent');
    if (box) box.classList.remove('hidden');
    if (title) title.innerText = displayName;

    const methodData = PAYMENT_METHODS_DATA[methodKey];
    if (content) {
        if (methodData && methodData.type === 'copy') {
            content.innerHTML = `${methodData.instruction}<br><b>${methodData.value}</b>`;
        } else if (methodData && methodData.html) {
            content.innerHTML = methodData.html;
        } else {
            content.innerHTML = `الدفع عبر <b>${displayName}</b> متاح.`;
        }
    }
    const confBtn = document.getElementById('confirmPaymentBtn');
    if (confBtn) confBtn.classList.remove('hidden');
}

function finalizeOrderWhatsApp() {
    if (!selectedPayment) return showToast('اختر وسيلة الدفع أولاً', 'error');
    const senderInput = document.getElementById('senderAccountInput');
    const senderAcc = senderInput ? senderInput.value.trim() : '';
    if (!senderAcc) return showToast('أدخل رقم المحفظة أو الحساب المحوّل منه', 'error');

    let msg = `طلب جديد من Migo AI Solution\n*طريقة الدفع:* ${selectedPayment}\n*الحساب المحوّل منه:* ${senderAcc}\n\n`;
    cart.forEach((item, index) => {
        msg += `${index + 1}. ${item.name} - ${item.price} ج.م\n`;
    });
    cart = [];
    saveCartToStorage();
    closeCheckoutModal();
    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function renderReviews() {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;
    container.innerHTML = verifiedReviews.map(r => `
        <div class="sky-card border p-3 rounded-2xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-1.5">
                    <span class="font-bold text-xs text-white">${r.name}</span>
                    <span class="text-amber-400 text-[10px]">★★★★★</span>
                </div>
                <p class="text-[11px] text-gray-300 mb-2">"${r.text}"</p>
            </div>
            <div class="pt-1.5 border-t border-slate-700 flex items-center justify-between text-[9px] text-gray-400">
                <span class="text-amber-400">✓ ${r.service}</span>
                <span>${r.date}</span>
            </div>
        </div>
    `).join('');
}

function toggleSidebar() { 
    const sb = document.getElementById('sidebarContainer');
    if (sb) sb.classList.toggle('hidden'); 
}

// التشغيل الشامل والفوري
window.onload = function() {
    try { initVisitorCounter(); } catch (e) {}
    try { initCountdown(); } catch (e) {}
    try { loadCartFromStorage(); } catch (e) {}
    try { renderCoinsAndStars(); } catch (e) {}
    try { renderLiveApps(); } catch (e) {}
    try { renderVccCards(); } catch (e) {}
    try { renderGames(); } catch (e) {}
    try { renderProductivity(); } catch (e) {}
    try { renderEntertainment(); } catch (e) {}
    try { renderAI(); } catch (e) {}
    try { renderSMMPlatforms(); selectSMMPlatform('tiktok'); } catch (e) {}
    try { renderReviews(); } catch (e) {}

    setInterval(() => { 
        currentSlide = (currentSlide + 1) % 3; 
        updateSlider(); 
    }, 5000);
    setTimeout(triggerSocialProof, 3500);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (window.onload) window.onload(); });
} else {
    if (window.onload) window.onload();
}
