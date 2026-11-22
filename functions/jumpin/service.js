/**
 * JumpIn transactions. Call with a db that has runTransaction(fn).
 * fn receives { get, set, del } and must be retried by the db on conflict.
 */
const core = require("./core.js");

const GENERIC_LINK = "This link no longer works. Request a new text from the ride page.";
const SUPERADMIN_EMAIL = "senthil930@gmail.com";

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

async function loadConfig(tx, now) {
  const stored = await tx.get("settings/carpool_config");
  const config = core.clampConfig(stored || {});
  const budget = core.smsBudget(config, now);
  config.dailySmsDay = budget.day;
  config.dailySmsSent = budget.sent;
  return config;
}

function bumpSms(config) {
  config.dailySmsSent += 1;
  return config;
}

function saveConfig(tx, config) {
  tx.set("settings/carpool_config", {
    enabled: config.enabled,
    requireRideApproval: config.requireRideApproval,
    membersOnly: config.membersOnly === true,
    adminEmails: config.adminEmails,
    contactEmail: config.contactEmail,
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
}

function queueText(outbox, to, body, triggerType) {
  outbox.push({ to: to, body: body, triggerType: triggerType, shopSlug: "jumpin" });
}

function freshTexts() { return []; }

function withOutbox(result, texts) {
  result.outbox = arr(texts);
  return result;
}

async function rememberRide(tx, ride, riders) {
  const index = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
  const summary = {
    rideId: ride.rideId,
    status: ride.status,
    departAt: ride.departAt,
    driverName: ride.driverName,
    phoneLast4: core.last4(ride.driverPhoneE164),
    driverPhoneE164: ride.driverPhoneE164,
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
  tx.set("carpool_private/broadcast_index", index);
}

async function rememberAudience(tx, e164, optOut) {
  const index = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
  const audience = arr(index.audience).filter(function (row) { return row.phoneE164 !== e164; });
  audience.push({ phoneE164: e164, smsOptOut: optOut === true });
  index.audience = audience;
  tx.set("carpool_private/broadcast_index", index);
}

async function touchAudience(tx, e164, name, role, now) {
  const id = core.phoneHash16(e164);
  const key = "carpool_private/audience/" + id;
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
  await rememberAudience(tx, e164, next.smsOptOut);
}

function phoneKey(e164) { return "carpool_private/phones/" + core.phoneHash16(e164); }
function blockKey(e164) { return "carpool_private/blocks/" + core.phoneHash16(e164); }
function ridePrivate(id) { return "carpool_private/rides/" + id; }
function ridePublic(id) { return "carpool_public/rides/" + id; }
function reservationKey(rideId, e164) { return "carpool_private/reservations/" + rideId + "_" + core.phoneHash16(e164); }

function activeRiders(list) {
  return arr(list).filter(function (row) { return row.status === "active"; });
}

async function memberError(tx, config, e164) {
  if (!config.membersOnly) return "";
  const pack = await tx.get("carpool_private/member_index") || { members: [] };
  const hash = core.phoneHash16(e164);
  if (arr(pack.members).some(function (m) { return m.phoneHash === hash; })) return "";
  return "JumpIn is for approved community members only. Please contact the administrator at " + config.contactEmail + " to be added.";
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
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const depart = core.departureError(fields.date, fields.time, input.timeZone, now, config.horizonDays);
    if (depart.error) return { ok: false, field: "time", error: depart.error };
    if (fields.seats > config.maxSeats) return { ok: false, field: "seats", error: "Choose seats from 1 to " + config.maxSeats + "." };
    if (await tx.get(blockKey(fields.phone))) return { ok: false, error: "You can't post a ride right now." };
    const notMember = await memberError(tx, config, fields.phone);
    if (notMember) return { ok: false, field: "phone", error: notMember };
    const phone = await tx.get(phoneKey(fields.phone)) || { postsDay: core.utcDay(now), postsToday: 0, activeReservations: 0 };
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
      timeZone: input.timeZone,
      seatsTotal: fields.seats,
      seatsLeft: fields.seats,
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
    const sent = core.canSend(config, now);
    if (sent) {
      ride.smsSent = 1;
      bumpSms(config);
      const body = status === "pending"
        ? "JumpIn trip is waiting for approval. Manage: " + manageUrl("trip", rideId, secret)
        : "JumpIn trip posted. Manage: " + manageUrl("trip", rideId, secret);
      queueText(texts, fields.phone, body, "CARPOOL_DRIVER_LINK");
    }
    phone.postsDay = core.utcDay(now);
    phone.postsToday = today + 1;
    phone.updatedAt = now;
    tx.set(ridePrivate(rideId), ride);
    tx.set(ridePublic(rideId), pub);
    tx.set(phoneKey(fields.phone), phone);
    await touchAudience(tx, fields.phone, fields.name, "driver", now);
    await rememberRide(tx, ride, []);
    saveConfig(tx, config);
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
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(ridePrivate(input.rideId));
    if (!ride) return { ok: false, error: "This ride is not available." };
    if (ride.status === "cancelled") return { ok: false, error: "This trip was cancelled." };
    if (ride.status === "rejected") return { ok: false, error: "This trip was not approved." };
    if (ride.status === "pending") return { ok: false, error: "Waiting for approval." };
    if (ride.status !== "open" || ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (fields.phone === ride.driverPhoneE164) return { ok: false, error: "The driver already has this trip." };
    if (ride.seatsLeft < 1) return { ok: false, error: "That seat was just taken." };
    const notMember = await memberError(tx, config, fields.phone);
    if (notMember) return { ok: false, field: "phone", error: notMember };
    const phone = await tx.get(phoneKey(fields.phone)) || { postsDay: core.utcDay(now), postsToday: 0, activeReservations: 0 };
    if (core.activeReservations(phone) >= config.maxActiveReservationsPerPhone) {
      return { ok: false, error: "You already have " + config.maxActiveReservationsPerPhone + " upcoming seats." };
    }
    const key = reservationKey(ride.rideId, fields.phone);
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
    ride.seatsLeft -= 1;
    if (ride.activeReservationDocIds.indexOf(key) === -1) ride.activeReservationDocIds.push(key);
    phone.activeReservations = core.activeReservations(phone) + 1;
    phone.updatedAt = now;
    const pub = await tx.get(ridePublic(ride.rideId)) || core.publicRide(ride, [], []);
    pub.seatsLeft = ride.seatsLeft;
    pub.riders = activeRiders(pub.riders).concat([{ reservationId: reservationId, name: fields.name, status: "active" }]);
    pub.messages = arr(pub.messages).concat([core.systemMessage(fields.name + " reserved a seat.", now, pub.messages.length + 1)]);
    pub.updatedAt = now;
    pub.status = ride.status;
    const sent = core.canSend(config, now);
    if (sent) {
      reservation.smsSent = 1;
      bumpSms(config);
      const when = core.formatWhen(ride.departAt, ride.timeZone);
      queueText(texts, fields.phone, "You have a seat. " + when + ", " + ride.from + " to " + ride.to + ". Manage: " + manageUrl("seat", reservationId, secret, ride.rideId), "CARPOOL_RIDER_LINK");
    }
    tx.set(key, reservation);
    tx.set(ridePrivate(ride.rideId), ride);
    tx.set(ridePublic(ride.rideId), pub);
    tx.set(phoneKey(fields.phone), phone);
    await touchAudience(tx, fields.phone, fields.name, "rider", now);
    const riderRows = [];
    for (let i = 0; i < ride.activeReservationDocIds.length; i++) {
      const docId = ride.activeReservationDocIds[i];
      const row = docId === key ? reservation : await tx.get(docId);
      if (row && row.status === "active") riderRows.push({ phoneE164: row.phoneE164, name: row.name || "", status: "active" });
    }
    await rememberRide(tx, ride, riderRows);
    saveConfig(tx, config);
    return {
      ok: true,
      reservationId: reservationId,
      secret: secret,
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

function cancelSeat(db, input, now) {
  return db.runTransaction(async function (tx) {
    const config = await loadConfig(tx, now);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const key = await findReservationKey(tx, input);
    const reservation = key ? await tx.get(key) : null;
    if (!reservation || !assertSecret(input.secret, reservation.tokenHash)) return { ok: false, error: GENERIC_LINK };
    const ride = await tx.get(ridePrivate(reservation.rideId));
    if (!ride || ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (ride.status === "cancelled" || reservation.status === "cancelled") return { ok: true, already: true };
    if (ride.status !== "open" && ride.status !== "pending") return { ok: false, error: GENERIC_LINK };
    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    reservation.idempotencySecret = "";
    ride.seatsLeft += 1;
    const phone = await tx.get(phoneKey(reservation.phoneE164)) || { activeReservations: 0 };
    phone.activeReservations = Math.max(0, core.activeReservations(phone) - 1);
    const pub = await tx.get(ridePublic(ride.rideId));
    if (pub) {
      pub.seatsLeft = ride.seatsLeft;
      pub.riders = arr(pub.riders).map(function (row) {
        if (row.reservationId === reservation.reservationId) return { reservationId: row.reservationId, name: row.name, status: "cancelled" };
        return row;
      }).filter(function (row) { return row.status === "active"; });
      pub.messages = arr(pub.messages).concat([core.systemMessage(reservation.name + " cancelled.", now, arr(pub.messages).length + 1)]);
      pub.updatedAt = now;
      tx.set(ridePublic(ride.rideId), pub);
    }
    tx.set(key, reservation);
    tx.set(ridePrivate(ride.rideId), ride);
    tx.set(phoneKey(reservation.phoneE164), phone);
    const riderRows = [];
    for (let i = 0; i < ride.activeReservationDocIds.length; i++) {
      const docId = ride.activeReservationDocIds[i];
      const row = docId === key ? reservation : await tx.get(docId);
      if (row && row.status === "active") riderRows.push({ phoneE164: row.phoneE164, name: row.name || "", status: "active" });
    }
    await rememberRide(tx, ride, riderRows);
    return { ok: true };
  });
}

async function findReservationKey(tx, input) {
  if (input.reservationDocId) return input.reservationDocId;
  if (input.rideId && input.phone) {
    const phone = core.normalizePhone(input.phone);
    return reservationKey(input.rideId, phone.ok ? phone.e164 : input.phone);
  }
  if (input.rideId && input.secret) {
    const ride = await tx.get(ridePrivate(input.rideId));
    const keys = arr(ride && ride.activeReservationDocIds);
    for (let i = 0; i < keys.length; i++) {
      const row = await tx.get(keys[i]);
      if (row && assertSecret(input.secret, row.tokenHash)) return keys[i];
    }
  }
  return input.reservationKey || "";
}

function cancelTrip(db, input, now) {
  return db.runTransaction(async function (tx) {
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(ridePrivate(input.rideId));
    if (!ride || !assertSecret(input.secret, ride.driverTokenHash)) return { ok: false, error: GENERIC_LINK };
    if (ride.departAt <= now) return { ok: false, error: "This trip has already left." };
    if (ride.status !== "open" && ride.status !== "pending") {
      if (ride.status === "cancelled") return { ok: true, already: true };
      return { ok: false, error: GENERIC_LINK };
    }
    await releaseRide(tx, ride, now, texts, config, "Trip cancelled.", false);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

async function releaseRide(tx, ride, now, outbox, config, systemText, admin) {
  const pub = await tx.get(ridePublic(ride.rideId)) || core.publicRide(ride, [], []);
  const keys = arr(ride.activeReservationDocIds);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const reservation = await tx.get(key);
    if (!reservation || reservation.status !== "active") continue;
    reservation.status = "cancelled";
    reservation.cancelledAt = now;
    const phone = await tx.get(phoneKey(reservation.phoneE164)) || { activeReservations: 0 };
    phone.activeReservations = Math.max(0, core.activeReservations(phone) - 1);
    tx.set(phoneKey(reservation.phoneE164), phone);
    tx.set(key, reservation);
    if (core.canSend(config, now)) {
      bumpSms(config);
      const when = core.formatWhen(ride.departAt, ride.timeZone);
      const body = admin
        ? "A JumpIn admin cancelled this trip. " + when + ", " + ride.from + " to " + ride.to + "."
        : "JumpIn trip cancelled. " + when + ", " + ride.from + " to " + ride.to + ".";
      queueText(outbox, reservation.phoneE164, body, "CARPOOL_TRIP_CANCELLED");
    }
  }
  if (admin && core.canSend(config, now)) {
    bumpSms(config);
    const when = core.formatWhen(ride.departAt, ride.timeZone);
    queueText(outbox, ride.driverPhoneE164, "A JumpIn admin cancelled this trip. " + when + ", " + ride.from + " to " + ride.to + ".", "CARPOOL_TRIP_CANCELLED");
  }
  ride.status = "cancelled";
  ride.cancelledAt = now;
  ride.seatsLeft = 0;
  pub.status = "cancelled";
  pub.seatsLeft = 0;
  pub.riders = [];
  pub.messages = arr(pub.messages).concat([core.systemMessage(systemText, now, arr(pub.messages).length + 1)]);
  pub.updatedAt = now;
  tx.set(ridePrivate(ride.rideId), ride);
  tx.set(ridePublic(ride.rideId), pub);
  await rememberRide(tx, ride, []);
  saveConfig(tx, config);
}

const MESSAGE_GRACE_MS = 60 * 60 * 1000;

function postMessage(db, input, now) {
  const checked = core.messageError(input.text);
  if (checked.error) return Promise.resolve({ ok: false, error: checked.error });
  return db.runTransaction(async function (tx) {
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!config.enabled) return { ok: false, error: "JumpIn is not open yet." };
    const ride = await tx.get(ridePrivate(input.rideId));
    if (!ride || ride.status !== "open" || ride.departAt + MESSAGE_GRACE_MS <= now) return { ok: false, error: GENERIC_LINK };
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
    const pub = await tx.get(ridePublic(ride.rideId));
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
    const noteBody = "JumpIn (" + ride.from + " to " + ride.to + "): " + authorName + ": " + checked.value + " https://waitlink.app?s=jumpin&view=ride&ride=" + ride.rideId;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i] && core.canSend(config, now)) {
        bumpSms(config);
        queueText(texts, targets[i], noteBody, "CARPOOL_MESSAGE");
      }
    }
    tx.set(ridePublic(ride.rideId), pub);
    saveConfig(tx, config);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function sendManageLink(db, input, now, rng) {
  const phone = core.normalizePhone(input.phone);
  if (!phone.ok) return Promise.resolve({ ok: false, field: "phone", error: phone.error, phrase: core.recoveryPhrase() });
  return db.runTransaction(async function (tx) {
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!config.enabled) return { ok: true, phrase: core.recoveryPhrase() };
    const limitId = "carpool_private/limits/" + core.phoneHash16(input.ip || "unknown") + "_" + core.utcDay(now) + "T" + new Date(now).getUTCHours();
    const limit = await tx.get(limitId) || { recoveryCalls: 0, expiresAt: now + core.DAY_MS };
    if (limit.recoveryCalls >= 10) return { ok: true, phrase: core.recoveryPhrase() };
    limit.recoveryCalls += 1;
    limit.expiresAt = limit.expiresAt || now + core.DAY_MS;
    tx.set(limitId, limit);
    const limitIndex = await tx.get("carpool_private/limit_index") || { keys: [] };
    if (limitIndex.keys.indexOf(limitId) === -1) limitIndex.keys.push(limitId);
    tx.set("carpool_private/limit_index", limitIndex);
    const ride = await tx.get(ridePrivate(input.rideId));
    if (!ride || ride.departAt <= now) return { ok: true, phrase: core.recoveryPhrase() };
    let target = null;
    let kind = "";
    if (input.role === "driver" && ride.driverPhoneE164 === phone.e164) {
      target = ride;
      kind = "trip";
    } else if (input.role === "rider") {
      const reservation = await tx.get(reservationKey(ride.rideId, phone.e164));
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
    if (!core.canSend(config, now)) return { ok: true, phrase: core.recoveryPhrase() };
    const secret = core.randomSecret(rng);
    const hashed = core.hashSecret(secret);
    if (kind === "trip") target.driverTokenHash = hashed;
    else target.tokenHash = hashed;
    target.tokenIssuedAt = now;
    target.smsSent = (target.smsSent || 0) + 1;
    target.idempotencySecret = "";
    bumpSms(config);
    queueText(texts, phone.e164, "New JumpIn link: " + manageUrl(kind, kind === "trip" ? ride.rideId : target.reservationId, secret, ride.rideId), "CARPOOL_DRIVER_LINK");
    if (kind === "trip") tx.set(ridePrivate(ride.rideId), target);
    else tx.set(reservationKey(ride.rideId, phone.e164), target);
    saveConfig(tx, config);
    return { ok: true, phrase: core.recoveryPhrase(), texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function manageUrl(kind, id, secret, rideId) {
  if (kind === "trip") return "https://waitlink.app?s=jumpin&view=trip&ride=" + id + "&k=" + secret;
  return "https://waitlink.app?s=jumpin&view=seat&r=" + id + "&k=" + secret + "&ride=" + rideId;
}

function requireAdmin(email, config) {
  const clean = core.cleanEmail(email);
  if (!clean) return false;
  if (clean === SUPERADMIN_EMAIL) return true;
  return !!(config && Array.isArray(config.adminEmails) && config.adminEmails.indexOf(clean) !== -1);
}

function reviewRide(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    const ride = await tx.get(ridePrivate(input.rideId));
    if (!ride || ride.status !== "pending") return { ok: true, already: true, texts: texts };
    const pub = await tx.get(ridePublic(ride.rideId));
    if (!pub) return { ok: false, error: "This ride is not available." };
    if (input.decision === "approve") {
      ride.status = "open";
      pub.status = "open";
      pub.updatedAt = now;
      if (core.canSend(config, now)) {
        bumpSms(config);
        queueText(texts, ride.driverPhoneE164, "Your JumpIn trip is on the board. Share: https://waitlink.app?s=jumpin&view=ride&ride=" + ride.rideId, "CARPOOL_DRIVER_LINK");
      }
    } else if (input.decision === "decline") {
      ride.status = "rejected";
      pub.status = "rejected";
      pub.updatedAt = now;
      if (core.canSend(config, now)) {
        bumpSms(config);
        queueText(texts, ride.driverPhoneE164, "Your JumpIn trip was not approved.", "CARPOOL_DRIVER_LINK");
      }
    } else return { ok: false, error: "Enter a decision." };
    tx.set(ridePrivate(ride.rideId), ride);
    tx.set(ridePublic(ride.rideId), pub);
    await rememberRide(tx, ride, []);
    saveConfig(tx, config);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function adminCancelTrip(db, email, rideId, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const texts = freshTexts();
    const config = await loadConfig(tx, now);
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    const ride = await tx.get(ridePrivate(rideId));
    if (!ride) return { ok: false, error: "This ride is not available." };
    if (ride.status === "cancelled") return { ok: true, already: true, texts: texts };
    if (ride.status !== "open" && ride.status !== "pending") return { ok: false, error: "This trip can no longer be cancelled." };
    await releaseRide(tx, ride, now, texts, config, "Trip cancelled.", true);
    return { ok: true, texts: texts };
  }).then(function (result) {
    return withOutbox(result, result.texts);
  });
}

function setPosting(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const config = await loadConfig(tx, now || Date.now());
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    if (input.phoneHash && input.blocked === false) {
      const index = await tx.get("carpool_private/block_index") || { blocks: [] };
      index.blocks = arr(index.blocks).filter(function (row) { return row.phoneHash !== input.phoneHash; });
      tx.del("carpool_private/blocks/" + input.phoneHash);
      tx.set("carpool_private/block_index", index);
      return { ok: true };
    }
    let e164 = "";
    let name = "";
    if (input.rideId) {
      const ride = await tx.get(ridePrivate(input.rideId));
      if (!ride) return { ok: false, error: "This ride is not available." };
      e164 = ride.driverPhoneE164;
      name = ride.driverName;
    } else {
      const phone = core.normalizePhone(input.phone);
      if (!phone.ok) return { ok: false, error: phone.error };
      e164 = phone.e164;
      name = core.collapse(input.name || "");
    }
    const key = blockKey(e164);
    const hash = core.phoneHash16(e164);
    const index = await tx.get("carpool_private/block_index") || { blocks: [] };
    index.blocks = arr(index.blocks).filter(function (row) { return row.phoneHash !== hash; });
    if (input.blocked) {
      const entry = { phoneHash: hash, driverName: name, phoneLast4: core.last4(e164), blockedAt: now };
      tx.set(key, entry);
      index.blocks.push(entry);
    } else tx.del(key);
    tx.set("carpool_private/block_index", index);
    return { ok: true, phoneLast4: core.last4(e164) };
  });
}

function listAdmin(db, email, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const config = await loadConfig(tx, now || Date.now());
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
    const blocks = await tx.get("carpool_private/block_index") || { blocks: [] };
    const memberPack = await tx.get("carpool_private/member_index") || { members: [] };
    const clock = now || Date.now();
    const allRides = arr(pack.rides);
    const pubs = {};
    for (let i = 0; i < allRides.length; i++) {
      pubs[allRides[i].rideId] = await tx.get(ridePublic(allRides[i].rideId));
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
        status: ride.status,
        departAt: ride.departAt,
        driverName: ride.driverName || "",
        phoneLast4: ride.phoneLast4 || core.last4(ride.driverPhoneE164),
        from: ride.from || "",
        to: ride.to || "",
        note: ride.note || "",
        seatsLeft: ride.seatsLeft,
        timeZone: ride.timeZone || "UTC",
        riders: riders,
        messages: arr(pub.messages)
      };
    }
    return {
      ok: true,
      config: config,
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
    const config = await loadConfig(tx, now);
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
    const phones = broadcastPlan(pack, scope, input.rideId, now);
    const left = core.smsBudget(config, now).left;
    if (!input.confirm) return { ok: true, count: phones.length, left: left, confirm: false };
    if (phones.length > left) return { ok: false, error: "This would text " + phones.length + " people and " + left + " texts are left today.", count: phones.length, left: left };
    phones.forEach(function (e164) {
      bumpSms(config);
    });
    saveConfig(tx, config);
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

function completeDue(db, now) {
  return db.runTransaction(async function (tx) {
    const index = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
    let changed = 0;
    const rides = arr(index.rides);
    for (let i = 0; i < rides.length; i++) {
      const row = rides[i];
      const ride = await tx.get(ridePrivate(row.rideId));
      if (!ride) continue;
      if ((ride.status === "open" || ride.status === "pending") && ride.departAt + MESSAGE_GRACE_MS <= now) {
        ride.status = "completed";
        ride.completedAt = now;
        row.status = "completed";
        const pub = await tx.get(ridePublic(ride.rideId));
        if (pub) {
          pub.status = "completed";
          pub.updatedAt = now;
          tx.set(ridePublic(ride.rideId), pub);
        }
        tx.set(ridePrivate(ride.rideId), ride);
        changed += 1;
      }
    }
    tx.set("carpool_private/broadcast_index", index);
    return { ok: true, completed: changed };
  });
}

function retainTrips(db, now) {
  return db.runTransaction(async function (tx) {
    const index = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
    const kept = [];
    const rides = arr(index.rides);
    for (let i = 0; i < rides.length; i++) {
      const row = rides[i];
      const ride = await tx.get(ridePrivate(row.rideId));
      const pub = await tx.get(ridePublic(row.rideId));
      const endedAt = ride ? (ride.completedAt || ride.cancelledAt || 0) : 0;
      const ended = ride && (ride.status === "completed" || ride.status === "cancelled" || ride.status === "rejected");
      if (ride && ended && endedAt && now - endedAt >= 7 * core.DAY_MS) {
        const keys = arr(ride.activeReservationDocIds);
        for (let k = 0; k < keys.length; k++) tx.del(keys[k]);
        tx.del(ridePrivate(row.rideId));
        tx.set(ridePublic(row.rideId), { rideId: row.rideId, status: "missing", purgedAt: now, departAt: row.departAt });
        kept.push({ rideId: row.rideId, status: "missing", purgedAt: now, departAt: row.departAt });
        continue;
      }
      if (!ride && pub && pub.purgedAt && now - pub.purgedAt >= 30 * core.DAY_MS) {
        tx.del(ridePublic(row.rideId));
        continue;
      }
      kept.push(row);
    }
    index.rides = kept;
    tx.set("carpool_private/broadcast_index", index);
    const limits = await tx.get("carpool_private/limit_index") || { keys: [] };
    const live = [];
    for (let i = 0; i < arr(limits.keys).length; i++) {
      const doc = await tx.get(limits.keys[i]);
      if (!doc || (doc.expiresAt && doc.expiresAt <= now)) tx.del(limits.keys[i]);
      else live.push(limits.keys[i]);
    }
    tx.set("carpool_private/limit_index", { keys: live });
    return { ok: true, kept: kept.length, audience: arr(index.audience).length };
  });
}

function markOptOut(db, phone, now) {
  const parsed = core.normalizePhone(phone);
  if (!parsed.ok) return Promise.resolve({ ok: false, error: parsed.error });
  return db.runTransaction(async function (tx) {
    const key = "carpool_private/audience/" + core.phoneHash16(parsed.e164);
    const prev = await tx.get(key) || { roles: [], displayName: "", phoneLast4: core.last4(parsed.e164) };
    prev.phoneE164 = parsed.e164;
    prev.smsOptOut = true;
    prev.updatedAt = now;
    tx.set(key, prev);
    await rememberAudience(tx, parsed.e164, true);
    return { ok: true };
  });
}

function setMembers(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  const body = input || {};
  const clock = now || Date.now();
  return db.runTransaction(async function (tx) {
    const config = await loadConfig(tx, clock);
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get("carpool_private/member_index") || { members: [] };
    let list = arr(pack.members).slice();
    if (body.removePhoneHash) {
      list = list.filter(function (m) { return m.phoneHash !== body.removePhoneHash; });
      tx.set("carpool_private/member_index", { members: list });
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
        name: rawName.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 40) || "Member",
        addedAt: clock
      };
      list = list.filter(function (m) { return m.phoneHash !== hash; });
      list.push(entry);
      added += 1;
    }
    tx.set("carpool_private/member_index", { members: list });
    return { ok: true, added: added, skipped: skipped, count: list.length };
  });
}

function saveAdminConfig(db, email, input, now) {
  if (!core.cleanEmail(email)) return Promise.resolve({ ok: false, error: "This page is not available." });
  return db.runTransaction(async function (tx) {
    const prev = await loadConfig(tx, now || Date.now());
    if (!requireAdmin(email, prev)) return { ok: false, error: "This page is not available." };
    const next = core.clampConfig(input);
    next.dailySmsSent = prev.dailySmsSent;
    next.dailySmsDay = prev.dailySmsDay;
    saveConfig(tx, next);
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
    const config = await loadConfig(tx, clock);
    if (!requireAdmin(email, config)) return { ok: false, error: "This page is not available." };
    const pack = await tx.get("carpool_private/broadcast_index") || { rides: [], audience: [] };
    const limits = await tx.get("carpool_private/limit_index") || { keys: [] };
    const blocks = await tx.get("carpool_private/block_index") || { blocks: [] };
    const members = await tx.get("carpool_private/member_index") || { members: [] };
    const allRides = arr(pack.rides);
    const isPastOrClosed = function (r) {
      return r.status === "completed" || r.status === "cancelled" || r.status === "rejected" || (r.status === "open" && r.departAt + MESSAGE_GRACE_MS <= clock);
    };
    const targetRides = scope === "past" ? allRides.filter(isPastOrClosed) : (scope === "trips" || scope === "all" ? allRides : []);
    const resKeys = [];
    for (let i = 0; i < targetRides.length; i++) {
      const priv = await tx.get(ridePrivate(targetRides[i].rideId));
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
      tx.del(ridePrivate(r.rideId));
      tx.del(ridePublic(r.rideId));
    });
    resKeys.forEach(function (k) { tx.del(k); });
    if (scope === "past") {
      const dropIds = targetRides.map(function (r) { return r.rideId; });
      tx.set("carpool_private/broadcast_index", {
        rides: allRides.filter(function (r) { return dropIds.indexOf(r.rideId) === -1; }),
        audience: arr(pack.audience)
      });
    } else if (scope === "trips") {
      arr(limits.keys).forEach(function (k) { tx.del(k); });
      tx.set("carpool_private/limit_index", { keys: [] });
      tx.set("carpool_private/broadcast_index", { rides: [], audience: arr(pack.audience) });
    } else if (scope === "audience") {
      tx.set("carpool_private/broadcast_index", { rides: allRides, audience: [] });
    } else {
      arr(limits.keys).forEach(function (k) { tx.del(k); });
      arr(blocks.blocks).forEach(function (b) { tx.del("carpool_private/blocks/" + b.phoneHash); });
      tx.set("carpool_private/limit_index", { keys: [] });
      tx.set("carpool_private/block_index", { blocks: [] });
      tx.set("carpool_private/member_index", { members: [] });
      tx.set("carpool_private/broadcast_index", { rides: [], audience: [] });
    }
    return { ok: true, confirm: true, scope: scope, deleted: counts };
  });
}

module.exports = {
  SUPERADMIN_EMAIL: SUPERADMIN_EMAIL,
  GENERIC_LINK: GENERIC_LINK,
  createMemoryDb: createMemoryDb,
  postRide: postRide,
  reserveSeat: reserveSeat,
  cancelSeat: cancelSeat,
  cancelTrip: cancelTrip,
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
  manageUrl: manageUrl
};
