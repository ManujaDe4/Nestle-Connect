# Nestle Connect — Fix Pass Summary

This document covers every change applied to the workspace at
`C:\Users\PIUSH\OneDrive\Desktop\Nestle Connect\Nestle Connect\Nestle-Connect`.

---

## Manual follow-up you still need to do

1. **Rotate the leaked secrets.** The previous `backend/.env` had a real Neon
   Postgres password and a real Text.lk API token committed. `.env` is now in
   `.gitignore`, but if this repo touched a public GitHub remote those values
   are out there.
   - Reset the Neon DB password, update `DATABASE_URL` in `backend/.env`.
   - Regenerate the Text.lk token, update `TEXTLK_API_TOKEN`.
   - Run `git rm --cached backend/.env` once to stop tracking.

2. **`npm install`** in both the repo root and `backend/`. Lockfiles need
   refreshing because we removed the unused `twilio` dep and replaced
   `playwright.config.js` with the canonical `.ts` config.

3. **First server start auto-migrates the DB.** `initDatabase()`:
   - Drops the old `role IN ('admin','rep')` CHECK constraint
   - Migrates any `rep` rows to `sales_distributor`
   - Renames `REP-…` employee IDs to `SD-…`
   - Renames any existing `admin` user to `sysadmin`
   - Assigns `SYS-000001` to admins missing an employee ID
   - Creates a default `sysadmin / password` if no admin exists at all

4. **Default credentials after first startup:** `sysadmin` / `password` —
   change this immediately in production. Sales Distributors get IDs like
   `SD-WES-COL-000001`.

---

## Bugs fixed

### Admin-dashboard summary cards lazy-loading
`Total Users`, `Registered Shops`, `Total QR Scans` only updated when their
matching tab was opened. Replaced piecemeal updates with `refreshGlobalSummary()`
that fetches all three in parallel via `Promise.allSettled` and is invoked on
every tab switch (and on initial page load).

### ROI PDF export "highlighted / invisible" content
`html2canvas` flattens modern CSS (oklch, gradients, backdrop-filter, dark
badges over light bg) badly so text ended up looking highlighted. Now we
inject a temporary stylesheet before capture that forces dark-on-light
contrast across `#roiTab`, await `document.fonts.ready`, settle two animation
frames, capture with `backgroundColor: '#ffffff'`, and remove the style in
a `finally` block.

### OTP redemption flow (security-critical)
Old flow set `final_status='redeemed'` and `voucher.claim_status='redeemed'`
**before** the OTP was checked — so anyone with a voucher code could redeem
it by calling `/start`. Rewrite:
- `/start` inserts `otp_status='pending'`, `final_status='pending'`, no
  `redeemed_at`, OTP via `crypto.randomInt` (6 digits).
- `/verify` requires a `pending` row, increments `otp_attempts`, locks the
  redemption after 5 wrong attempts, returns `429` on lockout.
- Voucher transitions to `redeemed` only inside a transaction after a
  successful verify.
- The OTP is **stripped from the API response** unless `DEMO_MODE=true`.

### JWT_SECRET fallback to literal `"secret"`
`backend/middleware/auth.js` now requires `JWT_SECRET`; if absent the
process exits on startup. Login also returns `401` (not `400`) for bad
credentials and uses one identical message either way.

### `/api/sms` exposed all SMS logs publicly
Now `authenticate, authorize(["admin"])` — admin-only.

### `/api/dashboard/summary` was unauthenticated
Now requires `admin` or `sales_distributor`.

### Sales Distributors saw shops by registrant, not by area
`shopController` now uses a `buildAreaScope(user)` helper that filters by
`province + region + area` matching the SD's assigned location. SDs see all
shops in their area regardless of who registered them. Admins see
everything. SD with no location set sees nothing (rather than every shop in
the system). Delete is still ownership-gated — SDs can only delete shops
they registered themselves.

### QR codes hardcoded production URL
`createShop` builds the QR URL from `PUBLIC_BASE_URL` (or the request
host) so locally-generated QRs work locally.

