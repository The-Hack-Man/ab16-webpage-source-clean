import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function FAQPage() {
  const faqs = [
    { q: 'How long does UK shipping take?', a: 'Standard UK delivery is typically 2-4 working days. Free shipping is available on orders over £75. Exact timeframes will be confirmed at checkout based on your location.' },
    { q: 'What is your returns policy?', a: 'We accept returns on unworn items within 30 days of delivery. Items must be in original condition with tags attached. See our Shipping & Returns page for full details.' },
    { q: 'Do you ship internationally?', a: 'International shipping can be configured in the admin settings. Currently, UK shipping is our default. Check back or contact us for international availability.' },
    { q: 'How do I track my order?', a: 'Once your order is dispatched, you\'ll receive a tracking reference by email. You can also view your order status in your account under Order History.' },
    { q: 'Can I change or cancel my order?', a: 'If your order hasn\'t been dispatched yet, contact us as soon as possible and we\'ll do our best to help. Once dispatched, you\'ll need to follow the returns process.' },
    { q: 'Are AB16 products limited edition?', a: 'Some collections are limited drops, marked with a "Limited" badge on the product page. Once they\'re gone, they\'re gone.' },
    { q: 'How do I know my size?', a: 'Each product page has a size guide with measurements. If you\'re between sizes, we recommend sizing up for a looser fit or down for a fitted look.' },
    { q: 'Do you do pre-orders?', a: 'Selected items may be available for pre-order during limited drops. These will be clearly labelled, and payment is taken at the time of order.' },
    { q: 'Where is Jamie G\'s music available?', a: 'Streaming links for each release are available on the individual release pages. We list Spotify, Apple Music, YouTube, and other platforms where Jamie G\'s music is available.' },
    { q: 'How do I contact you about a music booking?', a: 'Use the contact form on our Contact page and select "Music Booking" as the category. We\'ll get back to you directly.' },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="bg-bone min-h-screen">
      <div className="border-b border-jet/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label mb-3">Help Centre</p>
          <h1 className="text-display-xl">Frequently Asked Questions</h1>
        </div>
      </div>

      <div className="container-narrow py-12 lg:py-16">
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-jet/10">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left"
              >
                <span className="text-base font-medium pr-4">{faq.q}</span>
                <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <p className="pb-5 text-sm text-slate-600 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 border border-jet/10 p-8 text-center">
          <h2 className="text-lg font-semibold">Still have questions?</h2>
          <p className="mt-2 text-sm text-slate-500">We're here to help.</p>
          <Link to="/contact" className="btn-primary mt-6">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
