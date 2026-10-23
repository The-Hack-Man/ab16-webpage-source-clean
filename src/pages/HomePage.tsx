import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDown, Play, ShoppingBag, Music2, Instagram, Youtube, Music as TikTokIcon, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, MusicRelease, Campaign, SiteSettings } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { UpcomingAlbumBanner } from '@/components/UpcomingAlbumBanner';
import { formatDate, timeUntil } from '@/lib/format';

const HERO_IMAGE = '/images/merch/clothes2.png';
const SPLIT_FASHION = '/images/merch/opt/ab16clothing1.webp';
const SPLIT_MUSIC = '/images/merch/clothes3.png';
const STORY_IMAGE = '/images/merch/opt/ab16clothing.webp';
const DEFAULT_ALBUM_COVER = '/images/albumcovers/newalbumcover.png';

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredRelease, setFeaturedRelease] = useState<MusicRelease | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const [prodRes, relRes, campRes, setRes] = await Promise.all([
          supabase.from('products').select('*, product_images(*), product_variants(*)').eq('status', 'published').order('created_at', { ascending: false }).limit(4),
          supabase.from('music_releases').select('*, tracks(*)').in('status', ['published', 'upcoming', 'scheduled']).order('release_date', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('campaigns').select('*').in('status', ['live', 'scheduled']).order('launch_date', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('site_settings').select('*').limit(1).maybeSingle(),
        ]);

        if (!active) return;
        const firstError = [prodRes.error, relRes.error, campRes.error, setRes.error].find(Boolean);
        setLoadError(firstError?.message ?? null);
        setProducts(prodRes.data as Product[] ?? []);
        setFeaturedRelease(relRes.data as MusicRelease | null);
        setCampaign(campRes.data as Campaign | null);
        setSettings(setRes.data as SiteSettings | null);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load homepage content.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [retryKey]);

  return (
    <div className="bg-bone">
      <Hero settings={settings} />
      {loadError && (
        <div role="alert" className="container-base py-4 text-sm text-red-800">
          Some homepage content could not be loaded: {loadError}
          <button type="button" className="ml-3 underline font-semibold" onClick={() => setRetryKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      )}
      <FeaturedClothing products={products} loading={loading} />
      <LatestDrop campaign={campaign} />
      <FeaturedRelease release={featuredRelease} />
      <ShopMeetsMusic />
      <BrandStory />
      <SocialSection />
    </div>
  );
}

function Hero({ settings }: { settings: SiteSettings | null }) {
  const headline = settings?.hero_headline ?? 'clothes made by a boy from the scheme, for the people of the schemes.';
  const subtext = settings?.hero_subtext ?? 'AB16 Clothing. Independent streetwear. Music. Culture. Identity.';
  const heroImage = settings?.hero_image_url ?? HERO_IMAGE;

  return (
    <section className="relative h-[92vh] min-h-[600px] w-full bg-jet overflow-hidden">
      <img src={heroImage} alt="AB16 Clothing hero" className="absolute inset-0 w-full h-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-jet via-jet/90 to-jet/50" />

      <div className="relative h-full container-base flex flex-col justify-end pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-3xl animate-fade-up">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-bone/60 mb-5">
            AB16 Clothing × Jamie G Music — Aberdeen
          </p>
          <h1 className="text-display-2xl font-display font-extrabold text-bone leading-[0.95]">
            {headline}
          </h1>
          <p className="mt-6 text-base lg:text-lg text-bone/70 max-w-xl leading-relaxed">
            {subtext}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/shop" className="btn-light">
              Shop AB16 <ArrowRight size={14} />
            </Link>
            <Link to="/music" className="btn-outline-light">
              Discover Jamie G <Music2 size={14} />
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 right-8 hidden lg:flex flex-col items-center gap-2 text-bone/50">
          <span className="text-[9px] uppercase tracking-[0.3em] rotate-90 origin-center mt-8">Scroll</span>
          <ArrowDown size={14} className="animate-scroll-indicator" />
        </div>
      </div>
    </section>
  );
}

function FeaturedClothing({ products, loading }: { products: Product[]; loading: boolean }) {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-base">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="section-label mb-3">Featured Clothing</p>
            <h2 className="text-display-lg">The latest from AB16.</h2>
          </div>
          <Link to="/shop" className="link-underline text-sm font-medium hidden sm:inline-block">
            Shop the collection
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/5] bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <EmptyState
            title="The catalogue is being curated"
            message="Products will appear here once the team adds them through the admin dashboard. No demo products are shown — only real stock."
            cta={{ label: 'Browse Shop', to: '/shop' }}
          />
        )}

        <div className="mt-8 sm:hidden">
          <Link to="/shop" className="btn-outline w-full">Shop the collection</Link>
        </div>
      </div>
    </section>
  );
}

