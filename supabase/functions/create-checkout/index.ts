import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { resolveSiteOrigin } from '../_shared/site_origin.ts';
import {
  validateCustomerInfo,
  validateRequestedItems,
  buildLineItems,
  type CustomerInfo,
  type CheckoutItem,
} from './checkout_validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
    const printfulApiKey = Deno.env.get('PRINTFUL_API_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const adminOrderEmail = Deno.env.get('ADMIN_ORDER_EMAIL');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    if (!stripeKey || !supabaseUrl || !serviceRoleKey || !printfulApiKey || !resendApiKey || !adminOrderEmail || !fromEmail) {
      return json({ error: 'Secure clothing checkout is temporarily unavailable while payment, fulfilment, or order notifications are configured.' }, 503);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const customer = body.customer ?? {} as CustomerInfo;
    const requestedItems: CheckoutItem[] = Array.isArray(body.items) ? body.items : [];

    const customerError = validateCustomerInfo(customer);
    if (customerError) return json({ error: customerError.error }, customerError.statusCode);

    const { quantities: requestedQuantities, error: itemsError } = validateRequestedItems(requestedItems);
    if (itemsError) return json({ error: itemsError.error }, itemsError.statusCode);

    const siteOrigin = resolveSiteOrigin({
      PUBLIC_SITE_URL: Deno.env.get('PUBLIC_SITE_URL'),
      SITE_URL: Deno.env.get('SITE_URL'),
    });
    let checkoutOrigin: string;
    try {
      checkoutOrigin = new URL(body.origin).origin;
    } catch {
      return json({ error: 'A valid checkout origin is required.' }, 400);
    }
    if (!new Set([siteOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']).has(checkoutOrigin)) {
      return json({ error: 'Checkout is not available from this site origin.' }, 400);
    }
    const successUrl = `${checkoutOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${checkoutOrigin}/checkout/cancelled`;

    const variantIds = [...requestedQuantities.keys()];
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('id, size, color, stock, price_override, printful_sync_variant_id, product_id, products(id, name, slug, price, status, available_for_sale)')
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
    const message = error instanceof Error ? error.message : 'Stripe checkout failed.';

    // If we have an order ID in scope, mark it as failed to avoid lingering pending orders.
    // This preserves audit history (we never delete orders) while ensuring no order
    // stays "pending" indefinitely after a Stripe API failure.
    if (order?.id) {
      await supabase
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id)
        .eq('payment_status', 'pending');
    }

    return json({ error: message }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
