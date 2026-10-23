import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { verifyCheckoutOrder } from './verification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!stripeKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Checkout verification is not configured.' }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid checkout request.' }, 400);
  }
  const sessionId = typeof body === 'object' && body !== null && 'sessionId' in body
    && typeof body.sessionId === 'string'
    ? body.sessionId
    : '';
  if (!sessionId.startsWith('cs_')) return json({ error: 'Invalid checkout session.' }, 400);

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.order_id;
    if (!orderId) return json({ error: 'This checkout session is not linked to a store order.' }, 409);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, email, total, payment_status, payment_intent_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('Could not load the checkout order for verification.');
      return json({ error: 'Could not verify this order yet. Please try again.' }, 503);
    }
    if (!order) return json({ error: 'This checkout session is not linked to a store order.' }, 404);

    const result = verifyCheckoutOrder({
      id: session.id,
      mode: session.mode,
      status: session.status,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
      currency: session.currency,
      amountTotal: session.amount_total,
      customerEmail: session.customer_details?.email ?? session.customer_email,
      paymentIntentId: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    }, order);

    if (result.status === 'failed') return json({ status: 'failed', error: result.error });
    if (result.status === 'pending') return json({ status: 'pending' });
    return json({ status: 'paid', orderNumber: result.orderNumber });
  } catch (error) {
    console.error(
      'Checkout verification failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    return json({ error: 'Could not verify this Stripe payment.' }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
