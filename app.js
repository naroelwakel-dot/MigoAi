// ==============================================================================
// تطبيق Migo AI Solution - المحرك البصري المصحح (Glitch Store Standard)
// ==============================================================================

let cart = [];
let appliedCoupon = null;
let currentSelectedPaymentMethod = null;
let currentUser = null;
let currentSlide = 0;
let slideInterval = null;
let activeCinematicGame = null;
let activeCinematicPackage = null;

document.addEventListener("DOMContentLoaded", () => {
  loadCartFromStorage();
  initAuth();
  startPromoCountdown();
  initAutoSlider();
  initSocialProofSystem();

  // رسم المعارض والخدمات
  renderGlitchGamesGrid();
  renderTiktokAndTelegram();
  renderLiveApps();
  renderVccCards();
  renderProductivityTools();
  renderEntertainment();
  renderAiTools();
  renderSMMModule();
  renderReviews();
});

// ==============================================================================
// 1. شبكة بوسترات الألعاب - مطابقة 100% لطراز Glitch Store المضغوط
// ==============================================================================

function renderGlitchGamesGrid() {
  const container = document.getElementById("gamesCardsContainer");
  if (!container || typeof allGames === "undefined") return;

  container.innerHTML = allGames.map(game => `
    <div onclick="openGameCinematicModal('${game.id}')" 
         class="poster-card relative h-52 sm:h-64 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800 bg-[#0e1422] shadow-xl flex flex-col justify-between p-2.5 sm:p-3 group cursor-pointer hover:border-purple-500/80 transition-all duration-300">
      
      <!-- غلاف اللعبة الرأسي الكامل مع معالج أخطاء التحميل -->
      <img src="${game.banner}" alt="${game.name}" 
           onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop';"
           class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-108">
      
      <!-- تدرج لوني سينمائي داكن ناعم -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/40 to-black/30 pointer-events-none"></div>

      <!-- الشارة العلوية المدمجة -->
      <div class="relative z-10 flex justify-between items-center">
        <span class="bg-purple-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm border border-purple-400/30">
          ${game.badge || "👑 Top"}
        </span>
        <span class="text-[9px] text-amber-400 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-mono">5.0 ★</span>
      </div>

      <!-- كبسولة الاسم السفلية النظيفة مثل Glitch Store تماماً -->
      <div class="relative z-10 bg-slate-950/85 backdrop-blur-md border border-white/10 px-2.5 py-2 rounded-xl text-right">
        <h3 class="text-xs font-black text-white truncate leading-tight">${game.name}</h3>
        <div class="flex items-center justify-between mt-1 text-[10px]">
          <span class="text-gray-300 font-medium">Top-Up</span>
          <span class="text-emerald-400 font-bold font-mono">⚡ فوري</span>
        </div>
      </div>

    </div>
  `).join("");
}

// ==============================================================================
// 2. النافذة السينمائية المخصصة لاختيار الباقة والـ ID
// ==============================================================================

