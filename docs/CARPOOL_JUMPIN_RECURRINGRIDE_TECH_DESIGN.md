# JumpIn — Recurring Rides Technical Design

**Status:** Ready for Implementation (Updated for v2026.11)  
**Target Files:** `jumpin/core.js`, `jumpin/service.js`, `jumpin/handlers.js`, `jumpin/cloud.js`, `jumpin/ui-state.js`, `jumpin/app.js`, `functions/index.js`, `functions/jumpin/*`, `firebase.json`, `tests/jumpin/*`  
**Owner:** WaitLink / JumpIn Engineering

---

## 1. Overview & Goals

Drivers who commute or run regular neighborhood/school carpools (e.g., Mon–Fri mornings, Tue/Thu practices) currently have to post each day individually. This design adds **Weekly Recurring Rides with Tap-to-Skip Days** while preserving JumpIn's core principles:

- **Zero clutter on one-off posts:** `Repeat` defaults to `One-time` and keeps the existing Post Ride form compact.
- **Tap-to-skip flexibility:** Drivers can preview every generated date and tap any specific date chip (e.g., a holiday or appointment day) to skip it before posting.
- **Independent ride lifecycle:** Each non-skipped occurrence is stored as a standard `rides/{rideId}` document linked by a shared `seriesId`, so riders reserve, waitlist, message, or cancel *per day*, and drivers can edit or cancel *one* day without breaking the rest of the series.
- **Strict SMS cost control:** Posting a recurring series sends **1 single-segment SMS** to the driver (never $N$ separate confirmation texts).
- **Zero regressions:** Existing `carpoolPostRide`, `carpoolEditRide`, `carpoolCancelTrip`, `carpoolCompleteTrips`, `carpoolRetainTrips`, and all 26 JumpIn tests + 11 master suites remain 100% compatible.
- **Mobile-first & Desktop-compatible UI:** Touch-friendly `40px+` pill targets on all phone sizes (`320px+` iOS/Android, zero horizontal overflow) and clean layout inside the `640px` desktop `.post-card`.

### Non-Goals (Phase 1)
- Complex RRULE patterns (bi-weekly, monthly-by-nth-weekday, custom intervals).
- Bulk-editing all future rides in a series at once (drivers edit individual rides; series-wide **Cancel upcoming** is supported).
- Recurring mode inside **Post return trip** (`returnTripSheet` stays 1-day-at-a-time carrying `vehicle`, `rideCost`, and `note` so the mobile modal stays compact and uncluttered).
- Infinite/open-ended recurring series (capped to `config.horizonDays` and max `6` weeks / `18` rides).

---

## 2. Mobile-First UX Specification

### 2.1 Post a Ride Form (`jumpin/app.js`)
Inside `secSched` (Schedule section), directly below the `whenChips` (`Today`, `Tomorrow`, `In 30m`, `In 1h`, `In 2h`) row:

1. **Repeat Selector (Always visible, 1 compact row):**
   - Label: `Repeat`
   - Segmented pills (matching `seat-pills` style):
     - **`One-time`** (default active)
     - **`Weekly`**

2. **Recurring Panel (Visible only when `Weekly` is selected):**
   - **Days of week (`repeat-days`):** 7-column CSS grid (`grid-template-columns: repeat(7, minmax(0, 1fr))`, `gap: 6px`) with `min-height: 40px` pill buttons:
     `S` `M` `T` `W` `T` `F` `S` (with full `aria-label` weekday names) on `< 420px` and `Sun`–`Sat` on wider screens so it never overflows `320px` phones.
     - Pre-selects the weekday of the currently chosen `Date`.
     - If the driver changes the start `Date` while `Weekly` is active, automatically ensure that start date's weekday is selected (unless manually deselected).
   - **Duration (`repeat-weeks`):** Compact pill row (`flex-wrap: wrap`):
     - `2 wks` (default when `Weekly` is tapped)
     - `4 wks`
     - `6 wks` (hard cap: **6 weeks**, max **18 rides** per submission, and dates beyond `config.horizonDays` are automatically excluded so group horizon settings are always respected).
   - **Preview & Tap-to-Skip Chips (`repeat-preview`):**
     - Responsive wrapping flex/grid of tappable chips (`min-height: 36px`, `min-width: 0`).
     - Dynamically generated list of dates matching `(startDate, selectedWeekdays, weeks, horizonDays)` at the chosen `time` in `timeZone`.
     - Each date renders as a tappable chip:
       - **Included (default):** `✓ Mon, Nov 30` (cyan tint border)
       - **Skipped (tapped):** `✕ Wed, Dec 2` (muted, strikethrough text)
     - Summary line underneath: `"Posting 8 rides · Tap any day to skip"` (updates live as chips are toggled).
     - If all dates are skipped (`activeDates.length === 0`), show inline validation error `"Keep at least 1 ride date."` and prevent submission.

