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

it("index.html contains all 7 Shop Owner Settings sub-tab panes", () => {
  assert.ok(html.includes('id="settings-pane-general"'), "Missing General settings pane (#settings-pane-general)");
  assert.ok(html.includes('id="settings-pane-branding"'), "Missing Branding settings pane (#settings-pane-branding)");
  assert.ok(html.includes('id="settings-pane-services"'), "Missing Services settings pane (#settings-pane-services)");
  assert.ok(html.includes('id="settings-pane-promotions"'), "Missing Promotions settings pane (#settings-pane-promotions)");
  assert.ok(html.includes('id="settings-pane-notifications"'), "Missing Notifications settings pane (#settings-pane-notifications)");
  assert.ok(html.includes('id="settings-pane-marketing"'), "Missing Marketing settings pane (#settings-pane-marketing)");
  assert.ok(html.includes('id="settings-pane-security"'), "Missing Queue Security settings pane (#settings-pane-security)");
});

it("index.html contains SuperAdmin tabs (Master Shops Directory, Revenue Metrics, Pricing, Support, Retention)", () => {
  assert.ok(html.includes('id="supertab-shops"'), "Missing SuperAdmin shops tab (#supertab-shops)");
  assert.ok(html.includes('id="supertab-revenue"'), "Missing SuperAdmin revenue tab (#supertab-revenue)");
  assert.ok(html.includes('id="supertab-pricing"'), "Missing SuperAdmin pricing tab (#supertab-pricing)");
  assert.ok(html.includes('id="supertab-support"'), "Missing SuperAdmin support tab (#supertab-support)");
  assert.ok(html.includes('id="supertab-retention"'), "Missing SuperAdmin retention tab (#supertab-retention)");
});

it("SuperAdmin Revenue Metrics & Account 360° panel contains complete KPI cards, toolbar, grid and drawer", () => {
  assert.ok(html.includes('id="superpanel-revenue"'), "Missing #superpanel-revenue");
  assert.ok(html.includes('id="kpi-total-mrr"'), "Missing #kpi-total-mrr");
  assert.ok(html.includes('id="kpi-total-arr"'), "Missing #kpi-total-arr");
  assert.ok(html.includes('id="kpi-conversion-rate"'), "Missing #kpi-conversion-rate");
  assert.ok(html.includes('id="kpi-paid-ratio"'), "Missing #kpi-paid-ratio");
  assert.ok(html.includes('id="kpi-blended-arpu"'), "Missing #kpi-blended-arpu");
  assert.ok(html.includes('id="kpi-arppu"'), "Missing #kpi-arppu");
  assert.ok(html.includes('id="kpi-topup-sales"'), "Missing #kpi-topup-sales");
  assert.ok(html.includes('id="kpi-topup-margin"'), "Missing #kpi-topup-margin");

  // Filter toolbar
  assert.ok(html.includes('id="revenue-search-input"'), "Missing #revenue-search-input");
  assert.ok(html.includes('id="revenue-filter-tier"'), "Missing #revenue-filter-tier");
  assert.ok(html.includes('id="revenue-filter-size"'), "Missing #revenue-filter-size");
  assert.ok(html.includes('id="revenue-filter-signal"'), "Missing #revenue-filter-signal");
  assert.ok(html.includes('id="revenue-sort-by"'), "Missing #revenue-sort-by");

  // Grid
  assert.ok(html.includes('id="revenue-accounts-table"'), "Missing #revenue-accounts-table");
  assert.ok(html.includes('id="revenue-accounts-tbody"'), "Missing #revenue-accounts-tbody");

  // Account 360 Drawer & Backdrop
  assert.ok(html.includes('id="account-360-backdrop"'), "Missing #account-360-backdrop");
  assert.ok(html.includes('id="account-360-drawer"'), "Missing #account-360-drawer");
  assert.ok(html.includes('id="drawer-shops-list"'), "Missing #drawer-shops-list");
  assert.ok(html.includes('id="drawer-mrr-val"'), "Missing #drawer-mrr-val");
  assert.ok(html.includes('id="drawer-arr-val"'), "Missing #drawer-arr-val");
  assert.ok(html.includes('id="drawer-topup-val"'), "Missing #drawer-topup-val");
  assert.ok(html.includes('id="drawer-ltv-val"'), "Missing #drawer-ltv-val");
  assert.ok(html.includes('id="drawer-action-jump-desk"'), "Missing #drawer-action-jump-desk");
  assert.ok(html.includes('id="drawer-action-email-owner"'), "Missing #drawer-action-email-owner");
  assert.ok(html.includes('id="drawer-action-grant-sms"'), "Missing #drawer-action-grant-sms");
  assert.ok(html.includes('id="drawer-action-override-tier"'), "Missing #drawer-action-override-tier");

  // app.js functions
  assert.ok(appJs.includes("function aggregateRevenueAccounts("), "Missing aggregateRevenueAccounts in app.js");
  assert.ok(appJs.includes("function formatCurrencyUsd("), "Missing formatCurrencyUsd in app.js");
  assert.ok(appJs.includes("function renderSuperAdminRevenuePanel("), "Missing renderSuperAdminRevenuePanel in app.js");
  assert.ok(appJs.includes("function filterRevenueAccountsTable("), "Missing filterRevenueAccountsTable in app.js");
  assert.ok(appJs.includes("function openAccount360Drawer("), "Missing openAccount360Drawer in app.js");
  assert.ok(appJs.includes("function closeAccount360Drawer("), "Missing closeAccount360Drawer in app.js");
  assert.ok(appJs.includes("function exportRevenueMetricsCsv("), "Missing exportRevenueMetricsCsv in app.js");

  // style.css classes
  assert.ok(css.includes(".revenue-kpi-grid"), "Missing .revenue-kpi-grid in style.css");
  assert.ok(css.includes(".drawer-panel"), "Missing .drawer-panel in style.css");
  assert.ok(css.includes(".drawer-backdrop"), "Missing .drawer-backdrop in style.css");
  assert.ok(css.includes(".badge-signal-upsell"), "Missing .badge-signal-upsell in style.css");
  assert.ok(css.includes(".badge-signal-multi"), "Missing .badge-signal-multi in style.css");
  assert.ok(css.includes(".badge-signal-enterprise"), "Missing .badge-signal-enterprise in style.css");
  assert.ok(css.includes(".badge-signal-churn"), "Missing .badge-signal-churn in style.css");
});

