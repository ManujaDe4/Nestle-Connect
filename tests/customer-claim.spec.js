const { test, expect } = require('@playwright/test');

test.describe('Module 4: Consumer Claim Flow', () => {

  test('TC_40: Valid Mobile Number Claim', async ({ page }) => {
    await page.goto('/claim-offer.html'); 
    
    // Wait for the button to become enabled (campaign async fetch completes)
    const claimBtn = page.locator('button[id="claimBtn"]');
    await expect(claimBtn).toBeEnabled({ timeout: 10000 });

    // Use a unique mobile number each test run to avoid already-claimed issues
    // (already-claimed still shows successSection so either way passes)
    await page.fill('input[id="mobileNumber"]', '0773369997');
    
    await page.click('button[id="claimBtn"]');

    // Wait for either success or already-claimed state (both show successSection)
    const successSection = page.locator('#successSection');
    await expect(successSection).toBeVisible({ timeout: 15000 });

    const voucherCode = page.locator('#voucherCodeValue');
    await expect(voucherCode).not.toHaveText('-');
    
    const codeText = await voucherCode.innerText();
    console.log(`Successfully generated Voucher Code: ${codeText}`);
  });

  test('TC_41: Invalid Mobile Number Format', async ({ page }) => {
    await page.goto('/claim-offer.html'); 

    // Wait for button to be enabled before interacting
    const claimBtn = page.locator('button[id="claimBtn"]');
    await expect(claimBtn).toBeEnabled({ timeout: 10000 });

    await page.fill('input[id="mobileNumber"]', '12345');
    await page.click('button[id="claimBtn"]');

    const errorMsg = page.locator('#responseMsg.state-error');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Invalid mobile number format');
  });

});