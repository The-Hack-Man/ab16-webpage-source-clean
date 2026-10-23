import { test, expect } from '@playwright/test';

test.describe('Storefront — homepage rendering', () => {
  test('desktop homepage loads without critical errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(pageErrors).toHaveLength(0);
    await expect(page).toHaveTitle(/Jamie G/i);
  });

  test('mobile homepage loads without critical errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(pageErrors).toHaveLength(0);
  });

  test('no broken image requests on homepage (excluding API calls)', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (resp) => {
      if (resp.request().resourceType() === 'image' && resp.status() >= 400) {
        failed.push(resp.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failed).toHaveLength(0);
  });

  test('homepage shows AB16 brand logo', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const brandLink = page.locator('a[aria-label="AB16 Clothing home"]').first();
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toHaveText(/AB16/i);
  });

  test('homepage has desktop navigation links', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('nav a[href="/shop"]')).toBeVisible();
    await expect(page.locator('nav a[href="/master"]')).toBeVisible();
  });

  test('product catalogue lists published products on shop page', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('a[href="/shop/ab16-tshirt-white"]')).toBeVisible();
    await expect(page.locator('a[href="/shop/ab16-tshirt-black"]')).toBeVisible();
    await expect(page.locator('a[href="/shop/ab16-baseball-cap"]')).toBeVisible();
    await expect(page.locator('a[href="/shop/ab16-black-jumper"]')).toBeVisible();
  });

  test('published product detail shows Add to Bag button', async ({ page }) => {
    await page.goto('/shop/ab16-baseball-cap');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Add to Bag')).toBeVisible();
  });

  test('coming-soon products do not show Add to Bag', async ({ page }) => {
    await page.goto('/shop/ab16-tracksuit');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Add to Bag')).not.toBeVisible();
  });

  test('mobile menu opens and shows navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menuButton = page.locator('button[aria-label="Open menu"]');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    await expect(page.getByRole('link', { name: 'Shop' }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audio Master' }).last()).toBeVisible();
  });

  test('audio master page is accessible from navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav a[href="/master"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/master/);
  });

  test('homepage renders with dark theme styling', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasDarkStyles = await page.evaluate(() => {
      const darkPatterns = ['bg-jet', 'bg-black', 'bg-gray-900', 'text-bone'];
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const cls = el.className?.toString() || '';
        if (darkPatterns.some(dp => cls.includes(dp))) {
          const bg = window.getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
        }
      }
      return false;
    });
    expect(hasDarkStyles).toBe(true);
  });
});
