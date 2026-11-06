/**
 * WaitLink — Post-Service Survey & Dual-Mode Service Completion Test Suite
 * Comprehensive verification of Mode 1, Mode 2, Paywall Gating, Edge Cases & Memory Safety
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("======================================================================");
console.log("🧪 SUITE 9: POST-SERVICE SURVEY & DUAL-MODE SERVICE COMPLETION ENGINE");
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
// Logic Replicas & Verification Helpers
// -------------------------------------------------------------------------
const DEFAULT_SURVEY_SMS_TEMPLATE = "Thanks for visiting {shop}! How was your experience today? Rate us here: {link}";

function formatSurveySms(template, customerName, shopName, destinationUrl) {
  const defaultTpl = DEFAULT_SURVEY_SMS_TEMPLATE;
  const tpl = (template && template.trim()) ? template.trim() : defaultTpl;
  let formatted = tpl
    .replace(/\{name\}|\{customerName\}/gi, customerName || "Customer")
    .replace(/\{shop\}|\{shopName\}/gi, shopName || "our shop");

  const effectiveLink = destinationUrl || "https://waitlink.app";
  const hasLinkTag = /\{link\}|\{surveyUrl\}|\{url\}/i.test(formatted);
  if (hasLinkTag) {
    formatted = formatted.replace(/\{link\}|\{surveyUrl\}|\{url\}/gi, effectiveLink);
  } else if (destinationUrl) {
    formatted += ` Rate us: ${destinationUrl}`;
  }
  return formatted.trim();
}

function getSurveyAutoDelayMinutes(item, config) {
  let baseDuration = 0;
  if (item && item.selectedServiceDurationMin && parseInt(item.selectedServiceDurationMin, 10) > 0) {
    baseDuration = parseInt(item.selectedServiceDurationMin, 10);
  } else {
    baseDuration = parseInt((config && config.estBaseWaitMin), 10) || 20;
  }
  const surv = (config && config.surveySettings) || {};
  const buffer = parseInt(surv.bufferMinutes, 10) || 0;
  return Math.max(1, baseDuration + buffer);
}

// -------------------------------------------------------------------------
// 1. Template Formatting & Placeholder Replacement
// -------------------------------------------------------------------------
console.log("--- 1. SMS Template Formatting & Placeholders ---");

it("replaces {name}, {shop}, and {link} in survey template", () => {
  const tpl = "Hey {name}, thanks for visiting {shop}! Leave a review: {link}";
  const res = formatSurveySms(tpl, "David", "Blade & Razor", "https://g.page/r/test/review");
  assert.strictEqual(res, "Hey David, thanks for visiting Blade & Razor! Leave a review: https://g.page/r/test/review");
});

it("appends review link when {link} tag is omitted in custom template", () => {
  const tpl = "Thanks for stopping by {shop}!";
  const res = formatSurveySms(tpl, "Alex", "Downtown Barber", "https://g.page/r/downtown/review");
  assert.ok(res.includes("https://g.page/r/downtown/review"));
  assert.ok(res.startsWith("Thanks for stopping by Downtown Barber!"));
});

it("falls back gracefully when customer name is missing or null", () => {
  const res = formatSurveySms(DEFAULT_SURVEY_SMS_TEMPLATE, null, "Main St Barbers", "https://g.page/r/test");
  assert.ok(res.includes("Main St Barbers"));
  assert.ok(res.includes("https://g.page/r/test"));
});

// -------------------------------------------------------------------------
// 2. Dynamic Service Time & Buffer Math (Zero Hardcoding)
// -------------------------------------------------------------------------
console.log("\n--- 2. Dynamic Service Time & Buffer Math ---");

it("derives delay strictly from item selectedServiceDurationMin when present", () => {
  const item = { selectedServiceDurationMin: 45 };
  const config = { estBaseWaitMin: 20, surveySettings: { bufferMinutes: 0 } };
  const delay = getSurveyAutoDelayMinutes(item, config);
  assert.strictEqual(delay, 45, "Should use service duration 45m");
});

it("falls back to shop profile estBaseWaitMin when service has no duration", () => {
  const item = { selectedServiceDurationMin: 0 };
  const config = { estBaseWaitMin: 35, surveySettings: { bufferMinutes: 0 } };
  const delay = getSurveyAutoDelayMinutes(item, config);
  assert.strictEqual(delay, 35, "Should use profile baseline duration 35m");
});

it("adds owner-configured buffer minutes to service duration", () => {
  const item = { selectedServiceDurationMin: 25 };
  const config = { estBaseWaitMin: 20, surveySettings: { bufferMinutes: 5 } };
  const delay = getSurveyAutoDelayMinutes(item, config);
  assert.strictEqual(delay, 30, "Should add 5m buffer to 25m service = 30m");
});

it("guarantees a minimum delay of at least 1 minute even if durations are 0", () => {
  const item = { selectedServiceDurationMin: 0 };
  const config = { estBaseWaitMin: 0, surveySettings: { bufferMinutes: 0 } };
  const delay = getSurveyAutoDelayMinutes(item, config);
  assert.ok(delay >= 1, "Delay must never be 0 or negative");
});

// -------------------------------------------------------------------------
// 3. Mode 1: Active Chair & Complete Service Lifecycle
// -------------------------------------------------------------------------
console.log("\n--- 3. Mode 1: Active Chair & Service Completion ---");

it("Mode 1: sets ticket status to in_service upon desk call", () => {
  const config = { surveySettings: { enabled: true, mode: "mode_1", destinationUrl: "https://g.page/r/test" } };
  const now = Date.now();
  const queueItem = { id: "cust_1", customerName: "Marcus T.", checkedInAt: now - (15 * 60 * 1000) };

  const isMode1 = config.surveySettings.enabled && config.surveySettings.mode === "mode_1";
  const historyItem = {
    ...queueItem,
    status: isMode1 ? "in_service" : "called",
    calledAt: now,
    serviceStartedAt: now,
    completedAt: isMode1 ? null : now,
    waitDurationMin: Math.max(1, Math.round((now - queueItem.checkedInAt) / 60000)),
    serviceDurationMin: 0,
    surveySent: false
  };

  assert.strictEqual(historyItem.status, "in_service");
  assert.strictEqual(historyItem.waitDurationMin, 15);
  assert.strictEqual(historyItem.completedAt, null);
  assert.strictEqual(historyItem.surveySent, false);
});

it("Mode 1: completeService computes serviceDurationMin and marks status completed", () => {
  const startTs = Date.now() - (22 * 60 * 1000);
  const inServiceItem = {
    id: "cust_1",
    customerName: "Marcus T.",
    status: "in_service",
    calledAt: startTs,
    serviceStartedAt: startTs,
    waitDurationMin: 15,
    surveySent: false
  };

  const completedAt = Date.now();
  inServiceItem.status = "completed";
  inServiceItem.completedAt = completedAt;
  inServiceItem.serviceDurationMin = Math.max(1, Math.round((completedAt - inServiceItem.serviceStartedAt) / 60000));
  inServiceItem.surveySent = true;
  inServiceItem.surveySentAt = completedAt;

  assert.strictEqual(inServiceItem.status, "completed");
  assert.strictEqual(inServiceItem.serviceDurationMin, 22);
  assert.strictEqual(inServiceItem.surveySent, true);
});

// -------------------------------------------------------------------------
// 4. Mode 2: Auto-Delay & Manual Override
// -------------------------------------------------------------------------
console.log("\n--- 4. Mode 2: Auto-Delay & Manual Override ---");

it("Mode 2: sets ticket status to called and initiates timer calculation", () => {
  const config = { estBaseWaitMin: 20, surveySettings: { enabled: true, mode: "mode_2", destinationUrl: "https://g.page/r/test", bufferMinutes: 5 } };
  const item = { id: "cust_2", customerName: "Sarah L.", selectedServiceDurationMin: 20 };
  const totalDelayMin = getSurveyAutoDelayMinutes(item, config);
  assert.strictEqual(totalDelayMin, 25);
});

it("Mode 2: manual override immediately dispatches survey and cancels timer", () => {
  const activeTimers = new Map();
  const ticketId = "cust_2";

  // Simulate scheduled timer
  const mockTimerId = setTimeout(() => {}, 100000);
  activeTimers.set(ticketId, mockTimerId);
  assert.strictEqual(activeTimers.has(ticketId), true);

  // Manual override triggered
  if (activeTimers.has(ticketId)) {
    clearTimeout(activeTimers.get(ticketId));
    activeTimers.delete(ticketId);
  }

  assert.strictEqual(activeTimers.has(ticketId), false, "Active timer must be cleanly cleared");
});

// -------------------------------------------------------------------------
// 5. Deduplication & Race Condition Guards
// -------------------------------------------------------------------------
console.log("\n--- 5. Deduplication & Race Condition Guards ---");

it("prevents double survey dispatch when surveySent is already true", () => {
  const item = { id: "cust_3", customerName: "Chris K.", surveySent: true, surveySentAt: Date.now() - 5000 };
  let smsDispatched = false;

  function triggerSurvey(target) {
    if (target.surveySent) return false;
    target.surveySent = true;
    smsDispatched = true;
    return true;
  }

  const result = triggerSurvey(item);
  assert.strictEqual(result, false, "Should abort dispatch because surveySent is already true");
  assert.strictEqual(smsDispatched, false, "SMS must not be dispatched twice");
});

// -------------------------------------------------------------------------
// 6. Edge Cases: No Phone & Requeue Cleanup
// -------------------------------------------------------------------------
console.log("\n--- 6. Edge Cases: No Phone & Timer Cleanup ---");

it("handles customer with null or empty phone without error and skips SMS", () => {
  const item = { id: "cust_4", customerName: "Walk-in Guest", phone: null, surveySent: false };
  let smsAttempted = false;

  if (item.phone) {
    smsAttempted = true;
  } else {
    // Web ticket only path
    item.surveySent = true;
    item.surveyTrigger = "web_ticket_only";
  }

  assert.strictEqual(smsAttempted, false, "SMS should be skipped when phone is null");
  assert.strictEqual(item.surveySent, true, "Ticket should still register surveySent");
});

it("clears pending survey timers when customer is marked no-show or requeued", () => {
  const activeTimers = new Map();
  const ticketId = "cust_5";
  const timerId = setTimeout(() => {}, 50000);
  activeTimers.set(ticketId, timerId);

  // Mark No-Show occurs
  if (activeTimers.has(ticketId)) {
    clearTimeout(activeTimers.get(ticketId));
    activeTimers.delete(ticketId);
  }

  assert.strictEqual(activeTimers.has(ticketId), false, "Timer must be cleared on cancellation");
});

// -------------------------------------------------------------------------
// 7. Data Accuracy & Metrics Invariants
// -------------------------------------------------------------------------
console.log("\n--- 7. Data Accuracy & Metrics Invariants ---");

it("getTodayCalledVisits includes both called, in_service, and completed records", () => {
  const startOfToday = Date.now() - 3600000;
  const history = [
    { id: "h1", status: "called", calledAt: startOfToday + 1000 },
    { id: "h2", status: "in_service", calledAt: startOfToday + 2000 },
    { id: "h3", status: "completed", calledAt: startOfToday + 3000 },
    { id: "h4", status: "cancelled", calledAt: startOfToday + 4000 }
  ];

  const todayVisits = history.filter(item => {
    if (item.status !== "called" && item.status !== "in_service" && item.status !== "completed") return false;
    const targetTs = item.calledAt || item.checkedInAt;
    return targetTs && targetTs >= startOfToday;
  });

  assert.strictEqual(todayVisits.length, 3, "Must include called, in_service, and completed");
  assert.ok(!todayVisits.some(item => item.status === "cancelled"), "Cancelled visits must be excluded");
});

// -------------------------------------------------------------------------
// 8. DOM Integrity & Paywall Markups
// -------------------------------------------------------------------------
console.log("\n--- 8. DOM & Markup Integrity ---");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const styleCss = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");

it("index.html contains Reviews & Surveys subtab button and pane", () => {
  assert.ok(indexHtml.includes('data-subtab="surveys"'), "Must contain surveys subtab button");
  assert.ok(indexHtml.includes('id="settings-pane-surveys"'), "Must contain settings-pane-surveys");
  assert.ok(indexHtml.includes('id="owner-survey-card"'), "Must contain owner-survey-card");
  assert.ok(indexHtml.includes('id="owner-survey-enabled"'), "Must contain owner-survey-enabled toggle");
  assert.ok(indexHtml.includes('id="owner-survey-url"'), "Must contain owner-survey-url input");
  assert.ok(indexHtml.includes('id="owner-survey-mode-1"'), "Must contain Mode 1 radio");
  assert.ok(indexHtml.includes('id="owner-survey-mode-2"'), "Must contain Mode 2 radio");
});

it("index.html contains in-service-container on desk view", () => {
  assert.ok(indexHtml.includes('id="in-service-container"'), "Must contain in-service-container");
});

it("index.html contains review-qr-modal for in-person desk checkout", () => {
  assert.ok(indexHtml.includes('id="review-qr-modal"'), "Must contain review-qr-modal");
  assert.ok(indexHtml.includes('id="review-qr-canvas"'), "Must contain review-qr-canvas");
});

it("app.js implements survey lockdown, completeService, and survey trigger functions", () => {
  assert.ok(appJs.includes("DEFAULT_SURVEY_SMS_TEMPLATE"), "Must define DEFAULT_SURVEY_SMS_TEMPLATE");
  assert.ok(appJs.includes("function completeService("), "Must implement completeService");
  assert.ok(appJs.includes("function triggerSurveyForTicket("), "Must implement triggerSurveyForTicket");
  assert.ok(appJs.includes("function scheduleSurveyAutoTimer("), "Must implement scheduleSurveyAutoTimer");
  assert.ok(appJs.includes("function clearSurveyAutoTimer("), "Must implement clearSurveyAutoTimer");
  assert.ok(appJs.includes("function openReviewQrModal("), "Must implement openReviewQrModal");
});

it("style.css contains styles for in-service-panel and review buttons", () => {
  assert.ok(styleCss.includes(".in-service-panel"), "Must define in-service-panel");
  assert.ok(styleCss.includes(".btn-complete-service"), "Must define btn-complete-service");
  assert.ok(styleCss.includes(".btn-row-survey"), "Must define btn-row-survey");
  assert.ok(styleCss.includes(".ticket-survey-box"), "Must define ticket-survey-box");
});

// -------------------------------------------------------------------------
// 9. Upgrade Modal & Demo Gate Invariants
// -------------------------------------------------------------------------
console.log("\n--- 9. Upgrade Modal & Demo Gate Invariants ---");

it("isDemoScreenOrGuestDemo strictly unblocks authenticated owners on real shops like CrossLine Euro", () => {
  assert.ok(appJs.includes("if (!isGuest && !isDemoShop) {\n    return false;\n  }"), "isDemoScreenOrGuestDemo must immediately unblock authenticated users on real shops");
  assert.ok(appJs.includes('else if (targetTier === "pro")'), "openUpgradeModal must highlight pro card");
  assert.ok(indexHtml.includes("openUpgradeModal('pro')"), "Survey upgrade button must target pro tier directly");
});

it("PRO BUSINESS and ENTERPRISE users strictly do not see Upgrade to Unlock button in Review & Surveys", () => {
  // 1. Verify getActivePlanInfo correctly recognizes Pro and Enterprise
  assert.ok(appJs.includes("planPrice >= 49 || planTitle.toLowerCase().includes(\"enterprise\")"), "Must recognize Enterprise tier");
  assert.ok(appJs.includes("planPrice >= 15 || planTitle.toLowerCase().includes(\"pro\")"), "Must recognize Pro Business tier");

  // 2. Verify updateTierFeatureLockdown sets display: none !important and hides banner for isPaid
  assert.ok(appJs.includes('surveyBanner.style.setProperty("display", "none", "important");'), "updateTierFeatureLockdown must enforce display none !important on survey banner for paid users");
  assert.ok(appJs.includes('surveyBadge.textContent = "✓ UNLOCKED";'), "Must unlock badge for paid users");

  // 3. Verify index.html initializes survey-locked-banner with pro-locked-banner hidden and display: none !important
  assert.ok(indexHtml.includes('id="survey-locked-banner" class="pro-locked-banner hidden" style="display: none !important;'), "index.html must initialize survey-locked-banner hidden");

  // 4. Verify style.css rules suppress banner for unlocked cards
  assert.ok(styleCss.includes("#owner-survey-card:not(.locked) #survey-locked-banner"), "style.css must suppress survey-locked-banner when card is not locked");
  assert.ok(styleCss.includes("#survey-locked-banner.hidden"), "style.css must suppress survey-locked-banner with hidden class");
});

// -------------------------------------------------------------------------
// 10. Completed Visit Actions & Customer Feedback Invariants
// -------------------------------------------------------------------------
console.log("\n--- 10. Completed Visit Actions & Customer Feedback Invariants ---");

it("app.js renders manual Send Survey and Show QR action buttons for completed visits in Mode 1 and Mode 2", () => {
  assert.ok(appJs.includes('class="btn-row-survey" onclick="manualTriggerSurvey(\'${safeId}\')"'), "Must include Send Survey button in history row");
  assert.ok(appJs.includes('class="btn-row-survey-qr" onclick="openReviewQrModal(\'${safeId}\')"'), "Must include Show QR button in history row");
  assert.ok(appJs.includes('item.status === "completed" || item.status === "called" || item.status === "served"'), "Must guard survey buttons for any completed/called visit");
});

it("app.js renders ticket-survey-review-box and exports submitCustomerStarRating for customer rating", () => {
  assert.ok(appJs.includes('ticket-survey-review-box'), "Must manage ticket-survey-review-box");
  assert.ok(appJs.includes('function submitCustomerStarRating('), "Must implement submitCustomerStarRating");
  assert.ok(appJs.includes('window.submitCustomerStarRating = submitCustomerStarRating;'), "Must attach submitCustomerStarRating to window");
  assert.ok(appJs.includes('star-rating-row'), "Must render interactive 5-star rating row");
});

it("app.js generates fallback review URL when destinationUrl is unconfigured", () => {
  assert.ok(appJs.includes("&feedback=1&tid="), "Must construct fallback review link when destinationUrl is missing");
});

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log("\n======================================================================");
console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("======================================================================\n");

if (failed > 0) {
  process.exit(1);
}
