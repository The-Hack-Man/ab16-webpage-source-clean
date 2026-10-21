import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';
import { Send, Check } from 'lucide-react';

const CATEGORIES = [
  'Customer Support',
  'Order Enquiry',
  'Returns Enquiry',
  'Collaboration',
  'Press & Media',
  'Music Booking',
  'Business Partnership',
];

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', category: CATEGORIES[0], message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [contactEmail, setContactEmail] = useState('mcjamieg@zohomail.eu');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('site_settings').select('contact_email').limit(1).maybeSingle();
      if (data?.contact_email) setContactEmail(data.contact_email);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    const { error } = await supabase.from('contact_enquiries').insert({
      name: form.name,
      email: form.email,
      category: form.category,
      message: form.message,
    });
    if (error) {
      setStatus('error');
    } else {
      setStatus('done');
      setForm({ name: '', email: '', category: CATEGORIES[0], message: '' });
    }
  };

  return (
    <div className="bg-bone min-h-screen">
      <div className="border-b border-jet/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label mb-3">Get In Touch</p>
          <h1 className="text-display-xl">Contact</h1>
          <p className="mt-3 text-slate-500 max-w-lg">Questions about an order? Want to collaborate? Music booking? We want to hear from you.</p>
        </div>
      </div>

      <div className="container-base py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Form */}
          <div>
            {status === 'done' ? (
              <div className="border border-jet/10 p-10 text-center">
                <Check size={32} className="mx-auto text-green-600 mb-4" />
                <h2 className="text-lg font-semibold">Message sent</h2>
                <p className="mt-2 text-sm text-slate-500">We'll get back to you as soon as we can.</p>
                <button onClick={() => setStatus('idle')} className="btn-outline mt-6">Send another</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Name</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Your name" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Email</label>
                    <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="your@email.com" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field cursor-pointer">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 block mb-2">Message</label>
                  <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} className="input-field resize-none" placeholder="Tell us what you need…" />
                </div>

                {status === 'error' && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}

                <button type="submit" disabled={status === 'submitting'} className="btn-primary">
                  {status === 'submitting' ? 'Sending…' : <>Send Message <Send size={14} /></>}
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2">Customer Support</h3>
              <a href={`mailto:${contactEmail}`} className="text-sm text-slate-500 hover:text-jet underline underline-offset-4">{contactEmail}</a>
            </div>
            <div className="hairline" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2">Music Booking</h3>
              <p className="text-sm text-slate-500">For Jamie G booking enquiries, use the booking category in the form above.</p>
            </div>
            <div className="hairline" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2">Collaborations</h3>
              <p className="text-sm text-slate-500">Brand partnerships, collaborations, and press enquiries welcome.</p>
            </div>
            <div className="hairline" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-2">Based In</h3>
              <p className="text-sm text-slate-500">Aberdeen, Scotland. AB16.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
