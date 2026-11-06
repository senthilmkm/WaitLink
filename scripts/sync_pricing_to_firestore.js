/**
 * WaitLink — Sync De-Jargonized Pricing Tiers to Cloud Firestore
 * Updates settings/pricing_config and appends audit log to pricing_audits collection
 */

const admin = require("../functions/node_modules/firebase-admin");

admin.initializeApp({
  projectId: "waitlink-app-8821"
});

const db = admin.firestore();

const cleanTiers = [
  {
    id: "starter",
    badge: "Starter",
    title: "Free Forever",
    price: "$0",
    baseSmsQuota: 0,
    starterCheckinCap: 100,
    desc: "Perfect for solo barbers or new pop-up clinics testing zero-friction digital queue tracking.",
    features: [
      { text: "1 Shop Location", enabled: true },
      { text: "Up to 100 Monthly Check-ins", enabled: true },
      { text: "Printable Window QR Poster", enabled: true },
      { text: "1-Tap Front Desk Control", enabled: true },
      { text: "Real-Time Waiting Time Estimator", enabled: true },
      { text: "Anonymous Public Wait Page", enabled: true },
      { text: "Audible Turn Chimes & Sound Alerts", enabled: true },
      { text: "0 SMS Included (Live Mobile Web Card & Lobby Screen Calling only)", enabled: true },
      { text: "Automated SMS Customer Text Alerts", enabled: false },
      { text: "Custom Shop Logo Branding", enabled: false },
      { text: "Business Performance & Excel Export", enabled: false }
    ]
  },
  {
    id: "pro",
    badge: "Pro Business",
    title: "Standard Shop",
    price: "$15",
    baseSmsQuota: 500,
    desc: "Everything you need to eliminate walk-away losses and track owner analytics.",
    isPopular: true,
    features: [
      { text: "Everything in Starter", enabled: true },
      { text: "1 Dedicated Shop with Unlimited Check-ins", enabled: true },
      { text: "500 Automated SMS / mo Included", enabled: true },
      { text: "1-Month Rollover Bank (Up to 1,000 SMS reserve)", enabled: true },
      { text: "Top-Up SMS Packs Available from $5 (+250 / +1,000 / +2,500 Never Expire)", enabled: true },
      { text: "Automated SMS \"Your Turn is Ready\" Alerts", enabled: true },
      { text: "Custom Logo Branding & Colors", enabled: true },
      { text: "Promotional Offer Banners on Public Screen", enabled: true },
      { text: "Owner Performance & Analytics Dashboard", enabled: true },
      { text: "Track Busy Peak Hours & Lost Walk-Aways", enabled: true },
      { text: "Unlimited Excel & Spreadsheet Data Export", enabled: true },
      { text: "Multi-Device Front Desk Sync", enabled: true },
      { text: "Instant Real-Time Queue Sync (Zero Lag)", enabled: true },
      { text: "Automated Google Reviews & Post-Service Surveys", enabled: true },
      { text: "Multi-Location Network (Unlimited Shops)", enabled: false },
      { text: "Multiple Staff Front Desk Accounts", enabled: false }
    ]
  },
  {
    id: "enterprise",
    badge: "Enterprise",
    title: "Multi-Location",
    price: "$49",
    baseSmsQuota: 2500,
    baseLocations: 3,
    extraLocationPrice: 15,
    desc: "For chains, franchise barber networks, and regional multi-location studios.",
    features: [
      { text: "Everything in Pro Business", enabled: true },
      { text: "Up to 3 Locations Included (+ $15/mo per extra store)", enabled: true },
      { text: "Unlimited Front Desk Staff Accounts", enabled: true },
      { text: "Central Headquarters Dashboard (Manage All Locations)", enabled: true },
      { text: "Custom Web Link (e.g. wait.yourbrand.com)", enabled: true },
      { text: "2,500+ Automated SMS / mo Included", enabled: true },
      { text: "High-Speed Priority SMS Delivery", enabled: true },
      { text: "Dedicated Support Manager", enabled: true },
      { text: "99.99% Guaranteed High-Reliability Uptime", enabled: true }
    ]
  }
];

async function run() {
  console.log("🚀 Updating settings/pricing_config in Cloud Firestore...");
  const now = Date.now();
  const adminEmail = "senthil930@gmail.com";

  await db.collection("settings").doc("pricing_config").set({
    tiers: cleanTiers,
    starterCheckinCap: 100,
    rolloverPolicy: "option_b",
    updatedAt: now,
    updatedBy: adminEmail
  }, { merge: true });

  console.log("✅ Updated settings/pricing_config successfully!");

  console.log("📝 Writing pricing_audits entry...");
  await db.collection("pricing_audits").add({
    id: "audit_" + now,
    timestamp: now,
    adminEmail,
    changes: [
      "Enterprise Multi-Location: 3 Locations Included in base $49/mo (+ $15/mo per extra store)",
      "Set baseLocations: 3 and extraLocationPrice: 15 on Enterprise tier",
      "De-jargonized tier features for small business clarity across Starter, Pro, and Enterprise",
      "Replaced Priority Cloud Firestore Latency with Instant Real-Time Queue Sync (Zero Lag)",
      "Replaced Twilio SMS with Automated SMS text alerts",
      "Replaced CSV with Excel & Spreadsheet Data Export",
      "Replaced Custom Domain CNAME Routing with Custom Web Link",
      "Replaced Multi-Tenant SuperAdmin Directory with Central Headquarters Dashboard",
      "Replaced 99.99% Cloud SLA with 99.99% Guaranteed High-Reliability Uptime",
      "Eliminated duplicate Rollover Bank wording in Pro Business headline",
      "Cleanly positioned Automated Google Reviews & Post-Service Surveys above crossed-out exclusions"
    ]
  });

  console.log("✅ pricing_audits entry logged successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Failed to update Firestore:", err);
  process.exit(1);
});
