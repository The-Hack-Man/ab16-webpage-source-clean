import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SITE_ORIGIN = new URL(Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ab16clothing.co.uk').origin;
const IS_TEST_DEPLOYMENT = Deno.env.get('STRIPE_EXPECT_LIVE_MODE') === 'false';
const corsHeaders = {
  'Access-Control-Allow-Origin': IS_TEST_DEPLOYMENT ? '*' : SITE_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, apikey',
};

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const expectedStripeMode = Deno.env.get('STRIPE_EXPECT_LIVE_MODE');

const CREDIT_PACKAGES: Record<string, { credits: number; amount: number; priceId?: string }> = {
  single: { credits: 1, amount: 500, priceId: Deno.env.get('STRIPE_MASTERING_PRICE_SINGLE') },
  pack5: { credits: 5, amount: 2500, priceId: Deno.env.get('STRIPE_MASTERING_PRICE_PACK5') },
  pack10: { credits: 10, amount: 5000, priceId: Deno.env.get('STRIPE_MASTERING_PRICE_PACK10') },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!stripeKey || !stripeModeMatchesDeployment(stripeKey, expectedStripeMode)
      || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Payment system is not configured for this environment.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { package: packageName, origin } = body;
    const siteOrigin = new URL(Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ab16clothing.co.uk').origin;
    let checkoutOrigin: string;
    try {
      checkoutOrigin = new URL(origin).origin;
    } catch {
      return new Response(
        JSON.stringify({ error: 'A valid checkout origin is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const allowedOrigins = new Set([siteOrigin]);
    if (IS_TEST_DEPLOYMENT) {
      for (const host of ['localhost', '127.0.0.1']) {
        for (const port of [5173, 5174, 5176, 5177]) allowedOrigins.add(`http://${host}:${port}`);
      }
    }
    if (!allowedOrigins.has(checkoutOrigin)) {
      return new Response(
        JSON.stringify({ error: 'Checkout is not available from this site origin.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pkg = CREDIT_PACKAGES[packageName];
    if (!pkg) {
      return new Response(
        JSON.stringify({ error: 'Invalid package. Choose: single, pack5, or pack10.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!pkg.priceId) {
      return new Response(
        JSON.stringify({ error: 'Mastering checkout is not configured for this environment.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${checkoutOrigin}/master?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${checkoutOrigin}/master?payment=cancelled`,
      metadata: {
        user_id: userData.user.id,
        credits: String(pkg.credits),
        package: packageName,
      },
      client_reference_id: userData.user.id,
    });

    const { error: recordError } = await supabase.from('payment_records').insert({
      user_id: userData.user.id,
      stripe_session_id: session.id,
      amount_cents: pkg.amount,
      currency: 'gbp',
      credits_purchased: pkg.credits,
      status: 'pending',
    });

    if (recordError) {
      console.error('Failed to record payment:', recordError);
      await stripe.checkout.sessions.expire(session.id);
      return new Response(
        JSON.stringify({ error: 'Could not prepare the payment record. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function stripeModeMatchesDeployment(stripeSecret: string, configuredMode?: string): boolean {
  if (configuredMode !== undefined && configuredMode !== 'true' && configuredMode !== 'false') return false;
  const keyMode = /^(?:sk|rk)_(test|live)_/.exec(stripeSecret)?.[1];
  if (!keyMode) return false;
  return keyMode === (configuredMode === 'false' ? 'test' : 'live');
}
