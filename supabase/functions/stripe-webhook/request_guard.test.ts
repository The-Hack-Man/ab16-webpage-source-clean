import { describe, expect, it, vi } from 'vitest';
import { verifyStripeWebhookSignature } from './request_guard';

describe('verifyStripeWebhookSignature', () => {
  it('rejects requests without a Stripe signature before invoking verification', async () => {
    const verify = vi.fn(async () => ({ id: 'evt_test' }));
    const request = new Request('https://webhook.example.test', {
      method: 'POST',
      body: '{"id":"evt_test"}',
    });

    const result = await verifyStripeWebhookSignature(request, 'whsec_test', verify);

    expect(result).toEqual({ success: false, reason: 'missing_signature' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures without returning an event', async () => {
    const signatureError = new Error('signature mismatch');
    const verify = vi.fn(async () => {
      throw signatureError;
    });
    const request = new Request('https://webhook.example.test', {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid' },
      body: '{"id":"evt_test"}',
    });

    const result = await verifyStripeWebhookSignature(request, 'whsec_test', verify);

    expect(result).toEqual({
      success: false,
      reason: 'invalid_signature',
      error: signatureError,
    });
  });

  it('passes the original body, signature, and secret to Stripe verification', async () => {
    const body = '{ "id": "evt_test", "type": "checkout.session.completed" }';
    const event = { id: 'evt_test' };
    const verify = vi.fn(async () => event);
    const request = new Request('https://webhook.example.test', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=valid' },
      body,
    });

    const result = await verifyStripeWebhookSignature(request, 'whsec_test', verify);

    expect(result).toEqual({ success: true, event });
    expect(verify).toHaveBeenCalledWith(body, 't=123,v1=valid', 'whsec_test');
  });
});
