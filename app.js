// ==============================================================================
// Migo AI Solution - Core Application Engine
// ==============================================================================

const USD_TO_EGP = 62; 
const USERS_STORAGE_KEY = 'migo_registered_users_v2';
const SESSION_STORAGE_KEY = 'migo_active_member_v2';
const CART_STORAGE_KEY = 'migo_cart_v2';
const DENO_API_URL = "https://migoai-72.naroelwakel-dot.deno.net";

let currentSMMPlatform = smmPlatforms[0];
let currentSlide = 0;
let cart = [];
let appliedCoupon = null;
let currentModalItem = null;
let isExpressModal = false;
let selectedVccItem = null;
let selectedPayment = null;

const validCoupons = {
    'SIAFFC15': { discount: 0.15 },
    'MIGO15': { discount: 0.15 },
    'WELCOME10': { discount: 0.10 }
};

const verifiedReviews = [
    { name: "أحمد عبد الرحمن", service: "تيك توك كوينز (700)", text: "شحن فوري باليوزر نيم فقط وفحص الحساب والصورة ميزة ممتازة.", date: "أكتوبر 2026" },
    { name: "محمد طارق", service: "ببجي 3850 UC", text: "الشدات وصلت فوراً بعد التحويل بالـ ID، خدمة سريعة ومحترمة.", date: "أكتوبر 2026" },
    { name: "محمود إبراهيم", service: "فيزا افتراضية (50$)", text: "استلمت بيانات الكارت واشتغلت في إعلانات الفيسبوك بدون أي رفض.", date: "أكتوبر 2026" },
    { name: "سارة م.", service: "Canva Pro Admin", text: "الحساب شغال بصلاحيات الأدمن كاملة وممتاز لفريقي في التصميم.", date: "أكتوبر 2026" },
    { name: "خالد وائل", service: "بيجو لايف (840 ماسة)", text: "الماسات نزلت في حسابي فوراً بعد الفحص بالـ ID، متجر ثقة.", date: "أكتوبر 2026" },
    { name: "يوسف إبراهيم", service: "Claude Max 5x", text: "شغال بأعلى كفاءة وبدون VPN، أنقذني في مشاريع البرمجة والعمل.", date: "أكتوبر 2026" }
];

