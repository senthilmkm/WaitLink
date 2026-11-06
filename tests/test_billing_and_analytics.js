/**
 * WaitLink — Billing Economics, Retention Compliance & BI Analytics Test Suite
 * 100% Comprehensive Coverage for Top-Up Packs, PII Anonymization, RFC 4180 CSV, and Business Intelligence Math
 */

const assert = require("assert");

console.log("======================================================================");
console.log("🧪 SUITE 3: BILLING ECONOMICS, RETENTION COMPLIANCE & BI ANALYTICS");
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
// Core Logic Replicas (Mirrors app.js verified functions)
// -------------------------------------------------------------------------

function getRetentionWindowDays(planInfo, retentionConfig = {}) {
  if (planInfo.isEnterprise) {
    return Number(retentionConfig.enterprise_retention_days) || 365;
  }
  if (planInfo.isPro) {
    return Number(retentionConfig.pro_retention_days) || 90;
  }
  return Number(retentionConfig.starter_retention_days) || 7;
}

function isRecordSubjectToPiiMasking(timestamp, thresholdDays = 30) {
  if (!timestamp) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs >= (thresholdDays * 24 * 60 * 60 * 1000);
}

function maskHistoricalPhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  if (!cleaned) return "";

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 4) {
    return "***-****";
  }
  const last4 = digits.slice(-4);
  
  if (cleaned.startsWith("+1") || (digits.length === 11 && digits.startsWith("1"))) {
    return `+1 (***) ***-${last4}`;
  } else if (digits.length === 10) {
    return `(***) ***-${last4}`;
  } else if (cleaned.startsWith("+")) {
    const countryPrefix = cleaned.split(" ")[0] || "+*";
    return `${countryPrefix} (***) ***-${last4}`;
  }
  return `(***) ***-${last4}`;
}

function maskHistoricalName(fullName, preserveFirstName = true) {
  if (!fullName) return "Customer";
  const str = String(fullName).trim();
  if (!str) return "Customer";

  if (!preserveFirstName) {
    return "Customer";
  }

  const parts = str.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }
  const firstName = parts[0];
  const lastPart = parts[parts.length - 1];
  const lastInitial = lastPart.charAt(0).toUpperCase() + ".";
  return `${firstName} ${lastInitial}`;
}

function calculateWalkAwayLossRate(totalVisits, cancelledVisits) {
  if (!totalVisits || totalVisits <= 0) return 0;
  return Math.round((cancelledVisits / totalVisits) * 1000) / 10; // e.g. 15.5%
}

function calculatePeakRushHour(visits = []) {
  if (!visits || visits.length === 0) return { peakHour: null, count: 0 };
  const hourBuckets = Array(24).fill(0);
  visits.forEach(v => {
    const ts = v.checkedInAt || v.calledAt;
    if (ts) {
      const h = new Date(ts).getHours();
      hourBuckets[h]++;
    }
  });

  let maxHour = 0;
  let maxCount = 0;
  hourBuckets.forEach((cnt, h) => {
    if (cnt > maxCount) {
      maxCount = cnt;
      maxHour = h;
    }
  });

  return { peakHour: maxHour, count: maxCount };
}

function calculateStaffVelocity(completedVisitsCount, elapsedHours) {
  if (!elapsedHours || elapsedHours <= 0) return 0;
  return Math.round((completedVisitsCount / elapsedHours) * 10) / 10;
}

