/**
 * JumpIn transactions. Call with a db that has runTransaction(fn).
 * fn receives { get, set, del } and must be retried by the db on conflict.
 */
const core = require("./core.js");

/* c8 ignore next 6 */
let localSecrets = {};
try { localSecrets = require(require("fs").existsSync(__dirname + "/../secrets.json") ? "../secrets.json" : "../functions/secrets.json"); } catch (e) { localSecrets = {}; }
const GENERIC_LINK = "This link no longer works. Request a new text from the ride page.";
const SUPERADMIN_EMAIL = String(process.env.JUMPIN_SUPERADMIN_EMAIL || localSecrets.superadmin_email || "").trim().toLowerCase();
const PLATFORM_ADMIN_PHONE = "+19802531359";
const PLATFORM_SUPPORT_NOTE = String(process.env.JUMPIN_SUPPORT_NOTE || localSecrets.jumpin_support_note || "").trim();

function clone(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function createMemoryDb(seed) {
  const docs = {};
  const versions = {};
  Object.keys(seed || {}).forEach(function (key) {
    docs[key] = clone(seed[key]);
    versions[key] = 1;
  });
  let chain = Promise.resolve();
  let pendingHook = null;
  function runTransaction(fn) {
    const exec = function () {
      return attempt(0);
    };
    function attempt(n) {
      const base = {};
      Object.keys(docs).forEach(function (key) { base[key] = versions[key] || 0; });
      const writes = {};
      const tx = {
        get: function (key) {
          if (Object.prototype.hasOwnProperty.call(writes, key)) return clone(writes[key]);
          return clone(docs[key] == null ? null : docs[key]);
        },
        set: function (key, value) { writes[key] = clone(value); },
        del: function (key) { writes[key] = null; }
      };
      return Promise.resolve(fn(tx)).then(function (result) {
        if (pendingHook) {
          const hook = pendingHook;
          pendingHook = null;
          hook(versions);
        }
        const keys = Object.keys(base);
        for (let i = 0; i < keys.length; i++) {
          if ((versions[keys[i]] || 0) !== base[keys[i]]) {
            if (n >= 7) throw new Error("transaction contention");
            return attempt(n + 1);
          }
        }
        Object.keys(writes).forEach(function (key) {
          if (writes[key] == null) delete docs[key];
          else docs[key] = writes[key];
          versions[key] = (versions[key] || 0) + 1;
        });
        return result;
      });
    }
    const run = chain.then(exec, exec);
    chain = run.then(function () {}, function () {});
    return run;
  }
  return {
    runTransaction: runTransaction,
    snapshot: function () { return clone(docs); },
    interfere: function (hook) { pendingHook = hook; }
  };
}

function gidOf(input) {
  const g = core.normalizeGroupId(input && input.groupId);
  return g || "default";
}

function pathsFor(gid) {
  const g = gid || "default";
  if (g === "default") {
    return {
      groupId: "default",
      config: "settings/carpool_config",
      groupMeta: "carpool_groups/default",
      broadcastIndex: "carpool_private/broadcast_index",
      memberIndex: "carpool_private/member_index",
      blockIndex: "carpool_private/block_index",
      limitIndex: "carpool_private/limit_index",
      audience: function (id) { return "carpool_private/audience/" + id; },
      phone: function (e164) { return "carpool_private/phones/" + core.phoneHash16(e164); },
      block: function (hash) { return "carpool_private/blocks/" + hash; },
      ridePrivate: function (id) { return "carpool_private/rides/" + id; },
      ridePublic: function (id) { return "carpool_public/rides/" + id; },
      reservation: function (rideId, e164) { return "carpool_private/reservations/" + rideId + "_" + core.phoneHash16(e164); },
      limit: function (key) { return "carpool_private/limits/" + key; }
    };
  }
  const base = "carpool_groups/" + g;
  return {
    groupId: g,
    config: base + "/private/config",
    groupMeta: base,
    broadcastIndex: base + "/private/broadcast_index",
    memberIndex: base + "/private/member_index",
    blockIndex: base + "/private/block_index",
    limitIndex: base + "/private/limit_index",
    audience: function (id) { return base + "/audience/" + id; },
    phone: function (e164) { return base + "/phones/" + core.phoneHash16(e164); },
    block: function (hash) { return base + "/blocks/" + hash; },
    ridePrivate: function (id) { return base + "/rides/" + id; },
    ridePublic: function (id) { return base + "/public_rides/" + id; },
    reservation: function (rideId, e164) { return base + "/reservations/" + rideId + "_" + core.phoneHash16(e164); },
    limit: function (key) { return base + "/limits/" + key; }
  };
}

async function groupAccessError(tx, p) {
  if (p.groupId === "default") return "";
  const meta = await tx.get(p.groupMeta);
  if (!meta) return "This community group was not found.";
  if (meta.status === "pending") return "This community group is waiting for approval.";
  if (meta.status === "suspended") return "This community group is currently paused.";
  return "";
}

async function loadPlatformConfig(tx, now) {
  const stored = await tx.get("carpool_platform/config") || {};
  const cap = Number.isInteger(Number(stored.platformDailySmsCap)) ? Math.max(0, Number(stored.platformDailySmsCap)) : 2000;
  const budget = core.smsBudget({ dailySmsCap: cap, dailySmsDay: stored.dailySmsDay, dailySmsSent: stored.dailySmsSent }, now);
  const supportNote = core.collapse(core.stripTags(stored.platformSupportNote || "")).slice(0, 80) || PLATFORM_SUPPORT_NOTE;
  const maintenanceMessage = core.collapse(core.stripTags(stored.maintenanceMessage || "")).slice(0, 200);
  const parsedPhone = stored.platformAdminPhone ? core.normalizePhone(stored.platformAdminPhone) : { ok: false };
  const completeInterval = [5, 10, 15, 30].indexOf(Number(stored.completeTripsIntervalMinutes)) !== -1
    ? Number(stored.completeTripsIntervalMinutes)
    : 5;
  const retainInterval = [24, 48, 72].indexOf(Number(stored.retainTripsIntervalHours)) !== -1
    ? Number(stored.retainTripsIntervalHours)
    : 24;
  return {
    platformEnabled: stored.platformEnabled !== false,
    iosThemeEnabled: stored.iosThemeEnabled === true,
    broadcastSmsEnabled: stored.broadcastSmsEnabled !== false,
    needARideEnabled: stored.needARideEnabled === true,
    maintenanceMessage: maintenanceMessage,
    platformSupportNote: supportNote,
    platformAdminEmail: core.cleanEmail(stored.platformAdminEmail) || SUPERADMIN_EMAIL,
    superAdminEmails: core.cleanAdminEmails(stored.superAdminEmails, true, SUPERADMIN_EMAIL),
    platformAdminPhone: parsedPhone.ok ? parsedPhone.e164 : PLATFORM_ADMIN_PHONE,
    platformDailySmsCap: cap,
    dailySmsDay: budget.day,
    dailySmsSent: budget.sent,
    completeTripsEnabled: stored.completeTripsEnabled !== false,
    completeTripsIntervalMinutes: completeInterval,
    lastCompleteRunAt: Number(stored.lastCompleteRunAt) || 0,
    retainTripsEnabled: stored.retainTripsEnabled !== false,
    retainTripsIntervalHours: retainInterval,
    lastRetainRunAt: Number(stored.lastRetainRunAt) || 0
  };
}

function canSendBoth(config, platform, now) {
  return core.canSend(config, now) && (!platform || platform.dailySmsSent < platform.platformDailySmsCap);
}

async function loadConfig(tx, now, p) {
  const path = p ? p.config : "settings/carpool_config";
  const stored = await tx.get(path);
  const config = core.clampConfig(stored || {}, { groupId: p ? p.groupId : "default" });
  const budget = core.smsBudget(config, now);
  config.dailySmsDay = budget.day;
  config.dailySmsSent = budget.sent;
  return config;
}

function bumpSms(config, platform) {
  config.dailySmsSent += 1;
  if (platform) platform.dailySmsSent += 1;
  return config;
}

function saveConfig(tx, config, p, platform) {
  const path = p ? p.config : "settings/carpool_config";
  tx.set(path, {
    enabled: config.enabled,
    requireRideApproval: config.requireRideApproval,
    membersOnly: config.membersOnly === true,
    adminEmails: config.adminEmails,
    contactEmail: config.contactEmail,
    supportNote: config.supportNote,
    postRideThankYouSms: config.postRideThankYouSms === true,
    dailySmsCap: config.dailySmsCap,
    dailySmsSent: config.dailySmsSent,
    dailySmsDay: config.dailySmsDay,
    maxSeats: config.maxSeats,
    horizonDays: config.horizonDays,
    maxMessagesPerRide: config.maxMessagesPerRide,
    maxPostsPerPhonePerDay: config.maxPostsPerPhonePerDay,
    maxActiveReservationsPerPhone: config.maxActiveReservationsPerPhone,
    maxSmsPerRecord: config.maxSmsPerRecord,
    resendCooldownSec: config.resendCooldownSec
  });
  if (platform) tx.set("carpool_platform/config", platform);
}

function shortRoute(from, to) {
  const f = String(from || "").trim().slice(0, 14);
  const t = String(to || "").trim().slice(0, 14);
  return f && t ? f + "-" + t : (f || t || "trip");
}

function queueText(outbox, to, body, triggerType) {
  outbox.push({ to: to, body: body, triggerType: triggerType, shopSlug: "jumpin" });
}

function freshTexts() { return []; }

function withOutbox(result, texts) {
  result.outbox = arr(texts);
  return result;
}

async function rememberRide(tx, ride, riders, p) {
  const idxPath = p ? p.broadcastIndex : "carpool_private/broadcast_index";
  const index = await tx.get(idxPath) || { rides: [], audience: [] };
  const summary = {
    rideId: ride.rideId,
    kind: ride.kind || "offer",
    status: ride.status,
    departAt: ride.departAt,
    driverName: ride.driverName,
    phoneLast4: core.last4(ride.driverPhoneE164),
    driverPhoneE164: ride.driverPhoneE164,
    requesterName: ride.requesterName || "",
    requesterPhoneE164: ride.requesterPhoneE164 || "",
    seatsRequested: Number(ride.seatsRequested) || 0,
    from: ride.from || "",
    to: ride.to || "",
    note: ride.note || "",
    seatsLeft: ride.seatsLeft,
    seatsTotal: ride.seatsTotal,
    timeZone: ride.timeZone || "UTC",
    riders: arr(riders).filter(function (row) { return row.status === "active" && row.phoneE164; }).map(function (row) {
      return { phoneE164: row.phoneE164, name: row.name || "", phoneLast4: core.last4(row.phoneE164), status: "active" };
    })
  };
  index.rides = arr(index.rides).filter(function (row) { return row.rideId !== ride.rideId; });
  index.rides.push(summary);
  tx.set(idxPath, index);
}

async function rememberAudience(tx, e164, optOut, p) {
  const idxPath = p ? p.broadcastIndex : "carpool_private/broadcast_index";
  const index = await tx.get(idxPath) || { rides: [], audience: [] };
  const audience = arr(index.audience).filter(function (row) { return row.phoneE164 !== e164; });
  audience.push({ phoneE164: e164, smsOptOut: optOut === true });
  index.audience = audience;
  tx.set(idxPath, index);
}

async function touchAudience(tx, e164, name, role, now, p) {
  const id = core.phoneHash16(e164);
  const key = p ? p.audience(id) : ("carpool_private/audience/" + id);
  const prev = await tx.get(key) || { roles: [], smsOptOut: false };
  const roles = prev.roles.slice();
  if (roles.indexOf(role) === -1) roles.push(role);
  const next = {
    displayName: name || prev.displayName || "",
    phoneE164: e164,
    phoneLast4: core.last4(e164),
    roles: roles,
    smsOptOut: false,
    updatedAt: now
  };
  tx.set(key, next);
  await rememberAudience(tx, e164, next.smsOptOut, p);
}

function activeRiders(list) {
  return arr(list).filter(function (row) { return row.status === "active"; });
}

async function memberError(tx, config, e164, p) {
  if (!config.membersOnly) return "";
  const pack = await tx.get(p ? p.memberIndex : "carpool_private/member_index") || { members: [] };
  const hash = core.phoneHash16(e164);
  if (arr(pack.members).some(function (m) { return m.phoneHash === hash; })) return "";
  const contact = config.contactEmail || SUPERADMIN_EMAIL;
  const base = "JumpIn is for approved community members only. Please contact the administrator at " + contact + " to be added.";
  if (!p || p.groupId === "default") return base + " If your neighborhood uses its own group, open the ?g=... link from your organizer.";
  return base;
}

function postRide(db, input, now, rng) {
  const checked = core.postErrors(input || {});
  if (checked.error) return Promise.resolve({ ok: false, field: checked.field, error: checked.error });
  const fields = checked.value;
  let parsed = null;
  try { parsed = core.zonedToUtc(fields.date, fields.time, input.timeZone); } catch (err) { parsed = null; }
  if (parsed == null) {
    return Promise.resolve({ ok: false, field: "time", error: "Choose a later time." });
  }
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    if (!platform.platformEnabled) return { ok: false, error: platform.maintenanceMessage || "JumpIn is temporarily paused for maintenance." };
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const depart = core.departureError(fields.date, fields.time, input.timeZone, now, config.horizonDays);
    if (depart.error) return { ok: false, field: "time", error: depart.error };
    if (fields.seats > config.maxSeats) return { ok: false, field: "seats", error: "Choose seats from 1 to " + config.maxSeats + "." };
    if (fields.seats > config.maxSeats) return { ok: false, field: "seats", error: "Choose seats from 1 to " + config.maxSeats + "." };
    if (await tx.get(p.block(core.phoneHash16(fields.phone)))) return { ok: false, error: "You can't post a ride right now." };
    const notMember = await memberError(tx, config, fields.phone, p);
    if (notMember) return { ok: false, field: "phone", error: notMember, memberDenied: true, contactEmail: config.contactEmail };
    const phone = await tx.get(p.phone(fields.phone)) || { postsDay: core.utcDay(now), postsToday: 0, activeReservations: 0 };
    const today = core.postsToday(phone, now);
    if (today >= config.maxPostsPerPhonePerDay) return { ok: false, error: "You already posted " + config.maxPostsPerPhonePerDay + " trips today." };
    const rideId = core.randomId("ride_", rng);
    const secret = core.randomSecret(rng);
    const status = config.requireRideApproval ? "pending" : "open";
    const ride = {
      rideId: rideId,
      status: status,
      driverName: fields.name,
      driverPhoneE164: fields.phone,
      driverTokenHash: core.hashSecret(secret),
      tokenIssuedAt: now,
      idempotencyKey: input.idempotencyKey || "",
      idempotencySecret: secret,
      idempotencyExpiresAt: now + core.IDEMPOTENCY_MS,
      from: fields.from,
      to: fields.to,
      departAt: depart.departAt,
      durationMinutes: fields.durationMinutes,
      timeZone: input.timeZone,
      seatsTotal: fields.seats,
      seatsLeft: fields.seats,
      rideCost: fields.rideCost || 0,
      note: fields.note,
      smsSent: 0,
      activeReservationDocIds: [],
      createdAt: now,
      cancelledAt: null,
      completedAt: null
    };
    const message = core.systemMessage("Trip posted.", now, 1);
    const pub = core.publicRide(ride, [], [message]);
    pub.updatedAt = now;
    const sent = canSendBoth(config, platform, now);
    if (sent) {
      ride.smsSent = 1;
      bumpSms(config, platform);
      const routeTag = shortRoute(fields.from, fields.to);
      const body = status === "pending"
        ? "JumpIn pending (" + routeTag + "): " + manageUrl("trip", rideId, secret, rideId, p.groupId)
        : "JumpIn posted (" + routeTag + "): " + manageUrl("trip", rideId, secret, rideId, p.groupId);
      queueText(texts, fields.phone, body, "CARPOOL_DRIVER_LINK");
    }
    phone.postsDay = core.utcDay(now);
    phone.postsToday = today + 1;
    phone.updatedAt = now;
    tx.set(p.ridePrivate(rideId), ride);
    tx.set(p.ridePublic(rideId), pub);
    tx.set(p.phone(fields.phone), phone);
    await touchAudience(tx, fields.phone, fields.name, "driver", now, p);
    await rememberRide(tx, ride, [], p);
    saveConfig(tx, config, p, sent ? platform : null);
    return {
      ok: true,
      rideId: rideId,
      secret: secret,
      status: status,
      textSent: sent,
      texts: texts,
      error: sent ? "" : "Trip posted on this browser. Text could not be sent right now."
    };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function reserveSeat(db, input, now, rng) {
  const checked = core.reserveErrors(input || {});
  if (checked.error) return Promise.resolve({ ok: false, field: checked.field, error: checked.error });
  const fields = checked.value;
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    if (!platform.platformEnabled) return { ok: false, error: platform.maintenanceMessage || "JumpIn is temporarily paused for maintenance." };
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride) return { ok: false, error: "This ride is not available." };
    if (ride.status === "cancelled") return { ok: false, error: "This trip was cancelled." };
    if (ride.status === "rejected") return { ok: false, error: "This trip was not approved." };
    if (ride.status === "pending") return { ok: false, error: "Waiting for approval." };
    if (ride.status !== "open" || ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (ride.kind === "request") return { ok: false, error: "This ride still needs a driver." };
    if (fields.phone === ride.driverPhoneE164) return { ok: false, error: "The driver already has this trip." };
    const requested = fields.seats || 1;
    if (ride.seatsLeft < requested) {
      return {
        ok: false,
        error: ride.seatsLeft < 1
          ? "That seat was just taken."
          : (ride.seatsLeft === 1 ? "Only 1 seat is left." : "Only " + ride.seatsLeft + " seats are left.")
      };
    }
    const notMember = await memberError(tx, config, fields.phone, p);
    if (notMember) return { ok: false, field: "phone", error: notMember, memberDenied: true, contactEmail: config.contactEmail };
    const phone = await tx.get(p.phone(fields.phone)) || { postsDay: core.utcDay(now), postsToday: 0, activeReservations: 0 };
    if (core.activeReservations(phone) >= config.maxActiveReservationsPerPhone) {
      return { ok: false, error: "You already have " + config.maxActiveReservationsPerPhone + " upcoming seats." };
    }
    const key = p.reservation(ride.rideId, fields.phone);
    const existing = await tx.get(key);
    if (existing && existing.status === "active") {
      const sameKey = input.idempotencyKey && existing.idempotencyKey === input.idempotencyKey;
      if (sameKey && existing.idempotencySecret && existing.idempotencyExpiresAt > now) {
        return { ok: true, reservationId: existing.reservationId, secret: existing.idempotencySecret, already: true, textSent: false };
      }
      return { ok: false, error: "You already have this seat." };
    }
    const secret = core.randomSecret(rng);
    const reservationId = core.randomId("rsv_", rng);
    const reservation = {
      reservationId: reservationId,
      rideId: ride.rideId,
      name: fields.name,
      phoneE164: fields.phone,
      seats: requested,
      dropoff: fields.dropoff || "",
      status: "active",
      tokenHash: core.hashSecret(secret),
      tokenIssuedAt: now,
      idempotencyKey: input.idempotencyKey || "",
      idempotencySecret: secret,
      idempotencyExpiresAt: now + core.IDEMPOTENCY_MS,
      smsSent: 0,
      createdAt: existing ? existing.createdAt : now,
      cancelledAt: null
    };
    ride.seatsLeft -= requested;
    if (ride.activeReservationDocIds.indexOf(key) === -1) ride.activeReservationDocIds.push(key);
    phone.activeReservations = core.activeReservations(phone) + 1;
    phone.updatedAt = now;
    const pub = await tx.get(p.ridePublic(ride.rideId)) || core.publicRide(ride, [], []);
    pub.seatsLeft = ride.seatsLeft;
    pub.riders = activeRiders(pub.riders).concat([{ reservationId: reservationId, name: fields.name, seats: requested, dropoff: fields.dropoff || "", driverSeenAt: input.driverAck === true ? now : 0, status: "active" }]);
    const reserveMsg = requested === 1 ? (fields.name + " reserved a seat.") : (fields.name + " reserved " + requested + " seats.");
    pub.messages = arr(pub.messages).concat([core.systemMessage(reserveMsg, now, pub.messages.length + 1)]);
    pub.updatedAt = now;
    pub.status = ride.status;
    const sent = canSendBoth(config, platform, now);
    if (sent) {
      reservation.smsSent = 1;
      bumpSms(config, platform);
      const when = core.formatWhen(ride.departAt, ride.timeZone);
      const seatWord = requested === 1 ? "seat" : (requested + " seats");
      queueText(texts, fields.phone, "JumpIn " + seatWord + " (" + shortRoute(ride.from, ride.to) + "): " + manageUrl("seat", reservationId, secret, ride.rideId, p.groupId), "CARPOOL_RIDER_LINK");
    }
    tx.set(key, reservation);
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.ridePublic(ride.rideId), pub);
    tx.set(p.phone(fields.phone), phone);
    await touchAudience(tx, fields.phone, fields.name, "rider", now, p);
    const riderRows = [];
    for (let i = 0; i < ride.activeReservationDocIds.length; i++) {
      const docId = ride.activeReservationDocIds[i];
      const row = docId === key ? reservation : await tx.get(docId);
      if (row && row.status === "active") riderRows.push({ phoneE164: row.phoneE164, name: row.name || "", status: "active" });
    }
    await rememberRide(tx, ride, riderRows, p);
    saveConfig(tx, config, p, sent ? platform : null);
    return {
      ok: true,
      reservationId: reservationId,
      secret: secret,
      seatsLeft: ride.seatsLeft,
      textSent: sent,
      texts: texts,
      error: sent ? "" : "Seat saved on this browser. Text could not be sent right now."
    };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function assertSecret(presented, hash) {
  if (!presented || !hash || !core.timingSafeEqual(core.hashSecret(presented), hash)) return false;
  return true;
}

function updateSeat(db, input, now) {
  const seats = Number(input && input.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) {
    return Promise.resolve({ ok: false, error: "Choose seats from 1 to 6." });
  }
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const key = await findReservationKey(tx, input, p);
    const reservation = key ? await tx.get(key) : null;
    if (!reservation || !assertSecret(input.secret, reservation.tokenHash)) return { ok: false, error: GENERIC_LINK };
    const ride = await tx.get(p.ridePrivate(reservation.rideId));
    if (!ride || ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (ride.status !== "open" || reservation.status !== "active") return { ok: false, error: GENERIC_LINK };
    const oldSeats = Number(reservation.seats) || 1;
    const delta = seats - oldSeats;
    if (delta === 0) return { ok: true, already: true, seats: seats };
    if (delta > 0 && ride.seatsLeft < delta) {
      return {
        ok: false,
        error: ride.seatsLeft < 1
          ? "No extra seats are left."
          : (ride.seatsLeft === 1 ? "Only 1 more seat is left." : "Only " + ride.seatsLeft + " more seats are left.")
      };
    }
    const pub = await tx.get(p.ridePublic(ride.rideId));
    const riderRows = [];
    reservation.seats = seats;
    ride.seatsLeft = Math.max(0, Math.min(Number(ride.seatsTotal) || 0, (Number(ride.seatsLeft) || 0) - delta));
    for (let i = 0; i < ride.activeReservationDocIds.length; i++) {
      const docId = ride.activeReservationDocIds[i];
      const row = docId === key ? reservation : await tx.get(docId);
      if (row && row.status === "active") riderRows.push({ phoneE164: row.phoneE164, name: row.name || "", status: "active" });
    }
    if (pub) {
      pub.seatsLeft = ride.seatsLeft;
      pub.riders = arr(pub.riders).map(function (row) {
        if (row.reservationId === reservation.reservationId) return { reservationId: row.reservationId, name: row.name, seats: seats, dropoff: reservation.dropoff || row.dropoff || "", driverSeenAt: delta > 0 ? 0 : (row.driverSeenAt || 0), status: "active" };
        return row;
      });
      const word = seats === 1 ? "1 seat." : (seats + " seats.");
      pub.messages = arr(pub.messages).concat([core.systemMessage(reservation.name + " updated to " + word, now, arr(pub.messages).length + 1)]);
      pub.updatedAt = now;
      tx.set(p.ridePublic(ride.rideId), pub);
    }
    if (ride.driverPhoneE164 && canSendBoth(config, platform, now)) {
      bumpSms(config, platform);
      queueText(texts, ride.driverPhoneE164, "JumpIn (" + shortRoute(ride.from, ride.to) + "): " + reservation.name + " updated seats to " + seats + ". " + manageUrl("ride", ride.rideId, "", "", p.groupId), "CARPOOL_SEAT_UPDATED");
    }
    notifyWaitlist(ride, config, platform, now, texts, p);
    tx.set(key, reservation);
    tx.set(p.ridePrivate(ride.rideId), ride);
    await rememberRide(tx, ride, riderRows, p);
    if (texts.length) saveConfig(tx, config, p, platform);
    return { ok: true, seats: seats, seatsLeft: ride.seatsLeft, ride: pub, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function notifyWaitlist(ride, config, platform, now, texts, p) {
  const list = arr(ride && ride.waitlistPhones);
  if (!list.length || (Number(ride && ride.seatsLeft) || 0) < 1) return false;
  ride.waitlistPhones = [];
  const body = "JumpIn (" + shortRoute(ride.from, ride.to) + "): Seat open! " + manageUrl("ride", ride.rideId, "", "", p.groupId);
  for (let i = 0; i < list.length; i++) {
    if (!canSendBoth(config, platform, now)) break;
    bumpSms(config, platform);
    queueText(texts, list[i], body, "CARPOOL_SEAT_OPEN");
  }
  return true;
}

function joinWaitlist(db, input, now) {
  const parsed = core.normalizePhone(input && input.phone);
  if (!parsed.ok) return Promise.resolve({ ok: false, field: "phone", error: parsed.error });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const platform = await loadPlatformConfig(tx, now);
    if (!platform.platformEnabled) return { ok: false, error: platform.maintenanceMessage || "JumpIn is temporarily paused for maintenance." };
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input && input.rideId));
    if (!ride || ride.status !== "open" || ride.departAt <= now) return { ok: false, error: "This trip is no longer open." };
    if ((Number(ride.seatsLeft) || 0) > 0) return { ok: false, error: "Seats are available now — reserve your seat!" };
    if (await tx.get(p.block(core.phoneHash16(parsed.e164)))) return { ok: false, error: "You can't join this waitlist right now." };
    const notMember = await memberError(tx, config, parsed.e164, p);
    if (notMember) return { ok: false, field: "phone", error: notMember, memberDenied: true, contactEmail: config.contactEmail };
    if (parsed.e164 === ride.driverPhoneE164) return { ok: false, error: "You are the driver of this trip." };
    const keys = arr(ride.activeReservationDocIds);
    for (let i = 0; i < keys.length; i++) {
      const row = await tx.get(keys[i]);
      if (row && row.status === "active" && row.phoneE164 === parsed.e164) {
        return { ok: false, error: "You already have a seat on this trip." };
      }
    }
    const list = arr(ride.waitlistPhones);
    if (list.indexOf(parsed.e164) !== -1) return { ok: true, already: true };
    if (list.length >= 15) return { ok: false, error: "Waitlist is full for this trip." };
    ride.waitlistPhones = list.concat([parsed.e164]);
    tx.set(p.ridePrivate(ride.rideId), ride);
    return { ok: true };
  });
}

function cancelSeat(db, input, now) {
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const key = await findReservationKey(tx, input, p);
    const reservation = key ? await tx.get(key) : null;
    if (!reservation || !assertSecret(input.secret, reservation.tokenHash)) return { ok: false, error: GENERIC_LINK };
    const ride = await tx.get(p.ridePrivate(reservation.rideId));
    if (!ride || ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (ride.status === "cancelled" || reservation.status === "cancelled") return { ok: true, already: true };
    if (ride.status !== "open" && ride.status !== "pending") return { ok: false, error: GENERIC_LINK };
    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    reservation.idempotencySecret = "";
    ride.seatsLeft = Math.min(Number(ride.seatsTotal) || 0, (Number(ride.seatsLeft) || 0) + (Number(reservation.seats) || 1));
    const phone = await tx.get(p.phone(reservation.phoneE164)) || { activeReservations: 0 };
    phone.activeReservations = Math.max(0, core.activeReservations(phone) - 1);
    const pub = await tx.get(p.ridePublic(ride.rideId));
    const riderRows = [];
    for (let i = 0; i < ride.activeReservationDocIds.length; i++) {
      const docId = ride.activeReservationDocIds[i];
      const row = docId === key ? reservation : await tx.get(docId);
      if (row && row.status === "active") riderRows.push({ phoneE164: row.phoneE164, name: row.name || "", status: "active" });
    }
    notifyWaitlist(ride, config, platform, now, texts, p);
    if (pub) {
      pub.seatsLeft = ride.seatsLeft;
      pub.riders = arr(pub.riders).map(function (row) {
        if (row.reservationId === reservation.reservationId) return { reservationId: row.reservationId, name: row.name, status: "cancelled" };
        return row;
      }).filter(function (row) { return row.status === "active"; });
      pub.messages = arr(pub.messages).concat([core.systemMessage(reservation.name + " cancelled.", now, arr(pub.messages).length + 1)]);
      pub.updatedAt = now;
      tx.set(p.ridePublic(ride.rideId), pub);
    }
    tx.set(key, reservation);
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.phone(reservation.phoneE164), phone);
    await rememberRide(tx, ride, riderRows, p);
    if (texts.length) saveConfig(tx, config, p, platform);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function removeRider(db, input, now) {
  if (!input || !input.rideId || !input.reservationId) {
    return Promise.resolve({ ok: false, error: "Passenger not found." });
  }
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || !assertSecret(input.secret, ride.driverTokenHash)) return { ok: false, error: GENERIC_LINK };
    if (ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (ride.status !== "open") return { ok: false, error: "This trip is not open." };
    const keys = arr(ride.activeReservationDocIds);
    let targetKey = "";
    let target = null;
    const riderRows = [];
    let remainingSeats = 0;
    for (let i = 0; i < keys.length; i++) {
      const row = await tx.get(keys[i]);
      if (!row) continue;
      if (row.reservationId === input.reservationId) {
        targetKey = keys[i];
        target = row;
      } else if (row.status === "active") {
        remainingSeats += Number(row.seats) || 1;
        riderRows.push({ phoneE164: row.phoneE164, name: row.name || "", status: "active" });
      }
    }
    if (!target) return { ok: false, error: "Passenger not found." };
    if (target.status === "cancelled") return { ok: true, already: true, seatsLeft: ride.seatsLeft };
    const oldSeats = Number(target.seats) || 1;
    const keepSeats = input.keepSeats == null ? 0 : Number(input.keepSeats);
    if (!Number.isInteger(keepSeats) || keepSeats < 0 || keepSeats > 6) {
      return { ok: false, error: "Choose seats from 0 to 6." };
    }
    if (keepSeats === oldSeats) return { ok: true, already: true, seatsLeft: ride.seatsLeft, keepSeats: keepSeats };
    if (keepSeats > 0 && remainingSeats + keepSeats > (Number(ride.seatsTotal) || 0)) {
      return { ok: false, error: "Not enough seats left on this trip." };
    }
    const freed = oldSeats - keepSeats;
    const pub = await tx.get(p.ridePublic(ride.rideId)) || core.publicRide(ride, [], []);
    const phone = await tx.get(p.phone(target.phoneE164)) || { activeReservations: 0 };
    if (keepSeats === 0) {
      target.status = "cancelled";
      target.cancelledAt = now;
      target.removedByDriver = true;
      target.idempotencySecret = "";
      phone.activeReservations = Math.max(0, core.activeReservations(phone) - 1);
      tx.set(p.phone(target.phoneE164), phone);
      pub.riders = arr(pub.riders).filter(function (row) { return row.reservationId !== target.reservationId; });
    } else {
      target.seats = keepSeats;
      riderRows.push({ phoneE164: target.phoneE164, name: target.name || "", status: "active" });
      pub.riders = arr(pub.riders).map(function (row) {
        if (row.reservationId === target.reservationId) return Object.assign({}, row, { seats: keepSeats });
        return row;
      });
    }
    ride.seatsLeft = Math.max(0, Math.min(Number(ride.seatsTotal) || 0, (Number(ride.seatsTotal) || 0) - (remainingSeats + keepSeats)));
    pub.seatsLeft = ride.seatsLeft;
    const deltaCount = Math.abs(freed);
    const deltaWord = deltaCount === 1 ? "1 seat" : deltaCount + " seats";
    const sysText = keepSeats === 0
      ? (target.name || "Passenger") + " removed by driver (" + deltaWord + " freed)."
      : (target.name || "Passenger") + " updated to " + (keepSeats === 1 ? "1 seat" : keepSeats + " seats") + " by driver (" + (freed > 0 ? deltaWord + " freed" : deltaWord + " added") + ").";
    pub.messages = arr(pub.messages).concat([core.systemMessage(sysText, now, arr(pub.messages).length + 1)]);
    pub.updatedAt = now;
    if (target.phoneE164 && canSendBoth(config, platform, now)) {
      bumpSms(config, platform);
      const body = keepSeats === 0
        ? "JumpIn (" + shortRoute(ride.from, ride.to) + "): Driver removed your seat. " + manageUrl("ride", ride.rideId, "", "", p.groupId)
        : "JumpIn (" + shortRoute(ride.from, ride.to) + "): Driver updated your seats to " + keepSeats + ". " + manageUrl("ride", ride.rideId, "", "", p.groupId);
      queueText(texts, target.phoneE164, body, keepSeats === 0 ? "CARPOOL_RIDER_REMOVED" : "CARPOOL_RIDER_UPDATED");
    }
    notifyWaitlist(ride, config, platform, now, texts, p);
    tx.set(targetKey, target);
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.ridePublic(ride.rideId), pub);
    await rememberRide(tx, ride, riderRows, p);
    saveConfig(tx, config, p, texts.length ? platform : null);
    return { ok: true, seatsLeft: ride.seatsLeft, keepSeats: keepSeats, ride: pub, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

async function findReservationKey(tx, input, p) {
  if (input.reservationDocId) return input.reservationDocId;
  if (input.rideId && input.phone) {
    const phone = core.normalizePhone(input.phone);
    return p.reservation(input.rideId, phone.ok ? phone.e164 : input.phone);
  }
  if (input.rideId && input.secret) {
    const ride = await tx.get(p.ridePrivate(input.rideId));
    const keys = arr(ride && ride.activeReservationDocIds);
    for (let i = 0; i < keys.length; i++) {
      const row = await tx.get(keys[i]);
      if (row && assertSecret(input.secret, row.tokenHash)) return keys[i];
    }
  }
  return input.reservationKey || "";
}

function completeTrip(db, input, now) {
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || !assertSecret(input.secret, ride.driverTokenHash)) return { ok: false, error: GENERIC_LINK };
    if (ride.status === "completed") return { ok: true, already: true, texts: [] };
    if (ride.status !== "open") return { ok: false, error: GENERIC_LINK };
    if (ride.departAt > now) return { ok: false, error: "You can complete this trip after it departs." };
    const pub = await tx.get(p.ridePublic(ride.rideId));
    const index = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
    const phones = [];
    let activeRiderCount = 0;
    const keys = arr(ride.activeReservationDocIds);
    for (let k = 0; k < keys.length; k++) {
      const res = await tx.get(keys[k]);
      if (res && res.status === "active") {
        activeRiderCount += 1;
        if (!ride.thankYouSentAt && config.postRideThankYouSms && config.supportNote && res.phoneE164 && phones.indexOf(res.phoneE164) === -1) phones.push(res.phoneE164);
      }
    }
    if (!activeRiderCount) return { ok: false, error: "No active passengers remain on this trip. Use Cancel trip instead." };
    if (phones.length && ride.driverPhoneE164 && phones.indexOf(ride.driverPhoneE164) === -1) phones.unshift(ride.driverPhoneE164);
    ride.status = "completed";
    ride.completedAt = now;
    if (phones.length) {
      ride.thankYouSentAt = now;
      const body = "JumpIn ride done (" + shortRoute(ride.from, ride.to) + "). Free tool - chip in $1-$2: " + config.supportNote;
      phones.forEach(function (ph) {
        if (canSendBoth(config, platform, now)) {
          bumpSms(config, platform);
          queueText(texts, ph, body, "CARPOOL_THANKYOU");
        }
      });
    }
    if (pub) {
      pub.status = "completed";
      pub.messages = arr(pub.messages).concat([core.systemMessage("Trip completed.", now, arr(pub.messages).length + 1)]);
      pub.updatedAt = now;
      tx.set(p.ridePublic(ride.rideId), pub);
    }
    tx.set(p.ridePrivate(ride.rideId), ride);
    const rides = arr(index.rides);
    rides.forEach(function (row) {
      if (row.rideId === ride.rideId) row.status = "completed";
    });
    tx.set(p.broadcastIndex, { rides: rides, audience: arr(index.audience) });
    if (texts.length) saveConfig(tx, config, p, platform);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function editRide(db, input, now) {
  const checked = core.editErrors(input || {});
  if (checked.error) return Promise.resolve({ ok: false, field: checked.field, error: checked.error });
  const fields = checked.value;
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    if (!platform.platformEnabled) return { ok: false, error: platform.maintenanceMessage || "JumpIn is temporarily paused for maintenance." };
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || !assertSecret(input.secret, ride.driverTokenHash)) return { ok: false, error: GENERIC_LINK };
    if (ride.status !== "open" && ride.status !== "pending") return { ok: false, error: "This trip can no longer be edited." };
    if (ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    const tz = ride.timeZone || input.timeZone || "UTC";
    const depart = core.departureError(fields.date, fields.time, tz, now, config.horizonDays);
    if (depart.error) return { ok: false, field: "time", error: depart.error };
    if (fields.seats > config.maxSeats) return { ok: false, field: "seats", error: "Choose seats from 1 to " + config.maxSeats + "." };
    const keys = arr(ride.activeReservationDocIds);
    const activeRiders = [];
    let bookedSeats = 0;
    for (let i = 0; i < keys.length; i++) {
      const reservation = await tx.get(keys[i]);
      if (!reservation || reservation.status !== "active") continue;
      bookedSeats += Number(reservation.seats) || 1;
      activeRiders.push({ docKey: keys[i], phoneE164: reservation.phoneE164, name: reservation.name || "", status: "active" });
    }
    if (fields.seats < bookedSeats) {
      return { ok: false, field: "seats", error: bookedSeats === 1 ? "1 seat is already reserved." : (bookedSeats + " seats are already reserved.") };
    }
    const timeChanged = depart.departAt !== ride.departAt;
    const seatsChanged = fields.seats !== ride.seatsTotal;
    const noteChanged = fields.note !== (ride.note || "");
    const pub = await tx.get(p.ridePublic(ride.rideId)) || core.publicRide(ride, [], []);
    if (!timeChanged && !seatsChanged && !noteChanged) return { ok: true, unchanged: true, ride: pub };
    const edits = Number(ride.editCount) || 0;
    if ((timeChanged || noteChanged) && edits >= 15) return { ok: false, error: "This trip reached the maximum number of edits (15)." };
    const changes = [];
    const smsParts = [];
    if (timeChanged) {
      const newWhen = core.formatWhen(depart.departAt, tz);
      changes.push("time -> " + newWhen);
      smsParts.push("Time " + newWhen);
    }
    if (seatsChanged) changes.push("seats -> " + fields.seats);
    if (noteChanged) {
      changes.push(fields.note ? "note updated" : "note cleared");
      smsParts.push(fields.note ? "Note: " + fields.note.slice(0, 60) : "Note cleared");
    }
    ride.departAt = depart.departAt;
    ride.seatsTotal = fields.seats;
    ride.seatsLeft = fields.seats - bookedSeats;
    ride.note = fields.note;
    if (timeChanged || noteChanged) ride.editCount = edits + 1;
    ride.updatedAt = now;
    pub.departAt = ride.departAt;
    pub.seatsTotal = ride.seatsTotal;
    pub.seatsLeft = ride.seatsLeft;
    pub.note = ride.note;
    pub.messages = arr(pub.messages).concat([core.systemMessage("Trip updated: " + changes.join(", ") + ".", now, arr(pub.messages).length + 1)]);
    pub.updatedAt = now;
    if (smsParts.length && activeRiders.length) {
      const routeTag = shortRoute(ride.from, ride.to);
      const rideLink = manageUrl("ride", ride.rideId, "", "", p.groupId);
      const body = "JumpIn update (" + routeTag + "): " + smsParts.join("; ") + ". " + rideLink;
      for (let i = 0; i < activeRiders.length; i++) {
        if (!canSendBoth(config, platform, now)) break;
        bumpSms(config, platform);
        queueText(texts, activeRiders[i].phoneE164, body, "CARPOOL_TRIP_UPDATED");
      }
    }
    notifyWaitlist(ride, config, platform, now, texts, p);
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.ridePublic(ride.rideId), pub);
    await rememberRide(tx, ride, activeRiders, p);
    saveConfig(tx, config, p, texts.length ? platform : null);
    return { ok: true, ride: pub, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function cancelTrip(db, input, now) {
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || !assertSecret(input.secret, ride.driverTokenHash)) return { ok: false, error: GENERIC_LINK };
    if (completionDeadline(ride) <= now) return { ok: false, error: "This trip has already left." };
    if (ride.status !== "open" && ride.status !== "pending") {
      if (ride.status === "cancelled") return { ok: true, already: true };
      return { ok: false, error: GENERIC_LINK };
    }
    await releaseRide(tx, ride, now, texts, config, "Trip cancelled.", false, p, platform);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

async function releaseRide(tx, ride, now, outbox, config, systemText, admin, p, platform) {
  const pub = await tx.get(p.ridePublic(ride.rideId)) || core.publicRide(ride, [], []);
  const keys = arr(ride.activeReservationDocIds);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const reservation = await tx.get(key);
    if (!reservation || reservation.status !== "active") continue;
    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    const phone = await tx.get(p.phone(reservation.phoneE164)) || { activeReservations: 0 };
    phone.activeReservations = Math.max(0, core.activeReservations(phone) - 1);
    tx.set(p.phone(reservation.phoneE164), phone);
    tx.set(key, reservation);
    if (canSendBoth(config, platform, now)) {
      bumpSms(config, platform);
      const when = core.formatWhen(ride.departAt, ride.timeZone);
      const body = admin
        ? "JumpIn admin cancelled (" + shortRoute(ride.from, ride.to) + ", " + when + ")."
        : (ride.claimedFromRequest
          ? "JumpIn trip cancelled (" + shortRoute(ride.from, ride.to) + ", " + when + "). Post a new request if you still need a ride."
          : "JumpIn trip cancelled (" + shortRoute(ride.from, ride.to) + ", " + when + ").");
      queueText(outbox, reservation.phoneE164, body, "CARPOOL_TRIP_CANCELLED");
    }
  }
  const notifyOwnerPhone = ride.kind === "request" ? ride.requesterPhoneE164 : ride.driverPhoneE164;
  if (admin && notifyOwnerPhone && canSendBoth(config, platform, now)) {
    bumpSms(config, platform);
    const when = core.formatWhen(ride.departAt, ride.timeZone);
    queueText(outbox, notifyOwnerPhone, "JumpIn admin cancelled (" + shortRoute(ride.from, ride.to) + ", " + when + ").", "CARPOOL_TRIP_CANCELLED");
  }
  ride.status = "cancelled";
  ride.cancelledAt = now;
  ride.seatsLeft = 0;
  pub.status = "cancelled";
  pub.seatsLeft = 0;
  pub.riders = [];
  pub.messages = arr(pub.messages).concat([core.systemMessage(systemText, now, arr(pub.messages).length + 1)]);
  pub.updatedAt = now;
  tx.set(p.ridePrivate(ride.rideId), ride);
  tx.set(p.ridePublic(ride.rideId), pub);
  await rememberRide(tx, ride, [], p);
  saveConfig(tx, config, p, outbox.length ? platform : null);
}

const MESSAGE_GRACE_MS = 60 * 60 * 1000;

function completionDeadline(ride) {
  const mins = Number(ride && ride.durationMinutes);
  const durationMs = Number.isFinite(mins) && mins > 0 ? mins * 60 * 1000 : 0;
  return Number((ride && ride.departAt) || 0) + durationMs + MESSAGE_GRACE_MS;
}

function postMessage(db, input, now) {
  const checked = core.messageError(input.text);
  if (checked.error) return Promise.resolve({ ok: false, error: checked.error });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || ride.status !== "open" || completionDeadline(ride) <= now) return { ok: false, error: GENERIC_LINK };
    let authorName = "";
    let authorRole = "";
    const riderPhones = [];
    const keys = arr(ride.activeReservationDocIds);
    for (let i = 0; i < keys.length; i++) {
      const reservation = await tx.get(keys[i]);
      if (!reservation || reservation.status !== "active") continue;
      if (reservation.phoneE164) riderPhones.push(reservation.phoneE164);
      if (!authorRole && assertSecret(input.secret, reservation.tokenHash)) {
        authorName = reservation.name;
        authorRole = "rider";
      }
    }
    if (assertSecret(input.secret, ride.driverTokenHash)) {
      authorName = ride.driverName;
      authorRole = "driver";
    }
    if (!authorRole) return { ok: false, error: GENERIC_LINK };
    const pub = await tx.get(p.ridePublic(ride.rideId));
    if (!pub) return { ok: false, error: GENERIC_LINK };
    const messages = arr(pub.messages);
    if (messages.length >= config.maxMessagesPerRide) return { ok: false, error: "This trip thread is full." };
    messages.push({
      messageId: "msg_" + now + "_" + (messages.length + 1),
      kind: "user",
      authorName: authorName,
      authorRole: authorRole,
      text: checked.value,
      createdAt: now
    });
    pub.messages = messages;
    pub.updatedAt = now;
    const targets = authorRole === "driver" ? riderPhones : [ride.driverPhoneE164];
    const gPrefix = p.groupId !== "default" ? "g=" + encodeURIComponent(p.groupId) + "&" : "";
    const noteBody = "JumpIn (" + shortRoute(ride.from, ride.to) + ") " + authorName + ": " + checked.value + " https://waitlink.app/jumpin?" + gPrefix + "view=ride&ride=" + ride.rideId;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i] && canSendBoth(config, platform, now)) {
        bumpSms(config, platform);
        queueText(texts, targets[i], noteBody, "CARPOOL_MESSAGE");
      }
    }
    tx.set(p.ridePublic(ride.rideId), pub);
    saveConfig(tx, config, p, texts.length ? platform : null);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function ackRider(db, input, now) {
  const body = input || {};
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(body));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const config = await loadConfig(tx, clock, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(body.rideId));
    if (!ride || !assertSecret(body.secret, ride.driverTokenHash)) return { ok: false, error: GENERIC_LINK };
    const pub = await tx.get(p.ridePublic(ride.rideId));
    if (!pub) return { ok: false, error: GENERIC_LINK };
    let found = false;
    let nextSeen = 0;
    pub.riders = arr(pub.riders).map(function (row) {
      if (row.reservationId === body.reservationId && row.status === "active") {
        found = true;
        nextSeen = body.seen === false ? 0 : clock;
        return Object.assign({}, row, { driverSeenAt: nextSeen });
      }
      return row;
    });
    if (!found) return { ok: false, error: GENERIC_LINK };
    pub.updatedAt = clock;
    tx.set(p.ridePublic(ride.rideId), pub);
    return { ok: true, driverSeenAt: nextSeen };
  });
}

