import { describe, it, expect } from 'vitest';
import { StripeService, STRIPE_CONFIG } from '../../src/stripe/index.js';

describe('StripeService', () => {
  it('uses default config', () => {
    const service = new StripeService();
    expect(service.getConfig()).toEqual(STRIPE_CONFIG);
  });

  it('uses provided config', () => {
    const service = new StripeService({ apiVersion: '2025-01-01', currency: 'usd' });
    expect(service.getConfig()).toEqual({ apiVersion: '2025-01-01', currency: 'usd' });
  });

  it('has correct default values', () => {
    expect(STRIPE_CONFIG.apiVersion).toBeTruthy();
    expect(STRIPE_CONFIG.currency).toBe('gbp');
  });
});

