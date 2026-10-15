// Default Firebase Config for WaitLink Cloud Sync
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "waitlink-app-8821",
  appId: "1:397413980014:web:6a2265cca9a4b2635e937f",
  storageBucket: "waitlink-app-8821.firebasestorage.app",
  apiKey: "AIzaSyCXKhwN-ah8GX8knAipTF8QcPD5iTtODDE",
  authDomain: "waitlink-app-8821.firebaseapp.com",
  messagingSenderId: "397413980014"
};

const SUPERADMIN_EMAIL = "senthil930@gmail.com";

// Local Secrets Configuration (Loaded from config.secrets.js or window.WAITLINK_SECRETS)
const SECRETS = (typeof window !== "undefined" && window.WAITLINK_SECRETS) ? window.WAITLINK_SECRETS : {};

// Centralized Twilio SMS Gateway Sender Number
const DEFAULT_TWILIO_FROM = SECRETS.TWILIO_FROM_PHONE || "+18039027464";
const DEFAULT_TWILIO_FROM_DISPLAY = "+1 (803) 902-7464";
const DEFAULT_SERVE_NOW_SMS = "Hi {name}! Your turn at {shop} is ready now. Please proceed to the front desk. View your ticket: {link}";

// Application State
const state = {
  activeView: "home", // "home" | "desk" | "owner" | "public" | "poster" | "superadmin"
  isDemoMode: false,
  user: null, // Logged in user object
  userRole: "Guest", // "SuperAdmin" | "ShopOwner" | "Guest"
  config: {
    shopName: "Main St Barbers",
    slug: "main-st-barbers",
    estBaseWaitMin: 20,
    enableServices: true,
    services: [
      { id: "srv_demo_1", name: "Men's Haircut", estDurationMin: 20, icon: "✂️", enabled: true },
      { id: "srv_demo_2", name: "Haircut & Beard Trim", estDurationMin: 35, icon: "💈", enabled: true },
      { id: "srv_demo_3", name: "Beard Trim & Lineup", estDurationMin: 15, icon: "🧔", enabled: true }
    ],
    firebaseConfig: DEFAULT_FIREBASE_CONFIG
  },
  queue: [], // Active waiting items
  history: [], // Called or cancelled items today
  registeredShops: [], // SuperAdmin multi-tenant directory
  deskHistoryPage: 1,
  ownerHistoryPage: 1,
  historyPageSize: 20,
  deskViewMode: localStorage.getItem("waitlink_desk_view_mode") || "grid",
  stageFocusedIndex: 0
};
window.state = state;

// Theme Mode Manager (Dark / Light)
let currentThemeMode = localStorage.getItem("waitlink_theme") || "dark";

function initTheme() {
  setThemeMode(currentThemeMode);
}

function setThemeMode(theme) {
  currentThemeMode = theme;
  localStorage.setItem("waitlink_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeToggleUI();
}

function toggleThemeMode() {
  const newTheme = currentThemeMode === "dark" ? "light" : "dark";
  setThemeMode(newTheme);
  showToast(newTheme === "light" ? "☀️ Switched to Light Mode" : "🌙 Switched to Dark Mode");
}

function updateThemeToggleUI() {
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) {
    btn.innerHTML = currentThemeMode === "dark" ? "🌙" : "☀️";
    btn.title = currentThemeMode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
  }
  const menuBtn = document.getElementById("menu-theme-label");
  if (menuBtn) {
    menuBtn.textContent = currentThemeMode === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
  const mobileDrawerThemeIcon = document.getElementById("mobile-drawer-theme-icon");
  const mobileDrawerThemeLabel = document.getElementById("mobile-drawer-theme-label");
  if (mobileDrawerThemeIcon) {
    mobileDrawerThemeIcon.textContent = currentThemeMode === "dark" ? "☀️" : "🌙";
  }
  if (mobileDrawerThemeLabel) {
    mobileDrawerThemeLabel.textContent = currentThemeMode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
  }
}

// Immediately apply saved theme mode
initTheme();

// Firestore Handle
let db = null;
let unsubscribeSnapshot = null;

// Timer Handle
let timerInterval = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  loadData();
  initFirestore();
  initAuth();
  renderAll();
  startTimerTicker();
  generateQRCode();

  // Auto-clear auth error banner when typing in email or password
  const authEmailInput = document.getElementById("auth-email");
  const authPasswordInput = document.getElementById("auth-password");
  if (authEmailInput) authEmailInput.addEventListener("input", clearAuthError);
  if (authPasswordInput) authPasswordInput.addEventListener("input", clearAuthError);

  window.addEventListener("beforeunload", () => {
    if (timerInterval) clearInterval(timerInterval);
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  });

  // Smart URL parameter routing logic
  const params = new URLSearchParams(window.location.search);
  const shopParam = params.get("shop") || params.get("s");
  const modeParam = params.get("mode") || params.get("view");

  if (shopParam) {
    state.config.slug = shopParam;
    state.isDemoMode = false;
    if (modeParam === "public") {
      const header = document.querySelector(".app-header");
      if (header) header.style.display = "none";
      switchView("public");
    } else {
      switchView("desk");
    }
  } else if (modeParam === "public") {
    const header = document.querySelector(".app-header");
    if (header) header.style.display = "none";
    switchView("public");
  } else {
    // Root URL visit without shop parameter -> Show Product Landing Overview!
    switchView("home");
  }
});

// Ensure Firebase App is initialized once and available globally
function ensureFirebaseInitialized() {
  if (!window.firebase) return false;
  if (!firebase.apps || !firebase.apps.length) {
    const fbConfig = (state.config && state.config.firebaseConfig) || DEFAULT_FIREBASE_CONFIG;
    if (fbConfig && fbConfig.apiKey) {
      try {
        firebase.initializeApp(fbConfig);
      } catch (e) {
        console.warn("Firebase initialization error:", e);
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

// Initialize Cloud Firestore Real-time Sync
function initFirestore() {
  if (!ensureFirebaseInitialized()) return;
  const fbConfig = state.config.firebaseConfig || DEFAULT_FIREBASE_CONFIG;
  try {
    db = firebase.firestore();
    const liveInd = document.getElementById("live-indicator");
    if (liveInd) liveInd.innerHTML = `<span class="pulse-dot"></span> Cloud Live Sync`;

    const statusLabel = document.getElementById("firestore-status-label");
    if (statusLabel) statusLabel.textContent = `Connected to Cloud Firestore (${fbConfig.projectId})`;
    subscribeFirestore();
  } catch (e) {
    console.warn("Firestore initialization error:", e);
  }
}

/* ==========================================================================
   FRONT DESK AUDIO CHIME SYNTHESIZER & REAL-TIME ALERTS
   ========================================================================== */

let audioCtx = null;
let previousQueueIds = null;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

// Global user interaction listener to satisfy browser autoplay security policy
if (typeof document !== "undefined") {
  document.addEventListener("click", () => { initAudioContext(); }, { passive: true });
  document.addEventListener("touchstart", () => { initAudioContext(); }, { passive: true });
}

function playFrontDeskChime() {
  if (state.soundEnabled === false) return;
  try {
    initAudioContext();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;

    // Tone 1: E5 (659.25 Hz) - Bell sound
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2: B5 (987.77 Hz) - Chime response
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.15);
    gain2.gain.setValueAtTime(0.45, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn("Audio chime playback notice:", e);
  }
}

function toggleSoundAlerts() {
  initAudioContext();
  state.soundEnabled = (state.soundEnabled === false) ? true : false;
  updateSoundToggleUI();

  if (state.soundEnabled !== false) {
    playFrontDeskChime();
    showToast("🔔 Front Desk Sound Alerts Enabled");
  } else {
    showToast("🔕 Front Desk Sound Alerts Muted");
  }

  try {
    localStorage.setItem("waitlink_sound_enabled", JSON.stringify(state.soundEnabled));
  } catch (e) {}
}

function updateSoundToggleUI() {
  const btn = document.getElementById("sound-toggle-btn");
  if (!btn) return;
  if (state.soundEnabled !== false) {
    btn.innerHTML = "🔔 Sound Alerts: ON";
    btn.style.color = "#10b981";
    btn.style.borderColor = "rgba(16, 185, 129, 0.3)";
    btn.style.background = "rgba(16, 185, 129, 0.1)";
  } else {
    btn.innerHTML = "🔕 Sound Alerts: OFF";
    btn.style.color = "var(--text-muted)";
    btn.style.borderColor = "var(--border-color)";
    btn.style.background = "transparent";
  }
}

let currentSubscribedSlug = "";

function subscribeFirestore(forceResubscribe = false) {
  if (!db || !state.config.slug) return;
  if (!forceResubscribe && currentSubscribedSlug === state.config.slug && unsubscribeSnapshot) {
    return;
  }

  if (unsubscribeSnapshot) unsubscribeSnapshot();
  currentSubscribedSlug = state.config.slug;

  const shopDoc = db.collection("shops").doc(state.config.slug);
  unsubscribeSnapshot = shopDoc.onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      let newCheckInDetected = false;

      if (Array.isArray(data.queue)) {
        const currentIds = new Set(data.queue.map(q => q.id));
        if (previousQueueIds !== null) {
          data.queue.forEach(item => {
            if (!previousQueueIds.has(item.id)) {
              newCheckInDetected = true;
            }
          });
        }
        previousQueueIds = currentIds;
        state.queue = data.queue;
      }

      if (Array.isArray(data.history)) state.history = data.history;
      if (data.shopName) state.config.shopName = data.shopName;
      if (data.name) state.config.shopName = data.name;
      if (data.address !== undefined) state.config.address = data.address;
      if (data.phone !== undefined) state.config.phone = data.phone;
      if (data.ownerEmail !== undefined) state.config.ownerEmail = data.ownerEmail;
      if (data.promoText !== undefined) state.config.promoText = data.promoText;
      if (data.promoStart !== undefined) state.config.promoStart = data.promoStart;
      if (data.promoEnd !== undefined) state.config.promoEnd = data.promoEnd;
      if (data.hours !== undefined) state.config.hours = data.hours;
      if (data.estBaseWaitMin !== undefined) state.config.estBaseWaitMin = data.estBaseWaitMin;
      if (data.enableServices !== undefined) state.config.enableServices = data.enableServices;
      if (Array.isArray(data.services)) state.config.services = data.services;
      if (data.logoUrl !== undefined) state.config.logoUrl = data.logoUrl;
      if (data.planTitle !== undefined) state.config.planTitle = data.planTitle;
      if (data.planPrice !== undefined) state.config.planPrice = data.planPrice;
      if (data.twilio) {
        state.config.twilio = { ...state.config.twilio, ...data.twilio };
        const fromDigits = (state.config.twilio.fromPhone || "").replace(/\D/g, "");
        if (!fromDigits || fromDigits.includes("9802531359") || fromDigits.includes("8774153678")) {
          state.config.twilio.fromPhone = DEFAULT_TWILIO_FROM;
        }
      }
      updateConfigUI();
      renderAll();

      if (newCheckInDetected && state.currentView === "desk") {
        playFrontDeskChime();
        showToast("🔔 New customer joined the queue!");
      }
    } else {
      // Push initial clean data to cloud on first load for new shop
      if (state.config.slug !== "main-st-barbers" && !state.isDemoMode) {
        state.queue = [];
        state.history = [];
      }
      saveData();
    }
  }, err => {
    console.error("Firestore real-time subscription error:", err);
  });
}

// Helper to track visited & created shops for quick switching
function trackMyShop(slug, shopName) {
  if (!slug || !shopName) return;
  if (!Array.isArray(state.myShops)) state.myShops = [];
  const existing = state.myShops.find(s => s.slug === slug);
  if (!existing) {
    state.myShops.push({ slug, shopName });
  } else {
    existing.shopName = shopName;
  }
  try {
    localStorage.setItem("waitlink_my_shops", JSON.stringify(state.myShops));
  } catch (e) {}
}

// Load Config from LocalStorage
function loadConfig() {
  const saved = localStorage.getItem("waitlink_config");
  if (saved) {
    try {
      state.config = { ...state.config, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Failed to parse saved config", e);
    }
  }

  // Ensure Twilio sender number is healthy & synchronized with +1 (803) 902-7464
  if (state.config.twilio) {
    const fromDigits = (state.config.twilio.fromPhone || "").replace(/\D/g, "");
    if (!fromDigits || fromDigits.includes("9802531359") || fromDigits.includes("8774153678")) {
      state.config.twilio.fromPhone = DEFAULT_TWILIO_FROM;
      try {
        localStorage.setItem("waitlink_config", JSON.stringify(state.config));
      } catch (e) {}
    }
  }

  if (state.config.enableServices === undefined) {
    state.config.enableServices = true;
  }
  if (!Array.isArray(state.config.services) || state.config.services.length === 0) {
    state.config.services = [
      { id: "srv_demo_1", name: "Men's Haircut", estDurationMin: 20, icon: "✂️", enabled: true },
      { id: "srv_demo_2", name: "Haircut & Beard Trim", estDurationMin: 35, icon: "💈", enabled: true },
      { id: "srv_demo_3", name: "Beard Trim & Lineup", estDurationMin: 15, icon: "🧔", enabled: true }
    ];
  }

  if (!state.config.firebaseConfig) {
    state.config.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
  }

  // URL parameter check for custom shop slug and Stripe payment callbacks
  const params = new URLSearchParams(window.location.search);
  const urlSlug = params.get("s") || params.get("shop");
  if (urlSlug) {
    state.config.slug = urlSlug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  }

  const paymentStatus = params.get("payment");
  const paidTier = params.get("tier");
  if (paymentStatus === "success") {
    let title = paidTier === "enterprise" ? "Enterprise Tier" : "Pro Business Tier";
    let price = paidTier === "enterprise" ? 49 : 15;
    state.config.planTitle = title;
    state.config.planPrice = price;
    saveConfig();
  }

  // Load tracked user shops
  const savedMyShops = localStorage.getItem("waitlink_my_shops");
  if (savedMyShops) {
    try { state.myShops = JSON.parse(savedMyShops); } catch (e) { state.myShops = []; }
  }
  if (!Array.isArray(state.myShops) || state.myShops.length === 0) {
    state.myShops = [
      { slug: "main-st-barbers", shopName: "Main St Barbers" }
    ];
  }

  trackMyShop(state.config.slug, state.config.shopName);

  // Ensure isDemoMode is false for any custom user shop
  if (state.config.slug && state.config.slug !== "main-st-barbers") {
    state.isDemoMode = false;
  }

  const savedSound = localStorage.getItem("waitlink_sound_enabled");
  if (savedSound !== null) {
    try { state.soundEnabled = JSON.parse(savedSound); } catch (e) {}
  }

  updateConfigUI();
  updateSoundToggleUI();
}

function saveConfig() {
  trackMyShop(state.config.slug, state.config.shopName);
  localStorage.setItem("waitlink_config", JSON.stringify(state.config));
  updateConfigUI();
  subscribeFirestore(); // Re-subscribe to new shop document
}

function getPublicUrl() {
  const host = window.location.origin;
  const baseUrl = (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("file://"))
    ? "https://waitlink.app"
    : host;
  return `${baseUrl}?s=${state.config.slug}&view=public`;
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatDatetimeLocalVal(val) {
  if (!val) return "";
  if (typeof val === "string") {
    val = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return "";
  }
}

function setElValue(id, val) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = val;
}

function updateConfigUI() {
  setElText("desk-shop-name", state.config.shopName);
  setElText("owner-shop-name", state.config.shopName);
  setElText("public-shop-name", state.config.shopName);
  setElText("poster-shop-name", state.config.shopName.toUpperCase());
  setElText("header-shop-name", state.config.shopName);
  setElText("menu-current-shop", state.config.shopName);
  setElText("mobile-drawer-shop-name", state.config.shopName);
  
  // Set Owner Settings inputs
  setElValue("owner-input-address", state.config.address || "");
  setElValue("owner-input-phone", state.config.phone || "");
  setElValue("owner-input-email", state.config.ownerEmail || (state.user ? state.user.email : ""));
  setElValue("owner-input-promo", state.config.promoText || "");
  setElValue("owner-input-promo-start", formatDatetimeLocalVal(state.config.promoStart));
  setElValue("owner-input-promo-end", formatDatetimeLocalVal(state.config.promoEnd));

  // Set Twilio Settings inputs
  const twilio = state.config.twilio || {};
  const twilioCheck = document.getElementById("twilio-enable-checkbox");
  if (twilioCheck) twilioCheck.checked = (twilio.enabled !== false);
  setElValue("twilio-account-sid", twilio.accountSid || SECRETS.TWILIO_ACCOUNT_SID || "");
  setElValue("twilio-auth-token", twilio.authToken || SECRETS.TWILIO_AUTH_TOKEN || "");
  
  let fromPhoneDisplay = twilio.fromPhone || DEFAULT_TWILIO_FROM_DISPLAY;
  const cleanFromDigits = fromPhoneDisplay.replace(/\D/g, "");
  if (!cleanFromDigits || cleanFromDigits.includes("9802531359") || cleanFromDigits.includes("8774153678")) {
    fromPhoneDisplay = DEFAULT_TWILIO_FROM_DISPLAY;
    if (state.config.twilio) {
      state.config.twilio.fromPhone = DEFAULT_TWILIO_FROM;
    }
  }
  setElValue("twilio-from-phone", fromPhoneDisplay);

  const serveNowTpl = (twilio && twilio.serveNowSmsTemplate) || DEFAULT_SERVE_NOW_SMS;
  setElValue("twilio-serve-now-template", serveNowTpl);
  updateServeNowTemplatePreview();

  const publicUrl = getPublicUrl();
  setElValue("share-url-input", publicUrl);
  setElText("poster-url-text", publicUrl.replace("https://", ""));

  // Custom Logo updates
  const logoUrl = state.config.logoUrl || "";
  const publicLogo = document.getElementById("public-shop-logo");
  const posterLogo = document.getElementById("poster-shop-logo");
  const logoInput = document.getElementById("owner-input-logourl");
  const previewBox = document.getElementById("logo-preview-box");
  const previewImg = document.getElementById("logo-preview-img");

  if (logoInput && !logoUrl.startsWith("data:")) logoInput.value = logoUrl;

  if (logoUrl) {
    if (publicLogo) { publicLogo.src = logoUrl; publicLogo.classList.remove("hidden"); }
    if (posterLogo) { posterLogo.src = logoUrl; posterLogo.classList.remove("hidden"); }
    if (previewBox && previewImg) {
      previewImg.src = logoUrl;
      previewBox.style.display = "flex";
    }
  } else {
    if (publicLogo) { publicLogo.src = ""; publicLogo.classList.add("hidden"); }
    if (posterLogo) { posterLogo.src = ""; posterLogo.classList.add("hidden"); }
    if (previewBox) { previewBox.style.display = "none"; }
  }

  // Settings inputs
  setElValue("setting-shop-name", state.config.shopName);
  setElValue("setting-slug", state.config.slug);
  setElValue("setting-base-wait", state.config.estBaseWaitMin);
  setElValue("setting-firebase-config", state.config.firebaseConfig ? JSON.stringify(state.config.firebaseConfig, null, 2) : "");

  // Owner Mode inputs
  setElValue("owner-input-shopname", state.config.shopName);
  setElValue("owner-input-slug", state.config.slug);
  setElValue("owner-input-baseline", state.config.estBaseWaitMin);
  setElText("owner-target-baseline", state.config.estBaseWaitMin + "m");
  
  const ownerJsonInput = document.getElementById("owner-firestore-json");
  if (ownerJsonInput) {
    ownerJsonInput.value = state.config.firebaseConfig ? JSON.stringify(state.config.firebaseConfig, null, 2) : "";
  }
  
  const statusLabel = document.getElementById("firestore-status-label");
  if (statusLabel) {
    if (state.config.firebaseConfig) {
      statusLabel.textContent = "Cloud Live Sync Connected (" + (state.config.firebaseConfig.projectId || "Active") + ")";
    } else {
      statusLabel.textContent = "Local Standalone Mode";
    }
  }
}

// Helper to get shop-specific local storage keys
function getStorageKeys() {
  const slug = state.config.slug || "main-st-barbers";
  return {
    queueKey: `waitlink_queue_${slug}`,
    historyKey: `waitlink_history_${slug}`
  };
}

// Load Queue & History Data
function loadData() {
  const { queueKey, historyKey } = getStorageKeys();
  const savedQueue = localStorage.getItem(queueKey);
  const savedHistory = localStorage.getItem(historyKey);

  const isMainStDemo = (state.config.slug === "main-st-barbers") || state.isDemoMode;

  if (savedQueue) {
    try { state.queue = JSON.parse(savedQueue); } catch (e) { state.queue = []; }
  } else if (isMainStDemo) {
    // Initial Demo Seed for Main St Barbers Sandbox ONLY
    const now = Date.now();
    state.queue = [
      { id: "q1", customerName: "senthil", checkedInAt: now - 2.68 * 60 * 1000 },
      { id: "q2", customerName: "ragu", checkedInAt: now - 0.63 * 60 * 1000 },
      { id: "q3", customerName: "deeena", checkedInAt: now - 0.08 * 60 * 1000 }
    ];
  } else {
    // Clean empty queue for real custom shop
    state.queue = [];
  }

  if (savedHistory) {
    try { state.history = JSON.parse(savedHistory); } catch (e) { state.history = []; }
  } else if (isMainStDemo) {
    // Initial Demo Seed History for Main St Barbers Sandbox ONLY
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    state.history = [
      { id: "h1", customerName: "James P.", status: "called", checkedInAt: now - 45 * 60 * 1000, calledAt: now - 25 * 60 * 1000, waitDurationMin: 20 },
      { id: "h2", customerName: "Chris K.", status: "called", checkedInAt: now - 35 * 60 * 1000, calledAt: now - 17 * 60 * 1000, waitDurationMin: 18 },
      { id: "h7", customerName: "Alex W.", status: "cancelled", cancelledBy: "desk", checkedInAt: now - 50 * 60 * 1000, cancelledAt: now - 40 * 60 * 1000, waitDurationMin: 0 },
      { id: "h3", customerName: "Sarah M.", status: "called", checkedInAt: now - oneDay - 120 * 60 * 1000, calledAt: now - oneDay - 105 * 60 * 1000, waitDurationMin: 15 },
      { id: "h4", customerName: "David L.", status: "called", checkedInAt: now - oneDay - 180 * 60 * 1000, calledAt: now - oneDay - 160 * 60 * 1000, waitDurationMin: 20 },
      { id: "h5", customerName: "Elena R.", status: "cancelled", cancelledBy: "customer", checkedInAt: now - oneDay - 240 * 60 * 1000, cancelledAt: now - oneDay - 235 * 60 * 1000, waitDurationMin: 0 },
      { id: "h6", customerName: "Michael B.", status: "called", checkedInAt: now - 2 * oneDay - 300 * 60 * 1000, calledAt: now - 2 * oneDay - 280 * 60 * 1000, waitDurationMin: 20 }
    ];
  } else {
    // Clean empty history for real custom shop
    state.history = [];
  }
}

function saveData() {
  const { queueKey, historyKey } = getStorageKeys();
  localStorage.setItem(queueKey, JSON.stringify(state.queue));
  localStorage.setItem(historyKey, JSON.stringify(state.history));

  if (db && state.config.slug) {
    db.collection("shops").doc(state.config.slug).set({
      shopName: state.config.shopName,
      slug: state.config.slug,
      address: state.config.address || "",
      phone: state.config.phone || "",
      ownerEmail: state.config.ownerEmail || (state.user ? state.user.email : ""),
      promoText: state.config.promoText || "",
      promoStart: state.config.promoStart || "",
      promoEnd: state.config.promoEnd || "",
      hours: state.config.hours || "9:00 AM - 7:00 PM",
      estBaseWaitMin: state.config.estBaseWaitMin || 20,
      enableServices: !!state.config.enableServices,
      services: state.config.services || [],
      logoUrl: state.config.logoUrl || "",
      queue: state.queue,
      history: state.history,
      updatedAt: Date.now()
    }, { merge: true }).catch(err => {
      console.warn("Firestore save warning:", err);
      showToast("⚠️ Cloud Sync Warning: Saved locally. Sync pending.");
    });
  }
}

// Check-In Handler
function handleCheckIn(event) {
  event.preventDefault();
  const input = document.getElementById("customer-name-input");
  const submitBtn = event.target ? event.target.querySelector("button[type='submit']") : null;
  const name = input ? input.value.trim() : "";
  if (!name) return;

  if (submitBtn) submitBtn.disabled = true;

  const serviceSelect = document.getElementById("desk-service-select");
  let selectedServiceObj = null;
  if (serviceSelect && serviceSelect.value) {
    const found = (state.config.services || []).find(s => s.id === serviceSelect.value);
    if (found) selectedServiceObj = found;
  }

  const phoneInput = document.getElementById("desk-customer-phone");
  const phone = phoneInput ? phoneInput.value.trim() : "";

  const isDeskCheckIn = (state.currentView === "desk");
  const newItem = {
    id: "q_" + Date.now(),
    customerName: name,
    phone: phone || null,
    checkedInAt: Date.now(),
    checkedInVia: isDeskCheckIn ? "Front Desk Terminal" : "Customer QR Code Live Card",
    selectedServiceId: selectedServiceObj ? selectedServiceObj.id : null,
    selectedServiceName: selectedServiceObj ? selectedServiceObj.name : null,
    selectedServiceDurationMin: selectedServiceObj ? selectedServiceObj.estDurationMin : null,
    activities: [
      {
        action: "check_in",
        title: "Customer Checked In",
        detail: isDeskCheckIn ? `Added manually by Front Desk${phone ? ' (Cell: ' + phone + ')' : ''}` : `Self check-in via QR Code Live Card${phone ? ' (Cell: ' + phone + ')' : ''}`,
        timestamp: Date.now(),
        icon: "📝"
      }
    ]
  };

  if (selectedServiceObj) {
    newItem.activities.push({
      action: "select_service",
      title: "Service Selected",
      detail: `${selectedServiceObj.icon || '✂️'} ${selectedServiceObj.name} (${selectedServiceObj.estDurationMin || 20}m)`,
      timestamp: Date.now(),
      icon: "✂️"
    });
  }

  addQueueItemAtomic(newItem);
  if (input) input.value = "";
  if (phoneInput) phoneInput.value = "";
  if (serviceSelect) serviceSelect.value = "";
  renderAll();
  showToast(`Checked in ${name}${selectedServiceObj ? ' (' + selectedServiceObj.name + ')' : ''}`);

  if (submitBtn) setTimeout(() => { submitBtn.disabled = false; }, 800);
}

// ==========================================
// TWILIO SMS INTEGRATION & NOTIFICATION ENGINE
// ==========================================

function formatPhoneE164(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return "+1" + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return "+" + cleaned;
  } else if (cleaned.length > 0) {
    return "+" + cleaned;
  }
  return "";
}

function onTwilioToggleChange() {
  const check = document.getElementById("twilio-enable-checkbox");
  if (!check) return;
  state.config.twilio = {
    ...(state.config.twilio || {}),
    enabled: check.checked
  };
  saveConfig();
  saveData();
  if (check.checked) {
    showToast("📲 Twilio SMS Customer Notifications Enabled");
  } else {
    showToast("🔕 Twilio SMS Notifications Muted — No text messages will be sent.");
  }
}

function formatServeNowSms(template, customerName, shopName, serviceName, ticketUrl) {
  const defaultTpl = DEFAULT_SERVE_NOW_SMS;
  const tpl = (template && template.trim()) ? template.trim() : defaultTpl;
  let formatted = tpl
    .replace(/\{name\}|\{customerName\}/gi, customerName || "Customer")
    .replace(/\{shop\}|\{shopName\}/gi, shopName || "our shop")
    .replace(/\{service\}|\{serviceName\}/gi, serviceName || "");

  const effectiveLink = ticketUrl || `${getPublicUrl()}&ticket=sample-101`;
  const hasLinkTag = /\{link\}|\{ticketUrl\}|\{url\}/i.test(formatted);
  if (hasLinkTag) {
    formatted = formatted.replace(/\{link\}|\{ticketUrl\}|\{url\}/gi, effectiveLink);
  } else if (ticketUrl) {
    formatted += ` View your ticket: ${ticketUrl}`;
  }
  return formatted.trim();
}

function updateServeNowTemplatePreview() {
  const input = document.getElementById("twilio-serve-now-template");
  const preview = document.getElementById("twilio-template-live-preview");
  if (!preview) return;
  const val = input ? input.value : "";
  const shopName = (state.config && state.config.shopName) || "Main St Barbers";
  const sampleTicketUrl = `${getPublicUrl()}&ticket=sample-101`;
  preview.textContent = formatServeNowSms(val, "Alex", shopName, "Haircut", sampleTicketUrl);
}

function insertServeNowTemplateTag(tag) {
  const input = document.getElementById("twilio-serve-now-template");
  if (!input) return;
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const before = input.value.substring(0, start);
  const after = input.value.substring(end);
  input.value = before + tag + after;
  input.focus();
  input.setSelectionRange(start + tag.length, start + tag.length);
  updateServeNowTemplatePreview();
}

function resetServeNowTemplateDefault() {
  const input = document.getElementById("twilio-serve-now-template");
  if (input) {
    input.value = DEFAULT_SERVE_NOW_SMS;
    updateServeNowTemplatePreview();
    showToast("Template reset to default");
  }
}

async function sendTwilioSms(toPhone, messageBody, metadata = {}) {
  const e164Phone = formatPhoneE164(toPhone);
  if (!e164Phone) {
    console.warn("Invalid phone format for Twilio SMS:", toPhone);
    return { success: false, error: "Invalid phone number format" };
  }

  const twilioConfig = (state.config && state.config.twilio) || {};
  if (twilioConfig.enabled === false && !metadata.isTest) {
    return { success: false, error: "Twilio SMS is disabled in Shop Settings" };
  }

  const sidInput = document.getElementById("twilio-account-sid");
  const tokenInput = document.getElementById("twilio-auth-token");
  const fromInput = document.getElementById("twilio-from-phone");

  const sid = (sidInput && sidInput.value.trim()) || twilioConfig.accountSid || SECRETS.TWILIO_ACCOUNT_SID || "";
  const token = (tokenInput && tokenInput.value.trim()) || twilioConfig.authToken || SECRETS.TWILIO_AUTH_TOKEN || "";
  let rawFrom = (fromInput && fromInput.value.trim()) || twilioConfig.fromPhone || DEFAULT_TWILIO_FROM;
  if (rawFrom.replace(/\D/g, "").includes("9802531359") || rawFrom.replace(/\D/g, "").includes("8774153678")) {
    rawFrom = DEFAULT_TWILIO_FROM;
  }
  const e164From = formatPhoneE164(rawFrom) || DEFAULT_TWILIO_FROM;

  // 1. Write to Firestore 'messages' collection (Trigger for Firebase Twilio Extension / Cloud Function)
  if (typeof db !== "undefined" && db) {
    try {
      db.collection("messages").add({
        to: e164Phone,
        from: e164From,
        body: messageBody,
        shopSlug: state.config.slug || "shop",
        shopName: state.config.shopName || "WaitLink",
        createdAt: Date.now(),
        status: "pending",
        ...metadata
      });
    } catch (e) {
      console.warn("Firestore message write error:", e);
    }
  }

  // 2. Direct Twilio HTTPS REST API Call (Instant Fallback)
  try {
    const auth = "Basic " + btoa(`${sid}:${token}`);
    const postData = `To=${encodeURIComponent(e164Phone)}&From=${encodeURIComponent(e164From)}&Body=${encodeURIComponent(messageBody)}`;

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: postData
    });

    const data = await response.json();
    if (response.ok && data.sid) {
      console.log("Twilio SMS dispatched successfully! SID:", data.sid);
      return { success: true, sid: data.sid, data };
    } else {
      console.warn("Twilio REST API Error:", data);
      return { success: false, error: data.message || `Twilio Error Code ${data.code}`, code: data.code, data };
    }
  } catch (err) {
    console.error("Twilio fetch exception:", err);
    return { success: false, error: err.message };
  }
}

