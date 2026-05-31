# Nestlé Connect — Use Cases & Actors Mapping

> **Version:** Post-sprint (Tiered Analytics, Rewards Distribution, Customer Loyalty, Campaign-Scoped Claims)
> **Last updated:** 2026-05-31

---

## Actors

| Actor ID | Actor | Category | Identity Type |
|----------|-------|----------|---------------|
| A-01 | **Admin / Sys Admin** | Platform Core | Staff account (`admin`, `sys_admin`) |
| A-02 | **Digital Marketing Team** | Central Team | Staff accounts: `digital_marketing_manager`, `digital_content_specialist`, `digital_media_performance_manager`, `social_media_influencer_strategist`, `crm_data_analyst`, `digital_marketing_intern` |
| A-03 | **Area Sales Manager (ASM)** | Zonal Manager | Staff account, scoped to **province** |
| A-04 | **Field Sales Manager (FSM)** | Regional Manager | Staff account, scoped to **province + region** |
| A-05 | **Sales Distributor (SD)** | Field Representative | Staff account, scoped to **province + region + area** |
| A-06 | **Retail Shop** | Business Entity | Row in `shops` table — identified by `shop_id`, contacted via `owner_mobile` |
| A-07 | **End Consumer / Customer** | External User | No account — identified solely by `customer_mobile` in transactional data |
| A-08 | **System (Automated)** | Backend Process | Campaign expiry scheduler (runs every 5 minutes) |

---

## Use Cases

---

### UC-01: User Provisioning

| Field | Detail |
|-------|--------|
| **Name** | Register / Create Staff Account |
| **Primary Actor** | Admin (A-01), Sys Admin (A-01), ASM (A-03), FSM (A-04) |
| **Secondary Actors** | System — auto-generates `employee_id` with role-specific prefix (e.g. `ASM-000001`, `DMM-000001`) |
| **Description** | Authorised managers create subordinate staff accounts. Role hierarchy is strictly enforced server-side. Admin/sys_admin can create any of the 11 valid roles without restriction. ASM can create FSM and SD within their own province. FSM can only create SD within their own province+region. The system auto-assigns an employee ID based on role prefix and sequence. |
| **Roles Allowed to Create** | `admin`/`sys_admin` → any role; `area_sales_manager` → `field_sales_manager`, `sales_distributor`; `field_sales_manager` → `sales_distributor` |
| **Constraints** | A manager cannot create a role equal to or above their own. Territory assignment must fall within the creator's assigned province/region. Field manager permissions are fixed and cannot be edited post-creation. |
| **Endpoint** | `POST /api/users` — requires `MANAGERS` guard |

---

### UC-02: Authentication & Session Management

| Field | Detail |
|-------|--------|
| **Name** | Staff Login |
| **Primary Actor** | Any staff account (A-01 – A-05) |
| **Secondary Actors** | System — issues signed JWT, writes login event to `activity_logs` |
| **Description** | Staff authenticate using `username` or `employee_id` plus `password`. On success, a signed JWT (1-hour expiry) is returned containing `id`, `username`, `role`, `province`, `region`, `area`. The token must be included as `Bearer <token>` in all subsequent protected requests. Login activity is always logged regardless of outcome. |
| **Endpoint** | `POST /api/auth/login` — public, no auth required |

---

### UC-03: Shop Registration & QR Linking

| Field | Detail |
|-------|--------|
| **Name** | Register a Retail Shop and Link a Physical QR Code |
| **Primary Actor** | Sales Distributor (A-05) |
| **Secondary Actors** | Any staff (can also register); System — generates `shop_id` with geographic prefix (e.g. `SHP-WES-COL-000001`) and unique `qr_slug` |
| **Description** | A sales distributor registers a shop with owner name, mobile, NIC, business registration, address, and location. The system auto-generates a province-region-scoped shop ID. A separate QR mapping step links a physical QR code identifier to the shop record, enabling in-store voucher redemption. |
| **Constraints** | Sales Distributors can only view and delete shops within their assigned area. Shop ID encodes the geographic hierarchy for traceability. |
| **Endpoints** | `POST /api/shops`, `POST /api/shops/map-qr` |

