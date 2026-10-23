import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, apikey',
};

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const CREDIT_PACKAGES: Record<string, { credits: number; amount: number; label: string }> = {
  single: { credits: 1, amount: 500, label: '1 Full-Track Master (£5)' },
  pack5: { credits: 5, amount: 2500, label: '5 Mastering Credits (£25)' },
  pack10: { credits: 10, amount: 5000, label: '10 Mastering Credits (£50)' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Payment system is not configured. STRIPE_SECRET_KEY is missing.' }),
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
    const allowedOrigins = new Set([siteOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']);
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: pkg.label },
          unit_amount: pkg.amount,
        },
        quantity: 1,
      }],
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