const egyptianNames = ["أحمد م.", "محمد س.", "كريم ع.", "يوسف ط.", "عمر ح.", "سارة م.", "محمود خ.", "زياد ف.", "مصطفى ن.", "نور د."];
const purchaseTemplates = [
    { act: "شحن 700 عملة تيك توك فوري", icon: '💎' },
    { act: "طلب بطاقة افتراضية VCC (25$)", icon: '💳' },
    { act: "شحن 3850 UC ببجي موبايل", icon: '🎮' },
    { act: "تفعيل Claude Max 5x", icon: '🧠' },
    { act: "تفعيل اشتراك Watch IT", icon: '🎬' },
    { act: "تفعيل باقة beIN Sports TOD", icon: '⚽' },
    { act: "تفعيل Adobe Creative Cloud (شهر)", icon: '🎨' },
    { act: "تفعيل Discord Nitro (سنة)", icon: '🎮' },
    { act: "شحن 500 نجمة تليجرام", icon: '⭐' },
    { act: "شحن 840 ماسة بيجو لايف", icon: '🔴' },
    { act: "تفعيل اشتراك Canva Pro Admin", icon: '🎨' },
    { act: "شحن 1200 كوينز تانجو لايف", icon: '🔴' },
    { act: "تفعيل GitHub Copilot", icon: '💻' }
];

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all transform duration-300 -translate-x-full flex items-center gap-2 ${type === 'success' ? 'bg-emerald-600 border border-emerald-400' : 'bg-red-600 border border-red-400'}`;
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
    document.getElementById('proofUser').innerText = name;
    document.getElementById('proofAction').innerText = tpl.act;
    document.getElementById('proofTime').innerText = `منذ ${Math.floor(Math.random() * 45) + 5} ثانية`;
    document.getElementById('proofIcon').innerText = tpl.icon;
    popup.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => popup.classList.add('translate-y-24', 'opacity-0'), 4500);
    setTimeout(triggerSocialProof, Math.floor(Math.random() * 10000) + 12000);
}

function initVisitorCounter() {
    let count = localStorage.getItem('migo_visitors_v4');
    if (!count) count = 1420 + Math.floor(Math.random() * 20);
    else count = parseInt(count) + 1;
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
    document.getElementById('cartModal').classList.remove('hidden');
    document.getElementById('cartModal').classList.add('flex');
    updateCartUI();
}
function closeCartModal() {
    document.getElementById('cartModal').classList.add('hidden');
    document.getElementById('cartModal').classList.remove('flex');
}
function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    if (badge) badge.innerText = cart.length;
    const container = document.getElementById('cartItemsContainer');
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">سلة المشتريات فارغة</div>';
    } else {
        container.innerHTML = cart.map(item => `
            <div class="bg-slate-950 border border-slate-700 rounded-xl p-2.5 flex justify-between items-center gap-2">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                    <div class="text-[10px] text-sky-400 truncate">${item.details}</div>
                </div>
                <div class="text-left shrink-0">
                    <div class="text-xs font-black text-amber-400 font-mono">${Number(item.price).toLocaleString()} ج.م</div>
                    <button onclick="removeFromCart(${item.cartId})" class="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">حذف</button>
                </div>
            </div>
        `).join('');
    }
    calculateCartTotal();
}
function applyCartCoupon() {
    const code = document.getElementById('cartCouponInput').value.trim().toUpperCase();
    if (!code) return showToast('أدخل كود الخصم أولاً', 'error');
    const coupon = validCoupons[code];
    if (!coupon) return showToast('كود غير صالح', 'error');
    appliedCoupon = { code: code, discount: coupon.discount };
    const statusEl = document.getElementById('cartCouponStatus');
    statusEl.classList.remove('hidden');
    statusEl.className = 'text-[10px] font-bold text-emerald-400';
    statusEl.innerText = `✅ تم تطبيق خصم ${(coupon.discount * 100)}% بنجاح`;
    calculateCartTotal();
}
function calculateCartTotal() {
    let subtotal = cart.reduce((sum, item) => sum + Number(item.price), 0);
    document.getElementById('cartSubtotal').innerText = subtotal.toLocaleString() + ' ج.م';
    if (appliedCoupon && subtotal > 0) {
        let discountAmt = subtotal * appliedCoupon.discount;
        document.getElementById('cartDiscountRow').classList.remove('hidden');
        document.getElementById('cartDiscountAmount').innerText = '-' + discountAmt.toLocaleString() + ' ج.م';
        document.getElementById('cartTotal').innerText = (subtotal - discountAmt).toLocaleString() + ' ج.م';
    } else {
        document.getElementById('cartDiscountRow').classList.add('hidden');
        document.getElementById('cartTotal').innerText = subtotal.toLocaleString() + ' ج.م';
    }
}

function renderCoinsAndStars() {
    const ttContainer = document.getElementById('tiktokCoinsGrid');
    if (ttContainer) {
        ttContainer.innerHTML = tiktokCoinsList.map(c => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-700">
                <span class="text-xs font-bold text-gray-200">🪙 ${c.coins.toLocaleString()} عملة</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-extrabold text-amber-400 font-mono">${c.price} ج.م</span>
                    <button onclick="openPlayerIdModal('تيك توك كوينز', '${c.coins} عملة', ${c.price}, true, 'tiktok')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg">⚡</button>
                    <button onclick="openPlayerIdModal('تيك توك كوينز', '${c.coins} عملة', ${c.price}, false, 'tiktok')" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg">🛒</button>
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
                    <span class="text-xs font-extrabold text-amber-400 font-mono">${s.price} ج.م</span>
                    <button onclick="openPlayerIdModal('نجوم تليجرام', '${s.stars} نجمة', ${s.price}, true, 'telegram')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg">⚡</button>
                    <button onclick="openPlayerIdModal('نجوم تليجرام', '${s.stars} نجمة', ${s.price}, false, 'telegram')" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg">🛒</button>
                </div>
            </div>
        `).join('');
    }
}

