import { supabase } from '@/lib/supabase';
import type { CartItem } from '@/types';

export interface CheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  shippingMethod: string;
  discountCode?: string;
}

export async function startStripeCheckout(customer: CheckoutCustomer, items: CartItem[]) {
  const origin = window.location.origin;
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    ...(sessionData.session ? { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } } : {}),
    body: {
      customer,
      items: items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
      origin,
    },
  });

  if (error) {
    const context = (data as { error?: string } | null)?.error;
    throw new Error(context || error.message || 'Could not start Stripe checkout.');
  }

  const url = (data as { url?: string } | null)?.url;
  if (!url) {
    throw new Error(
      (data as { error?: string } | null)?.error
      || 'Stripe checkout is not configured yet. Add STRIPE_SECRET_KEY as a Supabase secret and deploy the create-checkout function.',
    );
  }

  window.location.assign(url);
}
