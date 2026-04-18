const { test, expect } = require('@playwright/test');

test.describe('Module 1: Authentication', () => {

  // Runs before every single test to ensure we start at the login page
  test.beforeEach(async ({ page }) => {
    await page.goto('https://nestle-connect.onrender.com/login.html');
  });

  test('TC_01: Admin Login Success', async ({ page }) => {
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*admin-dashboard.html/);
  });

  test('TC_02: Rep Login Success', async ({ page }) => {
    // Assuming you have a rep user in your DB, replace 'rep_user' if needed
    await page.fill('input[id="username"]', 'manu'); 
    await page.fill('input[id="password"]', '123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*rep-dashboard.html/);
  });

  test('TC_03: Login - Invalid Password', async ({ page }) => {
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'wrong_password_test');
    await page.click('button[type="submit"]');
    
    // NOTE: Change '.error-msg' to the actual class or ID of your error text
    const errorMessage = page.locator('.error-msg'); 
    await expect(errorMessage).toBeVisible();
  });

  test('TC_04: Login - Empty Fields', async ({ page }) => {
    // Just click submit without typing anything
    await page.click('button[type="submit"]');
    
    // Verify the system blocked it and we are still on the login page
    await expect(page).toHaveURL(/.*login.html/);
  });

});