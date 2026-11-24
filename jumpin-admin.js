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
    button.addEventListener("click", function (ev) { onClick(ev, button); });
    return button;
  }

  function withBusy(doc, btn, label, work) {
    if (!btn) return Promise.resolve().then(work);
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "";
    btn.appendChild(el(doc, "span", "admin-spin"));
    btn.appendChild(doc.createTextNode(label));
    function restore() {
      btn.disabled = false;
      btn.textContent = prev;
    }
    return Promise.resolve().then(work).then(function (val) {
      restore();
      return val;
    }, function (err) {
      restore();
      throw err;
    });
  }

  function seatsLabel(count, suffix) {
    return count + (count === 1 ? " seat" : " seats") + (suffix ? " " + suffix : "");
  }

  function shortTripId(id) {
    const s = String(id || "").replace(/^ride_/, "");
    return s ? "#" + s.slice(-6).toUpperCase() : "";
  }

  function formatWhen(departAt) {
    if (!departAt) return "";
    return new Date(departAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function buildRideCard(doc, ride, badgeText, actions) {
    const card = el(doc, "div", "admin-card");
    const top = el(doc, "div", "admin-card-top");
    const route = ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId;
    top.appendChild(el(doc, "div", "admin-route", route));
    if (badgeText) top.appendChild(el(doc, "span", "admin-badge", badgeText));
    card.appendChild(top);
    const when = formatWhen(ride.departAt);
    const code = shortTripId(ride.rideId);
    if (when || code) card.appendChild(el(doc, "div", "admin-meta", [code ? "Trip ID: " + code : "", when].filter(Boolean).join(" · ")));
    const who = [ride.driverName || "", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ");
    if (who) card.appendChild(el(doc, "div", "admin-meta muted", who));
    const paxCount = (ride.riders && ride.riders.length) || 0;
    const msgCount = (ride.messages && ride.messages.length) || 0;
    card.appendChild(el(doc, "div", "admin-meta muted", paxCount + (paxCount === 1 ? " passenger" : " passengers") + " · " + msgCount + (msgCount === 1 ? " message" : " messages")));
    if (ride.note) card.appendChild(el(doc, "div", "admin-note", ride.note));
    if (actions && actions.length) {
      const bar = el(doc, "div", "admin-actions");
      actions.forEach(function (act) { bar.appendChild(pillBtn(doc, act.label, act.tone, act.onClick)); });
      card.appendChild(bar);
    }
    return card;
  }

  function buildRideTable(doc, rows, badgeOf, actionsOf) {
    const wrap = el(doc, "div", "admin-table-wrap");
    const table = el(doc, "table", "admin-table");
    const thead = doc.createElement("thead");
    const headRow = doc.createElement("tr");
    ["Route", "When", "Driver", "Seats / Pax", "Msgs", "Actions"].forEach(function (h) {
      headRow.appendChild(el(doc, "th", "", h));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = doc.createElement("tbody");
    rows.forEach(function (ride) {
      const tr = doc.createElement("tr");
      const route = ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId;
      const tdRoute = doc.createElement("td");
      tdRoute.appendChild(el(doc, "div", "admin-route", route));
      const rowCode = shortTripId(ride.rideId);
      if (rowCode || ride.note) tdRoute.appendChild(el(doc, "div", "admin-meta muted", [rowCode ? "Trip ID: " + rowCode : "", ride.note || ""].filter(Boolean).join(" · ")));
      tr.appendChild(tdRoute);
      tr.appendChild(el(doc, "td", "", formatWhen(ride.departAt) || "—"));
      const who = [ride.driverName || "Driver", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ");
      tr.appendChild(el(doc, "td", "", who));
      const paxCount = (ride.riders && ride.riders.length) || 0;
      const tdSeats = doc.createElement("td");
      tdSeats.appendChild(el(doc, "span", "admin-badge", badgeOf(ride) || ride.status || ""));
      tdSeats.appendChild(el(doc, "div", "admin-meta muted", paxCount + (paxCount === 1 ? " rider" : " riders")));
      tr.appendChild(tdSeats);
      const msgCount = (ride.messages && ride.messages.length) || 0;
      tr.appendChild(el(doc, "td", "", String(msgCount)));
      const tdAct = doc.createElement("td");
      const bar = el(doc, "div", "admin-actions");
      actionsOf(ride).forEach(function (act) { bar.appendChild(pillBtn(doc, act.label, act.tone, act.onClick)); });
      tdAct.appendChild(bar);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function openDetailModal(doc, ride) {
    const modal = doc.getElementById("jumpin-detail-modal");
    if (!modal || !ride) return;
    const route = ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId;
    text(doc.getElementById("jumpin-detail-route"), route);
    const meta = [formatWhen(ride.departAt), [ride.driverName || "", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
    text(doc.getElementById("jumpin-detail-meta"), meta);
    const noteNode = doc.getElementById("jumpin-detail-note");
    if (noteNode) {
      noteNode.textContent = ride.note || "";
      noteNode.hidden = !ride.note;
    }
    const riders = ride.riders || [];
    text(doc.getElementById("jumpin-detail-pax-count"), String(riders.length));
    const paxBox = doc.getElementById("jumpin-detail-pax");
    if (paxBox) {
      paxBox.textContent = "";
      if (!riders.length) paxBox.appendChild(el(doc, "p", "quiet", "No passengers yet."));
      riders.forEach(function (r) {
        const row = el(doc, "div", "admin-subrow");
        row.appendChild(el(doc, "span", "", (r.name || "Passenger") + (r.phoneLast4 ? " · ····" + r.phoneLast4 : "")));
        row.appendChild(el(doc, "span", "admin-badge", "Active"));
        paxBox.appendChild(row);
      });
    }
    const msgs = ride.messages || [];
    text(doc.getElementById("jumpin-detail-msg-count"), String(msgs.length));
    const msgBox = doc.getElementById("jumpin-detail-msgs");
    if (msgBox) {
      msgBox.textContent = "";
      if (!msgs.length) msgBox.appendChild(el(doc, "p", "quiet", "No messages yet."));
      msgs.forEach(function (m) {
        const item = el(doc, "div", "admin-msg");
        const who = m.authorName ? m.authorName + (m.authorRole ? " (" + m.authorRole + ")" : "") : "System";
        const stamp = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
        item.appendChild(el(doc, "div", "admin-msg-head", [stamp, who].filter(Boolean).join(" · ")));
        item.appendChild(el(doc, "div", "", m.text || ""));
        msgBox.appendChild(item);
      });
    }
    modal.hidden = false;
  }

  let pendingConfirmFn = null;

  function askConfirm(doc, title, message, confirmLabel, onConfirm) {
    const modal = doc.getElementById("jumpin-confirm-modal");
    if (!modal) {
      onConfirm();
      return;
    }
    text(doc.getElementById("jumpin-confirm-title"), title);
    text(doc.getElementById("jumpin-confirm-msg"), message);
    text(doc.getElementById("jumpin-confirm-yes"), confirmLabel);
    pendingConfirmFn = onConfirm;
    modal.hidden = false;
  }

  const ADMIN_PAGE_SIZE = 12;
  const pageByBox = {};

  function fillTrips(doc, node, countNode, rows, badgeOf, actionsOf) {
    if (countNode) countNode.textContent = rows.length ? String(rows.length) : "";
    if (!node) return;
    node.textContent = "";
    if (!rows.length) {
      node.appendChild(doc.createTextNode("None"));
      return;
    }
    const boxKey = node.id || "trips";
    const totalPages = Math.max(1, Math.ceil(rows.length / ADMIN_PAGE_SIZE));
    const page = Math.min(pageByBox[boxKey] || 1, totalPages);
    pageByBox[boxKey] = page;
    const slice = rows.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
    node.appendChild(buildRideTable(doc, slice, badgeOf, actionsOf));
    const cards = el(doc, "div", "admin-cards");
    slice.forEach(function (ride) { cards.appendChild(buildRideCard(doc, ride, badgeOf(ride), actionsOf(ride))); });
    node.appendChild(cards);
    if (totalPages > 1) {
      const pager = el(doc, "div", "admin-pager");
      function addBtn(label, target, disabled, edge) {
        const btn = el(doc, "button", "admin-pager-btn" + (edge ? " admin-pager-edge" : ""), label);
        btn.type = "button";
        if (disabled) btn.disabled = true;
        btn.addEventListener("click", function () {
          pageByBox[boxKey] = target;
          fillTrips(doc, node, countNode, rows, badgeOf, actionsOf);
        });
        pager.appendChild(btn);
      }
      addBtn("First", 1, page <= 1, true);
      addBtn("‹ Prev", Math.max(1, page - 1), page <= 1, false);
      const info = el(doc, "span", "admin-pager-info");
      info.appendChild(el(doc, "span", "admin-pager-long", "Page " + page + " of " + totalPages));
      info.appendChild(el(doc, "span", "admin-pager-short", page + " / " + totalPages));
      pager.appendChild(info);
      addBtn("Next ›", Math.min(totalPages, page + 1), page >= totalPages, false);
      addBtn("Last", totalPages, page >= totalPages, true);
      node.appendChild(pager);
    }
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

  function matchesQuery(ride, q) {
    if (!q) return true;
    const parts = [ride.from, ride.to, ride.driverName, ride.phoneLast4, ride.note, shortTripId(ride.rideId)].concat((ride.riders || []).map(function (r) { return r.name + " " + (r.phoneLast4 || ""); }));
    return parts.join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function render(doc, state, lists, cloud) {
    text(doc.getElementById("jumpin-error"), state.error);
    text(doc.getElementById("jumpin-count"), state.pendingConfirm ? (state.count + " people. " + state.left + " texts left today.") : "");
    const send = doc.getElementById("jumpin-send");
    if (send) send.hidden = !admin.canSend(state);
    if (lists && lists.config) text(doc.getElementById("jumpin-sms-today"), "Texts sent today: " + (lists.config.dailySmsSent || 0));
    const searchNode = doc.getElementById("jumpin-search");
    const q = searchNode && searchNode.value ? searchNode.value.trim().toLowerCase() : "";
    const filterBy = function (arr) { return (arr || []).filter(function (r) { return matchesQuery(r, q); }); };
    const detailsAct = function (ride) { return { label: "Details", tone: "", onClick: function () { openDetailModal(doc, ride); } }; };
    fillTrips(doc, doc.getElementById("jumpin-pending"), doc.getElementById("jumpin-pending-count"), filterBy(lists && lists.pending), function (ride) {
      return ride.seatsLeft == null ? "Waiting" : seatsLabel(ride.seatsLeft, "");
    }, function (ride) {
      const list = [detailsAct(ride)];
      if (cloud) {
        list.push({ label: "Approve", tone: "primary", onClick: function (_e, btn) { withBusy(doc, btn, "Approving…", function () { return cloud.review(ride.rideId, "approve").then(cloud.refresh); }); } });
        list.push({ label: "Decline", tone: "warn", onClick: function (_e, btn) { withBusy(doc, btn, "Declining…", function () { return cloud.review(ride.rideId, "decline").then(cloud.refresh); }); } });
        list.push({ label: "Cancel", tone: "danger", onClick: function () {
          const route = ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId;
          askConfirm(doc, "Cancel this trip?", route + " will be cancelled and riders notified.", "Cancel trip", function () {
            return cloud.adminCancel(ride.rideId).then(cloud.refresh);
          });
        } });
      }
      return list;
    });
    fillTrips(doc, doc.getElementById("jumpin-upcoming"), doc.getElementById("jumpin-upcoming-count"), filterBy(lists && lists.upcoming), function (ride) {
      return ride.seatsLeft == null ? "Open" : seatsLabel(ride.seatsLeft, "left");
    }, function (ride) {
      const list = [detailsAct(ride)];
      if (cloud) {
        const route = ride.from && ride.to ? ride.from + " → " + ride.to : ride.rideId;
        const who = [ride.driverName || "Driver", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" ");
        list.push({ label: "Text trip", tone: "primary", onClick: function () { cloud.chooseTrip(ride); } });
        list.push({ label: "Block", tone: "warn", onClick: function () {
          askConfirm(doc, "Block driver from posting?", who + " won't be able to post new trips.", "Block driver", function () {
            return cloud.setPosting({ rideId: ride.rideId, blocked: true }).then(cloud.refresh);
          });
        } });
        list.push({ label: "Cancel", tone: "danger", onClick: function () {
          askConfirm(doc, "Cancel this trip?", route + " (" + (formatWhen(ride.departAt) || "upcoming") + ") will be cancelled and riders notified.", "Cancel trip", function () {
            return cloud.adminCancel(ride.rideId).then(cloud.refresh);
          });
        } });
      }
      return list;
    });
    fillTrips(doc, doc.getElementById("jumpin-past"), doc.getElementById("jumpin-past-count"), filterBy(lists && lists.past), function () {
      return "Completed";
    }, function (ride) { return [detailsAct(ride)]; });
    fillTrips(doc, doc.getElementById("jumpin-cancelled"), doc.getElementById("jumpin-cancelled-count"), filterBy(lists && lists.cancelled), function (ride) {
      return ride.status === "rejected" ? "Declined" : "Cancelled";
    }, function (ride) { return [detailsAct(ride)]; });
    fill(doc, doc.getElementById("jumpin-blocked"), doc.getElementById("jumpin-blocked-count"), (lists && lists.blocked) || [], function (entry) {
      const button = el(doc, "button", "admin-blocked-btn", (entry.driverName || "Driver") + " ····" + entry.phoneLast4 + " — Unblock");
      button.type = "button";
      if (cloud) button.addEventListener("click", function () { withBusy(doc, button, "Unblocking…", function () { return cloud.setPosting({ phoneHash: entry.phoneHash, blocked: false }).then(cloud.refresh); }); });
      return button;
    });
    const mSearchNode = doc.getElementById("jumpin-member-search");
    const mq = mSearchNode && mSearchNode.value ? mSearchNode.value.trim().toLowerCase() : "";
    const allMembers = (lists && lists.members) || [];
    const shownMembers = mq ? allMembers.filter(function (m) { return (String(m.name || "") + " " + String(m.phoneLast4 || "")).toLowerCase().indexOf(mq) !== -1; }) : allMembers;
    text(doc.getElementById("jumpin-members-count"), allMembers.length ? String(allMembers.length) : "");
    const modeBadge = doc.getElementById("jumpin-members-mode");
    if (modeBadge && lists && lists.config) modeBadge.textContent = lists.config.membersOnly ? "Members only" : "Open to all";
    fill(doc, doc.getElementById("jumpin-members"), null, shownMembers, function (m) {
      const row = el(doc, "div", "admin-subrow");
      row.appendChild(el(doc, "span", "", (m.name || "Member") + " · ····" + (m.phoneLast4 || "")));
      if (cloud && cloud.setMembers) {
        row.appendChild(pillBtn(doc, "Remove", "danger", function () {
          askConfirm(doc, "Remove member?", (m.name || "Member") + " (····" + (m.phoneLast4 || "") + ") will no longer be on the community list.", "Remove", function () {
            return cloud.setMembers({ removePhoneHash: m.phoneHash }).then(cloud.refresh);
          });
        }));
      }
      return row;
    });
    if (lists && lists.ok) {
      const upN = (lists.upcoming || []).length;
      const waitN = (lists.pending || []).length;
      const oldN = (lists.past || []).length + (lists.cancelled || []).length;
      const memN = (lists.members || []).length;
      const audN = lists.audienceCount || 0;
      text(doc.getElementById("jumpin-cleanup-summary"), "Upcoming: " + upN + " · Waiting: " + waitN + " · Past/Cancelled: " + oldN + " · Members: " + memN + " · Audience: " + audN);
    }
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
      let activeGroupId = (function () {
        try {
          const p = new URLSearchParams((win.location && win.location.search) || "");
          return p.get("g") || "default";
        } catch (err) { return "default"; }
      })();
      let groupsData = { isSuperAdmin: false, groups: [], platform: null };
      const groupSelect = page.getElementById("jumpin-group-select");
      const copyBoardBtn = page.getElementById("jumpin-copy-board-link");
      function switchTab(name) {
        ["trips", "members", "settings", "blocked", "cleanup", "groups"].forEach(function (other) {
          const b = page.getElementById("jumpin-tab-btn-" + other);
          const p = page.getElementById("jumpin-tab-" + other);
          if (b) b.className = "admin-tab" + (other === name ? " active" : "");
          if (p) p.hidden = other !== name;
        });
      }
      function paintGroups() {
        const listNode = page.getElementById("jumpin-groups-list");
        const countNode = page.getElementById("jumpin-groups-count");
        const platNode = page.getElementById("jumpin-platform-sms");
        const groups = groupsData.groups || [];
        const pendingCount = groups.filter(function (g) { return g.status === "pending"; }).length;
        if (countNode) countNode.textContent = pendingCount ? String(pendingCount) : (groups.length ? String(groups.length) : "");
        if (platNode && groupsData.platform) {
          platNode.textContent = "Platform SMS today: " + (groupsData.platform.dailySmsSent || 0) + " / " + (groupsData.platform.platformDailySmsCap || 2000);
        }
        if (groupSelect) {
          groupSelect.textContent = "";
          groups.forEach(function (g) {
            const opt = el(page, "option", "", g.name + " (" + g.groupId + ")");
            opt.value = g.groupId;
            if (g.groupId === activeGroupId) opt.selected = true;
            groupSelect.appendChild(opt);
          });
          groupSelect.hidden = !groups.length;
        }
        if (copyBoardBtn) copyBoardBtn.hidden = !groups.length;
        if (!listNode) return;
        listNode.textContent = "";
        if (!groups.length) {
          listNode.appendChild(page.createTextNode("No groups yet. Request your neighborhood group above."));
          return;
        }
        groups.forEach(function (g) {
          const card = el(page, "div", "admin-card");
          const top = el(page, "div", "admin-card-top");
          top.appendChild(el(page, "div", "admin-route", (g.name || g.groupId) + " (?" + "g=" + g.groupId + ")"));
          top.appendChild(el(page, "span", "admin-badge", g.status || "active"));
          card.appendChild(top);
          card.appendChild(el(page, "div", "admin-meta muted", "Contact: " + (g.contactEmail || "—") + " · Cap: " + (g.dailySmsCap != null ? g.dailySmsCap : 0) + " texts/day"));
          const bar = el(page, "div", "admin-actions");
          bar.appendChild(pillBtn(page, "Open", g.groupId === activeGroupId ? "primary" : "", function () {
            activeGroupId = g.groupId;
            switchTab("trips");
            refresh();
          }));
          if (groupsData.isSuperAdmin && g.groupId !== "default" && api && api.reviewGroup) {
            if (g.status !== "active") {
              bar.appendChild(pillBtn(page, "Approve", "primary", function (_e, btn) {
                withBusy(page, btn, "Approving…", function () { return api.reviewGroup({ groupId: g.groupId, decision: "approve" }).then(refresh); });
              }));
            } else {
              bar.appendChild(pillBtn(page, "Suspend", "warn", function (_e, btn) {
                withBusy(page, btn, "Pausing…", function () { return api.reviewGroup({ groupId: g.groupId, decision: "suspend" }).then(refresh); });
              }));
            }
            if (g.status === "pending") {
              bar.appendChild(pillBtn(page, "Reject", "danger", function (_e, btn) {
                withBusy(page, btn, "Removing…", function () { return api.reviewGroup({ groupId: g.groupId, decision: "reject" }).then(refresh); });
              }));
            }
          }
          card.appendChild(bar);
          listNode.appendChild(card);
        });
      }
      cloud = api ? {
        review: function (rideId, decision) { return api.review(rideId, decision, activeGroupId); },
        adminCancel: function (rideId) { return api.adminCancel(rideId, activeGroupId); },
        setPosting: function (body) { return api.setPosting(Object.assign({ groupId: activeGroupId }, body || {})); },
        setMembers: function (body) { return api.setMembers(Object.assign({ groupId: activeGroupId }, body || {})); },
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
        const groupWait = api.listGroups ? api.listGroups().then(function (gr) {
          if (gr && gr.ok) {
            groupsData = gr;
            const ids = (gr.groups || []).map(function (g) { return g.groupId; });
            if (ids.length && ids.indexOf(activeGroupId) === -1) activeGroupId = ids[0];
            if (!ids.length) switchTab("groups");
            paintGroups();
          }
        }) : Promise.resolve();
        return groupWait.then(function () {
          return api.listAdmin(activeGroupId).then(function (result) {
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
        });
      }
      function preview(scope) {
        setScopeHighlight(scope);
        const note = page.getElementById("jumpin-selected-trip");
        if (note) note.hidden = scope !== "trip" || !note.textContent;
        const textValue = page.getElementById("jumpin-announce").value;
        return api.broadcast({ scope: scope, text: textValue, confirm: false, rideId: chosenRide, groupId: activeGroupId }).then(function (result) {
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
      ["trips", "members", "settings", "blocked", "cleanup", "groups"].forEach(function (name) {
        const btn = page.getElementById("jumpin-tab-btn-" + name);
        if (!btn) return;
        btn.addEventListener("click", function () { switchTab(name); });
      });
      if (groupSelect) groupSelect.addEventListener("change", function () {
        activeGroupId = groupSelect.value || "default";
        refresh();
      });
      if (copyBoardBtn) copyBoardBtn.addEventListener("click", function () {
        const url = "https://waitlink.app/?s=jumpin" + (activeGroupId && activeGroupId !== "default" ? "&g=" + encodeURIComponent(activeGroupId) : "");
        const clip = win.navigator && win.navigator.clipboard;
        if (clip && clip.writeText) clip.writeText(url);
        copyBoardBtn.textContent = "Copied!";
      });
      const grpName = page.getElementById("jumpin-group-name");
      const grpSlug = page.getElementById("jumpin-group-slug");
      if (grpName && grpSlug) grpName.addEventListener("input", function () {
        if (!grpSlug.dataset || !grpSlug.dataset.edited) {
          grpSlug.value = String(grpName.value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
        }
      });
      if (grpSlug) grpSlug.addEventListener("input", function () { if (grpSlug.dataset) grpSlug.dataset.edited = "1"; });
      const grpCreate = page.getElementById("jumpin-group-create");
      if (grpCreate && api && api.createGroup) grpCreate.addEventListener("click", function () {
        const payload = {
          name: grpName ? grpName.value : "",
          groupId: grpSlug ? grpSlug.value : "",
          contactEmail: (page.getElementById("jumpin-group-email") || {}).value || "",
          supportNote: (page.getElementById("jumpin-group-support") || {}).value || "",
          membersOnly: ((page.getElementById("jumpin-group-members-only") || {}).value || "yes") === "yes"
        };
        withBusy(page, grpCreate, "Creating…", function () {
          return api.createGroup(payload).then(function (res) {
            if (!res || res.ok === false) state = admin.reduce(state, { type: "fail", error: (res && res.error) || "Could not create group." });
            else {
              activeGroupId = res.group && res.group.groupId ? res.group.groupId : activeGroupId;
              state = admin.reduce(state, { type: "clear" });
              text(page.getElementById("jumpin-admin-status"), res.group && res.group.status === "pending" ? "Group requested — waiting for platform approval." : "Group created and active.");
              return refresh();
            }
            paint();
          });
        });
      });
      ["upcoming", "pending", "past", "cancelled"].forEach(function (key) {
        const btn = page.getElementById("jumpin-filter-" + key);
        if (!btn) return;
        btn.addEventListener("click", function () {
          ["upcoming", "pending", "past", "cancelled"].forEach(function (other) {
            const b = page.getElementById("jumpin-filter-" + other);
            const p = page.getElementById("jumpin-" + other);
            if (b) b.className = "admin-btn" + (other === key ? " primary" : "");
            if (p) p.hidden = other !== key;
          });
        });
      });
      const searchBox = page.getElementById("jumpin-search");
      if (searchBox) searchBox.addEventListener("input", paint);
      const detailClose = page.getElementById("jumpin-detail-close");
      const detailModal = page.getElementById("jumpin-detail-modal");
      if (detailClose && detailModal) detailClose.addEventListener("click", function () { detailModal.hidden = true; });
      if (detailModal) detailModal.addEventListener("click", function (ev) { if (ev.target === detailModal) detailModal.hidden = true; });
      const confirmModal = page.getElementById("jumpin-confirm-modal");
      const confirmNo = page.getElementById("jumpin-confirm-no");
      const confirmYes = page.getElementById("jumpin-confirm-yes");
      function closeConfirm() {
        pendingConfirmFn = null;
        if (confirmModal) confirmModal.hidden = true;
      }
      if (confirmNo) confirmNo.addEventListener("click", closeConfirm);
      if (confirmModal) confirmModal.addEventListener("click", function (ev) { if (ev.target === confirmModal) closeConfirm(); });
      if (confirmYes) confirmYes.addEventListener("click", function () {
        const fn = pendingConfirmFn;
        if (!fn) { closeConfirm(); return; }
        withBusy(page, confirmYes, "Working…", function () {
          return Promise.resolve(fn()).then(closeConfirm, function (err) { closeConfirm(); throw err; });
        });
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
      if (save) save.addEventListener("click", function () { withBusy(page, save, "Saving…", function () { return saveSettings(firebase, page, api, refresh, activeGroupId); }); });
      const addMember = page.getElementById("jumpin-member-add");
      if (addMember && api && api.setMembers) addMember.addEventListener("click", function () {
        const nameNode = page.getElementById("jumpin-member-name");
        const phoneNode = page.getElementById("jumpin-member-phone");
        withBusy(page, addMember, "Adding…", function () {
          return api.setMembers({ groupId: activeGroupId, name: nameNode ? nameNode.value : "", phone: phoneNode ? phoneNode.value : "" }).then(function (res) {
            if (!res || res.ok === false) state = admin.reduce(state, { type: "fail", error: (res && res.error) || "Could not add member." });
            else {
              if (nameNode) nameNode.value = "";
              if (phoneNode) phoneNode.value = "";
              state = admin.reduce(state, { type: "clear" });
              refresh();
            }
            paint();
          });
        });
      });
      const importMembers = page.getElementById("jumpin-member-import");
      if (importMembers && api && api.setMembers) importMembers.addEventListener("click", function () {
        const bulkNode = page.getElementById("jumpin-member-bulk");
        withBusy(page, importMembers, "Importing…", function () {
          return api.setMembers({ groupId: activeGroupId, bulk: bulkNode ? bulkNode.value : "" }).then(function (res) {
            if (!res || res.ok === false) state = admin.reduce(state, { type: "fail", error: (res && res.error) || "Could not import members." });
            else {
              if (bulkNode) bulkNode.value = "";
              state = admin.reduce(state, { type: "clear" });
              text(page.getElementById("jumpin-admin-status"), "Added " + (res.added || 0) + " members" + (res.skipped ? " (" + res.skipped + " skipped)" : "") + ".");
              refresh();
            }
            paint();
          });
        });
      });
      const memberSearch = page.getElementById("jumpin-member-search");
      if (memberSearch) memberSearch.addEventListener("input", paint);
      [
        ["jumpin-purge-past", "past", "Clean Past & Cancelled Trips?"],
        ["jumpin-purge-trips", "trips", "Wipe ALL Trips?"],
        ["jumpin-purge-audience", "audience", "Clear Broadcast Audience?"],
        ["jumpin-purge-all", "all", "Full JumpIn Data Reset?"]
      ].forEach(function (spec) {
        const btn = page.getElementById(spec[0]);
        if (!btn || !api || !api.purge) return;
        btn.addEventListener("click", function () {
          withBusy(page, btn, "Checking…", function () {
            return api.purge({ groupId: activeGroupId, scope: spec[1], confirm: false }).then(function (res) {
              if (!res || res.ok === false) {
                state = admin.reduce(state, { type: "fail", error: (res && res.error) || "Could not preview cleanup." });
                paint();
                return;
              }
              const c = res.counts || {};
              const summary = [
                c.rides ? c.rides + " trips" : "",
                c.reservations ? c.reservations + " reservations" : "",
                c.audience ? c.audience + " audience phones" : "",
                c.blocks ? c.blocks + " blocked drivers" : "",
                c.members ? c.members + " members" : ""
              ].filter(Boolean).join(", ") || "0 records";
              if (summary === "0 records") {
                text(page.getElementById("jumpin-admin-status"), "Nothing to clean up for this option.");
                return;
              }
              askConfirm(page, spec[2], "This will permanently delete: " + summary + ".", "Delete now", function () {
                return api.purge({ groupId: activeGroupId, scope: spec[1], confirm: true }).then(function (done) {
                  if (!done || done.ok === false) state = admin.reduce(state, { type: "fail", error: (done && done.error) || "Cleanup failed." });
                  else {
                    state = admin.reduce(state, { type: "clear" });
                    text(page.getElementById("jumpin-admin-status"), "Cleanup complete (" + summary + " deleted).");
                  }
                  paint();
                  return refresh();
                });
              });
            });
          });
        });
      });
      ["trip", "upcoming", "all"].forEach(function (scope) {
        const button = page.getElementById("jumpin-preview-" + (scope === "trip" ? "trip" : scope === "upcoming" ? "upcoming" : "all"));
        if (button) button.addEventListener("click", function () { withBusy(page, button, "Checking…", function () { return preview(scope); }); });
      });
      const send = page.getElementById("jumpin-send");
      if (send) send.addEventListener("click", function () {
        const textValue = page.getElementById("jumpin-announce").value;
        withBusy(page, send, "Sending…", function () {
          return api.broadcast({ groupId: activeGroupId, scope: state.pendingConfirm, text: textValue, confirm: true, rideId: chosenRide }).then(function (result) {
            if (!result || result.ok === false) state = admin.reduce(state, { type: "fail", error: result && result.error });
            else state = admin.reduce(state, { type: "sent", count: result.count });
            paint();
            refresh();
          });
        });
      });
    }
  }

  function applyConfig(doc, config) {
    const enabled = doc.getElementById("jumpin-enabled");
    const review = doc.getElementById("jumpin-review");
    const membersOnly = doc.getElementById("jumpin-members-only");
    const contactEmail = doc.getElementById("jumpin-contact-email");
    const supportNote = doc.getElementById("jumpin-support-note");
    const thankYou = doc.getElementById("jumpin-thankyou");
    const adminEmails = doc.getElementById("jumpin-admin-emails");
    if (enabled) enabled.value = config.enabled ? "yes" : "no";
    if (review) review.value = config.requireRideApproval ? "yes" : "no";
    if (membersOnly) membersOnly.value = config.membersOnly ? "yes" : "no";
    if (contactEmail && config.contactEmail) contactEmail.value = config.contactEmail;
    if (supportNote) supportNote.value = config.supportNote || "";
    if (thankYou) thankYou.value = config.postRideThankYouSms ? "yes" : "no";
    if (adminEmails && Array.isArray(config.adminEmails)) adminEmails.value = config.adminEmails.join(", ");
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

  function saveSettings(firebase, doc, api, onSaved, groupId) {
    const membersNode = doc.getElementById("jumpin-members-only");
    const contactNode = doc.getElementById("jumpin-contact-email");
    const supportNode = doc.getElementById("jumpin-support-note");
    const thankYouNode = doc.getElementById("jumpin-thankyou");
    const adminsNode = doc.getElementById("jumpin-admin-emails");
    const fields = {
      enabled: doc.getElementById("jumpin-enabled").value === "yes",
      requireRideApproval: doc.getElementById("jumpin-review").value === "yes",
      membersOnly: membersNode ? membersNode.value === "yes" : false,
      contactEmail: contactNode ? contactNode.value : "",
      supportNote: supportNode ? supportNode.value : "",
      postRideThankYouSms: thankYouNode ? thankYouNode.value === "yes" : false,
      adminEmails: adminsNode ? adminsNode.value : "",
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
    if (api && api.saveAdminConfig) {
      checked.value.supportNote = String(fields.supportNote || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
      checked.value.postRideThankYouSms = fields.postRideThankYouSms === true;
      checked.value.groupId = groupId || "default";
      return api.saveAdminConfig(checked.value).then(function (res) {
        if (!res || res.ok === false) {
          if (error) error.textContent = (res && res.error) || "This page is not available.";
          return;
        }
        if (error) error.textContent = "";
        applyConfig(doc, res.config || checked.value);
        const status = doc.getElementById("jumpin-admin-status");
        if (status) status.textContent = "Saved.";
        if (onSaved) onSaved();
      }).catch(function () {
        if (error) error.textContent = "This page is not available.";
      });
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
