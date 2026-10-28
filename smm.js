// ==============================================================================
// Migo AI Solution - smm.js
// محرك السوشيال ميديا (18 منصة ببانرات أفقية واقعية مخصصة) + البطاقات الافتراضية VCC
// ==============================================================================

// 1. البطاقات الافتراضية الدولية (Virtual Credit Cards - VCC)
const vccData = [
  {
    id: "vcc_10",
    name: "بطاقة VCC دولية (10$)",
    balanceUsd: 10,
    priceEgp: 620,
    banner: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80",
    badge: "تفعيل فوري 💳",
    description: "صالحة للشراء الدولي وتفعيل الاشتراكات والإعلانات."
  },
  {
    id: "vcc_25",
    name: "بطاقة VCC دولية (25$)",
    balanceUsd: 25,
    priceEgp: 1550,
    banner: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
    badge: "الأكثر طلباً 🔥",
    description: "مشحونة برصيد 25 دولار ومقبولة في مختلف المنصات العالمية."
  },
  {
    id: "vcc_50",
    name: "بطاقة VCC دولية (50$)",
    balanceUsd: 50,
    priceEgp: 3100,
    banner: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
    badge: "رصيد مميز ⚡",
    description: "مثالية للمدفوعات والحملات الإعلانية واشتراكات المطورين."
  },
  {
    id: "vcc_100",
    name: "بطاقة VCC دولية (100$)",
    balanceUsd: 100,
    priceEgp: 6200,
    banner: "https://images.unsplash.com/photo-1589758438368-0ad531db3366?auto=format&fit=crop&w=1200&q=80",
    badge: "باقة النخبة 💎",
    description: "بطاقة دفع رقمية برصيد 100 دولار كاملة مع كود التحقق 3DS."
  }
];

// 2. محرك خدمات السوشيال ميديا للمنصات الـ 18 (بانرات مخصصة لكل تطبيق)
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
    banner: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1611605698323-b1e99cfd37ea?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1579869847514-7c1a19d2d2ad?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
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
    banner: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80",
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
