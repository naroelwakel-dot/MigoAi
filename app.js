// ==============================================================================
// Migo AI Solution - Core Application Engine (Full Complete File)
// المحرك التشغيلي الرئيسي المتكامل - بدون أي اختصار أو حذف لسطر واحد
// ==============================================================================

const USD_TO_EGP = 62; 
const USERS_STORAGE_KEY = 'migo_registered_users_v2';
const SESSION_STORAGE_KEY = 'migo_active_member_v2';
const CART_STORAGE_KEY = 'migo_cart_v2';
const DENO_API_URL = "https://migoai-72.naroelwakel-dot.deno.net";
const WHATSAPP_NUMBER = "201060934020";

// تهيئة المتغيرات التشغيلية
let currentSMMPlatform = null;
let currentSlide = 0;
let cart = [];
let appliedCoupon = null;
let currentModalItem = null;
let isExpressModal = false;
let selectedVccItem = null;
let selectedPayment = null;

// أكواد الخصم المعتمدة
const validCoupons = {
    'SIAFFC15': { discount: 0.15 },
    'SIAF15': { discount: 0.15 },
    'SIAFGAMING15': { discount: 0.15 },
    'MIGO15': { discount: 0.15 },
    'WELCOME10': { discount: 0.10 }
};

// خريطة أيقونات المنصات الـ 18 لإظهار الشعارات الرسمية الملونة بدقة
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

// بيانات وسائل الدفع المعتمدة الـ 14 بدقة 100%
const PAYMENT_METHODS_DATA = {
    vodafone: {
        title: "فودافون كاش",
        type: "copy",
        value: "01020323432",
        instruction: "قم بالتحويل إلى رقم محفظة فودافون كاش المعتمد:"
    },
    etisalat: {
        title: "اتصالات كاش",
        type: "copy",
        value: "01146691073",
        instruction: "قم بالتحويل إلى رقم محفظة اتصالات كاش المعتمد:"
    },
    instapay: {
        title: "إنستاباي (InstaPay)",
        type: "copy",
        value: "01146691073",
        instruction: "قم بالتحويل عبر تطبيق إنستاباي إلى الرقم التالي:"
    },
    telda: {
        title: "تيلدا Telda",
        type: "copy",
        value: "@saherbeh",
        instruction: "قم بالتحويل عبر تطبيق تلدا إلى المعرّف الشخصي التالي:"
    },
    binance: {
        title: "باينانس باي (Binance Pay)",
        type: "html",
        html: `
            <div class="space-y-2 text-right">
                <p class="text-xs text-gray-300">الدفع عبر باينانس باي (Binance Pay) متاح بالعملات الرقمية (USDT).</p>
                <div class="p-3 bg-slate-950 border border-amber-500/30 rounded-xl text-center">
                    <img src="binance-qr.png.jpg" alt="Binance Pay QR" class="w-36 h-36 mx-auto rounded-lg border border-amber-400 p-1 bg-white mb-2 shadow-lg">
                    <p class="text-xs text-amber-300 font-extrabold">امسح رمز الـ QR من البطاقة أو اطلب الـ Pay ID عبر واتساب للمتابعة.</p>
                </div>
            </div>
        `
    },
    paypal: {
        title: "PayPal",
        type: "copy",
        value: "sahermohamed123456@gmail.com",
        instruction: "قم بالتحويل إلى بريد PayPal المعتمد (مع تفضيل خيار Friends & Family إن أمكن):"
    },
    redotpay: {
        title: "RedotPay",
        type: "copy",
        value: "1217212555",
        instruction: "قم بالتحويل الداخلي عبر حساب RedotPay إلى معرف المستخدم (User ID):"
    },
    cards: {
        title: "بطاقة بنكية",
        type: "html",
        html: `
            <div class="p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center">
                <p class="text-xs text-gray-200 font-bold mb-1">الدفع متاح عبر البطاقات البنكية المباشرة والائتمانية:</p>
                <p class="text-xs text-sky-400 font-mono font-bold">Visa • Mastercard • Google Pay • Apple Pay</p>
                <p class="text-[10px] text-gray-400 mt-2">اضغط على زر إرسال الفاتورة عبر واتساب لتزويدك برابط بوابة الدفع الإلكتروني فوراً.</p>
            </div>
        `
    },
    tamara: {
        title: "تمارة Tamara",
        type: "bnpl",
        text: "خدمة الشراء الآن والدفع لاحقاً عبر تمارة Tamara متاحة بالتقسيط المريح.",
        notice: "(Contact me to get link)"
    },
    valu: {
        title: "فاليو valU",
        type: "bnpl",
        text: "خدمة تقسيط المشتريات عبر فاليو valu بدون دفعة أولى أو فوائد حسب خطتك.",
        notice: "(Contact me to get link)"
    },
    souhoola: {
        title: "سهولة",
        type: "bnpl",
        text: "خدمة التقسيط عبر شركة سهولة Souhoola لجميع الباقات والخدمات.",
        notice: "(Contact me to get link)"
    },
    tabby: {
        title: "تابي Tabby",
        type: "bnpl",
        text: "قسم مشترياتك على 4 دفعات بدون فوائد عبر تابي Tabby.",
        notice: "(Contact me to get link)"
    },
    aman: {
        title: "أمان Aman",
        type: "bnpl",
        text: "خطط تقسيط مرنة عبر خدمات تقسيط أمان Aman.",
        notice: "(Contact me to get link)"
    },
    forsa: {
        title: "فرصة Forsa",
        type: "bnpl",
        text: "شراء وتقسيط فوري لكافة الاشتراكات والألعاب عبر فرصة Forsa.",
        notice: "(Contact me to get link)"
    }
};

