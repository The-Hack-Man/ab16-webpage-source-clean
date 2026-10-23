import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

const networkErrors = [];

page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
page.on('requestfailed', req => networkErrors.push(req.url() + ': ' + req.failure()?.errorText));

// Navigate to DEPLOYED site and check VERY quickly
await page.goto('https://super-feather-1f5e.mcjamieg4.workers.dev/', { waitUntil: 'commit', timeout: 30000 });

// Check immediately (before JS renders)
await page.waitForTimeout(100);
const initialColor = await page.evaluate(() => {
  // Check the body background
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  // Check element at top
  const topEl = document.elementFromPoint(window.innerWidth / 2, 5);
  const topBg = topEl ? window.getComputedStyle(topEl).backgroundColor : 'none';
  return { bodyBg, topEl: topEl?.tagName, topBg, rootInnerHTML: document.getElementById('root')?.innerHTML.substring(0, 100) };
});
console.log('=== 100ms after navigation ===');
console.log('Initial state:', JSON.stringify(initialColor));

// Take screenshot at 100ms
await page.screenshot({ path: '/tmp/deployed-initial-100ms.png', fullPage: false });

// Wait for hydration
await page.waitForTimeout(500);
const afterHydrate = await page.evaluate(() => {
  const root = document.getElementById('root');
  const rootContent = root?.innerHTML?.substring(0, 200) || 'empty';
  const bars = document.querySelectorAll('div.border-b.bg-bone');
  const barCount = bars.length;
  const firstBarText = bars[0]?.textContent?.trim().substring(0, 80) || 'none';
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  return { rootContent, barCount, firstBarText, bodyBg };
});
console.log('=== 600ms after navigation (after hydration) ===');
console.log('After hydrate:', JSON.stringify(afterHydrate));

// Wait for Supabase
await page.waitForTimeout(3000);
const afterSupabase = await page.evaluate(() => {
  const bars = document.querySelectorAll('div.border-b.bg-bone');
  return {
    barCount: bars.length,
    firstBarText: bars[0]?.textContent?.trim().substring(0, 80) || 'none',
    barBg: bars[0] ? window.getComputedStyle(bars[0]).backgroundColor : 'none'
  };
});
console.log('=== AFTER Supabase fetch ===');
console.log('After Supabase:', JSON.stringify(afterSupabase));

// Full screenshot
await page.screenshot({ path: '/tmp/deployed-homepage-full.png', fullPage: true });
console.log('Full screenshot saved');

// Check network errors
console.log('\nNetwork errors:', networkErrors.length > 0 ? networkErrors : 'None');

// Check image resources
const images = await page.$$eval('img', (els) => els.map(el => ({ src: el.getAttribute('src'), complete: el.complete, naturalWidth: el.naturalWidth })));
console.log('Images:', JSON.stringify(images, null, 2));

await browser.close();
