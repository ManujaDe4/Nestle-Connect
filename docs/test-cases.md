# Nestlé Connect — System Test Cases

> **Version:** Post-sprint (Tiered Analytics, Rewards Distribution, Customer Loyalty, Campaign-Scoped Claims)
> **Last updated:** 2026-05-31
>
> **Schema:** Test ID | Feature/Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome
>
> **Existing Playwright tests:** TC_01–TC_04 (Auth), TC_14–TC_15 (Shop Reg), TC_25–TC_26 (QR Mapping), TC_40–TC_41 (Consumer Claim)
> **New test cases start at:** TC_50

---

## Module 1: Authentication (Existing)

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_01 | Login — Admin Success | Admin | Default admin exists: `sysadmin / password` | 1. Navigate to `login.html`. 2. Enter Employee ID `SYS-000001`, password `password`. 3. Click Sign In. | Redirect to `admin-dashboard.html`. JWT stored in `localStorage`. |
| TC_02 | Login — Rep Success | Sales Distributor | Rep `SD-WES-COL-000001` exists with password `123456` | 1. Navigate to `login.html`. 2. Enter credentials. 3. Click Sign In. | Redirect to `rep-dashboard.html`. JWT stored in `localStorage`. |
| TC_03 | Login — Invalid Password | Any staff | Valid user exists | 1. Enter valid Employee ID, wrong password. 2. Click Sign In. | Stay on `login.html`. Error message displayed. No JWT issued. |
| TC_04 | Login — Empty Fields | Any | None | 1. Leave both fields empty. 2. Click Sign In. | Stay on `login.html`. Validation error shown. |

---

## Module 2: Shop Registration (Existing)

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_14 | Shop Reg — Valid Submit | Sales Distributor | Logged in as `SD-WES-COL-000001` | 1. Navigate to `shop-owner-registration.html`. 2. Fill shop name, mobile, NIC, select area "Dehiwala". 3. Submit. | Success message visible within 15s. QR section appears within 10s. Shop row created in DB. |
| TC_15 | Shop Reg — Missing Fields | Sales Distributor | Logged in as SD | 1. Fill only mobile field, leave shop name and NIC empty. 2. Submit. | QR section remains hidden. No shop inserted. Validation feedback shown. |

---

## Module 3: QR Mapping (Existing)

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_25 | QR Map — Valid Link | Sales Distributor | Logged in as SD. A shop exists in dropdown. | 1. Navigate to `qr-mapping.html`. 2. Select shop. 3. Enter unique QR code. 4. Click "Link QR Code". | Green success message: "Successfully Linked" within 10s. `qr_identifier` updated in shops table. |
| TC_26 | QR Map — Missing QR | Sales Distributor | Logged in as SD. Shop selected. | 1. Select shop. 2. Leave QR code empty. 3. Click "Link QR Code". | Red error: "Please enter or scan a QR code". No DB update. |

---

## Module 4: Consumer Claim Flow (Existing)

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_40 | Valid Mobile Claim | End Consumer | Active campaign exists | 1. Navigate to `claim-offer.html`. 2. Enter mobile `0773369997`. 3. Click Claim. | Success section visible. Voucher code generated and non-empty. SMS sent. |
| TC_41 | Invalid Mobile Format | End Consumer | None | 1. Navigate to `claim-offer.html`. 2. Enter `12345` (invalid format). 3. Click Claim. | Error message: "Invalid mobile number format". No voucher created. |

---

