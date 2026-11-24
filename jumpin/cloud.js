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

  function publicRideUrl(rideId) {
    return "https://waitlink.app?s=jumpin&view=ride&ride=" + rideId;
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

  function ridesQuery(firebase) {
    return firebase.firestore().collection("carpool_public").doc("root").collection("rides").where("status", "==", "open");
  }

  function watchBoard(win, onChange) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore) return function () {};
    try {
    return ridesQuery(firebase).onSnapshot(function (snap) {
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

  function watchRide(win, rideId, onChange) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore || !rideId) return function () {};
    return firebase.firestore().collection("carpool_public").doc("root").collection("rides").doc(rideId).onSnapshot(function (snap) {
      onChange(snap.exists ? snap.data() : null);
    }, function () { onChange(null); });
  }

  function watchSupportNote(win, onNote) {
    const firebase = ensureFirebase(win);
    if (!firebase || !firebase.firestore) return function () {};
    return firebase.firestore().doc("settings/carpool_config").onSnapshot(function (snap) {
      const data = snap.exists ? snap.data() : null;
      onNote((data && typeof data.supportNote === "string") ? data.supportNote : "");
    }, function () { onNote(""); });
  }

  function attach(win) {
    let storage = null;
    try { storage = win.localStorage; } catch (err) { storage = null; }
    const keys = { post: "", reserve: "" };
    const ready = Promise.race([
      prepareAppCheck(win),
      new Promise(function (resolve) { setTimeout(resolve, 1500); })
    ]);
    function call(name, data) {
      return ready.then(function () { return callNamed(win, name, data); });
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
      sendManageLink: function (rideId, phone, role) {
        return call("carpoolSendManageLink", { rideId: rideId, phone: phone, role: role });
      },
      postMessage: function (rideId, secret, text) {
        return call("carpoolPostMessage", { rideId: rideId, secret: secret, text: text });
      },
      listAdmin: function () { return call("carpoolListPending", {}); },
      review: function (rideId, decision) { return call("carpoolReviewRide", { rideId: rideId, decision: decision }); },
      adminCancel: function (rideId) { return call("carpoolAdminCancelTrip", { rideId: rideId }); },
      setPosting: function (body) { return call("carpoolAdminSetPosting", body); },
      setMembers: function (body) { return call("carpoolAdminSetMembers", body); },
      saveAdminConfig: function (body) { return call("carpoolAdminSaveConfig", body); },
      purge: function (body) { return call("carpoolAdminPurge", body); },
      broadcast: function (body) { return call("carpoolAdminBroadcast", body); },
      watchBoard: function (onChange) { return watchBoard(win, onChange); },
      watchRide: function (rideId, onChange) { return watchRide(win, rideId, onChange); },
      watchSupportNote: function (onNote) { return watchSupportNote(win, onNote); },
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
      publicRideUrl: publicRideUrl,
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
