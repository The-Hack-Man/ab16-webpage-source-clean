import { ExternalLink, ImagePlus, Package, ShieldCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, SectionCard } from '@/components/admin/ui';

export function AdminUploadGuide() {
  return <div>
    <PageHeader title="Product upload guide" subtitle="Printful is the product and fulfilment catalog. Product and variant IDs are imported automatically." action={<a href="https://www.printful.com/dashboard/store" target="_blank" rel="noreferrer" className="btn-primary"><ExternalLink size={15} /> Open Printful</a>} />
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><p><strong>Safe by default.</strong> New Printful products are imported as drafts and stay unavailable for sale until their garment, artwork, price and delivery details are reviewed.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard title="Add a product">
        <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>Create and configure the product, artwork, variants and retail prices in <a className="font-medium underline" href="https://www.printful.com/dashboard/store" target="_blank" rel="noreferrer">Printful <ExternalLink className="inline" size={12} /></a>.</li>
          <li>Use <Link className="font-medium underline" to="/admin/printful">Printful fulfilment → Sync catalog now</Link>. The importer reads each Printful product and variant ID and reconciles them to Supabase automatically.</li>
          <li>The new product appears in <Link className="font-medium underline" to="/admin/products">Store listings</Link> as a draft. Product artwork, variant sizes, colours and Printful IDs arrive from the provider catalog.</li>
          <li>Edit AB16-specific description, story, category, SEO and extra gallery images in the listing editor. Provider-managed artwork, prices and variants refresh on each catalog sync.</li>
          <li>Review the live garment, mockups, artwork, price and UK fulfilment. Publish and enable sales only after the product is approved.</li>
        </ol>
      </SectionCard>
      <SectionCard title="How automatic mapping works">
        <div className="space-y-4 text-sm text-slate-700">
          <p>The Printful sync-variant ID is the stable mapping key. It is stored with its parent Printful product ID, so changing a product title or SKU does not break fulfilment.</p>
          <p>A Printful product update webhook keeps the Supabase catalog reconciled after setup. The admin sync button also performs a full refresh at any time.</p>
          <p>Existing shop products are linked only when their stored Printful variant IDs identify one unambiguous product. Unmatched legacy drafts remain unavailable rather than being guessed into a product.</p>
          <Link to="/admin/printful" className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50"><RefreshCw size={15} /> View sync status</Link>
        </div>
      </SectionCard>
      <SectionCard title="Photo checklist">
        <div className="flex gap-3 text-sm text-slate-700"><ImagePlus size={18} className="mt-0.5 shrink-0 text-slate-500" /><p>Printful’s primary product mockup is imported automatically. Add campaign or editorial images from the listing editor; use a consistent crop and descriptive alt text.</p></div>
      </SectionCard>
      <SectionCard title="Before publishing">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700"><li>Confirm the Printful garment model, colour, size and artwork match the listing.</li><li>Check the imported selling price and any size-specific prices.</li><li>Verify Printful can fulfil each required variant to the UK.</li><li>Check the product detail page and mobile image crop.</li><li>Confirm shipping charges and delivery wording, then complete the test checkout and webhook acceptance checks.</li></ul>
      </SectionCard>
    </div>
    <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Package size={15} /><span>Printful owns fulfillment variants; AB16’s admin editor manages store presentation and publishing.</span><Link to="/admin" className="ml-auto underline">Back to Admin Desk</Link></div>
  </div>;
}
