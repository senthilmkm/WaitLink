/**
 * JumpIn phone shell. Loaded only when ?s=jumpin.
 * Removes every listener it adds.
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root && root.document) api.start(root);
  /* c8 ignore end */
})(typeof window !== "undefined" ? window : globalThis, function () {
  /* c8 ignore next */
  const core = typeof require === "function" ? require("./core.js") : globalThis.JumpInCore;
  /* c8 ignore next */
  const ui = typeof require === "function" ? require("./ui-state.js") : globalThis.JumpInUi;
  const cleanups = [];

  function on(target, type, fn) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, fn);
    cleanups.push(function () { target.removeEventListener(type, fn); });
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function track(doc) {
    let node = doc.getElementById("jumpin-root");
    if (!node) {
      node = el(doc, "div");
      node.id = "jumpin-root";
      doc.body.appendChild(node);
    }
    return node;
  }

  function applyShell(win, rootNode, mode) {
    if (mode === "board" || mode === "posted") {
      rootNode.style.height = "auto";
      rootNode.style.overflow = "visible";
      return;
    }
    const view = win.visualViewport;
    const height = view && view.height ? view.height : (win.innerHeight || 0);
    rootNode.style.height = height + "px";
    rootNode.style.overflow = "hidden";
  }

  function ensureStyle(doc) {
    if (doc.getElementById("jumpin-style")) return;
    const style = el(doc, "style");
    style.id = "jumpin-style";
    style.textContent = [
      "html:has(body.jumpin-on),body.jumpin-on{display:block !important;height:auto;min-height:100%;background:var(--bg-dark,#f1f5f9);color:var(--text-main,#090d16)}",
      "body.jumpin-on{margin:0;overflow:auto}",
      "body.jumpin-on > *:not(#jumpin-root){display:none !important}",
      "#jumpin-root{display:flex;flex-direction:column;width:100%;min-height:100%;background:var(--bg-dark,#f1f5f9);color:var(--text-main,#090d16);font-family:var(--font-family-body,Inter,-apple-system,BlinkMacSystemFont,sans-serif);font-size:16px;line-height:1.5}",
      "#jumpin-root.portal{min-height:100dvh}",
      "#jumpin-root *{box-sizing:border-box}",
      "#jumpin-root a{color:inherit;text-decoration:none}",
      "#jumpin-top,#jumpin-bottom{flex:0 0 auto}",
      "#jumpin-top{position:sticky;top:0;z-index:2;width:100%;background:var(--bg-card,#fff);border-bottom:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-top .bar{width:min(1040px,100%);margin:0 auto;display:flex;align-items:center;gap:16px;min-height:64px;padding:12px 24px calc(12px + env(safe-area-inset-top))}",
      "#jumpin-top .brand{display:flex;align-items:center;gap:8px;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-weight:700;font-size:18px}",
      "#jumpin-top .mark{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:rgba(8,145,178,.12)}",
      "#jumpin-top .product{color:var(--primary,#0891b2);font-weight:700}",
      "#jumpin-top nav{margin-left:auto;display:flex;align-items:center;gap:16px}",
      "#jumpin-top nav a{color:var(--text-muted,#1e293b);font-weight:600}",
      "#jumpin-top .title{font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:18px}",
      "#jumpin-root.app-screen{width:100%;background:var(--bg-dark,#f1f5f9)}",
      "#jumpin-root.app-screen #jumpin-top{display:flex;align-items:center;gap:12px;width:100%;padding:0 16px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root.app-screen #jumpin-top .bar{flex:1;padding:12px 0;min-height:56px}",
      "#jumpin-root.app-screen #jumpin-top .back-btn{flex-shrink:0}",
      "#jumpin-mid{flex:1 1 auto;width:100%;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:none}",
      "#jumpin-root.app-screen #jumpin-mid{width:100%;max-width:520px;margin:0 auto;padding:18px 16px 20px}",
      "#jumpin-root.app-screen #jumpin-mid.post-card{width:calc(100% - 32px);max-width:520px;margin:18px auto;padding:24px;background:var(--bg-card,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:var(--shadow-card,0 4px 10px rgba(0,0,0,.06))}",
      "#jumpin-mid .wrap{width:min(1040px,100%);margin:0 auto;padding:28px 24px 12px}",
      "#jumpin-mid .hero{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;margin:0 0 20px;padding:28px;background:var(--bg-card,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:var(--shadow-card,0 4px 10px rgba(0,0,0,.06))}",
      "#jumpin-mid .hero .copy{flex:1 1 260px;min-width:0}",
      "#jumpin-mid h1{margin:0 0 8px;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:36px;line-height:1.15;letter-spacing:-0.03em}",
      "#jumpin-mid .hero button{width:auto;min-width:200px;flex:0 0 auto;padding:0 22px}",
      "#jumpin-mid .board{display:grid;grid-template-columns:1fr;gap:12px}",
      "#jumpin-mid .empty{grid-column:1 / -1;padding:22px;background:var(--bg-card,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-md,14px)}",
      "#jumpin-mid .empty .route{margin:0 0 4px}",
      "#jumpin-bottom{width:100%;padding:0 16px calc(16px + env(safe-area-inset-bottom))}",
      "#jumpin-root.portal #jumpin-bottom{margin-top:auto;padding:0;background:var(--bg-card,#fff);border-top:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root .site-foot{width:min(1040px,100%);margin:0 auto;padding:16px 24px calc(16px + env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center;color:var(--text-muted,#1e293b);font-size:14px}",
      "#jumpin-root .site-foot a{color:var(--primary,#0891b2);font-weight:600}",
      "#jumpin-root .site-foot .spacer{margin-left:auto}",
      "#jumpin-root.app-screen #jumpin-bottom{position:sticky;bottom:0;margin-top:auto;padding:12px 16px 0;background:var(--bg-card,#fff);border-top:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-mid .hero button,#jumpin-bottom button{min-height:52px;border:0;border-radius:var(--radius-md,14px);background:var(--primary,#0891b2);color:#fff;font-size:17px;font-weight:700}",
      "#jumpin-root.app-screen #jumpin-bottom button{display:block;width:100%;max-width:520px;margin:0 auto}",
      "body.jumpin-android #jumpin-bottom button,body.jumpin-android #jumpin-mid .hero button{border-radius:var(--radius-lg,20px)}",
      "#jumpin-mid .lbl{display:block;margin:0 0 6px;color:var(--text-muted,#1e293b);font-size:14px;font-weight:600}",
      "#jumpin-mid input,#jumpin-mid select{width:100%;min-width:0;max-width:100%;font-size:16px;min-height:44px;margin:0 0 14px;padding:0 12px;color:var(--text-main,#090d16);background:var(--bg-input,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-sm,8px)}",
      "#jumpin-mid .confirm{padding:24px;background:var(--bg-card,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:var(--shadow-card,0 4px 10px rgba(0,0,0,.06))}",
      "#jumpin-mid .confirm h1{font-size:28px}",
      "#jumpin-mid .row{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;text-align:left;min-height:44px;padding:16px;margin:0;background:var(--bg-card,#fff);color:inherit;border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-md,14px);box-shadow:var(--shadow-card,0 4px 10px rgba(0,0,0,.06))}",
      "#jumpin-mid .route{font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:18px;font-weight:700}",
      "#jumpin-mid .meta,#jumpin-mid .muted{color:var(--text-muted,#1e293b);font-size:14px;margin:0}",
      "#jumpin-mid .hint{color:var(--text-muted,#1e293b);font-size:14px;margin:8px 0 0}",
      "#jumpin-root #jumpin-mid .error{color:#dc2626;font-weight:600;font-size:14px;margin:-4px 0 14px}",
      "@media (max-width:700px){#jumpin-top .bar{padding:10px 14px;gap:8px;min-height:52px}#jumpin-top .brand{font-size:16px}#jumpin-top nav a{display:none}#jumpin-root.app-screen #jumpin-top{padding:0 12px;gap:8px}#jumpin-root.app-screen #jumpin-top .back-btn{min-height:36px;padding:0 10px;font-size:13px}#jumpin-root.app-screen #jumpin-mid{padding:12px}#jumpin-root.app-screen #jumpin-mid.post-card{width:calc(100% - 24px);margin:12px auto;padding:16px;border-radius:16px}#jumpin-mid .wrap{padding:16px 12px}#jumpin-mid .hero{padding:18px}#jumpin-mid h1{font-size:26px}#jumpin-mid .confirm{padding:16px;border-radius:16px}#jumpin-mid .confirm h1{font-size:22px}#jumpin-mid .hero button{width:100%}#jumpin-root.app-screen #jumpin-bottom{padding:10px 12px calc(10px + env(safe-area-inset-bottom))}#jumpin-root.app-screen #jumpin-bottom .site-foot{display:none}#jumpin-root .site-foot{padding:14px 16px calc(14px + env(safe-area-inset-bottom));gap:8px 14px}#jumpin-root .site-foot .spacer{margin-left:0;width:100%}}",
      "#jumpin-sheet{position:fixed;left:50%;transform:translateX(-50%);width:min(448px,calc(100% - 32px));bottom:16px;z-index:50;background:var(--bg-card,#fff);color:var(--text-main,#090d16);padding:18px;border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:var(--shadow-card,0 12px 32px rgba(0,0,0,.16))}",
      "#jumpin-root .action-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center}",
      "#jumpin-root .recovery-box{margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color,#e2e8f0)}",
      "#jumpin-root .section-lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted,#475569);margin:14px 0 6px}",
      "#jumpin-root .rider-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--bg-input,#f8fafc);border:1px solid var(--border-color,#e2e8f0);border-radius:10px;font-size:14px;font-weight:600}",
      "#jumpin-root .msg-row{padding:8px 12px;margin-bottom:6px;background:rgba(8,145,178,.06);border-radius:10px;font-size:14px;color:var(--text-main,#090d16)}",
      "#jumpin-root .textish{background:var(--bg-input,#f8fafc);color:var(--primary,#0891b2);border:1px solid var(--border-color,#cbd5e1);border-radius:10px;padding:0 14px;font-size:14px;font-weight:600;min-height:40px;cursor:pointer}",
      "#jumpin-root .textish:hover{background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .linkish{display:block;background:transparent;color:var(--primary,#0891b2);border:0;padding:4px 0;font-size:14px;font-weight:600;text-align:left;cursor:pointer}",
      "#jumpin-root .linkish:hover{text-decoration:underline}",
      "#jumpin-root button.danger{background:transparent;color:var(--accent-rose,#be123c);border:0;font-size:16px;font-weight:700;min-height:44px;cursor:pointer;margin-left:12px}",
      "@keyframes jumpin-spin{to{transform:rotate(360deg)}}",
      ".jumpin-spin{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:jumpin-spin .7s linear infinite;vertical-align:middle;margin-right:8px}"
    ].join("");
    doc.head.appendChild(style);
  }

  function mount(win) {
    destroy();
    const doc = win.document;
    doc.body.classList.add("jumpin-on");
    const platform = ui.platformOf(win.navigator && win.navigator.userAgent);
    if (platform === "android") doc.body.classList.add("jumpin-android");
    ensureStyle(doc);
    const rootNode = track(doc);
    const secrets = win.localStorage;
    const cloud = win.JumpInCloud || null;
    let state = Object.assign(ui.blank(), { platform: platform, rides: cloud ? [] : loadRides(secrets) });
    let stopRide = function () { };

    function seatsLabel(n) {
      return n === 1 ? "1 seat left" : n + " seats left";
    }

    function whenOf(ride) {
      if (!ride || !ride.departAt) return "";
      try { return core.formatWhen(ride.departAt, ride.timeZone || "UTC"); } catch (err) { return ""; }
    }

    function openRide(rideId) {
      if (!cloud || !rideId) return;
      stopRide();
      stopRide = cloud.watchRide(rideId, function (ride) {
        const kept = state.rides || [];
        if (!ride) {
          state = Object.assign(ui.reduce(state, { type: "ride", ride: { status: "missing", seatsLeft: 0 }, role: "" }), { rides: kept, ride: null });
        } else if (ride.status === "open" && (state.reserveOpen || state.recovery || state.sheet || state.busy || state.mode === "reserved")) {
          state = Object.assign({}, state, {
            rides: kept,
            ride: ride,
            seatsLeft: ride.seatsLeft,
            route: ride.from + " → " + ride.to,
            when: whenOf(ride),
            link: cloud.publicRideUrl(ride.rideId)
          });
          return;
        } else {
          const prevNotice = state.notice;
          state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: cloud.roleFor(ride) }), {
            rides: kept,
            ride: ride,
            route: ride.from + " → " + ride.to,
            when: whenOf(ride),
            link: cloud.publicRideUrl(ride.rideId),
            notice: ride.status === "open" && (prevNotice === "You have a seat." || prevNotice === "Passenger added." || prevNotice === "Seat cancelled.") ? prevNotice : ""
          });
        }
        draw();
      }) || function () { };
    }

    function confirmSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.appendChild(el(doc, "p", "", state.sheet === "trip" ? "Cancel this trip?" : "Cancel your seat?"));
      const keep = el(doc, "button", "textish", state.sheet === "trip" ? "Keep trip" : "Keep seat");
      on(keep, "click", function () { state = ui.reduce(state, { type: "keep" }); draw(); });
      sheet.appendChild(keep);
      const yes = el(doc, "button", "danger", state.sheet === "trip" ? "Cancel trip" : "Cancel seat");
      on(yes, "click", function () {
        const ride = state.ride || (state.rideId ? { rideId: state.rideId } : null);
        state = ui.reduce(state, { type: "confirm" });
        const action = state.pendingAction;
        if (cloud && ride && action) {
          const secret = action === "cancel-trip" ? cloud.tripSecret(ride.rideId) : cloud.seatSecretFor(ride);
          const job = action === "cancel-trip" ? cloud.cancelTrip(ride.rideId, secret) : cloud.cancelSeat(ride.rideId, secret);
          job.then(function (result) {
            if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
            else if (action === "cancel-trip") state = Object.assign({}, state, { status: "cancelled", notice: "This trip was cancelled.", link: "" });
            else state = Object.assign({}, state, { role: "", notice: "Seat cancelled.", reserveOpen: false });
            draw();
          });
        }
        draw();
      });
      sheet.appendChild(yes);
      return sheet;
    }

    function rideCard(doc, current) {
      const ride = current.ride;
      const card = el(doc, "section", "confirm");
      if (current.notice) card.appendChild(el(doc, "h1", "", current.notice));
      card.appendChild(el(doc, "p", "route", (ride.from || "") + " → " + (ride.to || "")));
      card.appendChild(el(doc, "p", "muted", current.when || whenOf(ride)));
      if (ride.seatsLeft != null) {
        card.appendChild(el(doc, "p", "muted", seatsLabel(ride.seatsLeft)));
      }
      if (ride.note) card.appendChild(el(doc, "p", "muted", ride.note));
      if (ride.driverName) card.appendChild(el(doc, "p", "muted", "Driver: " + ride.driverName));
      if (ride.riders && ride.riders.length) {
        card.appendChild(el(doc, "div", "section-lbl", "Passengers (" + ride.riders.length + ")"));
        ride.riders.forEach(function (rider) {
          card.appendChild(el(doc, "div", "rider-row", rider.name || "Passenger"));
        });
      }
      if (ride.messages && ride.messages.length) {
        card.appendChild(el(doc, "div", "section-lbl", "Trip Updates"));
        ride.messages.forEach(function (message) {
          const who = message.authorName || "";
          card.appendChild(el(doc, "div", "msg-row", (who ? who + ": " : "") + (message.text || "")));
        });
      }
      if (current.status === "pending") card.appendChild(el(doc, "p", "route", "Waiting for approval."));
      if (current.status === "rejected") card.appendChild(el(doc, "p", "route", "This trip was not approved."));
      if (current.status === "cancelled") card.appendChild(el(doc, "p", "route", "This trip was cancelled."));
      if (current.status === "open" && ride.seatsLeft === 0) card.appendChild(el(doc, "p", "route", "Full"));
      if (current.reserveOpen) {
        card.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Passenger name" : "Your name"));
        const name = el(doc, "input");
        name.name = "name";
        card.appendChild(name);
        card.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Passenger phone" : "Phone"));
        const phone = el(doc, "input");
        phone.name = "phone";
        phone.type = "tel";
        card.appendChild(phone);
        card.appendChild(el(doc, "p", "hint", "WaitLink will text this number a link to manage their seat, and JumpIn notices."));
        if (current.error) card.appendChild(el(doc, "p", "error", current.error));
        const cancelForm = el(doc, "button", "textish", "Cancel");
        on(cancelForm, "click", function () { state = ui.reduce(state, { type: "reserve-close" }); draw(); });
        const formActions = el(doc, "div", "action-row");
        formActions.appendChild(cancelForm);
        card.appendChild(formActions);
      }
      if (current.recovery) {
        const recLabel = current.recovery === "driver"
          ? "Driver phone (used to post this trip)"
          : "Rider phone (used to reserve your seat)";
        card.appendChild(el(doc, "label", "lbl", recLabel));
        const phone = el(doc, "input");
        phone.name = "phone";
        phone.type = "tel";
        card.appendChild(phone);
        if (current.error) card.appendChild(el(doc, "p", "error", current.error));
      }
      if (!current.reserveOpen && (current.role === "driver" || current.role === "rider")) {
        card.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Message passengers" : "Message the driver"));
        const box = el(doc, "input");
        box.name = "message";
        box.placeholder = "Write an update (e.g. I am at the pickup spot)";
        card.appendChild(box);
        const actions = el(doc, "div", "action-row");
        if (current.role === "driver") {
          const send = el(doc, "button", "textish", "Send");
          on(send, "click", function () { sendMessage(box.value); });
          actions.appendChild(send);
          if (current.status === "open" && ride.seatsLeft > 0) {
            const addPax = el(doc, "button", "textish", "Add passenger");
            on(addPax, "click", function () { state = ui.reduce(state, { type: "reserve-open" }); draw(); });
            actions.appendChild(addPax);
          }
          const cancel = el(doc, "button", "textish", "Cancel trip");
          on(cancel, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "driver" }); draw(); });
          actions.appendChild(cancel);
        } else if (cloud && cloud.seatSecretFor(ride)) {
          const cancelSeat = el(doc, "button", "textish", "Cancel my seat");
          on(cancelSeat, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "rider" }); draw(); });
          actions.appendChild(cancelSeat);
        }
        const forget = el(doc, "button", "textish", "Sign out on this device");
        on(forget, "click", function () {
          cloud.forget(ride);
          state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: "" }), { ride: ride, rides: state.rides || [], when: current.when, link: current.link });
          draw();
        });
        actions.appendChild(forget);
        card.appendChild(actions);
      } else if (!current.reserveOpen && (current.status === "open" || current.status === "pending")) {
        const recBox = el(doc, "div", "recovery-box");
        const seat = el(doc, "button", "linkish", "Rider? Manage seat or message driver");
        on(seat, "click", function () { state = ui.reduce(state, { type: "recovery", role: "rider" }); draw(); });
        const trip = el(doc, "button", "linkish", "Driver? Manage or cancel this trip");
        on(trip, "click", function () { state = ui.reduce(state, { type: "recovery", role: "driver" }); draw(); });
        recBox.appendChild(seat);
        recBox.appendChild(trip);
        card.appendChild(recBox);
      }
      if (current.error && !current.reserveOpen && !current.recovery) card.appendChild(el(doc, "p", "error", current.error));
      return card;
    }

    function sendMessage(text) {
      if (!cloud || !state.ride) return;
      const secret = state.role === "driver" ? cloud.tripSecret(state.ride.rideId) : cloud.seatSecretFor(state.ride);
      state.busy = true;
      draw();
      cloud.postMessage(state.ride.rideId, secret, text).then(function (result) {
        state.busy = false;
        if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
        draw();
      }, function () {
        state.busy = false;
        state = ui.reduce(state, { type: "fail", error: "Could not send message. Check the connection and try again." });
        draw();
      });
    }

    function draw() {
      rootNode.textContent = "";
      rootNode.className = state.mode === "board" ? "portal" : "app-screen";
      const top = el(doc, "header");
      top.id = "jumpin-top";
      if (state.mode === "board") brandBar(doc, top);
      else {
        const back = el(doc, "button", "textish back-btn", "Back");
        on(back, "click", function () {
          stopRide();
          const kept = state.rides || [];
          state = ui.reduce(state, { type: "board" });
          state.rides = kept;
          draw();
        });
        top.appendChild(back);
        brandBar(doc, top);
      }
      const mid = el(doc, "main");
      mid.id = "jumpin-mid";
      if (state.mode === "post") mid.className = "post-card";
      const bottom = el(doc, "footer");
      bottom.id = "jumpin-bottom";
      let hero = null;
      if (state.mode === "board") {
        const wrap = el(doc, "div", "wrap");
        hero = el(doc, "section", "hero");
        const copy = el(doc, "div", "copy");
        copy.appendChild(el(doc, "h1", "", "Find a seat. Offer a ride."));
        copy.appendChild(el(doc, "p", "muted", "Post one trip. Reserve one seat. No payment."));
        hero.appendChild(copy);
        wrap.appendChild(hero);
        const rides = state.rides || [];
        const list = el(doc, "div", "board");
        if (!rides.length) {
          const empty = el(doc, "div", "empty");
          empty.appendChild(el(doc, "p", "route", "No rides yet"));
          empty.appendChild(el(doc, "p", "muted", "Post one trip and it will show up here."));
          list.appendChild(empty);
        }
        rides.forEach(function (ride) {
          const row = el(doc, "button", "row");
          row.appendChild(el(doc, "div", "route", ride.from + " → " + ride.to));
          row.appendChild(el(doc, "div", "meta", (ride.when || whenOf(ride)) + " · " + (ride.seats || seatsLabel(ride.seatsLeft))));
          on(row, "click", function () { if (cloud) openRide(ride.rideId || ride.id); });
          list.appendChild(row);
        });
        wrap.appendChild(list);
        mid.appendChild(wrap);
      } else if (state.mode === "post") {
        if (state.error && !state.field) mid.appendChild(el(doc, "p", "error", state.error));
        const fields = [
          ["name", "Your name", "text", "Alex"],
          ["phone", "Phone", "tel", "555 234 5678"],
          ["from", "From", "text", "Library"],
          ["to", "To", "text", "Office"],
          ["date", "Date", "date", ""],
          ["time", "Time", "time", ""]
        ];
        fields.forEach(function (spec) {
          mid.appendChild(el(doc, "label", "lbl", spec[1]));
          const input = el(doc, "input");
          input.name = spec[0];
          input.type = spec[2];
          if (spec[3]) input.placeholder = spec[3];
          input.autocomplete = spec[0] === "phone" ? "tel" : "on";
          if (state.draft && state.draft[spec[0]]) input.value = state.draft[spec[0]];
          mid.appendChild(input);
          if (state.error && state.field === spec[0]) mid.appendChild(el(doc, "p", "error", state.error));
        });
        mid.appendChild(el(doc, "label", "lbl", "Seats"));
        const seats = el(doc, "select");
        seats.name = "seats";
        for (let n = 1; n <= 6; n++) {
          const option = el(doc, "option", "", String(n));
          option.value = String(n);
          if (String(n) === String((state.draft && state.draft.seats) || 3)) option.selected = true;
          seats.appendChild(option);
        }
        mid.appendChild(seats);
        mid.appendChild(el(doc, "label", "lbl", "Note, optional"));
        const note = el(doc, "input");
        note.name = "note";
        note.type = "text";
        note.placeholder = "South door";
        if (state.draft && state.draft.note) note.value = state.draft.note;
        mid.appendChild(note);
        mid.appendChild(el(doc, "p", "hint", "WaitLink will text this number a link to manage this trip, and JumpIn notices."));
      } else if (state.mode === "posted") {
        const card = el(doc, "section", "confirm");
        card.appendChild(el(doc, "h1", "", state.notice || "Trip posted."));
        card.appendChild(el(doc, "p", "route", state.route || ""));
        if (state.when) card.appendChild(el(doc, "p", "muted", state.when));
        if (state.seatsText) card.appendChild(el(doc, "p", "muted", state.seatsText));
        if (state.link) {
          const link = el(doc, "input");
          link.readOnly = true;
          link.value = state.link;
          card.appendChild(link);
          card.appendChild(el(doc, "p", "hint", "Send this link to the people riding with you."));
        }
        if (state.smsNote) card.appendChild(el(doc, "p", "hint", state.smsNote));
        if (state.error) card.appendChild(el(doc, "p", "error", state.error));
        if (state.role === "driver" && state.status !== "cancelled") {
          const actions = el(doc, "div", "action-row");
          const cancel = el(doc, "button", "textish", "Cancel trip");
          on(cancel, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "driver" }); draw(); });
          actions.appendChild(cancel);
          card.appendChild(actions);
        }
        mid.appendChild(card);
        if (state.sheet) mid.appendChild(confirmSheet(doc));
      } else if (state.mode === "reserved") {
        const card = el(doc, "section", "confirm");
        card.appendChild(el(doc, "h1", "", state.notice || "You have a seat."));
        card.appendChild(el(doc, "p", "route", state.route || ""));
        if (state.when) card.appendChild(el(doc, "p", "muted", state.when));
        if (state.seatsText) card.appendChild(el(doc, "p", "muted", state.seatsText));
        if (state.smsNote) card.appendChild(el(doc, "p", "hint", state.smsNote));
        else card.appendChild(el(doc, "p", "hint", state.role === "driver" ? "Passenger added to this trip." : "We texted you a link to manage your seat."));
        mid.appendChild(card);
      } else if (state.ride) {
        mid.appendChild(rideCard(doc, state));
        if (state.sheet) mid.appendChild(confirmSheet(doc));
      } else {
        mid.appendChild(el(doc, "p", "route", rideLine(state)));
        if (state.sheet) mid.appendChild(confirmSheet(doc));
      }
      let label = state.mode === "reserved" ? "View trip" : ui.buttonLabel(state);
      if (label === "Reserve a seat" && state.reserveOpen) label = state.role === "driver" ? "Confirm passenger" : "Confirm seat";
      if (state.busy && state.mode === "post") label = "Posting…";
      if (state.busy && (label === "Confirm seat" || label === "Confirm passenger")) label = "Reserving…";
      if (state.busy && (label === "Text me a link" || label === "Send")) label = "Sending…";
      if (label) {
        const button = el(doc, "button", "");
        if (state.busy) button.appendChild(el(doc, "span", "jumpin-spin"));
        button.appendChild(doc.createTextNode(label));
        on(button, "click", function () {
          if (label === "Post a ride") {
            const kept = state.rides || [];
            state = ui.reduce(state, { type: "post" });
            state.rides = kept;
          }
          else if (label === "Post") {
            const values = {};
            mid.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
            if (!values.seats) values.seats = 3;
            values.timeZone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
            const errors = core.postErrors(values);
            const when = errors.error ? null : core.departureError(values.date, values.time, values.timeZone, Date.now(), 30);
            if (errors.error) {
              state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
              state.draft = values;
            } else if (when.error) {
              state = ui.reduce(state, { type: "fail", field: "time", error: when.error });
              state.draft = values;
            } else if (cloud) {
              state.busy = true;
              state.draft = values;
              draw();
              Promise.resolve().then(function () { return cloud.postRide(values); }).then(function (result) {
                state.busy = false;
                if (!result || result.ok === false) {
                  state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not post. Check the connection and try again." });
                  state.draft = values;
                  state.rides = state.rides || [];
                } else state = postedFromServer(state, result, values, when.departAt);
                draw();
              }, function () {
                state.busy = false;
                state = ui.reduce(state, { type: "fail", error: "Could not post. Check the connection and try again." });
                state.draft = values;
                draw();
              });
              return;
            } else state = rememberRide(win, secrets, state, values, when.departAt);
          } else if (label === "Reserve a seat" && !state.reserveOpen) {
            state = ui.reduce(state, { type: "reserve-open" });
          } else if ((label === "Confirm seat" || label === "Confirm passenger") && cloud && state.ride) {
            const values = {};
            mid.querySelectorAll("input").forEach(function (input) { values[input.name] = input.value; });
            const errors = core.reserveErrors(values);
            if (errors.error) state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
            else {
              const wasDriver = state.role === "driver";
              state.busy = true;
              draw();
              cloud.reserveSeat(state.ride.rideId, values, { skipSaveSeat: wasDriver }).then(function (result) {
                state.busy = false;
                if (!result || result.ok === false) {
                  state = ui.reduce(state, { type: "fail", error: (result && result.error) || "Could not reserve. Check the connection and try again." });
                } else {
                  const ride = Object.assign({}, state.ride, {
                    seatsLeft: Math.max(0, Number(state.ride.seatsLeft || 1) - 1),
                    riders: (state.ride.riders || []).concat([{ reservationId: result.reservationId, name: values.name, status: "active" }])
                  });
                  state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: wasDriver ? "driver" : "rider" }), {
                    mode: "reserved",
                    ride: ride,
                    rides: state.rides || [],
                    route: (ride.from || "") + " → " + (ride.to || ""),
                    when: state.when,
                    seatsText: seatsLabel(ride.seatsLeft),
                    link: state.link,
                    smsNote: result.textSent === false ? (result.error || "Seat saved on this browser. Text could not be sent right now.") : "",
                    notice: wasDriver ? "Passenger added." : "You have a seat."
                  });
                }
                draw();
              }, function () {
                state.busy = false;
                state = ui.reduce(state, { type: "fail", error: "Could not reserve. Check the connection and try again." });
                draw();
              });
              return;
            }
          } else if (label === "Text me a link" && cloud && state.ride) {
            const values = {};
            mid.querySelectorAll("input").forEach(function (input) { values[input.name] = input.value; });
            state.busy = true;
            draw();
            cloud.sendManageLink(state.ride.rideId, values.phone, state.recovery === "driver" ? "driver" : "rider").then(function () {
              state.busy = false;
              state = ui.reduce(state, { type: "notice", notice: core.recoveryPhrase() });
              draw();
            }, function () {
              state.busy = false;
              state = ui.reduce(state, { type: "fail", error: "Could not send link. Check the connection and try again." });
              draw();
            });
            return;
          } else if (label === "View trip" && state.ride) {
            state = Object.assign(ui.reduce(state, { type: "ride", ride: state.ride, role: state.role }), {
              ride: state.ride,
              rides: state.rides || [],
              route: state.route,
              when: state.when,
              link: state.link
            });
          } else if (label === "Send") {
            const box = mid.querySelector("input[name=message]");
            sendMessage(box ? box.value : "");
            return;
          } else if (label === "Copy link") {
            const clip = win.navigator && win.navigator.clipboard;
            const link = state.link || (state.ride && cloud ? cloud.publicRideUrl(state.ride.rideId) : "");
            if (clip && clip.writeText && link) clip.writeText(link);
            state = ui.reduce(state, { type: "notice", notice: "Copied" });
          }
          draw();
        });
        if (state.busy) button.disabled = true;
        button.className = state.mode === "board" ? "cta" : "";
        if (state.mode === "board" && hero) hero.appendChild(button);
        else bottom.appendChild(button);
      }
      bottom.appendChild(siteFooter(doc));
      rootNode.appendChild(top);
      rootNode.appendChild(mid);
      rootNode.appendChild(bottom);
      applyShell(win, rootNode, state.mode);
      const bad = rootNode.querySelector && rootNode.querySelector(".error");
      if (bad && bad.scrollIntoView) bad.scrollIntoView({ block: "center" });
      if (secrets) secrets.setItem("jumpin-ui-mounted", "1");
    }

    function postedFromServer(current, result, values, departAt) {
      let when = values.date + " " + values.time;
      try { when = core.formatWhen(departAt, values.timeZone || "UTC"); } catch (err) { /* keep the typed date */ }
      const kept = current.rides || [];
      return Object.assign(ui.reduce(current, { type: "notice", notice: result.status === "pending" ? "Waiting for approval." : "Trip posted." }), {
        mode: "posted",
        role: "driver",
        status: result.status || "open",
        route: values.from + " → " + values.to,
        when: when,
        seatsText: seatsLabel(Number(values.seats || 3)),
        link: result.status === "pending" || !result.rideId || !cloud || !cloud.publicRideUrl ? "" : cloud.publicRideUrl(result.rideId),
        rideId: result.rideId,
        ride: { rideId: result.rideId, from: values.from, to: values.to, status: result.status || "open", seatsLeft: Number(values.seats || 3), note: values.note || "", driverName: values.name || "" },
        rides: kept,
        smsNote: result.textSent === false ? (result.error || "Trip posted on this browser. Text could not be sent right now.") : ""
      });
    }

    function connectCloud() {
      if (!cloud) return;
      let stop = function () { };
      try {
        stop = cloud.watchBoard(function (rides) {
          try {
            state.rides = (rides || []).map(function (ride) {
              return { rideId: ride.rideId, from: ride.from, to: ride.to, when: whenOf(ride), seats: (ride.seatsLeft == null ? "" : seatsLabel(ride.seatsLeft)), departAt: ride.departAt, note: ride.note || "", driverName: ride.driverName || "" };
            });
            if (state.mode === "board") draw();
          } catch (err) { /* leave the board that is already on screen */ }
        }) || function () { };
      } catch (err) { stop = function () { }; }
      cleanups.push(stop);
      const params = new URLSearchParams((win.location && win.location.search) || "");
      const view = params.get("view") || "";
      const rideId = params.get("ride") || "";
      const secret = params.get("k") || "";
      if (view === "trip" && rideId && secret) cloud.saveTrip(rideId, secret);
      if (view === "seat" && params.get("r") && secret) cloud.saveSeat(params.get("r"), secret);
      if (secret && win.history && win.history.replaceState && win.location) {
        params.delete("k");
        const next = params.toString();
        win.history.replaceState({}, "", win.location.pathname + (next ? "?" + next : ""));
      }
      if (rideId && (view === "ride" || view === "trip" || view === "seat")) openRide(rideId);
      if (cloud.prepareAppCheck) {
        try { cloud.prepareAppCheck(); } catch (err) { /* the board still works if App Check cannot start */ }
      }
    }

    on(win, "resize", function () { applyShell(win, rootNode, state.mode); });
    if (win.visualViewport) on(win.visualViewport, "resize", function () { applyShell(win, rootNode, state.mode); });
    if (win.visualViewport) on(win.visualViewport, "scroll", function () { applyShell(win, rootNode, state.mode); });
    draw();
    connectCloud();
    return { getState: function () { return state; }, setState: function (next) { state = next; draw(); }, root: rootNode };
  }

  function brandBar(doc, top) {
    const bar = el(doc, "div", "bar");
    const link = el(doc, "a", "brand");
    link.href = "https://waitlink.app/";
    link.appendChild(el(doc, "span", "mark", "⏳"));
    link.appendChild(el(doc, "span", "", "WaitLink"));
    const nav = el(doc, "nav");
    nav.appendChild(el(doc, "span", "product", "JumpIn"));
    const rides = el(doc, "a", "", "Rides");
    rides.href = "https://waitlink.app/?s=jumpin";
    nav.appendChild(rides);
    bar.appendChild(link);
    bar.appendChild(nav);
    top.appendChild(bar);
  }

  function loadRides(storage) {
    if (!storage || !storage.getItem) return [];
    try {
      const list = JSON.parse(storage.getItem("jumpin-rides") || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveRides(storage, rides) {
    if (!storage || !storage.setItem) return;
    try { storage.setItem("jumpin-rides", JSON.stringify(rides)); } catch (err) { /* keep the screen if storage is full */ }
  }

  function rememberRide(win, storage, state, values, departAt) {
    const zone = values.timeZone || "UTC";
    let when = values.date + " " + values.time;
    try { when = core.formatWhen(departAt, zone); } catch (err) { /* date text already set */ }
    const seats = String(values.seats || 3);
    const id = core.randomId("ride_");
    const ride = {
      id: id,
      from: values.from,
      to: values.to,
      when: when,
      seats: seats + " seats left"
    };
    const rides = [ride].concat(state.rides || []);
    saveRides(storage, rides);
    return Object.assign(ui.reduce(state, { type: "notice", notice: "Trip posted." }), {
      mode: "posted",
      route: values.from + " → " + values.to,
      when: when,
      seatsText: ride.seats,
      rides: rides
    });
  }

  function siteFooter(doc) {
    const foot = el(doc, "div", "site-foot");
    foot.appendChild(el(doc, "span", "", "JumpIn by WaitLink"));
    [["Privacy", "/privacy.html"], ["Terms", "/terms.html"], ["Contact", "/contact.html"]].forEach(function (item) {
      const link = el(doc, "a", "", item[0]);
      link.href = item[1];
      foot.appendChild(link);
    });
    foot.appendChild(el(doc, "span", "spacer", "© 2026 WaitLink"));
    return foot;
  }

  function rideLine(state) {
    if (state.notice) return state.notice;
    if (state.route) return state.route;
    if (state.status === "pending") return "Waiting for approval.";
    if (state.status === "rejected") return "This trip was not approved.";
    if (state.status === "cancelled") return "This trip was cancelled.";
    if (state.status === "open" && state.seatsLeft === 0) return "Full";
    if (!state.status) return "Ride";
    return "";
  }

  function destroy() {
    while (cleanups.length) cleanups.pop()();
  }

  function start(win) {
    win.document.body.classList.add("jumpin-on");
    try {
      const rawCloud = (win && win.JumpInCloud) || globalThis.JumpInCloud;
      if (rawCloud && typeof rawCloud.attach === "function") win.JumpInCloud = rawCloud.attach(win);
    } catch (err) { /* draw the board even if the cloud client cannot start */ }
    return mount(win);
  }

  return { mount: mount, destroy: destroy, start: start, listenerCount: function () { return cleanups.length; } };
});
