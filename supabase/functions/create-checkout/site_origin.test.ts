import { describe, expect, it } from 'vitest';
import { resolveSiteOrigin } from '../_shared/site_origin';

describe('resolveSiteOrigin', () => {
  it('uses the documented PUBLIC_SITE_URL when configured', () => {
    expect(resolveSiteOrigin({ PUBLIC_SITE_URL: 'https://shop.example.test/path' }))
      .toBe('https://shop.example.test');
  });

  it('accepts SITE_URL for compatibility with the deployed checkout function', () => {
    expect(resolveSiteOrigin({ SITE_URL: 'https://shop.example.test/checkout' }))
      .toBe('https://shop.example.test');
  });

  it('prefers PUBLIC_SITE_URL when both aliases are set', () => {
    expect(resolveSiteOrigin({
      PUBLIC_SITE_URL: 'https://public.example.test',
      SITE_URL: 'https://legacy.example.test',
    })).toBe('https://public.example.test');
  });

  it('uses the production origin when neither alias is set', () => {
    expect(resolveSiteOrigin({})).toBe('https://ab16clothing.co.uk');
  });

  it('rejects malformed configured URLs', () => {
    expect(() => resolveSiteOrigin({ PUBLIC_SITE_URL: 'not a URL' })).toThrow();
  });
});
