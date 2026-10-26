// ==============================================================================
// بيانات وسائل الدفع الرسمية (14 وسيلة مستقلة)
// ==============================================================================

const WHATSAPP_NUMBER = "201060934020";

const PAYMENT_METHODS_DATA = {
    vodafone: {
        title: '📱 فودافون كاش',
        type: 'copy',
        value: '01020323432',
        instruction: 'يرجى تحويل المبلغ لمحفظة فودافون كاش الرسمية:'
    },
    etisalat: {
        title: '🟢 اتصالات كاش',
        type: 'copy',
        value: '01146691073',
        instruction: 'يرجى تحويل المبلغ لمحفظة اتصالات كاش الرسمية:'
    },
    instapay: {
        title: '⚡ إنستاباي (InstaPay)',
        type: 'copy',
        value: '01146691073',
        instruction: 'يرجى تحويل المبلغ عبر تطبيق إنستاباي (InstaPay) للرقم:'
    },
    telda: {
        title: '🟣 تيلدا (Telda)',
        type: 'copy',
        value: '@saherbeh',
        instruction: 'يرجى تحويل المبلغ لحساب تيلدا (Telda) التالي:'
    },
    redotpay: {
        title: '🔴 ريدوت باي (RedotPay)',
        type: 'copy',
        value: '1217212555',
        instruction: 'يرجى التحويل لمعرف حساب ريدوت باي (RedotPay ID):'
    },
    paypal: {
        title: '🔵 باي بال (PayPal)',
        type: 'copy',
        value: 'sahermohamed123456@gmail.com',
        instruction: 'يرجى إرسال المبلغ عبر باي بال (PayPal) إلى:'
    },
    binance: {
        title: '🟡 باينانس باي (Binance Pay)',
        type: 'info',
        html: `الدفع عبر باينانس باي (Binance Pay) متاح بالعملات الرقمية (USDT).<br><span class="text-amber-400 font-bold block mt-1">امسح رمز الـ QR من البطاقة أو اطلب الـ Pay ID عبر واتساب للمتابعة.</span>`
    },
    cards: {
        title: '💳 بطاقة بنكية (Visa / Apple Pay)',
        type: 'info',
        html: `الدفع المباشر ببطاقات (Visa / Mastercard / Google Pay / Apple Pay) متاح.<br><span class="text-sky-300 block mt-1 font-bold">اضغط تأكيد وسيتم تزويدك برابط الفاتورة المباشرة عبر واتساب.</span>`
    },
    valu: {
        title: '⚡ فاليو (valU)',
        type: 'bnpl',
        text: 'خدمة التقسيط عبر <b>فاليو (valU)</b> متاحة.'
    },
    tamara: {
        title: '🟠 تمارة (Tamara)',
        type: 'bnpl',
        text: 'خدمة التقسيط عبر <b>تمارة (Tamara)</b> متاحة.'
    },
    tabby: {
        title: '🟢 تابي (Tabby)',
        type: 'bnpl',
        text: 'خدمة التقسيط عبر <b>تابي (Tabby)</b> متاحة.'
    },
    souhoola: {
        title: '🟣 سهولة (Souhoola)',
        type: 'bnpl',
        text: 'خدمة التقسيط عبر <b>سهولة (Souhoola)</b> متاحة.'
    },
    forsa: {
        title: '🟢 فرصة (Forsa)',
        type: 'bnpl',
        text: 'خدمة التقسيط عبر <b>فرصة (Forsa)</b> متاحة.'
    },
    aman: {
        title: '🔵 أمان (Aman)',
        type: 'bnpl',
        text: 'خدمة التقسيط عبر <b>أمان (Aman)</b> متاحة.'
    }
};
