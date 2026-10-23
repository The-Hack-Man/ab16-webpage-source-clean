import { describe, expect, it } from 'vitest';
import { verifyCheckoutOrder } from './verification';

const session = {
  id: 'cs_test_order',
  mode: 'payment',
  status: 'complete',
  paymentStatus: 'paid',
  metadata: { order_id: 'order-1', order_number: 'AB16-001' },
  currency: 'gbp',
  amountTotal: 7500,
  customerEmail: 'buyer@example.test',
  paymentIntentId: 'pi_order',
};

const order = {
  id: 'order-1',
  order_number: 'AB16-001',
  email: 'buyer@example.test',
  total: 7500,
  payment_status: 'paid',
  payment_intent_id: 'pi_order',
};

describe('verifyCheckoutOrder', () => {
  it('confirms a completed, paid session linked to its saved order', () => {
    expect(verifyCheckoutOrder(session, order)).toEqual({
      status: 'paid',
      orderNumber: 'AB16-001',
    });
  });

  it('does not confirm payment while Stripe or the order record is pending', () => {
    expect(verifyCheckoutOrder({ ...session, paymentStatus: 'unpaid' }, {
      ...order,
      payment_status: 'pending',
    })).toEqual({ status: 'pending' });
    expect(verifyCheckoutOrder(session, { ...order, payment_status: 'pending' }))
      .toEqual({ status: 'pending' });
  });

  it.each([
    [{ ...session, status: 'expired' }, order],
    [session, { ...order, payment_status: 'failed' }],
    [session, { ...order, payment_status: 'refunded' }],
    [{ ...session, metadata: { ...session.metadata, order_id: 'other-order' } }, order],
    [{ ...session, customerEmail: 'other@example.test' }, order],
    [{ ...session, amountTotal: 7501 }, order],
    [{ ...session, currency: 'usd' }, order],
    [{ ...session, mode: 'subscription' }, order],
    [session, { ...order, payment_intent_id: 'cs_another_session' }],
  ])('rejects failed or mismatched checkout details', (checkout, savedOrder) => {
    expect(verifyCheckoutOrder(checkout, savedOrder).status).toBe('failed');
  });

  it('accepts the session id saved before Stripe creates a payment intent', () => {
    expect(verifyCheckoutOrder({ ...session, paymentIntentId: null }, {
      ...order,
      payment_intent_id: session.id,
    }).status).toBe('paid');
  });
});
