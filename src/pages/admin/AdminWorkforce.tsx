import { useCallback, useEffect, useState } from 'react';
import { Activity, Clock3, RefreshCw, ShieldAlert, Workflow } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, PageHeader, SectionCard, StatCard } from '@/components/admin/ui';

type CountResult = { count: number | null; error: { message: string } | null };

function resultCount(result: CountResult): number {
  if (result.error) throw result.error;
  return result.count ?? 0;
}

export function AdminWorkforce() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pendingJobs: 0, runningJobs: 0, failedJobs: 0, pendingOutbox: 0 });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, running, failed, outbox] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['pending']),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['running']),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['failed', 'dead']),
        supabase.from('outbox').select('id', { count: 'exact', head: true }).eq('processed', false),
      ]);
      setCounts({
        pendingJobs: resultCount(pending),
        runningJobs: resultCount(running),
        failedJobs: resultCount(failed),
        pendingOutbox: resultCount(outbox),
      });
      setCheckedAt(new Date().toISOString());
    } catch {
      setError('Work queue data could not be read. No healthy/empty status can be inferred until access and connectivity are restored.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div>
      <PageHeader
        title="Digital Workforce"
        subtitle="Read-only operational status from the connected Supabase project"
        action={<button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert size={18} />
        <strong>Not live:</strong> the scheduler function is not deployed; no verified recurring schedule or independent alert channel is configured.
      </div>

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Queued jobs" value={loading ? '…' : String(counts.pendingJobs)} sub="Status: pending" />
        <StatCard icon={Activity} label="Running jobs" value={loading ? '…' : String(counts.runningJobs)} sub="Status: running" />
        <StatCard icon={ShieldAlert} label="Failed / dead jobs" value={loading ? '…' : String(counts.failedJobs)} sub="Requires operator review" alert={counts.failedJobs > 0} />
        <StatCard icon={Workflow} label="Unprocessed outbox" value={loading ? '…' : String(counts.pendingOutbox)} sub="Events awaiting processing" alert={counts.pendingOutbox > 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Worker availability">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><span>Scheduler / job runner</span><Badge tone="danger">Not deployed</Badge></div>
            <div className="flex items-center justify-between gap-3"><span>Incident tracking</span><Badge>Not configured</Badge></div>
            <div className="flex items-center justify-between gap-3"><span>Approval workflow</span><Badge>Not configured</Badge></div>
            <div className="flex items-center justify-between gap-3"><span>External uptime / notification</span><Badge>Not verified</Badge></div>
          </div>
        </SectionCard>

        <SectionCard title="Readiness and safety">
          <ul className="space-y-2 text-sm leading-6 text-slate-600">
            <li>Queue counts above are live database reads as of {checkedAt ? new Date(checkedAt).toLocaleString() : 'not yet checked'}.</li>
            <li>This page never runs, retries, cancels, or mutates a job.</li>
            <li>The local <code>scheduler-tick</code> now authenticates requests, redacts payloads, and accepts only an explicit health-check event/job contract. The worker and its migration still need to be installed and verified in staging before deployment.</li>
            <li>Do not describe this store as monitored 24/7 until a protected worker is deployed, scheduled, and its real heartbeat/alerts are verified.</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
