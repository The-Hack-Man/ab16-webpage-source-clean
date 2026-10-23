import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface InventoryRow {
  id: string;
  size: string;
  color: string;
  stock: number;
  sku: string | null;
  products: { name: string; slug: string } | null;
}

export function AdminInventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('product_variants')
        .select('id, size, color, stock, sku, products(name, slug)')
        .order('stock', { ascending: true });
      setRows((data ?? []) as InventoryRow[]);
      setLoading(false);
    })();
  }, []);

  const updateStock = async (id: string, stock: number) => {
    await supabase.from('product_variants').update({ stock }).eq('id', id);
    setRows(rows.map((r) => r.id === id ? { ...r, stock } : r));
  };

  if (loading) return <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-12 bg-white animate-pulse rounded" />)}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Inventory</h1>
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Product</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Variant</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">SKU</th>
              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{r.products?.name ?? '—'}</td>
                <td className="px-4 py-3">{r.color} · {r.size}</td>
                <td className="px-4 py-3 text-slate-500">{r.sku ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <input type="number" value={r.stock} onChange={(e) => updateStock(r.id, parseInt(e.target.value || '0'))}
                    className={`w-20 text-center border px-2 py-1 ${r.stock < 5 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
