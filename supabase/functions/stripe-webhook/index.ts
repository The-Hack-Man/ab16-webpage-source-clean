import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  checkClothingOrderIdempotency,
  checkExpiredPaymentIdempotency,
  checkExpiredPaymentRecordIdempotency,
  checkMasteringCreditIdempotency,
  describeClaimOutcome,
  isPrintfulConfirmedButUnreconciled,
  type OrderRecord,
  type PaymentRecord,
} from './idempotency.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type StoreOrder = {
  id: string;
  order_number: string;
  email: string;
  total: number;
  payment_status: string;
  fulfilment_status: string | null;
  shipping_address: Record<string, string | null> | null;
  owner_order_notified_at: string | null;
};

type StoreOrderItem = {
  variant_id: string | null;
  product_name: string;
  variant_size: string | null;
  variant_color: string | null;
  quantity: number;
  price: number;
};

type PrintfulOrderResult = {
  id?: number;
  external_id?: string;
  status?: string;
};

type PrintfulApiResponse = {
  result?: PrintfulOrderResult;
  error?: { message?: string };
};

const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

function getCollectedShippingAddress(
  session: Stripe.Checkout.Session,
  fallback: StoreOrder['shipping_address'],
): StoreOrder['shipping_address'] | null {
  const details = session.shipping_details;
  const address = details?.address;
  if (!details || !address) return null;

  if (address.country !== 'GB' && address.country !== 'IE') {
    throw new Error('Stripe returned a shipping destination outside the supported countries.');
  }

  const fallbackName = [fallback?.firstName, fallback?.lastName].filter(Boolean).join(' ');
  const nameParts = (details.name?.trim() || fallbackName).split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts.shift() ?? '',
    lastName: nameParts.join(' '),
    address1: address.line1 ?? fallback?.address1 ?? null,
    address2: address.line2 ?? fallback?.address2 ?? null,
    city: address.city ?? fallback?.city ?? null,
    postcode: address.postal_code ?? fallback?.postcode ?? null,
    country: address.country === 'IE' ? 'Ireland' : 'United Kingdom',
    phone: details.phone ?? fallback?.phone ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'The Stripe webhook is not configured.' }, 503);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature.' }, 400);

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return json({ error: 'Invalid Stripe signature.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Event-level idempotency: atomically claim the Stripe event ID ────────
  // claim_stripe_event_v2 returns 'claimed', 'completed', or 'locked'.
  // - 'completed': a previous worker already finished — acknowledge (200).
  // - 'locked': another worker holds the 5-minute claim — return 500 so Stripe
  //   retries; the lock auto-expires if that worker crashes.
  // - 'claimed': this worker owns the event — proceed with processing.
  const { data: claimOutcome, error: claimError } = await supabase.rpc('claim_stripe_event_v2', {
    p_event_id: event.id,
  }) as { data: 'claimed' | 'completed' | 'locked' | null; error: { message?: string } | null };

  if (claimError) {
    console.error('Could not claim Stripe event for deduplication:', claimError);
    return json({ error: 'Internal error during event claiming.' }, 500);
  }

  if (claimOutcome === 'completed') {
    return json({ received: true, skipped: true, reason: describeClaimOutcome('completed') });
  }

  if (claimOutcome === 'locked') {
    console.warn(`Stripe event ${event.id} is locked by another worker; Stripe will retry.`);
    return json({ received: true, skipped: true, reason: describeClaimOutcome('locked') }, 500);
  }

  // claimOutcome === 'claimed' — proceed with processing

  try {
    await processStripeEvent(supabase, stripe, event);

     // Mark the event as completed only after all business logic succeeded
    const { error: markCompletedError } = await supabase.rpc('mark_stripe_event_completed', {
      p_event_id: event.id,
    });
    if (markCompletedError) {
      console.error('Could not mark Stripe event as completed:', markCompletedError);
      // The event remains 'processing' with a 5-minute claim lock.
      // Attempt to mark it as failed so Stripe can redeliver and another
      // worker can pick it up after the lock expires.
      const { error: markFailedError } = await supabase.rpc('mark_stripe_event_failed', {
        p_event_id: event.id,
        p_error: `mark_stripe_event_completed failed: ${markCompletedError.message?.slice(0, 500)}`,
      });
      if (markFailedError) {
        console.error('Could not mark Stripe event as failed after completion failure:', markFailedError);
      }
      return json({ error: 'Processing succeeded but event state could not be persisted.', retry: true }, 500);
    }

    return json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Stripe webhook processing failed.';
    console.error('Stripe webhook processing failed:', error);

    // Mark the event as failed so it can be retried
    const { error: markFailedError } = await supabase.rpc('mark_stripe_event_failed', {
      p_event_id: event.id,
      p_error: errorMessage.slice(0, 1000),
    });
    if (markFailedError) {
      console.error('Could not mark Stripe event as failed:', markFailedError);
    }

    return json({ error: errorMessage }, 500);
  }
});

