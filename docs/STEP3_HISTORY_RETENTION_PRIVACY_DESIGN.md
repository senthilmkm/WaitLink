# WaitLink Step 3: Queue History Data Retention, Privacy Auto-Masking & Reporting
## Architectural Design Specification

**Document Version:** 1.1.0  
**Status:** Implemented  
**Location:** `c:\Workspaces\WaitLink\docs\STEP3_HISTORY_RETENTION_PRIVACY_DESIGN.md`  
**Target Environment:** Firebase Hosting & Cloud Firestore (`waitlink-app-8821`)  
**Target Audience:** Engineering, Architecture Review, SuperAdmin  

---

## 1. Executive Summary & Core Objectives

WaitLink provides walk-in line management for single shops and multi-location enterprises. Over time, active shops accumulate significant volume: an average shop with 40 daily walk-ins generates ~1,200 records/month (~14,400 records/year).

This specification addresses three critical engineering requirements:
1. **Multi-Tenant Retention Governance**: Centralized SuperAdmin control over queue history retention windows per subscription tier without code changes.
2. **Customer Privacy & Compliance**: Automatic PII (Personally Identifiable Information) anonymization for historical records to comply with TCPA, CCPA, and GDPR regulations while preserving business analytics and throughput metrics.
3. **Firestore Scalability & Performance**: Overcoming Firestore's **1 MB document size ceiling** by transitioning legacy monolithic history arrays into an active cache + partitioned subcollection architecture.
4. **Tier-Gated CSV Reporting**: Tier-governed reporting that enforces subscription boundaries (Free vs. Pro vs. Enterprise) while streaming sanitized data in standard spreadsheet-ready format.

---

## 2. Configuration & Parameter Matrix

Based on user requirements, the system operates with the following canonical retention windows:

| Tier / Function | Retention Window | PII Masking Window | Export Capabilities | Data Storage Layer |
| :--- | :--- | :--- | :--- | :--- |
| **Starter (Free)** | **7 Days** | After 30 Days (N/A due to 7d limit) | Locked (Requires Pro) | Active Cache (Document) |
| **Pro Business** | **90 Days** (3 Months) | **30 Days** | Full 90-Day CSV Export | Subcollection + Active Cache |
| **Enterprise** | **365 Days** (1 Year) | **30 Days** | Full Annual CSV Across All Shops | Subcollection + Active Cache |
| **SuperAdmin Override**| Unlimited / Custom | Configurable (1–365 Days) | Cross-Tenant Master CSV | Full Database Access |

---

## 3. SuperAdmin Configurable Retention Architecture

### 3.1 Cloud Firestore Storage Schema
A centralized document is maintained at path:
```
/settings/retention_config
```

#### Document Schema:
```json
{
  "starter_retention_days": 7,
  "pro_retention_days": 90,
  "enterprise_retention_days": 365,
  "pii_mask_after_days": 30,
  "auto_purge_expired": true,
  "preserve_first_name": true,
  "last_cleanup_timestamp": 1729012345000,
  "updatedAt": 1729012345000,
  "updatedBy": "senthil930@gmail.com"
}
```

### 3.2 Real-Time Client Synchronization
- On app initialization, `initRetentionConfigRealtimeSync()` establishes a real-time snapshot listener on `/settings/retention_config`.
- Fallback defaults (7, 90, 365, 30) are pre-loaded in memory so that offline or freshly opened sessions execute immediately without awaiting cloud round-trips.
- Any update made in the SuperAdmin portal instantly synchronizes across all active Front Desk and Owner Admin client sessions via Firestore snapshots.

### 3.3 SuperAdmin Management UI
Located inside the SuperAdmin Portal (`#superadmin-view`):
- **Card Title**: `🛡️ History Retention & Privacy Governance Settings`
- **Fields**:
  - `Starter Tier (Free) Retention Window (Days)`: Number input (min: 1, max: 30, default: 7).
  - `Pro Business Tier Retention Window (Days)`: Number input (min: 7, max: 180, default: 90).
  - `Enterprise Tier Retention Window (Days)`: Number input (min: 30, max: 730, default: 365).
  - `PII Auto-Masking Age Threshold (Days)`: Number input (min: 1, max: 90, default: 30).
  - `Auto-Purge Expired Records`: Toggle switch (Enabled by default).
  - `Customer Name Anonymization Mode`: Radio/Toggle:
    - `Keep First Name Visible (e.g. John D.)` (Selected by default)
    - `Full Anonymization (e.g. Customer)`
- **Action Buttons**:
  - `Save Retention Configuration` (Writes to `/settings/retention_config`).
  - `Trigger Cloud Cleanup Now` (Manual on-demand purge of expired historical documents across tenants).

---

## 4. Cloud Data Storage & Scalability Architecture

### 4.1 The 1 MB Document Limit Challenge
In legacy versions, historical items were appended directly to `shops/{slug}.history[]`.
- Each history record averages **~250 bytes**.
- 1,200 visits/month = **~300 KB/month**.
- Over 90 days (Pro) or 365 days (Enterprise), an active shop would easily surpass 1,000–4,000 records, triggering Firestore document size limits (`RESOURCE_EXHAUSTED` / 1 MB limit error).

