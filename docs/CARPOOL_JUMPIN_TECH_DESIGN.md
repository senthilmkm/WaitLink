# WaitLink JumpIn — Carpool Technical Design Specification

**Document Version:** 1.13.0
**Status:** Design only. Not implemented.
**Location:** `c:\Workspaces\WaitLink\docs\CARPOOL_JUMPIN_TECH_DESIGN.md`
**Target Environment:** Firebase Hosting, Cloud Firestore, Cloud Functions (`waitlink-app-8821`)
**Target Audience:** Engineering
**Product Name:** JumpIn
**Financial Invariant:** No fares, no wallets, no Stripe, and no charge to a shop SMS quota.

---

## 1. Purpose

JumpIn is a ride board on the WaitLink host. A driver posts one trip. A rider reserves one seat. The people on that trip can message each other. Nobody pays anyone inside the product. The primary screen is a phone browser. The page is one column, with one main button, and the same page is what a laptop shows.

The shop product stays untouched. Desk, public wait, poster, owner, and kiosk views keep their current URLs and data. JumpIn is a separate route, a separate pair of Firestore trees, and a separate set of Cloud Functions.

This document is the contract for that feature. The flows in sections 6 and 7 are the product. The edge cases in section 12 are required behavior, not ideas.

---

## 2. Rules that do not change

1. A person may browse the board and open a ride with no name and no phone number.
2. A name and a phone number are collected at the moment of posting a ride or reserving a seat.
3. There is no email, no password, and no WaitLink shop account for a driver or a rider.
4. The phone number is the stable identity of a person. It is used to send texts. It is never shown on a public page.
5. Each reserved seat has its own reservation id. The cancel control for that seat requires a secret that was issued to the browser that reserved it and copied into a text to that phone.
6. Opening a public ride link never cancels a seat and never cancels a trip.
7. A rider can release only their own seat.
8. A driver can cancel only their own trip, which releases every seat on it.
9. A message can be written only by the driver of that trip or by a rider with an active seat, and only with the same secret used to cancel.
10. The public ride page shows trip facts, seat count, first names, and messages that were already sent. The write box and the cancel controls are not available from the public link alone.
11. Places are plain text. There is no map, no live location, and no fare field.
12. `https://waitlink.app/jumpin` is not a JumpIn URL. The app reads the board only from the `s` parameter.
13. Every JumpIn screen is built for a phone browser first. Safari on iPhone and Chrome on Android are the surfaces that must work. There is no app to install.
14. Each screen has one job and one primary button. The layout is a single column of plain text and full-width controls. A wider window uses that same column. It does not gain a sidebar, a table, or a second layout.
15. In a phone browser the page behaves like an app screen: a fixed top bar, a scrolling middle, and the one filled button fixed at the bottom under the thumb. People stay in Safari or Chrome. No App Store install is required.
16. Existing WaitLink pages, UI, UX flows, features, and functions stay as they are. JumpIn is added beside them. No existing screen gains a button, a link, a card, or a copy change. No existing Cloud Function’s behavior changes.

---

## 3. Why this is not a shop

WaitLink today loads `?s={slug}` as a shop. Shop documents are publicly readable. Client writes to `/messages` are limited to a signed-in shop owner, staff, or SuperAdmin. A guest browser cannot legally create those SMS documents, and it must not be given that power.

JumpIn therefore does not use `/shops/jumpin`.

| Concern | Shop queue | JumpIn |
| :--- | :--- | :--- |
| URL | `?s={shopSlug}` | `?s=jumpin` only |
| Who may write | Owner, staff, SuperAdmin | Cloud Functions with the Admin SDK |
| SMS billing | Shop quota and top-up wallet | Platform daily cap in `/settings/carpool_config` |
| Public document | Wait count, no customer phone | Trip card, no phone, no secret |
| Secret | Ticket secret stays off the public ticket | Cancel secret stored only as a hash |

`jumpin` is reserved in `/slug_registry/jumpin` before the feature is enabled, with `ownerUid: "platform"`. Shop creation rejects that slug. If a shop document with id `jumpin` already exists at build time, the feature does not ship until that shop is renamed.

On boot, `app.js` checks the `s` parameter before any shop fetch. When the value is `jumpin`, the shop loader does not run. Views `desk`, `owner`, `public`, `poster`, `kiosk`, and `superadmin` on that slug are ignored and the board is shown instead. When `s` is anything else, including an empty value, startup continues with the current shop code and the current screens.

JumpIn is not linked from the guest homepage, the desk, the owner portal, or the SuperAdmin portal. Those screens stay as they are. People open JumpIn at `https://waitlink.app?s=jumpin`.

---

## 4. URLs

Production origin: `https://waitlink.app`.

| Page | URL | Who it is for |
| :--- | :--- | :--- |
| Board (home) | `https://waitlink.app?s=jumpin` | Everyone |
| Board, explicit | `https://waitlink.app?s=jumpin&view=rides` | Same page as home |
| Public ride | `https://waitlink.app?s=jumpin&view=ride&ride={rideId}` | Everyone. This is the link the driver texts to the group. |
| Rider manage | `https://waitlink.app?s=jumpin&view=seat&r={reservationId}&k={secret}` | The phone number on that reservation |
| Driver manage | `https://waitlink.app?s=jumpin&view=trip&ride={rideId}&k={secret}` | The phone number that posted the trip |

`rideId` and `reservationId` are random ids (`ride_` + 12 url-safe chars, `rsv_` + 12 url-safe chars). They are not derived from the clock time. Two Tuesday 8:00 AM trips have different ids. The page displays “Tue 8:00 AM” from the stored departure instant.

The `k` value is a bearer secret. It is 32 cryptographically random bytes, encoded url-safe base64. The server stores only `SHA-256(secret)`.

Opening a manage URL does not cancel anything. The page shows the trip and a button. Cancel is a separate function call.

After the manage page has read `k` and stored it in `localStorage`, the client removes `k` from the address bar with `history.replaceState`. The text message remains the copy of the secret. A bookmark made after the strip does not contain the secret.

---

## 5. Screens

On a phone, JumpIn fills the browser window the way an iOS or Android app screen does. The person is still in Safari, Chrome, or the browser that opened the text. A laptop shows the same column, centered. Nothing in this section depends on hover, a wide viewport, or an installed app.

The production WaitLink manifest stays the shop manifest. `manifest.json` name, `start_url`, icons, and shortcuts are not changed. JumpIn does not replace the installed shop icon.

### 5.0 App shell in the phone browser

These rules apply to the board, the post form, the public ride, and both manage pages.

The shell has three parts:

1. **Top bar.** Fixed to the top of the visual viewport. Height 56px plus `env(safe-area-inset-top)`. Title “JumpIn”, centered. On every screen except the board, a **Back** control on the left, at least 44px. The bar background is the page background, so content scrolls under it and does not show through.
2. **Middle.** The only scrolling region. One column, 16px side padding, content width capped at 420px. `-webkit-overflow-scrolling: touch`.
3. **Bottom bar.** Fixed to the bottom of the visual viewport. It holds the one filled button, full width, 52px tall. Padding below the button is `env(safe-area-inset-bottom)` plus 12px, so the button sits above the iPhone home indicator.

The shell height is `window.visualViewport.height`, updated when the viewport resizes or scrolls. That keeps the bottom button above the Safari or Chrome toolbar and above the keyboard. The page does not use a locked `100vh` frame, which would hide the button behind the iOS toolbar.

