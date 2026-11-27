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
    const who = ride.kind === "request"
      ? ["🙋 Needs driver", ride.requesterName || "Rider", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ")
      : [ride.driverName || "", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ");
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
      const who = ride.kind === "request"
        ? ["🙋 Needs driver", ride.requesterName || "Rider", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ")
        : [ride.driverName || "Driver", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ");
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
    const whoDetail = ride.kind === "request"
      ? ["🙋 Needs driver", ride.requesterName || "Rider", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ")
      : [ride.driverName || "", ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" · ");
    const meta = [formatWhen(ride.departAt), whoDetail].filter(Boolean).join(" · ");
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
  let editingMemberHash = "";
  let memberFilter = "all";

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

  let editingMember = null;
  function openEditMemberModal(doc, member) {
    const modal = doc.getElementById("jumpin-edit-member-modal");
    if (!modal || !member) return;
    editingMember = member;
    editingMemberHash = member.phoneHash || "";
    const nameIn = doc.getElementById("jumpin-edit-member-name");
    const phoneIn = doc.getElementById("jumpin-edit-member-phone");
    const emailIn = doc.getElementById("jumpin-edit-member-email");
    const adminIn = doc.getElementById("jumpin-edit-member-admin");
    const blockBtn = doc.getElementById("jumpin-edit-member-block");
    const blockedBadge = doc.getElementById("jumpin-edit-member-blocked-badge");
    const errNode = doc.getElementById("jumpin-edit-member-error");
    const isBlocked = !!member._isBlocked;
    if (nameIn) nameIn.value = member.name || "";
    if (phoneIn) phoneIn.value = member.phoneE164 ? String(member.phoneE164).replace(/^\+1/, "") : "";
    if (emailIn) emailIn.value = member.email || "";
    if (adminIn) adminIn.checked = !!member.isAdmin;
    if (blockedBadge) blockedBadge.hidden = !isBlocked;
    if (blockBtn) {
      blockBtn.hidden = !!member.isAdmin || (!member.phoneE164 && !isBlocked);
      blockBtn.textContent = isBlocked ? "Unblock from posting" : "Block from posting";
    }
    if (errNode) {
      errNode.textContent = "";
      errNode.hidden = true;
    }
    modal.hidden = false;
  }

  const ADMIN_PAGE_SIZE = 12;
  const pageByBox = {};

  function appendPager(doc, node, boxKey, totalPages, page, onPage) {
    if (totalPages <= 1) return;
    const pager = el(doc, "div", "admin-pager");
    function addBtn(label, target, disabled, edge) {
      const btn = el(doc, "button", "admin-pager-btn" + (edge ? " admin-pager-edge" : ""), label);
      btn.type = "button";
      if (disabled) btn.disabled = true;
      btn.addEventListener("click", function () {
        pageByBox[boxKey] = target;
        onPage();
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
    appendPager(doc, node, boxKey, totalPages, page, function () {
      fillTrips(doc, node, countNode, rows, badgeOf, actionsOf);
    });
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
    const parts = [ride.from, ride.to, ride.driverName, ride.requesterName, ride.phoneLast4, ride.note, shortTripId(ride.rideId)].concat((ride.riders || []).map(function (r) { return r.name + " " + (r.phoneLast4 || ""); }));
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
    const blockRideAct = function (ride) {
      const isReq = ride.kind === "request";
      const roleWord = isReq ? "rider" : "driver";
      const who = [(isReq ? ride.requesterName : ride.driverName) || (isReq ? "Rider" : "Driver"), ride.phoneLast4 ? "····" + ride.phoneLast4 : ""].filter(Boolean).join(" ");
      return { label: "Block", tone: "warn", onClick: function () {
        askConfirm(doc, "Block " + roleWord + " from posting?", who + " won't be able to post new trips. No SMS will be sent to the " + roleWord + ".", "Block " + roleWord, function () {
          return cloud.setPosting({ rideId: ride.rideId, blocked: true }).then(cloud.refresh);
        });
      } };
    };
    fillTrips(doc, doc.getElementById("jumpin-pending"), doc.getElementById("jumpin-pending-count"), filterBy(lists && lists.pending), function (ride) {
      return ride.seatsLeft == null ? "Waiting" : seatsLabel(ride.seatsLeft, "");
    }, function (ride) {
      const list = [detailsAct(ride)];
      if (cloud) {
        list.push({ label: "Approve", tone: "primary", onClick: function (_e, btn) { withBusy(doc, btn, "Approving…", function () { return cloud.review(ride.rideId, "approve").then(cloud.refresh); }); } });
        list.push({ label: "Decline", tone: "warn", onClick: function (_e, btn) { withBusy(doc, btn, "Declining…", function () { return cloud.review(ride.rideId, "decline").then(cloud.refresh); }); } });
        list.push(blockRideAct(ride));
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
        list.push({ label: "Text trip", tone: "primary", onClick: function () { cloud.chooseTrip(ride); } });
        list.push({ label: "Cancel", tone: "danger", onClick: function () {
          askConfirm(doc, "Cancel this trip?", route + " (" + (formatWhen(ride.departAt) || "upcoming") + ") will be cancelled and riders notified.", "Cancel trip", function () {
            return cloud.adminCancel(ride.rideId).then(cloud.refresh);
          });
        } });
      }
      return list;
    });
    fillTrips(doc, doc.getElementById("jumpin-past"), doc.getElementById("jumpin-past-count"), filterBy(lists && lists.past), function (ride) {
      return ride.status === "open" ? "In progress" : "Completed";
    }, function (ride) { return [detailsAct(ride)]; });
    fillTrips(doc, doc.getElementById("jumpin-cancelled"), doc.getElementById("jumpin-cancelled-count"), filterBy(lists && lists.cancelled), function (ride) {
      return ride.status === "rejected" ? "Declined" : "Cancelled";
    }, function (ride) { return [detailsAct(ride)]; });
    const mSearchNode = doc.getElementById("jumpin-member-search");
    const mq = mSearchNode && mSearchNode.value ? mSearchNode.value.trim().toLowerCase() : "";
    const showAdminsOnly = memberFilter === "admins";
    const showBlockedOnly = memberFilter === "blocked";
    const allBlocked = (lists && lists.blocked) || [];
    const shownBlocked = mq ? allBlocked.filter(function (entry) {
      return [entry.driverName, entry.phoneLast4].filter(Boolean).join(" ").toLowerCase().indexOf(mq) !== -1;
    }) : allBlocked;
    const blockedBox = doc.getElementById("jumpin-blocked");
    fill(doc, blockedBox, null, shownBlocked, function (entry) {
      const button = el(doc, "button", "admin-blocked-btn", (entry.driverName || "Driver") + " ····" + entry.phoneLast4 + " — Unblock");
      button.type = "button";
      if (cloud) button.addEventListener("click", function () { withBusy(doc, button, "Unblocking…", function () { return cloud.setPosting({ phoneHash: entry.phoneHash, blocked: false }).then(cloud.refresh); }); });
      return button;
    });
    text(doc.getElementById("jumpin-blocked-count"), allBlocked.length ? String(allBlocked.length) : "");
    text(doc.getElementById("jumpin-member-blocked-opt"), allBlocked.length ? ("🚫 Blocked (" + allBlocked.length + ")") : "🚫 Blocked");
    if (blockedBox) blockedBox.hidden = !showBlockedOnly;
    const adminEmails = ((lists && lists.config && lists.config.adminEmails) || []).map(function (e) { return String(e || "").toLowerCase(); }).filter(Boolean);
    const groupMeta = (lists && lists.group) || null;
    const groupPhone = (groupMeta && groupMeta.contactPhoneE164) || "";
    const groupEmail = String((groupMeta && groupMeta.contactEmail) || (lists && lists.config && lists.config.contactEmail) || "").split(",")[0].trim().toLowerCase();
    function isAdminMember(m) {
      return !!(m && (m.isAdmin || (m.email && adminEmails.indexOf(String(m.email).toLowerCase()) !== -1) || (groupPhone && m.phoneE164 && m.phoneE164 === groupPhone)));
    }
    function memberSort(a, b) {
      const an = String((a && a.name) || (a && a.email) || "Member");
      const bn = String((b && b.name) || (b && b.email) || "Member");
      const cmp = an.localeCompare(bn, undefined, { sensitivity: "base" });
      return cmp !== 0 ? cmp : String((a && a.phoneLast4) || "").localeCompare(String((b && b.phoneLast4) || ""));
    }
    const allMembers = ((lists && lists.members) || []).slice().sort(memberSort);
    let sourceMembers = allMembers;
    if (showAdminsOnly) {
      const adminList = [];
      const seenEmails = {};
      allMembers.forEach(function (m) {
        if (!isAdminMember(m)) return;
        const em = String(m.email || (groupPhone && m.phoneE164 === groupPhone ? (groupEmail || adminEmails[0] || "") : "")).toLowerCase();
        if (em) seenEmails[em] = true;
        adminList.push(Object.assign({}, m, { email: em, _isAdmin: true }));
      });
      adminEmails.forEach(function (em) {
        if (seenEmails[em]) return;
        seenEmails[em] = true;
        const isOrg = groupMeta && String(groupMeta.contactEmail || "").toLowerCase().indexOf(em) !== -1;
        adminList.push({
          name: (isOrg && groupMeta.contactName) ? groupMeta.contactName : "Group Admin",
          phoneE164: isOrg ? (groupMeta.contactPhoneE164 || "") : "",
          phoneLast4: isOrg && groupMeta.contactPhoneE164 ? String(groupMeta.contactPhoneE164).slice(-4) : "",
          email: em,
          _isAdmin: true
        });
      });
      sourceMembers = adminList.sort(memberSort);
    }
    const shownMembers = mq ? sourceMembers.filter(function (m) {
      return [m.name, m.phoneLast4, m.phoneE164, m.email].filter(Boolean).join(" ").toLowerCase().indexOf(mq) !== -1;
    }) : sourceMembers;
    text(doc.getElementById("jumpin-members-count"), allMembers.length ? String(allMembers.length) : "");
    const modeBadge = doc.getElementById("jumpin-members-mode");
    if (modeBadge && lists && lists.config) modeBadge.textContent = lists.config.membersOnly ? "Members only" : "Open to all";
    const blockedHashes = {};
    allBlocked.forEach(function (b) { if (b && b.phoneHash) blockedHashes[b.phoneHash] = true; });
    const membersBox = doc.getElementById("jumpin-members");
    if (membersBox) membersBox.hidden = showBlockedOnly;
    const mTotalPages = Math.max(1, Math.ceil(shownMembers.length / ADMIN_PAGE_SIZE));
    const mPage = Math.min(pageByBox["jumpin-members"] || 1, mTotalPages);
    pageByBox["jumpin-members"] = mPage;
    const pagedMembers = shownMembers.slice((mPage - 1) * ADMIN_PAGE_SIZE, mPage * ADMIN_PAGE_SIZE);
    fill(doc, membersBox, null, pagedMembers, function (m) {
      const row = el(doc, "div", "admin-subrow");
      const adminFlag = !!(m._isAdmin || isAdminMember(m));
      const blockedFlag = !!(m.phoneHash && blockedHashes[m.phoneHash]);
      const info = el(doc, "div", "admin-member-info");
      const nameWrap = el(doc, "div", "admin-member-name");
      if (adminFlag) {
        const shield = el(doc, "span", "admin-shield", "🛡️");
        shield.setAttribute("title", "Group Admin");
        shield.setAttribute("aria-label", "Group Admin");
        nameWrap.appendChild(shield);
      }
      if (blockedFlag) {
        const blk = el(doc, "span", "admin-shield", "🚫");
        blk.setAttribute("title", "Blocked from posting");
        blk.setAttribute("aria-label", "Blocked from posting");
        nameWrap.appendChild(blk);
      }
      const phoneLabel = showAdminsOnly ? (m.phoneE164 || (m.phoneLast4 ? "····" + m.phoneLast4 : "")) : (m.phoneLast4 ? "····" + m.phoneLast4 : "");
      nameWrap.appendChild(doc.createTextNode((m.name || "Member") + (showAdminsOnly ? "" : (phoneLabel ? " · " + phoneLabel : ""))));
      info.appendChild(nameWrap);
      if (showAdminsOnly) {
        const contactParts = [phoneLabel, m.email || ""].filter(Boolean);
        if (contactParts.length) info.appendChild(el(doc, "div", "admin-member-meta", contactParts.join(" · ")));
      }
      row.appendChild(info);
      if (cloud && cloud.setMembers && m.phoneHash) {
        const btns = el(doc, "div", "admin-actions");
        btns.style.marginTop = "0";
        btns.appendChild(pillBtn(doc, "Edit", "", function () { openEditMemberModal(doc, Object.assign({}, m, { _isBlocked: blockedFlag })); }));
        row.appendChild(btns);
      }
      return row;
    });
    if (membersBox && shownMembers.length) {
      appendPager(doc, membersBox, "jumpin-members", mTotalPages, mPage, function () {
        render(doc, state, lists, cloud);
      });
    }
    if (lists && lists.ok) {
      const upN = (lists.upcoming || []).length;
      const waitN = (lists.pending || []).length;
      const oldN = (lists.past || []).length + (lists.cancelled || []).length;
      const memN = (lists.members || []).length;
      const audN = lists.audienceCount || 0;
      text(doc.getElementById("jumpin-cleanup-summary"), "Upcoming: " + upN + " · Waiting: " + waitN + " · Past/Cancelled: " + oldN + " · Members: " + memN + " · Audience: " + audN);
      const showPendingApproval = !!(waitN > 0 || (lists.config && lists.config.requireRideApproval));
      const pendFilterBtn = doc.getElementById("jumpin-filter-pending");
      if (pendFilterBtn) pendFilterBtn.hidden = !showPendingApproval;
      const pendPanel = doc.getElementById("jumpin-pending");
      if (!showPendingApproval && pendPanel && !pendPanel.hidden) {
        const upBtn = doc.getElementById("jumpin-filter-upcoming");
        if (upBtn && upBtn.click) upBtn.click();
      }
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
      function boardUrlFor(gid) {
        return "https://waitlink.app/jumpin" + (gid && gid !== "default" ? "?g=" + encodeURIComponent(gid) : "");
      }
      function copyUrl(url, btn) {
        const clip = win.navigator && win.navigator.clipboard;
        if (clip && clip.writeText) clip.writeText(url);
        if (btn) btn.textContent = "Copied!";
      }
      let activeTab = "trips";
      let platformViewOpen = false;
      let groupsViewOpen = false;
      let hasActiveAccess = false;
      const GROUP_TABS = ["trips", "members", "settings", "cleanup"];
      function hideGroupTabs() {
        GROUP_TABS.forEach(function (other) {
          const p = page.getElementById("jumpin-tab-" + other);
          if (p) p.hidden = true;
        });
      }
      function syncAdminChrome() {
        const tabsBar = page.getElementById("jumpin-admin-tabs");
        if (tabsBar) tabsBar.hidden = !hasActiveAccess || platformViewOpen || groupsViewOpen;
      }
      function setHeaderPanel(kind, open) {
        const isPlat = kind === "platform";
        if (isPlat) platformViewOpen = !!open;
        else groupsViewOpen = !!open;
        if (open) {
          if (isPlat && groupsViewOpen) setHeaderPanel("groups", false);
          if (!isPlat && platformViewOpen) setHeaderPanel("platform", false);
        }
        const panel = page.getElementById(isPlat ? "jumpin-platform-view" : "jumpin-tab-groups");
        const btn = page.getElementById(isPlat ? "jumpin-plat-open" : "jumpin-groups-open");
        const isOpen = isPlat ? platformViewOpen : groupsViewOpen;
        if (panel) panel.hidden = !isOpen;
        if (btn) btn.className = "admin-btn" + (isOpen ? " primary" : "");
        if (!isPlat) {
          const gBack = page.getElementById("jumpin-groups-back");
          const cSec = page.getElementById("jumpin-create-group-section");
          if (gBack) gBack.hidden = !hasActiveAccess || !!(cSec && !cSec.hidden);
        }
        syncAdminChrome();
        if (isOpen) hideGroupTabs();
        else if (!platformViewOpen && !groupsViewOpen) switchTab(activeTab);
      }
      function showPlatformView(open) { setHeaderPanel("platform", open); }
      function showGroupsView(open) { setHeaderPanel("groups", open); }
      function switchPlatTab(sub) {
        ["general", "features", "members"].forEach(function (k) {
          const b = page.getElementById("jumpin-plat-tab-btn-" + k);
          const p = page.getElementById("jumpin-plat-tab-" + k);
          if (b) b.className = "admin-tab" + (k === sub ? " active" : "");
          if (p) p.hidden = k !== sub;
        });
      }
      function switchTab(name) {
        if (name) activeTab = name;
        if (platformViewOpen || groupsViewOpen) return;
        GROUP_TABS.forEach(function (other) {
          const b = page.getElementById("jumpin-tab-btn-" + other);
          const p = page.getElementById("jumpin-tab-" + other);
          if (b) b.className = "admin-tab" + (other === name ? " active" : "");
          if (p) p.hidden = other !== name;
        });
      }
      (function () {
        try {
          const t = (new URLSearchParams((win.location && win.location.search) || "").get("tab") || "").toLowerCase();
          if (t === "groups") groupsViewOpen = true;
          else if (GROUP_TABS.indexOf(t) !== -1) activeTab = t;
        } catch (err) { /* keep default tab */ }
      })();
      function showGroupConfirmCard(group, isPending, allowAnother, shouldScroll, autoPending) {
        const grpConfirm = page.getElementById("jumpin-group-confirm");
        const grpAnother = page.getElementById("jumpin-group-another");
        if (grpAnother) grpAnother.hidden = !allowAnother;
        if (!grpConfirm) return;
        const badge = page.getElementById("jumpin-group-confirm-badge");
        const title = page.getElementById("jumpin-group-confirm-title");
        const msg = page.getElementById("jumpin-group-confirm-msg");
        const gName = (group && group.name) || "";
        const gId = (group && group.groupId) || "";
        if (badge) {
          badge.textContent = isPending ? "⏳ Pending Approval" : "✓ Active";
          badge.style.background = isPending ? "#fef3c7" : "#dcfce7";
          badge.style.color = isPending ? "#92400e" : "#15803d";
        }
        if (title) title.textContent = gName + (isPending ? (autoPending ? " — Waiting for Approval" : " — Request Submitted!") : " — Group Created!");
        if (msg) msg.textContent = isPending
          ? ("Your board link will be waitlink.app/jumpin?g=" + gId + ". We'll text you as soon as it's approved.")
          : ("Your board is live at waitlink.app/jumpin?g=" + gId + ".");
        if (grpConfirm.dataset) {
          if (autoPending) grpConfirm.dataset.pendingAuto = "1";
          else delete grpConfirm.dataset.pendingAuto;
        }
        grpConfirm.hidden = false;
        if (shouldScroll && grpConfirm.scrollIntoView) grpConfirm.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      function setToggleState(btn, on) {
        if (!btn) return;
        const val = !!on;
        btn.setAttribute("aria-checked", val ? "true" : "false");
        const txt = btn.querySelector ? btn.querySelector(".admin-switch-text") : null;
        if (txt) txt.textContent = val ? "On" : "Off";
      }
      function getToggleState(btn) {
        return !!(btn && btn.getAttribute && btn.getAttribute("aria-checked") === "true");
      }
      function setCreateGroupOpen(open) {
        const cSec = page.getElementById("jumpin-create-group-section");
        const newBtn = page.getElementById("jumpin-new-group-btn");
        const cancelBtn = page.getElementById("jumpin-create-group-cancel");
        const platSms = page.getElementById("jumpin-platform-sms");
        const listNode = page.getElementById("jumpin-groups-list");
        const gBack = page.getElementById("jumpin-groups-back");
        const groups = groupsData.groups || [];
        const hasPendingBlock = !groupsData.isSuperAdmin && groups.some(function (g) { return g.status === "pending"; });
        const isOpen = !!open && !hasPendingBlock;
        if (cSec) cSec.hidden = !isOpen;
        if (newBtn) newBtn.hidden = isOpen || hasPendingBlock;
        if (cancelBtn) cancelBtn.hidden = !groups.length;
        if (gBack) gBack.hidden = !hasActiveAccess || isOpen;
        if (platSms) platSms.hidden = isOpen;
        if (listNode) listNode.hidden = isOpen;
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
        const platOpenBtn = page.getElementById("jumpin-plat-open");
        if (platOpenBtn) platOpenBtn.hidden = !groupsData.isSuperAdmin;
        if (!groupsData.isSuperAdmin && platformViewOpen) showPlatformView(false);
        const broadcastEnabled = !groupsData.platform || groupsData.platform.broadcastSmsEnabled !== false;
        const openBroadcastBtn = page.getElementById("jumpin-open-broadcast");
        if (openBroadcastBtn) openBroadcastBtn.hidden = !broadcastEnabled;
        if (!broadcastEnabled) showSelectedTrip(null, false);
        const pendingGrp = !groupsData.isSuperAdmin ? groups.find(function (g) { return g.status === "pending"; }) : null;
        if (pendingGrp) {
          setCreateGroupOpen(false);
          showGroupConfirmCard(pendingGrp, true, false, false, true);
        } else {
          if (!groups.length) setCreateGroupOpen(true);
          else {
            const cSec = page.getElementById("jumpin-create-group-section");
            setCreateGroupOpen(cSec ? !cSec.hidden : false);
          }
          const grpAnother = page.getElementById("jumpin-group-another");
          if (grpAnother) grpAnother.hidden = false;
          const grpConfirm = page.getElementById("jumpin-group-confirm");
          if (grpConfirm && grpConfirm.dataset && grpConfirm.dataset.pendingAuto === "1") {
            grpConfirm.hidden = true;
            delete grpConfirm.dataset.pendingAuto;
          }
        }
        if (groupsData.isSuperAdmin && groupsData.platform) {
          const pEn = page.getElementById("jumpin-plat-enabled");
          const pCap = page.getElementById("jumpin-plat-cap");
          const pSuper = page.getElementById("jumpin-plat-super-emails");
          const pEmail = page.getElementById("jumpin-plat-email");
          const pPhone = page.getElementById("jumpin-plat-phone");
          const pSup = page.getElementById("jumpin-plat-support");
          const pBan = page.getElementById("jumpin-plat-banner");
          const pCompEn = page.getElementById("jumpin-plat-complete-enabled");
          const pCompInt = page.getElementById("jumpin-plat-complete-interval");
          const pRetEn = page.getElementById("jumpin-plat-retain-enabled");
          const pRetInt = page.getElementById("jumpin-plat-retain-interval");
          const fIos = page.getElementById("jumpin-feat-ios");
          const fBroadcast = page.getElementById("jumpin-feat-broadcast");
          const fNeedRide = page.getElementById("jumpin-feat-need-ride");
          if (pEn) pEn.value = groupsData.platform.platformEnabled === false ? "no" : "yes";
          if (pCap) pCap.value = String(groupsData.platform.platformDailySmsCap != null ? groupsData.platform.platformDailySmsCap : 2000);
          if (pSuper) pSuper.value = (groupsData.platform.superAdminEmails || []).join(", ");
          if (pEmail) pEmail.value = groupsData.platform.platformAdminEmail || "";
          if (pPhone) pPhone.value = (groupsData.platform.platformAdminPhone || "").replace(/^\+1/, "");
          if (pSup) pSup.value = groupsData.platform.platformSupportNote || "";
          if (pBan) pBan.value = groupsData.platform.maintenanceMessage || "";
          if (pCompEn) pCompEn.value = groupsData.platform.completeTripsEnabled === false ? "off" : "on";
          if (pCompInt) {
            pCompInt.value = String(groupsData.platform.completeTripsIntervalMinutes || 5);
            pCompInt.disabled = groupsData.platform.completeTripsEnabled === false;
          }
          if (pRetEn) pRetEn.value = groupsData.platform.retainTripsEnabled === false ? "off" : "on";
          if (pRetInt) {
            pRetInt.value = String(groupsData.platform.retainTripsIntervalHours || 24);
            pRetInt.disabled = groupsData.platform.retainTripsEnabled === false;
          }
          setToggleState(fIos, !!groupsData.platform.iosThemeEnabled);
          setToggleState(fBroadcast, groupsData.platform.broadcastSmsEnabled !== false);
          setToggleState(fNeedRide, !!groupsData.platform.needARideEnabled);
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
        const navGuide = page.getElementById("jumpin-nav-guide");
        if (navGuide) navGuide.hidden = !groupsData.isSuperAdmin;
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
          const shareUrl = boardUrlFor(g.groupId);
          card.appendChild(el(page, "div", "admin-meta muted", "Contact: " + (g.contactEmail || "—") + " · Cap: " + (g.dailySmsCap != null ? g.dailySmsCap : 0) + " texts/day"));
          card.appendChild(el(page, "div", "admin-meta muted", "Share link: " + shareUrl));
          const bar = el(page, "div", "admin-actions");
          bar.appendChild(pillBtn(page, "Open", g.groupId === activeGroupId ? "primary" : "", function () {
            activeGroupId = g.groupId;
            activeTab = "trips";
            showGroupsView(false);
            refresh();
          }));
          bar.appendChild(pillBtn(page, "Copy Link", "", function (_e, btn) { copyUrl(shareUrl, btn); }));
          if (groupsData.isSuperAdmin && g.groupId !== "default" && api && api.reviewGroup) {
            if (g.status !== "active") {
              const isSuspended = g.status === "suspended";
              bar.appendChild(pillBtn(page, isSuspended ? "Resume" : "Approve", "primary", function (_e, btn) {
                withBusy(page, btn, isSuspended ? "Resuming…" : "Approving…", function () {
                  return api.reviewGroup({ groupId: g.groupId, decision: "approve" }).then(function (res) {
                    if (res && res.textSent === false) text(page.getElementById("jumpin-admin-status"), "Group " + (isSuspended ? "resumed" : "approved") + ", but SMS notification could not be sent (SMS cap reached or unavailable).");
                    return refresh();
                  });
                });
              }));
            } else {
              bar.appendChild(pillBtn(page, "Suspend", "warn", function (_e, btn) {
                const suspendMsg = (g.name || g.groupId) + " (?" + "g=" + g.groupId + ") will be paused immediately. Visitors will not be able to post new rides or reserve seats, while existing rides, members, and settings are preserved. You can click Resume anytime to reopen it (no SMS is sent).";
                askConfirm(page, "Suspend group?", suspendMsg, "Suspend", function () {
                  return withBusy(page, btn, "Pausing…", function () { return api.reviewGroup({ groupId: g.groupId, decision: "suspend" }).then(refresh); });
                });
              }));
            }
            const removeLabel = g.status === "pending" ? "Reject" : "Delete";
            const removeMsg = g.status === "pending"
              ? (g.name || g.groupId) + " (?" + "g=" + g.groupId + ") will be permanently deleted, including its pending request and settings. No SMS or email will be sent to the organizer, and the URL slug can be reused."
              : (g.name || g.groupId) + " (?" + "g=" + g.groupId + ") will be permanently deleted along with all its rides, reservations, members, blocked numbers, and settings. No SMS or email will be sent to the organizer, drivers, or riders, and this cannot be undone (use Suspend to pause temporarily).";
            bar.appendChild(pillBtn(page, removeLabel, "danger", function () {
              askConfirm(page, removeLabel + " group?", removeMsg, removeLabel, function () {
                return api.reviewGroup({ groupId: g.groupId, decision: "reject" }).then(function () {
                  if (activeGroupId === g.groupId) activeGroupId = "default";
                  return refresh();
                });
              });
            }));
            const pBadge = el(page, "span", "admin-plat-badge", "🔒 Platform Only");
            pBadge.title = "Hidden from group admins — only Platform Admins can approve, suspend, or remove groups.";
            bar.appendChild(pBadge);
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
            const groups = gr.groups || [];
            const ids = groups.map(function (g) { return g.groupId; });
            hasActiveAccess = !!(gr.isSuperAdmin || groups.some(function (g) { return g.status === "active"; }));
            if (ids.length && ids.indexOf(activeGroupId) === -1) activeGroupId = ids[0];
            if (!hasActiveAccess) {
              showGroupsView(true);
            } else if (groupsViewOpen) {
              showGroupsView(true);
            }
            syncAdminChrome();
            paintGroups();
            const grpOpenBtn = page.getElementById("jumpin-groups-open");
            if (grpOpenBtn) grpOpenBtn.hidden = !hasActiveAccess;
            if (groupSelect) groupSelect.hidden = !hasActiveAccess || !groups.length;
            if (copyBoardBtn) copyBoardBtn.hidden = !hasActiveAccess || !groups.length;
          }
        }) : Promise.resolve();
        return groupWait.then(function () {
          if (api.listGroups && !hasActiveAccess) {
            lists = {};
            state = admin.reduce(state, { type: "clear" });
            paint();
            return;
          }
          return api.listAdmin(activeGroupId).then(function (result) {
            if (!result || result.ok === false) {
              state = admin.reduce(state, { type: "fail", error: (result && result.error) || "This page is not available." });
              lists = {};
            } else {
              lists = result;
              state = admin.reduce(state, { type: "clear" });
              applyConfig(page, result.config || {});
              const supWrap = page.getElementById("jumpin-support-note-wrap");
              if (supWrap) supWrap.hidden = !groupsData.isSuperAdmin && activeGroupId !== "default";
              const supBadge = page.getElementById("jumpin-support-plat-badge");
              if (supBadge) supBadge.hidden = !(groupsData.isSuperAdmin && activeGroupId !== "default");
              const supInput = page.getElementById("jumpin-support-note");
              if (supInput) supInput.disabled = !groupsData.isSuperAdmin && activeGroupId !== "default";
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
      function runGoogleSignIn(openNewGroup) {
        if (openNewGroup) activeTab = "groups";
        else if (activeTab === "groups") activeTab = "trips";
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(refresh);
      }
      page.getElementById("jumpin-signin").addEventListener("click", function () { runGoogleSignIn(true); });
      const signInAdmin = page.getElementById("jumpin-signin-admin");
      if (signInAdmin) signInAdmin.addEventListener("click", function () { runGoogleSignIn(false); });
      const signOut = page.getElementById("jumpin-signout");
      if (signOut) signOut.addEventListener("click", function () {
        if (platformViewOpen) showPlatformView(false);
        if (groupsViewOpen) showGroupsView(false);
        const platOpenBtn = page.getElementById("jumpin-plat-open");
        if (platOpenBtn) platOpenBtn.hidden = true;
        const grpOpenBtn = page.getElementById("jumpin-groups-open");
        if (grpOpenBtn) grpOpenBtn.hidden = true;
        firebase.auth().signOut();
      });
      const grpOpen = page.getElementById("jumpin-groups-open");
      if (grpOpen) grpOpen.addEventListener("click", function () { showGroupsView(true); });
      const grpBack = page.getElementById("jumpin-groups-back");
      if (grpBack) grpBack.addEventListener("click", function () { showGroupsView(false); });
      const installBtn = page.getElementById("jumpin-install-app");
      let deferredInstallPrompt = null;
      function syncInstallBtn() {
        if (!installBtn) return;
        const ua = (win.navigator && win.navigator.userAgent) || "";
        const standalone = !!((win.matchMedia && win.matchMedia("(display-mode: standalone)").matches) || (win.navigator && win.navigator.standalone));
        const isIos = /iPad|iPhone|iPod/i.test(ua);
        installBtn.hidden = standalone || (!deferredInstallPrompt && !isIos);
      }
      if (win.addEventListener) {
        win.addEventListener("beforeinstallprompt", function (e) {
          if (e && e.preventDefault) e.preventDefault();
          deferredInstallPrompt = e;
          syncInstallBtn();
        });
      }
      if (installBtn) {
        syncInstallBtn();
        installBtn.addEventListener("click", function () {
          if (deferredInstallPrompt && deferredInstallPrompt.prompt) {
            deferredInstallPrompt.prompt();
            deferredInstallPrompt = null;
            syncInstallBtn();
          } else {
            askConfirm(page, "Add JumpIn Admin to Home Screen", "On iPhone/iPad Safari: tap Share (⬆️) at the bottom, then tap 'Add to Home Screen'. On Android Chrome: open the browser menu (⋮) and tap 'Install app' or 'Add to Home screen'.", "Got it", function () { return Promise.resolve(); });
          }
        });
      }
      const platOpen = page.getElementById("jumpin-plat-open");
      if (platOpen) platOpen.addEventListener("click", function () { showPlatformView(true); });
      const platBack = page.getElementById("jumpin-plat-back");
      if (platBack) platBack.addEventListener("click", function () { showPlatformView(false); });
      ["general", "features", "members"].forEach(function (k) {
        const b = page.getElementById("jumpin-plat-tab-btn-" + k);
        if (b) b.addEventListener("click", function () { switchPlatTab(k); });
      });
      const mSearchIn = page.getElementById("jumpin-member-search-input");
      const mSearchBtn = page.getElementById("jumpin-member-search-btn");
      function openMemberTripsModal(m) {
        const modal = page.getElementById("jumpin-detail-modal");
        if (!modal) return;
        text(page.getElementById("jumpin-detail-route"), (m.name || "Member") + " (" + (m.phone || "") + ")");
        text(page.getElementById("jumpin-detail-meta"), "Group: " + (m.groupName || m.groupId) + " (?" + "g=" + m.groupId + ") · Organizer: " + [m.organizerEmail, m.organizerPhone].filter(Boolean).join(" / "));
        const note = page.getElementById("jumpin-detail-note");
        if (note) note.hidden = true;
        const trips = m.trips || [];
        text(page.getElementById("jumpin-detail-pax-count"), String(trips.length));
        const riders = page.getElementById("jumpin-detail-pax");
        if (riders) {
          riders.textContent = "";
          if (!trips.length) riders.appendChild(el(page, "p", "quiet", "No trips or reservations found for this member."));
          else trips.forEach(function (t) {
            const row = el(page, "div", "admin-subrow");
            row.appendChild(el(page, "span", "", t.role + " · " + t.from + " → " + t.to + (t.when ? " (" + t.when + ")" : "")));
            row.appendChild(el(page, "span", "admin-badge", t.status || ""));
            riders.appendChild(row);
          });
        }
        text(page.getElementById("jumpin-detail-msg-count"), "0");
        const msgs = page.getElementById("jumpin-detail-msgs");
        if (msgs) {
          msgs.textContent = "";
          msgs.appendChild(el(page, "p", "quiet", "No messages yet."));
        }
        modal.hidden = false;
      }
      function runMemberSearch() {
        if (!api || !api.searchMembers) return;
        const q = mSearchIn ? mSearchIn.value : "";
        const statusEl = page.getElementById("jumpin-member-search-status");
        const cardsEl = page.getElementById("jumpin-member-search-cards");
        const wrapEl = page.getElementById("jumpin-member-search-table-wrap");
        const tbodyEl = page.getElementById("jumpin-member-search-tbody");
        withBusy(page, mSearchBtn, "Searching…", function () {
          return api.searchMembers({ query: q }).then(function (res) {
            if (!res || res.ok === false) {
              text(statusEl, (res && res.error) || "Search failed.");
              if (cardsEl) cardsEl.textContent = "";
              if (tbodyEl) tbodyEl.textContent = "";
              if (wrapEl) wrapEl.hidden = true;
              return;
            }
            const list = res.results || [];
            text(statusEl, list.length ? list.length + " matching member" + (list.length === 1 ? "" : "s") + "." : "No matching members found.");
            if (cardsEl) cardsEl.textContent = "";
            if (tbodyEl) tbodyEl.textContent = "";
            if (wrapEl) wrapEl.hidden = !list.length;
            list.forEach(function (m) {
              const orgText = [m.organizerEmail, m.organizerPhone].filter(Boolean).join(" · ") || "—";
              const grpText = (m.groupName || m.groupId) + " (?" + "g=" + m.groupId + ")";
              const tripsCount = (m.trips || []).length;
              if (cardsEl) {
                const c = el(page, "div", "admin-card");
                const top = el(page, "div", "admin-card-top");
                top.appendChild(el(page, "div", "admin-route", m.name));
                top.appendChild(el(page, "span", "admin-badge", m.phone));
                c.appendChild(top);
                c.appendChild(el(page, "div", "admin-meta muted", "Group: " + grpText));
                c.appendChild(el(page, "div", "admin-meta muted", "Organizer: " + orgText));
                const act = el(page, "div", "admin-actions");
                act.appendChild(pillBtn(page, "More (" + tripsCount + " trips)", "", function () { openMemberTripsModal(m); }));
                c.appendChild(act);
                cardsEl.appendChild(c);
              }
              if (tbodyEl) {
                const tr = page.createElement("tr");
                [m.name, m.phone, grpText, orgText].forEach(function (val) {
                  const td = page.createElement("td");
                  td.textContent = val;
                  tr.appendChild(td);
                });
                const tdAct = page.createElement("td");
                tdAct.appendChild(pillBtn(page, "More (" + tripsCount + ")", "", function () { openMemberTripsModal(m); }));
                tr.appendChild(tdAct);
                tbodyEl.appendChild(tr);
              }
            });
          }).catch(function (err) {
            text(statusEl, (err && err.message) || "Could not search members right now. Please refresh and try again.");
          });
        });
      }
      if (mSearchBtn) mSearchBtn.addEventListener("click", runMemberSearch);
      if (mSearchIn) mSearchIn.addEventListener("keydown", function (e) {
        if (e && e.key === "Enter") {
          if (e.preventDefault) e.preventDefault();
          runMemberSearch();
        }
      });
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
      GROUP_TABS.forEach(function (name) {
        const btn = page.getElementById("jumpin-tab-btn-" + name);
        if (!btn) return;
        btn.addEventListener("click", function () { switchTab(name); });
      });
      if (groupSelect) groupSelect.addEventListener("change", function () {
        activeGroupId = groupSelect.value || "default";
        if (groupsViewOpen) showGroupsView(false);
        if (platformViewOpen) showPlatformView(false);
        refresh();
      });
      if (copyBoardBtn) copyBoardBtn.addEventListener("click", function () {
        copyUrl(boardUrlFor(activeGroupId), copyBoardBtn);
      });
      const grpName = page.getElementById("jumpin-group-name");
      const grpSlug = page.getElementById("jumpin-group-slug");
      const grpEmail = page.getElementById("jumpin-group-email");
      const grpPhone = page.getElementById("jumpin-group-phone");
      const slugPreview = page.getElementById("jumpin-group-slug-preview");
      const groupFieldMap = {
        name: ["jumpin-group-name", "jumpin-err-group-name"],
        groupId: ["jumpin-group-slug", "jumpin-err-group-slug"],
        contactEmail: ["jumpin-group-email", "jumpin-err-group-email"],
        contactPhone: ["jumpin-group-phone", "jumpin-err-group-phone"]
      };
      function setGroupFieldError(field, message) {
        const pair = groupFieldMap[field];
        if (!pair) return null;
        const inp = page.getElementById(pair[0]);
        const err = page.getElementById(pair[1]);
        if (inp) {
          if (message) { inp.classList.add("admin-input-invalid"); inp.setAttribute("aria-invalid", "true"); }
          else { inp.classList.remove("admin-input-invalid"); inp.removeAttribute("aria-invalid"); }
        }
        if (err) {
          err.textContent = message || "";
          err.hidden = !message;
        }
        return inp;
      }
      function clearGroupFieldErrors() {
        Object.keys(groupFieldMap).forEach(function (k) { setGroupFieldError(k, ""); });
      }
      function syncSlugPreview() {
        if (!slugPreview) return;
        const val = grpSlug && grpSlug.value ? grpSlug.value.trim() : "";
        slugPreview.textContent = val ? ("Your link: waitlink.app/jumpin?g=" + val) : "Used in your private link, e.g. waitlink.app/jumpin?g=ballantyne";
      }
      if (grpName && grpSlug) grpName.addEventListener("input", function () {
        setGroupFieldError("name", "");
        if (!grpSlug.dataset || !grpSlug.dataset.edited) {
          let s = String(grpName.value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          if (s.length > 20) {
            const cut = s.slice(0, 20);
            const dash = cut.lastIndexOf("-");
            s = (dash >= 4 ? cut.slice(0, dash) : cut).replace(/-+$/g, "");
          }
          grpSlug.value = s;
          setGroupFieldError("groupId", "");
          syncSlugPreview();
        }
      });
      if (grpSlug) grpSlug.addEventListener("input", function () {
        if (grpSlug.dataset) grpSlug.dataset.edited = "1";
        setGroupFieldError("groupId", "");
        syncSlugPreview();
      });
      if (grpEmail) grpEmail.addEventListener("input", function () { setGroupFieldError("contactEmail", ""); });
      if (grpPhone) grpPhone.addEventListener("input", function () { setGroupFieldError("contactPhone", ""); });
      const grpCreate = page.getElementById("jumpin-group-create");
      const grpConfirm = page.getElementById("jumpin-group-confirm");
      const grpAnother = page.getElementById("jumpin-group-another");
      const grpNewBtn = page.getElementById("jumpin-new-group-btn");
      const grpCancelBtn = page.getElementById("jumpin-create-group-cancel");
      function openCreateGroupForm() {
        if (grpConfirm) grpConfirm.hidden = true;
        setCreateGroupOpen(true);
        if (grpName && grpName.focus) grpName.focus();
      }
      if (grpAnother) grpAnother.addEventListener("click", openCreateGroupForm);
      if (grpNewBtn) grpNewBtn.addEventListener("click", openCreateGroupForm);
      if (grpCancelBtn) grpCancelBtn.addEventListener("click", function () { setCreateGroupOpen(false); });
      if (grpCreate && api && api.createGroup) grpCreate.addEventListener("click", function () {
        clearGroupFieldErrors();
        const payload = {
          name: grpName ? grpName.value.trim() : "",
          groupId: grpSlug ? grpSlug.value.trim().toLowerCase() : "",
          contactEmail: grpEmail ? grpEmail.value.trim() : "",
          contactPhone: grpPhone ? grpPhone.value.trim() : "",
          membersOnly: ((page.getElementById("jumpin-group-members-only") || {}).value || "yes") === "yes"
        };
        const c = win.JumpInCore;
        let firstBad = null;
        if (!payload.name) firstBad = firstBad || setGroupFieldError("name", "Enter a community or group name.");
        const slugMsg = c && c.groupSlugError ? c.groupSlugError(payload.groupId) : (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(payload.groupId) ? "Enter a 3–32 character slug (letters, numbers, and dashes)." : "");
        if (slugMsg) firstBad = setGroupFieldError("groupId", slugMsg) && (firstBad || page.getElementById("jumpin-group-slug"));
        const emailOk = c && c.cleanEmail ? !!c.cleanEmail(payload.contactEmail) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail);
        if (!emailOk) firstBad = setGroupFieldError("contactEmail", "Enter a valid contact email.") && (firstBad || page.getElementById("jumpin-group-email"));
        const phoneParsed = c && c.normalizePhone ? c.normalizePhone(payload.contactPhone) : { ok: payload.contactPhone.replace(/\D/g, "").length >= 10, error: "Enter a valid 10-digit US/Canada mobile number." };
        if (!phoneParsed.ok) firstBad = setGroupFieldError("contactPhone", phoneParsed.error || "Enter a valid 10-digit US/Canada mobile number.") && (firstBad || page.getElementById("jumpin-group-phone"));
        if (firstBad) {
          if (firstBad.focus) firstBad.focus();
          return;
        }
        withBusy(page, grpCreate, "Creating…", function () {
          return api.createGroup(payload).then(function (res) {
            if (!res || res.ok === false) {
              if (res && res.field && groupFieldMap[res.field]) {
                const elBad = setGroupFieldError(res.field, res.error || "Check this field.");
                if (elBad && elBad.focus) elBad.focus();
              } else {
                state = admin.reduce(state, { type: "fail", error: (res && res.error) || "Could not create group." });
              }
            } else {
              activeGroupId = res.group && res.group.groupId ? res.group.groupId : activeGroupId;
              state = admin.reduce(state, { type: "clear" });
              const gObj = res.group || {};
              const isPending = gObj.status === "pending";
              const baseStatus = isPending ? "Group requested — waiting for platform approval." : "Group created and active.";
              text(page.getElementById("jumpin-admin-status"), res.textSent === false ? baseStatus + " (SMS notification skipped — daily cap reached or unavailable.)" : baseStatus);
              if (grpName) grpName.value = "";
              if (grpSlug) {
                grpSlug.value = "";
                if (grpSlug.dataset) delete grpSlug.dataset.edited;
              }
              if (grpPhone) grpPhone.value = "";
              syncSlugPreview();
              setCreateGroupOpen(false);
              showGroupConfirmCard({
                name: gObj.name || payload.name,
                groupId: gObj.groupId || payload.groupId
              }, isPending, !isPending || !!groupsData.isSuperAdmin, true, false);
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
        const adminBtn = page.getElementById("jumpin-signin-admin");
        const titleEl = page.getElementById("jumpin-console-title");
        const createBox = page.getElementById("jumpin-create-group-box");
        const tabsBar = page.getElementById("jumpin-admin-tabs");
        const signedOutInfo = page.getElementById("jumpin-signedout-info");
        const navGuide = page.getElementById("jumpin-nav-guide");
        if (button) button.hidden = !!user;
        if (adminBtn) adminBtn.hidden = !!user;
        if (titleEl) titleEl.textContent = user ? "Community Carpool Console" : "Start or Manage a Carpool Group";
        if (signOut) signOut.hidden = !user;
        if (signedOutInfo) signedOutInfo.hidden = !!user;
        if (navGuide && !user) navGuide.hidden = true;
        const signedInEl = page.getElementById("jumpin-signedin-as");
        if (signedInEl) {
          signedInEl.textContent = user ? ("Signed in as " + (user.email || "JumpIn admin")) : "";
          signedInEl.hidden = !user;
        }
        text(page.getElementById("jumpin-admin-status"), user ? "" : "New organizer? Use any Google account to start a private neighborhood board or manage an existing one.");
        if (user) {
          if (grpEmail && !grpEmail.value && user.email) grpEmail.value = user.email;
          if (groupsViewOpen) {
            showGroupsView(true);
          } else {
            switchTab(activeTab);
          }
          refresh();
        } else {
          hasActiveAccess = false;
          groupsViewOpen = false;
          platformViewOpen = false;
          const grpOpenBtn = page.getElementById("jumpin-groups-open");
          if (grpOpenBtn) grpOpenBtn.hidden = true;
          const gv = page.getElementById("jumpin-tab-groups");
          if (gv) gv.hidden = true;
          syncAdminChrome();
          groupsData = { isSuperAdmin: false, groups: [], platform: null };
          switchTab("");
          if (groupSelect) groupSelect.hidden = true;
          if (copyBoardBtn) copyBoardBtn.hidden = true;
          showSelectedTrip(null);
          lists = {};
          state = admin.reduce(state, { type: "clear" });
          paint();
        }
      });
      ["jumpin-feat-ios", "jumpin-feat-broadcast", "jumpin-feat-need-ride"].forEach(function (id) {
        const sw = page.getElementById(id);
        if (sw) sw.addEventListener("click", function () { setToggleState(sw, !getToggleState(sw)); });
      });
      const featSave = page.getElementById("jumpin-feat-save");
      if (featSave && api && api.savePlatformConfig) featSave.addEventListener("click", function () {
        const fIos = page.getElementById("jumpin-feat-ios");
        const fBroadcast = page.getElementById("jumpin-feat-broadcast");
        const fNeedRide = page.getElementById("jumpin-feat-need-ride");
        const featErr = page.getElementById("jumpin-feat-error");
        if (featErr) { featErr.textContent = ""; featErr.hidden = true; }
        withBusy(page, featSave, "Saving…", function () {
          return api.savePlatformConfig({
            iosThemeEnabled: getToggleState(fIos),
            broadcastSmsEnabled: getToggleState(fBroadcast),
            needARideEnabled: getToggleState(fNeedRide)
          }).then(function (res) {
            if (!res || res.ok === false) {
              const msg = (res && res.error) || "Could not save feature config.";
              if (featErr) { featErr.textContent = msg; featErr.hidden = false; }
              else state = admin.reduce(state, { type: "fail", error: msg });
            } else {
              state = admin.reduce(state, { type: "clear" });
              text(page.getElementById("jumpin-admin-status"), "Feature config saved.");
              return refresh();
            }
            paint();
          });
        });
      });
      const save = page.getElementById("jumpin-save");
      if (save) save.addEventListener("click", function () { withBusy(page, save, "Saving…", function () { return saveSettings(firebase, page, api, refresh, activeGroupId); }); });
      if (page.querySelectorAll) {
        page.querySelectorAll("[data-info-target]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            if (e && e.preventDefault) e.preventDefault();
            const box = page.getElementById(btn.getAttribute("data-info-target"));
            if (!box) return;
            box.hidden = !box.hidden;
            btn.setAttribute("aria-expanded", box.hidden ? "false" : "true");
          });
        });
      }
      const pCompEnBind = page.getElementById("jumpin-plat-complete-enabled");
      const pCompIntBind = page.getElementById("jumpin-plat-complete-interval");
      if (pCompEnBind && pCompIntBind) pCompEnBind.addEventListener("change", function () { pCompIntBind.disabled = pCompEnBind.value === "off"; });
      const pRetEnBind = page.getElementById("jumpin-plat-retain-enabled");
      const pRetIntBind = page.getElementById("jumpin-plat-retain-interval");
      if (pRetEnBind && pRetIntBind) pRetEnBind.addEventListener("change", function () { pRetIntBind.disabled = pRetEnBind.value === "off"; });
      const platSave = page.getElementById("jumpin-plat-save");
      if (platSave && api && api.savePlatformConfig) platSave.addEventListener("click", function () {
        const pEn = page.getElementById("jumpin-plat-enabled");
        const pCap = page.getElementById("jumpin-plat-cap");
        const pSuper = page.getElementById("jumpin-plat-super-emails");
        const pEmail = page.getElementById("jumpin-plat-email");
        const pPhone = page.getElementById("jumpin-plat-phone");
        const pSup = page.getElementById("jumpin-plat-support");
        const pBan = page.getElementById("jumpin-plat-banner");
        const pCompEn = page.getElementById("jumpin-plat-complete-enabled");
        const pCompInt = page.getElementById("jumpin-plat-complete-interval");
        const pRetEn = page.getElementById("jumpin-plat-retain-enabled");
        const pRetInt = page.getElementById("jumpin-plat-retain-interval");
        withBusy(page, platSave, "Saving…", function () {
          return api.savePlatformConfig({
            platformEnabled: !pEn || pEn.value !== "no",
            platformDailySmsCap: pCap ? Number(pCap.value || 0) : 2000,
            platformAdminEmail: pEmail ? pEmail.value : "",
            superAdminEmails: pSuper ? pSuper.value : undefined,
            platformAdminPhone: pPhone ? pPhone.value : "",
            platformSupportNote: pSup ? pSup.value : "",
            maintenanceMessage: pBan ? pBan.value : "",
            completeTripsEnabled: !pCompEn || pCompEn.value !== "off",
            completeTripsIntervalMinutes: pCompInt ? Number(pCompInt.value || 5) : 5,
            retainTripsEnabled: !pRetEn || pRetEn.value !== "off",
            retainTripsIntervalHours: pRetInt ? Number(pRetInt.value || 24) : 24
          }).then(function (res) {
            const platErr = page.getElementById("jumpin-plat-error");
            if (!res || res.ok === false) {
              const msg = (res && res.error) || "Could not save platform settings.";
              if (platErr) { platErr.textContent = msg; platErr.hidden = false; }
              else state = admin.reduce(state, { type: "fail", error: msg });
            } else {
              if (platErr) { platErr.textContent = ""; platErr.hidden = true; }
              state = admin.reduce(state, { type: "clear" });
              text(page.getElementById("jumpin-admin-status"), "Platform settings saved.");
              return refresh();
            }
            paint();
          });
        });
      });
      let memberActionPanel = "";
      function setInlineError(inputId, errId, msg) {
        const inp = page.getElementById(inputId);
        const errEl = page.getElementById(errId);
        const hasErr = !!msg;
        if (errEl) { errEl.textContent = msg || ""; errEl.hidden = !hasErr; }
        if (inp && inp.classList) {
          if (hasErr) inp.classList.add("admin-input-invalid");
          else inp.classList.remove("admin-input-invalid");
        }
        return hasErr ? inp : null;
      }
      function setMemberPanel(mode) {
        memberActionPanel = mode === memberActionPanel ? "" : (mode || "");
        const addPanel = page.getElementById("jumpin-add-member-panel");
        const bulkPanel = page.getElementById("jumpin-bulk-import-panel");
        const openAddBtn = page.getElementById("jumpin-open-add-member");
        const openBulkBtn = page.getElementById("jumpin-open-bulk-import");
        if (addPanel) addPanel.hidden = memberActionPanel !== "add";
        if (bulkPanel) bulkPanel.hidden = memberActionPanel !== "bulk";
        if (openAddBtn) openAddBtn.className = "admin-btn" + (memberActionPanel === "bulk" ? "" : " primary");
        if (openBulkBtn) openBulkBtn.className = "admin-btn" + (memberActionPanel === "bulk" ? " primary" : "");
        setInlineError("jumpin-member-phone", "jumpin-err-member-phone", "");
        setInlineError("jumpin-member-bulk", "jumpin-err-member-bulk", "");
        if (memberActionPanel === "add") {
          const n = page.getElementById("jumpin-member-name");
          if (n && n.focus) n.focus();
        } else if (memberActionPanel === "bulk") {
          const b = page.getElementById("jumpin-member-bulk");
          if (b && b.focus) b.focus();
        }
      }
      const openAddMember = page.getElementById("jumpin-open-add-member");
      const openBulkImport = page.getElementById("jumpin-open-bulk-import");
      const cancelAddMember = page.getElementById("jumpin-add-member-cancel");
      const cancelBulkImport = page.getElementById("jumpin-bulk-import-cancel");
      const memberPhoneIn = page.getElementById("jumpin-member-phone");
      const memberBulkIn = page.getElementById("jumpin-member-bulk");
      if (memberPhoneIn) memberPhoneIn.addEventListener("input", function () { setInlineError("jumpin-member-phone", "jumpin-err-member-phone", ""); });
      if (memberBulkIn) memberBulkIn.addEventListener("input", function () { setInlineError("jumpin-member-bulk", "jumpin-err-member-bulk", ""); });
      if (openAddMember) openAddMember.addEventListener("click", function () { setMemberPanel("add"); });
      if (openBulkImport) openBulkImport.addEventListener("click", function () { setMemberPanel("bulk"); });
      if (cancelAddMember) cancelAddMember.addEventListener("click", function () { setMemberPanel(""); });
      if (cancelBulkImport) cancelBulkImport.addEventListener("click", function () { setMemberPanel(""); });
      const addMember = page.getElementById("jumpin-member-add");
      if (addMember && api && api.setMembers) addMember.addEventListener("click", function () {
        const nameNode = page.getElementById("jumpin-member-name");
        const phoneNode = page.getElementById("jumpin-member-phone");
        const phoneVal = phoneNode ? phoneNode.value : "";
        const c = win.JumpInCore;
        const parsed = c && c.normalizePhone ? c.normalizePhone(phoneVal) : { ok: phoneVal.replace(/\D/g, "").length >= 10, error: "Enter a US or Canada mobile number." };
        if (!parsed.ok) {
          const bad = setInlineError("jumpin-member-phone", "jumpin-err-member-phone", parsed.error || "Enter a US or Canada mobile number.");
          if (bad && bad.focus) bad.focus();
          return;
        }
        setInlineError("jumpin-member-phone", "jumpin-err-member-phone", "");
        withBusy(page, addMember, "Adding…", function () {
          return api.setMembers({ groupId: activeGroupId, name: nameNode ? nameNode.value : "", phone: phoneVal }).then(function (res) {
            if (!res || res.ok === false) {
              const bad = setInlineError("jumpin-member-phone", "jumpin-err-member-phone", (res && res.error) || "Could not add member.");
              if (bad && bad.focus) bad.focus();
            } else {
              if (nameNode) nameNode.value = "";
              if (phoneNode) phoneNode.value = "";
              setMemberPanel("");
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
        const bulkVal = bulkNode ? bulkNode.value : "";
        if (!bulkVal.trim()) {
          const bad = setInlineError("jumpin-member-bulk", "jumpin-err-member-bulk", "Paste at least one name and US/Canada phone number.");
          if (bad && bad.focus) bad.focus();
          return;
        }
        setInlineError("jumpin-member-bulk", "jumpin-err-member-bulk", "");
        withBusy(page, importMembers, "Importing…", function () {
          return api.setMembers({ groupId: activeGroupId, bulk: bulkVal }).then(function (res) {
            if (!res || res.ok === false) {
              const bad = setInlineError("jumpin-member-bulk", "jumpin-err-member-bulk", (res && res.error) || "Could not import members.");
              if (bad && bad.focus) bad.focus();
            } else {
              if (bulkNode) bulkNode.value = "";
              setMemberPanel("");
              state = admin.reduce(state, { type: "clear" });
              text(page.getElementById("jumpin-admin-status"), "Added " + (res.added || 0) + " members" + (res.skipped ? " (" + res.skipped + " skipped)" : "") + ".");
              refresh();
            }
            paint();
          });
        });
      });
      const memberSearch = page.getElementById("jumpin-member-search");
      if (memberSearch) memberSearch.addEventListener("input", function () {
        pageByBox["jumpin-members"] = 1;
        paint();
      });
      const memberFilterBtns = {
        all: page.getElementById("jumpin-member-all-btn"),
        admins: page.getElementById("jumpin-member-admins-btn"),
        blocked: page.getElementById("jumpin-member-blocked-btn")
      };
      const memberFilterSelect = page.getElementById("jumpin-member-filter-select");
      function setMemberFilterMode(mode) {
        memberFilter = mode || "all";
        Object.keys(memberFilterBtns).forEach(function (k) {
          const btn = memberFilterBtns[k];
          if (!btn) return;
          const active = memberFilter === k;
          btn.className = "admin-btn" + (active ? " primary" : "");
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
        if (memberFilterSelect) memberFilterSelect.value = memberFilter;
        pageByBox["jumpin-members"] = 1;
        paint();
      }
      if (memberFilterSelect) memberFilterSelect.addEventListener("change", function () { setMemberFilterMode(memberFilterSelect.value || "all"); });
      if (memberFilterBtns.all) memberFilterBtns.all.addEventListener("click", function () { setMemberFilterMode("all"); });
      if (memberFilterBtns.admins) memberFilterBtns.admins.addEventListener("click", function () { setMemberFilterMode(memberFilter === "admins" ? "all" : "admins"); });
      if (memberFilterBtns.blocked) memberFilterBtns.blocked.addEventListener("click", function () { setMemberFilterMode(memberFilter === "blocked" ? "all" : "blocked"); });
      const editModal = page.getElementById("jumpin-edit-member-modal");
      const editCancel = page.getElementById("jumpin-edit-member-cancel");
      const editSave = page.getElementById("jumpin-edit-member-save");
      const editBlock = page.getElementById("jumpin-edit-member-block");
      const editRemove = page.getElementById("jumpin-edit-member-remove");
      if (editCancel && editModal) editCancel.addEventListener("click", function () { editModal.hidden = true; });
      if (editModal) editModal.addEventListener("click", function (ev) { if (ev.target === editModal) editModal.hidden = true; });
      if (editBlock && api && api.setPosting) editBlock.addEventListener("click", function () {
        const m = editingMember;
        if (!m || (!m.phoneE164 && !m._isBlocked)) return;
        if (editModal) editModal.hidden = true;
        if (m._isBlocked) {
          askConfirm(page, "Unblock member?", (m.name || "Member") + " (····" + (m.phoneLast4 || "") + ") will be able to post new trips again. No SMS will be sent to the member.", "Unblock", function () {
            return api.setPosting({ groupId: activeGroupId, phoneHash: m.phoneHash, blocked: false }).then(refresh);
          });
        } else {
          askConfirm(page, "Block member from posting?", (m.name || "Member") + " (····" + (m.phoneLast4 || "") + ") won't be able to post new trips. No SMS will be sent to the member.", "Block", function () {
            return api.setPosting({ groupId: activeGroupId, phone: m.phoneE164, name: m.name || "", blocked: true }).then(refresh);
          });
        }
      });
      if (editRemove && api && api.setMembers) editRemove.addEventListener("click", function () {
        const m = editingMember;
        if (!m || !m.phoneHash) return;
        if (editModal) editModal.hidden = true;
        askConfirm(page, "Remove member?", (m.name || "Member") + " (····" + (m.phoneLast4 || "") + ") will no longer be on the community list.", "Remove", function () {
          return api.setMembers({ groupId: activeGroupId, removePhoneHash: m.phoneHash }).then(refresh);
        });
      });
      const editNameIn = page.getElementById("jumpin-edit-member-name");
      const editPhoneIn = page.getElementById("jumpin-edit-member-phone");
      const editEmailIn = page.getElementById("jumpin-edit-member-email");
      function clearEditMemberErr() {
        const errNode = page.getElementById("jumpin-edit-member-error");
        if (errNode) { errNode.textContent = ""; errNode.hidden = true; }
        [editNameIn, editPhoneIn, editEmailIn].forEach(function (inp) {
          if (inp && inp.classList) inp.classList.remove("admin-input-invalid");
        });
      }
      [editNameIn, editPhoneIn, editEmailIn].forEach(function (inp) {
        if (inp) inp.addEventListener("input", clearEditMemberErr);
      });
      if (editSave && api && api.setMembers) editSave.addEventListener("click", function () {
        const adminIn = page.getElementById("jumpin-edit-member-admin");
        const errNode = page.getElementById("jumpin-edit-member-error");
        clearEditMemberErr();
        const nameVal = editNameIn ? editNameIn.value.trim() : "";
        const phoneVal = editPhoneIn ? editPhoneIn.value.trim() : "";
        const emailVal = editEmailIn ? editEmailIn.value.trim() : "";
        const c = win.JumpInCore;
        let badInp = null;
        let badMsg = "";
        if (!nameVal) {
          badInp = editNameIn;
          badMsg = "Enter a member name.";
        } else {
          const parsedPhone = c && c.normalizePhone ? c.normalizePhone(phoneVal) : { ok: phoneVal.replace(/\D/g, "").length >= 10, error: "Enter a US or Canada mobile number." };
          if (!parsedPhone.ok) {
            badInp = editPhoneIn;
            badMsg = parsedPhone.error || "Enter a US or Canada mobile number.";
          } else if (emailVal && !(c && c.cleanEmail ? c.cleanEmail(emailVal) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal))) {
            badInp = editEmailIn;
            badMsg = "Enter a valid email address.";
          }
        }
        if (badMsg) {
          if (errNode) { errNode.textContent = badMsg; errNode.hidden = false; }
          if (badInp && badInp.classList) badInp.classList.add("admin-input-invalid");
          if (badInp && badInp.focus) badInp.focus();
          return;
        }
        withBusy(page, editSave, "Saving…", function () {
          return api.setMembers({
            groupId: activeGroupId,
            editPhoneHash: editingMemberHash,
            name: nameVal,
            phone: phoneVal,
            email: emailVal,
            isAdmin: !!(adminIn && adminIn.checked)
          }).then(function (res) {
            if (!res || res.ok === false) {
              if (errNode) {
                errNode.textContent = (res && res.error) || "Could not update member.";
                errNode.hidden = false;
              }
              return;
            }
            if (editModal) editModal.hidden = true;
            state = admin.reduce(state, { type: "clear" });
            paint();
            return refresh();
          });
        });
      });
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
    if (contactEmail) contactEmail.value = config.contactEmail || "";
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
    const settingsErr = doc.getElementById("jumpin-settings-error");
    const error = settingsErr || doc.getElementById("jumpin-error");
    function setSettingsErr(msg) {
      if (settingsErr) {
        settingsErr.textContent = msg || "";
        settingsErr.hidden = !msg;
      } else if (error) {
        error.textContent = msg || "";
      }
    }
    if (checked.error) {
      setSettingsErr(checked.error);
      return;
    }
    if (api && api.saveAdminConfig) {
      checked.value.supportNote = String(fields.supportNote || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
      checked.value.postRideThankYouSms = fields.postRideThankYouSms === true;
      checked.value.groupId = groupId || "default";
      return api.saveAdminConfig(checked.value).then(function (res) {
        if (!res || res.ok === false) {
          setSettingsErr((res && res.error) || "This page is not available.");
          return;
        }
        setSettingsErr("");
        applyConfig(doc, res.config || checked.value);
        const status = doc.getElementById("jumpin-admin-status");
        if (status) status.textContent = "Saved.";
        if (onSaved) onSaved();
      }).catch(function () {
        setSettingsErr("This page is not available.");
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
