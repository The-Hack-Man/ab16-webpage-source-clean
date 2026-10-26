import type Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

export interface CheckoutItem {
  variant_id: string;
  quantity: number;
}

export interface CustomerInfo {
  email?: string;
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  shippingMethod?: string;
  discountCode?: string;
}

export interface DbVariant {
  id: string;
  size: string;
  color: string;
  stock: number;
  printful_availability_status?: string | null;
  price_override: number | null;
  printful_sync_variant_id: number | null;
  product_id: string;
  products: {
    id: string;
    name: string;
    slug: string;
    price: number;
    status: string;
    available_for_sale: boolean;
  } | null;
}

export interface CheckoutError {
  error: string;
  statusCode: number;
}

export function stripeModeMatchesDeployment(stripeKey: string, configuredMode?: string): boolean {
  if (configuredMode !== undefined && configuredMode !== 'true' && configuredMode !== 'false') return false;
  const keyMode = /^(?:sk|rk)_(test|live)_/.exec(stripeKey)?.[1];
  if (!keyMode) return false;
  const expectedMode = configuredMode === 'false' ? 'test' : 'live';
  return keyMode === expectedMode;
}

export interface CheckoutReadinessConfig {
  stripeSecretKey?: string;
  expectedStripeMode?: string;
  printfulApiKey?: string;
  resendApiKey?: string;
  adminOrderEmail?: string;
  fromEmail?: string;
}

export function missingCheckoutReadinessSecrets(config: CheckoutReadinessConfig): string[] {
  const missing: string[] = [];
  if (!config.stripeSecretKey?.trim() || !stripeModeMatchesDeployment(config.stripeSecretKey.trim(), config.expectedStripeMode)) {
    missing.push('STRIPE_SECRET_KEY (must match STRIPE_EXPECT_LIVE_MODE)');
  }
  if (config.expectedStripeMode !== undefined && config.expectedStripeMode !== 'true' && config.expectedStripeMode !== 'false') {
    missing.push('STRIPE_EXPECT_LIVE_MODE');
  }

  if (config.expectedStripeMode !== 'false') {
    if (!config.printfulApiKey?.trim()) missing.push('PRINTFUL_API_KEY');
    if (!config.resendApiKey?.trim()) missing.push('RESEND_API_KEY');
    if (!config.adminOrderEmail?.trim()) missing.push('ADMIN_ORDER_EMAIL');
    if (!config.fromEmail?.trim()) missing.push('FROM_EMAIL');
  }
  return missing;
}

export interface CheckoutLineItems {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  snapshot: Array<{
    variant_id: string;
    product_name: string;
    variant_size: string;
    variant_color: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
}

export function validateCustomerInfo(customer: CustomerInfo): CheckoutError | null {
  if (!customer.email || !customer.firstName || !customer.address1 || !customer.city || !customer.postcode) {
    return { error: 'Please complete your delivery details before paying.', statusCode: 400 };
  }
  if (customer.country !== 'United Kingdom' && customer.country !== 'Ireland') {
    return { error: 'We currently deliver to the United Kingdom and Ireland only.', statusCode: 400 };
  }
  return null;
}

export function validateRequestedItems(items: CheckoutItem[]): { quantities: Map<string, number>; error: CheckoutError | null } {
  if (!Array.isArray(items) || !items.length) {
    return { quantities: new Map(), error: { error: 'Your bag is empty.', statusCode: 400 } };
  }
  const quantities = new Map<string, number>();
  for (const item of items) {
    const variantId = typeof item.variant_id === 'string' ? item.variant_id : '';
    const quantity = Number(item.quantity);
    if (!variantId || !Number.isInteger(quantity) || quantity < 1) {
      return { quantities, error: { error: 'Your bag contains an invalid item or quantity.', statusCode: 400 } };
    }
    quantities.set(variantId, (quantities.get(variantId) ?? 0) + quantity);
  }
  return { quantities, error: null };
}

export function buildLineItems(
  variants: DbVariant[],
  requestedQuantities: Map<string, number>,
): { result: CheckoutLineItems; error: CheckoutError | null } {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const snapshot: CheckoutLineItems['snapshot'] = [];
  let subtotal = 0;

  for (const [variantId, requestedQuantity] of requestedQuantities) {
    const variant = variants.find((row) => row.id === variantId);
    const product = variant?.products;
    if (!variant || !product || product.status !== 'published' || product.available_for_sale === false) {
      return {
        result: { lineItems, snapshot, subtotal },
        error: { error: 'AB16 clothing is not available for purchase yet. Stripe cannot take payment for coming-soon items.', statusCode: 400 },
      };
    }
    const printfulMapped = Number.isSafeInteger(variant.printful_sync_variant_id) && variant.printful_sync_variant_id! > 0;
    const printfulStatus = variant.printful_availability_status;
    const printfulAvailable = printfulMapped && (printfulStatus === null || printfulStatus === undefined || printfulStatus === 'active');
    const stock = printfulAvailable ? 99 : Math.max(0, Number(variant.stock ?? 0));
    if (!stock || (printfulMapped && !printfulAvailable)) {
      return {
        result: { lineItems, snapshot, subtotal },
        error: { error: `${product.name} is out of stock.`, statusCode: 400 },
      };
    }
    if (requestedQuantity > stock) {
      return {
        result: { lineItems, snapshot, subtotal },
        error: { error: `Only ${stock} ${product.name} item(s) are available in this size and colour.`, statusCode: 400 },
      };
    }
    if (!printfulMapped) {
      return {
        result: { lineItems, snapshot, subtotal },
        error: { error: `${product.name} is not connected to its Printful product yet. Please try again later.`, statusCode: 409 },
      };
    }
    const unitAmount = variant.price_override ?? product.price;
    if (!unitAmount || unitAmount < 50) {
      return {
        result: { lineItems, snapshot, subtotal },
        error: { error: `${product.name} does not have a sale price yet.`, statusCode: 400 },
      };
    }
    subtotal += unitAmount * requestedQuantity;
    snapshot.push({
      variant_id: variant.id,
      product_name: product.name,
      variant_size: variant.size,
      variant_color: variant.color,
      quantity: requestedQuantity,
      price: unitAmount,
    });
    lineItems.push({
      quantity: requestedQuantity,
      price_data: {
        currency: 'gbp',
        unit_amount: unitAmount,
        product_data: {
          name: product.name,
          description: `${variant.color} / ${variant.size}`,
        },
      },
    });
  }

  return { result: { lineItems, snapshot, subtotal }, error: null };
}
