import { useEffect, useState } from 'react';
import { Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { PageHeader, Badge, EmptyState, LoadingRows, StatCard, SearchInput, FilterSelect } from '@/components/admin/ui';

interface StripeEvent {
  stripe_event_id: string;
  status: string;
  last_error: string | null;
  attempts: number;
  locked_until: string | null;
  completed_at: string | null;
  processed_at: string;
}

export function AdminStripe() {
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data, error: queryError } = await supabase
        .from('processed_stripe_events')
        .select('stripe_event_id, status, last_error, attempts, locked_until, completed_at, processed_at')
        .order('processed_at', { ascending: false });
      if (queryError) setError('Stripe event data could not be loaded. Check administrator access and database connectivity.');
      else setEvents((data ?? []) as StripeEvent[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4"><LoadingRows count={4} height="h-24" /></div>;
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;

  const failed = events.filter((e) => e.status === 'failed');
  const completed = events.filter((e) => e.status === 'completed');
  const processing = events.filter((e) => e.status === 'processing' || e.status === 'claimed');

  const retried = events.filter((event) => event.attempts > 1);

  const filtered = events.filter((e) => {
    const matchesSearch = e.stripe_event_id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader title="Stripe Webhook Monitor" subtitle="Event processing status, failures, and duplicate detection" />

      {/* Summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Zap} label="Total Events" value={events.length.toString()} />
        <StatCard icon={CheckCircle} label="Completed" value={completed.length.toString()} />
        <StatCard icon={Clock} label="Processing" value={processing.length.toString()} alert={processing.length > 0} />
        <StatCard icon={AlertTriangle} label="Failed" value={failed.length.toString()} link="/admin/stripe" alert={failed.length > 0} />
      </div>

      {retried.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <p className="text-sm text-amber-800">
              {retried.length} event{retried.length !== 1 ? 's have' : ' has'} been attempted more than once.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by event ID..." />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
            { value: 'processing', label: 'Processing' },
            { value: 'claimed', label: 'Claimed' },
          ]}
        />
      </div>

      {/* Events table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Zap} title="No Stripe events" desc="Webhook events will appear here once Stripe sends checkout notifications." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Event ID</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Attempts</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Error</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.stripe_event_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.stripe_event_id}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{e.attempts}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={e.status === 'completed' ? 'success' : e.status === 'failed' ? 'danger' : e.status === 'processing' || e.status === 'claimed' ? 'warning' : 'neutral'}>
                      {e.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate" title={e.last_error ?? ''}>{e.last_error ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(e.processed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
