import type Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

export type StripeEventStatus = 'processing' | 'completed' | 'failed';

export type OrderRecord = {
  id: string;
  order_number: string;
  total: number;
  payment_status: string;
  payment_intent_id: string | null;
  fulfilment_status: string | null;
  owner_order_notified_at: string | null;
};

export type PaymentRecord = {
  id: string;
  stripe_session_id: string | null;
  status: string;
};

export type MasteringCredits = { user_id: string; credits: number };

export type PrintfulOrder = {
  id: string;
  printful_order_id: number | null;
  status: string;
  confirmed_at: string | null;
};

export function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === 'paid';
}

/**
 * An order may already be paid and still require fulfilment recovery.
 * This function means "still needs fulfilment work", not "payment is unpaid".
 */
export function isFulfillableOrder(order: OrderRecord): boolean {
  return order.payment_status === 'paid'
    && order.fulfilment_status !== 'fulfilled'
    && order.payment_status !== 'refunded'
    && order.payment_status !== 'failed';
}

export function isPendingPayment(record: PaymentRecord): boolean {
  return record.status === 'pending';
}

export function canClaimPrintfulOrder(existing: PrintfulOrder | null): boolean {
  if (!existing) return true;
  if (existing.confirmed_at) return false;
  if (existing.status === 'processing') return false;
  return existing.status === 'pending' || existing.status === 'failed';
}

export function canSendOwnerNotification(order: OrderRecord): boolean {
  return order.owner_order_notified_at == null;
}

export function canInsertPrintfulOrderItem(existingItems: Array<{ id: string }>): boolean {
  return existingItems.length === 0;
}

export interface IdempotencyCheck {
  shouldProcess: boolean;
  reason: string;
}

export function checkClothingOrderIdempotency(
  order: OrderRecord,
  session: Stripe.Checkout.Session,
): IdempotencyCheck {
  if (order.payment_status === 'refunded') return { shouldProcess: false, reason: 'order_refunded' };
  if (order.payment_status === 'failed') return { shouldProcess: false, reason: 'order_failed' };
  if (order.payment_status === 'paid' && order.fulfilment_status === 'fulfilled') {
    return { shouldProcess: false, reason: 'order_already_paid_and_fulfilled' };
  }
  if (session.currency?.toLowerCase() !== 'gbp') return { shouldProcess: false, reason: 'currency_mismatch' };
  if (session.amount_total !== order.total) return { shouldProcess: false, reason: 'amount_mismatch' };
  return { shouldProcess: true, reason: 'ok' };
}

export function checkMasteringCreditIdempotency(paymentRecord: PaymentRecord | null): IdempotencyCheck {
  if (!paymentRecord) return { shouldProcess: false, reason: 'payment_record_not_found' };
  if (paymentRecord.status === 'paid') return { shouldProcess: false, reason: 'credits_already_granted' };
  if (paymentRecord.status !== 'pending') return { shouldProcess: false, reason: 'payment_not_pending' };
  return { shouldProcess: true, reason: 'ok' };
}

export function checkExpiredPaymentIdempotency(order: OrderRecord | null): IdempotencyCheck {
  if (!order) return { shouldProcess: false, reason: 'order_not_found' };
  if (order.payment_status !== 'pending') return { shouldProcess: false, reason: 'order_not_pending' };
  return { shouldProcess: true, reason: 'ok' };
}

export function checkExpiredPaymentRecordIdempotency(record: PaymentRecord | null): IdempotencyCheck {
  if (!record) return { shouldProcess: false, reason: 'payment_record_not_found' };
  if (record.status !== 'pending') return { shouldProcess: false, reason: 'payment_record_not_pending' };
  return { shouldProcess: true, reason: 'ok' };
}

export function checkPrintfulSubmissionIdempotency(existing: PrintfulOrder | null): IdempotencyCheck {
  if (existing?.confirmed_at) return { shouldProcess: false, reason: 'printful_order_already_confirmed' };
  if (existing && !canClaimPrintfulOrder(existing)) {
    return { shouldProcess: false, reason: 'printful_order_already_processing' };
  }
  return { shouldProcess: true, reason: 'ok' };
}

export type ClaimOutcome = 'claimed' | 'completed' | 'locked';

/**
 * Interpret the status-aware result returned by claim_stripe_event_v2.
 * - "claimed": this worker owns the event and should process it.
 * - "skipped_completed": a previous worker already completed this event —
 *   safe to acknowledge to Stripe (HTTP 200).
 * - "locked_retryable": another worker is currently processing this event
 *   — return HTTP 500 so Stripe retries after the lock expires.
 */
export function describeClaimOutcome(outcome: ClaimOutcome): string {
  return outcome === 'claimed' ? 'claimed' : outcome === 'completed' ? 'skipped_completed' : 'locked_retryable';
}

/**
 * Detects the gap where Printful has already confirmed an order
 * but the store order's fulfilment_status has not yet been reconciled.
 */
export function isPrintfulConfirmedButUnreconciled(
  printfulOrder: PrintfulOrder | null,
  order: { fulfilment_status: string | null },
): boolean {
  return Boolean(printfulOrder?.confirmed_at && order.fulfilment_status !== 'fulfilled');
}