| Rule | Requirement |
| :--- | :--- |
| Viewport | `width=device-width, initial-scale=1, viewport-fit=cover`. No horizontal scroll at 320px wide. `maximum-scale` is left unset so the phone’s larger-text setting still works. |
| Theme | While `s=jumpin`, `theme-color` and `apple-mobile-web-app-status-bar-style` match the page background (`#090d16`) so the status bar blends into the top bar. Shop pages keep their current theme color. |
| Type | On iPhone and iPad, the system UI font. On Android, Roboto. Body at least 16px. The trip route is the largest text. Inputs are at least 16px so iOS Safari does not zoom on focus. |
| Rows | A trip row is a full-width cell with 16px vertical padding and a hairline divider. The whole cell is the tap target. |
| Tap targets | Every button and text action is at least 44px tall. The filled button is 52px. |
| One primary button | That button lives in the bottom bar. Every other action is a text button in the scrolling middle. |
| Press | iOS darkens or fades the control on touch. Android shows a ripple. Nothing depends on hover. |
| Color | Page background `#090d16`, text `#f8fafc`, accent `#06b6d4` for the filled button. These match the live WaitLink theme. Status is a sentence (“Full”, “This trip was cancelled.”). |
| Controls | Native controls only: `input type="text"`, `type="tel"`, `type="date"`, `type="time"`, and a `select` for seats 1–6. Labels sit above the fields. Placeholders are examples, not the only label. Date, time, and seats open the phone’s own picker, so an iPhone gets the iOS picker and an Android phone gets the Android calendar, clock, and menu. |
| Keyboard | The phone field opens the phone keypad. On focus, the field scrolls into the middle region above the keyboard. The bottom bar moves with `visualViewport` so the filled button stays visible above the keyboard. |
| Overscroll | The shell uses `overscroll-behavior: none` so a pull at the top does not reload the page. The middle region still scrolls. |
| Callouts | Text can be selected in the message list and in the copy-link box. Buttons use `-webkit-user-select: none` and `-webkit-touch-callout: none` so a tap does not open a selection menu. |
| Motion | iOS moves to the next screen with a 200ms slide. Android uses a 150ms fade. `prefers-reduced-motion: reduce` turns both off. A submit button shows “Sending…” and stays disabled until the call returns. |
| Dialogs | The page never calls `alert`, `confirm`, or `prompt`. Those are browser dialogs. Confirmations use the sheet or dialog in section 5.0.1. |
| Links from a text | Messages, Chrome, and an in-app browser (a chat app’s built-in browser) render this same shell. Cancel still requires a tap. |
| Copy | **Copy link** uses the clipboard API. If the browser refuses, the URL is shown in a selectable field the person can press and hold. |
| Shop chrome | When `s=jumpin`, the shop header, desk nav, marketing hero, and footer are not shown. |

The screen does not include a map, photos, avatars, stars, a search box, filters, tabs, a drawer, or a bottom navigation bar. The board is the list. A ride row opens the trip. **Back** in the top bar returns to the board.

Which phone set to use: iPhone and iPad use the iOS column. Android uses the Android column. Any other browser, including a laptop, uses the iOS column inside the same centered layout.

### 5.0.1 Every driver and rider tap

| What the person does | iPhone and iPad | Android |
| :--- | :--- | :--- |
| Tap a ride on the board | The row fades while the finger is down. The ride screen slides in from the right. | The row shows a ripple. The ride screen fades in. |
| Tap **Back** | A chevron labeled **Back**. The screen slides back to the right. | An arrow labeled **Back**. The screen fades back to the board. |
| Tap **Date** | The iOS date picker. | The Android calendar. |
| Tap **Time** | The iOS time picker. | The Android clock. |
| Tap **Seats** | The iOS picker wheel, values 1 through 6. | The Android dropdown, values 1 through 6. |
| Tap the phone field | The number keypad. | The phone keypad. |
| Tap **Post**, **Reserve a seat**, **Send**, **Copy link**, or **Text me a link** | The bottom button, corner radius 14px, fades while pressed. | The bottom button, corner radius 20px, shows a ripple. |
| Tap **Cancel** on a seat | A sheet rises from the bottom: “Cancel your seat?” Then **Cancel seat** in red, and **Keep seat**. The seat stays until **Cancel seat**. | A dialog in the center with the same words. **Cancel seat** is the destructive action. **Keep seat** closes the dialog. The seat stays until **Cancel seat**. |
| Tap **Cancel trip** | A sheet from the bottom: “Cancel this trip?” Then **Cancel trip** in red, and **Keep trip**. The trip stays until **Cancel trip**. | A dialog: “Cancel this trip?” **Cancel trip** and **Keep trip**. The trip stays until **Cancel trip**. |
| **Copy link** succeeds | The bottom button reads **Copied** for 2 seconds, then **Copy link** again. | A short bar just above the bottom button reads “Link copied” for 2 seconds. |
| A field is invalid | One sentence under that field. The form stays filled in. | The same sentence under that field. |
| The action is in progress | The bottom button reads **Sending…** and ignores more taps. | The same. |

**Post a ride**, **Reserve a seat**, **Send**, and **Text me a link** run on the first tap of the bottom button. Only **Cancel** and **Cancel trip** ask for the second tap, because those release a seat or the whole trip.

---

### 5.1 Board

Lists trips with `status = open` and `departAt` in the future, soonest first, up to 50.

The top bar title is “JumpIn”. The bottom bar button is **Post a ride**.

Each trip is one full-width row in the scrolling middle, stacked:

```
Library → Office
Tue 8:00 AM ET
2 seats left
```

The whole row is the tap target and opens the public ride. A full trip stays on the board with `0 seats left`. A cancelled trip and a departed trip do not.

Empty state, in the middle: “No rides yet. Post one.” The bottom bar still shows **Post a ride**.

### 5.2 Post a ride

A single form. One field per row, in this order: your name, your phone, from, to, date, time, seats, note. Note is labeled “Note, optional”.

Phone uses `type="tel"` and `autocomplete="tel"`. Date and time use the phone’s native pickers.

**Back** is in the top bar. **Post** is the bottom bar button and stays visible while the form scrolls.

Success depends on `requireRideApproval` in section 5.6.

When that switch is off, the form is replaced by “Trip posted.”, the public ride URL in a selectable box, and a filled **Copy link** button. Under that, a text button **Cancel trip** when this browser holds the driver secret.

When that switch is on, the form is replaced by “Waiting for approval.” The public URL is not shown yet, so the driver cannot share a trip that is still hidden. **Cancel trip** is the text button. When a SuperAdmin approves the trip, this page updates on its own to the posted state and shows **Copy link**.

### 5.3 Public ride

One card, stacked, in this order:

1. Route, the largest text: `Library → Office`.
2. `Tue 8:00 AM ET`.
3. `2 seats left`.
4. The note, if it is not empty.
5. `Driver: Alex`.
6. Rider first names, one per line. When this browser holds that rider’s secret, the line includes a text button **Cancel**.
7. The message list, oldest first. Each line is the name and the text.
8. One filled button, chosen from the table below.

| Who is on the page | Filled button | Text buttons under the card |
| :--- | :--- | :--- |
| Trip is `pending` | None. The card says “Waiting for approval.” | **Cancel trip** only when this browser holds the driver secret |
| Trip is `rejected` | None. The card says “This trip was not approved.” | None |
| No secret, a seat is open | **Reserve a seat** | **Cancel my seat**, **Cancel my trip** |
| No secret, the trip is full | None. The card says “Full”. | **Cancel my seat**, **Cancel my trip** |
| This browser holds a rider secret | **Send** | **Cancel** on that rider’s line |
| This browser holds the driver secret, trip is `open` | **Copy link** | **Send** beside the message field, **Cancel trip** |

**Reserve a seat** keeps the name and phone fields hidden until the tap. The tap shows those two fields, and the filled button submits them.

**Cancel my seat** and **Cancel my trip** each open one phone field. While that field is open, the filled button is **Text me a link** and the other filled action is hidden, so the screen still has one filled button.

The message field is on the page only when this browser holds a rider or driver secret. A visitor with only the public link does not get a composer.

### 5.4 Rider manage and driver manage

The same card and the same filled-button table as section 5.3. The manage link only proves the secret. It does not add a second layout.

Phones are not rendered on either manage page. A forwarded manage link must not reveal a list of phone numbers.

### 5.5 Forget this browser

Where a local secret is present, show **Forget this browser** as a text button at the bottom of the card. It deletes the local secret only. It does not cancel the seat and does not cancel the trip. This is the control for a shared computer. It is never the filled button.

### 5.6 SuperAdmin JumpIn page

The page is a new file, `jumpin-admin.html`, at `https://waitlink.app/jumpin-admin.html`. It is not inserted into `#superadmin-view` and it is not linked from any existing page. A shop owner, a driver, and a rider never see it. `isSuperAdmin()` is required to open it and to save it. Anyone else sees “This page is not available.”

The page title is “JumpIn”. It shows one read-only line, “Texts sent today: {dailySmsSent}”, and the fields in the table below. **Save JumpIn settings** writes only those fields onto `/settings/carpool_config`. The save does not change `dailySmsSent` or `dailySmsDay`. There is no button that zeroes the day’s text count. Raising **Daily text cap** is how a SuperAdmin lets more texts through before the next UTC day.

