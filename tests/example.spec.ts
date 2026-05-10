import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Login.*Nestl/i);
  await expect(page.locator('#loginForm')).toBeVisible();
});

test('claim entry page is reachable', async ({ page }) => {
  await page.goto('/claim-offer.html');
  await expect(page.locator('#mobileNumber')).toBeVisible();
  await expect(page.locator('#claimBtn')).toBeVisible();
});

test('admin can log in with seeded credentials', async ({ page }) => {
  await page.goto('/');
  await page.fill('#username', 'sysadmin');
  await page.fill('#password', '123');
  await page.click('#loginBtn');
  await page.waitForURL(/admin-dashboard\.html/);
  await expect(page).toHaveURL(/admin-dashboard\.html/);
});
