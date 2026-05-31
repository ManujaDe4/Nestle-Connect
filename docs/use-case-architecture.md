# Nestlé Connect — Unified High-Level Use Case Architecture & Test Mapping

> **Scope:** Full platform — Semester 1 (Core MVP: Campaign Engine, Voucher Lifecycle, Shop QR, ROI Dashboard) + Semester 2 (Tiered Analytics, Cascading Rewards, Customer Loyalty, Campaign-Scoped Claim Fix)
> **Last updated:** 2026-05-31

---

## Section 1: Complete Actor Profiles & Hierarchy

### 1.1 Actor Definitions

| Actor ID | Display Name | Backend Role String(s) | Scope / Boundary |
|----------|-------------|----------------------|-----------------|
| **AC-01** | System Administrator | `admin`, `sys_admin` | Global — no territory restriction; full permission override on all subsystems |
| **AC-02** | Digital Marketing Team | `digital_marketing_manager`, `digital_content_specialist`, `digital_media_performance_manager`, `social_media_influencer_strategist`, `crm_data_analyst`, `digital_marketing_intern` | Global — campaign management, analytics, rewards, customer personalisation |
| **AC-03** | Area Sales Manager (ASM) | `area_sales_manager` | Province-level — territory-scoped to assigned `province` field |
| **AC-04** | Field Sales Manager (FSM) | `field_sales_manager` | Province + Region level — territory-scoped to assigned `province` + `region` |
| **AC-05** | Sales Distributor (SD) | `sales_distributor` | Province + Region + Area level — territory-scoped to assigned `province` + `region` + `area` |
| **AC-06** | End Consumer / Customer | _(no account — identified by `customer_mobile`)_ | External; public endpoints only; no authentication |
| **AC-07** | Retail Shop | _(entity in `shops` table; `owner_mobile` used for SMS)_ | Passive recipient of redemptions and staff-distributed rewards; no login |
| **AC-08** | System (Automated) | _(backend scheduler process)_ | Campaign auto-expiry job; fires every 5 minutes |

---

### 1.2 Actor Inheritance / Generalisation Hierarchy

```
                    ┌──────────────────────┐
                    │       «actor»        │
                    │  Authenticated Staff │
                    └──────────┬───────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
  ┌─────────────────┐  ┌───────────────┐  ┌────────────────────┐
  │     AC-01       │  │     AC-02     │  │  Field Management  │
  │ System Admin    │  │   DM Team     │  │    (abstract)      │
  │ (override all)  │  │ (7 sub-roles) │  └─────────┬──────────┘
  └─────────────────┘  └───────────────┘            │
                                          ┌──────────┼──────────┐
                                          ▼          ▼          ▼
                                     ┌────────┐ ┌────────┐ ┌────────┐
                                     │ AC-03  │ │ AC-04  │ │ AC-05  │
                                     │  ASM   │ │  FSM   │ │   SD   │
                                     │(province│ │(prov+  │ │(prov+  │
                                     │  only) │ │ region)│ │reg+area│
                                     └────────┘ └────────┘ └────────┘
```

**Inheritance & override rules:**

- **AC-01 (System Administrator)** overrides all `CREATABLE_ROLES` and territory restrictions. Can provision any of the 11 valid roles globally. The `MANAGERS` guard (`admin`, `sys_admin`, `area_sales_manager`, `field_sales_manager`) grants user-management access, but only AC-01 is free of role-ceiling and territory constraints.

- **AC-02 (Digital Marketing Team)** is a generalisation of 7 specialised role strings. All share the `authorize(DM_TEAM)` guard for analytics tracks, rewards, and customer loyalty endpoints. Per-role permission flags vary: `digital_marketing_intern` has `stats` only; `digital_marketing_manager` has full scope including `roi`, `campaigns`, `shops`.

- **Field Management (abstract)** generalises AC-03, AC-04, AC-05 into a descending territory hierarchy. Each level can only create roles at the level directly below it (`ASM → FSM + SD`; `FSM → SD only`). Territory assignment of the new account must not exceed the creator's own boundary.

- **AC-06 (End Consumer)** and **AC-07 (Retail Shop)** are external actors. They access only public, unauthenticated endpoints. Consumers are identified solely by `customer_mobile`; shops are identified by `shop_id` / `qr_slug`.