| Field on the card | Config field | Allowed value | What it changes |
| :--- | :--- | :--- | :--- |
| JumpIn is open | `enabled` | On or off | Off: every carpool function rejects and the board says “JumpIn is not open yet.” On: the board accepts posts and reserves. |
| Review rides before they show | `requireRideApproval` | Yes or no. Default no. | Yes: a new trip stays hidden until a SuperAdmin approves it once. No: a new trip shows on the board as soon as it is posted. |
| Daily text cap | `dailySmsCap` | Integer 0–5000 | Platform texts allowed on the current UTC day. |
| Seats on a new trip | `maxSeats` | Integer 1–6 | Upper choice on the post form for trips posted after the save. Trips already posted keep their seat count. |
| Days ahead a trip may be posted | `horizonDays` | Integer 1–60 | How far in the future a new departure may be. |
| Messages on a trip | `maxMessagesPerRide` | Integer 1–20 | Cap for a new message. Existing messages stay. |
| Trips one phone may post today | `maxPostsPerPhonePerDay` | Integer 1–50 | Count in `/carpool_private/phones`. |
| Upcoming seats one phone may hold | `maxActiveReservationsPerPhone` | Integer 1–20 | Count in `/carpool_private/phones`. |
| Manage texts per seat or trip | `maxSmsPerRecord` | Integer 1–10 | Original manage text plus replacements. The trip-cancelled text is not part of this count. |
| Seconds between replacement texts | `resendCooldownSec` | Integer 30–600 | Recovery cooldown. |

A value outside the allowed range is not written. The field shows “Enter a number from {min} to {max}.”

Under the settings, the card lists trips whose status is `pending`, oldest first. Each row shows from, to, local departure, seats, driver name, and the note. It does not show a phone number or a secret. Each row has **Approve** and **Decline**.

**Approve** sets that trip to `open`. It then appears on the JumpIn board. The driver is texted once that it is on the board, with the public ride link. **Decline** sets it to `rejected`. It never appears on the board. The driver is texted once that it was not approved. A second tap on a trip that is already `open` or `rejected` does nothing.

Turning the switch to no does not publish trips that are already waiting. Those stay in this list until **Approve** or **Decline**. Turning the switch to yes leaves trips that are already on the board alone. Only trips posted after the save wait for review.

The card does not show a full phone number or a secret. It cannot edit a shop. It cannot release one rider’s seat. It can cancel a whole trip, stop a driver from posting another ride, text one trip, text everyone on upcoming trips, and announce to every driver and rider.

### 5.6.1 Trips the SuperAdmin can act on

Below the waiting list, the card lists upcoming trips (`open` and still in the future), soonest first. Each row shows from, to, local departure, seats left, driver name, driver phone last 4 digits, and the note.

| Action | What it does |
| :--- | :--- |
| **Cancel trip** | Asks “Cancel this trip?” A second tap confirms. The trip becomes `cancelled`, every active seat is released, and the driver and each active rider get one text. This works for a `pending` trip and an `open` trip. |
| **Block posting** | Asks “Stop this driver from posting?” A second tap confirms. That driver phone cannot post another ride. Rides they already posted stay up until someone cancels them. They can still reserve a seat as a rider. |
| **Text this trip** | A box of 1–280 characters. Recipients are that trip’s driver and each rider who still has a seat. Each phone once. The card shows the count, then **Send text**. |

**Decline** on a waiting trip is unchanged. It marks the trip `rejected` before it ever shows on the board.

### 5.6.2 Blocked drivers and announcements

A **Blocked from posting** list shows the driver name and the last 4 digits of the phone. **Unblock** removes that block. The next post from that phone is allowed again.

**Text everyone upcoming** is one box, 1–280 characters. Recipients are the drivers of upcoming `open` trips and the riders who still have a seat on those trips. Each phone once. A pending trip is not included, and a finished or cancelled trip is not included. The card shows the count before **Send text**.

**Announce to all drivers and riders** is a separate box, 1–280 characters. The SuperAdmin writes the words. This is how a policy change, a new enhancement, or an urgent notice goes out. There is no list of templates. The recipients are every phone that has posted a ride or reserved a seat, including trips that already finished or were cancelled. A person who has been both a driver and a rider is one recipient.

All three boxes follow the same send rules. The card shows “This will text N people.” before **Send text**. It does not show their names or numbers. If N is greater than the texts left in today’s cap, nothing is sent. The card says how many people would have been texted and how many texts are left. The SuperAdmin raises **Daily text cap** and tries again.

The body is sent as `JumpIn: {the words the SuperAdmin wrote}`. The function does not add a manage link. Someone who has replied STOP to the WaitLink number is skipped, and that skip is remembered so the next text skips them too. Posting or reserving again, with the consent line on the form, puts that phone back on the list.

---

## 6. Driver flow

1. Open `https://waitlink.app?s=jumpin`.
2. Tap **Post a ride** and enter name, phone, from, to, date, time, seats, and an optional note.
3. The function creates the trip, stores the driver secret in this browser, and texts the driver a manage link. When review is off, the trip is `open`. When review is on, the trip is `pending` and is not on the board.
4. When the trip is `open`, the driver copies the public ride link and sends that link to riders. The driver does not send the manage link. When the trip is `pending`, the driver waits. After approval, the page shows **Copy link** and the driver gets a text that the trip is on the board.
5. As riders reserve, the public card and the driver page show each new first name and the new seat count.
6. The driver writes in the trip thread from the browser that posted, or from the driver manage link.
7. At the meeting place, the note and the thread are the instructions.
8. To call the trip off, the driver taps **Cancel trip**, then confirms in the iOS sheet or the Android dialog from section 5.0.1. The first tap does not cancel the trip.
9. To do that from a phone that does not have the secret, the driver opens the public ride, taps **Cancel my trip**, enters the same phone number, and uses the new text. The public page shows **Cancel my trip** only when this browser has no driver secret. The tap sends a text. It does not cancel the trip.

There is no edit of from, to, date, time, or seats after post. A change is a cancelled trip plus a new post. That keeps seat counts and texts pointed at one immutable trip.

---

## 7. Rider flow

1. Open the public ride link, or pick the row on the board.
2. Read the card.
3. Enter name and phone. Tap **Reserve a seat**.
4. The function creates the reservation, stores the rider secret in this browser, decrements seats left, and texts the rider manage link.
5. This browser now shows **Cancel** and the composer.
6. From any other browser, the public page does not know who the visitor is. **Cancel my seat** plus the same phone number sends a new manage text. The person opens that text, taps **Cancel**, then confirms in the sheet or dialog. The seat stays until that confirmation.
7. A deleted text is replaced by the same **Cancel my seat** step. The reservation remains until **Cancel seat** is confirmed on a manage page or on a browser that still holds the secret.

---

## 8. How a browser is matched to a seat

The public URL does not identify the visitor. Matching works in two ways.

**This browser already reserved or posted.** The function returned the secret once. The client saved it.

| Key | Value |
| :--- | :--- |
| `waitlink_carpool_seat_{reservationId}` | rider secret |
| `waitlink_carpool_trip_{rideId}` | driver secret |

The ride page reads those keys for the current `rideId`. A hit draws **Cancel** or **Cancel trip**. The function still checks the secret on every call. A stale local key fails closed and the client deletes it.

**This browser has no secret.** The person enters the phone number they used. The function looks up an active driver or an active reservation on this ride with that exact E.164 number. On a match it rotates the secret, stores the new hash, and texts the new manage link. The response body never contains the secret and never says whether a match existed. The screen always reads: “If this number is on this ride, we sent a text.”

The secret is returned in the function response only for the original post or reserve call, and only when the request presents the same client idempotency key that created the record (section 12.4).

---

## 9. Data model

Two trees. Clients may read the public tree. Clients may not read or write the private tree. Cloud Functions use the Admin SDK for both.

### 9.1 Public ride — `/carpool_public/rides/{rideId}`

Readable by anyone. Written only by Functions. The document must not gain new fields that contain a phone, a secret, a hash, or a full name beyond the display name.

```json
{
  "rideId": "ride_7k2m9qpx4c1a",
  "status": "open",
  "from": "Library",
  "to": "Office",
  "departAt": 1763726400000,
  "timeZone": "America/New_York",
  "seatsTotal": 3,
  "seatsLeft": 2,
  "note": "South door",
  "driverName": "Alex",
  "riders": [
    { "reservationId": "rsv_8f3a1bc9d2e4", "name": "Sam", "status": "active" }
  ],
  "messages": [
    {
      "messageId": "msg_1",
      "kind": "user",
      "authorName": "Alex",
      "authorRole": "driver",
      "text": "Leaving at 8:00 sharp",
      "createdAt": 1763720000000
    }
  ],
  "createdAt": 1763710000000,
  "updatedAt": 1763720000000
}
```

