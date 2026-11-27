# JumpIn — "Need a Ride" (Rider Requests) Technical Design

**Status:** Proposed  
**Target Files:** `jumpin/core.js`, `jumpin/service.js`, `jumpin/handlers.js`, `jumpin/cloud.js`, `jumpin/ui-state.js`, `jumpin/app.js`, `jumpin-admin.html`, `jumpin-admin.js`, `functions/carpool.js`, `functions/jumpin/*`, `tests/jumpin/*`  
**Owner:** WaitLink / JumpIn Engineering

---

## 1. Overview & Goals

Currently, JumpIn only allows **drivers** to post trips (`Offer a ride`). Riders can reserve seats on existing trips or join a waitlist on full trips, but if no driver has posted a matching route, a rider cannot signal demand.

This design adds **"Need a Ride" (Rider Requests)** with a **Platform Admin Feature Flag (`needARideEnabled`)**:

- **Two-way marketplace without complexity:** Riders can post a ride request (`From` → `To`, `Date`, `Time`, `Seats needed`), and any driver can tap **`🚗 I can drive`** to claim it and convert it into a live trip.
- **Controlled rollout via Platform Admin:** Super-admin can toggle **`Need a Ride`** ON/OFF in real time from **Platform Settings → Features** (`#jumpin-plat-tab-features` in `jumpin-admin.html`).
- **Strict SMS cost control:** Zero neighborhood-wide SMS blasts when a rider posts a request. SMS is sent only for the rider's manage link (1 SMS) and when a driver claims the request (1 SMS to rider + 1 SMS to driver).
- **Zero regressions:** When `needARideEnabled` is `false` (or on existing driver-only flows), all UI, validation, and backend endpoints behave identically to today.

---

## 2. Platform Admin Feature Flag (`needARideEnabled`)

### 2.1 Storage & Propagation (`platformConfig/global`)
Reuse the existing `platformConfig` mechanism used by `platformEnabled` and `iosThemeEnabled`:

- **Default in `jumpin/service.js`:**
  ```js
  needARideEnabled: stored.needARideEnabled === true // defaults to false until enabled by Super Admin
  ```
- **`savePlatformConfig(db, email, input, now)` (`jumpin/service.js`):**
  - Accepts `body.needARideEnabled` (`boolean`).
  - Persists `needARideEnabled` to `platformConfig/global` and mirrors it in the `watchPlatformNotice` public payload (`jumpin/cloud.js`).
- **Real-Time Client Sync (`jumpin/app.js`):**
  - `platformNotice` (`{ platformEnabled, iosThemeEnabled, maintenanceMessage, needARideEnabled }`) updates via `cloud.watchPlatformNotice`.
  - When `platformNotice.needARideEnabled` is `false`:
    - Hide the `🙋 I need a ride` mode toggle on the Post screen and hide the `Need a driver` filter chip on the board.
    - Existing/past rider requests (if any) remain readable if opened directly, while new request creation is rejected server-side with `"Need a Ride is currently disabled."`.

### 2.2 Platform Admin UI (`jumpin-admin.html` & `jumpin-admin.js`)
- Inside `#jumpin-plat-tab-features` (alongside `iosThemeEnabled`):
  - Add toggle row: **Need a Ride (Rider Requests)** (`id="jumpin-plat-need-ride"`), with helper text: *"Allow riders to post ride requests when no matching driver trip exists."*
  - Load initial state via `setToggleState(fNeedRide, !!groupsData.platform.needARideEnabled)`.
  - Save via `api.savePlatformConfig({ iosThemeEnabled: getToggleState(fIos), needARideEnabled: getToggleState(fNeedRide) })`.

---

## 3. Mobile-First UX Specification

### 3.1 Post Screen Mode Switch (`jumpin/app.js`)
When `platformNotice.needARideEnabled === true`:
1. At the top of `state.mode === "post"`, render a 2-pill segmented switch:
   - **`🚗 I'm driving`** (default)
   - **`🙋 I need a ride`**
2. When **`🙋 I need a ride`** is selected:
   - Keep `From`, `To`, `Swap`, `Date` (60-day picker), `Time` (3-column wheel), `whenChips`, `Seats needed` (`1–4` pills), `Pickup note, optional`, `Your name`, and `Phone (US/Canada)`.
   - Hide driver-only fields (`Estimated duration`, `Ride cost`).
   - Primary bottom CTA updates to **`Post ride request`**.
