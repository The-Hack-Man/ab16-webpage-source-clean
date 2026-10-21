import type Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

/**
 * Idempotency helpers for Stripe webhook processing.
 *
 * These pure functions work alongside the database-level idempotency
 * (claim_stripe_event / mark_stripe_event_completed / mark_stripe_event_failed)
 * to provide defence-in-depth against duplicate Stripe deliveries.
 *
 * Database functions on production:
 *   claim_stripe_event(p_event_id text) RETURNS boolean
 *   mark_stripe_event_completed(p_event_id text) RETURNS void
 *   mark_stripe_event_failed(p_event_id text, p_error text) RETURNS void
 */

export type StripeEventStatus = 'processing' | 'completed' | 'failed';

export type OrderRecord = {
  id: string;
  order_number: string;
  total: number;
  payment_status: string;
  payment_intent_id: string | null;
  owner_order_notified_at: string | null;
};

export type PaymentRecord = {
  id: string;
  stripe_session_id: string | null;
  status: string;
};

export type MasteringCredits = {
  user_id: string;
  credits: number;
};

export type PrintfulOrder = {
  id: string;
  printful_order_id: number | null;
  status: string;
  confirmed_at: string | null;
};

export function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === 'paid';
}

export function isFulfillableOrder(order: OrderRecord): boolean {
  return order.payment_status !== 'paid';
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

export function canInsertPrintfulOrderItem(
  existingItems: Array<{ id: string }>,
): boolean {
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
  if (!isFulfillableOrder(order)) {
    return { shouldProcess: false, reason: 'order_already_paid' };
  }

  if (order.payment_status === 'refunded') {
    return { shouldProcess: false, reason: 'order_refunded' };
  }

  if (order.payment_status === 'failed') {
    return { shouldProcess: false, reason: 'order_failed' };
  }

  if (session.currency !== 'gbp') {
    return { shouldProcess: false, reason: 'currency_mismatch' };
  }

  if (session.amount_total !== order.total) {
    return { shouldProcess: false, reason: 'amount_mismatch' };
  }

  return { shouldProcess: true, reason: 'ok' };
}

export function checkMasteringCreditIdempotency(paymentRecord: PaymentRecord | null): IdempotencyCheck {
  if (!paymentRecord) {
    return { shouldProcess: false, reason: 'payment_record_not_found' };
  }
  if (paymentRecord.status === 'paid') {
    return { shouldProcess: false, reason: 'credits_already_granted' };
  }
  if (paymentRecord.status !== 'pending') {
    return { shouldProcess: false, reason: 'payment_not_pending' };
  }
  return { shouldProcess: true, reason: 'ok' };
}

export function checkExpiredPaymentIdempotency(order: OrderRecord | null): IdempotencyCheck {
  if (!order) {
    return { shouldProcess: false, reason: 'order_not_found' };
  }
  if (order.payment_status !== 'pending') {
    return { shouldProcess: false, reason: 'order_not_pending' };
  }
  return { shouldProcess: true, reason: 'ok' };
}

export function checkExpiredPaymentRecordIdempotency(record: PaymentRecord | null): IdempotencyCheck {
  if (!record) {
    return { shouldProcess: false, reason: 'payment_record_not_found' };
  }
  if (record.status !== 'pending') {
    return { shouldProcess: false, reason: 'payment_record_not_pending' };
  }
  return { shouldProcess: true, reason: 'ok' };
}

export function checkPrintfulSubmissionIdempotency(
  existing: PrintfulOrder | null,
): IdempotencyCheck {
  if (existing?.confirmed_at) {
    return { shouldProcess: false, reason: 'printful_order_already_confirmed' };
  }
  if (existing && !canClaimPrintfulOrder(existing)) {
    return { shouldProcess: false, reason: 'printful_order_already_processing' };
  }
  return { shouldProcess: true, reason: 'ok' };
}

/**
 * Classify an event claim result for logging / metrics.
 * Mirrors what the database claim_stripe_event returns as a boolean:
 *   true  → this worker should process the event
 *   false → event already completed or currently locked by another worker
 */
export function describeClaimOutcome(claimed: boolean, existingStatus?: StripeEventStatus): string {
  if (claimed) return 'claimed';
  if (existingStatus) return `skipped_${existingStatus}`;
  return 'skipped';
}
