import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Cloud, Globe2, Package, Play, RefreshCw, ShieldCheck, ShoppingBag, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageHeader, SectionCard } from '@/components/admin/ui';

type Run = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  result: { publishedProducts?: number; saleableProducts?: number; orders?: number; pendingJobs?: number; pendingOutboxEvents?: number; checkedAt?: string } | null;
};

const operations = [
  { title: 'Products & images', description: 'Add products, upload images, manage variants and availability.', href: '/admin/products', icon: Package },
  { title: 'Product upload guide', description: 'Follow the repeatable photo, SKU and Printful mapping workflow.', href: '/admin/uploads', icon: Package },
  { title: 'Website content', description: 'Manage releases, videos, news, events, campaigns and site settings.', href: '/admin/content', icon: Globe2 },
  { title: 'Orders & fulfilment', description: 'Review paid orders and provider fulfilment status.', href: '/admin/orders', icon: ShoppingBag },
  { title: 'Workforce & queues', description: 'Inspect jobs, outbox events and worker readiness.', href: '/admin/workforce', icon: Workflow },
  { title: 'Alerts & analytics', description: 'Review current store signals and operational reports.', href: '/admin/alerts', icon: Activity },
];

const providers = [
  { name: 'DNSExit', purpose: 'Domain DNS records', href: 'https://www.dnsexit.com/' },
  { name: 'InfinityFree', purpose: 'Website hosting and file manager', href: 'https://dash.infinityfree.com/' },
  { name: 'Hosting file manager', purpose: 'Upload and extract website files', href: 'https://filemanager.ai/new3/index.php?home=%2Fhtdocs' },
  { name: 'Supabase production', purpose: 'Live database, storage and Edge Functions', href: 'https://supabase.com/dashboard/project/fleoxzauuvfbdysvadev' },
  { name: 'Supabase staging', purpose: 'Test database and storage', href: 'https://supabase.com/dashboard/project/kmwdsrzdewnlkbmiagzo' },
  { name: 'Stripe', purpose: 'Payments and test mode', href: 'https://dashboard.stripe.com/' },
  { name: 'Printful', purpose: 'Products and fulfilment', href: 'https://www.printful.com/dashboard' },
  { name: 'Website source', purpose: 'Code and release history', href: 'https://github.com/The-Hack-Man/ab16-webpage-source-clean' },
];

export function AdminControlDesk() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase.from('control_desk_runs')
      .select('id,status,created_at,completed_at,result').order('created_at', { ascending: false }).limit(10);
    if (queryError) setError(queryError.message.includes('control_desk_runs') ? 'Control Desk setup is not applied to this database yet.' : 'Operational checks could not be loaded.');
    else setRuns((data ?? []) as Run[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const requestCheck = async () => {
    setRequesting(true);
    setNotice(null);
    setError(null);
    const { error: requestError } = await supabase.rpc('request_control_desk_health_check');
    if (requestError) setError(requestError.message.includes('request_control_desk_health_check') ? 'Control Desk setup is not applied to this database yet.' : 'Could not queue the health check.');
    else {
      setNotice('Health check queued. Refresh in a moment to see the worker result.');
      await refresh();
    }
    setRequesting(false);
  };

  const latest = runs[0];
  return (
    <div>
      <PageHeader title="Website Control Desk" subtitle="Manage the storefront and open the connected infrastructure from one place." action={<button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>} />

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div>}

      <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <SectionCard title="Website operations">
          <div className="grid gap-3 sm:grid-cols-2">
            {operations.map(({ title, description, href, icon: Icon }) => (
              <Link key={href} to={href} className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 hover:bg-slate-50">
                <Icon size={20} className="mb-3 text-slate-500" />
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Store health">
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <p>Sales stay disabled until products, payment testing, provider settings and launch approval are complete.</p>
          </div>
          <button onClick={() => void requestCheck()} disabled={requesting} className="inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Play size={15} />{requesting ? 'Queueing…' : 'Run health check'}</button>
          <p className="mt-3 text-xs text-slate-500">Runs a read-only check through the authenticated, idempotent queue workflow.</p>
          {latest && <div className="mt-4 rounded border border-slate-200 p-3 text-sm">
            <div className="flex justify-between"><strong>Latest check</strong><span className="capitalize">{latest.status}</span></div>
            <p className="mt-1 text-xs text-slate-500">{new Date(latest.created_at).toLocaleString()}</p>
            {latest.result && <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <span>Published products: {latest.result.publishedProducts}</span><span>Available for sale: {latest.result.saleableProducts}</span>
              <span>Orders: {latest.result.orders}</span><span>Pending jobs: {latest.result.pendingJobs}</span>
              <span>Pending events: {latest.result.pendingOutboxEvents}</span>
            </div>}
          </div>}
          {!loading && !latest && !error && <p className="mt-4 text-sm text-slate-500">No health checks recorded yet.</p>}
        </SectionCard>
      </div>

      <SectionCard title="Connected infrastructure" className="mt-5">
        <p className="mb-4 text-sm text-slate-600">Open the connected DNS, hosting, backend, payment, fulfilment and source controls here. Provider credentials and account-level changes stay in each provider console; this desk does not claim to change those settings automatically.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => <a key={provider.name} href={provider.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <span className="flex items-start gap-3"><Globe2 size={18} className="mt-0.5 text-slate-500" /><span><strong className="block text-sm text-slate-900">{provider.name}</strong><span className="text-xs text-slate-500">{provider.purpose}</span></span></span><ArrowUpRight size={15} className="shrink-0 text-slate-400" />
          </a>)}
          <Link to="/admin/settings" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50"><Cloud size={18} className="text-slate-500" /><span><strong className="block text-sm text-slate-900">Store settings</strong><span className="text-xs text-slate-500">Business and storefront configuration</span></span></Link>
        </div>
      </SectionCard>
    </div>
  );
}