---

## Section 2: High-Level Use Cases Categorisation

### Module 1 — User Management & RBAC Subsystem

| UC ID | Use Case Name | Primary Actor(s) | Endpoint(s) |
|-------|--------------|-----------------|-------------|
| UC-1.1 | Login / Authenticate | Any staff (AC-01–AC-05) | `POST /api/auth/login` |
| UC-1.2 | Create Staff Account | AC-01, AC-03, AC-04 | `POST /api/users` |
| UC-1.3 | List / Search Staff Directory | AC-01, AC-03, AC-04 | `GET /api/users` |
| UC-1.4 | Update Staff Permissions | AC-01, AC-03, AC-04 | `PUT /api/users/:id/permissions` |
| UC-1.5 | Delete Staff Account | AC-01, AC-03, AC-04 | `DELETE /api/users/:id` |
| UC-1.6 | View / Update Own Profile | Any staff | `GET /api/users/me`, `PUT /api/users/me` |
| UC-1.7 | Purge All Non-Admin Accounts | AC-01 only | `DELETE /api/users/purge-all` |

---

### Module 2 — Voucher Lifecycle & Campaign Validation Engine

| UC ID | Use Case Name | Primary Actor(s) | Endpoint(s) |
|-------|--------------|-----------------|-------------|
| UC-2.1 | Create Campaign | AC-01, AC-02 | `POST /api/campaigns` |
| UC-2.2 | Update Campaign | AC-01, AC-02 | `PUT /api/campaigns/:id` |
| UC-2.3 | Manually Expire / Disable Campaign | AC-01, AC-02 | `POST /api/campaigns/expire` |
| UC-2.4 | Auto-Expire Campaign | AC-08 (System scheduler) | _(internal — no HTTP endpoint)_ |
| UC-2.5 | Claim Voucher (Campaign-Scoped) | AC-06 (End Consumer) | `POST /api/vouchers/claim` |
| UC-2.6 | Redeem Voucher at Retail Shop | AC-06, AC-07 | `POST /api/redemptions/start` |
| UC-2.7 | View Campaign Statistics | AC-01, AC-02 | `GET /api/campaigns/:campaign_id/stats` |

---

### Module 3 — Shop & Field Operations Subsystem

| UC ID | Use Case Name | Primary Actor(s) | Endpoint(s) |
|-------|--------------|-----------------|-------------|
| UC-3.1 | Register Retail Shop | AC-05, any staff | `POST /api/shops` |
| UC-3.2 | Link QR Code to Shop | AC-05, any staff | `POST /api/shops/map-qr` |
| UC-3.3 | View / Search Shop Directory | Any staff | `GET /api/shops` |
| UC-3.4 | Export Shop Data (CSV) | Any staff | `GET /api/shops/export/csv` |
| UC-3.5 | Delete Shop | AC-01, AC-05 (own shops) | `DELETE /api/shops/:id` |
| UC-3.6 | View Shop Registration Log | Any staff | `GET /api/shops/log/registrations` |

---

### Module 4 — ROI Analytics & Dashboard

| UC ID | Use Case Name | Primary Actor(s) | Endpoint(s) |
|-------|--------------|-----------------|-------------|
| UC-4.1 | View Dashboard Summary | Any staff + AC-05 | `GET /api/dashboard/summary` |
| UC-4.2 | View ROI Summary & Funnel | AC-01, AC-02 | `GET /api/roi/summary` |
| UC-4.3 | View Campaign-Level ROI | AC-01, AC-02 | `GET /api/roi/campaign/:campaign_id` |
| UC-4.4 | Export ROI Report (CSV) | AC-01, AC-02 | `GET /api/roi/export` |
| UC-4.5 | View Activity Audit Trail | AC-01, AC-02 | `GET /api/activity` |

---

### Module 5 — Tiered Performance Analytics & Personalisation Engine _(Semester 2)_

