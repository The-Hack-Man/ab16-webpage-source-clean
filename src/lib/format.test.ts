import { describe, expect, it } from 'vitest';
import { formatPrice, slugify, generateOrderNumber, formatDate, formatDateLong, storeImageUrl } from './format';

describe('formatPrice', () => {
  it('formats GBP pence as pounds', () => {
    expect(formatPrice(2200)).toBe('£22.00');
  });

  it('formats USD', () => {
    expect(formatPrice(1500, 'USD')).toBe('$15.00');
  });

  it('formats zero pence', () => {
    expect(formatPrice(0)).toBe('£0.00');
  });

  it('formats EUR', () => {
    expect(formatPrice(4000, 'EUR')).toBe('€40.00');
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('AB16 T-Shirt (White)')).toBe('ab16-t-shirt-white');
  });

  it('trims and strips leading/trailing hyphens', () => {
    expect(slugify('  ---Hello World---  ')).toBe('hello-world');
  });

  it('collapses internal whitespace runs', () => {
    expect(slugify('one    two   three')).toBe('one-two-three');
  });

  it('removes accented and special characters', () => {
    expect(slugify('Café & Crème!')).toBe('caf-crme');
  });
});

describe('generateOrderNumber', () => {
  it('returns an AB16-prefixed order number', () => {
    const order = generateOrderNumber();
    expect(order).toMatch(/^AB16-\d{8}-[A-Z0-9]{5}$/);
  });

  it('includes the current UTC date', () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(generateOrderNumber()).toContain(`AB16-${today}-`);
  });
});

describe('formatDate', () => {
  it('formats a date string en-GB', () => {
    expect(formatDate('2026-12-02')).toBe('2 Dec 2026');
  });

  it('returns TBC for null', () => {
    expect(formatDate(null)).toBe('TBC');
  });

  it('returns TBC for empty string', () => {
    expect(formatDate('')).toBe('TBC');
  });
});

describe('formatDateLong', () => {
  it('formats with long month name', () => {
    expect(formatDateLong('2026-12-02')).toBe('2 December 2026');
  });
});

describe('storeImageUrl', () => {
  it('maps ab16clothing1.png to optimised webp', () => {
    expect(storeImageUrl('/images/merch/ab16clothing1.png')).toBe('/images/merch/opt/ab16clothing1.webp');
  });

  it('maps ab16clothing.png to optimised webp', () => {
    expect(storeImageUrl('/images/merch/ab16clothing.png')).toBe('/images/merch/opt/ab16clothing.webp');
  });

  it('returns undefined for null input', () => {
    expect(storeImageUrl(null)).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(storeImageUrl(undefined)).toBeUndefined();
  });

  it('passes through unknown URLs unchanged', () => {
    expect(storeImageUrl('/other.png')).toBe('/other.png');
  });
});