// تقييمات العملاء الموثقين
const verifiedReviews = [
    { name: "أحمد عبد الرحمن", service: "ChatGPT Plus", text: "التفعيل تم على إيميلي الشخصي في أقل من نص ساعة، خدمة محترمة ومستقرة.", date: "أكتوبر 2026" },
    { name: "محمد طارق", service: "ببجي 3850 UC", text: "الشدات وصلت فوراً بعد التحويل بالـ ID بس وبدون باسورد.", date: "أكتوبر 2026" },
    { name: "محمود إبراهيم", service: "بطاقة VCC (50$)", text: "استلمت بيانات الكارت واشتغلت في إعلانات الفيسبوك بدون أي رفض.", date: "أكتوبر 2026" },
    { name: "سارة م.", service: "Canva Pro Admin", text: "الحساب شغال بصلاحيات الأدمن كاملة وممتاز لفريقي في التصميم.", date: "أكتوبر 2026" },
    { name: "خالد وائل", service: "بيجو لايف (848 ماسة)", text: "الماسات نزلت في حسابي فوراً بعد الفحص بالـ ID، متجر ثقة.", date: "أكتوبر 2026" },
    { name: "يوسف إبراهيم", service: "Google Gemini Pro", text: "شغال بأعلى كفاءة وبدون VPN، وفر لي الكثير في مشاريع البرمجة والعمل.", date: "أكتوبر 2026" }
];

// قوالب إشعارات الشراء المباشرة
const egyptianNames = ["أحمد م.", "محمد س.", "كريم ع.", "يوسف ط.", "عمر ح.", "سارة م.", "محمود خ.", "زياد ف.", "مصطفى ن.", "نور د."];
const purchaseTemplates = [
    { act: "طلب Google Gemini Pro (18 شهر)", icon: '✨' },
    { act: "شحن 3850 UC ببجي موبايل", icon: '🎮' },
    { act: "شحن 7000 كوينز بوبو لايف", icon: '🔴' },
    { act: "طلب بطاقة افتراضية VCC (25$)", icon: '💳' },
    { act: "تفعيل اشتراك ChatGPT Plus", icon: '🤖' },
    { act: "تفعيل Adobe Creative Cloud (شهر)", icon: '🎨' },
    { act: "شحن 583 جوهرة فري فاير", icon: '💎' },
    { act: "تفعيل اشتراك Canva Pro", icon: '🖌️' },
    { act: "شحن 848 ماسة بيجو لايف", icon: '🔴' },
    { act: "تفعيل اشتراك شاهد VIP", icon: '📺' },
    { act: "شحن 1400 كوينز تيك توك", icon: '🪙' },
    { act: "شحن 500 نجمة تليجرام", icon: '⭐' }
];

// دالة التنبيهات السريعة (Toast)
function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all transform duration-300 -translate-x-full flex items-center gap-2 ${type === 'success' ? 'bg-emerald-600 border border-emerald-400' : 'bg-red-600 border border-red-400'}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('-translate-x-full'), 10);
    setTimeout(() => { 
        toast.classList.add('-translate-x-full'); 
        setTimeout(() => toast.remove(), 300); 
    }, 3200);
}

// مؤقت العد التنازلي للخصم
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

// السلايدر العلوي
function updateSlider() {
    const track = document.getElementById('sliderTrack');
    if (track) track.style.transform = `translateX(${currentSlide * 100}%)`;
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlide));
}

function goToSlide(index) { 
    currentSlide = index; 
    updateSlider(); 
}

// محاكي إشعارات الشراء المباشرة التلقائية
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

// عداد الزيارات
function initVisitorCounter() {
    let count = localStorage.getItem('migo_visitors_v4');
    if (!count) count = 1420 + Math.floor(Math.random() * 20);
    else count = parseInt(count, 10) + 1;
    localStorage.setItem('migo_visitors_v4', count);
    const counterEl = document.getElementById('visitorCount');
    if (counterEl) counterEl.innerText = Number(count).toLocaleString();
}

// إدارة سلة المشتريات
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
    m.classList.remove('hidden');
    m.classList.add('flex');
    updateCartUI();
}