function sendManageLink(db, input, now, rng) {
  const phone = core.normalizePhone(input.phone);
  if (!phone.ok) return Promise.resolve({ ok: false, field: "phone", error: phone.error, phrase: core.recoveryPhrase() });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: true, phrase: core.recoveryPhrase() };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: true, phrase: core.recoveryPhrase() };
    const limitId = p.limit(core.phoneHash16(input.ip || "unknown") + "_" + core.utcDay(now) + "T" + new Date(now).getUTCHours());
    const limit = await tx.get(limitId) || { recoveryCalls: 0, expiresAt: now + core.DAY_MS };
    if (limit.recoveryCalls >= 10) return { ok: true, phrase: core.recoveryPhrase() };
    limit.recoveryCalls += 1;
    limit.expiresAt = limit.expiresAt || now + core.DAY_MS;
    tx.set(limitId, limit);
    const limitIndex = await tx.get(p.limitIndex) || { keys: [] };
    if (limitIndex.keys.indexOf(limitId) === -1) limitIndex.keys.push(limitId);
    tx.set(p.limitIndex, limitIndex);
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || (ride.status !== "open" && ride.status !== "pending") || completionDeadline(ride) <= now) return { ok: true, phrase: core.recoveryPhrase() };
    let target = null;
    let kind = "";
    if (ride.kind === "request") {
      if (input.role === "rider" && ride.requesterPhoneE164 === phone.e164) {
        target = ride;
        kind = "request";
      }
    } else if (input.role === "driver" && ride.driverPhoneE164 === phone.e164) {
      target = ride;
      kind = "trip";
    } else if (input.role === "rider") {
      const reservation = await tx.get(p.reservation(ride.rideId, phone.e164));
      if (reservation && reservation.status === "active") {
        target = reservation;
        kind = "seat";
      }
    }
    if (!target) return { ok: true, phrase: core.recoveryPhrase() };
    if (target.smsSent >= config.maxSmsPerRecord) return { ok: true, phrase: core.recoveryPhrase() };
    if (target.tokenIssuedAt && now - target.tokenIssuedAt < config.resendCooldownSec * 1000 && target.smsSent > 0) {
      return { ok: true, phrase: core.recoveryPhrase() };
    }
    if (!canSendBoth(config, platform, now)) return { ok: true, phrase: core.recoveryPhrase() };
    const secret = core.randomSecret(rng);
    const hashed = core.hashSecret(secret);
    if (kind === "trip") target.driverTokenHash = hashed;
    else if (kind === "request") target.requesterSecretHash = core.sha256Hex(secret);
    else target.tokenHash = hashed;
    target.tokenIssuedAt = now;
    target.smsSent = (target.smsSent || 0) + 1;
    target.idempotencySecret = "";
    bumpSms(config, platform);
    const linkBody = kind === "request"
      ? "JumpIn request (" + shortRoute(ride.from, ride.to) + "): " + manageUrl("seat", ride.requesterReservationId, secret, ride.rideId, p.groupId)
      : "JumpIn " + (kind === "trip" ? "driver" : "seat") + " link (" + shortRoute(ride.from, ride.to) + "): " + manageUrl(kind, kind === "trip" ? ride.rideId : target.reservationId, secret, ride.rideId, p.groupId);
    queueText(texts, phone.e164, linkBody, "CARPOOL_DRIVER_LINK");
    if (kind === "trip" || kind === "request") tx.set(p.ridePrivate(ride.rideId), target);
    else tx.set(p.reservation(ride.rideId, phone.e164), target);
    saveConfig(tx, config, p, platform);
    return { ok: true, phrase: core.recoveryPhrase(), texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function manageUrl(kind, id, secret, rideId, groupId) {
  const gPrefix = groupId && groupId !== "default" ? "g=" + encodeURIComponent(groupId) + "&" : "";
  if (kind === "trip") return "https://waitlink.app/jumpin?" + gPrefix + "view=trip&ride=" + id + "&k=" + secret;
  if (kind === "ride") return "https://waitlink.app/jumpin?" + gPrefix + "view=ride&ride=" + id;
  return "https://waitlink.app/jumpin?" + gPrefix + "view=seat&r=" + id + "&k=" + secret + "&ride=" + rideId;
}

function isSuperAdminEmail(email, platform) {
  const clean = core.cleanEmail(email);
  if (!clean) return false;
  if (clean === SUPERADMIN_EMAIL) return true;
  return !!(platform && Array.isArray(platform.superAdminEmails) && platform.superAdminEmails.indexOf(clean) !== -1);
}

function requireAdmin(email, config, platform) {
  const clean = core.cleanEmail(email);
  if (!clean) return false;
  if (isSuperAdminEmail(clean, platform)) return true;
  return !!(config && Array.isArray(config.adminEmails) && config.adminEmails.indexOf(clean) !== -1);
}

function reviewRide(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    const ride = await tx.get(p.ridePrivate(input.rideId));
    if (!ride || ride.status !== "pending") return { ok: true, already: true, texts: texts };
    const pub = await tx.get(p.ridePublic(ride.rideId));
    if (!pub) return { ok: false, error: "This ride is not available." };
    const ownerPhone = ride.kind === "request" ? ride.requesterPhoneE164 : ride.driverPhoneE164;
    const noun = ride.kind === "request" ? "request" : "trip";
    if (input.decision === "approve") {
      ride.status = "open";
      pub.status = "open";
      pub.updatedAt = now;
      if (ownerPhone && canSendBoth(config, platform, now)) {
        bumpSms(config, platform);
        const gPrefix = p.groupId !== "default" ? "g=" + encodeURIComponent(p.groupId) + "&" : "";
        queueText(texts, ownerPhone, "JumpIn " + noun + " on the board (" + shortRoute(ride.from, ride.to) + "). Share: https://waitlink.app/jumpin?" + gPrefix + "view=ride&ride=" + ride.rideId, "CARPOOL_DRIVER_LINK");
      }
    } else if (input.decision === "decline") {
      ride.status = "rejected";
      pub.status = "rejected";
      pub.updatedAt = now;
      if (ownerPhone && canSendBoth(config, platform, now)) {
        bumpSms(config, platform);
        queueText(texts, ownerPhone, "JumpIn " + noun + " not approved (" + shortRoute(ride.from, ride.to) + ").", "CARPOOL_DRIVER_LINK");
      }
    } else return { ok: false, error: "Enter a decision." };
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.ridePublic(ride.rideId), pub);
    await rememberRide(tx, ride, [], p);
    saveConfig(tx, config, p, texts.length ? platform : null);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function adminCancelTrip(db, email, rideId, now, groupId) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf({ groupId: groupId }));
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    const ride = await tx.get(p.ridePrivate(rideId));
    if (!ride) return { ok: false, error: "This ride is not available." };
    if (ride.status === "cancelled") return { ok: true, already: true, texts: texts };
    if (ride.status !== "open" && ride.status !== "pending") return { ok: false, error: "This trip can no longer be cancelled." };
    await releaseRide(tx, ride, now, texts, config, "Trip cancelled.", true, p, platform);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function setPosting(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const platform = await loadPlatformConfig(tx, now || Date.now());
    const config = await loadConfig(tx, now || Date.now(), p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    if (input.phoneHash && input.blocked === false) {
      const index = await tx.get(p.blockIndex) || { blocks: [] };
      index.blocks = arr(index.blocks).filter(function (row) { return row.phoneHash !== input.phoneHash; });
      tx.del(p.block(input.phoneHash));
      tx.set(p.blockIndex, index);
      return { ok: true };
    }
    let e164 = "";
    let name = "";
    if (input.rideId) {
      const ride = await tx.get(p.ridePrivate(input.rideId));
      if (!ride) return { ok: false, error: "This ride is not available." };
      e164 = ride.driverPhoneE164;
      name = ride.driverName;
    } else {
      const phone = core.normalizePhone(input.phone);
      if (!phone.ok) return { ok: false, error: phone.error };
      e164 = phone.e164;
      name = core.collapse(input.name || "");
    }
    const hash = core.phoneHash16(e164);
    const key = p.block(hash);
    const index = await tx.get(p.blockIndex) || { blocks: [] };
    index.blocks = arr(index.blocks).filter(function (row) { return row.phoneHash !== hash; });
    if (input.blocked) {
      const entry = { phoneHash: hash, driverName: name, phoneLast4: core.last4(e164), blockedAt: now };
      tx.set(key, entry);
      index.blocks.push(entry);
    } else tx.del(key);
    tx.set(p.blockIndex, index);
    return { ok: true, phoneLast4: core.last4(e164) };
  });
}