| UC ID | Use Case Name | Primary Actor(s) | Track | Endpoint |
|-------|--------------|-----------------|-------|---------|
| UC-5.1 | View Top Customers by Redemption Frequency | AC-01, AC-02 | **Track A** | `GET /api/analytics/customers/top` |
| UC-5.2 | View Shop Sales Performance | AC-01, AC-02, AC-03, AC-04 | **Track B-A** | `GET /api/analytics/shops/performance` |
| UC-5.3 | View Field Rep Performance | AC-03, AC-04 | **Track B-B** | `GET /api/analytics/reps/performance` |
| UC-5.4 | View Regional Manager (FSM) Performance | AC-03 (ASM only) | **Track B-C** | `GET /api/analytics/regional-managers/performance` |
| UC-5.5 | View Zonal Manager (ASM) Province Performance | AC-01, AC-02 | **Track B-D** | `GET /api/analytics/zonal-managers/performance` |

---

### Module 6 — Cascading Reward Distribution Subsystem _(Semester 2)_

| UC ID | Use Case Name | Primary Actor(s) | Endpoint(s) |
|-------|--------------|-----------------|-------------|
| UC-6.1 | Issue Reward Allocation to ASM | AC-01, AC-02 | `POST /api/rewards/allocate` |
| UC-6.2 | Distribute Sub-Reward to FSM / SD / Shop | AC-03 (ASM only) | `POST /api/rewards/distribute` |
| UC-6.3 | View Reward Allocations | AC-01, AC-02, AC-03 (own) | `GET /api/rewards/allocations` |
| UC-6.4 | View Reward Distributions | Any staff (role-scoped) | `GET /api/rewards/distributions` |
| UC-6.5 | View My Received Rewards | Any authenticated staff | `GET /api/rewards/my-rewards` |
| UC-6.6 | View Full Reward Audit Trail | AC-01, AC-02 | `GET /api/rewards/audit` |
| UC-6.7 | Issue Customer Loyalty Reward + SMS | AC-01, AC-02 | `POST /api/rewards/customer` |
| UC-6.8 | View All Customer Rewards Issued | AC-01, AC-02 | `GET /api/rewards/customer` |
| UC-6.9 | View Customer Redemption & Reward History | AC-01, AC-02 | `GET /api/rewards/customer/:mobile` |

---

## Section 3: Use Case Relationship Mapping

### 3.1 `<<include>>` Relationships
> A `<<include>>` relationship means the included sub-flow **always** executes as a mandatory part of the base use case — there is no condition.

