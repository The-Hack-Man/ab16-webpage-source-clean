import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

const networkErrors = [];

page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
page.on('requestfailed', req => networkErrors.push(req.url() + ': ' + req.failure()?.errorText));

// Navigate to LOCAL build
await page.goto('http://localhost:5175/', { waitUntil: 'commit', timeout: 30000 });

// Check at 100ms (before JS renders)
await page.waitForTimeout(100);
const initial = await page.evaluate(() => {
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  const root = document.getElementById('root');
  return { bodyBg, rootEmpty: root?.innerHTML === '' };
});
console.log('=== 100ms (before JS) ===');
console.log(JSON.stringify(initial));
await page.screenshot({ path: '/tmp/local-initial-100ms.png', fullPage: false });

// Check at 300ms (early hydration)
await page.waitForTimeout(200);
const earlyHydrate = await page.evaluate(() => {
  const root = document.getElementById('root');
  const hasRoot = root?.innerHTML && root.innerHTML.length > 0;
  const bars = document.querySelectorAll('div.border-b.bg-bone');
  return {
    hasRoot,
    barCount: bars.length,
    barText: bars[0]?.textContent?.trim().substring(0, 80) || 'none',
    bodyBg: window.getComputedStyle(document.body).backgroundColor
  };
});
console.log('=== 300ms (early hydration) ===');
console.log(JSON.stringify(earlyHydrate));

// Wait for full load
await page.waitForTimeout(3000);
const fullyLoaded = await page.evaluate(() => {
  const bars = document.querySelectorAll('div.border-b.bg-bone');
  const albumImg = document.querySelector('img[alt*="artwork"]');
  return {
    barCount: bars.length,
    barText: bars[0]?.textContent?.trim().substring(0, 80) || 'none',
    barBg: bars[0] ? window.getComputedStyle(bars[0]).backgroundColor : 'none',
    albumSrc: albumImg?.getAttribute('src') || 'none',
    albumAlt: albumImg?.getAttribute('alt') || 'none'
  };
});
console.log('=== AFTER full load ===');
console.log(JSON.stringify(fullyLoaded));

// Full screenshot
await page.screenshot({ path: '/tmp/local-homepage-fixed.png', fullPage: true });
console.log('Full screenshot saved');

// Navigate to shop (SPA)
const shopLink = await page.$('a[href="/shop"]');
if (shopLink) {
  await shopLink.click();
  await page.waitForTimeout(2000);
  
  const shopState = await page.evaluate(() => {
    const bars = document.querySelectorAll('div.border-b.bg-bone');
    const albumImg = document.querySelector('img[alt*="artwork"]');
    return {
      barCount: bars.length,
      barText: bars[0]?.textContent?.trim().substring(0, 80) || 'none',
      albumSrc: albumImg?.getAttribute('src') || 'none'
    };
  });
  console.log('=== SHOP page (SPA) ===');
  console.log(JSON.stringify(shopState));
  await page.screenshot({ path: '/tmp/local-shop-fixed.png', fullPage: true });
}

console.log('\nNetwork errors:', networkErrors.length > 0 ? networkErrors : 'None');

await browser.close();