`status` is `pending`, `open`, `rejected`, `cancelled`, or `completed`. The board lists only `open`.

`reservationId` on the public rider row is an identifier, not a secret. It does not authorize cancel. It lets the posting browser attach its local secret to the right row.

`messages` is capped at 20 items. The function appends and drops nothing already stored; a 21st user message is rejected. System lines count toward the cap.

### 9.2 Public board

The board is a query, not a second copy of the trips:

`carpool_public/rides` where `status == open` and `departAt > now`, order by `departAt` ascending, limit 50.

A composite index on `status` + `departAt` is required.

### 9.3 Private ride — `/carpool_private/rides/{rideId}`

```json
{
  "rideId": "ride_7k2m9qpx4c1a",
  "status": "open",
  "driverName": "Alex",
  "driverPhoneE164": "+15552345678",
  "driverTokenHash": "<sha256>",
  "tokenIssuedAt": 1763710000000,
  "idempotencyKey": "<client uuid>",
  "from": "Library",
  "to": "Office",
  "departAt": 1763726400000,
  "timeZone": "America/New_York",
  "seatsTotal": 3,
  "seatsLeft": 2,
  "note": "South door",
  "smsSent": 1,
  "activeReservationDocIds": ["ride_7k2m9qpx4c1a_a1b2c3d4e5f67890"],
  "createdAt": 1763710000000,
  "cancelledAt": null,
  "completedAt": null
}
```

### 9.4 Private reservation — `/carpool_private/reservations/{rideId}_{phoneHash16}`

The document id is deterministic: `rideId` plus the first 16 hex chars of `SHA-256(phoneE164)`. One phone number can hold at most one reservation record per ride, which is what makes the seat transaction safe without a query.

```json
{
  "reservationId": "rsv_8f3a1bc9d2e4",
  "rideId": "ride_7k2m9qpx4c1a",
  "name": "Sam",
  "phoneE164": "+15559876543",
  "status": "active",
  "tokenHash": "<sha256>",
  "tokenIssuedAt": 1763712000000,
  "idempotencyKey": "<client uuid>",
  "smsSent": 1,
  "createdAt": 1763712000000,
  "cancelledAt": null
}
```

`status` is `active` or `cancelled`.

A person who cancelled may reserve again. The same document is reused, a new `reservationId` and a new token hash are written, and `status` returns to `active`. The previous secret stops working.

### 9.5 Platform config — `/settings/carpool_config`

SuperAdmin write, world read, same as other `/settings` documents. The SuperAdmin edits the allowed fields from the card in section 5.6. Functions update `dailySmsSent` and `dailySmsDay`. The card does not.

```json
{
  "enabled": false,
  "requireRideApproval": false,
  "dailySmsCap": 200,
  "dailySmsSent": 0,
  "dailySmsDay": "2026-11-21",
  "maxSeats": 6,
  "horizonDays": 30,
  "maxMessagesPerRide": 20,
  "maxPostsPerPhonePerDay": 10,
  "maxActiveReservationsPerPhone": 5,
  "maxSmsPerRecord": 4,
  "resendCooldownSec": 60
}
```

`enabled: false` until the reserved slug, indexes, rules, and functions are deployed. While disabled, `?s=jumpin` shows “JumpIn is not open yet.”

### 9.6 SMS documents

Functions create `/messages/{id}` with the Admin SDK. The existing Twilio extension delivers them. Carpool texts set `shopSlug: "jumpin"` and `triggerType` to one of `CARPOOL_DRIVER_LINK`, `CARPOOL_RIDER_LINK`, `CARPOOL_TRIP_CANCELLED`. They do not increment a shop’s `monthlyCheckinCount` or SMS wallet.

JumpIn does not add a second SMS collection.

### 9.7 Phone counters — `/carpool_private/phones/{phoneHash16}`

`phoneHash16` is the first 16 hex characters of `SHA-256(phoneE164)`. The document stores no phone number. Post and reserve read it inside the same transaction as the trip or the seat, because a query is not allowed there.

```json
{
  "postsDay": "2026-11-22",
  "postsToday": 1,
  "activeReservations": 1,
  "updatedAt": 1763710000000
}
```

`postsDay` is the UTC date. When the stored day is not today, the function treats `postsToday` as 0 and then writes today’s date. `carpoolPostRide` rejects the trip when `postsToday` would pass `maxPostsPerPhonePerDay` (10). A committed post increments `postsToday`.

`carpoolReserveSeat` rejects the seat when `activeReservations` would pass `maxActiveReservationsPerPhone` (5). A new active seat increments it. Cancelling that seat decrements it. Cancelling the trip decrements it once for each active reservation on that trip. An idempotent retry of a seat that is already active does not increment it again.

### 9.8 Recovery rate limits — `/carpool_private/limits/{ipHash16}_{utcHour}`

`ipHash16` is the first 16 hex characters of `SHA-256(client IP)`. `utcHour` is `YYYY-MM-DDTHH`. The raw IP is not stored.

```json
{
  "recoveryCalls": 1,
  "expiresAt": 1763714400000
}
```

`carpoolSendManageLink` increments `recoveryCalls` and stops sending when the count for that IP and hour would pass 10. The on-screen sentence stays “If this number is on this ride, we sent a text.” The 7-day sweep deletes limit documents whose `expiresAt` has passed.

### 9.9 What is not its own collection

| Data | Where it lives |
| :--- | :--- |
| Board | A query on `/carpool_public/rides`. |
| Trip messages | The `messages` array on the public ride. Cap 20. |
| Idempotency keys | A field on the private ride or the private reservation. |
| Daily platform SMS count | Fields on `/settings/carpool_config`. |
| Outbound texts | The existing `/messages` collection. |
| Reserved slug | The existing `/slug_registry/jumpin` document. |

No shop document is created for JumpIn.

### 9.10 Blocked drivers — `/carpool_private/blocks/{phoneHash16}`

`phoneHash16` is the same hash used for phone counters. The document stores no full phone number.

```json
{
  "driverName": "Alex",
  "phoneLast4": "5678",
  "blockedAt": 1763710000000
}
```

`carpoolPostRide` reads this document inside the post transaction. When it exists, the trip is not created and the screen says “You can't post a ride right now.” **Unblock** deletes the document.

### 9.11 Announcement audience — `/carpool_private/audience/{phoneHash16}`

This is the list **Announce to all drivers and riders** sends to. It is not deleted when a trip is purged.

`carpoolPostRide` and `carpoolReserveSeat` create or update the document for that phone. The full number stays in this private document so a later announcement can be delivered. The SuperAdmin card never reads the number. It only receives the count.

```json
{
  "displayName": "Alex",
  "phoneE164": "+15552345678",
  "phoneLast4": "5678",
  "roles": ["driver"],
  "smsOptOut": false,
  "updatedAt": 1763710000000
}
```

`roles` contains `driver`, `rider`, or both. `carpoolRetainTrips` does not delete audience documents. When a send fails because the carrier reports STOP, the function sets `smsOptOut` to true. Announcements skip those documents.

---

## 10. Cloud Functions

Eight callable HTTPS functions. Region: `us-central1`. The client never writes Firestore for JumpIn. App Check is required on the six guest functions. The two SuperAdmin functions check the signed-in email instead, as specified below.

Time comparisons use the server clock. The client clock is ignored for “has this trip left?”