## Module 5: Staff Provisioning & Role Hierarchy

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_50 | Sysadmin — Create DM Role | Admin / Sys Admin | Logged in as `sysadmin` (role: `admin`). Valid JWT. | 1. `POST /api/users` body: `{ username: "test_dmm", password: "pass123", role: "digital_marketing_manager" }`, header: `Authorization: Bearer <token>`. | HTTP 201. `employee_id` prefixed `DMM-`. User created in DB with correct `digital_marketing_manager` role and default permissions. |
| TC_51 | Sysadmin — Create ASM | Admin / Sys Admin | Logged in as `sysadmin`. | 1. `POST /api/users` body: `{ username: "test_asm", password: "pass", role: "area_sales_manager", province: "Western" }`. | HTTP 201. `employee_id` prefixed `ASM-`. `province = 'Western'` stored. |
| TC_52 | Sysadmin — Bypass Forbidden on Any Role | Admin / Sys Admin | Logged in as `sysadmin`. | 1. POST `/api/users` for each of the 11 valid roles in sequence (unique usernames). 2. Collect all HTTP status codes. | All 11 requests return HTTP 201. Zero 403 responses. Confirms sysadmin is unrestricted by `CREATABLE_ROLES` hierarchy. |
| TC_53 | FSM Cannot Create FSM (Role Ceiling) | Field Sales Manager | Logged in as FSM. Valid JWT. | 1. `POST /api/users` body: `{ role: "field_sales_manager", ... }` with FSM Bearer token. | HTTP 403 Forbidden. Message indicates FSM may only create `sales_distributor`. No user created. |
| TC_54 | ASM Cannot Create DM Staff | Area Sales Manager | Logged in as ASM. Valid JWT. | 1. `POST /api/users` body: `{ role: "digital_marketing_manager", ... }` with ASM Bearer token. | HTTP 403 Forbidden. `digital_marketing_manager` is outside `CREATABLE_ROLES` for ASM. No user created. |
| TC_55 | Territory Enforcement — FSM Cannot Create SD Outside Region | Field Sales Manager | FSM assigned to Western / Colombo. Valid JWT. | 1. `POST /api/users` body: `{ role: "sales_distributor", province: "Central", region: "Kandy" }` with FSM Bearer token. | HTTP 403 or 400. Province/region mismatch detected. No SD created in Central/Kandy. |
| TC_56 | ASM Creates FSM Within Own Province | Area Sales Manager | ASM assigned to Western province. Valid JWT. | 1. `POST /api/users` body: `{ role: "field_sales_manager", province: "Western", region: "Colombo" }` with ASM Bearer token. | HTTP 201. FSM created with `province = 'Western'`, `region = 'Colombo'`. `employee_id` prefixed `FSM-`. |

---

## Module 6: Campaign-Scoped Voucher Claim Isolation

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_60 | First Claim on Campaign A — Success | End Consumer | Active Campaign A (`campaign_id: "CAMP_A"`, future `end_date`). No prior vouchers for mobile `0771111001`. | 1. `POST /api/vouchers/claim` body: `{ customer_mobile: "0771111001", campaign_id: "CAMP_A", ad_id: "AD001", platform: "facebook" }`. | HTTP 201. `already_claimed: false`. Voucher row inserted with `claim_status = 'claimed'`. `uq_vouchers_mobile_campaign` index row created for `(0771111001, CAMP_A)`. SMS sent to customer. |
| TC_61 | Duplicate Claim on Campaign A — Blocked | End Consumer | Voucher for `(0771111001, CAMP_A)` already exists (TC_60 ran). | 1. `POST /api/vouchers/claim` with same `customer_mobile = "0771111001"` and `campaign_id: "CAMP_A"`. | HTTP 200. `already_claimed: true`. Existing voucher returned in response body. No new row inserted. (DB-level: `uq_vouchers_mobile_campaign` would also reject via error 23505 if application check bypassed.) |
| TC_62 | Cross-Campaign Claim — Allowed | End Consumer | Voucher for `(0771111001, CAMP_A)` exists. Active Campaign B (`campaign_id: "CAMP_B"`) exists. | 1. `POST /api/vouchers/claim` body: `{ customer_mobile: "0771111001", campaign_id: "CAMP_B", ad_id: "AD001" }`. | HTTP 201. `already_claimed: false`. New voucher row for `(0771111001, CAMP_B)` created. Both rows coexist in `vouchers` table. Confirms campaign-boundary isolation. |
| TC_63 | Different Ad, Same Campaign — Still Blocked | End Consumer | Voucher for `(0771111002, CAMP_A)` with `ad_id: "AD001"` exists. | 1. `POST /api/vouchers/claim` body: `{ customer_mobile: "0771111002", campaign_id: "CAMP_A", ad_id: "AD002" }` (different ad, same campaign). | HTTP 200. `already_claimed: true`. Confirms uniqueness is enforced at campaign boundary, not at ad boundary. |
| TC_64 | Auto-Heal to Active Campaign | End Consumer | Campaign `OLD_CAMP` status is `expired`. An active campaign `NEW_CAMP` exists. | 1. `POST /api/vouchers/claim` body: `{ customer_mobile: "0771111003", campaign_id: "OLD_CAMP", ad_id: "AD001" }`. | HTTP 201. Response voucher has `campaign_id = "NEW_CAMP"` (auto-healed). No 404 or 400 returned. Customer receives valid voucher under the active campaign. |
| TC_65 | No Active Campaign — Fail Gracefully | End Consumer | All campaigns are `expired` or `disabled`. | 1. `POST /api/vouchers/claim` with any `campaign_id`. | HTTP 400. Message: `"Campaign is disabled and not accepting claims"`. No voucher inserted. |