async function sendTestSmsUI() {
  const ownerPhoneInput = document.getElementById("owner-input-phone");
  const targetPhone = (ownerPhoneInput && ownerPhoneInput.value.trim()) || state.config.phone || "9802531359";
  
  if (!targetPhone || targetPhone.length < 7) {
    alert("⚠️ Please enter your Business Phone Number under Shop Settings above before sending a test SMS.");
    if (ownerPhoneInput) ownerPhoneInput.focus();
    return;
  }

  const shopName = state.config.shopName || "WaitLink Shop";
  const customTpl = (state.config.twilio && state.config.twilio.serveNowSmsTemplate) || DEFAULT_SERVE_NOW_SMS;
  const sampleTicketUrl = `${getPublicUrl()}&ticket=test-sample`;
  const testMsg = `[WaitLink Test] ` + formatServeNowSms(customTpl, "Alex", shopName, "Haircut", sampleTicketUrl);
  showToast(`⏳ Dispatching test SMS to ${targetPhone}...`);

  const result = await sendTwilioSms(targetPhone, testMsg, { isTest: true });
  if (result.success) {
    showToast(`✅ Test SMS sent successfully to ${targetPhone}! SID: ${result.sid}`);
    alert(`🎉 Success!\n\nTest SMS dispatched via Twilio to your Business Phone (${targetPhone}).\nTwilio Message SID: ${result.sid}`);
  } else {
    const errMsg = result.error || "Unknown error";
    showToast(`⚠️ Twilio Notice: ${errMsg}`);
    
    if (result.code === 20003 || errMsg.includes("Primary compliance profile") || errMsg.includes("KYC")) {
      alert(`⚠️ Twilio Compliance Action Required:\n\nTwilio Error Notice: "${errMsg}"\n\nHow to complete (2 Minutes):\n1. Log into https://console.twilio.com\n2. Click "Trust Hub" (or "Regulatory Compliance -> Trust Hub" in the left sidebar menu).\n3. Click "Customer Profiles" -> Fill in your name/business name & address -> Submit.\n\nOnce approved by Twilio, your number +1 (803) 902-7464 will start delivering live SMS text messages to all your customers!`);
    } else if (result.code === 572006 || errMsg.includes("predefined SMS templates") || errMsg.includes("Trial accounts")) {
      alert(`⚠️ Twilio Trial Account Restriction Notice:\n\nTwilio Error 572006: "${errMsg}"\n\nWhy this happens:\nUn-upgraded Twilio Trial accounts restrict API-driven custom text bodies.\n\nHow to solve:\nLog into https://console.twilio.com and click "Upgrade" (add a balance deposit). Once upgraded, Twilio instantly unlocks custom SMS text delivery from +1 (803) 902-7464 to all your walk-in customers!`);
    } else {
      alert(`⚠️ Twilio Integration Status:\n\nMessage dispatch result: "${errMsg}"\n\nPlease ensure your Twilio From Phone Number is configured.`);
    }
  }
}

// Call Customer (End Wait Timer)
function callCustomer(id) {
  const index = state.queue.findIndex(item => item.id === id);
  if (index === -1) return;

  const item = state.queue[index];
  const now = Date.now();
  const durationMin = Math.max(1, Math.round((now - item.checkedInAt) / (1000 * 60)));

  const historyItem = {
    ...item,
    status: "called",
    calledAt: now,
    waitDurationMin: durationMin
  };

  logCustomerActivity(historyItem, "called", "Called Customer", `Called to front desk for service (Waited ${durationMin}m)`, "📞");

  // Trigger Twilio SMS notification if customer provided cell phone number
  if (item.phone) {
    const shopName = state.config.shopName || "our shop";
    const baseUrl = getPublicUrl();
    const ticketUrl = `${baseUrl}&ticket=${item.id}`;
    const customTpl = (state.config.twilio && state.config.twilio.serveNowSmsTemplate) || DEFAULT_SERVE_NOW_SMS;
    const smsMsg = formatServeNowSms(customTpl, item.customerName, shopName, item.selectedServiceName, ticketUrl);
    sendTwilioSms(item.phone, smsMsg, { ticketId: item.id, triggerType: "CALLED_NOW", ticketUrl })
      .then(res => {
        if (res.success) {
          logCustomerActivity(historyItem, "sms_sent", "SMS Notification Sent", `Delivered SMS text message with live ticket link to ${item.phone} via Twilio`, "📲");
          showToast(`📱 SMS with ticket link sent to ${item.customerName} (${item.phone})`);
        } else {
          logCustomerActivity(historyItem, "sms_attempt", "SMS Notification Attempted", `Twilio Dispatch: ${res.error}`, "📱");
        }
      });
  }

  state.queue.splice(index, 1);
  state.history.unshift(historyItem);
  saveData();
  renderAll();
  showToast(`Called ${item.customerName} (Waited ${durationMin}m)`);
}

// Cancel Customer
function cancelCustomer(id, nameFallback, cancelledBy = "desk") {
  // 1. Check queue by ID or name
  let index = state.queue.findIndex(item => item.id === id);
  if (index === -1 && nameFallback) {
    index = state.queue.findIndex(item => item.customerName && item.customerName.toLowerCase() === nameFallback.toLowerCase());
  }

  if (index !== -1) {
    const item = state.queue[index];
    const historyItem = {
      ...item,
      status: "cancelled",
      cancelledBy: cancelledBy,
      calledAt: Date.now(),
      cancelledAt: Date.now(),
      waitDurationMin: 0
    };

    const byDesk = (cancelledBy === "desk");
    logCustomerActivity(historyItem, "cancelled", "Cancelled Visit", byDesk ? "Cancelled / marked No-Show by Front Desk" : "Customer tapped Leave Line on phone", "✕");

    state.queue.splice(index, 1);
    state.history.unshift(historyItem);
    saveData();
    renderAll();
    showToast(`Cancelled ${item.customerName}`);
    return;
  }

  // 2. Check history by ID or name (e.g. status "called" / Visit In Progress)
  let hIndex = state.history.findIndex(item => item.id === id);
  if (hIndex === -1 && nameFallback) {
    hIndex = state.history.findIndex(item => item.customerName && item.customerName.toLowerCase() === nameFallback.toLowerCase());
  }

  if (hIndex !== -1) {
    const item = state.history[hIndex];
    item.status = "cancelled";
    item.cancelledBy = cancelledBy;
    item.waitDurationMin = 0;
    saveData();
    renderAll();
    showToast(`Cancelled ${item.customerName}`);
    return;
  }
}

// Reset Daily History Log for Current Shop
function clearDailyHistory() {
  const shopName = state.config.shopName || "this shop";
  if (confirm(`Clear all visitor history log records for "${shopName}"?`)) {
    state.history = [];
    saveData();
    renderAll();
    showToast(`🧹 History log cleared for "${shopName}"`);
  }
}

// Helper: Get start of today timestamp (00:00:00 AM)
function getStartOfTodayTimestamp() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// Helper: Get today's called visits strictly
function getTodayCalledVisits() {
  const startOfToday = getStartOfTodayTimestamp();
  return state.history.filter(item => {
    if (item.status !== "called") return false;
    const targetTs = item.calledAt || item.checkedInAt;
    return targetTs && targetTs >= startOfToday;
  });
}

// Helper: Get today's cancelled visits strictly
function getTodayCancelledVisits() {
  const startOfToday = getStartOfTodayTimestamp();
  return state.history.filter(item => {
    if (item.status !== "cancelled") return false;
    const targetTs = item.calledAt || item.checkedInAt;
    return targetTs && targetTs >= startOfToday;
  });
}

// Calculate Estimated Wait Time based strictly on CURRENT DAY traffic and completed wait times
function calculateEstimatedWait(targetItemIndex = -1) {
  const queueCount = state.queue.length;
  if (queueCount === 0) return 0;

  const todayVisits = getTodayCalledVisits();
  let fallbackAvgServiceTime = parseInt(state.config.estBaseWaitMin) || 20;

  if (todayVisits.length > 0) {
    const totalMin = todayVisits.reduce((sum, item) => sum + Math.min(120, parseInt(item.waitDurationMin, 10) || 0), 0);
    const avg = Math.round(totalMin / todayVisits.length);
    fallbackAvgServiceTime = Math.max(5, avg);
  }

  const limit = (targetItemIndex >= 0 && targetItemIndex <= queueCount) ? targetItemIndex : queueCount;
  if (limit === 0) return 0;

  let totalWaitMin = 0;
  for (let i = 0; i < limit; i++) {
    const item = state.queue[i];
    if (item && item.selectedServiceDurationMin && parseInt(item.selectedServiceDurationMin, 10) > 0) {
      totalWaitMin += parseInt(item.selectedServiceDurationMin, 10);
    } else {
      totalWaitMin += fallbackAvgServiceTime;
    }
  }

  return Math.max(5, totalWaitMin);
}

// Calculate Average Turnaround Today based strictly on CURRENT DAY traffic
function calculateAvgTurnaround() {
  const todayVisits = getTodayCalledVisits();
  if (todayVisits.length === 0) return "--";
  const totalMin = todayVisits.reduce((sum, item) => sum + Math.min(120, parseInt(item.waitDurationMin, 10) || 0), 0);
  return Math.round(totalMin / todayVisits.length) + "m";
}

// Render All UI Views
function renderAll() {
  renderMetrics();
  renderQueue();
  renderHistory();
  renderPublicView();
  renderOwnerMetrics();
  renderShopDropdown();
  renderSubscriptionBadges();
  populateOwnerServicesUI();
}

function renderPublicView() {
  setElText("public-shop-name", state.config.shopName || "Main St Barbers");
  setElText("public-footer-shop-name", state.config.shopName || "Main St Barbers");

  renderPublicContactBar();

  const estWait = calculateEstimatedWait(-1);
  setElText("public-wait-display", estWait > 0 ? `~ ${estWait} MINS` : "NO WAIT ⚡");

  const qCount = state.queue.length;
  setElText("public-queue-summary", `${qCount} ${qCount === 1 ? 'person' : 'people'} currently waiting in line`);

  restoreActiveTicket();
  renderPublicServiceChips();
  renderDeskServiceSelect();
}

function renderPublicContactBar() {
  const container = document.getElementById("public-contact-bar");
  if (!container) return;

  const address = state.config.address || "";
  const phone = state.config.phone || "";

  if (!address && !phone) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.gap = "0.5rem";
  container.style.fontSize = "0.85rem";
  container.style.color = "var(--text-muted)";
  container.style.marginTop = "0.4rem";
  container.style.flexWrap = "wrap";

  let html = "";
  if (address) {
    const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    html += `<a href="${mapsUrl}" target="_blank" style="color: var(--text-subtle); text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">📍 ${escapeHtml(address)}</a>`;
  }
  if (address && phone) {
    html += `<span style="color: var(--text-muted);">&bull;</span>`;
  }
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    html += `<a href="tel:${cleanPhone}" data-phone="${escapeHtml(phone)}" data-label="${escapeHtml(state.config.shopName || 'Shop')}" onclick="handlePhoneClick(event, this)" style="color: #06b6d4; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem; background: rgba(6, 182, 212, 0.1); padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid rgba(6, 182, 212, 0.35); font-size: 0.85rem;" title="Tap to call shop">📞 ${escapeHtml(phone)}</a>`;
  }

  container.innerHTML = html;
}

let currentCallNumberDigits = "";
let currentCallNumberFormatted = "";

function handlePhoneClick(event, el, fallbackPhone, fallbackLabel) {
  let rawPhone = "";
  let labelName = "";

  if (typeof el === "string") {
    rawPhone = el;
    labelName = fallbackPhone || "";
  } else if (el && el.getAttribute) {
    rawPhone = el.getAttribute("data-phone") || fallbackPhone || "";
    labelName = el.getAttribute("data-label") || fallbackLabel || "";
  } else {
    rawPhone = fallbackPhone || "";
    labelName = fallbackLabel || "";
  }

  openPhoneCallModal(event, rawPhone, labelName);
}

function openPhoneCallModal(arg1, arg2, arg3) {
  let event = null;
  let rawPhone = "";
  let labelName = "";

  if (arg1 && typeof arg1 === "object" && arg1.preventDefault) {
    event = arg1;
    rawPhone = arg2;
    labelName = arg3;
  } else {
    rawPhone = arg1;
    labelName = arg2;
  }

  if (!rawPhone) return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth <= 768);

  if (!isMobile && event && event.preventDefault) {
    event.preventDefault();
  }

  const cleanDigits = String(rawPhone).replace(/[^0-9+]/g, '');
  currentCallNumberDigits = cleanDigits;
  currentCallNumberFormatted = rawPhone;

  const modal = document.getElementById("modal-phone-call");
  const title = document.getElementById("phone-modal-title");
  const displayNum = document.getElementById("phone-modal-display-num");
  const callBtn = document.getElementById("phone-modal-call-btn");

  if (title) title.textContent = labelName ? `Call ${labelName}` : "Call Phone Number";
  if (displayNum) displayNum.textContent = rawPhone;
  if (callBtn) callBtn.href = `tel:${cleanDigits}`;

  if (modal) modal.classList.remove("hidden");
}

function closePhoneCallModal() {
  const modal = document.getElementById("modal-phone-call");
  if (modal) modal.classList.add("hidden");
}

function copyPhoneModalNumber() {
  const textToCopy = currentCallNumberFormatted || currentCallNumberDigits;
  if (!textToCopy) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast("📋 Phone number copied to clipboard!");
      closePhoneCallModal();
    }).catch(() => {
      showToast("📋 Phone number: " + textToCopy);
      closePhoneCallModal();
    });
  } else {
    showToast("📋 Phone number: " + textToCopy);
    closePhoneCallModal();
  }
}

function renderSubscriptionBadges() {
  const isAuthenticated = !!(state.user && state.user.email);
  const rawPrice = state.config.planPrice !== undefined ? state.config.planPrice : 0;
  const rawTitle = state.config.planTitle || "Starter Tier (Free)";

  const planPrice = isAuthenticated ? rawPrice : 0;
  const planTitle = isAuthenticated ? rawTitle : "Starter Tier (Free)";
  const isSubscribed = isAuthenticated && (planPrice > 0 || planTitle.includes("Pro") || planTitle.includes("Enterprise"));

  // 1. Home View Subscription Banner (ONLY shown for active paid subscribers)
  const homeBanner = document.getElementById("home-active-subscription-banner");
  const homeTitle = document.getElementById("home-tier-title");
  const homeIcon = document.getElementById("home-tier-icon");

  if (homeBanner) {
    if (isSubscribed) {
      homeBanner.classList.remove("hidden");
      if (homeTitle) {
        homeTitle.textContent = `${planTitle} ($${planPrice}/mo)`;
      }
      if (homeIcon) {
        homeIcon.textContent = planTitle.includes("Enterprise") ? "👑" : "💎";
      }
    } else {
      homeBanner.classList.add("hidden");
    }
  }

  // 2. Main Header Upgrade Button (Only visible for Free Starter & Guest users; hidden when subscribed for clean navbar)
  const headerBtn = document.getElementById("header-upgrade-btn");
  if (headerBtn) {
    if (isSubscribed) {
      headerBtn.style.display = "none";
    } else {
      headerBtn.style.display = "inline-flex";
      headerBtn.innerHTML = `<span>💎 Upgrade</span>`;
    }
  }

  // 3. User Profile Dropdown Badge & Menu Item
  const dropdownBadge = document.getElementById("dropdown-tier-badge");
  const dropdownSubItemLabel = document.getElementById("dropdown-item-subscription-label");

  if (dropdownBadge) {
    if (isSubscribed && planTitle.includes("Enterprise")) {
      dropdownBadge.innerHTML = `<span class="pulse-dot" style="background:#6366f1;"></span> 👑 Enterprise • Active`;
      dropdownBadge.style.color = "#6366f1";
      dropdownBadge.style.background = "rgba(99, 102, 241, 0.15)";
      dropdownBadge.style.borderColor = "rgba(99, 102, 241, 0.3)";
    } else if (isSubscribed) {
      dropdownBadge.innerHTML = `<span class="pulse-dot" style="background:#10b981;"></span> 💎 Pro Business • Active`;
      dropdownBadge.style.color = "#10b981";
      dropdownBadge.style.background = "rgba(16, 185, 129, 0.15)";
      dropdownBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
    } else {
      dropdownBadge.innerHTML = `<span class="pulse-dot"></span> Starter Plan (Free)`;
      dropdownBadge.style.color = "var(--text-subtle)";
      dropdownBadge.style.background = "rgba(255, 255, 255, 0.08)";
      dropdownBadge.style.borderColor = "var(--border-color)";
    }
  }

  const mobileDrawerUserTier = document.getElementById("mobile-drawer-user-tier");
  if (mobileDrawerUserTier && dropdownBadge) {
    mobileDrawerUserTier.innerHTML = dropdownBadge.innerHTML;
    mobileDrawerUserTier.style.color = dropdownBadge.style.color;
    mobileDrawerUserTier.style.background = dropdownBadge.style.background;
    mobileDrawerUserTier.style.borderColor = dropdownBadge.style.borderColor;
  }

  if (dropdownSubItemLabel) {
    dropdownSubItemLabel.textContent = isSubscribed ? "⚙️ Manage Subscription" : "🚀 Upgrade Subscription";
  }
}

// Render Metrics (Front Desk Header)
function renderMetrics() {
  const estWait = calculateEstimatedWait();
  const waitingCount = state.queue.length;
  const servedCount = getTodayCalledVisits().length;
  const avgTurnaround = calculateAvgTurnaround();

  setElText("metric-est-wait", estWait > 0 ? `~ ${estWait}m` : "0m");
  setElText("metric-waiting-count", waitingCount);
  setElText("metric-served-count", servedCount);
  setElText("metric-avg-wait", avgTurnaround);
  setElText("queue-badge", `${waitingCount} Waiting`);
}

