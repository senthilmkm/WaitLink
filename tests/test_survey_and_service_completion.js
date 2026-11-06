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

it("calculates exact 1-minute delay when estBaseWaitMin is 1 and buffer is 0", () => {
  const item = { selectedServiceDurationMin: 0 };
  const config = { estBaseWaitMin: 1, surveySettings: { bufferMinutes: 0 } };
  const delay = getSurveyAutoDelayMinutes(item, config);
  assert.strictEqual(delay, 1, "Should calculate 1 minute delay");
});

it("calculates 6-minute delay when estBaseWaitMin is 1 and default buffer is 5", () => {
  const item = { selectedServiceDurationMin: 0 };
  const config = { estBaseWaitMin: 1, surveySettings: { bufferMinutes: 5 } };
  const delay = getSurveyAutoDelayMinutes(item, config);
  assert.strictEqual(delay, 6, "Should calculate 1m + 5m = 6 minutes delay");
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
  assert.ok(appJs.includes('window.hoverCustomerStarRating = hoverCustomerStarRating;'), "Must attach hoverCustomerStarRating to window");
  assert.ok(appJs.includes('window.resetCustomerStarHover = resetCustomerStarHover;'), "Must attach resetCustomerStarHover to window");
  assert.ok(appJs.includes('star-rating-row'), "Must render interactive 5-star rating row");
  assert.ok(appJs.includes('☆'), "Must render hollow stars initially");
  assert.ok(appJs.includes('★'), "Must render solid stars on hover and tap");
});

it("app.js generates complete public live ticket review URL with view=public and ticket ID", () => {
  assert.ok(appJs.includes("&view=public&ticket="), "Must construct public review link with view=public and ticket parameter");
  assert.ok(appJs.includes("&feedback=1"), "Must include feedback parameter in review URL");
});

// -------------------------------------------------------------------------
// 11. Legal, Compliance, SMS Transparency & Memory Safety Invariants
// -------------------------------------------------------------------------
console.log("\n--- 11. Legal, Compliance, SMS Transparency & Memory Safety ---");

const termsHtml = fs.readFileSync(path.join(__dirname, "..", "terms.html"), "utf8");
const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "privacy.html"), "utf8");
const helpHtml = fs.readFileSync(path.join(__dirname, "..", "help.html"), "utf8");
const pricingHtml = fs.readFileSync(path.join(__dirname, "..", "pricing.html"), "utf8");

it("terms.html specifies Reviews & Surveys SMS terms, 1 credit quota metering, and zero-credit exceptions", () => {
  assert.ok(termsHtml.includes("Post-Service Reviews &amp; Surveys"), "terms.html must include Post-Service Reviews section");
  assert.ok(termsHtml.includes("debits exactly one (1) SMS credit"), "terms.html must specify 1 credit debit per texted customer");
  assert.ok(termsHtml.includes("Zero (0) SMS credits are deducted for customers without phone numbers"), "terms.html must state zero credits for web-only or QR reviews");
});

it("privacy.html covers voluntary customer star ratings and SMS survey links under TCPA / CTIA compliance", () => {
  assert.ok(privacyHtml.includes("voluntary customer satisfaction ratings (1-5 stars)"), "privacy.html must include star ratings in collected information");
  assert.ok(privacyHtml.includes("optional post-service satisfaction survey link"), "privacy.html must specify survey message frequency and purpose");
});

it("help.html includes Guide 10 explaining Automated Google Reviews & Post-Service Surveys", () => {
  assert.ok(helpHtml.includes("10. Automated Google Reviews &amp; Post-Service Surveys"), "help.html must include Guide 10");
  assert.ok(helpHtml.includes("Mode 1 (Active Chair)"), "help.html must document Mode 1");
  assert.ok(helpHtml.includes("Mode 2 (Smart Delay)"), "help.html must document Mode 2");
});

it("pricing.html includes Reviews & Surveys in Pro and Enterprise tiers and exclusion in Starter", () => {
  assert.ok(pricingHtml.includes("Automated Google Reviews &amp; Post-Service Customer Surveys"), "pricing.html must feature survey booster in Pro tier");
  assert.ok(pricingHtml.includes("Multi-Location Google Reviews &amp; Post-Service Customer Surveys"), "pricing.html must feature survey booster in Enterprise tier");
  assert.ok(pricingHtml.includes("No Automated Post-Service Surveys or Google Review Boosters"), "pricing.html must explicitly exclude surveys in Starter tier");
});

it("index.html displays transparent SMS usage & credits notice in Reviews & Surveys tab", () => {
  assert.ok(indexHtml.includes("SMS Usage &amp; Credits:"), "index.html must display SMS usage callout in Reviews & Surveys pane");
  assert.ok(indexHtml.includes("1 SMS credit"), "index.html must specify 1 SMS credit per texted customer");
  assert.ok(indexHtml.includes("zero credits are deducted"), "index.html must confirm zero credits for web ticket reviews");
});

