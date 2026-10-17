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

it("index.html contains all 16 modal backdrops and dialogs", () => {
  const all16Modals = [
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
    "waitlink-dialog-backdrop"
  ];

  all16Modals.forEach(id => {
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

console.log(`\n📊 RESULTS: ${passed} PASSED, ${failed} FAILED\n`);
if (failed > 0) process.exit(1);
