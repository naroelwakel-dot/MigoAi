// ==============================================================================
// Migo AI Solution - smm.js
// محرك السوشيال ميديا (18 منصة أصلية) + البطاقات الافتراضية VCC (مع بطاقة القيمة المخصصة الحرة)
// ==============================================================================

// 1. البطاقات الافتراضية الدولية (Virtual Credit Cards - VCC) مع إضافة بطاقة القيمة المخصصة
const vccData = [
  {
    id: "vcc",
    name: "بطاقة VCC دولية (فيزا افتراضية)",
    balanceUsd: "حسب الطلب",
    priceEgp: 620,
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/725a5c22417b46109c5aa8a54e93f762.webp",
    badge: "تفعيل فوري 💳",
    description: "بطاقة فيزا افتراضية دولية تُفعّل الاشتراكات والحملات الإعلانية والشراء من المواقع العالمية، بالجنيه المصري مع كود التحقق 3DS.",
    packages: [
      { id: "vcc_10", name: "بطاقة برصيد 10$ — 620 ج.م", price: 620, usd: 10 },
      { id: "vcc_25", name: "بطاقة برصيد 25$ — 1,550 ج.م", price: 1550, usd: 25 },
      { id: "vcc_50", name: "بطاقة برصيد 50$ — 3,100 ج.م", price: 3100, usd: 50 },
      { id: "vcc_100", name: "بطاقة برصيد 100$ — 6,200 ج.م", price: 6200, usd: 100 },
      { id: "vcc_custom", name: "بطاقة بقيمة مخصصة (تحديد المبلغ عبر واتساب)", price: 100, usd: 1 }
    ]
  }
];

