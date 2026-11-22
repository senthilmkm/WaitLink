/**
 * JumpIn screen state. Pure. One filled button, confirm-before-cancel, no browser dialogs.
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JumpInUi = api;
  /* c8 ignore end */
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /* c8 ignore next */
  const core = typeof module === "object" && module.exports ? require("./core.js") : globalThis.JumpInCore;

  function blank() {
    return {
      mode: "board",
      platform: "ios",
      status: "",
      role: "",
      seatsLeft: 0,
      reserveOpen: false,
      recovery: "",
      sheet: "",
      pendingAction: "",
      error: "",
      field: "",
      notice: "",
      shellHeight: "visualViewport"
    };
  }

  function openBoard(state) {
    return Object.assign(blank(), { platform: state.platform });
  }

  function openPost(state) {
    return Object.assign(blank(), { mode: "post", platform: state.platform });
  }

  function openRide(state, ride, role) {
    return {
      mode: "ride",
      platform: state.platform,
      status: ride.status,
      role: role || "",
      seatsLeft: ride.seatsLeft,
      reserveOpen: false,
      recovery: "",
      sheet: "",
      pendingAction: "",
      error: "",
      field: "",
      notice: "",
      shellHeight: "visualViewport"
    };
  }

  function reduce(state, event) {
    const next = Object.assign({}, state, { error: "", field: "", notice: "" });
    if (event.type === "post") return openPost(next);
    if (event.type === "board") return openBoard(next);
    if (event.type === "ride") return openRide(next, event.ride, event.role);
    if (event.type === "reserve-open") {
      if (next.status !== "open" || next.seatsLeft < 1 || (next.role && next.role !== "driver")) return next;
      next.reserveOpen = true;
      next.recovery = "";
      return next;
    }
    if (event.type === "reserve-close") {
      next.reserveOpen = false;
      return next;
    }
    if (event.type === "recovery") {
      next.recovery = event.role === "driver" ? "driver" : "rider";
      next.reserveOpen = false;
      next.sheet = "";
      return next;
    }
    if (event.type === "cancel-ask") {
      if (event.role === "driver" && (next.role === "driver" || next.status === "pending")) next.sheet = "trip";
      else if (event.role === "rider" && next.role === "rider") next.sheet = "seat";
      next.pendingAction = "";
      return next;
    }
    if (event.type === "keep") {
      next.sheet = "";
      next.pendingAction = "";
      return next;
    }
    if (event.type === "confirm") {
      if (next.sheet === "seat") next.pendingAction = "cancel-seat";
      if (next.sheet === "trip") next.pendingAction = "cancel-trip";
      next.sheet = "";
      return next;
    }
    if (event.type === "fail") {
      next.error = event.error || "";
      next.field = event.field || "";
      return next;
    }
    if (event.type === "notice") {
      next.notice = event.notice || "";
      return next;
    }
    return next;
  }

  function buttonLabel(state) {
    if (state.recovery) return "Text me a link";
    return core.filledButton(state);
  }

  function shellCss() {
    return {
      heightSource: "visualViewport",
      lockedVh: false,
      overscroll: "none"
    };
  }

  return { blank: blank, reduce: reduce, buttonLabel: buttonLabel, shellCss: shellCss, platformOf: core.platformOf };
});