---

## Module 7: Data Visibility Boundaries

### Positive Tests — Authorised Access Succeeds

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_70 | DM Team — Top Customers Analytics | Digital Marketing Manager | Logged in as `digital_marketing_manager`. At least one confirmed redemption exists. | 1. `GET /api/analytics/customers/top` with DM Team Bearer token. | HTTP 200. JSON `{ customers: [...] }`. Each row contains `customer_mobile`, `total_redemptions`, `first_redemption`, `last_redemption`. |
| TC_71 | DM Team — Zonal Manager Performance | Digital Marketing Manager | At least one ASM exists. | 1. `GET /api/analytics/zonal-managers/performance` with DM Team Bearer token. | HTTP 200. `{ zonal_managers: [...] }`. Each row has `province`, `aggregate_sales`, `shops_in_province`, `active_campaigns`. |
| TC_72 | ASM — Province-Scoped Shop Performance | Area Sales Manager | ASM assigned to Western. Shops exist in both Western and Central provinces. | 1. `GET /api/analytics/shops/performance` with ASM Bearer token. | HTTP 200. All returned shops have `province = 'Western'`. No Central shops included. Territory scoping confirmed. |
| TC_73 | ASM — Regional Manager Performance | Area Sales Manager | ASM and FSMs exist in Western province. | 1. `GET /api/analytics/regional-managers/performance` with ASM Bearer token. | HTTP 200. Returns only FSMs in `province = 'Western'`. |
| TC_74 | FSM — Region-Scoped Rep Performance | Field Sales Manager | FSM assigned to Western / Colombo. SDs exist in both Colombo and Gampaha regions. | 1. `GET /api/analytics/reps/performance` with FSM Bearer token. | HTTP 200. Only returns SDs with `region = 'Colombo'`. Gampaha SDs absent. |
| TC_75 | FSM — Region-Scoped Shop Performance | Field Sales Manager | Same pre-conditions as TC_74. | 1. `GET /api/analytics/shops/performance` with FSM Bearer token. | HTTP 200. Only shops with `province = 'Western'` AND `region = 'Colombo'` returned. |

