// ==============================================================================
// Migo AI Solution - Complete Store Logic & Engine
// Currency: EGP (Rate: 1 USD = 62 EGP)
// ==============================================================================

const WHATSAPP_NUMBER = "201060934020";
const USD_TO_EGP = 62; 
const USERS_STORAGE_KEY = 'migo_registered_users_v2';
const SESSION_STORAGE_KEY = 'migo_active_member_v2';
const CART_STORAGE_KEY = 'migo_cart_v2';
const DENO_API_URL = "https://migoai-72.naroelwakel-dot.deno.net";

// ------------------------------------------------------------------------------
// SVG Logos for SMM & Interface
// ------------------------------------------------------------------------------
const SVG_LOGOS = {
    tiktok: `<svg class="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.76 1.44-.03 2.74-.93 3.22-2.29.21-.59.27-1.23.26-1.86.03-5.26.01-10.53.02-15.79z"/></svg>`,
    facebook: `<svg class="w-5 h-5 fill-current text-blue-500" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    instagram: `<svg class="w-5 h-5 fill-current text-pink-500" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    telegram: `<svg class="w-5 h-5 fill-current text-sky-400" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.949z"/></svg>`,
    youtube: `<svg class="w-5 h-5 fill-current text-red-500" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    twitter: `<svg class="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    whatsapp: `<svg class="w-5 h-5 fill-current text-emerald-400" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>`,
    snapchat: `<svg class="w-5 h-5 fill-current text-yellow-400" viewBox="0 0 24 24"><path d="M12 2C7.58 2 4 5.58 4 10c0 2.65 1.34 4.98 3.39 6.36-.14.62-.48 1.46-1.39 2.05-.18.12-.25.35-.16.55.08.19.28.31.49.29 2.11-.14 3.67-1.11 4.37-1.63.42.06.85.1 1.3.1 4.42 0 8-3.58 8-8s-3.58-8-8-8z"/></svg>`,
    linkedin: `<svg class="w-5 h-5 fill-current text-blue-400" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 1 0 0-2.9 1.45 1.45 0 0 0 0 2.9m1.37 9.74v-8.37H5.09v8.37h2.74z"/></svg>`,
    spotify: `<svg class="w-5 h-5 fill-current text-emerald-500" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10A10 10 0 0 0 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.792-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.721 1.114.294.18.387.563.207.856zm1.223-2.724c-.226.367-.707.482-1.074.256-2.69-1.654-6.79-2.134-9.97-1.168-.413.125-.85-.107-.975-.52-.125-.414.107-.851.52-.976 3.633-1.103 8.147-.568 11.243 1.334.367.226.482.707.256 1.074zm.105-2.835C14.692 8.95 8.085 8.73 4.708 9.756c-.495.15-1.022-.13-1.172-.625-.15-.495.13-1.022.625-1.172 3.945-1.198 11.23-.944 15.05 1.324.446.265.592.845.327 1.291-.265.446-.845.592-1.291.327z"/></svg>`,
    traffic: `<svg class="w-5 h-5 fill-current text-cyan-400" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V17a1 1 0 0 0-2 0v2.93A8 8 0 0 1 4.07 13H7a1 1 0 0 0 0-2H4.07A8 8 0 0 1 11 4.07V7a1 1 0 0 0 2 0V4.07A8 8 0 0 1 19.93 11H17a1 1 0 0 0 0 2h2.93A8 8 0 0 1 13 19.93z"/></svg>`,
    google: `<svg class="w-5 h-5 fill-current text-amber-400" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3.66 13.5a5.1 5.1 0 1 1 .15-7.14l-1.57 1.51a3 3 0 1 0-.17 4.12l1.59 1.51z"/></svg>`,
    discord: `<svg class="w-5 h-5 fill-current text-indigo-400" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
    twitch: `<svg class="w-5 h-5 fill-current text-purple-400" viewBox="0 0 24 24"><path d="M2.149 0l-1.612 4.119v16.036h5.051v3.845l3.845-3.845h3.042l6.417-6.418v-13.737h-16.743zm14.912 12.449l-2.812 2.812h-3.328l-2.444 2.444v-2.444h-2.906v-12.787h11.49v9.975zm-6.071-6.19h1.794v5.127h-1.794v-5.127zm4.359 0h1.795v5.127h-1.795v-5.127z"/></svg>`,
    threads: `<svg class="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5v.5h-1.8v-.5c0-1.5-1.2-2.7-2.7-2.7s-2.7 1.2-2.7 2.7 1.2 2.7 2.7 2.7c.9 0 1.69-.44 2.18-1.12.42.31.91.51 1.45.58-.87 1.46-2.44 2.44-4.23 2.44z"/></svg>`,
    kick: `<svg class="w-5 h-5 fill-current text-emerald-400" viewBox="0 0 24 24"><path d="M3 2h5v7.2L13.8 2H20l-7.2 8.2L21 22h-6.2l-6.8-8.2V22H3V2z"/></svg>`,
    pinterest: `<svg class="w-5 h-5 fill-current text-red-500" viewBox="0 0 24 24"><path d="M12 0a12 12 0 0 0-4.37 23.18c-.06-.99-.11-2.51.02-3.6.13-1.02.87-3.7.87-3.7s-.22-.45-.22-1.12c0-1.05.61-1.83 1.36-1.83.64 0 .95.48.95 1.06 0 .65-.41 1.62-.63 2.51-.18.75.38 1.36 1.12 1.36 1.34 0 2.38-1.42 2.38-3.46 0-1.81-1.3-3.08-3.16-3.08-2.15 0-3.41 1.61-3.41 3.28 0 .65.25 1.35.56 1.73.06.08.07.14.05.22-.06.26-.2.83-.23.95-.04.16-.13.2-.3.12-1.11-.52-1.81-2.14-1.81-3.45 0-2.8 2.04-5.38 5.88-5.38 3.09 0 5.49 2.2 5.49 5.14 0 3.07-1.93 5.54-4.62 5.54-.9 0-1.75-.47-2.04-1.02l-.56 2.12c-.2.78-.75 1.75-1.12 2.35A12 12 0 1 0 12 0z"/></svg>`,
    kwai: `<svg class="w-5 h-5 fill-current text-orange-500" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5v-3.8l3.2 2.2-1.2 2.1-2-.5zm-4.2-2.1l3.2-2.2V16.5l-2 .5-1.2-2.1zm.2-4.9c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5-2.5-1.1-2.5-2.5z"/></svg>`
};

