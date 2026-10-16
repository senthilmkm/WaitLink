# WaitLink Specification: Shop Owner Multi-Tenant Directory, Staff RBAC & 1-Click Front Desk Terminals

**Document Version:** 1.0.0  
**Status:** In Progress / Implementation Ready  
**Target Environment:** Firebase Hosting & Cloud Firestore (`waitlink-app-8821`)  
**Target Audience:** Core Engineering, Architecture Review, Product & UX  

---

## 1. Executive Summary & Core Objectives

WaitLink currently provides a **Master Multi-Tenant Directory** restricted exclusively to Platform SuperAdmins, while individual business owners switch between multiple locations via a single dropdown selector (`MY SHOPS ▾`). 

As multi-location owners, franchise operators, clinics, and high-traffic walk-in salons expand, they require:
1. **Centralized Multi-Shop Oversight**: A dedicated **Owner Directory** where a business owner can manage all of their storefronts in one place—viewing real-time line occupancy, today's throughput metrics, store status (Open/Closed), and executing administrative actions (Settings, Poster, and Shop Deletion with safety confirmation).
2. **Delegated Front Desk Staff Roles**: The ability to provision dedicated staff accounts for front desk receptionists, stylists, nurses, and floor operators **without sharing master Google/Firebase account passwords**.
3. **Zero-Friction iPad / Station Access**: Simple text usernames and human-readable passcodes/PINs, paired with **1-Click Station URLs and QR Codes** bookmarked directly on front desk tablets for instant, frictionless morning shifts.
4. **Strict Role Separation & Security Guardrails**: Granular checkboxes allowing owners to control what front desk staff can see and do (e.g., tap-to-reveal phone masking, history access, service editing) while permanently locking staff out of billing, Stripe upgrades, platform settings, and shop deletion.

---

## 2. Role Hierarchy & Access Boundaries

WaitLink enforces 4 distinct runtime roles:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 👑 Platform SuperAdmin                                                           │
│ Full platform access across all tenant shops, pricing configuration & master purge│
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│ 💈 Shop Owner (Authenticated via Firebase Auth Email/Google)                      │
│ Owns 1 to N shops. Accesses Owner Directory via User Account Chip dropdown.        │
│ Can configure branding, SMS, services, staff roles, and delete owned shops.      │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│ 👤 Front Desk Staff (Authenticated via Shop Slug + Username + Passcode / URL Key)  │
│ Restricted strictly to Front Desk Operator Mode for assigned shop.                │
│ Permissions governed by owner-assigned feature checkboxes.                        │
│ Zero access to Owner Settings, Billing/Stripe, or Shop Deletion.                  │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│ 📱 Walk-in Customer (Public Unauthenticated / Transient Ticket Session)            │
│ View-only queue tracking on mobile browser via QR poster scan or SMS ticket link. │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Navigation & Entry Point

Per design review, to prevent visual clutter across the app, access to the directory is restricted to a **single, intuitive entry point**:

### Entry Point: User Account Chip Dropdown (`#account-dropdown`)
When an authenticated shop owner (`state.userRole === "ShopOwner"` or `"SuperAdmin"`) clicks their account chip at the top-right of the screen (`👤 user@business.com ▾`), a prominent new option is rendered:

```
┌────────────────────────────────────────────────────────┐
│ 💈 Shop Owner: senthil930@gmail.com                    │
│ 🟢 Enterprise Plan                                     │
├────────────────────────────────────────────────────────┤
│ 🏢 My Shops & Staff Directory        ◄── [NEW ENTRY]   │
├────────────────────────────────────────────────────────┤
│ 🔗 SHARE & TOOLS                                       │
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

Clicking this item activates `#view-owner-directory` and closes all dropdown menus.

---

## 4. Owner Directory Architecture (`#view-owner-directory`)

