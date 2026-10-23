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
    const stock = Math.max(0, Number(variant.stock ?? 0));
    if (!stock) {
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
    if (!variant.printful_sync_variant_id) {
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
