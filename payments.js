// ==============================================================================
// Migo AI Solution - payments.js
// بيانات وسائل الدفع المعتمدة بالكامل (بدون أورانج كاش) - مطابقة 100% للمتجر الحي
// ==============================================================================

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
        type: "copy",
        value: "855602846",
        instruction: "قم بالتحويل الداخلي عبر Binance Pay إلى الـ Pay ID التالي:"
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
        notice: "(تواصل معنا عبر واتساب للحصول على رابط إتمام الدفع)"
    },
    valu: {
        title: "فاليو valU",
        type: "bnpl",
        text: "خدمة تقسيط المشتريات عبر فاليو valu بدون دفعة أولى أو فوائد حسب خطتك.",
        notice: "(تواصل معنا عبر واتساب للحصول على رابط إتمام الدفع)"
    },
    souhoola: {
        title: "سهولة",
        type: "bnpl",
        text: "خدمة التقسيط عبر شركة سهولة Souhoola لجميع الباقات والخدمات.",
        notice: "(تواصل معنا عبر واتساب للحصول على رابط إتمام الدفع)"
    },
    tabby: {
        title: "تابي Tabby",
        type: "bnpl",
        text: "قسم مشترياتك على 4 دفعات بدون فوائد عبر تابي Tabby.",
        notice: "(تواصل معنا عبر واتساب للحصول على رابط إتمام الدفع)"
    },
    aman: {
        title: "أمان Aman",
        type: "bnpl",
        text: "خطط تقسيط مرنة عبر خدمات تقسيط أمان Aman.",
        notice: "(تواصل معنا عبر واتساب للحصول على رابط إتمام الدفع)"
    },
    forsa: {
        title: "فرصة Forsa",
        type: "bnpl",
        text: "شراء وتقسيط فوري لكافة الاشتراكات والألعاب عبر فرصة Forsa.",
        notice: "(تواصل معنا عبر واتساب للحصول على رابط إتمام الدفع)"
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PAYMENT_METHODS_DATA };
} else {
    window.PAYMENT_METHODS_DATA = PAYMENT_METHODS_DATA;
}
