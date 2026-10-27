// ==============================================================================
// Migo AI Solution - payments.js
// بوابة وسائل الدفع الرسمية المعتمدة والكوبونات - مطابقة 100% للصورة المعتمدة
// ==============================================================================

const WHATSAPP_INVOICE_NUMBER = "201060934020";

const paymentsConfig = {
  // 1. المحافظ الإلكترونية المحلية
  localWallets: [
    {
      id: "vodafone_cash",
      name: "فودافون كاش",
      number: "01020323432",
      instruction: "قم بتحويل المبلغ إلى رقم فودافون كاش التالي:"
    },
    {
      id: "etisalat_cash",
      name: "اتصالات كاش",
      number: "01146691073",
      instruction: "قم بتحويل المبلغ إلى رقم اتصالات كاش التالي:"
    },
    {
      id: "instapay",
      name: "إنستاباي",
      number: "01146691073",
      instruction: "قم بالتحويل عبر تطبيق إنستاباي إلى الرقم التالي:"
    },
    {
      id: "telda",
      name: "تيلدا Telda",
      handle: "@saherbeh",
      instruction: "أرسل المبلغ عبر تطبيق تلدا إلى المعرف التالي:"
    }
  ],

  // 2. وسائل الدفع العالمية والرقمية
  globalPayments: [
    {
      id: "binance_pay",
      name: "باينانس باي (Binance Pay)",
      qrImage: "binance-qr.png.jpg",
      text: "الدفع عبر باينانس باي (Binance Pay) متاح بالعملات الرقمية (USDT).",
      notice: "امسح رمز الـ QR من البطاقة أو اطلب الـ Pay ID عبر واتساب للمتابعة."
    },
    {
      id: "paypal",
      name: "PayPal",
      email: "sahermohamed123456@gmail.com",
      instruction: "أرسل المبلغ إلى حساب PayPal التالي:"
    },
    {
      id: "redotpay",
      name: "RedotPay",
      userId: "1217212555",
      instruction: "التحويل الداخلي عبر حساب RedotPay إلى User ID التالي:"
    }
  ],

  // 3. البطاقات البنكية
  cardPayments: [
    {
      id: "bank_cards",
      name: "بطاقة بنكية",
      supported: ["VISA", "Mastercard", "G Pay", "Apple Pay"],
      instruction: "الدفع متاح عبر جميع البطاقات البنكية المباشرة والائتمانية."
    }
  ],

  // 4. خدمات الشراء الآن والدفع لاحقاً والائتمان
  installmentsBNPL: [
    {
      id: "bnpl_services",
      name: "خدمات الشراء الآن والدفع لاحقاً والائتمان",
      providers: ["تمارة Tamara", "فاليو valu", "سهولة", "تابي Tabby", "أمان Aman", "فرصة Forsa"],
      actionNotice: "(Contact me to get link)",
      instruction: "اختر وسيلة التقسيط وتواصل معنا مباشرة للحصول على الرابط المخصص (Contact me to get link)."
    }
  ],

  // 5. أكواد الخصم الرسمية
  coupons: [
    { code: "SIAFFC15", discountPercent: 15, active: true },
    { code: "SIAF15", discountPercent: 15, active: true },
    { code: "SIAFGAMING15", discountPercent: 15, active: true },
    { code: "MIGO15", discountPercent: 15, active: true }
  ]
};

// دالة فحص وتطبيق كود الخصم
function applyCouponCode(code, subtotal) {
  if (!code || typeof code !== "string") {
    return { valid: false, discountAmount: 0, finalTotal: subtotal, message: "يرجى كتابة الكوبون" };
  }
  const cleanCode = code.trim().toUpperCase();
  const coupon = paymentsConfig.coupons.find(c => c.code === cleanCode && c.active);

  if (!coupon) {
    return { valid: false, discountAmount: 0, finalTotal: subtotal, message: "كود الخصم غير صحيح" };
  }

  const discountAmount = Math.round((subtotal * (coupon.discountPercent / 100)) * 100) / 100;
  const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    discountAmount: discountAmount,
    finalTotal: finalTotal,
    message: `تم تفعيل خصم ${coupon.discountPercent}% بنجاح`
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { paymentsConfig, WHATSAPP_INVOICE_NUMBER, applyCouponCode };
} else {
  window.paymentsConfig = paymentsConfig;
  window.WHATSAPP_INVOICE_NUMBER = WHATSAPP_INVOICE_NUMBER;
  window.applyCouponCode = applyCouponCode;
}
