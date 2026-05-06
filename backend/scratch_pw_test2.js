const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  await page.goto('http://localhost:5000/login.html');
  await page.fill('#username', 'manu');
  await page.fill('#password', '123');
  await page.click('button[type="submit"]');
  
  await page.waitForURL(/.*rep-dashboard.html/);
  
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    console.log("LocalStorage User:", JSON.stringify(user));
  });

  await page.goto('http://localhost:5000/shop-owner-registration.html');
  
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    console.log("Registration Page User:", JSON.stringify(user));
    console.log("SRI_LANKA_LOCATIONS exists?", !!window.SRI_LANKA_LOCATIONS);
    if (window.SRI_LANKA_LOCATIONS && user) {
       console.log("Province:", user.province, "Region:", user.region);
       const areas = (window.SRI_LANKA_LOCATIONS[user.province] || {})[user.region] || [];
       console.log("Areas array length:", areas.length);
    }
  });

  await browser.close();
}
test();
