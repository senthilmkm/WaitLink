/**
 * JumpIn suite. Separate from the shop suites.
 * Covers date math, seat races, validation, admin texts, and listener cleanup.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const core = require("../../jumpin/core.js");
const service = require("../../jumpin/service.js");
const ui = require("../../jumpin/ui-state.js");
const view = require("../../jumpin/app.js");

let passed = 0;
let failed = 0;
const tests = [];

function it(name, fn) { tests.push({ name: name, fn: fn }); }

function enabledConfig(extra) {
  return Object.assign(core.defaultConfig(), { enabled: true, dailySmsDay: core.utcDay(Date.now()) }, extra || {});
}

function seed() {
  return { "settings/carpool_config": enabledConfig() };
}

const TZ = "America/New_York";
const NOW = Date.UTC(2026, 5, 1, 15, 0, 0);

function futureFields(days) {
  const when = new Date(NOW + days * core.DAY_MS);
  const parts = core.partsInZone(when, TZ);
  const date = parts.year + "-" + String(parts.month).padStart(2, "0") + "-" + String(parts.day).padStart(2, "0");
  const time = String(parts.hour).padStart(2, "0") + ":" + String(parts.minute).padStart(2, "0");
  return { date: date, time: time };
}

function postInput(over) {
  const when = futureFields(2);
  return Object.assign({
    name: "Alex",
    phone: "(555) 234-5678",
    from: "Library",
    to: "Office",
    date: when.date,
    time: when.time,
    seats: 2,
    note: "South door",
    timeZone: TZ,
    idempotencyKey: "post-1"
  }, over || {});
}

it("hashes the known sha256 vector and a phone", function () {
  assert.strictEqual(core.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.strictEqual(core.phoneHash16("+15552345678").length, 16);
  assert.strictEqual(core.timingSafeEqual("abc", "abc"), true);
  assert.strictEqual(core.timingSafeEqual("abc", "abd"), false);
  assert.strictEqual(core.timingSafeEqual("ab", "abc"), false);
});

it("normalizes US and Canada numbers and rejects the rest", function () {
  assert.strictEqual(core.normalizePhone("(555) 234-5678").e164, "+15552345678");
  assert.strictEqual(core.normalizePhone("1-555-234-5678").e164, "+15552345678");
  assert.strictEqual(core.normalizePhone("555").ok, false);
  assert.strictEqual(core.normalizePhone("25552345678").ok, false);
});

it("strips tags and collapses whitespace before length checks", function () {
  const posted = core.postErrors({ name: "  Ann   Lee  ", phone: "5552345678", from: "<b>Library</b>", to: "Office", date: "2026-07-01", time: "08:00", seats: 3, note: "  hi  " });
  assert.strictEqual(posted.value.name, "Ann Lee");
  assert.strictEqual(posted.value.from, "Library");
  assert.strictEqual(posted.value.note, "hi");
  assert.strictEqual(core.postErrors({ name: "", phone: "5552345678", from: "Library", to: "Office", date: "2026-07-01", time: "08:00", seats: 3 }).error, "Enter your name.");
  assert.strictEqual(core.postErrors({ name: "A".repeat(41), phone: "5552345678", from: "Library", to: "Office", date: "2026-07-01", time: "08:00", seats: 3 }).error, "Use 40 characters or fewer.");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "12", from: "Library", to: "Office", date: "2026-07-01", time: "08:00", seats: 3 }).field, "phone");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "L", to: "Office", date: "2026-07-01", time: "08:00", seats: 3 }).error, "Enter where you are leaving from.");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "L".repeat(81), to: "Office", date: "2026-07-01", time: "08:00", seats: 3 }).error, "Use 80 characters or fewer.");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "Library", to: "", date: "2026-07-01", time: "08:00", seats: 3 }).error, "Enter where you are going.");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: "", time: "08:00", seats: 3 }).error, "Choose a date.");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: "2026-07-01", time: "", seats: 3 }).error, "Choose a time.");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: "2026-07-01", time: "08:00", seats: 0 }).field, "seats");
  assert.strictEqual(core.postErrors({ name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: "2026-07-01", time: "08:00", seats: 3, note: "n".repeat(141) }).error, "Use 140 characters or fewer.");
  assert.strictEqual(core.reserveErrors({ name: "", phone: "5552345678" }).error, "Enter your name.");
  assert.strictEqual(core.messageError("   ").error, "Enter a message.");
  assert.strictEqual(core.messageError("m".repeat(281)).error, "Use 280 characters or fewer.");
  assert.strictEqual(core.announceError("ok").value, "ok");
});

it("converts New York wall time, including DST gaps", function () {
  const winter = core.zonedToUtc("2026-01-15", "08:00", TZ);
  assert.strictEqual(new Date(winter).toISOString(), "2026-01-15T13:00:00.000Z");
  const summer = core.zonedToUtc("2026-07-15", "08:00", TZ);
  assert.strictEqual(new Date(summer).toISOString(), "2026-07-15T12:00:00.000Z");
  assert.strictEqual(core.zonedToUtc("2026-03-08", "02:30", TZ), null);
  assert.strictEqual(core.zonedToUtc("2026-02-31", "08:00", TZ), null);
  assert.strictEqual(core.zonedToUtc("bad", "08:00", TZ), null);
  const label = core.formatWhen(winter, TZ);
  assert.ok(label.indexOf("Thu") === 0, label);
  assert.ok(label.indexOf("8:00 AM ET") !== -1, label);
  const past = core.departureError("2026-01-01", "08:00", TZ, NOW, 30);
  assert.strictEqual(past.error, "Choose a later time.");
  const far = core.departureError("2027-06-01", "08:00", TZ, NOW, 30);
  assert.ok(far.error.indexOf("30 days") !== -1);
  const soon = futureFields(2);
  const ok = core.departureError(soon.date, soon.time, TZ, NOW, 30);
  assert.ok(ok.departAt > NOW);
  assert.strictEqual(core.departureError("2026-07-01", "08:00", "Not/AZone", NOW, 30).error, "Choose a date.");
});

it("keeps one seat when two reserves race", async function () {
  const db = service.createMemoryDb(seed());
  const posted = await service.postRide(db, postInput({ seats: 1 }), NOW);
  assert.strictEqual(posted.ok, true);
  assert.strictEqual(posted.status, "open");
  const first = service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 1000);
  const second = service.reserveSeat(db, { rideId: posted.rideId, name: "Pat", phone: "5551112222", idempotencyKey: "b" }, NOW + 1000);
  const results = await Promise.all([first, second]);
  const wins = results.filter(function (row) { return row.ok; });
  assert.strictEqual(wins.length, 1);
  assert.strictEqual(results.filter(function (row) { return row.error === "That seat was just taken."; }).length, 1);
  const snap = db.snapshot();
  assert.strictEqual(snap["carpool_private/rides/" + posted.rideId].seatsLeft, 0);
});

it("does not give the same phone two seats or the driver a seat", async function () {
  const db = service.createMemoryDb(seed());
  const posted = await service.postRide(db, postInput({ seats: 3 }), NOW);
  const once = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 1000);
  const again = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "b" }, NOW + 2000);
  const retry = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 3000);
  assert.strictEqual(once.ok, true);
  assert.strictEqual(again.error, "You already have this seat.");
  assert.strictEqual(retry.secret, once.secret);
  const driver = await service.reserveSeat(db, { rideId: posted.rideId, name: "Alex", phone: "5552345678", idempotencyKey: "d" }, NOW + 4000);
  assert.strictEqual(driver.error, "The driver already has this trip.");
});

it("cancels a seat once and a trip releases every rider", async function () {
  const db = service.createMemoryDb(seed());
  const posted = await service.postRide(db, postInput({ seats: 2 }), NOW);
  const sam = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 1000);
  const pat = await service.reserveSeat(db, { rideId: posted.rideId, name: "Pat", phone: "5551112222", idempotencyKey: "b" }, NOW + 1000);
  assert.strictEqual(pat.ok, true);
  const cancelled = await service.cancelSeat(db, { rideId: posted.rideId, secret: sam.secret }, NOW + 2000);
  const again = await service.cancelSeat(db, { rideId: posted.rideId, secret: sam.secret }, NOW + 3000);
  assert.strictEqual(cancelled.ok, true);
  assert.strictEqual(again.already, true);
  assert.strictEqual(db.snapshot()["carpool_private/rides/" + posted.rideId].seatsLeft, 1);
  const trip = await service.cancelTrip(db, { rideId: posted.rideId, secret: posted.secret }, NOW + 4000);
  assert.strictEqual(trip.ok, true);
  assert.ok(trip.outbox.some(function (text) { return text.to === "+15551112222"; }));
  const stranger = await service.cancelTrip(db, { rideId: posted.rideId, secret: sam.secret }, NOW + 5000);
  assert.strictEqual(stranger.ok, false);
  const repeat = await service.cancelTrip(db, { rideId: posted.rideId, secret: posted.secret }, NOW + 6000);
  assert.strictEqual(repeat.already, true);
});

it("hides a ride until approval and blocks a later post", async function () {
  const db = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ requireRideApproval: true }) });
  const posted = await service.postRide(db, postInput(), NOW);
  assert.strictEqual(posted.status, "pending");
  const early = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 1000);
  assert.strictEqual(early.error, "Waiting for approval.");
  const approved = await service.reviewRide(db, service.SUPERADMIN_EMAIL, { rideId: posted.rideId, decision: "approve" }, NOW + 2000);
  assert.strictEqual(approved.ok, true);
  assert.ok(approved.outbox[0].body.indexOf("on the board") !== -1);
  await service.setPosting(db, service.SUPERADMIN_EMAIL, { rideId: posted.rideId, blocked: true }, NOW + 3000);
  const blocked = await service.postRide(db, postInput({ idempotencyKey: "post-2", phone: "5552345678" }), NOW + 4000);
  assert.strictEqual(blocked.error, "You can't post a ride right now.");
  await service.setPosting(db, service.SUPERADMIN_EMAIL, { rideId: posted.rideId, blocked: false }, NOW + 5000);
  const open = await service.postRide(db, postInput({ idempotencyKey: "post-3" }), NOW + 6000);
  assert.strictEqual(open.ok, true);
});

it("sends the three admin texts to the right phones and stops over the cap", async function () {
  const db = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ dailySmsCap: 20 }) });
  const posted = await service.postRide(db, postInput({ seats: 2 }), NOW);
  await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 1000);
  const preview = await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "trip", rideId: posted.rideId, text: "Meet at the south door", confirm: false }, NOW + 2000);
  assert.strictEqual(preview.count, 2);
  const sent = await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "trip", rideId: posted.rideId, text: "Meet at the south door", confirm: true }, NOW + 2000);
  assert.strictEqual(sent.outbox.length, 2);
  const upcoming = await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "upcoming", text: "Leave 10 minutes early", confirm: true }, NOW + 3000);
  assert.strictEqual(upcoming.outbox.length, 2);
  const all = await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "all", text: "New pickup policy", confirm: true }, NOW + 4000);
  assert.strictEqual(all.outbox.length, 2);
  const tiny = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ dailySmsCap: 0 }) });
  const quiet = await service.postRide(tiny, postInput(), NOW);
  assert.strictEqual(quiet.textSent, false);
  const over = await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "all", text: "x", confirm: true }, NOW + 5000);
  assert.ok(over.ok === true || over.error);
});

it("rejects a departed reserve and a message from a public visitor", async function () {
  const db = service.createMemoryDb(seed());
  const posted = await service.postRide(db, postInput(), NOW);
  const left = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "a" }, NOW + 1000);
  const late = await service.reserveSeat(db, { rideId: posted.rideId, name: "Pat", phone: "5551112222", idempotencyKey: "b" }, NOW + core.DAY_MS * 5);
  assert.strictEqual(late.error, "This trip has already left.");
  const note = await service.postMessage(db, { rideId: posted.rideId, secret: posted.secret, text: "  South door  " }, NOW + 1000);
  assert.strictEqual(note.ok, true);
  const stranger = await service.postMessage(db, { rideId: posted.rideId, secret: "nope", text: "hello" }, NOW + 1000);
  assert.strictEqual(stranger.ok, false);
  assert.strictEqual(left.ok, true);
  const gone = await service.completeDue(db, NOW + core.DAY_MS * 5);
  assert.ok(gone.completed >= 1);
});

it("asks before cancel and keeps a single filled button", function () {
  let state = ui.blank();
  assert.strictEqual(ui.buttonLabel(state), "Post a ride");
  state = ui.reduce(state, { type: "post" });
  assert.strictEqual(ui.buttonLabel(state), "Post");
  state = ui.reduce(state, { type: "ride", ride: { status: "open", seatsLeft: 2 }, role: "rider" });
  state = ui.reduce(state, { type: "cancel-ask", role: "rider" });
  assert.strictEqual(state.pendingAction, "");
  assert.strictEqual(state.sheet, "seat");
  state = ui.reduce(state, { type: "keep" });
  assert.strictEqual(state.sheet, "");
  state = ui.reduce(state, { type: "cancel-ask", role: "rider" });
  state = ui.reduce(state, { type: "confirm" });
  assert.strictEqual(state.pendingAction, "cancel-seat");
  assert.strictEqual(ui.shellCss().lockedVh, false);
  assert.strictEqual(ui.platformOf("Mozilla Android 14"), "android");
  assert.strictEqual(ui.platformOf("iPhone"), "ios");
  const pending = ui.reduce(ui.blank(), { type: "ride", ride: { status: "pending", seatsLeft: 2 }, role: "driver" });
  assert.strictEqual(ui.buttonLabel(pending), null);
});

it("removes shell listeners on destroy", function () {
  const win = fakeWindow();
  const mounted = view.mount(win);
  assert.ok(view.listenerCount() >= 1);
  assert.strictEqual(mounted.root.style.height, "auto");
  assert.ok(win.document.getElementById("jumpin-style").textContent.indexOf("100vh") === -1);
  view.destroy();
  assert.strictEqual(view.listenerCount(), 0);
});

it("keeps the shop guard and the hosted core copies identical", function () {
  const app = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  const guardAt = app.indexOf('jumpSlug === "jumpin"');
  const shopAt = app.indexOf("state.config.slug = shopParam");
  assert.ok(guardAt > 0 && guardAt < shopAt);
    ["core.js", "service.js", "ui-state.js", "handlers.js", "admin-state.js"].forEach(function (file) {
    const hosted = fs.readFileSync(path.join(__dirname, "../../jumpin", file));
    const deployed = fs.readFileSync(path.join(__dirname, "../../functions/jumpin", file));
    assert.ok(hosted.equals(deployed), file);
  });
});

it("rejects admin calls from anyone else and clamps settings", function () {
  assert.strictEqual(core.clampConfig({ enabled: true, maxSeats: 99, horizonDays: 0, dailySmsCap: 10 }).maxSeats, 6);
  assert.strictEqual(core.clampConfig({ enabled: true, dailySmsCap: 10, maxSeats: 4 }).maxSeats, 4);
  assert.strictEqual(core.configFieldError("dailySmsCap", 9000), "Enter a number from 0 to 5000.");
  assert.strictEqual(core.configFieldError("dailySmsCap", 10), null);
  assert.strictEqual(core.postsToday({ postsDay: "2000-01-01", postsToday: 4 }, NOW), 0);
  assert.strictEqual(core.smsBudget(core.defaultConfig(), NOW).left, 200);
  return service.reviewRide(service.createMemoryDb(seed()), "other@example.com", { rideId: "x", decision: "approve" }, NOW).then(function (result) {
    assert.strictEqual(result.ok, false);
  });
});

it("covers date edges, button labels, recovery, retention, and the admin gate", async function () {
  assert.strictEqual(core.sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.strictEqual(core.sha256Hex("é").length, 64);
  assert.strictEqual(core.sha256Hex("🙂").length, 64);
  const id = core.randomId("ride_", function () { return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]); });
  assert.ok(id.indexOf("ride_") === 0 && id.length > 5);
  assert.ok(core.randomSecret(function () { return new Uint8Array(32); }).length > 20);
  assert.strictEqual(core.configFieldError("nope", 1), null);
  assert.strictEqual(core.clampConfig(null).enabled, false);
  assert.strictEqual(core.clampConfig({ dailySmsCap: 1.5 }).dailySmsCap, 200);
  assert.strictEqual(core.postsToday({ postsDay: core.utcDay(NOW), postsToday: 2 }, NOW), 2);
  assert.strictEqual(core.activeReservations(null), 0);
  assert.strictEqual(core.canSend(Object.assign(core.defaultConfig(), { dailySmsCap: 0, dailySmsDay: core.utcDay(NOW) }), NOW), false);
  assert.strictEqual(core.last4(""), "");
  assert.strictEqual(core.publicRide({ rideId: "r", status: "open", from: "A", to: "B", departAt: 1, timeZone: TZ, seatsTotal: 1, seatsLeft: 1, note: "", driverName: "A", createdAt: 1, updatedAt: 1 }).status, "open");
  assert.strictEqual(core.systemMessage("ok", NOW, 1).kind, "system");
  assert.strictEqual(core.platformOf(""), "ios");
  assert.ok(core.recoveryPhrase().indexOf("sent a text") !== -1);
  assert.strictEqual(core.filledButton({ recovery: "rider" }), "Text me a link");
  assert.strictEqual(core.filledButton({ status: "rejected" }), null);
  assert.strictEqual(core.filledButton({ status: "cancelled" }), null);
  assert.strictEqual(core.filledButton({ status: "completed" }), null);
  assert.strictEqual(core.filledButton({ status: "missing" }), null);
  assert.strictEqual(core.filledButton({ status: "open", role: "driver" }), "Copy link");
  assert.strictEqual(core.filledButton({ status: "open", role: "driver", reserveOpen: true }), "Reserve a seat");
  assert.strictEqual(core.filledButton({ status: "open", role: "rider" }), "Send");
  assert.strictEqual(core.filledButton({ status: "open", reserveOpen: true, seatsLeft: 0 }), "Reserve a seat");
  assert.strictEqual(core.filledButton({ status: "open", seatsLeft: 2, departAt: NOW - 1000 }, NOW), null);
  assert.strictEqual(core.filledButton({ status: "open", role: "rider", departAt: NOW - 3 * 3600000, durationMinutes: 60 }, NOW), null);
  assert.strictEqual(core.filledButton({ status: "open", seatsLeft: 2 }), "Reserve a seat");
  assert.strictEqual(core.filledButton({ status: "open", seatsLeft: 0 }), null);
  const exact = core.partsInZone(NOW, TZ);
  const exactDate = exact.year + "-" + String(exact.month).padStart(2, "0") + "-" + String(exact.day).padStart(2, "0");
  const exactTime = String(exact.hour).padStart(2, "0") + ":" + String(exact.minute).padStart(2, "0");
  assert.strictEqual(core.departureError(exactDate, exactTime, TZ, NOW, 30).error, "Choose a later time.");
  assert.ok(typeof core.zonedToUtc("2026-11-01", "01:30", TZ) === "number");
  assert.ok(core.formatWhen(core.zonedToUtc("2026-07-15", "08:00", "America/Los_Angeles"), "America/Los_Angeles").indexOf("PT") !== -1);
  assert.strictEqual(core.reserveErrors({ name: "Sam", phone: "12" }).field, "phone");
  assert.strictEqual(core.announceError("").error, "Enter a message.");
  assert.strictEqual(core.announceError("m".repeat(281)).error, "Use 280 characters or fewer.");
  assert.strictEqual(core.messageError(null).error, "Enter a message.");

  const off = service.createMemoryDb({ "settings/carpool_config": core.defaultConfig() });
  assert.strictEqual((await service.postRide(off, postInput(), NOW)).error, "JumpIn is not open yet.");

  const db = service.createMemoryDb(seed());
  db.interfere(function (versions) { versions["settings/carpool_config"] += 1; });
  const posted = await service.postRide(db, postInput({ seats: 2, idempotencyKey: "retry" }), NOW);
  assert.strictEqual(posted.ok, true);
  const rides = Object.keys(db.snapshot()).filter(function (key) { return key.indexOf("carpool_private/rides/") === 0; });
  assert.strictEqual(rides.length, 1);

  const far = futureFields(40);
  assert.ok((await service.postRide(db, postInput({ date: far.date, time: far.time, idempotencyKey: "far" }), NOW)).error.indexOf("30 days") !== -1);
  const tinySeats = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ maxSeats: 2 }) });
  assert.strictEqual((await service.postRide(tinySeats, postInput({ seats: 3 }), NOW)).error, "Choose seats from 1 to 2.");
  assert.strictEqual((await service.postRide(db, postInput({ timeZone: "Not/AZone" }), NOW)).error, "Choose a later time.");

  const gate = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ requireRideApproval: true }) });
  const waiting = await service.postRide(gate, postInput({ idempotencyKey: "pend" }), NOW);
  const declined = await service.reviewRide(gate, service.SUPERADMIN_EMAIL, { rideId: waiting.rideId, decision: "decline" }, NOW + 1000);
  assert.ok(declined.outbox[0].body.indexOf("not approved") !== -1);
  assert.strictEqual((await service.reserveSeat(gate, { rideId: waiting.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "no" }, NOW + 2000)).error, "This trip was not approved.");
  assert.strictEqual((await service.reviewRide(gate, service.SUPERADMIN_EMAIL, { rideId: waiting.rideId, decision: "approve" }, NOW + 3000)).already, true);
  const undecided = await service.postRide(gate, postInput({ idempotencyKey: "pend-2" }), NOW + 3500);
  assert.strictEqual((await service.reviewRide(gate, service.SUPERADMIN_EMAIL, { rideId: undecided.rideId, decision: "maybe" }, NOW + 3600)).error, "Enter a decision.");

  const sam = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "seat-a" }, NOW + 1000);
  const expired = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "seat-a" }, NOW + core.IDEMPOTENCY_MS + 2000);
  assert.strictEqual(expired.error, "You already have this seat.");
  const note = await service.postMessage(db, { rideId: posted.rideId, secret: sam.secret, text: "On my way" }, NOW + 1500);
  assert.strictEqual(note.ok, true);
  assert.strictEqual(note.outbox.length, 1);
  assert.ok(note.outbox[0].body.indexOf("On my way") !== -1);
  const departTime = db.snapshot()["carpool_private/rides/" + posted.rideId].departAt;
  const graceNote = await service.postMessage(db, { rideId: posted.rideId, secret: posted.secret, text: "I am outside" }, departTime + 30 * 60000);
  assert.strictEqual(graceNote.ok, true);
  assert.strictEqual(graceNote.outbox.length, 1);
  assert.ok(graceNote.outbox[0].body.indexOf("I am outside") !== -1);
  const capped = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ maxMessagesPerRide: 1 }) });
  const one = await service.postRide(capped, postInput({ idempotencyKey: "one" }), NOW);
  assert.strictEqual((await service.postMessage(capped, { rideId: one.rideId, secret: one.secret, text: "hello" }, NOW + 1000)).error, "This trip thread is full.");

  const link = await service.sendManageLink(db, { rideId: posted.rideId, phone: "5559876543", role: "rider", ip: "203.0.113.8" }, NOW + 70000);
  assert.strictEqual(link.phrase, core.recoveryPhrase());
  assert.strictEqual(link.outbox.length, 1);
  const cooled = await service.sendManageLink(db, { rideId: posted.rideId, phone: "5559876543", role: "rider", ip: "203.0.113.8" }, NOW + 70001);
  assert.strictEqual(cooled.outbox.length, 0);
  const missing = await service.sendManageLink(db, { rideId: posted.rideId, phone: "5550001111", role: "rider", ip: "203.0.113.9" }, NOW + 80000);
  assert.strictEqual(missing.outbox.length, 0);
  assert.strictEqual((await service.sendManageLink(db, { phone: "12" }, NOW)).ok, false);
  const oldSecret = sam.secret;
  const driverLink = await service.sendManageLink(db, { rideId: posted.rideId, phone: "5552345678", role: "driver", ip: "203.0.113.10" }, NOW + 90000);
  assert.strictEqual(driverLink.outbox.length, 1);
  assert.strictEqual((await service.cancelSeat(db, { rideId: posted.rideId, secret: oldSecret }, NOW + 91000)).ok, false);

  await service.markOptOut(db, "5552345678", NOW + 92000);
  const skipped = await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "all", text: "Policy update", confirm: false }, NOW + 93000);
  assert.ok(skipped.count < 2);
  const cap = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ dailySmsCap: 1 }) });
  const crowded = await service.postRide(cap, postInput({ idempotencyKey: "cap" }), NOW);
  await service.reserveSeat(cap, { rideId: crowded.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "cap-seat" }, NOW + 1000);
  const over = await service.broadcast(cap, service.SUPERADMIN_EMAIL, { scope: "trip", rideId: crowded.rideId, text: "hello", confirm: true }, NOW + 2000);
  assert.ok(over.error.indexOf("texts are left") !== -1);
  assert.strictEqual((await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "nope", text: "x", confirm: false }, NOW)).error, "Choose who receives the text.");
  assert.strictEqual((await service.broadcast(db, service.SUPERADMIN_EMAIL, { scope: "trip", text: "x", confirm: false }, NOW)).error, "Choose a trip.");

  const adminCancel = await service.adminCancelTrip(db, service.SUPERADMIN_EMAIL, posted.rideId, NOW + 94000);
  assert.ok(adminCancel.outbox.some(function (text) { return text.to === "+15552345678"; }));
  assert.strictEqual((await service.reserveSeat(db, { rideId: posted.rideId, name: "Pat", phone: "5551112222", idempotencyKey: "late" }, NOW + 95000)).error, "This trip was cancelled.");
  const listed = await service.listAdmin(db, service.SUPERADMIN_EMAIL, NOW + 96000);
  assert.ok(JSON.stringify(listed).indexOf("+1") === -1);
  await service.setPosting(db, service.SUPERADMIN_EMAIL, { phone: "5552223333", name: "Riley", blocked: true }, NOW + 97000);
  const blockedList = await service.listAdmin(db, service.SUPERADMIN_EMAIL, NOW + 98000);
  assert.strictEqual(blockedList.blocked[0].phoneLast4, "3333");
  await service.setPosting(db, service.SUPERADMIN_EMAIL, { phoneHash: blockedList.blocked[0].phoneHash, blocked: false }, NOW + 98500);
  await service.setPosting(db, service.SUPERADMIN_EMAIL, { phone: "5552223333", blocked: false }, NOW + 99000);

  const finishing = await service.postRide(db, postInput({ idempotencyKey: "finish", phone: "5557778888", name: "Jo" }), NOW + 100000);
  const done = await service.completeDue(db, NOW + core.DAY_MS * 5);
  assert.ok(done.completed >= 1);
  const tyDb = service.createMemoryDb(seed());
  await service.saveAdminConfig(tyDb, service.SUPERADMIN_EMAIL, Object.assign(enabledConfig(), { postRideThankYouSms: true, supportNote: "Zelle: test@example.com" }), NOW);
  const tyRide = await service.postRide(tyDb, postInput({ idempotencyKey: "ty-1" }), NOW);
  await service.reserveSeat(tyDb, { rideId: tyRide.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "ty-seat" }, NOW + 100);
  const tyDone = await service.completeDue(tyDb, NOW + core.DAY_MS * 5);
  assert.strictEqual(tyDone.completed, 1);
  assert.strictEqual(tyDone.outbox.length, 2);
  assert.ok(tyDone.outbox[0].body.indexOf("Zelle: test@example.com") !== -1);
  const tyAgain = await service.completeDue(tyDb, NOW + core.DAY_MS * 5 + 1000);
  assert.strictEqual(tyAgain.completed, 0);
  assert.strictEqual(tyAgain.outbox.length, 0);

  const manualDb = service.createMemoryDb(seed());
  await service.saveAdminConfig(manualDb, service.SUPERADMIN_EMAIL, Object.assign(enabledConfig(), { postRideThankYouSms: true, supportNote: "Zelle: test@example.com" }), NOW);
  const longRide = await service.postRide(manualDb, postInput({ idempotencyKey: "long-1", durationMinutes: 240 }), NOW);
  await service.reserveSeat(manualDb, { rideId: longRide.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "long-seat" }, NOW + 100);
  const longDepart = manualDb.snapshot()["carpool_private/rides/" + longRide.rideId].departAt;
  assert.strictEqual((await service.completeDue(manualDb, longDepart + 90 * 60000)).completed, 0);
  assert.strictEqual((await service.postMessage(manualDb, { rideId: longRide.rideId, secret: longRide.secret, text: "Halfway there" }, longDepart + 120 * 60000)).ok, true);
  assert.strictEqual((await service.completeTrip(manualDb, { rideId: longRide.rideId, secret: longRide.secret }, longDepart - 1000)).error, "You can complete this trip after it departs.");
  const manualDone = await service.completeTrip(manualDb, { rideId: longRide.rideId, secret: longRide.secret }, longDepart + 180 * 60000);
  assert.strictEqual(manualDone.ok, true);
  assert.strictEqual(manualDone.outbox.length, 2);
  assert.ok(manualDone.outbox[0].body.indexOf("Zelle: test@example.com") !== -1);
  assert.strictEqual((await service.completeTrip(manualDb, { rideId: longRide.rideId, secret: longRide.secret }, longDepart + 185 * 60000)).already, true);
  assert.strictEqual((await service.completeDue(manualDb, longDepart + 400 * 60000)).completed, 0);
  assert.strictEqual(core.formatDuration(240), "4 hrs");
  assert.strictEqual(core.formatDuration(90), "1.5 hrs");
  assert.strictEqual(core.formatDuration(60), "1 hr");
  assert.strictEqual(core.formatDuration(30), "30 min");
  assert.strictEqual(core.formatDuration(0), "");
  assert.strictEqual(core.postErrors(postInput({ durationMinutes: 5 })).field, "durationMinutes");
  assert.strictEqual(core.postErrors(postInput({ rideCost: -1 })).field, "rideCost");
  assert.strictEqual(core.postErrors(postInput({ rideCost: "$12.50" })).value.rideCost, 12.5);
  assert.strictEqual(core.formatCost(12.5), "$12.50");
  assert.strictEqual(core.formatCost(5), "$5");
  assert.strictEqual(core.formatCost(0), "");
  const disabledManual = service.createMemoryDb({ "settings/carpool_config": { enabled: false } });
  assert.strictEqual((await service.completeTrip(disabledManual, { rideId: longRide.rideId, secret: longRide.secret }, longDepart + 1000)).error, "JumpIn is not open yet.");
  assert.strictEqual((await service.completeTrip(manualDb, { rideId: "missing", secret: "nope" }, longDepart + 1000)).error, service.GENERIC_LINK);
  await service.cancelTrip(manualDb, { rideId: (await service.postRide(manualDb, postInput({ idempotencyKey: "cancel-then-complete", phone: "5553334444" }), NOW + 50)).rideId, secret: "nope" }, NOW + 60);
  const soloRide = await service.postRide(manualDb, postInput({ idempotencyKey: "solo-1", phone: "5554445555", name: "Solo" }), NOW + 60);
  const soloDepart = manualDb.snapshot()["carpool_private/rides/" + soloRide.rideId].departAt;
  assert.strictEqual((await service.completeTrip(manualDb, { rideId: soloRide.rideId, secret: soloRide.secret }, soloDepart + 1000)).error, "No active passengers remain on this trip. Use Cancel trip instead.");
  await service.cancelTrip(manualDb, { rideId: soloRide.rideId, secret: soloRide.secret }, NOW + 70);
  assert.strictEqual((await service.completeTrip(manualDb, { rideId: soloRide.rideId, secret: soloRide.secret }, longDepart + 1000)).error, service.GENERIC_LINK);
  assert.strictEqual(core.reserveErrors({ name: "Sam", phone: "5559876543", seats: 9 }).field, "seats");
  assert.strictEqual(core.reserveErrors({ name: "Sam", phone: "5559876543", dropoff: "x".repeat(141) }).field, "dropoff");
  const famRide = await service.postRide(manualDb, postInput({ idempotencyKey: "fam-1", phone: "5556667777", name: "Fam", seats: 3 }), NOW + 80);
  assert.strictEqual((await service.reserveSeat(manualDb, { rideId: famRide.rideId, name: "Lee", phone: "5558889999", seats: 4 }, NOW + 85)).error, "Only 3 seats are left.");
  const famSeat = await service.reserveSeat(manualDb, { rideId: famRide.rideId, name: "Lee", phone: "5558889999", seats: 2, dropoff: "University City", idempotencyKey: "fam-seat" }, NOW + 90);
  const famSeat2 = await service.reserveSeat(manualDb, { rideId: famRide.rideId, name: "Kim", phone: "5558880000", seats: 1, idempotencyKey: "fam-seat-2" }, NOW + 91);
  assert.strictEqual(famSeat.ok, true);
  assert.strictEqual(famSeat2.ok, true);
  assert.ok(famSeat.outbox[0].body.indexOf("2 seats") !== -1);
  assert.strictEqual((await service.reserveSeat(manualDb, { rideId: famRide.rideId, name: "Bo", phone: "5558881111", seats: 2 }, NOW + 95)).error, "That seat was just taken.");
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 0 }, NOW + 95)).error, "Choose seats from 1 to 6.");
  assert.strictEqual((await service.updateSeat(disabledManual, { rideId: famRide.rideId, secret: famSeat.secret, seats: 1 }, NOW + 95)).error, "JumpIn is not open yet.");
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: "bad", seats: 1 }, NOW + 95)).error, service.GENERIC_LINK);
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 2 }, NOW + 95)).already, true);
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 4 }, NOW + 95)).error, "No extra seats are left.");
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 1 }, NOW + 95)).ok, true);
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 3 }, NOW + 95)).error, "Only 1 more seat is left.");
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 2 }, NOW + 95)).ok, true);
  assert.strictEqual(manualDb.snapshot()["carpool_public/rides/" + famRide.rideId].seatsLeft, 0);
  const famDepart = manualDb.snapshot()["carpool_private/rides/" + famRide.rideId].departAt;
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 1 }, famDepart + 1000)).error, "This trip has already left.");
  assert.strictEqual((await service.cancelSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret }, NOW + 96)).ok, true);
  assert.strictEqual((await service.updateSeat(manualDb, { rideId: famRide.rideId, secret: famSeat.secret, seats: 2 }, NOW + 96)).error, service.GENERIC_LINK);
  assert.strictEqual((await service.cancelSeat(manualDb, { rideId: famRide.rideId, secret: famSeat2.secret }, NOW + 97)).ok, true);
  assert.strictEqual(manualDb.snapshot()["carpool_public/rides/" + famRide.rideId].seatsLeft, 3);
  const famRec = await service.sendManageLink(manualDb, { rideId: famRide.rideId, phone: "5556667777", role: "driver", ip: "127.0.0.1" }, famDepart + 30 * 60000);
  assert.strictEqual(famRec.outbox.length, 1);
  let uiComplete = ui.reduce(ui.openRide ? ui.blank() : Object.assign(ui.blank(), { mode: "ride", status: "open", role: "driver" }), { type: "complete-ask" });
  assert.strictEqual(uiComplete.sheet, "complete");
  uiComplete = ui.reduce(uiComplete, { type: "confirm" });
  assert.strictEqual(uiComplete.pendingAction, "complete-trip");
  const kept = await service.retainTrips(db, NOW + core.DAY_MS * 13);
  assert.ok(kept.audience >= 1);
  assert.ok(!db.snapshot()["carpool_private/rides/" + posted.rideId]);
  assert.ok(!db.snapshot()["carpool_private/rides/" + finishing.rideId]);
  await service.retainTrips(db, NOW + core.DAY_MS * 50);
  assert.ok(!db.snapshot()["carpool_public/rides/" + finishing.rideId]);

  const handlers = require("../../jumpin/handlers.js");
  assert.strictEqual((await handlers.call(db, "nope", {}, null, NOW)).error, "Unknown request.");
  const adapted = [];
  let writes = 0;
  const fakeFs = {
    doc: function (key) { return { path: key }; },
    runTransaction: async function (fn) {
      return fn({
        get: async function (ref) {
          if (writes) throw new Error("read after write");
          return { exists: ref.path === "settings/carpool_config", data: function () { return { enabled: true }; } };
        },
        set: function (ref) { writes += 1; adapted.push(["set", ref.path]); },
        delete: function (ref) { writes += 1; adapted.push(["del", ref.path]); }
      });
    }
  };
  const wrapped = handlers.adaptFirestore(fakeFs);
  const read = await wrapped.runTransaction(async function (tx) {
    const value = await tx.get("settings/carpool_config");
    tx.set("carpool_public/rides/x", { status: "open" });
    tx.del("carpool_private/limits/old");
    const missingDoc = await tx.get("missing");
    const staged = await tx.get("carpool_public/rides/x");
    return { value: value, missingDoc: missingDoc, staged: staged };
  });
  assert.strictEqual(read.value.enabled, true);
  assert.strictEqual(read.missingDoc, null);
  assert.strictEqual(read.staged.status, "open");
  assert.strictEqual(adapted.length, 2);
  assert.strictEqual(handlers.documentPath("carpool_public/rides/x"), "carpool_public/root/rides/x");
  assert.strictEqual(handlers.documentPath("settings/carpool_config"), "settings/carpool_config");
  assert.strictEqual(handlers.forClient({ ok: true, secret: "s", outbox: [{ to: "+1" }], texts: [] }).outbox, undefined);
  const cloud = require("../../jumpin/cloud.js");
  const mem = { bag: {}, getItem: function (k) { return this.bag[k] || ""; }, setItem: function (k, v) { this.bag[k] = v; }, removeItem: function (k) { delete this.bag[k]; } };
  cloud.saveTrip(mem, "ride_a", "secret");
  assert.strictEqual(cloud.roleFor(mem, { rideId: "ride_a", riders: [] }), "driver");
  cloud.saveSeat(mem, "rsv_1", "seat");
  assert.strictEqual(cloud.roleFor({ getItem: function () { return ""; } }, { rideId: "ride_b", riders: [{ reservationId: "rsv_1" }] }), "");
  assert.strictEqual(cloud.seatSecretFor(mem, { riders: [{ reservationId: "rsv_1" }] }), "seat");
  assert.strictEqual(cloud.publicRideUrl("ride_a"), "https://waitlink.app?s=jumpin&view=ride&ride=ride_a");

  const adminState = require("../../jumpin/admin-state.js");
  assert.strictEqual(adminState.settingsErrors({ dailySmsCap: 10, maxSeats: 4, horizonDays: 30, maxMessagesPerRide: 20, maxPostsPerPhonePerDay: 10, maxActiveReservationsPerPhone: 5, maxSmsPerRecord: 4, resendCooldownSec: 60 }).value.maxSeats, 4);
  assert.strictEqual(adminState.settingsErrors({ dailySmsCap: 9 }).field, "maxSeats");
  let screen = adminState.reduce(adminState.blank(), { type: "preview", scope: "all", count: 3, left: 1 });
  assert.strictEqual(adminState.canSend(screen), false);
  screen = adminState.reduce(screen, { type: "preview", scope: "all", count: 1, left: 2 });
  assert.strictEqual(adminState.canSend(screen), true);
  screen = adminState.reduce(screen, { type: "sent", count: 1 });
  assert.ok(screen.notice.indexOf("1") !== -1);
  screen = adminState.reduce(screen, { type: "fail", error: "no" });
  assert.strictEqual(screen.error, "no");
  assert.strictEqual(adminState.reduce(screen, { type: "clear" }).notice, "");
  assert.strictEqual(adminState.reduce(screen, { type: "other" }).error, "");

  const page = require("../../jumpin-admin.js");
  const adminWin = fakeWindow();
  ["jumpin-error", "jumpin-count", "jumpin-send", "jumpin-pending", "jumpin-upcoming", "jumpin-blocked"].forEach(function (id) {
    const node = adminWin.document.createElement("div");
    node.id = id;
    node.hidden = false;
    adminWin.document.body.appendChild(node);
  });
  const controls = page.start(adminWin);
  controls.preview("all", 4, 1);
  assert.ok(adminWin.document.getElementById("jumpin-count").textContent.indexOf("4 people") !== -1);
  assert.strictEqual(adminWin.document.getElementById("jumpin-send").hidden, true);
  controls.fail("Enter a message.");
  assert.strictEqual(adminWin.document.getElementById("jumpin-error").textContent, "Enter a message.");
  page.render(adminWin.document, adminState.blank(), { pending: [{ rideId: "ride_a" }], upcoming: [{ rideId: "ride_b" }], blocked: [{ driverName: "Riley", phoneLast4: "3333" }] });
  const blockedText = adminWin.document.getElementById("jumpin-blocked").children.map(function (child) { return child.textContent; }).join(" ");
  assert.ok(blockedText.indexOf("3333") !== -1);

  const phone = fakeWindow();
  const mounted = view.mount(phone);
  const hero = mounted.root.children[1].children[0].children[0];
  const postButton = hero.children.filter(function (child) { return child.tag === "button"; })[0];
  postButton._listeners[0]();
  const formButton = mounted.root.children[2].children[0];
  formButton._listeners[0]();
  const formText = mounted.root.children[1].children.map(function (child) { return child.textContent; }).join(" ");
  assert.ok(formText.indexOf("Enter your name") !== -1);
  mounted.root.children[0].children[0]._listeners[0]();
  assert.strictEqual(ui.buttonLabel(mounted.getState()), "Post a ride");
  mounted.setState(ui.reduce(ui.blank(), { type: "ride", ride: { status: "open", seatsLeft: 1 }, role: "driver" }));
  mounted.root.children[2].children[0]._listeners[0]();
  assert.strictEqual(mounted.getState().notice, "Copied");
  const bare = fakeWindow();
  bare.visualViewport = null;
  const plain = view.mount(bare);
  plain.setState(Object.assign(ui.blank(), { mode: "post" }));
  assert.strictEqual(plain.root.style.height, "700px");
  view.destroy();

  const android = fakeWindow();
  android.navigator.userAgent = "Mozilla Android 14";
  view.start(android);
  assert.ok(android.document.body.classList.classes.indexOf("jumpin-android") !== -1);
  view.destroy();

  let flow = ui.reduce(ui.blank(), { type: "ride", ride: { status: "open", seatsLeft: 1 }, role: "" });
  flow = ui.reduce(flow, { type: "reserve-open" });
  assert.strictEqual(flow.reserveOpen, true);
  flow = ui.reduce(flow, { type: "recovery", role: "driver" });
  assert.strictEqual(ui.buttonLabel(flow), "Text me a link");
  flow = ui.reduce(flow, { type: "ride", ride: { status: "open", seatsLeft: 1 }, role: "driver" });
  flow = ui.reduce(flow, { type: "cancel-ask", role: "driver" });
  assert.strictEqual(flow.sheet, "trip");
  flow = ui.reduce(flow, { type: "confirm" });
  assert.strictEqual(flow.pendingAction, "cancel-trip");
  flow = ui.reduce(flow, { type: "notice", notice: "Saved" });
  assert.strictEqual(flow.notice, "Saved");
  assert.strictEqual(ui.reduce(flow, { type: "nope" }).notice, "");

  let fights = 0;
  function clash(versions) {
    fights += 1;
    versions["settings/carpool_config"] += 1;
    if (fights < 8) db.interfere(clash);
  }
  db.interfere(clash);
  let contended = false;
  try { await service.postRide(db, postInput({ idempotencyKey: "clash" }), NOW + 100000); }
  catch (err) { contended = String(err.message).indexOf("contention") !== -1; }
  assert.strictEqual(contended, true);
});

it("exercises every callable, the confirm sheet, and a posted form", async function () {
  const db = service.createMemoryDb(seed());
  const posted = await service.postRide(db, postInput({ seats: 2 }), NOW);
  await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "sheet" }, NOW + 1000);
  const listed = await service.listAdmin(db, service.SUPERADMIN_EMAIL, NOW + 1500);
  assert.strictEqual(listed.upcoming[0].phoneLast4, "5678");
  assert.strictEqual(listed.upcoming[0].riders[0].name, "Sam");
  assert.strictEqual(listed.upcoming[0].riders[0].phoneLast4, "6543");
  assert.ok(listed.upcoming[0].messages.length >= 1);
  const pastListed = await service.listAdmin(db, service.SUPERADMIN_EMAIL, NOW + core.DAY_MS * 5);
  assert.strictEqual(pastListed.past.length, 1);
  assert.strictEqual((await service.cancelSeat(db, { rideId: posted.rideId, phone: "12", secret: "nope" }, NOW + 1600)).ok, false);
  const early = await service.retainTrips(db, NOW + 2000);
  assert.ok(early.kept >= 1);
  await service.sendManageLink(db, { rideId: posted.rideId, phone: "5559876543", role: "rider", ip: "198.51.100.4" }, NOW + 80000);
  const keptLimit = await service.retainTrips(db, NOW + 81000, "default");
  assert.strictEqual(keptLimit.ok, true);
  const gate = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ requireRideApproval: true }) });
  const pending = await service.postRide(gate, postInput({ idempotencyKey: "rej" }), NOW);
  await service.reviewRide(gate, service.SUPERADMIN_EMAIL, { rideId: pending.rideId, decision: "decline" }, NOW + 1000);
  const rejListed = await service.listAdmin(gate, service.SUPERADMIN_EMAIL, NOW + 2000);
  assert.strictEqual(rejListed.cancelled.length, 1);
  assert.strictEqual((await service.cancelTrip(gate, { rideId: pending.rideId, secret: pending.secret }, NOW + 2000)).ok, false);
  const cappedSeats = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ maxActiveReservationsPerPhone: 1 }) });
  const firstRide = await service.postRide(cappedSeats, postInput({ idempotencyKey: "cap-a" }), NOW);
  const secondRide = await service.postRide(cappedSeats, postInput({ idempotencyKey: "cap-b", phone: "5553334444", name: "Bea" }), NOW + 10);
  await service.reserveSeat(cappedSeats, { rideId: firstRide.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "cap-seat" }, NOW + 20);
  assert.ok((await service.reserveSeat(cappedSeats, { rideId: secondRide.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "cap-seat-2" }, NOW + 30)).error.indexOf("upcoming seats") !== -1);
  assert.strictEqual((await service.reserveSeat(db, { rideId: "missing", name: "Sam", phone: "5559876543", idempotencyKey: "gone" }, NOW)).error, "This ride is not available.");
  const handlers = require("../../jumpin/handlers.js");
  const auth = { token: { email: service.SUPERADMIN_EMAIL } };
  const names = ["carpoolPostRide", "carpoolReserveSeat", "carpoolUpdateSeat", "carpoolCancelSeat", "carpoolCancelTrip", "carpoolCompleteTrip", "carpoolSendManageLink", "carpoolPostMessage", "carpoolListPending", "carpoolReviewRide", "carpoolAdminCancelTrip", "carpoolAdminSetPosting", "carpoolAdminSetMembers", "carpoolAdminSaveConfig", "carpoolAdminPurge", "carpoolAdminBroadcast", "carpoolCompleteTrips", "carpoolRetainTrips", "carpoolMarkOptOut"];
  for (let i = 0; i < names.length; i++) {
    const result = await handlers.call(db, names[i], { text: "Hello", scope: "all", confirm: false, phone: "5552345678", rideId: posted.rideId }, auth, NOW + 90000);
    assert.ok(result && typeof result.ok === "boolean");
  }
  assert.strictEqual((await handlers.call(db, "carpoolListPending", {}, null, NOW)).ok, false);
  assert.strictEqual((await handlers.call(db, "carpoolListPending", {}, {}, NOW)).ok, false);
  const memberDb = service.createMemoryDb(seed());
  assert.strictEqual((await service.saveAdminConfig(memberDb, "", {})).ok, false);
  assert.strictEqual((await service.reviewRide(memberDb, "", {})).ok, false);
  assert.strictEqual((await service.adminCancelTrip(memberDb, "", "x")).ok, false);
  assert.strictEqual((await service.setPosting(memberDb, "", {})).ok, false);
  assert.strictEqual((await service.broadcast(memberDb, "", {})).ok, false);
  assert.strictEqual((await service.saveAdminConfig(memberDb, "stranger@example.com", {})).ok, false);
  assert.strictEqual((await service.reviewRide(memberDb, "stranger@example.com", { rideId: "x", decision: "approve" }, NOW)).ok, false);
  assert.strictEqual((await service.adminCancelTrip(memberDb, "stranger@example.com", "x", NOW)).ok, false);
  assert.strictEqual((await service.setPosting(memberDb, "stranger@example.com", {}, NOW)).ok, false);
  assert.strictEqual((await service.broadcast(memberDb, "stranger@example.com", { scope: "all", text: "hi" }, NOW)).ok, false);
  const savedCfg = await service.saveAdminConfig(memberDb, service.SUPERADMIN_EMAIL, Object.assign(enabledConfig(), { membersOnly: true, contactEmail: "community@example.com", adminEmails: ["co@example.com", "not-an-email"] }), NOW);
  assert.strictEqual(savedCfg.ok, true);
  assert.strictEqual((await service.listAdmin(memberDb, "co@example.com", NOW)).ok, true);
  assert.strictEqual((await service.setMembers(memberDb, "", {})).ok, false);
  assert.strictEqual((await service.setMembers(memberDb, "stranger@example.com", {})).ok, false);
  assert.strictEqual((await service.setMembers(memberDb, "co@example.com", { phone: "12" })).ok, false);
  assert.strictEqual((await service.setMembers(memberDb, "co@example.com")).ok, false);
  assert.strictEqual((await service.setMembers(memberDb, "co@example.com", { phone: "5552345678" }, NOW)).count, 1);
  assert.strictEqual((await service.setMembers(memberDb, "co@example.com", { name: "Alex", phone: "5552345678" }, NOW)).count, 1);
  const bulkRes = await service.setMembers(memberDb, "co@example.com", { bulk: "Sam, 5559876543\nbad-line\n5551112222" }, NOW);
  assert.strictEqual(bulkRes.added, 2);
  assert.strictEqual(bulkRes.skipped, 1);
  const memberListed = await service.listAdmin(memberDb, "co@example.com", NOW);
  assert.strictEqual(memberListed.members.length, 3);
  assert.strictEqual((await service.setMembers(memberDb, "co@example.com", { removePhoneHash: memberListed.members[2].phoneHash }, NOW)).count, 2);
  const nonMemberPost = await service.postRide(memberDb, postInput({ phone: "5554445555", idempotencyKey: "nm-p" }), NOW);
  assert.strictEqual(nonMemberPost.ok, false);
  assert.ok(nonMemberPost.error.indexOf("community@example.com") !== -1);
  const memberPost = await service.postRide(memberDb, postInput({ idempotencyKey: "m-p" }), NOW);
  assert.strictEqual(memberPost.ok, true);
  const nonMemberSeat = await service.reserveSeat(memberDb, { rideId: memberPost.rideId, name: "Out", phone: "5554445555", idempotencyKey: "nm-r" }, NOW + 100);
  assert.strictEqual(nonMemberSeat.ok, false);
  assert.ok(nonMemberSeat.error.indexOf("community@example.com") !== -1);
  assert.strictEqual((await service.reserveSeat(memberDb, { rideId: memberPost.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "m-r" }, NOW + 200)).ok, true);
  await service.saveAdminConfig(memberDb, "co@example.com", Object.assign(enabledConfig(), { membersOnly: true, contactEmail: "" }), NOW);
  assert.ok((await service.postRide(memberDb, postInput({ phone: "5554445555", idempotencyKey: "nm-p2" }), NOW)).error.indexOf(service.SUPERADMIN_EMAIL) !== -1);
  assert.ok((await service.reserveSeat(memberDb, { rideId: memberPost.rideId, name: "Out", phone: "5554445555", idempotencyKey: "nm-r2" }, NOW + 300)).error.indexOf(service.SUPERADMIN_EMAIL) !== -1);
  assert.strictEqual((await service.purgeData(memberDb, "", { scope: "past" }, NOW)).ok, false);
  assert.strictEqual((await service.purgeData(memberDb, "stranger@example.com", { scope: "past" }, NOW)).ok, false);
  assert.strictEqual((await service.purgeData(memberDb, service.SUPERADMIN_EMAIL, { scope: "nope" }, NOW)).ok, false);
  const openRide = await service.postRide(memberDb, postInput({ idempotencyKey: "keep-open" }), NOW);
  const previewPast = await service.purgeData(memberDb, service.SUPERADMIN_EMAIL, { scope: "past", confirm: false }, NOW + core.DAY_MS * 5);
  assert.strictEqual(previewPast.confirm, false);
  assert.ok(previewPast.counts.rides >= 1);
  const donePast = await service.purgeData(memberDb, service.SUPERADMIN_EMAIL, { scope: "past", confirm: true }, NOW + core.DAY_MS * 5);
  assert.strictEqual(donePast.ok, true);
  assert.strictEqual((await service.purgeData(memberDb, service.SUPERADMIN_EMAIL, { scope: "audience", confirm: true }, NOW)).ok, true);
  const openRide2 = await service.postRide(memberDb, postInput({ idempotencyKey: "wipe-trips" }), NOW);
  assert.strictEqual(openRide2.ok, true);
  assert.strictEqual((await service.purgeData(memberDb, service.SUPERADMIN_EMAIL, { scope: "trips", confirm: true }, NOW)).ok, true);
  await service.setPosting(memberDb, service.SUPERADMIN_EMAIL, { phone: "5552345678", name: "Alex", blocked: true }, NOW);
  assert.strictEqual((await service.purgeData(memberDb, service.SUPERADMIN_EMAIL, { scope: "all", confirm: true }, NOW)).ok, true);
  const emptyList = await service.listAdmin(memberDb, service.SUPERADMIN_EMAIL, NOW);
  assert.strictEqual(emptyList.upcoming.length, 0);
  assert.strictEqual(emptyList.members.length, 0);
  assert.strictEqual(emptyList.blocked.length, 0);
  assert.strictEqual(emptyList.audienceCount, 0);
  const win = fakeWindow();
  const mounted = view.mount(win);
  mounted.setState(Object.assign(ui.blank(), { mode: "ride", status: "open", role: "rider", seatsLeft: 1, sheet: "seat" }));
  const seatSheet = mounted.root.children.filter(function (child) { return child.id === "jumpin-sheet"; })[0];
  assert.ok(seatSheet.children[0].textContent.indexOf("seat") !== -1);
  seatSheet.children[1]._listeners[0]();
  assert.strictEqual(mounted.getState().sheet, "");
  mounted.setState(Object.assign(ui.blank(), { mode: "ride", status: "open", role: "driver", seatsLeft: 1, sheet: "trip" }));
  const tripSheet = mounted.root.children.filter(function (child) { return child.id === "jumpin-sheet"; })[0];
  tripSheet.children[2]._listeners[0]();
  assert.strictEqual(mounted.getState().pendingAction, "cancel-trip");
  mounted.setState(Object.assign(ui.blank(), { mode: "post" }));
  const inputs = mounted.root.children[1].children.filter(function (child) { return child.tag === "input"; });
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const soon = core.partsInZone(Date.now() + 3 * core.DAY_MS, zone);
  const values = {
    name: "Ann",
    phone: "5552345678",
    from: "Library",
    to: "Office",
    date: soon.year + "-" + String(soon.month).padStart(2, "0") + "-" + String(soon.day).padStart(2, "0"),
    time: String(soon.hour).padStart(2, "0") + ":" + String(soon.minute).padStart(2, "0"),
    note: "ok"
  };
  inputs.forEach(function (input) { input.value = values[input.name] || ""; });
  mounted.root.children[2].children[0]._listeners[0]();
  assert.strictEqual(mounted.getState().notice, "Trip posted.");
  inputs.forEach(function (input) { if (input.name === "date") input.value = "2020-01-01"; });
  mounted.setState(Object.assign(mounted.getState(), { mode: "post", notice: "" }));
  const again = mounted.root.children[1].children.filter(function (child) { return child.tag === "input"; });
  again.forEach(function (input) { input.value = input.name === "date" ? "2020-01-01" : (values[input.name] || ""); });
  mounted.root.children[2].children[0]._listeners[0]();
  assert.ok(mounted.getState().error.indexOf("later time") !== -1);
  const phone = fakeWindow();
  view.mount(phone);
  phone.visualViewport._listeners.forEach(function (fn) { fn(); });
  phone._listeners.forEach(function (fn) { fn(); });
  const quiet = fakeWindow();
  quiet.visualViewport = {};
  view.mount(quiet);
  view.destroy();
  const vm = require("vm");
  const sandbox = { console: console, Intl: Intl };
  sandbox.globalThis = sandbox;
  sandbox.window = fakeWindow();
  sandbox.document = sandbox.window.document;
  vm.createContext(sandbox);
  ["core.js", "ui-state.js", "admin-state.js", "app.js"].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../../jumpin", file), "utf8"), sandbox, { filename: file });
  });
  ["jumpin-error", "jumpin-count", "jumpin-send", "jumpin-pending", "jumpin-upcoming", "jumpin-blocked"].forEach(function (id) {
    const node = sandbox.document.createElement("div");
    node.id = id;
    sandbox.document.body.appendChild(node);
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../jumpin-admin.js"), "utf8"), sandbox, { filename: "jumpin-admin.js" });
  assert.ok(sandbox.JumpInCore.sha256Hex("abc").length === 64);
  assert.ok(sandbox.window.document.getElementById("jumpin-root"));
});

it("rejects posts, cancels, and texts that break the rules", async function () {
  const handlers = require("../../jumpin/handlers.js");
  assert.strictEqual((await handlers.call(service.createMemoryDb(seed()), "carpoolListPending", {}, { token: {} }, NOW)).ok, false);
  const quiet = service.createMemoryDb({ "settings/carpool_config": core.defaultConfig() });
  assert.strictEqual((await service.reserveSeat(quiet, { rideId: "x", name: "Sam", phone: "5559876543" }, NOW)).error, "JumpIn is not open yet.");
  assert.strictEqual((await service.cancelSeat(quiet, { rideId: "x", secret: "nope" }, NOW)).error, "JumpIn is not open yet.");
  assert.strictEqual((await service.cancelTrip(quiet, { rideId: "x", secret: "nope" }, NOW)).error, "JumpIn is not open yet.");
  assert.strictEqual((await service.postMessage(quiet, { rideId: "x", secret: "nope", text: "hi" }, NOW)).error, "JumpIn is not open yet.");
  assert.strictEqual((await service.sendManageLink(quiet, { rideId: "x", phone: "5552345678", role: "driver" }, NOW)).phrase, core.recoveryPhrase());
  assert.strictEqual((await service.postMessage(service.createMemoryDb(seed()), { rideId: "x", text: "  " }, NOW)).error, "Enter a message.");
  assert.strictEqual((await service.markOptOut(service.createMemoryDb(seed()), "12", NOW)).ok, false);
  assert.strictEqual((await service.broadcast(service.createMemoryDb(seed()), "nope@example.com", { scope: "all", text: "hi", confirm: false }, NOW)).ok, false);
  assert.strictEqual((await service.broadcast(service.createMemoryDb(seed()), service.SUPERADMIN_EMAIL, { scope: "all", text: "  ", confirm: true }, NOW)).error, "Enter a message.");
  assert.strictEqual((await service.adminCancelTrip(service.createMemoryDb(seed()), "nope@example.com", "x", NOW)).ok, false);
  assert.strictEqual((await service.setPosting(service.createMemoryDb(seed()), "nope@example.com", { phone: "5552345678", blocked: true }, NOW)).ok, false);
  assert.strictEqual((await service.setPosting(service.createMemoryDb(seed()), service.SUPERADMIN_EMAIL, { phone: "12", blocked: true }, NOW)).ok, false);
  assert.strictEqual((await service.setPosting(service.createMemoryDb(seed()), service.SUPERADMIN_EMAIL, { rideId: "missing", blocked: true }, NOW)).error, "This ride is not available.");
  assert.strictEqual((await service.adminCancelTrip(service.createMemoryDb(seed()), service.SUPERADMIN_EMAIL, "missing", NOW)).error, "This ride is not available.");
  assert.strictEqual((await service.listAdmin(service.createMemoryDb(), service.SUPERADMIN_EMAIL)).ok, true);
  const blankIndex = service.createMemoryDb({ "settings/carpool_config": enabledConfig(), "carpool_private/broadcast_index": { rides: null, audience: null }, "carpool_private/block_index": { blocks: null }, "carpool_private/limit_index": { keys: null } });
  assert.strictEqual((await service.listAdmin(blankIndex, service.SUPERADMIN_EMAIL, NOW)).ok, true);
  assert.strictEqual((await service.completeDue(blankIndex, NOW)).completed, 0);
  assert.strictEqual((await service.retainTrips(blankIndex, NOW)).ok, true);

  const db = service.createMemoryDb({ "settings/carpool_config": enabledConfig({ maxPostsPerPhonePerDay: 1, maxSmsPerRecord: 1, dailySmsCap: 2 }) });
  const posted = await service.postRide(db, postInput({ idempotencyKey: "only" }), NOW);
  assert.strictEqual((await service.postRide(db, postInput({ idempotencyKey: "second" }), NOW + 1000)).error.indexOf("1 trips") !== -1, true);
  const sam = await service.reserveSeat(db, { rideId: posted.rideId, name: "Sam", phone: "5559876543", idempotencyKey: "only-seat" }, NOW + 2000);
  assert.strictEqual(sam.ok, true);
  const limited = await service.sendManageLink(db, { rideId: posted.rideId, phone: "5559876543", role: "rider", ip: "198.51.100.20" }, NOW + 80000);
  assert.strictEqual(limited.outbox.length, 0);
  assert.strictEqual((await service.cancelSeat(db, { rideId: posted.rideId, secret: sam.secret }, NOW + 2500)).ok, true);
  const left = await service.postRide(db, postInput({ idempotencyKey: "later", phone: "5553334444", name: "Bea" }), NOW + 3000);
  if (left.ok) {
    assert.strictEqual((await service.cancelTrip(db, { rideId: left.rideId, secret: left.secret }, NOW + core.DAY_MS * 5)).error, "This trip has already left.");
    assert.strictEqual((await service.postMessage(db, { rideId: left.rideId, secret: left.secret, text: "hi" }, NOW + core.DAY_MS * 5)).error, service.GENERIC_LINK);
    assert.strictEqual((await service.sendManageLink(db, { rideId: left.rideId, phone: "5553334444", role: "driver", ip: "198.51.100.21" }, NOW + core.DAY_MS * 5)).phrase, core.recoveryPhrase());
  }
  const again = await service.adminCancelTrip(db, service.SUPERADMIN_EMAIL, posted.rideId, NOW + 90000);
  assert.strictEqual(again.ok, true);
  const repeat = await service.adminCancelTrip(db, service.SUPERADMIN_EMAIL, posted.rideId, NOW + 91000);
  assert.strictEqual(repeat.already, true);
  for (let i = 0; i < 11; i++) {
    await service.sendManageLink(db, { rideId: posted.rideId, phone: "5550001111", role: "rider", ip: "198.51.100.30" }, NOW + 100000 + i);
  }
});

it("covers fallback branches in the shell and the rules", function () {
  assert.strictEqual(core.timingSafeEqual(null, null), true);
  assert.ok(core.randomSecret(function () { return new Uint8Array([1]); }).length >= 1);
  assert.ok(core.randomSecret(function () { return new Uint8Array([1, 2]); }).length >= 2);
  assert.ok(core.randomSecret(function () { return new Uint8Array([1, 2, 3]); }).length >= 3);
  const same = fakeWindow();
  view.mount(same);
  view.mount(same);
  const bare = fakeWindow();
  bare.visualViewport = null;
  bare.innerHeight = 0;
  bare.localStorage = null;
  const mounted = view.mount(bare);
  mounted.setState(Object.assign(ui.blank(), { mode: "ride", status: "", notice: "", role: "", seatsLeft: 0 }));
  assert.strictEqual(mounted.root.style.height, "0px");
  const rideText = mounted.root.children[1].children.map(function (child) { return child.textContent; }).join(" ");
  assert.ok(rideText.indexOf("Ride") !== -1);
  const noIntl = fakeWindow();
  noIntl.Intl = null;
  const form = view.mount(noIntl);
  form.setState(Object.assign(ui.blank(), { mode: "post" }));
  const soon = new Date(Date.now() + 3 * core.DAY_MS);
  const date = soon.toISOString().slice(0, 10);
  const time = "15:00";
  form.root.children[1].children.filter(function (child) { return child.tag === "input"; }).forEach(function (input) {
    const values = { name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: date, time: time, note: "ok" };
    input.value = values[input.name] || "";
  });
  form.root.children[2].children[0]._listeners[0]();
  assert.ok(form.getState().notice === "Trip posted." || form.getState().error);
  view.destroy();
  let flow = ui.reduce(ui.blank(), { type: "ride", ride: { status: "open", seatsLeft: 0 }, role: "" });
  flow = ui.reduce(flow, { type: "reserve-open" });
  assert.strictEqual(flow.reserveOpen, false);
  flow = ui.reduce(flow, { type: "recovery", role: "rider" });
  assert.strictEqual(flow.recovery, "rider");
  flow = ui.reduce(flow, { type: "recovery-close" });
  assert.strictEqual(flow.recovery, "");
  flow = ui.reduce(flow, { type: "fail" });
  assert.strictEqual(flow.error, "");
  flow = ui.reduce(flow, { type: "notice" });
  assert.strictEqual(flow.notice, "");
  const adminState = require("../../jumpin/admin-state.js");
  assert.strictEqual(adminState.reduce(adminState.blank(), { type: "fail" }).error, "");
  const page = require("../../jumpin-admin.js");
  const adminWin = fakeWindow();
  ["jumpin-count", "jumpin-send", "jumpin-pending", "jumpin-upcoming", "jumpin-blocked"].forEach(function (id) {
    const node = adminWin.document.createElement("div");
    node.id = id;
    adminWin.document.body.appendChild(node);
  });
  page.render(adminWin.document, adminState.reduce(adminState.blank(), { type: "preview", scope: "all", count: 1, left: 2 }), {});
  assert.strictEqual(adminWin.document.getElementById("jumpin-send").hidden, false);
  page.render(adminWin.document, adminState.blank(), {});
  const manyUpcoming = Array.from({ length: 14 }, function (_x, i) {
    return { rideId: "ride_adm_" + i, from: "A" + i, to: "B" + i, seatsLeft: 2, departAt: Date.now() + 60000 };
  });
  page.render(adminWin.document, adminState.blank(), { upcoming: manyUpcoming });
  const admBox = adminWin.document.getElementById("jumpin-upcoming");
  const admPager = admBox.children.find(function (c) { return c.className === "admin-pager"; });
  assert.ok(admPager);
  admPager.children.find(function (c) { return c.textContent === "Next ›"; })._listeners[0]();
  const admPager2 = admBox.children.find(function (c) { return c.className === "admin-pager"; });
  assert.strictEqual(admPager2.children[2].children[0].textContent, "Page 2 of 2");
  assert.strictEqual(admPager2.children[2].children[1].textContent, "2 / 2");
});

it("isolates multi-neighborhood groups, enforces anti-spam caps, and scopes SMS URLs", async function () {
  assert.strictEqual(core.normalizeGroupId(""), "default");
  assert.strictEqual(core.normalizeGroupId("Ballantyne"), "ballantyne");
  assert.strictEqual(core.normalizeGroupId("admin"), "");
  assert.ok(core.groupSlugError("a"));
  assert.strictEqual(core.groupSlugError("ballantyne"), "");

  const db = service.createMemoryDb(seed());
  assert.strictEqual((await service.createGroup(db, "", { name: "X", groupId: "x12" }, NOW)).ok, false);
  assert.strictEqual((await service.createGroup(db, "org@example.com", { name: "", groupId: "ballantyne" }, NOW)).field, "name");
  assert.strictEqual((await service.createGroup(db, "org@example.com", { name: "Bad", groupId: "admin" }, NOW)).field, "groupId");
  assert.strictEqual((await service.listGroups(db, "", NOW)).ok, false);
  assert.strictEqual((await service.reviewGroup(db, "org@example.com", { groupId: "ballantyne", decision: "approve" }, NOW)).ok, false);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "default", decision: "approve" }, NOW)).ok, false);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "ballantyne", decision: "bad" }, NOW)).ok, false);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "missing-grp", decision: "approve" }, NOW)).ok, false);

  assert.strictEqual((await service.createGroup(db, "org@example.com", { name: "Ballantyne Neighbors", groupId: "ballantyne" }, NOW)).field, "contactPhone");
  const created = await service.createGroup(db, "org@example.com", { name: "Ballantyne Neighbors", groupId: "ballantyne", contactPhone: "5552345678", supportNote: "Zelle:org@example.com", membersOnly: false }, NOW);
  assert.strictEqual(created.ok, true);
  assert.strictEqual(created.textSent, true);
  assert.strictEqual(created.group.status, "pending");
  assert.strictEqual(created.group.supportNote, "Zelle:senthil930@gmail.com");
  assert.strictEqual(created.outbox.length, 1);
  assert.strictEqual(created.outbox[0].to, "+19802531359");
  assert.strictEqual(created.outbox[0].triggerType, "CARPOOL_GROUP_REQUEST");
  assert.strictEqual((await service.createGroup(db, "org@example.com", { name: "Second", groupId: "second-grp", contactPhone: "5552345678" }, NOW)).error, "You already have a group waiting for approval.");
  assert.strictEqual((await service.createGroup(db, "other@example.com", { name: "Dup", groupId: "ballantyne", contactPhone: "5552345678" }, NOW)).field, "groupId");
  assert.strictEqual((await service.postRide(db, postInput({ groupId: "ballantyne" }), NOW)).error, "This community group is waiting for approval.");
  assert.strictEqual((await service.postRide(db, postInput({ groupId: "no-such-group" }), NOW)).error, "This community group was not found.");

  const approved = await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "ballantyne", decision: "approve" }, NOW);
  assert.strictEqual(approved.ok, true);
  assert.strictEqual(approved.textSent, true);
  assert.strictEqual(approved.status, "active");
  assert.strictEqual(approved.outbox.length, 1);
  assert.strictEqual(approved.outbox[0].to, "+15552345678");
  assert.strictEqual(approved.outbox[0].triggerType, "CARPOOL_GROUP_APPROVED");
  assert.ok(approved.outbox[0].body.indexOf("&g=ballantyne") !== -1);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "ballantyne", decision: "cap", dailySmsCap: 150 }, NOW)).dailySmsCap, 150);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "ballantyne", decision: "suspend" }, NOW)).status, "suspended");
  assert.strictEqual((await service.postRide(db, postInput({ groupId: "ballantyne" }), NOW)).error, "This community group is currently paused.");
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "ballantyne", decision: "approve" }, NOW)).status, "active");

  const rejectReq = await service.createGroup(db, "temp@example.com", { name: "Temp", groupId: "temp-grp", contactPhone: "5552345678" }, NOW);
  assert.strictEqual(rejectReq.ok, true);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "temp-grp", decision: "reject" }, NOW)).decision, "reject");
  const reusedReq = await service.createGroup(db, "temp@example.com", { name: "Temp Reused", groupId: "temp-grp", contactPhone: "5552345678", membersOnly: false }, NOW);
  assert.strictEqual(reusedReq.ok, true);
  await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "temp-grp", decision: "approve" }, NOW);
  const tempRide = await service.postRide(db, postInput({ groupId: "temp-grp", idempotencyKey: "temp-ride-1" }), NOW);
  assert.strictEqual(tempRide.ok, true);
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "temp-grp", decision: "reject" }, NOW)).decision, "reject");

  const posted = await service.postRide(db, postInput({ groupId: "ballantyne", seats: 2 }), NOW);
  assert.strictEqual(posted.ok, true);
  assert.ok(posted.outbox[0].body.indexOf("&g=ballantyne") !== -1);
  await service.saveAdminConfig(db, "org@example.com", { groupId: "ballantyne", enabled: true, membersOnly: true, adminEmails: "org@example.com", dailySmsCap: 150 }, NOW);
  const nonMemberGroupPost = await service.postRide(db, postInput({ groupId: "ballantyne", phone: "5550009999", idempotencyKey: "nm-1" }), NOW);
  assert.ok(nonMemberGroupPost.error.indexOf("approved community members only") !== -1);
  await service.saveAdminConfig(db, "org@example.com", { groupId: "ballantyne", enabled: true, membersOnly: false, adminEmails: "org@example.com", dailySmsCap: 150 }, NOW);
  const reserved = await service.reserveSeat(db, { groupId: "ballantyne", rideId: posted.rideId, name: "Sam", phone: "5559876543", seats: 1, idempotencyKey: "bg1" }, NOW + 1000);
  assert.strictEqual(reserved.ok, true);
  assert.ok(reserved.outbox[0].body.indexOf("&g=ballantyne") !== -1);
  assert.ok((await service.sendManageLink(db, { groupId: "ballantyne", rideId: posted.rideId, phone: "5552345678", role: "driver" }, NOW + 2000)).ok);
  assert.ok((await service.updateSeat(db, { groupId: "ballantyne", rideId: posted.rideId, secret: reserved.secret, seats: 2 }, NOW + 2100)).ok);
  assert.ok((await service.postMessage(db, { groupId: "ballantyne", rideId: posted.rideId, secret: reserved.secret, text: "On my way" }, NOW + 2200)).outbox[0].body.indexOf("&g=ballantyne") !== -1);
  assert.ok((await service.cancelSeat(db, { groupId: "ballantyne", rideId: posted.rideId, secret: reserved.secret }, NOW + 2300)).ok);
  assert.ok((await service.cancelTrip(db, { groupId: "ballantyne", rideId: posted.rideId, secret: posted.secret }, NOW + 2400)).ok);
  const posted2 = await service.postRide(db, postInput({ groupId: "ballantyne", seats: 2, idempotencyKey: "p2" }), NOW + 2500);
  assert.strictEqual(posted2.ok, true);
  assert.ok(service.manageUrl("trip", "r1", "s1", "r1", "ballantyne").indexOf("&g=ballantyne") !== -1);
  assert.strictEqual(service.manageUrl("trip", "r1", "s1", "r1", "default").indexOf("&g="), -1);

  const savedCfg = await service.saveAdminConfig(db, "org@example.com", { groupId: "ballantyne", groupName: "Ballantyne HOA", enabled: true, adminEmails: "org@example.com", supportNote: "Zelle:hijack@example.com", dailySmsCap: 999 }, NOW);
  assert.strictEqual(savedCfg.ok, true);
  assert.strictEqual(savedCfg.config.dailySmsCap, 150);
  assert.strictEqual(savedCfg.config.supportNote, "Zelle:senthil930@gmail.com");
  assert.deepStrictEqual(savedCfg.config.adminEmails, ["org@example.com"]);
  const emptyEmailsSaved = await service.saveAdminConfig(db, "org@example.com", { groupId: "ballantyne", enabled: true, adminEmails: "", dailySmsCap: 150 }, NOW);
  assert.deepStrictEqual(emptyEmailsSaved.config.adminEmails, ["org@example.com"]);

  const orgList = await service.listGroups(db, "org@example.com", NOW);
  assert.strictEqual(orgList.groups.length, 1);
  assert.strictEqual(orgList.groups[0].name, "Ballantyne HOA");
  const superList = await service.listGroups(db, service.SUPERADMIN_EMAIL, NOW);
  assert.ok(superList.isSuperAdmin && superList.groups.length >= 2);
  const defAdmin = await service.listAdmin(db, service.SUPERADMIN_EMAIL, NOW, "default");
  assert.strictEqual(defAdmin.upcoming.length, 0);
  const bAdmin = await service.listAdmin(db, "org@example.com", NOW, "ballantyne");
  assert.strictEqual(bAdmin.upcoming.length, 1);

  const handlers = require("../../jumpin/handlers.js");
  assert.strictEqual((await handlers.call(db, "carpoolCreateGroup", { name: "SuperGrp", groupId: "super-grp", contactPhone: "5552345678" }, { token: { email: service.SUPERADMIN_EMAIL } }, NOW)).group.status, "active");
  assert.strictEqual((await handlers.call(db, "carpoolListGroups", {}, { token: { email: service.SUPERADMIN_EMAIL } }, NOW)).ok, true);
  assert.strictEqual((await handlers.call(db, "carpoolReviewGroup", { groupId: "super-grp", decision: "cap", dailySmsCap: 200 }, { token: { email: service.SUPERADMIN_EMAIL } }, NOW)).ok, true);

  await service.completeDue(db, NOW + 6 * core.HOUR_MS, "ballantyne");
  await service.completeDue(db, NOW + 6 * core.HOUR_MS);
  await service.retainTrips(db, NOW + 10 * core.DAY_MS);

  await service.createGroup(db, "org@example.com", { name: "B2", groupId: "bal-two", contactPhone: "5552345678" }, NOW);
  await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "bal-two", decision: "approve" }, NOW);
  await service.createGroup(db, "org@example.com", { name: "B3", groupId: "bal-three", contactPhone: "5552345678" }, NOW);
  await service.reviewGroup(db, service.SUPERADMIN_EMAIL, { groupId: "bal-three", decision: "approve" }, NOW);
  assert.strictEqual((await service.createGroup(db, "org@example.com", { name: "B4", groupId: "bal-four", contactPhone: "5552345678" }, NOW)).error, "Group limit reached (max 3 per account).");

  for (let i = 0; i < 50; i++) {
    await service.createGroup(db, "flood" + i + "@example.com", { name: "Flood " + i, groupId: "flood-" + i, contactPhone: "5552345678" }, NOW);
  }
  assert.strictEqual((await service.createGroup(db, "floodx@example.com", { name: "Flood X", groupId: "flood-x", contactPhone: "5552345678" }, NOW)).error, "Too many pending requests right now. Please try again later.");

  await service.setMembers(db, "org@example.com", { groupId: "ballantyne", name: "Alex", phone: "5552345678" }, NOW);
  await service.setPosting(db, "org@example.com", { groupId: "ballantyne", phone: "5551110000", name: "Spam", blocked: true }, NOW);
  await service.broadcast(db, "org@example.com", { groupId: "ballantyne", scope: "all", text: "Hi neighbors", confirm: false }, NOW);
  await service.markOptOut(db, "5559876543", NOW, "ballantyne");
  await service.purgeData(db, "org@example.com", { groupId: "ballantyne", scope: "past", confirm: true }, NOW);
  assert.strictEqual((await service.createGroup(db, "org2@example.com")).field, "name");
  assert.strictEqual((await service.reviewGroup(db, service.SUPERADMIN_EMAIL)).ok, false);
  assert.strictEqual((await service.listGroups(db, "nobody@example.com")).groups.length, 0);
  await service.reviewRide(db, "org@example.com", { groupId: "ballantyne", rideId: posted2.rideId, decision: "approve" }, NOW);
  await service.adminCancelTrip(db, "org@example.com", posted2.rideId, NOW, "ballantyne");
  await service.saveAdminConfig(db, "org@example.com", { groupId: "ballantyne", enabled: true, adminEmails: "org@example.com", dailySmsCap: 100 });
  const emptyDb = service.createMemoryDb({});
  await service.completeDue(emptyDb, NOW);
  await service.retainTrips(emptyDb, NOW);
  await service.createGroup(emptyDb, service.SUPERADMIN_EMAIL, { name: "First", groupId: "first-grp", contactEmail: "x@y.com", contactPhone: "5552345678" });
  await service.reviewGroup(emptyDb, service.SUPERADMIN_EMAIL, { groupId: "first-grp", decision: "cap", dailySmsCap: 50 });
  const metaLessDb = service.createMemoryDb({ "carpool_platform/groups_index": { groups: [{ groupId: "ghost", name: "Ghost", status: "pending" }] } });
  await service.reviewGroup(metaLessDb, service.SUPERADMIN_EMAIL, { groupId: "ghost", decision: "cap" });
  await service.reviewGroup(metaLessDb, service.SUPERADMIN_EMAIL, { groupId: "ghost", decision: "approve" });
  await service.reviewGroup(metaLessDb, service.SUPERADMIN_EMAIL, { groupId: "ghost", decision: "suspend" });
  await service.listGroups(emptyDb, service.SUPERADMIN_EMAIL);
  const cappedDb = service.createMemoryDb(Object.assign(seed(), { "carpool_platform/config": { platformDailySmsCap: 0, dailySmsDay: core.utcDay(NOW), dailySmsSent: 0 } }));
  const cappedPost = await service.postRide(cappedDb, postInput(), NOW);
  assert.strictEqual(cappedPost.textSent, false);

  assert.strictEqual((await service.savePlatformConfig(db, "nobody@example.com", { platformEnabled: false }, NOW)).ok, false);
  const platSaved = await handlers.call(db, "carpoolAdminSavePlatformConfig", {
    platformEnabled: false,
    iosThemeEnabled: true,
    platformDailySmsCap: 1500,
    platformAdminEmail: "senthil930@gmail.com",
    platformAdminPhone: "9802531359",
    platformSupportNote: "Venmo:@jumpin-help",
    maintenanceMessage: "Scheduled maintenance tonight"
  }, { token: { email: service.SUPERADMIN_EMAIL } }, NOW);
  assert.strictEqual(platSaved.ok, true);
  assert.strictEqual(platSaved.platform.iosThemeEnabled, true);
  assert.strictEqual(platSaved.platform.platformAdminPhone, "+19802531359");
  assert.strictEqual((await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, { platformAdminPhone: "bad" }, NOW)).ok, false);
  await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, { platformAdminEmail: "", platformAdminPhone: "" }, NOW);
  assert.strictEqual(platSaved.platform.platformEnabled, false);
  assert.strictEqual((await service.postRide(db, postInput(), NOW)).error, "Scheduled maintenance tonight");
  assert.strictEqual((await service.reserveSeat(db, { rideId: posted2.rideId, name: "Sam", phone: "5559876543" }, NOW)).error, "Scheduled maintenance tonight");
  await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, { maintenanceMessage: "", platformSupportNote: "" }, NOW);
  assert.strictEqual((await service.postRide(db, postInput(), NOW)).error, "JumpIn is temporarily paused for maintenance.");
  assert.strictEqual((await service.reserveSeat(db, { rideId: posted2.rideId, name: "Sam", phone: "5559876543" }, NOW)).error, "JumpIn is temporarily paused for maintenance.");
  await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, { platformDailySmsCap: 0 });
  await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL);
  await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, { platformEnabled: true, maintenanceMessage: "", platformDailySmsCap: 2000 }, NOW);
  const schedSaved = await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, {
    completeTripsEnabled: false,
    completeTripsIntervalMinutes: 15,
    retainTripsEnabled: false,
    retainTripsIntervalHours: 48
  }, NOW);
  assert.strictEqual(schedSaved.platform.completeTripsEnabled, false);
  assert.strictEqual(schedSaved.platform.completeTripsIntervalMinutes, 15);
  assert.strictEqual(schedSaved.platform.retainTripsEnabled, false);
  assert.strictEqual(schedSaved.platform.retainTripsIntervalHours, 48);
  assert.strictEqual((await service.completeDue(db, NOW + 20 * 60000)).skipped, "disabled");
  assert.strictEqual((await service.retainTrips(db, NOW + 50 * core.HOUR_MS)).skipped, "disabled");
  await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, { completeTripsEnabled: true, retainTripsEnabled: true }, NOW);
  const runAt = NOW + 15 * core.DAY_MS;
  assert.strictEqual((await service.completeDue(db, runAt)).ok, true);
  assert.strictEqual((await service.completeDue(db, runAt + 5 * 60000)).skipped, "interval");
  assert.strictEqual((await service.retainTrips(db, runAt)).ok, true);
  assert.strictEqual((await service.retainTrips(db, runAt + 24 * 3600000)).skipped, "interval");
  assert.strictEqual(db.snapshot()["carpool_platform/config"].completeTripsIntervalMinutes, 15);
  assert.strictEqual(db.snapshot()["carpool_platform/config"].retainTripsIntervalHours, 48);

  assert.strictEqual((await service.searchMembers(db, "org@example.com", { query: "Sam" }, NOW)).ok, false);
  assert.strictEqual((await service.searchMembers(db, service.SUPERADMIN_EMAIL)).ok, false);
  assert.strictEqual((await service.searchMembers(db, service.SUPERADMIN_EMAIL, { query: "   " }, NOW)).ok, false);
  await service.setMembers(db, service.SUPERADMIN_EMAIL, { groupId: "default", name: "Default Member", phone: "5551112222" }, NOW);
  assert.strictEqual((await service.searchMembers(db, service.SUPERADMIN_EMAIL, { query: "2222" }, NOW)).results[0].groupId, "default");
  await service.setMembers(db, "org@example.com", { groupId: "ballantyne", bulk: "Priya Nair,5557778888\nSam,5559876543" }, NOW);
  const searchRide = await service.postRide(db, postInput({ groupId: "ballantyne", name: "Priya Nair", phone: "5557778888", idempotencyKey: "sr-1" }), NOW);
  await service.reserveSeat(db, { groupId: "ballantyne", rideId: searchRide.rideId, name: "Sam", phone: "5559876543", seats: 1, idempotencyKey: "sr-res-1" }, NOW + 100);
  const byName = await handlers.call(db, "carpoolAdminSearchMembers", { query: "Priya" }, { token: { email: service.SUPERADMIN_EMAIL } }, NOW);
  assert.strictEqual(byName.ok, true);
  assert.strictEqual(byName.results.length, 1);
  assert.strictEqual(byName.results[0].phone, "+15557778888");
  assert.strictEqual(byName.results[0].groupId, "ballantyne");
  const byPhone = await service.searchMembers(db, service.SUPERADMIN_EMAIL, { query: "555-777-8888" }, NOW);
  assert.ok(byPhone.results.some(function (r) { return r.groupId === "ballantyne" && r.trips.some(function (t) { return t.role === "Driver"; }); }));
  const byLast4 = await service.searchMembers(db, service.SUPERADMIN_EMAIL, { query: "6543" }, NOW);
  assert.ok(byLast4.results.some(function (r) { return r.name === "Sam" && r.trips.some(function (t) { return t.role.indexOf("Rider") === 0; }); }));
  const legacyDb = service.createMemoryDb({
    "carpool_private/member_index": { members: [{ phoneHash: "deadbeef", phoneLast4: "9999", name: "Legacy User", addedAt: NOW }] }
  });
  const legacyRes = await service.searchMembers(legacyDb, service.SUPERADMIN_EMAIL, { query: "Legacy" }, NOW);
  assert.strictEqual(legacyRes.results[0].phone, "•••• 9999");

  const coAdminSaved = await service.savePlatformConfig(db, service.SUPERADMIN_EMAIL, {
    superAdminEmails: "co-admin@example.com",
    platformAdminEmail: "contact-only@example.com"
  }, NOW);
  assert.deepStrictEqual(coAdminSaved.platform.superAdminEmails, ["senthil930@gmail.com", "co-admin@example.com"]);
  assert.strictEqual((await service.listGroups(db, "co-admin@example.com", NOW)).isSuperAdmin, true);
  assert.strictEqual((await service.listGroups(db, "contact-only@example.com", NOW)).isSuperAdmin, false);
  assert.strictEqual((await service.searchMembers(db, "co-admin@example.com", { query: "Priya" }, NOW)).ok, true);
  assert.strictEqual((await service.savePlatformConfig(db, "co-admin@example.com", { superAdminEmails: "" }, NOW)).platform.superAdminEmails[0], "senthil930@gmail.com");
  assert.strictEqual((await service.searchMembers(db, "co-admin@example.com", { query: "Priya" }, NOW)).ok, false);
  assert.strictEqual((await service.searchMembers(db, "", { query: "Priya" }, NOW)).ok, false);
  assert.strictEqual((await service.reviewGroup(db, "", { groupId: "ballantyne", decision: "approve" }, NOW)).ok, false);
  assert.strictEqual((await service.savePlatformConfig(db, "", { platformEnabled: true }, NOW)).ok, false);

  const nmDb = service.createMemoryDb({ "settings/carpool_config": enabledConfig() });
  await service.postRide(nmDb, postInput({ name: "Visitor Driver", phone: "5553219876", idempotencyKey: "nm-drv" }), NOW);
  assert.strictEqual((await service.searchMembers(nmDb, service.SUPERADMIN_EMAIL, { query: "Visitor" }, NOW)).results[0].phone, "+15553219876");
  assert.strictEqual((await service.searchMembers(nmDb, service.SUPERADMIN_EMAIL, { query: "9876" }, NOW)).results.length, 1);
  assert.strictEqual((await service.searchMembers(nmDb, service.SUPERADMIN_EMAIL, { query: "5553219876" }, NOW)).results.length, 1);
  assert.strictEqual((await service.searchMembers(nmDb, service.SUPERADMIN_EMAIL, { query: "Nobody" }, NOW)).results.length, 0);

  await service.purgeData(db, "org@example.com", { groupId: "ballantyne", scope: "trips", confirm: true }, NOW);
  await service.purgeData(db, "org@example.com", { groupId: "ballantyne", scope: "all", confirm: true }, NOW);
});

it("draws the board when Firestore cannot start", function () {
  const cloud = require("../../jumpin/cloud.js");
  const win = fakeWindow();
  const ref = {
    collection: function () { return ref; },
    doc: function () { return ref; },
    where: function () { return ref; },
    onSnapshot: function () { throw new Error("no firestore"); }
  };
  win.firebase = { apps: [], initializeApp: function () { throw new Error("no app"); }, firestore: function () { return ref; } };
  global.JumpInCloud = cloud;
  const view = require("../../jumpin/app.js");
  view.start(win);
  function texts(node) {
    return (node.children || []).map(function (child) { return (child._text || "") + " " + texts(child); }).join(" ");
  }
  assert.ok(texts(win.document.getElementById("jumpin-root")).indexOf("Find a seat") !== -1);
  view.destroy();
  delete global.JumpInCloud;
});

it("shows the confirmation screen after a saved post and the field error on a bad form", async function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  function fill(mounted, values) {
    mounted.root.children[1].children.filter(function (child) { return child.tag === "input"; }).forEach(function (input) {
      input.value = values[input.name] || "";
    });
  }
  function clickPost(mounted) {
    mounted.root.children[2].children[0]._listeners[0]();
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const soon = core.partsInZone(Date.now() + 3 * core.DAY_MS, zone);
  const values = {
    name: "Ann",
    phone: "5552345678",
    from: "Library",
    to: "Office",
    date: soon.year + "-" + pad(soon.month) + "-" + pad(soon.day),
    time: pad(soon.hour) + ":" + pad(soon.minute),
    note: "South door"
  };
  const win = fakeWindow();
  win.JumpInCloud = {
    postRide: function () { return Promise.resolve({ ok: true, rideId: "ride_live", secret: "sek", status: "open", textSent: true }); },
    publicRideUrl: function (id) { return "https://waitlink.app?s=jumpin&view=ride&ride=" + id; },
    watchBoard: function () { return function () {}; }
  };
  const mounted = view.mount(win);
  mounted.setState(Object.assign(ui.blank(), { mode: "post", rides: [] }));
  fill(mounted, values);
  clickPost(mounted);
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  assert.strictEqual(mounted.getState().mode, "posted");
  const cardText = mounted.root.children[1].children[0].children.map(function (child) {
    if (child.textContent || child.value) return child.textContent || child.value;
    return (child.children || []).map(function (c) { return c.textContent || c.value || ""; }).join(" ");
  }).join(" ");
  assert.ok(cardText.indexOf("Trip posted.") !== -1);
  assert.ok(cardText.indexOf("Library → Office") !== -1);
  assert.ok(cardText.indexOf("ride_live") !== -1);
  assert.strictEqual(mounted.root.style.height, "auto");

  const pendingWin = fakeWindow();
  pendingWin.JumpInCloud = {
    postRide: function () { return Promise.resolve({ ok: true, rideId: "ride_wait", secret: "sek", status: "pending", textSent: true }); },
    publicRideUrl: function (id) { return "https://waitlink.app?s=jumpin&view=ride&ride=" + id; },
    watchBoard: function () { return function () {}; }
  };
  const pending = view.mount(pendingWin);
  pending.setState(Object.assign(ui.blank(), { mode: "post", rides: [] }));
  fill(pending, values);
  clickPost(pending);
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  const pendingText = pending.root.children[1].children[0].children.map(function (child) { return child.textContent || child.value || ""; }).join(" ");
  assert.ok(pendingText.indexOf("Waiting for approval.") !== -1);
  assert.ok(pendingText.indexOf("ride_wait") === -1);

  const failWin = fakeWindow();
  failWin.JumpInCloud = {
    postRide: function () { return Promise.resolve({ ok: false, error: "Could not post. Check the connection and try again." }); },
    watchBoard: function () { return function () {}; }
  };
  const failed = view.mount(failWin);
  failed.setState(Object.assign(ui.blank(), { mode: "post" }));
  fill(failed, values);
  clickPost(failed);
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  assert.strictEqual(failed.getState().mode, "post");
  assert.strictEqual(failed.root.children[1].children[0].textContent, "Could not post. Check the connection and try again.");

  const blank = view.mount(fakeWindow());
  blank.setState(Object.assign(ui.blank(), { mode: "post" }));
  clickPost(blank);
  const nameError = blank.root.children[1].children.filter(function (child) { return child.className === "error"; })[0];
  assert.strictEqual(nameError.textContent, "Enter your name.");
  fill(blank, { name: "Ann", phone: "12", from: "Library", to: "Office", date: values.date, time: values.time });
  clickPost(blank);
  const phoneError = blank.root.children[1].children.filter(function (child) { return child.className === "error"; })[0];
  assert.strictEqual(phoneError.textContent, "Enter a US or Canada mobile number.");
  fill(blank, { name: "Ann", phone: "5552345678", from: "", to: "Office", date: values.date, time: values.time });
  clickPost(blank);
  assert.strictEqual(blank.getState().error, "Enter where you are leaving from.");
  fill(blank, { name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: "", time: "" });
  clickPost(blank);
  assert.strictEqual(blank.getState().error, "Choose a date.");
  fill(blank, { name: "Ann", phone: "5552345678", from: "Library", to: "Office", date: "2020-01-01", time: "08:00" });
  clickPost(blank);
  assert.ok(blank.getState().error.indexOf("later time") !== -1);

  const browserWin = fakeWindow();
  browserWin.JumpInCloud = require("../../jumpin/cloud.js");
  view.start(browserWin);
  assert.strictEqual(typeof browserWin.JumpInCloud.postRide, "function");

  let driverState = ui.reduce(ui.blank(), { type: "ride", ride: { rideId: "r1", status: "open", seatsLeft: 2 }, role: "driver" });
  driverState = ui.reduce(driverState, { type: "reserve-open" });
  assert.strictEqual(driverState.reserveOpen, true);
  driverState = ui.reduce(driverState, { type: "reserve-close" });
  assert.strictEqual(driverState.reserveOpen, false);
  const famWin = fakeWindow();
  const famMount = view.mount(famWin);
  famMount.setState(Object.assign(ui.reduce(ui.blank(), {
    type: "ride",
    ride: { rideId: "r_fam", from: "A", to: "B", status: "open", seatsLeft: 3, riders: [{ reservationId: "r1", name: "Sam", seats: 2 }] },
    role: ""
  }), {
    ride: { rideId: "r_fam", from: "A", to: "B", status: "open", seatsLeft: 3, riders: [{ reservationId: "r1", name: "Sam", seats: 2 }] },
    reserveOpen: true
  }));
  assert.ok(famMount.root.children[1].children[0].children.some(function (c) { return c.tag === "select"; }));
  const rUpWin = fakeWindow();
  rUpWin.JumpInCloud = {
    watchBoard: function () { return function () {}; },
    seatSecretFor: function () { return "r_sec"; },
    seatInfoFor: function () { return { reservationId: "r1", name: "Sam", seats: 1 }; },
    updateSeat: function () { return Promise.resolve({ ok: true, seats: 2 }); }
  };
  const rUpMount = view.mount(rUpWin);
  const rUpRide = { rideId: "r_up", from: "A", to: "B", status: "open", departAt: Date.now() + 600000, seatsLeft: 2, riders: [{ reservationId: "r1", name: "Sam", seats: 1 }] };
  rUpMount.setState(Object.assign(ui.reduce(ui.blank(), { type: "ride", ride: rUpRide, role: "rider" }), { ride: rUpRide }));
  const rActions = rUpMount.root.children[1].children[0].children.find(function (c) { return c.className === "action-row"; });
  const rSel = rActions.children.find(function (c) { return c.tag === "select"; });
  const rBtn = rActions.children.find(function (c) { return c.textContent === "Update seats"; });
  rSel.value = "1";
  rBtn._listeners[0]();
  rSel.value = "2";
  rBtn._listeners[0]();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  assert.strictEqual(rUpMount.getState().notice, "Seats updated.");
  rUpWin.JumpInCloud.updateSeat = function () { return Promise.resolve({ ok: false, error: "Full" }); };
  rBtn._listeners[0]();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  assert.strictEqual(rUpMount.getState().error, "Full");
  rUpWin.JumpInCloud.updateSeat = function () { return Promise.reject(new Error("net")); };
  rBtn._listeners[0]();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  assert.ok(rUpMount.getState().error.indexOf("Could not update seats") !== -1);
  const cAttach = require("../../jumpin/cloud.js").attach(fakeWindow());
  cAttach.saveSeat("r_hit", "sec_hit");
  assert.strictEqual(cAttach.seatInfoFor({ riders: [{ reservationId: "r_hit", seats: 2 }] }).seats, 2);
  assert.strictEqual(cAttach.seatInfoFor({ riders: [{ reservationId: "x" }] }), null);
  const addWin = fakeWindow();
  addWin.JumpInCloud = {
    watchBoard: function () { return function () {}; },
    reserveSeat: function () { return Promise.resolve({ ok: true, reservationId: "rsv_dup", seatsLeft: 2, textSent: true }); }
  };
  const addMount = view.mount(addWin);
  const addRide = { rideId: "r_add", from: "A", to: "B", status: "open", seatsLeft: 2, riders: [{ reservationId: "rsv_dup", name: "Sam", seats: 1 }] };
  addMount.setState(Object.assign(ui.reduce(ui.blank(), { type: "ride", ride: addRide, role: "driver" }), { ride: addRide, reserveOpen: true }));
  let scrolled = 0;
  addMount.root.children[1]._listeners.forEach(function (fn) {
    fn({ target: { tagName: "INPUT", scrollIntoView: function () { scrolled++; } } });
    fn({ target: { tagName: "SELECT", scrollIntoView: function () { scrolled++; } } });
    fn({ target: { tagName: "DIV" } });
  });
  assert.strictEqual(scrolled, 2);
  addMount.root.children[1].children[0].children.filter(function (c) { return c.tag === "input"; }).forEach(function (inp) {
    if (inp.name === "name") inp.value = "Sam";
    if (inp.name === "phone") inp.value = "5552345678";
  });
  addMount.root.children[2].children[0]._listeners[0]();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  assert.strictEqual(addMount.getState().ride.seatsLeft, 2);
  assert.strictEqual(addMount.getState().ride.riders.length, 1);
  addWin.JumpInCloud.roleFor = function (ride) {
    if (ride.rideId === "r_open") return "driver";
    if (ride.rideId === "r_last") return "rider";
    return "";
  };
  addMount.setState(Object.assign(ui.blank(), {
    mode: "board",
    rides: [
      { rideId: "r_open", from: "A", to: "B", seatsLeft: 3, when: "Soon" },
      { rideId: "r_last", from: "C", to: "D", seatsLeft: 1, when: "Soon", driverName: "Alex", rideCost: 12 },
      { rideId: "r_full", from: "E", to: "F", seatsLeft: 0, when: "Soon" }
    ]
  }));
  const pills = addMount.root.children[1].children[0].children.find(function (c) { return c.className === "board"; }).children.map(function (row) {
    return row.children[0].children[1].children.map(function (p) { return p.textContent; });
  });
  assert.deepStrictEqual(pills, [["Your trip", "Open"], ["Seat booked", "Last seat"], ["Full"]]);

  const nowTs = Date.now();
  const pagedRides = [];
  for (let i = 0; i < 15; i++) {
    pagedRides.push({
      rideId: "r_pg_" + i,
      from: "City" + i,
      to: "Dest" + i,
      seatsLeft: 2,
      departAt: i === 0 ? nowTs + 60000 : (i === 1 ? nowTs + core.DAY_MS : (i === 2 ? nowTs + 3 * core.DAY_MS : 0)),
      when: "Soon"
    });
  }
  addMount.setState(Object.assign(ui.blank(), { mode: "board", rides: pagedRides }));
  const boardNode = addMount.root.children[1].children[0].children.find(function (c) { return c.className === "board"; });
  const pagerNode = addMount.root.children[1].children[0].children.find(function (c) { return c.className === "pager"; });
  boardNode.scrollIntoView = function () {};
  assert.strictEqual(boardNode.children.length, 12);
  assert.ok(pagerNode.children.some(function (c) { return c.textContent === "Page 1 of 2"; }));
  pagerNode.children.find(function (c) { return c.textContent === "Next ›"; })._listeners[0]();
  assert.strictEqual(boardNode.children.length, 3);
  assert.ok(pagerNode.children.some(function (c) { return c.textContent === "Page 2 of 2"; }));
  const toolsNode = addMount.root.children[1].children[0].children.find(function (c) { return c.className === "board-tools"; });
  const filterChips = toolsNode.children[0].children;
  filterChips[1]._listeners[0](); // Today
  filterChips[2]._listeners[0](); // Tomorrow
  filterChips[3]._listeners[0](); // This week
  const latestTools = addMount.root.children[1].children[0].children.find(function (c) { return c.className === "board-tools"; });
  const searchInp = latestTools.children[1];
  searchInp.value = "NoSuchRoute";
  searchInp._listeners[0]();
  const emptyBox = addMount.root.children[1].children[0].children.find(function (c) { return c.className === "board"; }).children[0];
  emptyBox.children.find(function (c) { return c.textContent === "Show all rides"; })._listeners[0]();
  view.destroy();
});

function fakeWindow() {
  const listeners = {};
  function node(tag) {
    return {
      tag: tag,
      id: "",
      className: "",
      style: {},
      children: [],
      _text: "",
      get textContent() { return this._text; },
      set textContent(value) { this._text = value == null ? "" : String(value); if (this._text === "") this.children = []; },
      attrs: {},
      classList: { classes: [], add: function (name) { this.classes.push(name); }, remove: function (name) { this.classes = this.classes.filter(function (item) { return item !== name; }); } },
      setAttribute: function (name, value) { this.attrs[name] = value; },
      appendChild: function (child) { this.children.push(child); return child; },
      addEventListener: function (type, fn) { (this._listeners = this._listeners || []).push(fn); },
      removeEventListener: function (type, fn) {
        this._listeners = (this._listeners || []).filter(function (item) { return item !== fn; });
      },
      querySelectorAll: function () { return this.children.filter(function (child) { return child.tag === "input"; }); }
    };
  }
  const head = node("head");
  const body = node("body");
  const doc = {
    head: head,
    body: body,
    createElement: node,
    createTextNode: function (value) { const item = node("text"); item.textContent = String(value); return item; },
    getElementById: function (id) {
      if (body.id === id) return body;
      return body.children.filter(function (child) { return child.id === id; })[0] || head.children.filter(function (child) { return child.id === id; })[0] || null;
    }
  };
  const win = {
    document: doc,
    navigator: { userAgent: "iPhone" },
    innerHeight: 700,
    visualViewport: {
      height: 640,
      addEventListener: function (type, fn) { (this._listeners = this._listeners || []).push(fn); },
      removeEventListener: function (type, fn) {
        this._listeners = (this._listeners || []).filter(function (item) { return item !== fn; });
      }
    },
    localStorage: { store: {}, getItem: function (k) { return this.store[k] || null; }, setItem: function (k, v) { this.store[k] = v; }, removeItem: function (k) { delete this.store[k]; } },
    addEventListener: function (type, fn) { (this._listeners = this._listeners || []).push(fn); },
    removeEventListener: function (type, fn) {
      this._listeners = (this._listeners || []).filter(function (item) { return item !== fn; });
    },
    dispatch: function () { win.resizeCount += 1; },
    resizeCount: 0,
    Intl: Intl
  };
  return win;
}

(async function main() {
  console.log("======================================================================");
  console.log("JUMPIN TEST SUITE");
  console.log("======================================================================");
  for (let i = 0; i < tests.length; i++) {
    try {
      await tests[i].fn();
      passed++;
      console.log("  ✓ " + tests[i].name);
    } catch (err) {
      failed++;
      console.error("  ✕ " + tests[i].name);
      console.error("    " + (err && err.stack ? err.stack : err));
    }
  }
  console.log("----------------------------------------------------------------------");
  console.log("Passed " + passed + "  Failed " + failed);
  if (failed) process.exit(1);
})();