// ------------------------------------------------------------------------------
// Promotion Countdown & Slider
// ------------------------------------------------------------------------------
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

let currentSlide = 0;
function updateSlider() {
    const track = document.getElementById('sliderTrack');
    if (track) track.style.transform = `translateX(${currentSlide * 100}%)`;
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentSlide);
    });
}
function goToSlide(index) { currentSlide = index; updateSlider(); }
setInterval(() => { currentSlide = (currentSlide + 1) % 3; updateSlider(); }, 5000);

// ------------------------------------------------------------------------------
// Social Proof Notifications & Visitor Counter
// ------------------------------------------------------------------------------
const egyptianNames = ["أحمد م.", "محمد س.", "كريم ع.", "يوسف ط.", "عمر ح.", "سارة م.", "محمود خ.", "زياد ف.", "مصطفى ن.", "نور د."];
const purchaseTemplates = [
    { act: "شحن 700 عملة تيك توك فوري", icon: '💎' },
    { act: "طلب بطاقة افتراضية VCC (25$)", icon: '💳' },
    { act: "شحن 3850 UC ببجي موبايل", icon: '🎮' },
    { act: "تفعيل Claude Max 5x", icon: '🧠' },
    { act: "تفعيل Notion Plus 12M", icon: '🎨' },
    { act: "شحن 500 نجمة تليجرام", icon: '⭐' },
    { act: "شحن 840 ماسة بيجو لايف", icon: '🔴' },
    { act: "تفعيل اشتراك Canva Pro Admin", icon: '🎨' },
    { act: "شحن 550 كوينز eFootball", icon: '⚽' },
    { act: "تفعيل API Claude 30D", icon: '🧠' },
    { act: "تفعيل اشتراك Super Grok", icon: '🧠' },
    { act: "تفعيل Cursor AI Pro", icon: '💻' }
];

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
    setTimeout(() => { popup.classList.add('translate-y-24', 'opacity-0'); }, 4500);
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

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all transform duration-300 -translate-x-full flex items-center gap-2 ${type === 'success' ? 'bg-emerald-600 border border-emerald-400' : 'bg-red-600 border border-red-400'}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('-translate-x-full'), 10);
    setTimeout(() => { toast.classList.add('-translate-x-full'); setTimeout(() => toast.remove(), 300); }, 3200);
}

// ------------------------------------------------------------------------------
// Cart System & Discount Coupons
// ------------------------------------------------------------------------------
let cart = [];
let appliedCoupon = null;
const validCoupons = {
    'SIAFFC15': { discount: 0.15 },
    'MIGO15': { discount: 0.15 },
    'WELCOME10': { discount: 0.10 }
};

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

// ------------------------------------------------------------------------------
// 1. TikTok Coins & Telegram Stars Catalog
// ------------------------------------------------------------------------------
const tiktokCoinsList = [
    { coins: 70, price: 65 },
    { coins: 350, price: 295 },
    { coins: 700, price: 575 },
    { coins: 1400, price: 1100 },
    { coins: 3500, price: 2680 },
    { coins: 7000, price: 5250 },
    { coins: 17500, price: 12950 }
];

const telegramStarsList = [
    { stars: 50, price: 85 },
    { stars: 100, price: 165 },
    { stars: 250, price: 395 },
    { stars: 500, price: 770 },
    { stars: 1000, price: 1490 }
];

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