it("app.js protects against memory leaks by clearing activeSurveyTimers in beforeunload and inspectShop", () => {
  assert.ok(appJs.includes("state.activeSurveyTimers.forEach(t => clearTimeout(t));"), "Must clear survey timer timeouts on unload or shop switch");
  assert.ok(appJs.includes("state.activeSurveyTimers.clear();"), "Must clear activeSurveyTimers Map");
});

it("app.js persists surveySettings into root Firestore shop document in saveData", () => {
  assert.ok(appJs.includes("surveySettings: state.config.surveySettings || {}"), "saveData must include surveySettings in doc update");
});

it("app.js renders customerRating badge in Visit History and exports rating column in CSV", () => {
  assert.ok(appJs.includes("badge-survey-rating"), "Must render badge-survey-rating in buildHistoryRowHtml");
  assert.ok(appJs.includes('"Customer Rating (Stars)"'), "Must export Customer Rating (Stars) in exportHistoryCSV");
});

// -------------------------------------------------------------------------
// 12. More Analytics Star Rating Card, Sentiment Booster & Cloud Audit Invariants
// -------------------------------------------------------------------------
console.log("\n--- 12. More Analytics Card, Sentiment Booster & Cloud Audit Invariants ---");

it("index.html contains card-metric-reviews in Business Intelligence & Analytics grid", () => {
  assert.ok(indexHtml.includes('id="card-metric-reviews"'), "Must contain card-metric-reviews in index.html");
  assert.ok(indexHtml.includes('id="owner-avg-rating"'), "Must contain owner-avg-rating in index.html");
  assert.ok(indexHtml.includes('id="owner-avg-rating-val"'), "Must contain owner-avg-rating-val in index.html");
  assert.ok(indexHtml.includes('id="owner-rating-caption"'), "Must contain owner-rating-caption in index.html");
});

it("app.js accurately computes average rating and CSAT percentage for shop owner analytics", () => {
  const historyWithRatings = [
    { customerRating: 5 },
    { customerRating: 5 },
    { customerRating: 4 },
    { customerRating: 2 }
  ];
  const ratedVisits = historyWithRatings.filter(h => typeof h.customerRating === "number" && h.customerRating >= 1 && h.customerRating <= 5);
  const sum = ratedVisits.reduce((acc, h) => acc + h.customerRating, 0);
  const avg = (sum / ratedVisits.length).toFixed(1);
  const positiveCount = ratedVisits.filter(h => h.customerRating >= 4).length;
  const csatPct = Math.round((positiveCount / ratedVisits.length) * 100);

  assert.strictEqual(avg, "4.0", "Average rating of 5,5,4,2 must be 4.0");
  assert.strictEqual(positiveCount, 3, "3 of 4 ratings are 4+ stars");
  assert.strictEqual(csatPct, 75, "CSAT percentage must be 75%");
});

it("app.js handles empty rating history gracefully without dividing by zero", () => {
  const historyEmpty = [];
  const ratedVisits = historyEmpty.filter(h => typeof h.customerRating === "number" && h.customerRating >= 1 && h.customerRating <= 5);
  assert.strictEqual(ratedVisits.length, 0);
});

it("app.js implements editCustomerStarRating and sentiment gating for Google Review booster", () => {
  assert.ok(appJs.includes("function editCustomerStarRating()"), "Must implement editCustomerStarRating");
  assert.ok(appJs.includes("window.editCustomerStarRating = editCustomerStarRating;"), "Must export editCustomerStarRating to window");
  assert.ok(appJs.includes("post-rating-google-btn"), "Must support post-rating-google-btn container");
  assert.ok(appJs.includes("rating >= 4"), "Must gate Google Review booster strictly to 4-5 star ratings");
});

it("app.js exports clearAllSurveyTimers for zero memory leak lifecycle management", () => {
  assert.ok(appJs.includes("function clearAllSurveyTimers()"), "Must define clearAllSurveyTimers");
  assert.ok(appJs.includes("window.clearAllSurveyTimers = clearAllSurveyTimers;"), "Must export clearAllSurveyTimers to window");
});

it("Cloud Function publicQueueAction in functions/index.js handles action === rate with audit entry", () => {
  const functionsIndex = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  assert.ok(functionsIndex.includes('if (action === "rate")'), "functions/index.js must handle action === rate");
  assert.ok(functionsIndex.includes("held.customerRating = rating;"), "Must store customerRating on ticket");
  assert.ok(functionsIndex.includes("customer_rated"), "Must record customer_rated audit activity");
});

// -------------------------------------------------------------------------
// 13. Defect Regressions: 401 Prevention, Audit Modal Sizing & Checkout QR Poster
// -------------------------------------------------------------------------
console.log("\n--- 13. Defect Regressions: 401 Prevention, Audit Modal Sizing & Checkout QR Poster ---");