### Negative Tests — Unauthorised Access Blocked

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_76 | ASM — Blocked from Customer Analytics | Area Sales Manager | Logged in as ASM. Valid JWT. | 1. `GET /api/analytics/customers/top` with ASM Bearer token. | HTTP 403 Forbidden. Message cites role restriction. Customer personalisation data is DM-Team-exclusive. |
| TC_77 | ASM — Blocked from Zonal Performance View | Area Sales Manager | Logged in as ASM. | 1. `GET /api/analytics/zonal-managers/performance` with ASM Bearer token. | HTTP 403 Forbidden. ASMs cannot view peer zonal performance — reserved for DM Team only. |
| TC_78 | FSM — Blocked from Regional Manager Analytics | Field Sales Manager | Logged in as FSM. | 1. `GET /api/analytics/regional-managers/performance` with FSM Bearer token. | HTTP 403 Forbidden. This view is reserved for ASM only. |
| TC_79 | SD — Blocked from All Analytics Endpoints | Sales Distributor | Logged in as SD. Valid JWT. | 1. `GET /api/analytics/shops/performance`. 2. `GET /api/analytics/reps/performance`. 3. `GET /api/analytics/customers/top`. (Each with SD Bearer token.) | All three return HTTP 403. SD role has zero access to analytics endpoints. |
| TC_80 | FSM — Cannot View Customer Rewards | Field Sales Manager | Logged in as FSM. | 1. `GET /api/rewards/customer` with FSM Bearer token. | HTTP 403. Customer loyalty rewards listing is DM-Team-exclusive. |
| TC_81 | ASM — Cannot Issue Customer Rewards | Area Sales Manager | Logged in as ASM. | 1. `POST /api/rewards/customer` body: `{ customer_mobile: "0771234567", reward_type: "monetary", reward_description: "test" }` with ASM Bearer token. | HTTP 403. Issuing customer loyalty rewards is DM-Team-exclusive. |
| TC_82 | SD — Cannot View Reward Audit Trail | Sales Distributor | Logged in as SD. | 1. `GET /api/rewards/audit` with SD Bearer token. | HTTP 403. Audit trail is restricted to admin and DM Team. |
| TC_83 | Unauthenticated Request — Blocked | None (no token) | Server running. | 1. `GET /api/analytics/shops/performance` with no `Authorization` header. | HTTP 401. Message: `"Access denied"`. No data returned. |

---

## Module 8: Top-Down Cascading Reward Execution