### Customer claim race
`claim-offer.html` disables the **Generate Voucher** button until the active
campaign fetch resolves and falls back to a friendly error if no campaign
is active. The old code submitted with a stale `'CMP001'` fallback id.

### Inconsistent API_BASE definitions across 9 HTML files
Replaced with a shared `frontend/js/config.js` exporting `window.API_BASE`,
included from every page via `<script src="./js/config.js">`. The new
detection covers `localhost`, `127.0.0.1`, `0.0.0.0`, and `file://`.
Production deployments use same-origin so it works behind any custom domain.

---

## Renames

### Role: `rep` → `sales_distributor`
Role string changed everywhere — DB CHECK constraint, controllers, routes,
JWT claims, frontend redirects, role checks. Migration block in `server.js`
converts existing `rep` rows on first startup.

### Employee-ID prefix: `REP-` → `SD-`
Format: `SD-{PROVINCE}-{REGION}-NNNNNN`, e.g. `SD-WES-COL-000001`.
`createUser` generates these for new SDs; the migration renames legacy IDs.

### Admin: `admin` → `sysadmin`
Default admin username, employee-ID prefix `SYS-NNNNNN`, starting at
`SYS-000001`. The migration renames any existing `admin` row.

### UI labels swept
- "Reps" → "Sales Distributors" (sidebar nav, page titles, panel titles)
- "Add New Representative" → "Add New Sales Distributor"
- "Field Representative Activity Log" → "Field Sales Distributor Activity Log"
- "Rep ID" column → "Employee ID"
- "Rep Portal" → "Sales Distributor Portal"
- "Sales Representative" → "Sales Distributor"
- Role badges in admin user table now show "Admin" / "Sales Distributor"
- Empty-state and error messages updated in both dashboards
- "My Shops" → "Area Shops" in the Sales Distributor dashboard
- Login page subtitle updated

Internal-only references like DOM IDs (`repProvince`, `repsList`, etc.) and
JS variable names were intentionally left alone — not user-visible, and
renaming them would touch every related script for zero behavior change.

---

## Files removed

- `frontend/app.js` (dead, never referenced; hardcoded production API_BASE)
- `frontend/js/{ad-entry,claim-offer,dashboard,store-verify}.js` (all empty stubs)
- `frontend/{otp,temp_kpi,temp_switch,voucher}.html` (empty / partial fragments)
- `alter.js`, `chunks.txt` (root scratch artifacts)
- `playwright.config.js` (broken ESM duplicate; `.ts` is canonical)

---

## Files added

- `frontend/js/config.js` — shared API_BASE
- `backend/.env.example` — keys cloners need to fill in
- `CHANGES.md` — this file

---

## Files reconciled

- `database/schema.sql` regenerated to match `initDatabase()` (now includes
  `activity_logs`, `sms_logs`, `otp_attempts`, `otp_expires_at`, the new
  role check, and reconciles VARCHAR length mismatches).
- `database/seed.sql` updated for the new role string and `sysadmin` user;
  uses `ON CONFLICT … DO NOTHING` so it's safe to rerun.
- Root `package.json`: `start` correctly points to `node backend/server.js`,
  added `test:e2e`, removed nonexistent `index.js` reference.
- `backend/package.json`: dropped unused `twilio` dependency.
- `playwright.config.ts`: `testDir` points to `./tests` (where the real spec
  files live); placeholder `playwright.dev` test in `tests/example.spec.ts`
  replaced with real smoke tests that log in as `sysadmin`.

---

## What I deliberately didn't do

- **Did not rename `rep-dashboard.html`** — the file path is referenced by
  the login redirect and several other links; renaming would mean a
  coordinated rename across the project. Easy follow-up if you want.
- **Did not move `backend/scratch_*.js` / `add-*.js` etc. to `backend/scripts/`.**
  They work fine where they are.
- **Did not add login / claim rate-limiting** (e.g. `express-rate-limit`).
  Recommended but a separate task.
- **Did not add an input-validation library** (Zod / Joi). Current handlers
  do ad-hoc null checks; a structured validation pass is a nice next step.
