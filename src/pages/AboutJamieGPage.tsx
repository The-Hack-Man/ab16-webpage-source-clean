import { Link } from 'react-router-dom';
import { ArrowRight, Music2, Mic, MapPin, Mail, ExternalLink } from 'lucide-react';
import type { Icon } from '@/types';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const JAMIE_IMAGE = '/images/site/jamie-g-home.png';

export function AboutJamieGPage() {
  const settings = useSiteSettings();
  return (
    <div className="bg-jet text-bone min-h-screen">
      {/* Hero */}
      <section className="relative h-[65vh] min-h-[450px] overflow-hidden">
        <img src={settings?.jamie_hero_image_url || JAMIE_IMAGE} alt="Jamie G" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-jet/30 via-jet/50 to-jet" />
        <div className="relative h-full container-base flex flex-col justify-end pb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-bone/50 mb-4">The Artist</p>
          <h1 className="text-display-2xl">JAMIE G</h1>
          <p className="mt-4 text-lg text-bone/60 max-w-2xl">Producer. Singer. Engineer. Lyricist. No genre can hold him — but mostly country.</p>
        </div>
      </section>

      {/* Bio */}
      <section className="py-20 lg:py-28">
        <div className="container-base grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <div className="aspect-[4/5] overflow-hidden">
            <img src={settings?.jamie_studio_image_url || JAMIE_IMAGE} alt="Jamie G" className="w-full h-full object-cover" />
          </div>

          <div>
            <p className="section-label text-bone/40 mb-4">The Story</p>
            <h2 className="text-display-lg">From the schemes to the studio.</h2>
            <div className="mt-6 space-y-4 text-bone/70 leading-relaxed">
              <p>
                JAMIE G is a music producer, singer, musical engineer, and lyrical genius based in Aberdeen.
                No genre can hold him — but mostly country.
              </p>
              <p>
                Jamie had a hard upbringing in the tough southside of Seaton — nothing but skyscrapers and poverty.
                At 10, Jamie moved to the north end called Northfield, which people would say was worse.
                Jamie landed right in the heart of it. AB16.
              </p>
              <p>
                Jamie started writing and MCing for UK hardcore on the local circuit. Then after having three
                babies and ten years in and out of prison — 15 times for fighting and being daft — Jamie hit 23,
                daughters getting older, and said enough is enough. Time to start writing again.
              </p>
              <p>
                At first Jamie didn't want to release under his own name or even sing, so he started AB16-AI music,
                where he could write and get it out. But deep down he knew because it's not him singing it doesn't
                matter. So he bit the bullet and went in with everything in his body. That's when the movement
                started. People started noticing his music — but it was the haters that fueled him forward.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Influences / Milestones */}
      <section className="py-20 border-t border-bone/10">
        <div className="container-base">
          <div className="grid md:grid-cols-3 gap-6">
            <InfoCard icon={Mic} title="Musical Style" text="Country-rooted with raw, honest lyricism. A producer's ear and a singer's heart." />
            <InfoCard icon={MapPin} title="Roots" text="Seaton to Northfield. Aberdeen AB16. The streets that made him." />
            <InfoCard icon={Music2} title="The Movement" text="From AB16-AI to the real thing. The haters only fueled the fire." />
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-bone/10">
        <div className="container-base">
          <p className="section-label text-bone/40 mb-4">Official Jamie G links</p>
          <div className="flex flex-wrap gap-3">
            {[
              ['YouTube', settings?.youtube_url || 'https://www.youtube.com/channel/UCDTrDLZyf8YTXvKFTHOCkyg'],
              ['Spotify', settings?.spotify_url || 'https://open.spotify.com/artist/05IDis5l8XLJKkWp7CAOcC'],
              ['Amazon Music', settings?.amazon_music_url || 'https://music.amazon.co.uk/artists/B0F9SBKZVD/jamie-g'],
              ['TikTok', settings?.tiktok_url || 'https://www.tiktok.com/@jamiegmusic'],
              ['Apple Music', settings?.apple_music_url || 'https://music.apple.com/us/artist/jamie-g/1815382137'],
            ].filter(([, url]) => Boolean(url)).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="btn-outline-light">{label} <ExternalLink size={13} /></a>)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-bone/10 text-center">
        <div className="container-base">
          <h2 className="text-display-lg">Hear the vision.</h2>
          <p className="mt-4 text-bone/50 max-w-md mx-auto">Listen to the latest releases and follow the journey.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/music/releases" className="btn-light">Listen Now <ArrowRight size={14} /></Link>
            <Link to="/contact" className="btn-outline-light"><Mail size={14} /> Booking Enquiries</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: Icon; title: string; text: string }) {
  return (
    <div className="border border-bone/10 p-8">
      <Icon size={24} strokeWidth={1.5} className="text-bone/50 mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-bone/50 leading-relaxed">{text}</p>
    </div>
  );
}
