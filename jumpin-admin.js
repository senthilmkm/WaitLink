/**
 * JumpIn admin page. Not linked from shop screens.
 * Shows names and last four digits only.
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root && root.document) api.start(root);
  /* c8 ignore end */
})(typeof window !== "undefined" ? window : globalThis, function () {
  /* c8 ignore next */
  const admin = typeof module === "object" && module.exports ? require("./jumpin/admin-state.js") : globalThis.JumpInAdmin;

  function text(node, value) {
    if (!node) return;
    node.textContent = value == null ? "" : String(value);
  }

  function row(doc, label, onClick) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "textish";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function fill(doc, node, rows, make) {
    if (!node) return;
    node.textContent = "";
    if (!rows.length) {
      node.appendChild(doc.createTextNode("None"));
      return;
    }
    rows.forEach(function (item) { node.appendChild(make(item)); });
  }

  function render(doc, state, lists, cloud) {
    text(doc.getElementById("jumpin-error"), state.error);
    text(doc.getElementById("jumpin-count"), state.pendingConfirm ? (state.count + " people. " + state.left + " texts left today.") : "");
    const send = doc.getElementById("jumpin-send");
    if (send) send.hidden = !admin.canSend(state);
    if (lists && lists.config) text(doc.getElementById("jumpin-sms-today"), "Texts sent today: " + (lists.config.dailySmsSent || 0));
    const pending = doc.getElementById("jumpin-pending");
    const upcoming = doc.getElementById("jumpin-upcoming");
    const blocked = doc.getElementById("jumpin-blocked");
    fill(doc, pending, (lists && lists.pending) || [], function (ride) {
      const wrap = doc.createElement("div");
      const waiting = [
        ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId,
        ride.driverName || "",
        ride.seatsLeft == null ? "" : ride.seatsLeft + " seats",
        ride.note || ""
      ].filter(Boolean).join(" · ");
      wrap.appendChild(row(doc, waiting, function () {}));
      if (cloud) {
        wrap.appendChild(row(doc, "Approve", function () { cloud.review(ride.rideId, "approve").then(cloud.refresh); }));
        wrap.appendChild(row(doc, "Decline", function () { cloud.review(ride.rideId, "decline").then(cloud.refresh); }));
        wrap.appendChild(row(doc, "Cancel trip", function () { cloud.adminCancel(ride.rideId).then(cloud.refresh); }));
      }
      return wrap;
    });
    fill(doc, upcoming, (lists && lists.upcoming) || [], function (ride) {
      const wrap = doc.createElement("div");
      const when = ride.departAt ? new Date(ride.departAt).toLocaleString() : "";
      const detail = [
        ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId,
        when,
        ride.driverName || "",
        ride.seatsLeft == null ? "" : ride.seatsLeft + " seats left",
        ride.phoneLast4 ? "····" + ride.phoneLast4 : "",
        ride.note || ""
      ].filter(Boolean).join(" · ");
      wrap.appendChild(row(doc, detail, function () {}));
      if (cloud) {
        wrap.appendChild(row(doc, "Cancel trip", function () { cloud.adminCancel(ride.rideId).then(cloud.refresh); }));
        wrap.appendChild(row(doc, "Block posting", function () { cloud.setPosting({ rideId: ride.rideId, blocked: true }).then(cloud.refresh); }));
        wrap.appendChild(row(doc, "Text this trip", function () { cloud.chooseTrip(ride.rideId); }));
      }
      return wrap;
    });
    fill(doc, blocked, (lists && lists.blocked) || [], function (entry) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "textish";
      button.textContent = (entry.driverName || "Driver") + " ····" + entry.phoneLast4;
      if (cloud) button.addEventListener("click", function () { cloud.setPosting({ phoneHash: entry.phoneHash, blocked: false }).then(cloud.refresh); });
      return button;
    });
  }

  function start(win) {
    const doc = win.document;
    let state = admin.blank();
    let lists = {};
    let cloud = null;
    function paint() { render(doc, state, lists, cloud); }
    paint();
    if (doc.getElementById && doc.getElementById("jumpin-signin")) bind(win, doc);
    return {
      preview: function (scope, count, left) {
        state = admin.reduce(state, { type: "preview", scope: scope, count: count, left: left });
        render(doc, state, lists, cloud);
        return state;
      },
      fail: function (error) {
        state = admin.reduce(state, { type: "fail", error: error });
        render(doc, state, lists, cloud);
      }
    };

    function bind(owner, page) {
      const firebase = owner.firebase;
      if (!firebase) return;
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp({
          projectId: "waitlink-app-8821",
          appId: "1:397413980014:web:6a2265cca9a4b2635e937f",
          storageBucket: "waitlink-app-8821.firebasestorage.app",
          apiKey: "AIzaSyCXKhwN-ah8GX8knAipTF8QcPD5iTtODDE",
          authDomain: "waitlink-app-8821.firebaseapp.com",
          messagingSenderId: "397413980014"
        });
      }
      const api = globalThis.JumpInCloud ? globalThis.JumpInCloud.attach(owner) : null;
      let chosenRide = "";
      cloud = api ? {
        review: api.review,
        adminCancel: api.adminCancel,
        setPosting: api.setPosting,
        chooseTrip: function (rideId) { chosenRide = rideId; preview("trip"); },
        refresh: refresh
      } : null;
      function refresh() {
        if (!api) return Promise.resolve();
        return api.listAdmin().then(function (result) {
          if (!result || result.ok === false) {
            state = admin.reduce(state, { type: "fail", error: (result && result.error) || "This page is not available." });
            lists = {};
          } else {
            lists = result;
            state = admin.reduce(state, { type: "clear" });
            applyConfig(page, result.config || {});
          }
          paint();
        });
      }
      function preview(scope) {
        const textValue = page.getElementById("jumpin-announce").value;
        api.broadcast({ scope: scope, text: textValue, confirm: false, rideId: chosenRide }).then(function (result) {
          if (!result || result.ok === false) state = admin.reduce(state, { type: "fail", error: result && result.error });
          else state = admin.reduce(state, { type: "preview", scope: scope, count: result.count, left: result.left });
          paint();
        });
      }
      page.getElementById("jumpin-signin").addEventListener("click", function () {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(refresh);
      });
      const signOut = page.getElementById("jumpin-signout");
      if (signOut) signOut.addEventListener("click", function () { firebase.auth().signOut(); });
      firebase.auth().onAuthStateChanged(function (user) {
        const button = page.getElementById("jumpin-signin");
        if (button) button.hidden = !!user;
        if (signOut) signOut.hidden = !user;
        text(page.getElementById("jumpin-admin-status"), user ? "Signed in as " + (user.email || "JumpIn admin") : "Sign in with the JumpIn admin account.");
        if (user) refresh();
        else {
          lists = {};
          state = admin.reduce(state, { type: "clear" });
          paint();
        }
      });
      const save = page.getElementById("jumpin-save");
      if (save) save.addEventListener("click", function () { saveSettings(firebase, page); });
      ["trip", "upcoming", "all"].forEach(function (scope) {
        const button = page.getElementById("jumpin-preview-" + (scope === "trip" ? "trip" : scope === "upcoming" ? "upcoming" : "all"));
        if (button) button.addEventListener("click", function () { preview(scope); });
      });
      const send = page.getElementById("jumpin-send");
      if (send) send.addEventListener("click", function () {
        const textValue = page.getElementById("jumpin-announce").value;
        api.broadcast({ scope: state.pendingConfirm, text: textValue, confirm: true, rideId: chosenRide }).then(function (result) {
          if (!result || result.ok === false) state = admin.reduce(state, { type: "fail", error: result && result.error });
          else state = admin.reduce(state, { type: "sent", count: result.count });
          paint();
          refresh();
        });
      });
    }
  }

  function applyConfig(doc, config) {
    const enabled = doc.getElementById("jumpin-enabled");
    const review = doc.getElementById("jumpin-review");
    if (enabled) enabled.value = config.enabled ? "yes" : "no";
    if (review) review.value = config.requireRideApproval ? "yes" : "no";
    const map = {
      "jumpin-daily": config.dailySmsCap,
      "jumpin-seats": config.maxSeats,
      "jumpin-horizon": config.horizonDays,
      "jumpin-messages": config.maxMessagesPerRide,
      "jumpin-posts": config.maxPostsPerPhonePerDay,
      "jumpin-active": config.maxActiveReservationsPerPhone,
      "jumpin-record": config.maxSmsPerRecord,
      "jumpin-cooldown": config.resendCooldownSec
    };
    Object.keys(map).forEach(function (id) {
      const node = doc.getElementById(id);
      if (node && map[id] != null) node.value = String(map[id]);
    });
  }

  function saveSettings(firebase, doc) {
    const fields = {
      enabled: doc.getElementById("jumpin-enabled").value === "yes",
      requireRideApproval: doc.getElementById("jumpin-review").value === "yes",
      dailySmsCap: Number(doc.getElementById("jumpin-daily").value),
      maxSeats: Number(doc.getElementById("jumpin-seats").value),
      horizonDays: Number(doc.getElementById("jumpin-horizon").value),
      maxMessagesPerRide: Number(doc.getElementById("jumpin-messages").value),
      maxPostsPerPhonePerDay: Number(doc.getElementById("jumpin-posts").value),
      maxActiveReservationsPerPhone: Number(doc.getElementById("jumpin-active").value),
      maxSmsPerRecord: Number(doc.getElementById("jumpin-record").value),
      resendCooldownSec: Number(doc.getElementById("jumpin-cooldown").value)
    };
    const checked = admin.settingsErrors(fields);
    const error = doc.getElementById("jumpin-error");
    if (checked.error) {
      if (error) error.textContent = checked.error;
      return;
    }
    const ref = firebase.firestore().doc("settings/carpool_config");
    ref.get().then(function (snap) {
      const prev = snap.exists ? snap.data() : {};
      const next = checked.value;
      next.enabled = fields.enabled === true;
      next.requireRideApproval = fields.requireRideApproval === true;
      next.dailySmsSent = Number(prev.dailySmsSent) || 0;
      next.dailySmsDay = prev.dailySmsDay || "";
      return ref.set(next);
    }).then(function () {
      if (error) error.textContent = "";
      const status = doc.getElementById("jumpin-admin-status");
      if (status) status.textContent = "Saved.";
    }).catch(function () {
      if (error) error.textContent = "This page is not available.";
    });
  }

  return { start: start, render: render };
});