function listAdmin(db, email, now, groupId) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf({ groupId: groupId }));
    const platform = await loadPlatformConfig(tx, now || Date.now());
    const config = await loadConfig(tx, now || Date.now(), p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    const meta = p.groupId === "default" ? null : await tx.get(p.groupMeta);
    const pack = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
    const blocks = await tx.get(p.blockIndex) || { blocks: [] };
    const memberPack = await tx.get(p.memberIndex) || { members: [] };
    const clock = now || Date.now();
    const allRides = arr(pack.rides);
    const pubs = {};
    for (let i = 0; i < allRides.length; i++) {
      pubs[allRides[i].rideId] = await tx.get(p.ridePublic(allRides[i].rideId));
    }
    function card(ride) {
      const pub = pubs[ride.rideId] || {};
      const riders = arr(ride.riders).filter(function (r) { return r.status === "active"; }).map(function (r) {
        return {
          name: r.name || "Passenger",
          phoneLast4: core.last4(r.phoneE164),
          status: "active"
        };
      });
      return {
        rideId: ride.rideId,
        kind: ride.kind || "offer",
        status: ride.status,
        departAt: ride.departAt,
        driverName: ride.driverName || "",
        requesterName: ride.requesterName || "",
        seatsRequested: Number(ride.seatsRequested) || 0,
        phoneLast4: ride.phoneLast4 || core.last4(ride.driverPhoneE164 || ride.requesterPhoneE164),
        from: ride.from || "",
        to: ride.to || "",
        note: ride.note || "",
        seatsLeft: ride.seatsLeft,
        timeZone: ride.timeZone || "UTC",
        riders: riders,
        messages: arr(pub.messages)
      };
    }
    const safeConfig = p.groupId === "default" ? config : Object.assign({}, config, {
      adminEmails: arr(config.adminEmails).filter(function (em) {
        return !isSuperAdminEmail(em, platform) || (meta && core.cleanEmail(meta.contactEmail) === em);
      })
    });
    return {
      ok: true,
      groupId: p.groupId,
      group: meta,
      config: safeConfig,
      pending: allRides.filter(function (ride) { return ride.status === "pending"; }).map(card),
      upcoming: allRides.filter(function (ride) { return ride.status === "open" && ride.departAt > clock; }).map(card),
      past: allRides.filter(function (ride) { return ride.status === "completed" || (ride.status === "open" && ride.departAt <= clock); }).map(card),
      cancelled: allRides.filter(function (ride) { return ride.status === "cancelled" || ride.status === "rejected"; }).map(card),
      blocked: arr(blocks.blocks).map(function (entry) {
        return { driverName: entry.driverName, phoneLast4: entry.phoneLast4, phoneHash: entry.phoneHash, blockedAt: entry.blockedAt };
      }),
      members: arr(memberPack.members),
      audienceCount: arr(pack.audience).length
    };
  });
}