// ------------------------------------------------------------------------------
// 2. Live Streaming Apps (All 6 Apps Fully Intact)
// ------------------------------------------------------------------------------
const liveAppsCatalog = [
    { key: 'bigo', name: "بيجو لايف (BIGO Live)", tag: "شحن فوري بالـ ID", pkgs: [{l: "42 ماسة", p: 60}, {l: "210 ماسة", p: 295}, {l: "840 ماسة", p: 1180}, {l: "2100 ماسة", p: 2950}] },
    { key: 'poppo', name: "بوبو لايف (Poppo Live)", tag: "فوري بالمعرف", pkgs: [{l: "7,000 نقطة", p: 65}, {l: "35,000 نقطة", p: 310}, {l: "70,000 نقطة", p: 620}, {l: "140,000 نقطة", p: 1240}] },
    { key: 'chamet', name: "تشاميت (Chamet)", tag: "فوري بالـ ID", pkgs: [{l: "1,000 ماسة", p: 75}, {l: "5,000 ماسة", p: 360}, {l: "10,000 ماسة", p: 710}, {l: "20,000 ماسة", p: 1400}] },
    { key: 'yalla', name: "يلا لودو (Yalla Ludo)", tag: "الماس ودايموند", pkgs: [{l: "50 دايموند", p: 60}, {l: "250 دايموند", p: 285}, {l: "500 دايموند", p: 560}, {l: "1,000 دايموند", p: 1100}] },
    { key: 'sugo', name: "سوجو (SUGO)", tag: "عملات الدردشة", pkgs: [{l: "حزمة أساسية", p: 70}, {l: "حزمة متوسطة", p: 340}, {l: "حزمة VIP", p: 680}] },
    { key: 'meyo', name: "ميو (MeYo)", tag: "رصيد المكالمات", pkgs: [{l: "100 عملة", p: 65}, {l: "500 عملة", p: 320}, {l: "1,000 عملة", p: 630}] }
];

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

// ------------------------------------------------------------------------------
// 3. Virtual Cards (VCC)
// ------------------------------------------------------------------------------
const vccCatalog = [
    { id: 'vcc_10', name: 'بطاقة افتراضية (10 دولار)', price: 700, tag: 'تفعيل سريع' },
    { id: 'vcc_25', name: 'بطاقة افتراضية (25 دولار)', price: 1650, tag: 'الأكثر طلباً' },
    { id: 'vcc_50', name: 'بطاقة افتراضية (50 دولار)', price: 3250, tag: 'ممتازة للإعلانات' },
    { id: 'vcc_100', name: 'بطاقة افتراضية (100 دولار)', price: 6400, tag: 'للشركات والمواقع' }
];

let selectedVccItem = null;
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

// ------------------------------------------------------------------------------
// 4. Games Catalog (All 18 Games & All Packages Intact)
// ------------------------------------------------------------------------------
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

// ------------------------------------------------------------------------------
// 5. Productivity, Design & Digital Assets
// ------------------------------------------------------------------------------
const productivityProducts = [
    { id: 'prod_canva_adm', name: 'Canva Pro Admin', tag: 'تحكم إداري كامل', price: 340, desc: 'موثق بالمستندات مع صلاحية إضافة أعضاء' },
    { id: 'prod_capcut_1m', name: 'CapCut Pro (شهر)', tag: 'جاهز وثابت 30 يوم', price: 110, desc: 'يدعم جهازين وضمان كامل' },
    { id: 'prod_capcut_6m', name: 'CapCut Pro (6 شهور)', tag: 'اشتراك 6 شهور', price: 680, desc: 'حساب ثابت نصف سنوي' },
    { id: 'prod_capcut_cred', name: 'CapCut Pro 1600 نقطة', tag: 'رصيد توليد AI', price: 140, desc: 'رصيد نقاط إضافي' },
    { id: 'prod_notion', name: 'Notion Plus (12 شهر)', tag: 'تسليم فوري Outlook', price: 115, desc: 'حساب مخصص ومفعل لسنة كاملة' },
    { id: 'prod_miro', name: 'Miro Lifetime Panel', tag: 'مدى الحياة', price: 680, desc: 'إدارة فريق رسمي حتى 100 عضو' },
    { id: 'prod_ilovepdf', name: 'iLovePDF Premium (سنة)', tag: 'شامل 2000 رصيد AI', price: 80, desc: 'توقيعات رقمية وتعديل كامل' },
    { id: 'prod_framer', name: 'Framer AI (سنة)', tag: 'كود ترقية رسمي', price: 475, desc: 'خطة Basic السنوية لتصميم المواقع' },
    { id: 'prod_figma', name: 'Figma Pro Edu (سنتين)', tag: 'اشتراك سنتين', price: 340, desc: 'أدوات التصميم والـ UI/UX كاملة' },
    { id: 'prod_office', name: 'Office 365 Plus (سنة)', tag: 'مايكروسوفت أوفيس', price: 45, desc: 'حزمة برامج كاملة مع سحابة OneDrive' },
    { id: 'prod_adobe', name: 'Adobe Express (12 شهر)', tag: 'أدوبي للتصميم', price: 50, desc: 'تفعيل لسنة كاملة' },
    { id: 'prod_gmail', name: 'حسابات Gmail جاهزة', tag: 'مع أكواد الاسترداد', price: 55, desc: 'تسليم: البريد | الباسورد | كود 8 أرقام' },
    { id: 'prod_hotmail', name: 'حسابات Outlook / Hotmail', tag: 'جاهزة وفورية', price: 5, desc: 'إيميلات نظيفة للاستخدام الفوري' },
    { id: 'prod_vpn_nord', name: 'NordVPN (3 شهور)', tag: 'حماية وVPN', price: 210, desc: 'تشفير فائق وحماية للتصفح' },
    { id: 'prod_vpn_express', name: 'ExpressVPN (شهر)', tag: 'أعلى سرعة VPN', price: 115, desc: 'حساب مفعل شهر كامل' }
];

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

