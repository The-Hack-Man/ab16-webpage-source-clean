import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Download, BarChart3, ShoppingBag, PoundSterling } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { PageHeader, SectionCard, EmptyState, LoadingRows, StatCard, FilterSelect } from '@/components/admin/ui';
import { toCsv, downloadCsv, formatDateForCsv, type CsvColumn } from '@/lib/adminCsv';

interface PaidOrder {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

type Period = 'daily' | 'weekly' | 'monthly';

interface RevenuePoint {
  period: string;
  revenue: number;
  orderCount: number;
}

interface ProductPerf {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

export function AdminAnalytics() {
  const [orders, setOrders] = useState<PaidOrder[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('daily');

  useEffect(() => {
    (async () => {
      const ordersRes = await supabase.from('orders').select('id, order_number, total, created_at').eq('payment_status', 'paid').order('created_at', { ascending: true });
      if (ordersRes.error) {
        setError('Paid orders could not be loaded. Check administrator access and database connectivity.');
        setLoading(false);
        return;
      }
      const paidOrders = (ordersRes.data ?? []) as PaidOrder[];
      const orderIds = paidOrders.map((order) => order.id);
      const itemsRes = orderIds.length > 0
        ? await supabase.from('order_items').select('id, order_id, product_name, quantity, price').in('order_id', orderIds)
        : { data: [], error: null };
      if (itemsRes.error) {
        setError('Paid order items could not be loaded. Check administrator access and database connectivity.');
        setLoading(false);
        return;
      }
      setOrders(paidOrders);
      setItems((itemsRes.data ?? []) as OrderItemRow[]);
      setLoading(false);
    })();
  }, []);

  const revenueSeries = useMemo<RevenuePoint[]>(() => {
    const buckets = new Map<string, { revenue: number; orderCount: number }>();
    for (const o of orders) {
      const d = new Date(o.created_at);
      let key: string;
      if (period === 'daily') {
        key = d.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        key = monday.toISOString().split('T')[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      const existing = buckets.get(key) ?? { revenue: 0, orderCount: 0 };
      existing.revenue += o.total;
      existing.orderCount += 1;
      buckets.set(key, existing);
    }
    return Array.from(buckets.entries())
      .map(([p, v]) => ({ period: p, revenue: v.revenue, orderCount: v.orderCount }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [orders, period]);

  const productPerf = useMemo<ProductPerf[]>(() => {
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const item of items) {
      const existing = map.get(item.product_name) ?? { quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      map.set(item.product_name, existing);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ product_name: name, total_quantity: v.quantity, total_revenue: v.revenue }))
      .sort((a, b) => b.total_revenue - a.total_revenue);
  }, [items]);

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const maxRevenue = Math.max(...revenueSeries.map((r) => r.revenue), 1);

  const exportRevenue = () => {
    const cols: CsvColumn<RevenuePoint>[] = [
      { header: 'Period', accessor: (r) => r.period },
      { header: 'Revenue (pence)', accessor: (r) => r.revenue },
      { header: 'Order Count', accessor: (r) => r.orderCount },
    ];
    downloadCsv(`ab16-revenue-${period}-${formatDateForCsv(new Date().toISOString())}.csv`, toCsv(revenueSeries, cols));
  };

  const exportProducts = () => {
    const cols: CsvColumn<ProductPerf>[] = [
      { header: 'Product', accessor: (p) => p.product_name },
      { header: 'Units Sold', accessor: (p) => p.total_quantity },
      { header: 'Revenue (pence)', accessor: (p) => p.total_revenue },
    ];
    downloadCsv(`ab16-product-performance-${formatDateForCsv(new Date().toISOString())}.csv`, toCsv(productPerf, cols));
  };

  if (loading) return <div className="space-y-4"><LoadingRows count={4} height="h-24" /></div>;
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;

  return (
    <div>
      <PageHeader title="Sales Analytics" subtitle="Revenue trends, product performance, and exportable reports" />

      {/* Key metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={PoundSterling} label="Total Revenue (Paid)" value={formatPrice(totalRevenue)} />
        <StatCard icon={ShoppingBag} label="Paid Orders" value={orders.length.toString()} />
        <StatCard icon={TrendingUp} label="Average Order Value" value={formatPrice(aov)} />
        <StatCard icon={BarChart3} label="Products Sold" value={productPerf.length.toString()} />
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No sales data yet" desc="Analytics will populate once customers complete paid checkouts. All figures here are derived from real order data — no sample or demo metrics are shown." />
      ) : (
        <>
          {/* Revenue over time */}
          <SectionCard
            title="Revenue Over Time"
            action={
              <div className="flex items-center gap-3">
                <FilterSelect
                  value={period}
                  onChange={(v) => setPeriod(v as Period)}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                />
                <button onClick={exportRevenue} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                  <Download size={14} /> CSV
                </button>
              </div>
            }
            className="mb-6"
          >
            {revenueSeries.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No revenue data for this period.</p>
            ) : (
              <div className="space-y-2">
                {revenueSeries.map((point) => (
                  <div key={point.period} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-500 shrink-0">{formatDate(point.period)}</div>
                    <div className="flex-1 bg-slate-100 rounded h-7 relative overflow-hidden">
                      <div
                        className="h-full bg-accent rounded transition-all duration-500"
                        style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-3 text-xs">
                        <span className="font-medium text-jet">{formatPrice(point.revenue)}</span>
                        <span className="text-slate-500">{point.orderCount} order{point.orderCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Product performance */}
          <SectionCard
            title="Product Performance"
            action={
              <button onClick={exportProducts} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                <Download size={14} /> CSV
              </button>
            }
          >
            {productPerf.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No product sales recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Product</th>
                      <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Units Sold</th>
                      <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Revenue</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500 w-1/3">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productPerf.map((p) => {
                      const share = totalRevenue > 0 ? (p.total_revenue / totalRevenue) * 100 : 0;
                      return (
                        <tr key={p.product_name} className="border-b border-slate-50">
                          <td className="px-4 py-3 font-medium text-jet">{p.product_name}</td>
                          <td className="px-4 py-3 text-center">{p.total_quantity}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatPrice(p.total_revenue)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded h-2 overflow-hidden">
                                <div className="h-full bg-accent rounded" style={{ width: `${share}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 w-12 text-right">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
