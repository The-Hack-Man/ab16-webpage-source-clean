import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play, ArrowLeft, ExternalLink, Share2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MusicRelease } from '@/types';
import { ReleaseCard } from '@/components/ReleaseCard';
import { UpcomingAlbumBanner } from '@/components/UpcomingAlbumBanner';
import { formatDateLong } from '@/lib/format';

export function ReleaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [release, setRelease] = useState<MusicRelease | null>(null);
  const [related, setRelated] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      const { data } = await supabase
        .from('music_releases')
        .select('*, tracks(*)')
        .eq('slug', slug)
        .in('status', ['published', 'upcoming', 'scheduled'])
        .maybeSingle();
      setRelease(data as MusicRelease | null);

      if (data) {
        const { data: rel } = await supabase
          .from('music_releases')
          .select('*')
          .eq('status', 'published')
          .neq('id', data.id)
          .order('release_date', { ascending: false })
          .limit(4);
        setRelated(rel as MusicRelease[] ?? []);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return <div className="bg-jet text-bone min-h-screen container-base py-20"><div className="grid lg:grid-cols-2 gap-8"><div className="aspect-square bg-charcoal animate-pulse" /><div className="space-y-4"><div className="h-8 bg-charcoal animate-pulse" /><div className="h-4 bg-charcoal animate-pulse w-1/2" /></div></div></div>;
  }

  if (!release) {
    return (
      <div className="bg-jet text-bone min-h-screen container-base py-32 text-center">
        <h1 className="text-display-lg">Release not found</h1>
        <p className="mt-3 text-bone/40">This release may not be published yet.</p>
        <Link to="/music/releases" className="btn-light mt-8">Back to Releases</Link>
      </div>
    );
  }

  const accent = release.accent_color ?? '#080808';
  const tracks = release.tracks?.sort((a, b) => a.position - b.position) ?? [];
  const isUpcoming = release.status === 'upcoming' || release.status === 'scheduled';

  const streamingLinks = [
    { label: 'Spotify', url: release.spotify_url },
    { label: 'Apple Music', url: release.apple_music_url },
    { label: 'YouTube', url: release.youtube_url },
    { label: 'Amazon Music', url: 'https://music.amazon.co.uk/artists/B0F9SBKZVD/jamie-g' },
    { label: 'TikTok', url: 'https://www.tiktok.com/@jamiegmusic' },
    { label: 'SoundCloud', url: release.soundcloud_url },
    { label: 'Tidal', url: release.tidal_url },
    { label: 'Bandcamp', url: release.bandcamp_url },
  ].filter((l) => l.url);

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: `${release.title} — ${release.artist}`, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="bg-jet text-bone min-h-screen" style={{ backgroundColor: accent }}>
      {/* Hero */}
      <section className="relative pt-12 lg:pt-16">
        <div className="container-base">
          <Link to="/music/releases" className="inline-flex items-center gap-2 text-sm text-bone/50 hover:text-bone mb-8">
            <ArrowLeft size={16} /> All Releases
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Cover art */}
            <div>
              <div className="aspect-square overflow-hidden bg-jet shadow-2xl">
                {release.cover_art_url ? (
                  <img src={release.cover_art_url} alt={release.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-jet">
                    <span className="text-display-lg font-display font-extrabold text-bone text-center">{release.title}</span>
                    <span className="text-bone/40 text-sm mt-3 uppercase tracking-widest">{release.artist}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="lg:pt-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="badge bg-bone/10 text-bone/70 backdrop-blur">{release.release_type}</span>
                {release.explicit && <span className="badge bg-bone/10 text-bone/70 backdrop-blur">Explicit</span>}
                {isUpcoming && <span className="badge bg-accent text-white">Upcoming</span>}
              </div>

              <h1 className="text-display-xl">{release.title}</h1>
              <p className="mt-3 text-xl text-bone/70">{release.artist}{release.featured_artists ? ` ft. ${release.featured_artists}` : ''}</p>
              <p className="mt-1 text-sm text-bone/40">{formatDateLong(release.release_date)}</p>

              {release.description && <p className="mt-6 text-bone/70 leading-relaxed">{release.description}</p>}

              {/* Actions */}
              <div className="mt-8 flex flex-wrap gap-3">
                {streamingLinks.length > 0 ? (
                  streamingLinks.map((l) => (
                    <a key={l.label} href={l.url ?? undefined} target="_blank" rel="noopener noreferrer" className="btn-light">
                      {l.label} <ExternalLink size={12} />
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-bone/40">Streaming links will appear here once added.</p>
                )}
                {release.pre_save_url && (
                  <a href={release.pre_save_url ?? undefined} target="_blank" rel="noopener noreferrer" className="btn-outline-light">Pre-save</a>
                )}
                <button onClick={share} className="btn-outline-light">
                  <Share2 size={14} /> Share
                </button>
              </div>

              {release.label && <p className="mt-8 text-xs text-bone/30">Label: {release.label}</p>}
              {release.copyright && <p className="mt-1 text-xs text-bone/30">{release.copyright}</p>}
            </div>
          </div>
        </div>
      </section>

      {isUpcoming && <UpcomingAlbumBanner release={release} />}

      {/* Tracklist */}
      {tracks.length > 0 && (
        <section className="py-16 lg:py-24 mt-16 border-t border-bone/10">
          <div className="container-base">
            <h2 className="text-display-lg mb-8">Tracklist</h2>
            <div className="space-y-1 max-w-2xl">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center gap-4 py-3 px-4 hover:bg-bone/5 transition-colors group">
                  <span className="text-sm text-bone/30 tabular-nums w-6">{String(track.position).padStart(2, '0')}</span>
                  {track.preview_url ? (
                    <a href={track.preview_url ?? undefined} target="_blank" rel="noopener noreferrer" className="text-bone/40 hover:text-bone">
                      <Play size={16} fill="currentColor" />
                    </a>
                  ) : (
                    <Play size={16} className="text-bone/20" />
                  )}
                  <span className="flex-1 text-sm font-medium">
                    {track.title}
                    {track.explicit && <span className="ml-2 text-[9px] text-bone/30 border border-bone/20 px-1">E</span>}
                  </span>
                  {track.duration && <span className="text-xs text-bone/40 tabular-nums flex items-center gap-1"><Clock size={11} /> {track.duration}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="py-16 lg:py-24 border-t border-bone/10">
          <div className="container-base">
            <h2 className="text-display-lg mb-8">More Releases</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {related.map((r) => <ReleaseCard key={r.id} release={r} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