async function processStripeEvent(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  event: Stripe.Event,
) {
  // This deployed endpoint is for live payments. Test-mode events must never
  // grant credits, mutate production orders, send owner emails, or contact Printful.
  if (!event.livemode) {
    console.warn(`Ignoring test-mode Stripe event ${event.id} (${event.type}) on the live webhook.`);
    return;
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      return;
    }

    // ── Mastering credit grant (idempotent via payment_records.status check) ──
    if (session.metadata?.user_id && session.metadata.credits) {
      const credits = Number.parseInt(session.metadata.credits, 10);
      if (!Number.isSafeInteger(credits) || credits <= 0) {
        throw new Error('Invalid mastering-credit metadata.');
      }

      // Fetch the payment record to check idempotency
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payment_records')
        .select('id, stripe_session_id, status')
        .eq('stripe_session_id', session.id)
        .maybeSingle();

      if (paymentError) {
        throw new Error('Could not load the payment record for mastering credits.');
      }

      const creditCheck = checkMasteringCreditIdempotency(
        paymentRecord as PaymentRecord | null,
      );
      if (!creditCheck.shouldProcess) {
        return;
      }

      const { error } = await supabase.rpc('grant_mastering_credits', {
        p_stripe_session_id: session.id,
        p_user_id: session.metadata.user_id,
        p_credits: credits,
        p_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
      });
      if (error) {
        throw new Error(`Could not grant mastering credits: ${error.message}`);
      }
    }

    // ── Clothing order processing (idempotent via order.payment_status check) ──
    const orderId = session.metadata?.order_id;
    if (orderId) {
      await processClothingOrder(supabase, session, orderId);
    }
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, payment_status')
        .eq('id', orderId)
        .maybeSingle();
      if (orderError) throw new Error('Could not load the expired clothing order.');

      const expiredCheck = checkExpiredPaymentIdempotency(
        order as OrderRecord | null,
      );
      if (expiredCheck.shouldProcess) {
        const { error } = await supabase
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', orderId)
          .eq('payment_status', 'pending');
        if (error) throw new Error('Could not mark the expired clothing order failed.');
      }
    }

    if (session.metadata?.user_id && session.metadata.credits) {
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payment_records')
        .select('id, status')
        .eq('stripe_session_id', session.id)
        .maybeSingle();
      if (paymentError) throw new Error('Could not load the failed mastering payment record.');

      const expiredRecordCheck = checkExpiredPaymentRecordIdempotency(
        paymentRecord as PaymentRecord | null,
      );
      if (expiredRecordCheck.shouldProcess) {
        const { error } = await supabase
          .from('payment_records')
          .update({ status: 'failed' })
          .eq('stripe_session_id', session.id)
          .eq('status', 'pending');
        if (error) throw new Error('Could not mark the failed mastering payment.');
      }
    }
  }
}

