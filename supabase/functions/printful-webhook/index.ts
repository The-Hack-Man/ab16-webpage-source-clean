import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pf-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JsonRecord = Record<string, unknown>;

async function verifyPrintfulWebhook(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get('x-pf-webhook-signature');
  const signingSecretHex = Deno.env.get('PRINTFUL_WEBHOOK_SIGNING_SECRET') ?? '';
  if (signature && signingSecretHex) {
    if (!/^[0-9a-fA-F]+$/.test(signingSecretHex) || signingSecretHex.length % 2 !== 0) return false;
    const keyBytes = new Uint8Array(signingSecretHex.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
    const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
    return diff === 0;
  }

  // Legacy Printful webhook API does not sign requests. Use a high-entropy
  // URL token until the store is migrated to signed Webhook v2.
  const configuredToken = Deno.env.get('PRINTFUL_WEBHOOK_SECRET') ?? '';
  const suppliedToken = new URL(req.url).searchParams.get('token') ?? '';
  if (!configuredToken || !suppliedToken || configuredToken.length < 32) return false;
  if (configuredToken.length !== suppliedToken.length) return false;
  let diff = 0;
  for (let i = 0; i < configuredToken.length; i++) diff |= configuredToken.charCodeAt(i) ^ suppliedToken.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await req.text();
  const signingSecret = Deno.env.get('PRINTFUL_WEBHOOK_SIGNING_SECRET') ?? '';
  const legacySecret = Deno.env.get('PRINTFUL_WEBHOOK_SECRET') ?? '';
  if (!signingSecret && !legacySecret) {
    return json({ error: 'Printful webhook authentication is not configured' }, 503);
  }
  if (!(await verifyPrintfulWebhook(req, rawBody))) {
    return json({ error: 'Invalid Printful webhook authentication' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase is not configured' }, 500);

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

      const { error: storeOrderError } = await supabase.from('orders')
        .update({ fulfilment_status: 'shipped', tracking_reference: trackingNumber, updated_at: now }).eq('id', orderId);
      if (storeOrderError) throw new Error('Could not update the AB16 shipping status.');
      const { error: printfulOrderError } = await supabase.from('printful_orders')
        .update({ status: 'shipped', tracking_number: trackingNumber, tracking_url: trackingUrl, carrier, updated_at: now })
        .eq('order_id', orderId);
      if (printfulOrderError) throw new Error('Could not save Printful shipment tracking.');
      const { error: auditError } = await supabase.from('audit_logs').insert({
        actor_id: null, action: 'order.shipped', entity: 'order', entity_id: orderId,
        details: JSON.stringify({ tracking_number: trackingNumber, tracking_url: trackingUrl, carrier }),
      });
      if (auditError) console.error('Could not write the Printful shipment audit log:', auditError);
    } else if (eventType === 'package_returned' || eventType === 'order_canceled'
      || eventType === 'order_failed' || eventType === 'order_return_processed') {
      const orderId = await findStoreOrderId(supabase, externalOrderNumber, printfulOrderId);
      if (!orderId) return json({ error: 'No AB16 order matches this Printful update.' }, 404);
      const status = eventType === 'package_returned' || eventType === 'order_return_processed'
        ? 'returned' : eventType === 'order_failed' ? 'failed' : 'cancelled';
      const { error: storeOrderError } = await supabase.from('orders')
        .update({ fulfilment_status: status, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (storeOrderError) throw new Error('Could not update the AB16 fulfilment status.');
      const { error: printfulOrderError } = await supabase.from('printful_orders')
        .update({ status, updated_at: new Date().toISOString() }).eq('order_id', orderId);
      if (printfulOrderError) throw new Error('Could not update Printful order status.');
    }
    return json({ received: true });
  } catch (error) {
    console.error('Printful webhook processing failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Printful webhook failed' }, 500);
  }
});

async function findStoreOrderId(
  supabase: ReturnType<typeof createClient>,
  externalOrderNumber: string | null,
  printfulOrderId: number | null,
): Promise<string | null> {
  if (externalOrderNumber) {
    const { data, error } = await supabase.from('orders').select('id').eq('order_number', externalOrderNumber).maybeSingle();
    if (error) throw new Error('Could not look up the external AB16 order number.');
    if (data) return data.id as string;
  }
  if (!printfulOrderId) return null;
  const { data, error } = await supabase.from('printful_orders').select('order_id')
    .eq('printful_order_id', printfulOrderId).maybeSingle();
  if (error) throw new Error('Could not look up the Printful order ID.');
  return (data?.order_id as string | undefined) ?? null;
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function json(payload: JsonRecord, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
