// ==============================================================================
// Migo AI Solution - Core Application Engine (Full Complete File)
// المحرك التشغيلي الرئيسي المتكامل - بدون أي اختصار أو حذف لسطر واحد
// ==============================================================================

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

// أكواد الخصم تُتحقّق على السيرفر (Supabase RPC: validate_coupon) — الأكواد غير مكشوفة في الواجهة

// خريطة أيقونات المنصات الـ 20 لإظهار الشعارات الرسمية الملونة بدقة
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

// بيانات وسائل الدفع المعتمدة الـ 13
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
                    <p class="text-xs text-amber-300 font-extrabold">اطلب الـ Pay ID عبر واتساب للمتابعة.</p>
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
    tamara: { title: "تمارة Tamara", type: "bnpl", text: "خدمة الشراء الآن والدفع لاحقاً عبر تمارة Tamara متاحة بالتقسيط المريح.", notice: "(Contact me to get link)" },
    valu: { title: "فاليو valU", type: "bnpl", text: "خدمة تقسيط المشتريات عبر فاليو valu بدون دفعة أولى أو فوائد حسب خطتك.", notice: "(Contact me to get link)" },
    souhoola: { title: "سهولة", type: "bnpl", text: "خدمة التقسيط عبر شركة سهولة Souhoola لجميع الباقات والخدمات.", notice: "(Contact me to get link)" },
    tabby: { title: "تابي Tabby", type: "bnpl", text: "قسم مشترياتك على 4 دفعات بدون فوائد عبر تابي Tabby.", notice: "(Contact me to get link)" },
    aman: { title: "أمان Aman", type: "bnpl", text: "خطط تقسيط مرنة عبر خدمات تقسيط أمان Aman.", notice: "(Contact me to get link)" },
    forsa: { title: "فرصة Forsa", type: "bnpl", text: "شراء وتقسيط فوري لكافة الاشتراكات والألعاب عبر فرصة Forsa.", notice: "(Contact me to get link)" }
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

function calculateAutoPrice(basePrice) {
    if (!basePrice || isNaN(basePrice)) return 0;
    return Math.round(Number(basePrice));
}

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
    setTimeout(triggerSocialProof, Math.floor(Math.random() * 30000) + 75000);
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
                        <h3 class="text-xs font-bold text-white truncate">${item.name}</h3>
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

