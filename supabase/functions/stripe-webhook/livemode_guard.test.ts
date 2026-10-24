import { describe, expect, it, vi } from 'vitest';
import { runForLiveStripeEvent } from './livemode_guard';

describe('runForLiveStripeEvent', () => {
  it('does not run business logic for a test-mode event', async () => {
    const handleLiveEvent = vi.fn(async () => 'processed');
    const handleTestEvent = vi.fn();

    const result = await runForLiveStripeEvent(
      { id: 'evt_test_123', type: 'checkout.session.completed', livemode: false },
      handleLiveEvent,
      handleTestEvent,
    );

    expect(result).toBeUndefined();
    expect(handleLiveEvent).not.toHaveBeenCalled();
    expect(handleTestEvent).toHaveBeenCalledWith({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      livemode: false,
    });
  });

  it('continues live-mode events through the existing business logic', async () => {
    const handleLiveEvent = vi.fn(async () => 'processed');
    const handleTestEvent = vi.fn();

    const result = await runForLiveStripeEvent(
      { id: 'evt_live_123', type: 'checkout.session.completed', livemode: true },
      handleLiveEvent,
      handleTestEvent,
    );

    expect(result).toBe('processed');
    expect(handleLiveEvent).toHaveBeenCalledOnce();
    expect(handleTestEvent).not.toHaveBeenCalled();
  });

  it('preserves live processing errors for Stripe retry handling', async () => {
    const failure = new Error('database temporarily unavailable');

    await expect(runForLiveStripeEvent(
      { id: 'evt_live_456', type: 'checkout.session.completed', livemode: true },
      async () => { throw failure; },
      vi.fn(),
    )).rejects.toBe(failure);
  });
});