function closeCartModal() {
    const m = document.getElementById('cartModal');
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
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
                        <button onclick="removeFromCart(${item.cartId})" class="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">حذف</button>
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
    if (!code) return showToast('أدخل كود الخصم أولاً', 'error');
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

// عرض باقات كوينز تيك توك ونجوم تليجرام
function renderCoinsAndStars() {
    if (typeof tiktokCoinsList !== 'undefined') {
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
    }
    if (typeof telegramStarsList !== 'undefined') {
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
}

// عرض الألعاب الـ 16 بالبانرات الأفقية الواقعية
function renderGames() {
    const gamesList = (typeof gamesData !== 'undefined') ? gamesData : [];
    const container = document.getElementById('gamesCardsContainer');
    if (!container || !gamesList.length) return;

    container.innerHTML = gamesList.map(g => {
        const pkgs = g.packages || [];
        const bannerUrl = g.banner || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80";
        const badgeText = g.badge || "شحن فوري ⚡";
        const gameKey = g.id || "pubg";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 sm:h-32 relative bg-cover bg-center" style="background-image: url('${bannerUrl}');">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <div class="flex justify-between items-start">
                            <span class="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40 backdrop-blur-md">
                                ${badgeText}
                            </span>
                        </div>
                        <h3 class="font-extrabold text-sm sm:text-base text-white drop-shadow-md">${g.name}</h3>
                    </div>
                </div>

                <div class="p-3 space-y-1.5 flex-1 bg-slate-900/60">
                    ${pkgs.map(pkg => `
                        <div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/40 transition">
                            <span class="text-[11px] font-bold text-gray-200">${pkg.name}</span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.price.toLocaleString()} ج.م</span>
                                <button onclick="openPlayerIdModal('${g.name}', '${pkg.name}', ${pkg.price}, true, '${gameKey}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer transition">⚡</button>
                                <button onclick="openPlayerIdModal('${g.name}', '${pkg.name}', ${pkg.price}, false, '${gameKey}')" class="sky-btn font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer transition">🛒</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// عرض تطبيقات البث المباشر (Live Apps)
function renderLiveApps() {
    const liveList = (typeof liveCoinsData !== 'undefined') ? liveCoinsData : [];
    const container = document.getElementById('liveAppsContainer');
    if (!container || !liveList.length) return;

    container.innerHTML = liveList.map(app => {
        const pkgs = app.packages || [];
        const bannerUrl = app.banner || "https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80";
        const badgeText = app.badge || "بث مباشر 🔴";
        const appKey = app.id || "live";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 sm:h-32 relative bg-cover bg-center" style="background-image: url('${bannerUrl}');">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <div>
                            <span class="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/40 backdrop-blur-md">
                                ${badgeText}
                            </span>
                        </div>
                        <h3 class="font-extrabold text-sm sm:text-base text-white drop-shadow-md">${app.name}</h3>
                    </div>
                </div>
                <div class="p-3 space-y-1.5 flex-1 bg-slate-900/60">
                    ${pkgs.map(pkg => `
                        <div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/40 transition">
                            <span class="text-[11px] font-bold text-gray-200">${pkg.name}</span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.price.toLocaleString()} ج.م</span>
                                <button onclick="openPlayerIdModal('${app.name}', '${pkg.name}', ${pkg.price}, true, '${appKey}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer transition">⚡</button>
                                <button onclick="openPlayerIdModal('${app.name}', '${pkg.name}', ${pkg.price}, false, '${appKey}')" class="sky-btn font-bold text-[9px] px-2 py-1 rounded-md cursor-pointer transition">🛒</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// عرض بطاقات الـ VCC الافتراضية
function renderVccCards() {
    const list = (typeof vccData !== 'undefined') ? vccData : [];
    const container = document.getElementById('vccCardsContainer');
    if (!container || !list.length) return;

    container.innerHTML = list.map(v => {
        const price = v.priceEgp || 0;
        const bannerUrl = v.banner || "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80";
        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 relative bg-cover bg-center" style="background-image: url('${bannerUrl}');">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold w-fit">
                            ${v.badge || 'فيزا دولية'}
                        </span>
                        <h3 class="font-bold text-sm text-white">${v.name}</h3>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-3">${v.description || 'تقبل الدفع بالمواقع العالمية والإعلانات بدون قيود.'}</p>
                    <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span class="text-sm font-extrabold text-amber-400 font-mono">${price.toLocaleString()} ج.م</span>
                        <button onclick="openVccModal('${v.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow">اطلب 💳</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openVccModal(vccId) {
    const list = (typeof vccData !== 'undefined') ? vccData : [];
    selectedVccItem = list.find(x => x.id === vccId);
    if (!selectedVccItem) return;
    const price = selectedVccItem.priceEgp || 0;

    const t = document.getElementById('vccModalTitle');
    const p = document.getElementById('vccModalPrice');
    if (t) t.innerText = selectedVccItem.name;
    if (p) p.innerText = `المبلغ: ${price.toLocaleString()} ج.م`;
    const em = document.getElementById('vccEmailInput');
    const pu = document.getElementById('vccPurposeInput');
    if (em) em.value = '';
    if (pu) pu.value = '';
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
    const pu = document.getElementById('vccPurposeInput');
    const email = em ? em.value.trim() : '';
    const purpose = pu ? pu.value.trim() : '';
    if (!email) return showToast('أدخل البريد الإلكتروني لاستلام بيانات البطاقة', 'error');

    const price = selectedVccItem.priceEgp || 0;
    const item = {
        id: selectedVccItem.id + '_' + Date.now(),
        name: selectedVccItem.name,
        type: 'vcc',
        price: price,
        details: `البريد: ${email} ${purpose ? '| الغرض: ' + purpose : ''}`
    };
    closeVccModal();
    if (isExpress) expressCheckout(item);
    else addToCart(item);
}

// عرض برامج التصميم والإنتاجية
function renderProductivity() {
    const subList = (typeof subscriptionsData !== 'undefined') 
        ? subscriptionsData.filter(s => s.category === 'design' || s.category === 'productivity')
        : [];
    const container = document.getElementById('productivityContainer');
    if (!container || !subList.length) return;

    container.innerHTML = subList.map(p => {
        const pkgs = p.packages || [{ name: p.name, price: 0 }];
        const defaultPrice = pkgs[0].price;
        const bannerUrl = p.banner || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-24 relative bg-cover bg-center" style="background-image: url('${bannerUrl}');">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                        <span class="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold w-fit">
                            ${p.badge || 'إنتاجية'}
                        </span>
                        <h3 class="font-bold text-xs sm:text-sm text-white">${p.name}</h3>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${p.description || ''}</p>
                    
                    ${pkgs.length > 1 ? `
                        <select id="prod_pkg_${p.id}" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-[10px] text-sky-300 font-bold mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}">${pkg.name}</option>`).join('')}
                        </select>
                    ` : ''}

                    <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span class="text-xs font-extrabold text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        <div class="flex gap-1">
                            <button onclick="handleSubscriptionAction('${p.id}', true)" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                            <button onclick="handleSubscriptionAction('${p.id}', false)" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// عرض خدمات البث والترفيه
function renderEntertainment() {
    const subList = (typeof subscriptionsData !== 'undefined') 
        ? subscriptionsData.filter(s => s.category === 'entertainment')
        : [];
    const container = document.getElementById('entertainmentCardsContainer');
    if (!container || !subList.length) return;

    container.innerHTML = subList.map(e => {
        const pkgs = e.packages || [{ name: e.name, price: 0 }];
        const defaultPrice = pkgs[0].price;
        const bannerUrl = e.banner || "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-24 relative bg-cover bg-center" style="background-image: url('${bannerUrl}');">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                        <span class="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold w-fit">
                            ${e.badge || 'ترفيه وبث'}
                        </span>
                        <h4 class="font-bold text-xs sm:text-sm text-white">${e.name}</h4>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${e.description || ''}</p>

                    ${pkgs.length > 1 ? `
                        <select id="ent_pkg_${e.id}" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-[10px] text-purple-300 font-bold mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}">${pkg.name}</option>`).join('')}
                        </select>
                    ` : ''}

                    <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span class="text-xs font-black text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        <div class="flex gap-1.5">
                            <button onclick="handleSubscriptionAction('${e.id}', true)" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                            <button onclick="handleSubscriptionAction('${e.id}', false)" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// عرض أدوات الذكاء الاصطناعي
function renderAI() {
    const aiList = (typeof subscriptionsData !== 'undefined') 
        ? subscriptionsData.filter(s => s.category === 'ai')
        : [];
    const container = document.getElementById('aiCardsContainer');
    if (!container || !aiList.length) return;

    container.innerHTML = aiList.map(a => {
        const pkgs = a.packages || [{ name: a.name, price: 0 }];
        const defaultPrice = pkgs[0].price;
        const bannerUrl = a.banner || "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-24 relative bg-cover bg-center" style="background-image: url('${bannerUrl}');">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                        <span class="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold w-fit">
                            ${a.badge || 'ذكاء اصطناعي'}
                        </span>
                        <h4 class="font-bold text-xs sm:text-sm text-white">${a.name}</h4>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${a.description || ''}</p>

                    ${pkgs.length > 1 ? `
                        <select id="ai_pkg_${a.id}" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-[10px] text-indigo-300 font-bold mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}">${pkg.name}</option>`).join('')}
                        </select>
                    ` : ''}

                    <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span class="text-xs font-black text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        <div class="flex gap-1.5">
                            <button onclick="handleSubscriptionAction('${a.id}', true)" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">⚡</button>
                            <button onclick="handleSubscriptionAction('${a.id}', false)" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer">🛒</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// دالة تفاعلية لاختيار وتنفيذ باقات الاشتراكات
function handleSubscriptionAction(itemId, isExpress = false) {
    if (typeof subscriptionsData === 'undefined') return;
    const item = subscriptionsData.find(s => s.id === itemId);
    if (!item) return;

    let selectedPkg = item.packages[0];
    const selectEl = document.getElementById(`prod_pkg_${itemId}`) || 
                     document.getElementById(`ent_pkg_${itemId}`) || 
                     document.getElementById(`ai_pkg_${itemId}`);

    if (selectEl) {
        selectedPkg = item.packages[parseInt(selectEl.value, 10)] || item.packages[0];
    }

    const cartItem = {
        id: `${item.id}_${Date.now()}`,
        name: `${item.name} (${selectedPkg.duration || selectedPkg.name})`,
        type: item.category,
        price: selectedPkg.price,
        details: item.description
    };

    if (isExpress) expressCheckout(cartItem);
    else addToCart(cartItem);
}

// ==============================================================================
// محرك السوشيال ميديا للمنصات الـ 18 - متوافق مباشرة مع index.html و smm.js
// ==============================================================================

// 1. رسم شبكة أزرار المنصات بالأيقونات الرسمية الملونة بدلاً من إيموجي الهاتف
function renderSMMPlatforms() {
    if (typeof smmPlatforms === 'undefined' || !smmPlatforms.length) return;
    if (!currentSMMPlatform) currentSMMPlatform = smmPlatforms[0];

    const grid = document.getElementById('smmPlatformsGrid');
    if (grid) {
        grid.innerHTML = smmPlatforms.map(p => {
            const iconClass = SMM_ICONS[p.id] || p.icon || "fas fa-share-alt text-sky-400";
            const isActive = currentSMMPlatform && p.id === currentSMMPlatform.id;
            return `
                <button type="button" onclick="selectSMMPlatform('${p.id}')" class="p-2 rounded-xl ${isActive ? 'sky-active-tab' : 'sky-card border'} text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-sky-400">
                    <i class="${iconClass} text-base"></i>
                    <span class="text-[10px] font-bold text-white truncate max-w-full">${p.name.split(' ')[0]}</span>
                </button>
            `;
        }).join('');
    }
}

// 2. عند اختيار منصة: تحديث العنوان والأيقونة وصورة البانر واستخراج الأقسام تلقائياً
function selectSMMPlatform(pid) {
    if (typeof smmPlatforms === 'undefined' || !smmPlatforms.length) return;
    currentSMMPlatform = smmPlatforms.find(p => p.id === pid) || smmPlatforms[0];
    renderSMMPlatforms();

    const titleEl = document.getElementById('selectedPlatformTitle');
    const iconContainer = document.getElementById('selectedPlatformIconContainer');
    const bannerImg = document.getElementById('selectedPlatformBannerImg');
    const catSelect = document.getElementById('smmCategorySelect');

    if (titleEl) titleEl.innerText = currentSMMPlatform.name;
    
    // حقن الأيقونة الرسمية المعتمدة داخل المربع
    const iconClass = SMM_ICONS[currentSMMPlatform.id] || currentSMMPlatform.icon || "fas fa-share-alt text-sky-400";
    if (iconContainer) {
        iconContainer.innerHTML = `<i class="${iconClass} text-xl"></i>`;
    }

    // حقن صورة البانر الأفقي بشكل مضمون ومباشر
    if (bannerImg && currentSMMPlatform.banner) {
        bannerImg.src = currentSMMPlatform.banner;
    }

    if (catSelect && currentSMMPlatform.services) {
        // استخراج الأقسام الفريدة تلقائياً من الخدمات (مثل: متابعين، لايكات، مشاهدات...)
        const categories = [...new Set(currentSMMPlatform.services.map(s => s.category || "عام"))];
        catSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
    onSMMCategoryChange();
}

// 3. عند تغيير القسم: ملء الخدمات التابعة لهذا القسم فقط
function onSMMCategoryChange() {
    if (!currentSMMPlatform || !currentSMMPlatform.services) return;
    const catEl = document.getElementById('smmCategorySelect');
    const selectedCat = catEl ? catEl.value : null;
    const srvSelect = document.getElementById('smmServiceSelect');

    let availableServices = currentSMMPlatform.services;
    if (selectedCat) {
        availableServices = currentSMMPlatform.services.filter(s => (s.category || "عام") === selectedCat);
    }

    if (srvSelect) {
        srvSelect.innerHTML = availableServices.map(srv => {
            return `<option value="${srv.id}">#${srv.id} - ${srv.name} (${srv.pricePer1k} ج.م / 1k)</option>`;
        }).join('');
    }
    onSMMServiceChange();
}

// 4. جلب الخدمة المحددة حالياً
function getCurrentSMMService() {
    if (!currentSMMPlatform || !currentSMMPlatform.services) return null;
    const srvEl = document.getElementById('smmServiceSelect');
    const selectedId = srvEl ? srvEl.value : null;
    if (!selectedId) return currentSMMPlatform.services[0] || null;
    return currentSMMPlatform.services.find(s => s.id === selectedId) || currentSMMPlatform.services[0];
}

// 5. تحديث البادج والحدود والميتا للخدمة
function onSMMServiceChange() {
    const srv = getCurrentSMMService();
    if (!srv) return;

    const badgeId = document.getElementById('selectedServiceBadgeId');
    const limits = document.getElementById('smmLimitsNote');
    const meta = document.getElementById('smmServiceMeta');

    if (badgeId) badgeId.innerText = 'ID: #' + srv.id;
    if (limits) limits.innerText = `الحدود: ${srv.min.toLocaleString()} - ${srv.max.toLocaleString()}`;
    if (meta) {
        meta.innerHTML = `
            <span class="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-mono font-bold">لكل 1,000: ${srv.pricePer1k} ج.م</span>
            <span class="text-gray-400 text-[10px]">${srv.speed || 'بدء فوري وتلقائي ⚡'}</span>
        `;
    }
    calculateSMMCost();
}

// 6. حساب تكلفة السوشيال ميديا بالجنيه
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

// 7. إضافة السوشيال ميديا إلى السلة
function addSMMToCart() {
    const linkInp = document.getElementById('smmLinkInput');
    const qtyInp = document.getElementById('smmQtyInput');
    const link = linkInp ? linkInp.value.trim() : '';
    const qty = qtyInp ? parseFloat(qtyInp.value) : 0;
    const srv = getCurrentSMMService();
    if (!srv) return;
    if (!link) return showToast('أدخل الرابط أولاً', 'error');
    if (qty < srv.min || qty > srv.max) return showToast(`الكمية يجب أن تكون بين ${srv.min} و ${srv.max}`, 'error');
    
    addToCart({ 
        id: 'smm_' + srv.id, 
        name: `${currentSMMPlatform.name} - ${srv.name}`, 
        type: 'smm', 
        price: calculateSMMCost(), 
        details: `الكمية: ${qty.toLocaleString()} | الرابط: ${link}` 
    });
    if (linkInp) linkInp.value = '';
}

// 8. الشراء الفوري للسوشيال ميديا
function expressCheckoutSMM() {
    const linkInp = document.getElementById('smmLinkInput');
    const qtyInp = document.getElementById('smmQtyInput');
    const link = linkInp ? linkInp.value.trim() : '';
    const qty = qtyInp ? parseFloat(qtyInp.value) : 0;
    const srv = getCurrentSMMService();
    if (!srv) return;
    if (!link) return showToast('أدخل الرابط أولاً', 'error');
    if (qty < srv.min || qty > srv.max) return showToast(`الكمية يجب أن تكون بين ${srv.min} و ${srv.max}`, 'error');
    
    const cost = calculateSMMCost();
    const item = { 
        id: 'smm_' + srv.id, 
        name: `${currentSMMPlatform.name} - ${srv.name}`, 
        type: 'smm', 
        price: cost, 
        details: `الكمية: ${qty.toLocaleString()} | الرابط: ${link}` 
    };
    if (linkInp) linkInp.value = '';
    expressCheckout(item);
}

// تعبئة قائمة الألعاب والخدمات في نافذة فحص الـ ID تلقائياً
function populateModalGamesList() {
    const select = document.getElementById('modalSelectGame');
    if (!select) return;
    
    let optionsHtml = '';
    if (typeof gamesData !== 'undefined') {
        optionsHtml += gamesData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
    if (typeof liveCoinsData !== 'undefined') {
        optionsHtml += liveCoinsData.map(app => `<option value="${app.id}">${app.name}</option>`).join('');
    }
    optionsHtml += `<option value="tiktok">تيك توك كوينز</option><option value="telegram">نجوم تليجرام</option>`;
    select.innerHTML = optionsHtml;
}

// نافذة فحص الـ ID المربوطة بسيرفر Deno
function openPlayerIdModal(targetName, pkgLabel, price, isExpress = false, iconKey = 'pubg') {
    currentModalItem = { name: `${targetName} - ${pkgLabel}`, price: price, targetName: targetName, pkgLabel: pkgLabel, gameKey: iconKey };
    isExpressModal = isExpress;
    
    populateModalGamesList();
    
    const titleEl = document.getElementById('modalTargetTitle');
    const pkgEl = document.getElementById('modalTargetPkg');
    if (titleEl) titleEl.innerText = targetName;
    if (pkgEl) pkgEl.innerText = `الباقة: ${pkgLabel} (${price.toLocaleString()} ج.م)`;
    
    const select = document.getElementById('modalSelectGame');
    if (select) {
        select.value = iconKey;
        select.disabled = true;
    }
    
    const idInp = document.getElementById('modalInputPlayerId');
    const nameInp = document.getElementById('modalInputPlayerName');
    const zoneInp = document.getElementById('modalInputZoneId');
    const zoneGroup = document.getElementById('modalZoneGroup');
    const idLabel = document.getElementById('modalIdLabel');
    
    if (idInp) idInp.value = '';
    if (nameInp) nameInp.value = '';
    if (zoneInp) zoneInp.value = '';
    
    const requiresZone = ['mlbb', 'mobilelegends', 'genshin', 'diablo'];
    if (zoneGroup) {
        if (requiresZone.includes(iconKey.toLowerCase())) zoneGroup.classList.remove('hidden');
        else zoneGroup.classList.add('hidden');
    }

    if (idLabel) {
        if (iconKey === 'tiktok' || iconKey === 'telegram') idLabel.innerText = "اسم المستخدم (Username بدون @)";
        else idLabel.innerText = "معرف اللاعب أو التطبيق (Player ID)";
    }

    const statusBox = document.getElementById('verifyStatusBox');
    if (statusBox) statusBox.classList.add('hidden');

    const btn = document.getElementById('modalSubmitBtn');
    if (btn) {
        if (isExpress) {
            btn.className = "w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs sm:text-sm cursor-pointer shadow";
            btn.innerHTML = `متابعة الدفع الفوري ⚡ (${price.toLocaleString()} ج.م)`;
        } else {
            btn.className = "w-full sky-btn font-extrabold py-3 rounded-xl text-xs sm:text-sm cursor-pointer shadow";
            btn.innerHTML = `تأكيد وإضافة للسلة 🛒`;
        }
        btn.onclick = submitPlayerIdModal;
    }
    const modal = document.getElementById('playerIdModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closePlayerIdModal() {
    const modal = document.getElementById('playerIdModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    currentModalItem = null;
}

function onModalGameSelectChange() {
    const select = document.getElementById('modalSelectGame');
    if (!select) return;
    const selectedKey = select.value;
    const zoneGroup = document.getElementById('modalZoneGroup');
    const idLabel = document.getElementById('modalIdLabel');
    const requiresZone = ['mlbb', 'mobilelegends', 'genshin', 'diablo'];

    if (idLabel) {
        if (selectedKey === 'tiktok' || selectedKey === 'telegram') idLabel.innerText = "اسم المستخدم (Username بدون @)";
        else idLabel.innerText = "معرف اللاعب أو التطبيق (Player ID)";
    }

    if (zoneGroup) {
        if (requiresZone.includes(selectedKey.toLowerCase())) zoneGroup.classList.remove('hidden');
        else zoneGroup.classList.add('hidden');
    }
}

// دالة فحص واستعلام الحساب الحقيقية المربوطة بسيرفر Deno API
async function verifyPlayerAccount() {
    const uidEl = document.getElementById('modalInputPlayerId');
    const zoneIdEl = document.getElementById('modalInputZoneId');
    const statusBox = document.getElementById('verifyStatusBox');
    const nameInput = document.getElementById('modalInputPlayerName');
    const verifyBtn = document.getElementById('verifyAccountBtn');

    if (!uidEl || !currentModalItem) return;
    const game = currentModalItem.gameKey;
    const uid = uidEl.value.trim().replace(/^@/, '');
    const zoneId = zoneIdEl ? zoneIdEl.value.trim() : '';

    if (!uid) return showToast('أدخل المعرف أو اسم المستخدم أولاً!', 'error');

    if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.innerText = "جاري..."; }
    if (statusBox) {
        statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-sky-500/15 border-sky-500/40 text-sky-300";
        statusBox.classList.remove('hidden');
        statusBox.innerText = "⏳ جاري الاستعلام المباشر من سيرفر Deno...";
    }

    let query = `/?game=${encodeURIComponent(game)}&id=${encodeURIComponent(uid)}`;
    if (zoneId) query += `&zoneId=${encodeURIComponent(zoneId)}`;

    try {
        const response = await fetch(`${DENO_API_URL}${query}`);
        const data = await response.json();
        const retrievedName = data.username || data.name || (data.data && (data.data.username || data.data.name));
        const avatarUrl = data.avatar || data.avatar_url;

        if (data.success && (retrievedName || avatarUrl)) {
            if (nameInput) nameInput.value = retrievedName || uid;
            if (statusBox) {
                statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-emerald-500/20 border-emerald-500/50 text-emerald-300";
                statusBox.innerHTML = `✅ تم التحقق: <span class="text-white font-mono underline">${retrievedName || uid}</span>`;
            }
            if (avatarUrl) {
                const iconBox = document.getElementById('modalTargetIcon');
                if (iconBox) iconBox.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-xl" alt="avatar">`;
            }
            showToast(`تم التعرف على الحساب: ${retrievedName || uid}`);
        } else {
            if (statusBox) {
                statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-red-500/20 border-red-500/50 text-red-300";
                statusBox.innerText = `❌ ${data.message || 'لم يتم العثور على الحساب، يرجى التأكد من صحة المعرف.'}`;
            }
        }
    } catch (err) {
        if (statusBox) {
            statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-amber-500/20 border-amber-500/50 text-amber-300";
            statusBox.innerText = "⚠️ تعذر الفحص اللحظي، يمكنك كتابة اسم حسابك يدوياً وإتمام طلبك مباشرة.";
        }
    } finally {
        if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.innerText = "فحص 🔍"; }
    }
}

function submitPlayerIdModal() {
    const idEl = document.getElementById('modalInputPlayerId');
    const nameEl = document.getElementById('modalInputPlayerName');
    const zoneEl = document.getElementById('modalInputZoneId');
    const playerId = idEl ? idEl.value.trim() : '';
    const playerName = nameEl ? nameEl.value.trim() : '';
    const zoneId = zoneEl ? zoneEl.value.trim() : '';
    if (!playerId) return showToast('يرجى إدخال المعرف المطلوب!', 'error');

    let detailStr = `معرّف/حساب: ${playerId}`;
    if (zoneId) detailStr += ` (Zone: ${zoneId})`;
    if (playerName) detailStr += ` | الاسم: ${playerName}`;

    const item = { 
        id: 'item_' + Date.now(), 
        name: currentModalItem.name, 
        type: 'game_coin', 
        price: currentModalItem.price, 
        details: detailStr 
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
    if (cart.length === 0) return showToast('السلة فارغة، اختر خدمات أولاً', 'error');
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
    const box = document.getElementById('checkoutDetailsBox');
    const btn = document.getElementById('confirmPaymentBtn');
    if (box) box.classList.add('hidden');
    if (btn) btn.classList.add('hidden');
    document.querySelectorAll('.pay-method-btn').forEach(btn => btn.classList.remove('border-sky-400', 'bg-slate-800'));
}

function copyTextToClipboard(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => showToast('تم نسخ البيانات بنجاح 📋'));
    }
}

// دالة اختيار وسيلة الدفع وعرض تفاصيلها الرسمية
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
    const copyBtn = (txt) => `<button type="button" onclick="copyTextToClipboard('${txt}')" class="mt-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-white font-mono text-xs cursor-pointer shadow transition inline-flex items-center gap-1.5"><span>📋 نسخ:</span> <b>${txt}</b></button>`;

    if (content) {
        if (!methodData) {
            content.innerHTML = `الدفع عبر <b>${displayName}</b> متاح. اضغط تأكيد وسنزودك بالتفاصيل عبر واتساب.`;
        } else if (methodData.type === 'copy') {
            content.innerHTML = `${methodData.instruction}<br>${copyBtn(methodData.value)}`;
        } else if (methodData.type === 'bnpl') {
            content.innerHTML = `${methodData.text}<br><span class="text-sky-300 block mt-1 font-bold">${methodData.notice || '(Contact me to get link)'}</span>`;
        } else {
            content.innerHTML = methodData.html;
        }
    }

    const confBtn = document.getElementById('confirmPaymentBtn');
    if (confBtn) confBtn.classList.remove('hidden');
}

// إتمام الطلب وتوليد الفاتورة إلى رقم الواتساب المعتمد 01060934020
function finalizeOrderWhatsApp() {
    if (!selectedPayment) return showToast('اختر وسيلة الدفع أولاً', 'error');
    
    const senderInput = document.getElementById('senderAccountInput');
    const senderAcc = senderInput ? senderInput.value.trim() : '';
    if (!senderAcc) return showToast('يرجى إدخال رقم المحفظة أو الحساب الذي قمت بالتحويل منه', 'error');

    const totEl = document.getElementById('cartTotal');
    const orderId = Math.floor(1000 + Math.random() * 9000);
    let msg = `السلام عليكم، أود تأكيد طلبي الجديد من Migo AI Solution\n`;
    msg += `*رقم الفاتورة:* #${orderId}\n`;
    msg += `*طريقة الدفع:* ${selectedPayment}\n`;
    msg += `*الحساب المُحوّل منه:* ${senderAcc}\n\n`;
    msg += `*--- تفاصيل الطلب ---*\n`;
    cart.forEach((item, index) => {
        msg += `${index + 1}. *${item.name}*\n   - السعر: ${Number(item.price).toLocaleString()} ج.م\n   - البيانات: [${item.details || ''}]\n`;
    });
    msg += `\n*الإجمالي المطلوب:* ${totEl ? totEl.innerText : ''}`;
    if (appliedCoupon) msg += `\n*(كود الخصم المطبق: ${appliedCoupon.code})*`;

    cart = [];
    appliedCoupon = null;
    saveCartToStorage();
    closeCheckoutModal();

    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// محرك البحث اللحظي والشامل لجميع الخدمات دون نقص
function handleLiveSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!dropdown) return;
    query = query.trim().toLowerCase();
    if (!query) { dropdown.classList.add('hidden'); return; }

    let results = [];
    
    // 1. البحث في الألعاب الـ 16
    if (typeof gamesData !== 'undefined') {
        gamesData.forEach(g => {
            if (g.name.toLowerCase().includes(query)) {
                g.packages.forEach(pkg => results.push({ name: `${g.name} (${pkg.name})`, price: pkg.price, type: 'game', key: g.id, pkg: pkg.name }));
            }
        });
    }

    // 2. البحث في برامج اللايف الـ 6
    if (typeof liveCoinsData !== 'undefined') {
        liveCoinsData.forEach(app => {
            if (app.name.toLowerCase().includes(query)) {
                app.packages.forEach(pkg => results.push({ name: `${app.name} (${pkg.name})`, price: pkg.price, type: 'live', key: app.id, pkg: pkg.name }));
            }
        });
    }

    // 3. البحث في كوينز تيك توك
    if (typeof tiktokCoinsList !== 'undefined') {
        tiktokCoinsList.forEach(c => {
            if (`تيك توك كوينز tiktok ${c.coins}`.toLowerCase().includes(query)) {
                results.push({ name: `تيك توك (${c.coins} عملة)`, price: c.price, type: 'coin_tiktok', coins: c.coins });
            }
        });
    }

    // 4. البحث في نجوم تليجرام
    if (typeof telegramStarsList !== 'undefined') {
        telegramStarsList.forEach(s => {
            if (`تليجرام نجوم telegram ${s.stars}`.toLowerCase().includes(query)) {
                results.push({ name: `تليجرام (${s.stars} نجمة)`, price: s.price, type: 'coin_tg', stars: s.stars });
            }
        });
    }

    // 5. البحث في خدمات السوشيال ميديا الـ 18
    if (typeof smmPlatforms !== 'undefined') {
        smmPlatforms.forEach(p => {
            if (p.name.toLowerCase().includes(query)) {
                p.services.forEach(srv => {
                    results.push({ name: `${p.name} - ${srv.name}`, price: srv.pricePer1k, type: 'smm', platformId: p.id });
                });
            }
        });
    }

    // 6. البحث في الاشتراكات الـ 26
    if (typeof subscriptionsData !== 'undefined') {
        subscriptionsData.forEach(sub => {
            if (sub.name.toLowerCase().includes(query) || (sub.description && sub.description.toLowerCase().includes(query))) {
                results.push({ name: sub.name, price: sub.packages[0].price, type: 'sub', id: sub.id });
            }
        });
    }

    // 7. البحث في بطاقات VCC
    if (typeof vccData !== 'undefined') {
        vccData.forEach(v => {
            if (v.name.toLowerCase().includes(query)) {
                results.push({ name: v.name, price: v.priceEgp, type: 'vcc', id: v.id });
            }
        });
    }

    if (results.length === 0) {
        dropdown.innerHTML = '<div class="text-center py-3 text-xs text-gray-400">لا توجد نتائج مطابقة لبحثك</div>';
    } else {
        dropdown.innerHTML = results.slice(0, 10).map(res => `
            <div class="p-2 hover:bg-slate-800 rounded-xl flex items-center justify-between text-xs transition border-b border-slate-700/50 last:border-0">
                <div class="text-right">
                    <span class="font-bold text-white block">${res.name}</span>
                    <span class="text-amber-400 font-mono font-bold">${Number(res.price).toLocaleString()} ج.م</span>
                </div>
                <button onclick="onGlobalSearchClick('${encodeURIComponent(JSON.stringify(res))}')" class="sky-btn text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer">طلب ⚡</button>
            </div>
        `).join('');
    }
    dropdown.classList.remove('hidden');
}

function onGlobalSearchClick(encodedItem) {
    const item = JSON.parse(decodeURIComponent(encodedItem));
    const dd = document.getElementById('searchResultsDropdown');
    const inp = document.getElementById('liveSearchInput');
    if (dd) dd.classList.add('hidden');
    if (inp) inp.value = '';
    
    if (item.type === 'game' || item.type === 'live') {
        openPlayerIdModal(item.name.split(' (')[0], item.pkg, item.price, true, item.key);
    } else if (item.type === 'smm') {
        selectSMMPlatform(item.platformId);
        window.location.href = '#sec-social';
    } else if (item.type === 'coin_tiktok') {
        openPlayerIdModal('تيك توك كوينز', `${item.coins} عملة`, item.price, true, 'tiktok');
    } else if (item.type === 'coin_tg') {
        openPlayerIdModal('نجوم تليجرام', `${item.stars} نجمة`, item.price, true, 'telegram');
    } else if (item.type === 'vcc') {
        openVccModal(item.id);
    } else if (item.type === 'sub') {
        handleSubscriptionAction(item.id, true);
    }
}

// عرض تقييمات العملاء
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

// إدارة العضويات والمستخدمين
function getRegisteredUsers() { try { return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY)) || []; } catch (e) { return []; } }
function saveRegisteredUsers(u) { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(u)); }
function encodePass(str) { return btoa(unescape(encodeURIComponent('migo_salt_' + str))); }