function renderLiveApps() {
    const container = document.getElementById('liveAppsContainer');
    if (!container) return;
    container.innerHTML = liveAppsCatalog.map(app => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between">
            <div class="bg-slate-950 border-b border-slate-700 p-3 flex items-center justify-between">
                <h3 class="font-extrabold text-xs sm:text-sm text-white">${app.name}</h3>
                <span class="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">${app.tag}</span>
            </div>
            <div class="p-3 space-y-1.5">
                ${app.pkgs.map(pkg => `
                    <div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-950 border border-slate-700">
                        <span class="text-[11px] font-bold text-gray-200">${pkg.l}</span>
                        <div class="flex items-center gap-1">
                            <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.p} ج.م</span>
                            <button onclick="openPlayerIdModal('${app.name}', '${pkg.l}', ${pkg.p}, true, '${app.key}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[9px] px-1.5 py-1 rounded-md">⚡</button>
                            <button onclick="openPlayerIdModal('${app.name}', '${pkg.l}', ${pkg.p}, false, '${app.key}')" class="sky-btn font-bold text-[9px] px-2 py-1 rounded-md">🛒</button>
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
    container.innerHTML = vccCatalog.map(v => `
        <div class="sky-card border p-3.5 rounded-2xl flex flex-col justify-between relative">
            <div>
                <span class="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">${v.tag}</span>
                <h3 class="font-bold text-sm text-white mt-2 mb-1">${v.name}</h3>
                <p class="text-[10px] text-gray-400 mb-3">تقبل الدفع بالمواقع العالمية بدون قيود.</p>
            </div>
            <div class="pt-2 border-t border-slate-700 flex items-center justify-between">
                <span class="text-sm font-extrabold text-amber-400 font-mono">${v.price.toLocaleString()} ج.م</span>
                <button onclick="openVccModal('${v.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl">اطلب 💳</button>
            </div>
        </div>
    `).join('');
}

function openVccModal(vccId) {
    selectedVccItem = vccCatalog.find(x => x.id === vccId);
    if (!selectedVccItem) return;
    document.getElementById('vccModalTitle').innerText = selectedVccItem.name;
    document.getElementById('vccModalPrice').innerText = `المبلغ: ${selectedVccItem.price.toLocaleString()} ج.م`;
    document.getElementById('vccEmailInput').value = '';
    document.getElementById('vccPurposeInput').value = '';
    document.getElementById('vccModal').classList.remove('hidden');
    document.getElementById('vccModal').classList.add('flex');
}
function closeVccModal() {
    document.getElementById('vccModal').classList.add('hidden');
    document.getElementById('vccModal').classList.remove('flex');
    selectedVccItem = null;
}
function submitVccModal(isExpress) {
    const email = document.getElementById('vccEmailInput').value.trim();
    const purpose = document.getElementById('vccPurposeInput').value.trim();
    if (!email) return showToast('أدخل البريد الإلكتروني لاستلام بيانات البطاقة', 'error');

    const item = {
        id: selectedVccItem.id + '_' + Date.now(),
        name: selectedVccItem.name,
        type: 'vcc',
        price: selectedVccItem.price,
        details: `البريد: ${email} ${purpose ? '| الغرض: ' + purpose : ''}`
    };
    closeVccModal();
    if (isExpress) expressCheckout(item);
    else addToCart(item);
}

function renderGames() {
    const container = document.getElementById('gamesCardsContainer');
    if (!container) return;
    container.innerHTML = allGames.map(g => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between">
            <div class="bg-slate-950 border-b border-slate-700 p-3 flex items-center justify-between">
                <h3 class="font-extrabold text-xs sm:text-sm text-white">${g.name}</h3>
                <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">${g.tag}</span>
            </div>
            <div class="p-3 space-y-1.5">
                ${g.pkgs.map(pkg => `
                    <div class="flex items-center justify-between p-1.5 rounded-xl bg-slate-950 border border-slate-700">
                        <span class="text-[11px] font-bold text-gray-200">${pkg.l}</span>
                        <div class="flex items-center gap-1">
                            <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.p} ج.م</span>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.l}', ${pkg.p}, true, '${g.key}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[9px] px-1.5 py-1 rounded-md">⚡</button>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.l}', ${pkg.p}, false, '${g.key}')" class="sky-btn font-bold text-[9px] px-2 py-1 rounded-md">🛒</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderProductivity() {
    const container = document.getElementById('productivityContainer');
    if (!container) return;
    container.innerHTML = productivityProducts.map(p => `
        <div class="sky-card border p-3 rounded-2xl flex flex-col justify-between">
            <div>
                <span class="text-[9px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">${p.tag}</span>
                <h3 class="font-bold text-xs sm:text-sm text-white mt-1.5 mb-1">${p.name}</h3>
                <p class="text-[10px] text-gray-400 mb-2">${p.desc}</p>
            </div>
            <div class="pt-2 border-t border-slate-700 flex items-center justify-between">
                <span class="text-xs font-extrabold text-amber-400 font-mono">${p.price} ج.م</span>
                <div class="flex gap-1">
                    <button onclick="expressCheckout({id: '${p.id}', name: '${p.name}', type: 'digital', price: ${p.price}, details: '${p.desc}'})" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg">⚡</button>
                    <button onclick="addToCart({id: '${p.id}', name: '${p.name}', type: 'digital', price: ${p.price}, details: '${p.desc}'})" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg">🛒</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderEntertainment() {
    const container = document.getElementById('entertainmentCardsContainer');
    if (!container) return;
    container.innerHTML = entertainmentProducts.map(e => `
        <div class="sky-card border p-3 rounded-xl flex items-center justify-between">
            <div>
                <h4 class="font-bold text-xs text-white">${e.name}</h4>
                <div class="text-[10px] text-purple-300">${e.label}</div>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-black text-amber-400 font-mono">${e.price} ج.م</span>
                <button onclick="expressCheckout({id: '${e.id}', name: '${e.name}', type: 'sub', price: ${e.price}, details: '${e.desc}'})" class="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg">⚡</button>
                <button onclick="addToCart({id: '${e.id}', name: '${e.name}', type: 'sub', price: ${e.price}, details: '${e.desc}'})" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg">🛒</button>
            </div>
        </div>
    `).join('');
}

function renderAI() {
    const container = document.getElementById('aiCardsContainer');
    if (!container) return;
    container.innerHTML = aiProducts.map(a => `
        <div class="sky-card border p-3 rounded-xl flex items-center justify-between">
            <div>
                <h4 class="font-bold text-xs text-white">${a.name}</h4>
                <div class="text-[10px] text-indigo-300">${a.tag}</div>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-black text-amber-400 font-mono">${a.price} ج.م</span>
                <button onclick="expressCheckout({id: '${a.id}', name: '${a.name}', type: 'ai', price: ${a.price}, details: '${a.desc}'})" class="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-1 rounded-lg">⚡</button>
                <button onclick="addToCart({id: '${a.id}', name: '${a.name}', type: 'ai', price: ${a.price}, details: '${a.desc}'})" class="sky-btn font-bold text-[10px] px-2 py-1 rounded-lg">🛒</button>
            </div>
        </div>
    `).join('');
}

function renderSMMPlatforms() {
    const grid = document.getElementById('smmPlatformsGrid');
    if (!grid) return;
    grid.innerHTML = smmPlatforms.map(p => `
        <button type="button" onclick="selectSMMPlatform('${p.id}')" class="p-2 rounded-xl ${p.id === currentSMMPlatform.id ? 'sky-active-tab' : 'sky-card border'} text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer">
            <div class="w-5 h-5 flex items-center justify-center">${p.svg}</div>
            <span class="text-[10px] font-bold text-white truncate max-w-full">${p.name}</span>
        </button>
    `).join('');
}
function selectSMMPlatform(pid) {
    currentSMMPlatform = smmPlatforms.find(p => p.id === pid) || smmPlatforms[0];
    renderSMMPlatforms();
    document.getElementById('selectedPlatformIconContainer').innerHTML = currentSMMPlatform.svg;
    document.getElementById('selectedPlatformTitle').innerText = currentSMMPlatform.name;
    document.getElementById('smmCategorySelect').innerHTML = currentSMMPlatform.categories.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
    onSMMCategoryChange();
}
function onSMMCategoryChange() {
    const catIdx = document.getElementById('smmCategorySelect').value || 0;
    const cat = currentSMMPlatform.categories[catIdx] || currentSMMPlatform.categories[0];
    document.getElementById('smmServiceSelect').innerHTML = cat.services.map((srv, i) => {
        const finalPer1k = (srv.baseUSD * 2.0 * USD_TO_EGP).toFixed(1);
        return `<option value="${i}">#${srv.id} - ${srv.title} (${finalPer1k} ج.م / 1k)</option>`;
    }).join('');
    onSMMServiceChange();
}
function getCurrentSMMService() {
    const cat = currentSMMPlatform.categories[document.getElementById('smmCategorySelect').value || 0];
    return cat ? (cat.services[document.getElementById('smmServiceSelect').value || 0] || cat.services[0]) : smmPlatforms[0].categories[0].services[0];
}
function onSMMServiceChange() {
    const srv = getCurrentSMMService();
    const finalPer1k = (srv.baseUSD * 2.0 * USD_TO_EGP).toFixed(2);
    document.getElementById('selectedServiceBadgeId').innerText = 'ID: #' + srv.id;
    document.getElementById('smmLimitsNote').innerText = `الحدود: ${srv.min} - ${srv.max.toLocaleString()}`;
    document.getElementById('smmServiceMeta').innerHTML = `
        <span class="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-mono font-bold">لكل 1,000: ${finalPer1k} ج.م</span>
        <span class="text-gray-400 text-[10px]">بدء فوري وتلقائي</span>
    `;
    calculateSMMCost();
}
function calculateSMMCost() {
    const srv = getCurrentSMMService();
    const qty = Math.max(srv.min, parseFloat(document.getElementById('smmQtyInput').value) || srv.min);
    const totalEGP = (qty / 1000) * (srv.baseUSD * 2.0) * USD_TO_EGP;
    document.getElementById('smmPriceEGP').innerText = totalEGP.toFixed(2) + ' ج.م';
    return totalEGP;
}
function addSMMToCart() {
    const link = document.getElementById('smmLinkInput').value.trim();
    const qty = document.getElementById('smmQtyInput').value;
    const srv = getCurrentSMMService();
    if (!link) return showToast('أدخل الرابط أولاً', 'error');
    if (qty < srv.min || qty > srv.max) return showToast(`الكمية يجب أن تكون بين ${srv.min} و ${srv.max}`, 'error');
    addToCart({ id: 'smm_' + srv.id, name: `${currentSMMPlatform.name} - ${srv.title}`, type: 'smm', price: calculateSMMCost(), details: `الكمية: ${qty} | الرابط: ${link}` });
    document.getElementById('smmLinkInput').value = '';
}
function expressCheckoutSMM() {
    const link = document.getElementById('smmLinkInput').value.trim();
    const qty = document.getElementById('smmQtyInput').value;
    const srv = getCurrentSMMService();
    if (!link) return showToast('أدخل الرابط أولاً', 'error');
    if (qty < srv.min || qty > srv.max) return showToast(`الكمية يجب أن تكون بين ${srv.min} و ${srv.max}`, 'error');
    const cost = calculateSMMCost();
    const item = { id: 'smm_' + srv.id, name: `${currentSMMPlatform.name} - ${srv.title}`, type: 'smm', price: cost, details: `الكمية: ${qty} | الرابط: ${link}` };
    document.getElementById('smmLinkInput').value = '';
    expressCheckout(item);
}

function populateModalGamesList() {
    const select = document.getElementById('modalSelectGame');
    if (!select) return;
    select.innerHTML = GAMES_REGISTRY.map(g => `<option value="${g.key}">${g.label}</option>`).join('');
}

function openPlayerIdModal(targetName, pkgLabel, price, isExpress = false, iconKey = 'pubg') {
    currentModalItem = { name: `${targetName} - ${pkgLabel}`, price: price, targetName: targetName, pkgLabel: pkgLabel, gameKey: iconKey };
    isExpressModal = isExpress;
    populateModalGamesList();
    document.getElementById('modalTargetTitle').innerText = targetName;
    document.getElementById('modalTargetPkg').innerText = `الباقة: ${pkgLabel} (${price.toLocaleString()} ج.م)`;
    
    const iconContainer = document.getElementById('modalTargetIcon');
    if (iconKey === 'tiktok') iconContainer.innerHTML = SVG_LOGOS.tiktok;
    else if (iconKey === 'telegram') iconContainer.innerHTML = SVG_LOGOS.telegram;
    else if (['bigo', 'poppo', 'tango', 'likee', 'chamet', 'yalla', 'sugo', 'meyo'].includes(iconKey)) iconContainer.innerHTML = `<span class="text-2xl">🔴</span>`;
    else iconContainer.innerHTML = `<span class="text-2xl">🎮</span>`;

    document.getElementById('modalInputPlayerId').value = '';
    document.getElementById('modalInputPlayerName').value = '';
    document.getElementById('modalInputZoneId').value = '';
    
    const select = document.getElementById('modalSelectGame');
    const found = GAMES_REGISTRY.find(g => g.key === iconKey);
    select.value = found ? found.key : 'pubg';
    select.disabled = true;
    onModalGameSelectChange();

    document.getElementById('verifyStatusBox').classList.add('hidden');

    const btn = document.getElementById('modalSubmitBtn');
    if (isExpress) {
        btn.className = "w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs sm:text-sm cursor-pointer shadow";
        btn.innerHTML = `متابعة الدفع الفوري ⚡ (${price.toLocaleString()} ج.م)`;
    } else {
        btn.className = "w-full sky-btn font-extrabold py-3 rounded-xl text-xs sm:text-sm cursor-pointer shadow";
        btn.innerHTML = `تأكيد وإضافة للسلة 🛒`;
    }
    btn.onclick = submitPlayerIdModal;
    document.getElementById('playerIdModal').classList.remove('hidden');
    document.getElementById('playerIdModal').classList.add('flex');
}

function closePlayerIdModal() {
    document.getElementById('playerIdModal').classList.add('hidden');
    document.getElementById('playerIdModal').classList.remove('flex');
    currentModalItem = null;
}

function onModalGameSelectChange() {
    const selectedKey = document.getElementById('modalSelectGame').value;
    const targetGame = GAMES_REGISTRY.find(g => g.key === selectedKey);
    const zoneGroup = document.getElementById('modalZoneGroup');
    const idLabel = document.getElementById('modalIdLabel');
    
    if (targetGame && targetGame.isUser) {
        idLabel.innerText = "اسم المستخدم (Username بدون @)";
    } else {
        idLabel.innerText = "معرف اللاعب أو التطبيق (ID)";
    }

    if (targetGame && targetGame.hasZone) zoneGroup.classList.remove('hidden');
    else zoneGroup.classList.add('hidden');
}

async function verifyPlayerAccount() {
    const game = document.getElementById('modalSelectGame').value;
    const uid = document.getElementById('modalInputPlayerId').value.trim().replace(/^@/, '');
    const zoneId = document.getElementById('modalInputZoneId').value.trim();
    const statusBox = document.getElementById('verifyStatusBox');
    const nameInput = document.getElementById('modalInputPlayerName');
    const verifyBtn = document.getElementById('verifyAccountBtn');

    if (!uid) return showToast('أدخل المعرف أو اسم المستخدم أولاً!', 'error');
    const targetGame = GAMES_REGISTRY.find(g => g.key === game);
    if (targetGame && targetGame.hasZone && !zoneId) return showToast('أدخل رقم السيرفر (Zone ID)', 'error');

    verifyBtn.disabled = true;
    verifyBtn.innerText = "جاري...";
    statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-sky-500/15 border-sky-500/40 text-sky-300";
    statusBox.classList.remove('hidden');
    statusBox.innerText = "⏳ جاري الاستعلام المباشر من السيرفر...";

    let query = `/?game=${encodeURIComponent(game)}&id=${encodeURIComponent(uid)}`;
    if (zoneId) query += `&zoneId=${encodeURIComponent(zoneId)}`;

    try {
        const response = await fetch(`${DENO_API_URL}${query}`);
        const data = await response.json();
        const retrievedName = data.username || data.name || (data.data && (data.data.username || data.data.name));
        const avatarUrl = data.avatar || data.avatar_url || (data.data && data.data.avatar);

        if (data.success && (retrievedName || avatarUrl)) {
            nameInput.value = retrievedName || uid;
            statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-emerald-500/20 border-emerald-500/50 text-emerald-300";
            statusBox.innerHTML = `✅ تم التحقق: <span class="text-white font-mono underline">${retrievedName || uid}</span>`;
            if (avatarUrl) {
                document.getElementById('modalTargetIcon').innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover rounded-xl" alt="avatar">`;
            }
            showToast(`تم التعرف على الحساب: ${retrievedName || uid}`);
        } else {
            statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-red-500/20 border-red-500/50 text-red-300";
            statusBox.innerText = `❌ ${data.message || 'لم يتم العثور على الحساب، تأكد من صحة البيانات.'}`;
        }
    } catch (err) {
        statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-amber-500/20 border-amber-500/50 text-amber-300";
        statusBox.innerText = "⚠️ تعذر الاتصال اللحظي. يمكنك كتابة الاسم يدوياً ومتابعة طلبك وسنتأكد منه فوراً.";
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerText = "فحص 🔍";
    }
}

function submitPlayerIdModal() {
    const playerId = document.getElementById('modalInputPlayerId').value.trim();
    const playerName = document.getElementById('modalInputPlayerName').value.trim();
    const zoneId = document.getElementById('modalInputZoneId').value.trim();
    if (!playerId) return showToast('يرجى إدخال المعرف المطلوب!', 'error');

    let detailStr = `ID/User: ${playerId}`;
    if (zoneId) detailStr += ` (Zone: ${zoneId})`;
    if (playerName) detailStr += ` | الاسم: ${playerName}`;

    const item = { id: 'item_' + Date.now(), name: currentModalItem.name, type: 'game_coin', price: currentModalItem.price, details: detailStr };
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
    document.getElementById('checkoutTotalText').innerText = document.getElementById('cartTotal').innerText;
    closeCartModal();
    document.getElementById('checkoutModal').classList.remove('hidden');
    document.getElementById('checkoutModal').classList.add('flex');
}
function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.add('hidden');
    document.getElementById('checkoutModal').classList.remove('flex');
    selectedPayment = null;
    document.getElementById('checkoutDetailsBox').classList.add('hidden');
    document.getElementById('confirmPaymentBtn').classList.add('hidden');
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
    box.classList.remove('hidden');
    title.innerText = displayName;

    const methodData = PAYMENT_METHODS_DATA[methodKey];
    const copyBtn = (txt) => `<button type="button" onclick="copyTextToClipboard('${txt}')" class="mt-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-white font-mono text-xs cursor-pointer shadow transition inline-flex items-center gap-1.5"><span>📋 نسخ:</span> <b>${txt}</b></button>`;

    if (!methodData) {
        content.innerHTML = `الدفع عبر <b>${displayName}</b> متاح. اضغط تأكيد وسنزودك بالتفاصيل عبر واتساب.`;
    } else if (methodData.type === 'copy') {
        content.innerHTML = `${methodData.instruction}<br>${copyBtn(methodData.value)}`;
    } else if (methodData.type === 'bnpl') {
        content.innerHTML = `${methodData.text}<br><span class="text-sky-300 block mt-1 font-bold">اضغط تأكيد وسيتم تزويدك برابط التقسيط المباشر (Contact me to get link) عبر واتساب.</span>`;
    } else {
        content.innerHTML = methodData.html;
    }

    document.getElementById('confirmPaymentBtn').classList.remove('hidden');
}