| Function | Caller proves | Effect |
| :--- | :--- | :--- |
| `carpoolPostRide` | A valid new trip payload | Creates the trip. Status is `open`, or `pending` when `requireRideApproval` is yes. Returns the driver secret once and sends the driver manage text |
| `carpoolReserveSeat` | A valid seat payload, trip `open`, seat available | Creates or reactivates the reservation, returns the rider secret once, sends the rider text |
| `carpoolCancelSeat` | Rider secret for that reservation | Sets the reservation cancelled, increments `seatsLeft` |
| `carpoolCancelTrip` | Driver secret for that trip | Sets the trip cancelled, cancels active reservations, texts each active rider |
| `carpoolSendManageLink` | Phone number plus either `rideId` (driver recovery) or `rideId` (rider recovery) | Rotates the matching secret and texts it. Response does not reveal a match |
| `carpoolPostMessage` | Driver or active rider secret, and the trip is `open` | Appends a user message to the public ride |
| `carpoolListPending` | Signed-in platform SuperAdmin | Returns waiting trips: from, to, departure, seats, driver name, note. No phone and no secret |
| `carpoolReviewRide` | Signed-in platform SuperAdmin, plus `rideId` and `approve` or `decline` | One decision. Approve sets `pending` to `open` and texts the driver the public link. Decline sets `pending` to `rejected` and texts the driver that it was not approved |
| `carpoolAdminCancelTrip` | Signed-in platform SuperAdmin, plus `rideId` | Cancels a `pending` or `open` trip, releases active seats, and texts the driver and each active rider |
| `carpoolAdminSetPosting` | Signed-in platform SuperAdmin, plus `rideId` or a phone number, and `blocked` true or false | Blocks or unblocks posting for that phone. Does not cancel trips already posted |
| `carpoolAdminBroadcast` | Signed-in platform SuperAdmin, plus `scope` of `trip`, `upcoming`, or `all`, the text, `confirm`, and `rideId` when the scope is `trip` | `confirm` false returns how many phones would be texted, and the cap left. `confirm` true sends one `JumpIn:` text to each phone in that scope when the count fits in the cap. Opted-out numbers are skipped. |

`carpoolListPending` also returns the upcoming open trips and the blocked-driver list (name and last 4 digits only).

The first six are the guest functions. App Check is required on those six. The SuperAdmin functions require a signed-in Firebase user whose email is the platform SuperAdmin. They do not require App Check, so the existing SuperAdmin portal can call them without changing shop pages.

These functions are new exports in the existing `functions/` codebase for `waitlink-app-8821`. They are not shop functions with a carpool branch. Riders and drivers call only the first six. They do not call a shop function to post, reserve, cancel, or text.

`carpoolCompleteTrips` also sets `pending` trips whose `departAt` has passed to `completed`, so a trip that was never approved leaves the review list and does not appear on the board.

`carpoolSendManageLink` takes `role: "driver" | "rider"` and `rideId`. For a rider it also accepts no reservation id. The phone number selects the row.

Two scheduled functions run with the Admin SDK and are not called by the browser:

| Function | Schedule | Effect |
| :--- | :--- | :--- |
| `carpoolCompleteTrips` | Every 5 minutes | Sets `open` and `pending` trips whose `departAt` has passed to `completed`. Secrets then fail. Open trips leave the board. Pending trips leave the review list. |
| `carpoolRetainTrips` | Every 24 hours | At 7 days past `departAt`, deletes the private ride, its reservations, and rewrites the public doc as a tombstone. It does not delete `/carpool_private/audience`. At 30 days, deletes the tombstone. Deletes `/carpool_private/limits` documents whose `expiresAt` has passed. |

### 10.1 Secret check

```
hash = SHA-256(presented secret)
match the hash to driverTokenHash or tokenHash using a constant-time compare
reject when the trip is not `open`, except `carpoolCancelTrip`, which may also cancel a `pending` trip
reject when the seat is not active
reject when departAt <= now
```

A mismatch returns the same generic error for a bad secret, a rotated secret, and an unknown id: “This link no longer works. Request a new text from the ride page.” The function does not say which of those three happened.

### 10.2 Seat transaction

`carpoolReserveSeat` runs in one Firestore transaction:

1. Read the private ride.
2. Reject unless `status == open`, `departAt > now`, and `seatsLeft >= 1`.
3. Reject when `phoneE164` equals `driverPhoneE164`.
4. Read the deterministic reservation document.
5. When that document is `active`, stop. This is not a new seat (section 12.4).
6. When it is missing or `cancelled`, write it `active` with a new id and a new token hash, and decrement `seatsLeft`.
7. Write the public ride in the same transaction: new rider row, new `seatsLeft`, system message “{name} reserved a seat”.

`carpoolCancelSeat` in one transaction: verify secret, set reservation `cancelled`, increment `seatsLeft` only when the reservation was `active`, update the public row, append “{name} cancelled”. A second cancel sees `cancelled` and returns success without changing the count.

`carpoolCancelTrip` in one transaction: verify driver secret, set ride `cancelled`, set `seatsLeft` to 0, mark every active reservation on that ride `cancelled`. After the transaction commits, send one text per rider that was active. A failed text does not roll the trip back to open.

The list of reservation document ids to update is kept on the private ride as `activeReservationDocIds`, maintained inside the same transactions. The cancel-trip function does not depend on a collection query.

### 10.3 Validation

| Field | Rule |
| :--- | :--- |
| Name | Trimmed, 1–40 characters, internal whitespace collapsed. Stored and shown as entered after that cleanup. |
| Phone | Digits only. 10 digits become `+1`. 11 digits starting with 1 become `+` those digits. Anything else is rejected. v1 is US and Canada only. |
| From, To | Trimmed, 2–80 characters. |
| Note | Trimmed, 0–140 characters. Empty becomes `""`. |
| Seats | Integer 1 through `maxSeats` (6). |
| Departure | A real local date and time in the poster’s IANA timezone, strictly in the future, no more than `horizonDays` (30) ahead. |
| Message text | Trimmed, 1–280 characters. |
| HTML | Strip tags from every text field. Store plain text. |

The timezone is `Intl.DateTimeFormat().resolvedOptions().timeZone` from the posting browser, saved on the ride. Every viewer sees that zone, labeled (“8:00 AM ET”), including a rider whose laptop is in another zone.

### 10.4 What the screen says

The driver posts a trip. The driver does not reserve a seat on it. Reserve is the rider form: name and phone only. A driver who opens their own public link and submits their own phone as a rider is rejected with “The driver already has this trip.”

Checks run in the browser when **Post** or **Reserve a seat** is tapped, before the function call. The function repeats the same checks. The form stays filled in. The first failing field is scrolled above the keyboard, and one sentence appears under that field. The server can still return a sentence that the browser could not know (the seat was just taken, the daily post cap, the trip was cancelled). That sentence appears under the filled button.

Whitespace is trimmed and collapsed before the check. Tags are stripped before the length check.

#### Driver, post a ride

| Field | When it fails | Sentence under the field |
| :--- | :--- | :--- |
| Name | Empty after trim | Enter your name. |
| Name | Longer than 40 characters | Use 40 characters or fewer. |
| Phone | Empty, or not a US or Canada number | Enter a US or Canada mobile number. |
| From | Shorter than 2 characters | Enter where you are leaving from. |
| From | Longer than 80 characters | Use 80 characters or fewer. |
| To | Shorter than 2 characters | Enter where you are going. |
| To | Longer than 80 characters | Use 80 characters or fewer. |
| Date | Empty | Choose a date. |
| Time | Empty | Choose a time. |
| Date and time | Not strictly in the future, using this phone’s timezone | Choose a later time. |
| Date and time | More than 30 days ahead | Choose a time within the next 30 days. |
| Seats | The control only offers 1 through 6, default 3 | No error state. The function still rejects a value outside 1–6. |
| Note | Longer than 140 characters | Use 140 characters or fewer. |
| Note | Empty | Allowed. Stored as `""`. |

Under the phone field, before submit, the screen shows: “WaitLink will text this number a link to manage this trip, and JumpIn notices.” Submitting **Post** with that line visible is the consent to send those texts.

Sentences the browser shows under **Post** when the function rejects the trip:

| Server result | Sentence |
| :--- | :--- |
| This phone is blocked from posting | You can't post a ride right now. |
| This phone already posted 10 trips today | You already posted 10 trips today. |
| JumpIn is disabled | JumpIn is not open yet. |
| Text could not be sent, trip was saved | Trip posted on this browser. Text could not be sent right now. |
| Network or App Check failure | Could not post. Check the connection and try again. |

#### Rider, reserve a seat

The form has two fields. The trip, the time, and the seat count are already on the card. The rider does not enter them again.

| Field | When it fails | Sentence under the field |
| :--- | :--- | :--- |
| Name | Empty after trim | Enter your name. |
| Name | Longer than 40 characters | Use 40 characters or fewer. |
| Phone | Empty, or not a US or Canada number | Enter a US or Canada mobile number. |

Under the phone field, before submit: “WaitLink will text this number a link to manage your seat, and JumpIn notices.”

Sentences under **Reserve a seat** when the function rejects the seat:

| Server result | Sentence |
| :--- | :--- |
| Phone matches the driver of this trip | The driver already has this trip. |
| This phone already has an active seat on this trip | You already have this seat. |
| No seats left, including a seat taken a moment earlier | That seat was just taken. |
| Trip status is cancelled | This trip was cancelled. |
| Departure time has passed | This trip has already left. |
| This phone already has 5 active seats on other trips | You already have 5 upcoming seats. |
| Text could not be sent, seat was saved | Seat saved on this browser. Text could not be sent right now. |
| Network or App Check failure | Could not reserve. Check the connection and try again. |