function openAuthModal(mode) {
    const modal = document.getElementById('authModal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    switchAuthTab(mode || 'login');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function switchAuthTab(mode) {
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');
    const tl = document.getElementById('tabLoginBtn');
    const tr = document.getElementById('tabRegisterBtn');
    if (lf) lf.classList.toggle('hidden', mode !== 'login');
    if (rf) rf.classList.toggle('hidden', mode === 'login');
    if (tl) tl.className = (mode === 'login') ? 'py-1.5 text-xs font-bold rounded-lg transition sky-btn cursor-pointer' : 'py-1.5 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer';
    if (tr) tr.className = (mode !== 'login') ? 'py-1.5 text-xs font-bold rounded-lg transition sky-btn cursor-pointer' : 'py-1.5 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer';
}

function handleRegister(e) {
    e.preventDefault();
    const emailEl = document.getElementById('regEmail');
    const nameEl = document.getElementById('regName');
    const phoneEl = document.getElementById('regPhone');
    const passEl = document.getElementById('regPassword');
    const email = emailEl ? emailEl.value.trim().toLowerCase() : '';
    const users = getRegisteredUsers();
    if (users.find(u => u.email === email)) return showToast('البريد مسجل بالفعل', 'error');
    const newUser = { 
        name: nameEl ? nameEl.value.trim() : '', 
        email: email, 
        phone: phoneEl ? phoneEl.value.trim() : '', 
        passwordHash: encodePass(passEl ? passEl.value : '')
    };
    users.push(newUser);
    saveRegisteredUsers(users);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));
    updateNavbarAuthUI();
    closeAuthModal();
    showToast('تم التسجيل بنجاح');
}