// Render Owner Metrics (Business Owner Dashboard)
function renderOwnerMetrics() {
  const servedCount = getTodayCalledVisits().length;
  const cancelledCount = getTodayCancelledVisits().length;
  const totalEntries = servedCount + cancelledCount;
  const cancellationRate = totalEntries > 0 ? Math.round((cancelledCount / totalEntries) * 100) : 0;

  // Subscription Plan dynamic card rendering
  const planPrice = state.config.planPrice !== undefined ? state.config.planPrice : 0;
  const planTitle = state.config.planTitle || "Starter Tier (Free)";
  const ownerPlanValEl = document.getElementById("owner-plan-value");
  const ownerPlanCapEl = document.getElementById("owner-plan-caption");
  if (ownerPlanValEl) ownerPlanValEl.textContent = planPrice === 0 ? "$0 / month" : `$${planPrice} / month`;
  if (ownerPlanCapEl) ownerPlanCapEl.textContent = planPrice === 0 ? `${planTitle} • Free Forever` : `${planTitle} • Active`;

  const ownerServedEl = document.getElementById("owner-served-today");
  if (ownerServedEl) ownerServedEl.textContent = servedCount;
  
  const ownerCancelEl = document.getElementById("owner-cancellations");
  if (ownerCancelEl) ownerCancelEl.textContent = `${cancelledCount} (${cancellationRate}%)`;

  const ownerLobbyEl = document.getElementById("owner-lobby-count");
  if (ownerLobbyEl) ownerLobbyEl.textContent = state.queue.length;

  const avgTurnaround = calculateAvgTurnaround();
  const ownerAvgEl = document.getElementById("owner-avg-turnaround");
  if (ownerAvgEl) ownerAvgEl.textContent = avgTurnaround;

  const todayCalledVisits = getTodayCalledVisits();
  const startOfToday = getStartOfTodayTimestamp();
  const todayQueueWaits = state.queue.filter(q => q.checkedInAt && q.checkedInAt >= startOfToday).map(q => Math.round((Date.now() - q.checkedInAt)/(1000*60)));
  const todayCalledWaits = todayCalledVisits.map(h => parseInt(h.waitDurationMin, 10) || 0);
  const allWaitsToday = [...todayCalledWaits, ...todayQueueWaits];

  const ownerPeakEl = document.getElementById("owner-peak-wait");
  if (ownerPeakEl) {
    if (allWaitsToday.length > 0) {
      const maxWait = Math.max(...allWaitsToday);
      ownerPeakEl.textContent = maxWait + "m";
    } else {
      ownerPeakEl.textContent = "--";
    }
  }

  // Calculate Peak Rush Hour Window (Strictly for TODAY's visits)
  const todayEntries = [...state.history, ...state.queue].filter(item => {
    const ts = item.checkedInAt || item.calledAt;
    return ts && ts >= startOfToday;
  });

  if (todayEntries.length > 0) {
    const hourCounts = {};
    todayEntries.forEach(item => {
      const ts = item.checkedInAt || item.calledAt;
      const date = new Date(ts);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let maxHour = -1;
    let maxCount = 0;
    Object.keys(hourCounts).forEach(h => {
      if (hourCounts[h] > maxCount) {
        maxCount = hourCounts[h];
        maxHour = parseInt(h, 10);
      }
    });

    const ownerPeakHourEl = document.getElementById("owner-peak-hour");
    if (ownerPeakHourEl && maxHour !== -1) {
      const ampm = maxHour >= 12 ? "PM" : "AM";
      const displayHour = maxHour % 12 === 0 ? 12 : maxHour % 12;
      const nextH = maxHour + 1;
      const nextHour = nextH % 12 === 0 ? 12 : nextH % 12;
      const nextAmpm = nextH >= 12 && nextH < 24 ? "PM" : "AM";
      ownerPeakHourEl.textContent = `${displayHour} ${ampm} - ${nextHour} ${nextAmpm}`;
    }
  } else {
    const ownerPeakHourEl = document.getElementById("owner-peak-hour");
    if (ownerPeakHourEl) ownerPeakHourEl.textContent = "--";
  }

  // Calculate Staff Speed (Visits / Hour)
  const ownerThroughputEl = document.getElementById("owner-throughput");
  if (ownerThroughputEl) {
    if (todayCalledVisits.length > 0) {
      const timestamps = todayCalledVisits.map(v => v.calledAt || v.checkedInAt);
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps, Date.now());
      // Minimum elapsed window set to 0.1 hour (6 minutes) to avoid artificial under-reporting early in the day
      const hoursElapsed = Math.max(0.1, (maxTime - minTime) / (1000 * 60 * 60));
      const throughput = (servedCount / hoursElapsed).toFixed(1);
      ownerThroughputEl.textContent = `${throughput} / hr`;
    } else {
      ownerThroughputEl.textContent = "--";
    }
  }

  populateOwnerInputs();
}

// Populate Shop Profile & Branding inputs from state.config
function populateOwnerInputs() {
  const shopNameInput = document.getElementById("owner-input-shopname");
  if (shopNameInput && state.config.shopName && document.activeElement !== shopNameInput) {
    shopNameInput.value = state.config.shopName;
  }

  const slugInput = document.getElementById("owner-input-slug");
  if (slugInput && state.config.slug && document.activeElement !== slugInput) {
    slugInput.value = state.config.slug;
  }

  const addressInput = document.getElementById("owner-input-address");
  if (addressInput && document.activeElement !== addressInput) {
    addressInput.value = state.config.address || "";
  }

  const phoneInput = document.getElementById("owner-input-phone");
  if (phoneInput && document.activeElement !== phoneInput) {
    phoneInput.value = state.config.phone || "";
  }

  const emailInput = document.getElementById("owner-input-email");
  if (emailInput && document.activeElement !== emailInput) {
    emailInput.value = state.config.ownerEmail || "";
  }

  const hoursInput = document.getElementById("owner-input-hours");
  if (hoursInput && document.activeElement !== hoursInput) {
    hoursInput.value = state.config.hours || "";
  }

  const promoInput = document.getElementById("owner-input-promo");
  if (promoInput && document.activeElement !== promoInput) {
    promoInput.value = state.config.promoText || "";
  }

  const promoStartInput = document.getElementById("owner-input-promo-start");
  if (promoStartInput && document.activeElement !== promoStartInput) {
    promoStartInput.value = formatDatetimeLocalVal(state.config.promoStart);
  }

  const promoEndInput = document.getElementById("owner-input-promo-end");
  if (promoEndInput && document.activeElement !== promoEndInput) {
    promoEndInput.value = formatDatetimeLocalVal(state.config.promoEnd);
  }

  const logoUrlInput = document.getElementById("owner-input-logourl");
  if (logoUrlInput && document.activeElement !== logoUrlInput) {
    logoUrlInput.value = state.config.logoUrl || "";
  }

  const baselineInput = document.getElementById("owner-input-baseline");
  if (baselineInput && state.config.estBaseWaitMin && document.activeElement !== baselineInput) {
    baselineInput.value = state.config.estBaseWaitMin;
  }

  const previewBox = document.getElementById("logo-preview-box");
  const previewImg = document.getElementById("logo-preview-img");
  if (previewBox && previewImg) {
    if (state.config.logoUrl) {
      previewImg.src = state.config.logoUrl;
      previewBox.style.display = "flex";
    } else {
      previewBox.style.display = "none";
    }
  }
}

// Save Owner Dashboard Settings
function saveOwnerSettings() {
  const shopNameInput = document.getElementById("owner-input-shopname");
  const slugInput = document.getElementById("owner-input-slug");
  const shopName = shopNameInput ? shopNameInput.value.trim() || "Main St Barbers" : "Main St Barbers";
  const slug = slugInput ? slugInput.value.trim() || "main-st-barbers" : "main-st-barbers";

  const address = document.getElementById("owner-input-address") ? document.getElementById("owner-input-address").value.trim() : "";
  const phone = document.getElementById("owner-input-phone") ? document.getElementById("owner-input-phone").value.trim() : "";
  const ownerEmail = document.getElementById("owner-input-email") ? document.getElementById("owner-input-email").value.trim() : "";
  const hours = document.getElementById("owner-input-hours") ? document.getElementById("owner-input-hours").value.trim() : "";
  const promoText = document.getElementById("owner-input-promo") ? document.getElementById("owner-input-promo").value.trim() : "";
  const promoStartVal = document.getElementById("owner-input-promo-start") ? document.getElementById("owner-input-promo-start").value : "";
  const promoEndVal = document.getElementById("owner-input-promo-end") ? document.getElementById("owner-input-promo-end").value : "";

  const promoStart = formatDatetimeLocalVal(promoStartVal);
  const promoEnd = formatDatetimeLocalVal(promoEndVal);

  const logoUrlInput = document.getElementById("owner-input-logourl");
  const logoUrl = logoUrlInput ? logoUrlInput.value.trim() : (state.config.logoUrl || "");

  const baselineInput = document.getElementById("owner-input-baseline");
  const estBaseWaitMin = baselineInput ? (parseInt(baselineInput.value, 10) || 20) : (state.config.estBaseWaitMin || 20);

  const twilioEnable = document.getElementById("twilio-enable-checkbox") ? document.getElementById("twilio-enable-checkbox").checked : true;
  const twilioAccountSid = document.getElementById("twilio-account-sid") ? document.getElementById("twilio-account-sid").value.trim() : (SECRETS.TWILIO_ACCOUNT_SID || "");
  let twilioFromPhone = document.getElementById("twilio-from-phone") ? document.getElementById("twilio-from-phone").value.trim() : DEFAULT_TWILIO_FROM;
  if (!twilioFromPhone || twilioFromPhone.replace(/\D/g, "").includes("9802531359") || twilioFromPhone.replace(/\D/g, "").includes("8774153678")) {
    twilioFromPhone = DEFAULT_TWILIO_FROM;
  }

  state.config = {
    ...state.config,
    shopName,
    slug,
    address,
    phone,
    ownerEmail,
    hours,
    promoText,
    promoStart,
    promoEnd,
    logoUrl,
    estBaseWaitMin,
    twilio: {
      enabled: twilioEnable,
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      fromPhone: twilioFromPhone,
      serveNowSmsTemplate: (document.getElementById("twilio-serve-now-template") && document.getElementById("twilio-serve-now-template").value.trim()) 
        ? document.getElementById("twilio-serve-now-template").value.trim() 
        : DEFAULT_SERVE_NOW_SMS
    }
  };

  saveConfig();
  saveData();
  generateQRCode();
  renderAll();
  showToast("Shop Profile & Branding updated!");
}

// Logo File Uploader & Canvas Sanitizer
function handleLogoFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // File size validation (Max 2 MB)
  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    showToast("⚠️ Image file exceeds 2 MB limit. Please select a smaller image.");
    event.target.value = "";
    return;
  }

  // Type validation
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!validTypes.includes(file.type.toLowerCase())) {
    showToast("⚠️ Invalid format. Only PNG, JPG, and WEBP files are allowed.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Re-encode via HTML5 Canvas (Sanitizes metadata/EXIF & auto-resizes to 512x512)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const MAX_DIM = 512;

      let width = img.width;
      let height = img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Export as clean, optimized Data URL (image/webp or image/png)
      const sanitizedDataUrl = canvas.toDataURL("image/webp", 0.85);
      state.config.logoUrl = sanitizedDataUrl;

      saveConfig();
      renderAll();
      showToast("📷 Shop logo uploaded & sanitized!");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeShopLogo() {
  state.config.logoUrl = "";
  const fileInput = document.getElementById("owner-file-logo");
  const urlInput = document.getElementById("owner-input-logourl");
  if (fileInput) fileInput.value = "";
  if (urlInput) urlInput.value = "";

  saveConfig();
  renderAll();
  showToast("Logo removed.");
}


function saveOwnerFirestoreConfig() {
  const rawConfig = document.getElementById("owner-firestore-json").value.trim();
  let firebaseConfig = null;
  if (rawConfig) {
    try {
      firebaseConfig = JSON.parse(rawConfig);
    } catch (e) {
      alert("Invalid JSON format in Firestore config box.");
      return;
    }
  }

  state.config.firebaseConfig = firebaseConfig;
  saveConfig();
  updateConfigUI();
  showToast(firebaseConfig ? "Connected to Google Cloud Firestore!" : "Reset to Local Standalone Mode");
}

function setQueueViewMode(mode) {
  state.deskViewMode = mode;
  localStorage.setItem("waitlink_desk_view_mode", mode);
  if (state.stageFocusedIndex === undefined) state.stageFocusedIndex = 0;
  renderQueue();
}

function updateViewModeToggleUI() {
  const gridBtn = document.getElementById("btn-view-grid");
  const stageBtn = document.getElementById("btn-view-stage");
  if (gridBtn && stageBtn) {
    const isStage = state.deskViewMode === "stage";
    if (isStage) {
      stageBtn.classList.add("active");
      gridBtn.classList.remove("active");
    } else {
      gridBtn.classList.add("active");
      stageBtn.classList.remove("active");
    }
  }
}

function rotateStage(delta) {
  if (state.queue.length === 0) return;
  const maxIdx = state.queue.length - 1;
  let nextIdx = (state.stageFocusedIndex || 0) + delta;
  if (nextIdx < 0) nextIdx = maxIdx;
  if (nextIdx > maxIdx) nextIdx = 0;
  state.stageFocusedIndex = nextIdx;
  renderQueue();
}

function focusStageIndex(idx) {
  if (idx >= 0 && idx < state.queue.length) {
    state.stageFocusedIndex = idx;
    renderQueue();
  }
}

let touchStartX = 0;
function bindStageTouchEvents() {
  const container = document.getElementById("stage-touch-container");
  if (!container) return;

  container.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches[0]) {
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  container.addEventListener("touchend", (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) rotateStage(-1); // Swiped right -> prev card
        else rotateStage(1);           // Swiped left -> next card
      }
    }
  }, { passive: true });
}

// Global Keyboard Navigation for 3D Stage Mode
window.addEventListener("keydown", (e) => {
  if (state.currentView === "desk" && state.deskViewMode === "stage" && state.queue.length > 0) {
    if (e.key === "ArrowLeft") {
      rotateStage(-1);
    } else if (e.key === "ArrowRight") {
      rotateStage(1);
    }
  }
});

// Render Queue List
function renderQueue() {
  const queueContainer = document.getElementById("queue-list");
  if (!queueContainer) return;

  updateViewModeToggleUI();

  if (state.queue.length === 0) {
    queueContainer.className = "queue-grid";
    queueContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛋️</div>
        <h3>No one in line right now</h3>
        <p>Enter a customer's name above and tap <strong>Check In</strong> to start tracking wait time.</p>
      </div>
    `;
    return;
  }

  // Ensure queue is always sorted strictly by checkedInAt timestamp ascending
  state.queue.sort((a, b) => (a.checkedInAt || 0) - (b.checkedInAt || 0));

  if (state.stageFocusedIndex === undefined || state.stageFocusedIndex >= state.queue.length) {
    state.stageFocusedIndex = 0;
  }

  const now = Date.now();
  const showMoveToEnd = state.queue.length > 1;

  const cardsHtmlArray = state.queue.map((item, index) => {
    const elapsedSec = Math.floor((now - item.checkedInAt) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    const timeStr = `${elapsedMin}m ${elapsedSec % 60}s`;
    const checkInClock = new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isNextUp = index === 0;
    const badgeText = isNextUp ? "#1 NEXT UP" : `#${index + 1} IN LINE`;
    const nextUpClass = isNextUp ? "next-up" : "";

    const lateBadgeHtml = item.delayedMinutes 
      ? `<span class="badge-late" title="Customer reported running late">🕒 LATE +${item.delayedMinutes}m</span>` 
      : '';

    const servicePillHtml = item.selectedServiceName 
      ? `<span class="badge-service" title="Selected Service">💈 ${escapeHtml(item.selectedServiceName)} (${item.selectedServiceDurationMin || 20}m)</span>` 
      : '';

    const phoneDigits = item.phone ? String(item.phone).replace(/\D/g, '') : '';

    let stageClass = "";
    if (state.deskViewMode === "stage") {
      const diff = index - state.stageFocusedIndex;
      if (diff === 0) stageClass = "stage-center";
      else if (diff === -1) stageClass = "stage-left-1";
      else if (diff === 1) stageClass = "stage-right-1";
      else if (diff === -2) stageClass = "stage-far-left";
      else if (diff === 2) stageClass = "stage-far-right";
      else stageClass = "stage-hidden";
    }

    return `
      <div class="queue-item-card ${nextUpClass} ${stageClass}" onclick="if('${state.deskViewMode}'==='stage' && ${index} !== ${state.stageFocusedIndex}) focusStageIndex(${index})">
        <div class="card-top-bar">
          <span class="position-badge ${nextUpClass}">${badgeText}</span>
          <div class="timer-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${timeStr}</span>
          </div>
        </div>

        <div class="customer-info-section">
          <div class="customer-name">${escapeHtml(item.customerName)}</div>
          ${(servicePillHtml || lateBadgeHtml) ? `<div class="customer-tags-row">${servicePillHtml}${lateBadgeHtml}</div>` : ''}
          <div class="checkin-details-row">
            <span class="checkin-time">Checked in at ${checkInClock}</span>
            ${item.phone ? `<span class="details-divider">&bull;</span><a href="tel:${escapeHtml(phoneDigits || item.phone)}" data-phone="${escapeHtml(item.phone)}" data-label="${escapeHtml(item.customerName)}" class="customer-phone-link" onclick="handlePhoneClick(event, this)" title="Tap to call ${escapeHtml(item.customerName)}">📞 ${escapeHtml(item.phone)}</a>` : ''}
          </div>
        </div>

        <div class="queue-item-actions">
          <button class="btn btn-call ${isNextUp ? 'btn-hero' : ''}" onclick="callCustomer('${escapeHtml(item.id)}')" title="Serve customer and dispatch turn-ready SMS with live ticket link">
            ⏱️ SERVE ${isNextUp ? 'NOW' : 'NEXT'}
          </button>
          ${showMoveToEnd ? `
          <button class="btn btn-requeue" onclick="requeueActiveCustomerToEnd('${escapeHtml(item.id)}')" title="Move customer to end of active line">
            ⬇️ Move to End
          </button>` : ''}
          <button class="btn btn-cancel" onclick="cancelCustomer('${escapeHtml(item.id)}')">
            ✕ Cancel
          </button>
        </div>
      </div>
    `;
  });

  if (state.deskViewMode === "stage") {
    queueContainer.className = "";
    const dotsHtml = state.queue.map((_, i) => `
      <span class="stage-dot ${i === state.stageFocusedIndex ? 'active' : ''}" onclick="focusStageIndex(${i})" title="Focus #${i + 1}"></span>
    `).join("");

    queueContainer.innerHTML = `
      <div class="queue-stage-wrapper" id="stage-touch-container">
        <button type="button" class="stage-nav-btn stage-nav-prev" onclick="rotateStage(-1)" title="Previous Customer (Left Arrow)">‹</button>
        <button type="button" class="stage-nav-btn stage-nav-next" onclick="rotateStage(1)" title="Next Customer (Right Arrow)">›</button>
        
        <div class="queue-stage-rotator">
          ${cardsHtmlArray.join("")}
        </div>

        <div class="stage-dots-bar">
          ${dotsHtml}
        </div>
      </div>
    `;
    bindStageTouchEvents();
  } else {
    queueContainer.className = "queue-grid";
    queueContainer.innerHTML = cardsHtmlArray.join("");
  }
}

// Helper to format date + time cleanly
function formatHistoryDateTime(timestamp) {
  if (!timestamp) return "--";
  const d = new Date(timestamp);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - targetDate) / (1000 * 60 * 60 * 24));

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${timeStr}`;
  } else if (diffDays > 1 && diffDays < 7) {
    const dayName = d.toLocaleDateString([], { weekday: 'short' });
    return `${dayName} (${d.getMonth() + 1}/${d.getDate()}), ${timeStr}`;
  } else {
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${timeStr}`;
  }
}

// Get Filtered History List for a specific view
function getFilteredHistoryList(isOwner = false) {
  const prefix = isOwner ? "owner-history-" : "history-";
  const filterSelect = document.getElementById(prefix + "date-filter");
  const datePicker = document.getElementById(prefix + "date-picker");
  const searchInput = document.getElementById(prefix + "search-input");

  const filterVal = filterSelect && filterSelect.value ? filterSelect.value : "all";
  const searchVal = searchInput && searchInput.value ? searchInput.value.trim().toLowerCase() : "";
  const customDateVal = datePicker && datePicker.value ? datePicker.value : "";

  // Show/hide date picker
  if (datePicker) {
    if (filterVal === "custom") {
      datePicker.classList.remove("hidden");
    } else {
      datePicker.classList.add("hidden");
    }
  }

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  return state.history.filter(item => {
    // Search query filter
    if (searchVal && !item.customerName.toLowerCase().includes(searchVal)) {
      return false;
    }

    const targetTs = item.calledAt || item.checkedInAt;
    if (!targetTs) return true;

    const itemDate = new Date(targetTs);
    const itemDayOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

    if (filterVal === "today") {
      return itemDayOnly.getTime() === todayDate.getTime();
    } else if (filterVal === "yesterday") {
      return itemDayOnly.getTime() === yesterdayDate.getTime();
    } else if (filterVal === "7days") {
      const sevenDaysAgo = todayDate.getTime() - 6 * 24 * 60 * 60 * 1000;
      return targetTs >= sevenDaysAgo;
    } else if (filterVal === "custom" && customDateVal) {
      const [y, m, d] = customDateVal.split("-").map(Number);
      return itemDate.getFullYear() === y && (itemDate.getMonth() + 1) === m && itemDate.getDate() === d;
    }

    return true; // "all"
  });
}

// Helper to find customer in history or queue by ID, encoded ID, or Name
function findCustomerRecord(idRaw) {
  if (!idRaw) return null;
  let targetStr = String(idRaw || '').trim();
  let decodedStr = targetStr;
  try { decodedStr = decodeURIComponent(targetStr); } catch(e) {}
  const cleanTarget = targetStr.replace(/^(hist_|q_|ticket_)/, '');
  const cleanDecodedTarget = decodedStr.replace(/^(hist_|q_|ticket_)/, '');

  const matchItem = (item) => {
    if (!item) return false;
    const itemKey = String(item.id || '').trim();
    const cleanKey = itemKey.replace(/^(hist_|q_|ticket_)/, '');
    const name = String(item.customerName || '').trim();
    return itemKey === targetStr || 
           itemKey === decodedStr || 
           cleanKey === cleanTarget || 
           cleanKey === cleanDecodedTarget || 
           (name && (name === targetStr || name === decodedStr || name.toLowerCase() === targetStr.toLowerCase() || name.toLowerCase() === decodedStr.toLowerCase()));
  };

  return (state.history || []).find(matchItem) || (state.queue || []).find(matchItem) || null;
}

// Mark a Called Customer as No-Show / Cancelled
function markCalledAsNoShow(id) {
  const item = findCustomerRecord(id);
  if (!item) return;

  if (confirm(`Mark "${item.customerName}" as No-Show / Cancelled?`)) {
    item.status = "cancelled";
    item.cancelledBy = "desk";
    item.waitDurationMin = 0;
    saveData();
    renderAll();
    showToast(`Marked ${item.customerName} as No-Show`);
  }
}

function logCustomerActivity(item, action, title, detail, icon = "📌") {
  if (!item) return;
  if (!Array.isArray(item.activities)) {
    item.activities = [];
    if (item.checkedInAt) {
      item.activities.push({
        action: "check_in",
        title: "Customer Checked In",
        detail: item.checkedInVia ? `Checked in via ${item.checkedInVia}` : "Customer initial check-in",
        timestamp: item.checkedInAt,
        icon: "📝"
      });
    }
  }
  item.activities.push({
    action,
    title,
    detail,
    timestamp: Date.now(),
    icon
  });
}

function getItemActivities(item) {
  if (!item) return [];
  if (Array.isArray(item.activities) && item.activities.length > 0) {
    return item.activities;
  }

  const list = [];
  if (item.checkedInAt) {
    list.push({
      action: "check_in",
      title: "Customer Checked In",
      detail: item.selectedServiceName ? `Selected ${item.selectedServiceName}` : (item.checkedInVia ? `Checked in via ${item.checkedInVia}` : "Customer initial check-in"),
      timestamp: item.checkedInAt,
      icon: "📝"
    });
  }

  if (item.lateReportedAt) {
    list.push({
      action: "running_late",
      title: `Running Late (+${item.delayedMinutes || 10}m)`,
      detail: `Notified front desk of +${item.delayedMinutes || 10} minutes delay`,
      timestamp: item.lateReportedAt,
      icon: "🏃"
    });
  }

  if (item.calledAt && item.status === "called") {
    list.push({
      action: "called",
      title: "Called Customer",
      detail: `Called to front desk for service (Waited ${item.waitDurationMin || 0}m)`,
      timestamp: item.calledAt,
      icon: "📞"
    });
  }

  if (item.cancelledAt || item.status === "cancelled") {
    const ts = item.cancelledAt || item.calledAt || Date.now();
    const byDesk = item.cancelledBy === "desk";
    list.push({
      action: "cancelled",
      title: "Cancelled Visit",
      detail: byDesk ? "Cancelled / marked No-Show by Front Desk" : "Customer tapped Leave Line on phone",
      timestamp: ts,
      icon: "✕"
    });
  }

  return list;
}