function finalizeOrderWhatsApp() {
    if (!selectedPayment) return showToast('اختر وسيلة الدفع أولاً', 'error');
    
    const senderInput = document.getElementById('senderAccountInput');
    const senderAcc = senderInput ? senderInput.value.trim() : '';
    if (!senderAcc) return showToast('يرجى إدخال رقم المحفظة أو الحساب الذي قمت بالتحويل منه', 'error');

    const orderId = Math.floor(1000 + Math.random() * 9000);
    let msg = `السلام عليكم، أود تأكيد طلبي الجديد من Migo AI Solution\n`;
    msg += `*رقم الفاتورة:* #${orderId}\n`;
    msg += `*طريقة الدفع:* ${selectedPayment}\n`;
    msg += `*الحساب المُحوّل منه:* ${senderAcc}\n\n`;
    msg += `*--- تفاصيل الطلب ---*\n`;
    cart.forEach((item, index) => {
        msg += `${index + 1}. *${item.name}*\n   - السعر: ${Number(item.price).toLocaleString()} ج.م\n   - البيانات: [${item.details}]\n`;
    });
    msg += `\n*الإجمالي المطلوب:* ${document.getElementById('cartTotal').innerText}`;
    if (appliedCoupon) msg += `\n*(كود الخصم: ${appliedCoupon.code})*`;

    cart = [];
    appliedCoupon = null;
    saveCartToStorage();
    closeCheckoutModal();

    window.location.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
}

function handleLiveSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    query = query.trim().toLowerCase();
    if (!query) { dropdown.classList.add('hidden'); return; }

    let results = [];
    
    tiktokCoinsList.forEach(c => {
        const text = `${c.coins} عملة تيك توك كوينز تكتوك tiktok coins`.toLowerCase();
        if (text.includes(query)) results.push({ name: `تيك توك كوينز (${c.coins} عملة)`, price: c.price, type: 'coin_tiktok', item: c });
    });
    telegramStarsList.forEach(s => {
        const text = `${s.stars} نجمة تليجرام نجوم تلجرام stars telegram`.toLowerCase();
        if (text.includes(query)) results.push({ name: `نجوم تليجرام (${s.stars} نجمة)`, price: s.price, type: 'coin_tg', item: s });
    });
    liveAppsCatalog.forEach(app => {
        const appSearch = `${app.name} ${app.tag} لايف بث كوينز شحن live تانجو لايكي بيجو بوبو`.toLowerCase();
        if (appSearch.includes(query)) {
            app.pkgs.forEach(pkg => results.push({ name: `${app.name} (${pkg.l})`, price: pkg.p, type: 'live', app: app, pkg: pkg }));
        }
    });
    vccCatalog.forEach(v => {
        const vccSearch = `${v.name} فيزا كارت بطاقة شراء دولي vcc visa card`.toLowerCase();
        if (vccSearch.includes(query)) results.push({ name: v.name, price: v.price, type: 'vcc', vccId: v.id });
    });
    allGames.forEach(g => {
        const gSearch = `${g.name} ${g.tag} شدات كوينز جواهر ماسات شحن game ببجي فري فاير روبلوكس بيس فوت موبايل`.toLowerCase();
        if (gSearch.includes(query)) {
            g.pkgs.forEach(pkg => results.push({ name: `${g.name} (${pkg.l})`, price: pkg.p, type: 'game', game: g, pkg: pkg }));
        }
    });
    productivityProducts.forEach(p => {
        const pSearch = `${p.name} ${p.desc} ${p.tag} ${p.keywords || ''}`.toLowerCase();
        if (pSearch.includes(query)) results.push({ name: p.name, price: p.price, type: 'prod', item: p });
    });
    entertainmentProducts.forEach(e => {
        const eSearch = `${e.name} ${e.label} ${e.desc} ${e.keywords || ''}`.toLowerCase();
        if (eSearch.includes(query)) results.push({ name: e.name, price: e.price, type: 'ent', item: e });
    });
    aiProducts.forEach(a => {
        const aSearch = `${a.name} ${a.tag} ${a.desc} ذكاء اصطناعي برمجة api claude codex gpt كوبايلوت شات جي بي تي سونو`.toLowerCase();
        if (aSearch.includes(query)) results.push({ name: a.name, price: a.price, type: 'ai', item: a });
    });
    smmPlatforms.forEach(p => {
        const pSearch = `${p.name} متابعين لايكات مشاهدات تفاعل زيادة ريلز سوشيال ميديا`.toLowerCase();
        if (pSearch.includes(query) || query.includes(p.name.toLowerCase())) {
            p.categories.forEach(cat => {
                cat.services.forEach(srv => {
                    const price1k = ((srv.baseUSD * 2.0 * USD_TO_EGP)).toFixed(0);
                    results.push({
                        name: `${p.name}: ${srv.title}`,
                        price: price1k,
                        type: 'smm_quick',
                        platformId: p.id
                    });
                });
            });
        }
    });

    if (results.length === 0) {
        dropdown.innerHTML = '<div class="text-center py-3 text-xs text-gray-400">لا توجد نتائج مطابقة لبحثك</div>';
    } else {
        dropdown.innerHTML = results.slice(0, 10).map(res => `
            <div class="p-2 hover:bg-slate-800 rounded-xl flex items-center justify-between text-xs transition border-b border-slate-700/50 last:border-0">
                <div class="text-right">
                    <span class="font-bold text-white block">${res.name}</span>
                    <span class="text-amber-400 font-mono font-bold">${Number(res.price).toLocaleString()} ج.م</span>
                </div>
                <button onclick="onGlobalSearchClick('${encodeURIComponent(JSON.stringify(res))}')" class="sky-btn text-[10px] font-bold px-2.5 py-1 rounded-lg">طلب ⚡</button>
            </div>
        `).join('');
    }
    dropdown.classList.remove('hidden');
}