3. On empty board / empty search state (when `needARideEnabled === true`), offer a secondary pill **`🙋 Request this ride`** that pre-fills `From`/`To` from the search query into Post mode with `postRole: "rider"`.

### 3.2 Rides Board & Filters (`jumpin/app.js`)
- **Board Card (`.row.role-rider`):**
  - Emerald green left accent (`#059669`) + status pill **`🙋 Needs a driver · N seat(s)`** (e.g., `🙋 Needs a driver · 2 seats`).
  - Footer shows requester's first name / initials (e.g., `Requested by Sam`).
- **Filter Chip:**
  - Show **`Need a driver`** chip in `.filter-row` when `needARideEnabled === true` (or when at least one `need-driver` card is visible).

### 3.3 Ride Detail & Driver Claim Flow (`🚗 I can drive`)
When viewing a ride with `ride.kind === "request"` (`status === "need_driver"`):
- **Public / Driver Visitor View:**
  - Shows route, date/time, seats needed, requester's first name, and pickup note.
  - Primary CTA: **`🚗 I can drive`**.
  - Tapping **`🚗 I can drive`** opens a native bottom sheet (`claimRequestSheet`) with:
    - `Your name` (prefilled from saved profile if present)
    - `Phone (US/Canada)` (prefilled from saved profile if present)
    - `Total seats in car` (`Seat pills`, minimum = `ride.seatsRequested`, max `6`)
    - `Pickup note, optional` (prefilled or editable)
    - `Confirm & Offer Ride` button.
- **Requester (Rider) View (via SMS manage link or localStorage secret):**
  - Shows `"Waiting for a driver"`, Share Link button (so they can share in WhatsApp/group chat), **Message / Note** (once claimed), and **✕ Cancel request** (with confirmation sheet).

---

## 4. Data Model & Lifecycle

### 4.1 `rides/{rideId}` Fields for Rider Requests
Reusing the `rides` collection keeps `watchBoard`, `openRide`, group isolation (`groupId`), and `carpoolRetainTrips` unified:

```js
{
  rideId: "ride_req_...",
  groupId: "default",
  kind: "request",               // "offer" (default/omitted for existing rides) | "request"
  status: "need_driver",         // "need_driver" -> "open" (once claimed) | "cancelled" | "expired"
  from: "Library",
  to: "Office",
  departAt: 1795790000000,
  timeZone: "America/New_York",
  seatsRequested: 2,             // 1..4
  seatsTotal: 2,                 // Updated to driver's car capacity upon claim
  seatsLeft: 0,                  // Updated to (driverSeats - seatsRequested) upon claim
  requesterName: "Sam",
  requesterPhoneEnc: "...",
  requesterPhoneHash: "<sha256>",
  requesterSecretHash: "<sha256>",
  driverName: "",                // Populated on claim
  driverPhoneEnc: "",            // Populated on claim
  driverPhoneHash: "",           // Populated on claim
  editSecretHash: "",            // Populated on claim for the driver
  riders: [],                    // Populated atomically on claim with requester's reservation
  createdAt: 1795738225685
}
```

### 4.2 Atomic Conversion on Driver Claim (`need_driver` → `open`)
Inside `db.runTransaction` when a driver claims a request:
1. Verify `ride.kind === "request"` and `ride.status === "need_driver"` and `ride.departAt > now`.
2. Verify driver phone is not blocked, is a group member (if `membersOnly`), and `driverPhoneHash !== ride.requesterPhoneHash` (cannot claim your own request).
3. Verify `driverSeats >= ride.seatsRequested` and `driverSeats <= 6`.
4. Atomically update `rides/{rideId}`:
   - `status: "open"`, `kind: "offer"` (or keep `claimedFromRequest: true` for analytics)
   - `driverName`, `driverPhoneEnc`, `driverPhoneHash`, `editSecretHash` (new driver secret)
   - `seatsTotal: driverSeats`, `seatsLeft: driverSeats - ride.seatsRequested`
   - `riders: [{ reservationId, name: ride.requesterName, phoneEnc: ride.requesterPhoneEnc, phoneHash: ride.requesterPhoneHash, secretHash: ride.requesterSecretHash, seats: ride.seatsRequested, createdAt: now }]`
