const fetch = require('node-fetch');

async function testClaimVoucher() {
  try {
    const response = await fetch('http://localhost:5000/api/vouchers/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_mobile: '0771234567',
        campaign_id: 'CMP001',
        ad_id: 'AD001'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testClaimVoucher();