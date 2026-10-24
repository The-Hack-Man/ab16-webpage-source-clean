import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowRight, Check } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { startStripeCheckout } from '@/lib/checkout';
import { useAuth } from '@/hooks/useAuth';

const FREE_SHIPPING_THRESHOLD = 7500;

export function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { user } = useAuth();
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', address1: '', address2: '',
    city: '', postcode: '', country: 'United Kingdom', phone: '',
    shippingMethod: 'standard',
  });
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState<{
    code: string;
    type: 'percentage' | 'fixed' | 'free_shipping';
    value: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setForm((current) => current.email ? current : { ...current, email: user.email ?? '' });
  }, [user?.email]);

  const shipping = form.shippingMethod === 'express' ? 850 : (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 450);
  const discountAmount = !discountApplied
    ? 0
    : discountApplied.type === 'percentage'
      ? Math.round((subtotal * Math.min(100, Math.max(0, discountApplied.value))) / 100)
      : discountApplied.type === 'fixed'
        ? Math.min(discountApplied.value, subtotal)
        : shipping;
  const total = Math.max(0, subtotal + shipping - discountAmount);

  const applyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountError('');
    setDiscountApplied(null);
    const { data, error } = await supabase.from('discounts').select('*').eq('code', discountCode.trim().toUpperCase()).eq('active', true).maybeSingle();
    if (error) {
      setDiscountError('Could not validate the discount code. Please try again.');
      return;
    }
    if (!data) {
      setDiscountError('Invalid or expired code.');
      setDiscountApplied(null);
      return;
    }
    if (data.starts_at && new Date(data.starts_at) > new Date()) { setDiscountError('This code is not active yet.'); return; }
    if (data.ends_at && new Date(data.ends_at) < new Date()) { setDiscountError('This code has expired.'); return; }
    if (data.min_order_value && subtotal < data.min_order_value) { setDiscountError(`Minimum order of ${formatPrice(data.min_order_value)} required.`); return; }
    if (data.usage_limit !== null && data.used_count >= data.usage_limit) { setDiscountError('This code has reached its usage limit.'); return; }
    if (data.type !== 'percentage' && data.type !== 'fixed' && data.type !== 'free_shipping') {
      setDiscountError('This discount code is not configured correctly.');
      return;
    }

    setDiscountApplied({
      code: data.code,
      type: data.type,
      value: data.value,
    });
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    setCheckoutError(null);

    try {
      await startStripeCheckout(
        { email: form.email, firstName: form.firstName, lastName: form.lastName, address1: form.address1, address2: form.address2, city: form.city, postcode: form.postcode, country: form.country, phone: form.phone, shippingMethod: form.shippingMethod, discountCode: discountApplied?.code },
        items,
      );
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Could not start secure checkout. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-bone min-h-screen flex items-center justify-center px-4">
        <div className="text-center py-16">
          <h1 className="text-display-lg">Your bag is empty</h1>
          <Link to="/shop" className="btn-primary mt-6">Browse Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bone min-h-screen">
      <div className="container-base py-12 lg:py-16">
        <h1 className="text-display-xl mb-8">Checkout</h1>

        <form onSubmit={placeOrder} className="grid lg:grid-cols-[1fr,400px] gap-8 lg:gap-12">
          {/* Left: details */}
          <div className="space-y-8">
            {/* Contact */}
            <FormSection title="Contact" step={1}>
              <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
            </FormSection>

            {/* Shipping address */}
            <FormSection title="Delivery Address" step={2}>
              <div className="grid sm:grid-cols-2 gap-3">
                <input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-field" />
                <input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-field" />
              </div>
              <input required placeholder="Address line 1" value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} className="input-field" />
              <input placeholder="Address line 2 (optional)" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} className="input-field" />
              <div className="grid sm:grid-cols-3 gap-3">
                <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
                <input required placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className="input-field" />
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input-field cursor-pointer">
                  <option>United Kingdom</option>
                  <option>Ireland</option>
                  <option>Other</option>
                </select>
              </div>
              <input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </FormSection>

            {/* Shipping method */}
            <FormSection title="Delivery Method" step={3}>
              <div className="space-y-2">
                <label className={`flex items-center justify-between border p-4 cursor-pointer transition-colors ${form.shippingMethod === 'standard' ? 'border-jet' : 'border-jet/15 hover:border-jet/30'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="shipping" value="standard" checked={form.shippingMethod === 'standard'} onChange={(e) => setForm({ ...form, shippingMethod: e.target.value })} className="accent-jet" />
                    <div>
                      <p className="text-sm font-medium">Standard (2-4 days)</p>
                      <p className="text-xs text-slate-400">Free over £75</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{subtotal >= FREE_SHIPPING_THRESHOLD ? 'Free' : formatPrice(450)}</span>
                </label>
                <label className={`flex items-center justify-between border p-4 cursor-pointer transition-colors ${form.shippingMethod === 'express' ? 'border-jet' : 'border-jet/15 hover:border-jet/30'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="shipping" value="express" checked={form.shippingMethod === 'express'} onChange={(e) => setForm({ ...form, shippingMethod: e.target.value })} className="accent-jet" />
                    <div>
                      <p className="text-sm font-medium">Express (1-2 days)</p>
                      <p className="text-xs text-slate-400">Tracked, priority dispatch</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(850)}</span>
                </label>
              </div>
            </FormSection>

            {/* Discount */}
            <FormSection title="Discount Code" step={4}>
              <div className="flex gap-2">
                <input placeholder="Enter code" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} className="input-field flex-1" />
                <button type="button" onClick={applyDiscount} className="btn-outline whitespace-nowrap">Apply</button>
              </div>
              {discountError && <p className="text-sm text-red-600 mt-2">{discountError}</p>}
              {discountApplied && <p className="text-sm text-green-600 mt-2 flex items-center gap-1"><Check size={14} /> Code "{discountApplied.code}" applied — {formatPrice(discountAmount)} off.</p>}
            </FormSection>
          </div>

          {/* Right: summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="border border-jet/10 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.variant_id} className="flex gap-3">
                    <div className="w-14 h-16 bg-slate-100 overflow-hidden shrink-0">
                      {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.color} · {item.size} · Qty {item.quantity}</p>
                      <p className="text-xs font-semibold mt-0.5">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hairline mb-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                {discountApplied && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(discountAmount)}</span></div>}
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
                <div className="hairline my-3" />
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatPrice(total)}</span></div>
              </div>

              <button type="submit" disabled={placing} className="btn-primary w-full mt-6">
                {placing ? 'Placing order…' : <>Place Order <ArrowRight size={14} /></>}
              </button>
              {checkoutError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {checkoutError}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Lock size={11} /> Secure checkout — your data is encrypted.</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><ShieldCheck size={11} /> Payment processed by Stripe when configured.</p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormSection({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-6 h-6 rounded-full bg-jet text-bone text-xs font-bold flex items-center justify-center">{step}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