### 4.2 Two-Tier Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Firestore Root: /shops/{slug}               │
│                                                             │
│  • shopName, address, planTitle, planPrice                  │
│  • queue: [ Active Waiting Customers ]                      │
│  • recentHistory: [ Today's Completed Items (Max 50) ]      │  <-- Instant Desk & Lobby Load
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          Subcollection: /shops/{slug}/history/{ticketId}    │
│                                                             │
│  Document Structure:                                        │
│  • ticketId: "WL-104"                                       │
│  • customerName: "John Doe" (or "John D." if masked)        │
│  • phone: "+18039027464" (or "+1 (***) ***-7464" if >30d)   │
│  • serviceName: "Men's Haircut"                             │
│  • partySize: 1                                             │
│  • checkedInAt: 1729010000000                               │
│  • calledAt: 1729011200000                                  │
│  • completedAt: 1729012400000                               │
│  • waitTimeMinutes: 20                                      │
│  • serviceDurationMinutes: 20                               │
│  • status: "Served" | "Cancelled" | "Walk-Away"             │
│  • isMasked: false | true                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Dual-Tier Benefits:
1. **Sub-second Initial Rendering**: Front Desk & Public pages only load active queue and today's small buffer (`recentHistory`).
2. **Zero Size Limit**: The subcollection can store hundreds of thousands of historical entries without affecting document performance.
3. **Optimized Reads**: Date range queries only fetch rows requested by the user, drastically cutting Firestore read costs.

---

## 5. PII Anonymization & Privacy Protection

### 5.1 Masking Criteria
A historical record is subject to PII auto-masking when:
$$\text{Current Timestamp} - \text{completedAt} \ge (\text{pii\_mask\_after\_days} \times 86,400,000\text{ ms})$$
*(Default: 30 Days)*

### 5.2 Phone Number Masking Specification
- **US Standard Format**: `(555) 234-5678` $\rightarrow$ `(***) ***-5678`
- **E.164 International Format**: `+18039027464` $\rightarrow$ `+1 (***) ***-7464`
- **General / Other Format**: Redact all digits except the last 4 digits: `*******1234`.

### 5.3 Customer Name Anonymization Specification
Based on explicit user preference:
- **First name remains visible** so that shop owners can recognize regular patrons.
- **Last name is abbreviated to its first initial**:
  - `John Doe` $\rightarrow$ `John D.`
  - `Sarah Smith-Johnson` $\rightarrow$ `Sarah S.`
  - Single word names (e.g. `Alexander`) remain unchanged.

### 5.4 Metric & Analytics Preservation
During anonymization, **all operational and accounting metrics remain 100% intact**:
- Wait duration (`waitTimeMinutes`)
- Service duration (`serviceDurationMinutes`)
- Selected service type (`serviceName`)
- Party size (`partySize`)
- Exact date, day of week, and hour of service
- Calling staff member / desk operator

This guarantees that historical revenue, turnaround baselines, and peak rush analytics remain perfectly accurate while eliminating privacy liability.

---

## 6. Real-Time In-App History (Front Desk & Owner Admin)

### 6.1 View Capabilities by Subscription Tier
The History tab in both Front Desk (`#desk-view`) and Owner Admin (`#owner-view`) adapts dynamically based on the shop's active plan:

```
┌──────────────────────────────────────────────────────────────┐
│  Starter Tier (Free):                                        │
│  [ Preset: Past 7 Days (Fixed) ]                             │
│  Displaying 14 records from past 7 days.                     │
│  🔒 History older than 7 days requires Pro Business Tier.    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Pro Business Tier ($15/mo):                                 │
│  [ Presets: Today | Past 7d | Past 30d | Past 90d | Custom ] │
│  Displaying records within your 90-day retention window.     │
│  ℹ️ Records older than 30 days have phone numbers masked.    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Enterprise Tier ($49/mo):                                   │
│  [ Presets: Today | Past 30d | Past 90d | Full Year (365d) ] │
│  Displaying all annual records across your location(s).      │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 In-App Table Features
- **Search Filter**: Real-time debounce search matching Customer Name, Ticket ID (`WL-102`), or Service Name.
- **State Badges**: Color-coded pill tags for `Served` (green), `Cancelled` (red), `No-Show / Walk-Away` (amber).
- **Pagination**: Configurable page size (10, 25, 50 rows per page) with `Previous` / `Next` and page indicators.
- **Audit Details Modal**: Clicking on any customer opens the existing timeline modal showing transition history (Checked-in $\rightarrow$ Called $\rightarrow$ Served) with masked PII if older than 30 days.

---

## 7. CSV Download & Reporting Specification

### 7.1 Tier Gating & Paywall Integration
- **Starter Tier (Free)**:
  - The `📥 Export CSV` button displays a locked indicator: `📥 Export CSV [PRO]`.
  - Clicking the button intercepts the action and presents the Subscription Upgrade Modal with message:
    *"Business Analytics & CSV Reporting requires Pro Business ($15/mo) or Enterprise. Upgrade now to unlock unlimited exports."*
- **Pro Business Tier**:
  - Unlocked. Allows exporting up to 90 days of retained history.
  - Generates single-shop CSV.
- **Enterprise Tier**:
  - Unlocked. Allows exporting up to 365 days of retained history.
  - Multi-location dropdown: Allows exporting a single shop or an aggregated multi-location CSV.

### 7.2 CSV Column Structure
The generated file follows RFC 4180 standards:

| Column # | Column Header | Data Type | Example Value | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `Ticket ID` | String | `WL-104` | Unique queue identifier |
| 2 | `Customer Name` | String | `John D.` | Masked if >30 days old |
| 3 | `Phone Number` | String | `+1 (***) ***-7464` | Masked if >30 days old |
| 4 | `Service Name` | String | `Men's Haircut` | Service catalog item |
| 5 | `Party Size` | Integer | `1` | Guest count |
| 6 | `Check-In Time` | ISO Date/Time | `2026-10-15 14:32:00` | Localized timestamp |
| 7 | `Called Time` | ISO Date/Time | `2026-10-15 14:52:10` | When front desk buzzed ticket |
| 8 | `Completed Time` | ISO Date/Time | `2026-10-15 15:15:00` | When service completed |
| 9 | `Wait Time (Minutes)` | Integer | `20` | Check-in to Called delta |
| 10 | `Service Duration (Min)`| Integer | `23` | Called to Complete delta |
| 11 | `Status` | String | `Served` | Served / Cancelled / No-Show |
| 12 | `Audit Trail Log` | String | Activities | Full lifecycle history with masked PII |

### 7.3 Compatibility & Encoding
- **UTF-8 BOM**: Prepended with byte order mark `\uFEFF` to ensure flawless rendering of special characters in Microsoft Excel, Google Sheets, and Apple Numbers without character corruption.
- **Filename Convention**: `WaitLink_{shopSlug}_History_{YYYY-MM-DD}_to_{YYYY-MM-DD}.csv`

---

## 8. Cleanup & Purge Lifecycle Engine

### 8.1 Dual Execution Modes
To guarantee retention compliance without requiring expensive continuous backend workers:

1. **Client-Side Lazy Cleanup (On Load)**:
   - When Front Desk or Owner Admin loads for an authenticated shop owner, a lightweight reconciliation runs:
     - Checks records older than the tier limit (`starter_retention_days`, `pro_retention_days`, `enterprise_retention_days`).
     - Prunes expired documents from `shops/{slug}/history/`.
     - Masks PII in records older than `pii_mask_after_days`.
   - Runs in background with batched writes (`db.batch()`) limited to 50 operations at a time to prevent UI latency.

2. **SuperAdmin Scheduled / On-Demand Purge**:
   - SuperAdmin has a `Trigger Cloud Cleanup Now` button in `#superadmin-view` that executes a batch cleanup across all tenant subcollections in sequence.

---

## 9. Backward Compatibility & Migration

1. **Existing Data**:
   - Existing records stored in `shops/{slug}.history[]` are non-destructively read.
   - When Step 3 is activated, existing arrays are seamlessly processed:
     - Items within the active retention window remain accessible.
     - Items exceeding the retention window are cleanly retired.
     - PII masking is applied in real-time display even before background batch writes commit.
2. **Zero Downtime**:
   - No database schema migrations or service interruptions required.

---

## 10. Implementation Status

This architectural design specification is **fully implemented** and operational:

1. **Phase 3A: SuperAdmin Configuration UI & Firestore Listener**:
   - `/settings/retention_config` document structure established.
   - Real-time `initRetentionConfigRealtimeSync()` listener active.
   - SuperAdmin Data Retention Card with live input controls, auto-purge toggle, name mode radios, and `saveRetentionConfig()` implemented.
2. **Phase 3B: In-App History Tier Filtering & Masking Helper**:
   - `maskHistoricalPhone(phone)` and `maskHistoricalName(name, preserveFirstName)` implemented.
   - Front Desk and Owner Admin history tables filtered by active subscription retention window (`starter_retention_days: 7`, `pro_retention_days: 90`, `enterprise_retention_days: 365`).
   - PII auto-masking badge (`🛡️ MASKED`) displayed for records older than 30 days.
   - Customer audit log modal dynamically masks PII.
3. **Phase 3C: Subcollection & Batch Purge Engine**:
   - Two-tier storage active: subcollection `shops/{slug}/history/{ticketId}` populated on call/cancel.
   - Client-side lazy cleanup runs in background on owner load.
   - SuperAdmin manual purge `triggerSuperAdminPurge()` scans all tenant shops and cleans expired documents in batches.
4. **Phase 3D: Tier-Gated CSV Export Generator**:
   - Starter Plan paywall enforced with instant upgrade modal prompt.
   - Pro Business (90d) and Enterprise (365d) exports generated with UTF-8 BOM (`\uFEFF`) and RFC 4180 compliance.
5. **Phase 3E: Validation & Verification**:
   - Verified across all subscription tiers in production.

---

*End of Architectural Specification. Implemented and Active in Production.*
