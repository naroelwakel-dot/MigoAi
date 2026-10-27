// ==============================================================================
// Migo AI Solution - payments.js
// بوابة وسائل الدفع الرسمية المعتمدة والكوبونات - مطابقة 100%
// ==============================================================================

const paymentsConfig = {
  // 1. المحافظ الإلكترونية المحلية (Local Wallets)
  localWallets: [
    {
      id: "vodafone_cash",
      name: "فودافون كاش (Vodafone Cash)",
      number: "01020323432",
      badge: "دفع محلي فوري ⚡",
      icon: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80",
      instruction: "قم بتحويل المبلغ إلى رقم فودافون كاش الموضح، ثم احتفظ بصورة التحويل لتأكيد الطلب."
    },
    {
      id: "etisalat_cash",
      name: "اتصالات كاش (Etisalat Cash)",
      number: "01146691073",
      badge: "دفع محلي فوري ⚡",
      icon: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=300&q=80",
      instruction: "قم بالتحويل لرقم محفظة اتصالات كاش أعلاه، وأرسل لقطة الشاشة للتأكيد الفوري."
    },
    {
      id: "instapay",
      name: "إنستاباي (InstaPay)",
      number: "01146691073",
      badge: "تحويل بنكي لحظي ⚡",
      icon: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=300&q=80",
      instruction: "التحويل متاح لحظياً عبر تطبيق إنستاباي باستخدام رقم الهاتف الموضح."
    },
    {
      id: "telda",
      name: "تلدا (Telda)",
      handle: "@saherbeh",
      badge: "تحويل مباشر ⚡",
      icon: "https://images.unsplash.com/photo-1589758438368-0ad531db3366?auto=format&fit=crop&w=300&q=80",
      instruction: "أرسل المبلغ مباشرة عبر تطبيق تلدا إلى المعرف الشخصي (@saherbeh)."
    }
  ],

  // 2. وسائل الدفع الرقمية العالمية (Global & Crypto Payments)
  globalPayments: [
    {
      id: "binance_pay",
      name: "بايننس باي (Binance Pay)",
      qrCodeImage: "binance-qr.png.jpg",
      badge: "دفع رقمي فوري (USDT) 🪙",
      instruction: "امسح رمز الاستجابة السريعة (QR Code) عبر تطبيق بايننس لإتمام الدفع الفوري بدون رسوم."
    },
    {
      id: "paypal",
      name: "باي بال (PayPal)",
      email: "sahermohamed123456@gmail.com",
      badge: "دفع دولي معتمد 🌐",
      instruction: "أرسل الدفعة إلى بريد PayPal المعتمد (مع تحديد خيار Friends & Family إن أمكن)."
    },
    {
      id: "redotpay",
      name: "ريدوت باي (RedotPay)",
      userId: "1217212555",
      badge: "تحويل داخلي فوري ⚡",
      instruction: "التحويل المباشر من حسابك في RedotPay إلى معرف المستخدم ID: 1217212555."
    }
  ],

  // 3. البطاقات البنكية المباشرة (Credit & Debit Cards)
  cardPayments: [
    {
      id: "cards_direct",
      name: "البطاقات المباشرة والائتمانية",
      supported: ["Visa", "Mastercard", "Google Pay", "Apple Pay"],
      badge: "دفع آمن ومباشر 💳",
      instruction: "دعم لكافة البطاقات البنكية المعتمدة للدفع الرقمي."
    }
  ],

  // 4. خدمات الشراء الآن والدفع لاحقاً والائتمان (BNPL & Installments)
  installmentsBNPL: [
    {
      id: "bnpl_services",
      name: "خدمات التقسيط والشراء الآن والدفع لاحقاً",
      services: ["تابي (Tabby)", "تمارا (Tamara)", "فاليو (Valu)", "سهولة (Souhoola)", "فرصة (Forsa)", "أمان (Aman)"],
      actionNotice: "Contact me to get link",
      badge: "تقسيط مريح 🛍️",
      instruction: "اختر جهة التقسيط وتواصل معنا مباشرة عبر واتساب للحصول على رابط الدفع المخصص (Contact me to get link)."
    }
  ],

  // 5. أكواد الخصم الرسمية المعتمدة (Promo Codes)
  coupons: [
    {
      code: "SIAFFC15",
      discountPercent: 15,
      active: true,
      description: "خصم حصري 15% على إجمالي الطلب"
    },
    {
      code: "SIAF15",
      discountPercent: 15,
      active: true,
      description: "خصم ترويجي 15% على كافة الخدمات"
    },
    {
      code: "SIAFGAMING15",
      discountPercent: 15,
      active: true,
      description: "خصم خاص 15% لشحن الألعاب والخدمات الرقمية"
    }
  ]
};

// دالة تطبيق كود الخصم والتحقق من صلاحيته
function applyCouponCode(code, subtotal) {
  if (!code || typeof code !== "string") {
    return { valid: false, discountAmount: 0, finalTotal: subtotal, message: "يرجى إدخال الكوبون" };
  }

  const cleanCode = code.trim().toUpperCase();
  const coupon = paymentsConfig.coupons.find(c => c.code === cleanCode && c.active);

  if (!coupon) {
    return { valid: false, discountAmount: 0, finalTotal: subtotal, message: "كود الخصم غير صالح أو منتهي الصلاحية" };
  }

  const discountAmount = Math.round((subtotal * (coupon.discountPercent / 100)) * 100) / 100;
  const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    discountAmount: discountAmount,
    finalTotal: finalTotal,
    message: `تم تطبيق خصم ${coupon.discountPercent}% بنجاح!`
  };
}

// دالة توليد نص الفاتورة الرسمية لإرسالها عبر واتساب
function generateOrderInvoice(cartItems, paymentMethodName, couponCode = null) {
  if (!cartItems || cartItems.length === 0) {
    return "";
  }

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price || 0), 0);
  let discountText = "";
  let finalPrice = subtotal;

  if (couponCode) {
    const couponResult = applyCouponCode(couponCode, subtotal);
    if (couponResult.valid) {
      discountText = `\n🎁 كود الخصم (${couponResult.code}): -${couponResult.discountAmount} ج.م`;
      finalPrice = couponResult.finalTotal;
    }
  }

  let itemsDetails = cartItems.map((item, index) => {
    let details = `${index + 1}. ${item.name} - ${item.price} ج.م`;
    if (item.account) details += `\n   📍 معرّف الحساب (ID): ${item.account}`;
    if (item.zone) details += `\n   🌐 السيرفر (Zone ID): ${item.zone}`;
    if (item.quantity) details += `\n   📊 الكمية: ${item.quantity.toLocaleString()}`;
    return details;
  }).join("\n\n");

  const message = `مرحباً متجر Migo AI Solution 👋
أرغب في تأكيد وتفعيل طلبي التالي:

📦 تفاصيل الطلب:
${itemsDetails}

💰 الحساب المالي:
- المجموع الفرعي: ${subtotal} ج.م${discountText}
- الإجمالي النهائي للدفع: ${finalPrice} ج.م

💳 وسيلة الدفع المختارة:
- ${paymentMethodName}

يرجى تأكيد الاستلام وبدء التنفيذ الفوري ⚡`;

  return encodeURIComponent(message);
}

// إتاحة البيانات والوظائف للواجهة
if (typeof module !== "undefined" && module.exports) {
  module.exports = { paymentsConfig, applyCouponCode, generateOrderInvoice };
} else {
  window.paymentsConfig = paymentsConfig;
  window.applyCouponCode = applyCouponCode;
  window.generateOrderInvoice = generateOrderInvoice;
}