function openGameCinematicModal(gameId) {
  const game = allGames.find(g => g.id === gameId);
  if (!game) return;

  activeCinematicGame = game;
  activeCinematicPackage = game.packages[0] || null;

  const modalBanner = document.getElementById("gModalBanner");
  modalBanner.src = game.banner;
  modalBanner.onerror = () => { modalBanner.src = "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop"; };

  document.getElementById("gModalBadge").innerText = game.badge || "شحن فوري رسمي";
  document.getElementById("gModalTitle").innerText = game.name;
  document.getElementById("gModalSummaryName").innerText = game.name;

  // معالجة صورة أيقونة النافذة لمنع أي خطأ تالف
  const modalIcon = document.getElementById("gModalIcon");
  modalIcon.src = game.icon;
  modalIcon.onerror = function() {
    this.onerror = null;
    this.parentElement.innerHTML = `<span class="text-xl">🎮</span>`;
  };

  const zoneGroup = document.getElementById("gModalZoneGroup");
  if (game.requireZone) {
    zoneGroup.classList.remove("hidden");
  } else {
    zoneGroup.classList.add("hidden");
  }

  document.getElementById("gModalPlayerId").value = "";
  document.getElementById("gModalPlayerName").value = "";
  if (document.getElementById("gModalZoneId")) document.getElementById("gModalZoneId").value = "";

  const statusBox = document.getElementById("gModalVerifyStatus");
  statusBox.className = "hidden p-2 rounded-xl text-xs font-bold text-center border";
  statusBox.innerText = "";

  renderCinematicPackagesGrid(game);

  const modal = document.getElementById("gameCinematicModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeGameCinematicModal() {
  const modal = document.getElementById("gameCinematicModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  activeCinematicGame = null;
  activeCinematicPackage = null;
}

function renderCinematicPackagesGrid(game) {
  const container = document.getElementById("gModalPackagesGrid");
  if (!container) return;

  container.innerHTML = game.packages.map((pkg, idx) => {
    const isSelected = idx === 0;
    return `
      <button type="button" onclick="selectCinematicPackage(${idx}, this)" 
              class="cinematic-pkg-btn p-2.5 rounded-xl border text-right transition cursor-pointer ${
                isSelected 
                  ? "bg-purple-600/30 border-purple-400 text-white shadow-lg" 
                  : "bg-slate-900 border-slate-700 text-gray-300 hover:border-slate-500"
              }">
        <div class="text-xs font-black truncate">${pkg.name}</div>
        <div class="text-[11px] text-amber-400 font-mono font-bold mt-1">${pkg.price} ج.م</div>
      </button>
    `;
  }).join("");

  updateCinematicSelectedSummary();
}

function selectCinematicPackage(index, btnElement) {
  if (!activeCinematicGame) return;
  activeCinematicPackage = activeCinematicGame.packages[index];

  document.querySelectorAll(".cinematic-pkg-btn").forEach(btn => {
    btn.className = "cinematic-pkg-btn p-2.5 rounded-xl border text-right transition cursor-pointer bg-slate-900 border-slate-700 text-gray-300 hover:border-slate-500";
  });

  if (btnElement) {
    btnElement.className = "cinematic-pkg-btn p-2.5 rounded-xl border text-right transition cursor-pointer bg-purple-600/30 border-purple-400 text-white shadow-lg";
  }

  updateCinematicSelectedSummary();
}

function updateCinematicSelectedSummary() {
  const summary = document.getElementById("gModalSelectedSummary");
  if (!summary || !activeCinematicPackage) return;
  summary.innerHTML = `${activeCinematicPackage.name} <span class="text-white">•</span> <b class="text-amber-400">${activeCinematicPackage.price} ج.م</b>`;
}

// فحص المعرف لحظياً
async function verifyCinematicPlayerAccount() {
  if (!activeCinematicGame) return;
  const playerId = document.getElementById("gModalPlayerId").value.trim();
  const zoneId = document.getElementById("gModalZoneId") ? document.getElementById("gModalZoneId").value.trim() : "";
  const nameInput = document.getElementById("gModalPlayerName");
  const statusBox = document.getElementById("gModalVerifyStatus");
  const verifyBtn = document.getElementById("gModalVerifyBtn");

  if (!playerId) {
    showToast("⚠️ يرجى كتابة معرف اللاعب (ID) أولاً", "error");
    return;
  }

  if (activeCinematicGame.requireZone && !zoneId) {
    showToast("⚠️ يرجى إدخال معرف السيرفر (Zone ID)", "error");
    return;
  }

  verifyBtn.innerHTML = `<span>جارٍ الفحص...</span> ⏳`;
  verifyBtn.disabled = true;

  statusBox.className = "p-2 rounded-xl text-xs font-bold text-center border bg-slate-900 text-sky-400 border-sky-500/30 block";
  statusBox.innerText = "🔍 جارٍ استرجاع اسم اللاعب بالاسم الحقيقي...";

  try {
    const response = await fetch("https://migoai-72.naroelwakel-dot.deno.net/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game: activeCinematicGame.id,
        userId: playerId,
        zoneId: zoneId
      })
    });

    const data = await response.json();

    if (data && data.success && data.username) {
      nameInput.value = data.username;
      statusBox.className = "p-2 rounded-xl text-xs font-bold text-center border bg-emerald-950/60 text-emerald-300 border-emerald-500/40 block";
      statusBox.innerText = `✓ تم التحقق بنجاح! اسم اللاعب: ${data.username}`;
      showToast(`✓ مرحباً: ${data.username}`, "success");
    } else {
      throw new Error(data.message || "تعذر العثور على المعرف");
    }
  } catch (err) {
    statusBox.className = "p-2 rounded-xl text-xs font-bold text-center border bg-amber-950/60 text-amber-300 border-amber-500/40 block";
    statusBox.innerText = "ℹ️ لم يتم استرجاع الاسم تلقائياً. اكتب اسمك يدوياً واضغط إتمام الشحن.";
  } finally {
    verifyBtn.innerHTML = `<span>فحص</span> 🔍`;
    verifyBtn.disabled = false;
  }
}

function submitCinematicOrder(isInstant) {
  if (!activeCinematicGame || !activeCinematicPackage) {
    showToast("⚠️ يرجى اختيار الباقة المطلوبة", "error");
    return;
  }

  const playerId = document.getElementById("gModalPlayerId").value.trim();
  const zoneId = document.getElementById("gModalZoneId") ? document.getElementById("gModalZoneId").value.trim() : "";
  const playerName = document.getElementById("gModalPlayerName").value.trim();

  if (!playerId) {
    showToast("⚠️ يرجى كتابة معرف اللاعب (ID)", "error");
    return;
  }

  if (activeCinematicGame.requireZone && !zoneId) {
    showToast("⚠️ يرجى إدخال معرف السيرفر (Zone ID)", "error");
    return;
  }

  const item = {
    id: `game_${activeCinematicGame.id}_${Date.now()}`,
    serviceType: "game",
    title: activeCinematicGame.name,
    package: activeCinematicPackage.name,
    price: activeCinematicPackage.price,
    playerId: playerId,
    zoneId: zoneId || null,
    playerName: playerName || "غير محدد",
    image: activeCinematicGame.icon
  };

  closeGameCinematicModal();

  if (isInstant) {
    cart = [item];
    saveCartToStorage();
    updateCartUI();
    proceedToCheckout();
  } else {
    cart.push(item);
    saveCartToStorage();
    updateCartUI();
    showToast(`🛒 تمت إضافة ${item.title} (${item.package}) إلى السلة`, "success");
  }
}

// ==============================================================================
// 3. باقي الأقسام والخدمات
// ==============================================================================

function renderTiktokAndTelegram() {
  const tiktokContainer = document.getElementById("tiktokCoinsGrid");
  const telegramContainer = document.getElementById("telegramStarsGrid");

  if (tiktokContainer && typeof tiktokPackages !== "undefined") {
    tiktokContainer.innerHTML = tiktokPackages.map(pkg => `
      <div class="sky-surface border border-slate-700 p-2.5 rounded-xl flex items-center justify-between">
        <div>
          <div class="text-xs font-black text-white">${pkg.coins} كوينز</div>
          <div class="text-[11px] text-pink-400 font-bold font-mono">${pkg.price} ج.م</div>
        </div>
        <button type="button" onclick="openPlayerModalForCustom('tiktok', 'عملات تيك توك', '${pkg.coins} كوينز', ${pkg.price}, 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=200&auto=format&fit=crop')" 
                class="bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer">
          شحن ⚡
        </button>
      </div>
    `).join("");
  }

  if (telegramContainer && typeof telegramPackages !== "undefined") {
    telegramContainer.innerHTML = telegramPackages.map(pkg => `
      <div class="sky-surface border border-slate-700 p-2.5 rounded-xl flex items-center justify-between">
        <div>
          <div class="text-xs font-black text-white">${pkg.stars} نجمة</div>
          <div class="text-[11px] text-sky-400 font-bold font-mono">${pkg.price} ج.م</div>
        </div>
        <button type="button" onclick="openPlayerModalForCustom('telegram', 'نجوم تليجرام', '${pkg.stars} نجمة', ${pkg.price}, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop')" 
                class="sky-btn text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer">
          شحن ⚡
        </button>
      </div>
    `).join("");
  }
}