// ------------------------------------------------------------------------------
// 6. Entertainment & Streaming
// ------------------------------------------------------------------------------
const entertainmentProducts = [
    { id: 'sub_netflix', name: 'Netflix Premium', label: 'حساب كامل برمز خاص', price: 310, desc: 'ضمان كامل طوال المدة' },
    { id: 'sub_shahid', name: 'شاهد VIP', label: 'شهر واحد', price: 205, desc: 'أحدث المسلسلات بدون إعلانات' },
    { id: 'sub_prime', name: 'Prime Video (6 شهور)', label: 'وصول كامل للإيميل', price: 270, desc: 'حساب خاص بضمان شهرين' },
    { id: 'sub_youtube', name: 'YouTube Premium', label: 'شهر واحد', price: 115, desc: 'تشغيل بالخلفية وبدون إعلانات' },
    { id: 'sub_spotify', name: 'Spotify Premium', label: 'شهر واحد', price: 95, desc: 'موسيقى بجودة فائقة بدون فواصل' },
    { id: 'sub_appletv', name: 'Apple TV (12 شهر)', label: 'سنة كاملة', price: 140, desc: 'وصول لمكتبة آبل سينما' }
];

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

// ------------------------------------------------------------------------------
// 7. AI & Developer APIs (COMPLETE RESTORED LIST - NO OMISSIONS)
// ------------------------------------------------------------------------------
const aiProducts = [
    // عائلة كلود (Claude AI)
    { id: 'ai_claude_max5', name: 'Claude Max 5x', tag: '5 أضعاف Pro', price: 4340, desc: 'حساب خاص مفعل على بريدك وبدون VPN' },
    { id: 'ai_claude_max20', name: 'Claude Max 20x', tag: 'الاستخدام الأقصى 20x', price: 9200, desc: 'أعلى باقة للشركات بدون حدود إرسال' },
    { id: 'ai_claude_pro', name: 'Claude AI Pro', tag: 'شهر واحد', price: 1200, desc: 'تفعيل رسمي على إيميلك الشخصي مباشرة' },
    { id: 'ai_claude_team', name: 'Claude Team Workspace', tag: 'فريق عمل', price: 2900, desc: 'مساحة عمل مخصصة لفريقك حتى 5 أعضاء' },
    
    // مفاتيح الـ API للمطورين
    { id: 'ai_api_claude10', name: 'API Claude 10M Tokens', tag: 'يومي للمطورين', price: 75, desc: 'تسليم فوري للمفتاح مخصص للبرمجة' },
    { id: 'ai_api_claude50', name: 'API Claude 50M Tokens', tag: 'توكنز مرتفعة', price: 210, desc: 'صلاحية يومين للاستخدام المكثف' },
    { id: 'ai_api_claude_100', name: 'API Claude 30D $100', tag: 'رصيد 100 دولار', price: 150, desc: 'صلاحية شهر كامل لدعم مشاريعك' },
    { id: 'ai_api_codex10', name: 'API CODEX 10M Tokens', tag: 'أكواد وبرمجة', price: 75, desc: 'مخصص لمحررات الأكواد والمطورين' },
    { id: 'ai_api_codex50', name: 'API CODEX 50M Tokens', tag: 'توكنز برمجية 50M', price: 185, desc: 'صلاحية يومين مع دعم كامل' },
    { id: 'ai_api_codex100', name: 'API CODEX 100M Tokens', tag: 'توكنز برمجية 100M', price: 310, desc: 'صلاحية 3 أيام للمشاريع الكبيرة' },

    // منصات الذكاء الاصطناعي الأخرى
    { id: 'ai_super_grok', name: 'Super Grok (xAI)', tag: 'إيلون ماسك الذكي', price: 980, desc: 'اشتراك رسمي في أقوى نماذج Grok غير المقيدة' },
    { id: 'ai_midjourney_std', name: 'Midjourney Standard', tag: 'توليد الصور الاحترافي', price: 1850, desc: 'ساعات Fast كاملة وتوليد صور غير محدود في Relax' },
    { id: 'ai_midjourney_pro', name: 'Midjourney Pro', tag: 'وضع التخفي (Stealth)', price: 3700, desc: 'الوضع السري وحرية تجارية كاملة للمصممين' },
    { id: 'ai_chatgpt', name: 'ChatGPT Plus (شهر)', tag: 'GPT-4o الأصلي', price: 480, desc: 'حساب مفعل بكامل مميزات التحليل وتوليد الصور' },
    { id: 'ai_perplexity_pro', name: 'Perplexity Pro', tag: 'محرك البحث الذكي', price: 450, desc: 'بحث علمي وتحليلي متقدم مع Claude 3.5 و GPT-4o' },
    { id: 'ai_cursor_pro', name: 'Cursor AI Pro', tag: 'محرر المبرمجين الذكي', price: 1250, desc: 'أقوى IDE برمجي مدعوم بالذكاء الاصطناعي' },
    { id: 'ai_elevenlabs', name: 'ElevenLabs Creator', tag: 'دوبلاج وأصوات AI', price: 1350, desc: '100,000 حرف شهرياً واستنساخ الأصوات بدقة فائقة' },
    { id: 'ai_muse', name: 'Muse AI', tag: 'توليد ومونتاج ذكي', price: 140, desc: 'حساب كامل مخصص للإنتاج المرئي' }
];

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