function buildHistoryRowHtml(item, isOwnerView = false) {
  const checkInFormatted = item.checkedInAt ? formatHistoryDateTime(item.checkedInAt) : "--";
  const calledFormatted = item.calledAt ? formatHistoryDateTime(item.calledAt) : "--";
  const cancelledFormatted = item.cancelledAt 
    ? formatHistoryDateTime(item.cancelledAt) 
    : (item.status === "cancelled" ? (item.calledAt ? formatHistoryDateTime(item.calledAt) : "--") : "--");
  
  const isCalled = item.status === "called";

  let statusTagHtml = `<span class="status-tag called" data-tooltip="Customer called for service">Called</span>`;
  if (!isCalled) {
    const by = item.cancelledBy === "desk" ? "desk" : "customer";
    if (by === "customer") {
      statusTagHtml = `<span class="status-tag cancelled" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3);" data-tooltip="Customer tapped Leave Line on their phone">📱 Left Line</span>`;
    } else {
      statusTagHtml = `<span class="status-tag cancelled" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);" data-tooltip="Cancelled or marked No-Show by Front Desk">🖥️ Desk Cancelled</span>`;
    }
  }

  const safeId = encodeURIComponent(String(item.id || item.customerName || '')).replace(/'/g, "%27");

  const auditBtnHtml = isOwnerView ? `
    <button class="btn-text-sm" data-action="audit-log" data-id="${safeId}" onclick="openCustomerAuditModal('${safeId}')" style="color: #c084fc; font-size: 0.78rem; font-weight: 700; border: 1px solid rgba(192, 132, 252, 0.4); padding: 0.2rem 0.55rem; border-radius: 6px; background: rgba(192, 132, 252, 0.15);" title="View complete lifecycle activity log for this customer">
      🕵️ Audit Log
    </button>
  ` : '';

  const actionCell = `
    <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center;">
      ${auditBtnHtml}
      ${isCalled ? `<button class="btn-text-sm" onclick="markCalledAsNoShow('${safeId}')" style="color: #f43f5e; font-size: 0.78rem; font-weight: 600; border: 1px solid rgba(244, 63, 94, 0.3); padding: 0.2rem 0.5rem; border-radius: 6px; background: rgba(244, 63, 94, 0.1);" title="Mark customer as No-Show">✕ No-Show</button>` : ''}
      <button class="btn-text-sm" onclick="promptRequeueCustomer('${safeId}')" style="color: #06b6d4; font-size: 0.78rem; font-weight: 600; border: 1px solid rgba(6, 182, 212, 0.3); padding: 0.2rem 0.5rem; border-radius: 6px; background: rgba(6, 182, 212, 0.1);" title="Put customer back in active queue">
        ↩️ ${isCalled ? 'Re-Queue' : 'Reinstate'}
      </button>
    </div>
  `;

  const customerNameCell = isOwnerView ? `
    <strong data-action="audit-log" data-id="${safeId}" onclick="openCustomerAuditModal('${safeId}')" style="cursor: pointer; color: #06b6d4; text-decoration: underline;" title="Click to view lifecycle audit log">
      ${escapeHtml(item.customerName)}
    </strong>
  ` : `<strong>${escapeHtml(item.customerName)}</strong>`;

  return `
    <tr>
      <td>${customerNameCell}</td>
      <td>${statusTagHtml}</td>
      <td>${checkInFormatted}</td>
      <td>${calledFormatted}</td>
      <td>${cancelledFormatted}</td>
      <td>${isCalled ? (item.waitDurationMin || 0) + " min" : "--"}</td>
      <td style="text-align: right;">${actionCell}</td>
    </tr>
  `;
}

// History Pagination Handlers
function onDeskFilterChange() {
  state.deskHistoryPage = 1;
  renderHistory();
}

function onOwnerFilterChange() {
  state.ownerHistoryPage = 1;
  renderHistory();
}

function changeDeskPage(delta) {
  state.deskHistoryPage += delta;
  renderHistory();
}

function changeOwnerPage(delta) {
  state.ownerHistoryPage += delta;
  renderHistory();
}

function updatePaginationUI(prefix, currentPage, maxPage, totalCount, startIndex, pagedCount) {
  const infoEl = document.getElementById(`${prefix}-pagination-info`);
  const pageNumEl = document.getElementById(`${prefix}-page-num-display`);
  const prevBtn = document.getElementById(`${prefix}-prev-page-btn`);
  const nextBtn = document.getElementById(`${prefix}-next-page-btn`);

  if (totalCount === 0) {
    if (infoEl) infoEl.textContent = "Showing 0 visits";
    if (pageNumEl) pageNumEl.textContent = "Page 1 of 1";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
  } else {
    const startNum = startIndex + 1;
    const endNum = startIndex + pagedCount;
    if (infoEl) infoEl.textContent = `Showing ${startNum}-${endNum} of ${totalCount} visits`;
    if (pageNumEl) pageNumEl.textContent = `Page ${currentPage} of ${maxPage}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= maxPage;
  }
}

// Render History Table (Front Desk and Owner Views with 20-record pagination)
function renderHistory() {
  const tbody = document.getElementById("history-tbody");
  const ownerTbody = document.getElementById("owner-history-tbody");
  const emptyRow = '<tr class="empty-row"><td colspan="7">No customer visit logs found for selected filter.</td></tr>';
  const pageSize = state.historyPageSize || 20;

  // Render Front Desk History
  if (tbody) {
    const filteredDesk = getFilteredHistoryList(false);
    const totalCount = filteredDesk.length;
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (state.deskHistoryPage > maxPage) state.deskHistoryPage = maxPage;
    if (state.deskHistoryPage < 1) state.deskHistoryPage = 1;

    const startIndex = (state.deskHistoryPage - 1) * pageSize;
    const pagedDesk = filteredDesk.slice(startIndex, startIndex + pageSize);

    if (totalCount === 0) {
      tbody.innerHTML = emptyRow;
    } else {
      tbody.innerHTML = pagedDesk.map(item => buildHistoryRowHtml(item)).join("");
    }

    updatePaginationUI("desk", state.deskHistoryPage, maxPage, totalCount, startIndex, pagedDesk.length);
  }

  // Render Owner History
  if (ownerTbody) {
    const filteredOwner = getFilteredHistoryList(true);
    const totalCount = filteredOwner.length;
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (state.ownerHistoryPage > maxPage) state.ownerHistoryPage = maxPage;
    if (state.ownerHistoryPage < 1) state.ownerHistoryPage = 1;

    const startIndex = (state.ownerHistoryPage - 1) * pageSize;
    const pagedOwner = filteredOwner.slice(startIndex, startIndex + pageSize);

    if (totalCount === 0) {
      ownerTbody.innerHTML = emptyRow;
    } else {
      ownerTbody.innerHTML = pagedOwner.map(item => buildHistoryRowHtml(item, true)).join("");
    }

    updatePaginationUI("owner", state.ownerHistoryPage, maxPage, totalCount, startIndex, pagedOwner.length);
  }
}

// Export History Log to CSV
// Export History Log to CSV (Includes Full Lifecycle Audit Trail)
function exportHistoryCSV() {
  if (!state.history || state.history.length === 0) {
    showToast("No history records available to export.");
    return;
  }

  const headers = [
    "Customer Name",
    "Phone Number",
    "Service Selected",
    "Check-In Source",
    "Status",
    "Cancelled By",
    "Checked In Timestamp",
    "Called Timestamp",
    "Cancelled Timestamp",
    "Wait Duration (Minutes)",
    "Full Lifecycle Audit Trail Log"
  ];

  const rows = state.history.map(item => {
    const checkInStr = item.checkedInAt ? new Date(item.checkedInAt).toLocaleString() : "";
    const calledStr = item.calledAt ? new Date(item.calledAt).toLocaleString() : "";
    const cancelledStr = item.cancelledAt 
      ? new Date(item.cancelledAt).toLocaleString() 
      : (item.status === 'cancelled' && item.calledAt ? new Date(item.calledAt).toLocaleString() : "");
    const cancelledByStr = item.status === "cancelled" ? (item.cancelledBy === "customer" ? "Customer (Left Line)" : "Front Desk") : "--";
    const duration = item.status === "called" ? (item.waitDurationMin || 0) : 0;
    const phoneStr = item.phone || "Not Provided";
    const serviceStr = item.selectedServiceName || "General Service";
    const sourceStr = item.checkedInVia ? (item.checkedInVia === "QR Code" ? "Customer (QR Code)" : "Front Desk") : "Customer Mobile";

    // Format full audit trail as pipe-separated entries
    const activities = getItemActivities(item);
    const auditTrailText = activities.map(act => {
      const timeStr = formatHistoryDateTime(act.timestamp);
      return `[${timeStr}] ${act.title}: ${act.detail}`;
    }).join(" | ");

    return [
      `"${(item.customerName || '').replace(/"/g, '""')}"`,
      `"${phoneStr.replace(/"/g, '""')}"`,
      `"${serviceStr.replace(/"/g, '""')}"`,
      `"${sourceStr.replace(/"/g, '""')}"`,
      `"${(item.status || '').replace(/"/g, '""')}"`,
      `"${cancelledByStr.replace(/"/g, '""')}"`,
      `"${checkInStr}"`,
      `"${calledStr}"`,
      `"${cancelledStr}"`,
      duration,
      `"${auditTrailText.replace(/"/g, '""')}"`
    ];
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `waitlink_visit_history_audit_${state.config.slug || 'export'}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📥 Exported Customer Visit & Audit History to CSV");
}

// Render Public View
function renderPublicView() {
  const estWait = calculateEstimatedWait();
  const queueCount = state.queue.length;

  setElText("public-shop-name", state.config.shopName || "Main St Barbers");
  setElText("public-footer-shop-name", state.config.shopName || "Main St Barbers");
  setElText("public-wait-display", estWait > 0 ? `~ ${estWait} MINS` : "NO WAIT ⚡");
  setElText("public-queue-summary", `${queueCount} ${queueCount === 1 ? 'person' : 'people'} currently waiting in line`);
  setElText("public-last-updated", "Updated " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // Render Store Hours
  const hoursText = state.config.hours || "9:00 AM - 7:00 PM (Open Today 🟢)";
  setElText("public-hours-text", hoursText);
  setElText("ticket-hours-reassurance", `Store open today: ${state.config.hours || '9:00 AM - 7:00 PM'}`);

  // Render Address & Phone Bar
  renderPublicContactBar();

  // Render Address & Phone in Live Ticket Card
  const ticketContact = document.getElementById("ticket-contact-info");
  if (ticketContact) {
    const parts = [];
    if (state.config.address) parts.push(`📍 ${escapeHtml(state.config.address)}`);
    if (state.config.phone) parts.push(`📞 ${escapeHtml(state.config.phone)}`);
    ticketContact.innerHTML = parts.join(" &bull; ");
    if (parts.length > 0) {
      ticketContact.style.display = "flex";
    } else {
      ticketContact.style.display = "none";
    }
  }

  renderPublicPromoBanner();
  restoreActiveTicket();
  renderPublicServiceChips();
  renderDeskServiceSelect();
}

function parsePromoTimestamp(dateStr, isEnd = false) {
  if (!dateStr) return isEnd ? Infinity : 0;
  
  let str = String(dateStr).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str += isEnd ? "T23:59:59" : "T00:00:00";
  } else if (isEnd && /^\d{4}-\d{2}-\d{2}T00:00$/.test(str)) {
    str = str.replace("T00:00", "T23:59:59");
  }

  const d = new Date(str);
  if (isNaN(d.getTime())) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? (isEnd ? Infinity : 0) : fallback.getTime();
  }
  return d.getTime();
}

function renderPublicPromoBanner() {
  const promoBanner = document.getElementById("public-promo-banner");
  if (!promoBanner) return;

  const promoText = state.config.promoText || "";
  let isPromoValid = false;

  if (promoText) {
    const now = Date.now();
    const startTime = parsePromoTimestamp(state.config.promoStart, false);
    
    let endTime = Infinity;
    if (state.config.promoEnd) {
      endTime = parsePromoTimestamp(state.config.promoEnd, true);
    } else if (state.config.promoStart) {
      endTime = parsePromoTimestamp(state.config.promoStart, true);
    }

    if (now >= startTime && now <= endTime) {
      isPromoValid = true;
    }
  }

  if (isPromoValid) {
    promoBanner.innerHTML = `${escapeHtml(promoText)}`;
    promoBanner.classList.remove("hidden");
  } else {
    promoBanner.classList.add("hidden");
  }
}

// Timer Ticker (Updates waiting counters every second)
function startTimerTicker() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    renderQueue();
    updateActiveTicketTimer();
    renderPublicPromoBanner();
  }, 1000);
}

function updateActiveTicketTimer() {
  if (!state.myTicket) return;
  const ticketTimerEl = document.getElementById("ticket-timer-display");
  if (!ticketTimerEl) return;

  const elapsedSec = Math.floor((Date.now() - state.myTicket.checkedInAt) / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const timeStr = `${elapsedMin}m ${seconds < 10 ? '0' : ''}${seconds}s`;
  ticketTimerEl.textContent = `Waited ${timeStr}`;

  // Update line position & custom subtitle in real-time
  const queuePos = state.queue.findIndex(item => item.id === state.myTicket.id);
  const posEl = document.getElementById("ticket-position-display");
  const badgeEl = document.getElementById("ticket-badge-display");
  const subEl = document.getElementById("ticket-subtitle-display");
  const ticketCard = document.getElementById("public-active-ticket-card");

  if (queuePos !== -1) {
    if (queuePos === 0) {
      if (badgeEl) { badgeEl.textContent = "⚡ #1 YOU ARE NEXT UP!"; badgeEl.style.color = "#06b6d4"; }
      if (posEl) { posEl.textContent = "Head to the Front Desk"; posEl.style.color = "#06b6d4"; }
      if (subEl) subEl.textContent = "Staff is about to call your name!";
      if (ticketCard) ticketCard.style.border = "2px solid #06b6d4";
    } else {
      if (badgeEl) { badgeEl.textContent = "✅ YOU ARE IN LINE"; badgeEl.style.color = "#10b981"; }
      if (posEl) { posEl.textContent = `Position #${queuePos + 1} in line`; posEl.style.color = "#10b981"; }
      if (subEl) subEl.textContent = `${queuePos} ${queuePos === 1 ? 'person' : 'people'} ahead of you in line.`;
      if (ticketCard) ticketCard.style.border = "2px solid #10b981";
    }
  } else {
    if (badgeEl) { badgeEl.textContent = "🎉 YOU'RE BEING SERVED!"; badgeEl.style.color = "#3b82f6"; }
    if (posEl) { posEl.textContent = "Visit In Progress"; posEl.style.color = "#3b82f6"; }
    if (subEl) subEl.textContent = `Enjoy your service at ${state.config.shopName || 'WaitLink Shop'}!`;
  }
}

// Switch Views
function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".mobile-drawer-nav-item").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".view-panel").forEach(panel => panel.classList.add("hidden"));

  const targetTab = document.getElementById(`tab-${viewName}`);
  if (targetTab) targetTab.classList.add("active");

  const mobileTargetTab = document.getElementById(`mobile-tab-${viewName}`);
  if (mobileTargetTab) mobileTargetTab.classList.add("active");

  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.remove("hidden");

  // Show/Hide Global Full App Footer (Hidden only on standalone public QR customer view)
  const globalFooter = document.getElementById("global-app-footer");
  if (globalFooter) {
    if (viewName === "public") {
      globalFooter.style.display = "none";
    } else {
      globalFooter.style.display = "block";
    }
  }

  // Handle Demo Mode Banner display (ONLY for Main St Barbers Sandbox)
  const demoBanner = document.getElementById("demo-mode-banner");
  if (demoBanner) {
    const isDemoSandbox = state.isDemoMode && state.config.slug === "main-st-barbers";
    if (isDemoSandbox && viewName !== "home") {
      demoBanner.classList.remove("hidden");
    } else {
      demoBanner.classList.add("hidden");
    }
  }

  // Update banner mode indicators
  const currentModeLabel = document.getElementById("current-mode-label");
  if (currentModeLabel) {
    if (viewName === "desk") currentModeLabel.innerHTML = "Front Desk ⇆";
    if (viewName === "owner") currentModeLabel.innerHTML = "Business Owner ⇆";
  }

  if (viewName === "poster") {
    generateQRCode();
  }
}

// Render Dynamic Active Shop Switcher Dropdown
function renderShopDropdown() {
  const dropdown = document.getElementById("shop-dropdown");
  if (!dropdown) return;

  const currentSlug = state.config.slug || "main-st-barbers";

  // Build unified map of custom user shops: slug -> shopName (only listed when authenticated)
  const shopMap = new Map();
  
  if (state.user) {
    if (Array.isArray(state.myShops)) {
      state.myShops.forEach(s => {
        if (s && s.slug && s.slug !== "main-st-barbers") {
          shopMap.set(s.slug, s.shopName || s.slug);
        }
      });
    }

    if (Array.isArray(state.registeredShops)) {
      state.registeredShops.forEach(s => {
        const sSlug = s.slug || s.id;
        const sName = s.name || s.shopName || sSlug;
        if (sSlug && sSlug !== "main-st-barbers") {
          shopMap.set(sSlug, sName);
        }
      });
    }

    if (currentSlug && currentSlug !== "main-st-barbers") {
      shopMap.set(currentSlug, state.config.shopName || currentSlug);
    }
  }

  let shopsListHtml = "";
  
  // Render Custom User Shops
  if (shopMap.size > 0) {
    shopMap.forEach((name, slug) => {
      const isActive = (slug === currentSlug);
      shopsListHtml += `
        <button class="dropdown-item ${isActive ? 'active-shop-item' : ''}" onclick="inspectShop('${escapeHtml(slug)}'); closeAllDropdowns();">
          <span>${isActive ? '✓' : '💈'} <strong>${escapeHtml(name)}</strong></span>
        </button>
      `;
    });
  } else if (state.user) {
    shopsListHtml = `
      <div style="padding: 10px 14px; font-size: 13px; color: var(--text-muted); font-style: italic;">No custom shops created yet</div>
    `;
  } else {
    shopsListHtml = `
      <div style="padding: 10px 14px; font-size: 13px; color: var(--text-muted); font-style: italic;">Sign in to view your shops</div>
    `;
  }

  dropdown.innerHTML = `
    <div class="dropdown-header-title">MY SHOPS</div>
    ${shopsListHtml}
    <div class="dropdown-divider"></div>
    <button class="dropdown-item" onclick="openCreateShopModal(); closeAllDropdowns();">
      <span>⚡ + Create New Shop Waitlist</span>
    </button>
  `;
}

// Launch Live Interactive Demo Mode Sandbox
function launchDemoMode() {
  state.isDemoMode = true;
  state.config.shopName = "Main St Barbers";
  state.config.slug = "main-st-barbers";
  state.config.planTitle = "Starter Tier (Free)";
  state.config.planPrice = 0;

  // Persist demo config in localStorage so UI & reloads stay in sync
  saveConfig();

  // Load demo queue & multi-day seed history
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  state.queue = [
    { id: "q1", customerName: "senthil", checkedInAt: now - 2.68 * 60 * 1000 },
    { id: "q2", customerName: "ragu", checkedInAt: now - 0.63 * 60 * 1000 },
    { id: "q3", customerName: "deeena", checkedInAt: now - 0.08 * 60 * 1000 }
  ];
  state.history = [
    { id: "h1", customerName: "James P.", status: "called", checkedInAt: now - 45 * 60 * 1000, calledAt: now - 25 * 60 * 1000, waitDurationMin: 20 },
    { id: "h2", customerName: "Chris K.", status: "called", checkedInAt: now - 35 * 60 * 1000, calledAt: now - 17 * 60 * 1000, waitDurationMin: 18 },
    { id: "h7", customerName: "Alex W.", status: "cancelled", cancelledBy: "desk", checkedInAt: now - 50 * 60 * 1000, cancelledAt: now - 40 * 60 * 1000, waitDurationMin: 0 },
    { id: "h3", customerName: "Sarah M.", status: "called", checkedInAt: now - oneDay - 120 * 60 * 1000, calledAt: now - oneDay - 105 * 60 * 1000, waitDurationMin: 15 },
    { id: "h4", customerName: "David L.", status: "called", checkedInAt: now - oneDay - 180 * 60 * 1000, calledAt: now - oneDay - 160 * 60 * 1000, waitDurationMin: 20 },
    { id: "h5", customerName: "Elena R.", status: "cancelled", cancelledBy: "customer", checkedInAt: now - oneDay - 240 * 60 * 1000, cancelledAt: now - oneDay - 235 * 60 * 1000, waitDurationMin: 0 },
    { id: "h6", customerName: "Michael B.", status: "called", checkedInAt: now - 2 * oneDay - 300 * 60 * 1000, calledAt: now - 2 * oneDay - 280 * 60 * 1000, waitDurationMin: 20 }
  ];

  // Save demo state locally
  saveData();

  // Re-subscribe Firestore to main-st-barbers document
  if (db) {
    subscribeFirestore();
  }

  // Update browser URL query string to match demo
  try {
    const newUrl = `${window.location.pathname}?shop=main-st-barbers`;
    window.history.pushState({ shop: "main-st-barbers" }, "", newUrl);
  } catch (e) {}

  renderAll();
  generateQRCode();
  switchView("desk");
  showToast("🎮 Entered Live Interactive Demo (Main St Barbers)");
}

// Open Shop Creation Wizard Modal
function openCreateShopModal() {
  // Gate unauthenticated guests: prompt them to register/sign in first!
  if (!state.user || !state.user.email) {
    pendingCreateShopAfterAuth = true;
    showToast("👋 Please create an account or sign in to set up your shop.");
    openAuthModal(true); // Open directly in "🚀 Register New Shop Account" mode
    return;
  }

  pendingCreateShopAfterAuth = false;

  // Pre-fill and lock the owner's email address from their authenticated profile
  const emailInput = document.getElementById("onboard-owner-email");
  if (emailInput) {
    emailInput.value = state.user.email;
    emailInput.readOnly = true;
    emailInput.style.opacity = "0.85";
    emailInput.style.cursor = "not-allowed";
  }

  const modal = document.getElementById("onboarding-modal") || document.getElementById("create-shop-modal");
  if (modal) {
    modal.classList.remove("hidden");
    const nameInput = document.getElementById("onboard-shopname") || document.getElementById("new-shop-name");
    if (nameInput) nameInput.focus();
  }
}

function openOnboardingModal() {
  openCreateShopModal();
}

function closeCreateShopModal() {
  const modal = document.getElementById("onboarding-modal") || document.getElementById("create-shop-modal");
  if (modal) modal.classList.add("hidden");
}

function closeOnboardingModal() {
  closeCreateShopModal();
}

// Auto-generate URL slug from Shop Name
function generateSlugFromInput(val) {
  const slugInput = document.getElementById("onboard-slug") || document.getElementById("new-shop-slug");
  if (slugInput && val) {
    const cleanSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    slugInput.value = cleanSlug;
  }
}

// Handle Shop Creation Form Submission (Delegates to unified handleOnboardingSubmit)
function handleCreateShopSubmit(event) {
  handleOnboardingSubmit(event);
}

