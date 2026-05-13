const { test, expect } = require('@playwright/test');

test.describe('Module 2: Shop Registration', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html'); 
    await page.fill('input[id="employeeId"]', 'SD-WES-COL-000001');
    await page.fill('input[id="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*rep-dashboard.html/);
    await page.goto('/shop-owner-registration.html');
    // Wait for the page's JS to finish setting up location dropdowns
    await page.waitForLoadState('networkidle');
  });

  test('TC_14: Shop Reg - Valid Submit', async ({ page }) => {
    // Use unique values each run to avoid duplicate registration errors.
    // Shop name also unique so the qr_slug loop is always O(1) and fast.
    const ts           = Date.now();
    const uniqueShop   = `Test Shop PW-${ts}`;
    const uniqueMobile = `077${ts.toString().slice(-7)}`;
    const uniqueNIC    = `NIC${ts.toString().slice(-9)}`;

    await page.fill('input[id="shopName"]', uniqueShop);
    await page.fill('input[id="ownerMobile"]', uniqueMobile);
    await page.fill('input[id="nicNumber"]', uniqueNIC);

    // Province & Region are pre-locked for SD-WES-COL-000001 (Western / Colombo).
    // Area options are pre-populated from locations.js — select directly by value.
    await page.selectOption('select[id="shopArea"]', { value: 'Dehiwala' });

    await page.click('button[id="registerBtn"]');

    // Allow longer timeout for DB write + QR generation
    const successMsg = page.locator('#responseMsg.state-success');
    await expect(successMsg).toBeVisible({ timeout: 15000 });

    const qrSection = page.locator('#qrSection');
    await expect(qrSection).toBeVisible({ timeout: 10000 });
  });

  test('TC_15: Shop Reg - Missing Fields', async ({ page }) => {
    // Only fill mobile, leave shop name and NIC empty
    await page.fill('input[id="ownerMobile"]', '0768628138');
    
    await page.click('button[id="registerBtn"]');

    // QR section should NOT appear when required fields are missing
    const qrSection = page.locator('#qrSection');
    await expect(qrSection).toBeHidden();
  });

});