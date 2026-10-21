interface StripeCheckoutForVerification {
  id: string;
  mode: string | null;
  status: string | null;
  paymentStatus: string;
  metadata: Record<string, string> | null;
  currency: string | null;
  amountTotal: number | null;
  customerEmail: string | null;
  paymentIntentId: string | null;
}

interface StoreOrderForVerification {
  id: string;
  order_number: string;
  email: string;
  total: number;
  payment_status: string;
  payment_intent_id: string | null;
}

type CheckoutVerification =
  | { status: 'paid'; orderNumber: string }
  | { status: 'pending' }
  | { status: 'failed'; error: string };

export function verifyCheckoutOrder(
  session: StripeCheckoutForVerification,
  order: StoreOrderForVerification,
): CheckoutVerification {
  const orderMatches = session.metadata?.order_id === order.id
    && session.metadata.order_number === order.order_number;
  const linkedSession = order.payment_intent_id === session.id
    || (session.paymentIntentId !== null && order.payment_intent_id === session.paymentIntentId);
  const sessionEmail = session.customerEmail?.trim().toLowerCase();

  if (
    session.mode !== 'payment'
    || !orderMatches
    || !linkedSession
    || !sessionEmail
    || sessionEmail !== order.email.trim().toLowerCase()
    || session.currency?.toLowerCase() !== 'gbp'
    || session.amountTotal !== order.total
  ) {
    return { status: 'failed', error: 'The checkout details do not match this order.' };
  }

  if (
    session.status === 'expired'
    || order.payment_status === 'failed'
    || order.payment_status === 'refunded'
  ) {
    return { status: 'failed', error: 'This payment was not completed.' };
  }

  if (session.status !== 'complete' || session.paymentStatus !== 'paid') {
    return { status: 'pending' };
  }

  if (order.payment_status !== 'paid') return { status: 'pending' };

  return { status: 'paid', orderNumber: order.order_number };
}
