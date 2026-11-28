# JumpIn Trust Signals Design: Car Info + Verified Trip Count

> **Goal:** Give riders, parents, and neighbors immediate confidence when choosing a ride and faster pickup identification, without adding logins, ID uploads, or extra clicks.

---

## 1. Data Model

### A. Car Info (`vehicle`)
- **Field Name:** `vehicle` (string, optional, max **40** chars, collapsed & HTML-tag-stripped via `core.collapse(core.stripTags(...)).slice(0, 40)`).
- **Where Stored:**
  - Private ride doc (`carpool_rides/{rideId}` / group-scoped path)
  - Public ride doc (`carpool_public/rides/{rideId}`) via `toPublicRide(ride)`
- **Client Persistence:** Saved in `localStorage` alongside the driver's last name/phone so returning drivers only type their car once (e.g. `"Silver Honda CR-V"`).
- **Editable:** Editable in **Edit Trip** (`editRide`). Note: changing `vehicle` alone is saved cleanly without requiring seat/time changes.

### B. Verified Driver Trip Count (`driverTripCount`)
- **Stats Doc Path:** `carpool_groups/{groupId}/driver_stats/{phoneHash}` (for default group: `carpool_driver_stats/{phoneHash}`), added to `paths(groupId)`.
  - Shape: `{ completedTrips: number, updatedAt: number }`
- **Anti-Gaming Invariant:**
  - `completedTrips` increments by `+1` **only** when a trip transitions from `open` → `completed` (via `completeTrip` or scheduled `completeDue`) **AND** has at least **1 active rider** (`activeRiders.length >= 1`).
  - Empty `0-rider` trips, cancelled trips, and rejected trips **never** increment `completedTrips`.
  - If `completeTrip` is called twice (idempotency), `ride.status === "completed"` already returns early before incrementing.
- **Zero-Extra-Read Board Display:**
  - When a driver posts a ride (`postRide`) or claims a "Need a Ride" request (`claimRideRequest`), the transaction reads `p.driverStats(phoneHash)` once and stamps `driverTripCount: stats.completedTrips || 0` onto the ride document (and onto `toPublicRide(ride)`).
  - The public board and Trip Details screens still load in **1 read** with zero N+1 queries.

---

## 2. UI / UX Design (Mobile & Desktop)

1. **Post a Ride ("I'm driving"):**
   - Inside the existing optional extras drawer (`+ Add car, price, or pickup note`), add an optional **`Car / Color (optional)`** input (`placeholder: e.g. Silver Honda CR-V`, `maxLength: 40`), pre-filled from `localStorage`.
2. **Claim a Request ("🚗 I can drive") & Edit Trip:**
   - Include the same optional **`Car / Color`** input (pre-filled from `localStorage` on Claim, or from `ride.vehicle` on Edit).
3. **Board Cards (`.card-foot`):**
   - Next to the driver's name, when `ride.driverTripCount > 0`, show a subtle verified pill:
     - `✓ 1 trip` / `✓ 8 trips` (`.trip-cnt-tag`).
   - Keep the card compact on both `320px–390px` mobile and desktop.
4. **Trip Details (`info-grid`):**
   - Show **`VEHICLE`** tile when `ride.vehicle` is set (e.g. `Silver Honda CR-V`).
   - Next to the Driver row (`secPeople`), show **`✓ 8 trips`** badge when `ride.driverTripCount > 0`.
