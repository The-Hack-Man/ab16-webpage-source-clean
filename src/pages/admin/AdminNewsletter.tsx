import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { NewsletterSubscriber } from '@/types';

export function AdminNewsletter() {
  const [subs, setSubs] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false });
      setSubs(data ?? []);
      setLoading(false);
    })();
  }, []);

  const active = subs.filter((s) => !s.unsubscribed_at);
  const unsubscribed = subs.filter((s) => s.unsubscribed_at);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Newsletter</h1>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded p-5">
          <p className="text-2xl font-bold">{active.length}</p>
          <p className="text-xs text-slate-500 mt-1">Active Subscribers</p>
        </div>
        <div className="bg-white border border-slate-200 rounded p-5">
          <p className="text-2xl font-bold">{unsubscribed.length}</p>
          <p className="text-xs text-slate-500 mt-1">Unsubscribed</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Subscribed</th>
              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : subs.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No subscribers yet.</td></tr>
            ) : subs.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{s.email}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(s.subscribed_at).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`badge ${s.unsubscribed_at ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                    {s.unsubscribed_at ? 'Unsubscribed' : 'Active'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
