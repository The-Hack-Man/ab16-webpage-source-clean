import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { MusicRelease } from '@/types';
import { formatDate } from '@/lib/format';

const TYPE_LABELS: Record<string, string> = {
  single: 'Single',
  ep: 'EP',
  album: 'Album',
  mixtape: 'Mixtape',
  deluxe: 'Deluxe',
  feature: 'Feature',
  remix: 'Remix',
  instrumental: 'Instrumental',
};

export function ReleaseCard({ release, dark = true }: { release: MusicRelease; dark?: boolean }) {
  const accent = release.accent_color ?? '#080808';
  const isUpcoming = release.status === 'upcoming' || release.status === 'scheduled';

  return (
    <Link to={`/music/releases/${release.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden bg-slate-900 transition-all duration-500 ease-out-expo group-hover:shadow-2xl group-hover:shadow-accent/20">
        {release.cover_art_url ? (
          <img
            src={release.cover_art_url}
            alt={`${release.title} cover art`}
            className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: accent }}>
            <span className="font-display font-extrabold text-bone text-xl text-center">{release.title}</span>
            <span className="text-bone/50 text-xs mt-2 uppercase tracking-widest">{release.artist}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-jet/0 group-hover:bg-jet/30 transition-colors duration-500 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-bone/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
            <Play size={18} className="text-jet ml-0.5" fill="currentColor" />
          </div>
        </div>

        <div className="absolute top-3 left-3">
          <span className="badge bg-jet/80 backdrop-blur text-bone group-hover:bg-accent transition-colors duration-300">{TYPE_LABELS[release.release_type] ?? 'Release'}</span>
        </div>
        {isUpcoming && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-accent text-white animate-pulse-glow">Upcoming</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className={`text-sm font-semibold group-hover:underline underline-offset-2 transition-colors ${dark ? 'text-bone group-hover:text-accent' : 'text-jet'}`}>{release.title}</h3>
        <p className={`mt-0.5 text-xs transition-colors ${dark ? 'text-bone/50 group-hover:text-bone/70' : 'text-slate-400'}`}>{release.artist}</p>
        <p className={`mt-1 text-xs ${dark ? 'text-bone/40 group-hover:text-bone/60' : 'text-slate-400'}`}>{formatDate(release.release_date)}</p>
      </div>
    </Link>
  );
}