function onGlobalSearchClick(encodedItem) {
    const item = JSON.parse(decodeURIComponent(encodedItem));
    document.getElementById('searchResultsDropdown').classList.add('hidden');
    document.getElementById('liveSearchInput').value = '';
    
    if (item.type === 'vcc') openVccModal(item.vccId);
    else if (item.type === 'coin_tiktok') openPlayerIdModal('تيك توك كوينز', `${item.item.coins} عملة`, item.price, true, 'tiktok');
    else if (item.type === 'coin_tg') openPlayerIdModal('نجوم تليجرام', `${item.item.stars} نجمة`, item.price, true, 'telegram');
    else if (item.type === 'live') openPlayerIdModal(item.app.name, item.pkg.l, item.price, true, item.app.key);
    else if (item.type === 'game') openPlayerIdModal(item.game.name, item.pkg.l, item.price, true, item.game.key);
    else if (item.type === 'prod') expressCheckout({ id: item.item.id, name: item.item.name, type: 'digital', price: item.price, details: item.item.desc });
    else if (item.type === 'ent') expressCheckout({ id: item.item.id, name: item.item.name, type: 'sub', price: item.price, details: item.item.desc });
    else if (item.type === 'ai') expressCheckout({ id: item.item.id, name: item.item.name, type: 'ai', price: item.price, details: item.item.desc });
    else if (item.type === 'smm_quick') {
        selectSMMPlatform(item.platformId);
        window.location.hash = 'sec-social';
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

function getRegisteredUsers() { try { return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY)) || []; } catch (e) { return []; } }
function saveRegisteredUsers(u) { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(u)); }
function encodePass(str) { return btoa(unescape(encodeURIComponent('migo_salt_' + str))); }

