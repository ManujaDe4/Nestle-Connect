const { test, expect } = require('@playwright/test');

test.describe('Module 3: QR Mapping & Linking', () => {

  // ARRANGE: The ghost logs in as a Rep and navigates to the mapping page
  test.beforeEach(async ({ page }) => {
    // 1. Go to the live login page
    await page.goto('https://nestle-connect.onrender.com/login.html'); 
    
    // 2. Log in using the Rep credentials
    await page.fill('input[id="username"]', 'manu'); 
    await page.fill('input[id="password"]', '123');
    await page.click('button[type="submit"]');

    // 3. Wait until the dashboard loads, then go to the QR mapping page
    await page.waitForURL(/.*rep-dashboard.html/);
    await page.goto('https://nestle-connect.onrender.com/qr-mapping.html');
  });

  // THE HAPPY PATH: Successfully linking a QR code to a shop
  test('TC_25: QR Map - Single Valid Link', async ({ page }) => {
    
    // THE FIX: Tell Playwright to wait for the options to be attached to the DOM, not visually drawn
    await page.waitForSelector('#shopSelect option:not([value=""])', { state: 'attached' });

    // 2. Select the second option in the dropdown (index 1)
    await page.locator('#shopSelect').selectOption({ index: 1 });

    // 3. Verify the Shop Info card becomes visible after selecting a shop
    const shopInfoCard = page.locator('#shopInfo');
    await expect(shopInfoCard).toHaveClass(/show/);

    // 4. Type a unique dummy QR identifier
    const uniqueQRCode = `QR-TEST-${Date.now()}`;
    await page.fill('input[id="qrIdentifier"]', uniqueQRCode);
    
    // 5. Click the 'Link QR Code' button
    await page.click('button:has-text("Link QR Code")');

    // THE QA CHECK: Did the green success message appear?
    const successMsg = page.locator('#successMessage');
    await expect(successMsg).toHaveClass(/show/);
    await expect(successMsg).toContainText('Successfully Linked');
  });

  // THE EDGE CASE: Forgetting to type the QR identifier
  test('TC_26: QR Map - Missing QR Identifier', async ({ page }) => {
    
    // THE FIX: Applied here as well
    await page.waitForSelector('#shopSelect option:not([value=""])', { state: 'attached' });
    await page.locator('#shopSelect').selectOption({ index: 1 });

    // 2. Click the link button WITHOUT typing a QR identifier
    await page.click('button:has-text("Link QR Code")');

    // THE QA CHECK: Did the red error message appear?
    const errorMsg = page.locator('#errorMessage');
    await expect(errorMsg).toHaveClass(/show/);
    await expect(errorMsg).toContainText('Please enter or scan a QR code');
  });

});