// 2. محرك خدمات السوشيال ميديا للمنصات الـ 20 (كاملة وبدون أي نقص)
const smmPlatforms = [
  {
    id: "tiktok",
    name: "تيك توك (TikTok)",
    icon: "fab fa-tiktok",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/8487df546d17404b8189206a03d8cf81.webp",
    services: [
      {
        id: "2410",
        name: "متابعين حقيقيين | ضمان عدم النقص 30 يوم",
        category: "متابعين",
        pricePer1k: 359.60,
        min: 1000,
        max: 100000,
        speed: "فوري وتلقائي ⚡",
        description: "سيرفر سريع بضمان عدم النقص لمدة شهر كامل."
      },
      {
        id: "2415",
        name: "متابعين فوري فائق السرعة",
        category: "متابعين",
        pricePer1k: 434.00,
        min: 1000,
        max: 50000,
        speed: "سرعة قصوى 🚀",
        description: "بدء فوري خلال دقائق بمعدل تدفق عالي."
      },
      {
        id: "2420",
        name: "لايكات تيك توك لحسابات حقيقية",
        category: "لايكات",
        pricePer1k: 75.00,
        min: 1000,
        max: 200000,
        speed: "فوري ⚡",
        description: "رفع التفاعل والوصول لإكسبلور."
      },
      {
        id: "2430",
        name: "مشاهدات فيديو تيك توك صاروخية",
        category: "مشاهدات",
        pricePer1k: 15.00,
        min: 1000,
        max: 1000000,
        speed: "فائق السرعة ⚡",
        description: "تسليم فوري بملايين المشاهدات لدعم التريند."
      }
    ]
  },
  {
    id: "facebook",
    name: "فيسبوك (Facebook)",
    icon: "fab fa-facebook",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/e519b9e2348340d5b51cae0c2882345b.webp",
    services: [
      {
        id: "3101",
        name: "متابعين وتفاعل صفحات وبيجات (Page Followers)",
        category: "متابعين",
        pricePer1k: 240.00,
        min: 1000,
        max: 100000,
        speed: "مستقر ⚡",
        description: "زيادة موثوقة لصفحات الأعمال والبروفايلات الاحترافية."
      },
      {
        id: "3105",
        name: "لايكات ورياكشنات منوعات بوستات",
        category: "لايكات",
        pricePer1k: 95.00,
        min: 1000,
        max: 50000,
        speed: "فوري ⚡",
        description: "إمكانية توزيع التفاعلات على المنشورات."
      }
    ]
  },
  {
    id: "instagram",
    name: "انستقرام (Instagram)",
    icon: "fab fa-instagram",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/4918fadac99c466faf761ddb2740c7a0.webp",
    services: [
      {
        id: "4101",
        name: "متابعين إنستغرام بضمان وجودة فائقة",
        category: "متابعين",
        pricePer1k: 195.00,
        min: 1000,
        max: 150000,
        speed: "سريع ⚡",
        description: "حسابات بمظهر حقيقي لتعزيز موثوقية الصفحة."
      },
      {
        id: "4105",
        name: "إعجابات ريلز وبوستات إنستغرام",
        category: "لايكات",
        pricePer1k: 45.00,
        min: 1000,
        max: 100000,
        speed: "فوري ⚡",
        description: "تفاعل مباشر لتحسين ظهور الريلز في التوصيات."
      }
    ]
  },
  {
    id: "youtube",
    name: "يوتيوب (YouTube)",
    icon: "fab fa-youtube",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/9a65ee2605ef4565a843042aa11835fa.webp",
    services: [
      {
        id: "5101",
        name: "مشتركين قنوات يوتيوب غير قابل للنقص",
        category: "مشتركين",
        pricePer1k: 850.00,
        min: 1000,
        max: 50000,
        speed: "آمن للقناة 🛡️",
        description: "مشتركون بجودة عالية للمساعدة في تحقيق شروط الربح."
      },
      {
        id: "5105",
        name: "مشاهدات يوتيوب حقيقية لتحقيق 4000 ساعة",
        category: "مشاهدات",
        pricePer1k: 220.00,
        min: 1000,
        max: 500000,
        speed: "طبيعي وآمن ⚡",
        description: "مشاهدات باحتفاظ عالي آمنة تماماً على إعلانات أدسنس."
      }
    ]
  },
  {
    id: "telegram",
    name: "تليجرام (Telegram)",
    icon: "fab fa-telegram",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/bc68344c93cc434180f1f241b56b6a60.webp",
    services: [
      {
        id: "6101",
        name: "أعضاء قنوات وجروبات تليجرام",
        category: "أعضاء",
        pricePer1k: 110.00,
        min: 1000,
        max: 200000,
        speed: "فوري ⚡",
        description: "إضافة فورية لقنوات البث ومجموعات النقاش."
      },
      {
        id: "6105",
        name: "مشاهدات منشورات القنوات (آخر 10 بوستات)",
        category: "مشاهدات",
        pricePer1k: 25.00,
        min: 1000,
        max: 100000,
        speed: "تلقائي ⚡",
        description: "توزيع المشاهدات تلقائياً على المنشورات الجديدة."
      }
    ]
  },
  {
    id: "twitter",
    name: "إكس / تويتر (Twitter / X)",
    icon: "fab fa-x-twitter",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/30be0b7cfe4048258b19055277e1d3c4.webp",
    services: [
      {
        id: "7101",
        name: "متابعين إكس (تويتر) بجودة عالية",
        category: "متابعين",
        pricePer1k: 580.00,
        min: 1000,
        max: 50000,
        speed: "مستقر ⚡",
        description: "حسابات بروفايل بصور وسيرة ذاتية."
      },
      {
        id: "7105",
        name: "إعادة تغريد (Retweet) ولايكات",
        category: "تفاعل",
        pricePer1k: 180.00,
        min: 1000,
        max: 20000,
        speed: "سريع ⚡",
        description: "دفع التغريدات للتريند وزيادة مدى الوصول."
      }
    ]
  },
  {
    id: "snapchat",
    name: "سناب شات (Snapchat)",
    icon: "fab fa-snapchat",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/06995d0dd75944f3821b18d73299e97e.webp",
    services: [
      {
        id: "8101",
        name: "متابعين منصة الأضواء والملفات العامة",
        category: "متابعين",
        pricePer1k: 720.00,
        min: 1000,
        max: 25000,
        speed: "آمن ⚡",
        description: "توسيع انتشار الستوري وملف التعريف العام."
      }
    ]
  },
  {
    id: "twitch",
    name: "تويتش (Twitch)",
    icon: "fab fa-twitch",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/04ca90beea9d4b21bb9b7ab509273669.webp",
    services: [
      {
        id: "9101",
        name: "متابعين قنوات تويتش للبث",
        category: "متابعين",
        pricePer1k: 160.00,
        min: 1000,
        max: 50000,
        speed: "فوري ⚡",
        description: "شروط شريك تويتش (Twitch Affiliate)."
      }
    ]
  },
  {
    id: "kwai",
    name: "كواي (Kwai)",
    icon: "fas fa-video",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b7353ef3ba1a484ea0a4e33b3bf81f69.webp",
    services: [
      {
        id: "10101",
        name: "متابعين ولايكات منصة كواي",
        category: "متابعين",
        pricePer1k: 140.00,
        min: 1000,
        max: 50000,
        speed: "سريع ⚡",
        description: "دعم المقاطع القصيرة في كواي."
      }
    ]
  },
  {
    id: "linkedin",
    name: "لينكد إن (LinkedIn)",
    icon: "fab fa-linkedin",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/8d35775695454c98a3f13521638940a5.webp",
    services: [
      {
        id: "11101",
        name: "متابعين وتوصيات صفحات الشركات والبروفايل",
        category: "متابعين",
        pricePer1k: 950.00,
        min: 1000,
        max: 20000,
        speed: "احترافي ⚡",
        description: "بناء ثقة الأعمال والمظهر المهني الموثوق."
      }
    ]
  },
  {
    id: "discord",
    name: "ديسكورد (Discord)",
    icon: "fab fa-discord",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/5a2ca3a143604ec69fa1c2a0e6ee8f7b.webp",
    services: [
      {
        id: "12101",
        name: "أعضاء سيرفرات ديسكورد (Online / Offline)",
        category: "أعضاء",
        pricePer1k: 260.00,
        min: 1000,
        max: 30000,
        speed: "فوري ⚡",
        description: "تنشيط وزيادة عدد مجتمع السيرفر."
      }
    ]
  },
  {
    id: "spotify_smm",
    name: "سبوتيفاي (Spotify)",
    icon: "fab fa-spotify",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/8826fb4260be49efa12745bd00d181b0.webp",
    services: [
      {
        id: "13101",
        name: "استماعات أغاني وقوائم تشغيل ومتابعين فنانين",
        category: "استماعات",
        pricePer1k: 120.00,
        min: 1000,
        max: 500000,
        speed: "مستقر ⚡",
        description: "رفع ترتيب التراك في خوارزميات الاستماع."
      }
    ]
  },
  {
    id: "soundcloud",
    name: "ساوند كلاود (SoundCloud)",
    icon: "fab fa-soundcloud",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/5ff451b5ae9c4b989cfea84a583ae538.webp",
    services: [
      {
        id: "14101",
        name: "تشغيلات ومتابعين ساوند كلاود",
        category: "استماعات",
        pricePer1k: 40.00,
        min: 1000,
        max: 200000,
        speed: "فوري ⚡",
        description: "زيادة بلاي ليست وتفاعل الأغاني."
      }
    ]
  },
  {
    id: "pinterest",
    name: "بينترست (Pinterest)",
    icon: "fab fa-pinterest",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/1d4bebb86cab461880de93e17ab58834.webp",
    services: [
      {
        id: "15101",
        name: "متابعين لوحات وحسابات بينترست",
        category: "متابعين",
        pricePer1k: 180.00,
        min: 1000,
        max: 30000,
        speed: "طبيعي ⚡",
        description: "زيادة حفظ وتداول البنز والتصاميم."
      }
    ]
  },
  {
    id: "threads",
    name: "ثريدز (Threads)",
    icon: "fas fa-at",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/11c8d91179df4d3498aefbb1cd1ef0ae.webp",
    services: [
      {
        id: "16101",
        name: "متابعين ثريدز ولايكات منشورات",
        category: "متابعين",
        pricePer1k: 290.00,
        min: 1000,
        max: 50000,
        speed: "فوري ⚡",
        description: "تنمية وتوسيع قاعدة المتابعين لحسابات ثريدز."
      }
    ]
  },
  {
    id: "reddit",
    name: "ريديت (Reddit)",
    icon: "fab fa-reddit",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/07563f9f07a041b19c62a65c9a815a9c.webp",
    services: [
      {
        id: "17101",
        name: "أبفوت بوستات وكارما (Upvotes & Karma)",
        category: "تفاعل",
        pricePer1k: 880.00,
        min: 500,
        max: 10000,
        speed: "حقيقي ⚡",
        description: "رفع البوستات في الصب ريديتس المستهدفة."
      }
    ]
  },
  {
    id: "kick",
    name: "كيك (Kick)",
    icon: "fas fa-play-circle",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/d43882fe6d814a219cdeebc4cbbb6061.webp",
    services: [
      {
        id: "18101",
        name: "متابعين قنوات كيك ومشاهدات بث مباشر",
        category: "متابعين",
        pricePer1k: 320.00,
        min: 1000,
        max: 40000,
        speed: "سريع ⚡",
        description: "تسريع التوثيق والانضمام لبرنامج صناع محتوى Kick."
      }
    ]
  },
  {
    id: "trovo",
    name: "تروفو (Trovo)",
    icon: "fas fa-gamepad",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/fc2613091ff6480aaaa64d29a6e52cb5.webp",
    services: [
      {
        id: "19101",
        name: "متابعين ومشاهدي قنوات Trovo Live",
        category: "متابعين",
        pricePer1k: 210.00,
        min: 1000,
        max: 30000,
        speed: "فوري ⚡",
        description: "دعم قنوات الجيمنج والبث التفاعلي على تروفو."
      }
    ]
  },
  {
    id: "whatsapp",
    name: "واتساب (WhatsApp)",
    icon: "fab fa-whatsapp",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/ace79d94ca724d648384c8c51698a632.webp",
    services: [
      { id: "3159", name: "اعضاء قناه واتساب [ اعضاء من جميع العالم ][ أعضاء حقيقيين 100% ][ سريعه ] لا توجد اعاده تعبئه", category: "أعضاء", pricePer1k: 63.72, min: 1000, max: 10000, speed: "سريع ⚡", description: "بدون ضمان ⚠️" },
      { id: "2794", name: "اعضاء قناة واتساب |🎯100% أعضاء حقيقيون |⚡السرعة +10 ألف/اليوم |🔥بداية فورية |✅30 يوم ضمان", category: "أعضاء", pricePer1k: 324.87, min: 1000, max: 500000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
      { id: "4185", name: "أعضاء قنوات WhatsApp | بدون نقص | 20K+ يوميًا | تعويض 30 يومًا ♻️ | الحد الأقصى 20K", category: "أعضاء", pricePer1k: 29.13, min: 1000, max: 20000, speed: "⚡", description: "مع ضمان ♻️" },
      { id: "4541", name: "اعضاء واتساب | 🔥بدون نقص | ⚡السرعة 20 ألف/يوم |✅30 يوم ضمان", category: "أعضاء", pricePer1k: 52.66, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
      { id: "4137", name: "تفاعلات منشورات قنوات واتساب ~ مزيج عشوائي [👍❤️😂😲😥🙏] الحد الأقصى 20 ألف ~ 10 آلاف/يوم ~ فوري ~ بدون ضمان ♻️", category: "تفاعل", pricePer1k: 2.29, min: 1000, max: 100000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
      { id: "3161", name: "تفاعل منشور قناة واتساب [عشوائي 👍 ❤️ 🔥 🎉 😁] [الحد الأقصى 100 ك] | فوري", category: "تفاعل", pricePer1k: 101.94, min: 1000, max: 100000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
      { id: "3165", name: "ؤتفاعل منشور قناة واتساب [ 🙏 ] [الحد الأقصى 100 ك] | فوري", category: "تفاعل", pricePer1k: 101.94, min: 1000, max: 100000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
      { id: "2801", name: "تفاعل واتساب مكس عشوائى | رمز👍❤️😂😲😥🙏|⚡السرعة +10 ألف/اليوم |🔥بداية فورية", category: "تفاعل", pricePer1k: 100.97, min: 1000, max: 100000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
      { id: "4188", name: "تصويتات استطلاع رأي واتساب ~ [A] ~ الحد الأقصى 20 ألف ~ 20 ألف/يوم ~ فوري", category: "تصويت", pricePer1k: 119.76, min: 1000, max: 20000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
    ]
  },
  {
    id: "googlemaps",
    name: "خرائط جوجل (Google Maps)",
    icon: "fas fa-map-marker-alt",
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/aa21e7a1b45d4f6c8dfa9a1dd5b5a99c.gif",
    services: [
      { id: "2734", name: "تقييمات خرائط جوجل |🎯حسابات مصرية |📊تقييم 5 نجوم |⚡السرعة +10 /اليوم |✅بدون ضمان", category: "تقييمات", pricePer1k: 45000.0, min: 1000, max: 1000, speed: "⚡", description: "بدون ضمان ⚠️" },
      { id: "2735", name: "تقييمات خرائط جوجل |🎯حسابات مصرية |📊تقييم 5 نجوم + تعليقات مخصصة |⚡السرعة +10 /اليوم |✅بدون ضمان", category: "تعليقات", pricePer1k: 49500.0, min: 1000, max: 1000, speed: "⚡", description: "بدون ضمان ⚠️" },
      { id: "2736", name: "تقييمات خرائط جوجل |🎯حسابات سعودية |📊تقييم 5 نجوم |⚡السرعة +10 /اليوم |✅7 ايام ضمان", category: "تقييمات", pricePer1k: 52500.0, min: 1000, max: 1000, speed: "⚡", description: "مع ضمان ♻️" },
      { id: "2737", name: "تقييمات خرائط جوجل |🎯حسابات سعودية |📊تقييم 5 نجوم + تعليقات مخصصة |⚡السرعة +10 /اليوم |✅ 7 ايام ضمان", category: "تعليقات", pricePer1k: 58500.0, min: 1000, max: 1000, speed: "⚡", description: "مع ضمان ♻️" },
      { id: "2738", name: "تقييمات خرائط جوجل |🎯حسابات كويتية |📊تقييم 5 نجوم |⚡السرعة +10 /اليوم |✅30 يوم ضمان", category: "تقييمات", pricePer1k: 97500.0, min: 1000, max: 1000, speed: "⚡", description: "مع ضمان ♻️" },
    ]
  }
];

// دالة حساب السعر التفاعلي بناءً على معرف الخدمة والكمية
function calculateSmmCost(serviceId, quantity) {
  let targetService = null;
  for (const plat of smmPlatforms) {
    const s = plat.services.find(srv => srv.id === serviceId);
    if (s) {
      targetService = s;
      break;
    }
  }

  if (!targetService) {
    return { valid: false, message: "الخدمة غير موجودة", totalCost: 0 };
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < targetService.min) {
    return {
      valid: false,
      message: `الحد الأدنى للطلب هو ${targetService.min.toLocaleString()}`,
      totalCost: 0
    };
  }

  if (qty > targetService.max) {
    return {
      valid: false,
      message: `الحد الأقصى للطلب هو ${targetService.max.toLocaleString()}`,
      totalCost: 0
    };
  }

  const cost = ((qty / 1000) * targetService.pricePer1k);
  const roundedCost = Math.round(cost * 100) / 100;

  return {
    valid: true,
    serviceName: targetService.name,
    pricePer1k: targetService.pricePer1k,
    quantity: qty,
    totalCost: roundedCost
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { vccData, smmPlatforms, calculateSmmCost };
} else {
  window.vccData = vccData;
  window.smmPlatforms = smmPlatforms;
  window.calculateSmmCost = calculateSmmCost;
}

// == Migo AI Solution - added 2026-10-31 from supplier SMM Scorpion (smmscorpion-media.xyz) ==
// New social-media services only. Price = supplier rate x1.5 (50% margin). Min shown 1000.
// Each id is the supplier's own service number, kept so an order can be traced back.
window.smmScorpionServices = [
  { platform: "tiktok", id: "4682", name: "متابعين تيك توك مصري و عرب حقيقي (من الاعلانات المموله| ⚡السرعة 1 الف/يوم | ✅30 يوم ضمان", category: "متابعين", pricePer1k: 365.33, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4687", name: "متابعين تيك توك مصرين و عرب حقيقيين|⚡السرعة 200-500 /يوم | ✅30 يوم ضمان", category: "متابعين", pricePer1k: 295.2, min: 1000, max: 10000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4331", name: "تيك توك | متابعين مصريين وعرب حقيقيين (من الإعلانات الممولة) | ضمان 30 يومًا ♻️", category: "متابعين", pricePer1k: 408.5, min: 1000, max: 20000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4329", name: "تيك توك | لايكات مصريين وعرب حقيقيين (من الإعلانات الممولة) | ضمان مدى الحياة ♻️", category: "لايكات", pricePer1k: 153.63, min: 1000, max: 20000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4694", name: "إعجابات تيك توك [جودة عالية \\+ حقيقية] [ضمان 30 يوم ♻️] [20-40 ألف إعجاب/يوم] [0-1 إعجاب/ساعة] [خدمة متنوعة]", category: "لايكات", pricePer1k: 102.28, min: 1000, max: 500000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4714", name: "لايكات تيك توك | [حسابات حقيقية 100%] | حد أقصى 10 مليون | 100 ألف/يوم | فوري | ضمان 30 يوم ♻️", category: "لايكات", pricePer1k: 92.0, min: 1000, max: 50000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "2941", name: "مشاهدات تيك توك [ بدء فوري ][ بدون نقص ][ سريعه][ لا يوجد اعاده تعبئه⛔ ]", category: "مشاهدات", pricePer1k: 6.57, min: 1000, max: 2147483647, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "tiktok", id: "2992", name: "مشاهدات تيك توك |🔥بدون نقص |⚡السرعة 10 مليون |✅90 يوم ضمان", category: "مشاهدات", pricePer1k: 6.2, min: 1000, max: 2147483647, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4761", name: "تعليقات تيك توك | عشوائي | حساب حقيقي | الحد الأقصى 10K | 10K يوميًا | فوري | ضمان ♻️ 30 يوم", category: "تعليقات", pricePer1k: 389.34, min: 1000, max: 10000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "tiktok", id: "4762", name: "تعليقات تيك توك | إيموجي | حساب حقيقي | الحد الأقصى 10K | 10K يوميًا | فوري | ضمان ♻️ 30 يوم", category: "تعليقات", pricePer1k: 389.34, min: 1000, max: 100000000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "2332", name: "متابعين انستجرام [مصرين 100%][جوده عاليه][سرعه متوسطه][8 - 10يوم][اعاده تعبئه 365 يوم] ♻️", category: "متابعين", pricePer1k: 360.93, min: 1000, max: 5000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "4799", name: "متابعين إنستغرام |🎯حسابات مصرية |⚡السرعة +100ل1000/اليوم |⛔ضمان بدون [ بدء 0ل24ساعه]", category: "متابعين", pricePer1k: 181.5, min: 1000, max: 5000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "instagram", id: "4754", name: "متابعين انستجرام | ميكس حقيقي (ضمان 30 يوم ♻️) فوري | سرعة يومية من 3 إلى 5 آلاف", category: "متابعين", pricePer1k: 98.85, min: 1000, max: 30000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "4426", name: "إعجابات إنستجرام [ ذكور 🧑 ] [ 100% مصريين 🇪🇬 ] [ جودة عالية ] [ ضمان 30 يوم ♻️ ] 50 ألف في اليوم", category: "لايكات", pricePer1k: 108.66, min: 1000, max: 20000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "3984", name: "لايكات انستجرام [فوري][جوده عاليه] إعادة التعبئة خلال 30 يومًا♻️", category: "لايكات", pricePer1k: 28.72, min: 1000, max: 500000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "3707", name: "لايكات انستجرام |فوري|✔السرعه 50الف في اليوم💥[جوده عاليه] ✅إعادة التعبئة خلال 30 يومًا♻️", category: "لايكات", pricePer1k: 18.75, min: 1000, max: 5000000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "2344", name: "تعليقات انستجرام [ مخصصة ][ جودة عالية ][ فورية ] بدون تعبئة تعبئه", category: "تعليقات", pricePer1k: 58.84, min: 1000, max: 100000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "instagram", id: "3291", name: "تعليقات مخصصة إنستغرام |✨جودة حقيقية |⚡السرعة +500 |✅30 يوم ضمان", category: "تعليقات", pricePer1k: 120.27, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "4791", name: "تعليقات انستجرام | عشوائي | حسابات عالية الجودة | 5ألف/يوم | بدون نقص | فوري | ضمان مدي الحياة ✅", category: "تعليقات", pricePer1k: 89.11, min: 1000, max: 10000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "instagram", id: "4298", name: "إنستجرام \\- مشاهدات (جميع الفيديوهات) ~ حد أقصى غير محدود ~ 500 ألف/يومياً ~ بدء فوري ~ بدون تعويض", category: "مشاهدات", pricePer1k: 0.14, min: 1000, max: 2147483647, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "facebook", id: "4127", name: "متابعين فيس بوك | الجوده صفحات مصري +اجنبي 🎯|ملف شخصي+صفحه|💥السرعه10000في اليوم|✅ضمان30يوم", category: "متابعين", pricePer1k: 49.38, min: 1000, max: 10000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "53", name: "اعجاب+متابعه فيس بوك💠/الجوده صفحات مصرين💯%/💥السرعه500/1000في اليوم /✅ضمان 30يوم", category: "متابعين", pricePer1k: 199.02, min: 1000, max: 28000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "4763", name: "متابعين فيس بوك مصرين🎯|ملف شخصي+صفحه|💥السرعه10000في اليوم|✅ضمان مدي 30يوم", category: "متابعين", pricePer1k: 82.5, min: 1000, max: 2000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "4599", name: "تعليقات اومشن 🥰✍️ فيس بوك |🎯حسابات مصريه متقراره💯%|الجوده حقيقيه |السرعه50الف في اليوم| ✅ضمان 30يوم", category: "تعليقات", pricePer1k: 112.5, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "4600", name: "تعليقات مخصصه✍️ فيس بوك |🎯حسابات مصريه متقراره 💯%|الجوده حقيقيه |السرعه50الف في اليوم| ✅ضمان 30يوم", category: "تعليقات", pricePer1k: 127.5, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "2118", name: "تعليقات شباب👨 مخصصه✍️ فيس بوك |🎯حسابات مصريه💯%|الجوده حقيقيه |السرعه50الف في اليوم| ✅ضمان 30يوم", category: "تعليقات", pricePer1k: 210.0, min: 1000, max: 30000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "4820", name: "إعجابات منشور فيسبوك حسابات مصري 🎯| رمز 👍❤️ |💥بدون نقص |⚡السرعة +5000 ألف/اليوم |✅ضمان مدي الحياه|بدا 0 ل3ساعات", category: "لايكات", pricePer1k: 112.5, min: 1000, max: 10000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "2887", name: "ريأكت فيسبوك لايك [👍]مصرين +مخفي][ اعاده تعبئه 30 يوم ][مزود الخدمه]", category: "لايكات", pricePer1k: 75.0, min: 1000, max: 15000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "2888", name: "ريأكت فيسبوك احببت [❤️]مصرين +مخفي][ اعاده تعبئه 30 يوم ][مزود الخدمه]", category: "لايكات", pricePer1k: 75.0, min: 1000, max: 15000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "facebook", id: "42", name: "مشاركات🫂 منشورت فيس بوك|بوستات فقط|🎯حسابات مصريه💯%| 👑جوده حقيقيه|✅ضمان مدي الحياه|بدون نقص نهائي", category: "مشاركات", pricePer1k: 15.0, min: 1000, max: 2147483647, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "4509", name: "مشتركين يوتيوب [مستخدمين حقيقيين من المهام] [بدون انخفاض] [30-100 يوميًا] [تعويض مدى الحياة ♻️] [0-24 ساعة]", category: "مشتركين", pricePer1k: 5972.44, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "4511", name: "مشتركين يوتيوب حقيقيين [مستخدمين حقيقيين من المهام] [3-10K يوميًا] [بدون انخفاض] [تعويض مدى الحياة ♻️] [وقت البدء:…", category: "مشتركين", pricePer1k: 6249.87, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "4708", name: "مشاهدات يوتيوب الفريدة | مشاهدات حقيقية ونشطة | المملكة العربية السعودية 🇸🇦 | مشاهدات وأجهزة حقيقية 100% | من 10K إلى…", category: "مشاهدات", pricePer1k: 167.87, min: 1000, max: 2147483647, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "3213", name: "مشتركين يوتيوب [ سريعه ][ 200 - 500 /لليوم ][ انخفاض منخفض ] اعاده تعبئة 30 يومًا ♻️", category: "مشتركين", pricePer1k: 3274.22, min: 1000, max: 100000, speed: "سريع ⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "3911", name: "إعجابات يوتيوب | حقيقي | 50 ألف/30 دقيقة | بدون انخفاض | 30 يوم ضمان | فوري ♻", category: "لايكات", pricePer1k: 59.64, min: 1000, max: 10000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "2673", name: "إعجابات فيديوهات قصيرة يوتيوب |✨جودة حقيقية |⚡السرعة +50 ألف/اليوم |✅30 يوم ضمان", category: "لايكات", pricePer1k: 585.28, min: 1000, max: 100000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "2691", name: "إعجابات يوتيوب |✨جودة حقيقية |⚡السرعة +50 ألف/اليوم |✅30 يوم ضمان", category: "لايكات", pricePer1k: 560.91, min: 1000, max: 75000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "4280", name: "مشاهدة وقت يوتيوب | من 15 دقيقة إلى 120 دقيقة + مدة الفيديو | أكثر من 1 ألف يوميًا | 100% بدون نقص | ضمان ♻️ 30 يوم |…", category: "مشاهدات", pricePer1k: 1325.78, min: 1000, max: 4000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "2630", name: "مشاهدات فيديوهات قصيرة يوتيوب | مصدر متنوع | +10 ألف/يوم | ضمان مدى الحياة | فوري ♻", category: "مشاهدات", pricePer1k: 63.44, min: 1000, max: 500000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "youtube", id: "2675", name: "تعليقات يوتيوب مخصصة للفيديوهات القصيرة |✨جودة حقيقية |⚡السرعة +10 ألف/اليوم |✅ضمان مدى الحياة", category: "تعليقات", pricePer1k: 654.66, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "telegram", id: "2399", name: "أعضاء تيليجرام عرب [ 0% انخفاض ][ فوري ][ مزود الخدمه ][ 2000 مشترك/ يوم ] لا يوجد ضمان 🇦🇪", category: "مشتركين", pricePer1k: 293.12, min: 1000, max: 1000000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "telegram", id: "2401", name: "أعضاء تيليجرام عرب [ 0% نقص ][ فوري ][ مزود الخدمه ][ 3000 مشترك في اليوم ] ضمان 60 يوم 🇦🇪", category: "مشتركين", pricePer1k: 147.12, min: 1000, max: 100000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "telegram", id: "3730", name: "أعضاء تليجرام حقيقي | بدون انخفاض | جودة عالية | حد أقصى 1 مليون | 50 ألف/يوم | ضمان مدى الحياة | فوري ♻", category: "أعضاء", pricePer1k: 581.38, min: 1000, max: 1000000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "telegram", id: "4416", name: "أعضاء تيليجرام [ عرب 🇦🇪 ] [ حد أقصى 100 ألف ] | جودة عالية | بدون نزول | فوري | ضمان 30 يوم ♻️ | 20 ألف/يوم", category: "أعضاء", pricePer1k: 62.72, min: 1000, max: 1000000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "telegram", id: "4418", name: "أعضاء تيليجرام [عرب 🇦🇪] [الحد الأقصى 100 ألف] | جودة عالية | بدون نقصان | بدء فوري | ضمان 90 يومًا ♻️ | 20 ألف يوميًا", category: "أعضاء", pricePer1k: 67.55, min: 1000, max: 1000000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "telegram", id: "4232", name: "تليجرام \\- ردود فعل مختلطة إيجابية | 👍🤩🎉🔥❤️🥰👏🏻 \\+ مشاهدات مجانية | الأرخص ❌", category: "مشاهدات", pricePer1k: 1.65, min: 1000, max: 30000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "telegram", id: "4234", name: "تليجرام \\- ردود فعل بريميوم مختلطة إيجابية | 💯❤️‍🔥🤡🕊🐳 \\+ مشاهدات مجانية | رخيص", category: "مشاهدات", pricePer1k: 1.65, min: 1000, max: 30000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "telegram", id: "3140", name: "تفاعلات اجابيه عشوائية تيليجرام [👍❤️👏🔥🥰🤩🎉😁] \\+ المشاهدات | فوري", category: "مشاهدات", pricePer1k: 3.45, min: 1000, max: 1000000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "telegram", id: "2596", name: "تفاعل تليجرام إيجابى مكس [👍 ❤️ 🔥 🎉🤩 😁]", category: "تفاعل", pricePer1k: 13.96, min: 1000, max: 1000000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "telegram", id: "4236", name: "تليجرام \\- ردود فعل 👍", category: "أخرى", pricePer1k: 1.65, min: 1000, max: 1000000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "twitter", id: "2475", name: "إعجابات تويتر حقيقية [ فورية ][ انخفاض بسيط جدًا ] إعادة تعبئة خلال 60 يومًا ♻️⚡️", category: "لايكات", pricePer1k: 117.69, min: 1000, max: 50000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "twitter", id: "3809", name: "مشاهدات تغريدات/فيديوهات تويتر | سريع | انخفاض منخفض | | إعادة تعبئة لمدة 30 يوم♻️", category: "مشاهدات", pricePer1k: 0.32, min: 1000, max: 217545811, speed: "سريع ⚡", description: "مع ضمان ♻️" },
  { platform: "twitter", id: "2472", name: "مشاهدات تويتر [ تغريدات \\- فيديوهات ] [ سريع ⚡ ] إعادة تعبئة 90 يوم ♻️", category: "مشاهدات", pricePer1k: 0.81, min: 1000, max: 217545811, speed: "سريع ⚡", description: "مع ضمان ♻️" },
  { platform: "twitter", id: "2477", name: "🇸🇦 إعجابات تويتر [عرب][الحد الأقصى 1000 إعجاب][ جودة عالية ][ فوري ][ سريع ] اعادع تعبئة 30 يوم♻️", category: "لايكات", pricePer1k: 764.97, min: 1000, max: 1000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "twitter", id: "4787", name: "متابعون على تويتر ~ الحد الأقصى 1000 ~ 1000 متابع يوميًا ~ فوري ~ بدون ضمان", category: "متابعين", pricePer1k: 67.28, min: 1000, max: 5000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "twitter", id: "4162", name: "🇸🇦 لايكات تويتر عربية | الحد الأقصى 1000 | جودة عالية | سريعة | بدون إعادة تعبئة", category: "لايكات", pricePer1k: 802.83, min: 1000, max: 1000, speed: "سريع ⚡", description: "بدون ضمان ⚠️" },
  { platform: "twitter", id: "2466", name: "رتويت تويتر [جودة عالية][سريع][ بدء فوري] إعادة تعبئة 30 يوم ♻️⚡️", category: "أخرى", pricePer1k: 117.69, min: 1000, max: 100000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "twitter", id: "2465", name: "رتويت تويتر حقيقي [جودة عالية] سريع ⚡", category: "أخرى", pricePer1k: 111.81, min: 1000, max: 100000, speed: "سريع ⚡", description: "بدون ضمان ⚠️" },
  { platform: "snapchat", id: "4357", name: "سناب شات \\- متابعين | مستخدمون حقيقيون 100% | الحد الأقصى: 5 آلاف | 100–500/يوم | فوري | ضمان 30 يومًا ♻️", category: "متابعين", pricePer1k: 1293.69, min: 1000, max: 5000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "snapchat", id: "4359", name: "سناب شات \\- لايكات \\+ مشاهدات | مستخدمون حقيقيون 100% | الحد الأقصى: 5 آلاف | 100–500/يوم | فوري | ضمان 30 يومًا ♻️", category: "لايكات", pricePer1k: 1034.95, min: 1000, max: 5000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "snapchat", id: "2488", name: "متابعين سناب شات [ الحد الأقصى 12 ألف ] إعادة تعبئة لمدة 30 يوم♻️", category: "متابعين", pricePer1k: 1588.77, min: 1000, max: 10000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "snapchat", id: "2487", name: "اعجابات سناب شات عرب 🇸🇦 [ الحد الأقصى 50 الف ] إعادة تعبئة خلال 30 يومًا ♻️", category: "لايكات", pricePer1k: 941.5, min: 1000, max: 50000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3349", name: "متابعون كواي |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "متابعين", pricePer1k: 175.26, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3350", name: "لايكات كواي |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "لايكات", pricePer1k: 86.14, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3357", name: "لايكات كواي [بث مباشر] |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "لايكات", pricePer1k: 209.43, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3360", name: "لايكات تعليق كواي |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "لايكات", pricePer1k: 224.28, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3351", name: "تعليقات كواي عشوائي |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "تعليقات", pricePer1k: 276.25, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3353", name: "تعليقات كواي مخصصة |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "تعليقات", pricePer1k: 289.63, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3354", name: "تعليقات كواي عشوائي [بث مباشر] |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "تعليقات", pricePer1k: 386.17, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3352", name: "مشاركات كواي |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "مشاركات", pricePer1k: 59.41, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3356", name: "مشاركات كواي [بث مباشر] |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "مشاركات", pricePer1k: 151.5, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "kwai", id: "3361", name: "حفظ كواي |🎯100% عرب |⚡السرعة + 10 ألف/اليوم |✅30 يوم ضمان", category: "حفظ", pricePer1k: 99.52, min: 1000, max: 1000000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "linkedin", id: "4079", name: "متابعو ملف LinkedIn الشخصي ~ [مستخدمون حقيقيون 100%] ~ الحد الأقصى 10 آلاف ~ 500-1000 يومياً ~ فوري ~ ❌ لا يوجد تعويض…", category: "متابعين", pricePer1k: 543.18, min: 1000, max: 10000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "linkedin", id: "4081", name: "متابعون لصفحة الشركة على LinkedIn ~ [مستخدمون حقيقيون 100%] ~ الحد الأقصى 50 ألفاً ~ 500-1000 يومياً ~ فوري ~ لا يوجد…", category: "متابعين", pricePer1k: 543.18, min: 1000, max: 50000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "linkedin", id: "4078", name: "إعجابات لمنشورات LinkedIn ~ [مستخدمون حقيقيون 100%] ~ الحد الأقصى 10 آلاف ~ 500-1000 يومياً ~ تنفيذ فوري ~ ضمان إعادة…", category: "لايكات", pricePer1k: 790.08, min: 1000, max: 10000, speed: "فوري ⚡", description: "مع ضمان ♻️" },
  { platform: "linkedin", id: "4085", name: "إعجابات لتعليقات LinkedIn ~ [مستخدمون حقيقيون 100%] ~ الحد الأقصى 5 آلاف ~ 500-1000 يومياً ~ تنفيذ فوري ~ ❌ لا يوجد…", category: "لايكات", pricePer1k: 574.17, min: 1000, max: 5000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "linkedin", id: "4165", name: "متابعون بروفايل لينكدإن [عالميًا] | بدون نقصان | 500 يوميًا | ضمان لمدة 30 يومًا ♻️", category: "متابعين", pricePer1k: 2142.16, min: 1000, max: 10000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "linkedin", id: "4164", name: "لايكات لينكد إن | 30 ♻️ | ماكس 10 الف | العالمية | 50", category: "لايكات", pricePer1k: 417.33, min: 1000, max: 10000, speed: "⚡", description: "مع ضمان ♻️" },
  { platform: "linkedin", id: "4086", name: "مشاركة منشور LinkedIn ~ [مستخدمون حقيقيون 100%] ~ الحد الأقصى 20 ألفاً ~ 500-1000 يومياً ~ فوري ~ ❌ لا يوجد تعويض…", category: "مشاركات", pricePer1k: 760.46, min: 1000, max: 5000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "linkedin", id: "4083", name: "اتصالات LinkedIn ~ [مستخدمون حقيقيون 100%] ~ الحد الأقصى 5 آلاف ~ 500-1000 يومياً ~ فوري ~ ❌ لا يوجد تعويض (No Refill)", category: "أخرى", pricePer1k: 977.75, min: 1000, max: 5000, speed: "فوري ⚡", description: "بدون ضمان ⚠️" },
  { platform: "kick", id: "2493", name: "مشاهدات البث المباشر على [Kick] [الحد الأقصى 100,000] [لا يوجد نقص] [15 دقيقة]", category: "مشاهدات", pricePer1k: 7.06, min: 1000, max: 100000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "threads", id: "4088", name: "متابعين ثريدز|✨جودة حقيقية |🔥 حد أقصى 100 ألف |⛔بدون ضمان", category: "متابعين", pricePer1k: 362.58, min: 1000, max: 200000, speed: "⚡", description: "بدون ضمان ⚠️" },
  { platform: "threads", id: "4092", name: "تعليقات مخصصة ثريدز|✨جودة حقيقية |🔥 حد أقصى 500 |✅30 يوم ضمان", category: "تعليقات", pricePer1k: 1418.75, min: 1000, max: 1000, speed: "⚡", description: "مع ضمان ♻️" },
];
(function () {
  const list = window.smmScorpionServices || [];
  const platforms = window.smmPlatforms || [];
  const byId = {};
  platforms.forEach(function (p) { byId[p.id] = p; });
  list.forEach(function (s) {
    const p = byId[s.platform];
    if (!p) return;
    p.services = p.services || [];
    p.services.push({ id: s.id, name: s.name, category: s.category, pricePer1k: s.pricePer1k, min: s.min, max: s.max, speed: s.speed, description: s.description });
  });
})();
