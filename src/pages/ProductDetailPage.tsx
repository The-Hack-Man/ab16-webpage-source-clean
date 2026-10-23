import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Heart, Truck, RotateCcw, Ruler, ChevronRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductVariant, Icon } from '@/types';
import { useCart } from '@/hooks/useCart';
import { formatPrice, storeImageUrl } from '@/lib/format';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      setProduct(data as Product | null);
      if (data?.product_variants?.length) {
        const variants = data.product_variants as ProductVariant[];
        const colors = [...new Set(variants.map((v) => v.color))];
        setSelectedColor(colors[0] ?? '');
        const sizes = [...new Set(variants.map((v) => v.size))];
        setSelectedSize(sizes[0] ?? '');
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return <div className="container-base py-20"><div className="grid lg:grid-cols-2 gap-8"><div className="aspect-[4/5] bg-slate-100 animate-pulse" /><div className="space-y-4"><div className="h-8 bg-slate-100 animate-pulse" /><div className="h-4 bg-slate-100 animate-pulse w-1/2" /><div className="h-32 bg-slate-100 animate-pulse" /></div></div></div>;
  }

  if (!product) {
    return (
      <div className="container-base py-32 text-center">
        <h1 className="text-display-lg">Product not found</h1>
        <p className="mt-3 text-slate-400">This product may have been removed or is no longer available.</p>
        <Link to="/shop" className="btn-primary mt-8">Back to Shop</Link>
      </div>
    );
  }

  const images = product.product_images ?? [];
  const variants = product.product_variants ?? [];
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizes = [...new Set(variants.map((v) => v.size))];

  const currentVariant = variants.find((v) => v.size === selectedSize && v.color === selectedColor);
  const stock = currentVariant?.stock ?? 0;
  const price = currentVariant?.price_override ?? product.price;
  const comingSoon = product.available_for_sale === false;
  const soldOut = !comingSoon && stock === 0;

  const handleAddToBag = () => {
    if (!currentVariant || soldOut) return;
    addItem({
      variant_id: currentVariant.id,
      product_id: product.id,
      product_slug: product.slug,
      name: product.name,
      price,
      image_url: storeImageUrl(images[0]?.url) ?? null,
      size: selectedSize,
      color: selectedColor,
      quantity,
      max_stock: stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="bg-bone min-h-screen">
      {/* Breadcrumb */}
      <div className="container-base pt-6">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/" className="hover:text-jet">Home</Link>
          <ChevronRight size={12} />
          <Link to="/shop" className="hover:text-jet">Shop</Link>
          <ChevronRight size={12} />
          <span className="text-jet">{product.name}</span>
        </nav>
      </div>

      <div className="container-base py-8 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Gallery */}
          <div>
            <div className="aspect-[4/5] bg-slate-100 overflow-hidden mb-3">
              {images[selectedImage] ? (
                <img src={storeImageUrl(images[selectedImage].url)} alt={images[selectedImage].alt_text ?? product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm uppercase tracking-widest">No image</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-24 overflow-hidden border-2 transition-colors ${selectedImage === i ? 'border-jet' : 'border-transparent hover:border-jet/30'}`}
                  >
                    <img src={storeImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:py-4">
            {product.is_new_arrival && <span className="badge-new mb-3">New Arrival</span>}
            {product.is_limited_drop && <span className="badge-limited mb-3">Limited Drop</span>}
            {comingSoon && <span className="badge bg-jet text-bone mb-3">{product.availability_label ?? 'Coming Soon'}</span>}

            <h1 className="text-display-lg">{product.name}</h1>
            <p className="mt-3 text-xl font-semibold">{comingSoon ? 'TBA' : formatPrice(price)}</p>
            {product.compare_at_price && (
              <p className="text-sm text-slate-400 line-through">{formatPrice(product.compare_at_price)}</p>
            )}

            {product.description && <p className="mt-6 text-slate-600 leading-relaxed">{product.description}</p>}

            {/* Colour selector */}
            {colors.length > 0 && (
              <div className="mt-8">
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Colour: <span className="text-jet">{selectedColor}</span></label>
                <div className="mt-2 flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`px-4 py-2.5 text-xs font-medium border transition-colors ${selectedColor === c ? 'bg-jet text-bone border-jet' : 'border-jet/15 hover:border-jet'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size selector */}
            {sizes.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Size: <span className="text-jet">{selectedSize}</span></label>
                  <button onClick={() => setShowSizeGuide(true)} className="text-xs text-slate-400 hover:text-jet flex items-center gap-1">
                    <Ruler size={12} /> Size Guide
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const variant = variants.find((v) => v.size === s && v.color === selectedColor);
                    const inStock = variant && variant.stock > 0;
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        disabled={!inStock}
                        className={`min-w-[3rem] px-3 py-2.5 text-xs font-medium border transition-colors ${
                          selectedSize === s ? 'bg-jet text-bone border-jet' : 'border-jet/15 hover:border-jet'
                        } ${!inStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + Add to bag */}
            {!comingSoon && <div className="mt-8 flex items-center gap-3">
              <div className="flex items-center border border-jet/15">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-3 hover:bg-jet/5" aria-label="Decrease quantity">
                  <Minus size={14} />
                </button>
                <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                <button onClick={() => setQuantity((q) => Math.min(stock, q + 1))} className="px-3 py-3 hover:bg-jet/5" aria-label="Increase quantity">
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAddToBag}
                disabled={soldOut}
                className="btn-primary flex-1"
              >
                {added ? <><Check size={16} /> Added to Bag</> : soldOut ? 'Sold Out' : <><ShoppingBag size={16} /> Add to Bag</>}
              </button>
              <button className="border border-jet/15 p-3.5 hover:bg-jet hover:text-bone transition-colors" aria-label="Add to wishlist">
                <Heart size={18} strokeWidth={1.5} />
              </button>
            </div>}

            {comingSoon && <ComingSoonNotice />}

            {/* Buy now */}
            {!comingSoon && <Link to="/checkout" onClick={handleAddToBag} className="btn-outline w-full mt-3" style={{ display: soldOut ? 'none' : 'flex' }}>
              Buy Now
            </Link>}

            {/* Info sections */}
            <div className="mt-10 space-y-5 border-t border-jet/10 pt-6">
              <InfoRow icon={Truck} title="Delivery" text={product.delivery_info ?? 'Standard UK shipping 2-4 working days. Free shipping on orders over £75.'} />
              <InfoRow icon={RotateCcw} title="Returns" text={product.return_info ?? '30-day returns on unworn items. See our returns policy for details.'} />
              {product.material_care && <InfoRow icon={Check} title="Material & Care" text={product.material_care} />}
            </div>

            {/* Story */}
            {product.story && (
              <div className="mt-8 border-t border-jet/10 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">The Story</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{product.story}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Size guide modal */}
      {showSizeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-jet/60 backdrop-blur-sm" onClick={() => setShowSizeGuide(false)} />
          <div className="relative bg-bone max-w-md w-full p-8 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Size Guide</h2>
            <p className="text-xs text-slate-400 mb-4">Sample measurements — replace with actual garment specs in admin.</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-jet/10"><th className="text-left py-2">Size</th><th className="text-right py-2">Chest (cm)</th><th className="text-right py-2">Length (cm)</th></tr></thead>
              <tbody>
                {[['S', '48', '68'], ['M', '52', '70'], ['L', '54', '72'], ['XL', '58', '74'], ['XXL', '62', '76']].map(([s, c, l]) => (
                  <tr key={s} className="border-b border-jet/5"><td className="py-2 font-medium">{s}</td><td className="text-right py-2">{c}</td><td className="text-right py-2">{l}</td></tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setShowSizeGuide(false)} className="btn-primary w-full mt-6">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoonNotice() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: email.trim(),
      consent_text: 'Subscribed for AB16 product launch announcements',
    });
    if (!error || error.code === '23505') {
      setSubscribed(true);
      setEmail('');
    }
  };

  if (subscribed) return <p className="mt-8 border border-jet/10 p-4 text-sm text-slate-500">You’re on the list for the launch announcement.</p>;

  return (
    <div className="mt-8 border border-jet/10 p-5">
      <p className="text-sm font-semibold">Coming soon</p>
      <p className="mt-1 text-sm text-slate-500">Join the list for launch news. Pricing, sizes, and availability will be announced later.</p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="input-field flex-1" />
        <button type="submit" className="btn-primary whitespace-nowrap">Notify me</button>
      </form>
    </div>
  );
}

function InfoRow({ icon: Icon, title, text }: { icon: Icon; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <Icon size={18} className="text-slate-400 shrink-0 mt-0.5" strokeWidth={1.5} />
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-sm text-slate-500 mt-0.5">{text}</p>
      </div>
    </div>
  );
}
