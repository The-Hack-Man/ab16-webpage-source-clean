import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

page.on('console', (msg) => { console.log('PAGE LOG:', msg.text()); });
page.on('pageerror', (err) => { console.log('PAGE ERROR:', err.message); });

function getBars() {
  return page.evaluate(() => {
    const bars = document.querySelectorAll('div.border-b.bg-bone');
    return Array.from(bars).map((el) => {
      const text = el.textContent || '';
      const style = window.getComputedStyle(el);
      return {
        text: text.trim().substring(0, 120),
        bg: style.backgroundColor,
        height: style.height,
        top: el.getBoundingClientRect().top
      };
    });
  });
}

// Go to homepage
await page.goto('http://localhost:5175/', { waitUntil: 'networkidle', timeout: 30000 });

// Check INITIAL state (before Supabase loads)
await page.waitForTimeout(500);

console.log('=== INITIAL STATE (0.5s) ===');
const initialBars = await getBars();
console.log('Announcement bars:', JSON.stringify(initialBars));

// Wait for app to fully load
await page.waitForTimeout(3000);

console.log('\n=== AFTER LOAD (3.5s) ===');
const loadedBars = await getBars();
console.log('Announcement bars:', JSON.stringify(loadedBars));

await page.screenshot({ path: '/tmp/homepage-after-fix.png', fullPage: true });
console.log('Screenshot saved');

// Check album cover
const albumSrc = await page.$eval('img[alt*="artwork"]', (el) => el.getAttribute('src')).catch(() => null);
console.log('Album cover img src:', albumSrc);
if (albumSrc) {
  const albumVisible = await page.$eval('img[alt*="artwork"]', (el) => el.getAttribute('alt')).catch(() => null);
  console.log('Album cover alt:', albumVisible);
}

const allText = await page.textContent('body');
console.log('Has "Artwork to be announced":', allText.includes('Artwork to be announced'));
console.log('Has "Album artwork":', allText.includes('Album artwork'));
console.log('Has announcement:', allText.includes('JAMIE G'));

// Navigate to shop
await page.goto('http://localhost:5175/shop', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

console.log('\n=== SHOP PAGE ===');
const shopBars = await getBars();
console.log('Announcement bars:', JSON.stringify(shopBars));

await page.screenshot({ path: '/tmp/shop-after-fix.png', fullPage: true });

// Navigate back home
await page.goto('http://localhost:5175/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

console.log('\n=== HOME AFTER RETURN ===');
const homeBars = await getBars();
console.log('Announcement bars:', JSON.stringify(homeBars));

// Verify album cover image source
const allImgs = await page.$$eval('img', (els) =>
  els.map((el) => ({ src: el.getAttribute('src'), alt: el.getAttribute('alt') }))
);
console.log('\nAll images:');
allImgs.forEach((img, i) => console.log(`  ${i}: src="${img.src}" alt="${img.alt}"`));

console.log('\n=== SUMMARY ===');
console.log('Initial flash present:', initialBars.length > 0);
console.log('Bar visible after load:', loadedBars.length > 0);
console.log('Announcement text correct:', loadedBars[0]?.text === 'JAMIE G — NEW ALBUM ARRIVES 02.12.26');

await browser.close();