function handleLogin(e) {
    e.preventDefault();
    const emailEl = document.getElementById('loginEmail');
    const passEl = document.getElementById('loginPassword');
    const email = emailEl ? emailEl.value.trim().toLowerCase() : '';
    const passHash = encodePass(passEl ? passEl.value : '');
    const user = getRegisteredUsers().find(u => u.email === email && u.passwordHash === passHash);
    if (!user) return showToast('بيانات الدخول غير صحيحة', 'error');
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    updateNavbarAuthUI();
    closeAuthModal();
    showToast(`أهلاً بك ${user.name}`);
}

function handleLogout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    updateNavbarAuthUI();
    showToast('تم الخروج');
}

function updateNavbarAuthUI() {
    let session = null;
    try { session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)); } catch (e) {}
    const loginBtn = document.getElementById('navLoginBtn');
    const userBadge = document.getElementById('navUserBadge');
    const userName = document.getElementById('navUserName');
    if (session && session.email) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userBadge) { userBadge.classList.remove('hidden'); userBadge.classList.add('flex'); }
        if (userName) userName.innerText = session.name.split(' ')[0];
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userBadge) { userBadge.classList.add('hidden'); userBadge.classList.remove('flex'); }
    }
}

function toggleSidebar() { 
    const sb = document.getElementById('sidebarContainer');
    if (sb) sb.classList.toggle('hidden'); 
}

// تشغيل كافة الخدمات عند تحميل الصفحة
window.onload = function() {
    try { updateNavbarAuthUI(); } catch (e) {}
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
    try { 
        renderSMMPlatforms(); 
        selectSMMPlatform('tiktok');
    } catch (e) {}
    try { renderReviews(); } catch (e) {}

    setInterval(() => { 
        currentSlide = (currentSlide + 1) % 3; 
        updateSlider(); 
    }, 5000);
    setTimeout(triggerSocialProof, 3500);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#liveSearchInput') && !e.target.closest('#searchResultsDropdown')) {
            const dd = document.getElementById('searchResultsDropdown');
            if (dd) dd.classList.add('hidden');
        }
    });
};
