import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  validateCustomerInfo,
  validateRequestedItems,
  buildLineItems,
  stripeModeMatchesDeployment,
  missingCheckoutReadinessSecrets,
  type CustomerInfo,
  type CheckoutItem,
} from './checkout_validation.ts';

// Keep production checkout pinned to the canonical storefront even if a stale
// deployment secret still contains an old preview URL.
const SITE_ORIGIN = 'https://ab16clothing.co.uk';
const IS_TEST_DEPLOYMENT = Deno.env.get('STRIPE_EXPECT_LIVE_MODE') === 'false';
const corsHeaders = {
  'Access-Control-Allow-Origin': IS_TEST_DEPLOYMENT ? '*' : SITE_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-checkout-readiness',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FREE_SHIPPING_THRESHOLD = 7500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  let orderId: string | null = null;
  let supabaseClient: ReturnType<typeof createClient> | null = null;

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
    const expectedStripeMode = Deno.env.get('STRIPE_EXPECT_LIVE_MODE');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');

    if (req.headers.get('x-checkout-readiness') === 'true') {
      if (!supabaseUrl || !serviceRoleKey) {
        return json({ error: 'Supabase server configuration is incomplete.' }, 503);
      }
      const supabase = supabaseClient = createClient(supabaseUrl, serviceRoleKey);
      const accessToken = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!accessToken) return json({ error: 'Administrator sign-in is required.' }, 401);
      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !authData.user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401);
      const role = (authData.user.app_metadata as { role?: string } | undefined)?.role;
      if (role !== 'admin' && role !== 'super_admin') return json({ error: 'Administrator access is required.' }, 403);

      const missing = missingCheckoutReadinessSecrets({
        stripeSecretKey: stripeKey,
        expectedStripeMode,
        printfulApiKey: Deno.env.get('PRINTFUL_API_KEY'),
        resendApiKey: Deno.env.get('RESEND_API_KEY'),
        adminOrderEmail: Deno.env.get('ADMIN_ORDER_EMAIL'),
        fromEmail: Deno.env.get('FROM_EMAIL'),
      });
      return json({ ready: missing.length === 0, missing, mode: expectedStripeMode === 'false' ? 'test' : 'live' }, 200);
    }

    if (!stripeKey || !stripeModeMatchesDeployment(stripeKey, expectedStripeMode)
      || !supabaseUrl || !serviceRoleKey) {
      // Record only presence and mode categories; never log a credential or its fingerprint.
      const stripeKeyMode = /^(?:sk|rk)_(test|live)_/.exec(stripeKey ?? '')?.[1] ?? 'missing_or_unsupported';
      console.error('create-checkout configuration rejected', {
        stripeKeyPresent: Boolean(stripeKey),
        stripeKeyMode,
        expectedStripeMode: expectedStripeMode === 'false' ? 'test' : expectedStripeMode === 'true' ? 'live' : 'missing_or_unsupported',
        supabaseUrlPresent: Boolean(supabaseUrl),
        serviceRoleKeyPresent: Boolean(serviceRoleKey),
      });
      return json({ error: 'Secure clothing checkout is not configured for this payment mode.' }, 503);
    }

    const isLiveMode = expectedStripeMode !== 'false';
    if (isLiveMode && (!Deno.env.get('PRINTFUL_API_KEY')?.trim()
      || !Deno.env.get('RESEND_API_KEY')?.trim()
      || !Deno.env.get('ADMIN_ORDER_EMAIL')?.trim()
      || !Deno.env.get('FROM_EMAIL')?.trim())) {
      return json({ error: 'Secure clothing checkout is temporarily unavailable while payment, fulfilment, or order notifications are configured.' }, 503);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const supabase = supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const authHeader = req.headers.get('Authorization') ?? '';
    const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    let customerUserId: string | null = null;
    if (accessToken) {
      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !authData.user) return json({ error: 'Your sign-in session is no longer valid. Please sign in again.' }, 401);
      customerUserId = authData.user.id;
    }
    const customer = body.customer ?? {} as CustomerInfo;
    const requestedItems: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];

    const customerError = validateCustomerInfo(customer);
    if (customerError) return json({ error: customerError.error }, customerError.statusCode);

    const { quantities: requestedQuantities, error: itemsError } = validateRequestedItems(requestedItems);
    if (itemsError) return json({ error: itemsError.error }, itemsError.statusCode);

    const siteOrigin = SITE_ORIGIN;
    let checkoutOrigin: string;
    try {
      checkoutOrigin = new URL(body.origin).origin;
    } catch {
      return json({ error: 'A valid checkout origin is required.' }, 400);
    }
    const allowedCheckoutOrigins = new Set([siteOrigin]);
    if (IS_TEST_DEPLOYMENT) {
      for (const host of ['localhost', '127.0.0.1']) {
        for (const port of [5173, 5174, 5176, 5177]) allowedCheckoutOrigins.add(`http://${host}:${port}`);
      }
    }
    if (!allowedCheckoutOrigins.has(checkoutOrigin)) {
      return json({ error: 'Checkout is not available from this site origin.' }, 400);
    }
    const successUrl = `${checkoutOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${checkoutOrigin}/checkout/cancelled`;

    const variantIds = [...requestedQuantities.keys()];
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('id, size, color, stock, price_override, printful_sync_variant_id, printful_availability_status, product_id, products(id, name, slug, price, status, available_for_sale)')
      .in('id', variantIds);

    if (variantError || !variants?.length) {
      return json({ error: 'Those items are not available to buy yet.' }, 400);
    }

    const { result: lineItemResult, error: validationError } = buildLineItems(variants, requestedQuantities);
    if (validationError) return json({ error: validationError.error }, validationError.statusCode);

    const { lineItems, snapshot, subtotal } = lineItemResult;

    const shippingMethod = customer.shippingMethod === 'express' ? 'express' : 'standard';
    const shipping = shippingMethod === 'express' ? 850 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 450);
    if (shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: shipping,
          product_data: { name: shippingMethod === 'express' ? 'Express delivery' : 'Standard UK delivery' },
        },
      });
    }

    let discountAmount = 0;
    let discountCode: string | null = null;
    let checkoutCouponId: string | null = null;
    if (customer.discountCode) {
      const { data: discount, error: discountError } = await supabase
        .from('discounts')
        .select('*')
        .eq('code', String(customer.discountCode).trim().toUpperCase())
        .eq('active', true)
        .maybeSingle();
      if (discountError) return json({ error: 'Could not validate the discount code.' }, 500);
      if (!discount) return json({ error: 'This discount code is invalid or inactive.' }, 400);
      const now = Date.now();
      if (discount.starts_at && Date.parse(discount.starts_at) > now) {
        return json({ error: 'This discount code is not active yet.' }, 400);
      }
      if (discount.ends_at && Date.parse(discount.ends_at) < now) {
        return json({ error: 'This discount code has expired.' }, 400);
      }
      if (subtotal < discount.min_order_value) {
        return json({ error: 'Your order does not meet the minimum for this discount.' }, 400);
      }
      if (discount.usage_limit !== null && discount.used_count >= discount.usage_limit) {
        return json({ error: 'This discount code has reached its usage limit.' }, 400);
      }
      discountCode = discount.code;
      if (discount.type === 'percentage') {
        discountAmount = Math.round((subtotal * Math.min(100, Math.max(0, discount.value))) / 100);
      } else if (discount.type === 'fixed') {
        discountAmount = Math.min(Math.max(0, discount.value), subtotal);
      } else if (discount.type === 'free_shipping') {
        discountAmount = shipping;
      }
      discountAmount = Math.min(discountAmount, subtotal + shipping);
      if (discountAmount > 0) {
        const checkoutCoupon = await stripe.coupons.create({
          amount_off: discountAmount,
          currency: 'gbp',
          duration: 'once',
          name: `Store discount ${discountCode}`,
        });
        checkoutCouponId = checkoutCoupon.id;
      }
    }

    const total = Math.max(0, subtotal + shipping - discountAmount);
    const orderNumber = `AB16-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      order_number: orderNumber,
      email: customer.email,
      user_id: customerUserId,
      items: snapshot,
      shipping_address: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        address1: customer.address1,
        address2: customer.address2,
        city: customer.city,
        postcode: customer.postcode,
        country: customer.country,
        phone: customer.phone,
      },
      billing_address: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        address1: customer.address1,
        address2: customer.address2,
        city: customer.city,
        postcode: customer.postcode,
        country: customer.country,
      },
      shipping_method: shippingMethod,
      shipping_charge: shipping,
      discount_code: discountCode,
      discount_amount: discountAmount,
      subtotal,
      total,
      payment_status: 'pending',
      fulfilment_status: 'unfulfilled',
    }).select('id, order_number').single();

    if (orderError || !order) {
      return json({ error: 'Could not create the order record.' }, 500);
    }
    orderId = order.id;

    const { error: orderItemsError } = await supabase.from('order_items').insert(
      snapshot.map((item) => ({ ...item, order_id: order.id })),
    );
    if (orderItemsError) {
      const { error: cleanupError } = await supabase.from('orders').delete().eq('id', order.id);
      if (cleanupError) console.error('Could not clean up an order after its items failed to save:', cleanupError);
      console.error('Could not save order items:', orderItemsError);
      return json({ error: 'Could not prepare the order for fulfilment.' }, 500);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customer.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      ...(checkoutCouponId ? { discounts: [{ coupon: checkoutCouponId }] } : {}),
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
      },
      shipping_address_collection: { allowed_countries: ['GB', 'IE'] },
    });

    const { error: sessionLinkError } = await supabase
      .from('orders')
      .update({
        payment_intent_id: session.id,
        payment_status: 'pending',
      })
      .eq('id', order.id);

    if (sessionLinkError) {
      console.error('Could not link the Stripe checkout session to its order:', sessionLinkError);
      await stripe.checkout.sessions.expire(session.id);
      // Preserve audit history: mark order as failed so it doesn't linger in pending
      await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('payment_status', 'pending');
      return json({ error: 'Could not prepare the order for secure checkout.' }, 500);
    }

    return json({ url: session.url, orderNumber: order.order_number });
  } catch (error) {
    // If we have an order ID in scope, mark it as failed to avoid lingering pending orders.
    // This preserves audit history (we never delete orders) while ensuring no order
    // stays "pending" indefinitely after a Stripe API failure.
    if (orderId && supabaseClient) {
      try {
        const { error: cleanupError } = await supabaseClient
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', orderId)
          .eq('payment_status', 'pending');
        if (cleanupError) console.error('Could not mark failed checkout order:', cleanupError);
      } catch (cleanupError) {
        console.error('Could not mark failed checkout order:', cleanupError);
      }
    }

    console.error('create-checkout failed:', error instanceof Error ? error.name : 'Unknown error');
    return json({ error: 'Checkout could not be started safely. Please try again.' }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
