import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

// Go to homepage
await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded', timeout: 15000 });

// Take initial screenshot (before JS loads fully)
await page.waitForTimeout(500);

// Check the AnnouncementBar
const announcementBars = await page.$$eval('div.border-b.bg-bone', (els) =>
  els.map(el => ({ 
    class: el.className, 
    text: el.textContent?.trim().substring(0, 120),
    bg: window.getComputedStyle(el).backgroundColor,
    height: window.getComputedStyle(el).height
  }))
);
console.log('Initial Announcement bars:', JSON.stringify(announcementBars));

// Wait for app to fully load
await page.waitForTimeout(3000);

// Check AnnouncementBar after load
const announcementBarsAfter = await page.$$eval('div.border-b.bg-bone', (els) =>
  els.map(el => ({ 
    class: el.className, 
    text: el.textContent?.trim().substring(0, 120),
    bg: window.getComputedStyle(el).backgroundColor,
    height: window.getComputedStyle(el).height
  }))
);
console.log('After load Announcement bars:', JSON.stringify(announcementBarsAfter));

// Take screenshot after load
await page.screenshot({ path: '/tmp/homepage-loaded.png', fullPage: true });

// Check album cover
const albumImg = await page.$('img[alt*="artwork"]');
if (albumImg) {
  const src = await albumImg.getAttribute('src');
  console.log('Album cover img src:', src);
} else {
  console.log('No album cover img found');
}

// Check for placeholder text
const allText = await page.textContent('body');
console.log('Has "Artwork to be announced":', allText.includes('Artwork to be announced'));
console.log('Has placeholder "Album artwork":', allText.includes('Album artwork'));

// Now navigate using SPA (click a link)
const homeContent = await page.content();

// Click the Shop nav link (SPA navigation)
await page.click('nav a[href="/shop"]');
await page.waitForTimeout(2000);

// Take screenshot of shop page
await page.screenshot({ path: '/tmp/shop-spa.png', fullPage: true });

// Check AnnouncementBar on shop page
const shopAnnouncementBars = await page.$$eval('div.border-b.bg-bone', (els) =>
  els.map(el => ({ 
    class: el.className, 
    text: el.textContent?.trim().substring(0, 120),
    bg: window.getComputedStyle(el).backgroundColor,
    height: window.getComputedStyle(el).height
  }))
);
console.log('Shop Announcement bars:', JSON.stringify(shopAnnouncementBars));

// Click back to home (SPA navigation)
await page.click('nav a[href="/"]');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/homepage-spa-back.png', fullPage: true });

// Check AnnouncementBar after returning home
const homeBackAnnouncementBars = await page.$$eval('div.border-b.bg-bone', (els) =>
  els.map(el => ({ 
    class: el.className, 
    text: el.textContent?.trim().substring(0, 120),
    bg: window.getComputedStyle(el).backgroundColor,
    height: window.getComputedStyle(el).height
  }))
);
console.log('Home after SPA Announcement bars:', JSON.stringify(homeBackAnnouncementBars));

// Check what the announcement text looks like - is it the default or the DB value?
const announcementText = await page.$eval('p', (el) => el.textContent?.trim().substring(0, 120));
console.log('First p tag text:', announcementText);

// Check for white pixels at the very top of the page
const topColor = await page.evaluate(() => {
  const el = document.elementFromPoint(window.innerWidth / 2, 5);
  return {
    tag: el?.tagName,
    class: el?.className,
    bg: window.getComputedStyle(el).backgroundColor,
    text: el?.textContent?.trim().substring(0, 60)
  };
});
console.log('Element at top center:', JSON.stringify(topColor));

// Check AnnouncementBar specifically  
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

await browser.close();
