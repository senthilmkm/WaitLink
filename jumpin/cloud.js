/**
 * JumpIn browser calls. Reads public rides. Never writes Firestore.
 * Secrets stay in this browser. The function response is the only place a secret arrives.
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JumpInCloud = api;
  /* c8 ignore end */
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CONFIG = {
    projectId: "waitlink-app-8821",
    appId: "1:397413980014:web:6a2265cca9a4b2635e937f",
    storageBucket: "waitlink-app-8821.firebasestorage.app",
    apiKey: "AIzaSyCXKhwN-ah8GX8knAipTF8QcPD5iTtODDE",
    authDomain: "waitlink-app-8821.firebaseapp.com",
    messagingSenderId: "397413980014"
  };
  const REGION = "us-central1";
  const APP_CHECK_KEY = "6LdFjiwuAAAAAKo7K6u_fy_uaLOpl-61O9Z-xsTA";

  function tripKey(rideId) { return "waitlink_carpool_trip_" + rideId; }
  function seatKey(reservationId) { return "waitlink_carpool_seat_" + reservationId; }

  function tripSecret(storage, rideId) {
    if (!storage || !storage.getItem) return "";
    return storage.getItem(tripKey(rideId)) || "";
  }

  function seatSecret(storage, reservationId) {
    if (!storage || !storage.getItem) return "";
    return storage.getItem(seatKey(reservationId)) || "";
  }

  function saveTrip(storage, rideId, secret) {
    if (storage && storage.setItem && secret) storage.setItem(tripKey(rideId), secret);
  }

  function saveSeat(storage, reservationId, secret) {
    if (storage && storage.setItem && secret) storage.setItem(seatKey(reservationId), secret);
  }

  function roleFor(storage, ride) {
    if (!ride) return "";
    if (tripSecret(storage, ride.rideId)) return "driver";
    const riders = ride.riders || [];
    for (let i = 0; i < riders.length; i++) {
      if (seatSecret(storage, riders[i].reservationId)) return "rider";
    }
    return "";
  }

  function seatSecretFor(storage, ride) {
    const riders = (ride && ride.riders) || [];
    for (let i = 0; i < riders.length; i++) {
      const secret = seatSecret(storage, riders[i].reservationId);
      if (secret) return secret;
    }
    return "";
  }

  function forget(storage, ride) {
    if (!storage || !storage.removeItem || !ride) return;
    storage.removeItem(tripKey(ride.rideId));
    (ride.riders || []).forEach(function (row) { storage.removeItem(seatKey(row.reservationId)); });
  }

  function normalizeGroup(raw) {
    const s = String(raw == null ? "" : raw).trim().toLowerCase();
    if (!s || s === "default") return "default";
    return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(s) ? s : "default";
  }

  function activeGroupId(win) {
    const search = win && win.location ? win.location.search : "";
    const params = new URLSearchParams(search || "");
    return normalizeGroup(params.get("g"));
  }

  function publicRideUrl(rideId, groupId) {
    const gid = normalizeGroup(groupId);
    const gPrefix = gid !== "default" ? "g=" + encodeURIComponent(gid) + "&" : "";
    return "https://waitlink.app/jumpin?" + gPrefix + "view=ride&ride=" + rideId;
  }

  function failure(name) {
    if (name === "carpoolReserveSeat") return "Could not reserve. Check the connection and try again.";
    if (name === "carpoolPostRide") return "Could not post. Check the connection and try again.";
    return "Could not post. Check the connection and try again.";
  }

  function callNamed(win, name, data) {
    let firebase = null;
    try { firebase = ensureFirebase(win); } catch (err) { firebase = null; }
    const headers = { "Content-Type": "application/json" };
    let user = null;
    let appCheck = null;
    try { user = firebase && firebase.auth ? firebase.auth().currentUser : null; } catch (err) { user = null; }
    try {
      if (firebase && typeof firebase.appCheck === "function" && firebase.apps && firebase.apps.length) appCheck = firebase.appCheck();
    } catch (err) { appCheck = null; }
    let tokenWait = Promise.resolve("");
    let checkWait = Promise.resolve("");
    try {
      if (user && user.getIdToken) tokenWait = user.getIdToken().catch(function () { return ""; });
    } catch (err) { tokenWait = Promise.resolve(""); }
    try {
      if (appCheck && appCheck.getToken) {
        checkWait = Promise.resolve().then(function () { return appCheck.getToken(); }).then(function (token) {
          return token && token.token;
        }).catch(function () { return ""; });
      }
    } catch (err) { checkWait = Promise.resolve(""); }
    const timed = new Promise(function (resolve) {
      const timer = setTimeout(function () { resolve(["", ""]); }, 1500);
      Promise.all([tokenWait, checkWait]).then(function (pair) {
        clearTimeout(timer);
        resolve(pair);
      }, function () {
        clearTimeout(timer);
        resolve(["", ""]);
      });
    });
    function endpoint() {
      const loc = win && win.location;
      if (loc && loc.protocol === "https:") return "/api/" + name;
      return "https://" + REGION + "-" + CONFIG.projectId + ".cloudfunctions.net/" + name;
    }
    return timed.then(function (pair) {
      if (pair[0]) headers.Authorization = "Bearer " + pair[0];
      if (pair[1]) headers["X-Firebase-AppCheck"] = pair[1];
      const ctrl = typeof AbortController === "function" ? new AbortController() : null;
      const netTimer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      return fetch(endpoint(), {
        method: "POST",
        headers: headers,
        signal: ctrl ? ctrl.signal : undefined,
        body: JSON.stringify({ data: data || {} })
      }).then(function (res) {
        if (netTimer) clearTimeout(netTimer);
        return res;
      }, function (err) {
        if (netTimer) clearTimeout(netTimer);
        throw err;
      });
    }).then(function (res) { return res.json(); }).then(function (body) {
      if (body && body.result) return body.result;
      return { ok: false, error: failure(name) };
    }).catch(function () {
      return { ok: false, error: failure(name) };
    });
  }

  function ensureFirebase(win) {
    try {
      const firebase = win && win.firebase;
      if (!firebase) return null;
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CONFIG);
      return firebase;
    } catch (err) {
      return null;
    }
  }

  function ridesCollection(firebase, groupId) {
    const gid = normalizeGroup(groupId);
    if (gid === "default") return firebase.firestore().collection("carpool_public").doc("root").collection("rides");
    return firebase.firestore().collection("carpool_groups").doc(gid).collection("public_rides");
  }

  function watchBoard(win, onChange, groupId) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore) return function () {};
    try {
      return ridesCollection(firebase, groupId).where("status", "==", "open").onSnapshot(function (snap) {
        const now = Date.now();
        const rides = [];
        snap.forEach(function (doc) {
          const ride = doc.data();
          if (ride && ride.departAt > now) rides.push(ride);
        });
        rides.sort(function (a, b) { return a.departAt - b.departAt; });
        onChange(rides.slice(0, 50));
      }, function () { onChange([]); });
    } catch (err) {
      try { onChange([]); } catch (ignore) { /* keep the screen that already drew */ }
      return function () {};
    }
  }

  function watchRide(win, rideId, onChange, groupId) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore || !rideId) return function () {};
    return ridesCollection(firebase, groupId).doc(rideId).onSnapshot(function (snap) {
      onChange(snap.exists ? snap.data() : null);
    }, function () { onChange(null); });
  }

  function watchGroup(win, onMeta, groupId) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore) return function () {};
    const gid = normalizeGroup(groupId);
    if (gid === "default") {
      return firebase.firestore().doc("settings/carpool_config").onSnapshot(function (snap) {
        const data = snap.exists ? snap.data() : null;
        onMeta({
          groupId: "default",
          name: "Its-OK",
          status: "active",
          enabled: !data || data.enabled !== false,
          membersOnly: !!(data && data.membersOnly === true),
          contactEmail: (data && typeof data.contactEmail === "string") ? data.contactEmail : "",
          supportNote: (data && typeof data.supportNote === "string") ? data.supportNote : ""
        });
      }, function () { onMeta({ groupId: "default", name: "Its-OK", status: "active", enabled: true, membersOnly: false, contactEmail: "", supportNote: "" }); });
    }
    return firebase.firestore().collection("carpool_groups").doc(gid).onSnapshot(function (snap) {
      const data = snap.exists ? snap.data() : null;
      if (!data) {
        onMeta({ groupId: gid, name: gid, status: "missing", enabled: false, membersOnly: false, contactEmail: "", supportNote: "" });
        return;
      }
      onMeta({
        groupId: gid,
        name: data.name || gid,
        status: data.status || "pending",
        enabled: data.enabled === true,
        membersOnly: data.membersOnly === true,
        contactEmail: typeof data.contactEmail === "string" ? data.contactEmail : "",
        supportNote: typeof data.supportNote === "string" ? data.supportNote : ""
      });
    }, function () { onMeta({ groupId: gid, name: gid, status: "pending", enabled: false, membersOnly: false, contactEmail: "", supportNote: "" }); });
  }

  function watchSupportNote(win, onNote, groupId) {
    return watchGroup(win, function (meta) { onNote((meta && meta.supportNote) || ""); }, groupId);
  }

  function watchPlatformNotice(win, onNotice) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore) return function () {};
    return firebase.firestore().doc("carpool_platform/public_notice").onSnapshot(function (snap) {
      const data = snap.exists ? snap.data() : null;
      onNotice({
        platformEnabled: !data || data.platformEnabled !== false,
        iosThemeEnabled: !!(data && data.iosThemeEnabled === true),
        maintenanceMessage: (data && typeof data.maintenanceMessage === "string") ? data.maintenanceMessage : ""
      });
    }, function () { onNotice({ platformEnabled: true, iosThemeEnabled: false, maintenanceMessage: "" }); });
  }

  function attach(win) {
    let storage = null;
    try { storage = win.localStorage; } catch (err) { storage = null; }
    const gid = activeGroupId(win);
    const keys = { post: "", reserve: "" };
    const ready = Promise.race([
      prepareAppCheck(win),
      new Promise(function (resolve) { setTimeout(resolve, 1500); })
    ]);
    function call(name, data) {
      const payload = Object.assign({ groupId: gid }, data || {});
      return ready.then(function () { return callNamed(win, name, payload); });
    }
    function once(slot) {
      if (!keys[slot]) keys[slot] = "idem_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      return keys[slot];
    }
    return {
      postRide: function (values) {
        return call("carpoolPostRide", Object.assign({}, values, { idempotencyKey: once("post") })).then(function (result) {
          if (result && result.ok && result.secret) {
            saveTrip(storage, result.rideId, result.secret);
            keys.post = "";
          }
          return result;
        });
      },
      reserveSeat: function (rideId, values, options) {
        return call("carpoolReserveSeat", {
          rideId: rideId,
          name: values.name,
          phone: values.phone,
          seats: Number(values.seats || 1),
          dropoff: values.dropoff || "",
          driverAck: !!(options && options.skipSaveSeat),
          idempotencyKey: once("reserve")
        }).then(function (result) {
          if (result && result.ok && result.secret) {
            if (!options || !options.skipSaveSeat) saveSeat(storage, result.reservationId, result.secret);
            keys.reserve = "";
          }
          return result;
        });
      },
      cancelSeat: function (rideId, secret) {
        return call("carpoolCancelSeat", { rideId: rideId, secret: secret });
      },
      updateSeat: function (rideId, secret, seats) {
        return call("carpoolUpdateSeat", { rideId: rideId, secret: secret, seats: Number(seats) });
      },
      cancelTrip: function (rideId, secret) {
        return call("carpoolCancelTrip", { rideId: rideId, secret: secret });
      },
      completeTrip: function (rideId, secret) {
        return call("carpoolCompleteTrip", { rideId: rideId, secret: secret });
      },
      ackRider: function (rideId, secret, reservationId, seen) {
        return call("carpoolAckRider", { rideId: rideId, secret: secret, reservationId: reservationId, seen: seen });
      },
      sendManageLink: function (rideId, phone, role) {
        return call("carpoolSendManageLink", { rideId: rideId, phone: phone, role: role });
      },
      postMessage: function (rideId, secret, text) {
        return call("carpoolPostMessage", { rideId: rideId, secret: secret, text: text });
      },
      listAdmin: function (groupId) { return call("carpoolListPending", groupId ? { groupId: groupId } : {}); },
      review: function (rideId, decision, groupId) { return call("carpoolReviewRide", { rideId: rideId, decision: decision, groupId: groupId || gid }); },
      adminCancel: function (rideId, groupId) { return call("carpoolAdminCancelTrip", { rideId: rideId, groupId: groupId || gid }); },
      setPosting: function (body) { return call("carpoolAdminSetPosting", body); },
      setMembers: function (body) { return call("carpoolAdminSetMembers", body); },
      saveAdminConfig: function (body) { return call("carpoolAdminSaveConfig", body); },
      purge: function (body) { return call("carpoolAdminPurge", body); },
      broadcast: function (body) { return call("carpoolAdminBroadcast", body); },
      createGroup: function (body) { return call("carpoolCreateGroup", body); },
      listGroups: function () { return call("carpoolListGroups", {}); },
      reviewGroup: function (body) { return call("carpoolReviewGroup", body); },
      savePlatformConfig: function (body) { return call("carpoolAdminSavePlatformConfig", body); },
      searchMembers: function (body) { return call("carpoolAdminSearchMembers", body); },
      groupId: gid,
      watchBoard: function (onChange) { return watchBoard(win, onChange, gid); },
      watchRide: function (rideId, onChange) { return watchRide(win, rideId, onChange, gid); },
      watchGroup: function (onMeta) { return watchGroup(win, onMeta, gid); },
      watchSupportNote: function (onNote) { return watchSupportNote(win, onNote, gid); },
      watchPlatformNotice: function (onNotice) { return watchPlatformNotice(win, onNotice); },
      tripSecret: function (rideId) { return tripSecret(storage, rideId); },
      seatSecretFor: function (ride) { return seatSecretFor(storage, ride); },
      seatInfoFor: function (ride) {
        const riders = (ride && ride.riders) || [];
        for (let i = 0; i < riders.length; i++) {
          if (seatSecret(storage, riders[i].reservationId)) return riders[i];
        }
        return null;
      },
      roleFor: function (ride) { return roleFor(storage, ride); },
      saveTrip: function (rideId, secret) { saveTrip(storage, rideId, secret); },
      saveSeat: function (reservationId, secret) { saveSeat(storage, reservationId, secret); },
      forget: function (ride) { forget(storage, ride); },
      publicRideUrl: function (rideId) { return publicRideUrl(rideId, gid); },
      prepareAppCheck: function () { return prepareAppCheck(win); }
    };
  }

  function prepareAppCheck(win) {
    /* c8 ignore next */
    if (!APP_CHECK_KEY || !win || !win.document || !win.document.createElement) return Promise.resolve();
    const firebase = ensureFirebase(win);
    if (!firebase) return Promise.resolve();
    const prior = win.document.querySelector && win.document.querySelector("script[data-jumpin-appcheck]");
    const load = prior ? Promise.resolve() : new Promise(function (resolve) {
      const script = win.document.createElement("script");
      script.src = "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check-compat.js";
      script.setAttribute("data-jumpin-appcheck", "1");
      script.onload = function () { resolve(); };
      script.onerror = function () { resolve(); };
      (win.document.head || win.document.body).appendChild(script);
    });
    return load.then(function () {
      if (!firebase.appCheck || !firebase.appCheck.ReCaptchaEnterpriseProvider) return;
      try {
        firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(APP_CHECK_KEY), true);
      } catch (err) { /* already active */ }
    });
  }

  return {
    attach: attach,
    roleFor: roleFor,
    tripSecret: tripSecret,
    seatSecret: seatSecret,
    saveTrip: saveTrip,
    saveSeat: saveSeat,
    seatSecretFor: seatSecretFor,
    forget: forget,
    publicRideUrl: publicRideUrl,
    failure: failure
  };
});
