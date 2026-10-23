import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Music2, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Campaign, Product, MusicRelease } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { ReleaseCard } from '@/components/ReleaseCard';
import { timeUntil } from '@/lib/format';

export function CampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [releases, setReleases] = useState<MusicRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data: camp } = await supabase.from('campaigns').select('*').eq('slug', slug).maybeSingle();
      setCampaign(camp as Campaign | null);

      if (camp) {
        const [prodRes, relRes] = await Promise.all([
          supabase.from('campaign_products').select('product:products(*, product_images(*), product_variants(*))').eq('campaign_id', camp.id),
          supabase.from('campaign_releases').select('release:music_releases(*)').eq('campaign_id', camp.id),
        ]);
        setProducts((prodRes.data ?? []).flatMap((r: { product?: unknown }) => (r.product ? [r.product as Product] : [])));
        setReleases((relRes.data ?? []).flatMap((r: { release?: unknown }) => (r.release ? [r.release as MusicRelease] : [])));
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!campaign?.launch_date) return;
    const interval = setInterval(() => setCountdown(timeUntil(campaign.launch_date)), 1000);
    return () => clearInterval(interval);
  }, [campaign?.launch_date]);

  if (loading) return <div className="bg-jet text-bone min-h-screen container-base py-20"><div className="h-8 bg-charcoal animate-pulse max-w-xl mb-4" /><div className="h-64 bg-charcoal animate-pulse" /></div>;

  if (!campaign) {
    return (
      <div className="bg-jet text-bone min-h-screen container-base py-32 text-center">
        <h1 className="text-display-lg">Campaign not found</h1>
        <Link to="/" className="btn-light mt-8">Back Home</Link>
      </div>
    );
  }

  const isLive = campaign.status === 'live' || (campaign.launch_date && countdown.total <= 0);

  return (
    <div className="bg-jet text-bone min-h-screen">
      {/* Hero */}
      <section className="relative h-[65vh] min-h-[450px] overflow-hidden">
        {campaign.hero_image_url && <img src={campaign.hero_image_url} alt={campaign.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-b from-jet/40 via-jet/50 to-jet" />
        <div className="relative h-full container-base flex flex-col justify-end pb-16 lg:pb-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-bone/50 mb-4">AB16 × Jamie G</p>
          <h1 className="text-display-2xl">{campaign.name}</h1>
          {campaign.description && <p className="mt-5 text-lg text-bone/60 max-w-2xl">{campaign.description}</p>}

          {!isLive && campaign.launch_date && (
            <div className="mt-8 grid grid-cols-4 gap-3 max-w-md">
              {[
                { label: 'Days', value: countdown.days },
                { label: 'Hours', value: countdown.hours },
                { label: 'Mins', value: countdown.minutes },
                { label: 'Secs', value: countdown.seconds },
              ].map((u) => (
                <div key={u.label} className="border border-bone/15 p-3 text-center">
                  <div className="text-2xl font-display font-bold tabular-nums">{String(u.value).padStart(2, '0')}</div>
                  <div className="text-[9px] uppercase tracking-widest text-bone/40 mt-0.5">{u.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/shop" className="btn-light">Shop the Collection <ShoppingBag size={14} /></Link>
            {releases.length > 0 && <Link to={`/music/releases/${releases[0].slug}`} className="btn-outline-light"><Music2 size={14} /> Listen Now</Link>}
          </div>
        </div>
      </section>

      {/* Products */}
      {products.length > 0 && (
        <section className="py-16 lg:py-24">
          <div className="container-base">
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-display-lg">The Collection</h2>
              <Link to="/shop" className="link-underline text-sm text-bone/70">View all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Releases */}
      {releases.length > 0 && (
        <section className="py-16 lg:py-24 border-t border-bone/10">
          <div className="container-base">
            <h2 className="text-display-lg mb-8">The Music</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {releases.map((r) => <ReleaseCard key={r.id} release={r} />)}
            </div>
          </div>
        </section>
      )}

      {campaign.discount_code && (
        <section className="py-12 border-t border-bone/10 text-center">
          <div className="container-base">
            <p className="text-sm text-bone/50">Use code</p>
            <p className="text-2xl font-display font-bold tracking-widest my-2">{campaign.discount_code}</p>
            <p className="text-sm text-bone/50">at checkout for this campaign's offer.</p>
          </div>
        </section>
      )}
    </div>
  );
}
