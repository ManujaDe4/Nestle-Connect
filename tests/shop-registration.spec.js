const { test, expect } = require('@playwright/test');

test.describe('Module 2: Shop Registration', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Go to the live login page
    await page.goto('https://nestle-connect.onrender.com/login.html'); 
    
    // 2. Log in as the Delivery Partner (Rep)
    await page.fill('input[id="username"]', 'manu'); 
    await page.fill('input[id="password"]', '123');
    await page.click('button[type="submit"]');

    // 3. Wait until the dashboard loads, then manually go to the registration page
    await page.waitForURL(/.*rep-dashboard.html/);
    await page.goto('https://nestle-connect.onrender.com/shop-owner-registration.html');
  });

  test('TC_14: Shop Reg - Valid Submit', async ({ page }) => {
    // Fill out the shop details
    await page.fill('input[id="shopName"]', 'Kamal Grocery Store');
    await page.fill('input[id="ownerMobile"]', '0711234567');
    
    await page.fill('input[id="nicNumber"]', '198512345678'); 
    
    // Click the submit button
    await page.click('button[id="registerBtn"]');

    const successMsg = page.locator('#responseMsg.state-success');
    await expect(successMsg).toBeVisible();

    const qrSection = page.locator('#qrSection');
    await expect(qrSection).toBeVisible();
  });

  test('TC_15: Shop Reg - Missing Fields', async ({ page }) => {
    await page.fill('input[id="ownerMobile"]', '0711234567');
    
    // Click register
    await page.click('button[id="registerBtn"]');

    const qrSection = page.locator('#qrSection');
    await expect(qrSection).toBeHidden();
  });

});