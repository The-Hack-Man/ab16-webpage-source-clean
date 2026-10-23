import { useEffect, useState } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import type { Order } from '@/types';

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      setOrders(data as unknown as Order[] ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Orders</h1>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search by order number or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-slate-200 pl-11 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:border-jet" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 px-4 py-2.5 text-sm bg-white cursor-pointer focus:outline-none focus:border-jet">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-16 bg-white animate-pulse rounded" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded py-16 text-center">
          <ShoppingBag size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No orders yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Order</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Total</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Payment</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Fulfilment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{o.order_number}</td>
                  <td className="px-4 py-3">{o.email}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(o.total)}</td>
                  <td className="px-4 py-3 text-center"><span className={`badge ${o.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{o.payment_status}</span></td>
                  <td className="px-4 py-3 text-center"><span className="badge bg-slate-100 text-slate-600">{o.fulfilment_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