// Generate QR Code for Poster
function generateQRCode() {
  const qrBox = document.getElementById("qrcode-box");
  if (!qrBox) return;
  qrBox.innerHTML = "";
  const publicUrl = getPublicUrl();

  let qrGenerated = false;

  if (window.QRCode) {
    try {
      new QRCode(qrBox, {
        text: publicUrl,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
      if (qrBox.children && qrBox.children.length > 0) {
        qrGenerated = true;
      }
    } catch (e) {
      console.warn("Local QRCode render fallback:", e);
    }
  }

  // Fail-safe QR Image generation fallback (100% Guaranteed High-Res QR rendering)
  if (!qrGenerated) {
    const encodedUrl = encodeURIComponent(publicUrl);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodedUrl}`;
    qrBox.innerHTML = `<img src="${qrApiUrl}" alt="Scan QR Code" style="width: 220px; height: 220px; display: block; margin: 0 auto; border-radius: 8px;">`;
  }
}

// Copy Public Link Helper
function copyPublicLink() {
  const publicUrl = getPublicUrl();
  navigator.clipboard.writeText(publicUrl).then(() => {
    showToast("Public wait link copied to clipboard!");
  }).catch(() => {
    showToast("Link: " + publicUrl);
  });
}

// Settings Modal
function openSettingsModal() {
  document.getElementById("settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.add("hidden");
}

function saveSettings() {
  const shopName = document.getElementById("setting-shop-name").value.trim() || "Main St Barbers";
  const slug = document.getElementById("setting-slug").value.trim() || "main-st-barbers";
  const baseWait = parseInt(document.getElementById("setting-base-wait").value) || 20;

  const rawConfig = document.getElementById("setting-firebase-config").value.trim();
  let firebaseConfig = null;
  if (rawConfig) {
    try {
      firebaseConfig = JSON.parse(rawConfig);
    } catch (e) {
      alert("Invalid JSON in Firebase config field.");
      return;
    }
  }

  state.config = {
    shopName,
    slug,
    estBaseWaitMin: baseWait,
    firebaseConfig
  };

  saveConfig();
  generateQRCode();
  renderAll();
  closeSettingsModal();
  showToast("Settings saved successfully");
}

// Toast Notifications
function showToast(message) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>⏳</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/* ==========================================================================
   FIREBASE AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
   ========================================================================== */

let isRegistering = false;
let pendingCreateShopAfterAuth = false;

function initAuth() {
  // Check for persistent session override first
  const sessionUser = sessionStorage.getItem("waitlink_session_user");
  if (sessionUser) {
    try {
      state.user = JSON.parse(sessionUser);
      applyUserRole(state.user);
    } catch (e) {}
  }

  if (!ensureFirebaseInitialized() || !firebase.auth) return;

  // Process Google OAuth redirect result (Bypasses COOP popup restrictions)
  try {
    firebase.auth().getRedirectResult().then(result => {
      if (result && result.user) {
        state.user = result.user;
        sessionStorage.setItem("waitlink_session_user", JSON.stringify(result.user));
        applyUserRole(result.user);
        closeAuthModal();
        const email = result.user.email || "";
        if (email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
          switchView("superadmin");
          showToast("👑 Welcome Platform Administrator");
        } else {
          switchView("owner");
          showToast(`💈 Welcome ${result.user.displayName || email}!`);
        }
      }
    }).catch(err => {
      console.warn("Google Redirect result error:", err);
      if (err && (err.message || "").includes("domain")) {
        showToast("⚠️ Domain authorization pending in Firebase Console.");
        openEmailPromptModal();
      }
    });
  } catch (e) {}

  firebase.auth().onAuthStateChanged(user => {
    // If a manual session exists, priority is given to session
    const currentSession = sessionStorage.getItem("waitlink_session_user");
    if (currentSession) return;

    state.user = user;
    applyUserRole(user);
  });
}

/* Dropdown Navigation System */
function toggleDropdown(event, dropdownId) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const isCurrentlyHidden = dropdown.classList.contains("hidden");
  closeAllDropdowns();

  if (isCurrentlyHidden) {
    dropdown.classList.remove("hidden");
  }
}

function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-menu").forEach(menu => {
    menu.classList.add("hidden");
  });
}

/* FAQ Accordion Toggle Handler */
function toggleFaq(btn) {
  const item = btn.closest(".faq-item");
  if (!item) return;
  const isExpanded = item.classList.contains("active");
  document.querySelectorAll(".faq-item").forEach(el => el.classList.remove("active"));
  if (!isExpanded) {
    item.classList.add("active");
  }
}

// Close dropdowns when clicking anywhere outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown-wrapper")) {
    closeAllDropdowns();
  }
});

function handleAccountDropdownAction() {
  closeAllDropdowns();
  if (state.user) {
    handleSignOut();
  } else {
    openAuthModal();
  }
}

function fetchUserShopsAndSync(userEmail) {
  if (!db || !userEmail) return;

  const isSuper = userEmail.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

  const query = isSuper 
    ? db.collection("shops")
    : db.collection("shops").where("ownerEmail", "==", userEmail);

  query.get().then(snapshot => {
    const fetchedShops = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const sSlug = data.slug || doc.id;
      const sName = data.name || data.shopName || sSlug;
      fetchedShops.push({ slug: sSlug, shopName: sName, ...data });
      trackMyShop(sSlug, sName);
    });

    state.registeredShops = fetchedShops;
    renderShopDropdown();

    // Auto-select user's custom shop if current active is still default demo on sign in
    if (fetchedShops.length > 0) {
      const nonDemoShop = fetchedShops.find(s => s.slug !== "main-st-barbers");
      if (nonDemoShop && state.config.slug === "main-st-barbers") {
        inspectShop(nonDemoShop.slug);
      }
    }
  }).catch(err => {
    console.warn("Error fetching user shops:", err);
  });
}

function applyUserRole(user) {
  const authBtnLabel = document.getElementById("auth-btn-label");
  const dropdownUserEmail = document.getElementById("dropdown-user-email");
  const itemSuperAdmin = document.getElementById("item-superadmin");
  const itemSettings = document.getElementById("item-settings");
  const itemArchitecture = document.getElementById("item-architecture");
  const itemAuthActionLabel = document.getElementById("item-auth-action-label");
  const superAdminTab = document.getElementById("tab-superadmin");
  const deskTab = document.getElementById("tab-desk");
  const ownerTab = document.getElementById("tab-owner");
  const settingsBtn = document.getElementById("btn-settings");

  const shopChipContainer = document.getElementById("shop-chip-container");

  // Mobile Drawer sync elements
  const mobileTabDesk = document.getElementById("mobile-tab-desk");
  const mobileTabOwner = document.getElementById("mobile-tab-owner");
  const mobileTabSuperAdmin = document.getElementById("mobile-tab-superadmin");
  const mobileDrawerUserEmail = document.getElementById("mobile-drawer-user-email");
  const mobileDrawerAvatarIcon = document.getElementById("mobile-drawer-avatar-icon");
  const mobileItemAuthActionLabel = document.getElementById("mobile-item-auth-action-label");
  const mobileDrawerShopBadge = document.getElementById("mobile-drawer-shop-badge");

  if (user && user.email) {
    const email = user.email;
    const isSuper = email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
    state.userRole = isSuper ? "SuperAdmin" : "ShopOwner";

    fetchUserShopsAndSync(email);

    if (shopChipContainer) shopChipContainer.classList.remove("hidden");
    if (deskTab) deskTab.classList.remove("hidden");
    if (ownerTab) ownerTab.classList.remove("hidden");

    if (mobileTabDesk) mobileTabDesk.classList.remove("hidden");
    if (mobileTabOwner) mobileTabOwner.classList.remove("hidden");

    if (authBtnLabel) {
      if (isSuper) {
        authBtnLabel.innerHTML = `<span>👑 Admin ▾</span>`;
      } else {
        authBtnLabel.innerHTML = `<span>👤 ${escapeHtml(email)} ▾</span>`;
      }
    }

    if (dropdownUserEmail) {
      dropdownUserEmail.textContent = isSuper ? "👑 Platform Administrator" : `💈 Shop Owner: ${email}`;
    }

    if (mobileDrawerUserEmail) {
      mobileDrawerUserEmail.textContent = isSuper ? "👑 Platform Administrator" : email;
    }

    if (mobileDrawerAvatarIcon) {
      mobileDrawerAvatarIcon.textContent = isSuper ? "👑" : "👤";
    }

    if (superAdminTab) {
      if (isSuper) superAdminTab.classList.remove("hidden");
      else superAdminTab.classList.add("hidden");
    }

    if (mobileTabSuperAdmin) {
      if (isSuper) mobileTabSuperAdmin.classList.remove("hidden");
      else mobileTabSuperAdmin.classList.add("hidden");
    }

    if (itemSuperAdmin) {
      if (isSuper) itemSuperAdmin.classList.remove("hidden");
      else itemSuperAdmin.classList.add("hidden");
    }

    if (itemSettings) {
      if (isSuper) itemSettings.classList.remove("hidden");
      else itemSettings.classList.add("hidden");
    }

    if (itemArchitecture) {
      if (isSuper) itemArchitecture.classList.remove("hidden");
      else itemArchitecture.classList.add("hidden");
    }

    if (settingsBtn) {
      if (isSuper) settingsBtn.classList.remove("hidden");
      else settingsBtn.classList.add("hidden");
    }

    if (itemAuthActionLabel) {
      itemAuthActionLabel.textContent = "🚪 Sign Out";
    }

    if (mobileItemAuthActionLabel) {
      mobileItemAuthActionLabel.textContent = "🚪 Sign Out";
    }

    if (mobileDrawerShopBadge) {
      if (state.config && state.config.shopName) {
        mobileDrawerShopBadge.classList.remove("hidden");
        setElText("mobile-drawer-shop-name", state.config.shopName);
      }
    }

    if (isSuper) {
      const superAdminEmailLabel = document.getElementById("superadmin-email-label");
      if (superAdminEmailLabel) superAdminEmailLabel.textContent = "Platform Administrator";
      loadSuperAdminShops();
    }
  } else if (state.isDemoMode) {
    state.userRole = "Guest";
    if (shopChipContainer) shopChipContainer.classList.remove("hidden");
    if (deskTab) deskTab.classList.remove("hidden");
    if (ownerTab) ownerTab.classList.remove("hidden");
    if (mobileTabDesk) mobileTabDesk.classList.remove("hidden");
    if (mobileTabOwner) mobileTabOwner.classList.remove("hidden");
    if (mobileTabSuperAdmin) mobileTabSuperAdmin.classList.add("hidden");

    if (authBtnLabel) authBtnLabel.textContent = "🔑 Sign In";
    if (dropdownUserEmail) dropdownUserEmail.textContent = "Guest Sandbox Mode";
    if (mobileDrawerUserEmail) mobileDrawerUserEmail.textContent = "Guest Sandbox Mode";
    if (mobileDrawerAvatarIcon) mobileDrawerAvatarIcon.textContent = "🎮";
    if (mobileDrawerShopBadge) {
      mobileDrawerShopBadge.classList.remove("hidden");
      setElText("mobile-drawer-shop-name", "Main St Barbers");
    }

    if (superAdminTab) superAdminTab.classList.add("hidden");
    if (itemSuperAdmin) itemSuperAdmin.classList.add("hidden");
    if (itemSettings) itemSettings.classList.add("hidden");
    if (itemArchitecture) itemArchitecture.classList.add("hidden");
    if (settingsBtn) settingsBtn.classList.add("hidden");

    if (itemAuthActionLabel) {
      itemAuthActionLabel.textContent = "🔑 Sign In / Register";
    }
    if (mobileItemAuthActionLabel) {
      mobileItemAuthActionLabel.textContent = "🔑 Sign In / Register";
    }
  } else {
    state.userRole = "Guest";
    if (shopChipContainer) shopChipContainer.classList.add("hidden");
    if (deskTab) deskTab.classList.add("hidden");
    if (ownerTab) ownerTab.classList.add("hidden");
    if (mobileTabDesk) mobileTabDesk.classList.add("hidden");
    if (mobileTabOwner) mobileTabOwner.classList.add("hidden");
    if (mobileTabSuperAdmin) mobileTabSuperAdmin.classList.add("hidden");

    if (authBtnLabel) authBtnLabel.textContent = "🔑 Sign In";
    if (dropdownUserEmail) dropdownUserEmail.textContent = "Guest User";
    if (mobileDrawerUserEmail) mobileDrawerUserEmail.textContent = "Guest User";
    if (mobileDrawerAvatarIcon) mobileDrawerAvatarIcon.textContent = "👤";
    if (mobileDrawerShopBadge) mobileDrawerShopBadge.classList.add("hidden");

    if (superAdminTab) superAdminTab.classList.add("hidden");
    if (itemSuperAdmin) itemSuperAdmin.classList.add("hidden");
    if (itemSettings) itemSettings.classList.add("hidden");
    if (itemArchitecture) itemArchitecture.classList.add("hidden");
    if (settingsBtn) settingsBtn.classList.add("hidden");

    if (itemAuthActionLabel) {
      itemAuthActionLabel.textContent = "🔑 Sign In / Register";
    }
    if (mobileItemAuthActionLabel) {
      mobileItemAuthActionLabel.textContent = "🔑 Sign In / Register";
    }
  }
}

function handleAuthButtonClick(event) {
  if (event) event.stopPropagation();
  if (state.user) {
    toggleDropdown(event, "account-dropdown");
  } else {
    openAuthModal();
  }
}

function handleSignOut(e) {
  if (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  // 1. Unsubscribe real-time cloud snapshot listeners
  if (typeof unsubscribeSnapshot === "function") {
    try { unsubscribeSnapshot(); } catch (err) {}
    unsubscribeSnapshot = null;
  }

  // 2. Clear state variables
  state.user = null;
  state.userRole = "Guest";
  state.registeredShops = [];
  state.myShops = [{ slug: "main-st-barbers", shopName: "Main St Barbers" }];
  state.config.planTitle = "Starter Tier (Free)";
  state.config.planPrice = 0;

  // 3. Clear all cached storage data
  try {
    localStorage.removeItem("waitlink_my_shops");
    localStorage.removeItem("waitlink_config");
    localStorage.removeItem("waitlink_pricing_tiers");
    localStorage.removeItem("waitlink_sound_enabled");
    sessionStorage.clear();
  } catch (err) {}

  // 4. Clean URL parameters (remove ?payment=..., ?tier=..., ?s=... on logout)
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 5. Sign out Firebase Auth
  try {
    if (window.firebase && firebase.apps && firebase.apps.length > 0 && firebase.auth) {
      if (firebase.auth().currentUser) {
        firebase.auth().signOut().catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Firebase signout error handled:", err);
  }

  // 6. Reset active shop to default demo sandbox mode for logged out guests
  launchDemoMode();
  applyUserRole(null);
  renderShopDropdown();
  renderAll();
  switchView("home");
  showToast("Logged out successfully");
}

function setAuthError(message) {
  const banner = document.getElementById("auth-error-banner");
  const text = document.getElementById("auth-error-text");
  if (banner && text) {
    if (message) {
      text.textContent = message.replace(/^⚠️\s*/, "");
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
      text.textContent = "";
    }
  }
}

function clearAuthError() {
  setAuthError("");
}

function setAuthMode(registerMode) {
  isRegistering = !!registerMode;
  clearAuthError();
  const title = document.getElementById("auth-modal-title");
  const submitBtn = document.getElementById("auth-submit-btn");
  const toggleBtn = document.getElementById("auth-toggle-btn");
  const switchText = document.getElementById("auth-switch-text");
  const passwordHint = document.getElementById("auth-password-hint");
  const passwordInput = document.getElementById("auth-password");

  if (isRegistering) {
    if (title) title.textContent = "🚀 Register New Shop Account";
    if (submitBtn) submitBtn.textContent = "Create Account & Set Up Shop";
    if (switchText) switchText.textContent = "Already have an account?";
    if (toggleBtn) toggleBtn.textContent = "Sign In Instead";
    if (passwordHint) passwordHint.style.display = "block";
    if (passwordInput) passwordInput.setAttribute("autocomplete", "new-password");
  } else {
    if (title) title.textContent = "🔑 Sign In to WaitLink";
    if (submitBtn) submitBtn.textContent = "Sign In";
    if (switchText) switchText.textContent = "New Business Owner?";
    if (toggleBtn) toggleBtn.textContent = "Create Shop Account";
    if (passwordHint) passwordHint.style.display = "none";
    if (passwordInput) passwordInput.setAttribute("autocomplete", "current-password");
  }
}

function openAuthModal(forRegister = false) {
  clearAuthError();
  setAuthMode(forRegister);
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeAuthModal() {
  clearAuthError();
  pendingCreateShopAfterAuth = false;
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("hidden");
}

function toggleAuthMode() {
  setAuthMode(!isRegistering);
}

function openEmailPromptModal() {
  closeAuthModal();
  const modal = document.getElementById("email-prompt-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeEmailPromptModal() {
  const modal = document.getElementById("email-prompt-modal");
  if (modal) modal.classList.add("hidden");
}

function handleEmailPromptSubmit(event) {
  event.preventDefault();
  const input = document.getElementById("prompt-email-input");
  const email = input ? input.value.trim() : "";
  if (!email) return;

  const user = { email: email };
  state.user = user;
  sessionStorage.setItem("waitlink_session_user", JSON.stringify(user));
  applyUserRole(user);
  closeEmailPromptModal();

  if (email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
    switchView("superadmin");
    showToast("👑 Welcome Platform Administrator");
  } else {
    if (isRegistering) {
      openOnboardingModal();
    } else {
      switchView("owner");
      showToast(`💈 Welcome back, ${email}!`);
    }
  }
}

function signInWithGoogle() {
  if (!ensureFirebaseInitialized() || !firebase.auth) {
    showToast("⚠️ Firebase Auth is not available. Please enter your email.");
    openEmailPromptModal();
    return;
  }

  showToast("🔍 Connecting to Google Auth...");
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // On mobile browsers (e.g. iOS Safari), popups are blocked by default — use redirect
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    showToast("Redirecting to Google Sign-In...");
    firebase.auth().signInWithRedirect(provider).catch(err => {
      console.warn("Google Redirect Error:", err);
      if (err && err.code === "auth/unauthorized-domain") {
        showToast("⚠️ Domain not yet authorized in Firebase Console.");
      } else {
        showToast(`⚠️ ${err.message || 'Redirect failed'}`);
      }
      openEmailPromptModal();
    });
    return;
  }

  firebase.auth().signInWithPopup(provider).then(result => {
    if (result && result.user) {
      state.user = result.user;
      sessionStorage.setItem("waitlink_session_user", JSON.stringify(result.user));
      applyUserRole(result.user);
      const wasPendingShop = pendingCreateShopAfterAuth || isRegistering;
      closeAuthModal();
      const email = result.user.email || "";
      if (email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
        switchView("superadmin");
        showToast(`👑 Welcome SuperAdmin (${email})`);
      } else if (wasPendingShop) {
        pendingCreateShopAfterAuth = false;
        switchView("owner");
        showToast(`💈 Welcome ${result.user.displayName || email}! Let's set up your shop.`);
        openOnboardingModal();
      } else {
        switchView("owner");
        showToast(`💈 Welcome ${result.user.displayName || email}!`);
      }
    }
  }).catch(err => {
    console.warn("Google Popup Auth Error:", err);
    if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user") {
      showToast("Redirecting to Google Sign-In...");
      firebase.auth().signInWithRedirect(provider).catch(redirectErr => {
        console.warn("Redirect fallback error:", redirectErr);
        if (redirectErr && redirectErr.code === "auth/unauthorized-domain") {
          showToast("⚠️ Domain not yet authorized in Firebase Console.");
        }
        openEmailPromptModal();
      });
    } else if (err.code === "auth/unauthorized-domain") {
      showToast("⚠️ Domain waitlink.app not authorized in Firebase Console yet.");
      openEmailPromptModal();
    } else {
      showToast(`⚠️ Auth error: ${err.message || err.code}`);
      openEmailPromptModal();
    }
  });
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById("auth-email");
  const passwordInput = document.getElementById("auth-password");
  const submitBtn = document.getElementById("auth-submit-btn");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  if (!email || !password) return;

  clearAuthError();

  if (!ensureFirebaseInitialized() || !firebase.auth) {
    const errorMsg = "⚠️ Firebase Auth service is currently unavailable. Please check your connection.";
    setAuthError(errorMsg);
    showToast(errorMsg);
    return;
  }

  // Client-side minimum password validation
  if (isRegistering && password.length < 6) {
    const errorMsg = "⚠️ Password must be at least 6 characters long.";
    setAuthError(errorMsg);
    showToast(errorMsg);
    if (passwordInput) passwordInput.focus();
    return;
  }

  // Set loading state on submit button
  const originalBtnText = submitBtn ? submitBtn.textContent : (isRegistering ? "Create Account & Set Up Shop" : "Sign In");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = isRegistering ? "Creating Account..." : "Signing In...";
  }

  if (isRegistering) {
    // =========================================================================
    // 1. REAL FIREBASE USER REGISTRATION (Create new account)
    // =========================================================================
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then(result => {
        if (result && result.user) {
          state.user = result.user;
          sessionStorage.setItem("waitlink_session_user", JSON.stringify(result.user));
          applyUserRole(result.user);
          closeAuthModal();
          showToast(`🎉 Welcome to WaitLink! Account registered for ${email}.`);
          if (emailInput) emailInput.value = "";
          if (passwordInput) passwordInput.value = "";

          // Launch the Shop Onboarding Setup Wizard for new business owners
          if (email.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()) {
            openOnboardingModal();
          } else {
            switchView("superadmin");
          }
        }
      })
      .catch(err => {
        console.warn("Firebase Registration Error:", err);
        let errorMsg = "Registration failed. Please try again.";
        switch (err.code) {
          case "auth/email-already-in-use":
            errorMsg = "⚠️ An account with this email already exists. Please sign in instead.";
            if (isRegistering) toggleAuthMode();
            break;
          case "auth/invalid-email":
            errorMsg = "⚠️ Please enter a valid email address.";
            break;
          case "auth/weak-password":
            errorMsg = "⚠️ Password is too weak. Please use at least 6 characters.";
            break;
          case "auth/operation-not-allowed":
            errorMsg = "⚠️ Email/Password accounts are not enabled in Firebase Console.";
            break;
          case "auth/network-request-failed":
            errorMsg = "⚠️ Network error. Please check your internet connection.";
            break;
          default:
            errorMsg = `⚠️ ${err.message || 'Registration failed.'}`;
        }
        setAuthError(errorMsg);
        showToast(errorMsg);
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      });
  } else {
    // =========================================================================
    // 2. REAL FIREBASE USER SIGN-IN (Verify existing credentials)
    // =========================================================================
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(result => {
        if (result && result.user) {
          state.user = result.user;
          sessionStorage.setItem("waitlink_session_user", JSON.stringify(result.user));
          applyUserRole(result.user);
          const wasPendingShop = pendingCreateShopAfterAuth;
          closeAuthModal();
          if (emailInput) emailInput.value = "";
          if (passwordInput) passwordInput.value = "";

          const isSuper = email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
          if (isSuper) {
            switchView("superadmin");
            showToast("👑 Welcome Platform Administrator");
          } else if (wasPendingShop) {
            pendingCreateShopAfterAuth = false;
            switchView("owner");
            showToast(`💈 Welcome back, ${email}! Let's set up your shop.`);
            openOnboardingModal();
          } else {
            switchView("owner");
            showToast(`💈 Welcome back, ${email}!`);
          }
        }
      })
      .catch(err => {
        console.warn("Firebase Sign-In Error:", err);
        let errorMsg = "Sign-in failed. Please verify your credentials.";
        switch (err.code) {
          case "auth/user-not-found":
            errorMsg = "⚠️ No account found with this email. Click 'Create Shop Account' below.";
            break;
          case "auth/wrong-password":
          case "auth/invalid-credential":
            errorMsg = "⚠️ Incorrect password. Please try again.";
            break;
          case "auth/invalid-email":
            errorMsg = "⚠️ Please enter a valid email address.";
            break;
          case "auth/too-many-requests":
            errorMsg = "⚠️ Too many failed attempts. Please wait a moment and try again.";
            break;
          case "auth/user-disabled":
            errorMsg = "⚠️ This account has been disabled.";
            break;
          case "auth/network-request-failed":
            errorMsg = "⚠️ Network error. Please check your internet connection.";
            break;
          default:
            errorMsg = `⚠️ ${err.message || 'Invalid email or password.'}`;
        }
        setAuthError(errorMsg);
        showToast(errorMsg);
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      });
  }
}

/* ==========================================================================
   SHOP ONBOARDING WIZARD (BUSINESS OWNER)
   ========================================================================== */

function handleOnboardingSubmit(event) {
  event.preventDefault();

  // Strict Auth Gate: Ensure user is authenticated
  if (!state.user || !state.user.email) {
    showToast("⚠️ Authentication required. Please register or sign in to set up your shop.");
    closeOnboardingModal();
    pendingCreateShopAfterAuth = true;
    openAuthModal(true);
    return;
  }

  const nameInput = document.getElementById("onboard-shopname") || document.getElementById("new-shop-name");
  const slugInput = document.getElementById("onboard-slug") || document.getElementById("new-shop-slug");

  const shopName = nameInput ? nameInput.value.trim() : "";
  let slug = slugInput ? slugInput.value.trim() : "";

  if (!shopName) {
    showToast("Please enter a shop name");
    return;
  }

  if (!slug) {
    slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Check for slug collision against existing directory
  const currentEmail = (state.user.email || "").toLowerCase();
  const isExistingOwned = state.myShops && state.myShops.some(s => s.slug === slug);
  const isCollision = !isExistingOwned && state.registeredShops && state.registeredShops.some(s => s.slug === slug && (s.ownerEmail || "").toLowerCase() !== currentEmail);

  if (isCollision) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    slug = `${slug}-${randomSuffix}`;
    showToast(`Notice: Reserved slug collision auto-resolved to "${slug}"`);
  }

  // Read selected Subscription Plan Tier
  const planSelect = document.getElementById("onboard-plan");
  let planTitle = "Pro Business Tier";
  let planPrice = 15;
  if (planSelect) {
    const selectedOpt = planSelect.options[planSelect.selectedIndex];
    if (selectedOpt) {
      planTitle = selectedOpt.getAttribute("data-title") || "Pro Business Tier";
      planPrice = parseInt(selectedOpt.getAttribute("data-price") || "15", 10);
    }
  }

  const address = document.getElementById("onboard-address") ? document.getElementById("onboard-address").value.trim() : "";
  const phone = document.getElementById("onboard-phone") ? document.getElementById("onboard-phone").value.trim() : "";
  const promoText = document.getElementById("onboard-promo-text") ? document.getElementById("onboard-promo-text").value.trim() : "";
  const promoStart = document.getElementById("onboard-promo-start") ? document.getElementById("onboard-promo-start").value : "";
  const promoEnd = document.getElementById("onboard-promo-end") ? document.getElementById("onboard-promo-end").value : "";
  const baseline = (document.getElementById("onboard-baseline") ? parseInt(document.getElementById("onboard-baseline").value, 10) : 0) || 20;

  // Clear previous shop's in-memory queue & history for the new shop
  state.queue = [];
  state.history = [];

  state.config.shopName = shopName;
  state.config.slug = slug;
  state.config.address = address;
  state.config.phone = phone;
  state.config.ownerEmail = state.user.email;
  state.config.planTitle = planTitle;
  state.config.planPrice = planPrice;
  state.config.promoText = promoText;
  state.config.promoStart = promoStart;
  state.config.promoEnd = promoEnd;
  state.config.estBaseWaitMin = baseline;
  state.isDemoMode = false;

  // Remove legacy global keys so no demo contamination remains
  localStorage.removeItem("waitlink_queue");
  localStorage.removeItem("waitlink_history");

  // Update browser URL query string to match newly created shop
  try {
    const newUrl = `${window.location.pathname}?shop=${slug}`;
    window.history.pushState({ shop: slug }, "", newUrl);
  } catch (e) {}

  // Explicitly hide demo banner
  const demoBanner = document.getElementById("demo-mode-banner");
  if (demoBanner) demoBanner.classList.add("hidden");

  saveConfig();

  // Register shop in Firestore with clean queue & history and verified owner
  if (db) {
    db.collection("shops").doc(slug).set({
      name: shopName,
      shopName: shopName,
      slug: slug,
      address: address,
      phone: phone,
      planTitle: planTitle,
      planPrice: planPrice,
      ownerEmail: state.user.email,
      promoText: promoText,
      promoStart: promoStart,
      promoEnd: promoEnd,
      estBaseWaitMin: baseline,
      queue: [],
      history: [],
      createdAt: Date.now()
    }, { merge: true }).catch(err => console.error("Firestore shop save error:", err));
    subscribeFirestore();
  }

  saveData();
  generateQRCode();
  renderAll();
  closeOnboardingModal();
  switchView("desk");
  showToast(`🎉 Live Waitlist for "${shopName}" Launched!`);
  openRegistrationSuccessModal(shopName, slug, state.user.email);
}

