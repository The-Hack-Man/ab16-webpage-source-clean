export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  detail: string;
  link: string;
}

export interface OrderAlertInput {
  id: string;
  order_number: string;
  email: string;
  payment_status: string;
  fulfilment_status: string | null;
  total: number;
  created_at: string;
}

export interface VariantAlertInput {
  id: string;
  product_name: string;
  size: string;
  color: string;
  printful_sync_variant_id: number | null;
  stock: number;
}

export interface StripeEventAlertInput {
  event_id: string;
  event_type: string;
  status: string;
  error: string | null;
}

export interface PrintfulOrderAlertInput {
  id: string;
  order_number: string;
  status: string;
}

const STUCK_ORDER_DAYS = 3;

export function deriveFailedPaymentAlerts(orders: OrderAlertInput[]): AlertItem[] {
  return orders
    .filter((o) => o.payment_status === 'failed')
    .map((o) => ({
      id: `failed-pay-${o.id}`,
      severity: 'critical' as const,
      category: 'Payments',
      title: `Failed payment: ${o.order_number}`,
      detail: `Order ${o.order_number} for ${o.email} has a failed payment.`,
      link: `/admin/orders/${o.id}`,
    }));
}

export function deriveStuckOrderAlerts(orders: OrderAlertInput[]): AlertItem[] {
  const cutoff = Date.now() - STUCK_ORDER_DAYS * 24 * 60 * 60 * 1000;
  return orders
    .filter((o) => o.payment_status === 'paid' && o.fulfilment_status === 'unfulfilled' && new Date(o.created_at).getTime() < cutoff)
    .map((o) => ({
      id: `stuck-${o.id}`,
      severity: 'warning' as const,
      category: 'Fulfilment',
      title: `Stuck order: ${o.order_number}`,
      detail: `Order ${o.order_number} has been paid but unfulfilled for over ${STUCK_ORDER_DAYS} days.`,
      link: `/admin/orders/${o.id}`,
    }));
}

export function deriveMissingMappingAlerts(variants: VariantAlertInput[]): AlertItem[] {
  return variants
    .filter((v) => v.printful_sync_variant_id === null)
    .map((v) => ({
      id: `unmapped-${v.id}`,
      severity: 'warning' as const,
      category: 'Printful',
      title: `Missing Printful mapping: ${v.product_name}`,
      detail: `Variant ${v.color} ${v.size} for "${v.product_name}" has no Printful sync variant ID. Checkout will fail for this item.`,
      link: '/admin/printful',
    }));
}

export function deriveLowStockAlerts(variants: VariantAlertInput[], threshold = 5): AlertItem[] {
  return variants
    .filter((v) => v.stock < threshold)
    .map((v) => ({
      id: `lowstock-${v.id}`,
      severity: 'info' as const,
      category: 'Inventory',
      title: `Low stock: ${v.product_name} (${v.color} ${v.size})`,
      detail: `Only ${v.stock} units remaining.`,
      link: '/admin/inventory',
    }));
}

export function deriveStripeEventAlerts(events: StripeEventAlertInput[]): AlertItem[] {
  return events
    .filter((e) => e.status === 'failed')
    .map((e) => ({
      id: `stripe-evt-${e.event_id}`,
      severity: 'critical' as const,
      category: 'Stripe',
      title: `Failed webhook event: ${e.event_type}`,
      detail: e.error ?? `Event ${e.event_id} failed processing.`,
      link: '/admin/stripe',
    }));
}

export function derivePrintfulFailureAlerts(orders: PrintfulOrderAlertInput[]): AlertItem[] {
  return orders
    .filter((o) => o.status === 'failed' || o.status === 'cancelled')
    .map((o) => ({
      id: `printful-${o.id}`,
      severity: 'critical' as const,
      category: 'Printful',
      title: `Printful ${o.status}: ${o.order_number}`,
      detail: `Printful order ${o.order_number} has status "${o.status}".`,
      link: '/admin/printful',
    }));
}

export function severityRank(s: AlertItem['severity']): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : 2;
}

export function sortAlerts(alerts: AlertItem[]): AlertItem[] {
  return [...alerts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
