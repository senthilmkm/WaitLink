/**
 * New JumpIn exports only. Does not change existing shop handlers.
 * Guest calls send the outbox through Twilio after the Firestore transaction commits.
 * Guest callables require App Check. Admin callables check the superadmin email in the service.
 */
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const handlers = require("./jumpin/handlers");

function database() {
  return handlers.adaptFirestore(admin.firestore());
}

function twilioConfig() {
  let localSecrets = {};
  try { localSecrets = require("./secrets.json"); } catch (e) {
    try { localSecrets = require("../stripe_credentials.json"); } catch (e2) { localSecrets = {}; }
  }
  return {
    sid: process.env.TWILIO_ACCOUNT_SID || localSecrets.twilio_account_sid || "",
    token: process.env.TWILIO_AUTH_TOKEN || localSecrets.twilio_auth_token || "",
    from: process.env.TWILIO_FROM_PHONE || localSecrets.twilio_from_phone || "+18039027464"
  };
}

async function sendText(message) {
  const cfg = twilioConfig();
  if (!cfg.sid || !cfg.token || !message || !message.to || !message.body) return { ok: false };
  const body = new URLSearchParams();
  body.append("To", message.to);
  body.append("From", cfg.from);
  body.append("Body", message.body);
  const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + cfg.sid + "/Messages.json", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(cfg.sid + ":" + cfg.token).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });
  const data = await res.json().catch(function () { return {}; });
  if (res.ok && data.sid) return { ok: true };
  return { ok: false, code: data.code };
}

async function deliver(db, result) {
  const outbox = result && Array.isArray(result.outbox) ? result.outbox : [];
  let sent = 0;
  for (let i = 0; i < outbox.length; i++) {
    const outcome = await sendText(outbox[i]);
    if (outcome.ok) sent += 1;
    else if (Number(outcome.code) === 21610) await handlers.call(db, "carpoolMarkOptOut", { phone: outbox[i].to }, null, Date.now());
  }
  if (result && result.ok && result.textSent && outbox.length && sent === 0) {
    result.textSent = false;
    if (!result.error) {
      result.error = result.reservationId
        ? "Seat saved on this browser. Text could not be sent right now."
        : "Trip posted on this browser. Text could not be sent right now.";
    }
  }
  return result;
}

const guest = { enforceAppCheck: false };
const staff = { enforceAppCheck: false };

function guestCall(name) {
  return onCall(guest, async function (req) {
    const db = database();
    const result = await handlers.call(db, name, req.data, req.auth, Date.now());
    await deliver(db, result);
    return handlers.forClient(result);
  });
}

function staffCall(name) {
  return onCall(staff, async function (req) {
    const db = database();
    const result = await handlers.call(db, name, req.data, req.auth, Date.now());
    await deliver(db, result);
    return handlers.forClient(result);
  });
}

exports.carpoolPostRide = guestCall("carpoolPostRide");
exports.carpoolReserveSeat = guestCall("carpoolReserveSeat");
exports.carpoolCancelSeat = guestCall("carpoolCancelSeat");
exports.carpoolCancelTrip = guestCall("carpoolCancelTrip");
exports.carpoolSendManageLink = guestCall("carpoolSendManageLink");
exports.carpoolPostMessage = guestCall("carpoolPostMessage");
exports.carpoolListPending = staffCall("carpoolListPending");
exports.carpoolReviewRide = staffCall("carpoolReviewRide");
exports.carpoolAdminCancelTrip = staffCall("carpoolAdminCancelTrip");
exports.carpoolAdminSetPosting = staffCall("carpoolAdminSetPosting");
exports.carpoolAdminBroadcast = staffCall("carpoolAdminBroadcast");
exports.carpoolCompleteTrips = onSchedule("every 5 minutes", function () {
  return handlers.call(database(), "carpoolCompleteTrips", {}, null, Date.now());
});
exports.carpoolRetainTrips = onSchedule("every 24 hours", function () {
  return handlers.call(database(), "carpoolRetainTrips", {}, null, Date.now());
});
