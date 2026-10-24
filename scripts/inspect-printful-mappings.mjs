#!/usr/bin/env node
/**
 * Read-only AB16 ↔ Printful reconciliation.
 * Uses credentials from process.env or .env. Never prints secrets.
 * GET-only: never writes mappings or submits orders.
 */
import fs from 'node:fs';
import path from 'node:path';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadLocalEnv();

const printfulKey = process.env.PRINTFUL_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!printfulKey || !supabaseUrl || !supabaseKey) {
  console.error('Missing PRINTFUL_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).');
  process.exit(2);
}

async function getJson(url, headers, label) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(label + ' failed with HTTP ' + response.status);
  return response.json();
}
const printfulHeaders = { Authorization: 'Bearer ' + printfulKey, Accept: 'application/json' };
const supabaseHeaders = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, Accept: 'application/json' };
const databaseUrl = new URL('/rest/v1/product_variants', supabaseUrl);
databaseUrl.searchParams.set('select', 'id,sku,size,color,printful_variant_id,printful_sync_variant_id,products(name,slug)');
databaseUrl.searchParams.set('order', 'sku.asc');

const dbVariants = await getJson(databaseUrl, supabaseHeaders, 'Supabase variant read');
const list = await getJson('https://api.printful.com/store/products?limit=100&offset=0', printfulHeaders, 'Printful store product list');
const listResult = list?.result ?? {};
const products = Array.isArray(listResult.sync_products) ? listResult.sync_products
  : Array.isArray(listResult) ? listResult
  : Array.isArray(listResult.products) ? listResult.products : [];

const details = [];
for (const listed of products) {
  const productId = listed.id ?? listed.sync_product?.id;
  if (!productId) continue;
  const detail = await getJson('https://api.printful.com/store/products/' + encodeURIComponent(productId), printfulHeaders, 'Printful product detail ' + productId);
  const result = detail?.result ?? {};
  const product = result.sync_product ?? result.product ?? listed.sync_product ?? listed;
  const variants = result.sync_variants ?? result.variants ?? listed.sync_variants ?? [];
  for (const variant of variants) details.push({
    printful_product_id: product.id ?? productId,
    printful_product_name: product.name ?? listed.name ?? null,
    sync_variant_id: variant.id ?? null,
    catalog_variant_id: variant.variant_id ?? variant.product?.variant_id ?? null,
    sku: variant.sku ?? null,
    variant_name: variant.name ?? variant.product?.name ?? null,
    retail_price: variant.retail_price ?? null,
    currency: variant.currency ?? null,
    size: variant.size ?? null,
    color: variant.color ?? null,
    image: variant.files?.find?.((file) => file.type === 'preview')?.preview_url ?? variant.product?.image ?? null,
  });
}

const normal = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const hasToken = (haystack, needle) => {
  const value = String(haystack ?? '');
  const token = String(needle ?? '').trim();
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escaped + '($|[^a-z0-9])', 'i').test(value);
};

const reconciliation = dbVariants.map((db) => {
  const product = Array.isArray(db.products) ? db.products[0] : db.products;
  const skuMatches = db.sku ? details.filter((remote) => normal(remote.sku) === normal(db.sku)) : [];
  const exactVariantMatches = skuMatches.filter((remote) => {
    const name = remote.variant_name ?? '';
    const sizeMatches = normal(remote.size) === normal(db.size) || hasToken(name, db.size);
    const colorMatches = normal(remote.color) === normal(db.color) || hasToken(name, db.color);
    return sizeMatches && colorMatches && Boolean(db.size) && Boolean(db.color);
  });
  return {
    db_product: product?.name ?? null,
    db_slug: product?.slug ?? null,
    db_variant_id: db.id,
    db_sku: db.sku,
    db_size: db.size,
    db_color: db.color,
    current_printful_variant_id: db.printful_variant_id,
    current_printful_sync_variant_id: db.printful_sync_variant_id,
    exact_sku_match_count: skuMatches.length,
    sku_and_size_color_match_count: exactVariantMatches.length,
    candidates: skuMatches.map((remote) => ({
      printful_product_id: remote.printful_product_id,
      printful_product_name: remote.printful_product_name,
      sync_variant_id: remote.sync_variant_id,
      catalog_variant_id: remote.catalog_variant_id,
      sku: remote.sku,
      variant_name: remote.variant_name,
      size: remote.size,
      color: remote.color,
      retail_price: remote.retail_price,
      image: remote.image,
      exact_sku_and_size_color: exactVariantMatches.some((match) => match.sync_variant_id === remote.sync_variant_id),
    })),
    status: exactVariantMatches.length === 1 ? 'candidate_requires_artwork_and_store_verification'
      : skuMatches.length ? 'ambiguous_or_inconsistent_sku_match' : 'no_exact_sku_match',
  };
});

console.log(JSON.stringify({
  read_only: true,
  database_variant_count: dbVariants.length,
  printful_store_product_count: products.length,
  printful_sync_variant_count: details.length,
  mapping_writes_performed: 0,
  orders_submitted: 0,
  reconciliation,
}, null, 2));