function broadcastPlan(records, scope, rideId, now) {
  const chosen = [];
  const seen = {};
  function add(e164, optOut) {
    if (!e164 || optOut || seen[e164]) return;
    seen[e164] = true;
    chosen.push(e164);
  }
  if (scope === "all") {
    records.audience.forEach(function (row) { add(row.phoneE164, row.smsOptOut === true); });
    return chosen;
  }
  records.rides.forEach(function (ride) {
    const upcoming = ride.status === "open" && ride.departAt > now;
    const thisTrip = scope === "trip" && ride.rideId === rideId && (ride.status === "open" || ride.status === "pending");
    if (scope === "upcoming" && !upcoming) return;
    if (scope === "trip" && !thisTrip) return;
    if (scope !== "upcoming" && scope !== "trip") return;
    add(ride.driverPhoneE164, optedOut(records, ride.driverPhoneE164));
    arr(ride.riders).forEach(function (rider) {
      if (rider.status === "active") add(rider.phoneE164, optedOut(records, rider.phoneE164));
    });
  });
  return chosen;
}

function optedOut(records, e164) {
  const row = arr(records.audience).filter(function (item) { return item.phoneE164 === e164; })[0];
  return row ? row.smsOptOut === true : false;
}

function broadcast(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const text = core.announceError(input.text);
  if (text.error) return Promise.resolve({ ok: false, error: text.error });
  const scope = input.scope;
  if (scope !== "all" && scope !== "upcoming" && scope !== "trip") return Promise.resolve({ ok: false, error: "Choose who receives the text." });
  if (scope === "trip" && !input.rideId) return Promise.resolve({ ok: false, error: "Choose a trip." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const platform = await loadPlatformConfig(tx, now);
    const config = await loadConfig(tx, now, p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
    if ((scope === "upcoming" || scope === "all") && platform.broadcastSmsEnabled === false) {
      return { ok: false, error: "Broadcast SMS is disabled by platform settings." };
    }
    const phones = broadcastPlan(pack, scope, input.rideId, now);
    const left = Math.min(core.smsBudget(config, now).left, Math.max(0, platform.platformDailySmsCap - platform.dailySmsSent));
    if (!input.confirm) return { ok: true, count: phones.length, left: left, confirm: false };
    if (phones.length > left) return { ok: false, error: "This would text " + phones.length + " people and " + left + " texts are left today.", count: phones.length, left: left };
    phones.forEach(function () {
      bumpSms(config, platform);
    });
    saveConfig(tx, config, p, phones.length ? platform : null);
    return { ok: true, count: phones.length, phones: phones, body: "JumpIn: " + text.value };
  }).then(function (result) {
    if (result.phones) {
      result.outbox = result.phones.map(function (e164) {
        return { to: e164, body: result.body, triggerType: "CARPOOL_BROADCAST", shopSlug: "jumpin" };
      });
      delete result.phones;
    } else result.outbox = [];
    return result;
  });
}

async function completeDueGroup(tx, p, now, texts, platform) {
  const config = await loadConfig(tx, now, p);
  const index = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
  const rides = arr(index.rides);
  const due = [];
  for (let i = 0; i < rides.length; i++) {
    const row = rides[i];
    const ride = await tx.get(p.ridePrivate(row.rideId));
    if (!ride) continue;
    if ((ride.status === "open" || ride.status === "pending") && completionDeadline(ride) <= now) {
      const pub = await tx.get(p.ridePublic(ride.rideId));
      const riderPhones = [];
      const keys = arr(ride.activeReservationDocIds);
      for (let k = 0; k < keys.length; k++) {
        const res = await tx.get(keys[k]);
        if (res && res.status === "active" && res.phoneE164 && riderPhones.indexOf(res.phoneE164) === -1) riderPhones.push(res.phoneE164);
      }
      const hasRiders = ride.status === "open" && riderPhones.length > 0;
      const phones = [];
      if (hasRiders && !ride.thankYouSentAt && config.enabled && config.postRideThankYouSms && config.supportNote) {
        if (ride.driverPhoneE164 && phones.indexOf(ride.driverPhoneE164) === -1) phones.push(ride.driverPhoneE164);
        riderPhones.forEach(function (ph) { if (phones.indexOf(ph) === -1) phones.push(ph); });
      }
      due.push({ row: row, ride: ride, pub: pub, phones: phones, hasRiders: hasRiders });
    }
  }
  let groupSent = 0;
  due.forEach(function (item) {
    if (item.hasRiders) {
      item.ride.status = "completed";
      item.ride.completedAt = now;
      item.row.status = "completed";
    } else {
      item.ride.status = "cancelled";
      item.ride.cancelledAt = now;
      item.ride.seatsLeft = 0;
      item.row.status = "cancelled";
    }
    if (item.phones.length) {
      item.ride.thankYouSentAt = now;
      const body = "JumpIn ride done (" + shortRoute(item.ride.from, item.ride.to) + "). Free tool - chip in $1-$2: " + config.supportNote;
      item.phones.forEach(function (ph) {
        if (canSendBoth(config, platform, now)) {
          bumpSms(config, platform);
          groupSent += 1;
          queueText(texts, ph, body, "CARPOOL_THANKYOU");
        }
      });
    }
    if (item.pub) {
      item.pub.status = item.hasRiders ? "completed" : "cancelled";
      if (!item.hasRiders) {
        item.pub.seatsLeft = 0;
        const expireMsg = item.ride.kind === "request" ? "Request expired — no driver offered a ride." : "Trip cancelled — no passengers joined.";
        item.pub.messages = arr(item.pub.messages).concat([core.systemMessage(expireMsg, now, arr(item.pub.messages).length + 1)]);
      }
      item.pub.updatedAt = now;
      tx.set(p.ridePublic(item.ride.rideId), item.pub);
    }
    tx.set(p.ridePrivate(item.ride.rideId), item.ride);
  });
  if (groupSent) saveConfig(tx, config, p, platform);
  if (due.length) tx.set(p.broadcastIndex, index);
  return due.length;
}

function completeDue(db, now, groupId) {
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, clock);
    if (!groupId) {
      if (!platform.completeTripsEnabled) return { ok: true, completed: 0, skipped: "disabled", texts: texts };
      const minMs = platform.completeTripsIntervalMinutes * 60000 - 30000;
      if (platform.lastCompleteRunAt && clock - platform.lastCompleteRunAt < minMs) {
        return { ok: true, completed: 0, skipped: "interval", texts: texts };
      }
      platform.lastCompleteRunAt = clock;
    }
    let total = 0;
    if (groupId) {
      total += await completeDueGroup(tx, pathsFor(gidOf({ groupId: groupId })), clock, texts, platform);
    } else {
      total += await completeDueGroup(tx, pathsFor("default"), clock, texts, platform);
      const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
      const groups = arr(gi.groups);
      for (let i = 0; i < groups.length; i++) {
        if (groups[i] && groups[i].groupId && groups[i].status === "active") {
          total += await completeDueGroup(tx, pathsFor(groups[i].groupId), clock, texts, platform);
        }
      }
      tx.set("carpool_platform/config", platform);
    }
    return { ok: true, completed: total, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

async function retainTripsGroup(tx, p, now) {
  const index = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
  const kept = [];
  const rides = arr(index.rides);
  for (let i = 0; i < rides.length; i++) {
    const row = rides[i];
    const ride = await tx.get(p.ridePrivate(row.rideId));
    const pub = await tx.get(p.ridePublic(row.rideId));
    const endedAt = ride ? (ride.completedAt || ride.cancelledAt || 0) : 0;
    const ended = ride && (ride.status === "completed" || ride.status === "cancelled" || ride.status === "rejected");
    if (ride && ended && endedAt && now - endedAt >= 7 * core.DAY_MS) {
      const keys = arr(ride.activeReservationDocIds);
      for (let k = 0; k < keys.length; k++) tx.del(keys[k]);
      tx.del(p.ridePrivate(row.rideId));
      tx.set(p.ridePublic(row.rideId), { rideId: row.rideId, status: "missing", purgedAt: now, departAt: row.departAt });
      kept.push({ rideId: row.rideId, status: "missing", purgedAt: now, departAt: row.departAt });
      continue;
    }
    if (!ride && pub && pub.purgedAt && now - pub.purgedAt >= 30 * core.DAY_MS) {
      tx.del(p.ridePublic(row.rideId));
      continue;
    }
    kept.push(row);
  }
  index.rides = kept;
  tx.set(p.broadcastIndex, index);
  const limits = await tx.get(p.limitIndex) || { keys: [] };
  const live = [];
  for (let i = 0; i < arr(limits.keys).length; i++) {
    const doc = await tx.get(limits.keys[i]);
    if (!doc || (doc.expiresAt && doc.expiresAt <= now)) tx.del(limits.keys[i]);
    else live.push(limits.keys[i]);
  }
  tx.set(p.limitIndex, { keys: live });
  return { kept: kept.length, audience: arr(index.audience).length };
}

function retainTrips(db, now, groupId) {
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const platform = await loadPlatformConfig(tx, clock);
    if (!groupId) {
      if (!platform.retainTripsEnabled) return { ok: true, kept: 0, audience: 0, skipped: "disabled" };
      const minMs = platform.retainTripsIntervalHours * 3600000 - 5 * 60000;
      if (platform.lastRetainRunAt && clock - platform.lastRetainRunAt < minMs) {
        return { ok: true, kept: 0, audience: 0, skipped: "interval" };
      }
      platform.lastRetainRunAt = clock;
    }
    const def = await retainTripsGroup(tx, pathsFor(groupId ? gidOf({ groupId: groupId }) : "default"), clock);
    if (!groupId) {
      const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
      const groups = arr(gi.groups);
      for (let i = 0; i < groups.length; i++) {
        if (groups[i] && groups[i].groupId) await retainTripsGroup(tx, pathsFor(groups[i].groupId), clock);
      }
      tx.set("carpool_platform/config", platform);
    }
    return { ok: true, kept: def.kept, audience: def.audience };
  });
}

