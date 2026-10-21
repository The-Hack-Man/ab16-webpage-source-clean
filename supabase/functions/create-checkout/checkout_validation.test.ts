import { describe, it, expect } from 'vitest';
import {
  validateCustomerInfo,
  validateRequestedItems,
  buildLineItems,
} from './checkout_validation';
import type { DbVariant } from './checkout_validation';

function makeVariant(overrides: Partial<DbVariant> = {}): DbVariant {
  return {
    id: 'variant-1',
    size: 'M',
    color: 'White',
    stock: 20,
    price_override: 2200,
    printful_sync_variant_id: 12345,
    product_id: 'product-1',
    products: {
      id: 'product-1',
      name: 'AB16 T-Shirt (White)',
      slug: 'ab16-tshirt-white',
      price: 2200,
      status: 'published',
      available_for_sale: true,
    },
    ...overrides,
  };
}

describe('validateCustomerInfo', () => {
  const validCustomer = {
    email: 'buyer@example.test',
    firstName: 'Jane',
    address1: '123 High Street',
    city: 'London',
    postcode: 'SW1A 1AA',
    country: 'United Kingdom',
  };

  it('returns null for a complete, valid customer', () => {
    expect(validateCustomerInfo(validCustomer)).toBeNull();
  });

  it('accepts Ireland as a delivery country', () => {
    expect(validateCustomerInfo({ ...validCustomer, country: 'Ireland' })).toBeNull();
  });

  it('rejects a missing email', () => {
    const result = validateCustomerInfo({ ...validCustomer, email: '' });
    expect(result).not.toBeNull();
    expect(result!.error).toBe('Please complete your delivery details before paying.');
    expect(result!.statusCode).toBe(400);
  });

  it('rejects a missing address1', () => {
    const result = validateCustomerInfo({ ...validCustomer, address1: '' });
    expect(result).not.toBeNull();
  });

  it('rejects a missing postcode', () => {
    const result = validateCustomerInfo({ ...validCustomer, postcode: '' });
    expect(result).not.toBeNull();
  });

  it('rejects a non-UK/Ireland country', () => {
    const result = validateCustomerInfo({ ...validCustomer, country: 'United States' });
    expect(result).not.toBeNull();
    expect(result!.error).toBe('We currently deliver to the United Kingdom and Ireland only.');
    expect(result!.statusCode).toBe(400);
  });
});

describe('validateRequestedItems', () => {
  it('accepts valid items and aggregates quantities', () => {
    const { quantities, error } = validateRequestedItems([
      { variant_id: 'v1', quantity: 2 },
      { variant_id: 'v1', quantity: 1 },
      { variant_id: 'v2', quantity: 1 },
    ]);
    expect(error).toBeNull();
    expect(quantities.get('v1')).toBe(3);
    expect(quantities.get('v2')).toBe(1);
  });

  it('rejects an empty bag', () => {
    const { error } = validateRequestedItems([]);
    expect(error).not.toBeNull();
    expect(error!.error).toBe('Your bag is empty.');
    expect(error!.statusCode).toBe(400);
  });

  it('rejects a non-array input', () => {
    const { error } = validateRequestedItems(null as unknown as Parameters<typeof validateRequestedItems>[0]);
    expect(error).not.toBeNull();
    expect(error!.error).toBe('Your bag is empty.');
  });

  it('rejects an item with no variant_id', () => {
    const { error } = validateRequestedItems([{ variant_id: '', quantity: 1 }]);
    expect(error).not.toBeNull();
    expect(error!.error).toBe('Your bag contains an invalid item or quantity.');
  });

  it('rejects a non-integer quantity', () => {
    const { error } = validateRequestedItems([{ variant_id: 'v1', quantity: 1.5 }]);
    expect(error).not.toBeNull();
  });

  it('rejects zero or negative quantity', () => {
    expect(validateRequestedItems([{ variant_id: 'v1', quantity: 0 }]).error).not.toBeNull();
    expect(validateRequestedItems([{ variant_id: 'v1', quantity: -1 }]).error).not.toBeNull();
  });
});

