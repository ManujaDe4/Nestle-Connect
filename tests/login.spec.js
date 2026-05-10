const { test, expect } = require('@playwright/test');

test.describe('Module 1: Authentication', () => {

  // Runs before every single test to ensure we start at the login page
  test.beforeEach(async ({ page }) => {
    await page.goto('/login.html');
  });

  test('TC_01: Admin Login Success', async ({ page }) => {
    await page.fill('input[id="employeeId"]', 'sysadmin');
    await page.fill('input[id="password"]', '123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*admin-dashboard.html/);
  });

  test('TC_02: Rep Login Success', async ({ page }) => {
    await page.fill('input[id="employeeId"]', 'manu');
    await page.fill('input[id="password"]', '123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*rep-dashboard.html/);
  });

 test('TC_03: Login - Invalid Password', async ({ page }) => {
    await page.fill('input[id="employeeId"]', 'sysadmin');
    await page.fill('input[id="password"]', 'wrong_password_test');
    await page.click('button[type="submit"]');

    const errorMessage = page.locator('#msgBox.error');
    await expect(errorMessage).toBeVisible();
  });

  test('TC_04: Login - Empty Fields', async ({ page }) => {
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*login.html/);
  });

});