| Test ID | Feature / Module | Targeted Actor | Pre-conditions | Step-by-Step Test Actions | Expected Technical Outcome |
|---------|-----------------|----------------|----------------|--------------------------|---------------------------|
| TC_90 | DM Team Issues Allocation to ASM | Digital Marketing Team → ASM | Logged in as `digital_marketing_manager`. An ASM user exists (record ID available). | 1. `POST /api/rewards/allocate` body: `{ recipient_id: <asm_id>, reward_type: "monetary", reward_value: 50000, reward_description: "Q1 Top Province Award" }` with DM Team Bearer token. | HTTP 201. Response: `allocation_id = "ALLOC-000001"`, `status = "issued"`. Row inserted in `reward_allocations`. Row in `reward_audit_logs` with `event_type = "issued"`, `actor_id = <dm_user_id>`. |
| TC_91 | Non-DM Cannot Issue Allocation | Area Sales Manager | Logged in as ASM. Valid JWT. | 1. `POST /api/rewards/allocate` with same body and ASM Bearer token. | HTTP 403 Forbidden. Allocation issuance is restricted to DM Team. |
| TC_92 | Cannot Allocate to Non-ASM Role | Digital Marketing Manager | Logged in as DM. Target user has role `field_sales_manager`. | 1. `POST /api/rewards/allocate` body: `{ recipient_id: <fsm_id>, reward_value: 10000, ... }`. | HTTP 400. Message: `"Rewards can only be allocated to Zonal Managers (area_sales_manager)."` No row inserted. |
| TC_93 | ASM Distributes Portion to FSM | Area Sales Manager | ASM is recipient of `ALLOC-000001` (value: 50000, undistributed). An FSM exists in ASM's province. | 1. `POST /api/rewards/distribute` body: `{ parent_allocation_id: <alloc_id>, recipient_type: "regional_manager", recipient_user_id: <fsm_id>, reward_type: "monetary", reward_value: 15000, reward_description: "Region Q1 award" }` with ASM Bearer token. | HTTP 201. `distribution_id = "DIST-000001"`. Row in `reward_distributions`. Audit log entry `event_type = "distributed"`. Remaining balance = 35000. |
| TC_94 | ASM Distributes Portion to SD | Area Sales Manager | Same allocation (35000 remaining). An SD exists in ASM's province. | 1. `POST /api/rewards/distribute` body: `{ ..., recipient_type: "field_rep", recipient_user_id: <sd_id>, reward_value: 10000 }`. | HTTP 201. `distribution_id = "DIST-000002"`. Remaining balance = 25000. |
| TC_95 | ASM Distributes Portion to Shop | Area Sales Manager | Same allocation (25000 remaining). A shop exists in ASM's province. | 1. `POST /api/rewards/distribute` body: `{ ..., recipient_type: "shop", recipient_shop_id: <shop_db_id>, reward_value: 5000 }`. | HTTP 201. `distribution_id = "DIST-000003"`. Allocation `total_distributed` = 30000. Remaining = 20000. |
| TC_96 | Over-Distribution Guard — Blocked | Area Sales Manager | Allocation value = 50000. Total distributed = 30000. Remaining = 20000. | 1. `POST /api/rewards/distribute` body: `{ ..., reward_value: 25000 }` (exceeds remaining by 5000). | HTTP 400. Message includes `"Distribution would exceed remaining allocation balance"` and the remaining figure (20000). No row inserted. PostgreSQL transaction rolled back. |
| TC_97 | Full Distribution — Status Updated | Area Sales Manager | Same allocation. Remaining = 20000. | 1. `POST /api/rewards/distribute` body: `{ ..., reward_value: 20000 }` (exactly remaining). | HTTP 201. Final distribution created. `reward_allocations.status` updated to `"distributed"`. No further distributions possible against this allocation. |
| TC_98 | Cross-Province Distribution — Blocked | Area Sales Manager | ASM assigned to Western. Target FSM is in Central province. | 1. `POST /api/rewards/distribute` body: `{ ..., recipient_user_id: <central_fsm_id>, reward_value: 5000 }`. | HTTP 400. Message: `"Recipient is outside your province."` No distribution created. |
| TC_99 | FSM Sees Only Their Own Distributions | Field Sales Manager | FSM was recipient of `DIST-000001`. Other distributions exist for other recipients. | 1. `GET /api/rewards/distributions` with FSM Bearer token. | HTTP 200. Response contains only distributions where `recipient_user_id = <fsm_id>`. Other users' distributions not included. |
| TC_100 | DM Team Sees Full Audit Trail | Digital Marketing Manager | Rewards allocated and distributed (TC_90–TC_97 completed). | 1. `GET /api/rewards/audit` with DM Team Bearer token. | HTTP 200. `audit_logs` array contains all events in chronological order: `"issued"` and `"distributed"` entries. Each entry has `actor_username`, `actor_role`, `allocation_ref`, `distribution_ref`, `detail` JSON. |
| TC_101 | Customer Reward Issued with SMS | Digital Marketing Manager | Customer mobile `0772222001` has ≥1 confirmed redemption (`final_status = 'redeemed'` in `redemptions`). | 1. `POST /api/rewards/customer` body: `{ customer_mobile: "0772222001", reward_type: "product_gift", reward_description: "Free Nestlé bundle for top loyalty" }` with DM Team token. | HTTP 201. `reward_id = "CUST-000001"`. `sms_sent: true`. Row in `customer_rewards` with `status = "notified"`. Row in `sms_logs` with `sms_type = "customer_reward"`, `related_id = "CUST-000001"`. Audit log entry `event_type = "customer_rewarded"`. |
| TC_102 | Cannot Reward Customer with No History | Digital Marketing Manager | Mobile `0779999999` has zero redemption history. | 1. `POST /api/rewards/customer` body: `{ customer_mobile: "0779999999", reward_type: "monetary", reward_description: "test" }`. | HTTP 400. Message: `"No redemption history found for this mobile number. Only customers with confirmed redemptions can be rewarded."` No reward row inserted. |
| TC_103 | DM Team Views All Customer Rewards | Digital Marketing Manager | At least one customer reward has been issued (TC_101 ran). | 1. `GET /api/rewards/customer` with DM Team Bearer token. | HTTP 200. `customer_rewards` array. Each row includes `reward_id`, `customer_mobile`, `customer_total_redemptions`, `reward_type`, `reward_value`, `sms_sent`, `status`, `issued_by_username`, `created_at`. |
