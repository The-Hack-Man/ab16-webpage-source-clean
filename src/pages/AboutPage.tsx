import { Link } from 'react-router-dom';
import { ArrowRight, Music2, Shirt, MapPin } from 'lucide-react';
import type { Icon } from '@/types';

const STORY_IMAGE = '/images/merch/opt/ab16clothing1.webp';
const ABERDEEN_IMAGE = '/images/merch/opt/ab16clothing.webp';

export function AboutPage() {
  return (
    <div className="bg-bone min-h-screen">
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px] overflow-hidden">
        <img src={STORY_IMAGE} alt="AB16 Clothing" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-jet/50" />
        <div className="relative h-full container-base flex flex-col justify-end pb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-bone/60 mb-4">About</p>
          <h1 className="text-display-2xl text-bone">AB16 Clothing</h1>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 lg:py-28">
        <div className="container-base grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <p className="section-label mb-4">The Brand</p>
            <h2 className="text-display-lg">Wear the vision. Hear the vision.</h2>
            <div className="mt-6 space-y-4 text-slate-600 leading-relaxed">
              <p>
                AB16 is more than a postcode. It's the heart of Aberdeen's north end — the schemes,
                the skyscrapers, the streets that shaped us. AB16 Clothing was born from that environment:
                independent streetwear made with raw authenticity, no compromises.
              </p>
              <p>
                What started as a creative outlet became a movement. AB16 Clothing exists at the
                intersection of fashion, music, and culture — a label that represents where we come from
                and everything we're building toward.
              </p>
              <p>
                Every piece is designed for the people of the schemes, by someone who came from them.
                No gatekeeping. No pretence. Just honest, premium streetwear with a story behind it.
              </p>
            </div>
            <div className="mt-8 flex gap-3">
              <Link to="/shop" className="btn-primary">Shop the Collection <ArrowRight size={14} /></Link>
              <Link to="/about/jamie-g" className="btn-outline">Meet Jamie G</Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="aspect-[4/3] overflow-hidden">
              <img src={ABERDEEN_IMAGE} alt="Aberdeen streets" className="w-full h-full object-cover" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <StatCard icon={Shirt} label="Independent" value="Streetwear" />
              <StatCard icon={Music2} label="Connected" value="Music" />
              <StatCard icon={MapPin} label="Based In" value="Aberdeen" />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-jet text-bone py-20 lg:py-28">
        <div className="container-base">
          <p className="section-label text-bone/40 mb-4 text-center">What We Stand For</p>
          <h2 className="text-display-xl text-center mb-14">More than a label.</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Authenticity', text: 'No borrowed identity. Everything we make comes from real experience — the schemes, the struggle, the come-up.' },
              { title: 'Community', text: 'Built for the people who came from the same places. AB16 is a movement, not just a brand.' },
              { title: 'Quality', text: 'Premium materials, considered design, and construction that holds up. Independent doesn\'t mean compromise.' },
            ].map((v) => (
              <div key={v.title} className="border border-bone/10 p-8">
                <h3 className="text-lg font-semibold mb-3">{v.title}</h3>
                <p className="text-sm text-bone/60 leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: Icon; label: string; value: string }) {
  return (
    <div className="border border-jet/10 p-4 text-center">
      <Icon size={20} className="mx-auto text-slate-400 mb-2" strokeWidth={1.5} />
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}
