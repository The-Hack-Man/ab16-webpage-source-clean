import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SITE_ORIGIN = new URL(Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ab16clothing.co.uk').origin;
const IS_TEST_DEPLOYMENT = Deno.env.get('STRIPE_EXPECT_LIVE_MODE') === 'false';
const corsHeaders = {
  'Access-Control-Allow-Origin': IS_TEST_DEPLOYMENT ? '*' : SITE_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PACKAGES: Record<string, { credits: number; amount: number; priceId?: string }> = {
  single: { credits: 1, amount: 500, priceId: Deno.env.get('STRIPE_MASTERING_PRICE_SINGLE') },
  pack5: { credits: 5, amount: 2500, priceId: Deno.env.get('STRIPE_MASTERING_PRICE_PACK5') },
  pack10: { credits: 10, amount: 5000, priceId: Deno.env.get('STRIPE_MASTERING_PRICE_PACK10') },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const expectedStripeMode = Deno.env.get('STRIPE_EXPECT_LIVE_MODE');
  if (!stripeKey || !stripeModeMatchesDeployment(stripeKey, expectedStripeMode)
    || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Mastering payment verification is not configured.' }, 503);
  }
  if (Object.values(PACKAGES).some((pkg) => !pkg.priceId)) {
    return json({ error: 'Mastering payment prices are not configured.' }, 503);
  }

  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: 'Sign in to verify this purchase.' }, 401);

  let sessionId = '';
  try {
    const body: unknown = await req.json();
    if (typeof body === 'object' && body !== null && 'sessionId' in body && typeof body.sessionId === 'string') {
      sessionId = body.sessionId;
    }
  } catch {
    return json({ error: 'Invalid checkout verification request.' }, 400);
  }
  if (!sessionId.startsWith('cs_')) return json({ error: 'Invalid checkout session.' }, 400);

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Your sign-in session is invalid. Sign in and try again.' }, 401);

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price'],
    });
    const userId = authData.user.id;
    const pkg = PACKAGES[session.metadata?.package ?? ''];
    const metadataCredits = Number(session.metadata?.credits);
    const lineItems = session.line_items?.data ?? [];
    const lineItemPrice = lineItems[0]?.price;
    const lineItemPriceId = typeof lineItemPrice === 'string' ? lineItemPrice : lineItemPrice?.id;

    if (session.mode !== 'payment'
      || session.client_reference_id !== userId
      || session.metadata?.user_id !== userId
      || !pkg
      || lineItems.length !== 1
      || lineItems[0].quantity !== 1
      || lineItemPriceId !== pkg.priceId
      || metadataCredits !== pkg.credits
      || session.currency !== 'gbp'
      || session.amount_total !== pkg.amount) {
      return json({ error: 'This checkout session does not match your mastering purchase.' }, 403);
    }
    if (session.payment_status !== 'paid') {
      return json({ status: session.status === 'expired' ? 'failed' : 'pending' });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: payment, error: paymentError } = await db
      .from('payment_records')
      .select('user_id, amount_cents, currency, credits_purchased, status')
      .eq('stripe_session_id', session.id)
      .maybeSingle();
    if (paymentError) throw new Error('Could not verify the payment record.');
    if (!payment
      || payment.user_id !== userId
      || payment.amount_cents !== pkg.amount
      || payment.currency !== 'gbp'
      || payment.credits_purchased !== pkg.credits) {
      return json({ error: 'The payment record does not match this mastering purchase.' }, 409);
    }

    const { error: grantError } = await db.rpc('grant_mastering_credits', {
      p_stripe_session_id: session.id,
      p_user_id: userId,
      p_credits: pkg.credits,
      p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    });
    if (grantError) throw new Error('Payment was received but credits could not be applied yet. Please retry verification.');

    const { data: balance, error: balanceError } = await db
      .from('mastering_credits')
      .select('credits')
      .eq('user_id', userId)
      .maybeSingle();
    if (balanceError || !balance) throw new Error('Credits were applied, but the balance could not be loaded. Please refresh.');
    return json({ status: 'paid', credits: balance.credits });
  } catch (error) {
    console.error('Mastering checkout verification failed:', error instanceof Error ? error.name : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'Could not verify this payment.' }, 503);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripeModeMatchesDeployment(stripeSecret: string, configuredMode?: string): boolean {
  if (configuredMode !== undefined && configuredMode !== 'true' && configuredMode !== 'false') return false;
  const keyMode = /^(?:sk|rk)_(test|live)_/.exec(stripeSecret)?.[1];
  if (!keyMode) return false;
  return keyMode === (configuredMode === 'false' ? 'test' : 'live');
}
