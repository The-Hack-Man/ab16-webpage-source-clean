import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

type JsonRecord = Record<string, unknown>;

interface PrintfulProductSummary {
  id: number;
  name: string;
  variants?: number;
  synced?: number;
  thumbnail_url?: string | null;
  is_ignored?: boolean;
}

interface PrintfulSyncVariant extends JsonRecord {
  id?: number;
  variant_id?: number;
  name?: string;
  retail_price?: string | number;
  sku?: string;
  currency?: string;
  availability_status?: string;
  is_ignored?: boolean;
}

interface CatalogProductRow extends JsonRecord {
  id: string;
  name: string;
  slug: string;
  price: number;
  category_slug: string | null;
  printful_product_id: number | null;
  printful_managed: boolean;
}

interface CatalogVariantRow extends JsonRecord {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string | null;
  stock: number;
  printful_availability_status: string | null;
  price_override: number | null;
  printful_sync_variant_id: number | null;
  printful_variant_id: number | null;
}

interface CatalogSummary {
  productsSeen: number;
  productsImported: number;
  productsLinked: number;
  variantsLinked: number;
  ignoredProducts: number;
}

export async function syncPrintfulCatalog(
  db: SupabaseClient,
  token: string,
  onlyProductId?: number,
): Promise<CatalogSummary> {
  const list = onlyProductId === undefined ? await listStoreProducts(token) : null;
  const details = onlyProductId === undefined
    ? await getStoreProductsInBatches(token, (list ?? []).filter((product) => !product.is_ignored))
    : [await getStoreProduct(token, onlyProductId)];
  const ignoredProducts = list?.filter((product) => product.is_ignored).length ?? 0;
  const allSyncVariants = details.flatMap((detail) => detail.variants);
  const seenProviderVariantIds = new Set<number>();
  for (const variant of allSyncVariants) {
    if (seenProviderVariantIds.has(variant.id)) {
      throw new Error(`Printful returned duplicate sync variant ID ${variant.id}; no catalog data was written.`);
    }
    seenProviderVariantIds.add(variant.id);
  }

  const [{ data: productRows, error: productsError }, { data: variantRows, error: variantsError }] = await Promise.all([
    db.from('products').select('id, name, slug, price, category_slug, printful_product_id, printful_managed'),
    db.from('product_variants').select('id, product_id, size, color, sku, stock, price_override, printful_sync_variant_id, printful_variant_id, printful_availability_status'),
  ]);
  if (productsError || variantsError) throw new Error('Could not read the current AB16 catalog before syncing.');

  const products = (productRows ?? []) as CatalogProductRow[];
  const variants = (variantRows ?? []) as CatalogVariantRow[];
  const variantByPrintfulId = new Map<number, CatalogVariantRow>();
  for (const variant of variants) {
    if (variant.printful_sync_variant_id === null) continue;
    if (variantByPrintfulId.has(variant.printful_sync_variant_id)) {
      throw new Error(`The AB16 database has duplicate Printful sync variant ID ${variant.printful_sync_variant_id}; resolve the duplicate before syncing.`);
    }
    variantByPrintfulId.set(variant.printful_sync_variant_id, variant);
  }

  for (const detail of details) {
    const currencies = new Set(detail.variants.map((variant) => variant.currency?.trim().toUpperCase()).filter(Boolean));
    if (currencies.size > 1 || (currencies.size === 1 && !currencies.has('GBP'))) {
      const currency = [...currencies].join(', ');
      throw new Error(`Printful product ${detail.id} uses ${currency} pricing; set its store retail prices to GBP before syncing the AB16 catalog.`);
    }
    const matchedProducts = new Set<string>();
    for (const variant of detail.variants) {
      const existing = variantByPrintfulId.get(variant.id);
      if (existing) matchedProducts.add(existing.product_id);
    }
    if (matchedProducts.size > 1) {
      throw new Error(`Printful product ${detail.id} currently maps to multiple AB16 products; no catalog data was written.`);
    }
    const existingProduct = products.find((product) => product.printful_product_id === detail.id);
    if (existingProduct && matchedProducts.size && !matchedProducts.has(existingProduct.id)) {
      throw new Error(`Printful product ${detail.id} conflicts with existing variant ownership; no catalog data was written.`);
    }
    const productId = existingProduct?.id ?? [...matchedProducts][0] ?? '';
    if (productId) {
      const duplicateSource = products.find((product) => product.printful_product_id === detail.id && product.id !== productId);
      if (duplicateSource) throw new Error(`Printful product ${detail.id} is linked to more than one AB16 product.`);
    }
  }

  let productsImported = 0;
  let productsLinked = 0;
  let variantsLinked = 0;

  for (const detail of details) {
    let product = products.find((candidate) => candidate.printful_product_id === detail.id);
    const matchedIds = new Set(detail.variants.map((variant) => variant.id));
    const matchedProductIds = new Set(
      detail.variants
        .map((variant) => variantByPrintfulId.get(variant.id)?.product_id)
        .filter((id): id is string => Boolean(id)),
    );
    const legacyMatchedProductId = [...matchedProductIds][0];

    if (!product && legacyMatchedProductId) {
      product = products.find((candidate) => candidate.id === legacyMatchedProductId);
      if (!product) throw new Error(`The AB16 product for Printful product ${detail.id} could not be loaded.`);
      const { error } = await db.from('products').update({
        printful_product_id: detail.id,
        printful_synced_at: new Date().toISOString(),
      }).eq('id', product.id);
      if (error) throw new Error(`Could not attach Printful product ${detail.id} to its existing AB16 product.`);
      product = { ...product, printful_product_id: detail.id };
      productsLinked += 1;
    } else if (!product) {
      const retailPrices = detail.variants.map((variant) => priceInPence(variant.retail_price)).filter((price): price is number => price !== null);
      const minimumPrice = retailPrices.length ? Math.min(...retailPrices) : 0;
      const slug = `${slugify(detail.name)}-${detail.id}`;
      const { data, error } = await db.from('products').insert({
        name: detail.name,
        slug,
        description: null,
        price: minimumPrice,
        category_slug: categoryForName(detail.name),
        status: 'draft',
        available_for_sale: false,
        featured: false,
        is_new_arrival: false,
        is_limited_drop: false,
        printful_product_id: detail.id,
        printful_managed: true,
        printful_synced_at: new Date().toISOString(),
      }).select('id, name, slug, price, category_slug, printful_product_id, printful_managed').single();
      if (error || !data) throw new Error(`Could not import Printful product ${detail.id}.`);
      product = data as CatalogProductRow;
      products.push(product);
      productsImported += 1;
    } else {
      const { error } = await db.from('products').update({ printful_synced_at: new Date().toISOString() }).eq('id', product.id);
      if (error) throw new Error(`Could not record the latest sync time for Printful product ${detail.id}.`);
    }

    if (!product) throw new Error(`Could not determine the AB16 product for Printful product ${detail.id}.`);

    if (detail.variants.length === 0) {
      const { error } = await db.from('products')
        .update({ status: 'draft', available_for_sale: false, printful_synced_at: new Date().toISOString() })
        .eq('id', product.id);
      if (error) throw new Error(`Could not hide Printful product ${detail.id} because it has no active variants.`);
    }

    if (product.printful_managed) {
      const validPrices = detail.variants.map((variant) => priceInPence(variant.retail_price)).filter((price): price is number => price !== null);
      const minimumPrice = validPrices.length ? Math.min(...validPrices) : 0;
      const { error } = await db.from('products').update({
        name: detail.name,
        price: minimumPrice,
        category_slug: categoryForName(detail.name),
        printful_synced_at: new Date().toISOString(),
      }).eq('id', product.id);
      if (error) throw new Error(`Could not refresh Printful-managed product ${detail.id}.`);
      product = { ...product, name: detail.name, price: minimumPrice, category_slug: categoryForName(detail.name) };
    }

    if (product.printful_managed && detail.thumbnailUrl) {
      const { data: image, error: imageReadError } = await db.from('product_images')
        .select('id').eq('product_id', product.id).eq('source_key', 'printful_primary').maybeSingle();
      if (imageReadError) throw new Error(`Could not read the managed Printful image for product ${detail.id}.`);
      const imagePayload = {
        product_id: product.id,
        url: detail.thumbnailUrl,
        alt_text: `${detail.name} product image`,
        position: 0,
        source_key: 'printful_primary',
      };
      const imageResult = image
        ? await db.from('product_images').update(imagePayload).eq('id', image.id)
        : await db.from('product_images').insert(imagePayload);
      if (imageResult.error) throw new Error(`Could not sync the primary image for Printful product ${detail.id}.`);
    }

    for (const variant of detail.variants) {
      const existing = variantByPrintfulId.get(variant.id);
      if (existing && existing.product_id !== product.id) {
        throw new Error(`Printful sync variant ${variant.id} belongs to a different AB16 product.`);
      }
      const dimensions = variantDimensions(variant);
      const retailPrice = priceInPence(variant.retail_price);
      const payload = {
        product_id: product.id,
        size: dimensions.size,
        color: dimensions.color,
        sku: product.printful_managed
          ? (variant.sku?.trim() || `PF-${variant.id}`)
          : (existing?.sku ?? variant.sku?.trim() ?? `PF-${variant.id}`),
        stock: existing?.stock ?? 0,
        printful_availability_status: normalizeAvailabilityStatus(variant.availability_status),
        price_override: product.printful_managed && retailPrice !== null && retailPrice !== product.price ? retailPrice : (product.printful_managed ? null : existing?.price_override ?? null),
        printful_sync_variant_id: variant.id,
        printful_variant_id: variant.variant_id ?? existing?.printful_variant_id ?? null,
      };

      const variantResult = existing
        ? await db.from('product_variants').update(payload).eq('id', existing.id)
        : await db.from('product_variants').insert(payload);
      if (variantResult.error) throw new Error(`Could not sync Printful variant ${variant.id}.`);
      variantsLinked += 1;
    }

    const staleIds = variants.filter((variant) =>
      variant.product_id === product.id
      && variant.printful_sync_variant_id !== null
      && !matchedIds.has(variant.printful_sync_variant_id),
    ).map((variant) => variant.id);
    if (staleIds.length) {
      const { error } = await db.from('product_variants')
        .update({ printful_sync_variant_id: null, printful_variant_id: null })
        .in('id', staleIds);
      if (error) throw new Error(`Could not clear discontinued Printful mappings from product ${detail.id}.`);
    }
  }

  if (list) {
    const activeProductIds = new Set(details.filter((detail) => detail.variants.length > 0).map((detail) => detail.id));
    const activeVariantIds = new Set(details.flatMap((detail) => detail.variants.map((variant) => variant.id)));
    const discontinuedVariantIds = variants.filter((variant) =>
      variant.printful_sync_variant_id !== null && !activeVariantIds.has(variant.printful_sync_variant_id),
    ).map((variant) => variant.id);
    if (discontinuedVariantIds.length) {
      const { error } = await db.from('product_variants')
        .update({ printful_sync_variant_id: null, printful_variant_id: null })
        .in('id', discontinuedVariantIds);
      if (error) throw new Error('Could not clear discontinued Printful variant mappings.');
    }

    for (const product of products) {
      if (product.printful_product_id === null || activeProductIds.has(product.printful_product_id)) continue;
      const { error } = await db.from('products').update({
        status: 'draft',
        available_for_sale: false,
        printful_synced_at: new Date().toISOString(),
      }).eq('id', product.id);
      if (error) throw new Error(`Could not hide unavailable Printful product ${product.printful_product_id}.`);
    }
  }

  return {
    productsSeen: list?.length ?? 1,
    productsImported,
    productsLinked,
    variantsLinked,
    ignoredProducts,
  };
}

