/**
 * JumpIn pure rules. No Firestore, no DOM.
 * Spec: docs/CARPOOL_JUMPIN_TECH_DESIGN.md
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JumpInCore = api;
  /* c8 ignore end */
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const IDEMPOTENCY_MS = 15 * 60 * 1000;

  function stripTags(value) {
    return String(value == null ? "" : value).replace(/<[^>]*>/g, "");
  }

  function collapse(value) {
    return stripTags(value).replace(/\s+/g, " ").trim();
  }

  function digits(value) {
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function normalizePhone(input) {
    const cleaned = digits(input);
    let e164 = "";
    if (cleaned.length === 10) e164 = "+1" + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith("1")) e164 = "+" + cleaned;
    else return { ok: false, error: "Enter a US or Canada mobile number." };
    return { ok: true, e164: e164 };
  }

  function sha256Hex(message) {
    const bytes = utf8(message);
    const bitLen = bytes.length * 8;
    const withOne = bytes.concat([0x80]);
    while ((withOne.length % 64) !== 56) withOne.push(0);
    const lenHi = Math.floor(bitLen / 0x100000000);
    const lenLo = bitLen >>> 0;
    for (let i = 3; i >= 0; i--) withOne.push((lenHi >>> (i * 8)) & 0xff);
    for (let i = 3; i >= 0; i--) withOne.push((lenLo >>> (i * 8)) & 0xff);
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const w = new Array(64);
    for (let offset = 0; offset < withOne.length; offset += 64) {
      for (let i = 0; i < 16; i++) {
        const j = offset + i * 4;
        w[i] = ((withOne[j] << 24) | (withOne[j + 1] << 16) | (withOne[j + 2] << 8) | withOne[j + 3]) >>> 0;
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (hh + S1 + ch + k[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(toHex8).join("");
  }

  function rotr(n, s) { return (n >>> s) | (n << (32 - s)); }
  function toHex8(n) { return ("00000000" + n.toString(16)).slice(-8); }
  function utf8(text) {
    const out = [];
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        const next = s.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return out;
  }

  function phoneHash16(e164) { return sha256Hex(e164).slice(0, 16); }
  function hashSecret(secret) { return sha256Hex(String(secret)); }
  function timingSafeEqual(a, b) {
    const x = String(a || "");
    const y = String(b || "");
    const n = Math.max(x.length, y.length);
    let diff = x.length ^ y.length;
    for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
    return diff === 0;
  }

  function base64url(bytes) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const triple = (b0 << 16) | (b1 << 8) | b2;
      out += alphabet[(triple >> 18) & 63] + alphabet[(triple >> 12) & 63];
      if (i + 1 < bytes.length) out += alphabet[(triple >> 6) & 63];
      if (i + 2 < bytes.length) out += alphabet[triple & 63];
    }
    return out;
  }

  function randomBytes(n, rng) {
    if (typeof rng === "function") return Array.from(rng(n));
    const buf = new Uint8Array(n);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf);
  }

  function randomId(prefix, rng) {
    return prefix + base64url(randomBytes(9, rng)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  }
  function randomSecret(rng) { return base64url(randomBytes(32, rng)); }

  function cleanEmail(raw) {
    const email = String(raw || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
  }

  function cleanAdminEmails(raw) {
    const list = Array.isArray(raw) ? raw : String(raw || "").split(/[\n,;]+/);
    const out = ["senthil930@gmail.com"];
    list.forEach(function (item) {
      const email = cleanEmail(item);
      if (email && out.indexOf(email) === -1) out.push(email);
    });
    return out;
  }

  function defaultConfig() {
    return {
      enabled: false,
      requireRideApproval: false,
      membersOnly: false,
      adminEmails: ["senthil930@gmail.com"],
      contactEmail: "senthil930@gmail.com",
      supportNote: "",
      postRideThankYouSms: false,
      dailySmsCap: 200,
      dailySmsSent: 0,
      dailySmsDay: "",
      maxSeats: 6,
      horizonDays: 30,
      maxMessagesPerRide: 20,
      maxPostsPerPhonePerDay: 10,
      maxActiveReservationsPerPhone: 5,
      maxSmsPerRecord: 4,
      resendCooldownSec: 60
    };
  }

  function clampConfig(input) {
    const base = defaultConfig();
    const src = input || {};
    function int(name, min, max, fallback) {
      const n = Number(src[name]);
      if (!Number.isInteger(n) || n < min || n > max) return fallback;
      return n;
    }
    return {
      enabled: src.enabled === true,
      requireRideApproval: src.requireRideApproval === true,
      membersOnly: src.membersOnly === true,
      adminEmails: cleanAdminEmails(src.adminEmails),
      contactEmail: cleanEmail(src.contactEmail) || base.contactEmail,
      supportNote: String(src.supportNote || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120),
      postRideThankYouSms: src.postRideThankYouSms === true,
      dailySmsCap: int("dailySmsCap", 0, 5000, base.dailySmsCap),
      dailySmsSent: Number.isFinite(Number(src.dailySmsSent)) ? Number(src.dailySmsSent) : 0,
      dailySmsDay: typeof src.dailySmsDay === "string" ? src.dailySmsDay : "",
      maxSeats: int("maxSeats", 1, 6, base.maxSeats),
      horizonDays: int("horizonDays", 1, 60, base.horizonDays),
      maxMessagesPerRide: int("maxMessagesPerRide", 1, 20, base.maxMessagesPerRide),
      maxPostsPerPhonePerDay: int("maxPostsPerPhonePerDay", 1, 50, base.maxPostsPerPhonePerDay),
      maxActiveReservationsPerPhone: int("maxActiveReservationsPerPhone", 1, 20, base.maxActiveReservationsPerPhone),
      maxSmsPerRecord: int("maxSmsPerRecord", 1, 10, base.maxSmsPerRecord),
      resendCooldownSec: int("resendCooldownSec", 30, 600, base.resendCooldownSec)
    };
  }

  function configFieldError(name, raw) {
    const ranges = {
      dailySmsCap: [0, 5000],
      maxSeats: [1, 6],
      horizonDays: [1, 60],
      maxMessagesPerRide: [1, 20],
      maxPostsPerPhonePerDay: [1, 50],
      maxActiveReservationsPerPhone: [1, 20],
      maxSmsPerRecord: [1, 10],
      resendCooldownSec: [30, 600]
    };
    if (!(name in ranges)) return null;
    const n = Number(raw);
    const span = ranges[name];
    if (!Number.isInteger(n) || n < span[0] || n > span[1]) return "Enter a number from " + span[0] + " to " + span[1] + ".";
    return null;
  }

  function nameError(value, emptySentence) {
    const name = collapse(value);
    if (!name) return { error: emptySentence || "Enter your name." };
    if (name.length > 40) return { error: "Use 40 characters or fewer." };
    return { value: name };
  }

  function placeError(value, emptySentence) {
    const text = collapse(value);
    if (text.length < 2) return { error: emptySentence };
    if (text.length > 80) return { error: "Use 80 characters or fewer." };
    return { value: text };
  }

  function noteValue(value) {
    const text = collapse(value);
    if (text.length > 140) return { error: "Use 140 characters or fewer." };
    return { value: text };
  }

  function messageError(value) {
    const text = collapse(value);
    if (!text) return { error: "Enter a message." };
    if (text.length > 280) return { error: "Use 280 characters or fewer." };
    return { value: text };
  }

  function announceError(value) {
    const text = collapse(value);
    if (!text) return { error: "Enter a message." };
    if (text.length > 280) return { error: "Use 280 characters or fewer." };
    return { value: text };
  }

  function postErrors(fields) {
    const name = nameError(fields.name, "Enter your name.");
    if (name.error) return { field: "name", error: name.error };
    const phone = normalizePhone(fields.phone);
    if (!phone.ok) return { field: "phone", error: phone.error };
    const from = placeError(fields.from, "Enter where you are leaving from.");
    if (from.error) return { field: "from", error: from.error };
    const to = placeError(fields.to, "Enter where you are going.");
    if (to.error) return { field: "to", error: to.error };
    if (!fields.date) return { field: "date", error: "Choose a date." };
    if (!fields.time) return { field: "time", error: "Choose a time." };
    const note = noteValue(fields.note);
    if (note.error) return { field: "note", error: note.error };
    const seats = Number(fields.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 6) return { field: "seats", error: "Choose seats from 1 to 6." };
    const rawDuration = fields.durationMinutes;
    const durationMinutes = rawDuration == null || rawDuration === "" ? 60 : Number(rawDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
      return { field: "durationMinutes", error: "Choose an estimated trip duration." };
    }
    return { value: { name: name.value, phone: phone.e164, from: from.value, to: to.value, date: String(fields.date), time: String(fields.time), note: note.value, seats: seats, durationMinutes: durationMinutes } };
  }

  function reserveErrors(fields) {
    const name = nameError(fields.name, "Enter your name.");
    if (name.error) return { field: "name", error: name.error };
    const phone = normalizePhone(fields.phone);
    if (!phone.ok) return { field: "phone", error: phone.error };
    const rawSeats = fields.seats;
    const seats = rawSeats == null || rawSeats === "" ? 1 : Number(rawSeats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 6) return { field: "seats", error: "Choose seats from 1 to 6." };
    return { value: { name: name.value, phone: phone.e164, seats: seats } };
  }

  function partsInZone(utcMs, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const bag = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
    fmt.formatToParts(new Date(utcMs)).forEach(function (part) {
      if (part.type === "literal") return;
      bag[part.type] = Number(part.type === "hour" && part.value === "24" ? "0" : part.value);
    });
    return bag;
  }

  function zonedToUtc(dateStr, timeStr, timeZone) {
    const dateBits = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
    const timeBits = /^(\d{2}):(\d{2})$/.exec(String(timeStr || ""));
    if (!dateBits || !timeBits) return null;
    const y = Number(dateBits[1]);
    const m = Number(dateBits[2]);
    const d = Number(dateBits[3]);
    const hh = Number(timeBits[1]);
    const mm = Number(timeBits[2]);
    if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
    const want = Date.UTC(y, m - 1, d, hh, mm, 0);
    if (new Date(want).getUTCFullYear() !== y || new Date(want).getUTCMonth() !== m - 1 || new Date(want).getUTCDate() !== d) return null;
    let utc = want;
    for (let i = 0; i < 4; i++) {
      const got = partsInZone(utc, timeZone);
      const asUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
      const diff = want - asUtc;
      if (diff === 0) break;
      utc += diff;
    }
    const check = partsInZone(utc, timeZone);
    if (check.year !== y || check.month !== m || check.day !== d || check.hour !== hh || check.minute !== mm) return null;
    return utc;
  }

  function departureError(dateStr, timeStr, timeZone, now, horizonDays) {
    let utc;
    try {
      utc = zonedToUtc(dateStr, timeStr, timeZone);
    } catch (err) {
      return { error: "Choose a date." };
    }
    if (utc == null) return { error: "Choose a later time." };
    if (utc <= now) return { error: "Choose a later time." };
    const horizon = (horizonDays || 30) * DAY_MS;
    if (utc > now + horizon) return { error: "Choose a time within the next " + (horizonDays || 30) + " days." };
    return { departAt: utc };
  }

  const ZONE_SHORT = { EST: "ET", EDT: "ET", CST: "CT", CDT: "CT", MST: "MT", MDT: "MT", PST: "PT", PDT: "PT" };

  function formatDuration(minutes) {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) return "";
    if (mins < 60) return mins + " min";
    const hrs = mins / 60;
    if (Number.isInteger(hrs)) return hrs === 1 ? "1 hr" : hrs + " hrs";
    return hrs.toFixed(1) + " hrs";
  }

  function formatWhen(utcMs, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h12",
      timeZoneName: "short"
    });
    const bag = {};
    fmt.formatToParts(new Date(utcMs)).forEach(function (part) {
      if (part.type !== "literal") bag[part.type] = part.value;
    });
    const zone = ZONE_SHORT[bag.timeZoneName] || bag.timeZoneName || "";
    return bag.weekday + " " + bag.hour + ":" + bag.minute + " " + bag.dayPeriod + (zone ? " " + zone : "");
  }

  function utcDay(now) {
    const d = new Date(now);
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return d.getUTCFullYear() + "-" + m + "-" + day;
  }

  function postsToday(phoneDoc, now) {
    if (!phoneDoc || phoneDoc.postsDay !== utcDay(now)) return 0;
    return Number(phoneDoc.postsToday) || 0;
  }

  function activeReservations(phoneDoc) {
    return phoneDoc ? (Number(phoneDoc.activeReservations) || 0) : 0;
  }

  function smsBudget(config, now) {
    const day = utcDay(now);
    const sent = config.dailySmsDay === day ? Number(config.dailySmsSent) || 0 : 0;
    return { day: day, sent: sent, left: Math.max(0, config.dailySmsCap - sent) };
  }

  function canSend(config, now) {
    return smsBudget(config, now).left > 0;
  }

  function last4(e164) { return String(e164 || "").slice(-4); }

  function publicRide(ride, riders, messages) {
    return {
      rideId: ride.rideId,
      status: ride.status,
      from: ride.from,
      to: ride.to,
      departAt: ride.departAt,
      durationMinutes: Number(ride.durationMinutes) || 60,
      timeZone: ride.timeZone,
      seatsTotal: ride.seatsTotal,
      seatsLeft: ride.seatsLeft,
      note: ride.note,
      driverName: ride.driverName,
      riders: riders || [],
      messages: messages || [],
      createdAt: ride.createdAt,
      updatedAt: ride.updatedAt
    };
  }

  function systemMessage(text, now, n) {
    return { messageId: "msg_" + now + "_" + n, kind: "system", authorName: "", authorRole: "system", text: text, createdAt: now };
  }

  function filledButton(model) {
    if (model.recovery) return "Text me a link";
    if (model.mode === "post") return "Post";
    if (model.mode === "board") return "Post a ride";
    if (model.status === "pending") return null;
    if (model.status === "rejected" || model.status === "cancelled" || model.status === "completed" || model.status === "missing") return null;
    if (model.role === "driver") return "Copy link";
    if (model.role === "rider") return "Send";
    if (model.reserveOpen) return "Reserve a seat";
    if (model.seatsLeft > 0 && model.status === "open") return "Reserve a seat";
    return null;
  }

  function platformOf(ua) {
    return /Android/i.test(String(ua || "")) ? "android" : "ios";
  }

  function recoveryPhrase() {
    return "If this number is on this ride, we sent a text.";
  }

  return {
    DAY_MS: DAY_MS,
    IDEMPOTENCY_MS: IDEMPOTENCY_MS,
    stripTags: stripTags,
    collapse: collapse,
    normalizePhone: normalizePhone,
    sha256Hex: sha256Hex,
    phoneHash16: phoneHash16,
    hashSecret: hashSecret,
    timingSafeEqual: timingSafeEqual,
    randomId: randomId,
    randomSecret: randomSecret,
    cleanEmail: cleanEmail,
    cleanAdminEmails: cleanAdminEmails,
    defaultConfig: defaultConfig,
    clampConfig: clampConfig,
    configFieldError: configFieldError,
    postErrors: postErrors,
    reserveErrors: reserveErrors,
    messageError: messageError,
    announceError: announceError,
    zonedToUtc: zonedToUtc,
    departureError: departureError,
    formatDuration: formatDuration,
    formatWhen: formatWhen,
    partsInZone: partsInZone,
    utcDay: utcDay,
    postsToday: postsToday,
    activeReservations: activeReservations,
    smsBudget: smsBudget,
    canSend: canSend,
    last4: last4,
    publicRide: publicRide,
    systemMessage: systemMessage,
    filledButton: filledButton,
    platformOf: platformOf,
    recoveryPhrase: recoveryPhrase
  };
});