The Owner Directory features 3 dedicated sub-tabs:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🏢 MY SHOPS & STAFF DIRECTORY                                                         │
│  Account: senthil930@gmail.com  •  Plan: Enterprise (3 Active Locations)               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [ 🏪 My Shops Directory ]   [ 👥 Manage Staff & Roles ]   [ 📋 Terminal Links & Logs ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tab 1: 🏪 My Shops Directory (`#ownerpanel-shops`) — Default Loaded Tab
A high-efficiency management grid displaying all shops where `ownerEmail == user.email`:

#### Display Fields & Metrics:
- **Shop Branding & Title**: Custom logo thumbnail, business name, and URL slug (`waitlink.app?s=slug`).
- **Live Queue Counter**: Current waiting count and active chair/service status in real time.
- **Today's Throughput**: Completed visits today, average wait time, and store status badge (🟢 Open / 🔴 Closed).
- **Assigned Staff Count**: Number of active front desk roles provisioned for this location.
- **Action Toolbar**:
  - `🖥️ Open Front Desk`: Instantly transitions session to Front Desk view for that shop.
  - `⚙️ Shop Settings`: Opens shop branding, services, and profile settings.
  - `📲 Customer View`: Launches live public waitlist page in new tab.
  - `🖨️ Window Poster`: Renders printable 8.5"x11" storefront QR flyer.
  - `🗑️ Delete Shop`: Opens two-step confirmation modal (`#delete-shop-modal`).

#### Header Actions:
- `+ Register New Shop`: Opens shop onboarding wizard (enforces tier boundaries: 1 shop on Starter/Pro, unlimited on Enterprise).
- Search input to filter owned shops by name or slug.

---

### Tab 2: 👥 Manage Staff & Roles (`#ownerpanel-roles`)
Enables the owner to create and manage dedicated staff logins with granular feature checkboxes.

#### Staff Record Schema (`/shops/{slug}/staff_roles/{staffId}`):
```javascript
{
  staffId: "staff_98a72b",
  displayName: "Sarah Jenkins",
  username: "sarah_desk",
  passcode: "4821",              // Plain text passcode / PIN for frictionless typing
  assignedShop: "stomada-clinic",
  assignedShopName: "Stomada Clinic",
  roleTitle: "Front Desk Receptionist",
  permissions: {
    canCheckIn: true,            // Add walk-ins to line
    canCallNext: true,           // Call customer & trigger SMS
    canComplete: true,           // Mark visit done
    canCancel: true,             // Mark no-show or cancel ticket
    canRevealPhone: false,       // Tap-to-reveal patient phone numbers (privacy shield)
    canViewHistory: true,        // Access visit history log
    canExportCSV: false,         // Download CSV audit records
    canEditServices: false,      // Modify service menu and times
    canToggleStoreStatus: true   // Open/Close walk-in queue
  },
  createdAt: "2026-10-16T10:15:00Z",
  createdBy: "senthil930@gmail.com",
  lastActiveAt: null
}
```

#### Staff Profile Creator / Editor Modal (`#staff-role-modal`):
1. **Basic Info**:
   - Staff Name (e.g. *Jonathan E.* or *Desk Operator 1*).
   - Assigned Shop (dropdown of the owner's shops).
   - Staff Username (simple text, e.g. `reception`).
   - Staff Passcode / PIN (plain text or 4-digit numeric PIN, with 👁️ toggle to reveal).
2. **Permission Checkbox Grid**:
   - Organized by category: *Queue Actions*, *Privacy Protections*, *Visibility & Reporting*, *Shop Controls*.
   - Preset buttons: `Full Desk Operator`, `Intake / Check-In Only`, `Restricted Staff`.
3. **Save Action**:
   - Atomically updates Firestore `/shops/{slug}/staff_roles/{staffId}`.

---

### Tab 3: 📋 Terminal Links & Access Activity (`#ownerpanel-terminals`)

#### 1. Frictionless iPad Station Links & QRs:
- Generates a unique, persistent station access URL for each provisioned staff member:
  `https://waitlink-app-8821.web.app/?s={slug}&staff={username}&key={passcode}`
- **Copy Link**: 1-click clipboard copy to paste into Safari on the desk iPad.
- **Station QR Code**: On-screen QR code that can be scanned using an iPad or tablet camera to instantly log into the front desk without typing credentials.
- **Home Screen Bookmark Guide**: Built-in instructions showing how to tap "Add to Home Screen" on iOS/iPadOS for a full-screen, native-app feel.

#### 2. Staff Action Audit Log:
- Displays recent queue activity tagged with staff identity:
  - `Ticket WL-104 called by Sarah Jenkins (10:14 AM)`
  - `Ticket WL-104 completed by Sarah Jenkins (10:35 AM)`
  - `Customer Marcus S. checked in by Mike T. (11:02 AM)`

---

## 5. Front Desk Staff Login & Session Management

### 5.1 Staff Authentication Pathways
Front desk users can authenticate through three friction-free methods:

1. **Station URL / QR Auto-Login**:
   - Query parameters `?s={slug}&staff={username}&key={passcode}` are detected on app load.
   - Credentials validate against `/shops/{slug}/staff_roles`.
   - On success, the app immediately locks into `#view-desk` with assigned permissions.
2. **Staff Login Tab on Sign In Modal**:
   - Added a **"Front Desk Staff"** sub-tab inside `#auth-modal`.
   - Fields:
     - Shop Identifier (`slug` or selection).
     - Username (e.g. `sarah_desk`).
     - Passcode (e.g. `4821`).
   - Validates in Firestore and establishes staff session.
3. **PIN Switcher on Desk Header**:
   - A small chip on the Front Desk header: `👤 Staff: Sarah J. ⇄ Switch`.
   - Clicking allows another staff member to enter their 4-digit PIN in 2 seconds to switch active operator identity.

### 5.2 Session Enforcement & DOM Security
When a staff session is active (`state.isStaffSession === true`):
- **Locked to Desk Mode**: Only the Front Desk view (`#view-desk`) and Public Customer view are accessible.
- **Owner Tab & SuperAdmin Tab**: Hidden and permanently disabled from navigation.
- **Shop Deletion & Billing**: Completely absent from the DOM; direct calls are blocked.
- **Permission Enforcement**:
  - `canCheckIn === false`: Check-in form is disabled with message `"Check-in disabled for this staff account"`.
  - `canCallNext === false`: "SERVE NOW" / "Call Next" buttons are hidden.
  - `canRevealPhone === false`: Phone tap-to-reveal toggle is disabled; phone numbers display strictly as `+1 (•••) •••-1359`.
  - `canExportCSV === false`: Export CSV button is hidden.
- **Sign Out**: Staff can click `🚪 Staff Sign Out` to return to public or standard login screen.

---

## 6. Shop Deletion Safeguards

Shop deletion inside Tab 1 (`#ownerpanel-shops`) is protected by strict guardrails:
1. **Role Check**: Only the authenticated shop owner (`ownerEmail === state.user.email`) or SuperAdmin can trigger deletion.
2. **Confirmation Modal (`#delete-shop-modal`)**: Explicit confirmation is required before executing deletion.
3. **Sandbox Immunity**: The demo shop (`main-st-barbers`) can never be deleted.
4. **Active Session Transition**: If the active shop is deleted, the session gracefully switches to the owner's next registered shop or opens the shop setup onboarding wizard.
5. **Database Purge**: The Firestore shop document and associated staff roles subcollection are deleted.

---

## 7. Cloud Firestore Security Rules

Update `firestore.rules` to secure the staff roles subcollection:

```javascript
match /shops/{shopId}/staff_roles/{staffId} {
  // Shop owners and SuperAdmin have full read/write access
  allow read, write, delete: if isOwner(shopId) || isSuperAdmin();
  
  // Public/Staff read allowed for authentication verification
  allow read: if true;
}
```

---

## 8. Implementation Phases & Verification Checklist

- [x] Phase 1: Create comprehensive design specification in `docs/OWNER_DIRECTORY_STAFF_ROLES_DESIGN_SPEC.md`.
- [ ] Phase 2: Add Firestore security rules for `/shops/{shopId}/staff_roles/{staffId}` in `firestore.rules`.
- [ ] Phase 3: Add `🏢 My Shops & Staff Directory` to User Account Chip dropdown in `index.html`.
- [ ] Phase 4: Build `#view-owner-directory` in `index.html` with Tab 1 (Shops), Tab 2 (Staff Roles), Tab 3 (Terminal Links & Activity Log).
- [ ] Phase 5: Build `#staff-role-modal` for adding/editing staff profiles and feature checkboxes.
- [ ] Phase 6: Add Front Desk Staff login tab to `#auth-modal` in `index.html`.
- [ ] Phase 7: Implement state management, authentication, role enforcement, and terminal auto-login in `app.js`.
- [ ] Phase 8: Add responsive styles for directory cards, staff list, permissions matrix, and station links in `style.css`.
- [ ] Phase 9: Test end-to-end in browser subagent (Owner directory view, staff creation, staff login, permission gating, iPad terminal QR, shop deletion confirmation).
- [ ] Phase 10: Deploy to Firebase Hosting and Cloud Firestore rules (`waitlink-app-8821`), prune versions to 5, and push to Git.