function LatestDrop({ campaign }: { campaign: Campaign | null }) {
  const [countdown, setCountdown] = useState(timeUntil(campaign?.launch_date ?? null));

  useEffect(() => {
    if (!campaign) return;
    if (!campaign.launch_date) return;
    const interval = setInterval(() => setCountdown(timeUntil(campaign.launch_date)), 1000);
    return () => clearInterval(interval);
  }, [campaign]);

  if (!campaign) return null;

  const isLive = campaign.status === 'live' || (campaign.launch_date && countdown.total <= 0);

  return (
    <section className="relative bg-jet text-bone overflow-hidden">
      {campaign.hero_image_url && (
        <img src={campaign.hero_image_url} alt={campaign.name} className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-jet via-jet/70 to-transparent" />

      <div className="relative container-base py-24 lg:py-36">
        <div className="max-w-2xl">
          <p className="section-label text-bone/50 mb-4">{isLive ? 'Now Live' : 'The Latest Drop'}</p>
          <h2 className="text-display-xl">{campaign.name}</h2>
          {campaign.description && <p className="mt-5 text-bone/60 text-lg leading-relaxed">{campaign.description}</p>}

          {!isLive && campaign.launch_date && (
            <div className="mt-10 grid grid-cols-4 gap-3 max-w-md">
              {[
                { label: 'Days', value: countdown.days },
                { label: 'Hours', value: countdown.hours },
                { label: 'Mins', value: countdown.minutes },
                { label: 'Secs', value: countdown.seconds },
              ].map((unit) => (
                <div key={unit.label} className="border border-bone/15 p-4 text-center">
                  <div className="text-2xl lg:text-3xl font-display font-bold tabular-nums">
                    {String(unit.value).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-bone/40 mt-1">{unit.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {isLive ? (
              <Link to="/shop" className="btn-light">Shop the Collection <ArrowRight size={14} /></Link>
            ) : (
              <DropNotify />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DropNotify() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await supabase.from('newsletter_subscribers').insert({
      email: email.trim(),
      consent_text: 'Subscribed via drop countdown notification',
    });
    setDone(true);
    setEmail('');
  };

  if (done) return <p className="text-sm text-bone/60">You'll be notified when it drops.</p>;

  return (
    <form onSubmit={submit} className="flex gap-2 w-full max-w-md">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for early access" className="input-field-dark flex-1" />
      <button type="submit" className="btn-light whitespace-nowrap">Notify Me</button>
    </form>
  );
}

function FeaturedRelease({ release }: { release: MusicRelease | null }) {
  if (release && (release.status === 'upcoming' || release.status === 'scheduled')) {
    return <UpcomingAlbumBanner release={release} />;
  }

  const accent = release?.accent_color ?? '#080808';

  if (!release) {
    return (
      <section className="bg-charcoal text-bone py-24 lg:py-32">
        <div className="container-base text-center">
          <p className="section-label text-bone/40 mb-4">Jamie G Music</p>
          <h2 className="text-display-xl">New music coming soon.</h2>
          <p className="mt-6 text-bone/50 max-w-lg mx-auto">
            The next release is being crafted. Sign up to be the first to hear it.
          </p>
          <Link to="/music" className="btn-light mt-8">Enter the Music World <ArrowRight size={14} /></Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-charcoal text-bone py-24 lg:py-32" style={{ backgroundColor: accent }}>
      <div className="container-base">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1">
            <p className="section-label text-bone/50 mb-4">Featured Release</p>
            <h2 className="text-display-lg">{release.title}</h2>
            <p className="mt-3 text-bone/60 text-lg">{release.artist}{release.featured_artists ? ` ft. ${release.featured_artists}` : ''}</p>
            <p className="mt-2 text-sm text-bone/40">{formatDate(release.release_date)}</p>
            {release.description && <p className="mt-6 text-bone/70 leading-relaxed max-w-lg">{release.description}</p>}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={`/music/releases/${release.slug}`} className="btn-light">
                <Play size={14} /> Listen Now
              </Link>
              {release.pre_save_url && (
                <a href={release.pre_save_url} target="_blank" rel="noopener noreferrer" className="btn-outline-light">Pre-save</a>
              )}
            </div>

            {/* Streaming links */}
            <div className="mt-8 flex flex-wrap gap-4 text-xs text-bone/50">
              {release.spotify_url && <a href={release.spotify_url} target="_blank" rel="noopener noreferrer" className="hover:text-bone transition-colors flex items-center gap-1.5">Spotify <ExternalLink size={11} /></a>}
              {release.apple_music_url && <a href={release.apple_music_url} target="_blank" rel="noopener noreferrer" className="hover:text-bone transition-colors flex items-center gap-1.5">Apple Music <ExternalLink size={11} /></a>}
              {release.youtube_url && <a href={release.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-bone transition-colors flex items-center gap-1.5">YouTube <ExternalLink size={11} /></a>}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <Link to={`/music/releases/${release.slug}`} className="block aspect-square overflow-hidden group">
              <img src={release.cover_art_url || DEFAULT_ALBUM_COVER} alt={release.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShopMeetsMusic() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container-base">
        <p className="section-label text-center mb-3">More Than A Label</p>
        <h2 className="text-display-xl text-center mb-14">MORE THAN A LABEL. IT'S A MOVEMENT.</h2>

        <div className="grid md:grid-cols-2 gap-1">
          <div className="relative aspect-[4/5] md:aspect-[3/4] group overflow-hidden">
            <img src={SPLIT_FASHION} alt="AB16 fashion" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-jet/30 group-hover:bg-jet/20 transition-colors" />
            <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-10">
              <p className="text-[11px] uppercase tracking-[0.25em] text-bone/60 mb-2">AB16 Clothing</p>
              <h3 className="text-display-lg text-bone">Wear the vision.</h3>
              <Link to="/shop" className="btn-light mt-5">Shop the Brand <ArrowRight size={14} /></Link>
            </div>
          </div>

          <div className="relative aspect-[4/5] md:aspect-[3/4] group overflow-hidden">
            <img src={SPLIT_MUSIC} alt="Jamie G music" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-jet/30 group-hover:bg-jet/20 transition-colors" />
            <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-10">
              <p className="text-[11px] uppercase tracking-[0.25em] text-bone/60 mb-2">Jamie G Music</p>
              <h3 className="text-display-lg text-bone">Hear the vision.</h3>
              <Link to="/music" className="btn-light mt-5">Enter the Music World <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandStory() {
  return (
    <section className="relative overflow-hidden bg-jet text-bone py-24 lg:py-32">
      <img src="/images/merch/opt/ab16clothing1.webp" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08] grayscale mix-blend-screen" />
      <div className="absolute inset-0 bg-jet/70" />
      <div className="container-base relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="relative aspect-[4/3] overflow-hidden">
            <img src={STORY_IMAGE} alt="AB16 brand story" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="section-label text-bone/40 mb-4">Our Story</p>
            <h2 className="text-display-lg">WEAR THE VISION. HEAR THE VISION.</h2>
            <p className="mt-6 text-bone/60 leading-relaxed text-lg">
              AB16 is more than a postcode. It's the heart of Aberdeen's north end — the schemes, the skyscrapers,
              the streets that raised us. AB16 Clothing and Jamie G Music are two halves of one creative world:
              independent streetwear made with raw authenticity, and music born from real life.
            </p>
            <p className="mt-4 text-bone/50 leading-relaxed">
              No genre holds Jamie G. No template holds AB16. This is culture, community, and identity —
              built from the ground up, for the people who came from the same places.
            </p>
            <Link to="/about" className="btn-light mt-8">Our Story <ArrowRight size={14} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SocialSection() {
  const socials = [
    { icon: Instagram, label: 'Instagram', desc: '@ab16clothing', url: 'https://instagram.com/ab16clothing' },
    { icon: TikTokIcon, label: 'TikTok', desc: '@jamiegmusic', url: 'https://www.tiktok.com/@jamiegmusic' },
    { icon: Youtube, label: 'YouTube', desc: 'Jamie G Official', url: 'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg' },
  ];

  return (
    <section className="py-24 lg:py-32">
      <div className="container-base">
        <div className="text-center mb-12">
          <p className="section-label mb-3">Follow the Movement</p>
          <h2 className="text-display-lg">Join the community.</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-jet/10 p-8 lg:p-10 hover:bg-jet hover:text-bone transition-all duration-300 ease-out-expo"
            >
              <s.icon size={28} strokeWidth={1.5} className="mb-4 transition-transform group-hover:scale-110" />
              <h3 className="text-base font-semibold">{s.label}</h3>
              <p className="text-sm text-slate-400 group-hover:text-bone/50 mt-1">{s.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
                Follow <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ title, message, cta }: { title: string; message: string; cta?: { label: string; to: string } }) {
  return (
    <div className="border border-jet/10 py-16 text-center px-6">
      <ShoppingBag size={32} className="mx-auto text-slate-300 mb-4" strokeWidth={1} />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">{message}</p>
      {cta && (
        <Link to={cta.to} className="btn-outline mt-6 inline-flex">{cta.label}</Link>
      )}
    </div>
  );
}
