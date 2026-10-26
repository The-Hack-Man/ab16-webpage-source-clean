import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, SectionCard, Badge, EmptyState, LoadingRows, StatCard } from '@/components/admin/ui';
import {
  deriveFailedPaymentAlerts,
  deriveStuckOrderAlerts,
  deriveMissingMappingAlerts,
  deriveLowStockAlerts,
  deriveStripeEventAlerts,
  derivePrintfulFailureAlerts,
  sortAlerts,
  type AlertItem,
} from '@/lib/adminAlerts';

interface OrderAlertRow {
  id: string;
  order_number: string;
  email: string;
  payment_status: string;
  fulfilment_status: string | null;
  total: number;
  created_at: string;
}

interface VariantAlertRow {
  id: string;
  size: string;
  color: string;
  printful_sync_variant_id: number | null;
  stock: number;
  products: { name: string } | null;
}

interface StripeEventRow {
  stripe_event_id: string;
  status: string;
  last_error: string | null;
}

interface PrintfulOrderRow {
  id: string;
  status: string;
  orders: { order_number: string } | null;
}

export function AdminAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [ordersRes, variantsRes, eventsRes, printfulRes] = await Promise.all([
        supabase.from('orders').select('id, order_number, email, payment_status, fulfilment_status, total, created_at'),
        supabase.from('product_variants').select('id, size, color, printful_sync_variant_id, stock, products(name)'),
        supabase.from('processed_stripe_events').select('stripe_event_id, status, last_error'),
        supabase.from('printful_orders').select('id, status, orders(order_number)'),
      ]);
      const failedQuery = ordersRes.error ?? variantsRes.error ?? eventsRes.error ?? printfulRes.error;
      if (failedQuery) {
        setError('Alert data could not be loaded. Check administrator access and database connectivity.');
        setLoading(false);
        return;
      }

      const orderRows = (ordersRes.data ?? []) as OrderAlertRow[];
      const variantRows = (variantsRes.data ?? []) as VariantAlertRow[];
      const eventRows = (eventsRes.data ?? []) as StripeEventRow[];
      const printfulRows = (printfulRes.data ?? []) as PrintfulOrderRow[];

      const all = [
        ...deriveFailedPaymentAlerts(orderRows),
        ...deriveStuckOrderAlerts(orderRows),
        ...deriveMissingMappingAlerts(
          variantRows.map((v) => ({
            id: v.id,
            product_name: v.products?.name ?? 'Unknown',
            size: v.size,
            color: v.color,
            printful_sync_variant_id: v.printful_sync_variant_id,
            stock: v.stock,
          })),
        ),
        ...deriveLowStockAlerts(
          variantRows.map((v) => ({
            id: v.id,
            product_name: v.products?.name ?? 'Unknown',
            size: v.size,
            color: v.color,
            printful_sync_variant_id: v.printful_sync_variant_id,
            stock: v.stock,
          })),
        ),
        ...deriveStripeEventAlerts(
          eventRows.map((e) => ({
            event_id: e.stripe_event_id,
            event_type: 'event',
            status: e.status,
            error: e.last_error,
          })),
        ),
        ...derivePrintfulFailureAlerts(
          printfulRows.map((p) => ({
            id: p.id,
            order_number: p.orders?.order_number ?? '—',
            status: p.status,
          })),
        ),
      ];

      setAlerts(sortAlerts(all));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4"><LoadingRows count={4} height="h-24" /></div>;
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;

  const critical = alerts.filter((a) => a.severity === 'critical');
  const warning = alerts.filter((a) => a.severity === 'warning');
  const info = alerts.filter((a) => a.severity === 'info');

  return (
    <div>
      <PageHeader title="Alerts Centre" subtitle="Aggregated issues across payments, fulfilment, integrations, and inventory" />

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={AlertTriangle} label="Critical" value={critical.length.toString()} alert={critical.length > 0} />
        <StatCard icon={Bell} label="Warnings" value={warning.length.toString()} alert={warning.length > 0} />
        <StatCard icon={CheckCircle} label="Info" value={info.length.toString()} />
      </div>

      {alerts.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No active alerts" desc="Everything looks healthy. Alerts will appear here when issues are detected across payments, fulfilment, Printful mappings, and Stripe webhooks." />
      ) : (
        <SectionCard title="All Alerts">
          <div className="space-y-2">
            {alerts.map((a) => (
              <Link
                key={a.id}
                to={a.link}
                className="flex items-start gap-3 p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${a.severity === 'critical' ? 'bg-red-500' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-jet">{a.title}</p>
                    <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}>{a.category}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{a.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