async function applyCartCoupon() {
    const inp = document.getElementById('cartCouponInput');
    if (!inp) return;
    const code = inp.value.trim().toUpperCase();
    if (!code) return showToast('أدخل كود الخصم أولاً', 'error');
    let discount = null;
    try {
        const c = await __sbClient();
        const res = await c.rpc('validate_coupon', { p_code: code });
        if (!res.error && res.data != null) discount = Number(res.data);
    } catch (e) { discount = null; }
    if (discount == null || isNaN(discount) || discount <= 0) return showToast('كود غير صالح', 'error');
    appliedCoupon = { code: code, discount: discount };
    const statusEl = document.getElementById('cartCouponStatus');
    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.className = 'text-[10px] font-bold text-emerald-400';
        statusEl.innerText = `✅ تم تطبيق خصم ${(discount * 100)}% بنجاح`;
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

function updateCardPriceDisplay(prefix, itemId) {
    const selectEl = document.getElementById(`${prefix}_pkg_${itemId}`);
    const priceDisplayEl = document.getElementById(`${prefix}_price_${itemId}`);
    if (!selectEl || !priceDisplayEl) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const basePrice = parseFloat(selectedOption.getAttribute('data-price')) || 0;
    const finalPrice = calculateAutoPrice(basePrice);
    
    priceDisplayEl.innerText = finalPrice.toLocaleString() + ' ج.م';
}

function renderCoinsAndStars() {
    if (typeof tiktokCoinsList !== 'undefined') {
        const ttContainer = document.getElementById('tiktokCoinsGrid');
        if (ttContainer) {
            const ttBanner = tiktokCoinsList.banner || "images (6).jpeg";
            const ttPkgs = tiktokCoinsList.packages || tiktokCoinsList;
            const defaultFinalPrice = calculateAutoPrice(ttPkgs[0].price);
            ttContainer.innerHTML = `
                <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg relative" style="min-height: 180px;">
                    <img src="${ttBanner}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center opacity-40">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
                    <div class="relative z-10 p-4 flex flex-col justify-between h-full gap-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-pink-400 bg-pink-500/20 px-2.5 py-0.5 rounded-full border border-pink-500/40">عملات تيك توك</span>
                            <span id="tt_price_display" class="text-xs font-extrabold text-amber-400 font-mono">${defaultFinalPrice.toLocaleString()} ج.م</span>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-gray-200 mb-1">اختر الباقة:</label>
                            <div class="coin-picker" id="tt_package_select" data-selected="0">
                                <button type="button" class="coin-picker-btn" onclick="toggleCoinPicker('tt')" aria-haspopup="listbox"><span id="tt_picker_label">${ttPkgs[0].coins.toLocaleString()} عملة (${defaultFinalPrice.toLocaleString()} ج.م)</span><span class="coin-picker-caret">▾</span></button>
                                <div class="coin-picker-list hidden" role="listbox">
                                    ${ttPkgs.map((c, idx) => `<button type="button" role="option" class="coin-picker-opt${idx === 0 ? ' is-active' : ''}" data-idx="${idx}" data-price="${c.price}" onclick="selectCoinPkg('tt', ${idx})"><span>${c.coins.toLocaleString()} عملة</span><span class="coin-picker-price">${calculateAutoPrice(c.price).toLocaleString()} ج.م</span></button>`).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2 pt-2 border-t border-slate-800/80">
                            <button onclick="handleCoinAction('tiktok', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow">شحن فوري ⚡</button>
                            <button onclick="handleCoinAction('tiktok', false)" class="sky-btn font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    if (typeof telegramStarsList !== 'undefined') {
        const tgContainer = document.getElementById('telegramStarsGrid');
        if (tgContainer) {
            const tgBanner = telegramStarsList.banner || "telegram.jpeg";
            const tgPkgs = telegramStarsList.packages || telegramStarsList;
            const defaultFinalPrice = calculateAutoPrice(tgPkgs[0].price);
            tgContainer.innerHTML = `
                <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg relative" style="min-height: 180px;">
                    <img src="${tgBanner}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center opacity-40">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
                    <div class="relative z-10 p-4 flex flex-col justify-between h-full gap-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-sky-400 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-500/40">نجوم تليجرام</span>
                            <span id="tg_price_display" class="text-xs font-extrabold text-amber-400 font-mono">${defaultFinalPrice.toLocaleString()} ج.م</span>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-gray-200 mb-1">اختر الباقة:</label>
                            <div class="coin-picker" id="tg_package_select" data-selected="0">
                                <button type="button" class="coin-picker-btn" onclick="toggleCoinPicker('tg')" aria-haspopup="listbox"><span id="tg_picker_label">${tgPkgs[0].stars.toLocaleString()} نجمة (${defaultFinalPrice.toLocaleString()} ج.م)</span><span class="coin-picker-caret">▾</span></button>
                                <div class="coin-picker-list hidden" role="listbox">
                                    ${tgPkgs.map((s, idx) => `<button type="button" role="option" class="coin-picker-opt${idx === 0 ? ' is-active' : ''}" data-idx="${idx}" data-price="${s.price}" onclick="selectCoinPkg('tg', ${idx})"><span>${s.stars.toLocaleString()} نجمة</span><span class="coin-picker-price">${calculateAutoPrice(s.price).toLocaleString()} ج.م</span></button>`).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2 pt-2 border-t border-slate-800/80">
                            <button onclick="handleCoinAction('telegram', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow">شحن فوري ⚡</button>
                            <button onclick="handleCoinAction('telegram', false)" class="sky-btn font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

function updateCoinPrice(type) {
    const root = document.getElementById(type === 'tt' ? 'tt_package_select' : 'tg_package_select');
    const disp = document.getElementById(type === 'tt' ? 'tt_price_display' : 'tg_price_display');
    if (!root || !disp) return;
    const idx = parseInt(root.getAttribute('data-selected') || '0', 10);
    const opt = root.querySelector('.coin-picker-opt[data-idx="' + idx + '"]');
    const basePrice = opt ? parseFloat(opt.getAttribute('data-price')) : 0;
    const finalPrice = calculateAutoPrice(basePrice);
    disp.innerText = finalPrice.toLocaleString() + ' ج.م';
    const label = document.getElementById(type === 'tt' ? 'tt_picker_label' : 'tg_picker_label');
    if (label && opt && opt.querySelector('span')) {
        label.innerText = opt.querySelector('span').textContent + ' (' + finalPrice.toLocaleString() + ' ج.م)';
    }
}

function closeAllCoinPickers() {
    document.querySelectorAll('.coin-picker-list').forEach(function (l) { l.classList.add('hidden'); });
}

function toggleCoinPicker(type) {
    const root = document.getElementById(type === 'tt' ? 'tt_package_select' : 'tg_package_select');
    if (!root) return;
    const list = root.querySelector('.coin-picker-list');
    if (!list) return;
    const wasHidden = list.classList.contains('hidden');
    closeAllCoinPickers();
    if (wasHidden) list.classList.remove('hidden');
}

function selectCoinPkg(type, idx) {
    const root = document.getElementById(type === 'tt' ? 'tt_package_select' : 'tg_package_select');
    if (!root) return;
    root.setAttribute('data-selected', String(idx));
    root.querySelectorAll('.coin-picker-opt').forEach(function (o) { o.classList.remove('is-active'); });
    const opt = root.querySelector('.coin-picker-opt[data-idx="' + idx + '"]');
    if (opt) opt.classList.add('is-active');
    updateCoinPrice(type);
    closeAllCoinPickers();
}

function handleCoinAction(type, isExpress) {
    const selId = type === 'tiktok' ? 'tt_package_select' : 'tg_package_select';
    const sel = document.getElementById(selId);
    if (!sel) return;
    const idx = parseInt(sel.getAttribute('data-selected') || '0', 10);
    const rawList = type === 'tiktok' ? tiktokCoinsList : telegramStarsList;
    const list = rawList.packages || rawList;
    const pkg = list[idx];
    const name = type === 'tiktok' ? 'تيك توك كوينز' : 'نجوم تليجرام';
    const label = type === 'tiktok' ? `${pkg.coins} عملة` : `${pkg.stars} نجمة`;
    const finalPrice = calculateAutoPrice(pkg.price);

    openPlayerIdModal(name, label, finalPrice, isExpress, type);
}

function renderGames() {
    const gamesList = (typeof gamesData !== 'undefined') ? gamesData : [];
    const container = document.getElementById('gamesCardsContainer');
    if (!container || !gamesList.length) return;

    container.innerHTML = gamesList.map(g => {
        const pkgs = g.packages || [];
        const bannerUrl = g.banner || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80";
        const badgeText = g.badge || "شحن فوري ⚡";
        const defaultPrice = pkgs.length ? calculateAutoPrice(pkgs[0].price) : 0;

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 sm:h-32 relative overflow-hidden bg-[#12151b]"><img src="${bannerUrl}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <div class="flex justify-between items-start">
                            <span class="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40 backdrop-blur-md">
                                ${badgeText}
                            </span>
                        </div>
                        <h3 class="font-extrabold text-sm sm:text-base text-white drop-shadow-md">${g.name}</h3>
                    </div>
                </div>

                <div class="p-3 space-y-3 flex-1 bg-slate-900/60 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center mb-1.5">
                            <label class="text-[11px] font-bold text-gray-300" for="game_pkg_${g.id}">اختر الباقة:</label>
                            <span id="game_price_${g.id}" class="text-xs font-extrabold text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        </div>
                        <select id="game_pkg_${g.id}" onchange="updateCardPriceDisplay('game', '${g.id}')" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-emerald-300 font-bold outline-none">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}" data-price="${pkg.price}">${pkg.name} — ${calculateAutoPrice(pkg.price)} ج.م</option>`).join('')}
                        </select>
                    </div>

                    <div class="flex gap-2 pt-2 border-t border-slate-800">
                        <button onclick="handleGameAction('${g.id}', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow">شحن فوري ⚡</button>
                        <button onclick="handleGameAction('${g.id}', false)" class="sky-btn font-bold text-xs px-3 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function handleGameAction(gameId, isExpress) {
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;
    const selectEl = document.getElementById(`game_pkg_${gameId}`);
    const idx = selectEl ? parseInt(selectEl.value, 10) : 0;
    const pkg = game.packages[idx] || game.packages[0];
    const finalPrice = calculateAutoPrice(pkg.price);

    openPlayerIdModal(game.name, pkg.name, finalPrice, isExpress, game.id);
}

function renderLiveApps() {
    const liveList = (typeof liveCoinsData !== 'undefined') ? liveCoinsData : [];
    const container = document.getElementById('liveAppsContainer');
    if (!container || !liveList.length) return;

    container.innerHTML = liveList.map(app => {
        const pkgs = app.packages || [];
        const bannerUrl = app.banner || "https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?auto=format&fit=crop&w=1200&q=80";
        const badgeText = app.badge || "بث مباشر 🔴";
        const defaultPrice = pkgs.length ? calculateAutoPrice(pkgs[0].price) : 0;

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 sm:h-32 relative overflow-hidden bg-[#12151b]"><img src="${bannerUrl}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <div>
                            <span class="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/40 backdrop-blur-md">
                                ${badgeText}
                            </span>
                        </div>
                        <h3 class="font-extrabold text-sm sm:text-base text-white drop-shadow-md">${app.name}</h3>
                    </div>
                </div>
                <div class="p-3 space-y-3 flex-1 bg-slate-900/60 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center mb-1.5">
                            <label class="text-[11px] font-bold text-gray-300" for="live_pkg_${app.id}">اختر الباقة:</label>
                            <span id="live_price_${app.id}" class="text-xs font-extrabold text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        </div>
                        <select id="live_pkg_${app.id}" onchange="updateCardPriceDisplay('live', '${app.id}')" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-rose-300 font-bold outline-none">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}" data-price="${pkg.price}">${pkg.name} — ${calculateAutoPrice(pkg.price)} ج.م</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex gap-2 pt-2 border-t border-slate-800">
                        <button onclick="handleLiveAction('${app.id}', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow">شحن فوري ⚡</button>
                        <button onclick="handleLiveAction('${app.id}', false)" class="sky-btn font-bold text-xs px-3 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function handleLiveAction(appId, isExpress) {
    const app = liveCoinsData.find(a => a.id === appId);
    if (!app) return;
    const selectEl = document.getElementById(`live_pkg_${appId}`);
    const idx = selectEl ? parseInt(selectEl.value, 10) : 0;
    const pkg = app.packages[idx] || app.packages[0];
    const finalPrice = calculateAutoPrice(pkg.price);

    openPlayerIdModal(app.name, pkg.name, finalPrice, isExpress, app.id);
}

function renderVccCards() {
    const list = (typeof vccData !== 'undefined') ? vccData : [];
    const container = document.getElementById('vccCardsContainer');
    if (!container || !list.length) return;

    container.innerHTML = list.map(v => {
        const pkgs = v.packages || [{ name: v.name, price: v.priceEgp }];
        const defaultPrice = calculateAutoPrice(pkgs[0].price);
        const bannerUrl = v.banner || "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 relative overflow-hidden bg-[#12151b]"><img src="${bannerUrl}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold w-fit">
                            ${v.badge || 'فيزا دولية'}
                        </span>
                        <h3 class="font-bold text-sm text-white">${v.name}</h3>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${v.description || 'تقبل الدفع بالمواقع العالمية والإعلانات بدون قيود.'}</p>
                    
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-[10px] font-bold text-gray-300" for="vcc_pkg_${v.id}">اختر باقتك:</label>
                            <span id="vcc_price_${v.id}" class="text-xs font-black text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        </div>
                        <select id="vcc_pkg_${v.id}" onchange="updateCardPriceDisplay('vcc', '${v.id}')" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-[10px] text-amber-300 font-bold outline-none mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}" data-price="${pkg.price}">${pkg.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <button onclick="handleVccAction('${v.id}', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow mr-1">طلب فوري ⚡</button>
                        <button onclick="handleVccAction('${v.id}', false)" class="sky-btn font-bold text-xs px-3 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function handleVccAction(vccId, isExpress) {
    const list = (typeof vccData !== 'undefined') ? vccData : [];
    const vcc = list.find(x => x.id === vccId);
    if (!vcc) return;

    const selectEl = document.getElementById(`vcc_pkg_${vccId}`);
    const pkgs = vcc.packages || [{ name: vcc.name, price: vcc.priceEgp }];
    const idx = selectEl ? parseInt(selectEl.value, 10) : 0;
    const selectedPkg = pkgs[idx] || pkgs[0];
    const finalPrice = calculateAutoPrice(selectedPkg.price);

    selectedVccItem = {
        id: vcc.id + '_' + Date.now(),
        name: `${vcc.name} - ${selectedPkg.name}`,
        type: 'vcc',
        price: finalPrice,
        details: `الباقة المختارة: ${selectedPkg.name}`
    };

    openVccModalCustom(vccId);
}

function openVccModalCustom(vccId) {
    const list = (typeof vccData !== 'undefined') ? vccData : [];
    const vcc = list.find(x => x.id === vccId);
    if (!vcc) return;

    const selectEl = document.getElementById(`vcc_pkg_${vccId}`);
    const pkgs = vcc.packages || [{ name: vcc.name, price: vcc.priceEgp }];
    const idx = selectEl ? parseInt(selectEl.value, 10) : 0;
    const selectedPkg = pkgs[idx] || pkgs[0];
    const finalPrice = calculateAutoPrice(selectedPkg.price);

    const t = document.getElementById('vccModalTitle');
    const p = document.getElementById('vccModalPrice');
    if (t) t.innerText = `${vcc.name} (${selectedPkg.name})`;
    if (p) p.innerText = `السعر الإجمالي: ${finalPrice.toLocaleString()} ج.م`;

    selectedVccItem = {
        id: vcc.id + '_' + Date.now(),
        name: `${vcc.name} - ${selectedPkg.name}`,
        type: 'vcc',
        price: finalPrice
    };

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
    if (!selectedVccItem) return showToast('حدث خطأ، اختر البطاقة مرة أخرى', 'error');

    selectedVccItem.details = `البريد: ${email} ${purpose ? '| ملاحظات: ' + purpose : ''}`;
    
    const itemToProcess = { ...selectedVccItem };
    closeVccModal();

    if (isExpress) {
        expressCheckout(itemToProcess);
    } else {
        addToCart(itemToProcess);
    }
}

function renderProductivity() {
    const subList = (typeof subscriptionsData !== 'undefined') 
        ? subscriptionsData.filter(s => s.category === 'design' || s.category === 'productivity')
        : [];
    const container = document.getElementById('productivityContainer');
    if (!container || !subList.length) return;

    container.innerHTML = subList.map(p => {
        const pkgs = p.packages || [{ name: p.name, price: 0 }];
        const defaultPrice = calculateAutoPrice(pkgs[0].price);
        const bannerUrl = p.banner || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-24 relative overflow-hidden bg-[#12151b]"><img src="${bannerUrl}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                        <span class="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold w-fit">
                            ${p.badge || 'إنتاجية'}
                        </span>
                        <h3 class="font-bold text-xs sm:text-sm text-white">${p.name}</h3>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${p.description || ''}</p>
                    
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-[10px] font-bold text-gray-300" for="prod_pkg_${p.id}">الباقة:</label>
                            <span id="prod_price_${p.id}" class="text-xs font-black text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        </div>
                        <select id="prod_pkg_${p.id}" onchange="updateCardPriceDisplay('prod', '${p.id}')" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-[10px] text-cyan-300 font-bold outline-none mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}" data-price="${pkg.price}">${pkg.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="pt-2 border-t border-slate-800 flex gap-2">
                        <button onclick="handleSubscriptionAction('${p.id}', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] py-1.5 rounded-lg cursor-pointer">فوري ⚡</button>
                        <button onclick="handleSubscriptionAction('${p.id}', false)" class="sky-btn font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">🛒 للسلة</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderEntertainment() {
    const subList = (typeof subscriptionsData !== 'undefined') 
        ? subscriptionsData.filter(s => s.category === 'entertainment')
        : [];
    const container = document.getElementById('entertainmentCardsContainer');
    if (!container || !subList.length) return;

    container.innerHTML = subList.map(e => {
        const pkgs = e.packages || [{ name: e.name, price: 0 }];
        const defaultPrice = calculateAutoPrice(pkgs[0].price);
        const bannerUrl = e.banner || "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-24 relative overflow-hidden bg-[#12151b]"><img src="${bannerUrl}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2.5 flex flex-col justify-between">
                        <span class="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold w-fit">
                            ${e.badge || 'ترفيه وبث'}
                        </span>
                        <h3 class="font-bold text-xs sm:text-sm text-white">${e.name}</h3>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${e.description || ''}</p>

                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-[10px] font-bold text-gray-300" for="ent_pkg_${e.id}">الباقة:</label>
                            <span id="ent_price_${e.id}" class="text-xs font-black text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        </div>
                        <select id="ent_pkg_${e.id}" onchange="updateCardPriceDisplay('ent', '${e.id}')" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-[10px] text-purple-300 font-bold outline-none mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}" data-price="${pkg.price}">${pkg.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="pt-2 border-t border-slate-800 flex gap-2">
                        <button onclick="handleSubscriptionAction('${e.id}', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] py-1.5 rounded-lg cursor-pointer">فوري ⚡</button>
                        <button onclick="handleSubscriptionAction('${e.id}', false)" class="sky-btn font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">🛒 للسلة</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAI() {
    let aiList = [];
    if (typeof aiProducts !== 'undefined' && aiProducts.length > 0) {
        aiList = aiProducts;
    } else if (typeof subscriptionsData !== 'undefined') {
        aiList = subscriptionsData.filter(s => s.category === 'ai');
    }

    const container = document.getElementById('aiCardsContainer');
    if (!container || !aiList.length) return;

    container.innerHTML = aiList.map(a => {
        const pkgs = a.packages || [{ name: a.tag || a.name, price: a.price, duration: a.tag }];
        const defaultPrice = calculateAutoPrice(pkgs[0].price);
        const bannerUrl = a.banner || "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80";

        return `
            <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
                <div class="h-28 sm:h-32 relative overflow-hidden bg-[#12151b]"><img src="${bannerUrl}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover object-center">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex flex-col justify-between">
                        <span class="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-bold w-fit">
                            ${a.badge || a.tag || 'ذكاء اصطناعي'}
                        </span>
                        <h3 class="font-extrabold text-sm sm:text-base text-white drop-shadow-md">${a.name}</h3>
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 flex-1 flex flex-col justify-between">
                    <p class="text-[10px] text-gray-400 mb-2">${a.description || a.desc || ''}</p>

                    <div>
                        <div class="flex justify-between items-center mb-1.5">
                            <label class="text-[11px] font-bold text-gray-300" for="ai_pkg_${a.id}">اختر الباقة:</label>
                            <span id="ai_price_${a.id}" class="text-xs font-extrabold text-amber-400 font-mono">${defaultPrice.toLocaleString()} ج.م</span>
                        </div>
                        <select id="ai_pkg_${a.id}" onchange="updateCardPriceDisplay('ai', '${a.id}')" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-indigo-300 font-bold outline-none mb-2">
                            ${pkgs.map((pkg, idx) => `<option value="${idx}" data-price="${pkg.price}">${pkg.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="pt-2 border-t border-slate-800 flex gap-2">
                        <button onclick="handleAIAction('${a.id}', true)" class="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl cursor-pointer shadow">شحن فوري ⚡</button>
                        <button onclick="handleAIAction('${a.id}', false)" class="sky-btn font-bold text-xs px-3 py-2 rounded-xl cursor-pointer shadow">🛒 للسلة</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function handleAIAction(itemId, isExpress = false) {
    const prod = (typeof aiProducts !== 'undefined') ? aiProducts.find(p => p.id === itemId) : null;
    if (!prod) return;

    const selectEl = document.getElementById(`ai_pkg_${itemId}`);
    const pkgs = prod.packages || [{ name: prod.tag, price: prod.price, duration: prod.tag }];
    const idx = selectEl ? parseInt(selectEl.value, 10) : 0;
    const selectedPkg = pkgs[idx] || pkgs[0];
    const finalPrice = calculateAutoPrice(selectedPkg.price);

    const cartItem = {
        id: `${prod.id}_${Date.now()}`,
        name: `${prod.name} (${selectedPkg.duration || selectedPkg.name})`,
        type: 'ai',
        price: finalPrice,
        details: prod.description || prod.desc
    };

    if (isExpress) expressCheckout(cartItem);
    else addToCart(cartItem);
}

function handleSubscriptionAction(itemId, isExpress = false) {
    let item = (typeof subscriptionsData !== 'undefined') ? subscriptionsData.find(s => s.id === itemId) : null;
    if (!item) return;

    let selectedPkg = item.packages[0];
    const selectEl = document.getElementById(`prod_pkg_${itemId}`) || 
                     document.getElementById(`ent_pkg_${itemId}`);

    if (selectEl) {
        selectedPkg = item.packages[parseInt(selectEl.value, 10)] || item.packages[0];
    }

    const finalPrice = calculateAutoPrice(selectedPkg.price);

    const cartItem = {
        id: `${item.id}_${Date.now()}`,
        name: `${item.name} (${selectedPkg.duration || selectedPkg.name})`,
        type: item.category || 'sub',
        price: finalPrice,
        details: item.description
    };

    if (isExpress) expressCheckout(cartItem);
    else addToCart(cartItem);
}

// ==============================================================================
// محرك السوشيال ميديا
// ==============================================================================
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

function selectSMMPlatform(pid) {
    if (typeof smmPlatforms === 'undefined' || !smmPlatforms.length) return;
    currentSMMPlatform = smmPlatforms.find(p => p.id === pid) || smmPlatforms[0];
    renderSMMPlatforms();

    const titleEl = document.getElementById('selectedPlatformTitle');
    const iconContainer = document.getElementById('selectedPlatformIconContainer');
    const bannerImg = document.getElementById('selectedPlatformBannerImg');
    const catSelect = document.getElementById('smmCategorySelect');

    if (titleEl) titleEl.innerText = currentSMMPlatform.name;
    
    const iconClass = SMM_ICONS[currentSMMPlatform.id] || currentSMMPlatform.icon || "fas fa-share-alt text-sky-400";
    if (iconContainer) iconContainer.innerHTML = `<i class="${iconClass} text-xl"></i>`;
    
    if (bannerImg && currentSMMPlatform.banner) {
        bannerImg.src = currentSMMPlatform.banner;
    }

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
    if (selectedCat) {
        availableServices = currentSMMPlatform.services.filter(s => (s.category || "عام") === selectedCat);
    }

    if (srvSelect) {
        srvSelect.innerHTML = availableServices.map(srv => {
            const adjustedSmmPrice = calculateAutoPrice(srv.pricePer1k);
            return `<option value="${srv.id}">#${srv.id} - ${srv.name} (${adjustedSmmPrice} ج.م / 1k)</option>`;
        }).join('');
    }
    onSMMServiceChange();
}

function getCurrentSMMService() {
    if (!currentSMMPlatform || !currentSMMPlatform.services) return null;
    const srvEl = document.getElementById('smmServiceSelect');
    const selectedId = srvEl ? srvEl.value : null;
    if (!selectedId) return currentSMMPlatform.services[0] || null;
    return currentSMMPlatform.services.find(s => s.id === selectedId) || currentSMMPlatform.services[0];
}

function onSMMServiceChange() {
    const srv = getCurrentSMMService();
    if (!srv) return;

    const badgeId = document.getElementById('selectedServiceBadgeId');
    const limits = document.getElementById('smmLimitsNote');
    const meta = document.getElementById('smmServiceMeta');

    const adjustedSmmPrice = calculateAutoPrice(srv.pricePer1k);

    if (badgeId) badgeId.innerText = 'ID: #' + srv.id;
    if (limits) limits.innerText = `الحدود: ${srv.min.toLocaleString()} - ${srv.max.toLocaleString()}`;
    if (meta) {
        meta.innerHTML = `
            <span class="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-mono font-bold">لكل 1,000: ${adjustedSmmPrice} ج.م</span>
            <span class="text-gray-400 text-[10px]">${srv.speed || 'بدء فوري وتلقائي ⚡'}</span>
        `;
    }
    calculateSMMCost();
}

function calculateSMMCost() {
    const srv = getCurrentSMMService();
    if (!srv) return 0;
    const qtyInp = document.getElementById('smmQtyInput');
    const qty = Math.max(srv.min, parseFloat(qtyInp ? qtyInp.value : srv.min) || srv.min);
    
    const adjustedSmmPrice = calculateAutoPrice(srv.pricePer1k);
    const totalEGP = Math.round(((qty / 1000) * adjustedSmmPrice) * 100) / 100;
    
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
                if (iconBox) iconBox.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-xl" alt="avatar" loading="lazy" decoding="async">`;
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

function handleLiveSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!dropdown) return;
    query = query.trim().toLowerCase();
    if (!query) { dropdown.classList.add('hidden'); return; }

    let results = [];
    
    if (typeof gamesData !== 'undefined') {
        gamesData.forEach(g => {
            if (g.name.toLowerCase().includes(query)) {
                g.packages.forEach(pkg => results.push({ name: `${g.name} (${pkg.name})`, price: calculateAutoPrice(pkg.price), type: 'game', key: g.id, pkg: pkg.name }));
            }
        });
    }

    if (typeof liveCoinsData !== 'undefined') {
        liveCoinsData.forEach(app => {
            if (app.name.toLowerCase().includes(query)) {
                app.packages.forEach(pkg => results.push({ name: `${app.name} (${pkg.name})`, price: calculateAutoPrice(pkg.price), type: 'live', key: app.id, pkg: pkg.name }));
            }
        });
    }

    if (typeof tiktokCoinsList !== 'undefined') {
        const ttPkgs = tiktokCoinsList.packages || tiktokCoinsList;
        ttPkgs.forEach(c => {
            if (`تيك توك كوينز tiktok ${c.coins}`.toLowerCase().includes(query)) {
                results.push({ name: `تيك توك (${c.coins} عملة)`, price: calculateAutoPrice(c.price), type: 'coin_tiktok', coins: c.coins });
            }
        });
    }

    if (typeof telegramStarsList !== 'undefined') {
        const tgPkgs = telegramStarsList.packages || telegramStarsList;
        tgPkgs.forEach(s => {
            if (`تليجرام نجوم telegram ${s.stars}`.toLowerCase().includes(query)) {
                results.push({ name: `تليجرام (${s.stars} نجمة)`, price: calculateAutoPrice(s.price), type: 'coin_tg', stars: s.stars });
            }
        });
    }

    if (typeof smmPlatforms !== 'undefined') {
        smmPlatforms.forEach(p => {
            if (p.name.toLowerCase().includes(query)) {
                p.services.forEach(srv => {
                    results.push({ name: `${p.name} - ${srv.name}`, price: calculateAutoPrice(srv.pricePer1k), type: 'smm', platformId: p.id });
                });
            }
        });
    }

    if (typeof subscriptionsData !== 'undefined') {
        subscriptionsData.forEach(sub => {
            if (sub.name.toLowerCase().includes(query) || (sub.description && sub.description.toLowerCase().includes(query))) {
                results.push({ name: sub.name, price: calculateAutoPrice(sub.packages[0].price), type: 'sub', id: sub.id });
            }
        });
    }

    if (typeof vccData !== 'undefined') {
        vccData.forEach(v => {
            if (v.name.toLowerCase().includes(query)) {
                results.push({ name: v.name, price: calculateAutoPrice(v.priceEgp), type: 'vcc', id: v.id });
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

// --- Customer accounts over Supabase (database + email confirmation link) ---
const SUPABASE_URL = 'https://tmfczgqewhkgsaeaupqu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1Jo8Tie65l5k_HPsyI0MDw_uZXxqblE';
let __sb = null, __pending = null;
function __sbClient() {
    if (__sb) return Promise.resolve(__sb);
    return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(function (m) {
        __sb = m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return __sb;
    });
}
function __authDone(name, email) {
    try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ name: name, email: email })); } catch (e) {}
    updateNavbarAuthUI();
    closeAuthModal();
}
function __awaitConfirm(email) {
    let box = document.getElementById('otpBox');
    if (!box) {
        const form = document.getElementById('registerForm');
        if (!form) { showToast('بعتنالك لينك تأكيد على إيميلك'); return; }
        box = document.createElement('div');
        box.id = 'otpBox';
        box.className = 'mt-2';
        form.appendChild(box);
    }
    box.innerHTML = '<p class="otp-hint">بعتنالك لينك تأكيد على إيميلك <b>' + email + '</b>.<br>افتح الإيميل ودوس على اللينك، وبعدها ارجع هنا وسجّل دخول.</p>';
    showToast('بعتنالك لينك تأكيد على إيميلك');
}
function __finishFromUrl() {
    if (!location.hash || location.hash.indexOf('access_token') === -1) return;
    __sbClient().then(c => c.auth.getSession()).then(res => {
        const s = res && res.data && res.data.session;
        if (!s || !s.user) return;
        const meta = s.user.user_metadata || {};
        __authDone(meta.name || (s.user.email || '').split('@')[0], s.user.email || '');
        showToast('تم تأكيد إيميلك 🎉');
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    }).catch(function () {});
}
if (document.readyState !== 'loading') { __finishFromUrl(); } else { document.addEventListener('DOMContentLoaded', __finishFromUrl); }
function handleRegister(e) {
    e.preventDefault();
    const email = (document.getElementById('regEmail') || {}).value ? document.getElementById('regEmail').value.trim().toLowerCase() : '';
    const name = (document.getElementById('regName') || {}).value ? document.getElementById('regName').value.trim() : '';
    const phone = (document.getElementById('regPhone') || {}).value ? document.getElementById('regPhone').value.trim() : '';
    const password = (document.getElementById('regPassword') || {}).value || '';
    if (!email || password.length < 6) return showToast('اكتب بريد صحيح وكلمة سر 6 أحرف على الأقل', 'error');
    showToast('جاري إنشاء الحساب...');
    __sbClient().then(c => c.auth.signUp({ email: email, password: password, options: { data: { name: name, phone: phone }, emailRedirectTo: 'https://naroelwakel-dot.github.io/MigoAi/' } }))
        .then(res => {
            if (res.error) return showToast(res.error.message, 'error');
            if (res.data && res.data.session) { __authDone(name, email); return showToast('تم التسجيل بنجاح 🎉'); }
            __awaitConfirm(email);
        }).catch(() => showToast('تعذّر الاتصال بالسيرفر', 'error'));
}

function handleLogin(e) {
    e.preventDefault();
    const email = (document.getElementById('loginEmail') || {}).value ? document.getElementById('loginEmail').value.trim().toLowerCase() : '';
    const password = (document.getElementById('loginPassword') || {}).value || '';
    __sbClient().then(c => c.auth.signInWithPassword({ email: email, password: password }))
        .then(res => {
            if (res.error) return showToast('بيانات الدخول غير صحيحة', 'error');
            const meta = (res.data && res.data.user && res.data.user.user_metadata) || {};
            __authDone(meta.name || email.split('@')[0], email);
            showToast('أهلاً بك ' + (meta.name || ''));
        }).catch(() => showToast('تعذّر الاتصال بالسيرفر', 'error'));
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

// التشغيل الشامل عند تحميل الصفحة
window.onload = function() {
    try { updateNavbarAuthUI(); } catch (e) {}
    try { initVisitorCounter(); } catch (e) {}
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
        if (!e.target.closest('.coin-picker')) { closeAllCoinPickers(); }
    });
};