function renderLiveApps() {
  const container = document.getElementById("liveAppsContainer");
  if (!container || typeof liveAppsData === "undefined") return;

  container.innerHTML = liveAppsData.map(app => `
    <div class="sky-card border p-3.5 rounded-2xl flex flex-col justify-between">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-11 h-11 rounded-xl bg-slate-950 border border-slate-700 p-1 flex items-center justify-center shrink-0">
          <img src="${app.icon}" alt="${app.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=200&auto=format&fit=crop';" class="w-full h-full object-cover rounded-lg">
        </div>
        <div>
          <h3 class="text-xs sm:text-sm font-black text-white">${app.name}</h3>
          <span class="text-[10px] text-rose-400 font-bold block">${app.chargeType}</span>
        </div>
      </div>
      <div class="space-y-1.5 mb-2">
        ${app.packages.map(pkg => `
          <div class="bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl flex justify-between items-center text-xs">
            <span class="font-bold text-gray-200">${pkg.name}</span>
            <div class="flex items-center gap-2">
              <span class="text-amber-400 font-mono font-bold">${pkg.price} ج.م</span>
              <button type="button" onclick="openPlayerModalForCustom('${app.id}', '${app.name}', '${pkg.name}', ${pkg.price}, '${app.icon}')" 
                      class="bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg cursor-pointer">
                شحن
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderVccCards() {
  const container = document.getElementById("vccCardsContainer");
  if (!container || typeof vccCardsData === "undefined") return;

  container.innerHTML = vccCardsData.map(card => `
    <div class="sky-card border border-amber-500/30 p-4 rounded-2xl flex flex-col justify-between text-center relative overflow-hidden group">
      <div>
        <span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black px-2.5 py-0.5 rounded-full inline-block mb-2">فيزا دولية</span>
        <h3 class="text-base font-black text-white">${card.name}</h3>
        <p class="text-[11px] text-gray-400 mt-1 mb-3">${card.desc}</p>
        <div class="text-lg font-black text-amber-400 font-mono mb-4">${card.price} ج.م</div>
      </div>
      <button type="button" onclick="openVccModal('${card.name}', ${card.price})" 
              class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition cursor-pointer shadow">
        طلب البطاقة 💳
      </button>
    </div>
  `).join("");
}

function openVccModal(name, price) {
  document.getElementById("vccModalTitle").innerText = name;
  document.getElementById("vccModalPrice").innerText = `السعر الإجمالي: ${price} ج.م`;
  document.getElementById("vccEmailInput").value = "";
  document.getElementById("vccPurposeInput").value = "";

  const modal = document.getElementById("vccModal");
  modal.dataset.currentName = name;
  modal.dataset.currentPrice = price;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeVccModal() {
  const modal = document.getElementById("vccModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function submitVccModal(isInstant) {
  const modal = document.getElementById("vccModal");
  const name = modal.dataset.currentName;
  const price = parseFloat(modal.dataset.currentPrice);
  const email = document.getElementById("vccEmailInput").value.trim();
  const purpose = document.getElementById("vccPurposeInput").value.trim();

  if (!email || !email.includes("@")) {
    showToast("⚠️ يرجى إدخال بريد إلكتروني صحيح", "error");
    return;
  }

  const item = {
    id: `vcc_${Date.now()}`,
    serviceType: "vcc",
    title: name,
    package: "بطاقة دفع دولي",
    price: price,
    email: email,
    purpose: purpose || "استخدام عام",
    image: "💳"
  };

  closeVccModal();

  if (isInstant) {
    cart = [item];
    saveCartToStorage();
    updateCartUI();
    proceedToCheckout();
  } else {
    cart.push(item);
    saveCartToStorage();
    updateCartUI();
    showToast(`🛒 تمت إضافة ${name} إلى السلة`, "success");
  }
}

function renderProductivityTools() {
  const container = document.getElementById("productivityContainer");
  if (!container || typeof productivityToolsData === "undefined") return;

  container.innerHTML = productivityToolsData.map(tool => `
    <div class="sky-card border p-3.5 rounded-2xl flex flex-col justify-between">
      <div class="flex items-center gap-2.5 mb-2.5">
        <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-xl shrink-0">
          ${tool.icon}
        </div>
        <div>
          <h3 class="text-xs sm:text-sm font-black text-white">${tool.name}</h3>
          <span class="text-[10px] text-cyan-400 font-bold block">${tool.tag}</span>
        </div>
      </div>
      <div class="space-y-1 mb-2">
        ${tool.packages.map(pkg => `
          <div class="bg-slate-950 border border-slate-800 px-2 py-1.5 rounded-xl flex justify-between items-center text-xs">
            <span class="text-gray-300 font-bold text-[11px]">${pkg.duration}</span>
            <div class="flex items-center gap-1.5">
              <span class="text-amber-400 font-mono font-bold text-[11px]">${pkg.price} ج.م</span>
              <button type="button" onclick="addToCartDirect('${tool.name}', '${pkg.duration}', ${pkg.price}, '${tool.icon}')" 
                      class="sky-btn text-[9px] font-black px-2 py-0.5 rounded-lg cursor-pointer">
                طلب
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderEntertainment() {
  const container = document.getElementById("entertainmentCardsContainer");
  if (!container || typeof entertainmentData === "undefined") return;

  container.innerHTML = entertainmentData.map(item => `
    <div class="sky-card border p-3 rounded-2xl flex flex-col justify-between">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-9 h-9 rounded-xl bg-slate-950 border border-purple-500/40 flex items-center justify-center text-lg shrink-0">
          ${item.icon}
        </div>
        <div>
          <h3 class="text-xs font-black text-white">${item.name}</h3>
          <span class="text-[9px] text-purple-400 font-bold">${item.desc}</span>
        </div>
      </div>
      <div class="space-y-1">
        ${item.packages.map(pkg => `
          <div class="bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg flex justify-between items-center text-[11px]">
            <span class="text-gray-300 font-bold">${pkg.duration}</span>
            <div class="flex items-center gap-1.5">
              <span class="text-amber-400 font-mono font-bold">${pkg.price} ج.م</span>
              <button type="button" onclick="addToCartDirect('${item.name}', '${pkg.duration}', ${pkg.price}, '${item.icon}')" 
                      class="bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer">
                طلب
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderAiTools() {
  const container = document.getElementById("aiCardsContainer");
  if (!container || typeof aiToolsData === "undefined") return;

  container.innerHTML = aiToolsData.map(item => `
    <div class="sky-card border p-3 rounded-2xl flex flex-col justify-between">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-9 h-9 rounded-xl bg-slate-950 border border-indigo-500/40 flex items-center justify-center text-lg shrink-0">
          ${item.icon}
        </div>
        <div>
          <h3 class="text-xs font-black text-white">${item.name}</h3>
          <span class="text-[9px] text-indigo-400 font-bold">${item.desc}</span>
        </div>
      </div>
      <div class="space-y-1">
        ${item.packages.map(pkg => `
          <div class="bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg flex justify-between items-center text-[11px]">
            <span class="text-gray-300 font-bold">${pkg.duration}</span>
            <div class="flex items-center gap-1.5">
              <span class="text-amber-400 font-mono font-bold">${pkg.price} ج.م</span>
              <button type="button" onclick="addToCartDirect('${item.name}', '${pkg.duration}', ${pkg.price}, '${item.icon}')" 
                      class="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer">
                طلب
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function addToCartDirect(title, pkgName, price, icon) {
  const item = {
    id: `direct_${Date.now()}`,
    serviceType: "direct",
    title: title,
    package: pkgName,
    price: price,
    image: icon
  };
  cart.push(item);
  saveCartToStorage();
  updateCartUI();
  showToast(`🛒 تمت إضافة ${title} (${pkgName}) إلى السلة`, "success");
}

let activeCustomModalData = null;

function openPlayerModalForCustom(id, name, pkg, price, iconUrl) {
  activeCustomModalData = { id, name, pkg, price, iconUrl };

  const select = document.getElementById("modalSelectGame");
  if (typeof GAMES_REGISTRY !== "undefined") {
    select.innerHTML = GAMES_REGISTRY.map(g => `
      <option value="${g.id}" ${g.id === id ? "selected" : ""}>${g.name} (${g.category})</option>
    `).join("");
  }

  document.getElementById("modalTargetIcon").innerHTML = `<img src="${iconUrl}" onerror="this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop';" class="w-full h-full object-cover rounded-lg">`;
  document.getElementById("modalTargetTitle").innerText = name;
  document.getElementById("modalTargetPkg").innerText = `الباقة: ${pkg} • ${price} ج.م`;

  document.getElementById("modalInputPlayerId").value = "";
  document.getElementById("modalInputPlayerName").value = "";
  if (document.getElementById("modalInputZoneId")) document.getElementById("modalInputZoneId").value = "";

  const statusBox = document.getElementById("verifyStatusBox");
  statusBox.className = "hidden p-2.5 rounded-xl text-xs font-bold text-center border";
  statusBox.innerText = "";

  document.getElementById("modalSubmitBtn").innerText = `متابعة الشحن الآن (${price} ج.م) ⚡`;
  document.getElementById("modalSubmitBtn").onclick = submitCustomPlayerOrder;

  const modal = document.getElementById("playerIdModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closePlayerIdModal() {
  const modal = document.getElementById("playerIdModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  activeCustomModalData = null;
}

function onModalGameSelectChange() {
  const select = document.getElementById("modalSelectGame");
  const selectedId = select.value;
  const regItem = GAMES_REGISTRY.find(g => g.id === selectedId);
  const zoneGroup = document.getElementById("modalZoneGroup");

  if (regItem && regItem.requireZone) {
    zoneGroup.classList.remove("hidden");
  } else {
    zoneGroup.classList.add("hidden");
  }
}

async function verifyPlayerAccount() {
  const select = document.getElementById("modalSelectGame");
  const gameId = select.value;
  const userId = document.getElementById("modalInputPlayerId").value.trim();
  const zoneId = document.getElementById("modalInputZoneId") ? document.getElementById("modalInputZoneId").value.trim() : "";
  const nameInput = document.getElementById("modalInputPlayerName");
  const statusBox = document.getElementById("verifyStatusBox");
  const verifyBtn = document.getElementById("verifyAccountBtn");

  if (!userId) {
    showToast("⚠️ يرجى كتابة الـ ID أولاً", "error");
    return;
  }

  verifyBtn.innerHTML = `<span>جارٍ الفحص...</span> ⏳`;
  verifyBtn.disabled = true;

  statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-slate-900 text-sky-400 border-sky-500/30 block";
  statusBox.innerText = "🔍 جارٍ استرجاع اسم الحساب بالاسم الرسمي...";

  try {
    const res = await fetch("https://migoai-72.naroelwakel-dot.deno.net/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: gameId, userId, zoneId })
    });
    const result = await res.json();

    if (result && result.success && result.username) {
      nameInput.value = result.username;
      statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-emerald-950/60 text-emerald-300 border-emerald-500/40 block";
      statusBox.innerText = `✓ تم التحقق بنجاح! اسم الحساب: ${result.username}`;
    } else {
      throw new Error(result.message || "فشل التحقق");
    }
  } catch (err) {
    statusBox.className = "p-2.5 rounded-xl text-xs font-bold text-center border bg-amber-950/60 text-amber-300 border-amber-500/40 block";
    statusBox.innerText = "ℹ️ تعذر استرجاع الاسم تلقائياً. اكتب اسمك يدوياً واضغط متابعة الشحن.";
  } finally {
    verifyBtn.innerHTML = `<span>فحص</span> 🔍`;
    verifyBtn.disabled = false;
  }
}

function submitCustomPlayerOrder() {
  if (!activeCustomModalData) return;

  const userId = document.getElementById("modalInputPlayerId").value.trim();
  const userName = document.getElementById("modalInputPlayerName").value.trim();
  const zoneId = document.getElementById("modalInputZoneId") ? document.getElementById("modalInputZoneId").value.trim() : "";

  if (!userId) {
    showToast("⚠️ يرجى كتابة معرف الحساب (ID)", "error");
    return;
  }

  const item = {
    id: `custom_${Date.now()}`,
    serviceType: "custom_id",
    title: activeCustomModalData.name,
    package: activeCustomModalData.pkg,
    price: activeCustomModalData.price,
    playerId: userId,
    zoneId: zoneId || null,
    playerName: userName || "غير محدد",
    image: activeCustomModalData.iconUrl
  };

  closePlayerIdModal();
  cart.push(item);
  saveCartToStorage();
  updateCartUI();
  proceedToCheckout();
}

// ==============================================================================
// 4. السوشيال ميديا
// ==============================================================================

let currentSMMPlatform = null;
let currentSMMService = null;

function renderSMMModule() {
  const grid = document.getElementById("smmPlatformsGrid");
  if (!grid || typeof smmPlatformsData === "undefined") return;

  grid.innerHTML = smmPlatformsData.map((plat, idx) => `
    <button type="button" onclick="selectSMMPlatform(${idx})" 
            class="smm-platform-btn p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
              idx === 0 ? "sky-active-tab border-sky-400" : "sky-card border-slate-700 hover:border-slate-500"
            }">
      <span class="text-xl">${plat.icon}</span>
      <span class="text-[10px] font-bold text-white truncate max-w-full">${plat.name}</span>
    </button>
  `).join("");

  selectSMMPlatform(0);
}

function selectSMMPlatform(index) {
  if (typeof smmPlatformsData === "undefined") return;
  currentSMMPlatform = smmPlatformsData[index];

  document.querySelectorAll(".smm-platform-btn").forEach((btn, idx) => {
    if (idx === index) {
      btn.className = "smm-platform-btn p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 sky-active-tab border-sky-400";
    } else {
      btn.className = "smm-platform-btn p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 sky-card border-slate-700 hover:border-slate-500";
    }
  });

  document.getElementById("selectedPlatformIconContainer").innerHTML = `<span class="text-xl">${currentSMMPlatform.icon}</span>`;
  document.getElementById("selectedPlatformTitle").innerText = currentSMMPlatform.name;

  const catSelect = document.getElementById("smmCategorySelect");
  catSelect.innerHTML = currentSMMPlatform.categories.map((c, i) => `
    <option value="${i}">${c.name}</option>
  `).join("");

  onSMMCategoryChange();
}

function onSMMCategoryChange() {
  const catIdx = parseInt(document.getElementById("smmCategorySelect").value) || 0;
  const category = currentSMMPlatform.categories[catIdx];
  const servSelect = document.getElementById("smmServiceSelect");

  servSelect.innerHTML = category.services.map((s, i) => `
    <option value="${i}">${s.name} - ($${s.rateUSD}/1K)</option>
  `).join("");

  onSMMServiceChange();
}

function onSMMServiceChange() {
  const catIdx = parseInt(document.getElementById("smmCategorySelect").value) || 0;
  const servIdx = parseInt(document.getElementById("smmServiceSelect").value) || 0;
  currentSMMService = currentSMMPlatform.categories[catIdx].services[servIdx];

  document.getElementById("selectedServiceBadgeId").innerText = `ID: #${currentSMMService.id}`;
  document.getElementById("smmLimitsNote").innerText = `(الحد الأدنى: ${currentSMMService.min} • الأقصى: ${currentSMMService.max.toLocaleString()})`;

  const metaBox = document.getElementById("smmServiceMeta");
  metaBox.innerHTML = `
    <span class="text-gray-300">السرعة: <b class="text-sky-300">${currentSMMService.speed}</b></span>
    <span class="text-gray-300">الضمان: <b class="text-emerald-400">${currentSMMService.guarantee}</b></span>
    <span class="text-gray-300">سعر الألف: <b class="text-amber-400 font-mono">${(currentSMMService.rateUSD * 62).toFixed(2)} ج.م</b></span>
  `;

  calculateSMMCost();
}

function calculateSMMCost() {
  if (!currentSMMService) return;
  const qty = parseInt(document.getElementById("smmQtyInput").value) || 0;
  const pricePerUnitEGP = (currentSMMService.rateUSD * 62) / 1000;
  const total = Math.max(0, qty * pricePerUnitEGP);
  document.getElementById("smmPriceEGP").innerText = `${total.toFixed(2)} ج.م`;
}

function getSMMOrderData() {
  if (!currentSMMService) return null;
  const link = document.getElementById("smmLinkInput").value.trim();
  const qty = parseInt(document.getElementById("smmQtyInput").value) || 0;

  if (!link || !link.startsWith("http")) {
    showToast("⚠️ يرجى إدخال رابط صحيح للحساب أو المنشور", "error");
    return null;
  }

  if (qty < currentSMMService.min || qty > currentSMMService.max) {
    showToast(`⚠️ الكمية يجب أن تكون بين ${currentSMMService.min} و ${currentSMMService.max}`, "error");
    return null;
  }

  const pricePerUnitEGP = (currentSMMService.rateUSD * 62) / 1000;
  const totalEGP = parseFloat((qty * pricePerUnitEGP).toFixed(2));

  return {
    id: `smm_${Date.now()}`,
    serviceType: "smm",
    title: `${currentSMMPlatform.name} - ${currentSMMService.name}`,
    package: `كمية: ${qty.toLocaleString()}`,
    price: totalEGP,
    link: link,
    smmId: currentSMMService.id,
    image: currentSMMPlatform.icon
  };
}

function addSMMToCart() {
  const item = getSMMOrderData();
  if (!item) return;
  cart.push(item);
  saveCartToStorage();
  updateCartUI();
  showToast("🛒 تمت إضافة خدمة السوشيال ميديا إلى السلة", "success");
}

function expressCheckoutSMM() {
  const item = getSMMOrderData();
  if (!item) return;
  cart = [item];
  saveCartToStorage();
  updateCartUI();
  proceedToCheckout();
}

// ==============================================================================
// 5. السلة والدفع
// ==============================================================================

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem("migo_cart");
    cart = saved ? JSON.parse(saved) : [];
  } catch (e) { cart = []; }
  updateCartUI();
}

function saveCartToStorage() {
  localStorage.setItem("migo_cart", JSON.stringify(cart));
}

function updateCartUI() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.innerText = cart.length;

  const container = document.getElementById("cartItemsContainer");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-400">
        <div class="text-4xl mb-2">🛒</div>
        <p class="text-xs">سلة المشتريات فارغة حالياً</p>
      </div>
    `;
    updateCartTotals(0);
    return;
  }

  container.innerHTML = cart.map((item, idx) => `
    <div class="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
          ${item.image && item.image.startsWith("http") ? `<img src="${item.image}" onerror="this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=150&auto=format&fit=crop';" class="w-full h-full object-cover">` : item.image || "⚡"}
        </div>
        <div class="text-right">
          <div class="font-extrabold text-white truncate max-w-[170px]">${item.title}</div>
          <div class="text-[10px] text-gray-400">${item.package}</div>
          ${item.playerId ? `<div class="text-[9px] text-sky-400 font-mono">ID: ${item.playerId}</div>` : ""}
          ${item.link ? `<div class="text-[9px] text-sky-400 font-mono truncate max-w-[150px]">${item.link}</div>` : ""}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-amber-400 font-mono font-bold">${item.price} ج.م</span>
        <button type="button" onclick="removeFromCart(${idx})" class="text-red-400 hover:text-red-300 font-bold px-1.5 py-0.5 rounded cursor-pointer">✕</button>
      </div>
    </div>
  `).join("");

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  updateCartTotals(subtotal);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCartToStorage();
  updateCartUI();
}

function updateCartTotals(subtotal) {
  document.getElementById("cartSubtotal").innerText = `${subtotal.toFixed(2)} ج.م`;

  let discount = 0;
  if (appliedCoupon) {
    discount = (subtotal * appliedCoupon.percent) / 100;
  }

  const finalTotal = Math.max(0, subtotal - discount);

  const discountRow = document.getElementById("cartDiscountRow");
  if (discount > 0) {
    discountRow.classList.remove("hidden");
    document.getElementById("cartDiscountAmount").innerText = `-${discount.toFixed(2)} ج.م (${appliedCoupon.percent}%)`;
  } else {
    discountRow.classList.add("hidden");
  }

  document.getElementById("cartTotal").innerText = `${finalTotal.toFixed(2)} ج.م`;
}

function applyCartCoupon() {
  const code = document.getElementById("cartCouponInput").value.trim().toUpperCase();
  const status = document.getElementById("cartCouponStatus");
  status.classList.remove("hidden");

  const validCoupons = {
    "SIAFFC15": 15,
    "SIAF15": 15,
    "SIAFGAMING15": 15,
    "MIGO15": 15,
    "WELCOME10": 10
  };

  if (validCoupons[code]) {
    appliedCoupon = { code: code, percent: validCoupons[code] };
    status.className = "text-[10px] font-bold text-emerald-400 block";
    status.innerText = `✓ تم تطبيق كود الخصم بنجاح (${validCoupons[code]}%)`;
    showToast(`✓ تم تفعيل خصم ${validCoupons[code]}%`, "success");
  } else {
    appliedCoupon = null;
    status.className = "text-[10px] font-bold text-red-400 block";
    status.innerText = "✕ كود الخصم غير صحيح أو منتهي الصلاحية";
  }

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  updateCartTotals(subtotal);
}

function openCartModal() {
  updateCartUI();
  const modal = document.getElementById("cartModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeCartModal() {
  const modal = document.getElementById("cartModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function proceedToCheckout() {
  if (cart.length === 0) {
    showToast("⚠️ سلة المشتريات فارغة", "error");
    return;
  }

  closeCartModal();

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  let discount = 0;
  if (appliedCoupon) {
    discount = (subtotal * appliedCoupon.percent) / 100;
  }
  const finalTotal = Math.max(0, subtotal - discount);

  document.getElementById("checkoutTotalText").innerText = `${finalTotal.toFixed(2)} ج.م`;

  const modal = document.getElementById("checkoutModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function selectPaymentMethod(key, title, btnElement) {
  currentSelectedPaymentMethod = { key, title };

  document.querySelectorAll(".pay-method-btn").forEach(btn => {
    btn.classList.remove("sky-active-tab");
  });
  if (btnElement) btnElement.classList.add("sky-active-tab");

  const detailsBox = document.getElementById("checkoutDetailsBox");
  const payTitle = document.getElementById("checkoutPayTitle");
  const payContent = document.getElementById("checkoutPayContent");
  const confirmBtn = document.getElementById("confirmPaymentBtn");

  detailsBox.classList.remove("hidden");
  confirmBtn.classList.remove("hidden");
  payTitle.innerText = title;

  if (typeof PAYMENT_DETAILS !== "undefined" && PAYMENT_DETAILS[key]) {
    payContent.innerHTML = PAYMENT_DETAILS[key];
  } else {
    payContent.innerHTML = `<p>سيتم تزويدك بتفاصيل التحويل الفوري مباشرة عبر واتساب.</p>`;
  }
}

function copyPaymentInfo(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(msg || "✓ تم النسخ بنجاح", "success");
  }).catch(() => {
    showToast("⚠️ يرجى نسخ الرقم يدوياً", "error");
  });
}

function finalizeOrderWhatsApp() {
  if (!currentSelectedPaymentMethod) {
    showToast("⚠️ يرجى اختيار وسيلة الدفع أولاً", "error");
    return;
  }

  const senderAccount = document.getElementById("senderAccountInput").value.trim();
  if (!senderAccount) {
    showToast("⚠️ يرجى كتابة رقم المحفظة أو الحساب الذي حوّلت منه", "error");
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  let discount = 0;
  if (appliedCoupon) {
    discount = (subtotal * appliedCoupon.percent) / 100;
  }
  const finalTotal = Math.max(0, subtotal - discount);

  let message = `🛒 *طلب جديد من متجر Migo AI Solution*\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  cart.forEach((item, idx) => {
    message += `*${idx + 1}. ${item.title}*\n`;
    message += `▫️ الباقة: ${item.package}\n`;
    if (item.playerId) message += `▫️ الـ ID: \`${item.playerId}\`\n`;
    if (item.zoneId) message += `▫️ Zone ID: \`${item.zoneId}\`\n`;
    if (item.playerName) message += `▫️ اسم اللاعب: ${item.playerName}\n`;
    if (item.email) message += `▫️ الإيميل: ${item.email}\n`;
    if (item.link) message += `▫️ الرابط: ${item.link}\n`;
    message += `▫️ السعر: ${item.price} ج.م\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━\n`;
  if (appliedCoupon) {
    message += `🎟️ كود الخصم: ${appliedCoupon.code} (${appliedCoupon.percent}%)\n`;
  }
  message += `💰 *الإجمالي المطلوب:* ${finalTotal.toFixed(2)} ج.م\n`;
  message += `💳 *وسيلة الدفع:* ${currentSelectedPaymentMethod.title}\n`;
  message += `📱 *الحساب المُحوّل منه:* \`${senderAccount}\`\n\n`;
  message += `⚡ بانتظار تأكيد الاستلام وتنفيذ الطلب فوراً.`;

  const waUrl = `https://wa.me/201060934020?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");

  cart = [];
  saveCartToStorage();
  updateCartUI();
  closeCheckoutModal();
  showToast("✓ تم إرسال الطلب بنجاح! جارٍ فتح محادثة الدعم عبر واتساب", "success");
}

// ==============================================================================
// 6. الأدوات المساعدة والإشعارات
// ==============================================================================

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClass = type === "success" ? "bg-emerald-600 border-emerald-400" : type === "error" ? "bg-rose-600 border-rose-400" : "bg-sky-600 border-sky-400";

  toast.className = `${bgClass} text-white text-xs font-bold px-4 py-2.5 rounded-2xl border shadow-2xl transition transform duration-300 pointer-events-auto flex items-center gap-2`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function handleLiveSearch(query) {
  const dropdown = document.getElementById("searchResultsDropdown");
  if (!query || query.trim().length < 2) {
    dropdown.classList.add("hidden");
    return;
  }

  const q = query.trim().toLowerCase();
  let results = [];

  if (typeof allGames !== "undefined") {
    allGames.forEach(g => {
      if (g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q)) {
        results.push({ name: g.name, action: () => openGameCinematicModal(g.id), icon: "🎮", type: "لعبة" });
      }
    });
  }

  if (typeof liveAppsData !== "undefined") {
    liveAppsData.forEach(app => {
      if (app.name.toLowerCase().includes(q)) {
        results.push({ name: app.name, action: () => location.href = "#sec-live", icon: "🔴", type: "لايف" });
      }
    });
  }

  if (typeof vccCardsData !== "undefined") {
    vccCardsData.forEach(c => {
      if (c.name.toLowerCase().includes(q) || "فيزا vcc بطاقة".includes(q)) {
        results.push({ name: c.name, action: () => location.href = "#sec-vcc", icon: "💳", type: "بطاقة" });
      }
    });
  }

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="p-3 text-xs text-gray-400 text-center">لا توجد نتائج مطابقة</div>`;
  } else {
    dropdown.innerHTML = results.slice(0, 6).map((res, i) => `
      <div onclick="executeSearchResult(${i})" class="p-2.5 rounded-xl hover:bg-slate-800 transition cursor-pointer flex items-center justify-between text-xs border-b border-slate-800 last:border-0">
        <div class="flex items-center gap-2">
          <span>${res.icon}</span>
          <span class="font-bold text-white">${res.name}</span>
        </div>
        <span class="text-[10px] text-sky-400">${res.type}</span>
      </div>
    `).join("");
    window._lastSearchResults = results;
  }

  dropdown.classList.remove("hidden");
}

function executeSearchResult(index) {
  if (window._lastSearchResults && window._lastSearchResults[index]) {
    window._lastSearchResults[index].action();
    document.getElementById("searchResultsDropdown").classList.add("hidden");
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebarContainer");
  sidebar.classList.toggle("hidden");
}

function initAutoSlider() {
  const track = document.getElementById("sliderTrack");
  if (!track) return;
  slideInterval = setInterval(() => {
    currentSlide = (currentSlide + 1) % 3;
    goToSlide(currentSlide);
  }, 5000);
}

function goToSlide(index) {
  currentSlide = index;
  const track = document.getElementById("sliderTrack");
  if (!track) return;
  track.style.transform = `translateX(${currentSlide * 100}%)`;

  const dots = document.querySelectorAll(".dot");
  dots.forEach((dot, idx) => {
    if (idx === currentSlide) dot.classList.add("active");
    else dot.classList.remove("active");
  });
}

function startPromoCountdown() {
  const countdownEl = document.getElementById("promoCountdown");
  if (!countdownEl) return;
  let seconds = 20539;
  setInterval(() => {
    seconds--;
    if (seconds <= 0) seconds = 86400;
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    countdownEl.innerText = `${h}:${m}:${s}`;
  }, 1000);
}

function initSocialProofSystem() {
  const popup = document.getElementById("socialProofPopup");
  if (!popup) return;

  const proofs = [
    { user: "أحمد م. (القاهرة)", action: "شحن 660 UC ببجي موبايل", time: "منذ دقيقتين", icon: "🎮" },
    { user: "محمود س. (الجيزة)", action: "شحن 1,400 كوينز تيك توك", time: "منذ 4 دقائق", icon: "🎵" },
    { user: "كريم ف. (الإسكندرية)", action: "تفعيل فيزا VCC دولية 50$", time: "منذ 7 دقائق", icon: "💳" },
    { user: "يوسف ع. (طنطا)", action: "شحن 1080 جوهرة فري فاير", time: "منذ 10 دقائق", icon: "🔥" }
  ];

  let proofIndex = 0;
  setInterval(() => {
    const item = proofs[proofIndex];
    document.getElementById("proofUser").innerText = item.user;
    document.getElementById("proofAction").innerText = item.action;
    document.getElementById("proofTime").innerText = item.time;
    document.getElementById("proofIcon").innerText = item.icon;

    popup.classList.remove("translate-y-24", "opacity-0");
    setTimeout(() => {
      popup.classList.add("translate-y-24", "opacity-0");
    }, 4500);

    proofIndex = (proofIndex + 1) % proofs.length;
  }, 12000);
}

function renderReviews() {
  const container = document.getElementById("reviewsContainer");
  if (!container) return;

  const reviews = [
    { name: "طارق الشناوي", text: "شحنت ببجي موبايل والشدات وصلت في ثواني بالـ ID.. تجربة ممتازة", stars: "★★★★★" },
    { name: "سارة إبراهيم", text: "استخدمت الفيزا الافتراضية ودفع بها إعلان فيسبوك واشتغلت فوراً بدون أي مشكلة.", stars: "★★★★★" },
    { name: "عمر خالد", text: "أسرع شحن كوينز تيك توك في مصر، وخدمة العملاء على الواتساب قمة في الذوق.", stars: "★★★★★" },
    { name: "مروان علاء", text: "سيرفرات السوشيال ميديا حقيقية وبدون أي نقص.. شكراً Migo AI", stars: "★★★★★" }
  ];

  container.innerHTML = reviews.map(r => `
    <div class="sky-card border p-3 rounded-2xl">
      <div class="text-amber-400 font-mono text-xs mb-1">${r.stars}</div>
      <p class="text-gray-300 text-[11px] mb-2">"${r.text}"</p>
      <span class="text-white font-extrabold text-[10px] block text-left">― ${r.name}</span>
    </div>
  `).join("");
}

function initAuth() {
  try {
    const user = localStorage.getItem("migo_user");
    if (user) {
      currentUser = JSON.parse(user);
      document.getElementById("navLoginBtn").classList.add("hidden");
      document.getElementById("navUserBadge").classList.remove("hidden");
      document.getElementById("navUserBadge").classList.add("flex");
      document.getElementById("navUserName").innerText = currentUser.name;
    }
  } catch (e) {}
}

function openAuthModal(tab) {
  switchAuthTab(tab);
  const modal = document.getElementById("authModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const regForm = document.getElementById("registerForm");
  const tabLogin = document.getElementById("tabLoginBtn");
  const tabReg = document.getElementById("tabRegisterBtn");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    regForm.classList.add("hidden");
    tabLogin.className = "py-1.5 text-xs font-bold rounded-lg transition sky-btn cursor-pointer";
    tabReg.className = "py-1.5 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer";
  } else {
    loginForm.classList.add("hidden");
    regForm.classList.remove("hidden");
    tabLogin.className = "py-1.5 text-xs font-bold rounded-lg transition text-gray-400 cursor-pointer";
    tabReg.className = "py-1.5 text-xs font-bold rounded-lg transition sky-btn cursor-pointer";
  }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  currentUser = { name: email.split("@")[0], email: email };
  localStorage.setItem("migo_user", JSON.stringify(currentUser));
  initAuth();
  closeAuthModal();
  showToast(`✓ أهلاً بك مجدداً يا ${currentUser.name}`, "success");
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  currentUser = { name, email };
  localStorage.setItem("migo_user", JSON.stringify(currentUser));
  initAuth();
  closeAuthModal();
  showToast(`✓ تم إنشاء حسابك بنجاح! أهلاً بك يا ${name}`, "success");
}

function handleLogout() {
  localStorage.removeItem("migo_user");
  currentUser = null;
  document.getElementById("navLoginBtn").classList.remove("hidden");
  document.getElementById("navUserBadge").classList.add("hidden");
  document.getElementById("navUserBadge").classList.remove("flex");
  showToast("تم تسجيل الخروج بنجاح", "info");
}
