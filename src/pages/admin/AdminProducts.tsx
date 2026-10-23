import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import type { Product } from '@/types';

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data, error } = await supabase.from('products').select('*, product_variants(*)').order('created_at', { ascending: false });
    if (error) {
      setDeleteError(`Failed to load products: ${error.message}`);
    } else {
      setProducts(data as Product[] ?? []);
    }
    setLoading(false);
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setDeleteError(`Failed to delete product: ${error.message}`);
    } else {
      load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} total</p>
        </div>
        <Link to="/admin/products/new" className="btn-primary"><Plus size={16} /> New Product</Link>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-slate-200 pl-11 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:border-jet" />
      </div>

      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-16 bg-white animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded py-16 text-center">
          <Package size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No products yet.</p>
          <Link to="/admin/products/new" className="btn-primary mt-4">Create your first product</Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Name</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Price</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = p.product_variants?.reduce((s, v) => s + v.stock, 0) ?? 0;
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3 text-center">{stock}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/products/${p.id}`} className="inline-flex p-1.5 hover:bg-slate-200 rounded" title="Edit"><Pencil size={14} /></Link>
                      <button onClick={() => deleteProduct(p.id)} className="inline-flex p-1.5 hover:bg-red-100 rounded text-red-500 ml-1" title="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