function markOptOut(db, phone, now, groupId) {
  const parsed = core.normalizePhone(phone);
  if (!parsed.ok) return Promise.resolve({ ok: false, error: parsed.error });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf({ groupId: groupId }));
    const key = p.audience(core.phoneHash16(parsed.e164));
    const prev = await tx.get(key) || { roles: [], displayName: "", phoneLast4: core.last4(parsed.e164) };
    prev.phoneE164 = parsed.e164;
    prev.smsOptOut = true;
    prev.updatedAt = now;
    tx.set(key, prev);
    await rememberAudience(tx, parsed.e164, true, p);
    return { ok: true };
  });
}

function setMembers(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const body = input || {};
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(body));
    const platform = await loadPlatformConfig(tx, clock);
    const config = await loadConfig(tx, clock, p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get(p.memberIndex) || { members: [] };
    let list = arr(pack.members).slice();
    if (body.removePhoneHash) {
      list = list.filter(function (m) { return m.phoneHash !== body.removePhoneHash; });
      tx.set(p.memberIndex, { members: list });
      return { ok: true, count: list.length };
    }
    if (body.editPhoneHash) {
      const existing = list.find(function (m) { return m.phoneHash === body.editPhoneHash; });
      if (!existing) return { ok: false, error: "Member not found." };
      const nextName = String(body.name || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 40) || "Member";
      const rawPhone = body.phone != null ? String(body.phone).trim() : "";
      let nextHash = existing.phoneHash;
      let nextLast4 = existing.phoneLast4 || "";
      let nextE164 = existing.phoneE164 || "";
      if (rawPhone) {
        const parsed = core.normalizePhone(rawPhone);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        nextHash = core.phoneHash16(parsed.e164);
        nextLast4 = core.last4(parsed.e164);
        nextE164 = parsed.e164;
      }
      const updated = {
        phoneHash: nextHash,
        phoneLast4: nextLast4,
        phoneE164: nextE164,
        name: nextName,
        email: body.email !== undefined ? core.cleanEmail(body.email) : (existing.email || ""),
        isAdmin: body.isAdmin !== undefined ? (body.isAdmin === true || body.isAdmin === "true") : !!existing.isAdmin,
        addedAt: existing.addedAt || clock
      };
      list = list.filter(function (m) { return m.phoneHash !== body.editPhoneHash && m.phoneHash !== nextHash; });
      list.push(updated);
      tx.set(p.memberIndex, { members: list });
      return { ok: true, count: list.length };
    }
    const lines = body.bulk ? String(body.bulk).split(/\r?\n|;/).map(function (l) { return l.trim(); }).filter(Boolean) : [String(body.name || "") + "," + String(body.phone || "")];
    let added = 0;
    let skipped = 0;
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",");
      const rawPhone = parts.length > 1 ? parts.slice(1).join(",") : parts[0];
      const rawName = parts.length > 1 ? parts[0] : "";
      const parsed = core.normalizePhone(rawPhone);
      if (!parsed.ok) {
        if (!body.bulk) return { ok: false, error: parsed.error };
        skipped += 1;
        continue;
      }
      const hash = core.phoneHash16(parsed.e164);
      const entry = {
        phoneHash: hash,
        phoneLast4: core.last4(parsed.e164),
        phoneE164: parsed.e164,
        name: rawName.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 40) || "Member",
        email: !body.bulk && body.email ? core.cleanEmail(body.email) : "",
        isAdmin: !body.bulk && (body.isAdmin === true || body.isAdmin === "true"),
        addedAt: clock
      };
      list = list.filter(function (m) { return m.phoneHash !== hash; });
      list.push(entry);
      added += 1;
    }
    tx.set(p.memberIndex, { members: list });
    return { ok: true, added: added, skipped: skipped, count: list.length };
  });
}

