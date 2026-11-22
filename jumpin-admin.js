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

  function el(doc, tag, className, value) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function pillBtn(doc, label, tone, onClick) {
    const button = el(doc, "button", "admin-btn" + (tone ? " " + tone : ""), label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  function seatsLabel(count, suffix) {
    return count + (count === 1 ? " seat" : " seats") + (suffix ? " " + suffix : "");
  }

  function formatWhen(departAt) {
    if (!departAt) return "";
    return new Date(departAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function buildRideCard(doc, ride, badgeText, metaLines, actions) {
    const card = el(doc, "div", "admin-card");
    const top = el(doc, "div", "admin-card-top");
    const route = ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId;
    top.appendChild(el(doc, "div", "admin-route", route));
    if (badgeText) top.appendChild(el(doc, "span", "admin-badge", badgeText));
    card.appendChild(top);
    metaLines.forEach(function (line) {
      if (line.text) card.appendChild(el(doc, "div", line.cls, line.text));
    });
    if (ride.note) card.appendChild(el(doc, "div", "admin-note", ride.note));
    if (actions && actions.length) {
      const bar = el(doc, "div", "admin-actions");
      actions.forEach(function (act) { bar.appendChild(pillBtn(doc, act.label, act.tone, act.onClick)); });
      card.appendChild(bar);
    }
    return card;
  }

  function fill(doc, node, countNode, rows, make) {
    if (countNode) countNode.textContent = rows.length ? String(rows.length) : "";
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
    fill(doc, pending, doc.getElementById("jumpin-pending-count"), (lists && lists.pending) || [], function (ride) {
      const badge = ride.seatsLeft == null ? "" : seatsLabel(ride.seatsLeft, "");
      const meta = [{ cls: "admin-meta muted", text: ride.driverName || "" }];
      const actions = cloud ? [
        { label: "Approve", tone: "primary", onClick: function () { cloud.review(ride.rideId, "approve").then(cloud.refresh); } },
        { label: "Decline", tone: "warn", onClick: function () { cloud.review(ride.rideId, "decline").then(cloud.refresh); } },
        { label: "Cancel", tone: "danger", onClick: function () { cloud.adminCancel(ride.rideId).then(cloud.refresh); } }
      ] : [];
      return buildRideCard(doc, ride, badge, meta, actions);
    });
    fill(doc, upcoming, doc.getElementById("jumpin-upcoming-count"), (lists && lists.upcoming) || [], function (ride) {
      const badge = ride.seatsLeft == null ? "" : seatsLabel(ride.seatsLeft, "left");
      const who = [ride.driverName || "", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ");
      const meta = [
        { cls: "admin-meta", text: formatWhen(ride.departAt) },
        { cls: "admin-meta muted", text: who }
      ];
      const actions = cloud ? [
        { label: "Text trip", tone: "primary", onClick: function () { cloud.chooseTrip(ride); } },
        { label: "Block", tone: "warn", onClick: function () { cloud.setPosting({ rideId: ride.rideId, blocked: true }).then(cloud.refresh); } },
        { label: "Cancel", tone: "danger", onClick: function () { cloud.adminCancel(ride.rideId).then(cloud.refresh); } }
      ] : [];
      return buildRideCard(doc, ride, badge, meta, actions);
    });
    fill(doc, blocked, doc.getElementById("jumpin-blocked-count"), (lists && lists.blocked) || [], function (entry) {
      const button = el(doc, "button", "admin-blocked-btn", (entry.driverName || "Driver") + " ····" + entry.phoneLast4 + " — Unblock");
      button.type = "button";
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
      function setScopeHighlight(scope) {
        const map = { trip: "jumpin-preview-trip", upcoming: "jumpin-preview-upcoming", all: "jumpin-preview-all" };
        Object.keys(map).forEach(function (key) {
          const btn = page.getElementById(map[key]);
          if (btn) btn.className = "admin-btn" + (key === scope ? " primary" : "");
        });
      }
      function showSelectedTrip(ride, keepOpen) {
        const picked = ride && ride.rideId ? ride : null;
        chosenRide = picked ? picked.rideId : "";
        const label = picked ? (picked.from && picked.to ? picked.from + " → " + picked.to : picked.rideId) + (picked.departAt ? " (" + formatWhen(picked.departAt) + ")" : "") : "";
        const note = page.getElementById("jumpin-selected-trip");
        const tripBtn = page.getElementById("jumpin-preview-trip");
        const upcomingBtn = page.getElementById("jumpin-preview-upcoming");
        const allBtn = page.getElementById("jumpin-preview-all");
        const section = page.getElementById("jumpin-text-section");
        if (section) section.hidden = !label && !keepOpen;
        if (note) {
          note.textContent = label ? "Selected trip: " + label : "";
          note.hidden = !label;
        }
        if (tripBtn) tripBtn.hidden = !label;
        if (upcomingBtn) upcomingBtn.hidden = !keepOpen;
        if (allBtn) allBtn.hidden = !keepOpen;
        if (!label) setScopeHighlight("");
      }
      function focusBox() {
        const box = page.getElementById("jumpin-announce");
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "center" });
        if (box && box.focus) box.focus();
      }
      cloud = api ? {
        review: api.review,
        adminCancel: api.adminCancel,
        setPosting: api.setPosting,
        chooseTrip: function (ride) {
          showSelectedTrip(ride, false);
          setScopeHighlight("trip");
          const box = page.getElementById("jumpin-announce");
          if (box && box.value && box.value.trim()) preview("trip");
          else {
            state = admin.reduce(state, { type: "clear" });
            paint();
          }
          focusBox();
        },
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
        setScopeHighlight(scope);
        const note = page.getElementById("jumpin-selected-trip");
        if (note) note.hidden = scope !== "trip" || !note.textContent;
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
      const openBroadcast = page.getElementById("jumpin-open-broadcast");
      if (openBroadcast) openBroadcast.addEventListener("click", function () {
        showSelectedTrip(null, true);
        state = admin.reduce(state, { type: "clear" });
        paint();
        focusBox();
      });
      const textClose = page.getElementById("jumpin-text-close");
      if (textClose) textClose.addEventListener("click", function () {
        showSelectedTrip(null, false);
        state = admin.reduce(state, { type: "clear" });
        paint();
      });
      firebase.auth().onAuthStateChanged(function (user) {
        const button = page.getElementById("jumpin-signin");
        if (button) button.hidden = !!user;
        if (signOut) signOut.hidden = !user;
        text(page.getElementById("jumpin-admin-status"), user ? "Signed in as " + (user.email || "JumpIn admin") : "Sign in with the JumpIn admin account.");
        if (user) refresh();
        else {
          showSelectedTrip(null);
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