function normalizeAvailabilityStatus(value: unknown): string | null {
  return value === 'active' || value === 'discontinued' || value === 'out_of_stock' || value === 'temporary_out_of_stock'
    ? value
    : null;
}

export async function getStoreProduct(token: string, productId: number): Promise<{
  id: number;
  name: string;
  thumbnailUrl: string | null;
  variants: PrintfulSyncVariant[];
}> {
  const response = await fetch(`https://api.printful.com/store/products/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await readPrintfulResponse(response, `product ${productId}`);
  const result = asRecord(body.result);
  const syncProduct = asRecord(result.sync_product ?? result);
  const rows = Array.isArray(result.sync_variants) ? result.sync_variants : [];
  const variants = rows.map(asRecord)
    .filter((variant) => !variant.is_ignored && Number.isInteger(Number(variant.id)) && Number.isInteger(Number(variant.variant_id)))
    .map((variant) => ({ ...variant, id: Number(variant.id), variant_id: Number(variant.variant_id) } as PrintfulSyncVariant));
  const id = Number(syncProduct.id ?? productId);
  const name = asString(syncProduct.name) || `Printful product ${productId}`;
  const thumbnailUrl = absoluteHttpsUrl(syncProduct.thumbnail_url ?? result.thumbnail_url ?? syncProduct.thumbnail);
  return { id, name, thumbnailUrl, variants };
}

async function listStoreProducts(token: string): Promise<PrintfulProductSummary[]> {
  const products: PrintfulProductSummary[] = [];
  const limit = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const response = await fetch(`https://api.printful.com/store/products?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await readPrintfulResponse(response, 'store products');
    const rows = Array.isArray(body.result) ? body.result : [];
    products.push(...rows.map(asRecord).map((row) => ({
      id: Number(row.id),
      name: asString(row.name) || `Printful product ${row.id}`,
      variants: Number(row.variants ?? 0),
      synced: Number(row.synced ?? 0),
      thumbnail_url: asNullableString(row.thumbnail_url),
      is_ignored: row.is_ignored === true,
    })).filter((row) => Number.isInteger(row.id)));
    total = Number(asRecord(body.paging).total ?? products.length);
    if (!rows.length) break;
    offset += rows.length;
  }
  return products;
}

