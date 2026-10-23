import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import type { MusicRelease } from '@/types';

export function AdminReleases() {
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('music_releases').select('*').order('created_at', { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setReleases((data as MusicRelease[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = releases.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Music Releases</h1>
          <p className="text-sm text-slate-500 mt-1">{releases.length} total</p>
        </div>
        <Link to="/admin/releases/new" className="btn-primary"><Plus size={16} /> New Release</Link>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input placeholder="Search releases…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-slate-200 pl-11 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:border-jet" />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-16 bg-white animate-pulse rounded" />)}</div>
      ) : error ? null : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded py-16 text-center">
          <Music size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No releases yet.</p>
          <Link to="/admin/releases/new" className="btn-primary mt-4">Create your first release</Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 capitalize">{r.release_type}</td>
                  <td className="px-4 py-3">{r.release_date ? formatDate(r.release_date) : <span className="text-slate-400">TBC</span>}</td>
                  <td className="px-4 py-3 text-center"><span className={`badge ${r.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/releases/${r.id}`} className="inline-flex p-1.5 hover:bg-slate-200 rounded"><Pencil size={14} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
