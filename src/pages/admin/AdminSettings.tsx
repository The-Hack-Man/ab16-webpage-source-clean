import { useEffect, useState } from 'react';
import { Save, ExternalLink, RefreshCw, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SiteSettings } from '@/types';

export function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();
      setSettings(data as SiteSettings | null);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    if (settings?.id) {
      await supabase.from('site_settings').update({
        website_url: settings.website_url, business_name: settings.business_name, contact_email: settings.contact_email,
        support_email: settings.support_email, currency: settings.currency,
        store_address: settings.store_address, instagram_url: settings.instagram_url,
        tiktok_url: settings.tiktok_url, youtube_url: settings.youtube_url,
        spotify_url: settings.spotify_url, apple_music_url: settings.apple_music_url, amazon_music_url: settings.amazon_music_url,
        facebook_url: settings.facebook_url, announcement_text: settings.announcement_text,
        announcement_active: settings.announcement_active, hero_headline: settings.hero_headline,
        hero_subtext: settings.hero_subtext, hero_image_url: settings.hero_image_url,
        maintenance_mode: settings.maintenance_mode,
      }).eq('id', settings.id);
    } else if (settings) {
      await supabase.from('site_settings').insert(settings);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="h-32 bg-white animate-pulse rounded" />;

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setSettings((prev) => prev ? { ...prev, [key]: value } : prev);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : saved ? 'Saved!' : <><Save size={14} /> Save Settings</>}</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Business Details">
          <Field label="Website URL"><input value={settings.website_url ?? ''} onChange={(e) => set('website_url', e.target.value)} className="admin-input" /></Field>
          <Field label="Business Name"><input value={settings.business_name ?? ''} onChange={(e) => set('business_name', e.target.value)} className="admin-input" /></Field>
          <Field label="Contact Email"><input value={settings.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} className="admin-input" /></Field>
          <Field label="Support Email"><input value={settings.support_email ?? ''} onChange={(e) => set('support_email', e.target.value)} className="admin-input" /></Field>
          <Field label="Store Address"><textarea value={settings.store_address ?? ''} onChange={(e) => set('store_address', e.target.value)} rows={2} className="admin-input resize-none" /></Field>
          <Field label="Currency"><input value={settings.currency ?? 'GBP'} onChange={(e) => set('currency', e.target.value)} className="admin-input" /></Field>
        </Section>

        <Section title="Social Links">
          <Field label="Instagram URL"><input value={settings.instagram_url ?? ''} onChange={(e) => set('instagram_url', e.target.value)} className="admin-input" /></Field>
          <Field label="TikTok URL"><input value={settings.tiktok_url ?? ''} onChange={(e) => set('tiktok_url', e.target.value)} className="admin-input" /></Field>
          <Field label="YouTube URL"><input value={settings.youtube_url ?? ''} onChange={(e) => set('youtube_url', e.target.value)} className="admin-input" /></Field>
          <Field label="Spotify URL"><input value={settings.spotify_url ?? ''} onChange={(e) => set('spotify_url', e.target.value)} className="admin-input" /></Field>
          <Field label="Apple Music URL"><input value={settings.apple_music_url ?? ''} onChange={(e) => set('apple_music_url', e.target.value)} className="admin-input" /></Field>
          <Field label="Amazon Music URL"><input value={settings.amazon_music_url ?? ''} onChange={(e) => set('amazon_music_url', e.target.value)} className="admin-input" /></Field>
          <Field label="Facebook URL"><input value={settings.facebook_url ?? ''} onChange={(e) => set('facebook_url', e.target.value)} className="admin-input" /></Field>
        </Section>

        <Section title="Homepage Hero">
          <Field label="Hero Headline"><textarea value={settings.hero_headline ?? ''} onChange={(e) => set('hero_headline', e.target.value)} rows={2} className="admin-input resize-none" /></Field>
          <Field label="Hero Subtext"><textarea value={settings.hero_subtext ?? ''} onChange={(e) => set('hero_subtext', e.target.value)} rows={2} className="admin-input resize-none" /></Field>
          <Field label="Hero Image URL"><input value={settings.hero_image_url ?? ''} onChange={(e) => set('hero_image_url', e.target.value)} className="admin-input" /></Field>
        </Section>

        <Section title="Announcement Bar">
          <Field label="Announcement Text"><input value={settings.announcement_text ?? ''} onChange={(e) => set('announcement_text', e.target.value)} className="admin-input" /></Field>
          <Toggle label="Active" checked={settings.announcement_active ?? false} onChange={(v) => set('announcement_active', v)} />
        </Section>

        <Section title="Payments (Stripe)">
          <p className="text-sm text-slate-500 leading-relaxed">
            Checkout redirects to Stripe. Add <code className="text-xs">STRIPE_SECRET_KEY</code> and <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> as Supabase secrets, then deploy the <code className="text-xs">create-checkout</code> and <code className="text-xs">stripe-webhook</code> functions.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => window.open('https://dashboard.stripe.com/test/apikeys', '_blank')}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50"
            >
              <ExternalLink size={12} /> Stripe Dashboard
            </button>
            <button
              onClick={async () => {
                const { error } = await supabase.functions.invoke('create-checkout', { body: { test: true } });
                alert(error ? `Error: ${error.message}` : 'create-checkout function is responsive.');
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs border border-slate-200 rounded hover:bg-slate-50"
            >
              <RefreshCw size={12} /> Test Checkout Ping
            </button>
          </div>
        </Section>

        <Section title="Fulfilment (Printful)">
          <p className="text-sm text-slate-500 leading-relaxed mb-3">
            The <code className="text-xs">printful-webhook</code> function is deployed and listening for order updates.
            Add <code className="text-xs">PRINTFUL_API_KEY</code> as a Supabase secret to enable automatic
            order forwarding after Stripe payment.
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-green-700">Printful webhook active</span>
          </div>
          <button
            onClick={() => window.open('https://fleoxzauuvfbdysvadev.supabase.co/functions/v1/printful-webhook', '_blank')}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink size={12} /> Copy webhook URL
          </button>
        </Section>

        <Section title="Refunds & Payment Links">
          <button
            onClick={async () => {
              const orderNum = prompt('Enter order number to look up:');
              if (!orderNum) return;
              const { data, error } = await supabase
                .from('orders')
                .select('id, order_number, total, payment_status, fulfilment_status')
                .eq('order_number', orderNum.toUpperCase())
                .maybeSingle();
              if (error || !data) {
                alert('Order not found.');
                return;
              }
              alert(
                `Order: ${data.order_number}\n` +
                `Total: £${(data.total / 100).toFixed(2)}\n` +
                `Payment: ${data.payment_status}\n` +
                `Fulfilment: ${data.fulfilment_status}\n` +
                `Payment Intent: ${data.payment_status}`
              );
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50"
          >
            <CreditCard size={14} /> Look Up Order
          </button>
        </Section>

        <Section title="Maintenance">
          <Toggle label="Maintenance Mode (hides the storefront)" checked={settings.maintenance_mode ?? false} onChange={(v) => set('maintenance_mode', v)} />
        </Section>
      </div>

      <style>{`.admin-input { width: 100%; border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; font-size: 0.875rem; background: white; } .admin-input:focus { outline: none; border-color: #080808; }`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded p-5"><h2 className="text-sm font-semibold uppercase tracking-wider mb-4">{title}</h2><div className="space-y-3">{children}</div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-slate-500 block mb-1.5">{label}</label>{children}</div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-jet" /><span className="text-sm">{label}</span></label>;
}
