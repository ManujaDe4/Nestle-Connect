const { test, expect } = require('@playwright/test');

// Shared across serial tests — set by TC_70, read by TC_71 and TC_72
let createdAllocationId = null;

test.describe.serial('Module 7: Cascading Rewards Distribution', () => {

  // ── TC_70: DM Team issues a reward allocation to the ASM ──────────────────
  test('TC_70: Top-Down Allocation — Digital Marketing Manager issues reward to ASM', async ({ page }) => {
    // Login as DMM
    await page.goto('/login.html');
    await page.fill('input[id="employeeId"]', 'DMM-TEST-000001');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*admin-dashboard\.html/, { timeout: 15000 });

    // Open the Rewards tab
    await page.click('button[data-tab="rewards"]');
    await page.waitForSelector('#rewardsTab', { state: 'visible', timeout: 15000 });

    // Issue panel is DM-only — wait for it to become visible and for the ASM list to populate
    const issuePanel = page.locator('#rewardsIssuePanel');
    await expect(issuePanel).toBeVisible({ timeout: 10000 });

    // Wait for the ASM dropdown to have options beyond the placeholder
    await page.waitForSelector('#rewardRecipientId option:not([value=""])', {
      state: 'attached',
      timeout: 10000,
    });

    // Select the test ASM user (option label: "asm_test (ASM-WES-001) — Western")
    await page.locator('#rewardRecipientId').selectOption({ label: /asm_test/ });

    // Fill reward details
    await page.locator('#rewardType').selectOption('monetary');
    await page.fill('#rewardValue', '5000');
    await page.fill('#rewardDescription', 'TC_70 Test Allocation');

    // Submit and wait for success message
    await page.click('#issueRewardBtn');
    const msgEl = page.locator('#issueRewardMsg');
    await expect(msgEl).toContainText('issued successfully', { timeout: 15000 });

    // Extract the allocation ID for downstream tests (e.g. "✓ Reward ALLOC-000012 issued successfully.")
    const msgText = await msgEl.innerText();
    const match = msgText.match(/ALLOC-\d+/);
    if (match) {
      createdAllocationId = match[0];
      console.log(`TC_70: Reward ${createdAllocationId} issued to ASM`);
    } else {
      console.warn('TC_70: Could not extract allocation ID from message — downstream tests will use description fallback');
    }
  });

  // ── TC_71: ASM verifies the allocation appears in their rewards panel ──────
  test('TC_71: ASM Verifies Received Allocation', async ({ page }) => {
    // Login as ASM
    await page.goto('/login.html');
    await page.fill('input[id="employeeId"]', 'ASM-WES-001');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*field-manager-dashboard\.html/, { timeout: 15000 });

    // Open the Rewards tab (visible for ASM only)
    const rewardsTabBtn = page.locator('#fmRewardsTabBtn');
    await expect(rewardsTabBtn).toBeVisible({ timeout: 10000 });
    await rewardsTabBtn.click();

    // Wait for the allocations table to load (not loading placeholder)
    const allocTable = page.locator('#fmAllocTable');
    await expect(allocTable).not.toContainText('Loading...', { timeout: 15000 });

    // Assert the allocation from TC_70 appears — match by ID if available, else by description
    if (createdAllocationId) {
      await expect(allocTable).toContainText(createdAllocationId, { timeout: 10000 });
    } else {
      await expect(allocTable).toContainText('TC_70 Test Allocation', { timeout: 10000 });
    }

    console.log(`TC_71: ASM allocation table shows ${createdAllocationId || 'TC_70 Test Allocation'}`);
  });

  // ── TC_72: ASM distributes portion of the reward downstream to a Sales Distributor ──
  test('TC_72: ASM Distributes Reward Downstream to Sales Distributor', async ({ page }) => {
    // Login as ASM
    await page.goto('/login.html');
    await page.fill('input[id="employeeId"]', 'ASM-WES-001');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*field-manager-dashboard\.html/, { timeout: 15000 });

    // Open the Rewards tab
    const rewardsTabBtn = page.locator('#fmRewardsTabBtn');
    await expect(rewardsTabBtn).toBeVisible({ timeout: 10000 });
    await rewardsTabBtn.click();

    // Wait for the distribute form allocation dropdown to populate
    await page.waitForSelector('#fmDistAllocId option:not([value=""])', {
      state: 'attached',
      timeout: 15000,
    });

    // Select the allocation from TC_70 — match by ID if available, else first available option
    if (createdAllocationId) {
      await page.locator('#fmDistAllocId').selectOption({ label: new RegExp(createdAllocationId) });
    } else {
      await page.locator('#fmDistAllocId').selectOption({ index: 1 });
    }

    // Select "Field Rep (SD)" as recipient type — triggers fmUpdateRecipList()
    await page.locator('#fmDistRecipType').selectOption('field_rep');

    // Wait for SD list to populate then select the Western Colombo SD
    await page.waitForSelector('#fmDistRecipUserId option:not([value=""])', {
      state: 'attached',
      timeout: 10000,
    });
    await page.locator('#fmDistRecipUserId').selectOption({ label: /SD-WES-COL-000001/ });

    // Fill reward details — partial distribution (1000 of 5000) so allocation stays 'issued'
    await page.locator('#fmDistRewardType').selectOption('monetary');
    await page.fill('#fmDistValue', '1000');
    await page.fill('#fmDistDesc', 'TC_72 downstream distribution');

    // Submit and wait for success confirmation
    await page.click('#fmDistBtn');
    const distMsg = page.locator('#fmDistMsg');
    await expect(distMsg).toContainText('created', { timeout: 15000 });

    // Extract the distribution ID for logging
    const msgText = await distMsg.innerText();
    const match = msgText.match(/DIST-\d+/);
    const distributionId = match ? match[0] : 'unknown';

    // Distributions table should reload and show the new entry
    const distTable = page.locator('#fmDistTable');
    await expect(distTable).not.toContainText('No distributions yet.', { timeout: 10000 });
    await expect(distTable).toContainText(distributionId, { timeout: 10000 });

    console.log(`TC_72: Distribution ${distributionId} created → SD SD-WES-COL-000001 received 1000 LKR`);
  });

});
