import { Link } from 'react-router-dom';
import { Instagram, Youtube, Music2, Mail, ArrowRight, Music } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AB16Logo, JamieGLogo } from '@/components/Logo';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export function Footer() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const settings = useSiteSettings();

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: email.trim(),
      consent_text: 'Subscribed via website footer form',
    });
    if (error) {
      if (error.code === '23505') {
        setStatus('done');
        setEmail('');
      } else {
        setStatus('error');
      }
    } else {
      setStatus('done');
      setEmail('');
    }
  };

  return (
    <footer className="bg-jet text-bone">
      {/* Newsletter */}
      <div className="border-b border-bone/10">
        <div className="container-base py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="section-label text-bone/40 mb-3">Newsletter</p>
              <h2 className="text-display-lg font-display font-bold">Get in before the drop.</h2>
              <p className="mt-4 text-sm text-bone/60 max-w-md">
                Early access to limited collections, new music releases, exclusive offers, and artist news.
              </p>
            </div>
            <div>
              <form onSubmit={subscribe} className="flex gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-field-dark flex-1"
                />
                <button type="submit" className="btn-light whitespace-nowrap">
                  Subscribe <ArrowRight size={14} />
                </button>
              </form>
              {status === 'done' && (
                <p className="mt-3 text-xs text-bone/60">You're on the list. Watch your inbox.</p>
              )}
              {status === 'error' && (
                <p className="mt-3 text-xs text-red-400">Something went wrong. Please try again.</p>
              )}
              <p className="mt-3 text-[10px] text-bone/30">
                By subscribing you agree to receive marketing emails. You can unsubscribe at any time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="container-base py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 lg:col-span-1">
            <AB16Logo variant="light" />
            <p className="mt-4 text-xs text-bone/50 max-w-xs leading-relaxed">
              Independent streetwear from Aberdeen. AB16 — the postcode, the culture, the movement.
            </p>
            <div className="mt-5">
              <JamieGLogo variant="light" />
            </div>
          </div>

          <FooterColumn title="Shop" links={[
            { label: 'All Products', to: '/shop' },
            { label: 'New Arrivals', to: '/shop/new-arrivals' },
            { label: 'Collections', to: '/shop/collections' },
            { label: 'Shopping Bag', to: '/bag' },
          ]} />

          <FooterColumn title="Music" links={[
            { label: 'Jamie G', to: '/music' },
            { label: 'Releases', to: '/music/releases' },
            { label: 'Videos', to: '/music/videos' },
            { label: 'News', to: '/music/news' },
            { label: 'Events', to: '/music/events' },
          ]} />

          <FooterColumn title="Brand" links={[
            { label: 'About', to: '/about' },
            { label: 'About Jamie G', to: '/about/jamie-g' },
            { label: 'Contact', to: '/contact' },
            { label: 'FAQs', to: '/faq' },
          ]} />

          <FooterColumn title="Legal" links={[
            { label: 'Shipping & Returns', to: '/shipping-returns' },
            { label: 'Privacy Policy', to: '/privacy' },
            { label: 'Terms & Conditions', to: '/terms' },
            { label: 'Cookie Policy', to: '/cookies' },
          ]} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-bone/10">
        <div className="container-base py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-bone/40">© {year} AB16 Clothing × Jamie G Music. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-start">
            <a href={settings?.instagram_url || 'https://www.instagram.com/ab16clothing/'} target="_blank" rel="noopener noreferrer" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="Instagram">
              <Instagram size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href={settings?.youtube_url || 'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg'} target="_blank" rel="noopener noreferrer" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="YouTube">
              <Youtube size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href={settings?.tiktok_url || 'https://www.tiktok.com/@jamiegmusic'} target="_blank" rel="noopener noreferrer" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="TikTok">
              <Music2 size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href={settings?.spotify_url || 'https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC'} target="_blank" rel="noopener noreferrer" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="Spotify">
              <Music size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href={settings?.apple_music_url || 'https://music.apple.com/us/artist/jamie-g/1815382137'} target="_blank" rel="noopener noreferrer" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="Apple Music">
              <Music size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href={settings?.amazon_music_url || 'https://music.amazon.co.uk/artists/B0F9SBKZVD/jamie-g'} target="_blank" rel="noopener noreferrer" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="Amazon Music">
              <Music size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href="mailto:mcjamieg@zohomail.eu" className="relative group text-bone/50 hover:text-bone transition-colors" aria-label="Email">
              <Mail size={18} strokeWidth={1.5} className="group-hover:scale-110 group-hover:text-accent transition-all" />
            </a>
            <a href="https://ab16clothing.co.uk" target="_blank" rel="noopener noreferrer" className="relative group text-[10px] uppercase tracking-[0.15em] text-bone/50 hover:text-bone hover:text-accent transition-all" aria-label="AB16 Clothing website">ab16clothing.co.uk</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bone/40 mb-4">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-bone/70 hover:text-bone transition-colors">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
