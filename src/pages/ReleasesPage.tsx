import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { MusicRelease } from '@/types';
import { ReleaseCard } from '@/components/ReleaseCard';

export function ReleasesPage() {
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('music_releases')
        .select('*')
        .in('status', ['published', 'upcoming'])
        .order('release_date', { ascending: false });
      setReleases(data as MusicRelease[] ?? []);
      setLoading(false);
    })();
  }, []);

  const types = ['all', 'single', 'ep', 'album', 'mixtape'];
  const filtered = filter === 'all' ? releases : releases.filter((r) => r.release_type === filter);

  return (
    <div className="bg-jet text-bone min-h-screen">
      <div className="border-b border-bone/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label text-bone/40 mb-3">Jamie G Music</p>
          <h1 className="text-display-xl">Releases</h1>
          <p className="mt-3 text-bone/50">Singles, EPs, albums, and more.</p>
        </div>
      </div>

      <div className="container-base py-10">
        {/* Type filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border transition-colors ${
                filter === t ? 'bg-bone text-jet border-bone' : 'border-bone/15 text-bone/60 hover:border-bone/40'
              }`}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square bg-charcoal animate-pulse" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {filtered.map((r) => <ReleaseCard key={r.id} release={r} />)}
          </div>
        ) : (
          <div className="border border-bone/10 py-20 text-center">
            <h3 className="text-lg font-semibold">No releases yet</h3>
            <p className="mt-2 text-sm text-bone/40">Music will appear here once published.</p>
          </div>
        )}
      </div>
    </div>
  );
}
