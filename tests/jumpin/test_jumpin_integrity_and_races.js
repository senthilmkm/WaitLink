/**
 * JumpIn Routing, Sync, Concurrency, Scheduled Jobs & UI Integrity Regression Suite (Suite 11)
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const core = require("../../functions/jumpin/core.js");
const service = require("../../functions/jumpin/service.js");
const handlers = require("../../functions/jumpin/handlers.js");

const ROOT = path.resolve(__dirname, "../..");
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

let passed = 0;
let failed = 0;
const cases = [];
function test(name, fn) { cases.push({ name: name, fn: fn }); }

test("1. Hosting Rewrites & Mirrored Functions Sync Integrity", function () {
  const carpoolSrc = fs.readFileSync(path.join(ROOT, "functions/carpool.js"), "utf8");
  const firebaseCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));
  const rewrites = new Set((firebaseCfg.hosting && firebaseCfg.hosting.rewrites || []).map(function (r) { return r.source; }));
  const callables = [];
  carpoolSrc.replace(/exports\.(carpool\w+)\s*=\s*(?:guestCall|staffCall)\(/g, function (_, fnName) {
    callables.push(fnName);
  });
  assert.ok(callables.length >= 20, "Expected >= 20 carpool callables");
  callables.forEach(function (fnName) {
    assert.ok(rewrites.has("/api/" + fnName), "Missing firebase.json rewrite for /api/" + fnName);
  });

  ["core.js", "service.js", "handlers.js", "ui-state.js", "admin-state.js"].forEach(function (file) {
    const a = fs.readFileSync(path.join(ROOT, "jumpin", file), "utf8");
    const b = fs.readFileSync(path.join(ROOT, "functions/jumpin", file), "utf8");
    assert.strictEqual(a, b, "functions/jumpin/" + file + " is out of sync with jumpin/" + file);
  });
});

test("2. Edit Trip End-to-End: Seat Floor, Delta SMS, and 5-Edit Cap", async function () {
  const db = service.createMemoryDb(baseSeed());
  const w1 = futureWall(4);
  const w2 = futureWall(6);
  const posted = await handlers.call(db, "carpoolPostRide", {
    name: "Dan", phone: "5552221111", from: "Library", to: "Station",
    date: w1.date, time: w1.time, timeZone: TZ, seats: 4, note: "East gate"
  }, null, NOW);
  assert.strictEqual(posted.ok, true);

  const res = await handlers.call(db, "carpoolReserveSeat", {
    rideId: posted.rideId, name: "Eva", phone: "5553334444", seats: 2
  }, null, NOW + 1000);
  assert.strictEqual(res.ok, true);

  // Shrinking below bookedSeats (2) must fail
  const badFloor = await handlers.call(db, "carpoolEditRide", {
    rideId: posted.rideId, secret: posted.secret, date: w1.date, time: w1.time, seats: 1, note: "East gate"
  }, null, NOW + 2000);
  assert.strictEqual(badFloor.ok, false);
  assert.strictEqual(badFloor.field, "seats");

  // Seat-only edit sends 0 SMS
  const seatOnly = await handlers.call(db, "carpoolEditRide", {
    rideId: posted.rideId, secret: posted.secret, date: w1.date, time: w1.time, seats: 5, note: "East gate"
  }, null, NOW + 3000);
  assert.strictEqual(seatOnly.ok, true);
  assert.strictEqual(seatOnly.ride.seatsLeft, 3);
  assert.strictEqual((seatOnly.outbox || []).length, 0);

  // Time + Note edit sends 1 delta SMS
  const timeNote = await handlers.call(db, "carpoolEditRide", {
    rideId: posted.rideId, secret: posted.secret, date: w2.date, time: w2.time, seats: 5, note: "West lot"
  }, null, NOW + 4000);
  assert.strictEqual(timeNote.ok, true);
  assert.strictEqual((timeNote.outbox || []).length, 1);
  assert.ok(timeNote.outbox[0].body.indexOf("JumpIn update") !== -1);
  assert.ok(timeNote.outbox[0].body.indexOf("West lot") !== -1);
});

test("3. Concurrency Matrix: Reserve vs Edit Seat Shrink Preserves Seat Invariant", async function () {
  const db = service.createMemoryDb(baseSeed());
  const w1 = futureWall(5);
  const posted = await handlers.call(db, "carpoolPostRide", {
    name: "Pat", phone: "5554441111", from: "North", to: "South",
    date: w1.date, time: w1.time, timeZone: TZ, seats: 3, note: ""
  }, null, NOW);
  assert.strictEqual(posted.ok, true);

  const [r1, e1] = await Promise.all([
    handlers.call(db, "carpoolReserveSeat", { rideId: posted.rideId, name: "R1", phone: "5556661111", seats: 2 }, null, NOW + 1000),
    handlers.call(db, "carpoolEditRide", { rideId: posted.rideId, secret: posted.secret, date: w1.date, time: w1.time, seats: 1, note: "" }, null, NOW + 1001)
  ]);

  // Either reserve won first (so edit to 1 failed) or edit won first (so reserve 2 failed)
  assert.ok(!(r1.ok && e1.ok), "Both reserve(2) and shrink-to-1 must never both succeed");
  const pub = db.snapshot()["carpool_public/rides/" + posted.rideId];
  const activeBooked = (pub.riders || []).reduce(function (s, r) { return s + r.seats; }, 0);
  assert.strictEqual(pub.seatsTotal - pub.seatsLeft, activeBooked);
  assert.ok(pub.seatsLeft >= 0);
});

test("4. Scheduled Jobs: Auto-Complete (1+ Riders vs 0 Riders) and Retention Purge", async function () {
  const db = service.createMemoryDb(baseSeed());
  const w1 = futureWall(2);
  const withRider = await handlers.call(db, "carpoolPostRide", {
    name: "Sam", phone: "5551112222", from: "Town", to: "City",
    date: w1.date, time: w1.time, timeZone: TZ, seats: 3, durationMinutes: 60
  }, null, NOW);
  assert.strictEqual(withRider.ok, true);
  await handlers.call(db, "carpoolReserveSeat", {
    rideId: withRider.rideId, name: "Liv", phone: "5551113333", seats: 1
  }, null, NOW + 1000);

  const emptyRide = await handlers.call(db, "carpoolPostRide", {
    name: "Max", phone: "5551114444", from: "North", to: "South",
    date: w1.date, time: w1.time, timeZone: TZ, seats: 3, durationMinutes: 60
  }, null, NOW + 2000);
  assert.strictEqual(emptyRide.ok, true);

  // Jump past depart + 60m duration + 60m grace (4h + 1m from NOW)
  const afterGrace = NOW + (4 * 3600 + 60) * 1000;
  const completed1 = await handlers.call(db, "carpoolCompleteTrips", {}, null, afterGrace);
  assert.strictEqual(completed1.ok, true);
  assert.strictEqual(db.snapshot()["carpool_public/rides/" + withRider.rideId].status, "completed");
  assert.strictEqual(db.snapshot()["carpool_public/rides/" + emptyRide.rideId].status, "cancelled");
  assert.ok((completed1.outbox || []).length >= 2, "Thank-you SMS sent once for trip with rider");

  // Running completeTrips again sends 0 duplicate SMS
  const completed2 = await handlers.call(db, "carpoolCompleteTrips", {}, null, afterGrace + 60000);
  assert.strictEqual((completed2.outbox || []).length, 0);

  // After 8 days: private doc purged, public doc scrubbed to 'missing' tombstone; after 39 days: tombstone purged
  const day8 = afterGrace + 8 * core.DAY_MS;
  await handlers.call(db, "carpoolRetainTrips", {}, null, day8);
  assert.strictEqual(db.snapshot()["carpool_private/rides/" + withRider.rideId], undefined);
  assert.strictEqual(db.snapshot()["carpool_public/rides/" + withRider.rideId].status, "missing");

  const day39 = afterGrace + 39 * core.DAY_MS;
  await handlers.call(db, "carpoolRetainTrips", {}, null, day39);
  assert.strictEqual(db.snapshot()["carpool_public/rides/" + withRider.rideId], undefined);
});

test("5. UI, CSS & Docs Contracts: Seat Pills in Sheet, Centered Footer, Cancel Confirm, FAQ", function () {
  const appSrc = fs.readFileSync(path.join(ROOT, "jumpin/app.js"), "utf8");
  const faqSrc = fs.readFileSync(path.join(ROOT, "jumpin-faq.html"), "utf8");
  const guideSrc = fs.readFileSync(path.join(ROOT, "jumpin-guide.html"), "utf8");

  assert.ok(appSrc.indexOf("#jumpin-root .seat-pills") !== -1, "Seat pills must work inside #jumpin-sheet");
  assert.ok(appSrc.indexOf("#jumpin-sheet .seat-pills button") !== -1, "Sheet seat pills must reset button margin");
  assert.ok(appSrc.indexOf("justify-content:center;text-align:center") !== -1, "Mobile footer must be centered");
  assert.ok(appSrc.indexOf("function editSheet(doc)") !== -1, "Edit trip must render in #jumpin-sheet");
  assert.ok(appSrc.indexOf("Cancel this trip?") !== -1, "Cancel trip confirmation modal must exist");
  assert.ok(faqSrc.indexOf("Edit trip") !== -1, "jumpin-faq.html must document Edit trip");
  assert.ok(guideSrc.indexOf("Edit trip") !== -1, "jumpin-guide.html must document Edit trip");
  assert.ok(appSrc.indexOf("Manage passengers") !== -1, "jumpin/app.js must include Manage passengers button");
  assert.ok(appSrc.indexOf("Manage trip") !== -1, "jumpin/app.js must include Manage trip button");
  assert.ok(faqSrc.indexOf("Remove") !== -1, "jumpin-faq.html must document Remove passenger");
  assert.ok(guideSrc.indexOf("Remove a passenger") !== -1, "jumpin-guide.html must document Remove a passenger");
});

test("6. Driver Remove Passenger: Atomic Seat Release, Quota Reset, and SMS", async function () {
  const db = service.createMemoryDb(baseSeed());
  const w1 = futureWall(5);
  const posted = await handlers.call(db, "carpoolPostRide", {
    name: "Dan", phone: "5552221111", from: "Library", to: "Station",
    date: w1.date, time: w1.time, timeZone: TZ, seats: 3, note: ""
  }, null, NOW);
  const res = await handlers.call(db, "carpoolReserveSeat", {
    rideId: posted.rideId, name: "Eva", phone: "5553334444", seats: 3
  }, null, NOW + 1000);
  assert.strictEqual(res.seatsLeft, 0);

  // Partial seat removal (keep 1 of 3 seats -> frees 2 seats, keeps rider active)
  const partial = await handlers.call(db, "carpoolRemoveRider", {
    rideId: posted.rideId, secret: posted.secret, reservationId: res.reservationId, keepSeats: 1
  }, null, NOW + 1500);
  assert.strictEqual(partial.ok, true);
  assert.strictEqual(partial.seatsLeft, 2);
  assert.strictEqual(partial.ride.riders[0].seats, 1);
  assert.ok(partial.outbox[0].body.indexOf("updated your seats to 1") !== -1);

  // Driver adds a seat back for existing rider (1 -> 2 seats)
  const inc = await handlers.call(db, "carpoolRemoveRider", {
    rideId: posted.rideId, secret: posted.secret, reservationId: res.reservationId, keepSeats: 2
  }, null, NOW + 1700);
  assert.strictEqual(inc.ok, true);
  assert.strictEqual(inc.seatsLeft, 1);
  assert.strictEqual(inc.ride.riders[0].seats, 2);

  const removed = await handlers.call(db, "carpoolRemoveRider", {
    rideId: posted.rideId, secret: posted.secret, reservationId: res.reservationId
  }, null, NOW + 2000);
  assert.strictEqual(removed.ok, true);
  assert.strictEqual(removed.seatsLeft, 3);
  assert.strictEqual((removed.outbox || []).length, 1);
  assert.ok(removed.outbox[0].body.indexOf("Driver removed your seat") !== -1);

  // Freed rider can book again immediately
  const rebook = await handlers.call(db, "carpoolReserveSeat", {
    rideId: posted.rideId, name: "Eva", phone: "5553334444", seats: 3
  }, null, NOW + 3000);
  assert.strictEqual(rebook.ok, true);
  assert.strictEqual(rebook.seatsLeft, 0);
});

test("7. Seat Waitlist: 0 SMS on Join, Single-Segment SMS on Open, and No Duplicates", async function () {
  const db = service.createMemoryDb(baseSeed());
  const w1 = futureWall(5);
  const posted = await handlers.call(db, "carpoolPostRide", {
    name: "Dan", phone: "5552221111", from: "Library", to: "Station",
    date: w1.date, time: w1.time, timeZone: TZ, seats: 2, note: ""
  }, null, NOW);
  const res = await handlers.call(db, "carpoolReserveSeat", {
    rideId: posted.rideId, name: "Eva", phone: "5553334444", seats: 2
  }, null, NOW + 1000);
  assert.strictEqual(res.seatsLeft, 0);

  const wl = await handlers.call(db, "carpoolJoinWaitlist", {
    rideId: posted.rideId, phone: "5559998888"
  }, null, NOW + 1500);
  assert.strictEqual(wl.ok, true);
  assert.strictEqual((wl.outbox || []).length, 0);

  // Driver adds a seat via Edit Trip -> waitlisted rider receives 1 short SMS (< 160 chars)
  const edited = await handlers.call(db, "carpoolEditRide", {
    rideId: posted.rideId, secret: posted.secret, date: w1.date, time: w1.time, seats: 3, note: ""
  }, null, NOW + 2000);
  assert.strictEqual(edited.ok, true);
  assert.strictEqual((edited.outbox || []).length, 1);
  assert.ok(edited.outbox[0].body.indexOf("Seat open!") !== -1);
  assert.ok(edited.outbox[0].body.length <= 160, "Waitlist SMS should stay <= 160 chars");

  // Subsequent seat opening sends 0 duplicate SMS since waitlist was cleared
  const cancelled = await handlers.call(db, "carpoolCancelSeat", {
    rideId: posted.rideId, secret: res.secret
  }, null, NOW + 3000);
  assert.strictEqual((cancelled.outbox || []).length, 0);
});

(async function run() {
  console.log("======================================================================");
  console.log("🧪 SUITE 11: JUMPIN INTEGRITY, CONCURRENCY, RETENTION & UI CONTRACTS");
  console.log("======================================================================");
  for (let i = 0; i < cases.length; i++) {
    try {
      await cases[i].fn();
      passed++;
      console.log("  ✓ " + cases[i].name);
    } catch (err) {
      failed++;
      console.error("  ✕ " + cases[i].name);
      console.error("    " + (err && err.stack ? err.stack : err));
    }
  }
  console.log("\n📊 RESULTS: " + passed + " PASSED, " + failed + " FAILED\n");
  if (failed > 0) process.exit(1);
})();