---

### UC-04: Campaign Lifecycle Management

| Field | Detail |
|-------|--------|
| **Name** | Create, Configure, and Expire Marketing Campaigns |
| **Primary Actor** | Digital Marketing Team (A-02), Admin (A-01) |
| **Secondary Actors** | System (A-08) — auto-expires campaigns every 5 minutes when `end_date` passes |
| **Description** | DM Team creates campaigns with a name, description, timeline, budget, voucher limit, target audience, objective, and promotional banner URL. Multiple campaigns can run concurrently. Campaigns can be manually expired or disabled at any time. The auto-expiry job polls every 5 minutes and marks campaigns with a past `end_date` as `expired`. |
| **Roles** | STAFF = `admin`, `sys_admin`, all 7 DM roles |
| **Endpoints** | `POST /api/campaigns`, `PUT /api/campaigns/:id`, `POST /api/campaigns/expire`, `DELETE /api/campaigns/:campaign_id` |

---

### UC-05: Voucher Claiming (Campaign-Scoped)

| Field | Detail |
|-------|--------|
| **Name** | End Consumer Claims a Campaign Voucher |
| **Primary Actor** | End Consumer (A-07) |
| **Secondary Actors** | System — generates `claim_id` and `voucher_code`, sends SMS via TextLK |
| **Description** | A customer submits their mobile number on a public ad landing page linked to a campaign. The system validates the campaign is active, applies a **campaign-scoped uniqueness check** (`customer_mobile + campaign_id`), generates a unique voucher code, and delivers it via SMS. An auto-heal fallback silently redirects to the latest active campaign if the originally linked campaign has expired. |
| **Uniqueness Boundary** | **One claim per customer per campaign.** The same customer mobile may claim from Campaign A and Campaign B independently but cannot claim Campaign A twice. |
| **DB Enforcement** | `UNIQUE INDEX uq_vouchers_mobile_campaign ON vouchers (customer_mobile, campaign_id)` |
| **Endpoint** | `POST /api/vouchers/claim` — public, no auth required |

---

### UC-06: Voucher Redemption at Retail Shop

| Field | Detail |
|-------|--------|
| **Name** | Redeem a Voucher at a Registered Retail Shop |
| **Primary Actor** | End Consumer (A-07), Retail Shop (A-06) |
| **Secondary Actors** | System — atomically marks voucher redeemed, sends SMS receipts to both customer and shop owner |
| **Description** | A customer or shop owner scans the shop's QR code and enters the voucher code on the store verification page. The system validates the code is active and unused, then in a single atomic transaction marks the voucher as `redeemed` and records the redemption. SMS confirmation receipts (with a confirmation code) are sent to both the customer and the shop owner as acknowledgement. No OTP verification step is required. |
| **Endpoint** | `POST /api/redemptions/start` — public, no auth required |

---

### UC-07: Tiered Performance Analytics

| Field | Detail |
|-------|--------|
| **Name** | View Role-Scoped Performance Analytics |
| **Primary Actor** | Varies by analytics track (see visibility matrix) |
| **Secondary Actors** | None |
| **Description** | Performance data is surfaced at five distinct levels, each with a strict role-based visibility boundary. Territory scoping is automatically applied in SQL: FSM sees data limited to their province+region; ASM sees their province; DM Team sees all data globally. |

#### Analytics Visibility Matrix

