import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Music2, Video, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MusicRelease, Icon } from '@/types';
import { ReleaseCard } from '@/components/ReleaseCard';
import { UpcomingAlbumBanner } from '@/components/UpcomingAlbumBanner';
import { formatDate } from '@/lib/format';

const HERO_IMAGE = 'https://images.pexels.com/photos/31510586/pexels-photo-31510586.jpeg?auto=compress&cs=tinysrgb&w=1920';

export function MusicPage() {
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('music_releases')
        .select('*')
        .in('status', ['published', 'upcoming', 'scheduled'])
        .order('release_date', { ascending: false })
        .limit(6);
      setReleases(data as MusicRelease[] ?? []);
      setLoading(false);
    })();
  }, []);

  const upcoming = releases.find((r) => r.status === 'upcoming' || r.status === 'scheduled');
  const latestPublished = releases.find((r) => r.status === 'published');

  return (
    <div className="bg-jet text-bone min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[70vh] overflow-hidden">
        <img src={HERO_IMAGE} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale" />
        <div className="absolute inset-0 bg-gradient-to-b from-jet/70 via-jet/75 to-jet" />
        <div className="relative container-base flex flex-col justify-end pt-28 pb-16 lg:pb-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-bone/50 mb-5">Jamie G — Aberdeen</p>
          <h1 className="text-display-2xl">JAMIE G</h1>
          <p className="mt-4 text-xl text-bone/60 max-w-2xl">The Music. The Vision. The Journey.</p>
          <p className="mt-2 text-base text-bone/40 max-w-xl">{upcoming ? `${upcoming.title} arrives 02.12.26. Listen now, watch the videos, and follow the movement.` : 'Discover the latest releases, watch the visuals, and follow the journey.'}</p>
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
            <Link to="/music/releases" className="btn-light">Listen Now <Play size={14} /></Link>
            <Link to="/music/videos" className="btn-outline-light">Watch the Videos <Video size={14} /></Link>
            <Link to="/about/jamie-g" className="btn-outline-light">The Story <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.18em] text-bone/50">
            <a href="https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC" target="_blank" rel="noopener noreferrer" className="hover:text-bone">Spotify</a>
            <a href="https://music.apple.com/us/artist/jamie-g/1815382137" target="_blank" rel="noopener noreferrer" className="hover:text-bone">Apple Music</a>
            <a href="https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg" target="_blank" rel="noopener noreferrer" className="hover:text-bone">YouTube</a>
            <a href="https://music.amazon.co.uk/artists/B0F9SBKZVD/jamie-g" target="_blank" rel="noopener noreferrer" className="hover:text-bone">Amazon Music</a>
            <a href="https://www.tiktok.com/@jamiegmusic" target="_blank" rel="noopener noreferrer" className="hover:text-bone">TikTok</a>
          </div>
        </div>
      </section>

      {upcoming && <UpcomingAlbumBanner release={upcoming} />}

      {/* Latest release spotlight */}
      {latestPublished && (
        <section className="py-20 lg:py-28">
          <div className="container-base">
            <p className="section-label text-bone/40 mb-4">Latest Release</p>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <Link to={`/music/releases/${latestPublished.slug}`} className="aspect-square overflow-hidden group">
                {latestPublished.cover_art_url ? (
                  <img src={latestPublished.cover_art_url} alt={latestPublished.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full bg-charcoal flex items-center justify-center"><Music2 size={48} className="text-bone/30" /></div>
                )}
              </Link>
              <div>
                <h2 className="text-display-lg">{latestPublished.title}</h2>
                <p className="mt-2 text-bone/50">{latestPublished.artist}{latestPublished.featured_artists ? ` ft. ${latestPublished.featured_artists}` : ''}</p>
                <p className="mt-1 text-sm text-bone/30">{formatDate(latestPublished.release_date)}</p>
                {latestPublished.description && <p className="mt-6 text-bone/60 leading-relaxed">{latestPublished.description}</p>}
                <Link to={`/music/releases/${latestPublished.slug}`} className="btn-light mt-8">Listen Now <ArrowRight size={14} /></Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Releases grid */}
      <section className="py-20 lg:py-28 border-t border-bone/10">
        <div className="container-base">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="section-label text-bone/40 mb-3">Releases</p>
              <h2 className="text-display-lg">All releases.</h2>
            </div>
            <Link to="/music/releases" className="link-underline text-sm font-medium text-bone/70">View all</Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square bg-charcoal animate-pulse" />)}
            </div>
          ) : releases.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {releases.map((r) => <ReleaseCard key={r.id} release={r} />)}
            </div>
          ) : (
            <div className="border border-bone/10 py-16 text-center">
              <Music2 size={32} className="mx-auto text-bone/20 mb-4" />
              <h3 className="text-lg font-semibold">Releases coming soon</h3>
              <p className="mt-2 text-sm text-bone/40 max-w-md mx-auto">Music will appear here once published through the admin dashboard.</p>
            </div>
          )}

          <div className="mt-16 max-w-xl">
            <p className="section-label text-bone/40 mb-4">Listen on Spotify</p>
            <iframe
              title="Jamie G on Spotify"
              className="w-full h-[352px] rounded-none"
              src="https://open.spotify.com/embed/artist/05IDis5l8XLJKkWp7CAOcC?utm_source=generator"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="py-20 border-t border-bone/10">
        <div className="container-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <QuickLink to="/music/videos" icon={Video} title="Music Videos" desc="Watch the visuals" />
            <QuickLink to="/music/news" icon={Calendar} title="News & Updates" desc="Stay in the loop" />
            <QuickLink to="/about/jamie-g" icon={ArrowRight} title="About Jamie G" desc="The story behind the music" />
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc }: { to: string; icon: Icon; title: string; desc: string }) {
  return (
    <Link to={to} className="group border border-bone/10 p-8 hover:bg-charcoal transition-all duration-300">
      <Icon size={24} strokeWidth={1.5} className="text-bone/50 mb-4 transition-transform group-hover:scale-110" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-bone/40 mt-1">{desc}</p>
    </Link>
  );
}
