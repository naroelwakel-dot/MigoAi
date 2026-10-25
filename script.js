const WHATSAPP_NUMBER = "201060934020";
const USD_TO_EGP = 62; 
const USERS_STORAGE_KEY = 'migo_registered_users_v2';
const SESSION_STORAGE_KEY = 'migo_active_member_v2';
const CART_STORAGE_KEY = 'migo_cart_v2';
const ADMIN_EMAIL = "sahermohamed123456@gmail.com";
const DENO_API_URL = "https://migoai-72.naroelwakel-dot.deno.net";

const SVG_LOGOS = {
    pubg: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1e293b"/><path d="M12 4L4 8V14C4 18.5 7.5 21.5 12 22C16.5 21.5 20 18.5 20 14V8L12 4Z" fill="#F59E0B"/><path d="M7 11H17V14H7V11Z" fill="#0F172A"/><path d="M9 8H15V10H9V8Z" fill="#0F172A"/></svg>`,
    roblox: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#0F172A"/><path d="M6.2 4L19.8 8.4L17.8 20L4.2 15.6L6.2 4Z" fill="#EF4444"/><rect x="10.5" y="10.5" width="3.5" height="3.5" rx="0.5" transform="rotate(18 12.25 12.25)" fill="#0F172A"/></svg>`,
    freefire: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1E1B4B"/><path d="M12 3C12 3 7 8 7 13C7 16 9 19 12 21C15 19 17 16 17 13C17 8 12 3 12 3Z" fill="#F97316"/><path d="M12 8C12 8 9.5 11 9.5 13.5C9.5 15.5 10.5 17 12 18C13.5 17 14.5 15.5 14.5 13.5C14.5 11 12 8 12 8Z" fill="#FDE047"/></svg>`,
    clash: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#451A03"/><path d="M5 16C5 12 8 8 12 5C16 8 19 12 19 16L12 19L5 16Z" fill="#F59E0B"/><path d="M12 5V19" stroke="#78350F" stroke-width="2"/><circle cx="8" cy="13" r="1.5" fill="#78350F"/><circle cx="16" cy="13" r="1.5" fill="#78350F"/></svg>`,
    fifa: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#064E3B"/><circle cx="12" cy="12" r="8" stroke="#10B981" stroke-width="2"/><path d="M12 4L14 8L18 8.5L15 11.5L16 16L12 13.5L8 16L9 11.5L6 8.5L10 8L12 4Z" fill="#34D399"/></svg>`,
    brawl: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1E293B"/><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#FBBF24"/><circle cx="10" cy="11" r="1.2" fill="#78350F"/><circle cx="14" cy="11" r="1.2" fill="#78350F"/></svg>`,
    genshin: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#312E81"/><path d="M12 3C12 7.5 15.5 11 20 12C15.5 13 12 16.5 12 21C12 16.5 8.5 13 4 12C8.5 11 12 7.5 12 3Z" fill="#818CF8"/><circle cx="12" cy="12" r="2.5" fill="#C7D2FE"/></svg>`,
    mlbb: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#172554"/><path d="M6 5L12 2L18 5V12C18 16.5 15 19.5 12 21C9 19.5 6 16.5 6 12V5Z" fill="#3B82F6"/><path d="M8 8L16 16M16 8L8 16" stroke="#DBEAFE" stroke-width="2"/></svg>`,
    codm: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1C1917"/><circle cx="12" cy="12" r="7" stroke="#A8A29E" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="22" stroke="#EF4444" stroke-width="1.5"/><line x1="2" y1="12" x2="22" y2="12" stroke="#EF4444" stroke-width="1.5"/></svg>`,
    valorant: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#0F172A"/><path d="M5 6L11 18H14L8 6H5Z" fill="#FA4454"/><path d="M16 6L19 12H16L13.5 6H16Z" fill="#FA4454"/></svg>`,
    fortnite: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#3B0764"/><path d="M8 5H17V8H11V11H15V14H11V20H8V5Z" fill="#C084FC"/></svg>`,
    wildrift: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#0369A1"/><path d="M7 6H10V15H17V18H7V6Z" fill="#BAE6FD"/><circle cx="17" cy="7" r="2.5" fill="#38BDF8"/></svg>`,
    arena: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#292524"/><path d="M6 7H18V14C18 17.5 15 20 12 21C9 20 6 17.5 6 14V7Z" fill="#D97706"/><line x1="6" y1="11" x2="18" y2="11" stroke="#78350F" stroke-width="2"/></svg>`,
    honor: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1E293B"/><path d="M5 16L7 8L12 12L17 8L19 16H5Z" fill="#FBBF24"/><circle cx="12" cy="7" r="1.5" fill="#FBBF24"/></svg>`,
    diablo: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#450A0A"/><path d="M6 5C6 10 9 14 12 17C15 14 18 10 18 5C16 8 14 10 12 10C10 10 8 8 6 5Z" fill="#EF4444"/><circle cx="12" cy="18" r="1.5" fill="#FCA5A5"/></svg>`,
    topeleven: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#14532D"/><circle cx="12" cy="12" r="7" stroke="#22C55E" stroke-width="2"/><text x="12" y="16" font-size="10" font-weight="900" text-anchor="middle" fill="#FFFFFF">11</text></svg>`,
    bigo: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#0C4A6E"/><path d="M8 8C8 5.79 9.79 4 12 4C14.21 4 16 5.79 16 8V12C16 14.21 14.21 16 12 16C9.79 16 8 14.21 8 12V8Z" fill="#38BDF8"/><circle cx="10" cy="8" r="1" fill="#0C4A6E"/><circle cx="14" cy="8" r="1" fill="#0C4A6E"/><path d="M10 17H14V20H10V17Z" fill="#38BDF8"/></svg>`,
    chamet: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#4A044E"/><circle cx="12" cy="12" r="7" fill="#F472B6"/><circle cx="12" cy="12" r="4" fill="#831843"/></svg>`,
    poppo: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#581C87"/><circle cx="12" cy="10" r="4.5" fill="#E879F9"/><path d="M9 15C9 14 11 13 12 13C13 13 15 14 15 15V19H9V15Z" fill="#C084FC"/></svg>`,
    yalla: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#1E1B4B"/><rect x="5" y="5" width="14" height="14" rx="3" fill="#DC2626"/><circle cx="8.5" cy="8.5" r="1.5" fill="#FFFFFF"/><circle cx="15.5" cy="8.5" r="1.5" fill="#FFFFFF"/><circle cx="12" cy="12" r="1.5" fill="#FFFFFF"/><circle cx="8.5" cy="15.5" r="1.5" fill="#FFFFFF"/><circle cx="15.5" cy="15.5" r="1.5" fill="#FFFFFF"/></svg>`,
    sugo: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#3B0764"/><path d="M12 5C8.13 5 5 8.13 5 12C5 15.87 8.13 19 12 19C15.87 19 19 15.87 19 12" stroke="#A855F7" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="2.5" fill="#F472B6"/></svg>`,
    meyo: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#172554"/><path d="M5 8C5 6.34 6.34 5 8 5H16C17.66 5 19 6.34 19 8V14C19 15.66 17.66 17 16 17H9L5 20V8Z" fill="#0284C7"/><circle cx="9" cy="11" r="1" fill="#FFFFFF"/><circle cx="12" cy="11" r="1" fill="#FFFFFF"/><circle cx="15" cy="11" r="1" fill="#FFFFFF"/></svg>`,
    tiktok: `<svg class="w-6 h-6 fill-current text-white" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.76 1.44-.03 2.74-.93 3.22-2.29.21-.59.27-1.23.26-1.86.03-5.26.01-10.53.02-15.79z"/></svg>`,
    facebook: `<svg class="w-6 h-6 fill-current text-blue-500" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    instagram: `<svg class="w-6 h-6 fill-current text-pink-500" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    telegram: `<svg class="w-6 h-6 fill-current text-sky-400" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.949z"/></svg>`,
    youtube: `<svg class="w-6 h-6 fill-current text-red-500" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    twitter: `<svg class="w-6 h-6 fill-current text-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    whatsapp: `<svg class="w-6 h-6 fill-current text-emerald-400" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>`,
    spotify: `<svg class="w-6 h-6 fill-current text-green-500" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
    traffic: `<svg class="w-6 h-6 fill-current text-sky-300" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
    linkedin: `<svg class="w-6 h-6 fill-current text-blue-600" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`,
    snapchat: `<svg class="w-6 h-6 fill-current text-amber-300" viewBox="0 0 24 24"><path d="M12.03 2c-3.5 0-6.03 2.5-6.03 5.4 0 .9.3 2.1.8 3-.5.2-1.3.6-1.5 1.5-.2.8.4 1.4 1.1 1.6-.1.6-.2 1.2-.2 1.7 0 1.9 1.6 3.4 3.7 3.7-.4.5-1.3 1.1-2.9 1.3-.5.1-.7.4-.7.7 0 .5.4.8 1.4 1 2 .4 3.9-.2 4.3-.4.4.2 2.3.8 4.3.4 1-.2 1.4-.5 1.4-1 0-.3-.2-.6-.7-.7-1.6-.2-2.5-.8-2.9-1.3 2.1-.3 3.7-1.8 3.7-3.7 0-.5-.1-1.1-.2-1.7.7-.2 1.3-.8 1.1-1.6-.2-.9-1-1.3-1.5-1.5.5-.9.8-2.1.8-3 0-2.9-2.53-5.4-6.03-5.4z"/></svg>`,
    google: `<svg class="w-6 h-6 fill-current text-emerald-400" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
};

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

const egyptianNames = ["أحمد م.", "محمد س.", "كريم ع.", "يوسف ط.", "عمر ح.", "سارة م.", "محمود خ.", "زياد ف.", "مصطفى ن.", "نور د.", "طارق ش.", "إسلام ع.", "علي ر.", "مروان ك.", "حازم ب."];
const egyptianCities = ["القاهرة - المعادي", "الجيزة - الدقي", "مدينة نصر", "الإسكندرية - سموحة", "المنصورة", "الشيخ زايد", "طنطا", "الزقازيق", "بورسعيد", "أسيوط", "المهندسين", "دمياط", "كفر الشيخ"];
const purchaseTemplates = [
    { act: "شحن 3850 UC ببجي موبايل", icon: 'pubg' },
    { act: "شحن 800 Robux روبلوكس", icon: 'roblox' },
    { act: "تفعيل اشتراك Claude Max 5x", icon: 'app_generic' },
    { act: "شحن 1188 جوهرة فري فاير", icon: 'freefire' },
    { act: "شحن تذكرة Gold Pass كلاش أوف كلانس", icon: 'clash' },
    { act: "طلب 2,500 متابع تيك توك موثق", icon: 'tiktok' },
    { act: "شحن 70,000 Coins Poppo Live", icon: 'poppo' },
    { act: "شحن 1000 V-Bucks فورتنايت", icon: 'fortnite' },
    { act: "شحن 1000 VP فالورانت", icon: 'valorant' },
    { act: "تفعيل Canva Pro رسمي لسنة", icon: 'app_generic' },
    { act: "شحن 500 Diamonds يلا لودو", icon: 'yalla' }
];

let lastProofIndex = -1;
function triggerSocialProof() {
    const popup = document.getElementById('socialProofPopup');
    if (!popup) return;
    let randIdx;
    do { randIdx = Math.floor(Math.random() * purchaseTemplates.length); } while (randIdx === lastProofIndex);
    lastProofIndex = randIdx;
    const tpl = purchaseTemplates[randIdx];
    const name = egyptianNames[Math.floor(Math.random() * egyptianNames.length)];
    const city = egyptianCities[Math.floor(Math.random() * egyptianCities.length)];
    const secondsAgo = Math.floor(Math.random() * 55) + 5;
    const timeStr = secondsAgo < 20 ? "الآن مباشرة ⚡" : `منذ ${secondsAgo} ثانية`;

    document.getElementById('proofUser').innerText = `${name} (${city})`;
    document.getElementById('proofAction').innerText = tpl.act;
    document.getElementById('proofTime').innerText = timeStr;
    const iconContainer = document.getElementById('proofIcon');
    if (tpl.icon === 'app_generic') {
        iconContainer.innerHTML = `<span class="text-lg">⚡</span>`;
    } else {
        iconContainer.innerHTML = SVG_LOGOS[tpl.icon] || `<span class="text-lg">🎮</span>`;
    }
    popup.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => { popup.classList.add('translate-y-24', 'opacity-0'); }, 5000);
    setTimeout(triggerSocialProof, Math.floor(Math.random() * 12000) + 10000);
}

let currentSlide = 0;
const totalSlides = 3;
function updateSlider() {
    const track = document.getElementById('sliderTrack');
    if (track) track.style.transform = `translateX(${currentSlide * 100}%)`;
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
        if (idx === currentSlide) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}
function goToSlide(index) { currentSlide = index; updateSlider(); }
setInterval(() => { currentSlide = (currentSlide + 1) % totalSlides; updateSlider(); }, 4500);

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-xl shadow-2xl text-xs font-bold text-white transition-all transform duration-300 -translate-x-full flex items-center gap-2 ${type === 'success' ? 'bg-emerald-600 border border-emerald-400' : 'bg-red-600 border border-red-400'}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('-translate-x-full'), 10);
    setTimeout(() => { toast.classList.add('-translate-x-full'); setTimeout(() => toast.remove(), 300); }, 3200);
}

function initVisitorCounter() {
    let count = localStorage.getItem('migo_visitors_v3');
    if (!count) count = 1240 + Math.floor(Math.random() * 20);
    else count = parseInt(count) + 1;
    localStorage.setItem('migo_visitors_v3', count);
    const counterEl = document.getElementById('visitorCount');
    if (counterEl) counterEl.innerText = Number(count).toLocaleString();
}

let cart = [];
let appliedCoupon = null;
const validCoupons = {
    'SIAFFC15': { discount: 0.15 },
    'MIGO15': { discount: 0.15 },
    'SAHER15': { discount: 0.15 },
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
function addSubscriptionToSiteCart(item, variant) {
    const cartItem = {
        id: item.id + '_' + variant.label,
        name: `${item.name} (${variant.label})`,
        type: 'sub',
        price: variant.price,
        details: item.desc
    };
    addToCart(cartItem);
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
        container.innerHTML = '<div class="text-center text-gray-400 py-8 text-xs">سلة المشتريات فارغة حالياً</div>';
    } else {
        container.innerHTML = cart.map(item => `
            <div class="bg-slate-950 border border-slate-700 rounded-xl p-3 flex justify-between items-center gap-3">
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs sm:text-sm font-bold text-white truncate">${item.name}</h4>
                    <div class="text-[10px] text-sky-400 truncate mt-0.5">${item.details}</div>
                </div>
                <div class="text-left shrink-0">
                    <div class="text-xs sm:text-sm font-black text-amber-400 font-mono">${Number(item.price).toLocaleString()} ج.م</div>
                    <button onclick="removeFromCart(${item.cartId})" class="text-[10px] text-red-400 hover:text-red-300 mt-1 cursor-pointer">حذف 🗑️</button>
                </div>
            </div>
        `).join('');
    }
    calculateCartTotal();
}
function applyCartCoupon() {
    const code = document.getElementById('cartCouponInput').value.trim().toUpperCase();
    if (!code) return showToast('الرجاء إدخال كود الخصم', 'error');
    const coupon = validCoupons[code];
    if (!coupon) return showToast('كود الخصم غير صحيح', 'error');
    appliedCoupon = { code: code, discount: coupon.discount };
    const statusEl = document.getElementById('cartCouponStatus');
    statusEl.classList.remove('hidden');
    statusEl.className = 'text-[10px] font-bold mt-1 text-emerald-400';
    statusEl.innerText = `✅ تم تفعيل خصم ${(coupon.discount * 100)}% على إجمالي طلبك`;
    showToast('تم تطبيق كود الخصم بنجاح');
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

let currentModalItem = null;
let isExpressModal = false;

const GAMES_REGISTRY = [
    { key: 'pubg', label: 'بابجي موبايل (PUBG Mobile)', hasZone: false },
    { key: 'freefire', label: 'فري فاير (Free Fire)', hasZone: false },
    { key: 'mlbb', label: 'موبايل ليجندز (Mobile Legends)', hasZone: true },
    { key: 'roblox', label: 'روبلوكس (Roblox)', hasZone: false },
    { key: 'clash', label: 'كلاش أوف كلانس (Clash of Clans)', hasZone: false },
    { key: 'fifa', label: 'فيفا موبايل (FC Mobile)', hasZone: false },
    { key: 'brawl', label: 'براول ستارز (Brawl Stars)', hasZone: false },
    { key: 'genshin', label: 'جينشين إمباكت (Genshin Impact)', hasZone: true },
    { key: 'codm', label: 'كول أوف ديوتي (CODM)', hasZone: false },
    { key: 'valorant', label: 'فالورانت (VALORANT)', hasZone: false },
    { key: 'fortnite', label: 'فورتنايت (Fortnite)', hasZone: false },
    { key: 'other', label: 'لعبة / تطبيق آخر بالمعرّف', hasZone: false }
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
    document.getElementById('modalTargetIcon').innerHTML = SVG_LOGOS[iconKey] || `<span class="text-2xl">🎮</span>`;
    document.getElementById('modalInputPlayerId').value = '';
    document.getElementById('modalInputPlayerName').value = '';
    document.getElementById('modalInputZoneId').value = '';
    const select = document.getElementById('modalSelectGame');
    const found = GAMES_REGISTRY.find(g => g.key === iconKey);
    select.value = found ? found.key : 'other';
    onModalGameSelectChange();

    const statusBox = document.getElementById('verifyStatusBox');
    statusBox.classList.add('hidden');
    statusBox.innerText = '';

    const btn = document.getElementById('modalSubmitBtn');
    if (isExpress) {
        btn.className = "w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg transition";
        btn.innerHTML = `متابعة الدفع الفوري ⚡ (${price.toLocaleString()} ج.م)`;
    } else {
        btn.className = "w-full sky-btn font-extrabold py-3.5 rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg";
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
    if (targetGame && targetGame.hasZone) zoneGroup.classList.remove('hidden');
    else zoneGroup.classList.add('hidden');
}

async function verifyPlayerAccount() {
    const game = document.getElementById('modalSelectGame').value;
    const uid = document.getElementById('modalInputPlayerId').value.trim();
    const zoneId = document.getElementById('modalInputZoneId').value.trim();
    const statusBox = document.getElementById('verifyStatusBox');
    const nameInput = document.getElementById('modalInputPlayerName');
    const verifyBtn = document.getElementById('verifyAccountBtn');

    if (!uid) return showToast('يرجى كتابة رقم الـ ID أولاً لإجراء الفحص!', 'error');
    const targetGame = GAMES_REGISTRY.find(g => g.key === game);
    if (targetGame && targetGame.hasZone && !zoneId) return showToast('هذه اللعبة تتطلب إدخال رقم السيرفر (Zone ID)', 'error');

    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<span>جاري...</span>`;
    statusBox.classList.remove('hidden', 'bg-emerald-500/15', 'border-emerald-500/40', 'text-emerald-300', 'bg-red-500/15', 'border-red-500/40', 'text-red-300', 'bg-amber-500/15', 'border-amber-500/40', 'text-amber-300');
    statusBox.classList.add('bg-sky-500/15', 'border-sky-500/40', 'text-sky-300');
    statusBox.innerText = "⏳ جاري الاستعلام السريع من سيرفرات اللعبة...";

    let query = `/?game=${encodeURIComponent(game)}&id=${encodeURIComponent(uid)}`;
    if (zoneId) query += `&zoneId=${encodeURIComponent(zoneId)}`;

    try {
        const response = await fetch(`${DENO_API_URL}${query}`);
        const data = await response.json();
        const retrievedName = data.username || data.name || (data.data && (data.data.username || data.data.name));
        if (data.success && retrievedName) {
            nameInput.value = retrievedName;
            statusBox.className = "p-3 rounded-xl text-xs font-bold text-center border bg-emerald-500/20 border-emerald-500/50 text-emerald-300";
            statusBox.innerHTML = `✅ تم التحقق! الحساب: <span class="text-white font-mono underline">${retrievedName}</span>`;
            showToast(`تم التعرف على اللاعب: ${retrievedName}`);
        } else {
            statusBox.className = "p-3 rounded-xl text-xs font-bold text-center border bg-red-500/20 border-red-500/50 text-red-300";
            statusBox.innerText = `❌ ${data.message || 'لم يتم العثور على اللاعب، تأكد من كتابة الـ ID بشكل صحيح.'}`;
        }
    } catch (err) {
        statusBox.className = "p-3 rounded-xl text-xs font-bold text-center border bg-amber-500/20 border-amber-500/50 text-amber-300";
        statusBox.innerText = "⚠️ تعذر الاتصال بالسيرفر حالياً. يمكنك كتابة الاسم يدوياً ومتابعة الطلب وسنتحقق منه فوراً.";
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<span>فحص الحساب</span> 🔍`;
    }
}

function submitPlayerIdModal() {
    const playerId = document.getElementById('modalInputPlayerId').value.trim();
    const playerName = document.getElementById('modalInputPlayerName').value.trim();
    const zoneId = document.getElementById('modalInputZoneId').value.trim();
    if (!playerId) return showToast('يرجى إدخال معرف اللاعب (Player ID) أولاً!', 'error');

    let detailStr = `ID: ${playerId}`;
    if (zoneId) detailStr += ` (Zone: ${zoneId})`;
    if (playerName) detailStr += ` | اللاعب: ${playerName}`;

    const item = { id: 'game_' + Date.now(), name: currentModalItem.name, type: 'game', price: currentModalItem.price, details: detailStr };
    closePlayerIdModal();
    if (isExpressModal) expressCheckout(item);
    else addToCart(item);
}

function expressCheckout(item) {
    cart.push({ ...item, cartId: Date.now() + Math.random() });
    saveCartToStorage();
    proceedToCheckout();
}
function expressCheckoutSMM() {
    const link = document.getElementById('smmLinkInput').value.trim();
    const qty = document.getElementById('smmQtyInput').value;
    const srv = getCurrentSMMService();
    if (!link) return showToast('يرجى إدخال الرابط أولاً!', 'error');
    if (qty < srv.min || qty > srv.max) return showToast(`الكمية يجب أن تكون بين ${srv.min} و ${srv.max}`, 'error');
    const cost = calculateSMMCost();
    const item = { id: 'smm_' + srv.id, name: `${currentSMMPlatform.name} - ${srv.title}`, type: 'smm', price: cost, details: `الكمية: ${qty} | الرابط: ${link}` };
    document.getElementById('smmLinkInput').value = '';
    expressCheckout(item);
}

let selectedPayment = null;
function proceedToCheckout() {
    if (cart.length === 0) return showToast('السلة فارغة، أضف خدمات أو ألعاب أولاً!', 'error');
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
        navigator.clipboard.writeText(txt).then(() => showToast('تم نسخ الرقم بنجاح'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('تم نسخ الرقم بنجاح');
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
    const copyBtn = (txt) => `<button type="button" onclick="copyTextToClipboard('${txt}')" class="mt-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-white font-mono text-xs hover:bg-slate-700 cursor-pointer">📋 نسخ الرقم: ${txt}</button>`;
    
    if (method === 'vodafone') content.innerHTML = `يرجى تحويل المبلغ المطلوب إلى محفظة فودافون كاش التالية:<br>${copyBtn('01020323432')}`;
    else if (method === 'instapay') content.innerHTML = `يرجى تحويل المبلغ عبر إنستاباي إلى رقم الحساب التالي:<br>${copyBtn('01146691073')}`;
    else if (method === 'etisalat') content.innerHTML = `يرجى تحويل المبلغ المطلوب إلى محفظة اتصالات كاش التالية:<br>${copyBtn('01146691073')}`;
    else content.innerHTML = `الدفع عبر <b>${name}</b> متاح ومفعل.<br>اضغط على زر (تم الدفع) وسيقوم فريق الدعم بإرسال رابط الفاتورة المخصص لك فوراً عبر واتساب.`;

    document.getElementById('confirmPaymentBtn').classList.remove('hidden');
    document.getElementById('confirmPaymentBtn').classList.add('flex');
}
function finalizeOrderWhatsApp() {
    if (!selectedPayment) return showToast('يرجى اختيار وسيلة الدفع أولاً من القائمة أعلاه', 'error');
    const orderId = Math.floor(1000 + Math.random() * 9000);
    let msg = `السلام عليكم، أود تأكيد طلبي الجديد من منصة Migo AI\n`;
    msg += `*رقم الفاتورة:* #${orderId}\n`;
    msg += `*طريقة الدفع المختارة:* ${selectedPayment}\n\n`;
    msg += `*--- تفاصيل الطلب والمشتريات ---*\n`;
    cart.forEach((item, index) => {
        msg += `${index + 1}. *${item.name}*\n   - السعر: ${Number(item.price).toLocaleString()} ج.م\n   - البيانات: [${item.details}]\n`;
    });
    msg += `\n*الإجمالي المطلوب:* ${document.getElementById('cartTotal').innerText}`;
    if (appliedCoupon) msg += `\n*(كود الخصم المطبق: ${appliedCoupon.code})*`;

    cart = [];
    appliedCoupon = null;
    saveCartToStorage();
    closeCheckoutModal();
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
}

const allGames = [
    { key: 'pubg', name: "بابجي موبايل (PUBG)", tag: "Midasbuy الرسمي", pkgs: [{l: "60 UC", p: 62}, {l: "325 UC", p: 310}, {l: "660 UC", p: 620}, {l: "1800 UC", p: 1550}, {l: "3850 UC", p: 3100}, {l: "8100 UC", p: 6200}] },
    { key: 'roblox', name: "روبلوكس (Roblox)", tag: "Codashop / Razer", pkgs: [{l: "80 Robux", p: 62}, {l: "400 Robux", p: 310}, {l: "800 Robux", p: 620}, {l: "1700 Robux", p: 1240}] },
    { key: 'freefire', name: "فري فاير (Free Fire)", tag: "تسليم فوري بالـ ID", pkgs: [{l: "110 Diamonds", p: 55}, {l: "231 Diamonds", p: 110}, {l: "583 Diamonds", p: 265}, {l: "1188 Diamonds", p: 530}, {l: "2420 Diamonds", p: 1050}] },
    { key: 'clash', name: "كلاش أوف كلانس (Clash of Clans)", tag: "Supercell الرسمي", pkgs: [{l: "80 جواهر", p: 60}, {l: "500 جواهر", p: 285}, {l: "1200 جواهر", p: 570}, {l: "تذكرة ذهبية Gold Pass", p: 430}] },
    { key: 'fifa', name: "فيفا موبايل (FC Mobile)", tag: "EA Sports", pkgs: [{l: "40 FC Points", p: 35}, {l: "100 FC Points", p: 88}, {l: "حزمة صغيرة (إضافية)", p: 115}, {l: "حزمة متوسطة (إضافية)", p: 230}, {l: "حزمة كبيرة (إضافية)", p: 345}] },
    { key: 'brawl', name: "براول ستارز (Brawl Stars)", tag: "Supercell ID", pkgs: [{l: "30 جواهر", p: 115}, {l: "80 جواهر", p: 285}, {l: "170 جواهر", p: 570}, {l: "Brawl Pass الفوري", p: 530}] },
    { key: 'genshin', name: "جينشين إمباكت (Genshin Impact)", tag: "Codashop المعتمد", pkgs: [{l: "60 كريستال", p: 62}, {l: "300+30 كريستال", p: 310}, {l: "بركة القمر (Welkin Moon)", p: 305}, {l: "980+110 كريستال", p: 950}] },
    { key: 'mlbb', name: "موبايل ليجندز (MLBB)", tag: "تسليم فوري", pkgs: [{l: "86 Diamonds", p: 55}, {l: "172 Diamonds", p: 110}, {l: "257 Diamonds", p: 160}, {l: "706 Diamonds", p: 425}] },
    { key: 'codm', name: "كول أوف ديوتي (CODM)", tag: "Activision", pkgs: [{l: "80 CP", p: 62}, {l: "420 CP", p: 265}, {l: "880 CP", p: 530}, {l: "2400 CP", p: 1250}] },
    { key: 'valorant', name: "فالورانت (VALORANT)", tag: "Riot Games", pkgs: [{l: "475 VP", p: 160}, {l: "1000 VP", p: 315}, {l: "2050 VP", p: 630}, {l: "3650 VP", p: 1050}] },
    { key: 'fortnite', name: "فورتنايت (Fortnite)", tag: "Epic Games", pkgs: [{l: "1000 V-Bucks", p: 315}, {l: "2800 V-Bucks", p: 790}, {l: "5000 V-Bucks", p: 1250}] },
    { key: 'wildrift', name: "وايلد ريفت (LoL Wild Rift)", tag: "Riot ID", pkgs: [{l: "425 Wild Cores", p: 170}, {l: "1000 Wild Cores", p: 365}, {l: "2050 Wild Cores", p: 720}] },
    { key: 'arena', name: "أرينا بريك آوت (Arena)", tag: "Level Infinite", pkgs: [{l: "باقة أساسية", p: 105}, {l: "باقة تكتيكية", p: 265}, {l: "باقة النخبة", p: 530}] },
    { key: 'honor', name: "هونر أوف كينجز (Honor of Kings)", tag: "Tencent Games", pkgs: [{l: "باقة المبتدئين", p: 105}, {l: "باقة المحترفين", p: 265}] },
    { key: 'diablo', name: "ديابلو إيمورتال (Diablo)", tag: "Blizzard", pkgs: [{l: "حزمة صغيرة", p: 105}, {l: "حزمة كبيرة", p: 315}] },
    { key: 'topeleven', name: "توب إلفن (Top Eleven)", tag: "Nordeus", pkgs: [{l: "رموز أساسية", p: 105}, {l: "رموز مميزة", p: 265}] }
];

function renderGames() {
    const container = document.getElementById('gamesCardsContainer');
    if (!container) return;
    container.innerHTML = allGames.map(g => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between">
            <div class="bg-slate-950 border-b border-slate-700 p-3.5 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center p-1">${SVG_LOGOS[g.key] || ''}</div>
                    <h3 class="font-extrabold text-sm text-white">${g.name}</h3>
                </div>
                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">${g.tag}</span>
            </div>
            <div class="p-3.5 space-y-2">
                ${g.pkgs.map(pkg => `
                    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-slate-600 transition">
                        <span class="text-xs font-bold text-gray-200">${pkg.l}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.p} ج.م</span>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.l}', ${pkg.p}, true, '${g.key}')" title="شحن فوري مباشر" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1.5 rounded-lg cursor-pointer">⚡</button>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.l}', ${pkg.p}, false, '${g.key}')" title="إضافة للسلة" class="sky-btn font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer">🛒</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

const smmPlatforms = [
    { 
        id: 'tiktok', name: 'تيك توك', svg: SVG_LOGOS.tiktok, extra: false, 
        categories: [
            { name: 'تيك توك - متابعين', services: [{ id: 2410, title: 'متابعين حقيقيين | ضمان عدم النقص 30 يوم', baseUSD: 2.90, min: 1000, max: 100000 }, { id: 2415, title: 'متابعين فوري فائق السرعة', baseUSD: 3.50, min: 1000, max: 50000 }] },
            { name: 'تيك توك - لايكات', services: [{ id: 2218, title: 'لايكات سريعة | ضمان وثبات', baseUSD: 1.39, min: 1000, max: 1000000 }, { id: 2221, title: 'لايكات رخيصة فورية', baseUSD: 0.85, min: 1000, max: 500000 }] },
            { name: 'تيك توك - مشاهدات وبث', services: [{ id: 2301, title: 'مشاهدات فيديو فورية (اكسبلور)', baseUSD: 0.15, min: 1000, max: 10000000 }, { id: 2305, title: 'مشاهدات بث مباشر (Live Stream)', baseUSD: 2.40, min: 1000, max: 50000 }] }
        ] 
    },
    { 
        id: 'facebook', name: 'فيسبوك', svg: SVG_LOGOS.facebook, extra: false, 
        categories: [
            { name: 'فيسبوك - متابعين', services: [{ id: 1950, title: 'متابعين صفحات وحسابات شخصية | ضمان', baseUSD: 1.85, min: 1000, max: 500000 }, { id: 1955, title: 'أعضاء جروبات فيسبوك', baseUSD: 2.10, min: 1000, max: 100000 }] },
            { name: 'فيسبوك - تفاعل ولايكات', services: [{ id: 1960, title: 'لايكات وتفاعلات بوستات (Love/Care)', baseUSD: 0.95, min: 1000, max: 50000 }, { id: 1913, title: 'مشاهدات بث مباشر (30 دقيقة)', baseUSD: 2.50, min: 1000, max: 20000 }] }
        ] 
    },
    { 
        id: 'instagram', name: 'انستقرام', svg: SVG_LOGOS.instagram, extra: false, 
        categories: [
            { name: 'انستقرام - متابعين', services: [{ id: 2510, title: 'متابعين ضمان سنة كاملة 365 يوم', baseUSD: 1.65, min: 1000, max: 500000 }, { id: 2515, title: 'متابعين جودة عالية وبدون نقص', baseUSD: 2.40, min: 1000, max: 200000 }] },
            { name: 'انستقرام - ريلز وتفاعل', services: [{ id: 2520, title: 'لايكات فورية حقيقية', baseUSD: 0.45, min: 1000, max: 100000 }, { id: 2525, title: 'مشاهدات ريلز وانطباعات اكسبلور', baseUSD: 0.20, min: 1000, max: 1000000 }] }
        ] 
    },
    { 
        id: 'youtube', name: 'يوتيوب', svg: SVG_LOGOS.youtube, extra: false, 
        categories: [
            { name: 'يوتيوب - تفاعل', services: [{ id: 3205, title: 'مشتركين قنوات حقيقيين | ضمان ممتد', baseUSD: 8.50, min: 1000, max: 50000 }, { id: 3201, title: 'مشاهدات فيديو حقيقية عالية الاحتفاظ', baseUSD: 1.90, min: 1000, max: 1000000 }, { id: 3210, title: 'لايكات يوتيوب فورية', baseUSD: 1.20, min: 1000, max: 100000 }] }
        ] 
    },
    { 
        id: 'telegram', name: 'تليجرام', svg: SVG_LOGOS.telegram, extra: false, 
        categories: [
            { name: 'تليجرام - قنوات', services: [{ id: 3101, title: 'أعضاء قنوات وجروبات | ضمان عدم الخروج', baseUSD: 1.75, min: 1000, max: 200000 }, { id: 3105, title: 'مشاهدات منشورات فورية وسريعة', baseUSD: 0.12, min: 1000, max: 1000000 }] }
        ] 
    },
    { 
        id: 'twitter', name: 'إكس (تويتر)', svg: SVG_LOGOS.twitter, extra: false, 
        categories: [
            { name: 'إكس - تفاعل', services: [{ id: 3301, title: 'لايكات وريتويت (إعادة نشر)', baseUSD: 1.40, min: 1000, max: 100000 }, { id: 3305, title: 'متابعين إكس حقيقيين', baseUSD: 6.90, min: 1000, max: 50000 }] }
        ] 
    },
    { id: 'whatsapp', name: 'واتساب', svg: SVG_LOGOS.whatsapp, extra: true, categories: [{ name: 'قنوات واتساب', services: [{ id: 1608, title: 'أعضاء قناة واتساب', baseUSD: 9.97, min: 1000, max: 50000 }] }] },
    { id: 'spotify', name: 'سبوتيفاي', svg: SVG_LOGOS.spotify, extra: true, categories: [{ name: 'استماعات', services: [{ id: 5001, title: 'استماعات أغاني سبوتيفاي', baseUSD: 1.20, min: 1000, max: 1000000 }] }] },
    { id: 'traffic', name: 'زيارات مواقع', svg: SVG_LOGOS.traffic, extra: true, categories: [{ name: 'زيارات', services: [{ id: 5101, title: 'زيارات مواقع حقيقية عالمية', baseUSD: 0.60, min: 1000, max: 1000000 }] }] },
    { id: 'linkedin', name: 'لينكد إن', svg: SVG_LOGOS.linkedin, extra: true, categories: [{ name: 'متابعين', services: [{ id: 5301, title: 'متابعين صفحات وحسابات', baseUSD: 6.50, min: 1000, max: 10000 }] }] },
    { id: 'snapchat', name: 'سناب شات', svg: SVG_LOGOS.snapchat, extra: true, categories: [{ name: 'مشاهدات', services: [{ id: 5501, title: 'مشاهدات ستوري سناب', baseUSD: 3.20, min: 1000, max: 50000 }] }] },
    { id: 'google', name: 'خرائط جوجل', svg: SVG_LOGOS.google, extra: true, categories: [{ name: 'تقييمات', services: [{ id: 5601, title: 'تقييمات 5 نجوم مع تعليق', baseUSD: 45.00, min: 1000, max: 10000 }] }] }
];

let currentSMMPlatform = smmPlatforms[0];
let showExtraSMMPlatforms = false;

function renderSMMPlatforms() {
    const grid = document.getElementById('smmPlatformsGrid');
    if (!grid) return;
    grid.innerHTML = smmPlatforms.filter(p => !p.extra || showExtraSMMPlatforms).map(p => `
        <button type="button" onclick="selectSMMPlatform('${p.id}')" class="p-2.5 rounded-2xl ${p.id === currentSMMPlatform.id ? 'sky-active-tab' : 'sky-card border'} text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer">
            <div class="w-8 h-8 flex items-center justify-center">${p.svg}</div>
            <span class="text-[11px] font-extrabold text-white truncate max-w-full">${p.name}</span>
        </button>
    `).join('');
}
function toggleMoreSMMPlatforms() {
    showExtraSMMPlatforms = !showExtraSMMPlatforms;
    document.getElementById('toggleMorePlatformsBtn').innerText = showExtraSMMPlatforms ? 'إخفاء المنصات ⌃' : 'عرض المزيد من المنصات (+12) ⌄';
    renderSMMPlatforms();
}
function selectSMMPlatform(pid) {
    currentSMMPlatform = smmPlatforms.find(p => p.id === pid);
    renderSMMPlatforms();
    document.getElementById('selectedPlatformIconContainer').innerHTML = currentSMMPlatform.svg;
    document.getElementById('selectedPlatformTitle').innerText = currentSMMPlatform.name;
    document.getElementById('smmCategorySelect').innerHTML = currentSMMPlatform.categories.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
    onSMMCategoryChange();
}
function onSMMCategoryChange() {
    const catIdx = document.getElementById('smmCategorySelect').value || 0;
    const cat = currentSMMPlatform.categories[catIdx];
    document.getElementById('smmServiceSelect').innerHTML = cat.services.map((srv, i) => {
        const finalPer1k = (srv.baseUSD * 2.0 * USD_TO_EGP).toFixed(1);
        return `<option value="${i}">#${srv.id} - ${srv.title} (${finalPer1k} ج.م / 1k)</option>`;
    }).join('');
    onSMMServiceChange();
}
function getCurrentSMMService() {
    return currentSMMPlatform.categories[document.getElementById('smmCategorySelect').value || 0].services[document.getElementById('smmServiceSelect').value || 0];
}
function onSMMServiceChange() {
    const srv = getCurrentSMMService();
    const finalPer1k = (srv.baseUSD * 2.0 * USD_TO_EGP).toFixed(2);
    document.getElementById('selectedServiceBadgeId').innerText = 'ID: #' + srv.id;
    document.getElementById('smmLimitsNote').innerText = `الحدود: ${srv.min.toLocaleString()} - ${srv.max.toLocaleString()}`;
    document.getElementById('smmServiceMeta').innerHTML = `
        <span class="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg font-mono font-bold">السعر لكل 1,000: ${finalPer1k} ج.م</span>
        <span class="text-gray-400 text-[11px]">⚡ بدء التنفيذ تلقائي وفوري</span>
    `;
    calculateSMMCost();
}
function calculateSMMCost() {
    const srv = getCurrentSMMService();
    const qty = Math.max(1000, parseFloat(document.getElementById('smmQtyInput').value) || 1000);
    const totalEGP = (qty / 1000) * (srv.baseUSD * 2.0) * USD_TO_EGP;
    document.getElementById('smmPriceEGP').innerText = totalEGP.toFixed(2) + ' ج.م';
    return totalEGP;
}
function addSMMToCart() {
    const link = document.getElementById('smmLinkInput').value.trim();
    const qty = document.getElementById('smmQtyInput').value;
    const srv = getCurrentSMMService();
    if (!link) return showToast('يرجى إدخال الرابط أولاً!', 'error');
    if (qty < srv.min || qty > srv.max) return showToast(`الكمية يجب أن تكون بين ${srv.min} و ${srv.max}`, 'error');
    addToCart({ id: 'smm_' + srv.id, name: `${currentSMMPlatform.name} - ${srv.title}`, type: 'smm', price: calculateSMMCost(), details: `الكمية: ${qty} | الرابط: ${link}` });
    document.getElementById('smmLinkInput').value = '';
}

const allLiveApps = [
    { key: 'bigo', name: "BIGO Live", tag: "شحن بالـ ID", pkgs: [{l: "42 Diamonds", p: 52}, {l: "297 Diamonds", p: 370}, {l: "848 Diamonds", p: 1050}, {l: "3818 Diamonds", p: 4750}] },
    { key: 'chamet', name: "Chamet", tag: "تسليم فوري", pkgs: [{l: "4500 Diamonds", p: 52}, {l: "9000 Diamonds", p: 105}, {l: "22500 Diamonds", p: 265}, {l: "45000 Diamonds", p: 530}] },
    { key: 'poppo', name: "Poppo Live", tag: "شحن فوري بالمعرف", pkgs: [{l: "7000 Coins", p: 52}, {l: "14000 Coins", p: 105}, {l: "35000 Coins", p: 265}, {l: "70000 Coins", p: 530}, {l: "140000 Coins", p: 1050}] },
    { key: 'yalla', name: "Yalla Ludo", tag: "يلا لودو", pkgs: [{l: "50 Diamonds", p: 52}, {l: "250 Diamonds", p: 265}, {l: "500 Diamonds", p: 530}, {l: "1000 Diamonds", p: 1050}, {l: "2500 Diamonds", p: 2650}] },
    { key: 'sugo', name: "SUGO", tag: "سوجو", pkgs: [{l: "42 Coins", p: 52}, {l: "297 Coins", p: 370}, {l: "848 Coins", p: 1050}, {l: "3818 Coins", p: 4750}] },
    { key: 'meyo', name: "MeYo", tag: "ميو", pkgs: [{l: "42 Coins", p: 52}, {l: "297 Coins", p: 370}, {l: "848 Coins", p: 1050}, {l: "3818 Coins", p: 4750}] }
];

function renderLiveApps() {
    const container = document.getElementById('liveAppsCardsContainer');
    if (!container) return;
    container.innerHTML = allLiveApps.map(g => `
        <div class="sky-card border rounded-2xl overflow-hidden flex flex-col justify-between">
            <div class="bg-slate-950 border-b border-slate-700 p-3.5 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center p-1">${SVG_LOGOS[g.key] || ''}</div>
                    <h3 class="font-extrabold text-sm text-pink-400">${g.name}</h3>
                </div>
                <span class="text-[10px] font-bold text-pink-300 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/30">${g.tag}</span>
            </div>
            <div class="p-3.5 space-y-2">
                ${g.pkgs.map(pkg => `
                    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-slate-600 transition">
                        <span class="text-xs font-bold text-gray-200">${pkg.l}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-extrabold text-amber-400 font-mono">${pkg.p} ج.م</span>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.l}', ${pkg.p}, true, '${g.key}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-1.5 rounded-lg cursor-pointer">⚡</button>
                            <button onclick="openPlayerIdModal('${g.name}', '${pkg.l}', ${pkg.p}, false, '${g.key}')" class="sky-btn font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer">🛒</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

const allApps = [
    { id: 'app_max5', name: "Claude Max 5x", tag: "5 أضعاف Pro", price: 4340, icon: "⚡" },
    { id: 'app_max20', name: "Claude Max 20x", tag: "للمبرمجين 20x", price: 8680, icon: "🚀" },
    { id: 'app_claude', name: "Claude AI Pro", tag: "اشتراك رسمي", price: 1200, icon: "🧠" },
    { id: 'app_gemini', name: "Gemini Pro", tag: "تفعيل مباشر", price: 310, icon: "✨" },
    { id: 'app_canva', name: "Canva Pro", tag: "سنة كاملة", price: 186, icon: "🎨" },
    { id: 'app_capcut', name: "CapCut Pro", tag: "باقة التصميم", price: 235, icon: "🎬" },
    { id: 'app_midjourney', name: "Midjourney Pro", tag: "توليد الصور", price: 485, icon: "🖼️" }
];

function renderApps() {
    const container = document.getElementById('appCardsContainer');
    if (!container) return;
    container.innerHTML = allApps.map(app => `
        <div class="sky-card border p-4 rounded-2xl flex flex-col justify-between h-full">
            <div>
                <div class="flex justify-between items-start mb-2">
                    <span class="text-3xl">${app.icon}</span>
                    <span class="bg-slate-950 text-sky-400 border border-sky-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">${app.tag}</span>
                </div>
                <h3 class="font-bold text-base text-white mb-2">${app.name}</h3>
            </div>
            <div class="pt-3 border-t border-slate-700 flex items-center justify-between">
                <span class="text-base font-extrabold text-amber-400 block font-mono">${app.price.toLocaleString()} ج.م</span>
                <div class="flex gap-1.5">
                    <button onclick="expressCheckout({id: '${app.id}', name: '${app.name}', type: 'app', price: ${app.price}, details: '${app.tag}'})" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-xl cursor-pointer">⚡</button>
                    <button onclick="addToCart({id: '${app.id}', name: '${app.name}', type: 'app', price: ${app.price}, details: '${app.tag}'})" class="sky-btn font-bold text-xs px-2.5 py-1.5 rounded-xl cursor-pointer">🛒</button>
                </div>
            </div>
        </div>
    `).join('');
}

function handleLiveSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    query = query.trim().toLowerCase();
    if (!query) { dropdown.classList.add('hidden'); return; }

    let results = [];
    allGames.forEach(g => {
        if (g.name.toLowerCase().includes(query)) g.pkgs.forEach(pkg => results.push({ name: `${g.name} (${pkg.l})`, price: pkg.p, type: 'game', rawGame: g, pkg: pkg }));
    });
    allApps.forEach(a => {
        if (a.name.toLowerCase().includes(query) || a.tag.toLowerCase().includes(query)) results.push({ name: a.name, price: a.price, type: 'app', rawApp: a });
    });
    allLiveApps.forEach(la => {
        if (la.name.toLowerCase().includes(query)) la.pkgs.forEach(pkg => results.push({ name: `${la.name} - ${pkg.l}`, price: pkg.p, type: 'live', rawLive: la, pkg: pkg }));
    });

    if (results.length === 0) {
        dropdown.innerHTML = '<div class="text-center py-4 text-xs text-gray-400">لا توجد نتائج مطابقة لبحثك</div>';
    } else {
        dropdown.innerHTML = results.slice(0, 7).map(res => `
            <div class="p-2.5 hover:bg-slate-800 rounded-xl flex items-center justify-between text-xs transition border-b border-slate-700/50 last:border-0">
                <div class="text-right">
                    <span class="font-bold text-white block">${res.name}</span>
                    <span class="text-amber-400 font-mono font-bold">${res.price.toLocaleString()} ج.م</span>
                </div>
                <button onclick="onSearchItemClick('${encodeURIComponent(JSON.stringify(res))}')" class="sky-btn text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer">طلب الآن ⚡</button>
            </div>
        `).join('');
    }
    dropdown.classList.remove('hidden');
}

function onSearchItemClick(encodedItem) {
    const item = JSON.parse(decodeURIComponent(encodedItem));
    document.getElementById('searchResultsDropdown').classList.add('hidden');
    document.getElementById('liveSearchInput').value = '';
    if (item.type === 'game' || item.type === 'live') {
        const target = item.rawGame || item.rawLive;
        openPlayerIdModal(target.name, item.pkg.l, item.price, true, target.key);
    } else {
        expressCheckout({ id: item.rawApp.id, name: item.rawApp.name, type: 'app', price: item.price, details: item.rawApp.tag });
    }
}

const apiModels = [
    { name: "Claude Opus 5.5", inVal: 74.4, outVal: 372 }, 
    { name: "GPT-5.6 Sol", inVal: 74.4, outVal: 372 }, 
    { name: "Gemini 3.1 Pro", inVal: 37.2, outVal: 223.2 }, 
    { name: "DeepSeek R2 Pro", inVal: 18.6, outVal: 55.8 }
];
function initAPI() {
    document.getElementById('calcModelSelect').innerHTML = apiModels.map((m, i) => `<option value="${i}">${m.name} (إدخال: ${m.inVal} ج / إخراج: ${m.outVal} ج)</option>`).join('');
    calculateCost();
}
function calculateCost() {
    const idx = document.getElementById('calcModelSelect').value || 0;
    const inCount = Math.max(0, parseFloat(document.getElementById('calcInputCount').value) || 0);
    const outCount = Math.max(0, parseFloat(document.getElementById('calcOutputCount').value) || 0);
    document.getElementById('calcInputRes').innerText = (apiModels[idx].inVal * inCount).toLocaleString() + ' ج.م';
    document.getElementById('calcOutputRes').innerText = (apiModels[idx].outVal * outCount).toLocaleString() + ' ج.م';
    document.getElementById('calcTotalRes').innerText = ((apiModels[idx].inVal * inCount) + (apiModels[idx].outVal * outCount)).toLocaleString() + ' ج.م';
}

const verifiedReviews = [
    { name: "أحمد عبد الرحمن", service: "Claude Max 5x", text: "التفعيل تم على إيميلي الشخصي في أقل من نص ساعة، خدمة محترمة ومستقرة بدون VPN.", date: "أكتوبر 2026" },
    { name: "محمد طارق", service: "ببجي 3850 UC", text: "الشدات وصلت فوراً بعد التحويل بالـ ID بس وبدون باسورد. فحص الاسم وفر عليا قلق الأخطاء.", date: "أكتوبر 2026" },
    { name: "كريم وائل", service: "روبلوكس 800 Robux", text: "أرخص سعر شفته بالجنيه وسرعة تسليم ممتازة.", date: "أكتوبر 2026" },
    { name: "سارة محمود", service: "متابعين تيك توك", text: "العدد وصل كامل وبسرعة رهيبة وبضمان عدم النقص.", date: "أكتوبر 2026" },
    { name: "يوسف الشناوي", service: "كلاش أوف كلانس Gold Pass", text: "التفعيل فوري على حساب سوبر سيل بدون أي تعقيد.", date: "أكتوبر 2026" },
    { name: "مروان عادل", service: "باقة مطورين API", text: "مفتاح الـ API شغال بسرعة فائقة في معالجة البيانات وبدون انقطاع.", date: "أكتوبر 2026" },
    { name: "ندى حسن", service: "Canva Pro سنوي", text: "تم تفعيل كانفا برو على إيميلي التعليمي وشغال ممتاز.", date: "أكتوبر 2026" },
    { name: "خالد المنسي", service: "جواهر فري فاير", text: "شحن سريع وآمن بالـ ID فقط مع ظهور اسم حسابي فوراً.", date: "أكتوبر 2026" }
];
function renderReviews() {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;
    container.innerHTML = verifiedReviews.map(r => `
        <div class="sky-card border p-3.5 rounded-2xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1.5">
                        <div class="w-6 h-6 rounded-full sky-btn font-bold text-xs flex items-center justify-center">${r.name.charAt(0)}</div>
                        <span class="font-bold text-xs text-white">${r.name}</span>
                        <span class="bg-sky-500/20 text-sky-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-sky-400/40">✓ موثق</span>
                    </div>
                    <span class="text-amber-400 text-[10px]">★★★★★</span>
                </div>
                <p class="text-[11px] text-gray-300 leading-relaxed mb-2.5">"${r.text}"</p>
            </div>
            <div class="pt-2 border-t border-slate-700 flex items-center justify-between text-[10px] text-gray-400">
                <span class="text-amber-400 font-medium">✓ ${r.service}</span>
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
    document.getElementById('tabLoginBtn').className = (mode === 'login') ? 'py-2 text-xs font-bold rounded-lg transition sky-btn cursor-pointer' : 'py-2 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer';
    document.getElementById('tabRegisterBtn').className = (mode !== 'login') ? 'py-2 text-xs font-bold rounded-lg transition sky-btn cursor-pointer' : 'py-2 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer';
}
function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const users = getRegisteredUsers();
    if (users.find(u => u.email === email)) return showToast('هذا البريد مسجل بالفعل!', 'error');
    const newUser = { 
        name: document.getElementById('regName').value.trim(), 
        email: email, 
        phone: document.getElementById('regPhone').value.trim(), 
        passwordHash: encodePass(document.getElementById('regPassword').value),
        createdAt: new Date().toLocaleString('ar-EG')
    };
    users.push(newUser);
    saveRegisteredUsers(users);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));
    updateNavbarAuthUI();
    closeAuthModal();
    showToast('تم تسجيل حسابك بنجاح');
}
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const passHash = encodePass(document.getElementById('loginPassword').value);
    const user = getRegisteredUsers().find(u => u.email === email && u.passwordHash === passHash);
    if (!user) return showToast('بيانات الدخول غير صحيحة!', 'error');
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    updateNavbarAuthUI();
    closeAuthModal();
    showToast(`أهلاً بك مجدداً ${user.name}`);
}
function handleLogout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    updateNavbarAuthUI();
    showToast('تم تسجيل الخروج');
}
function exportDatabaseToCSV() {
    const users = getRegisteredUsers();
    if (users.length === 0) return showToast('لا توجد حسابات مسجلة حتى الآن.', 'error');
    let csvContent = "\uFEFFالاسم الكامل,البريد الإلكتروني,رقم الهاتف,تاريخ التسجيل\n";
    users.forEach(u => { csvContent += `"${u.name}","${u.email}","${u.phone || '-'}","${u.createdAt}"\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Migo_AI_Clients_Backup.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        let adminBtn = document.getElementById('adminExportCSVBtn');
        if (session.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            if (!adminBtn) {
                adminBtn = document.createElement('button');
                adminBtn.id = 'adminExportCSVBtn';
                adminBtn.onclick = exportDatabaseToCSV;
                adminBtn.className = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-1 rounded-lg mr-1 cursor-pointer';
                adminBtn.innerText = '📥 CSV';
                userBadge.insertBefore(adminBtn, userBadge.lastElementChild);
            }
        } else if (adminBtn) { adminBtn.remove(); }
    } else {
        loginBtn.classList.remove('hidden');
        userBadge.classList.add('hidden');
        userBadge.classList.remove('flex');
    }
}

function toggleSidebar() { document.getElementById('sidebarContainer').classList.toggle('hidden'); }

const newSubscriptionsCatalog = [
    { id: 'sub_chatgpt', category: 'ai', icon: 'fa-robot', name: 'ChatGPT Plus', keywords: 'شات جي بي تي ذكاء اصطناعي اوبن اي chatgpt plus openai', desc: 'حساب رسمي تفعيل فوري', variants: [{ label: 'شهر واحد', price: 820 }] },
    { id: 'sub_gemini', category: 'ai', icon: 'fa-wand-magic-sparkles', name: 'Google Gemini Pro', keywords: 'جوجل جيميني برو ذكاء اصطناعي google gemini pro', desc: 'اشتراك رسمي متكامل', variants: [{ label: '18 شهر', price: 245 }] },
    { id: 'sub_capcut', category: 'ai', icon: 'fa-video', name: 'CapCut Pro', keywords: 'كاب كات برو مونتاج فيديو capcut pro', desc: 'مونتاج احترافي وأدوات ذكاء اصطناعي', variants: [{ label: 'شهر واحد', price: 200 }] },
    { id: 'sub_adobe_cc', category: 'design', icon: 'fa-palette', name: 'Adobe Creative Cloud', keywords: 'ادوبي كريتيف كلاود فوتوشوب adobe creative cloud photoshop', desc: 'جميع برامج أدوبي الرسمية', variants: [{ label: 'شهر واحد', price: 770 }] },
    { id: 'sub_canva', category: 'design', icon: 'fa-paintbrush', name: 'Canva Pro', keywords: 'كانفا برو تصميم canva pro', desc: 'جميع قوالب ومميزات كانفا برو', variants: [{ label: 'سنة كاملة', price: 130 }] },
    { id: 'sub_shahid', category: 'entertainment', icon: 'fa-tv', name: 'شاهد VIP', keywords: 'شاهد في اي بي مسلسلات افلام shahid vip', desc: 'مشاهدة المسلسلات والأفلام بجودة عالية', variants: [{ label: 'شهر واحد', price: 205 }] },
    { id: 'sub_youtube', category: 'entertainment', icon: 'fa-play', name: 'YouTube Premium', keywords: 'يوتيوب بريميوم بدون اعلانات youtube premium', desc: 'مشاهدة بدون إعلانات وتشغيل بالخلفية', variants: [{ label: 'شهر واحد', price: 115 }] },
    { id: 'sub_netflix', category: 'entertainment', icon: 'fa-film', name: 'Netflix Premium', keywords: 'نتفلكس بريميوم افلام مسلسلات netflix premium', desc: 'حساب كامل بضمان كامل', variants: [{ label: 'حساب كامل', price: 310 }] }
];

function optimizeHeaderLayout() {
    const header = document.querySelector('header');
    if (!header) return;
    const fbElement = header.querySelector('a[href*="facebook"]');
    if (fbElement) fbElement.style.display = 'none';
}

function injectSubscriptionsSection() {
    if (document.getElementById('smart-subscriptions-wrapper')) return;
    const wrapper = document.createElement('section');
    wrapper.id = 'smart-subscriptions-wrapper';
    wrapper.className = 'container mx-auto px-4 my-8 space-y-5';
    wrapper.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-4">
            <div>
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                    <i class="fa-solid fa-layer-group text-indigo-400"></i> قسم البرامج والاشتراكات الرقمية
                </h2>
                <p class="text-xs text-gray-400 mt-1">اختر الفئة وحدد مدة الاشتراك المناسبة لك من القائمة</p>
            </div>
            <div class="flex flex-wrap gap-2" id="sub-category-tabs">
                <button type="button" class="sub-cat-tab active" data-cat="all">الكل</button>
                <button type="button" class="sub-cat-tab" data-cat="ai">الذكاء الاصطناعي</button>
                <button type="button" class="sub-cat-tab" data-cat="design">التصميم والإنتاجية</button>
                <button type="button" class="sub-cat-tab" data-cat="entertainment">الترفيه والبث</button>
            </div>
        </div>
        <div id="smart-subs-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    `;
    const mainContainer = document.querySelector('main');
    if (mainContainer) mainContainer.appendChild(wrapper);

    wrapper.querySelectorAll('.sub-cat-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            wrapper.querySelectorAll('.sub-cat-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderSubCards(this.getAttribute('data-cat'));
        });
    });
    renderSubCards('all');
}