// ------------------------------------------------------------------------------
// 8. SMM Engine (All 18 Platforms Fully Intact)
// ------------------------------------------------------------------------------
const smmPlatforms = [
    { 
        id: 'tiktok', name: 'تيك توك', svg: SVG_LOGOS.tiktok,
        categories: [
            { 
                name: 'تيك توك - لايكات وإعجابات', 
                services: [
                    { id: 2218, title: 'لايكات فورية | 10k/يوم | ضمان 30 يوم ♻️', baseUSD: 1.85, min: 10, max: 1000000 },
                    { id: 2221, title: 'لايكات فائقة السرعة | 20k/يوم | بدون ضمان 🔥', baseUSD: 1.14, min: 10, max: 500000 },
                    { id: 2222, title: 'لايكات فائق السرعة | 30k/يوم | ضمان 15 يوم', baseUSD: 1.85, min: 10, max: 750000 },
                    { id: 1665, title: 'لايكات جودة عالية | بدون نقص | ضمان سنة كاملة 365 يوم', baseUSD: 1.42, min: 10, max: 1000000 },
                    { id: 2100, title: 'لايكات اقتصادية | ضمان 365 يوم', baseUSD: 0.71, min: 10, max: 1000000 }
                ] 
            },
            { 
                name: 'تيك توك - متابعين', 
                services: [
                    { id: 2410, title: 'متابعين حقيقيين | ضمان 30 يوم', baseUSD: 2.90, min: 100, max: 100000 },
                    { id: 2415, title: 'متابعين فوري فائق السرعة', baseUSD: 3.50, min: 100, max: 50000 }
                ] 
            },
            { 
                name: 'تيك توك - مشاهدات وبث مباشر', 
                services: [
                    { id: 2301, title: 'مشاهدات فيديو فورية (اكسبلور)', baseUSD: 0.15, min: 1000, max: 10000000 },
                    { id: 2305, title: 'مشاهدات بث مباشر (Live Stream)', baseUSD: 2.40, min: 100, max: 50000 }
                ] 
            },
            { 
                name: 'تيك توك - شير وحفظ المنشورات (Save)', 
                services: [
                    { id: 2350, title: 'حفظ المنشورات (سيف) عالي الجودة', baseUSD: 0.30, min: 100, max: 500000 },
                    { id: 2360, title: 'مشاركات وإكسبلور (شير)', baseUSD: 0.40, min: 100, max: 500000 }
                ] 
            }
        ] 
    },
    { 
        id: 'facebook', name: 'فيسبوك', svg: SVG_LOGOS.facebook,
        categories: [
            { 
                name: 'مشاهدات بث مباشر [اقتصادي]', 
                services: [
                    { id: 1913, title: 'مشاهدات بث مباشر | 15 دقيقة', baseUSD: 1.72, min: 50, max: 20000 },
                    { id: 1914, title: 'مشاهدات بث مباشر | 30 دقيقة', baseUSD: 3.45, min: 50, max: 20000 },
                    { id: 1915, title: 'مشاهدات بث مباشر | 60 دقيقة', baseUSD: 6.89, min: 50, max: 20000 },
                    { id: 1916, title: 'مشاهدات بث مباشر | 90 دقيقة', baseUSD: 10.34, min: 50, max: 20000 },
                    { id: 1917, title: 'مشاهدات بث مباشر | 120 دقيقة', baseUSD: 13.75, min: 50, max: 20000 }
                ] 
            },
            { 
                name: 'تفاعلات المنشورات (Love, Care, Wow)', 
                services: [
                    { id: 1960, title: 'تفاعلات بوستات منوعة مخصصة', baseUSD: 0.95, min: 100, max: 50000 }
                ] 
            },
            { 
                name: 'متابعين صفحات وحسابات', 
                services: [
                    { id: 1950, title: 'متابعين صفحات وحسابات شخصية | ضمان', baseUSD: 1.85, min: 100, max: 500000 }
                ] 
            },
            { 
                name: 'ساعات المشاهدة وتفعيل الأرباح', 
                services: [
                    { id: 1990, title: 'باقة تفعيل ساعات مشاهدة الفيديوهات والريلز', baseUSD: 12.00, min: 1000, max: 60000 }
                ] 
            }
        ] 
    },
    { 
        id: 'instagram', name: 'انستقرام', svg: SVG_LOGOS.instagram,
        categories: [
            { name: 'متابعين', services: [{ id: 2510, title: 'متابعين ضمان 365 يوم', baseUSD: 1.65, min: 100, max: 500000 }] },
            { name: 'ريلز ولايكات', services: [{ id: 2520, title: 'لايكات فورية حقيقية', baseUSD: 0.45, min: 100, max: 100000 }] }
        ] 
    },
    { 
        id: 'youtube', name: 'يوتيوب', svg: SVG_LOGOS.youtube,
        categories: [
            { name: 'تفاعل ومشاهدات', services: [{ id: 3205, title: 'مشتركين قنوات حقيقيين', baseUSD: 8.50, min: 100, max: 50000 }, { id: 3201, title: 'مشاهدات فيديو حقيقية', baseUSD: 1.90, min: 1000, max: 1000000 }] }
        ] 
    },
    { 
        id: 'telegram', name: 'تليجرام', svg: SVG_LOGOS.telegram,
        categories: [
            { name: 'قنوات ومجموعات', services: [{ id: 3101, title: 'أعضاء قنوات وجروبات ثبات', baseUSD: 1.75, min: 100, max: 200000 }] }
        ] 
    },
    { 
        id: 'twitter', name: 'إكس (تويتر)', svg: SVG_LOGOS.twitter,
        categories: [
            { name: 'تفاعل', services: [{ id: 3301, title: 'لايكات وإعادة نشر (Retweet)', baseUSD: 1.40, min: 100, max: 100000 }] }
        ] 
    },
    { 
        id: 'whatsapp', name: 'واتساب', svg: SVG_LOGOS.whatsapp,
        categories: [
            { name: 'قنوات ومجموعات', services: [{ id: 4101, title: 'أعضاء قنوات واتساب رسمية', baseUSD: 2.50, min: 100, max: 50000 }] }
        ] 
    },
    { 
        id: 'snapchat', name: 'سناب شات', svg: SVG_LOGOS.snapchat,
        categories: [
            { name: 'متابعين ومشاهدات', services: [{ id: 4201, title: 'متابعين منصة الأضواء وحسابات', baseUSD: 4.80, min: 100, max: 20000 }] }
        ] 
    },
    { 
        id: 'linkedin', name: 'لينكد إن', svg: SVG_LOGOS.linkedin,
        categories: [
            { name: 'متابعين وتفاعل', services: [{ id: 4301, title: 'متابعين حسابات شخصية وشركات', baseUSD: 7.50, min: 100, max: 25000 }] }
        ] 
    },
    { 
        id: 'spotify_smm', name: 'سبوتيفاي', svg: SVG_LOGOS.spotify,
        categories: [
            { name: 'استماعات ومتابعين', services: [{ id: 4401, title: 'استماعات أغاني حقيقية (Plays)', baseUSD: 1.20, min: 1000, max: 1000000 }] }
        ] 
    },
    { 
        id: 'traffic', name: 'زيارات مواقع', svg: SVG_LOGOS.traffic,
        categories: [
            { name: 'زيارات الويب', services: [{ id: 4501, title: 'زيارات جوجل عضوية حقيقية', baseUSD: 0.85, min: 1000, max: 1000000 }] }
        ] 
    },
    { 
        id: 'google_reviews', name: 'خرائط جوجل', svg: SVG_LOGOS.google,
        categories: [
            { name: 'تقييمات', services: [{ id: 4601, title: 'تقييمات 5 نجوم مع تعليقات مخصصة', baseUSD: 18.00, min: 10, max: 500 }] }
        ] 
    },
    { 
        id: 'discord', name: 'ديسكورد', svg: SVG_LOGOS.discord,
        categories: [
            { name: 'أعضاء سيرفرات', services: [{ id: 4701, title: 'أعضاء سيرفرات ديسكورد حقيقيين', baseUSD: 3.20, min: 100, max: 50000 }] }
        ] 
    },
    { 
        id: 'twitch', name: 'تويتش', svg: SVG_LOGOS.twitch,
        categories: [
            { name: 'متابعين ومشاهدات', services: [{ id: 4801, title: 'متابعين قنوات تويتش', baseUSD: 1.80, min: 100, max: 50000 }] }
        ] 
    },
    { 
        id: 'threads', name: 'ثريدز', svg: SVG_LOGOS.threads,
        categories: [
            { name: 'متابعين ولايكات', services: [{ id: 4901, title: 'متابعين ثريدز حقيقيين', baseUSD: 2.10, min: 100, max: 50000 }] }
        ] 
    },
    { 
        id: 'kick', name: 'كيك (Kick)', svg: SVG_LOGOS.kick,
        categories: [
            { name: 'متابعين وبث', services: [{ id: 5001, title: 'متابعين ومشاهدات بثوث Kick', baseUSD: 2.50, min: 100, max: 50000 }] }
        ] 
    },
    { 
        id: 'pinterest', name: 'بينترست', svg: SVG_LOGOS.pinterest,
        categories: [
            { name: 'متابعين وإعجابات', services: [{ id: 5101, title: 'متابعين لوحات وحسابات بينترست', baseUSD: 2.30, min: 100, max: 50000 }] }
        ] 
    },
    { 
        id: 'kwai', name: 'كواي (Kwai)', svg: SVG_LOGOS.kwai,
        categories: [
            { name: 'تفاعل', services: [{ id: 5201, title: 'متابعين ومشاهدات كواي فورية', baseUSD: 1.50, min: 100, max: 100000 }] }
        ] 
    }
];