| Base Use Case | Included Use Case | Rationale / Implementation Trace |
|--------------|-----------------|----------------------------------|
| UC-1.1 Login | **JWT Token Generation** | Every successful login signs a JWT containing `{id, username, role, province, region, area}` — `auth.js: login()` line 51 |
| UC-1.1 Login | **Log Login Activity** | `logActivity()` is always called regardless of success/failure — `auth.js` line 64 |
| UC-1.2 Create Staff Account | **Validate Role Hierarchy (CREATABLE_ROLES)** | `CREATABLE_ROLES` check always runs for non-admin creators — `userController.js` line 168 |
| UC-1.2 Create Staff Account | **Generate Employee ID** | `generateSequentialId()` / prefix lookup always auto-assigns `employee_id` — `userController.js` |
| UC-2.5 Claim Voucher | **Normalise Mobile Number** | `normalizeMobile()` always converts `07x` → `947x` before any DB query — `voucherController.js` line 14 |
| UC-2.5 Claim Voucher | **Validate Campaign Status** | Always checks `status = 'active'` and `end_date > NOW()` — `voucherController.js` lines 17–39 |
| UC-2.5 Claim Voucher | **Generate Claim ID & Voucher Code** | `generateClaimId()` + `generateVoucherCode()` always called on new claim — `voucherController.js` lines 60–61 |
| UC-2.5 Claim Voucher | **Send Voucher SMS to Customer** | `sendSMS()` always fires after successful INSERT — `voucherController.js` lines 73–78 |
| UC-2.6 Redeem Voucher | **Validate Voucher State** | Always checks `claim_status ∉ {redeemed, expired, disabled}` before proceeding — `redemptionController.js` |
| UC-2.6 Redeem Voucher | **Atomic Redemption Transaction** | Always wraps `INSERT redemptions` + `UPDATE vouchers` inside `BEGIN/COMMIT` — `redemptionController.js` |
| UC-2.6 Redeem Voucher | **Send Dual Confirmation SMS** | Always sends to both `customer_mobile` and `shop.owner_mobile` on completion — `redemptionController.js` |
| UC-5.2–UC-5.4 View Analytics | **Apply Territory Scope** | `buildTerritoryScope(user, alias)` always runs — appends `WHERE province=$x AND region=$y` for FSM/ASM; DM Team gets no filter — `analyticsController.js` lines 12–25 |
| UC-6.1 Issue Reward Allocation | **Validate Recipient is ASM** | Always verifies `recipient.role === 'area_sales_manager'` — `rewardsController.js` line ~50 |
| UC-6.1 Issue Reward Allocation | **Generate Allocation ID (ALLOC-xxxxxx)** | `generateSequentialId('ALLOC-', 'reward_allocations', 'allocation_id')` always runs |
| UC-6.1 Issue Reward Allocation | **Write Reward Audit Log** | Always inserts `event_type = 'issued'` into `reward_audit_logs` |
| UC-6.2 Distribute Sub-Reward | **Lock Allocation Row (SELECT FOR UPDATE)** | Transaction always acquires row lock before balance check — prevents concurrent over-distribution |
| UC-6.2 Distribute Sub-Reward | **Calculate Remaining Balance** | `SUM(reward_value) FROM reward_distributions WHERE parent_allocation_id = $1` always runs |
| UC-6.2 Distribute Sub-Reward | **Validate Recipient Territory** | Always checks `recipient.province === req.user.province` |
| UC-6.2 Distribute Sub-Reward | **Write Reward Audit Log** | Always inserts `event_type = 'distributed'` |
| UC-6.7 Issue Customer Loyalty Reward | **Validate Customer Redemption History** | Always queries `redemptions JOIN vouchers WHERE customer_mobile=$1 AND final_status='redeemed'` |
| UC-6.7 Issue Customer Loyalty Reward | **Generate Reward ID (CUST-xxxxxx)** | `generateSequentialId('CUST-', 'customer_rewards', 'reward_id')` always runs |
| UC-6.7 Issue Customer Loyalty Reward | **Send Reward SMS to Customer** | `sendSMS()` always called immediately after INSERT with `sms_type = 'customer_reward'` |
| UC-6.7 Issue Customer Loyalty Reward | **Write Reward Audit Log** | Always inserts `event_type = 'customer_rewarded'` |
| **All authenticated UCs** | **Authenticate (JWT Verification)** | `authenticate` middleware decodes and validates Bearer token — `middleware/auth.js` line 12 |
| **All role-restricted UCs** | **Authorise Role (RBAC Check)** | `authorize(roles[])` middleware checks `req.user.role ∈ allowedRoles` — `middleware/auth.js` line 24 |

---

### 3.2 `<<extend>>` Relationships
> A `<<extend>>` relationship means the extension is **conditional** — it fires only when a specific guard condition is true.

| Base Use Case | Extension Use Case | Guard Condition |
|--------------|-------------------|----------------|
| UC-2.5 Claim Voucher | **Block Duplicate Campaign Claim** | `∃ row IN vouchers WHERE customer_mobile = $1 AND campaign_id = $2` — `voucherController.js` lines 42–58 |
| UC-2.5 Claim Voucher | **Auto-Heal to Active Campaign** | Requested `campaign_id` is expired, disabled, or not found — system substitutes the latest `status='active'` campaign — `voucherController.js` lines 24–38 |
| UC-2.5 Claim Voucher | **Reject: No Active Campaign Exists** | Auto-heal query returns 0 rows — no campaign at all is available |
| UC-2.6 Redeem Voucher | **Reject Expired / Disabled Voucher** | `voucher.claim_status ∈ {redeemed, expired, disabled}` at time of request |
| UC-1.2 Create Staff Account | **Override: Sysadmin Bypass** | `req.user.role ∈ {admin, sys_admin}` — CREATABLE_ROLES and territory checks are entirely skipped |
| UC-1.2 Create Staff Account | **Block: Exceeds Role Ceiling** | Requested role ∉ `CREATABLE_ROLES[req.user.role]` for non-admin creators (e.g. FSM tries to create FSM) |
| UC-1.2 Create Staff Account | **Block: Territory Mismatch** | New user's `province` / `region` falls outside the creator's own assigned territory |
| UC-6.2 Distribute Sub-Reward | **Block Over-Distribution** | `reward_value > (allocation.reward_value − SUM(existing_distributions))` — `rewardsController.js` lines 155–162 |
| UC-6.2 Distribute Sub-Reward | **Mark Allocation as Distributed** | `SUM(all_distributions) ≥ allocation.reward_value` after this distribution is inserted — status updated to `'distributed'` |
| UC-6.2 Distribute Sub-Reward | **Block: Recipient Outside Province** | `recipient.province ≠ req.user.province` — territory boundary violation |
| UC-5.1–UC-5.5 View Analytics | **Block: Insufficient Role (403)** | Requesting actor's role ∉ the authorised set for that specific analytics track |
| UC-6.7 Issue Customer Loyalty Reward | **Block: No Redemption History** | Target `customer_mobile` has zero rows in `redemptions` with `final_status = 'redeemed'` |
| **Any UC using JWT** | **Reject: Token Expired or Invalid (401)** | JWT is missing, malformed, or past its 1-hour expiry |

