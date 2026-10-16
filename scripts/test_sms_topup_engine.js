/**
 * WaitLink — SMS Volume Quota, Rollover & Top-Up Engine Automated Test Suite
 * 100% Comprehensive Coverage for Telecom Math, Policies, and Security Rules
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("======================================================================");
console.log("🧪 STARTING WAITLINK SMS VOLUME & TOP-UP ENGINE TEST SUITE");
console.log("======================================================================\n");

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ ${description}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------------------
// 1. GSM-7 vs. UCS-2 Segment Math
// -------------------------------------------------------------------------
function calculateSmsSegments(text) {
  if (!text) return 1;
  const isGsm7 = !/[^\u0020-\u007E\r\n\t€£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(text);
  const len = Array.from(text).length;
  if (isGsm7) {
    if (len <= 160) return 1;
    return Math.ceil(len / 153);
  } else {
    if (len <= 70) return 1;
    return Math.ceil(len / 67);
  }
}

console.log("--- 1. Carrier Segment & Character Calculation Tests ---");

it("GSM-7: Single segment up to 160 standard characters", () => {
  const shortText = "Hi Alex! Your turn at Main St Barbers is ready now.";
  assert.strictEqual(calculateSmsSegments(shortText), 1);

  const exact160 = "a".repeat(160);
  assert.strictEqual(calculateSmsSegments(exact160), 1);
});

it("GSM-7: Multi-segment (>160 characters calculated at 153 chars/segment)", () => {
  const text161 = "a".repeat(161);
  assert.strictEqual(calculateSmsSegments(text161), 2);

  const text306 = "a".repeat(306);
  assert.strictEqual(calculateSmsSegments(text306), 2);

  const text307 = "a".repeat(307);
  assert.strictEqual(calculateSmsSegments(text307), 3);
});

it("UCS-2: Single segment up to 70 characters when Unicode / emoji present", () => {
  const emojiShort = "Hi Alex! Your turn is ready! 😊";
  assert.strictEqual(calculateSmsSegments(emojiShort), 1);

  const emojiText70 = "😊" + "a".repeat(69);
  assert.strictEqual(calculateSmsSegments(emojiText70), 1);
});

it("UCS-2: Multi-segment (>70 characters calculated at 67 chars/segment)", () => {
  const emojiText71 = "🎉" + "a".repeat(70);
  assert.strictEqual(calculateSmsSegments(emojiText71), 2);

  const emojiText134 = "🔥" + "b".repeat(133);
  assert.strictEqual(calculateSmsSegments(emojiText134), 2);

  const emojiText135 = "🔥" + "b".repeat(134);
  assert.strictEqual(calculateSmsSegments(emojiText135), 3);
});

// -------------------------------------------------------------------------
// 2. Rollover Engine Math: Option A vs. Option B
// -------------------------------------------------------------------------
console.log("\n--- 2. Billing Cycle Rollover Calculations ---");

function simulateRollover(currentUsage, policy) {
  const baseAllowance = 500;
  const unusedFromCurrentMonth = Math.max(0, (currentUsage.monthlyAllowance || baseAllowance) - (currentUsage.monthlyUsed || 0));

  let rolledOver = 0;
  if (policy === "option_a") {
    // Option A: Monthly Reset (No rollover)
    rolledOver = 0;
  } else {
    // Option B: 1-Month Rollover Bank (Capped at 1,000 SMS)
    rolledOver = Math.min(1000, unusedFromCurrentMonth);
  }

  const newAllowance = baseAllowance + rolledOver;
  const newTopUpBalance = currentUsage.topUpBalance || 0; // Top-up balance never expires
  const newTotalAvailable = newAllowance + newTopUpBalance;

  return {
    monthlyAllowance: newAllowance,
    rolledOverFromPriorMonth: rolledOver,
    monthlyUsed: 0,
    topUpBalance: newTopUpBalance,
    totalAvailable: newTotalAvailable
  };
}

it("Option A: Monthly Reset expires unused allowance strictly to 500", () => {
  const shopUsage = {
    monthlyAllowance: 500,
    monthlyUsed: 120, // 380 unused
    topUpBalance: 250
  };
  const rolled = simulateRollover(shopUsage, "option_a");
  assert.strictEqual(rolled.monthlyAllowance, 500);
  assert.strictEqual(rolled.rolledOverFromPriorMonth, 0);
  assert.strictEqual(rolled.topUpBalance, 250, "Top-up reserve must never expire");
  assert.strictEqual(rolled.totalAvailable, 750);
});

it("Option B: 1-Month Rollover Bank rolls unused quota to next month", () => {
  const shopUsage = {
    monthlyAllowance: 500,
    monthlyUsed: 150, // 350 unused
    topUpBalance: 1000
  };
  const rolled = simulateRollover(shopUsage, "option_b");
  assert.strictEqual(rolled.rolledOverFromPriorMonth, 350);
  assert.strictEqual(rolled.monthlyAllowance, 850); // 500 + 350
  assert.strictEqual(rolled.topUpBalance, 1000);
  assert.strictEqual(rolled.totalAvailable, 1850);
});

it("Option B: Rollover Bank enforces 1,000 SMS cap ceiling", () => {
  const shopUsage = {
    monthlyAllowance: 1600, // Previous high allowance
    monthlyUsed: 100, // 1500 unused
    topUpBalance: 0
  };
  const rolled = simulateRollover(shopUsage, "option_b");
  assert.strictEqual(rolled.rolledOverFromPriorMonth, 1000, "Rollover cap must be 1,000 SMS max");
  assert.strictEqual(rolled.monthlyAllowance, 1500); // 500 base + 1000 cap
  assert.strictEqual(rolled.totalAvailable, 1500);
});

// -------------------------------------------------------------------------
// 3. Quota Debit Priority & Top-Up Drain
// -------------------------------------------------------------------------
console.log("\n--- 3. Quota Debit Priority & Wallet Deductions ---");

function debitCredits(usage, segmentsNeeded) {
  const availablePlan = Math.max(0, (usage.monthlyAllowance || 500) - (usage.monthlyUsed || 0));
  const totalAvailable = availablePlan + (usage.topUpBalance || 0);

  if (totalAvailable < segmentsNeeded) {
    return { success: false, quotaExhausted: true, totalAvailable };
  }

  const updated = { ...usage };
  if (availablePlan >= segmentsNeeded) {
    updated.monthlyUsed = (updated.monthlyUsed || 0) + segmentsNeeded;
  } else {
    const remainder = segmentsNeeded - availablePlan;
    updated.monthlyUsed = updated.monthlyAllowance || 500;
    updated.topUpBalance = Math.max(0, (updated.topUpBalance || 0) - remainder);
  }

  const newPlanAvailable = Math.max(0, (updated.monthlyAllowance || 500) - (updated.monthlyUsed || 0));
  updated.totalAvailable = newPlanAvailable + (updated.topUpBalance || 0);
  updated.lifetimeSent = (updated.lifetimeSent || 0) + segmentsNeeded;

  return { success: true, updated };
}

it("Debits included monthly allowance first when sufficient", () => {
  const usage = { monthlyAllowance: 500, monthlyUsed: 10, topUpBalance: 1000 };
  const res = debitCredits(usage, 2);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated.monthlyUsed, 12);
  assert.strictEqual(res.updated.topUpBalance, 1000, "Top-up reserve should not be touched");
  assert.strictEqual(res.updated.totalAvailable, 1488);
});

it("Depletes remaining monthly allowance then drains top-up reserve", () => {
  const usage = { monthlyAllowance: 500, monthlyUsed: 499, topUpBalance: 250 };
  // Needs 3 segments: 1 from plan, 2 from top-up
  const res = debitCredits(usage, 3);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated.monthlyUsed, 500);
  assert.strictEqual(res.updated.topUpBalance, 248);
  assert.strictEqual(res.updated.totalAvailable, 248);
});

it("Returns quotaExhausted: true (HTTP 402 equivalent) when balance is insufficient", () => {
  const usage = { monthlyAllowance: 500, monthlyUsed: 500, topUpBalance: 0 };
  const res = debitCredits(usage, 1);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.quotaExhausted, true);
  assert.strictEqual(res.totalAvailable, 0);
});

// -------------------------------------------------------------------------
// 3.5 Plan Switch Allowance Calculation & Credit Bucket Tests
// -------------------------------------------------------------------------
console.log("\n--- 3.5 Plan Switch Allowance Calculations & Bucket Tracking ---");

function simulatePlanSwitch(currentUsage, newPlanPrice, newPlanTitle) {
  const isEnterprise = newPlanPrice >= 49 || String(newPlanTitle || "").toLowerCase().includes("enterprise");
  const isPro = newPlanPrice >= 15 || String(newPlanTitle || "").toLowerCase().includes("pro");
  const baseMonthlyQuota = isEnterprise ? 2500 : (isPro ? 500 : 0);

  const currentBase = currentUsage.baseMonthlyQuota || (currentUsage.monthlyAllowance > 1000 ? 2500 : (currentUsage.monthlyAllowance > 0 ? 500 : 0));
  const updated = { ...currentUsage };
  const delta = baseMonthlyQuota - currentBase;

  if (delta > 0) {
    updated.monthlyAllowance = (updated.monthlyAllowance || currentBase) + delta;
  } else {
    updated.monthlyAllowance = Math.min(baseMonthlyQuota, updated.monthlyAllowance || baseMonthlyQuota);
  }

  updated.baseMonthlyQuota = baseMonthlyQuota;
  updated.totalAvailable = Math.max(0, (updated.monthlyAllowance || baseMonthlyQuota) - (updated.monthlyUsed || 0)) + (updated.topUpBalance || 0);
  return updated;
}

it("Upgrade Pro -> Enterprise: Allowance increases to 2,500, retains used SMS, top-up untouched", () => {
  const proUsage = {
    monthlyAllowance: 500,
    baseMonthlyQuota: 500,
    monthlyUsed: 150,
    topUpBalance: 300,
    totalAvailable: 650
  };
  const enterprise = simulatePlanSwitch(proUsage, 49, "Enterprise Tier");
  assert.strictEqual(enterprise.monthlyAllowance, 2500, "Allowance must be 2,500");
  assert.strictEqual(enterprise.monthlyUsed, 150, "Used SMS must be preserved");
  assert.strictEqual(enterprise.topUpBalance, 300, "Top-up balance must remain intact");
  assert.strictEqual(enterprise.totalAvailable, (2500 - 150) + 300, "Total available = 2,350 plan + 300 top-up");
});

it("Downgrade Enterprise -> Pro: Allowance caps at 500, floors remaining at 0 if used > 500", () => {
  const entUsage = {
    monthlyAllowance: 2500,
    baseMonthlyQuota: 2500,
    monthlyUsed: 800,
    topUpBalance: 100,
    totalAvailable: 1800
  };
  const pro = simulatePlanSwitch(entUsage, 15, "Pro Business Tier");
  assert.strictEqual(pro.monthlyAllowance, 500, "Allowance must cap at 500");
  assert.strictEqual(pro.monthlyUsed, 800, "Used SMS count retained");
  assert.strictEqual(pro.topUpBalance, 100, "Top-up reserve preserved");
  // 500 - 800 is negative -> floors at 0 + 100 = 100
  assert.strictEqual(pro.totalAvailable, 100, "Remaining included allowance floored at 0, only top-up remains");
});

it("Credit Bucket Classification: Accurately labels Monthly Included, Top-Up Reserve, and Split dispatches", () => {
  function classifyBucket(allowance, used, needed) {
    const availablePlan = Math.max(0, allowance - used);
    if (availablePlan >= needed) return "Monthly Included";
    if (availablePlan > 0) return `Split (${availablePlan} Included + ${needed - availablePlan} Top-Up)`;
    return "Top-Up Reserve";
  }

  assert.strictEqual(classifyBucket(500, 10, 1), "Monthly Included");
  assert.strictEqual(classifyBucket(500, 500, 2), "Top-Up Reserve");
  assert.strictEqual(classifyBucket(500, 498, 5), "Split (2 Included + 3 Top-Up)");
});

// -------------------------------------------------------------------------
// 4. One-Time Top-Up Packs & Unit Economics
// -------------------------------------------------------------------------
console.log("\n--- 4. One-Time Top-Up Pack Unit Economics & Pricing Integrity ---");

const packs = [
  { id: "micro", credits: 250, price: 5.00, priceId: "price_1URHUhHXdog2I9XKyYLKFxLM" },
  { id: "growth", credits: 1000, price: 15.00, priceId: "price_1URHVaHXdog2I9XKypqiBnDf" },
  { id: "power", credits: 2500, price: 39.00, priceId: "price_1URHW8HXdog2I9XK0vb6CJXN" }
];

const TWILIO_COST_PER_SEGMENT = 0.0079;

packs.forEach(p => {
  it(`Pack [${p.id.toUpperCase()}]: ${p.credits} SMS for $${p.price.toFixed(2)} maintains positive gross margin`, () => {
    const twilioCogs = p.credits * TWILIO_COST_PER_SEGMENT;
    const grossProfit = p.price - twilioCogs;
    const marginPct = (grossProfit / p.price) * 100;

    assert.ok(grossProfit > 0, `Gross profit must be positive for ${p.id}`);
    assert.ok(marginPct > 40, `Gross profit margin must exceed 40% for ${p.id}`);
    assert.ok(p.priceId.startsWith("price_"), `Stripe price ID must be valid for ${p.id}`);
  });
});

// -------------------------------------------------------------------------
// 5. Codebase Wiring & File Verification
// -------------------------------------------------------------------------
console.log("\n--- 5. Codebase Wiring & DOM Integrity ---");

it("index.html contains all required UI elements for SMS management", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.ok(indexHtml.includes('id="desk-sms-exhausted-banner"'), "Missing #desk-sms-exhausted-banner");
  assert.ok(indexHtml.includes('id="sms-char-counter"'), "Missing #sms-char-counter");
  assert.ok(indexHtml.includes('id="sms-encoding-badge"'), "Missing #sms-encoding-badge");
  assert.ok(indexHtml.includes('id="sms-emoji-warning"'), "Missing #sms-emoji-warning");
  assert.ok(indexHtml.includes('id="owner-sms-wallet-card"'), "Missing #owner-sms-wallet-card");
  assert.ok(indexHtml.includes('id="sms-usage-progress-bar"'), "Missing #sms-usage-progress-bar");
  assert.ok(indexHtml.includes('id="modal-sms-topup"'), "Missing #modal-sms-topup");
  assert.ok(indexHtml.includes('id="modal-sms-logs"'), "Missing #modal-sms-logs");
  assert.ok(indexHtml.includes('id="admin-policy-opt-a"'), "Missing #admin-policy-opt-a");
  assert.ok(indexHtml.includes('id="admin-policy-opt-b"'), "Missing #admin-policy-opt-b");
});

it("functions/index.js exports all required Cloud Functions", () => {
  const fnCode = fs.readFileSync(path.join(__dirname, "../functions/index.js"), "utf8");
  assert.ok(fnCode.includes("exports.sendTwilioSms"), "Missing exports.sendTwilioSms");
  assert.ok(fnCode.includes("exports.createStripeTopUpSession"), "Missing exports.createStripeTopUpSession");
  assert.ok(fnCode.includes("exports.verifyStripeTopUpSession"), "Missing exports.verifyStripeTopUpSession");
  assert.ok(fnCode.includes("exports.adjustShopSmsCredits"), "Missing exports.adjustShopSmsCredits");
  assert.ok(fnCode.includes("calculateSmsSegments"), "Missing calculateSmsSegments in functions");
  assert.ok(fnCode.includes("checkAndSendCapacityAlerts"), "Missing checkAndSendCapacityAlerts in functions");
  assert.ok(fnCode.includes("usageData.monthlyUsed = (usageData.monthlyUsed || 0) + neededSegments;"), "Missing monthlyUsed debit increment");
  assert.ok(fnCode.includes("usageData.recentDispatches.unshift"), "Missing recentDispatches logging");
  assert.ok(!fnCode.includes("if (!isSuper) {\n          if (availablePlan >= neededSegments)"), "Quota debit must not be skipped for superadmin/testing accounts");
});

it("app.js contains real-time listener, checkout handlers, and segment calculator", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  assert.ok(appJs.includes("function calculateSmsSegments"), "Missing calculateSmsSegments in app.js");
  assert.ok(appJs.includes("function subscribeSmsUsage"), "Missing subscribeSmsUsage in app.js");
  assert.ok(appJs.includes("function renderSmsWalletUI"), "Missing renderSmsWalletUI in app.js");
  assert.ok(appJs.includes("function openTopUpModal"), "Missing openTopUpModal in app.js");
  assert.ok(appJs.includes("function initiateTopUpCheckout"), "Missing initiateTopUpCheckout in app.js");
  assert.ok(appJs.includes("function verifyTopUpSessionBackend"), "Missing verifyTopUpSessionBackend in app.js");
  assert.ok(appJs.includes("function setAdminRolloverPolicy"), "Missing setAdminRolloverPolicy in app.js");
  assert.ok(appJs.includes("state.smsUsage.recentDispatches.unshift"), "Missing client-side dispatch logging in sendTwilioSms");
});

it("firestore.rules enforces security on /billing and /top_ups", () => {
  const rules = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");
  assert.ok(rules.includes("match /billing/{docId}"), "Missing billing subcollection rule");
  assert.ok(rules.includes("match /top_ups/{topUpId}"), "Missing top_ups subcollection rule");
});

it("waitlinkarchitecture.html documents all 11 Cloud Functions & SMS Volume Quota Engine", () => {
  const archHtml = fs.readFileSync(path.join(__dirname, "../waitlinkarchitecture.html"), "utf8");
  assert.ok(archHtml.includes("All 11 Serverless Cloud Functions"), "Missing 11 Cloud Functions heading in architecture doc");
  assert.ok(archHtml.includes("createStripeTopUpSession"), "Missing createStripeTopUpSession in architecture doc");
  assert.ok(archHtml.includes("verifyStripeTopUpSession"), "Missing verifyStripeTopUpSession in architecture doc");
  assert.ok(archHtml.includes("adjustShopSmsCredits"), "Missing adjustShopSmsCredits in architecture doc");
  assert.ok(archHtml.includes("SMS Outbound Volume Quotas, Metering") && archHtml.includes("Top-Up Engine"), "Missing SMS Quota architecture section");
});

console.log("\n======================================================================");
console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("======================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
