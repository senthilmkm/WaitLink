/**
 * Maps callable names onto the JumpIn service.
 * Firestore reads stay async so the same functions run in tests and in production.
 */
const service = require("./service.js");

function call(db, name, data, auth, now) {
  const email = auth && auth.token && auth.token.email;
  const body = data || {};
  if (name === "carpoolPostRide") return service.postRide(db, body, now);
  if (name === "carpoolReserveSeat") return service.reserveSeat(db, body, now);
  if (name === "carpoolUpdateSeat") return service.updateSeat(db, body, now);
  if (name === "carpoolCancelSeat") return service.cancelSeat(db, body, now);
  if (name === "carpoolCancelTrip") return service.cancelTrip(db, body, now);
  if (name === "carpoolCompleteTrip") return service.completeTrip(db, body, now);
  if (name === "carpoolSendManageLink") return service.sendManageLink(db, body, now);
  if (name === "carpoolPostMessage") return service.postMessage(db, body, now);
  if (name === "carpoolListPending") return service.listAdmin(db, email, now);
  if (name === "carpoolReviewRide") return service.reviewRide(db, email, body, now);
  if (name === "carpoolAdminCancelTrip") return service.adminCancelTrip(db, email, body.rideId, now);
  if (name === "carpoolAdminSetPosting") return service.setPosting(db, email, body, now);
  if (name === "carpoolAdminSetMembers") return service.setMembers(db, email, body, now);
  if (name === "carpoolAdminSaveConfig") return service.saveAdminConfig(db, email, body, now);
  if (name === "carpoolAdminPurge") return service.purgeData(db, email, body, now);
  if (name === "carpoolAdminBroadcast") return service.broadcast(db, email, body, now);
  if (name === "carpoolCompleteTrips") return service.completeDue(db, now);
  if (name === "carpoolRetainTrips") return service.retainTrips(db, now);
  if (name === "carpoolMarkOptOut") return service.markOptOut(db, body.phone, now);
  return Promise.resolve({ ok: false, error: "Unknown request." });
}

function documentPath(key) {
  const parts = String(key || "").split("/").filter(Boolean);
  if (parts.length % 2 === 0) return parts.join("/");
  return [parts[0], "root"].concat(parts.slice(1)).join("/");
}

function forClient(result) {
  if (!result || typeof result !== "object") return result;
  const copy = Object.assign({}, result);
  delete copy.outbox;
  delete copy.texts;
  delete copy.phones;
  return copy;
}

function adaptFirestore(fs) {
  return {
    runTransaction: function (fn) {
      return fs.runTransaction(async function (tx) {
        const staged = new Map();
        const removed = new Set();
        const result = await fn({
          get: async function (key) {
            const path = documentPath(key);
            if (removed.has(path)) return null;
            if (staged.has(path)) return staged.get(path);
            const snap = await tx.get(fs.doc(path));
            return snap.exists ? snap.data() : null;
          },
          set: function (key, value) {
            const path = documentPath(key);
            removed.delete(path);
            staged.set(path, value);
          },
          del: function (key) {
            const path = documentPath(key);
            staged.delete(path);
            removed.add(path);
          }
        });
        removed.forEach(function (path) { tx.delete(fs.doc(path)); });
        staged.forEach(function (value, path) { tx.set(fs.doc(path), value); });
        return result;
      });
    }
  };
}

module.exports = { call: call, adaptFirestore: adaptFirestore, documentPath: documentPath, forClient: forClient };
