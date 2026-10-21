import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pf-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JsonRecord = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  const webhookSecret = Deno.env.get('PRINTFUL_WEBHOOK_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return json({ error: 'The Printful webhook is not configured.' }, 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-pf-webhook-signature');
  if (!signature || !(await verifyPrintfulSignature(rawBody, signature, webhookSecret))) {
    return json({ error: 'Invalid Printful webhook signature.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const payload = asRecord(JSON.parse(rawBody));
    const eventType = asString(payload.type);
    const eventData = asRecord(payload.data);
    const printfulOrder = asRecord(eventData.order ?? payload.order ?? eventData);
    const shipment = asRecord(eventData.shipment ?? payload.shipment ?? eventData);
    const externalOrderNumber = asString(printfulOrder.external_id ?? eventData.external_id);
    const printfulOrderId = asNumber(printfulOrder.id ?? eventData.order_id ?? payload.order_id);

    if (eventType === 'order_shipped' || eventType === 'package_shipped') {
      const orderId = await findStoreOrderId(supabase, externalOrderNumber, printfulOrderId);
      if (!orderId) return json({ error: 'No AB16 order matches this Printful shipment.' }, 404);

      const trackingNumber = asString(shipment.tracking_number);
      const trackingUrl = asString(shipment.tracking_url);
      const carrier = asString(shipment.carrier ?? shipment.carrier_title);
      const now = new Date().toISOString();

      const { error: storeOrderError } = await supabase
        .from('orders')
        .update({ fulfilment_status: 'shipped', tracking_reference: trackingNumber, updated_at: now })
        .eq('id', orderId);
      if (storeOrderError) throw new Error('Could not update the AB16 shipping status.');

      const { error: printfulOrderError } = await supabase
        .from('printful_orders')
        .update({
          status: 'shipped',
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          carrier,
          updated_at: now,
        })
        .eq('order_id', orderId);
      if (printfulOrderError) throw new Error('Could not save Printful shipment tracking.');

      const { error: auditError } = await supabase.from('audit_logs').insert({
        actor_id: null,
        action: 'order.shipped',
        entity: 'order',
        entity_id: orderId,
        details: JSON.stringify({ tracking_number: trackingNumber, tracking_url: trackingUrl, carrier }),
      });
      if (auditError) console.error('Could not write the Printful shipment audit log:', auditError);
    } else if (
      eventType === 'package_returned'
      || eventType === 'order_canceled'
      || eventType === 'order_failed'
      || eventType === 'order_return_processed'
    ) {
      const orderId = await findStoreOrderId(supabase, externalOrderNumber, printfulOrderId);
      if (!orderId) return json({ error: 'No AB16 order matches this Printful update.' }, 404);

      const status = eventType === 'package_returned' || eventType === 'order_return_processed'
        ? 'returned'
        : eventType === 'order_failed'
          ? 'failed'
          : 'cancelled';
      const { error: storeOrderError } = await supabase
        .from('orders')
        .update({ fulfilment_status: status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (storeOrderError) throw new Error('Could not update the AB16 fulfilment status.');

      const { error: printfulOrderError } = await supabase
        .from('printful_orders')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);
      if (printfulOrderError) throw new Error('Could not update Printful order status.');
    }

    return json({ received: true });
  } catch (error) {
    console.error('Printful webhook processing failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Printful webhook failed.' }, 500);
  }
});

async function findStoreOrderId(
  supabase: ReturnType<typeof createClient>,
  externalOrderNumber: string | null,
  printfulOrderId: number | null,
) {
  if (externalOrderNumber) {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', externalOrderNumber)
      .maybeSingle();
    if (error) throw new Error('Could not look up the external AB16 order number.');
    if (data) return data.id as string;
  }

  if (!printfulOrderId) return null;
  const { data, error } = await supabase
    .from('printful_orders')
    .select('order_id')
    .eq('printful_order_id', printfulOrderId)
    .maybeSingle();
  if (error) throw new Error('Could not look up the Printful order ID.');
  return (data?.order_id as string | undefined) ?? null;
}

async function verifyPrintfulSignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const base64 = btoa(String.fromCharCode(...digest));
  const normalized = signature.trim().replace(/^(sha256=|v1=)/i, '');
  return constantTimeEqual(normalized.toLowerCase(), hex) || constantTimeEqual(normalized, base64);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function json(payload: JsonRecord, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