3. **Board Card Indicator (`jumpin/app.js`):**
   - Rides with `ride.seriesId` display a subtle `🔁` prefix or tiny pill tag in card metadata (e.g., `🔁 Weekly`) without wrapping or adding card height.

4. **Posted Confirmation Screen (`state.mode === "posted"`):**
   - Displays the route, time, `"8 rides posted"` (or `"8 rides waiting for approval"`), the list of posted dates, and a **Copy Share Link** for the first upcoming ride (plus links saved automatically in `localStorage` via `cloud.saveTrip` for **every** created `rideId`, so the driver immediately owns all of them on their device).

5. **Manage Trip Sheet (`manageTripSheet`):**
   - For rides with `ride.seriesId`, keeps existing **✏️ Edit trip**, **↩️ Post return trip**, and **✕ Cancel trip** (this day only), and optionally adds **✕ Cancel all upcoming in series** (with a clear confirmation sheet showing how many upcoming rides and riders will be affected).

---

## 3. Data Model & Group-Scoped Firestore Schema (`pathsFor(gid)`)

All recurring documents use the existing `pathsFor(gid)` helper in `jumpin/service.js` (`p.ridePrivate(id)`, `p.ridePublic(id)`, `p.series(seriesId)` -> `carpool_private/series/{seriesId}` for `"default"` or `carpool_groups/{g}/series/{seriesId}` for named groups), and register every ride in `p.broadcastIndex` via `rememberRide`.

### 3.1 `p.ridePrivate(rideId)` & `p.ridePublic(rideId)` Additions (Additive & Optional)
Existing fields remain unchanged (including `vehicle` and `driverTripCount`). Recurring rides add:

```js
{
  // ...all existing ride fields (groupId, from, to, departAt, timeZone, seatsTotal, seatsLeft, status, driverName, driverPhoneHash, editSecretHash, etc.)
  seriesId: "ser_9xK2mP...",     // Shared across all occurrences in the same post
  seriesIndex: 1,                // 1-based index within posted occurrences (1..N)
  seriesTotal: 8,                // Total non-skipped rides created in the series
  seriesDays: [1, 2, 3, 4, 5],   // Weekday numbers (0=Sun..6=Sat) for UI badge/context
}
```

### 3.2 `carpoolSeries/{seriesId}` (Lightweight Series Metadata)
Optional summary doc for series-wide lookup/cancel and audit:

```js
{
  seriesId: "ser_9xK2mP...",
  groupId: "default",
  driverPhoneHash: "<sha256>",
  editSecretHash: "<sha256>",    // Same secret hash as the member rides so 1 link/secret can manage series
  rideIds: ["ride_a", "ride_b", ...],
  from: "Library",
  to: "Office",
  time: "08:00",
  timeZone: "America/New_York",
  createdAt: 1795738225685,
  status: "active"               // "active" | "cancelled"
}
```

> **Why store each day as a normal `rides/{rideId}` doc?**
> - Zero changes needed to `watchBoard`, search, filters, `reserveSeat`, `updateSeat`, `cancelSeat`, `joinWaitlist`, `editRide`, `completeTrip`, `carpoolCompleteTrips`, or `carpoolRetainTrips`.
> - Atomic per-day seat transactions (`runTransaction`) work identically with zero hot-document contention across different days.

---

## 4. Pure Date Generation & Validation (`jumpin/core.js`)

Add pure, deterministic functions (mirrored in `functions/jumpin/core.js`):

```js
const MAX_RECURRING_WEEKS = 6;
const MAX_RECURRING_RIDES = 18;
```