function saveAdminConfig(db, email, input, now) {
  const cleanEmail = core.cleanEmail(email);
  if (!cleanEmail) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const platform = await loadPlatformConfig(tx, now || Date.now());
    const prev = await loadConfig(tx, now || Date.now(), p);
    if (!requireAdmin(cleanEmail, prev, platform)) return { ok: false, error: "This page is not available." };
    const next = core.clampConfig(input, { groupId: p.groupId });
    if (p.groupId !== "default" && !next.adminEmails.length) next.adminEmails = prev.adminEmails.length ? prev.adminEmails : [cleanEmail];
    if (!isSuperAdminEmail(cleanEmail, platform) && p.groupId !== "default") {
      if (next.dailySmsCap > prev.dailySmsCap) next.dailySmsCap = prev.dailySmsCap;
      next.supportNote = prev.supportNote || platform.platformSupportNote;
    }
    next.dailySmsSent = prev.dailySmsSent;
    next.dailySmsDay = prev.dailySmsDay;
    saveConfig(tx, next, p);
    if (p.groupId !== "default") {
      const meta = await tx.get(p.groupMeta);
      if (meta) {
        const nextName = core.collapse(core.stripTags(input && input.groupName ? input.groupName : meta.name)).slice(0, 50) || meta.name;
        meta.name = nextName;
        meta.contactEmail = next.contactEmail;
        meta.supportNote = next.supportNote;
        meta.enabled = next.enabled;
        meta.updatedAt = now || Date.now();
        tx.set(p.groupMeta, meta);
        const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
        gi.groups = arr(gi.groups).map(function (g) {
          if (g.groupId !== p.groupId) return g;
          return Object.assign({}, g, { name: nextName, supportNote: next.supportNote, enabled: next.enabled, adminEmails: next.adminEmails, contactEmail: next.contactEmail, dailySmsCap: next.dailySmsCap });
        });
        tx.set("carpool_platform/groups_index", gi);
      }
    }
    return { ok: true, config: next };
  });
}

function purgeData(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const body = input || {};
  const scope = body.scope;
  if (scope !== "past" && scope !== "trips" && scope !== "audience" && scope !== "all") {
    return Promise.resolve({ ok: false, error: "Choose what to clean up." });
  }
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(body));
    const platform = await loadPlatformConfig(tx, clock);
    const config = await loadConfig(tx, clock, p);
    if (!requireAdmin(email, config, platform)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
    const limits = await tx.get(p.limitIndex) || { keys: [] };
    const blocks = await tx.get(p.blockIndex) || { blocks: [] };
    const members = await tx.get(p.memberIndex) || { members: [] };
    const allRides = arr(pack.rides);
    const isPastOrClosed = function (r) {
      return r.status === "completed" || r.status === "cancelled" || r.status === "rejected" || (r.status === "open" && r.departAt + MESSAGE_GRACE_MS <= clock);
    };
    const targetRides = scope === "past" ? allRides.filter(isPastOrClosed) : (scope === "trips" || scope === "all" ? allRides : []);
    const resKeys = [];
    for (let i = 0; i < targetRides.length; i++) {
      const priv = await tx.get(p.ridePrivate(targetRides[i].rideId));
      if (priv) arr(priv.activeReservationDocIds).forEach(function (k) { resKeys.push(k); });
    }
    const counts = {
      rides: targetRides.length,
      reservations: resKeys.length,
      audience: (scope === "audience" || scope === "all") ? arr(pack.audience).length : 0,
      blocks: scope === "all" ? arr(blocks.blocks).length : 0,
      members: scope === "all" ? arr(members.members).length : 0
    };
    if (!body.confirm) return { ok: true, confirm: false, scope: scope, counts: counts };
    targetRides.forEach(function (r) {
      tx.del(p.ridePrivate(r.rideId));
      tx.del(p.ridePublic(r.rideId));
    });
    resKeys.forEach(function (k) { tx.del(k); });
    if (scope === "past") {
      const dropIds = targetRides.map(function (r) { return r.rideId; });
      tx.set(p.broadcastIndex, {
        rides: allRides.filter(function (r) { return dropIds.indexOf(r.rideId) === -1; }),
        audience: arr(pack.audience)
      });
    } else if (scope === "trips") {
      arr(limits.keys).forEach(function (k) { tx.del(k); });
      tx.set(p.limitIndex, { keys: [] });
      tx.set(p.broadcastIndex, { rides: [], audience: arr(pack.audience) });
    } else if (scope === "audience") {
      tx.set(p.broadcastIndex, { rides: allRides, audience: [] });
    } else {
      arr(limits.keys).forEach(function (k) { tx.del(k); });
      arr(blocks.blocks).forEach(function (b) { tx.del(p.block(b.phoneHash)); });
      tx.set(p.limitIndex, { keys: [] });
      tx.set(p.blockIndex, { blocks: [] });
      tx.set(p.memberIndex, { members: [] });
      tx.set(p.broadcastIndex, { rides: [], audience: [] });
    }
    return { ok: true, confirm: true, scope: scope, deleted: counts };
  });
}

function createGroup(db, email, input, now) {
  const caller = core.cleanEmail(email);
  if (!caller) return Promise.resolve({ ok: false, error: "Sign in with Google first." });
  const body = input || {};
  const name = core.collapse(core.stripTags(body.name || "")).slice(0, 50);
  if (!name) return Promise.resolve({ ok: false, field: "name", error: "Enter a group name." });
  const slugErr = core.groupSlugError(body.groupId);
  if (slugErr) return Promise.resolve({ ok: false, field: "groupId", error: slugErr });
  const gid = core.normalizeGroupId(body.groupId);
  const parsedPhone = core.normalizePhone(body.contactPhone);
  if (!parsedPhone.ok) return Promise.resolve({ ok: false, field: "contactPhone", error: parsedPhone.error });
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gid);
    const platform = await loadPlatformConfig(tx, clock);
    const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
    const groups = arr(gi.groups);
    const isSuper = isSuperAdminEmail(caller, platform);
    if (!isSuper) {
      if (groups.filter(function (g) { return g.status === "pending"; }).length >= 50) {
        return { ok: false, error: "Too many pending requests right now. Please try again later." };
      }
      if (groups.some(function (g) { return g.createdBy === caller && g.status === "pending"; })) {
        return { ok: false, error: "You already have a group waiting for approval." };
      }
      if (groups.filter(function (g) { return g.createdBy === caller; }).length >= 3) {
        return { ok: false, error: "Group limit reached (max 3 per account)." };
      }
    }
    if (await tx.get(p.groupMeta) || groups.some(function (g) { return g.groupId === gid; })) {
      return { ok: false, field: "groupId", error: "That group link is already taken. Try another." };
    }
    const status = isSuper ? "active" : "pending";
    const enabled = isSuper;
    const cap = isSuper ? 100 : 0;
    const supportNote = isSuper ? (core.collapse(core.stripTags(body.supportNote || "")).slice(0, 80) || platform.platformSupportNote) : platform.platformSupportNote;
    const contactEmail = core.cleanEmail(body.contactEmail) || caller;
    const cfg = core.clampConfig({
      enabled: enabled,
      membersOnly: body.membersOnly !== false,
      contactEmail: contactEmail,
      supportNote: supportNote,
      adminEmails: [isSuper ? contactEmail : caller],
      dailySmsCap: cap
    });
    const meta = {
      groupId: gid,
      name: name,
      status: status,
      enabled: enabled,
      contactEmail: cfg.contactEmail,
      contactPhoneE164: parsedPhone.e164,
      supportNote: cfg.supportNote,
      updatedAt: clock
    };
    const entry = {
      groupId: gid,
      name: name,
      status: status,
      enabled: enabled,
      adminEmails: cfg.adminEmails,
      contactEmail: cfg.contactEmail,
      contactPhoneLast4: core.last4(parsedPhone.e164),
      supportNote: cfg.supportNote,
      dailySmsCap: cap,
      createdAt: clock,
      createdBy: caller
    };
    const texts = freshTexts();
    if (!isSuper && platform.platformAdminPhone && platform.dailySmsSent < platform.platformDailySmsCap) {
      platform.dailySmsSent += 1;
      tx.set("carpool_platform/config", platform);
      queueText(texts, platform.platformAdminPhone, "JumpIn group request: " + name + " (" + gid + ") " + cfg.contactEmail + " Review: https://waitlink.app/jumpin-admin.html?tab=groups", "CARPOOL_GROUP_REQUEST");
    }
    tx.set(p.groupMeta, meta);
    saveConfig(tx, cfg, p);
    tx.set(p.broadcastIndex, { rides: [], audience: [] });
    tx.set(p.memberIndex, { members: [] });
    tx.set(p.blockIndex, { blocks: [] });
    gi.groups = groups.concat([entry]);
    tx.set("carpool_platform/groups_index", gi);
    return { ok: true, group: entry, textSent: isSuper ? true : texts.length > 0, texts: texts };
  }).then(function (result) { return withOutbox(result, result.texts); });
}