async function processClothingOrder(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  orderId: string,
) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, email, total, payment_status, fulfilment_status, shipping_address, owner_order_notified_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) throw new Error(`Clothing order ${orderId} could not be loaded.`);
  const storeOrder = order as StoreOrder;

  // ── Idempotency: use the extracted checker ──────────────────────────────
  const clothingCheck = checkClothingOrderIdempotency(storeOrder, session);
  if (!clothingCheck.shouldProcess) {
    return;
  }

  if (session.amount_total !== storeOrder.total) {
    throw new Error(`Paid amount does not match clothing order ${storeOrder.order_number}.`);
  }

  const collectedShippingAddress = getCollectedShippingAddress(session, storeOrder.shipping_address);
  if (collectedShippingAddress) {
    const { error } = await supabase
      .from('orders')
      .update({ shipping_address: collectedShippingAddress })
      .eq('id', orderId);
    if (error) throw new Error('Could not save the shipping address confirmed at Stripe.');
    storeOrder.shipping_address = collectedShippingAddress;
  }

  if (storeOrder.payment_status !== 'paid') {
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_intent_id: session.payment_intent ? String(session.payment_intent) : session.id,
      })
      .eq('id', orderId)
      .eq('payment_status', 'pending')
      .select('payment_status')
      .maybeSingle();
    if (updateError) {
      console.error('Could not mark order as paid:', updateError);
      const { data: recheck, error: recheckError } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .maybeSingle();
      if (recheckError || recheck?.payment_status !== 'paid') {
        throw new Error('Could not mark the paid clothing order as paid.');
      }
    }
    if (!updatedOrder) {
      // No row was updated — another worker may have already marked it paid
      const { data: recheck, error: recheckError } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .maybeSingle();
      if (recheckError || recheck?.payment_status !== 'paid') {
        throw new Error('Could not mark the paid clothing order as paid.');
      }
      storeOrder.payment_status = 'paid';
    }
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('variant_id, product_name, variant_size, variant_color, quantity, price')
    .eq('order_id', orderId);
  if (itemsError || !items?.length) {
    await notifyOwner(supabase, storeOrder, [], 'Clothing order has no saved line items.');
    throw new Error(`Clothing order ${storeOrder.order_number} has no saved line items.`);
  }
  const orderItems = items as StoreOrderItem[];

  const missingVariantItems = orderItems.filter((item) => !item.variant_id);
  if (missingVariantItems.length > 0) {
    await notifyOwner(supabase, storeOrder, orderItems, 'Printful needs manual review: a purchased item has no product variant mapping.');
    throw new Error(`Clothing order ${storeOrder.order_number} contains an item without a variant.`);
  }

  const variantIds = [...new Set(orderItems.map((item) => item.variant_id).filter((id): id is string => Boolean(id)))];

  const { data: variants, error: variantError } = await supabase
    .from('product_variants')
    .select('id, printful_sync_variant_id')
    .in('id', variantIds);
  if (variantError || !variants || variants.length !== variantIds.length) {
    await notifyOwner(supabase, storeOrder, orderItems, 'Printful needs manual review: one or more product variants could not be matched.');
    throw new Error(`Printful variant lookup failed for clothing order ${storeOrder.order_number}.`);
  }

  const syncVariantById = new Map(variants.map((variant) => [variant.id, variant.printful_sync_variant_id]));
  if (orderItems.some((item) => !item.variant_id || !syncVariantById.get(item.variant_id))) {
    await notifyOwner(supabase, storeOrder, orderItems, 'Printful needs manual review: a product/size/colour has no linked Printful sync variant ID.');
    throw new Error(`Printful sync variants are not fully configured for clothing order ${storeOrder.order_number}.`);
  }

  const fulfillment = await submitPrintfulOrder(supabase, storeOrder, orderItems, syncVariantById);
  await notifyOwner(supabase, storeOrder, orderItems, fulfillment);
}