**Cancel my seat** and **Cancel my trip** ask for a phone number only. An invalid number shows “Enter a US or Canada mobile number.” A valid number always shows “If this number is on this ride, we sent a text.” The screen does not say whether the number was found.

---

## 11. Texts

Texts are short on purpose so the manage URL stays in one SMS segment when possible.

| Event | To | Body |
| :--- | :--- | :--- |
| Ride posted, review off | Driver | `JumpIn trip posted. Manage: {driverManageUrl}` |
| Ride posted, review on | Driver | `JumpIn trip is waiting for approval. Manage: {driverManageUrl}` |
| Ride approved | Driver | `Your JumpIn trip is on the board. Share: {publicRideUrl}` |
| Ride declined | Driver | `Your JumpIn trip was not approved.` |
| Admin cancelled the trip | Driver and each active rider | `A JumpIn admin cancelled this trip. {When}, {From} to {To}.` |
| Admin text, this trip | That trip’s driver and each active rider, once each | `JumpIn: {message}` |
| Admin text, upcoming trips | Drivers of upcoming open trips and riders with a seat on those trips, once each | `JumpIn: {message}` |
| Admin announcement | Every driver and rider on the announcement list, once each | `JumpIn: {message}` |
| Seat reserved | Rider | `You have a seat. {When}, {From} to {To}. Manage: {riderManageUrl}` |
| Manage recovery | Driver or rider | `New JumpIn link: {manageUrl}` |
| Trip cancelled | Each active rider | `JumpIn trip cancelled. {When}, {From} to {To}.` |

The group chat receives only the public URL, which the driver copies. Functions never put a manage URL on the public ride document.

Per ride or reservation, `smsSent` counts successful queue writes and stops at `maxSmsPerRecord` (4). That is one original text plus three replacements. The trip-cancelled text, the admin-cancelled text, the approval text, the decline text, and each broadcast text are each sent once and do not consume that manage-link budget. They do count toward the daily platform cap.

A resend inside `resendCooldownSec` (60) returns the generic “If this number is on this ride, we sent a text.” and does not send.

Platform cap: when `dailySmsSent >= dailySmsCap`, post and reserve still succeed if the rest of the transaction succeeded, the secret is still returned to that browser, and the text is skipped. The UI says “Seat saved on this browser. Text could not be sent right now.” Recovery stays possible from that browser. SuperAdmin raises `dailySmsCap` or waits for the next UTC day, when the counter resets.

Twilio opt-out (`STOP`) is handled by Twilio. A send failure is logged without the phone and without the secret. The seat or trip still exists. The UI tells the person they can cancel on this browser.

---

## 12. Edge cases

Each row is required behavior.

### 12.1 Who is allowed to act

| # | Situation | Result |
| :--- | :--- | :--- |
| 1 | Anonymous visitor opens the public ride | Sees the card, the reserve form when a seat is open, **Cancel my seat**, and **Cancel my trip** only as text-request buttons. No composer. |
| 2 | Visitor opens `/jumpin` | WaitLink home. The path is not a slug. |
| 3 | Visitor opens `?s=jumpin&view=desk` or any shop view | Board. Shop views do not run. |
| 4 | Visitor opens a ride id that does not exist | “This ride is not available.” No other trip data. |
| 5 | Visitor opens a manage URL with a wrong or missing `k` | “This link no longer works. Request a new text from the ride page.” |
| 6 | Someone forwards a rider manage text | The recipient can cancel that one seat and can post as that rider until the secret is rotated. They do not see other phones and they cannot cancel the trip. |
| 7 | Someone forwards a driver manage text | The recipient can cancel that trip and can post as the driver. They do not see phone numbers. |
| 8 | Someone knows a rider’s name and phone and opens the public link | They can request a text to that phone. They do not receive the secret. The seat stays reserved. |
| 9 | Driver tries to reserve a seat on their own trip, same phone | Rejected. “The driver already has this trip.” Seat count unchanged. |
| 10 | Rider presents a rider secret to `carpoolCancelTrip` | Generic link error. Trip stays open. |
| 11 | Driver presents a driver secret to `carpoolCancelSeat` | Generic link error. Seats unchanged. |
| 12 | A secret from ride A is presented for ride B | Generic link error. |

### 12.2 Reserve

| # | Situation | Result |
| :--- | :--- | :--- |
| 13 | Last seat, two reserves at once | One transaction commits. The other receives “That seat was just taken.” `seatsLeft` is 0. One text is sent. |
| 14 | Reserve when `seatsLeft` is 0 | “This ride is full.” |
| 15 | Reserve on a cancelled trip | “This trip was cancelled.” |
| 16 | Reserve when `departAt` has passed | “This trip has already left.” |
| 17 | Same phone, second seat on the same open trip | No second seat. See 12.4 for what the original browser receives. |
| 18 | Same phone on two different trips | Both reservations are allowed, up to `maxActiveReservationsPerPhone` (5). The sixth active seat is rejected. |
| 19 | Same phone cancels and reserves again | Allowed. New reservation id, new secret, old secret dead, seat count decremented again. |
| 20 | Double tap on Reserve | The button disables on the first tap. The idempotency key covers a retry. |
| 21 | Phone number fails validation | Nothing is written. “Enter a US or Canada mobile number.” |
| 22 | Name empty or only spaces | Nothing is written. The field shows “Enter your name.” |
| 23 | Departure in the past, or more than 30 days out | Post is rejected. Nothing is written. |
| 24 | Seats outside 1–6 | Post is rejected. |
| 25 | Note longer than 140, or from/to outside 2–80 | Post is rejected. |
| 26 | Client sends a `fare` or `price` field | The function ignores unknown fields. Nothing about money is stored. |

### 12.3 Cancel a seat

| # | Situation | Result |
| :--- | :--- | :--- |
| 27 | Cancel on the browser that reserved | Secret is sent. Seat becomes available. Public row shows the name as cancelled, then the name is omitted from the active list. System message appended. |
| 28 | Cancel from a phone after reserving on a laptop | Person uses the texted manage link, or **Cancel my seat** to get a new text, then taps **Cancel**. The laptop’s old secret dies when a new text is issued. |
| 29 | The manage text was deleted | **Cancel my seat**, same phone number, new text, then **Cancel**. The reservation is still active until that button. |
| 30 | Opening the manage link | Shows **Cancel**. Does not cancel. |
| 31 | Cancel tapped twice | Second call returns success. `seatsLeft` increments once. |
| 32 | Rider cancels after the driver already cancelled the trip | Success, no count change, no extra text. |
| 33 | Cancel after `departAt` | Rejected. “This trip has already left.” The seat is not returned. |
| 34 | **Forget this browser** | Local secret removed. Seat stays reserved. |
| 35 | Shared computer, next person opens the ride before anyone taps **Forget this browser** | That browser still shows **Cancel** for the stored seat. The product accepts this and shows the forget control beside it. |

### 12.4 Idempotency and secret replay

| # | Situation | Result |
| :--- | :--- | :--- |
| 36 | First reserve succeeds and the browser receives the secret | Secret saved locally. Later calls with the same idempotency key and same phone, within 15 minutes, return the same secret so a lost response can be retried by that browser. |
| 37 | A different idempotency key is used for a phone that already has an active seat | “You already have this seat.” The secret is not returned. The person uses **Cancel my seat** to reach a new manage link. |
| 38 | Anyone who merely knows the phone number calls reserve again | Same as 37. Knowing the phone does not retrieve the secret. |
| 39 | **Cancel my seat** / **Cancel my trip** for a number that is not on the ride | No text. Same on-screen sentence as a match. No write. |
| 40 | Recovery requested inside 60 seconds | No second text. Same on-screen sentence. |
| 41 | Fourth recovery text on the same record | No text. `smsSent` stays at 4. The person can still cancel from a browser that already holds the current secret. |
| 42 | A new recovery text is issued | Previous hash is replaced. The previous manage URL stops working. |

The lookup response is always the same sentence, match or not. The function waits out a fixed 400 ms before responding so a match is not obvious from speed. It still does not text a number that has no row, because that would let a stranger send texts to arbitrary phones and spend the platform cap.

### 12.5 Cancel a trip