let currentSMMPlatform = smmPlatforms[0];

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

// ------------------------------------------------------------------------------
// 9. ID & Account Lookup Modal (Games & TikTok & Live Apps)
// ------------------------------------------------------------------------------
let currentModalItem = null;
let isExpressModal = false;

const GAMES_REGISTRY = [
    { key: 'tiktok', label: 'تيك توك كوينز (TikTok Username)', hasZone: false, isUser: true },
    { key: 'telegram', label: 'تليجرام (Telegram Username)', hasZone: false, isUser: true },
    { key: 'pubg', label: 'بابجي موبايل (PUBG Mobile)', hasZone: false },
    { key: 'freefire', label: 'فري فاير (Free Fire)', hasZone: false },
    { key: 'efootball', label: 'إي فوتبول (eFootball Konami ID)', hasZone: false },
    { key: 'mlbb', label: 'موبايل ليجندز (Mobile Legends)', hasZone: true },
    { key: 'roblox', label: 'روبلوكس (Roblox)', hasZone: false },
    { key: 'pool8', label: '8 Ball Pool (Miniclip ID)', hasZone: false },
    { key: 'clash', label: 'كلاش أوف كلانس (Player Tag)', hasZone: false },
    { key: 'fifa', label: 'فيفا موبايل (FC Mobile)', hasZone: false },
    { key: 'brawl', label: 'براول ستارز (Player Tag)', hasZone: false },
    { key: 'genshin', label: 'جينشين إمباكت (Genshin UID)', hasZone: true },
    { key: 'codm', label: 'كول أوف ديوتي (Player ID)', hasZone: false },
    { key: 'bigo', label: 'بيجو لايف (BIGO ID)', hasZone: false },
    { key: 'poppo', label: 'بوبو لايف (Poppo ID)', hasZone: false },
    { key: 'chamet', label: 'تشاميت (Chamet ID)', hasZone: false },
    { key: 'yalla', label: 'يلا لودو (User ID)', hasZone: false },
    { key: 'sugo', label: 'سوجو (SUGO ID)', hasZone: false },
    { key: 'meyo', label: 'ميو (MeYo ID)', hasZone: false }
];

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
    else if (['bigo', 'poppo', 'chamet', 'yalla', 'sugo', 'meyo'].includes(iconKey)) iconContainer.innerHTML = `<span class="text-2xl">🔴</span>`;
    else iconContainer.innerHTML = `<span class="text-2xl">🎮</span>`;

    document.getElementById('modalInputPlayerId').value = '';
    document.getElementById('modalInputPlayerName').value = '';
    document.getElementById('modalInputZoneId').value = '';
    
    const select = document.getElementById('modalSelectGame');
    const found = GAMES_REGISTRY.find(g => g.key === iconKey);
    select.value = found ? found.key : 'pubg';
    onModalGameSelectChange();

    const statusBox = document.getElementById('verifyStatusBox');
    statusBox.classList.add('hidden');

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

