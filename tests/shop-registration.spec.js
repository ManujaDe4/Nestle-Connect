const { test, expect } = require('@playwright/test');

test.describe('Module 2: Shop Registration', () => {

  // ARRANGE: The ghost must log in as a Rep before every test in this block
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

 // THE HAPPY PATH: A flawless registration
  test('TC_14: Shop Reg - Valid Submit', async ({ page }) => {
    // Fill out the shop details
    await page.fill('input[id="shopName"]', 'Kamal Grocery Store');
    await page.fill('input[id="ownerMobile"]', '0711234567');
    
    // NEW LINE: Fill out the NIC Number
    // Note: I am guessing the ID is "ownerNic". If your HTML uses "nicNumber" or something else, change it here!
    await page.fill('input[id="nicNumber"]', '198512345678'); 
    
    // Click the submit button
    await page.click('button[id="registerBtn"]');

    // THE QA CHECK: Did the system show the green success text?
    const successMsg = page.locator('#responseMsg.state-success');
    await expect(successMsg).toBeVisible();

    // THE QA CHECK 2: Did the QR Code section un-hide itself?
    const qrSection = page.locator('#qrSection');
    await expect(qrSection).toBeVisible();
  });

  // THE EDGE CASE: Forgetting to type the Shop Name
  test('TC_15: Shop Reg - Missing Fields', async ({ page }) => {
    // We intentionally only fill the mobile number, leaving the Shop Name blank
    await page.fill('input[id="ownerMobile"]', '0711234567');
    
    // Click register
    await page.click('button[id="registerBtn"]');

    // THE QA CHECK: Because your HTML uses the "required" attribute, 
    // the system should block the submission. The QR section should remain hidden.
    const qrSection = page.locator('#qrSection');
    await expect(qrSection).toBeHidden();
  });

});