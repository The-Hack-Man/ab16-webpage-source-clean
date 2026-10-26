import { Link } from 'react-router-dom';
import { Minus, Plus, X, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/format';

const FREE_SHIPPING_THRESHOLD = 7500; // £75

export function BagPage() {
  const { items, removeItem, updateQuantity, subtotal, count } = useCart();

  if (items.length === 0) {
    return (
      <div className="bg-bone min-h-screen">
        <div className="container-base py-16 lg:py-24">
          <h1 className="text-display-xl mb-8">Shopping Bag</h1>
          <div className="border border-jet/10 py-16 text-center">
            <ShoppingBag size={40} className="mx-auto text-slate-300 mb-4" strokeWidth={1} />
            <h2 className="text-lg font-semibold">Your bag is empty</h2>
            <p className="mt-2 text-sm text-slate-400">Browse the shop for made-to-order AB16 pieces. Your bag will show delivery and total before secure checkout.</p>
            <Link to="/shop" className="btn-primary mt-6">Start Shopping <ArrowRight size={14} /></Link>
          </div>
        </div>
      </div>
    );
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 450;
  const total = subtotal + shipping;
  const remainingForFree = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <div className="bg-bone min-h-screen">
      <div className="container-base py-12 lg:py-16">
        <h1 className="text-display-xl mb-8">Shopping Bag ({count})</h1>

        {/* Free shipping progress */}
        {remainingForFree > 0 ? (
          <div className="bg-slate-100 p-4 mb-8">
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <Truck size={16} />
              Add {formatPrice(remainingForFree)} more for free UK shipping.
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 p-4 mb-8">
            <p className="text-sm text-green-700 flex items-center gap-2"><Truck size={16} /> You've unlocked free UK shipping!</p>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr,380px] gap-8 lg:gap-12">
          {/* Items */}
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.variant_id} className="flex gap-4 border border-jet/10 p-4">
                <Link to={`/shop/${item.product_slug}`} className="shrink-0">
                  <div className="w-24 h-28 bg-slate-100 overflow-hidden">
                    {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/shop/${item.product_slug}`} className="text-sm font-semibold hover:underline truncate">{item.name}</Link>
                    <button onClick={() => removeItem(item.variant_id)} className="text-slate-400 hover:text-jet shrink-0" aria-label="Remove item">
                      <X size={16} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{item.color} · {item.size}</p>
                  <p className="mt-1 text-sm font-semibold">{formatPrice(item.price)}</p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center border border-jet/15">
                      <button onClick={() => updateQuantity(item.variant_id, item.quantity - 1)} className="px-2.5 py-1.5 hover:bg-jet/5" aria-label="Decrease">
                        <Minus size={12} />
                      </button>
                      <span className="w-10 text-center text-xs font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.variant_id, item.quantity + 1)} className="px-2.5 py-1.5 hover:bg-jet/5" aria-label="Increase">
                        <Plus size={12} />
                      </button>
                    </div>
                    <p className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</p>
                  </div>

                  {item.quantity >= item.max_stock && (
                    <p className="mt-2 text-[11px] text-amber-600">Max stock reached for this variant.</p>
                  )}
                </div>
              </div>
            ))}

            <Link to="/shop" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-jet mt-4">
              ← Continue shopping
            </Link>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="border border-jet/10 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Order Summary</h2>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatPrice(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="font-medium">{shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
                <div className="hairline my-3" />
                <div className="flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-bold">{formatPrice(total)}</span></div>
              </div>
              <Link to="/checkout" className="btn-primary w-full mt-6">
                Checkout <ArrowRight size={14} />
              </Link>
              <p className="mt-4 text-[11px] text-slate-400 text-center">Taxes calculated at checkout. Secure payment via Stripe.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
