import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/types';
import { formatPrice, storeImageUrl } from '@/lib/format';

export function ProductCard({ product }: { product: Product }) {
  const image = storeImageUrl(product.product_images?.[0]?.url);
  const secondImage = storeImageUrl(product.product_images?.[1]?.url);
  const totalStock = product.product_variants?.reduce((sum, v) => sum + (
    v.printful_sync_variant_id && (v.printful_availability_status == null || v.printful_availability_status === 'active') ? 1 : v.stock
  ), 0) ?? 0;
  const unavailable = product.available_for_sale === false;
  const soldOut = !unavailable && totalStock === 0;

  return (
    <Link to={`/shop/${product.slug}`} className="group block animate-rise-in" style={{ animationDelay: `${(product.id.charCodeAt(0) % 4) * 100}ms` }}>
      <div className="relative aspect-[4/5] bg-[#e8e2d7] overflow-hidden editorial-panel transition-all duration-500 ease-out-expo group-hover:shadow-xl group-hover:shadow-accent/20">
        {image ? (
          <>
            <img
              src={image}
              alt={product.product_images?.[0]?.alt_text ?? product.name}
              className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]"
              loading="lazy"
            />
            {secondImage && (
              <img
                src={secondImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out-expo"
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
            <span className="text-xs uppercase tracking-widest">No image</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.is_new_arrival && (
            <span className="badge bg-accent animate-pulse-glow text-white relative overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer" />
              New Drop
            </span>
          )}
          {product.is_limited_drop && <span className="badge-limited">Limited</span>}
          {product.compare_at_price && <span className="badge-sale">Sale</span>}
          {unavailable && <span className="badge bg-jet text-bone">Preview only</span>}
          {soldOut && <span className="badge-soldout">Sold Out</span>}
        </div>

        {/* Quick view overlay */}
        <div className="absolute inset-0 bg-jet/0 group-hover:bg-jet/30 transition-colors duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-14 h-14 rounded-full bg-bone/90 flex items-center justify-center transition-all duration-500 scale-90 group-hover:scale-100">
            <ArrowRight size={20} className="text-jet ml-0.5" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-jet leading-snug group-hover:underline underline-offset-2">
            {product.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 uppercase tracking-wider">
            {product.category_slug ?? 'Apparel'}
          </p>
        </div>
        <div className="text-right shrink-0">
          {product.compare_at_price ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-red-600">{formatPrice(product.price)}</span>
              <span className="text-xs text-slate-400 line-through">{formatPrice(product.compare_at_price)}</span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-jet">{formatPrice(product.price)}</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
        <span>View Product</span>
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
