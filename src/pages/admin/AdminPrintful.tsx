import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, AlertTriangle, Package, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/format';
import { PageHeader, SectionCard, Badge, EmptyState, LoadingRows, StatCard } from '@/components/admin/ui';

interface VariantMapping {
  id: string;
  size: string;
  color: string;
  sku: string | null;
  stock: number;
  printful_sync_variant_id: number | null;
  products: { name: string; status: string } | null;
}

interface PrintfulOrderRow {
  id: string;
  printful_order_id: number | null;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  orders: { id: string; order_number: string; total: number; payment_status: string } | null;
}

interface OrderAwaiting {
  id: string;
  order_number: string;
  email: string;
  total: number;
  created_at: string;
  printful_orders: { status: string }[] | null;
}

export function AdminPrintful() {
  const [variants, setVariants] = useState<VariantMapping[]>([]);
  const [printfulOrders, setPrintfulOrders] = useState<PrintfulOrderRow[]>([]);
  const [awaiting, setAwaiting] = useState<OrderAwaiting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [variantsRes, printfulRes, awaitingRes] = await Promise.all([
        supabase.from('product_variants').select('id, size, color, sku, stock, printful_sync_variant_id, products(name, status)').order('printful_sync_variant_id', { ascending: false, nullsFirst: false }),
        supabase.from('printful_orders').select('id, printful_order_id, status, tracking_number, tracking_url, created_at, orders(id, order_number, total, payment_status)').order('created_at', { ascending: false }),
        supabase.from('orders').select('id, order_number, email, total, created_at, printful_orders(status)').eq('payment_status', 'paid').order('created_at', { ascending: false }),
      ]);
      const failedQuery = variantsRes.error ?? printfulRes.error ?? awaitingRes.error;
      if (failedQuery) {
        setError('Printful monitoring data could not be loaded. Check administrator access and database connectivity.');
        setLoading(false);
        return;
      }
      setVariants((variantsRes.data ?? []) as VariantMapping[]);
      setPrintfulOrders((printfulRes.data ?? []) as PrintfulOrderRow[]);
      const paidOrders = (awaitingRes.data ?? []) as OrderAwaiting[];
      setAwaiting(paidOrders.filter((o) => {
        const po = Array.isArray(o.printful_orders) ? o.printful_orders[0] : o.printful_orders;
        return !po || po.status === 'pending' || po.status === 'draft';
      }));
      setLoading(false);
    })();
  }, [reloadKey]);

  const syncCatalog = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{
        success?: boolean;
        productsSeen?: number;
        productsImported?: number;
        productsLinked?: number;
        variantsLinked?: number;
        webhook?: { configured?: boolean; reason?: string };
        error?: string;
      }>('sync-printful-catalog', { body: {} });
      if (invokeError) throw new Error(data?.error || invokeError.message);
      if (!data?.success) throw new Error(data?.error || 'Printful catalog sync did not complete.');
      const webhookNote = data.webhook?.configured
        ? 'Automatic product updates are enabled.'
        : data.webhook?.reason || 'Automatic product updates were not enabled.';
      setSyncMessage(`Synced ${data.productsSeen ?? 0} Printful products: ${data.productsImported ?? 0} imported, ${data.productsLinked ?? 0} existing products linked, ${data.variantsLinked ?? 0} variants reconciled. ${webhookNote}`);
      setReloadKey((value) => value + 1);
    } catch (syncFailure) {
      setSyncError(syncFailure instanceof Error ? syncFailure.message : 'Printful catalog sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="space-y-4"><LoadingRows count={4} height="h-24" /></div>;
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;

  const unmapped = variants.filter((v) => v.printful_sync_variant_id === null && v.products?.status === 'published');
  const unsyncedDrafts = variants.filter((v) => v.printful_sync_variant_id === null && v.products?.status === 'draft');
  const failedOrders = printfulOrders.filter((o) => o.status === 'failed' || o.status === 'cancelled');

  return (
    <div>
      <PageHeader title="Printful Monitoring" subtitle="Fulfilment status, mapping gaps, and order submission tracking" />

      <SectionCard title="Printful catalog source of truth" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-sm text-slate-600">Products and variants are matched by Printful’s permanent sync IDs. Sync once now; the product update webhook will keep later Printful additions and changes reconciled automatically.</p>
          <button type="button" onClick={() => void syncCatalog()} disabled={syncing} className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-jet px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"><RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing catalog…' : 'Sync catalog now'}</button>
        </div>
        {syncMessage && <p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">{syncMessage}</p>}
        {syncError && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{syncError}</p>}
        {unsyncedDrafts.length > 0 && <p className="mt-3 text-xs text-slate-500">{unsyncedDrafts.length} legacy draft variant{unsyncedDrafts.length === 1 ? '' : 's'} have no provider ID. They stay unavailable; new Printful variants are linked automatically by their provider IDs.</p>}
      </SectionCard>

      {/* Summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={AlertTriangle} label="Unmapped published variants" value={unmapped.length.toString()} link="/admin/printful" alert={unmapped.length > 0} />
        <StatCard icon={Clock} label="Awaiting Submission" value={awaiting.length.toString()} alert={awaiting.length > 0} />
        <StatCard icon={Truck} label="Printful Orders" value={printfulOrders.length.toString()} />
        <StatCard icon={AlertTriangle} label="Failed/Cancelled" value={failedOrders.length.toString()} alert={failedOrders.length > 0} />
      </div>

      {/* Missing mappings */}
      <SectionCard title="Missing Printful Mappings" className="mb-6">
        {unmapped.length === 0 ? (
          <EmptyState icon={Package} title="All variants mapped" desc="Every product variant has a Printful sync variant ID." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Variant</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">SKU</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {unmapped.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-jet">{v.products?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{v.color} · {v.size}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{v.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-center">{v.stock}</td>
                    <td className="px-4 py-3 text-center"><button type="button" onClick={() => void syncCatalog()} className="text-xs text-accent hover:underline">Sync Printful</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Awaiting submission */}
      <SectionCard title="Orders Awaiting Printful Submission" className="mb-6">
        {awaiting.length === 0 ? (
          <EmptyState icon={Clock} title="No orders awaiting submission" desc="Paid orders will appear here until Printful accepts them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Date</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Total</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Printful</th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50">
                    <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-mono text-xs text-accent hover:underline">{o.order_number}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{o.email}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3 text-center">{o.printful_orders && o.printful_orders.length > 0 ? <Badge tone="warning">{o.printful_orders[0].status}</Badge> : <Badge tone="danger">Not submitted</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Printful orders */}
      <SectionCard title="Printful Orders">
        {printfulOrders.length === 0 ? (
          <EmptyState icon={Truck} title="No Printful orders yet" desc="Orders submitted to Printful will appear here with tracking details." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Store Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Printful ID</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Tracking</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {printfulOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50">
                    <td className="px-4 py-3">{o.orders?.id ? <Link to={`/admin/orders/${o.orders.id}`} className="font-mono text-xs text-accent hover:underline">{o.orders.order_number}</Link> : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.printful_order_id ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><Badge tone={o.status === 'shipped' || o.status === 'fulfilled' ? 'success' : o.status === 'failed' || o.status === 'cancelled' ? 'danger' : 'info'}>{o.status}</Badge></td>
                    <td className="px-4 py-3 text-xs">{o.tracking_number ? (o.tracking_url ? <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{o.tracking_number}</a> : <span className="font-mono">{o.tracking_number}</span>) : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
