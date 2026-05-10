const { test, expect } = require('@playwright/test');

test.describe('Module 3: QR Mapping & Linking', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Go to the live login page
    await page.goto('/login.html'); 
    
    // 2. Log in using the Rep credentials
    await page.fill('input[id="username"]', 'manu'); 
    await page.fill('input[id="password"]', '123');
    await page.click('button[type="submit"]');

    // 3. Wait until the dashboard loads, then go to the QR mapping page
    await page.waitForURL(/.*rep-dashboard.html/);
    await page.goto('/qr-mapping.html');
  });

  test('TC_25: QR Map - Single Valid Link', async ({ page }) => {
    
    // Wait for shop options to load
    await page.waitForSelector('#shopSelect option:not([value=""])', { state: 'attached', timeout: 10000 });

    await page.locator('#shopSelect').selectOption({ index: 1 });

    const shopInfoCard = page.locator('#shopInfo');
    await expect(shopInfoCard).toHaveClass(/show/);

    const uniqueQRCode = `QR-TEST-${Date.now()}`;
    await page.fill('input[id="qrIdentifier"]', uniqueQRCode);
    
    // Click the 'Link QR Code' button
    await page.click('button:has-text("Link QR Code")');

    // Check for green success message
    const successMsg = page.locator('#successMessage');
    await expect(successMsg).toHaveClass(/show/, { timeout: 10000 });
    await expect(successMsg).toContainText('Successfully Linked');
  });

  test('TC_26: QR Map - Missing QR Identifier', async ({ page }) => {
    
    await page.waitForSelector('#shopSelect option:not([value=""])', { state: 'attached', timeout: 10000 });
    await page.locator('#shopSelect').selectOption({ index: 1 });

    // Click the link button WITHOUT typing a QR identifier
    await page.click('button:has-text("Link QR Code")');

    // Check for red error message
    const errorMsg = page.locator('#errorMessage');
    await expect(errorMsg).toHaveClass(/show/);
    await expect(errorMsg).toContainText('Please enter or scan a QR code');
  });

});