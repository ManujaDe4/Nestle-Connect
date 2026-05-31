const { test, expect } = require('@playwright/test');

// Phone normalises to 0771234567 via normalizeMobile() on the server
const PHONE     = '+94771234567';
const AD_ID     = 'AD001';
const PLATFORM  = 'instagram';

test.describe('Module 5: Campaign Claim Validation', () => {

  test('TC_50: Multi-Campaign Independent Claims', async ({ request }) => {
    // Claim under Campaign A (CMP001)
    const res1 = await request.post('/api/vouchers/claim', {
      data: { customer_mobile: PHONE, campaign_id: 'CMP001', ad_id: AD_ID, platform: PLATFORM },
    });
    // Accept 201 (fresh claim) or 200 (already_claimed — prior run cleaned up by globalSetup but
    // the test may run standalone without setup; either way the claim is scoped to CMP001)
    expect([200, 201]).toContain(res1.status());
    const body1 = await res1.json();
    expect(body1).toHaveProperty('voucher');

    // Same phone under Campaign B (CMP002) — must NOT be blocked by the CMP001 claim
    const res2 = await request.post('/api/vouchers/claim', {
      data: { customer_mobile: PHONE, campaign_id: 'CMP002', ad_id: AD_ID, platform: PLATFORM },
    });
    expect([200, 201]).toContain(res2.status());
    const body2 = await res2.json();
    expect(body2).toHaveProperty('voucher');

    // Confirm neither response is a cross-campaign block — each voucher belongs to its own campaign
    expect(body1.voucher.campaign_id).toBe('CMP001');
    expect(body2.voucher.campaign_id).toBe('CMP002');

    console.log(
      `TC_50: CMP001 voucher=${body1.voucher.voucher_code} | CMP002 voucher=${body2.voucher.voucher_code}`
    );
  });

  test('TC_51: Single-Campaign Duplicate Prevention', async ({ request }) => {
    // First call ensures the claim exists (idempotent — may already be present from TC_50)
    await request.post('/api/vouchers/claim', {
      data: { customer_mobile: PHONE, campaign_id: 'CMP001', ad_id: AD_ID, platform: PLATFORM },
    });

    // Second call with the same phone + same campaign must be rejected
    const res = await request.post('/api/vouchers/claim', {
      data: { customer_mobile: PHONE, campaign_id: 'CMP001', ad_id: AD_ID, platform: PLATFORM },
    });

    const body = await res.json();

    // Server returns HTTP 200 with already_claimed:true OR HTTP 409 on race/unique-index violation
    const isDuplicate =
      (res.status() === 200 && body.already_claimed === true) ||
      res.status() === 409;

    expect(isDuplicate).toBe(true);
    expect(body.message.toLowerCase()).toContain('already claimed');

    console.log(`TC_51: Duplicate correctly blocked — "${body.message}"`);
  });

});
