// ==============================================================================
// برامج التصميم، الإنتاجية والترفيه الرقمي الشامل
// ==============================================================================

const productivityProducts = [
    // عائلة أدوبي كريتيف
    { id: 'prod_adobe_cc_1m', name: 'Adobe Creative Cloud (شهر)', tag: 'جميع التطبيقات 20+', price: 490, desc: 'حساب رسمي يشمل Photoshop, Illustrator, Premiere ومساحة سحابية', keywords: 'ادوبي كريتيف فوتوشوب اليستريتور بريمير افتر افكت ديزاين adobe photoshop illustrator premiere' },
    { id: 'prod_adobe_cc_3m', name: 'Adobe Creative Cloud (3 شهور)', tag: 'الحزمة الكاملة VIP', price: 1350, desc: 'تفعيل رسمي على بريدك الشخصي بضمان كامل المدة', keywords: 'ادوبي ٣ شهور كريتيف فوتوشوب adobe' },
    { id: 'prod_adobe_cc_12m', name: 'Adobe Creative Cloud (سنة)', tag: 'اشتراك سنوي شامل', price: 4400, desc: 'خطة جميع تطبيقات أدوبي الأصلية لمدة 12 شهر مع السحابة', keywords: 'ادوبي سنة كامل فوتوشوب اليستريتور adobe annual' },
    { id: 'prod_adobe_sub_single', name: 'Adobe Single App (سنة)', tag: 'برنامج فردي مخصص', price: 1950, desc: 'تفعيل سنوي لبرنامج تختاره (Photoshop أو Illustrator)', keywords: 'فوتوشوب سنوي اليستريتور سنوي برنامج ادوبي واحد single app' },
    { id: 'prod_adobe', name: 'Adobe Express (12 شهر)', tag: 'أدوبي للتصميم', price: 180, desc: 'تفعيل رسمي لسنة كاملة لتصميم السوشيال ميديا والريلز', keywords: 'ادوبي اكسبريس اكسبرس express adobe express تصاميم' },

    // أدوات التصميم العالمية المستعادة
    { id: 'prod_envato', name: 'Envato Elements (شهر)', tag: 'تحميلات غير محدودة', price: 590, desc: 'مكتبة القوالب، الفيديوهات، والمؤثرات الصوتية الشاملة للمصممين', keywords: 'انفاتو انفانتو عناصر ملفات قوالب تمبلت envato elements' },
    { id: 'prod_freepik', name: 'Freepik Premium (شهر)', tag: 'بنك التصميم الأول', price: 360, desc: 'تحميل الفيكتور، الصور الحصرية وملفات PSD بدون حدود', keywords: 'فريبيك فريبك فيكتور صور تصميم freepik psd vector' },
    { id: 'prod_canva_adm', name: 'Canva Pro Admin', tag: 'تحكم إداري كامل', price: 340, desc: 'موثق بالمستندات مع صلاحية إضافة أعضاء', keywords: 'كانفا ادمن كانفا برو كانفا تيم canva admin pro' },
    { id: 'prod_canva_personal', name: 'Canva Pro (سنة على إيميلك)', tag: 'اشتراك سنوي فردي', price: 180, desc: 'تفعيل رسمي على بريدك الشخصي بضمان 365 يوم', keywords: 'كانفا برو سنة كانفا شخصي canva pro personal' },
    { id: 'prod_capcut_1m', name: 'CapCut Pro (شهر)', tag: 'جاهز وثابت 30 يوم', price: 120, desc: 'يدعم جهازين وضمان كامل', keywords: 'كاب كات كابكت مونتاج فيديو capcut pro' },
    { id: 'prod_capcut_6m', name: 'CapCut Pro (6 شهور)', tag: 'اشتراك 6 شهور', price: 690, desc: 'حساب ثابت نصف سنوي', keywords: 'كاب كات ٦ شهور كابكت capcut' },
    { id: 'prod_capcut_cred', name: 'CapCut Pro 1600 نقطة', tag: 'رصيد توليد AI', price: 150, desc: 'رصيد نقاط إضافي لتأثيرات الذكاء الاصطناعي', keywords: 'نقاط كاب كات توكنز كابكت capcut credits' },
    { id: 'prod_framer', name: 'Framer AI (سنة)', tag: 'كود ترقية رسمي', price: 490, desc: 'خطة Basic السنوية لتصميم المواقع', keywords: 'فرايمر فريمر تصميم مواقع framer ai web' },
    { id: 'prod_figma', name: 'Figma Pro Edu (سنتين)', tag: 'اشتراك سنتين', price: 360, desc: 'أدوات التصميم والـ UI/UX كاملة', keywords: 'فيجما فجما واجهات يوزر انترفيس figma pro ui ux' },

    // أنظمة التشغيل، الإنتاجية والتدقيق
    { id: 'prod_win_pro', name: 'مفتاح Windows 10/11 Pro أصلي', tag: 'مدى الحياة OEM', price: 220, desc: 'سيريال رقمي رسمي يربط بجهازك مدى الحياة مع التحديثات', keywords: 'ويندوز سيريال مفتاح تنشيط ويندوز 10 11 برو windows 10 11 pro key' },
    { id: 'prod_office', name: 'Office 365 Plus (سنة)', tag: 'مايكروسوفت أوفيس', price: 65, desc: 'حزمة برامج كاملة مع سحابة OneDrive', keywords: 'اوفيس ميكروسوفت وورد اكسل ون درايف office 365 word excel onedrive' },
    { id: 'prod_grammarly', name: 'Grammarly Premium (سنة)', tag: 'تدقيق لغوي احترافي', price: 390, desc: 'تصحيح القواعد، النبرة، وفحص الاقتباس والسرقة الأدبية', keywords: 'جرامرلي جرامر تصحيح انجليزي grammarly' },
    { id: 'prod_notion', name: 'Notion Plus (12 شهر)', tag: 'تسليم فوري Outlook', price: 125, desc: 'حساب مخصص ومفعل لسنة كاملة', keywords: 'نوشن تنظيم ملاحظات notion plus' },
    { id: 'prod_miro', name: 'Miro Lifetime Panel', tag: 'مدى الحياة', price: 690, desc: 'إدارة فريق رسمي حتى 100 عضو', keywords: 'ميرو لوحة تخطيط miro' },
    { id: 'prod_ilovepdf', name: 'iLovePDF Premium (سنة)', tag: 'شامل 2000 رصيد AI', price: 95, desc: 'توقيعات رقمية وتعديل كامل', keywords: 'بي دي اف تعديل دمج pdf ilovepdf' },

    // الجيمينج والمحادثات
    { id: 'prod_discord_nitro_m', name: 'Discord Nitro (شهر)', tag: 'مع 2 بوست سيرفر', price: 340, desc: 'إيموجي مخصص في كل مكان، ستريم 4K وبث بجودة فائقة', keywords: 'ديسكورد دسكورد نيترو قيمنق العاب سيرفر discord nitro' },
    { id: 'prod_discord_nitro_y', name: 'Discord Nitro (سنة)', tag: 'اشتراك سنوي كامل', price: 2950, desc: 'تفعيل رسمي على حسابك لعام كامل مع كافة المميزات', keywords: 'دسكورد سنة نيترو سنة discord nitro year' },
    { id: 'prod_xbox_pass', name: 'Xbox Game Pass Ultimate (شهر)', tag: 'PC & Console', price: 390, desc: 'مكتبة تضم أكثر من 400 لعبة تشمل EA Play والألعاب فور صدورها', keywords: 'اكس بوكس جيم باس قيم باس العاب كمبيوتر كونسول xbox game pass ultimate' },

    // الحسابات والشبكات
    { id: 'prod_gmail', name: 'حسابات Gmail جاهزة', tag: 'مع أكواد الاسترداد', price: 60, desc: 'تسليم: البريد | الباسورد | كود 8 أرقام', keywords: 'جيميل ايميل جوجل ايميلات جاهزة gmail google email' },
    { id: 'prod_hotmail', name: 'حسابات Outlook / Hotmail', tag: 'جاهزة وفورية', price: 10, desc: 'إيميلات نظيفة للاستخدام الفوري', keywords: 'هوتميل اوتلوك ايميلات outlook hotmail email' },
    { id: 'prod_vpn_nord', name: 'NordVPN (3 شهور)', tag: 'حماية وVPN', price: 230, desc: 'تشفير فائق وحماية للتصفح', keywords: 'في بي ان نورد حماية تصفح nordvpn vpn' },
    { id: 'prod_vpn_express', name: 'ExpressVPN (شهر)', tag: 'أعلى سرعة VPN', price: 130, desc: 'حساب مفعل شهر كامل', keywords: 'اكسبريس في بي ان سريع expressvpn vpn' }
];