function listGroups(db, email, now) {
  const caller = core.cleanEmail(email);
  if (!caller) return Promise.resolve({ ok: false, error: "Sign in with Google first." });
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const platform = await loadPlatformConfig(tx, clock);
    const isSuper = isSuperAdminEmail(caller, platform);
    const defCfg = await loadConfig(tx, clock, pathsFor("default"));
    const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
    const list = [];
    if (requireAdmin(caller, defCfg, platform)) {
      list.push({
        groupId: "default",
        name: "Its-OK",
        status: "active",
        enabled: defCfg.enabled,
        adminEmails: defCfg.adminEmails,
        contactEmail: defCfg.contactEmail,
        supportNote: defCfg.supportNote,
        dailySmsCap: defCfg.dailySmsCap,
        dailySmsSent: defCfg.dailySmsSent
      });
    }
    arr(gi.groups).forEach(function (g) {
      if (isSuper || arr(g.adminEmails).indexOf(caller) !== -1) list.push(g);
    });
    return { ok: true, isSuperAdmin: isSuper, platform: platform, groups: list };
  });
}

function reviewGroup(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const body = input || {};
  const gid = core.normalizeGroupId(body.groupId);
  if (!gid || gid === "default") return Promise.resolve({ ok: false, error: "Choose a group." });
  const decision = body.decision;
  if (decision !== "approve" && decision !== "suspend" && decision !== "cap" && decision !== "reject") {
    return Promise.resolve({ ok: false, error: "Enter a decision." });
  }
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const platform = await loadPlatformConfig(tx, clock);
    if (!isSuperAdminEmail(email, platform)) return { ok: false, error: "This page is not available." };
    const p = pathsFor(gid);
    const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
    const meta = await tx.get(p.groupMeta);
    const cfg = await loadConfig(tx, clock, p);
    const exists = meta || arr(gi.groups).some(function (g) { return g.groupId === gid; });
    if (!exists) return { ok: false, error: "Group not found." };
    if (decision === "reject") {
      const idx = await tx.get(p.broadcastIndex) || { rides: [] };
      arr(idx.rides).forEach(function (r) {
        if (r && r.rideId) {
          tx.del(p.ridePublic(r.rideId));
          tx.del(p.ridePrivate(r.rideId));
        }
      });
      tx.del(p.broadcastIndex);
      tx.del(p.memberIndex);
      tx.del(p.blockIndex);
      tx.del(p.groupMeta);
      tx.del(p.config);
      gi.groups = arr(gi.groups).filter(function (g) { return g.groupId !== gid; });
      tx.set("carpool_platform/groups_index", gi);
      return { ok: true, decision: "reject", groupId: gid };
    }
    if (decision === "approve") {
      cfg.enabled = true;
      cfg.dailySmsCap = Math.max(100, Number(body.dailySmsCap || cfg.dailySmsCap || 100));
    } else if (decision === "suspend") {
      cfg.enabled = false;
    } else {
      cfg.dailySmsCap = Math.max(0, Math.min(2000, Math.round(Number(body.dailySmsCap) || 0)));
    }
    const texts = freshTexts();
    const wasPending = !meta || meta.status === "pending";
    if (decision === "approve" && wasPending && meta && meta.contactPhoneE164) {
      const platform = await loadPlatformConfig(tx, clock);
      if (platform.dailySmsSent < platform.platformDailySmsCap) {
        platform.dailySmsSent += 1;
        tx.set("carpool_platform/config", platform);
        queueText(texts, meta.contactPhoneE164, "JumpIn group \"" + (meta.name || gid) + "\" approved! Share: https://waitlink.app/jumpin?g=" + encodeURIComponent(gid), "CARPOOL_GROUP_APPROVED");
      }
    }
    const nextStatus = decision === "suspend" ? "suspended" : (decision === "approve" ? "active" : (meta && meta.status) || "active");
    const nextMeta = Object.assign({}, meta || { groupId: gid, name: gid }, { status: nextStatus, enabled: cfg.enabled, updatedAt: clock });
    tx.set(p.groupMeta, nextMeta);
    saveConfig(tx, cfg, p);
    gi.groups = arr(gi.groups).map(function (g) {
      if (g.groupId !== gid) return g;
      return Object.assign({}, g, { status: nextStatus, enabled: cfg.enabled, dailySmsCap: cfg.dailySmsCap });
    });
    tx.set("carpool_platform/groups_index", gi);
    const orgTextSent = decision !== "approve" || !wasPending || !(meta && meta.contactPhoneE164) || texts.length > 0;
    return { ok: true, decision: decision, groupId: gid, status: nextStatus, dailySmsCap: cfg.dailySmsCap, textSent: orgTextSent, texts: texts };
  }).then(function (result) { return withOutbox(result, result.texts); });
}

function savePlatformConfig(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const body = input || {};
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const prev = await loadPlatformConfig(tx, clock);
    if (!isSuperAdminEmail(email, prev)) return { ok: false, error: "This page is not available." };
    const nextCap = body.platformDailySmsCap != null ? Math.max(0, Math.min(10000, Math.round(Number(body.platformDailySmsCap) || 0))) : prev.platformDailySmsCap;
    const nextEnabled = body.platformEnabled !== undefined ? body.platformEnabled !== false : prev.platformEnabled;
    const nextIos = body.iosThemeEnabled !== undefined ? body.iosThemeEnabled === true : prev.iosThemeEnabled;
    const nextBroadcastSms = body.broadcastSmsEnabled !== undefined ? body.broadcastSmsEnabled !== false : prev.broadcastSmsEnabled;
    const nextNeedARide = body.needARideEnabled !== undefined ? body.needARideEnabled === true : prev.needARideEnabled;
    const nextBanner = body.maintenanceMessage !== undefined ? core.collapse(core.stripTags(body.maintenanceMessage || "")).slice(0, 200) : prev.maintenanceMessage;
    const nextSupport = body.platformSupportNote !== undefined
      ? (core.collapse(core.stripTags(body.platformSupportNote || "")).slice(0, 80) || PLATFORM_SUPPORT_NOTE)
      : prev.platformSupportNote;
    const nextAdminEmail = body.platformAdminEmail !== undefined
      ? (core.cleanEmail(body.platformAdminEmail) || prev.platformAdminEmail)
      : prev.platformAdminEmail;
    const nextSuperAdmins = body.superAdminEmails !== undefined
      ? core.cleanAdminEmails(body.superAdminEmails, true, SUPERADMIN_EMAIL)
      : prev.superAdminEmails;
    let nextAdminPhone = prev.platformAdminPhone;
    if (body.platformAdminPhone !== undefined && String(body.platformAdminPhone).trim()) {
      const parsed = core.normalizePhone(body.platformAdminPhone);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      nextAdminPhone = parsed.e164;
    }
    const nextCompleteEnabled = body.completeTripsEnabled !== undefined ? body.completeTripsEnabled !== false : prev.completeTripsEnabled;
    const nextCompleteInterval = body.completeTripsIntervalMinutes != null && [5, 10, 15, 30].indexOf(Number(body.completeTripsIntervalMinutes)) !== -1
      ? Number(body.completeTripsIntervalMinutes)
      : prev.completeTripsIntervalMinutes;
    const nextRetainEnabled = body.retainTripsEnabled !== undefined ? body.retainTripsEnabled !== false : prev.retainTripsEnabled;
    const nextRetainInterval = body.retainTripsIntervalHours != null && [24, 48, 72].indexOf(Number(body.retainTripsIntervalHours)) !== -1
      ? Number(body.retainTripsIntervalHours)
      : prev.retainTripsIntervalHours;
    const next = {
      platformEnabled: nextEnabled,
      iosThemeEnabled: nextIos,
      broadcastSmsEnabled: nextBroadcastSms,
      needARideEnabled: nextNeedARide,
      maintenanceMessage: nextBanner,
      platformSupportNote: nextSupport,
      platformAdminEmail: nextAdminEmail,
      superAdminEmails: nextSuperAdmins,
      platformAdminPhone: nextAdminPhone,
      platformDailySmsCap: nextCap,
      dailySmsDay: prev.dailySmsDay,
      dailySmsSent: prev.dailySmsSent,
      completeTripsEnabled: nextCompleteEnabled,
      completeTripsIntervalMinutes: nextCompleteInterval,
      lastCompleteRunAt: prev.lastCompleteRunAt,
      retainTripsEnabled: nextRetainEnabled,
      retainTripsIntervalHours: nextRetainInterval,
      lastRetainRunAt: prev.lastRetainRunAt
    };
    tx.set("carpool_platform/config", next);
    tx.set("carpool_platform/public_notice", {
      platformEnabled: nextEnabled,
      iosThemeEnabled: nextIos,
      needARideEnabled: nextNeedARide,
      maintenanceMessage: nextBanner,
      updatedAt: clock
    });
    return { ok: true, platform: next };
  });
}

function searchMembers(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const body = input || {};
  const query = core.collapse(core.stripTags(String(body.query || ""))).slice(0, 60);
  if (!query) return Promise.resolve({ ok: false, error: "Enter a name, phone number, or last 4 digits." });
  const clock = now || Date.now();
  const digits = query.replace(/\D/g, "");
  const parsedPhone = core.normalizePhone(query);
  const targetHash = parsedPhone.ok ? core.phoneHash16(parsedPhone.e164) : "";
  const isLast4 = digits.length === 4 && !parsedPhone.ok;
  const nameQuery = query.toLowerCase();
  return db.runTransaction(async function (tx) {
    const platform = await loadPlatformConfig(tx, clock);
    if (!isSuperAdminEmail(email, platform)) return { ok: false, error: "This page is not available." };
    const gi = await tx.get("carpool_platform/groups_index") || { groups: [] };
    const groupIds = ["default"];
    arr(gi.groups).forEach(function (g) {
      if (g && g.groupId && groupIds.indexOf(g.groupId) === -1) groupIds.push(g.groupId);
    });
    const results = [];
    for (let gIdx = 0; gIdx < groupIds.length; gIdx++) {
      const gid = groupIds[gIdx];
      const p = pathsFor(gid);
      const meta = gid === "default" ? null : await tx.get(p.groupMeta);
      const cfg = await loadConfig(tx, clock, p);
      const mPack = await tx.get(p.memberIndex) || { members: [] };
      const members = arr(mPack.members);
      const bPack = await tx.get(p.broadcastIndex) || { rides: [], audience: [] };
      const byHash = {};
      function slot(hash, name) {
        if (!byHash[hash]) byHash[hash] = { phoneE164: "", name: name || "", trips: [] };
        else if (name && !byHash[hash].name) byHash[hash].name = name;
        return byHash[hash];
      }
      arr(bPack.audience).forEach(function (a) {
        if (a && a.phoneE164) slot(core.phoneHash16(a.phoneE164), a.name).phoneE164 = a.phoneE164;
      });
      const rides = arr(bPack.rides);
      for (let rIdx = 0; rIdx < rides.length; rIdx++) {
        const row = rides[rIdx];
        const ride = row && row.rideId ? await tx.get(p.ridePrivate(row.rideId)) : null;
        if (!ride) continue;
        const when = core.formatWhen(ride.departAt, ride.timeZone);
        const dSlot = slot(core.phoneHash16(ride.driverPhoneE164), ride.driverName);
        dSlot.phoneE164 = ride.driverPhoneE164;
        dSlot.trips.push({ rideId: ride.rideId, from: ride.from, to: ride.to, when: when, role: "Driver", status: ride.status });
        const resKeys = arr(ride.activeReservationDocIds);
        for (let k = 0; k < resKeys.length; k++) {
          const res = await tx.get(resKeys[k]);
          if (res && res.phoneE164) {
            const rSlot = slot(core.phoneHash16(res.phoneE164), res.name);
            rSlot.phoneE164 = res.phoneE164;
            rSlot.trips.push({
              rideId: ride.rideId,
              from: ride.from,
              to: ride.to,
              when: when,
              role: "Rider (" + res.seats + ")",
              status: ride.status
            });
          }
        }
      }
      const groupName = meta ? meta.name : (gid === "default" ? "Its-OK" : gid);
      const organizerEmail = (meta && meta.contactEmail) || cfg.contactEmail;
      const organizerPhone = (meta && meta.contactPhoneE164) || platform.platformAdminPhone;
      const seenHashes = {};
      members.forEach(function (m) {
        seenHashes[m.phoneHash] = true;
        const hit = (targetHash && m.phoneHash === targetHash) ||
          (isLast4 && m.phoneLast4 === digits) ||
          (String(m.name).toLowerCase().indexOf(nameQuery) !== -1);
        if (!hit) return;
        const info = byHash[m.phoneHash];
        results.push({
          name: m.name,
          phone: m.phoneE164 || (info && info.phoneE164) || ("•••• " + m.phoneLast4),
          phoneLast4: m.phoneLast4,
          groupId: gid,
          groupName: groupName,
          organizerEmail: organizerEmail,
          organizerPhone: organizerPhone,
          addedAt: m.addedAt,
          trips: info ? info.trips : []
        });
      });
      Object.keys(byHash).forEach(function (hash) {
        if (seenHashes[hash]) return;
        const info = byHash[hash];
        const last4 = info.phoneE164 ? core.last4(info.phoneE164) : "";
        const dispName = info.name || "Rider / Driver";
        const hit = (targetHash && hash === targetHash) ||
          (isLast4 && last4 === digits) ||
          (dispName.toLowerCase().indexOf(nameQuery) !== -1);
        if (!hit) return;
        results.push({
          name: dispName,
          phone: info.phoneE164,
          phoneLast4: last4,
          groupId: gid,
          groupName: groupName,
          organizerEmail: organizerEmail,
          organizerPhone: organizerPhone,
          addedAt: 0,
          trips: info.trips
        });
      });
    }
    return { ok: true, results: results.slice(0, 100) };
  });
}