let lastRegisteredEmailPayload = null;

function openRegistrationSuccessModal(shopName, slug, ownerEmail) {
  const modal = document.getElementById("modal-registration-success");
  if (!modal) return;

  const emailVal = ownerEmail || (state.user ? state.user.email : "") || "owner@waitlink.app";
  const baseUrl = getPublicUrl().replace(/\?.*$/, "");
  const ownerUrl = `${baseUrl}?s=${slug}&view=owner`;
  const deskUrl = `${baseUrl}?s=${slug}&view=desk`;
  const publicUrl = `${baseUrl}?s=${slug}&view=public`;

  setElText("reg-success-shop-name", `🎉 ${shopName} Live & Registered!`);
  setElText("reg-success-shop-title", shopName);
  setElText("reg-success-email-val", emailVal);

  setElText("reg-link-owner-text", ownerUrl.replace("https://", ""));
  setElText("reg-link-desk-text", deskUrl.replace("https://", ""));
  setElText("reg-link-public-text", publicUrl.replace("https://", ""));

  const ownerBtn = document.getElementById("reg-link-owner-btn");
  const deskBtn = document.getElementById("reg-link-desk-btn");
  const publicBtn = document.getElementById("reg-link-public-btn");
  const mailtoBtn = document.getElementById("reg-success-mailto-btn");

  if (ownerBtn) ownerBtn.href = ownerUrl;
  if (deskBtn) deskBtn.href = deskUrl;
  if (publicBtn) publicBtn.href = publicUrl;

  // Render QR Code in Onboarding Complete Modal
  const qrBox = document.getElementById("reg-success-qr-box");
  if (qrBox) {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicUrl)}&margin=1`;
    qrBox.innerHTML = `<img src="${qrApiUrl}" alt="Lobby QR Code" style="width: 140px; height: 140px; display: block; margin: 0 auto; border-radius: 8px;">`;
  }

  const emailSubject = encodeURIComponent(`🚀 Successful Registration: Welcome ${shopName} to WaitLink!`);
  const emailBodyStr = `Welcome to WaitLink!

Congratulations on registering ${shopName}! Your walk-in line management system is live and ready to serve your customers.

Here are your official shop links & credentials:

🔑 Owner Admin Portal:
${ownerUrl}

💈 Front Desk Queue Controller:
${deskUrl}

📱 Customer Live Check-In Page:
${publicUrl}

Registered Owner Email: ${emailVal}

Need help or want to customize your shop branding? Log into your Owner Admin Portal anytime!

Best regards,
The WaitLink Team
https://waitlink.app`;

  if (mailtoBtn) mailtoBtn.href = `mailto:${encodeURIComponent(emailVal)}?subject=${emailSubject}&body=${encodeURIComponent(emailBodyStr)}`;

  lastRegisteredEmailPayload = {
    shopName,
    emailVal,
    ownerUrl,
    deskUrl,
    publicUrl,
    fullText: emailBodyStr
  };

  modal.classList.remove("hidden");
  modal.style.display = "flex";
  sendAutomatedOnboardingEmail(shopName, slug, emailVal, ownerUrl, deskUrl, publicUrl);
}

function goToConfigSection(section) {
  closeRegistrationSuccessModal();
  switchView('owner');
  
  setTimeout(() => {
    if (section === 'services') {
      const el = document.getElementById("services-table-container") || document.getElementById("owner-services-heading");
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (section === 'branding') {
      const el = document.getElementById("promo-text-input") || document.getElementById("shop-name-input");
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 200);
}

function sendAutomatedOnboardingEmail(shopName, slug, emailVal, ownerUrl, deskUrl, publicUrl) {
  if (!emailVal || emailVal === "owner@waitlink.app") return;

  const payload = {
    _subject: `🚀 Successful Registration: Welcome ${shopName} to WaitLink!`,
    "Shop Name": shopName,
    "Registered Owner Email": emailVal,
    "🔑 Owner Admin Portal Link": ownerUrl,
    "💈 Front Desk Controller Link": deskUrl,
    "📱 Public Customer Check-In Page Link": publicUrl,
    "Registration Date": new Date().toLocaleString(),
    "_template": "table"
  };

  setElText("reg-success-email-notice", `⏳ Sending confirmation email to ${emailVal}...`);

  fetch(`https://formsubmit.co/ajax/${encodeURIComponent(emailVal)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  }).then(res => res.json())
    .then(data => {
      setElText("reg-success-email-notice", `✅ Confirmation email automatically sent to ${emailVal}`);
      showToast(`📧 Confirmation email sent to ${emailVal}`);
    })
    .catch(err => {
      setElText("reg-success-email-notice", `📧 Confirmation details ready for ${emailVal}`);
    });
}

function closeRegistrationSuccessModal() {
  const modal = document.getElementById("modal-registration-success");
  if (modal) modal.classList.add("hidden");
}

function copyRegistrationEmailDetails() {
  if (!lastRegisteredEmailPayload) return;
  const textToCopy = lastRegisteredEmailPayload.fullText;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast("📋 Shop links & registration confirmation copied to clipboard!");
    });
  } else {
    showToast("📋 Shop details ready!");
  }
}

/* ==========================================================================
   SUPERADMIN MULTI-TENANT DIRECTORY (senthil930@gmail.com)
   ========================================================================== */

function loadSuperAdminShops() {
  if (!db || state.userRole !== "SuperAdmin") return;

  db.collection("shops").get().then(snapshot => {
    state.registeredShops = [];
    snapshot.forEach(doc => {
      state.registeredShops.push({ id: doc.id, ...doc.data() });
    });
    renderSuperAdminShopsTable();
  }).catch(err => {
    console.error("Error fetching shops for SuperAdmin:", err);
  });
}

// Inspect a specific shop's Front Desk
function inspectShop(slug) {
  if (!slug) return;
  
  let targetName = slug;
  if (Array.isArray(state.registeredShops)) {
    const found = state.registeredShops.find(s => (s.slug || s.id) === slug);
    if (found) targetName = found.name || found.shopName || slug;
  }
  if (targetName === slug && Array.isArray(state.myShops)) {
    const foundMy = state.myShops.find(s => s.slug === slug);
    if (foundMy) targetName = foundMy.shopName || slug;
  }

  // Reset in-memory queue & history before switching to target shop
  state.queue = [];
  state.history = [];

  state.config.slug = slug;
  state.config.shopName = targetName;
  state.isDemoMode = (slug === "main-st-barbers");

  loadData();
  saveConfig();

  if (db) {
    subscribeFirestore(true);
  }

  try {
    const newUrl = `${window.location.pathname}?s=${slug}`;
    window.history.pushState({ shop: slug }, "", newUrl);
  } catch (e) {}

  renderAll();
  generateQRCode();
  switchView("desk");
  showToast(`💈 Switched to "${targetName}"`);
}

function openSettingsForShop(slug) {
  inspectShop(slug);
  openSettingsModal();
}

function renderSuperAdminShopsTable() {
  const tbody = document.getElementById("superadmin-shops-tbody");
  const countEl = document.getElementById("superadmin-total-shops");
  const mrrValEl = document.getElementById("superadmin-mrr-val");
  const mrrCapEl = document.getElementById("superadmin-mrr-cap");

  if (!tbody) return;

  const defaultShops = [
    { id: "main-st-barbers", name: "Main St Barbers", slug: "main-st-barbers", ownerEmail: "owner@waitlink.app", planTitle: "Pro Business Tier", planPrice: 15 },
    { id: "snailclinic", name: "Senthil Nail clinic", slug: "snailclinic", ownerEmail: "owner@snailclinic.com", planTitle: "Starter Tier (Free)", planPrice: 0 }
  ];

  const shops = (state.registeredShops && state.registeredShops.length > 0) ? state.registeredShops : defaultShops;

  if (countEl) countEl.textContent = shops.length;

  let totalMRR = 0;

  tbody.innerHTML = shops.map(shop => {
    const shopSlug = shop.slug || shop.id || 'main-st-barbers';
    const shopName = shop.name || shop.shopName || shopSlug;
    const price = shop.planPrice !== undefined ? shop.planPrice : 0;
    totalMRR += price;
    const planDisplay = shop.planTitle ? `${shop.planTitle} ($${price}/mo)` : (price === 0 ? "Starter Tier ($0/mo)" : `$${price} / mo`);

    return `
      <tr>
        <td><strong>${escapeHtml(shopName)}</strong></td>
        <td><code>waitlink.app?s=${escapeHtml(shopSlug)}</code></td>
        <td>${escapeHtml(shop.ownerEmail || 'owner@waitlink.app')}</td>
        <td><span class="status-tag called" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">${escapeHtml(planDisplay)}</span></td>
        <td><span class="status-pill"><span class="pulse-dot"></span> Active</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-text-sm" onclick="inspectShop('${escapeHtml(shopSlug)}')">Inspect Desk</button>
            <button class="btn-text-sm" onclick="openSettingsForShop('${escapeHtml(shopSlug)}')">Settings ⚙️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  if (mrrValEl) mrrValEl.textContent = `$${totalMRR} / mo`;
  if (mrrCapEl) mrrCapEl.textContent = `Calculated across ${shops.length} active tenant shop${shops.length === 1 ? '' : 's'}`;
}

// SuperAdmin Sub-Tab Switcher & Support Inbox Loader
function switchSuperTab(tabKey) {
  const tabs = ['shops', 'pricing', 'support'];
  tabs.forEach(t => {
    const btn = document.getElementById(`supertab-${t}`);
    const panel = document.getElementById(`superpanel-${t}`);
    if (btn) {
      if (t === tabKey) btn.classList.add("active");
      else btn.classList.remove("active");
    }
    if (panel) {
      if (t === tabKey) panel.classList.remove("hidden");
      else panel.classList.add("hidden");
    }
  });

  if (tabKey === 'support') {
    loadSupportInquiries();
  }
}



// Utility: Escape HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================================
   SUPERADMIN PRICING CONFIGURATOR ENGINE & AUDIT LOGGING
   ========================================================================== */

const DEFAULT_TIER_FEATURES = {
  t1: [
    { text: "1 Shop Location", enabled: true },
    { text: "Up to 100 Monthly Check-ins", enabled: true },
    { text: "Printable Window QR Poster", enabled: true },
    { text: "1-Tap Front Desk Control", enabled: true },
    { text: "Basic Wait Time Estimator", enabled: true }
  ],
  t2: [
    { text: "Unlimited Monthly Check-ins", enabled: true },
    { text: "Custom Logo Branding & Colors", enabled: true },
    { text: "Owner Business Intelligence Dashboard", enabled: true },
    { text: "Peak Rush Window & Walk-Away Analytics", enabled: true },
    { text: "Multi-Device Front Desk Sync", enabled: true },
    { text: "Priority Cloud Firestore Latency", enabled: true }
  ],
  t3: [
    { text: "Unlimited Locations & Staff Accounts", enabled: true },
    { text: "Multi-Tenant SuperAdmin Access", enabled: true },
    { text: "Custom Domain CNAME Routing", enabled: true },
    { text: "Dedicated Support Manager", enabled: true },
    { text: "99.99% Cloud SLA", enabled: true }
  ]
};

if (!state.adminFeatures) {
  state.adminFeatures = JSON.parse(JSON.stringify(DEFAULT_TIER_FEATURES));
}

function restoreDefaultTierFeatures(tierKey) {
  if (!DEFAULT_TIER_FEATURES[tierKey]) return;
  state.adminFeatures[tierKey] = JSON.parse(JSON.stringify(DEFAULT_TIER_FEATURES[tierKey]));
  renderAdminFeatureManager(tierKey);
  showToast(`Restored default features for Tier ${tierKey.toUpperCase().replace('T', '')}`);
}

function switchSuperTab(tabName) {
  const tabShops = document.getElementById("supertab-shops");
  const tabPricing = document.getElementById("supertab-pricing");
  const panelShops = document.getElementById("superpanel-shops");
  const panelPricing = document.getElementById("superpanel-pricing");

  if (tabName === "pricing") {
    if (tabShops) tabShops.classList.remove("active");
    if (tabPricing) tabPricing.classList.add("active");
    if (panelShops) panelShops.classList.add("hidden");
    if (panelPricing) panelPricing.classList.remove("hidden");
    loadPricingConfigUI();
  } else {
    if (tabShops) tabShops.classList.add("active");
    if (tabPricing) tabPricing.classList.remove("active");
    if (panelShops) panelShops.classList.remove("hidden");
    if (panelPricing) panelPricing.classList.add("hidden");
  }
}

function renderAdminFeatureManager(tierKey) {
  const container = document.getElementById(`pricing-${tierKey}-feature-manager`);
  if (!container) return;
  const list = state.adminFeatures[tierKey] || [];

  container.innerHTML = list.map((f, idx) => {
    const isEnabled = f.enabled !== false;
    const btnBg = isEnabled ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(239, 68, 68, 0.2)';
    const btnColor = isEnabled ? '#fff' : '#ef4444';
    const btnBorder = isEnabled ? '1px solid #10b981' : '1px solid rgba(239, 68, 68, 0.4)';
    const textDecoration = isEnabled ? 'none' : 'line-through';
    const textOpacity = isEnabled ? '1' : '0.65';

    return `
      <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-input); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <button type="button" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; border-radius: 4px; border: ${btnBorder}; cursor: pointer; background: ${btnBg}; color: ${btnColor}; transition: all 0.15s ease;" onclick="toggleAdminFeatureStatus('${tierKey}', ${idx})" title="Click to toggle Enabled vs Disabled">
          ${isEnabled ? '✓ Enabled' : '✕ Disabled (Strikethrough)'}
        </button>
        <input type="text" value="${escapeHtml(f.text)}" style="flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 0.85rem; text-decoration: ${textDecoration}; opacity: ${textOpacity};" oninput="updateAdminFeatureText('${tierKey}', ${idx}, this.value)">
        <button type="button" class="btn-text-sm" style="color: var(--accent-rose); font-size: 0.75rem; padding: 0.2rem 0.4rem;" onclick="deleteAdminFeatureItem('${tierKey}', ${idx})" title="Remove Feature Item">✕</button>
      </div>
    `;
  }).join("");

  syncFeatureManagerToTextarea(tierKey);
}

function toggleAdminFeatureStatus(tierKey, index) {
  if (!state.adminFeatures[tierKey] || !state.adminFeatures[tierKey][index]) return;
  state.adminFeatures[tierKey][index].enabled = !state.adminFeatures[tierKey][index].enabled;
  renderAdminFeatureManager(tierKey);
}

function updateAdminFeatureText(tierKey, index, newText) {
  if (!state.adminFeatures[tierKey] || !state.adminFeatures[tierKey][index]) return;
  state.adminFeatures[tierKey][index].text = newText;
  syncFeatureManagerToTextarea(tierKey);
}

function addAdminFeatureItem(tierKey) {
  if (!state.adminFeatures[tierKey]) state.adminFeatures[tierKey] = [];
  state.adminFeatures[tierKey].push({ text: "New Feature Item", enabled: true });
  renderAdminFeatureManager(tierKey);
}

function deleteAdminFeatureItem(tierKey, index) {
  if (!state.adminFeatures[tierKey]) return;
  state.adminFeatures[tierKey].splice(index, 1);
  renderAdminFeatureManager(tierKey);
}

function syncFeatureManagerToTextarea(tierKey) {
  const textarea = document.getElementById(`pricing-${tierKey}-features`);
  if (!textarea) return;
  const list = state.adminFeatures[tierKey] || [];
  textarea.value = list.map(f => f.enabled !== false ? f.text : `[x] ${f.text}`).join("\n");
}

function parseFeatureList(text) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    let enabled = true;
    let cleanText = line;
    if (line.startsWith("[x]") || line.startsWith("[X]") || line.startsWith("OFF:") || line.startsWith("~")) {
      enabled = false;
      cleanText = line.replace(/^(\[x\]\s*|\[X\]\s*|OFF:\s*|~\s*)/, "").trim();
    } else if (line.startsWith("[v]") || line.startsWith("[V]") || line.startsWith("✓")) {
      enabled = true;
      cleanText = line.replace(/^(\[v\]\s*|\[V\]\s*|✓\s*)/, "").trim();
    }
    return { text: cleanText, enabled };
  });
}

function formatFeatureListForInput(features) {
  if (!Array.isArray(features)) return "";
  return features.map(f => {
    if (typeof f === "object" && f !== null) {
      return f.enabled !== false ? f.text : `[x] ${f.text}`;
    }
    const str = String(f || "");
    return str;
  }).join("\n");
}

function savePricingConfig() {
  const prevTiers = state.pricingTiers || (localStorage.getItem("waitlink_pricing_tiers") ? JSON.parse(localStorage.getItem("waitlink_pricing_tiers")) : null);

  const t1 = {
    id: "starter",
    badge: document.getElementById("pricing-t1-badge").value.trim() || "Starter",
    title: document.getElementById("pricing-t1-title").value.trim() || "Free Forever",
    price: document.getElementById("pricing-t1-price").value.trim() || "$0",
    desc: document.getElementById("pricing-t1-desc").value.trim(),
    features: state.adminFeatures.t1 || parseFeatureList(document.getElementById("pricing-t1-features").value)
  };

  const t2 = {
    id: "pro",
    badge: document.getElementById("pricing-t2-badge").value.trim() || "Pro Business",
    title: document.getElementById("pricing-t2-title").value.trim() || "Standard Shop",
    price: document.getElementById("pricing-t2-price").value.trim() || "$15",
    desc: document.getElementById("pricing-t2-desc").value.trim(),
    isPopular: document.getElementById("pricing-t2-popular").checked,
    features: state.adminFeatures.t2 || parseFeatureList(document.getElementById("pricing-t2-features").value)
  };

  const t3 = {
    id: "enterprise",
    badge: document.getElementById("pricing-t3-badge").value.trim() || "Enterprise",
    title: document.getElementById("pricing-t3-title").value.trim() || "Multi-Location",
    price: document.getElementById("pricing-t3-price").value.trim() || "$49",
    desc: document.getElementById("pricing-t3-desc").value.trim(),
    features: state.adminFeatures.t3 || parseFeatureList(document.getElementById("pricing-t3-features").value)
  };

  const newTiers = [t1, t2, t3];

  // Compute detailed audit diffs
  const diffs = [];
  if (prevTiers && Array.isArray(prevTiers)) {
    newTiers.forEach((nTier, idx) => {
      const pTier = prevTiers[idx];
      if (!pTier) return;

      const tName = nTier.title || `Tier ${idx + 1}`;
      if (pTier.price !== nTier.price) {
        diffs.push(`${tName}: Price changed from "${pTier.price || '$0'}" ➔ "${nTier.price}"`);
      }
      if (pTier.title !== nTier.title) {
        diffs.push(`${tName}: Plan title changed from "${pTier.title}" ➔ "${nTier.title}"`);
      }

      // Compare feature status changes
      const pFeats = (pTier.features || []).map(f => typeof f === 'object' ? f : { text: String(f), enabled: !String(f).startsWith('[x]') });
      const nFeats = nTier.features;

      nFeats.forEach(nF => {
        const matchingP = pFeats.find(p => p.text.toLowerCase() === nF.text.toLowerCase());
        if (matchingP) {
          if (matchingP.enabled !== nF.enabled) {
            const statusStr = nF.enabled ? '✓ Enabled' : '✕ Disabled (Strikethrough)';
            diffs.push(`${tName}: Feature "${nF.text}" status changed to ${statusStr}`);
          }
        } else {
          diffs.push(`${tName}: Added new feature "${nF.text}"`);
        }
      });
    });
  } else {
    diffs.push("Initial pricing config published");
  }

  state.pricingTiers = newTiers;
  localStorage.setItem("waitlink_pricing_tiers", JSON.stringify(newTiers));

  // Save Audit Log
  const auditEntry = {
    id: "audit_" + Date.now(),
    timestamp: Date.now(),
    adminEmail: (state.user && state.user.email) ? state.user.email : "senthil930@gmail.com",
    changes: diffs.length > 0 ? diffs : ["Pricing config re-published with no changes"]
  };

  // Local Audit Log Save
  let existingAudits = [];
  try {
    const savedA = localStorage.getItem("waitlink_pricing_audits");
    if (savedA) existingAudits = JSON.parse(savedA);
  } catch (e) {}
  existingAudits.unshift(auditEntry);
  localStorage.setItem("waitlink_pricing_audits", JSON.stringify(existingAudits));

  // Firestore Sync
  if (db) {
    db.collection("settings").doc("pricing_config").set({
      tiers: newTiers,
      updatedAt: Date.now(),
      updatedBy: auditEntry.adminEmail
    }, { merge: true }).catch(console.warn);

    db.collection("pricing_audits").add(auditEntry).catch(console.warn);
  }

  showToast("💾 Pricing tiers saved & published to Cloud!");
}

function loadPricingConfigUI() {
  const loadFeaturesIntoState = (tierKey, features) => {
    if (!Array.isArray(features)) return;
    state.adminFeatures[tierKey] = features.map(f => {
      if (typeof f === 'object' && f !== null) {
        return { text: f.text || '', enabled: f.enabled !== false };
      }
      const str = String(f || '').trim();
      const isOff = str.startsWith('[x]') || str.startsWith('[X]') || str.startsWith('OFF:') || str.startsWith('~');
      const clean = str.replace(/^(\[x\]\s*|\[X\]\s*|OFF:\s*|~\s*|\[v\]\s*|✓\s*)/, '');
      return { text: clean, enabled: !isOff };
    });
    renderAdminFeatureManager(tierKey);
  };

  const applyTiersToUI = (tiers) => {
    if (!Array.isArray(tiers) || tiers.length === 0) return;
    if (tiers[0]) {
      setElValue("pricing-t1-badge", tiers[0].badge || "Starter");
      setElValue("pricing-t1-title", tiers[0].title || "Free Forever");
      setElValue("pricing-t1-price", tiers[0].price || "$0");
      setElValue("pricing-t1-desc", tiers[0].desc || "");
      loadFeaturesIntoState('t1', tiers[0].features);
    }
    if (tiers[1]) {
      setElValue("pricing-t2-badge", tiers[1].badge || "Pro Business");
      setElValue("pricing-t2-title", tiers[1].title || "Standard Shop");
      setElValue("pricing-t2-price", tiers[1].price || "$15");
      setElValue("pricing-t2-desc", tiers[1].desc || "");
      loadFeaturesIntoState('t2', tiers[1].features);
      const popCb = document.getElementById("pricing-t2-popular");
      if (popCb) popCb.checked = !!tiers[1].isPopular;
    }
    if (tiers[2]) {
      setElValue("pricing-t3-badge", tiers[2].badge || "Enterprise");
      setElValue("pricing-t3-title", tiers[2].title || "Multi-Location");
      setElValue("pricing-t3-price", tiers[2].price || "$49");
      setElValue("pricing-t3-desc", tiers[2].desc || "");
      loadFeaturesIntoState('t3', tiers[2].features);
    }
  };

  // Local load first
  const saved = localStorage.getItem("waitlink_pricing_tiers");
  if (saved) {
    try { applyTiersToUI(JSON.parse(saved)); } catch (e) {}
  }

  // Live Cloud load from Firestore
  if (db) {
    db.collection("settings").doc("pricing_config").get().then(doc => {
      if (doc.exists && doc.data().tiers) {
        state.pricingTiers = doc.data().tiers;
        localStorage.setItem("waitlink_pricing_tiers", JSON.stringify(state.pricingTiers));
        applyTiersToUI(state.pricingTiers);
      }
    }).catch(console.warn);
  }
}

/* ==========================================================================
   PRICING AUDIT LOG MODAL HANDLERS
   ========================================================================== */

function openPricingAuditModal() {
  const modal = document.getElementById("pricing-audit-modal");
  const logList = document.getElementById("audit-log-list");
  if (!modal || !logList) return;

  modal.classList.remove("hidden");
  logList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Loading historical audit log...</div>`;

  const renderAudits = (audits) => {
    if (!Array.isArray(audits) || audits.length === 0) {
      logList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No historical pricing changes recorded yet.</div>`;
      return;
    }

    logList.innerHTML = audits.map(log => {
      const dateStr = new Date(log.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const changesHtml = (log.changes || []).map(c => `
        <li style="margin-bottom: 0.35rem; font-size: 0.85rem; color: #fff;">
          📌 ${escapeHtml(c)}
        </li>
      `).join("");

      return `
        <div class="card" style="padding: 1rem 1.25rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--primary);">👤 ${escapeHtml(log.adminEmail || 'SuperAdmin')}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">📅 ${dateStr}</span>
          </div>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${changesHtml}
          </ul>
        </div>
      `;
    }).join("");
  };

  // Local Audits Fallback
  let localAudits = [];
  try {
    const saved = localStorage.getItem("waitlink_pricing_audits");
    if (saved) localAudits = JSON.parse(saved);
  } catch (e) {}

  if (db) {
    db.collection("pricing_audits").orderBy("timestamp", "desc").get().then(snapshot => {
      const cloudAudits = [];
      snapshot.forEach(doc => cloudAudits.push(doc.data()));
      if (cloudAudits.length > 0) {
        localStorage.setItem("waitlink_pricing_audits", JSON.stringify(cloudAudits));
        renderAudits(cloudAudits);
      } else {
        renderAudits(localAudits);
      }
    }).catch(err => {
      console.warn("Firestore pricing_audits fetch error:", err);
      renderAudits(localAudits);
    });
  } else {
    renderAudits(localAudits);
  }
}

