const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5000/login.html');
  await page.fill('#username', 'manu');
  await page.fill('#password', '123');
  await page.click('button[type="submit"]');
  
  await page.waitForURL(/.*rep-dashboard.html/);
  await page.goto('http://localhost:5000/shop-owner-registration.html');
  
  const options = await page.locator('#shopArea option').allInnerTexts();
  console.log('Available options for Area:', options);
  
  await browser.close();
}
test();
