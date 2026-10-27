// ==============================================================================
// ملف 2: وسائل الدفع والتحويلات الرسمية الكاملة للمتجر (مطابقة للصورة المعتمدة)
// ==============================================================================

const PAYMENT_DETAILS = {
  vodafone: `
    <p class="font-bold text-rose-400">🔴 فودافون كاش (Vodafone Cash):</p>
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center my-1.5 font-mono text-white text-xs">
      <span>01020323432</span>
      <button type="button" onclick="copyPaymentInfo('01020323432', 'تم نسخ رقم فودافون كاش')" class="bg-rose-600 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer">نسخ</button>
    </div>
  `,
  etisalat: `
    <p class="font-bold text-emerald-400">🟢 اتصالات كاش (Etisalat Cash):</p>
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center my-1.5 font-mono text-white text-xs">
      <span>01146691073</span>
      <button type="button" onclick="copyPaymentInfo('01146691073', 'تم نسخ رقم اتصالات كاش')" class="bg-emerald-600 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer">نسخ</button>
    </div>
  `,
  instapay: `
    <p class="font-bold text-purple-400">⚡ إنستاباي (InstaPay):</p>
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center my-1.5 font-mono text-white text-xs">
      <span>01146691073</span>
      <button type="button" onclick="copyPaymentInfo('01146691073', 'تم نسخ رقم إنستاباي')" class="sky-btn text-[10px] px-2.5 py-1 rounded cursor-pointer">نسخ</button>
    </div>
  `,
  telda: `
    <p class="font-bold text-teal-400">🔹 تلدا (Telda):</p>
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center my-1.5 font-mono text-white text-xs">
      <span>@saherbeh</span>
      <button type="button" onclick="copyPaymentInfo('@saherbeh', 'تم نسخ حساب تلدا')" class="bg-teal-600 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer">نسخ</button>
    </div>
  `,
  binance: `
    <p class="font-bold text-amber-400">🟡 بايننس باي (Binance Pay - QR كود):</p>
    <p class="text-[11px] text-gray-300 my-1">امسح الـ QR كود المعتمد للدفع السريع والآمن عبر منصة بايننس.</p>
  `,
  paypal: `
    <p class="font-bold text-sky-400">💙 باي بال (PayPal):</p>
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center my-1.5 font-mono text-white text-xs">
      <span>sahermohamed123456@gmail.com</span>
      <button type="button" onclick="copyPaymentInfo('sahermohamed123456@gmail.com', 'تم نسخ إيميل باي بال')" class="bg-sky-600 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer">نسخ</button>
    </div>
  `,
  redotpay: `
    <p class="font-bold text-red-400">💳 ريدوت باي (RedotPay):</p>
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center my-1.5 font-mono text-white text-xs">
      <span>User ID: 1217212555</span>
      <button type="button" onclick="copyPaymentInfo('1217212555', 'تم نسخ معرف ريدوت باي')" class="bg-red-600 text-white text-[10px] px-2.5 py-1 rounded cursor-pointer">نسخ</button>
    </div>
  `,
  cards: `
    <p class="font-bold text-blue-400">💳 البطاقات المباشرة والائتمانية:</p>
    <p class="text-[11px] text-gray-300">تدعم (Visa, Mastercard, G Pay, Apple Pay) للدفع الفوري الآمن.</p>
  `,
  bnpl: `
    <p class="font-bold text-indigo-400">🔄 خدمات الشراء الآن والدفع لاحقاً والائتمان:</p>
    <p class="text-[11px] text-gray-300 mb-1">(تابي Tabby, تمارا Tamara, فاليو Valu, سهولة Souhoola, فرصة Forsa, أمان Aman)</p>
    <p class="text-xs text-amber-300 font-bold mt-1">(Contact me to get link)</p>
  `
};

// قائمة الكوبونات المعتمدة للمتجر
const VALID_COUPONS = {
  "SIAFFC15": 15,
  "SIAF15": 15,
  "SIAFGAMING15": 15
};