| # | Situation | Result |
| :--- | :--- | :--- |
| 43 | Driver cancels from the posting browser or the driver manage link | Trip `cancelled`. Every active reservation `cancelled`. `seatsLeft` 0. Public page shows “This trip was cancelled.” Reserve form hidden. Composer hidden. |
| 44 | Driver needs a phone that never had the secret | **Cancel my trip**, same phone, new driver text, then **Cancel trip** on that page. |
| 45 | Driver deletes the manage text | Same recovery as 44. |
| 46 | Cancel trip twice | Second call returns success. Riders are not texted again. |
| 47 | A rider is mid-reserve when the trip cancels | One transaction wins. The loser of the seat transaction sees “This trip was cancelled.” and no seat is kept. |
| 48 | A rider SMS fails during trip cancel | The trip stays cancelled. The failure is logged. The public page is the record. |
| 49 | Cancel trip after departure | Rejected. The sweep has marked or will mark the trip `completed`. |
| 50 | Driver phone is also typed into **Cancel my seat** | Rider lookup finds no reservation. Generic sentence. The trip is not cancelled by the rider action. |

### 12.6 Messages

| # | Situation | Result |
| :--- | :--- | :--- |
| 51 | Public-link visitor writes a message | No composer, and `carpoolPostMessage` without a valid secret is rejected. |
| 52 | Active rider or driver with a secret writes | Message stored with the name from the private record, not with a name supplied in the call. The author cannot impersonate another row. |
| 53 | Rider cancels, then writes | Rejected. An active seat is required. |
| 54 | Write after the trip is cancelled or completed | Rejected. The thread is frozen. The cancel system line is the last line. |
| 55 | Empty or whitespace message | Rejected. |
| 56 | Message over 280 characters | Rejected. |
| 57 | 21st user message | Rejected. “This trip thread is full.” |
| 58 | Two messages at once | Each has its own `messageId`. Order on screen is `createdAt`, then `messageId`. |

### 12.7 Time, board, and completion

| # | Situation | Result |
| :--- | :--- | :--- |
| 59 | Two open trips at the same time and route | Both are listed. Ids differ. |
| 60 | Trip is full | Row remains, “0 seats left”, no reserve form. |
| 61 | Trip is cancelled | Removed from the board. Direct public link still opens and shows cancelled. |
| 62 | `departAt` passes | A scheduled function, every 5 minutes, sets due `open` trips to `completed`. They leave the board. The public link shows “This trip has already left.” Reserve, cancel seat, cancel trip, and new messages are closed. Secrets stop working. |
| 63 | Rider no-show | The seat stays taken through departure. v1 has no driver button to drop a single rider. The driver cancels the whole trip only when the trip itself is off. |
| 64 | Clock on the phone is wrong | Server time decides. A client cannot post a past trip by lying about the clock, and cannot keep a departed trip open. |
| 65 | Board has no future open trips | Empty state and the post button. |

### 12.8 SMS, cost, and abuse

| # | Situation | Result |
| :--- | :--- | :--- |
| 66 | Daily platform cap reached | Writes that do not need a text still commit. Texts are skipped. UI says the text was not sent and this browser can still manage the record. |
| 67 | One phone posts an 11th trip in a UTC day | Rejected. The screen says “You already posted 10 trips today.” |
| 68 | Repeated **Cancel my seat** with random numbers | No texts for unknown numbers. Per-IP limit: 10 recovery calls per hour. Past that, the generic sentence is returned and nothing is sent. |
| 69 | App Check token missing | Callable rejected. No write and no text. |
| 70 | `enabled` is false | Every function rejects. The board page explains that JumpIn is not open. |
| 71 | Shop SMS wallet is empty | JumpIn texts still send, until the platform daily cap. They do not read the shop wallet. |
| 72 | Number has replied STOP to the WaitLink Twilio number | Twilio drops the text. The record remains. Same-browser cancel still works. |

### 12.9 Privacy and retention

| # | Situation | Result |
| :--- | :--- | :--- |
| 73 | Public ride, board, or page source | No phone, no secret, no token hash. |
| 74 | Function logs | `rideId`, `reservationId`, and the last 4 digits of a phone when a send fails. Never the secret, never the full phone, never the full manage URL. |
| 75 | 7 days after `departAt` | Scheduled function deletes private ride and reservation documents (phones and hashes) and rewrites the public doc to a tombstone: `status`, `from`, `to`, `departAt`, `timeZone`. Names and messages are removed. |
| 76 | 30 days after `departAt` | Tombstone deleted. The public link then shows “This ride is not available.” |
| 77 | Browser history of a manage URL | `k` is stripped from the bar after capture. The SMS copy still has it until the carrier and the person’s text thread drop it. Rotation (case 42) is the kill switch for a leaked copy. |

### 12.10 Local browser and link hygiene

| # | Situation | Result |
| :--- | :--- | :--- |
| 78 | Private browsing, reserve, then the window is closed and the text is deleted | The seat is still reserved. Without the text and without the local secret, the person recovers only if they can receive a new text at that number. If they cannot, the seat stays until the driver cancels the trip or the trip departs. |
| 79 | Manage link opened, `k` stripped, page refreshed | The secret is in `localStorage`, so **Cancel** is still there. |
| 80 | `localStorage` cleared, text still in the phone | The person opens the text again. |
| 81 | Crawler or link-preview fetch of a manage URL | Fetches `index.html` only. Cancel is not bound to page load. |
| 82 | `s=jumpin` while a shop session is logged in on the same browser | Shop session is ignored for this slug. JumpIn does not show desk or owner controls and does not read that shop’s queue. |

### 12.11 Phone browser layout

| # | Situation | Result |
| :--- | :--- | :--- |
| 83 | Page opened in iPhone Safari or Android Chrome at 320px wide | Top bar, scrolling middle, bottom bar. No horizontal scroll. The filled button is on screen without scrolling to find it, and it is 52px tall. |
| 84 | iOS Safari shows or hides its bottom toolbar | The bottom bar stays above the toolbar. The shell follows `visualViewport`. It does not use a locked `100vh` frame. |
| 85 | The person focuses the phone, date, time, or message field | The field stays visible above the keyboard. The bottom button stays above the keyboard. Input text is at least 16px, so the browser does not zoom the page in. |
| 86 | A ride or manage link is opened from the Messages app, or from a chat app’s in-app browser | The same shell renders. Cancel still requires a tap on **Cancel** or **Cancel trip**. |
| 87 | The phone is rotated to landscape | The same top bar, middle, and bottom bar remain. No second pane appears. |
| 88 | The person has the phone’s larger text setting on | Text wraps inside the column. Rows grow taller. Controls stay tappable. |
| 89 | **Copy link** on a browser that blocks the clipboard | The public URL is shown in a selectable box. Press-and-hold can copy it. |
| 90 | A laptop window wider than 420px | The same column is centered. The shop desk layout is not reused. |
| 91 | Reserve form before the person taps **Reserve a seat** | Name and phone are hidden. The card shows the trip and one filled button. |
| 92 | A finger pulls down at the top of the shell | The browser does not reload the page. |
| 93 | The phone has a notch or a home indicator | The top bar clears the notch. The bottom button clears the home indicator. |
| 94 | `manifest.json` after JumpIn ships | Shop name, start URL, icons, and shortcuts are unchanged. |
| 95 | Driver taps **Date** or **Time** on an iPhone | The iOS system picker opens. JumpIn does not draw its own calendar. |
| 96 | Driver taps **Date** or **Time** on Android | The Android calendar and clock open. |
| 97 | Driver or rider taps **Cancel trip** or **Cancel** once | The sheet or dialog opens. The seat and the trip stay as they were. |
| 98 | The same person then taps **Keep seat** or **Keep trip** | The sheet or dialog closes. Nothing is cancelled. |
| 99 | iPhone and Android open the same ride | Same words and the same bottom action. iOS uses the chevron, slide, and bottom sheet. Android uses the arrow, fade, ripple, and dialog. |
| 100 | Review switch is no | A posted trip is `open` and shows on the board immediately. |
| 101 | Review switch is yes | A posted trip is `pending`. It is absent from the board. Reserve is hidden. The driver sees “Waiting for approval.” |
| 102 | SuperAdmin taps **Approve** once | The trip becomes `open`, shows on the board, and the driver is texted the public link once. |
| 103 | SuperAdmin taps **Decline** once | The trip becomes `rejected`, stays off the board, and the driver is texted once that it was not approved. |
| 104 | Someone opens the public link of a `pending` trip | The card says “Waiting for approval.” There is no reserve form and no composer. |
| 105 | SuperAdmin confirms **Cancel trip** | The trip is `cancelled`, seats are released, and the driver and each active rider are texted once. |
| 106 | SuperAdmin confirms **Block posting** | Later posts from that phone are rejected. Trips already posted stay until cancelled. Reserving a seat still works. |
| 107 | SuperAdmin taps **Unblock** | That phone can post again. |
| 108 | Any of the three text counts is above the texts left today | No texts are sent. The card shows the count and the cap left. |
| 109 | **Announce to all drivers and riders** is confirmed and fits in the cap | Every driver and rider who has posted or reserved, including people whose trips already ended, receives one `JumpIn:` text. A person who has done both gets one text. Opted-out numbers are skipped. |
| 110 | A trip’s private record is deleted 7 days after departure | That person’s phone remains on the announcement list. |
| 111 | **Text this trip** is confirmed | Only that trip’s driver and riders who still have a seat are texted. |
| 112 | **Text everyone upcoming** is confirmed | Only drivers of upcoming open trips and riders who still have a seat on those trips are texted. Pending, cancelled, and finished trips are not included. |
| 113 | Any existing WaitLink URL, including the guest homepage, desk, owner, and SuperAdmin portal | The screen, the flow, and the functions behave as they do today. No JumpIn link or card is added. |

