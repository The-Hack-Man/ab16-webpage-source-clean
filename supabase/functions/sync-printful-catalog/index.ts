import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { syncPrintfulCatalog } from '../_shared/printful-catalog-sync.ts';

const SITE_ORIGIN = new URL(Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ab16clothing.co.uk').origin;
const WEBHOOK_EVENT_TYPES = ['package_shipped', 'package_returned', 'order_failed', 'order_canceled', 'product_updated', 'stock_updated'];

Deno.serve(async (request) => {
  const origin = allowedOrigin(request.headers.get('origin'));
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, corsHeaders);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const printfulToken = Deno.env.get('PRINTFUL_API_KEY2') ?? Deno.env.get('PRINTFUL_API_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey || !printfulToken) {
    return json({ error: 'Supabase or Printful server configuration is incomplete.' }, 503, corsHeaders);
  }

  const bearer = request.headers.get('authorization') ?? '';
  if (!bearer.startsWith('Bearer ')) return json({ error: 'Administrator sign-in is required.' }, 401, corsHeaders);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401, corsHeaders);
  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  if (role !== 'admin' && role !== 'super_admin') return json({ error: 'Administrator access is required.' }, 403, corsHeaders);

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const summary = await syncPrintfulCatalog(db, printfulToken);
    const webhook = await ensureProductUpdatedWebhook(supabaseUrl, printfulToken, db);
    return json({ success: true, ...summary, webhook }, 200, corsHeaders);
  } catch (error) {
    console.error('Printful catalog sync failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Printful catalog synchronization failed.' }, 502, corsHeaders);
  }
});

async function ensureProductUpdatedWebhook(supabaseUrl: string, token: string, db: ReturnType<typeof createClient>) {
  const signingSecret = Deno.env.get('PRINTFUL_WEBHOOK_SIGNING_SECRET');
  const legacySecret = Deno.env.get('PRINTFUL_WEBHOOK_SECRET');
  if (!signingSecret && !legacySecret) {
    return { configured: false, reason: 'Add PRINTFUL_WEBHOOK_SIGNING_SECRET to Supabase Edge Function secrets to enable automatic product updates.' };
  }

  const endpoint = new URL(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/printful-webhook`);
  if (!signingSecret && legacySecret) endpoint.searchParams.set('token', legacySecret);

  const response = await fetch('https://api.printful.com/webhooks', {
    headers: { Authorization: `Bearer ${token}` },
  });
  let current: Record<string, unknown> = {};
  if (response.ok) {
    const body = await response.json() as { result?: Record<string, unknown> };
    current = body.result ?? {};
  } else if (response.status !== 404) {
    return { configured: false, reason: response.status === 401 || response.status === 403
      ? 'Catalog synced. The Printful API token needs Webhooks read/write access to enable automatic product updates.'
      : `Catalog synced, but Printful webhook settings could not be read (HTTP ${response.status}).` };
  }

  const currentUrl = typeof current.url === 'string' ? current.url : '';
  const currentBase = withoutQuery(currentUrl);
  const targetBase = withoutQuery(endpoint.toString());
  if (currentBase && currentBase !== targetBase) {
    return { configured: false, reason: 'Catalog synced. An existing Printful webhook points to another URL, so it was preserved.' };
  }

  const existingTypes = Array.isArray(current.types)
    ? current.types.filter((event): event is string => typeof event === 'string')
    : [];
  const types = [...new Set([...existingTypes, ...WEBHOOK_EVENT_TYPES])];
  const existingParams = current.params && typeof current.params === 'object'
    ? current.params as Record<string, unknown>
    : {};
  const { data: products, error: productsError } = await db.from('products')
    .select('printful_product_id').not('printful_product_id', 'is', null);
  if (productsError) return { configured: false, reason: 'Catalog synced, but Printful stock updates could not be linked to the store catalogue.' };
  const stockProductIds = (products ?? []).map((product) => Number(product.printful_product_id)).filter(Number.isSafeInteger);
  const params = {
    ...existingParams,
    stock_updated: { product_ids: stockProductIds },
  };
  const update = await fetch('https://api.printful.com/webhooks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: currentUrl || endpoint.toString(), types, ...(params ? { params } : {}) }),
  });
  if (!update.ok) {
    return { configured: false, reason: update.status === 401 || update.status === 403
      ? 'Catalog synced. The Printful API token needs Webhooks read/write access to enable automatic product updates.'
      : `Catalog synced, but Printful did not accept webhook settings (HTTP ${update.status}).` };
  }
  return { configured: true, events: ['product_updated', 'stock_updated'] };
}

function withoutQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function allowedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return SITE_ORIGIN;
  try {
    const parsed = new URL(requestOrigin);
    const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    return parsed.origin === SITE_ORIGIN || isLocal ? parsed.origin : SITE_ORIGIN;
  } catch {
    return SITE_ORIGIN;
  }
}

function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
