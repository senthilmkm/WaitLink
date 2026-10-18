/**
 * WaitLink — Master Automated Quality & Test Suite Runner
 * Runs 100% of all Unit Tests, UX Flows, Security Invariants, Telecom Math & Theme Systems
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("======================================================================");
console.log("🚀 EXECUTING WAITLINK 100% AUTOMATED TEST SUITE (ALL ROLES & FEATURES)");
console.log("======================================================================\n");

const testSuites = [
  { name: "1. Queue FIFO, UX Flows & Healthcare Privacy Engine", file: "test_queue_and_ux_engine.js" },
  { name: "2. Multi-Role Access Control & Security Invariants", file: "test_roles_and_security.js" },
  { name: "3. Billing Economics, Retention Compliance & BI Analytics", file: "test_billing_and_analytics.js" },
  { name: "4. DOM Structure, Screens, Modals & UI Theme Integrity", file: "test_dom_and_ui_integrity.js" },
  { name: "5. Telecom SMS Limits, Carrier Math & Rollover Governance", file: "test_sms_topup_engine.js" },
  { name: "6. 15-Second Shop Launch, 8 Industry Catalogs & Pre-Publishing Review", file: "test_onboarding_and_review_engine.js" },
  { name: "7. SuperAdmin Revenue Metrics, Unit Economics & Account 360° Engine", file: "test_superadmin_revenue_metrics.js" }
];

let totalSuitesPassed = 0;
let totalSuitesFailed = 0;
const startTime = Date.now();

testSuites.forEach(suite => {
  const suitePath = path.join(__dirname, suite.file);
  console.log(`\n▶️ Running Suite: ${suite.name}...`);
  try {
    const output = execSync(`node "${suitePath}"`, { stdio: "inherit" });
    totalSuitesPassed++;
  } catch (err) {
    console.error(`\n❌ Suite Failed: ${suite.name}`);
    totalSuitesFailed++;
  }
});

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

console.log("\n======================================================================");
console.log("🏁 MASTER TEST SUITE EXECUTION SUMMARY");
console.log("======================================================================");
console.log(`  Total Suites Executed: ${testSuites.length}`);
console.log(`  Suites Passed:        ${totalSuitesPassed}`);
console.log(`  Suites Failed:        ${totalSuitesFailed}`);
console.log(`  Total Duration:       ${elapsedSec}s`);
console.log("======================================================================\n");

if (totalSuitesFailed > 0) {
  console.error("❌ Quality Gate Failed: One or more test suites failed.\n");
  process.exit(1);
} else {
  console.log("✅ 100% QUALITY GATE PASSED: All UX flows, roles, features and screens verified.\n");
  process.exit(0);
}
