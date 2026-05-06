const { test, expect } = require('@playwright/test');

test.describe('Module 4: Consumer Claim Flow', () => {

  test('TC_40: Valid Mobile Number Claim', async ({ page }) => {
    await page.goto('/claim-offer.html'); 
    
    // Injecting the actual mobile number instead of a dummy variable
    await page.fill('input[id="mobileNumber"]', '0773369997');
    
    await page.click('button[id="claimBtn"]');

    const successSection = page.locator('#successSection');
    await expect(successSection).toBeVisible();

    const voucherCode = page.locator('#voucherCodeValue');
    await expect(voucherCode).not.toHaveText('-');
    
    const codeText = await voucherCode.innerText();
    console.log(`Successfully generated Voucher Code: ${codeText}`);
  });

  test('TC_41: Invalid Mobile Number Format', async ({ page }) => {
    await page.goto('/claim-offer.html'); 
    
    await page.fill('input[id="mobileNumber"]', '12345');
    await page.click('button[id="claimBtn"]');

    const errorMsg = page.locator('#responseMsg.state-error');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Invalid mobile number format');
  });

});