describe('buildLineItems', () => {
  const validVariant = makeVariant();

  it('builds line items for a valid available mapped variant', () => {
    const { result, error } = buildLineItems([validVariant], new Map([['variant-1', 2]]));
    expect(error).toBeNull();
    expect(result.subtotal).toBe(4400);
    expect(result.snapshot).toHaveLength(1);
    expect(result.snapshot[0]).toEqual({
      variant_id: 'variant-1',
      product_name: 'AB16 T-Shirt (White)',
      variant_size: 'M',
      variant_color: 'White',
      quantity: 2,
      price: 2200,
    });
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].price_data?.currency).toBe('gbp');
    expect(result.lineItems[0].price_data?.unit_amount).toBe(2200);
    expect(result.lineItems[0].quantity).toBe(2);
  });

  it('aggregates subtotal across multiple variants', () => {
    const { result, error } = buildLineItems(
      [validVariant, makeVariant({ id: 'variant-2', printful_sync_variant_id: 67890, color: 'Black' })],
      new Map([
        ['variant-1', 1],
        ['variant-2', 3],
      ]),
    );
    expect(error).toBeNull();
    expect(result.subtotal).toBe(2200 + 6600);
    expect(result.snapshot).toHaveLength(2);
  });

  it('rejects an out-of-stock variant', () => {
    const outOfStock = makeVariant({ stock: 0 });
    const { error } = buildLineItems([outOfStock], new Map([['variant-1', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toBe('AB16 T-Shirt (White) is out of stock.');
    expect(error!.statusCode).toBe(400);
  });

  it('rejects a variant with insufficient stock for the requested quantity', () => {
    const { error } = buildLineItems([validVariant], new Map([['variant-1', 25]]));
    expect(error).not.toBeNull();
    expect(error!.error).toBe('Only 20 AB16 T-Shirt (White) item(s) are available in this size and colour.');
    expect(error!.statusCode).toBe(400);
  });

  it('rejects a variant with a missing Printful mapping (printful_sync_variant_id is null)', () => {
    const unmapped = makeVariant({ printful_sync_variant_id: null });
    const { result, error } = buildLineItems([unmapped], new Map([['variant-1', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toBe('AB16 T-Shirt (White) is not connected to its Printful product yet. Please try again later.');
    expect(error!.statusCode).toBe(409);
    expect(result.snapshot).toHaveLength(0);
  });

  it('rejects a variant whose product is not published', () => {
    const draftProduct = makeVariant({ products: { ...makeVariant().products!, status: 'draft' } });
    const { error } = buildLineItems([draftProduct], new Map([['variant-1', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toContain('not available for purchase yet');
    expect(error!.statusCode).toBe(400);
  });

  it('rejects a variant whose product is coming-soon (available_for_sale = false)', () => {
    const comingSoon = makeVariant({ products: { ...makeVariant().products!, available_for_sale: false } });
    const { error } = buildLineItems([comingSoon], new Map([['variant-1', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toContain('not available for purchase yet');
  });

  it('rejects a variant with a zero or sub-minimum price', () => {
    const freeVariant = makeVariant({ price_override: 0, products: { ...makeVariant().products!, price: 0 } });
    const { error } = buildLineItems([freeVariant], new Map([['variant-1', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toBe('AB16 T-Shirt (White) does not have a sale price yet.');
    expect(error!.statusCode).toBe(400);
  });

  it('rejects a variant with a price below the 50p minimum', () => {
    const cheapVariant = makeVariant({ price_override: 30 });
    const { error } = buildLineItems([cheapVariant], new Map([['variant-1', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toContain('does not have a sale price yet');
    expect(error!.statusCode).toBe(400);
  });

  it('rejects a requested variant_id that does not match any loaded variant', () => {
    const { error } = buildLineItems([], new Map([['missing-variant-id', 1]]));
    expect(error).not.toBeNull();
    expect(error!.error).toContain('not available for purchase yet');
    expect(error!.statusCode).toBe(400);
  });

  it('uses price_override when present, falls back to product price', () => {
    const withOverride = makeVariant({ price_override: 2200, products: { ...makeVariant().products!, price: 2500 } });
    const withoutOverride = makeVariant({ price_override: null, products: { ...makeVariant().products!, price: 2500 } });

    const { result: r1 } = buildLineItems([withOverride], new Map([['variant-1', 1]]));
    expect(r1.snapshot[0].price).toBe(2200);

    const { result: r2 } = buildLineItems([withoutOverride], new Map([['variant-1', 1]]));
    expect(r2.snapshot[0].price).toBe(2500);
  });
});