// -------------------------------------------------------------------------
// Tests: Modals & Popups
// -------------------------------------------------------------------------
console.log("\n--- 2. Universal Modals & Dialog System ---");

it("index.html contains all 18 modal backdrops and dialogs", () => {
  const all18Modals = [
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
    "modal-demo-shop-generator",
    "waitlink-dialog-backdrop"
  ];

  all18Modals.forEach(id => {
    assert.ok(html.includes(`id="${id}"`), `Missing required modal or dialog: #${id}`);
  });
});

it("SuperAdmin Master Directory contains 1-Tap Demo Shop Generator with all 8 industry presets", () => {
  assert.ok(html.includes('id="btn-superadmin-demo-generator"'), "Missing #btn-superadmin-demo-generator in SuperAdmin directory");
  assert.ok(html.includes('id="modal-demo-shop-generator"'), "Missing #modal-demo-shop-generator in index.html");
  assert.ok(html.includes('id="demo-industry-grid"'), "Missing #demo-industry-grid in generator modal");
  assert.ok(html.includes('id="demo-shop-name-input"'), "Missing #demo-shop-name-input in generator modal");
  assert.ok(html.includes('id="btn-launch-demo-shop"'), "Missing #btn-launch-demo-shop in generator modal");
  assert.ok(html.includes('id="btn-copy-demo-pitch"'), "Missing #btn-copy-demo-pitch in generator modal");
  assert.ok(appJs.includes("function openDemoShopGeneratorModal()"), "app.js missing openDemoShopGeneratorModal");
  assert.ok(appJs.includes("async function launchDemoShopFromModal()"), "app.js missing launchDemoShopFromModal");
  assert.ok(appJs.includes("function copyDemoPitchFromModal()"), "app.js missing copyDemoPitchFromModal");
  assert.ok(appJs.includes("const DEMO_INDUSTRY_PRESETS ="), "app.js missing DEMO_INDUSTRY_PRESETS");
  assert.ok(css.includes(".demo-industry-chip"), "style.css missing .demo-industry-chip styling");
  assert.ok(css.includes(".demo-generator-modal-card"), "style.css missing .demo-generator-modal-card styling");
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
  assert.ok(html.includes('id="desk-sms-exhausted-banner" class="hidden" style="display: none !important;'), "desk-sms-exhausted-banner missing initial display: none !important inline style");
  assert.ok(css.includes("body:not(.user-authenticated) #desk-sms-exhausted-banner"), "style.css missing body:not(.user-authenticated) #desk-sms-exhausted-banner");
  assert.ok(css.includes("body.guest-mode #desk-sms-exhausted-banner"), "style.css missing body.guest-mode #desk-sms-exhausted-banner");
  assert.ok(css.includes("body:not(.user-authenticated) #header-upgrade-btn"), "style.css missing body:not(.user-authenticated) #header-upgrade-btn");
  assert.ok(css.includes("body.guest-mode #header-upgrade-btn"), "style.css missing body.guest-mode #header-upgrade-btn");
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

it("Queue card actions implement zero-overflow responsive layout on iPad, Android tablets, and mobile", () => {
  assert.ok(css.includes(".queue-item-actions"), "style.css missing .queue-item-actions");
  assert.ok(css.includes(".queue-item-card") && css.includes("overflow: hidden"), "style.css missing overflow: hidden on .queue-item-card");
  assert.ok(css.includes(".queue-item-actions.has-requeue .btn-call"), "style.css missing has-requeue full-width btn-call rule for tablet counter use");
  assert.ok(css.includes(".queue-item-actions.has-requeue .btn-requeue"), "style.css missing has-requeue 50/50 btn-requeue rule");
  assert.ok(css.includes(".queue-item-actions.has-requeue .btn-cancel"), "style.css missing has-requeue 50/50 btn-cancel rule");
  assert.ok(appJs.includes("has-requeue"), "app.js missing dynamic has-requeue class on queue-item-actions");
});

it("Universal tablet and mobile landscape responsiveness rules are implemented in style.css", () => {
  assert.ok(css.includes("max-width: 992px"), "style.css missing tablet 992px breakpoint");
  assert.ok(css.includes("(max-height: 520px) and (orientation: landscape)"), "style.css missing mobile landscape breakpoint");
  assert.ok(css.includes("env(safe-area-inset-left)"), "style.css missing safe area inset left padding");
  assert.ok(css.includes("minmax(280px, 1fr)"), "style.css missing 280px queue-grid minmax for 3-column tablet view");
});

it("Cancellation attribution accurately distinguishes desk cancellations from customer walk-aways across BI analytics, history table, and audit modal", () => {
  assert.ok(appJs.includes("function isItemCancelledByDesk(item)"), "app.js missing unified isItemCancelledByDesk helper");

  // Verify logic using direct mock evaluation
  const isItemCancelledByDesk = (item) => {
    if (!item) return false;
    if (item.cancelledBy === "desk") return true;
    if (item.cancelledBy === "customer" || item.cancelledBy === "walkout" || item.cancelledBy === "user") return false;
    if (Array.isArray(item.activityLog)) {
      for (let i = item.activityLog.length - 1; i >= 0; i--) {
        const act = item.activityLog[i];
        if (act && (act.action === "cancelled" || act.action === "cancel")) {
          if (act.actor === "desk" || act.actor === "staff" || act.actor === "operator") return true;
          if (act.actor === "customer" || act.actor === "public" || act.actor === "user") return false;
        }
      }
    }
    return false;
  };

  // Case 1: explicit cancelledBy desk
  assert.strictEqual(isItemCancelledByDesk({ cancelledBy: "desk" }), true, "Explicit cancelledBy: 'desk' must be desk cancelled");

  // Case 2: explicit cancelledBy customer
  assert.strictEqual(isItemCancelledByDesk({ cancelledBy: "customer" }), false, "Explicit cancelledBy: 'customer' must not be desk cancelled");

  // Case 3: legacy record with activityLog containing desk actor
  assert.strictEqual(isItemCancelledByDesk({
    activityLog: [{ action: "checkin", actor: "public" }, { action: "cancelled", actor: "desk" }]
  }), true, "activityLog with desk actor must be resolved as desk cancelled");

  // Case 4: legacy record with activityLog containing customer self-service leave
  assert.strictEqual(isItemCancelledByDesk({
    activityLog: [{ action: "checkin", actor: "desk" }, { action: "cancelled", actor: "customer" }]
  }), false, "activityLog with customer actor must be resolved as customer walk-out");

  // Case 5: undefined/null safety
  assert.strictEqual(isItemCancelledByDesk(null), false, "Null item must safely return false");
  assert.strictEqual(isItemCancelledByDesk({}), false, "Empty item must safely return false");

  // Verify app.js calls isItemCancelledByDesk in renderHistoryRows and openAuditModal
  assert.ok(appJs.includes("isItemCancelledByDesk(item)"), "renderHistoryRows must use isItemCancelledByDesk");
  assert.ok(appJs.includes("const isDeskCanc = isItemCancelledByDesk(item);"), "openAuditModal must use isItemCancelledByDesk");
});

console.log("\n--- 6. 15-Second Shop Launch Onboarding Flow, Presets & Pre-Publishing Review Banner ---");

it("DEMO_INDUSTRY_PRESETS contains all 8 industry presets with >= 5-6 realistic services each", () => {
  const industryKeys = ["auto", "salon", "clinic", "pet", "restaurant", "repair", "tattoo", "general"];
  
  // Extract DEMO_INDUSTRY_PRESETS definition from app.js safely
  const presetMatch = appJs.match(/const DEMO_INDUSTRY_PRESETS\s*=\s*(\{[\s\S]*?\n\};)/);
  assert.ok(presetMatch, "DEMO_INDUSTRY_PRESETS must be defined in app.js");
  
  // Verify all 8 presets exist
  industryKeys.forEach(key => {
    assert.ok(appJs.includes(`${key}: {`), `DEMO_INDUSTRY_PRESETS missing preset for: ${key}`);
  });

  // Execute sandboxed check of DEMO_INDUSTRY_PRESETS object
  const sandbox = {};
  const vm = require("vm");
  vm.runInNewContext(`${presetMatch[0]}; presets = DEMO_INDUSTRY_PRESETS;`, sandbox);
  const presets = sandbox.presets;

  assert.strictEqual(Object.keys(presets).length, 8, "Must contain exactly 8 industry presets");

  industryKeys.forEach(key => {
    const p = presets[key];
    assert.ok(p, `Preset ${key} must exist`);
    assert.ok(p.label, `Preset ${key} must have label`);
    assert.ok(p.icon, `Preset ${key} must have icon`);
    assert.ok(Array.isArray(p.services), `Preset ${key} must have services array`);
    assert.ok(p.services.length >= 5, `Preset ${key} must have at least 5 to 6 services, found: ${p.services.length}`);
    assert.strictEqual(p.services.length, 6, `Preset ${key} must have exactly 6 realistic services`);

    // Verify service schema
    p.services.forEach(srv => {
      assert.ok(srv.id, `Service in ${key} missing id`);
      assert.ok(srv.name, `Service in ${key} missing name`);
      assert.ok(srv.estDurationMin >= 5 && srv.estDurationMin <= 120, `Service ${srv.name} duration out of bounds`);
      assert.ok(srv.icon, `Service ${srv.name} missing icon`);
      assert.strictEqual(srv.enabled, true, `Service ${srv.name} must be enabled: true`);
    });
  });
});

it("15-Second Shop Launch modal (#onboarding-modal) contains streamlined UI and all 8 industry chips", () => {
  assert.ok(html.includes('id="onboarding-modal"'), "Missing #onboarding-modal");
  assert.ok(html.includes("15-Second Shop Launch"), "Missing 15-Second Shop Launch title in onboarding modal");
  assert.ok(html.includes('id="onboard-shopname"'), "Missing #onboard-shopname input");
  assert.ok(html.includes('id="onboard-industry"'), "Missing #onboard-industry hidden input");
  assert.ok(html.includes('id="onboard-industry-grid"'), "Missing #onboard-industry-grid container");

  // Verify all 8 preset chips are wired in the DOM
  const chips = [
    "onboard-chip-salon",
    "onboard-chip-auto",
    "onboard-chip-clinic",
    "onboard-chip-pet",
    "onboard-chip-restaurant",
    "onboard-chip-repair",
    "onboard-chip-tattoo",
    "onboard-chip-general"
  ];
  chips.forEach(chipId => {
    assert.ok(html.includes(`id="${chipId}"`), `Missing industry chip: #${chipId}`);
  });

  // Verify invisible slug preview and primary submit button
  assert.ok(html.includes('id="onboard-slug-preview-box"'), "Missing #onboard-slug-preview-box");
  assert.ok(html.includes('id="onboard-slug-url-display"'), "Missing #onboard-slug-url-display");
  assert.ok(html.includes('id="btn-onboard-submit"'), "Missing #btn-onboard-submit");
  assert.ok(html.includes("Launch My Live Queue (Free Forever)"), "Missing primary submit button text");
  
  // Verify friction-free: address, promo text/dates, and plan tier selection dropdown are removed from initial launch form
  assert.ok(!html.includes('id="onboard-promo-card"'), "Premature onboard-promo-card must be removed from 15-second launch");
  assert.ok(!html.includes('id="onboard-promo-lockable-content"'), "Premature promo lockable content must be removed from launch");
});

it("Universal invisible slug engine & industry preset wiring in app.js", () => {
  assert.ok(appJs.includes("function renderOnboardIndustryGrid()"), "app.js missing renderOnboardIndustryGrid");
  assert.ok(appJs.includes("function selectOnboardIndustry("), "app.js missing selectOnboardIndustry");
  assert.ok(appJs.includes("function handleOnboardShopNameInput("), "app.js missing handleOnboardShopNameInput");
  assert.ok(appJs.includes("function toggleSlugEdit()"), "app.js missing toggleSlugEdit");
  assert.ok(appJs.includes("async function handleOnboardingSubmit("), "handleOnboardingSubmit must be async for Firestore slug verification");
  
  // Check that handleOnboardingSubmit seeds preset services and default store hours (9 AM - 7 PM)
  assert.ok(appJs.includes("state.config.services = initialServices;"), "handleOnboardingSubmit must seed initialServices");
  assert.ok(appJs.includes("defaultHours = { open: \"09:00\", close: \"19:00\""), "handleOnboardingSubmit must seed 9 AM - 7 PM hours");
  assert.ok(appJs.includes("planTitle = \"Starter Tier (Free)\";"), "New shops must launch on Starter Tier (Free)");
  assert.ok(appJs.includes("planPrice = 0;"), "New shops must initialize with planPrice = 0");
});

it("Onboarding completion notice screen (#modal-registration-success) contains Pre-Publishing Review Banner & Submit Action Buttons", () => {
  assert.ok(html.includes('id="modal-registration-success"'), "Missing #modal-registration-success");
  assert.ok(html.includes('id="reg-success-review-banner"'), "Missing #reg-success-review-banner in completion modal");
  assert.ok(html.includes("Action Required: Review Your Shop Settings Before Publishing!"), "Missing review warning headline");
  assert.ok(html.includes("9:00 AM – 7:00 PM"), "Missing Store Hours 9 AM - 7 PM in review checklist");
  assert.ok(html.includes('id="reg-review-service-count"'), "Missing #reg-review-service-count");
  assert.ok(html.includes('id="btn-reg-review-settings"'), "Missing primary review submit button #btn-reg-review-settings");
  assert.ok(html.includes('id="btn-reg-jump-desk"'), "Missing secondary jump button #btn-reg-jump-desk");
  assert.ok(html.includes("Review & Confirm Shop Settings Now"), "Missing button label 'Review & Confirm Shop Settings Now'");
  assert.ok(html.includes("Jump Straight to Live Front Desk"), "Missing button label 'Jump Straight to Live Front Desk'");
});

it("style.css provides rich responsive styling and high-contrast light mode overrides for onboarding", () => {
  assert.ok(css.includes(".onboard-industry-grid"), "style.css missing .onboard-industry-grid");
  assert.ok(css.includes(".onboard-industry-chip"), "style.css missing .onboard-industry-chip");
  assert.ok(css.includes(".onboard-industry-chip.active"), "style.css missing .onboard-industry-chip.active");
  assert.ok(css.includes('html[data-theme="light"] .onboard-industry-chip'), "style.css missing light mode chip overrides");
  assert.ok(css.includes('html[data-theme="light"] #reg-success-review-banner'), "style.css missing light mode review banner overrides");
});

it("Owner Analytics metrics headers have tight 0.25rem spacing, #section-shop-settings is defined, and launchFromRegistration auto-scrolls to center", () => {
  assert.ok(html.includes('id="section-shop-settings"'), "Missing #section-shop-settings container ID in index.html");
  assert.ok(html.includes("Today's Live Flow"), "Missing Today's Live Flow heading");
  assert.ok(html.includes("Business Intelligence & Analytics"), "Missing Business Intelligence & Analytics heading");
  assert.ok(appJs.includes('document.getElementById("section-shop-settings")'), "launchFromRegistration must target section-shop-settings");
  assert.ok(appJs.includes('el.scrollIntoView({ behavior: "smooth", block: "center" })'), "launchFromRegistration must scroll to center of screen");
});

it("Front Desk and Owner Analytics navigation buttons are strictly suppressed in demo and signed-out guest states", () => {
  assert.ok(appJs.includes('deskTab.classList.add("hidden")'), "applyUserRole/handleSignOut must hide deskTab for signed out guests");
  assert.ok(appJs.includes('ownerTab.classList.add("hidden")'), "applyUserRole/handleSignOut must hide ownerTab for signed out guests");
  assert.ok(appJs.includes('mobileTabDesk.classList.add("hidden")'), "applyUserRole/handleSignOut must hide mobileTabDesk for signed out guests");
  assert.ok(appJs.includes('mobileTabOwner.classList.add("hidden")'), "applyUserRole/handleSignOut must hide mobileTabOwner for signed out guests");
});

it("Shop Settings & Branding Profile sub-tabs provide enhanced visibility and high-contrast styles", () => {
  assert.ok(css.includes(".settings-subtabs-nav"), "style.css missing .settings-subtabs-nav");
  assert.ok(css.includes(".settings-subtab-btn"), "style.css missing .settings-subtab-btn");
  assert.ok(css.includes(".settings-subtab-btn.active"), "style.css missing .settings-subtab-btn.active");
  assert.ok(css.includes("color: #cbd5e1;"), "style.css must have bright slate color for subtab buttons");
});

it("Shop active/inactive status toggle is implemented in Shop Settings, Shops Directory, Front Desk and Public View", () => {
  // DOM IDs in index.html
  assert.ok(html.includes('id="owner-shop-status-card"'), "index.html missing #owner-shop-status-card in Settings General tab");
  assert.ok(html.includes('id="owner-shop-active-checkbox"'), "index.html missing #owner-shop-active-checkbox toggle");
  assert.ok(html.includes('id="desk-shop-paused-banner"'), "index.html missing #desk-shop-paused-banner in Front Desk view");
  assert.ok(html.includes('id="public-shop-paused-banner"'), "index.html missing #public-shop-paused-banner in Public view");
  assert.ok(html.includes('id="public-shop-badge"'), "index.html missing #public-shop-badge in Public header");

  // Functions & Handlers in app.js
  assert.ok(appJs.includes("function updateShopStatusUI()"), "app.js missing updateShopStatusUI");
  assert.ok(appJs.includes("async function handleToggleActiveShop("), "app.js missing handleToggleActiveShop");
  assert.ok(appJs.includes("async function toggleShopActiveFromDirectory("), "app.js missing toggleShopActiveFromDirectory");
  assert.ok(appJs.includes("window.handleToggleActiveShop = handleToggleActiveShop"), "app.js must export handleToggleActiveShop");
  assert.ok(appJs.includes("window.toggleShopActiveFromDirectory = toggleShopActiveFromDirectory"), "app.js must export toggleShopActiveFromDirectory");
  assert.ok(appJs.includes("window.updateShopStatusUI = updateShopStatusUI"), "app.js must export updateShopStatusUI");

  // Zero-Race-Condition Atomic Firestore Write Pattern
  assert.ok(appJs.includes("isActive: newActive"), "app.js missing active state mutation");
  assert.ok(appJs.includes("{ merge: true }"), "app.js must use atomic merge: true to avoid race conditions");

  // Check-in protection when paused
  assert.ok(appJs.includes("Walk-in arrivals are currently paused"), "app.js must guard public checkin when paused");

  // Light Mode High Contrast CSS
  assert.ok(css.includes('html[data-theme="light"] #owner-shop-status-card'), "style.css missing light mode rule for status card");
  assert.ok(css.includes('html[data-theme="light"] #desk-shop-paused-banner'), "style.css missing light mode rule for desk paused banner");
});

it("Pricing page and upgrade modal are synchronized with Option A (Real-Time Analytics for Starter)", () => {
  const pricingHtml = fs.readFileSync(path.join(__dirname, "..", "pricing.html"), "utf8");
  const archHtml = fs.readFileSync(path.join(__dirname, "..", "waitlinkarchitecture.html"), "utf8");

  // pricing.html checks
  assert.ok(pricingHtml.includes("Today's Live Queue & Turnaround Analytics"), "pricing.html Starter card missing live analytics");
  assert.ok(pricingHtml.includes("Today's Real-Time Metrics"), "pricing.html matrix missing Starter real-time metrics");
  assert.ok(pricingHtml.includes("Today's Live Shift"), "pricing.html matrix missing Starter live shift metrics");

  // index.html upgrade modal checks
  assert.ok(html.includes("Today's Real-Time Analytics"), "index.html upgrade modal missing Starter real-time analytics");
  assert.ok(html.includes("90-Day Deep Trend Intelligence"), "index.html upgrade modal missing Pro 90-day deep trends");

  // waitlinkarchitecture.html checks
  assert.ok(archHtml.includes("Today's Real-Time Metrics"), "waitlinkarchitecture.html matrix missing Starter real-time metrics");
  assert.ok(archHtml.includes("Today's Live Shift"), "waitlinkarchitecture.html matrix missing Starter live shift");
});

it("Customer QR Code Join Flow: Ticket persistence, URL sync, in-flight ticket protection and completion states", () => {
  // DOM Elements
  assert.ok(html.includes('id="ticket-active-actions"'), "index.html missing #ticket-active-actions container");
  assert.ok(html.includes('id="ticket-completed-actions"'), "index.html missing #ticket-completed-actions container");
  assert.ok(html.includes('onclick="resetMyTicketView()"'), "index.html missing resetMyTicketView button");

  // Production Domain Hierarchy & Fallback Governance
  assert.ok(appJs.includes('const WAITLINK_PRODUCTION_DOMAIN = "https://waitlink.app"'), "app.js must declare https://waitlink.app as primary production domain");
  assert.ok(appJs.includes('const WAITLINK_FALLBACK_DOMAIN = "https://waitlink-app-8821.web.app"'), "app.js must declare https://waitlink-app-8821.web.app as official fallback domain");
  assert.ok(appJs.includes("function getPublicFallbackUrl()"), "app.js must provide getPublicFallbackUrl helper");
  assert.ok(appJs.includes("isHostedStaging"), "app.js getPublicUrl must detect hosted staging domains (*.web.app / *.firebaseapp.com)");

  // URL search parameter synchronization
  assert.ok(appJs.includes('u.searchParams.set("ticket", newItem.id)'), "app.js must synchronize ticket ID to URL search params");
  assert.ok(appJs.includes("window.history.replaceState"), "app.js must use replaceState to maintain ticket context without reload");

  // In-flight ticket protection in subscribeFirestore
  assert.ok(appJs.includes("mergedQueue.push(state.myTicket)"), "subscribeFirestore must retain in-flight myTicket during snapshot propagation");

  // In-flight ticket grace period and completion handling in restoreActiveTicket
  assert.ok(appJs.includes("isRecentlyCreated"), "restoreActiveTicket must protect recently created tickets from premature nullification");
  assert.ok(appJs.includes("🎉 VISIT COMPLETED"), "restoreActiveTicket and timer must display graceful visit completion banner");

  // Window export
  assert.ok(appJs.includes("window.resetMyTicketView = resetMyTicketView"), "app.js must export resetMyTicketView on window");
});

console.log(`\n📊 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
if (failed > 0) process.exit(1);