// ------------------------------------------------------------------------------
// 10. Checkout & Complete Payment Gateways
// ------------------------------------------------------------------------------
let selectedPayment = null;
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
        navigator.clipboard.writeText(txt).then(() => showToast('تم نسخ الرقم'));
    }
}
function selectPaymentMethod(method, name, btnElement) {
    selectedPayment = method;
    document.querySelectorAll('.pay-method-btn').forEach(btn => btn.classList.remove('border-sky-400', 'bg-slate-800'));
    if (btnElement) btnElement.classList.add('border-sky-400', 'bg-slate-800');
    const box = document.getElementById('checkoutDetailsBox');
    const title = document.getElementById('checkoutPayTitle');
    const content = document.getElementById('checkoutPayContent');
    box.classList.remove('hidden');
    title.innerText = name;
    const copyBtn = (txt) => `<button type="button" onclick="copyTextToClipboard('${txt}')" class="mt-2 bg-slate-800 border border-slate-600 px-3 py-1 rounded-lg text-white font-mono text-xs cursor-pointer">📋 نسخ: ${txt}</button>`;
    
    if (method === 'vodafone') content.innerHTML = `يرجى تحويل المبلغ لمحفظة فودافون كاش التالية:<br>${copyBtn('01020323432')}`;
    else if (method === 'instapay') content.innerHTML = `يرجى تحويل المبلغ عبر إنستاباي للحساب التالي:<br>${copyBtn('01146691073')}`;
    else if (method === 'etisalat') content.innerHTML = `يرجى تحويل المبلغ لمحفظة اتصالات كاش التالية:<br>${copyBtn('01146691073')}`;
    else if (method === 'orange') content.innerHTML = `يرجى تحويل المبلغ لمحفظة أورنج كاش التالية:<br>${copyBtn('01200000000')}`;
    else if (method === 'card') content.innerHTML = `الدفع عبر البطاقات البنكية المباشرة متاح عبر بوابة الدفع الآمنة. سيتم تزويدك برابط مباشر بالضغط على زر الواتساب.`;
    else content.innerHTML = `الدفع عبر <b>${name}</b> متاح. اضغط على الزر وسنزودك برابط الفاتورة المباشر فوراً على واتساب.`;

    document.getElementById('confirmPaymentBtn').classList.remove('hidden');
}
function finalizeOrderWhatsApp() {
    if (!selectedPayment) return showToast('اختر وسيلة الدفع أولاً', 'error');
    const orderId = Math.floor(1000 + Math.random() * 9000);
    let msg = `السلام عليكم، أود تأكيد طلبي الجديد من Migo AI Solution\n`;
    msg += `*رقم الفاتورة:* #${orderId}\n`;
    msg += `*طريقة الدفع:* ${selectedPayment}\n\n`;
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
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
}