function renderSubCards(category) {
    const grid = document.getElementById('smart-subs-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = category === 'all' ? newSubscriptionsCatalog : newSubscriptionsCatalog.filter(i => i.category === category);

    items.forEach(item => {
        const options = item.variants.map((v, idx) => `<option value="${idx}">${v.label} — ${v.price} ج.م</option>`).join('');
        const card = document.createElement('div');
        card.className = 'sub-item-card';
        card.id = `card-${item.id}`;
        card.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h3 class="font-bold text-white text-base flex items-center gap-2">
                        <i class="fa-solid ${item.icon} text-indigo-400"></i>
                        <span>${item.name}</span>
                    </h3>
                    <p class="text-xs text-gray-400 mt-1 leading-relaxed">${item.desc}</p>
                </div>
                <span id="price-badge-${item.id}" class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
                    ${item.variants[0].price} ج.م
                </span>
            </div>
            <div class="space-y-2 pt-2 border-t border-gray-800/80">
                <label class="block text-xs text-gray-300 font-medium" for="select-${item.id}">اختر خطة ومدة الاشتراك:</label>
                <select id="select-${item.id}" class="w-full bg-gray-900/90 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
                    ${options}
                </select>
                <button type="button" data-sub-id="${item.id}" class="add-sub-btn w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 mt-2 cursor-pointer">
                    <i class="fa-solid fa-cart-plus"></i> إضافة إلى السلة
                </button>
            </div>
        `;
        const selectEl = card.querySelector(`#select-${item.id}`);
        const badgeEl = card.querySelector(`#price-badge-${item.id}`);
        selectEl.addEventListener('change', function() {
            const selectedVar = item.variants[this.value];
            if (selectedVar) badgeEl.textContent = `${selectedVar.price} ج.م`;
        });
        card.querySelector('.add-sub-btn').addEventListener('click', function() {
            const selectedVar = item.variants[selectEl.value];
            addSubscriptionToSiteCart(item, selectedVar);
        });
        grid.appendChild(card);
    });
}

function integrateLiveSearch() {
    const searchInput = document.getElementById('liveSearchInput');
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toLowerCase();
        dropdown.querySelectorAll('.sub-live-search-item').forEach(el => el.remove());
        if (query.length < 1) return;

        const matchedSubs = newSubscriptionsCatalog.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.desc.toLowerCase().includes(query) ||
            (item.keywords && item.keywords.toLowerCase().includes(query))
        );

        if (matchedSubs.length > 0) {
            dropdown.classList.remove('hidden');
            matchedSubs.forEach(item => {
                const row = document.createElement('div');
                row.className = 'sub-live-search-item p-3 hover:bg-gray-800/90 cursor-pointer flex items-center justify-between border-b border-gray-800 transition';
                row.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <i class="fa-solid ${item.icon}"></i>
                        </div>
                        <div>
                            <div class="text-sm font-bold text-white">${item.name}</div>
                            <div class="text-xs text-gray-400">${item.desc}</div>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 whitespace-nowrap">
                        يبدأ من ${item.variants[0].price} ج.م
                    </span>
                `;
                row.addEventListener('click', function() {
                    dropdown.classList.add('hidden');
                    searchInput.value = '';
                    const allTab = document.querySelector('.sub-cat-tab[data-cat="all"]');
                    if (allTab) allTab.click();
                    setTimeout(() => {
                        const targetCard = document.getElementById(`card-${item.id}`);
                        if (targetCard) {
                            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetCard.classList.add('sub-highlight-pulse');
                            setTimeout(() => targetCard.classList.remove('sub-highlight-pulse'), 2000);
                        }
                    }, 100);
                });
                dropdown.appendChild(row);
            });
        }
    });
}

window.onload = function() {
    updateNavbarAuthUI();
    initVisitorCounter();
    initCountdown();
    loadCartFromStorage();
    renderGames();
    renderSMMPlatforms();
    selectSMMPlatform('tiktok');
    renderLiveApps();
    renderApps();
    initAPI();
    renderReviews();
    optimizeHeaderLayout();
    injectSubscriptionsSection();
    integrateLiveSearch();

    const slidePubg = document.getElementById('slidePubgIcon');
    if (slidePubg) slidePubg.innerHTML = SVG_LOGOS.pubg;

    setTimeout(triggerSocialProof, 3500);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#liveSearchInput') && !e.target.closest('#searchResultsDropdown')) {
            const dd = document.getElementById('searchResultsDropdown');
            if (dd) dd.classList.add('hidden');
        }
    });
};
