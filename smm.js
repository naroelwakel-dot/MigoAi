// ==============================================================================
// Migo AI Solution - smm.js
// محرك السوشيال ميديا (18 منصة أصلية) + البطاقات الافتراضية VCC (مع بطاقة القيمة المخصصة الحرة)
// ==============================================================================

// 1. البطاقات الافتراضية الدولية (Virtual Credit Cards - VCC) مع إضافة بطاقة القيمة المخصصة
const vccData = [
  {
    id: "vcc_custom",
    name: "بطاقة VCC دولية (قيمة مخصصة حسب طلبك)",
    balanceUsd: "حسب الطلب",
    priceEgp: 620,
    banner: "Square-VCC-Product-Focused-Blog.jpg",
    badge: "اطلب قيمتك ⚡",
    description: "اطلب القيمة والمبلغ الذي تحتاجه بالضبط (1$ أو أكثر) لأي منصة أو إعلان.",
    packages: [
      { name: "بطاقة برصيد 10$ — 620 ج.م", price: 620, usd: 10 },
      { name: "بطاقة برصيد 25$ — 1,550 ج.م", price: 1550, usd: 25 },
      { name: "بطاقة برصيد 50$ — 3,100 ج.م", price: 3100, usd: 50 },
      { name: "بطاقة برصيد 100$ — 6,200 ج.م", price: 6200, usd: 100 },
      { name: "بطاقة بقيمة مخصصة (تحديد المبلغ عبر واتساب)", price: 100, usd: 1 }
    ]
  },
  {
    id: "vcc_10",
    name: "بطاقة VCC دولية (10$)",
    balanceUsd: 10,
    priceEgp: 620,
    banner: "Square-VCC-Product-Focused-Blog.jpg",
    badge: "تفعيل فوري 💳",
    description: "صالحة للشراء الدولي وتفعيل الاشتراكات والإعلانات."
  },
  {
    id: "vcc_25",
    name: "بطاقة VCC دولية (25$)",
    balanceUsd: 25,
    priceEgp: 1550,
    banner: "Square-VCC-Product-Focused-Blog.jpg",
    badge: "الأكثر طلباً 🔥",
    description: "مشحونة برصيد 25 دولار ومقبولة في مختلف المنصات العالمية."
  },
  {
    id: "vcc_50",
    name: "بطاقة VCC دولية (50$)",
    balanceUsd: 50,
    priceEgp: 3100,
    banner: "Square-VCC-Product-Focused-Blog.jpg",
    badge: "رصيد مميز ⚡",
    description: "مثالية للمدفوعات والحملات الإعلانية واشتراكات المطورين."
  },
  {
    id: "vcc_100",
    name: "بطاقة VCC دولية (100$)",
    balanceUsd: 100,
    priceEgp: 6200,
    banner: "Square-VCC-Product-Focused-Blog.jpg",
    badge: "باقة النخبة 💎",
    description: "بطاقة دفع رقمية برصيد 100 دولار كاملة مع كود التحقق 3DS."
  }
];

// 2. محرك خدمات السوشيال ميديا للمنصات الـ 18 (كاملة وبدون أي نقص)
const smmPlatforms = [
  {
    id: "tiktok",
    name: "تيك توك (TikTok)",
    icon: "fab fa-tiktok",
    banner: "images (6).jpeg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/c0e16665be694683868fc7438b25c6a6.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/00ebd3f891664f21b581ea04f8b0e508.svg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/cd96d463270d4b19907ad500617d444e.webp",
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
    banner: "telegram.jpeg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/b7f65e6d00114100861b2d4b426e8e8d.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/e53f9d7c51594918951d74b09e4df462.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/53b1235d5b03427880563a4c2a6142d3.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/68f6f8bf42e64eb3bf05bd8fda201041.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/034e4c1e460345938ab2d8808cf14780.svg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/3758368776d54e278455fcccee2990da.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/5f37ee56f9b64a4bb117aec3d72d7aa6.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/eb6f3234021643c5ba9a1b01ed8f4014.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/fbdaacac102e4e40b945a621d1823dd2.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/67e8050068ef47ee8eeb36aedfacc4c9.webp",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/eea8f67ce36847e6b914095d956f4838.svg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/f0d88eead015441db5d2a10317eb0b13.svg",
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
    banner: "https://cdn-public.eesel.ai/0cbaf9ba-8014-447a-b542-35590921b469/f5283076-5741-4392-be55-32f19bc3b411/64b817bb52fe483195413f57e9314c17.svg",
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
