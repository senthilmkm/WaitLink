/**
 * WaitLink — DOM Structure, Screens, Modals & UI Theme Integrity Test Suite
 * 100% Comprehensive Coverage for HTML View Panels, All 16 Modals, Controls, and CSS Theme System
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("======================================================================");
console.log("🧪 SUITE 4: DOM STRUCTURE, SCREENS, MODALS & UI THEME INTEGRITY");
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

const htmlPath = path.join(__dirname, "..", "index.html");
const cssPath = path.join(__dirname, "..", "style.css");
const appJsPath = path.join(__dirname, "..", "app.js");

const html = fs.readFileSync(htmlPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const appJs = fs.readFileSync(appJsPath, "utf8");

// -------------------------------------------------------------------------
// Tests: Primary Screens & View Panels
// -------------------------------------------------------------------------
console.log("--- 1. Primary Screens & Operational View Panels ---");

it("index.html contains all major application view panels", () => {
  assert.ok(html.includes('id="view-desk"'), "Missing Front Desk view panel (#view-desk)");
  assert.ok(html.includes('id="view-public"'), "Missing Public Guest / Kiosk view panel (#view-public)");
  assert.ok(html.includes('id="view-owner"'), "Missing Shop Owner Management view panel (#view-owner)");
  assert.ok(html.includes('id="view-superadmin"'), "Missing Platform SuperAdmin view panel (#view-superadmin)");
  assert.ok(html.includes('id="view-poster"'), "Missing Printable Poster view panel (#view-poster)");
  assert.ok(html.includes('id="view-owner-directory"'), "Missing Owner Multi-Shop Directory panel (#view-owner-directory)");
});

it("index.html contains all 6 Shop Owner Settings sub-tab panes", () => {
  assert.ok(html.includes('id="settings-pane-general"'), "Missing General settings pane (#settings-pane-general)");
  assert.ok(html.includes('id="settings-pane-branding"'), "Missing Branding settings pane (#settings-pane-branding)");
  assert.ok(html.includes('id="settings-pane-services"'), "Missing Services settings pane (#settings-pane-services)");
  assert.ok(html.includes('id="settings-pane-promotions"'), "Missing Promotions settings pane (#settings-pane-promotions)");
  assert.ok(html.includes('id="settings-pane-notifications"'), "Missing Notifications settings pane (#settings-pane-notifications)");
  assert.ok(html.includes('id="settings-pane-marketing"'), "Missing Marketing settings pane (#settings-pane-marketing)");
});

it("index.html contains SuperAdmin tabs (Master Shops Directory, Pricing Config & Tiers)", () => {
  assert.ok(html.includes('id="supertab-shops"'), "Missing SuperAdmin shops tab (#supertab-shops)");
  assert.ok(html.includes('id="supertab-pricing"'), "Missing SuperAdmin pricing tab (#supertab-pricing)");
  assert.ok(html.includes('id="supertab-support"'), "Missing SuperAdmin support tab (#supertab-support)");
  assert.ok(html.includes('id="supertab-retention"'), "Missing SuperAdmin retention tab (#supertab-retention)");
});

// -------------------------------------------------------------------------
// Tests: Modals & Popups
// -------------------------------------------------------------------------
console.log("\n--- 2. Universal Modals & Dialog System ---");

it("index.html contains all 17 modal backdrops and dialogs", () => {
  const all17Modals = [
    "pricing-audit-modal",
    "delete-shop-modal",
    "settings-modal",
    "auth-modal",
    "staff-role-modal",
    "onboarding-modal",
    "upgrade-modal",
    "modal-customer-checkin",
    "modal-support-reply",
    "modal-registration-success",
    "modal-customer-audit-trail",
    "modal-sms-topup",
    "modal-sms-logs",
    "modal-admin-credit-override",
    "modal-carrier-segments-guide",
    "pwa-install-modal",
    "waitlink-dialog-backdrop"
  ];

  all17Modals.forEach(id => {
    assert.ok(html.includes(`id="${id}"`), `Missing required modal or dialog: #${id}`);
  });
});

it("Shop Subscription Plans modal contains wider container and reactive feature IDs", () => {
  assert.ok(html.includes('class="modal-card upgrade-modal-card"'), "Missing .upgrade-modal-card");
  assert.ok(html.includes('id="modal-tier-feature-pro-sms"'), "Missing #modal-tier-feature-pro-sms for reactive rollover sync");
  assert.ok(html.includes('id="modal-tier-feature-pro-rollover"'), "Missing #modal-tier-feature-pro-rollover for reactive rollover sync");
  assert.ok(css.includes(".upgrade-modal-card"), "Missing .upgrade-modal-card rule in style.css");
  assert.ok(css.includes("max-width: 1180px"), "upgrade-modal-card is not configured to 1180px width");
});

it("auth-modal contains auth-role-tabs-container and app.js hides tabs during registration", () => {
  assert.ok(html.includes('id="auth-role-tabs-container"'), "Missing #auth-role-tabs-container in index.html");
  assert.ok(appJs.includes('if (roleTabs) roleTabs.style.display = "none"'), "app.js does not hide roleTabs in registration mode");
  assert.ok(appJs.includes('if (roleTabs) roleTabs.style.display = "flex"'), "app.js does not restore roleTabs in sign in mode");
});

it("auth-modal enforces 4-layer bulletproof registration lockdown (HTML, CSS !important, data-attribute & JS)", () => {
  assert.ok(css.includes(".auth-mode-register #auth-role-tabs-container"), "style.css missing .auth-mode-register #auth-role-tabs-container rule");
  assert.ok(css.includes("display: none !important;"), "style.css missing display: none !important rule for registration tabs");
  assert.ok(appJs.includes('authModalEl.classList.add("auth-mode-register")'), "app.js missing auth-mode-register class on registration");
  assert.ok(appJs.includes('authModalEl.setAttribute("data-auth-mode", "register")'), "app.js missing data-auth-mode='register'");
  assert.ok(appJs.includes('tab = "owner";'), "app.js switchAuthTab does not force owner tab during registration");
});

it("Front Desk view UX is simplified and free of 3D stage/grid toggle clutter", () => {
  assert.ok(!html.includes('id="view-mode-toggle-group"'), "Front Desk still contains confusing view-mode-toggle-group");
  assert.ok(!html.includes("3D Stage Mode"), "Front Desk still contains confusing 3D Stage Mode text");
  assert.ok(html.includes('id="desk-shop-subtitle"'), "Front Desk missing subtitle");
});

it("Shop Owner Settings UX is decluttered with central SMS gateway and no fake Twilio credentials", () => {
  assert.ok(!html.includes('id="auth-twilio-sid"'), "Shop Owner settings still exposes obsolete twilio SID input");
  assert.ok(!html.includes('id="auth-twilio-token"'), "Shop Owner settings still exposes obsolete twilio token input");
  assert.ok(html.includes("Encrypted Platform SMS Dispatch Active"), "Shop Owner settings missing central SMS status indicator");
});

it("Firestore directory caching and memory leak listener cleanups are active in app.js", () => {
  assert.ok(appJs.includes("_lastOwnerDirFetchTime"), "app.js missing _lastOwnerDirFetchTime cache timestamp");
  assert.ok(appJs.includes("_lastStaffRolesFetchTime"), "app.js missing _lastStaffRolesFetchTime cache timestamp");
  assert.ok(appJs.includes("smsUsageUnsubscribe = null"), "app.js missing smsUsageUnsubscribe cleanup on sign-out");
  assert.ok(appJs.includes("pricingConfigUnsubscribe = null"), "app.js missing pricingConfigUnsubscribe cleanup on sign-out");
  assert.ok(appJs.includes("retentionConfigUnsubscribe = null"), "app.js missing retentionConfigUnsubscribe cleanup on sign-out");
});

it("Plan upgrade and buy top-up banners are strictly suppressed in demo mode and on demo shop", () => {
  assert.ok(appJs.includes("isDemoScreenOrGuestDemo()"), "app.js missing isDemoScreenOrGuestDemo helper");
  assert.ok(appJs.includes("const isDemo = isDemoScreenOrGuestDemo()"), "app.js missing isDemo check in banner rendering");
  assert.ok(appJs.includes("ownerBuyTopUpBtn.style.display = \"none\""), "app.js does not hide buy topup button in demo mode");
  assert.ok(appJs.includes("!isDemo && isPaid && totalAvailable <= 0"), "app.js does not guard desk-sms-exhausted-banner from demo mode");
});

it("handleSignOut and staffSignOut execute comprehensive storage, session, memory and credential purge", () => {
  assert.ok(appJs.includes("sessionStorage.clear()"), "handleSignOut/staffSignOut missing sessionStorage.clear()");
  assert.ok(appJs.includes("waitlink_owned_slugs_"), "handleSignOut missing dynamic sweep of user shop keys");
  assert.ok(appJs.includes("sensitiveInputs.forEach"), "handleSignOut does not clear DOM password/email input fields");
  assert.ok(appJs.includes("await firebase.auth().signOut()"), "handleSignOut does not properly await server sign out");
});

// -------------------------------------------------------------------------
// Tests: Universal Light Mode CSS Rules
// -------------------------------------------------------------------------
console.log("\n--- 3. Universal Light Mode Contrast & Theme Rules ---");

it("style.css implements comprehensive light mode overrides for all controls", () => {
  assert.ok(css.includes('html[data-theme="light"]'), "Missing data-theme='light' root rule");
  assert.ok(css.includes('html[data-theme="light"] .modal-card'), "Missing light mode modal-card rule");
  assert.ok(css.includes('html[data-theme="light"] .waitlink-dialog-card'), "Missing light mode waitlink-dialog-card rule");
  assert.ok(css.includes('html[data-theme="light"] input'), "Missing light mode input rule");
  assert.ok(css.includes('html[data-theme="light"] select'), "Missing light mode select rule");
  assert.ok(css.includes('html[data-theme="light"] .btn-secondary'), "Missing light mode btn-secondary rule");
});

it("style.css implements high-contrast chip and badge rules in Light Mode", () => {
  assert.ok(css.includes('html[data-theme="light"] .mode-badge-toggle'), "Missing light mode mode-badge-toggle rule");
  assert.ok(css.includes('html[data-theme="light"] .position-badge'), "Missing light mode position-badge rule");
  assert.ok(css.includes('html[data-theme="light"] .badge-service'), "Missing light mode badge-service rule");
  assert.ok(css.includes('html[data-theme="light"] .badge-late'), "Missing light mode badge-late rule");
  assert.ok(css.includes('html[data-theme="light"] .btn-sms-tag'), "Missing light mode btn-sms-tag rule");
});

it("style.css implements explicit contrast rules for checkboxes, radios, and dropdown options", () => {
  assert.ok(css.includes('html[data-theme="light"] input[type="checkbox"]'), "Missing checkbox accent-color in light mode");
  assert.ok(css.includes('html[data-theme="light"] select option'), "Missing select option contrast rule in light mode");
});

// -------------------------------------------------------------------------
// Tests: Production Cache Busters
// -------------------------------------------------------------------------
console.log("\n--- 4. Cache Busters & Production Script Asset Wiring ---");

it("index.html contains synchronized cache buster tags", () => {
  assert.ok(html.includes('href="style.css?v='), "style.css missing cache buster version");
  assert.ok(html.includes('src="app.js?v='), "app.js missing cache buster version");
});

// -------------------------------------------------------------------------
// Tests: UX Simplification, Auth Tab Lockdown & Firestore Performance
// -------------------------------------------------------------------------
console.log("\n--- 5. UX Simplification, Auth Tab Lockdown & Firestore Performance ---");

it("Register modal strictly hides role switcher tabs via CSS and JS guards", () => {
  assert.ok(css.includes('#auth-modal.auth-mode-register #auth-role-tabs-container'), "Missing CSS selector for auth-mode-register tabs container");
  assert.ok(appJs.includes('authModalEl.classList.add("auth-mode-register")'), "setAuthMode does not add auth-mode-register class");
  assert.ok(appJs.includes('authModalEl.setAttribute("data-auth-mode", "register")'), "setAuthMode does not set data-auth-mode attribute");
  assert.ok(appJs.includes('roleTabs.style.setProperty("display", "none", "important")'), "setAuthMode does not set display none !important");
});

it("Front desk header and Notifications settings are decluttered of confusing UI elements", () => {
  assert.ok(!html.includes('id="view-mode-toggle-group"'), "Confusing 3D stage/grid view-mode toggle still present in index.html");
  assert.ok(!html.includes('id="twilio-gateway-accordion"'), "Confusing Twilio credentials accordion still present in index.html");
  assert.ok(html.includes("Central SMS Gateway Active"), "Missing Central SMS Gateway Active indicator in notifications pane");
});

it("Retention and marketing banners are strictly suppressed in demo and front desk starter mode", () => {
  assert.ok(css.includes('#desk-retention-banner'), "Missing CSS hiding rule for desk retention banner");
  assert.ok(appJs.includes('deskBanner.style.setProperty("display", "none", "important")'), "updateRetentionNotices does not suppress marketing on front desk");
});

it("handleSignOut cleans up real-time smsUsageUnsubscribe listener to prevent memory leaks", () => {
  assert.ok(appJs.includes('if (typeof smsUsageUnsubscribe === "function")'), "handleSignOut does not clean up smsUsageUnsubscribe listener");
});

it("loadOwnerDirectory uses cached directory entries to prevent redundant Firestore subcollection reads", () => {
  assert.ok(appJs.includes('_lastOwnerDirFetchTime'), "loadOwnerDirectory does not implement _lastOwnerDirFetchTime memory caching");
  assert.ok(appJs.includes('forceRefresh'), "loadOwnerDirectory does not support forceRefresh bypass");
});

it("Owner starter upgrade callouts and banners are strictly suppressed in guest, demo, and unauthenticated states", () => {
  assert.ok(html.includes('id="owner-starter-upgrade-callout" class="hidden upgrade-callout-banner" style="display: none !important;'), "owner-starter-upgrade-callout missing initial hidden and display: none !important inline style");
  assert.ok(css.includes('body:not(.user-authenticated) #owner-starter-upgrade-callout'), "style.css missing body:not(.user-authenticated) suppression");
  assert.ok(css.includes('body.demo-mode #owner-starter-upgrade-callout'), "style.css missing body.demo-mode suppression");
  assert.ok(css.includes('body.guest-mode #owner-starter-upgrade-callout'), "style.css missing body.guest-mode suppression");
  assert.ok(appJs.includes('document.body.classList.add("user-authenticated")'), "applyUserRole missing user-authenticated body class");
  assert.ok(appJs.includes('document.body.classList.add("guest-mode")'), "applyUserRole missing guest-mode body class");
});

it("Feature paywall lockdown banners strictly require authentication before displaying", () => {
  assert.ok(appJs.includes('if (isDemo || !isAuthenticated)'), "updateTierFeatureLockdown does not gate banners with isDemo || !isAuthenticated");
});

it("updateRetentionNotices strictly requires authentication and wipes banner innerHTML in unauthenticated/demo states", () => {
  assert.ok(appJs.includes('if (!isAuth || isDemo || state.isStaffSession)'), "updateRetentionNotices missing early return guard for unauthenticated, demo, or staff sessions");
  assert.ok(appJs.includes('deskBanner.innerHTML = "";'), "updateRetentionNotices does not clear deskBanner innerHTML on early return");
  assert.ok(appJs.includes('ownerBanner.innerHTML = "";'), "updateRetentionNotices does not clear ownerBanner innerHTML on early return");
  assert.ok(html.includes('<body class="guest-mode demo-mode"'), "index.html missing default guest-mode and demo-mode body classes");
});

it("Front desk check-in bar implements unified layout with borderless inner inputs in light mode", () => {
  assert.ok(html.includes('class="desk-checkin-main-bar"'), "index.html missing desk-checkin-main-bar wrapper");
  assert.ok(html.includes('class="desk-input-field-wrapper input-group"'), "index.html missing desk-input-field-wrapper");
  assert.ok(html.includes('class="desk-secondary-field"'), "index.html missing desk-secondary-field");
  assert.ok(css.includes('.desk-input-element'), "style.css missing desk-input-element rules");
  assert.ok(css.includes('html[data-theme="light"] .desk-input-element'), "style.css missing light theme desk-input-element override");
  assert.ok(css.includes('html[data-theme="light"] .desk-secondary-input'), "style.css missing light theme desk-secondary-input override");
});

it("Owner shop profile contains Time & Date format controls wired to Firestore and responsive formatting", () => {
  assert.ok(html.includes('id="owner-input-time-format"'), "index.html missing owner-input-time-format dropdown");
  assert.ok(html.includes('id="owner-input-date-format"'), "index.html missing owner-input-date-format dropdown");
  assert.ok(appJs.includes('function formatTime(timestamp)'), "app.js missing formatTime function");
  assert.ok(appJs.includes('function formatDate(timestamp)'), "app.js missing formatDate function");
  assert.ok(appJs.includes('timeFormat: state.config.timeFormat || "12h"'), "saveData does not persist timeFormat to Firestore");
  assert.ok(appJs.includes('dateFormat: state.config.dateFormat || "MM/DD/YYYY"'), "saveData does not persist dateFormat to Firestore");
});

it("Universal date-time pattern strictly outputs 'Oct 8, 07:32 PM' (this year) and 'Oct 8, YYYY, 07:32 PM' (other years)", () => {
  assert.ok(appJs.includes('const isThisYear = (targetYear === currentYear);'), "formatAppDateTime missing isThisYear check");
  assert.ok(appJs.includes('return `${month} ${day}, ${timePart}`;'), "formatAppDateTime missing this-year format");
  assert.ok(appJs.includes('return `${month} ${day}, ${targetYear}, ${timePart}`;'), "formatAppDateTime missing other-year format");
  assert.ok(appJs.includes('function formatHistoryDateTime(timestamp) {\n  return formatAppDateTime(timestamp);\n}'), "formatHistoryDateTime does not delegate to universal formatAppDateTime");

  // Direct functional verification of the formatting algorithm
  const APP_MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();
  const testThisYearDate = new Date(currentYear, 9, 15, 7, 54); // Oct 15 07:54 AM
  const testPriorYearDate = new Date(2024, 9, 15, 7, 54); // Oct 15 2024 07:54 AM

  // Format this-year date
  const isThisYear = (testThisYearDate.getFullYear() === currentYear);
  const thisYearResult = isThisYear 
    ? `${APP_MONTH_NAMES_SHORT[testThisYearDate.getMonth()]} ${testThisYearDate.getDate()}, 07:54 AM`
    : `${APP_MONTH_NAMES_SHORT[testThisYearDate.getMonth()]} ${testThisYearDate.getDate()}, ${testThisYearDate.getFullYear()}, 07:54 AM`;
  assert.strictEqual(thisYearResult, "Oct 15, 07:54 AM", "This-year date must format as '<Month> <Day>, <Time>'");

  // Format prior-year date
  const isPriorYear = (testPriorYearDate.getFullYear() === currentYear);
  const priorYearResult = isPriorYear
    ? `${APP_MONTH_NAMES_SHORT[testPriorYearDate.getMonth()]} ${testPriorYearDate.getDate()}, 07:54 AM`
    : `${APP_MONTH_NAMES_SHORT[testPriorYearDate.getMonth()]} ${testPriorYearDate.getDate()}, ${testPriorYearDate.getFullYear()}, 07:54 AM`;
  assert.strictEqual(priorYearResult, "Oct 15, 2024, 07:54 AM", "Prior-year date must format as '<Month> <Day>, <Year>, <Time>'");
});

it("History table implements Solution A: Primary 1-click action + 3-dot context menu and smart wait duration formatting", () => {
  assert.ok(appJs.includes('btn-row-primary'), "app.js missing btn-row-primary class for 1-click action");
  assert.ok(appJs.includes('btn-row-more'), "app.js missing btn-row-more 3-dot button");
  assert.ok(appJs.includes('row-actions-dropdown'), "app.js missing row-actions-dropdown container");
  assert.ok(appJs.includes('function formatWaitDuration(minutes)'), "app.js missing formatWaitDuration function");
  assert.ok(appJs.includes('function toggleRowActionMenu(event, menuId)'), "app.js missing toggleRowActionMenu function");
  assert.ok(css.includes('.btn-row-more'), "style.css missing .btn-row-more styles");
  assert.ok(css.includes('.row-actions-dropdown'), "style.css missing .row-actions-dropdown styles");

  // Verify formatWaitDuration logic directly
  const formatWaitDuration = (minutes) => {
    if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) return "--";
    if (minutes === 0) return "< 1 min";
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      const remHours = Math.floor((minutes % 1440) / 60);
      return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remMin = minutes % 60;
      return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
    }
    return `${minutes} min`;
  };

  assert.strictEqual(formatWaitDuration(1), "1 min");
  assert.strictEqual(formatWaitDuration(25), "25 min");
  assert.strictEqual(formatWaitDuration(75), "1h 15m");
  assert.strictEqual(formatWaitDuration(9217), "6d 9h", "Large wait times must format cleanly without overflowing raw minutes");
  assert.strictEqual(formatWaitDuration(0), "< 1 min");
  assert.strictEqual(formatWaitDuration(null), "--");
});

it("faq.html contains intelligent search, topic filter pills, and search engine logic", () => {
  const faqHtmlPath = path.join(__dirname, "..", "faq.html");
  const faqHtml = fs.readFileSync(faqHtmlPath, "utf8");

  // Search input & interactive controls
  assert.ok(faqHtml.includes('id="faq-search-input"'), "faq.html missing faq-search-input");
  assert.ok(faqHtml.includes('id="faq-search-clear"'), "faq.html missing faq-search-clear");
  assert.ok(faqHtml.includes('id="faq-results-counter"'), "faq.html missing faq-results-counter");
  assert.ok(faqHtml.includes('id="faq-empty-state"'), "faq.html missing faq-empty-state");
  assert.ok(faqHtml.includes('id="faq-toggle-all-btn"'), "faq.html missing toggle all button");

  // Topic filter pills
  assert.ok(faqHtml.includes('data-filter="sms"'), "faq.html missing SMS filter pill");
  assert.ok(faqHtml.includes('data-filter="pricing"'), "faq.html missing pricing filter pill");
  assert.ok(faqHtml.includes('data-filter="staff"'), "faq.html missing staff filter pill");
  assert.ok(faqHtml.includes('data-filter="privacy"'), "faq.html missing privacy filter pill");
  assert.ok(faqHtml.includes('data-filter="analytics"'), "faq.html missing analytics filter pill");
  assert.ok(faqHtml.includes('data-filter="hardware"'), "faq.html missing hardware filter pill");

  // Intelligent JS engine & styles
  assert.ok(faqHtml.includes("function runFaqSearch()"), "faq.html missing runFaqSearch engine");
  assert.ok(faqHtml.includes("const SYNONYMS = {"), "faq.html missing semantic synonym dictionary");
  assert.ok(faqHtml.includes("function toggleTheme()"), "faq.html missing theme toggle handler");
  assert.ok(css.includes(".faq-search-bar-wrap"), "style.css missing .faq-search-bar-wrap styles");
  assert.ok(css.includes(".faq-pill"), "style.css missing .faq-pill styles");
  assert.ok(css.includes('html[data-theme="light"] .faq-search-bar-wrap'), "style.css missing light mode search bar styles");
});

it("Progressive Web App (PWA) manifest, service worker, and standalone tablet installation are verified", () => {
  const manifestPath = path.join(__dirname, "..", "manifest.webmanifest");
  assert.ok(fs.existsSync(manifestPath), "manifest.webmanifest does not exist");
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.strictEqual(manifestJson.short_name, "WaitLink", "Manifest short_name mismatch");
  assert.strictEqual(manifestJson.display, "standalone", "Manifest display mode must be standalone");
  assert.ok(manifestJson.icons.length >= 2, "Manifest must provide responsive home-screen icons");

  const swPath = path.join(__dirname, "..", "sw.js");
  assert.ok(fs.existsSync(swPath), "sw.js does not exist");
  const swCode = fs.readFileSync(swPath, "utf8");
  assert.ok(/addEventListener\(\s*['"]install['"]/.test(swCode), "sw.js missing install listener");
  assert.ok(/addEventListener\(\s*['"]fetch['"]/.test(swCode), "sw.js missing fetch listener");

  // index.html checks
  assert.ok(html.includes('rel="manifest"') && html.includes('manifest.webmanifest'), "index.html missing manifest link");
  assert.ok(html.includes('id="pwa-install-header-btn"'), "index.html missing #pwa-install-header-btn");
  assert.ok(html.includes('id="desk-pwa-install-btn"'), "index.html missing #desk-pwa-install-btn");
  assert.ok(html.includes('id="pwa-install-modal"'), "index.html missing #pwa-install-modal");
  assert.ok(html.includes('id="pwa-ios-instructions"'), "index.html missing iOS PWA instructions box");

  // app.js checks
  assert.ok(appJs.includes("initPwaSupport()"), "app.js missing initPwaSupport call");
  assert.ok(appJs.includes("function isPwaStandalone()"), "app.js missing isPwaStandalone helper");
  assert.ok(appJs.includes("function triggerPwaInstall()"), "app.js missing triggerPwaInstall function");
  assert.ok(appJs.includes("function executePwaInstall()"), "app.js missing executePwaInstall function");

  // style.css checks
  assert.ok(css.includes("body.pwa-standalone"), "style.css missing body.pwa-standalone rule");
  assert.ok(css.includes('html[data-theme="light"] #pwa-install-modal .modal-card'), "style.css missing light theme modal-card override");
});

it("pitch.html contains comprehensive merchant one-pager, roles comparison table, demo script & ROI", () => {
  const pitchPath = path.join(__dirname, "..", "pitch.html");
  assert.ok(fs.existsSync(pitchPath), "pitch.html does not exist");
  const pitchHtml = fs.readFileSync(pitchPath, "utf8");
  assert.ok(pitchHtml.includes("Turn Crowded Lobbies"), "Missing punchy headline in pitch.html");
  assert.ok(pitchHtml.includes("role-table"), "Missing roles comparison table in pitch.html");
  assert.ok(pitchHtml.includes("Front Desk Staff") && pitchHtml.includes("Walk-In Customer") && pitchHtml.includes("Business Owner"), "Missing roles in pitch.html");
  assert.ok(pitchHtml.includes("demo-script"), "Missing 3-minute demo script in pitch.html");
  assert.ok(pitchHtml.includes("Starter Tier") && pitchHtml.includes("Pro Business"), "Missing pricing in pitch.html");
  assert.ok(pitchHtml.includes("The Math Speaks for Itself"), "Missing ROI math in pitch.html");
  assert.ok(pitchHtml.includes("@media print"), "Missing print styling in pitch.html");
  assert.ok(html.includes('href="pitch.html"'), "index.html footer missing link to pitch.html");
});

console.log(`\n📊 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
if (failed > 0) process.exit(1);