---

## 13. Authorization matrix

| Action | Public link | Browser with rider secret | Browser with driver secret | Phone recovery text |
| :--- | :--- | :--- | :--- | :--- |
| See trip and messages | Yes | Yes | Yes | Yes |
| Reserve an open seat | Yes, with name and phone | Yes, for a different phone only if seats remain and the cap allows | No, not with the driver phone | No |
| Cancel that rider’s seat | No | Yes | No | Yes, after the link is opened and **Cancel** is tapped |
| Cancel the trip | No | No | Yes | Yes, for the driver phone only |
| Write a message | No | Yes, while the seat is active | Yes, while the trip is open | Yes, on the manage page, under the same rules |
| See phone numbers | No | No | No | No |

---

## 14. Firestore rules

Add explicit matches. Do not rely on the default SuperAdmin deny alone, so a future broad rule cannot open these trees by accident.

```
match /carpool_public/rides/{rideId} {
  allow get: if true;
  allow list: if resource.data.status == "open";
  allow write: if false;
}

match /carpool_private/{document=**} {
  allow read, write: if false;
}
```

Functions use the Admin SDK and bypass these rules. `/settings/carpool_config` stays on the existing settings rule: public read, SuperAdmin write.

Client creation of `/messages` is unchanged. JumpIn does not ask the browser to write that collection.

---

## 15. Client module

A single new script, `carpool.js`, loaded by `index.html`. `app.js` returns before shop initialization when `s=jumpin`.

Responsibilities of `carpool.js`:

1. Render the board, the post form, the public ride, and the manage pages.
2. Subscribe to the public ride document and the board query.
3. Keep secrets in `localStorage` under the keys in section 8.
4. Generate one idempotency UUID per post attempt and per reserve attempt, and reuse it for retries of that attempt.
5. Strip `k` from the URL after storing it.
6. Disable the submit button until the call returns.
7. Never write Firestore and never write `/messages`.
8. Render the phone shell in section 5.0 and the iOS or Android interaction set in section 5.0.1. Do not reuse the shop desk, owner, or marketing layout for `s=jumpin`. Do not edit `manifest.json`. Do not call `alert`, `confirm`, or `prompt`.
9. Leave existing pages, copy, CSS, and event handlers unchanged. The only change in `app.js` is the `s=jumpin` guard that stops before shop startup. Every other slug and every existing view runs the current code.
10. New Cloud Functions are new exports. Existing function handlers are not edited. Firestore rules gain the JumpIn matches in section 14 and do not change existing matches.

Shop screens, desk flow, owner flow, SuperAdmin portal, billing, and SMS behavior for shops are not modified. There is no guest-homepage link. SuperAdmin JumpIn is only `jumpin-admin.html`.

---

## 16. System messages

Appended by functions, `kind: "system"`, `authorRole: "system"`:

| Event | Text |
| :--- | :--- |
| Ride posted | “Trip posted.” |
| Seat reserved | “{name} reserved a seat.” |
| Seat cancelled by rider | “{name} cancelled.” |
| Trip cancelled | “Trip cancelled.” |

System lines are written in the same transaction as the status change so the thread and the seat count cannot disagree.

---

## 17. Out of scope for v1

- Changing existing WaitLink pages, UI, UX flows, features, or Cloud Functions. JumpIn does not add a link or a card to those screens.
- Native iOS or Android apps, and a separate JumpIn install icon. JumpIn is the phone-browser shell in section 5.0. The live WaitLink manifest stays the shop manifest.
- A separate desktop layout, dashboard, map, or navigation chrome.
- Payments, suggested contributions, wallets, or a fare field.
- Maps, GPS, live location, and route matching.
- Editing a posted trip.
- A driver removing one rider while keeping the trip.
- Recurring trips.
- Ratings.
- Email login or password accounts.
- Phone numbers outside US and Canada.
- Using `/shops/{slug}` or a shop SMS quota for this feature.
- Treating `https://waitlink.app/jumpin` as the home page.

---

## 18. Build order

1. Reserve `jumpin` in `/slug_registry/jumpin` and confirm no shop uses that id.
2. Deploy rules, the composite index, and `/settings/carpool_config` with `enabled: false`.
3. Deploy the guest functions, the SuperAdmin functions in section 10, plus `carpoolCompleteTrips` and `carpoolRetainTrips`.
4. Ship `carpool.js` and the `app.js` branch.
5. Add `jumpin-admin.html` from section 5.6. Do not add a link to it from an existing page.
6. Set `enabled: true` after the cases in section 19 pass.

---

## 19. Acceptance cases

These are the minimum tests before `enabled` is turned on. Numbers refer to section 12.

| Test | Cases |
| :--- | :--- |
| Public ride shows no phone and no composer | 1, 73 |
| Two browsers racing for the last seat produce one reservation | 13 |
| Second reserve with the same phone does not return the secret | 17, 37, 38 |
| Laptop reserve, phone cancel through the text | 28 |
| Deleted text, **Cancel my seat**, new text, cancel | 29 |
| Opening the manage URL does not cancel | 30, 81 |
| Recovery for an unknown number sends no text and looks the same | 39 |
| Rotated link kills the previous link | 42 |
| Driver cancel releases every seat and texts each rider once | 43, 46 |
| Rider secret cannot cancel the trip | 10 |
| Message author name comes from the stored record | 52 |
| Departed trip rejects reserve, cancel, and messages | 16, 33, 54, 62 |
| `?s=jumpin&view=desk` shows the board | 3 |
| A fare field is dropped | 26 |
| Platform cap skips the text and keeps the seat | 66 |
| A 320px phone browser shows a top bar, a scrolling middle, and the filled button fixed at the bottom | 83, 84, 93 |
| Focusing the phone field does not zoom the page, and the field and the bottom button stay above the keyboard | 85 |
| The shop PWA manifest is unchanged | 94 |
| iPhone date and time use the iOS picker, and Android uses the Android calendar and clock | 95, 96 |
| The first tap on **Cancel** or **Cancel trip** does not release the seat or the trip | 97, 98 |
| A manage link opened from Messages renders the card and does not cancel until **Cancel** is tapped | 30, 86 |
| Review off shows a new trip on the board. Review on hides it until **Approve** | 100, 101, 102, 104 |
| SuperAdmin cancel texts the driver and the riders who still have seats | 105 |
| The three SuperAdmin texts reach only the people named for that action, and a count over the daily cap sends nothing | 108, 109, 111, 112 |

---

## 20. Summary

The home page is `https://waitlink.app?s=jumpin`. The link a driver sends is `https://waitlink.app?s=jumpin&view=ride&ride={rideId}`. That page can reserve a seat and can ask for a new text. It cannot cancel a seat, cancel a trip, or write a message. On a phone the page is an app shell inside the browser. An iPhone uses iOS controls, a slide, and a bottom sheet. An Android phone uses Android controls, a ripple, and a dialog. The words and the bottom action are the same on both. A laptop shows that same column.

The rider’s phone number identifies the person. The reservation id identifies the seat. The unguessable secret, stored on the reserving browser and in a text to that phone, is the only way to cancel that seat. The driver has a separate secret for the trip. Cancelling the trip releases every seat. A new text rotates the secret so a deleted or forwarded link can be killed.