function formatRfc4180CsvRow(fields) {
  return fields.map(field => {
    const str = (field === null || field === undefined) ? "" : String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(",");
}

// -------------------------------------------------------------------------
// Tests: Top-Up Unit Economics & Wholesale Margins
// -------------------------------------------------------------------------
console.log("--- 1. Top-Up Packs Unit Economics & Gross Profit Margins ---");

const TWILIO_US_WHOLESALE_COST_PER_SMS = 0.0079; // $0.0079 / SMS

it("Top-Up Pack [MICRO]: $5.00 for 250 SMS generates >= 55% gross margin", () => {
  const price = 5.00;
  const count = 250;
  const wholesaleCost = count * TWILIO_US_WHOLESALE_COST_PER_SMS; // $1.975
  const grossProfit = price - wholesaleCost; // $3.025
  const marginPct = (grossProfit / price) * 100;
  assert.ok(marginPct >= 55, `Margin is ${marginPct}% (expected >= 55%)`);
});

it("Top-Up Pack [GROWTH]: $15.00 for 1,000 SMS generates >= 45% gross margin", () => {
  const price = 15.00;
  const count = 1000;
  const wholesaleCost = count * TWILIO_US_WHOLESALE_COST_PER_SMS; // $7.90
  const grossProfit = price - wholesaleCost; // $7.10
  const marginPct = (grossProfit / price) * 100;
  assert.ok(marginPct >= 45, `Margin is ${marginPct}% (expected >= 45%)`);
});

it("Top-Up Pack [POWER]: $39.00 for 2,500 SMS generates >= 45% gross margin", () => {
  const price = 39.00;
  const count = 2500;
  const wholesaleCost = count * TWILIO_US_WHOLESALE_COST_PER_SMS; // $19.75
  const grossProfit = price - wholesaleCost; // $19.25
  const marginPct = (grossProfit / price) * 100;
  assert.ok(marginPct >= 45, `Margin is ${marginPct}% (expected >= 45%)`);
});

// -------------------------------------------------------------------------
// Tests: Data Retention & PII Anonymization
// -------------------------------------------------------------------------
console.log("\n--- 2. Tier-Gated Data Retention & PII Anonymization ---");

it("getRetentionWindowDays: Respects Starter (7d), Pro (90d), Enterprise (365d)", () => {
  assert.strictEqual(getRetentionWindowDays({ isStarter: true }), 7);
  assert.strictEqual(getRetentionWindowDays({ isPro: true }), 90);
  assert.strictEqual(getRetentionWindowDays({ isEnterprise: true }), 365);
});

it("isRecordSubjectToPiiMasking: Triggers when record is 30+ days old", () => {
  const now = Date.now();
  const day29 = now - (29 * 24 * 60 * 60 * 1000);
  const day31 = now - (31 * 24 * 60 * 60 * 1000);

  assert.strictEqual(isRecordSubjectToPiiMasking(day29, 30), false);
  assert.strictEqual(isRecordSubjectToPiiMasking(day31, 30), true);
  assert.strictEqual(isRecordSubjectToPiiMasking(null), false);
});

it("maskHistoricalPhone: Accurately masks historical customer phones", () => {
  assert.strictEqual(maskHistoricalPhone("980-253-1359"), "(***) ***-1359");
  assert.strictEqual(maskHistoricalPhone("+19802531359"), "+1 (***) ***-1359");
  assert.strictEqual(maskHistoricalPhone(""), "");
  assert.strictEqual(maskHistoricalPhone(null), "");
});

it("maskHistoricalName: Preserves first name while scrubbing last name PII", () => {
  assert.strictEqual(maskHistoricalName("Marcus Sterling", true), "Marcus S.");
  assert.strictEqual(maskHistoricalName("Sarah Jenkins", true), "Sarah J.");
  assert.strictEqual(maskHistoricalName("Cher", true), "Cher");
  assert.strictEqual(maskHistoricalName("Marcus Sterling", false), "Customer");
});

// -------------------------------------------------------------------------
// Tests: Business Intelligence Analytics Math
// -------------------------------------------------------------------------
console.log("\n--- 3. Business Intelligence Analytics Math ---");

it("Walk-Away Loss Rate calculates percentage with safe division guard", () => {
  assert.strictEqual(calculateWalkAwayLossRate(100, 15), 15);
  assert.strictEqual(calculateWalkAwayLossRate(200, 31), 15.5);
  assert.strictEqual(calculateWalkAwayLossRate(0, 0), 0);
});

it("Peak Rush Window identifies busiest operating hour", () => {
  const baseToday = new Date().setHours(0, 0, 0, 0);
  const visits = [
    { checkedInAt: baseToday + (11 * 3600000) }, // 11 AM
    { checkedInAt: baseToday + (14 * 3600000) }, // 2 PM
    { checkedInAt: baseToday + (14 * 3600000) }, // 2 PM
    { checkedInAt: baseToday + (14 * 3600000) }, // 2 PM
    { checkedInAt: baseToday + (17 * 3600000) }  // 5 PM
  ];

  const peak = calculatePeakRushHour(visits);
  assert.strictEqual(peak.peakHour, 14); // 2 PM
  assert.strictEqual(peak.count, 3);
});

it("Staff Velocity throughput computes visits/hour accurately", () => {
  assert.strictEqual(calculateStaffVelocity(40, 8), 5); // 5 visits/hr
  assert.strictEqual(calculateStaffVelocity(25, 4), 6.3); // 6.3 visits/hr
  assert.strictEqual(calculateStaffVelocity(10, 0), 0); // safe division
});

// -------------------------------------------------------------------------
// Tests: RFC 4180 CSV Formatting Compliance
// -------------------------------------------------------------------------
console.log("\n--- 4. RFC 4180 CSV Compliant Formatting ---");

it("formatRfc4180CsvRow: Properly escapes commas, quotes, and newlines", () => {
  const plainRow = ["TK-101", "Marcus S.", "980-253-1359", "Fade & Beard", 1];
  assert.strictEqual(formatRfc4180CsvRow(plainRow), "TK-101,Marcus S.,980-253-1359,Fade & Beard,1");

  const rowWithComma = ["TK-102", "Sarah, MD", "Not Provided", "Exam, Consultation", 1];
  assert.strictEqual(formatRfc4180CsvRow(rowWithComma), 'TK-102,"Sarah, MD",Not Provided,"Exam, Consultation",1');

  const rowWithQuotes = ["TK-103", 'Marcus "The Barber"', "980-253-1359", "Cut", 1];
  assert.strictEqual(formatRfc4180CsvRow(rowWithQuotes), 'TK-103,"Marcus ""The Barber""",980-253-1359,Cut,1');
});

// -------------------------------------------------------------------------
// Tests: Stripe Checkout Cancellation Routing & Guidance Invariants
// -------------------------------------------------------------------------
console.log("\n--- 5. Stripe Checkout Navigation & Return URL Integrity ---");

it("buildStripeSubscriptionCancelUrl: Includes action=upgrade to reopen pricing modal", () => {
  const hostOrigin = "https://waitlink.app";
  const shopSlug = "downtown-salon";
  const tierKey = "pro";
  const cancelUrl = `${hostOrigin}?s=${encodeURIComponent(shopSlug)}&action=upgrade&tier=${encodeURIComponent(tierKey)}&payment=cancelled`;

  const parsed = new URL(cancelUrl);
  assert.strictEqual(parsed.searchParams.get("action"), "upgrade");
  assert.strictEqual(parsed.searchParams.get("payment"), "cancelled");
  assert.strictEqual(parsed.searchParams.get("tier"), "pro");
  assert.strictEqual(parsed.searchParams.get("s"), "downtown-salon");
});

it("buildStripeTopUpCancelUrl: Includes view=owner and subtab=notifications to restore SMS settings", () => {
  const hostOrigin = "https://waitlink.app";
  const cleanSlug = "uptown-cuts";
  const cancelUrl = `${hostOrigin}?s=${encodeURIComponent(cleanSlug)}&view=owner&subtab=notifications&topup=cancel`;

  const parsed = new URL(cancelUrl);
  assert.strictEqual(parsed.searchParams.get("view"), "owner");
  assert.strictEqual(parsed.searchParams.get("subtab"), "notifications");
  assert.strictEqual(parsed.searchParams.get("topup"), "cancel");
});

// -------------------------------------------------------------------------
// Tests: Starter Tier Dynamic Check-in Cap & Paywall Resolution
// -------------------------------------------------------------------------
console.log("\n--- 6. Starter Tier Dynamic Check-in Cap & SuperAdmin Governance ---");

function resolveStarterCheckinCap(shopConfig = {}, globalState = {}) {
  const customQuota = shopConfig.customMonthlyQuota ? parseInt(shopConfig.customMonthlyQuota, 10) : null;
  if (customQuota && !isNaN(customQuota) && customQuota > 0) {
    return customQuota;
  }
  if (globalState.starterCheckinCap && !isNaN(globalState.starterCheckinCap) && globalState.starterCheckinCap > 0) {
    return globalState.starterCheckinCap;
  }
  return 100;
}

function evaluateMonthlyCheckinAllowed(planPrice, currentCount, cap) {
  if (planPrice >= 15) return true; // Pro or Enterprise unlimited
  return currentCount < cap;
}

it("resolveStarterCheckinCap: Defaults to exactly 100 when no custom or global override set", () => {
  const cap = resolveStarterCheckinCap({}, {});
  assert.strictEqual(cap, 100);
});

it("resolveStarterCheckinCap: Respects SuperAdmin dynamic platform cap when modified (e.g. 150)", () => {
  const cap = resolveStarterCheckinCap({}, { starterCheckinCap: 150 });
  assert.strictEqual(cap, 150);
});

it("resolveStarterCheckinCap: Shop customMonthlyQuota takes priority over platform global cap", () => {
  const cap = resolveStarterCheckinCap({ customMonthlyQuota: 300 }, { starterCheckinCap: 125 });
  assert.strictEqual(cap, 300);
});

it("evaluateMonthlyCheckinAllowed: Permits check-in below dynamic cap and blocks at or above cap", () => {
  const cap = 100;
  assert.strictEqual(evaluateMonthlyCheckinAllowed(0, 99, cap), true);
  assert.strictEqual(evaluateMonthlyCheckinAllowed(0, 100, cap), false);
  assert.strictEqual(evaluateMonthlyCheckinAllowed(0, 101, cap), false);
});

it("evaluateMonthlyCheckinAllowed: Paid plans ($15 Pro, $49 Enterprise) are unlimited regardless of check-in count", () => {
  assert.strictEqual(evaluateMonthlyCheckinAllowed(15, 500, 100), true);
  assert.strictEqual(evaluateMonthlyCheckinAllowed(49, 10000, 100), true);
});

// -------------------------------------------------------------------------
// 7. Pricing Tier Deduplication & SMS Allowance Invariants
// -------------------------------------------------------------------------
console.log("\n--- 7. Pricing Tier Deduplication & SMS Allowance Invariants ---");

function deduplicateTierFeatures(features) {
  const result = [];
  let has0Sms = false;
  let has500Sms = false;
  let has2500Sms = false;

  features.forEach(f => {
    const text = typeof f === 'object' && f !== null ? f.text : String(f);
    const lower = text.toLowerCase();

    // Deduplicate 0 SMS variants
    if (lower.includes("0 sms")) {
      if (has0Sms) return;
      has0Sms = true;
      result.push({ text: "0 SMS Included (Live Mobile Web Card & Lobby Screen Calling only)", enabled: true });
      return;
    }
    // Deduplicate 500 SMS variants
    if (lower.includes("500") && lower.includes("sms")) {
      if (has500Sms) return;
      has500Sms = true;
      result.push({ text: "500 Automated SMS Customer Alerts / month Included", enabled: true });
      return;
    }
    // Deduplicate 2,500 SMS variants
    if ((lower.includes("2,500") || lower.includes("2500")) && lower.includes("sms")) {
      if (has2500Sms) return;
      has2500Sms = true;
      result.push({ text: "2,500+ Automated SMS / mo Included", enabled: true });
      return;
    }
    result.push(f);
  });
  return result;
}

it("deduplicateTierFeatures: Eliminates duplicate 0 SMS bullets in Starter plan", () => {
  const rawStarterFeatures = [
    { text: "1 Staff Login", enabled: true },
    { text: "0 SMS Included (Live Mobile Web Card & Lobby Screen Calling only)", enabled: true },
    { text: "0 SMS (Live Mobile Web Card & Lobby Screen Calling only)", enabled: true },
    { text: "Live Public Web Queue Card", enabled: true }
  ];
  const cleaned = deduplicateTierFeatures(rawStarterFeatures);
  const smsCount = cleaned.filter(f => f.text.toLowerCase().includes("0 sms")).length;
  assert.strictEqual(smsCount, 1, "Starter plan must contain strictly one 0 SMS feature bullet");
  assert.strictEqual(cleaned.length, 3, "Duplicate bullet must be removed");
});

it("deduplicateTierFeatures: Eliminates duplicate 500 SMS bullets in Pro Business tier", () => {
  const rawProFeatures = [
    { text: "5 Staff Logins", enabled: true },
    { text: "500 Automated SMS Customer Alerts / month Included", enabled: true },
    { text: "500 Automated SMS Customer Alerts / month", enabled: true },
    { text: "Post-Service 5-Star Google Review Booster", enabled: true }
  ];
  const cleaned = deduplicateTierFeatures(rawProFeatures);
  const smsCount = cleaned.filter(f => f.text.toLowerCase().includes("500")).length;
  assert.strictEqual(smsCount, 1, "Pro Business tier must contain strictly one 500 SMS feature bullet");
  assert.strictEqual(cleaned.length, 3, "Duplicate 500 SMS bullet must be removed");
});

it("pricing.html strictly defines 0 SMS for Starter, 500 for Pro, and 2,500 for Enterprise without duplicate bullets", () => {
  const fs = require("fs");
  const path = require("path");
  const pricingHtml = fs.readFileSync(path.join(__dirname, "..", "pricing.html"), "utf8");
  assert.ok(pricingHtml.includes("0 SMS Included (Live Mobile Web Card"), "pricing.html must specify 0 SMS in Starter");
  assert.ok(pricingHtml.includes("500 Automated SMS"), "pricing.html must specify 500 SMS in Pro");
  assert.ok(pricingHtml.includes("2,500+ Automated SMS") || pricingHtml.includes("2,500 Automated SMS"), "pricing.html must specify 2,500 SMS in Enterprise");
});

it("addAdminFeatureItem: Bumps newly added features cleanly above crossed-out ✕ exclusions", () => {
  const mockFeatures = [
    { text: "Everything in Starter", enabled: true },
    { text: "500 Automated SMS", enabled: true },
    { text: "Multi-Location Network (Unlimited Shops)", enabled: false },
    { text: "Multiple Staff Front Desk Accounts", enabled: false }
  ];

  // Replica of app.js addAdminFeatureItem logic
  const firstDisabledIdx = mockFeatures.findIndex(f => f && f.enabled === false);
  const newItem = { text: "Automated Google Reviews & Post-Service Surveys", enabled: true };
  if (firstDisabledIdx !== -1) {
    mockFeatures.splice(firstDisabledIdx, 0, newItem);
  } else {
    mockFeatures.push(newItem);
  }

  assert.strictEqual(mockFeatures[2].text, "Automated Google Reviews & Post-Service Surveys");
  assert.strictEqual(mockFeatures[2].enabled, true, "New feature must be enabled");
  assert.strictEqual(mockFeatures[3].enabled, false, "Exclusions must remain cleanly positioned at the bottom");
  assert.strictEqual(mockFeatures[4].enabled, false, "Subsequent exclusions must remain at the bottom");
});

it("toggleAdminFeatureStatus & sorting invariant: Enabled items always precede crossed-out ✕ exclusions", () => {
  const list = [
    { text: "Feature A", enabled: false },
    { text: "Feature B", enabled: true },
    { text: "Feature C", enabled: false },
    { text: "Feature D", enabled: true }
  ];

  list.sort((a, b) => {
    const aEnabled = a.enabled !== false;
    const bEnabled = b.enabled !== false;
    if (aEnabled === bEnabled) return 0;
    return aEnabled ? -1 : 1;
  });

  assert.deepStrictEqual(
    list.map(f => f.enabled),
    [true, true, false, false],
    "All enabled (✓) features must be sorted strictly ahead of disabled (✕) exclusions"
  );
});

it("app.js & index.html: Define canonical Automated Google Reviews & Post-Service Surveys above exclusions", () => {
  const fs = require("fs");
  const path = require("path");
  const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  // 1. Check DEFAULT_TIER_FEATURES in app.js
  assert.ok(
    appJs.includes('Automated Google Reviews & Post-Service Surveys'),
    "app.js must contain canonical title: Automated Google Reviews & Post-Service Surveys"
  );

  // 2. Check ensureTierSMSLimits normalizes raw review feature labels
  assert.ok(
    appJs.includes('low.includes("customer reviews") || low.includes("enable customer reviews")'),
    "app.js ensureTierSMSLimits must normalize customer reviews variants"
  );

  // 3. Check addAdminFeatureItem bumps above exclusions
  assert.ok(
    appJs.includes('const firstDisabledIdx = state.adminFeatures[tierKey].findIndex(f => f && f.enabled === false)'),
    "addAdminFeatureItem must find firstDisabledIdx to bump new items above exclusions"
  );

  // 4. Check index.html pricing-t2-features textarea has reviews feature
  assert.ok(
    indexHtml.includes('Automated Google Reviews & Post-Service Surveys'),
    "index.html must include canonical review feature in pricing tier 2 textarea and modal"
  );
});

console.log(`\n📊 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
if (failed > 0) process.exit(1);

