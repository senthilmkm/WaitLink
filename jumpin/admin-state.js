/**
 * SuperAdmin JumpIn page state. No phones are shown. Counts come before a send.
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JumpInAdmin = api;
  /* c8 ignore end */
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /* c8 ignore next */
  const core = typeof module === "object" && module.exports ? require("./core.js") : globalThis.JumpInCore;

  function blank() {
    return {
      error: "",
      notice: "",
      pendingConfirm: "",
      count: 0,
      left: 0
    };
  }

  function settingsErrors(fields) {
    const names = ["dailySmsCap", "maxSeats", "horizonDays", "maxMessagesPerRide", "maxPostsPerPhonePerDay", "maxActiveReservationsPerPhone", "maxSmsPerRecord", "resendCooldownSec"];
    for (let i = 0; i < names.length; i++) {
      const error = core.configFieldError(names[i], fields[names[i]]);
      if (error) return { field: names[i], error: error };
    }
    return { value: core.clampConfig(fields) };
  }

  function reduce(state, event) {
    const next = Object.assign({}, state, { error: "", notice: "" });
    if (event.type === "preview") {
      next.pendingConfirm = event.scope;
      next.count = event.count;
      next.left = event.left;
      return next;
    }
    if (event.type === "sent") {
      next.pendingConfirm = "";
      next.notice = "Text sent to " + event.count + " people.";
      return next;
    }
    if (event.type === "fail") {
      next.error = event.error || "";
      return next;
    }
    if (event.type === "clear") return blank();
    return next;
  }

  function canSend(state) {
    return state.pendingConfirm !== "" && state.count <= state.left;
  }

  return { blank: blank, settingsErrors: settingsErrors, reduce: reduce, canSend: canSend };
});