function closePricingAuditModal() {
  const modal = document.getElementById("pricing-audit-modal");
  if (modal) modal.classList.add("hidden");
}

function clearPricingAuditLogs() {
  if (!confirm("Are you sure you want to clear local pricing audit history?")) return;
  localStorage.removeItem("waitlink_pricing_audits");
  openPricingAuditModal();
  showToast("Local audit history cleared.");
}

/* ==========================================================================
   STRIPE SUBSCRIPTION PAYWALL & CHECKOUT ENGINE
   ========================================================================== */

let stripeConfig = {
  publishableKey: SECRETS.STRIPE_PUBLISHABLE_KEY || "pk_test_51UMbOTQa30COilZxWnUhiZ3V2WPWAoHlzQ5VpP5RXrl5nZh4XmGrSPUyHFEZgT58WG6dfbYrUjkpvz2n8AhF0qTd009iF20uN5",
  secretKey: SECRETS.STRIPE_SECRET_KEY || "",
  proPriceId: SECRETS.STRIPE_PRO_PRICE_ID || "price_1UMbOzQa30COilZx6HAwQRjB",
  resendApiKey: "",
  brevoApiKey: SECRETS.BREVO_API_KEY || ""
};
let stripeInstance = null;

// Initialize Stripe SDK and check for return payment status
function initStripePaymentEngine() {
  if (typeof window === "undefined") return;
  
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get("payment");
  const paidTier = urlParams.get("tier");
  
  if (paymentStatus === "success") {
    // Security Guard: Prevent unauthenticated URL tampering.
    // Only the authenticated shop owner or SuperAdmin can process payment return callbacks.
    const isOwner = state.user && (
      state.userRole === "SuperAdmin" || 
      (state.config.ownerEmail && state.user.email && state.config.ownerEmail.toLowerCase() === state.user.email.toLowerCase())
    );

    if (!isOwner) {
      console.warn("Security Alert: Unauthenticated payment callback detected and ignored.");
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {}
      return;
    }

    let title = paidTier === "enterprise" ? "Enterprise Tier" : "Pro Business Tier";
    let price = paidTier === "enterprise" ? 49 : 15;

    state.config.planTitle = title;
    state.config.planPrice = price;
    saveConfig();
    renderAll();
    switchView("home");

    if (db && state.config.slug) {
      db.collection("shops").doc(state.config.slug).set({
        planTitle: title,
        planPrice: price,
        updatedAt: Date.now()
      }, { merge: true }).catch(console.warn);
    }

    showToast(`🎉 Payment Confirmed! Upgraded to ${title} ($${price}/mo).`);
    try {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}
  } else if (paymentStatus === "cancelled") {
    showToast("Checkout cancelled. No charges were made.");
    try {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}
  }

  // Attempt to override config from local JSON if available
  fetch("stripe_credentials.json")
    .then(res => res.json())
    .then(data => {
      if (data) {
        if (data.stripe_publishable_key && !data.stripe_publishable_key.includes("PASTE_YOUR")) {
          stripeConfig.publishableKey = data.stripe_publishable_key.trim();
        }
        if (data.stripe_secret_key && !data.stripe_secret_key.includes("PASTE_YOUR")) {
          stripeConfig.secretKey = data.stripe_secret_key.trim();
        }
        if (data.pro_price_id && !data.pro_price_id.includes("PASTE_YOUR")) {
          stripeConfig.proPriceId = data.pro_price_id.trim();
        }
        if (data.enterprise_price_id && !data.enterprise_price_id.includes("PASTE_YOUR")) {
          stripeConfig.enterprisePriceId = data.enterprise_price_id.trim();
        }
        if (data.resend_api_key && !data.resend_api_key.includes("PASTE_YOUR")) {
          stripeConfig.resendApiKey = data.resend_api_key.trim();
        }
        if (data.sender_email && !data.sender_email.includes("PASTE_YOUR")) {
          stripeConfig.senderEmail = data.sender_email.trim();
        }
        if (data.brevo_api_key && !data.brevo_api_key.includes("PASTE_YOUR")) {
          stripeConfig.brevoApiKey = data.brevo_api_key.trim();
        }
      }
      initStripeSdk();
    })
    .catch(() => {
      initStripeSdk();
    });
}

function initStripeSdk() {
  if (stripeConfig.publishableKey && typeof Stripe !== "undefined") {
    try {
      stripeInstance = Stripe(stripeConfig.publishableKey);
      console.log("💳 Stripe.js SDK initialized with key:", stripeConfig.publishableKey.substring(0, 12) + "...");
    } catch (err) {
      console.warn("Stripe init warning:", err);
    }
  }
}

function openUpgradeModal() {
  updateUpgradeModalUI();
  const modal = document.getElementById("upgrade-modal");
  if (modal) modal.classList.remove("hidden");
}

function updateUpgradeModalUI() {
  const planPrice = state.config.planPrice !== undefined ? state.config.planPrice : 0;
  const planTitle = state.config.planTitle || "Starter Tier (Free)";

  const starterBtn = document.getElementById("tier-btn-starter");
  const proBtn = document.getElementById("tier-btn-pro");
  const enterpriseBtn = document.getElementById("tier-btn-enterprise");

  if (starterBtn) {
    if (planPrice === 0) {
      starterBtn.textContent = "✓ Current Plan (Free)";
      starterBtn.disabled = true;
      starterBtn.style.opacity = "0.7";
      starterBtn.style.cursor = "default";
    } else {
      starterBtn.textContent = "Switch to Starter ($0)";
      starterBtn.disabled = false;
      starterBtn.style.opacity = "1";
      starterBtn.style.cursor = "pointer";
    }
  }

  if (proBtn) {
    if (planPrice === 15 || planTitle.includes("Pro")) {
      proBtn.textContent = "✓ Current Active Plan";
      proBtn.disabled = true;
      proBtn.className = "btn btn-secondary btn-sm";
      proBtn.style.background = "rgba(16, 185, 129, 0.2)";
      proBtn.style.color = "#10b981";
      proBtn.style.borderColor = "#10b981";
      proBtn.style.cursor = "default";
    } else {
      proBtn.textContent = "🚀 Upgrade to Pro ($15/mo)";
      proBtn.disabled = false;
      proBtn.className = "btn btn-primary btn-sm";
      proBtn.style.background = "";
      proBtn.style.color = "";
      proBtn.style.borderColor = "";
      proBtn.style.cursor = "pointer";
    }
  }

  if (enterpriseBtn) {
    if (planPrice === 49 || planTitle.includes("Enterprise")) {
      enterpriseBtn.textContent = "✓ Current Active Plan";
      enterpriseBtn.disabled = true;
      enterpriseBtn.className = "btn btn-secondary btn-sm";
      enterpriseBtn.style.background = "rgba(99, 102, 241, 0.2)";
      enterpriseBtn.style.color = "#6366f1";
      enterpriseBtn.style.borderColor = "#6366f1";
      enterpriseBtn.style.cursor = "default";
    } else {
      enterpriseBtn.textContent = "👑 Upgrade to Enterprise ($49/mo)";
      enterpriseBtn.disabled = false;
      enterpriseBtn.className = "btn btn-secondary btn-sm";
      enterpriseBtn.style.background = "";
      enterpriseBtn.style.color = "#6366f1";
      enterpriseBtn.style.borderColor = "rgba(99, 102, 241, 0.4)";
      enterpriseBtn.style.cursor = "pointer";
    }
  }
}

function closeUpgradeModal() {
  const modal = document.getElementById("upgrade-modal");
  if (modal) modal.classList.add("hidden");
  const statusMsg = document.getElementById("stripe-checkout-status-msg");
  if (statusMsg) statusMsg.classList.add("hidden");
}

// Create a 100% Hosted Stripe Checkout Session directly
async function createStripeApiCheckoutSession(priceId, tierKey) {
  const secretKey = stripeConfig.secretKey;
  if (!secretKey || secretKey.includes("PASTE_YOUR")) return false;

  const bodyData = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'mode': 'subscription',
    'success_url': window.location.origin + window.location.pathname + `?payment=success&tier=${tierKey}`,
    'cancel_url': window.location.origin + window.location.pathname + '?payment=cancelled'
  });

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyData
    });

    const result = await res.json();
    if (result && result.url) {
      console.log("🚀 Redirecting to Stripe Checkout URL:", result.url);
      window.location.href = result.url;
      return true;
    } else if (result && result.error) {
      console.warn("Stripe API Error:", result.error.message);
      showToast("Stripe Error: " + result.error.message);
    }
  } catch (err) {
    console.error("Stripe Checkout Session Fetch Error:", err);
  }
  return false;
}

async function selectUpgradeTier(tierKey) {
  const statusMsg = document.getElementById("stripe-checkout-status-msg");
  
  if (tierKey === 'starter') {
    state.config.planTitle = "Starter Tier (Free)";
    state.config.planPrice = 0;
    saveConfig();
    renderAll();

    if (db && state.config.slug) {
      db.collection("shops").doc(state.config.slug).set({
        planTitle: "Starter Tier (Free)",
        planPrice: 0,
        updatedAt: Date.now()
      }, { merge: true }).catch(console.warn);
    }

    closeUpgradeModal();
    showToast("Switched to Starter Tier ($0/mo)");
    return;
  }

  const priceId = (tierKey === 'pro') ? stripeConfig.proPriceId : stripeConfig.enterprisePriceId;

  if (statusMsg) {
    statusMsg.textContent = "⏳ Redirecting to 100% Secure Stripe Payment Gateway...";
    statusMsg.classList.remove("hidden");
  }

  // 1. Direct Stripe REST API Checkout Session Creation (Guaranteed fast redirect)
  const sessionCreated = await createStripeApiCheckoutSession(priceId, tierKey);
  if (sessionCreated) return;

  // 2. Firestore Extension Trigger Fallback
  if (db && state.user && state.user.uid) {
    try {
      const sessionRef = await db.collection("users").doc(state.user.uid)
        .collection("checkout_sessions").add({
          price: priceId,
          success_url: window.location.origin + window.location.pathname + `?payment=success&tier=${tierKey}`,
          cancel_url: window.location.origin + window.location.pathname + "?payment=cancelled",
          mode: "subscription",
          createdAt: Date.now()
        });

      sessionRef.onSnapshot((snap) => {
        const data = snap.data();
        if (data && data.url) {
          window.location.href = data.url;
        }
      });
      return;
    } catch (err) {
      console.warn("Firestore extension trigger note:", err);
    }
  }

  showToast("Unable to open payment screen. Please check your network connection.");
}

// Automatically initialize Stripe engine on startup
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initStripePaymentEngine();
  });
}

// ==========================================
// CUSTOMER SELF-SERVICE CHECK-IN HANDLERS
// ==========================================

function openPublicCheckInModal() {
  const modal = document.getElementById("modal-customer-checkin");
  const shopSub = document.getElementById("public-checkin-shop-subtitle");
  if (shopSub) shopSub.textContent = `Checking in at ${state.config.shopName || 'WaitLink Shop'}`;
  if (modal) modal.classList.remove("hidden");
  
  const nameInput = document.getElementById("public-customer-name");
  if (nameInput) {
    nameInput.value = "";
    setTimeout(() => nameInput.focus(), 100);
  }
}

function closePublicCheckInModal() {
  const modal = document.getElementById("modal-customer-checkin");
  if (modal) modal.classList.add("hidden");
}

function handlePublicSelfCheckIn(event) {
  event.preventDefault();
  const nameInput = document.getElementById("public-customer-name");
  const phoneInput = document.getElementById("public-customer-phone");

  const customerName = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";

  if (!customerName) return;

  const newItem = {
    id: "q_" + Date.now(),
    customerName: customerName,
    phone: phone,
    checkedInAt: Date.now()
  };

  state.queue.push(newItem);
  saveData();

  closePublicCheckInModal();
  renderAll();

  // Find line position
  const queuePos = state.queue.length;
  showToast(`✅ You joined the queue! Position #${queuePos}. Timer started!`);
}

// ==========================================
// SUPERADMIN SUB-TAB & SUPPORT INBOX HANDLERS
// ==========================================

function switchSuperTab(tabName) {
  const panels = ["shops", "pricing", "support"];
  panels.forEach(p => {
    const panelEl = document.getElementById(`superpanel-${p}`);
    const tabEl = document.getElementById(`supertab-${p}`);
    if (panelEl) panelEl.classList.add("hidden");
    if (tabEl) tabEl.classList.remove("active");
  });

  const activePanel = document.getElementById(`superpanel-${tabName}`);
  const activeTab = document.getElementById(`supertab-${tabName}`);
  if (activePanel) activePanel.classList.remove("hidden");
  if (activeTab) activeTab.classList.add("active");

  if (tabName === "support") {
    loadSupportInquiries();
  }
}

function loadSupportInquiries() {
  const container = document.getElementById("support-inquiries-list");
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading support inquiries from Cloud Firestore...</div>`;

  const renderMessages = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
          <h3 style="color: #fff; font-size: 1.2rem; margin-bottom: 0.3rem;">No Support Inquiries Yet</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Messages submitted via the contact page will automatically land here in real time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(msg => {
      const dateStr = new Date(msg.sentAt || Date.now()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const isReplied = msg.status === "replied";

      return `
        <div class="card" style="padding: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-size: 0.75rem; background: rgba(99, 102, 241, 0.15); color: #6366f1; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 9999px; text-transform: uppercase;">
                ${escapeHtml(msg.subject || 'GENERAL')}
              </span>
              ${isReplied ? '<span style="font-size: 0.75rem; background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 9999px; margin-left: 0.4rem;">✓ REPLIED</span>' : ''}
              <h3 style="color: #fff; font-size: 1.2rem; margin: 0.4rem 0 0.2rem 0;">
                ${escapeHtml(msg.name || 'Anonymous')} <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 400;">(${escapeHtml(msg.email)})</span>
              </h3>
              <div style="font-size: 0.85rem; color: var(--primary);">🏢 Shop: ${escapeHtml(msg.shop || 'N/A')}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">📅 ${dateStr}</span>
            </div>
          </div>

          <div style="background: var(--bg-input); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; margin-bottom: 1rem;">
            ${escapeHtml(msg.message || '')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="openSupportReplyModal('${msg.id || ''}', '${escapeHtml(msg.email)}', '${escapeHtml(msg.name || 'Customer')}', '${escapeHtml(msg.message || '')}')">
              💬 Reply In-App
            </button>
            ${msg.id ? `<button class="btn-text-sm" style="color: #ef4444;" onclick="deleteSupportInquiry('${msg.id}')">🗑️ Delete Message</button>` : ''}
          </div>
        </div>
      `;
    }).join("");
  };

  // Check Local Storage fallback
  let localMessages = [];
  try {
    const saved = localStorage.getItem("waitlink_contact_messages");
    if (saved) localMessages = JSON.parse(saved);
  } catch (e) {}

  if (db) {
    db.collection("contact_messages").orderBy("sentAt", "desc").get().then(snapshot => {
      const cloudMessages = [];
      snapshot.forEach(doc => {
        cloudMessages.push({ id: doc.id, ...doc.data() });
      });
      // Ground truth is Firestore: update localStorage cache to match exactly
      localStorage.setItem("waitlink_contact_messages", JSON.stringify(cloudMessages));
      renderMessages(cloudMessages);
    }).catch(err => {
      console.warn("Error fetching contact_messages from Firestore:", err);
      renderMessages(localMessages);
    });
  } else {
    renderMessages(localMessages);
  }
}

function deleteSupportInquiry(msgId) {
  if (!confirm("Are you sure you want to delete this support inquiry?")) return;

  // 1. Immediately remove from local cache and update UI optimistically
  try {
    let local = JSON.parse(localStorage.getItem("waitlink_contact_messages") || "[]");
    local = local.filter(m => m.id !== msgId && m.sentAt != msgId);
    localStorage.setItem("waitlink_contact_messages", JSON.stringify(local));
  } catch (e) {}

  // 2. Delete from Cloud Firestore
  if (db && msgId) {
    db.collection("contact_messages").doc(msgId).delete().then(() => {
      showToast("🗑️ Support inquiry deleted.");
      loadSupportInquiries();
    }).catch(err => {
      console.warn("Error deleting message from Firestore:", err);
      showToast("Message removed from inbox.");
      loadSupportInquiries();
    });
  } else {
    showToast("🗑️ Support inquiry deleted.");
    loadSupportInquiries();
  }
}

// In-App Support Reply Modal Handlers
function openSupportReplyModal(msgId, email, name, snippet) {
  const modal = document.getElementById("modal-support-reply");
  const recipientLabel = document.getElementById("reply-recipient-label");
  const msgIdInput = document.getElementById("reply-msg-id");
  const recipientInput = document.getElementById("reply-recipient-email");
  const snippetBox = document.getElementById("reply-original-snippet");
  const textInput = document.getElementById("reply-message-text");

  if (recipientLabel) recipientLabel.textContent = `To: ${name || 'Customer'} (${email})`;
  if (msgIdInput) msgIdInput.value = msgId || "";
  if (recipientInput) recipientInput.value = email || "";
  if (snippetBox) snippetBox.textContent = `Original Message: "${(snippet || '').substring(0, 150)}..."`;
  if (textInput) textInput.value = "";

  if (modal) modal.classList.remove("hidden");
  if (textInput) setTimeout(() => textInput.focus(), 100);
}

function closeSupportReplyModal() {
  const modal = document.getElementById("modal-support-reply");
  if (modal) modal.classList.add("hidden");
}

function handleSendSupportReply(event) {
  event.preventDefault();
  const msgId = document.getElementById("reply-msg-id").value;
  const email = document.getElementById("reply-recipient-email").value;
  const replyText = document.getElementById("reply-message-text").value.trim();

  if (!replyText || !email) return;

  const submitBtn = document.getElementById("btn-submit-support-reply");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "⏳ Sending Email...";
  }

  const replyPayload = {
    inquiryId: msgId,
    recipientEmail: email,
    replyText: replyText,
    sentBy: (state.user && state.user.email) ? state.user.email : "senthil930@gmail.com",
    sentAt: Date.now()
  };

  // 1. Record reply and update inquiry status in Firestore
  if (db) {
    db.collection("support_replies").add(replyPayload).catch(console.warn);
    if (msgId) {
      db.collection("contact_messages").doc(msgId).update({
        status: "replied",
        repliedAt: Date.now()
      }).catch(console.warn);
    }
  }

  // 2. Direct Email Dispatch via Brevo REST API (supports CORS out-of-the-box!)
  const brevoKey = stripeConfig.brevoApiKey || SECRETS.BREVO_API_KEY || "";

  const emailHtml = `<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
    <div style="margin-bottom: 20px;">
      <span style="font-size: 20px; font-weight: 700; color: #06b6d4;">WaitLink Customer Support</span>
    </div>
    <p style="color: #334155; font-size: 15px; margin: 0 0 16px 0;">Hello,</p>
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #06b6d4; color: #0f172a; white-space: pre-wrap; font-size: 14px; margin-bottom: 24px;">${escapeHtml(replyText)}</div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
    <p style="font-size: 13px; color: #64748b; margin: 0;">
      <strong>WaitLink Customer Support Team</strong><br>
      <a href="https://waitlink.app" style="color: #06b6d4; text-decoration: none;">waitlink.app</a>
    </p>
  </div>`;

  const brevoPayload = {
    sender: { name: "WaitLink Support", email: "senthil930@gmail.com" },
    to: [{ email: email }],
    subject: "Re: WaitLink Support Inquiry",
    htmlContent: emailHtml,
    textContent: `${replyText}\n\n----------------------------------------\nWaitLink Customer Support Team\nhttps://waitlink.app`
  };

  fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify(brevoPayload)
  })
  .then(res => res.json())
  .then(data => {
    if (data && (data.messageId || data.id)) {
      showToast(`✉️ Support reply email delivered directly to ${email}!`);
    } else if (data && data.message) {
      showToast(`⚠️ Brevo notice: ${data.message}`);
    } else {
      showToast(`✅ Reply recorded & inquiry marked resolved for ${email}!`);
    }
  })
  .catch(err => {
    console.warn("Direct email send note:", err);
    showToast(`✅ Reply recorded & inquiry marked resolved for ${email}!`);
  })
  .finally(() => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "🚀 Send Response & Mark Resolved";
    }
    closeSupportReplyModal();
    loadSupportInquiries();
  });
}

// ==========================================
// INLINE CUSTOMER CHECK-IN EXPANSION HANDLERS
// ==========================================

function toggleInlineCheckInForm(show) {
  const btnContainer = document.getElementById("public-join-btn-container");
  const card = document.getElementById("public-inline-checkin-card");
  const nameInput = document.getElementById("inline-customer-name");

  if (show) {
    if (btnContainer) btnContainer.classList.add("hidden");
    if (card) card.classList.remove("hidden");
    renderPublicServiceChips();
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
  } else {
    if (card) card.classList.add("hidden");
    if (btnContainer) btnContainer.classList.remove("hidden");
  }
}

