/**
 * JumpIn End-to-End Regression Suite
 * Covers: Driver & Rider flows, Trip Posting, Trip Cancellation, Seat Reservation,
 * Seat Cancellation, Message to Passengers, Message to Driver, Trip Completion,
 * Confirmation State Machine, and SMS Outbox Delivery across all flows.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const core = require("../../functions/jumpin/core.js");
const service = require("../../functions/jumpin/service.js");
const handlers = require("../../functions/jumpin/handlers.js");
const ui = require("../../functions/jumpin/ui-state.js");

const TZ = "America/New_York";
const NOW = Date.UTC(2026, 6, 15, 14, 0, 0);

function baseSeed(extra) {
  return Object.assign({
    "settings/carpool_config": Object.assign(core.defaultConfig(), {
      enabled: true,
      postRideThankYouSms: true,
      supportNote: "Zelle: community@example.com",
      dailySmsCap: 200
    })
  }, extra || {});
}

function futureWall(hoursAhead) {
  const parts = core.partsInZone(NOW + hoursAhead * 3600000, TZ);
  return {
    date: parts.year + "-" + String(parts.month).padStart(2, "0") + "-" + String(parts.day).padStart(2, "0"),
    time: String(parts.hour).padStart(2, "0") + ":" + String(parts.minute).padStart(2, "0")
  };
}

async function run() {
  let passed = 0;
  function check(name, fn) {
    return Promise.resolve().then(fn).then(function () {
      console.log("  ✓ " + name);
      passed += 1;
    });
  }

  console.log("======================================================================");
  console.log("🧪 SUITE 10: JUMPIN END-TO-END DRIVER, RIDER & SMS REGRESSION");
  console.log("======================================================================");

  const db = service.createMemoryDb(baseSeed());
  const wall = futureWall(3);
  let rideId = "";
  let driverSecret = "";
  let rider1Secret = "";
  let rider2Secret = "";
  let departAt = 0;

  await check("1. Trip Posting (Driver): creates 3-hr ride and queues driver SMS", async function () {
    const res = await handlers.call(db, "carpoolPostRide", {
      name: "Alex Driver",
      phone: "5552001000",
      from: "Uptown",
      to: "Airport",
      date: wall.date,
      time: wall.time,
      timeZone: TZ,
      seats: 3,
      durationMinutes: 180,
      rideCost: 5,
      note: "Blue sedan",
      idempotencyKey: "e2e-post-1"
    }, null, NOW);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.textSent, true);
    assert.strictEqual(res.outbox.length, 1);
    assert.strictEqual(res.outbox[0].triggerType, "CARPOOL_DRIVER_LINK");
    assert.strictEqual(res.outbox[0].to, "+15552001000");
    rideId = res.rideId;
    driverSecret = res.secret;
    const priv = db.snapshot()["carpool_private/rides/" + rideId];
    const pub = db.snapshot()["carpool_public/rides/" + rideId];
    assert.strictEqual(priv.durationMinutes, 180);
    assert.strictEqual(pub.durationMinutes, 180);
    assert.strictEqual(pub.rideCost, 5);
    assert.strictEqual(pub.seatsLeft, 3);
    departAt = priv.departAt;
  });

  await check("2. Seat Reservation (Rider): reserves single and multi-seat (family) and queues rider SMS", async function () {
    const r1 = await handlers.call(db, "carpoolReserveSeat", {
      rideId: rideId,
      name: "Sam Rider",
      phone: "5552002001",
      seats: 1,
      idempotencyKey: "e2e-r1"
    }, null, NOW + 1000);
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.seatsLeft, 2);
    assert.strictEqual(r1.textSent, true);
    assert.strictEqual(r1.outbox.length, 1);
    assert.strictEqual(r1.outbox[0].triggerType, "CARPOOL_RIDER_LINK");
    assert.strictEqual(r1.outbox[0].to, "+15552002001");
    rider1Secret = r1.secret;

    const r2 = await handlers.call(db, "carpoolReserveSeat", {
      rideId: rideId,
      name: "Pat Family",
      phone: "5552002002",
      seats: 2,
      dropoff: "University City",
      idempotencyKey: "e2e-r2"
    }, null, NOW + 2000);
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.outbox[0].to, "+15552002002");
    assert.ok(r2.outbox[0].body.indexOf("2 seats") !== -1);
    rider2Secret = r2.secret;

    const pub = db.snapshot()["carpool_public/rides/" + rideId];
    assert.strictEqual(pub.seatsLeft, 0);
    assert.strictEqual(pub.riders.length, 2);
    assert.strictEqual(pub.riders[1].seats, 2);
    assert.strictEqual(pub.riders[1].dropoff, "University City");

    // Rider 2 decreases seats (2 -> 1), then increases (1 -> 2), and cannot exceed remaining seats
    const dec = await handlers.call(db, "carpoolUpdateSeat", { rideId: rideId, secret: rider2Secret, seats: 1 }, null, NOW + 2200);
    assert.strictEqual(dec.ok, true);
    assert.strictEqual(db.snapshot()["carpool_public/rides/" + rideId].seatsLeft, 1);
    const over = await handlers.call(db, "carpoolUpdateSeat", { rideId: rideId, secret: rider2Secret, seats: 3 }, null, NOW + 2300);
    assert.strictEqual(over.ok, false);
    const inc = await handlers.call(db, "carpoolUpdateSeat", { rideId: rideId, secret: rider2Secret, seats: 2 }, null, NOW + 2400);
    assert.strictEqual(inc.ok, true);
    assert.strictEqual(db.snapshot()["carpool_public/rides/" + rideId].seatsLeft, 0);
  });

  await check("3. Seat Cancellation (Rider): restores all seats and stops messaging cancelled rider", async function () {
    const cancel = await handlers.call(db, "carpoolCancelSeat", {
      rideId: rideId,
      secret: rider2Secret
    }, null, NOW + 3000);
    assert.strictEqual(cancel.ok, true);
    const pub = db.snapshot()["carpool_public/rides/" + rideId];
    assert.strictEqual(pub.seatsLeft, 2);
    assert.strictEqual(pub.riders.length, 1);
    assert.strictEqual(pub.riders[0].name, "Sam Rider");
  });

  await check("4. Message to Passengers (Driver): texts only active riders", async function () {
    const msg = await handlers.call(db, "carpoolPostMessage", {
      rideId: rideId,
      secret: driverSecret,
      text: "Leaving in 10 mins"
    }, null, NOW + 4000);
    assert.strictEqual(msg.ok, true);
    assert.strictEqual(msg.outbox.length, 1);
    assert.strictEqual(msg.outbox[0].triggerType, "CARPOOL_MESSAGE");
    assert.strictEqual(msg.outbox[0].to, "+15552002001");
    assert.ok(msg.outbox[0].body.indexOf("Leaving in 10 mins") !== -1);
  });

  await check("5. Message to Driver (Rider): works mid-trip (2 hrs into 3-hr ride) and texts driver", async function () {
    // Rider on another phone requests manage link mid-trip
    const rRec = await handlers.call(db, "carpoolSendManageLink", {
      rideId: rideId,
      phone: "5552002001",
      role: "rider",
      ip: "127.0.0.2"
    }, null, departAt + 90 * 60000);
    assert.strictEqual(rRec.ok, true);
    assert.strictEqual(rRec.outbox.length, 1);
    assert.ok(rRec.outbox[0].body.indexOf("view=seat") !== -1);
    const rm = /k=([^&\s]+)/.exec(rRec.outbox[0].body);
    assert.ok(rm && rm[1]);
    rider1Secret = rm[1];

    const msg = await handlers.call(db, "carpoolPostMessage", {
      rideId: rideId,
      secret: rider1Secret,
      text: "Almost at dropoff"
    }, null, departAt + 120 * 60000);
    assert.strictEqual(msg.ok, true);
    assert.strictEqual(msg.outbox.length, 1);
    assert.strictEqual(msg.outbox[0].triggerType, "CARPOOL_MESSAGE");
    assert.strictEqual(msg.outbox[0].to, "+15552001000");
    assert.ok(msg.outbox[0].body.indexOf("Almost at dropoff") !== -1);
  });

  await check("6. Trip Completion (Driver): confirmation state + manual complete + thank-you SMS", async function () {
    // Rejects before departure
    const early = await handlers.call(db, "carpoolCompleteTrip", {
      rideId: rideId,
      secret: driverSecret
    }, null, departAt - 60000);
    assert.strictEqual(early.ok, false);

    // UI confirmation state machine
    let s = ui.reduce(ui.blank(), { type: "ride", ride: { status: "open", seatsLeft: 2 }, role: "driver" });
    s = ui.reduce(s, { type: "complete-ask" });
    assert.strictEqual(s.sheet, "complete");
    s = ui.reduce(s, { type: "keep" });
    assert.strictEqual(s.sheet, "");
    s = ui.reduce(s, { type: "complete-ask" });
    s = ui.reduce(s, { type: "confirm" });
    assert.strictEqual(s.pendingAction, "complete-trip");

    // Driver on another device requests manage link after departure (1 hr into 3-hr trip)
    const rec = await handlers.call(db, "carpoolSendManageLink", {
      rideId: rideId,
      phone: "5552001000",
      role: "driver",
      ip: "127.0.0.1"
    }, null, departAt + 60 * 60000);
    assert.strictEqual(rec.ok, true);
    assert.strictEqual(rec.outbox.length, 1);
    assert.strictEqual(rec.outbox[0].triggerType, "CARPOOL_DRIVER_LINK");
    const m = /k=([^&\s]+)/.exec(rec.outbox[0].body);
    assert.ok(m && m[1]);
    driverSecret = m[1];

    // Complete after departure using the recovered secret
    const done = await handlers.call(db, "carpoolCompleteTrip", {
      rideId: rideId,
      secret: driverSecret
    }, null, departAt + 175 * 60000);
    assert.strictEqual(done.ok, true);
    assert.strictEqual(done.outbox.length, 2);
    const targets = done.outbox.map(function (m) { return m.to; }).sort();
    assert.deepStrictEqual(targets, ["+15552001000", "+15552002001"]);
    done.outbox.forEach(function (m) {
      assert.strictEqual(m.triggerType, "CARPOOL_THANKYOU");
      assert.ok(m.body.indexOf("Zelle: community@example.com") !== -1);
    });

    // Scheduled fallback must not duplicate thank-you SMS
    const cron = await handlers.call(db, "carpoolCompleteTrips", {}, null, departAt + 500 * 60000);
    assert.strictEqual(cron.completed, 0);
    assert.strictEqual(cron.outbox.length, 0);

    // 0-passenger trip auto-cancels after deadline with 0 thank-you SMS
    const emptyPost = await handlers.call(db, "carpoolPostRide", {
      name: "Solo Driver",
      phone: "5554001000",
      from: "North",
      to: "South",
      date: wall.date,
      time: wall.time,
      timeZone: TZ,
      seats: 3,
      durationMinutes: 30,
      idempotencyKey: "e2e-empty"
    }, null, NOW + 8000);
    assert.strictEqual(emptyPost.ok, true);
    const emptyCron = await handlers.call(db, "carpoolCompleteTrips", {}, null, departAt + 500 * 60000);
    assert.strictEqual(emptyCron.completed, 1);
    assert.strictEqual(emptyCron.outbox.length, 0);
    assert.strictEqual(db.snapshot()["carpool_public/rides/" + emptyPost.rideId].status, "cancelled");
  });

  await check("7. Trip Cancellation (Driver): cancels trip and texts active riders", async function () {
    const post2 = await handlers.call(db, "carpoolPostRide", {
      name: "Bea Driver",
      phone: "5553001000",
      from: "Campus",
      to: "Mall",
      date: wall.date,
      time: wall.time,
      timeZone: TZ,
      seats: 2,
      durationMinutes: 60,
      idempotencyKey: "e2e-post-2"
    }, null, NOW + 5000);
    assert.strictEqual(post2.ok, true);
    await handlers.call(db, "carpoolReserveSeat", {
      rideId: post2.rideId,
      name: "Lee Rider",
      phone: "5553002001",
      idempotencyKey: "e2e-r3"
    }, null, NOW + 6000);
    const cancelled = await handlers.call(db, "carpoolCancelTrip", {
      rideId: post2.rideId,
      secret: post2.secret
    }, null, NOW + 7000);
    assert.strictEqual(cancelled.ok, true);
    assert.strictEqual(cancelled.outbox.length, 1);
    assert.strictEqual(cancelled.outbox[0].triggerType, "CARPOOL_TRIP_CANCELLED");
    assert.strictEqual(cancelled.outbox[0].to, "+15553002001");
    assert.strictEqual(db.snapshot()["carpool_public/rides/" + post2.rideId].status, "cancelled");
  });

  await check("8. UI Source Integrity: completed/cancelled trips hide compose box and show confirm sheet", function () {
    const appSrc = fs.readFileSync(path.join(__dirname, "../../jumpin/app.js"), "utf8");
    assert.ok(appSrc.indexOf("(current.status === \"open\" || current.status === \"pending\")") !== -1);
    assert.ok(appSrc.indexOf("Complete this trip?") !== -1);
    assert.ok(appSrc.indexOf("z-index:9999") !== -1 && appSrc.indexOf("rootNode.appendChild(confirmSheet(doc))") !== -1);
    assert.ok(appSrc.indexOf("Edit seats") !== -1 && appSrc.indexOf("Cancel reservation") !== -1);
    assert.ok(appSrc.indexOf("bookedSeats + \" seats.\"") !== -1);
    ["/jumpin-privacy.html", "/jumpin-terms.html", "/jumpin-contact.html"].forEach(function (rel) {
      assert.ok(appSrc.indexOf(rel) !== -1);
      assert.ok(fs.existsSync(path.join(__dirname, "../.." + rel)));
    });
    assert.ok(appSrc.indexOf("waitlink_jumpin_profile") !== -1);
    assert.ok(appSrc.indexOf("On my way") !== -1 && appSrc.indexOf("At pickup spot") !== -1);
    assert.ok(appSrc.indexOf("Search route or city") !== -1);
    assert.ok(appSrc.indexOf("name = \"durationMinutes\"") !== -1 || appSrc.indexOf("dur.name = \"durationMinutes\"") !== -1);
    const fbJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../../firebase.json"), "utf8"));
    const rewrites = (fbJson.hosting && fbJson.hosting.rewrites) || [];
    ["carpoolPostRide", "carpoolReserveSeat", "carpoolUpdateSeat", "carpoolCancelSeat", "carpoolCancelTrip", "carpoolCompleteTrip", "carpoolSendManageLink", "carpoolPostMessage", "carpoolCreateGroup", "carpoolListGroups", "carpoolReviewGroup"].forEach(function (fnName) {
      assert.ok(rewrites.some(function (r) { return r.source === "/api/" + fnName && r.function && r.function.functionId === fnName; }), "Missing firebase.json rewrite for " + fnName);
    });
  });

  await check("9. UI Enhancements Regression: two-step reserve, non-sticky form focus, status/role pills, and short Trip ID", function () {
    const appSrc = fs.readFileSync(path.join(__dirname, "../../jumpin/app.js"), "utf8");
    const adminSrc = fs.readFileSync(path.join(__dirname, "../../jumpin-admin.js"), "utf8");
    assert.ok(appSrc.indexOf("reserveOpen: false") !== -1 && appSrc.indexOf("Reserve your seat") !== -1 && appSrc.indexOf("reserveDraft") !== -1);
    assert.ok(appSrc.indexOf("form-open") !== -1 && appSrc.indexOf("keepFocusedVisible") !== -1 && appSrc.indexOf("padding-bottom:42vh") !== -1);
    assert.ok(appSrc.indexOf("status-pill") !== -1 && appSrc.indexOf("Your trip") !== -1 && appSrc.indexOf("Seat booked") !== -1 && appSrc.indexOf("Last seat") !== -1);
    assert.ok(appSrc.indexOf("shortTripId") !== -1 && appSrc.indexOf("Trip ID: ") !== -1);
    assert.ok(appSrc.indexOf("hero-eyebrow") !== -1 && appSrc.indexOf("card-foot") !== -1 && appSrc.indexOf("info-grid") !== -1 && appSrc.indexOf("mini-av") !== -1 && appSrc.indexOf("post-head") !== -1);
    assert.ok(appSrc.indexOf("matchesDateFilter") !== -1 && appSrc.indexOf("PAGE_SIZE = 12") !== -1 && appSrc.indexOf("pager-edge") !== -1 && appSrc.indexOf("Show all rides") !== -1);
    assert.ok(adminSrc.indexOf("shortTripId") !== -1 && adminSrc.indexOf("Trip ID: ") !== -1 && adminSrc.indexOf("admin-pager") !== -1 && adminSrc.indexOf("jumpin-group-select") !== -1 && adminSrc.indexOf("get(\"tab\")") !== -1);
    const termsSrc = fs.readFileSync(path.join(__dirname, "../../jumpin-terms.html"), "utf8");
    assert.ok(termsSrc.indexOf("message and data rates may apply") !== -1 && termsSrc.indexOf("offline directly between the driver and riders") !== -1);
  });

  await check("10. Multi-Group Admin Governance, Header Gating & Home Polish Regression", async function () {
    const superAuth = { token: { email: service.SUPERADMIN_EMAIL } };
    const created = await handlers.call(db, "carpoolCreateGroup", {
      name: "Ballantyne",
      groupId: "ballantyne",
      contactEmail: "org@example.com",
      contactPhone: "5552345678",
      membersOnly: true
    }, { token: { email: "org@example.com" } }, NOW + 8000);
    assert.strictEqual(created.ok, true);
    assert.strictEqual(created.group.status, "pending");
    assert.strictEqual(created.outbox[0].triggerType, "CARPOOL_GROUP_REQUEST");

    const approved = await handlers.call(db, "carpoolReviewGroup", { groupId: "ballantyne", decision: "approve" }, superAuth, NOW + 8100);
    assert.strictEqual(approved.ok, true);
    assert.strictEqual(approved.status, "active");
    assert.strictEqual(approved.outbox[0].triggerType, "CARPOOL_GROUP_APPROVED");

    const paused = await handlers.call(db, "carpoolReviewGroup", { groupId: "ballantyne", decision: "suspend" }, superAuth, NOW + 8200);
    assert.strictEqual(paused.ok, true);
    assert.strictEqual(paused.status, "suspended");

    const deleted = await handlers.call(db, "carpoolReviewGroup", { groupId: "ballantyne", decision: "reject" }, superAuth, NOW + 8300);
    assert.strictEqual(deleted.ok, true);
    assert.strictEqual(deleted.decision, "reject");
    const listAfter = await handlers.call(db, "carpoolListGroups", {}, superAuth, NOW + 8400);
    assert.strictEqual((listAfter.groups || []).some(function (g) { return g.groupId === "ballantyne"; }), false);

    const adminHtml = fs.readFileSync(path.join(__dirname, "../../jumpin-admin.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(__dirname, "../../jumpin-admin.js"), "utf8");
    const appSrc = fs.readFileSync(path.join(__dirname, "../../jumpin/app.js"), "utf8");
    const guideHtml = fs.readFileSync(path.join(__dirname, "../../jumpin-guide.html"), "utf8");
    assert.ok(adminHtml.indexOf("[hidden] { display: none !important; }") !== -1);
    assert.ok(adminHtml.indexOf("id=\"jumpin-nav-guide\" hidden") !== -1);
    assert.ok(adminHtml.indexOf("id=\"jumpin-signedout-info\"") !== -1 && adminHtml.indexOf("id=\"jumpin-summary-strip\"") !== -1);
    assert.ok(adminJs.indexOf("groupsData.isSuperAdmin") !== -1 && adminJs.indexOf("senthil930@gmail.com") === -1);
    assert.ok(adminJs.indexOf("askConfirm(page, removeLabel + \" group?\"") !== -1);
    assert.ok(appSrc.indexOf("Start a Group") !== -1 && appSrc.indexOf("Offer a ride") !== -1 && appSrc.indexOf("while (cleanups.length) cleanups.pop()()") !== -1);
    assert.ok(appSrc.indexOf("watchPlatformNotice") !== -1 && appSrc.indexOf("Maintenance Mode") !== -1);
    assert.ok(appSrc.indexOf("function memberSheet") !== -1 && appSrc.indexOf("Members-Only Community") !== -1);
    assert.ok(appSrc.indexOf("body.jumpin-ios") !== -1 && appSrc.indexOf("syncIosTheme") !== -1);
    assert.ok(adminHtml.indexOf("id=\"jumpin-platform-settings\"") !== -1 && adminHtml.indexOf("id=\"jumpin-feature-config\"") !== -1 && adminJs.indexOf("savePlatformConfig") !== -1);
    assert.ok(guideHtml.indexOf("?tab=groups") !== -1);
  });

  console.log("\n📊 RESULTS: " + passed + " PASSED, 0 FAILED\n");
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