function postRideRequest(db, input, now, rng) {
  const checked = core.requestErrors(input || {});
  if (checked.error) return Promise.resolve({ ok: false, field: checked.field, error: checked.error });
  const fields = checked.value;
  let parsed = null;
  try { parsed = core.zonedToUtc(fields.date, fields.time, input.timeZone); } catch (err) { parsed = null; }
  if (parsed == null) return Promise.resolve({ ok: false, field: "time", error: "Choose a later time." });
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    if (!platform.platformEnabled) return { ok: false, error: platform.maintenanceMessage || "JumpIn is temporarily paused for maintenance." };
    if (!platform.needARideEnabled) return { ok: false, error: "Need a Ride is currently disabled." };
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const depart = core.departureError(fields.date, fields.time, input.timeZone, now, config.horizonDays);
    if (depart.error) return { ok: false, field: "time", error: depart.error };
    if (fields.seats > config.maxSeats) return { ok: false, field: "seats", error: "Choose seats from 1 to " + config.maxSeats + "." };
    const notMember = await memberError(tx, config, fields.phone, p);
    if (notMember) return { ok: false, field: "phone", error: notMember, memberDenied: true, contactEmail: config.contactEmail };
    if (await tx.get(p.block(core.phoneHash16(fields.phone)))) return { ok: false, error: "This number cannot post right now." };
    const phone = await tx.get(p.phone(fields.phone)) || { postsDay: core.utcDay(now), postsToday: 0, activeReservations: 0 };
    const today = core.postsToday(phone, now);
    if (today >= config.maxPostsPerPhonePerDay) return { ok: false, error: "You reached today's post limit." };
    const rideId = core.randomId("ride_", rng);
    const reservationId = core.randomId("res_", rng);
    const secret = core.randomSecret(rng);
    const status = config.requireRideApproval ? "pending" : "open";
    const ride = {
      rideId: rideId,
      groupId: p.groupId,
      kind: "request",
      status: status,
      from: fields.from,
      to: fields.to,
      departAt: parsed,
      durationMinutes: 60,
      timeZone: input.timeZone || "UTC",
      seatsTotal: fields.seats,
      seatsLeft: fields.seats,
      seatsRequested: fields.seats,
      rideCost: fields.rideCost || 0,
      note: fields.note,
      driverName: "",
      driverPhoneE164: "",
      driverPhoneHash: "",
      requesterName: fields.name,
      requesterPhoneE164: fields.phone,
      requesterPhoneHash: core.phoneHash16(fields.phone),
      requesterReservationId: reservationId,
      requesterSecretHash: core.sha256Hex(secret),
      editSecretHash: core.sha256Hex(secret),
      tokenIssuedAt: now,
      activeReservationDocIds: [],
      smsSent: 0,
      createdAt: now,
      updatedAt: now
    };
    const msg = core.systemMessage(status === "pending" ? "Ride request submitted for approval." : "Ride request posted — waiting for a driver.", now, 1);
    const pub = core.publicRide(ride, [], [msg]);
    pub.updatedAt = now;
    const sent = canSendBoth(config, platform, now);
    if (sent) {
      ride.smsSent = 1;
      bumpSms(config, platform);
      const body = status === "pending"
        ? "JumpIn request pending (" + shortRoute(fields.from, fields.to) + "): " + manageUrl("seat", reservationId, secret, rideId, p.groupId)
        : "JumpIn request (" + shortRoute(fields.from, fields.to) + "): " + manageUrl("seat", reservationId, secret, rideId, p.groupId);
      queueText(texts, fields.phone, body, "CARPOOL_REQUEST_LINK");
    }
    phone.postsDay = core.utcDay(now);
    phone.postsToday = today + 1;
    phone.updatedAt = now;
    tx.set(p.ridePrivate(rideId), ride);
    tx.set(p.ridePublic(rideId), pub);
    tx.set(p.phone(fields.phone), phone);
    await touchAudience(tx, fields.phone, fields.name, "rider", now, p);
    await rememberRide(tx, ride, [], p);
    saveConfig(tx, config, p, sent ? platform : null);
    return {
      ok: true,
      rideId: rideId,
      reservationId: reservationId,
      secret: secret,
      status: status,
      kind: "request",
      textSent: sent,
      texts: texts,
      error: sent ? "" : "Request posted on this browser. Text could not be sent right now."
    };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function claimRideRequest(db, input, now, rng) {
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const texts = freshTexts();
    const platform = await loadPlatformConfig(tx, now);
    if (!platform.platformEnabled) return { ok: false, error: platform.maintenanceMessage || "JumpIn is temporarily paused for maintenance." };
    if (!platform.needARideEnabled) return { ok: false, error: "Need a Ride is currently disabled." };
    const config = await loadConfig(tx, now, p);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(p.ridePrivate(input && input.rideId));
    if (!ride || ride.kind !== "request" || ride.status !== "open" || ride.departAt <= now) {
      return { ok: false, error: "This ride request is no longer open." };
    }
    const checked = core.claimErrors(input || {}, ride.seatsRequested || 1);
    if (checked.error) return { ok: false, field: checked.field, error: checked.error };
    const fields = checked.value;
    if (fields.seats > config.maxSeats) return { ok: false, field: "seats", error: "Choose seats from " + (ride.seatsRequested || 1) + " to " + config.maxSeats + "." };
    if (fields.phone === ride.requesterPhoneE164) return { ok: false, error: "You cannot drive your own ride request." };
    const notMember = await memberError(tx, config, fields.phone, p);
    if (notMember) return { ok: false, field: "phone", error: notMember, memberDenied: true, contactEmail: config.contactEmail };
    if (await tx.get(p.block(core.phoneHash16(fields.phone)))) return { ok: false, error: "This number cannot post right now." };
    const driverSecret = core.randomSecret(rng);
    const resKey = p.reservation(ride.rideId, ride.requesterPhoneE164);
    const resId = ride.requesterReservationId || core.randomId("res_", rng);
    const resRow = {
      reservationId: resId,
      rideId: ride.rideId,
      name: ride.requesterName,
      phoneE164: ride.requesterPhoneE164,
      phoneHash: ride.requesterPhoneHash,
      tokenHash: ride.requesterSecretHash,
      seats: ride.seatsRequested || 1,
      dropoff: ride.note || "",
      driverSeenAt: now,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    ride.kind = "offer";
    ride.claimedFromRequest = true;
    ride.claimedAt = now;
    ride.driverName = fields.name;
    ride.driverPhoneE164 = fields.phone;
    ride.driverPhoneHash = core.phoneHash16(fields.phone);
    ride.driverTokenHash = core.hashSecret(driverSecret);
    ride.tokenIssuedAt = now;
    ride.seatsTotal = fields.seats;
    ride.seatsLeft = fields.seats - (ride.seatsRequested || 1);
    ride.durationMinutes = fields.durationMinutes || 60;
    ride.note = fields.note || "";
    ride.activeReservationDocIds = [resKey];
    ride.updatedAt = now;
    const prevPub = await tx.get(p.ridePublic(ride.rideId)) || { messages: [] };
    const msgs = arr(prevPub.messages).concat([core.systemMessage(fields.name + " offered to drive this trip.", now, arr(prevPub.messages).length + 1)]);
    const pub = core.publicRide(ride, [{ reservationId: resId, name: resRow.name, seats: resRow.seats, dropoff: resRow.dropoff, driverSeenAt: now }], msgs);
    pub.updatedAt = now;
    const reqPhone = await tx.get(p.phone(ride.requesterPhoneE164)) || { postsDay: core.utcDay(now), postsToday: 0, activeReservations: 0 };
    reqPhone.activeReservations = core.activeReservations(reqPhone) + 1;
    reqPhone.updatedAt = now;
    const routeTag = shortRoute(ride.from, ride.to);
    const firstName = String(fields.name || "A driver").split(/\s+/)[0];
    let sentAny = false;
    if (canSendBoth(config, platform, now)) {
      bumpSms(config, platform);
      sentAny = true;
      queueText(texts, ride.requesterPhoneE164, "JumpIn: " + firstName + " offered to drive (" + routeTag + "). View: " + manageUrl("ride", ride.rideId, "", "", p.groupId), "CARPOOL_REQUEST_CLAIMED");
    }
    if (canSendBoth(config, platform, now)) {
      bumpSms(config, platform);
      sentAny = true;
      queueText(texts, fields.phone, "JumpIn driving (" + routeTag + "): " + manageUrl("trip", ride.rideId, driverSecret, ride.rideId, p.groupId), "CARPOOL_DRIVER_LINK");
    }
    tx.set(resKey, resRow);
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.ridePublic(ride.rideId), pub);
    tx.set(p.phone(ride.requesterPhoneE164), reqPhone);
    await touchAudience(tx, fields.phone, fields.name, "driver", now, p);
    await rememberRide(tx, ride, [resRow], p);
    saveConfig(tx, config, p, sentAny ? platform : null);
    return { ok: true, rideId: ride.rideId, secret: driverSecret, ride: pub, textSent: sentAny, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function cancelRideRequest(db, input, now) {
  return db.runTransaction(async function (tx) {
    const p = pathsFor(gidOf(input));
    const gErr = await groupAccessError(tx, p);
    if (gErr) return { ok: false, error: gErr };
    const ride = await tx.get(p.ridePrivate(input && input.rideId));
    if (!ride || ride.kind !== "request") return { ok: false, error: "This ride request is not available." };
    if (!input || !core.timingSafeEqual(core.sha256Hex(input.secret || ""), ride.requesterSecretHash || "")) {
      return { ok: false, error: "That manage link is not valid." };
    }
    if (ride.status === "cancelled") return { ok: true, already: true };
    ride.status = "cancelled";
    ride.cancelledAt = now;
    ride.seatsLeft = 0;
    ride.updatedAt = now;
    const prevPub = await tx.get(p.ridePublic(ride.rideId)) || { messages: [] };
    prevPub.status = "cancelled";
    prevPub.seatsLeft = 0;
    prevPub.updatedAt = now;
    prevPub.messages = arr(prevPub.messages).concat([core.systemMessage("Ride request cancelled.", now, arr(prevPub.messages).length + 1)]);
    tx.set(p.ridePrivate(ride.rideId), ride);
    tx.set(p.ridePublic(ride.rideId), prevPub);
    await rememberRide(tx, ride, [], p);
    return { ok: true, ride: prevPub };
  });
}

module.exports = {
  SUPERADMIN_EMAIL: SUPERADMIN_EMAIL,
  PLATFORM_SUPPORT_NOTE: PLATFORM_SUPPORT_NOTE,
  GENERIC_LINK: GENERIC_LINK,
  createMemoryDb: createMemoryDb,
  postRide: postRide,
  postRideRequest: postRideRequest,
  claimRideRequest: claimRideRequest,
  cancelRideRequest: cancelRideRequest,
  reserveSeat: reserveSeat,
  updateSeat: updateSeat,
  cancelSeat: cancelSeat,
  joinWaitlist: joinWaitlist,
  removeRider: removeRider,
  cancelTrip: cancelTrip,
  editRide: editRide,
  completeTrip: completeTrip,
  ackRider: ackRider,
  postMessage: postMessage,
  sendManageLink: sendManageLink,
  reviewRide: reviewRide,
  adminCancelTrip: adminCancelTrip,
  setPosting: setPosting,
  setMembers: setMembers,
  saveAdminConfig: saveAdminConfig,
  purgeData: purgeData,
  listAdmin: listAdmin,
  broadcast: broadcast,
  broadcastPlan: broadcastPlan,
  completeDue: completeDue,
  retainTrips: retainTrips,
  markOptOut: markOptOut,
  manageUrl: manageUrl,
  createGroup: createGroup,
  listGroups: listGroups,
  reviewGroup: reviewGroup,
  savePlatformConfig: savePlatformConfig,
  searchMembers: searchMembers
};