| Track | Data Subject | Metrics | Visible To | Endpoint |
|-------|-------------|---------|-----------|----------|
| A | Top Customers (by redemption frequency) | `total_redemptions`, first/last redemption dates | **DM Team only** | `GET /api/analytics/customers/top` |
| B-A | Retail Shop Sales | Redemptions per shop, unique customers | ASM + FSM + DM Team | `GET /api/analytics/shops/performance` |
| B-B | Field Rep Performance | Shops registered, total sales volume | ASM + FSM | `GET /api/analytics/reps/performance` |
| B-C | Regional Manager (FSM) Metrics | Shops in region, aggregate sales, active campaigns | **ASM only** | `GET /api/analytics/regional-managers/performance` |
| B-D | Zonal Manager (ASM) Province Metrics | Province-wide aggregate sales, shops, campaigns | **DM Team only** | `GET /api/analytics/zonal-managers/performance` |

---

### UC-08: Top-Down Staff Reward Distribution

| Field | Detail |
|-------|--------|
| **Name** | Issue and Cascade a Reward Allocation Down the Staff Hierarchy |
| **Primary Actor** | Digital Marketing Team (A-02) issues allocation → ASM (A-03) distributes sub-rewards |
| **Secondary Actors** | System — enforces over-distribution guard via `SELECT FOR UPDATE`, writes immutable audit log |
| **Description** | The DM Team reviews Zonal Manager performance analytics and issues a named reward allocation to a top-performing ASM (`reward_allocations` table). The status is `issued`. Upon receipt, the ASM unlocks the ability to sub-distribute portions of the allocated reward value to FSMs, SDs, and shops within their province (`reward_distributions` table). Every distribution event is logged immutably in `reward_audit_logs`. The system uses a transactional `FOR UPDATE` lock to prevent concurrent over-distribution race conditions. |
| **Cascade Flow** | DM Team → ASM → FSM / SD / Shop |
| **Allocation Lifecycle** | `issued` → (partial distributions) → `distributed` (when fully allocated) |
| **Constraints** | Recipient must be within the ASM's assigned province. Distribution value cannot exceed the remaining allocation balance. Only `area_sales_manager` accounts can receive top-level allocations. |
| **Endpoints** | `POST /api/rewards/allocate` (DM Team), `POST /api/rewards/distribute` (ASM only) |

---

### UC-09: Customer Loyalty Reward Issuance

| Field | Detail |
|-------|--------|
| **Name** | Issue a Personalised Loyalty Reward to a Top-Performing Consumer |
| **Primary Actor** | Digital Marketing Team (A-02) |
| **Secondary Actors** | System — validates redemption history, sends SMS via TextLK, writes audit log |
| **Description** | The DM Team views the top customers analytics panel (Track A) and selects a customer mobile number to reward. The customer must have at least one confirmed redemption to be eligible. The system generates a sequential reward ID (`CUST-000001`), inserts the reward record, immediately sends an SMS notification to the customer's mobile with the reward details, marks the record as `notified`, and writes a `customer_rewarded` entry to the audit log. |
| **Eligibility Gate** | Customer must appear in `redemptions` with `final_status = 'redeemed'` |
| **Visibility** | **Exclusively DM Team** — no field roles (ASM, FSM, SD) can view or issue customer rewards |
| **Endpoints** | `POST /api/rewards/customer`, `GET /api/rewards/customer`, `GET /api/rewards/customer/:mobile` |

---

### UC-10: ROI Analytics & Dashboard

| Field | Detail |
|-------|--------|
| **Name** | View Campaign ROI, Conversion Funnel, and Activity Audit Trail |
| **Primary Actor** | Digital Marketing Team (A-02), Admin (A-01) |
| **Secondary Actors** | None |
| **Description** | DM Team and admins access a comprehensive analytics suite: overall conversion funnel (claimed → redeemed → expired), per-platform performance breakdowns, 30-day daily trend charts, geographic breakdowns by province/region, and per-campaign ROI with budget vs. cost-per-acquisition analysis. Full CSV export is available. A time-ordered activity audit trail records all staff login, shop registration, QR linking, and deletion events. |
| **Endpoints** | `GET /api/roi/summary`, `GET /api/roi/export`, `GET /api/roi/campaign/:id`, `GET /api/dashboard/summary`, `GET /api/activity` |
