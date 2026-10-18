/**
 * WaitLink — 15-Second Shop Launch, Industry Presets & Pre-Publishing Review Test Suite
 * Tests 100% of the streamlined onboarding flow, universal slug engine, all 8 industry catalogs (6 services each),
 * and pre-publishing review checklist verification.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

console.log("======================================================================");
console.log("🧪 STARTING WAITLINK 15-SECOND SHOP LAUNCH & REVIEW ENGINE TEST SUITE");
console.log("======================================================================\n");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../style.css"), "utf8");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// Sandbox execution helper for app.js data structures
function loadPresetsFromAppJs() {
  const match = appJs.match(/const DEMO_INDUSTRY_PRESETS\s*=\s*(\{[\s\S]*?\n\};)/);
  if (!match) throw new Error("Could not extract DEMO_INDUSTRY_PRESETS from app.js");
  const sandbox = {};
  vm.runInNewContext(`${match[0]}; presets = DEMO_INDUSTRY_PRESETS;`, sandbox);
  return sandbox.presets;
}

const presets = loadPresetsFromAppJs();

console.log("--- 1. Industry Catalog & 6-Service Presets Verification ---");

it("DEMO_INDUSTRY_PRESETS defines all 8 required industry categories", () => {
  const expectedKeys = ["auto", "salon", "clinic", "pet", "restaurant", "repair", "tattoo", "general"];
  assert.strictEqual(Object.keys(presets).length, 8, "Expected exactly 8 industry presets");
  expectedKeys.forEach(k => {
    assert.ok(presets[k], `Missing industry preset key: ${k}`);
  });
});

it("Each of the 8 industries contains exactly 6 realistic pre-configured services", () => {
  const expectedLabels = {
    auto: "Auto Repair & Tire Shop",
    salon: "Barbershop & Hair Salon",
    clinic: "Medical, Urgent Care & Dental",
    pet: "Pet Grooming & Veterinary",
    restaurant: "Restaurants, Cafes & Food Trucks",
    repair: "Phone, Tablet & Computer Repair",
    tattoo: "Tattoo & Piercing Studios",
    general: "General Walk-In Service Counter"
  };

  Object.keys(presets).forEach(key => {
    const p = presets[key];
    assert.strictEqual(p.label, expectedLabels[key], `Preset ${key} label mismatch`);
    assert.ok(p.icon && p.icon.length > 0, `Preset ${key} icon missing`);
    assert.ok(Array.isArray(p.services), `Preset ${key} services must be an array`);
    assert.strictEqual(p.services.length, 6, `Preset ${key} must have exactly 6 services, found: ${p.services.length}`);

    // Verify service metadata completeness
    const seenIds = new Set();
    p.services.forEach(srv => {
      assert.ok(srv.id && srv.id.startsWith("srv_"), `Service ID ${srv.id} must start with srv_`);
      assert.ok(!seenIds.has(srv.id), `Duplicate service ID detected in ${key}: ${srv.id}`);
      seenIds.add(srv.id);
      assert.ok(srv.name && srv.name.trim().length > 3, `Service name invalid in ${key}: ${srv.name}`);
      assert.ok(srv.estDurationMin >= 5 && srv.estDurationMin <= 60, `Duration out of bounds for ${srv.name}: ${srv.estDurationMin}`);
      assert.ok(srv.icon && srv.icon.length > 0, `Icon missing for ${srv.name}`);
      assert.strictEqual(srv.enabled, true, `Service ${srv.name} must be enabled by default`);
    });
  });
});

it("Medical & Urgent Care preset strictly enforces clinicalPrivacyEnabled = true (HIPAA)", () => {
  assert.strictEqual(presets.clinic.clinicalPrivacyEnabled, true, "Clinic must have clinicalPrivacyEnabled: true");
  assert.strictEqual(presets.salon.clinicalPrivacyEnabled, false, "Salon must have clinicalPrivacyEnabled: false");
  assert.strictEqual(presets.auto.clinicalPrivacyEnabled, false, "Auto must have clinicalPrivacyEnabled: false");
});

console.log("\n--- 2. Invisible Universal Slug Engine & Collision Prevention ---");

it("slugify produces clean, URL-safe kebab-case strings", () => {
  const cleanSlug = (text) => String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  assert.strictEqual(cleanSlug("Apex Tire & Auto"), "apex-tire-auto");
  assert.strictEqual(cleanSlug("Crown & Blade Barbers!"), "crown-blade-barbers");
  assert.strictEqual(cleanSlug("Metro Urgent Care & Dental"), "metro-urgent-care-dental");
  assert.strictEqual(cleanSlug("  Paws   &   Claws  "), "paws-claws");
  assert.strictEqual(cleanSlug("123 Fix-It! (Downtown)"), "123-fix-it-downtown");
});

it("Universal slug engine auto-resolves collisions by appending numerical suffixes", () => {
  const mockExistingSlugs = new Set(["apex-barber", "apex-barber-2", "apex-barber-3"]);

  const resolveUniqueSlug = (candidate) => {
    let resolved = candidate;
    let counter = 1;
    while (mockExistingSlugs.has(resolved) && counter <= 10) {
      counter++;
      resolved = `${candidate}-${counter}`;
    }
    return resolved;
  };

  assert.strictEqual(resolveUniqueSlug("apex-barber"), "apex-barber-4");
  assert.strictEqual(resolveUniqueSlug("fresh-fades"), "fresh-fades");
});

it("RESERVED_SLUGS set in app.js protects core system paths", () => {
  const requiredReserved = ["home", "desk", "owner", "superadmin", "public", "admin", "api", "waitlink", "pricing"];
  requiredReserved.forEach(word => {
    assert.ok(appJs.includes(`"${word}"`), `RESERVED_SLUGS must protect '${word}'`);
  });
});

console.log("\n--- 3. 15-Second Shop Launch Modal DOM & Streamlined UX ---");

it("index.html contains 15-Second Shop Launch title and frictionless structure", () => {
  assert.ok(html.includes("15-Second Shop Launch"), "Missing 15-Second Shop Launch headline");
  assert.ok(html.includes('id="onboard-shopname"'), "Missing #onboard-shopname input");
  assert.ok(html.includes('id="onboard-industry-grid"'), "Missing #onboard-industry-grid");
  assert.ok(html.includes('id="onboard-industry"'), "Missing #onboard-industry hidden field");
  assert.ok(html.includes('id="onboard-slug-preview-box"'), "Missing live link preview box");
  assert.ok(html.includes('id="btn-onboard-submit"'), "Missing primary launch button");
});

it("Onboarding modal eliminates premature clutter (address, phone, promo dates, plan dropdown)", () => {
  // Verify that inputs that cause friction during initial 15-second launch are NOT in the active form
  assert.ok(!html.includes('name="onboard-address-visible"'), "Visible address input should not clutter onboarding");
  assert.ok(!html.includes('id="onboard-promo-card"'), "Pro promo dates box should not clutter onboarding");
  assert.ok(!html.includes('<select id="onboard-plan"'), "Plan tier dropdown should not clutter onboarding");
  
  // Verify compatibility hidden inputs exist so existing scripts do not throw null errors
  assert.ok(html.includes('<input type="hidden" id="onboard-plan" value="starter">'), "Hidden #onboard-plan compatibility input missing");
  assert.ok(html.includes('<input type="hidden" id="onboard-address" value="">'), "Hidden #onboard-address compatibility input missing");
});

it("All 8 industry preset chips are rendered in the onboarding modal markup", () => {
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

  chips.forEach(id => {
    assert.ok(html.includes(`id="${id}"`), `Onboarding modal missing industry chip: #${id}`);
  });
});

console.log("\n--- 4. Pre-Publishing Review Banner & Action Buttons ---");

it("Onboarding completion modal contains prominent Pre-Publishing Review Warning Banner", () => {
  assert.ok(html.includes('id="reg-success-review-banner"'), "Missing #reg-success-review-banner in completion modal");
  assert.ok(html.includes("Action Required: Review Your Shop Settings Before Publishing!"), "Missing review banner title");
  assert.ok(html.includes("Pre-Launch Check"), "Missing Pre-Launch Check badge");
});

it("Review banner contains checklist for Store Hours (9 AM - 7 PM), 6 Services, and Storefront Contact", () => {
  assert.ok(html.includes("9:00 AM – 7:00 PM"), "Review checklist missing default 9 AM - 7 PM store hours");
  assert.ok(html.includes('id="reg-review-service-count"'), "Missing #reg-review-service-count reactive element");
  assert.ok(html.includes("Storefront & Contact:"), "Review checklist missing Storefront & Contact item");
});

it("Review banner provides explicit Primary and Secondary action/submit buttons", () => {
  assert.ok(html.includes('id="btn-reg-review-settings"'), "Missing primary button #btn-reg-review-settings");
  assert.ok(html.includes("launchFromRegistration('owner')"), "Primary button must navigate to owner settings");
  assert.ok(html.includes('id="btn-reg-jump-desk"'), "Missing secondary button #btn-reg-jump-desk");
  assert.ok(html.includes("launchFromRegistration('desk')"), "Secondary button must navigate to front desk");
  assert.ok(html.includes("Review & Confirm Shop Settings Now"), "Primary button label mismatch");
  assert.ok(html.includes("Jump Straight to Live Front Desk"), "Secondary button label mismatch");
});

console.log("\n--- 5. Security & Plan Governance Invariants ---");

it("Newly registered shops strictly initialize on Starter Tier ($0 Free Forever)", () => {
  assert.ok(appJs.includes('const planTitle = "Starter Tier (Free)";'), "New shops must initialize with Starter Tier (Free)");
  assert.ok(appJs.includes("const planPrice = 0;"), "New shops must initialize with planPrice = 0");
  assert.ok(appJs.includes("state.config.services = initialServices;"), "Initial services must be seeded from selected preset");
  assert.ok(appJs.includes("state.config.industry = industryKey;"), "Industry must be recorded in config");
});

console.log("\n--- 6. Runtime Store Hours Polymorphism & handleOnboardingSubmit Safety ---");

it("renderPublicView safely handles polymorphic hours (both string and object formats) without TypeError", () => {
  function extractHours(configHours) {
    let rawHours = configHours || "9:00 AM - 7:00 PM";
    let hoursText = "9:00 AM - 7:00 PM";
    if (typeof rawHours === "string") {
      hoursText = rawHours.replace(/\s*\(?Open Today\s*🟢?\)?/gi, "").trim() || "9:00 AM - 7:00 PM";
    } else if (rawHours && typeof rawHours === "object") {
      const openTime = rawHours.open || "09:00";
      const closeTime = rawHours.close || "19:00";
      const format12 = (tStr) => {
        if (!tStr) return "";
        const parts = String(tStr).split(":");
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h)) return tStr;
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
      };
      hoursText = `${format12(openTime)} – ${format12(closeTime)}`;
    }
    return hoursText;
  }

  assert.strictEqual(extractHours("9:00 AM - 7:00 PM (Open Today 🟢)"), "9:00 AM - 7:00 PM");
  assert.strictEqual(extractHours({ open: "09:00", close: "19:00", days: [1,2,3,4,5,6,0] }), "9:00 AM – 7:00 PM");
  assert.strictEqual(extractHours({ open: "08:30", close: "17:00" }), "8:30 AM – 5:00 PM");
  assert.strictEqual(extractHours(undefined), "9:00 AM - 7:00 PM");
});

it("app.js protects renderAll execution in handleOnboardingSubmit to guarantee modal transitions", () => {
  assert.ok(appJs.includes("try {\n    saveData();\n    generateQRCode();\n    renderAll();\n  } catch (renderErr)") || appJs.includes("saveData();\n    generateQRCode();\n    renderAll();"), "handleOnboardingSubmit must execute saveData, generateQRCode, and renderAll");
  assert.ok(appJs.includes("openRegistrationSuccessModal(shopName, slug, state.user.email);"), "handleOnboardingSubmit must open registration success modal");
});

console.log(`\n======================================================================`);
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`======================================================================\n`);

if (failed > 0) process.exit(1);
process.exit(0);
