import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { MusicRelease } from '@/types';
import { timeUntil } from '@/lib/format';

const DEFAULT_ALBUM_COVER = '/images/albumcovers/newalbumcover.webp';

export function UpcomingAlbumBanner({ release, dark = true }: { release: MusicRelease; dark?: boolean }) {
  const [countdown, setCountdown] = useState(timeUntil(release.release_date));
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!release.release_date || !release.countdown_visible) return;
    const interval = window.setInterval(() => setCountdown(timeUntil(release.release_date)), 1000);
    return () => window.clearInterval(interval);
  }, [release.release_date, release.countdown_visible]);

  const released = countdown.total <= 0;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: email.trim(),
      consent_text: 'Subscribed for Jamie G album release announcements',
    });
    if (!error || error.code === '23505') {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <section className={`${dark ? 'bg-charcoal text-bone' : 'bg-bone text-jet'} relative overflow-hidden py-20 lg:py-28`}>
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-current opacity-10" />
      <div className="container-base relative grid items-center gap-10 lg:grid-cols-[0.8fr,1.2fr]">
        <div className="aspect-square max-w-sm overflow-hidden bg-jet/10">
          <img src={release.cover_art_url || DEFAULT_ALBUM_COVER} alt={`${release.title} artwork`} className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="section-label mb-4 opacity-50">New album announcement</p>
          <h2 className="text-display-xl max-w-3xl">{release.title}</h2>
          <p className="mt-3 text-xl opacity-70">{release.artist}</p>
          <p className="mt-4 text-lg opacity-60">Release date: 02.12.26</p>
          {release.announcement_text && <p className="mt-4 max-w-xl leading-relaxed opacity-60">{release.announcement_text}</p>}

          {release.countdown_visible && !released && (
            <div className="mt-8 grid max-w-lg grid-cols-4 gap-2 sm:gap-3">
              {[['Days', countdown.days], ['Hours', countdown.hours], ['Mins', countdown.minutes], ['Secs', countdown.seconds]].map(([label, value]) => (
                <div key={label} className="border border-current/15 p-3 text-center sm:p-4">
                  <div className="text-2xl font-display font-bold tabular-nums sm:text-3xl">{String(value).padStart(2, '0')}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-widest opacity-40">{label}</div>
                </div>
              ))}
            </div>
          )}
          {released && <p className="mt-8 text-lg font-semibold">Out now.</p>}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={`/music/releases/${release.slug}`} className={dark ? 'btn-light' : 'btn-primary'}>View release <ArrowRight size={14} /></Link>
            {release.pre_save_url && !released && <a href={release.pre_save_url} target="_blank" rel="noopener noreferrer" className="btn-outline-light">Pre-save <ExternalLink size={13} /></a>}
          </div>

          {!subscribed ? (
            <form onSubmit={submit} className="mt-8 flex max-w-md gap-2">
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email for release news" className={dark ? 'input-field-dark flex-1' : 'input-field flex-1'} />
              <button type="submit" className={dark ? 'btn-light whitespace-nowrap' : 'btn-primary whitespace-nowrap'}><Mail size={14} /> Notify me</button>
            </form>
          ) : <p className="mt-8 text-sm opacity-60">You’re on the list for Jamie G release news.</p>}
        </div>
      </div>
    </section>
  );
}