async function notifyOwner(
  supabase: ReturnType<typeof createClient>,
  order: StoreOrder,
  items: StoreOrderItem[],
  fulfillmentStatus: string,
) {
  if (order.owner_order_notified_at) return;

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ADMIN_ORDER_EMAIL');
  const from = Deno.env.get('FROM_EMAIL');
  if (!apiKey || !to || !from) {
    throw new Error('Clothing-order email notification is not configured.');
  }

  const lines = items.map((item) =>
    `${item.product_name} — ${item.variant_color ?? 'Colour not set'} / ${item.variant_size ?? 'One size'} × ${item.quantity} (${money(item.price * item.quantity)})`
  );
  const html = [
    `<h1>Paid AB16 clothing order ${escapeHtml(order.order_number)}</h1>`,
    `<p>Stripe payment received from ${escapeHtml(order.email)}.</p>`,
    `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
    `<p>${escapeHtml(fulfillmentStatus)}</p>`,
  ].join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `ab16-clothing-paid-${order.id}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `AB16 clothing payment received — ${order.order_number}`,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the paid-clothing-order notification: ${response.status}`);
  }

  const { error } = await supabase
    .from('orders')
    .update({ owner_order_notified_at: new Date().toISOString() })
    .eq('id', order.id)
    .is('owner_order_notified_at', null);
  if (error) throw new Error('The clothing-order email was sent but its notification status could not be saved.');
}

async function submitPrintfulOrder(
  supabase: ReturnType<typeof createClient>,
  order: StoreOrder,
  items: StoreOrderItem[],
  syncVariantById: Map<string, number | null>,
) {
  const apiKey = Deno.env.get('PRINTFUL_API_KEY');
  if (!apiKey) {
    await notifyOwner(supabase, order, items, 'Printful is not connected; this paid order requires manual fulfilment.');
    throw new Error('Printful is not configured.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('printful_orders')
    .select('id, printful_order_id, status, confirmed_at')
    .eq('order_id', order.id)
    .maybeSingle();
  if (existingError) throw new Error('Could not load Printful order state.');
  if (existing?.confirmed_at) {
    // Reconcile: if Printful already confirmed but store order isn't marked fulfilled, do so now.
    if (isPrintfulConfirmedButUnreconciled(existing, order)) {
      const { error: reconcileError } = await supabase
        .from('orders')
        .update({ fulfilment_status: 'fulfilled' })
        .eq('id', order.id);
      if (reconcileError) {
        throw new Error(
          'Printful already confirmed the order, but the store fulfilment_status could not be reconciled.',
        );
      }
      order.fulfilment_status = 'fulfilled';
    }
    return 'Printful accepted the clothing order for fulfilment.';
  }

  let fulfillmentRowId = existing?.id as string | undefined;
  if (existing) {
    if (existing.status === 'processing') throw new Error(`Printful order ${order.order_number} is already being submitted.`);
    const { data: claimed, error: claimError } = await supabase
      .from('printful_orders')
      .update({ status: 'processing', last_error: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();
    if (claimError) throw new Error('Could not retry the Printful order.');
    if (!claimed) throw new Error(`Printful order ${order.order_number} is already being submitted.`);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('printful_orders')
      .insert({ order_id: order.id, status: 'processing' })
      .select('id')
      .single();
    if (insertError || !inserted) {
      throw new Error('Could not reserve this order for Printful submission.');
    }
    fulfillmentRowId = inserted.id;
  }

  if (!fulfillmentRowId) throw new Error('Printful order reservation is missing.');

  try {
    let printfulOrderId = existing?.printful_order_id as number | null;
    if (!printfulOrderId) {
      const lookup = await fetch(`https://api.printful.com/orders/@${encodeURIComponent(order.order_number)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (lookup.ok) {
        const found = (await lookup.json()) as PrintfulApiResponse;
        printfulOrderId = found.result?.id ?? null;
      } else if (lookup.status !== 404) {
        throw new Error(`Could not check Printful for an existing order (${lookup.status}).`);
      }
    }

    if (!printfulOrderId) {
      const shippingAddress = order.shipping_address ?? {};
      const countryCode = shippingAddress.country === 'Ireland' || shippingAddress.country === 'IE'
        ? 'IE'
        : shippingAddress.country === 'United Kingdom' || shippingAddress.country === 'GB'
          ? 'GB'
          : null;
      if (!countryCode) throw new Error('The clothing order is missing a supported shipping country.');
      const response = await fetch('https://api.printful.com/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: order.order_number,
          recipient: {
            name: `${shippingAddress.firstName ?? ''} ${shippingAddress.lastName ?? ''}`.trim(),
            email: order.email,
            address1: shippingAddress.address1,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            country_code: countryCode,
            zip: shippingAddress.postcode,
            phone: shippingAddress.phone,
          },
          items: items.map((item) => ({
            sync_variant_id: syncVariantById.get(item.variant_id!)!,
            quantity: item.quantity,
            retail_price: (item.price / 100).toFixed(2),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Printful order creation failed (${response.status}).`);
      }
      const created = (await response.json()) as PrintfulApiResponse;
      printfulOrderId = created.result?.id ?? null;
      if (!printfulOrderId) throw new Error('Printful returned no order ID.');
    }

    const { error: savedOrderError } = await supabase
      .from('printful_orders')
      .update({ printful_order_id: printfulOrderId, status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', fulfillmentRowId);
    if (savedOrderError) throw new Error('Printful created the order, but its reference could not be saved.');

    const { data: existingItems, error: existingItemsError } = await supabase
      .from('printful_order_items')
      .select('id')
      .eq('printful_order_id', fulfillmentRowId)
      .limit(1);
    if (existingItemsError) throw new Error('Could not check Printful order item records.');
    if (!existingItems?.length) {
      const { error: snapshotError } = await supabase.from('printful_order_items').insert(items.map((item) => ({
        printful_order_id: fulfillmentRowId,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_size: item.variant_size,
        variant_color: item.variant_color,
        quantity: item.quantity,
        price: item.price,
        printful_variant_id: syncVariantById.get(item.variant_id!),
      })));
      if (snapshotError) throw new Error('Could not save the Printful item snapshot.');
    }

    const confirmResponse = await fetch(`https://api.printful.com/orders/${printfulOrderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!confirmResponse.ok) {
      throw new Error(`Printful order could not be confirmed (${confirmResponse.status}).`);
    }

    const confirmedAt = new Date().toISOString();
    const { error: confirmedError } = await supabase
      .from('printful_orders')
      .update({ status: 'processing', confirmed_at: confirmedAt, last_error: null, updated_at: confirmedAt })
      .eq('id', fulfillmentRowId);
    if (confirmedError) throw new Error('Printful accepted the order, but confirmation status could not be saved.');

    const { error: fulfillmentError } = await supabase
      .from('orders')
      .update({ fulfilment_status: 'fulfilled' })
      .eq('id', order.id);
    if (fulfillmentError) throw new Error('Printful accepted the order, but the store fulfilment status could not be saved.');

    return 'Printful accepted the clothing order for fulfilment.';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Printful order submission failed.';
    await supabase
      .from('printful_orders')
      .update({ status: 'failed', last_error: message.slice(0, 1000), updated_at: new Date().toISOString() })
      .eq('id', fulfillmentRowId);
    await notifyOwner(supabase, order, items, `Printful submission failed and needs attention: ${message}`);
    throw error;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
