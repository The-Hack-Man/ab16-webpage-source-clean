import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

// Go to DEPLOYED homepage
await page.goto('https://super-feather-1f5e.mcjamieg4.workers.dev/', { waitUntil: 'networkidle', timeout: 30000 });

// Wait for app to load
await page.waitForTimeout(3000);

// Take screenshot
await page.screenshot({ path: '/tmp/deployed-homepage.png', fullPage: true });

// Check the AnnouncementBar
const bars = await page.$$eval('div.border-b.bg-bone', (els) =>
  els.map(el => ({ 
    class: el.className, 
    text: el.textContent?.trim().substring(0, 120),
    bg: window.getComputedStyle(el).backgroundColor,
    height: window.getComputedStyle(el).height
  }))
);
console.log('Deployed Announcement bars:', JSON.stringify(bars));

// Check album cover
const albumImg = await page.$('img[alt*="artwork"]');
if (albumImg) {
  const src = await albumImg.getAttribute('src');
  console.log('Album cover img src:', src);
  const isVisible = await albumImg.isVisible();
  console.log('Album cover img visible:', isVisible);
} else {
  console.log('No album cover img found');
}

const allText = await page.textContent('body');
console.log('Has "Artwork to be announced":', allText.includes('Artwork to be announced'));
console.log('Has "Album artwork":', allText.includes('Album artwork'));

// Check the UpcomingAlbumBanner section
const bannerSection = await page.$eval('section', (el) => ({
  class: el.className,
  text: el.textContent?.trim().substring(0, 200)
}));
console.log('First section:', JSON.stringify(bannerSection));

// Get all sections
const allSections = await page.$$eval('section', (els) =>
  els.map(el => ({ 
    class: el.className.substring(0, 80), 
    text: el.textContent?.trim().substring(0, 80)
  }))
);
console.log('All sections:', JSON.stringify(allSections, null, 2));

// Check announcement bar rect
const announcementRect = await page.evaluate(() => {
  const bars = document.querySelectorAll('div.border-b.bg-bone');
  if (bars.length === 0) return null;
  const bar = bars[0];
  const rect = bar.getBoundingClientRect();
  return {
    top: rect.top,
    height: rect.height,
    backgroundColor: window.getComputedStyle(bar).backgroundColor,
    isRendered: rect.height > 0
  };
});
console.log('Announcement bar rect:', JSON.stringify(announcementRect));

// Now check if navigating to another page makes the banner disappear
// Click a nav link
const shopLink = await page.$('a[href="/shop"]');
if (shopLink) {
  await shopLink.click();
  await page.waitForTimeout(2000);
  
  const shopBars = await page.$$eval('div.border-b.bg-bone', (els) =>
    els.map(el => ({ 
      text: el.textContent?.trim().substring(0, 120),
      bg: window.getComputedStyle(el).backgroundColor,
      height: window.getComputedStyle(el).height
    }))
  );
  console.log('Shop page Announcement bars:', JSON.stringify(shopBars));
  
  await page.screenshot({ path: '/tmp/deployed-shop.png', fullPage: true });
}

// Go back to home
await page.goto('https://super-feather-1f5e.mcjamieg4.workers.dev/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const homeBars = await page.$$eval('div.border-b.bg-bone', (els) =>
  els.map(el => ({ 
    text: el.textContent?.trim().substring(0, 120),
    bg: window.getComputedStyle(el).backgroundColor,
    height: window.getComputedStyle(el).height
  }))
);
console.log('Home after refresh Announcement bars:', JSON.stringify(homeBars));

await browser.close();