const entertainmentProducts = [
    { id: 'sub_netflix', name: 'Netflix Premium', label: 'حساب كامل برمز خاص 4K', price: 320, desc: 'ضمان كامل طوال المدة', keywords: 'نتفلكس نتفليكس افلام مسلسلات netflix 4k' },
    { id: 'sub_shahid', name: 'شاهد VIP', label: 'شهر واحد باقة المسلسلات', price: 220, desc: 'أحدث المسلسلات بدون إعلانات وبأعلى جودة', keywords: 'شاهد مسلسلات عربي vip shahid' },
    { id: 'sub_watchit', name: 'Watch IT (شهر)', label: 'المنصة المصرية الأولى', price: 140, desc: 'حساب رسمي لمتابعة الدراما المصرية الحصرية بدون فواصل', keywords: 'واتش ات وتش ات واتشت مسلسلات مصرية watch it watchit' },
    { id: 'sub_tod', name: 'TOD / beIN Sports (شهر)', label: 'الباقة الرياضية الشاملة', price: 520, desc: 'بث مباشر لجميع البطولات والدوريات العالمية بدون تقطيع', keywords: 'تود بي ان سبورت بين كورة مباريات دوري ابطال tod bein sports football' },
    { id: 'sub_disney', name: 'Disney+ (شهر)', label: 'مارفل، ستار وورز وديزني', price: 220, desc: 'أحدث الأفلام والرسوم المتحركة بدقة 4K مع الترجمة والدبلجة', keywords: 'ديزني دزني مارفل افلام اطفال كرتون disney plus disney+' },
    { id: 'sub_osn', name: 'OSN+ (شهر)', label: 'أعمال HBO الحصرية', price: 230, desc: 'مسلسلات House of the Dragon و The Last of Us بجودة فائقة', keywords: 'او اس ان مسلسلات اجنبي hbo osn osn+' },
    { id: 'sub_prime', name: 'Prime Video (6 شهور)', label: 'وصول كامل للإيميل', price: 280, desc: 'حساب خاص بضمان شهرين', keywords: 'برايم امازون فيديو prime video amazon' },
    { id: 'sub_crunchyroll', name: 'Crunchyroll Mega Fan (شهر)', label: 'عالم الأنمي بالكامل', price: 110, desc: 'مشاهدة بدون إعلانات وتحميل أوفلاين بعد ساعة من العرض باليابان', keywords: 'كرانشي رول كرنشي انمي ون بيس سحر crunchyroll anime' },
    { id: 'sub_youtube', name: 'YouTube Premium', label: 'شهر واحد على إيميلك', price: 125, desc: 'تشغيل بالخلفية وبدون إعلانات مع YT Music', keywords: 'يوتيوب بريميوم بدون اعلانات ميوزك youtube premium' },
    { id: 'sub_spotify', name: 'Spotify Premium', label: 'شهر واحد حساب خاص', price: 100, desc: 'موسيقى بجودة فائقة بدون فواصل', keywords: 'سبوتيفاي سبوتفاي اغاني موسيقى spotify' },
    { id: 'sub_anghami', name: 'Anghami Plus (شهر)', label: 'أنغامي الموسيقية الذهبية', price: 90, desc: 'تحميل وسماع بدون نت وتخطي لا نهائي للأغاني', keywords: 'انغامي انغام انغامي بلس anghami plus' },
    { id: 'sub_appletv', name: 'Apple TV (12 شهر)', label: 'سنة كاملة', price: 150, desc: 'وصول لمكتبة آبل سينما الأصلية', keywords: 'ابل تي في سينما افلام apple tv apple' }
];
