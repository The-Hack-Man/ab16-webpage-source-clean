import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Mail, Truck, CreditCard, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { Badge, LoadingRows, EmptyState } from '@/components/admin/ui';

interface OrderDetail {
  id: string;
  order_number: string;
  email: string;
  total: number;
  subtotal: number;
  shipping_charge: number;
  discount_amount: number;
  discount_code: string | null;
  payment_status: string;
  fulfilment_status: string | null;
  tracking_reference: string | null;
  payment_intent_id: string | null;
  shipping_address: {
    firstName: string; lastName: string; address1: string; address2: string | null;
    city: string; postcode: string; country: string; phone?: string;
  } | null;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  product_name: string;
  variant_size: string | null;
  variant_color: string | null;
  quantity: number;
  price: number;
}

interface PrintfulOrderRow {
  id: string;
  printful_order_id: number | null;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
}

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [printful, setPrintful] = useState<PrintfulOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [orderRes, itemsRes, printfulRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).maybeSingle(),
        supabase.from('order_items').select('*').eq('order_id', id).order('product_name'),
        supabase.from('printful_orders').select('*').eq('order_id', id).maybeSingle(),
      ]);
      const failedQuery = orderRes.error ?? itemsRes.error ?? printfulRes.error;
      if (failedQuery) {
        setError('Order details could not be loaded. Check administrator access and database connectivity.');
        setLoading(false);
        return;
      }
      if (orderRes.data) setOrder(orderRes.data as OrderDetail);
      setItems((itemsRes.data ?? []) as OrderItemRow[]);
      if (printfulRes.data) setPrintful(printfulRes.data as PrintfulOrderRow);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingRows count={4} height="h-24" />;
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
  if (!order) return <EmptyState icon={Package} title="Order not found" action={<Link to="/admin/orders" className="btn-outline">Back to Orders</Link>} />;

  return (
    <div>
      <Link to="/admin/orders" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-jet mb-4"><ArrowLeft size={16} /> Back to Orders</Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-jet font-mono">{order.order_number}</h1>
          <p className="text-sm text-slate-500 mt-1">{formatDate(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={order.payment_status === 'paid' ? 'success' : order.payment_status === 'failed' ? 'danger' : 'warning'}>{order.payment_status}</Badge>
          <Badge tone={order.fulfilment_status === 'shipped' ? 'success' : order.fulfilment_status === 'cancelled' ? 'danger' : 'neutral'}>{order.fulfilment_status ?? 'pending'}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        <div className="space-y-6">
          {/* Line items */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h2 className="text-sm font-semibold text-jet">Line Items</h2></div>
            {items.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">No items recorded for this order.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Product</th>
                    <th className="text-center px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Qty</th>
                    <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Price</th>
                    <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-jet">{item.product_name}</p>
                        <p className="text-xs text-slate-400">{item.variant_color} {item.variant_size}</p>
                      </td>
                      <td className="px-5 py-3 text-center">{item.quantity}</td>
                      <td className="px-5 py-3 text-right">{formatPrice(item.price)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatPrice(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-100">
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-right text-xs text-slate-500">Subtotal</td>
                    <td className="px-5 py-3 text-right text-sm">{formatPrice(order.subtotal)}</td>
                  </tr>
                  {order.discount_amount > 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-2 text-right text-xs text-slate-500">Discount ({order.discount_code})</td>
                      <td className="px-5 py-2 text-right text-sm text-red-600">-{formatPrice(order.discount_amount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="px-5 py-2 text-right text-xs text-slate-500">Shipping</td>
                    <td className="px-5 py-2 text-right text-sm">{formatPrice(order.shipping_charge)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-right text-sm font-semibold text-jet">Total</td>
                    <td className="px-5 py-3 text-right text-base font-bold text-jet">{formatPrice(order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Printful fulfilment */}
          {printful && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-jet mb-4">Printful Fulfilment</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <DetailRow label="Printful Order ID" value={printful.printful_order_id?.toString() ?? '—'} />
                <DetailRow label="Status" value={<Badge tone={printful.status === 'fulfilled' || printful.status === 'shipped' ? 'success' : printful.status === 'failed' || printful.status === 'cancelled' ? 'danger' : 'neutral'}>{printful.status}</Badge>} />
                <DetailRow label="Tracking Number" value={printful.tracking_number ?? '—'} />
                <DetailRow label="Tracking URL" value={printful.tracking_url ? <a href={printful.tracking_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Track package</a> : '—'} />
              </div>
            </div>
          )}

          {/* Tracking reference from order */}
          {order.tracking_reference && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-jet mb-4 flex items-center gap-2"><Truck size={16} /> Tracking</h2>
              <p className="text-sm text-slate-600">Reference: <span className="font-mono font-medium text-jet">{order.tracking_reference}</span></p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-jet mb-4 flex items-center gap-2"><CreditCard size={16} /> Payment</h2>
            <div className="space-y-3 text-sm">
              <DetailRow label="Status" value={<Badge tone={order.payment_status === 'paid' ? 'success' : order.payment_status === 'failed' ? 'danger' : 'warning'}>{order.payment_status}</Badge>} />
              <DetailRow label="Payment Intent" value={order.payment_intent_id ? <span className="font-mono text-xs">{order.payment_intent_id.slice(0, 20)}...</span> : '—'} />
              <DetailRow label="Total" value={<span className="font-semibold">{formatPrice(order.total)}</span>} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-jet mb-4 flex items-center gap-2"><Mail size={16} /> Customer</h2>
            <p className="text-sm text-slate-600">{order.email}</p>
          </div>

          {order.shipping_address && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-jet mb-4 flex items-center gap-2"><MapPin size={16} /> Shipping Address</h2>
              <div className="text-sm text-slate-600 space-y-0.5">
                <p>{order.shipping_address.firstName} {order.shipping_address.lastName}</p>
                <p>{order.shipping_address.address1}</p>
                {order.shipping_address.address2 && <p>{order.shipping_address.address2}</p>}
                <p>{order.shipping_address.city} {order.shipping_address.postcode}</p>
                <p>{order.shipping_address.country}</p>
                {order.shipping_address.phone && <p className="text-slate-400 mt-2">{order.shipping_address.phone}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <div className="text-sm text-jet">{value}</div>
    </div>
  );
}