function openAuthModal(mode) {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('authModal').classList.add('flex');
    switchAuthTab(mode || 'login');
}
function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('authModal').classList.remove('flex');
}
function switchAuthTab(mode) {
    document.getElementById('loginForm').classList.toggle('hidden', mode !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', mode === 'login');
    document.getElementById('tabLoginBtn').className = (mode === 'login') ? 'py-1.5 text-xs font-bold rounded-lg transition sky-btn cursor-pointer' : 'py-1.5 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer';
    document.getElementById('tabRegisterBtn').className = (mode !== 'login') ? 'py-1.5 text-xs font-bold rounded-lg transition sky-btn cursor-pointer' : 'py-1.5 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer';
}
function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const users = getRegisteredUsers();
    if (users.find(u => u.email === email)) return showToast('البريد مسجل بالفعل', 'error');
    const newUser = { 
        name: document.getElementById('regName').value.trim(), 
        email: email, 
        phone: document.getElementById('regPhone').value.trim(), 
        passwordHash: encodePass(document.getElementById('regPassword').value)
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
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const passHash = encodePass(document.getElementById('loginPassword').value);
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
    if (session && session.email) {
        loginBtn.classList.add('hidden');
        userBadge.classList.remove('hidden');
        userBadge.classList.add('flex');
        document.getElementById('navUserName').innerText = session.name.split(' ')[0];
    } else {
        loginBtn.classList.remove('hidden');
        userBadge.classList.add('hidden');
        userBadge.classList.remove('flex');
    }
}

function toggleSidebar() { document.getElementById('sidebarContainer').classList.toggle('hidden'); }

window.onload = function() {
    updateNavbarAuthUI();
    initVisitorCounter();
    initCountdown();
    loadCartFromStorage();
    renderCoinsAndStars();
    renderLiveApps();
    renderVccCards();
    renderGames();
    renderProductivity();
    renderEntertainment();
    renderAI();
    renderSMMPlatforms();
    selectSMMPlatform('tiktok');
    renderReviews();

    // تشغيل سلايدر العروض تلقائياً كل 5 ثوانٍ
    setInterval(() => { currentSlide = (currentSlide + 1) % 3; updateSlider(); }, 5000);

    setTimeout(triggerSocialProof, 3500);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#liveSearchInput') && !e.target.closest('#searchResultsDropdown')) {
            const dd = document.getElementById('searchResultsDropdown');
            if (dd) dd.classList.add('hidden');
        }
    });
};
