import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { ProductCard } from '@/components/ProductCard';

const CATEGORIES = ['t-shirts', 'hoodies', 'tracksuits', 'jackets', 'trousers', 'accessories'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Black', 'White', 'Grey', 'Navy', 'Cream'];

export function ShopPage({ filter }: { filter?: 'new' | 'collection' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCategories = useMemo(() => searchParams.get('category')?.split(',').filter(Boolean) ?? [], [searchParams]);
  const selectedSizes = useMemo(() => searchParams.get('size')?.split(',').filter(Boolean) ?? [], [searchParams]);
  const selectedColors = useMemo(() => searchParams.get('color')?.split(',').filter(Boolean) ?? [], [searchParams]);
  const sort = searchParams.get('sort') ?? 'newest';
  const maxPrice = searchParams.get('maxPrice');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      let query = supabase.from('products').select('*, product_images(*), product_variants(*)').eq('status', 'published');
      if (filter === 'new') query = query.eq('is_new_arrival', true);
      if (filter === 'collection') query = query.not('collection_slug', 'is', null);
      const parsedMaxPrice = maxPrice ? Number(maxPrice) : NaN;
      if (Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0) query = query.lte('price', parsedMaxPrice);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (!active) return;
      if (error) {
        setLoadError('The catalogue could not be loaded. Please try again.');
        console.error('Could not load product catalogue:', error.message);
        setProducts([]);
      } else {
        setProducts(data as Product[] ?? []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [filter, maxPrice, refreshKey]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') setRefreshKey((key) => key + 1);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const filtered = useMemo(() => {
    let result = products;
    if (selectedCategories.length) result = result.filter((p) => p.category_slug && selectedCategories.includes(p.category_slug));
    if (selectedSizes.length) result = result.filter((p) => p.product_variants?.some((v) => selectedSizes.includes(v.size)));
    if (selectedColors.length) result = result.filter((p) => p.product_variants?.some((v) => selectedColors.includes(v.color)));
    if (sort === 'price-high') result = [...result].sort((a, b) => b.price - a.price);
    if (sort === 'price-low') result = [...result].sort((a, b) => a.price - b.price);
    return result;
  }, [products, selectedCategories, selectedSizes, selectedColors, sort]);

  const toggleParam = (key: string, value: string) => {
    const current = searchParams.get(key)?.split(',').filter(Boolean) ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const nextParams = new URLSearchParams(searchParams);
    if (next.length) nextParams.set(key, next.join(',')); else nextParams.delete(key);
    setSearchParams(nextParams);
  };

  const title = filter === 'new' ? 'New Arrivals' : filter === 'collection' ? 'Collections' : 'Shop All';

  return (
    <div className="bg-bone min-h-screen">
      {/* Page header */}
      <div className="border-b border-jet/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label mb-3">AB16 Clothing</p>
          <h1 className="text-display-lg">{title}</h1>
          <p className="mt-3 text-sm text-slate-400">
            {loading
              ? 'Loading catalogue'
              : loadError
                ? 'Catalogue unavailable'
                : `${filtered.length} ${filtered.length === 1 ? 'piece' : 'pieces'}`}
            {' · Independent Aberdeen streetwear'}
          </p>
        </div>
      </div>

      <div className="container-base py-8 lg:py-12">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8 sticky top-16 lg:top-20 bg-bone/95 backdrop-blur-sm py-3 z-30">
          <button
            className="flex items-center gap-2 text-sm font-medium border border-jet/15 px-4 py-2.5 hover:bg-jet hover:text-bone transition-colors"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-controls="mobile-filter-drawer"
          >
            <SlidersHorizontal size={16} strokeWidth={1.5} />
            Filters
            {(selectedCategories.length + selectedSizes.length + selectedColors.length) > 0 && (
              <span className="bg-accent text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {selectedCategories.length + selectedSizes.length + selectedColors.length}
              </span>
            )}
          </button>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                next.set('sort', e.target.value);
                setSearchParams(next);
              }}
              className="appearance-none border border-jet/15 pl-4 pr-10 py-2.5 text-sm font-medium bg-transparent cursor-pointer focus:outline-none focus:border-jet"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar filters */}
          {showFilters && (
            <aside className="hidden lg:block w-60 shrink-0">
              <FilterPanel
                categories={CATEGORIES}
                sizes={SIZES}
                colors={COLORS}
                selectedCategories={selectedCategories}
                selectedSizes={selectedSizes}
                selectedColors={selectedColors}
                onToggle={toggleParam}
                onClear={() => setSearchParams(new URLSearchParams())}
              />
            </aside>
          )}

          {/* Product grid */}
          <div className="flex-1">
            {loadError && <div className="mb-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{loadError}<button className="ml-3 font-semibold underline" onClick={() => window.location.reload()}>Reload</button></div>}
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="aspect-[4/5] bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : loadError ? null : filtered.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <div className="border border-jet/10 py-20 text-center">
                <h3 className="text-lg font-semibold">No products found</h3>
                <p className="mt-2 text-sm text-slate-400">Try adjusting your filters or check back soon.</p>
                <button onClick={() => setSearchParams(new URLSearchParams())} className="btn-outline mt-6">Clear filters</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-jet/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div id="mobile-filter-drawer" role="dialog" aria-modal="true" aria-label="Product filters" className="absolute right-0 top-0 h-full w-[88%] max-w-sm bg-bone overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button onClick={() => setShowFilters(false)}><X size={22} /></button>
            </div>
            <FilterPanel
              categories={CATEGORIES}
              sizes={SIZES}
              colors={COLORS}
              selectedCategories={selectedCategories}
              selectedSizes={selectedSizes}
              selectedColors={selectedColors}
              onToggle={toggleParam}
              onClear={() => setSearchParams(new URLSearchParams())}
            />
            <button onClick={() => setShowFilters(false)} className="btn-primary w-full mt-8">Show {filtered.length} results</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  categories, sizes, colors, selectedCategories, selectedSizes, selectedColors, onToggle, onClear,
}: {
  categories: string[];
  sizes: string[];
  colors: string[];
  selectedCategories: string[];
  selectedSizes: string[];
  selectedColors: string[];
  onToggle: (key: string, value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Filter By</h3>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-jet underline">Clear all</button>
      </div>

      <FilterGroup title="Category">
        {categories.map((c) => (
          <FilterCheckbox key={c} label={c.replace('-', ' ')} checked={selectedCategories.includes(c)} onChange={() => onToggle('category', c)} />
        ))}
      </FilterGroup>

      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => onToggle('size', s)}
              className={`px-3 py-2 text-xs font-medium border transition-colors ${
                selectedSizes.includes(s) ? 'bg-jet text-bone border-jet' : 'border-jet/15 hover:border-jet'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Colour">
        {colors.map((c) => (
          <FilterCheckbox key={c} label={c} checked={selectedColors.includes(c)} onChange={() => onToggle('color', c)} />
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <span className={`w-4 h-4 border flex items-center justify-center transition-colors ${checked ? 'bg-jet border-jet' : 'border-jet/20 group-hover:border-jet/40'}`}>
        {checked && <span className="w-2 h-2 bg-bone" />}
      </span>
      <span className="text-sm capitalize text-jet/80 group-hover:text-jet">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
    </label>
  );
}