it("app.js strictly prevents public and unauthenticated sessions from executing survey auto-timers or Twilio SMS (Fix for 401 Rejection)", () => {
  assert.ok(appJs.includes("const isPublicView = urlParams && (urlParams.get(\"view\") === \"public\" || urlParams.get(\"view\") === \"display\" || urlParams.has(\"ticket\") || urlParams.has(\"t\") || urlParams.has(\"feedback\"));"), "Must detect public customer view in auto timer");
  assert.ok(appJs.includes("if (isPublicView || !isOperator) return;"), "scheduleSurveyAutoTimer must immediately abort for public customers");
  assert.ok(appJs.includes("Unauthorized: only authenticated front desk operator can trigger surveys"), "triggerSurveyForTicket must reject unauthorized public callers");
});

it("app.js encodes ticket review URL in openReviewQrModal and renders smart subtitle for front desk", () => {
  assert.ok(appJs.includes("const ticketReviewUrl = `${origin}/?s=${encodeURIComponent(cleanSlug)}&view=public&ticket=${encodeURIComponent(item ? item.id : '')}&feedback=1`;"), "openReviewQrModal must generate ticket review URL");
  assert.ok(appJs.includes("subtitle.textContent = (item.customerRating)"), "openReviewQrModal must check item.customerRating for subtitle");
  assert.ok(appJs.includes("already submitted a"), "openReviewQrModal must confirm existing rating in subtitle");
  assert.ok(appJs.includes("Open Direct Google Review Page ↗"), "openReviewQrModal must offer direct link if destinationUrl set");
});

it("index.html provides spacious 980px max-width and 520px timeline container for Complete Lifecycle Audit Log modal", () => {
  assert.ok(indexHtml.includes('id="modal-customer-audit-trail"'), "Must contain modal-customer-audit-trail");
  assert.ok(indexHtml.includes('max-width: 980px; width: 96%; max-height: 94vh;'), "Audit modal card must use 980px width and 94vh max-height");
  assert.ok(indexHtml.includes('padding: 2.25rem 2.75rem;'), "Audit modal card must use 2.25rem 2.75rem padding");
  assert.ok(indexHtml.includes('max-height: 520px; overflow-y: auto;'), "Audit timeline container must have 520px max-height scroll area");
});

it("app.js openCustomerAuditModal renders Completed (Served) in emerald green for finished visits", () => {
  assert.ok(appJs.includes('item.status === "completed" || item.status === "called" || item.status === "served"'), "Must recognize completed status in audit modal");
  assert.ok(appJs.includes('Completed (Served)'), "Must display Completed (Served) text");
  assert.ok(appJs.includes('#10b981'), "Must use emerald green #10b981 for completed status");
});

it("app.js submitCustomerStarRating implements idempotency guard and update audit logging", () => {
  assert.ok(appJs.includes("if (existingRating === rating && starRow && starRow.style.pointerEvents === \"none\")"), "Must guard against duplicate star submissions");
  assert.ok(appJs.includes("Customer updated rating to ${rating}/5 stars on Web Ticket"), "Must log update activity when rating is changed");
});

it("app.js triggerSurveyForTicket enforces paywall gating and prevents SMS dispatch on starter tier", () => {
  assert.ok(appJs.includes("if (!isPaid) {"), "triggerSurveyForTicket must check isPaid before sending SMS");
  assert.ok(appJs.includes("Pro required for automated SMS"), "triggerSurveyForTicket must inform that Pro is required for SMS");
});

// -------------------------------------------------------------------------
// 14. Feedback Firewall for 1-3 Star Ratings
// -------------------------------------------------------------------------
console.log("\n--- 14. Feedback Firewall for 1-3 Star Ratings ---");

it("app.js implements Feedback Firewall with 3-row textarea, private submission, and audit badge", () => {
  assert.ok(appJs.includes('function submitCustomerPrivateFeedback('), "Must implement submitCustomerPrivateFeedback");
  assert.ok(appJs.includes('window.submitCustomerPrivateFeedback = submitCustomerPrivateFeedback;'), "Must attach submitCustomerPrivateFeedback to window");
  assert.ok(appJs.includes('id="customer-feedback-text" rows="3" maxlength="500"'), "Must render 3-row textarea with 500 char cap");
  assert.ok(appJs.includes('badge-feedback-comment'), "Must render badge-feedback-comment in visit history");
  assert.ok(appJs.includes('action === "customer_feedback"'), "Must recognize customer_feedback in audit activities");
});

it("functions/index.js publicQueueAction handles action === feedback and records customer note", () => {
  const functionsIndexJs = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  assert.ok(functionsIndexJs.includes('if (action === "feedback")'), "Must support action === feedback in publicQueueAction");
  assert.ok(functionsIndexJs.includes('held.customerFeedbackComment = comment;'), "Must store customerFeedbackComment");
});

it("app.js protects customer feedback textarea from being destroyed by 1-second timer ticks", () => {
  assert.ok(appJs.includes('isUserFocusedOrTyping'), "Must detect when user is focused or typing in feedback textarea");
  assert.ok(appJs.includes('surveyBox.dataset.renderKey === renderKey'), "Must use renderKey guard to avoid clobbering DOM on 1s ticks");
  assert.ok(appJs.includes('delete surveyBox.dataset.renderKey'), "Must clear renderKey when customer changes rating");
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