// ------------------------------------------------------------------------------
// 11. Live Search
// ------------------------------------------------------------------------------
function handleLiveSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    query = query.trim().toLowerCase();
    if (!query) { dropdown.classList.add('hidden'); return; }

    let results = [];
    tiktokCoinsList.forEach(c => {
        if (`${c.coins} عملة تيك توك كوينز tiktok`.includes(query)) results.push({ name: `تيك توك كوينز (${c.coins} عملة)`, price: c.price, type: 'coin_tiktok', item: c });
    });
    telegramStarsList.forEach(s => {
        if (`${s.stars} نجمة تليجرام stars`.includes(query)) results.push({ name: `نجوم تليجرام (${s.stars} نجمة)`, price: s.price, type: 'coin_tg', item: s });
    });
    liveAppsCatalog.forEach(app => {
        if (app.name.toLowerCase().includes(query)) {
            app.pkgs.forEach(pkg => results.push({ name: `${app.name} (${pkg.l})`, price: pkg.p, type: 'live', app: app, pkg: pkg }));
        }
    });
    vccCatalog.forEach(v => {
        if (v.name.toLowerCase().includes(query) || 'فيزا بطاقة vcc'.includes(query)) results.push({ name: v.name, price: v.price, type: 'vcc', vccId: v.id });
    });
    allGames.forEach(g => {
        if (g.name.toLowerCase().includes(query)) {
            g.pkgs.forEach(pkg => results.push({ name: `${g.name} (${pkg.l})`, price: pkg.p, type: 'game', game: g, pkg: pkg }));
        }
    });
    productivityProducts.forEach(p => {
        if (p.name.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query)) results.push({ name: p.name, price: p.price, type: 'prod', item: p });
    });
    entertainmentProducts.forEach(e => {
        if (e.name.toLowerCase().includes(query)) results.push({ name: e.name, price: e.price, type: 'ent', item: e });
    });
    aiProducts.forEach(a => {
        if (a.name.toLowerCase().includes(query) || a.tag.toLowerCase().includes(query) || a.desc.toLowerCase().includes(query)) results.push({ name: a.name, price: a.price, type: 'ai', item: a });
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
}

// ------------------------------------------------------------------------------
// 12. User Auth & Reviews
// ------------------------------------------------------------------------------
const verifiedReviews = [
    { name: "أحمد عبد الرحمن", service: "تيك توك كوينز (700)", text: "شحن فوري باليوزر نيم فقط بدون أي تعقيد وفحص الحساب والصورة ميزة ممتازة.", date: "أكتوبر 2026" },
    { name: "محمد طارق", service: "ببجي 3850 UC", text: "الشدات وصلت فوراً بعد التحويل بالـ ID، خدمة سريعة جداً ومحترمة.", date: "أكتوبر 2026" },
    { name: "محمود إبراهيم", service: "فيزا افتراضية (50$)", text: "استلمت بيانات الكارت واشتغلت في إعلانات الفيسبوك بدون أي رفض.", date: "أكتوبر 2026" },
    { name: "سارة م.", service: "Canva Pro Admin", text: "الحساب شغال بصلاحيات الأدمن كاملة وممتاز جداً لفريقي في التصميم.", date: "أكتوبر 2026" },
    { name: "خالد وائل", service: "بيجو لايف (840 ماسة)", text: "الماسات نزلت في حسابي فوراً بعد الفحص بالـ ID، متجر ثقة.", date: "أكتوبر 2026" },
    { name: "يوسف إبراهيم", service: "Claude Max 5x", text: "شغال بأعلى كفاءة وبدون VPN، أنقذني في مشاريع البرمجة والعمل.", date: "أكتوبر 2026" }
];

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

// ------------------------------------------------------------------------------
// Store Application Initialization
// ------------------------------------------------------------------------------
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

    setTimeout(triggerSocialProof, 3500);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#liveSearchInput') && !e.target.closest('#searchResultsDropdown')) {
            const dd = document.getElementById('searchResultsDropdown');
            if (dd) dd.classList.add('hidden');
        }
    });
};