async function getStoreProductsInBatches(token: string, products: PrintfulProductSummary[]) {
  const details: Awaited<ReturnType<typeof getStoreProduct>>[] = [];
  for (let offset = 0; offset < products.length; offset += 5) {
    const batch = products.slice(offset, offset + 5);
    details.push(...await Promise.all(batch.map((product) => getStoreProduct(token, product.id))));
  }
  return details;
}

async function readPrintfulResponse(response: Response, resource: string): Promise<JsonRecord> {
  let body: JsonRecord = {};
  try {
    body = asRecord(await response.json());
  } catch {
    throw new Error(`Printful returned an unreadable response for ${resource} (HTTP ${response.status}).`);
  }
  if (!response.ok || Number(body.code) >= 400) {
    const message = asString(asRecord(body.result).error) || asString(asRecord(body.error).message);
    throw new Error(`Printful could not return ${resource} (HTTP ${response.status}${message ? `: ${message}` : ''}).`);
  }
  return body;
}

function variantDimensions(variant: PrintfulSyncVariant): { size: string; color: string } {
  const options = Array.isArray(variant.options) ? variant.options.map(asRecord) : [];
  const findOption = (needle: string) => options.find((option) =>
    asString(option.id).toLowerCase().includes(needle) || asString(option.name).toLowerCase().includes(needle),
  );
  const sizeOption = findOption('size');
  const colorOption = findOption('color') ?? findOption('colour');
  const optionSize = asString(sizeOption?.value ?? sizeOption?.display_name);
  const optionColor = asString(colorOption?.value ?? colorOption?.display_name);
  const parts = asString(variant.name).split('/').map((part) => part.trim()).filter(Boolean);
  const sizePart = [...parts].reverse().find((part) => /^(?:one size|os|xs|s|m|l|xl|2xl|3xl|4xl|5xl|6xl|xxs|xxl|xxxl|[0-9]+(?:\.[0-9]+)?\s*(?:oz|in|cm))$/i.test(part));
  const size = optionSize || sizePart || (parts.length > 1 ? parts.at(-1) : '') || 'One Size';
  const color = optionColor || (sizePart && parts.length > 1 ? parts[parts.indexOf(sizePart) - 1] : '') || 'Default';
  return { size, color };
}

function priceInPence(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number.parseFloat(asString(value));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function categoryForName(name: string): string {
  const value = name.toLowerCase();
  if (/hoodie|hooded|sweatshirt|sweat shirt|jumper/.test(value)) return 'hoodies';
  if (/tracksuit|track suit|jogger|trouser/.test(value)) return 'tracksuits';
  if (/t-?shirt|tee|tank top|polo/.test(value)) return 't-shirts';
  if (/jacket|coat|windbreaker/.test(value)) return 'jackets';
  return 'accessories';
}

function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'printful-product';
}

function absoluteHttpsUrl(value: unknown): string | null {
  const text = asString(value);
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