function handlePublicInlineCheckIn(event) {
  event.preventDefault();
  const nameInput = document.getElementById("inline-customer-name");
  const phoneInput = document.getElementById("inline-customer-phone");
  const submitBtn = event.target ? event.target.querySelector("button[type='submit']") : null;

  const customerName = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";

  if (!customerName) return;

  // Anti-Spam / Rate Limit Guardrail 1: Active Ticket on this Device
  if (state.myTicket && state.queue.some(q => q.id === state.myTicket.id)) {
    showToast("⚠️ You already have an active check-in ticket in line!");
    if (submitBtn) submitBtn.disabled = false;
    restoreActiveTicket();
    return;
  }

  // Anti-Spam / Rate Limit Guardrail 2: Duplicate Phone Number in Active Queue
  const cleanPhoneDigits = phone.replace(/\D/g, "");
  if (cleanPhoneDigits && cleanPhoneDigits.length >= 7) {
    const isDuplicatePhone = state.queue.some(q => {
      const existingDigits = (q.phone || "").replace(/\D/g, "");
      return existingDigits && existingDigits === cleanPhoneDigits;
    });
    if (isDuplicatePhone) {
      showToast("⚠️ A check-in with this phone number is already waiting in line!");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
  }

  if (submitBtn) submitBtn.disabled = true;

  // Real-time re-verification guardrail: Check if services are still enabled by shop owner
  const activeServices = (state.config.services || []).filter(s => s.enabled);
  const isServicesActive = state.config.enableServices && activeServices.length > 0;
  
  let validService = null;
  if (isServicesActive && state.selectedPublicService) {
    validService = activeServices.find(s => s.id === state.selectedPublicService.id) || null;
  }

  const newItem = {
    id: "q_" + Date.now(),
    customerName: customerName,
    phone: phone,
    checkedInAt: Date.now(),
    selectedServiceId: validService ? validService.id : null,
    selectedServiceName: validService ? validService.name : null,
    selectedServiceDurationMin: validService ? validService.estDurationMin : null
  };

  state.selectedPublicService = null;
  state.myTicket = newItem;
  try {
    localStorage.setItem(`waitlink_ticket_${state.config.slug}`, JSON.stringify(newItem));
  } catch (e) {}

  addQueueItemAtomic(newItem);

  renderAll();

  // Find line position
  const queuePos = state.queue.findIndex(item => item.id === newItem.id) + 1;

  // Show ticket card
  const btnContainer = document.getElementById("public-join-btn-container");
  const inlineCard = document.getElementById("public-inline-checkin-card");
  const ticketCard = document.getElementById("public-active-ticket-card");

  if (btnContainer) btnContainer.classList.add("hidden");
  if (inlineCard) inlineCard.classList.add("hidden");
  
  if (ticketCard) {
    setElText("ticket-customer-name", customerName);
    setElText("ticket-position-display", `Position #${queuePos || 1}`);
    ticketCard.classList.remove("hidden");
  }

  showToast(`✅ You joined the queue! Position #${queuePos}. Timer started!`);
  if (submitBtn) setTimeout(() => { submitBtn.disabled = false; }, 800);
}

function restoreActiveTicket() {
  if (!state.myTicket) {
    // Check URL ticket parameter first
    const params = new URLSearchParams(window.location.search);
    const urlTicketId = params.get("ticket") || params.get("t");
    
    let ticketToFind = urlTicketId;
    if (!ticketToFind) {
      try {
        const saved = localStorage.getItem(`waitlink_ticket_${state.config.slug}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          ticketToFind = parsed.id;
        }
      } catch (e) {}
    }

    if (ticketToFind) {
      let match = state.queue.find(q => q.id === ticketToFind);
      if (!match) {
        match = state.history.find(h => h.id === ticketToFind);
      }
      if (match) {
        state.myTicket = match;
      }
    }
  }

  const btnContainer = document.getElementById("public-join-btn-container");
  const inlineCard = document.getElementById("public-inline-checkin-card");
  const ticketCard = document.getElementById("public-active-ticket-card");
  const timerBox = document.getElementById("public-timer-box");
  const infoBox = document.querySelector(".public-info-box");

  if (state.myTicket) {
    const queueItem = state.queue.find(q => q.id === state.myTicket.id);
    const historyItem = state.history.find(h => h.id === state.myTicket.id);

    if (queueItem) {
      state.myTicket = queueItem;
      const queuePos = state.queue.findIndex(q => q.id === state.myTicket.id) + 1;
      if (timerBox) timerBox.classList.add("hidden");
      if (btnContainer) btnContainer.classList.add("hidden");
      if (inlineCard) inlineCard.classList.add("hidden");
      if (infoBox) infoBox.classList.add("hidden"); // Hide 3-point trust box on active ticket card
      
      if (ticketCard) {
        setElText("ticket-badge-display", state.myTicket.requeued ? "🎟️ YOUR TICKET (RE-QUEUED)" : "🎟️ YOUR TICKET");
        setElText("ticket-customer-name", state.myTicket.customerName);
        setElText("ticket-position-display", `Position #${queuePos || 1}`);

        if (state.myTicket.selectedServiceName) {
          setElText("ticket-subtitle-display", `Service: ${state.myTicket.selectedServiceName} (~${state.myTicket.selectedServiceDurationMin || 20}m)`);
        } else {
          setElText("ticket-subtitle-display", "Please stay near the lobby");
        }

        ticketCard.classList.remove("hidden");
        updateActiveTicketTimer();

        // Update Running Late UI state based on position & anti-abuse lock
        const lateChips = document.getElementById("running-late-chips");
        const lateLocked = document.getElementById("running-late-locked-msg");
        const lateGated = document.getElementById("running-late-gated-msg");
        const reportedMinsEl = document.getElementById("reported-late-mins");

        if (state.myTicket.delayedMinutes || state.myTicket.lateReportCount > 0) {
          if (lateChips) lateChips.classList.add("hidden");
          if (lateGated) lateGated.classList.add("hidden");
          if (lateLocked) lateLocked.classList.remove("hidden");
          if (reportedMinsEl) reportedMinsEl.textContent = state.myTicket.delayedMinutes || 10;
        } else if (queuePos <= 2) {
          if (lateChips) lateChips.classList.remove("hidden");
          if (lateLocked) lateLocked.classList.add("hidden");
          if (lateGated) lateGated.classList.add("hidden");
        } else {
          if (lateChips) lateChips.classList.add("hidden");
          if (lateLocked) lateLocked.classList.add("hidden");
          if (lateGated) lateGated.classList.remove("hidden");
        }
      }
    } else if (historyItem && historyItem.status === "called") {
      state.myTicket = historyItem;
      if (ticketCard) {
        setElText("ticket-badge-display", "🎉 VISIT IN PROGRESS");
        setElText("ticket-customer-name", state.myTicket.customerName);
        setElText("ticket-position-display", "Visit In Progress");
        setElText("ticket-subtitle-display", `Enjoy your service at ${state.config.shopName || 'WaitLink Shop'}!`);
        ticketCard.classList.remove("hidden");
      }
      if (timerBox) timerBox.classList.add("hidden");
      if (btnContainer) btnContainer.classList.add("hidden");
      if (inlineCard) inlineCard.classList.add("hidden");
      if (infoBox) infoBox.classList.add("hidden");
    } else {
      // Ticket was cancelled or completed
      state.myTicket = null;
      try { localStorage.removeItem(`waitlink_ticket_${state.config.slug}`); } catch (e) {}
      if (timerBox) timerBox.classList.remove("hidden");
      if (btnContainer) btnContainer.classList.remove("hidden");
      if (ticketCard) ticketCard.classList.add("hidden");
      if (infoBox) infoBox.classList.remove("hidden");
    }
  } else {
    // New visitor -> Show general new walk-ins estimate & join button
    if (timerBox) timerBox.classList.remove("hidden");
    if (btnContainer) btnContainer.classList.remove("hidden");
    if (ticketCard) ticketCard.classList.add("hidden");
    if (infoBox) infoBox.classList.remove("hidden");
  }
}

function copyMyTicketLink() {
  if (!state.myTicket) return;
  const baseUrl = getPublicUrl();
  const ticketUrl = `${baseUrl}&ticket=${state.myTicket.id}`;
  
  navigator.clipboard.writeText(ticketUrl).then(() => {
    showToast("🔗 Ticket tracking link copied! Bookmark or save to check anytime.");
  }).catch(() => {
    showToast("Ticket Link: " + ticketUrl);
  });
}

function cancelMyTicket() {
  let ticketId = state.myTicket ? state.myTicket.id : null;
  let customerName = state.myTicket ? state.myTicket.customerName : null;

  if (!ticketId) {
    try {
      const saved = localStorage.getItem(`waitlink_ticket_${state.config.slug}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        ticketId = parsed.id;
        customerName = parsed.customerName;
      }
    } catch (e) {}
  }

  if (!ticketId && !customerName) {
    showToast("No active ticket found to leave.");
    return;
  }

  if (!confirm("Are you sure you want to leave the waitlist?")) return;

  cancelCustomer(ticketId, customerName, "customer");
  state.myTicket = null;
  try { localStorage.removeItem(`waitlink_ticket_${state.config.slug}`); } catch (e) {}

  const btnContainer = document.getElementById("public-join-btn-container");
  const ticketCard = document.getElementById("public-active-ticket-card");
  const timerBox = document.getElementById("public-timer-box");

  if (ticketCard) ticketCard.classList.add("hidden");
  if (timerBox) timerBox.classList.remove("hidden");
  if (btnContainer) btnContainer.classList.remove("hidden");

  renderAll();
  showToast("You have left the waitlist.");
}

function reportRunningLate(minutes) {
  if (!state.myTicket) return;
  const queueItem = state.queue.find(q => q.id === state.myTicket.id);
  if (!queueItem) {
    showToast("⚠️ Could not locate your queue ticket.");
    return;
  }

  if (queueItem.lateReportCount > 0 || queueItem.delayedMinutes) {
    showToast("⚠️ Delay notification has already been submitted for this ticket.");
    return;
  }

  queueItem.delayedMinutes = minutes;
  queueItem.lateReportedAt = Date.now();
  queueItem.lateReportCount = 1;
  logCustomerActivity(queueItem, "running_late", `Running Late (+${minutes} mins)`, `Customer notified front desk of +${minutes} minutes delay`, "🏃");

  state.myTicket.delayedMinutes = minutes;
  state.myTicket.lateReportedAt = queueItem.lateReportedAt;
  state.myTicket.lateReportCount = 1;

  try {
    localStorage.setItem(`waitlink_ticket_${state.config.slug}`, JSON.stringify(state.myTicket));
  } catch (e) {}

  saveData();
  renderAll();
  showToast(`🕒 Notified venue: Running ~${minutes} mins late!`);
}

// ==========================================
// SHOP SERVICES MANAGER & SELECTION HANDLERS
// ==========================================

function populateOwnerServicesUI() {
  const toggle = document.getElementById("owner-toggle-services");
  const body = document.getElementById("owner-services-manager-body");
  const listEl = document.getElementById("owner-services-list");

  if (!state.config.services) state.config.services = [];

  if (toggle) {
    toggle.checked = !!state.config.enableServices;
  }
  if (body) {
    if (state.config.enableServices) body.classList.remove("hidden");
    else body.classList.add("hidden");
  }

  if (listEl) {
    if (state.config.services.length === 0) {
      listEl.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No services added yet. Add one above!</div>`;
    } else {
      listEl.innerHTML = state.config.services.map(s => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 0.45rem 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem;">
            <span>${escapeHtml(s.icon || '✂️')}</span>
            <strong>${escapeHtml(s.name)}</strong>
            <span style="font-size: 0.75rem; color: #06b6d4;">(${s.estDurationMin || 20}m)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <button type="button" class="btn-text-sm" onclick="toggleServiceActiveStatus('${s.id}')" style="color: ${s.enabled ? '#10b981' : 'var(--text-muted)'}; font-weight: 600; font-size: 0.78rem;">
              ${s.enabled ? '🟢 Active' : '⚪ Off'}
            </button>
            <button type="button" class="btn-text-sm" onclick="deleteOwnerService('${s.id}')" style="color: #f43f5e; font-size: 0.78rem;">🗑️</button>
          </div>
        </div>
      `).join("");
    }
  }
}

function toggleOwnerServicesSection(enabled) {
  state.config.enableServices = !!enabled;
  saveConfig();
  saveData();
  populateOwnerServicesUI();
  renderAll();
}

function addNewOwnerService() {
  const emojiInput = document.getElementById("new-service-emoji");
  const nameInput = document.getElementById("new-service-name");
  const durationInput = document.getElementById("new-service-duration");

  const icon = emojiInput ? emojiInput.value.trim() || "💈" : "💈";
  const name = nameInput ? nameInput.value.trim() : "";
  const duration = durationInput ? (parseInt(durationInput.value) || 20) : 20;

  if (!name) {
    showToast("⚠️ Please enter a service name");
    return;
  }

  if (!state.config.services) state.config.services = [];

  const newService = {
    id: "srv_" + Date.now(),
    name: name,
    icon: icon,
    estDurationMin: duration,
    enabled: true
  };

  state.config.services.push(newService);
  state.config.enableServices = true;

  if (emojiInput) emojiInput.value = "";
  if (nameInput) nameInput.value = "";
  if (durationInput) durationInput.value = "";

  saveConfig();
  saveData();
  populateOwnerServicesUI();
  renderAll();
  showToast(`✂️ Added service: "${name}" (${duration}m)`);
}

function toggleServiceActiveStatus(id) {
  if (!state.config.services) return;
  const s = state.config.services.find(srv => srv.id === id);
  if (s) {
    s.enabled = !s.enabled;
    saveConfig();
    saveData();
    populateOwnerServicesUI();
    renderAll();
  }
}

function deleteOwnerService(id) {
  if (!state.config.services) return;
  state.config.services = state.config.services.filter(s => s.id !== id);
  saveConfig();
  saveData();
  populateOwnerServicesUI();
  renderAll();
  showToast("Service option removed.");
}

function renderPublicServiceChips() {
  const container = document.getElementById("public-service-chips-container");
  const chipsEl = document.getElementById("public-service-chips");
  if (!container || !chipsEl) return;

  const activeServices = (state.config.services || []).filter(s => s.enabled);
  if (!state.config.enableServices || activeServices.length === 0) {
    container.classList.add("hidden");
    chipsEl.innerHTML = "";
    state.selectedPublicService = null;
    return;
  }

  container.classList.remove("hidden");

  let html = activeServices.map(s => {
    const isSelected = state.selectedPublicService && state.selectedPublicService.id === s.id;
    const border = isSelected ? "border-color: #06b6d4; background: rgba(6, 182, 212, 0.2); color: #06b6d4;" : "border-color: rgba(255,255,255,0.15); color: #fff;";
    return `
      <button type="button" class="btn btn-secondary btn-sm" onclick="selectPublicService('${s.id}')" style="font-size: 0.8rem; padding: 0.35rem 0.65rem; ${border}">
        ${escapeHtml(s.icon || '✂️')} ${escapeHtml(s.name)} (${s.estDurationMin}m)
      </button>
    `;
  }).join("");

  const isDefaultSelected = !state.selectedPublicService;
  const defaultBorder = isDefaultSelected ? "border-color: #06b6d4; background: rgba(6, 182, 212, 0.2); color: #06b6d4;" : "border-color: rgba(255,255,255,0.15); color: var(--text-muted);";
  html += `
    <button type="button" class="btn btn-secondary btn-sm" onclick="selectPublicService(null)" style="font-size: 0.8rem; padding: 0.35rem 0.65rem; ${defaultBorder}">
      ❓ General Walk-In
    </button>
  `;

  chipsEl.innerHTML = html;
}

function selectPublicService(id) {
  if (!id) {
    state.selectedPublicService = null;
  } else {
    const s = (state.config.services || []).find(srv => srv.id === id);
    if (s) {
      state.selectedPublicService = s;
    } else {
      state.selectedPublicService = null;
    }
  }
  renderPublicServiceChips();
}

function renderDeskServiceSelect() {
  const container = document.getElementById("desk-service-selector-container");
  const selectEl = document.getElementById("desk-service-select");
  if (!container || !selectEl) return;

  const activeServices = (state.config.services || []).filter(s => s.enabled);
  if (!state.config.enableServices || activeServices.length === 0) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");

  const currentVal = selectEl.value;
  selectEl.innerHTML = `<option value="">-- Select Service (Optional) --</option>` + activeServices.map(s => `
    <option value="${s.id}">${escapeHtml(s.icon || '✂️')} ${escapeHtml(s.name)} (${s.estDurationMin}m)</option>
  `).join("");

  if (currentVal) selectEl.value = currentVal;
}

// Atomic Check-in Handler for Concurrency Protection
function addQueueItemAtomic(newItem) {
  state.queue.push(newItem);
  state.myTicket = newItem;
  try {
    localStorage.setItem(`waitlink_ticket_${state.config.slug}`, JSON.stringify(newItem));
  } catch (e) {}
  saveData();

  if (db && state.config.slug) {
    const shopRef = db.collection("shops").doc(state.config.slug);
    db.runTransaction(async (transaction) => {
      const doc = await transaction.get(shopRef);
      if (!doc.exists) {
        transaction.set(shopRef, { queue: [newItem], updatedAt: Date.now() }, { merge: true });
      } else {
        const currentQueue = doc.data().queue || [];
        if (!currentQueue.some(q => q.id === newItem.id)) {
          currentQueue.push(newItem);
          transaction.update(shopRef, { queue: currentQueue, updatedAt: Date.now() });
        }
      }
    }).catch(err => {
      console.warn("Atomic transaction note:", err);
    });
  }
}

// Live Ticker Timer Handler (Smooth 1-Second Updates, 0 Memory Leak)
function startTimerTicker() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    updateTickingTimers();
  }, 1000);
}

function updateTickingTimers() {
  const now = Date.now();

  const timerPills = document.querySelectorAll(".queue-item-card .timer-pill");
  timerPills.forEach((pill, idx) => {
    const item = state.queue[idx];
    if (item && item.checkedInAt) {
      const elapsedSec = Math.floor((now - item.checkedInAt) / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      const timeStr = `${elapsedMin}m ${secs < 10 ? '0' : ''}${secs}s`;
      pill.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${timeStr}
      `;
    }
  });

  const ticketTimerDisplay = document.getElementById("ticket-timer-display");
  if (ticketTimerDisplay && state.myTicket && state.myTicket.checkedInAt) {
    const elapsedSec = Math.floor((now - state.myTicket.checkedInAt) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    ticketTimerDisplay.textContent = `Waited ${elapsedMin < 10 ? '0' : ''}${elapsedMin}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

// ==========================================
// RE-QUEUE & REINSTATE CUSTOMER HANDLERS
// ==========================================

function promptRequeueCustomer(id) {
  const item = state.history.find(h => h.id === id) || state.queue.find(q => q.id === id);
  if (!item) {
    showToast("⚠️ Record not found.");
    return;
  }

  const mode = confirm(
    `Put "${item.customerName}" back into the Active Queue?\n\n` +
    `• OK = Move to End of Line (Recommended to protect lobby order)\n` +
    `• Cancel = Restore Original Priority Spot`
  ) ? "end" : "original";

  requeueCustomer(id, mode);
}

function requeueActiveCustomerToEnd(id) {
  const item = state.queue.find(q => q.id === id);
  if (!item) return;

  if (confirm(`Move "${item.customerName}" to the end of the active waiting line?`)) {
    item.checkedInAt = Date.now();
    item.requeued = true;
    logCustomerActivity(item, "requeue", "Re-queued to End of Line", "Moved customer to end of active waiting line", "⬇️");

    state.queue.sort((a, b) => (a.checkedInAt || 0) - (b.checkedInAt || 0));

    saveData();
    renderAll();
    showToast(`⬇️ Moved "${item.customerName}" to end of line.`);
  }
}

function requeueCustomer(id, mode = "end") {
  const historyIndex = state.history.findIndex(h => h.id === id);
  let item = null;

  if (historyIndex !== -1) {
    item = state.history.splice(historyIndex, 1)[0];
  } else {
    const queueIndex = state.queue.findIndex(q => q.id === id);
    if (queueIndex !== -1) {
      item = state.queue[queueIndex];
    }
  }

  if (!item) {
    showToast("⚠️ Record not found.");
    return;
  }

  item.status = "waiting";
  delete item.calledAt;
  delete item.cancelledAt;
  delete item.cancelledBy;
  delete item.waitDurationMin;
  item.requeued = true;
  logCustomerActivity(item, "reinstate", "Reinstated to Queue", `Restored customer back into active line (${mode === 'end' ? 'Moved to End' : 'Original Position'})`, "↩️");

  if (mode === "end") {
    item.checkedInAt = Date.now();
  }

  if (!state.queue.some(q => q.id === item.id)) {
    state.queue.push(item);
  }

  state.queue.sort((a, b) => (a.checkedInAt || 0) - (b.checkedInAt || 0));

  saveData();
  renderAll();
  showToast(`↩️ Reinstated "${item.customerName}" back to active queue!`);
}

// ==========================================
// CUSTOMER LIFECYCLE AUDIT TRAIL (OWNER VIEW ONLY)
// ==========================================

function openCustomerAuditModal(id) {
  if (!id) {
    showToast("⚠️ Customer record identifier missing.");
    return;
  }

  const item = findCustomerRecord(id);
  if (!item) {
    showToast("⚠️ Customer record not found.");
    return;
  }

  const modal = document.getElementById("modal-customer-audit-trail");
  if (!modal) {
    console.error("modal-customer-audit-trail element missing in DOM");
    showToast("⚠️ Audit Log modal element missing.");
    return;
  }

  const activities = getItemActivities(item);
  setElText("audit-modal-customer-name", item.customerName || "Customer");
  setElText("audit-modal-subtitle", `Complete Lifecycle Activity Audit Log • ${state.config.shopName || 'Shop'}`);
  
  const statusTag = item.status === "called" ? "Called (Completed)" : (item.status === "cancelled" ? (item.cancelledBy === "desk" ? "Desk Cancelled" : "Left Line (Customer)") : "In Active Queue");
  const statusColor = item.status === "called" ? "#10b981" : (item.status === "cancelled" ? "#f43f5e" : "#06b6d4");
  
  const statusEl = document.getElementById("audit-modal-status");
  if (statusEl) {
    statusEl.textContent = statusTag;
    statusEl.style.color = statusColor;
  }

  setElText("audit-modal-waited", item.waitDurationMin ? `${item.waitDurationMin} mins` : (item.checkedInAt ? `${Math.round((Date.now() - item.checkedInAt)/(1000*60))} mins so far` : "--"));
  setElText("audit-modal-phone", item.phone || "Not Provided");
  setElText("audit-modal-count", `${activities.length} Recorded ${activities.length === 1 ? 'Event' : 'Events'}`);

  const container = document.getElementById("audit-modal-timeline-container");
  if (container) {
    let html = "";
    activities.forEach((act, index) => {
      const formattedTime = formatHistoryDateTime(act.timestamp);
      const isLast = (index === activities.length - 1);
      html += `
        <div style="position: relative; padding-left: 2.2rem; padding-bottom: ${isLast ? '0.5rem' : '1.35rem'}; border-left: ${isLast ? '2px solid transparent' : '2px solid rgba(6, 182, 212, 0.35)'};">
          <div style="position: absolute; left: -12px; top: 0; background: #0f172a; border: 2px solid #06b6d4; color: #fff; border-radius: 50%; width: 22px; height: 22px; font-size: 0.78rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);">
            ${act.icon || '📌'}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
            <strong style="color: #fff; font-size: 0.92rem;">${escapeHtml(act.title)}</strong>
            <span style="font-size: 0.75rem; color: #06b6d4; font-weight: 600; font-family: monospace; background: rgba(6, 182, 212, 0.1); padding: 0.15rem 0.45rem; border-radius: 4px;">🕒 ${formattedTime}</span>
          </div>
          <div style="font-size: 0.83rem; color: var(--text-light); margin-top: 0.3rem; line-height: 1.4;">${escapeHtml(act.detail)}</div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function closeCustomerAuditModal() {
  const modal = document.getElementById("modal-customer-audit-trail");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

// Bind to window explicitly for inline HTML onclick reliability
window.openCustomerAuditModal = openCustomerAuditModal;
window.closeCustomerAuditModal = closeCustomerAuditModal;

// Global Event Delegation listener fallback for Audit Log buttons
document.addEventListener("click", function(e) {
  const auditTarget = e.target.closest && e.target.closest("[data-action='audit-log']");
  if (auditTarget) {
    e.preventDefault();
    const id = auditTarget.getAttribute("data-id");
    if (id) {
      openCustomerAuditModal(id);
    }
  }
});

/* ==========================================================================
   Mobile Navigation Drawer Controller
   ========================================================================== */
function openMobileNavDrawer() {
  const drawer = document.getElementById("mobile-nav-drawer");
  const toggleBtn = document.getElementById("mobile-menu-toggle-btn");
  if (!drawer) return;
  closeAllDropdowns();
  drawer.classList.remove("hidden");
  // Force reflow for silky smooth CSS entrance animation
  void drawer.offsetWidth;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  if (toggleBtn) {
    toggleBtn.classList.add("hamburger-active");
    toggleBtn.setAttribute("aria-expanded", "true");
  }
  document.body.classList.add("drawer-open");
}

function closeMobileNavDrawer() {
  const drawer = document.getElementById("mobile-nav-drawer");
  const toggleBtn = document.getElementById("mobile-menu-toggle-btn");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  if (toggleBtn) {
    toggleBtn.classList.remove("hamburger-active");
    toggleBtn.setAttribute("aria-expanded", "false");
  }
  document.body.classList.remove("drawer-open");
  setTimeout(() => {
    if (!drawer.classList.contains("open")) {
      drawer.classList.add("hidden");
    }
  }, 280);
}

function toggleMobileNavDrawer() {
  const drawer = document.getElementById("mobile-nav-drawer");
  if (!drawer) return;
  if (drawer.classList.contains("open")) {
    closeMobileNavDrawer();
  } else {
    openMobileNavDrawer();
  }
}

function handleMobileNavClick(viewName) {
  switchView(viewName);
  closeMobileNavDrawer();
}

function handleMobileAuthAction() {
  closeMobileNavDrawer();
  if (state.user) {
    handleSignOut();
  } else {
    openAuthModal();
  }
}

// Auto-close drawer on Escape key or when window resizes back to desktop
window.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeMobileNavDrawer();
  }
});

window.addEventListener("resize", function() {
  if (window.innerWidth > 768) {
    const drawer = document.getElementById("mobile-nav-drawer");
    if (drawer && drawer.classList.contains("open")) {
      closeMobileNavDrawer();
    }
  }
});

// Explicit window bindings for inline HTML onclick reliability
window.openMobileNavDrawer = openMobileNavDrawer;
window.closeMobileNavDrawer = closeMobileNavDrawer;
window.toggleMobileNavDrawer = toggleMobileNavDrawer;
window.handleMobileNavClick = handleMobileNavClick;
window.handleMobileAuthAction = handleMobileAuthAction;