---

## Section 4: Unified Use Case to Test Case Matrix

| System Module | Use Case Name | Primary Actor | Interacting Secondary Actor(s) | Core Use Case Description | High-Level Test Scenario Target |
|---------------|--------------|---------------|-------------------------------|--------------------------|--------------------------------|
| User Management & RBAC | Login / Authenticate | Any Staff (AC-01–AC-05) | System (JWT issuer, activity logger) | Staff submits credentials; system validates, issues signed JWT, logs login event | **TC_01–TC_04:** Valid admin credentials → redirect + JWT; rep login → rep dashboard; invalid password → error; empty fields → validation block |
| User Management & RBAC | Create Staff Account — Sysadmin Bypass | AC-01 (Sys Admin) | System (employee ID generator) | Sysadmin creates any of the 11 valid roles with no restriction; CREATABLE_ROLES and territory constraints fully bypassed | **TC_50–TC_52:** All 11 roles return HTTP 201; zero 403 responses from sysadmin |
| User Management & RBAC | Create Staff Account — Role Ceiling Enforcement | AC-04 (FSM) | System | FSM attempts to create a peer FSM; blocked by CREATABLE_ROLES ceiling | **TC_53:** FSM POST with `role: field_sales_manager` → HTTP 403 |
| User Management & RBAC | Create Staff Account — Territory Enforcement | AC-04 (FSM) | System | FSM attempts to create SD in a province/region outside their assignment | **TC_55:** Province/region mismatch → HTTP 400 or 403; no user created |
| User Management & RBAC | Create Staff Account — ASM Valid Path | AC-03 (ASM) | System | ASM creates FSM within their own province; should succeed | **TC_56:** HTTP 201; FSM-prefixed employee ID; correct province stored |
| Voucher Lifecycle & Campaign Validation | Create / Configure Campaign | AC-02 (DM Team), AC-01 | System (auto-expiry scheduler) | DM Team creates campaign with budget, timeline, and voucher limit; system adds to active pool | Positive: HTTP 201, `status = active`; validation failure (missing dates) → HTTP 400 |
| Voucher Lifecycle & Campaign Validation | Claim Voucher — First Claim Success | AC-06 (End Consumer) | System (code gen, SMS, DB) | Customer submits valid mobile; system validates campaign, inserts voucher row, sends SMS | **TC_40, TC_60:** HTTP 201, `already_claimed: false`, voucher code non-empty, SMS sent |
| Voucher Lifecycle & Campaign Validation | Claim Voucher — Duplicate Campaign Blocked | AC-06 | System (unique index `uq_vouchers_mobile_campaign`) | Same mobile attempts a second claim against the same campaign; blocked at app layer (and DB constraint as backstop) | **TC_61:** Same mobile + same campaign_id → HTTP 200, `already_claimed: true`; no new row inserted |
| Voucher Lifecycle & Campaign Validation | Claim Voucher — Cross-Campaign Allowed | AC-06 | System | Same mobile submits a claim against a different campaign; must succeed | **TC_62:** Same mobile, different campaign_id → HTTP 201, `already_claimed: false`; two rows in `vouchers` |
| Voucher Lifecycle & Campaign Validation | Claim Voucher — Campaign vs. Ad Boundary | AC-06 | System | Different `ad_id` but same `campaign_id`; uniqueness boundary is campaign, not ad | **TC_63:** Different ad_id, same campaign → `already_claimed: true` |
| Voucher Lifecycle & Campaign Validation | Claim Voucher — Auto-Heal to Active Campaign | AC-06 | System | Expired `campaign_id` submitted; system silently substitutes the latest active campaign | **TC_64:** Expired campaign_id → response voucher shows new active `campaign_id`; no error |
| Voucher Lifecycle & Campaign Validation | Claim Voucher — No Active Campaign | AC-06 | System | No active campaign exists; auto-heal finds nothing | **TC_65:** HTTP 400; message: "Campaign is disabled and not accepting claims" |
| Voucher Lifecycle & Campaign Validation | Redeem Voucher at Shop | AC-06, AC-07 | System (atomic txn, dual SMS) | Consumer/shop enters voucher code; system validates, atomically marks redeemed, sends SMS receipts to both customer and shop owner | Positive: HTTP 201, `final_status = redeemed`, dual SMS logged; Negative: already-redeemed code → HTTP 400 |
| Shop & Field Operations | Register Retail Shop | AC-05 (SD), any staff | System (shop_id gen, QR slug gen) | Rep submits shop details; system auto-generates geographically-encoded shop ID | **TC_14:** All fields → HTTP 201, shop_id format `SHP-WES-COL-xxxxxx`; **TC_15:** Missing required fields → no shop created |
| Shop & Field Operations | Link QR Code to Shop | AC-05, any staff | System | Staff maps physical QR identifier string to shop record | **TC_25:** Valid QR + shop selected → success message; **TC_26:** Empty QR field → error message |
| ROI Analytics & Dashboard | View Dashboard Summary | Any staff + AC-05 | System (aggregation queries) | Aggregated totals: claims, redemptions, conversion rate, best campaign | All staff roles → HTTP 200 with summary figures |
| ROI Analytics & Dashboard | View ROI Analytics + Export | AC-01, AC-02 | System | Conversion funnel, per-platform rates, 30-day trend, geographic breakdown, CSV export | HTTP 200 with `total_claims`, `total_redeemed`; CSV download returns valid data |
| Tiered Performance Analytics | View Top Customers — Track A | AC-02 (DM Team) | System (redemption aggregation) | DM Team sees ranked customer list by total redemption count; unrestricted global view | **TC_70:** DM Team → HTTP 200, `{ customers: [...] }`; **TC_76:** ASM → HTTP 403 |
| Tiered Performance Analytics | View Zonal Manager Performance — Track B-D | AC-02 (DM Team) | System | Province-level aggregate metrics per ASM; visible to DM Team only | **TC_71:** DM Team → HTTP 200; **TC_77:** ASM → HTTP 403 |
| Tiered Performance Analytics | View Shop Performance — Track B-A (Province-Scoped) | AC-03 (ASM), AC-02 | System (territory filter) | ASM sees shops within their province only; DM Team sees all globally | **TC_72:** ASM → Western province shops only; **TC_79:** SD → HTTP 403 |
| Tiered Performance Analytics | View Regional Manager Performance — Track B-C | AC-03 (ASM) | System | ASM views FSM-level metrics scoped to their province | **TC_73:** ASM → own-province FSMs only; **TC_78:** FSM → HTTP 403 |
| Tiered Performance Analytics | View Field Rep Performance — Track B-B (Region-Scoped) | AC-03, AC-04 | System (territory filter) | FSM sees SDs in their region; ASM sees all SDs in province | **TC_74:** FSM → Colombo-region SDs only; **TC_75:** FSM → Colombo-region shops only |
| Cascading Reward Distribution | Issue Reward Allocation to ASM | AC-02 (DM Team) | AC-03 (recipient ASM), System (audit log) | DM Team selects top-performing ASM, issues named allocation with value; audit log entry created | **TC_90:** HTTP 201, `allocation_id = ALLOC-xxxxxx`, `status = issued`, audit log `event_type = issued` |
| Cascading Reward Distribution | Block Non-DM from Issuing Allocation | AC-03 (ASM) | — | ASM attempts to issue a top-level allocation; blocked by role guard | **TC_91:** ASM → HTTP 403 |
| Cascading Reward Distribution | Block Allocation to Non-ASM Recipient | AC-02 (DM Team) | AC-04 (FSM as mistaken recipient) | DM Team attempts to allocate to an FSM; role validation rejects it | **TC_92:** Recipient is FSM → HTTP 400, role restriction message |
| Cascading Reward Distribution | Distribute to FSM (Regional Manager) | AC-03 (ASM) | AC-04 (FSM), System | ASM sub-distributes portion of their allocation to an FSM within province | **TC_93:** `recipient_type: regional_manager` → HTTP 201, `DIST-xxxxxx` created |
| Cascading Reward Distribution | Distribute to Sales Distributor | AC-03 (ASM) | AC-05 (SD), System | ASM distributes reward to a sales distributor within province | **TC_94:** `recipient_type: field_rep` → HTTP 201 |
| Cascading Reward Distribution | Distribute to Retail Shop | AC-03 (ASM) | AC-07 (Shop), System | ASM distributes reward to a shop entity within province | **TC_95:** `recipient_type: shop` → HTTP 201 |
| Cascading Reward Distribution | Block Over-Distribution (Guard) | AC-03 (ASM) | System (FOR UPDATE lock + balance calc) | Requested distribution value exceeds remaining allocation balance; transaction rolled back | **TC_96:** value > remaining → HTTP 400 with remaining balance in message; no row inserted |
| Cascading Reward Distribution | Full Distribution — Allocation Status Lifecycle | AC-03 (ASM) | System | Final distribution exactly exhausts remaining balance; allocation status auto-updates | **TC_97:** Exactly remaining value → HTTP 201; `allocation.status = distributed` |
| Cascading Reward Distribution | Block Cross-Province Distribution | AC-03 (ASM) | System | Recipient's province does not match ASM's assigned province | **TC_98:** Cross-province recipient → HTTP 400 "Recipient is outside your province" |
| Cascading Reward Distribution | Role-Scoped Distribution View | AC-04 (FSM) | System | FSM views GET /distributions; sees only their own received distributions | **TC_99:** FSM → rows where `recipient_user_id = <fsm_id>` only |
| Cascading Reward Distribution | Full Reward Audit Trail | AC-02 (DM Team) | System | DM Team retrieves complete immutable event log in chronological order | **TC_100:** GET /rewards/audit → array with `issued`, `distributed` events; `actor_username`, `detail` JSON present |
| Cascading Reward Distribution | Issue Customer Loyalty Reward | AC-02 (DM Team) | AC-06 (customer, SMS recipient), System (audit log) | DM Team issues personalised reward to top consumer; SMS notification sent immediately on insert | **TC_101:** Confirmed customer → HTTP 201, `CUST-xxxxxx`, `sms_sent: true`, `status: notified`, audit `customer_rewarded` |
| Cascading Reward Distribution | Block Customer Reward — No Redemption History | AC-02 (DM Team) | System | Target mobile has no confirmed redemptions; eligibility gate rejects | **TC_102:** Unknown mobile → HTTP 400 "No redemption history found" |
| Cascading Reward Distribution | View All Customer Rewards | AC-02 (DM Team) | System | DM Team lists all customer rewards with redemption context per customer | **TC_103:** GET /rewards/customer → list with `customer_total_redemptions`, `sms_sent`, `status` |
| RBAC — Visibility Boundaries | Block SD from All Analytics | AC-05 (SD) | — | SD attempts any analytics endpoint; all must return 403 | **TC_79:** Three analytics endpoints all → HTTP 403 for SD role |
| RBAC — Visibility Boundaries | Block FSM from Customer Rewards Listing | AC-04 (FSM) | — | FSM attempts GET /rewards/customer; blocked | **TC_80:** FSM → HTTP 403 |
| RBAC — Visibility Boundaries | Block ASM from Customer Rewards Issuance | AC-03 (ASM) | — | ASM attempts POST /rewards/customer; blocked | **TC_81:** ASM → HTTP 403 |
| RBAC — Visibility Boundaries | Block SD from Reward Audit Trail | AC-05 (SD) | — | SD attempts GET /rewards/audit; blocked | **TC_82:** SD → HTTP 403 |
| RBAC — Visibility Boundaries | Block Unauthenticated Requests | None (no token) | — | Any protected endpoint called without a Bearer token | **TC_83:** No `Authorization` header → HTTP 401 "Access denied" |
