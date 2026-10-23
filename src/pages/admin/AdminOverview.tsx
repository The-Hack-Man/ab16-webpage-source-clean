import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Music, Users, Mail, Tag, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import type { Icon } from '@/types';

interface OverviewOrder {
  total: number;
  payment_status: string;
  fulfilment_status: string;
  email: string;
}

interface OverviewRelease {
  id: string;
  status: string;
  release_date: string | null;
}

export function AdminOverview() {
  const [stats, setStats] = useState({
    orders: 0, revenue: 0, pendingOrders: 0, products: 0, lowStock: 0,
    customers: 0, subscribers: 0, releases: 0, upcomingReleases: 0, enquiries: 0, campaigns: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [orders, products, variants, subs, releases, enquiries, campaigns] = await Promise.all([
        supabase.from('orders').select('total, payment_status, fulfilment_status, email'),
        supabase.from('products').select('id, status', { count: 'exact' }),
        supabase.from('product_variants').select('stock').lt('stock', 5),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact' }).is('unsubscribed_at', null),
        supabase.from('music_releases').select('id, status, release_date'),
        supabase.from('contact_enquiries').select('id', { count: 'exact' }).eq('handled', false),
        supabase.from('campaigns').select('id', { count: 'exact' }).in('status', ['live', 'scheduled']),
      ]);

      const paidOrders = orders.data?.filter((o: OverviewOrder) => o.payment_status === 'paid') ?? [];
      const pending = orders.data?.filter((o: OverviewOrder) => o.fulfilment_status === 'unfulfilled' && o.payment_status === 'paid') ?? [];
      const uniqueEmails = new Set(orders.data?.map((o: OverviewOrder) => o.email) ?? []);
      const upcoming = releases.data?.filter((r: OverviewRelease) => r.status === 'upcoming' || r.status === 'scheduled') ?? [];

      setStats({
        orders: orders.data?.length ?? 0,
        revenue: paidOrders.reduce((sum: number, o: OverviewOrder) => sum + o.total, 0),
        pendingOrders: pending.length,
        products: products.data?.filter((p: { status: string }) => p.status === 'published').length ?? 0,
        lowStock: variants.data?.length ?? 0,
        customers: uniqueEmails.size,
        subscribers: subs.count ?? 0,
        releases: releases.data?.filter((r: OverviewRelease) => r.status === 'published').length ?? 0,
        upcomingReleases: upcoming.length,
        enquiries: enquiries.count ?? 0,
        campaigns: campaigns.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4">{[0,1,2].map((i) => <div key={i} className="h-24 bg-white animate-pulse rounded" />)}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>

      {/* Key metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.orders.toString()} link="/admin/orders" />
        <StatCard icon={TrendingUp} label="Revenue (Paid)" value={formatPrice(stats.revenue)} />
        <StatCard icon={Package} label="Outstanding" value={stats.pendingOrders.toString()} link="/admin/orders" alert={stats.pendingOrders > 0} />
        <StatCard icon={AlertCircle} label="Low Stock Items" value={stats.lowStock.toString()} link="/admin/inventory" alert={stats.lowStock > 0} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Package} label="Published Products" value={stats.products.toString()} link="/admin/products" />
        <StatCard icon={Users} label="Unique Customers" value={stats.customers.toString()} />
        <StatCard icon={Mail} label="Subscribers" value={stats.subscribers.toString()} link="/admin/newsletter" />
        <StatCard icon={Tag} label="Active Campaigns" value={stats.campaigns.toString()} link="/admin/campaigns" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Music} label="Published Releases" value={stats.releases.toString()} link="/admin/releases" />
        <StatCard icon={Music} label="Upcoming Releases" value={stats.upcomingReleases.toString()} link="/admin/releases" />
        <StatCard icon={Mail} label="Unhandled Enquiries" value={stats.enquiries.toString()} link="/admin/enquiries" alert={stats.enquiries > 0} />
      </div>

      {/* Getting started */}
      <div className="bg-white border border-slate-200 rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Getting Started</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <GettingStartedLink to="/admin/products/new" label="Add your first product" desc="Create products with variants, images, and pricing" />
          <GettingStartedLink to="/admin/releases/new" label="Add a music release" desc="Upload artwork, tracklists, and streaming links" />
          <GettingStartedLink to="/admin/settings" label="Configure settings" desc="Set business name, contact email, social links" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, link, alert }: { icon: Icon; label: string; value: string; link?: string; alert?: boolean }) {
  const content = (
    <div className={`bg-white border rounded p-5 ${alert ? 'border-amber-300' : 'border-slate-200'} hover:border-slate-300 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={20} className={alert ? 'text-amber-500' : 'text-slate-400'} strokeWidth={1.5} />
        {alert && <span className="w-2 h-2 rounded-full bg-amber-500" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function GettingStartedLink({ to, label, desc }: { to: string; label: string; desc: string }) {
  return (
    <Link to={to} className="group border border-slate-200 rounded p-4 hover:bg-slate-50 transition-colors">
      <h3 className="text-sm font-semibold group-hover:text-accent">{label}</h3>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </Link>
  );
}