5. **Post-claim behavior:** The trip is now a standard `open` ride! Any remaining `seatsLeft` can be reserved by other riders, and both the requester (with their original `requesterSecret`) and the driver (with their new `driverSecret`) can message each other or manage their seat/trip using the existing flows.

---

## 5. Backend Callables & Scheduled Behavior

### 5.1 New Callables (`functions/carpool.js` + `jumpin/handlers.js` + `jumpin/service.js`)
1. **`carpoolPostRideRequest`** (`guestCall`):
   - Checks `platformEnabled`, `platformNotice.needARideEnabled === true`, `group.status === "active"`, `membersOnly`, `blockedPhones`, and daily post/SMS cap.
   - Validates `from`, `to`, `date`, `time`, `seatsRequested` (`1..4`), `name`, `phone`.
   - Creates `rides/{rideId}` with `kind: "request"`, `status: "need_driver"`.
   - Sends **1 single-segment SMS** (`<= 160` chars) to the requester with their manage link.
2. **`carpoolClaimRideRequest`** (`guestCall`):
   - Checks `platformEnabled`, `group.status === "active"`, `membersOnly`, `blockedPhones`, and `need_driver` status inside `runTransaction`.
   - Converts the request to an `open` ride and confirms the requester's seat(s).
   - Sends **1 SMS to the requester** (`"JumpIn: Alex offered to drive Library -> Office at 8:00 AM! Manage: <url>"`) and **1 SMS to the driver** (`"JumpIn: You're driving Library -> Office (8:00 AM). Manage trip: <url>"`).
3. **`carpoolCancelRideRequest`** (`guestCall`):
   - Verifies `requesterSecretHash` and marks `status: "cancelled"` (0 SMS needed since no driver has claimed it yet).

### 5.2 Scheduled Cleanup (`carpoolCompleteTrips` / `carpoolRetainTrips`)
- In `carpoolCompleteTrips` (runs every 5 minutes):
  - Any `status === "need_driver"` request where `departAt <= now` is marked `status: "expired"` with **0 SMS** sent.
- In `carpoolRetainTrips` (runs every 24 hours):
  - Expired/cancelled requests are purged alongside completed/cancelled trips using the existing retention window.

---

## 6. Security, Anti-Spam & Edge Cases

| Edge Case | Mitigation |
| :--- | :--- |
| **Feature flag turned OFF mid-session** | `carpoolPostRideRequest` rejects server-side even if a stale client tab still displays the toggle. |
| **Two drivers tap `I can drive` simultaneously** | `runTransaction` checks `status === "need_driver"` atomically; the second driver gets `"This request was already claimed by another driver."`. |
| **Driver tries to claim own request** | Rejected (`driverPhoneHash === ride.requesterPhoneHash`) to prevent self-booking/SMS farming. |
| **Requester's phone privacy** | Requester's phone is never exposed to public visitors or claiming drivers; communication happens via masked SMS relay (`carpoolPostMessage`). |
| **SMS cost & segment limits** | All 3 new SMS templates (request posted, request claimed-rider, request claimed-driver) are enforced `<= 160` GSM-7 chars. |

---

## 7. Test & Coverage Plan (100% Gate)

1. **`tests/jumpin/test_jumpin.js`:**
   - `savePlatformConfig` toggling `needARideEnabled` `true` ↔ `false` (admin-only gate).
   - `carpoolPostRideRequest`: rejected when `needARideEnabled === false`, succeeds when `true`, enforces `1..4` seats and caps.
   - `carpoolClaimRideRequest`: atomic race between 2 drivers (exactly 1 wins), prevents self-claim, converts `seatsLeft = driverSeats - seatsRequested`, queues 1 rider SMS + 1 driver SMS (`<= 160` chars).
   - `carpoolCancelRideRequest` & scheduled expiry (`need_driver` past `departAt` -> `expired` with 0 SMS).
   - UI tests: `I'm driving` / `I need a ride` toggle hidden when flag is `false`, visible when `true`, `Need a driver` filter chip, and `claimRequestSheet`.
2. **`tests/jumpin/test_jumpin_integrity_and_races.js`:**
   - Concurrent `carpoolClaimRideRequest` race test, `jumpin/` ↔ `functions/jumpin/` mirror sync, and `jumpin-admin.html` / `jumpin-admin.js` toggle contract test.