### 4.1 `buildRecurringDates(params)`
- **Inputs:**
  - `startDate` (`"YYYY-MM-DD"`), `time` (`"HH:MM"`), `timeZone` (IANA string)
  - `weekdays` (`number[]`, values `0..6`)
  - `weeks` (`number`, clamped `1..6`)
  - `skipDates` (`string[]` of `"YYYY-MM-DD"`, optional)
  - `nowMs` (`number`, injected for deterministic tests)
- **Algorithm:**
  1. Validate `startDate`, `time`, `timeZone`, and `weekdays.length >= 1`.
  2. Iterate day offset `d = 0` to `weeks * 7 - 1`:
     - Compute `ymd` by calendar-day addition from `startDate` (pure `Date.UTC(y, m - 1, day + d)` -> `YYYY-MM-DD`, avoiding local host TZ drift).
     - Compute weekday (`0..6`) of `ymd`.
     - If `weekdays` includes that weekday:
       - Convert `(ymd, time, timeZone)` to `departAt` via `core.wallTimeToUtc(ymd, time, timeZone)` (automatically handles DST spring-forward/fall-back per date!).
       - Skip automatically if `departAt < nowMs + 30 * 60000` (e.g., today's time already passed or < 30 min away).
       - Mark `skipped: skipSet.has(ymd)`.
       - Append `{ date: ymd, departAt, weekday, skipped }`.
  3. Enforce `included.length >= 1` and `included.length <= MAX_RECURRING_RIDES` (`18`).
- **Return:** `{ dates: [...], included: [...], error?: string }`

---

## 5. Backend Service & Cloud Functions (`jumpin/service.js`, `jumpin/handlers.js`, `functions/carpool.js`)

### 5.1 New Callable: `carpoolPostRecurringRides`
Keeping `carpoolPostRide` separate for single trips avoids touching the existing single-ride fast path.

- **Export & Routing:** Export `carpoolPostRecurringRides` (and `carpoolCancelSeries`) in `functions/index.js`, and add `/api/carpoolPostRecurringRides` (and `/api/carpoolCancelSeries`) rewrites in `firebase.json`.
- **Handler:** `if (name === "carpoolPostRecurringRides") return service.postRecurringRides(db, body, now, rng);` in `jumpin/handlers.js`.
- **Validation & Guards (reusing existing `service.js` helpers):**
  1. Platform enabled (`platformEnabled`) & group active (`group.status === "active"`).
  2. `core.postErrors(input)` (including `vehicle` and `rideCost`) + `core.buildRecurringDates(..., config.horizonDays)`.
  3. Idempotency check (`idempotencyKey`): if a series with the same `idempotencyKey` was already created within `IDEMPOTENCY_MS`, return `{ ok: true, already: true, seriesId, rideIds, secret }` without creating duplicates.
  4. Blocklist check (`blockedPhones`) & Members-Only check (`requireGroupMember`).
  5. Anti-spam / quota check:
     - Check daily ride post cap (`maxPostsPerPhonePerDay`).
     - A recurring series counts as **1 series post action** against SMS cap (1 SMS sent) and enforces `included.length <= MAX_RECURRING_RIDES` (18) and `config.horizonDays`.
  6. **Trust Signals:** Stamp `vehicle: fields.vehicle || ""` and `driverTripCount: Number(phone.completedTrips) || 0` on every ride in the series; each day that later completes with 1+ active riders increments `completedTrips`.
- **Atomic Persistence (`db.runTransaction` / batch):**
  - Generate `seriesId = core.randomId("ser_")` and one shared `secret = core.randomSecret()` (or per-ride secrets + shared `seriesSecret` — **single shared `secret` stored as `editSecretHash` on all member rides + `carpoolSeries/{seriesId}`** is cleanest because 1 URL/secret works everywhere!).
  - Create each `rides/{rideId}` with `status = group.requireApproval ? "pending" : "open"`, `seriesId`, `seriesIndex`, `seriesTotal`, `editSecretHash`.
  - Create `carpoolSeries/{seriesId}` summary doc.
- **Single-Segment SMS Notification (Cost Control):**
  - **Driver SMS (1 text total, `<= 160` GSM-7 chars):**
    - Open: `"JumpIn: Posted 8 rides (Library -> Office, 8:00 AM). Manage: https://waitlink.app/j/..."`
    - Pending: `"JumpIn: 8 rides submitted for approval (Library -> Office). You'll get a text once approved."`
  - **Admin SMS (if `requireApproval`):** **1 single text** to group admins summarizing `"8 recurring rides pending approval..."` instead of 8 texts.

### 5.2 Optional Series Cancel: `carpoolCancelSeries`
- **Inputs:** `{ seriesId, secret }`
- **Behavior:**
  1. Verify `carpoolSeries/{seriesId}` exists and `sha256Hex(secret) === series.editSecretHash`.
  2. Query/load upcoming `rides` in `seriesId` where `status` is `"open"` or `"pending"` and `departAt > now`.
  3. Mark each upcoming ride `status = "cancelled"`, `cancelledAt = now`.
  4. Send SMS only to active riders who actually had reservations on any cancelled upcoming rides (deduplicated per rider phone if a rider booked multiple days in the series, saving SMS!).

---

## 6. Frontend State & Client Integration

- **`jumpin/ui-state.js`:**
  - `state.draft` supports optional `{ repeat: "once" | "weekly", weekdays: [...], weeks: 2, skipDates: [...] }`.
  - `posted` mode supports `state.seriesCount` and `state.seriesDates` to render the multi-date summary cleanly.
- **`jumpin/cloud.js`:**
  - Add `postRecurringRides(fields)` calling `carpoolPostRecurringRides`.
  - On `ok: true`, loop `result.rideIds` and call `saveTrip(id, result.secret)` for each `rideId` so all created trips are immediately recognized as `role: "driver"` on the user's device.
  - Add `cancelSeries(seriesId, secret)` (if series cancel is enabled).
- **`jumpin/app.js`:**
  - Add Repeat toggle (`One-time` / `Weekly`), Weekday pills, Weeks pills (`2 wks` / `4 wks` / `6 wks`), and Tap-to-Skip date chips inside `secSched` on the Post screen.
  - Add `🔁` indicator on board cards when `ride.seriesId` is present.
  - Keep all existing inputs (`date`, `time`, `seats`, `durationMinutes`, `note`) 100% compatible.

---

## 7. Edge Cases & Mitigations

| Edge Case | Mitigation |
| :--- | :--- |
| **DST change mid-series** | `core.wallTimeToUtc(ymd, time, timeZone)` runs per individual `ymd`, keeping wall-clock time (e.g. `8:00 AM`) consistent across DST transitions. |
| **Today's time already < 30 min away** | `buildRecurringDates` filters out Day 0 if `departAt < nowMs + 30 * 60000`, while keeping future occurrences. |
| **Driver skips every generated date** | Client & server reject with `"Keep at least 1 ride date."` before writing or sending SMS. |
| **Duplicate tap on Post button** | `state.busy` disables the submit button immediately (`"Posting…"`). |
| **Driver edits 1 day in a series** | `carpoolEditRide` edits only that `rideId`; other days in `seriesId` remain untouched. |
| **Hosted / Cloud Functions mirror sync** | Update both `jumpin/core.js`, `jumpin/service.js`, `jumpin/handlers.js` AND `functions/jumpin/*` identically (verified by existing sync test). |

---

## 8. Test & Coverage Plan (100% Gate)

To maintain WaitLink's `c8` gate (`100%` lines/functions/statements, `>=95%` branches) and `11/11` master suite pass:

1. **`tests/jumpin/test_jumpin.js`:**
   - `core.buildRecurringDates`: weekday filtering, `skipDates` exclusion, DST wall-time preservation, `< 30 min` Day-0 filtering, `MAX_RECURRING_WEEKS` / `MAX_RECURRING_RIDES` bounds, and all-skipped error.
   - `service.postRecurringRides` & `handlers.call("carpoolPostRecurringRides", ...)`: creates $N$ rides with shared `seriesId`, sends **exactly 1** driver SMS (`<= 160` chars), respects `requireApproval` + `membersOnly` + blocklist + caps.
   - UI tests in `mounted`: toggling `One-time` ↔ `Weekly`, toggling weekday pills, tapping date chips to skip/unskip, all-skipped error, and submitting `postRecurringRides` (success + error + reject).
2. **`tests/jumpin/test_jumpin_integrity_and_races.js`:**
   - Verify `jumpin/` and `functions/jumpin/` mirror sync, `functions/carpool.js` export `carpoolPostRecurringRides`, and SMS character-length budget (`<= 160` chars).
