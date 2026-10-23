import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, MusicRelease } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { ReleaseCard } from '@/components/ReleaseCard';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [products, setProducts] = useState<Product[]>([]);
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'music'>('products');

  useEffect(() => {
    if (!query.trim()) return;
    setLoading(true);
    (async () => {
      const [prodRes, relRes] = await Promise.all([
        supabase.from('products').select('*, product_images(*), product_variants(*)').eq('status', 'published').ilike('name', `%${query}%`),
        supabase.from('music_releases').select('*').in('status', ['published', 'upcoming']).ilike('title', `%${query}%`),
      ]);
      setProducts(prodRes.data as Product[] ?? []);
      setReleases(relRes.data as MusicRelease[] ?? []);
      setLoading(false);
    })();
  }, [query]);

  const hasResults = products.length > 0 || releases.length > 0;

  return (
    <div className="bg-bone min-h-screen">
      <div className="border-b border-jet/10">
        <div className="container-base py-12">
          <h1 className="text-display-lg">Search</h1>
          <p className="mt-2 text-slate-500">Results for "{query}"</p>
        </div>
      </div>

      <div className="container-base py-10">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0,1,2,3].map((i) => <div key={i} className="aspect-[4/5] bg-slate-100 animate-pulse" />)}</div>
        ) : !query.trim() ? (
          <div className="text-center py-20">
            <SearchIcon size={32} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-400">Type something in the search bar above.</p>
          </div>
        ) : !hasResults ? (
          <div className="text-center py-20">
            <SearchIcon size={32} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold">No results found</h3>
            <p className="mt-2 text-sm text-slate-400">Try different keywords or browse the shop.</p>
            <Link to="/shop" className="btn-outline mt-6">Browse Shop</Link>
          </div>
        ) : (
          <>
            {(products.length > 0 && releases.length > 0) && (
              <div className="flex gap-2 mb-8">
                <button onClick={() => setActiveTab('products')} className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider border ${activeTab === 'products' ? 'bg-jet text-bone border-jet' : 'border-jet/15'}`}>
                  Products ({products.length})
                </button>
                <button onClick={() => setActiveTab('music')} className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider border ${activeTab === 'music' ? 'bg-jet text-bone border-jet' : 'border-jet/15'}`}>
                  Music ({releases.length})
                </button>
              </div>
            )}

            {activeTab === 'products' && products.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}

            {activeTab === 'music' && releases.length > 0 && (
              <div className="bg-jet text-bone p-6 lg:p-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  {releases.map((r) => <ReleaseCard key={r.id} release={r} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
