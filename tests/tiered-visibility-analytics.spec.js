const { test, expect } = require('@playwright/test');

const API = 'http://localhost:5000';

// Helper: login via UI and return the JWT stored in localStorage
async function loginAndGetToken(page, employeeId, password) {
  await page.goto('/login.html');
  await page.fill('input[id="employeeId"]', employeeId);
  await page.fill('input[id="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard\.html/, { timeout: 15000 });
  return page.evaluate(() => localStorage.getItem('token'));
}

// Helper: authenticated fetch using Playwright request fixture + Bearer token
function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('Module 6: Tiered Analytics Visibility', () => {

  test('TC_60: Digital Marketing Manager — full analytics access', async ({ page, request }) => {
    const token = await loginAndGetToken(page, 'DMM-TEST-000001', 'password');
    await expect(page).toHaveURL(/.*admin-dashboard\.html/);

    // Navigate to analytics tab and let the JS populate the sections
    await page.click('button[data-tab="analytics"]');
    await page.waitForSelector('#analyticsSectionCustomer', { state: 'attached', timeout: 10000 });

    // DM Team sees customer redemption frequency (Track A)
    const customerSection = page.locator('#analyticsSectionCustomer');
    await expect(customerSection).not.toHaveCSS('display', 'none');

    // DM Team sees zonal manager provincial performance (Track B-D)
    const asmSection = page.locator('#analyticsSectionASM');
    await expect(asmSection).not.toHaveCSS('display', 'none');

    // DM Team sees retail shop sales metrics (Track B-A)
    const shopSection = page.locator('#analyticsSectionShops');
    await expect(shopSection).not.toHaveCSS('display', 'none');

    // API-level: customer top endpoint returns 200 for DM Team
    const r = await request.get(`${API}/api/analytics/customers/top`, {
      headers: authHeaders(token),
    });
    expect(r.status()).toBe(200);

    console.log('TC_60: DMM — customer, shops, and zonal-manager sections all visible; API 200');
  });

  test('TC_61: Area Sales Manager — scoped access and customer data blocked', async ({ page, request }) => {
    const token = await loginAndGetToken(page, 'ASM-WES-001', 'password');
    await expect(page).toHaveURL(/.*field-manager-dashboard\.html/);

    // Navigate directly to admin-dashboard — the page reads role from localStorage and adjusts visibility
    await page.goto('/admin-dashboard.html');
    await page.click('button[data-tab="analytics"]');
    await page.waitForSelector('#analyticsSectionCustomer', { state: 'attached', timeout: 10000 });

    // ASM can see shop metrics (Track B-A), rep metrics (Track B-B), and regional FSM metrics (Track B-C)
    await expect(page.locator('#analyticsSectionShops')).not.toHaveCSS('display', 'none');
    await expect(page.locator('#analyticsSectionReps')).not.toHaveCSS('display', 'none');
    await expect(page.locator('#analyticsSectionFSM')).not.toHaveCSS('display', 'none');

    // Customer redemption lists are DM-only — must be hidden for ASM
    await expect(page.locator('#analyticsSectionCustomer')).toHaveCSS('display', 'none');

    // API: customer top → 403 Forbidden
    const rCustomer = await request.get(`${API}/api/analytics/customers/top`, {
      headers: authHeaders(token),
    });
    expect(rCustomer.status()).toBe(403);

    // API: regional-managers/performance → 200 (ASM is authorised to see FSM metrics)
    const rRegional = await request.get(`${API}/api/analytics/regional-managers/performance`, {
      headers: authHeaders(token),
    });
    expect(rRegional.status()).toBe(200);

    console.log('TC_61: ASM — shops/reps/FSM visible, customer section hidden, customers/top=403');
  });

  test('TC_62: Field Sales Manager — restricted to own-territory data', async ({ page, request }) => {
    const token = await loginAndGetToken(page, 'FSM-WES-COL-001', 'password');
    await expect(page).toHaveURL(/.*field-manager-dashboard\.html/);

    // FSM can see shop performance and rep performance within their territory
    const rShops = await request.get(`${API}/api/analytics/shops/performance`, {
      headers: authHeaders(token),
    });
    expect(rShops.status()).toBe(200);

    const rReps = await request.get(`${API}/api/analytics/reps/performance`, {
      headers: authHeaders(token),
    });
    expect(rReps.status()).toBe(200);

    // FSM cannot see ASM-level (regional-managers) data — 403
    const rRegional = await request.get(`${API}/api/analytics/regional-managers/performance`, {
      headers: authHeaders(token),
    });
    expect(rRegional.status()).toBe(403);

    // FSM cannot see top customer lists (DM Team only) — 403
    const rCustomer = await request.get(`${API}/api/analytics/customers/top`, {
      headers: authHeaders(token),
    });
    expect(rCustomer.status()).toBe(403);

    // FSM cannot see zonal manager dashboard (DM Team only) — 403
    const rZonal = await request.get(`${API}/api/analytics/zonal-managers/performance`, {
      headers: authHeaders(token),
    });
    expect(rZonal.status()).toBe(403);

    console.log('TC_62: FSM — shops=200, reps=200, regional=403, customers=403, zonal=403');
  });

});
