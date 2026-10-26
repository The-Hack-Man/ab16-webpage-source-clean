import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, ArrowLeft, Plus, X, Upload, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProductImage } from '@/types';

interface VariantRow {
  id?: string;
  size: string;
  color: string;
  sku: string;
  printful_sync_variant_id: string;
}

export function AdminProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingImages(true);
    setImageUploadError(null);
    try {
      const selected = Array.from(files);
      if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))) {
        throw new Error('Choose JPG, PNG, WebP, or AVIF images only.');
      }
      if (selected.some((file) => file.size > 10 * 1024 * 1024)) {
        throw new Error('Each image must be 10 MB or smaller.');
      }
      const results = await Promise.allSettled(selected.map(async (file) => {
        const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'product-image';
        const path = `products/${crypto.randomUUID()}/${safeName}`;
        const { error } = await supabase.storage.from('product-images').upload(path, file, {
          contentType: file.type,
          cacheControl: '31536000',
          upsert: false,
        });
        if (error) throw error;
        return { path, url: supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl, alt_text: file.name.replace(/\.[^.]+$/, ''), position: 0 };
      }));
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed) {
        const completed = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
        const { error: cleanupError } = completed.length
          ? await supabase.storage.from('product-images').remove(completed.map((upload) => upload.path))
          : { error: null };
        if (cleanupError) throw new Error(`An image upload failed and temporary files could not be cleaned up: ${failed.reason instanceof Error ? failed.reason.message : 'Upload failed.'}`);
        throw failed.reason;
      }
      const uploads = results.flatMap((result) => result.status === 'fulfilled' ? [{ url: result.value.url, alt_text: result.value.alt_text, position: result.value.position }] : []);
      setImages((current) => [...current.filter((image) => image.url.trim()), ...uploads].map((image, position) => ({ ...image, position })));
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploadingImages(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  const [form, setForm] = useState({
    name: '', slug: '', description: '', story: '', price: '', compare_at_price: '',
    category_slug: '', collection_slug: '', status: 'draft', available_for_sale: false, availability_label: '', featured: false,
    is_new_arrival: false, is_limited_drop: false, material_care: '', delivery_info: '', return_info: '',
    seo_title: '', seo_description: '',
  });

  const [images, setImages] = useState<{ id?: string; url: string; alt_text: string; position: number; source_key?: string | null }[]>([
    { url: '', alt_text: '', position: 0 },
  ]);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: prod } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (prod) {
        setForm({
          name: prod.name ?? '', slug: prod.slug ?? '', description: prod.description ?? '', story: prod.story ?? '',
          price: (prod.price / 100).toFixed(2), compare_at_price: prod.compare_at_price ? (prod.compare_at_price / 100).toFixed(2) : '',
          category_slug: prod.category_slug ?? '', collection_slug: prod.collection_slug ?? '', status: prod.status ?? 'draft',
          available_for_sale: prod.available_for_sale ?? false, availability_label: prod.availability_label ?? '',
          featured: prod.featured ?? false, is_new_arrival: prod.is_new_arrival ?? false, is_limited_drop: prod.is_limited_drop ?? false,
          material_care: prod.material_care ?? '', delivery_info: prod.delivery_info ?? '', return_info: prod.return_info ?? '',
          seo_title: prod.seo_title ?? '', seo_description: prod.seo_description ?? '',
        });
      }
      const { data: imgs } = await supabase.from('product_images').select('*').eq('product_id', id).order('position');
      if (imgs && imgs.length) setImages(imgs.map((i: ProductImage) => ({ id: i.id, url: i.url, alt_text: i.alt_text ?? '', position: i.position, source_key: i.source_key })));

      const { data: vars } = await supabase.from('product_variants').select('*').eq('product_id', id);
      if (vars && vars.length) {
        setVariants(vars.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku ?? '',
          printful_sync_variant_id: v.printful_sync_variant_id ? String(v.printful_sync_variant_id) : '',
        })));
      }
    })();
  }, [id]);

  const save = async () => {
    if (saving || uploadingImages) return;

    if (!form.name.trim()) {
      setSaveError('Product name is required');
      return;
    }

    if (form.available_for_sale) {
      const sellableVariants = variants.filter((variant) => variant.size.trim() && variant.color.trim());
      const skus = sellableVariants.map((variant) => variant.sku.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
      const syncIds = sellableVariants.map((variant) => variant.printful_sync_variant_id.trim());
      if (form.status !== 'published') {
        setSaveError('A product must be published before it can be made available for sale.');
        return;
      }
      if (sellableVariants.length === 0 || sellableVariants.some((variant) => !variant.sku.trim() || !variant.printful_sync_variant_id.trim())) {
        setSaveError('Sync this product from Printful first; every size and colour must have a provider sync ID before sales can be enabled.');
        return;
      }
      if (new Set(skus).size !== skus.length || new Set(syncIds).size !== syncIds.length) {
        setSaveError('Sellable variants must have unique shop SKUs and unique Printful sync variant IDs.');
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      if (!slug) {
        setSaveError('Could not generate a valid slug — please enter one manually');
        return;
      }

      const pricePence = Math.round(parseFloat(form.price || '0') * 100);
      const comparePence = form.compare_at_price ? Math.round(parseFloat(form.compare_at_price) * 100) : null;

      const payload = {
        name: form.name, slug, description: form.description || null, story: form.story || null,
        price: pricePence, compare_at_price: comparePence, category_slug: form.category_slug || null,
        collection_slug: form.collection_slug || null, status: form.status, available_for_sale: form.available_for_sale, availability_label: form.availability_label || null, featured: form.featured,
        is_new_arrival: form.is_new_arrival, is_limited_drop: form.is_limited_drop,
        material_care: form.material_care || null, delivery_info: form.delivery_info || null,
        return_info: form.return_info || null, seo_title: form.seo_title || null, seo_description: form.seo_description || null,
      };

      let productId = id;

      if (isEdit) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
      } else {
        const { data: newProd, error } = await supabase
          .from('products')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!newProd?.id) throw new Error('Product was inserted but no ID was returned');
        productId = newProd.id;
      }

      if (!productId) throw new Error('Could not determine product ID');

      const savedImageIds: string[] = [];
      for (const [position, image] of images.filter((entry) => entry.url.trim()).entries()) {
        const imagePayload = {
          product_id: productId,
          url: image.url.trim(),
          alt_text: image.alt_text.trim() || null,
          position,
          source_key: image.source_key ?? null,
        };
        const result = image.id
          ? await supabase.from('product_images').update(imagePayload).eq('id', image.id).select('id').single()
          : await supabase.from('product_images').insert(imagePayload).select('id').single();
        if (result.error || !result.data) throw result.error ?? new Error('Could not save a product image.');
        savedImageIds.push(result.data.id);
      }

      if (isEdit) {
        const { error: imageDeleteError } = savedImageIds.length
          ? await supabase.from('product_images').delete().eq('product_id', productId).not('id', 'in', `(${savedImageIds.join(',')})`)
          : await supabase.from('product_images').delete().eq('product_id', productId);
        if (imageDeleteError) throw imageDeleteError;
      }

      setImages((current) => current.filter((image) => image.url.trim()).map((image, position) => ({
        ...image,
        id: savedImageIds[position],
        position,
      })));
      setSaved(true);
      setTimeout(() => navigate('/admin/products'), 1500);
    } catch (err) {
      const supabaseErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const message = supabaseErr?.message
        ? `${supabaseErr.message}${supabaseErr.details ? ` — ${supabaseErr.details}` : ''}`
        : 'Failed to save product — check the console for details';
      setSaveError(message);
      console.error('Product save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isEdit) {
    return <div className="max-w-2xl rounded border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-bold">Create products in Printful</h1>
      <p className="mt-2 text-sm text-slate-600">Printful is the source of truth for products, artwork and fulfilment variants. New shop listings are imported automatically using Printful product and variant IDs.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/admin/printful" className="btn-primary"><RefreshCw size={15} /> Sync Printful catalog</Link>
        <a href="https://www.printful.com/dashboard/store" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium"><Upload size={15} /> Open Printful</a>
      </div>
    </div>;
  }

  return (
    <div>
      <Link to="/admin/products" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-jet mb-4"><ArrowLeft size={16} /> Back to Products</Link>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Product' : 'New Product'}</h1>

      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        <div className="space-y-6">
          {/* Basic info */}
          <Section title="Basic Information">
            <Field label="Product Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" placeholder="e.g. AB16 Logo Hoodie" /></Field>
            <Field label="Slug (URL)"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input" placeholder="auto-generated from name" /></Field>
            <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="admin-input resize-none" /></Field>
            <Field label="Product Story (optional)"><textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} rows={3} className="admin-input resize-none" /></Field>
          </Section>

          {/* Pricing */}
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (£)"><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="admin-input" placeholder="0.00" /></Field>
              <Field label="Compare-at Price (£)"><input type="number" step="0.01" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} className="admin-input" placeholder="0.00" /></Field>
            </div>
          </Section>

          {/* Images */}
          <Section title="Images">
            <p className="text-xs text-slate-400 mb-3">Upload product images here, or paste an existing image URL. JPG, PNG, WebP, and AVIF up to 10 MB each. Uploaded images are linked when you save the product.</p>
            <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" aria-label="Upload product images" onChange={(event) => void uploadImages(event.target.files)} />
            <button type="button" onClick={() => imageFileRef.current?.click()} disabled={uploadingImages} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"><Upload size={15} />{uploadingImages ? 'Uploading…' : 'Upload images'}</button>
            {imageUploadError && <p role="alert" className="text-sm text-red-700">{imageUploadError} Confirm the product-images storage setup is applied.</p>}
            {images.map((img, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={img.url} onChange={(e) => setImages(images.map((im, idx) => idx === i ? { ...im, url: e.target.value } : im))} className="admin-input flex-1" placeholder="https://image-url.jpg" />
                <input value={img.alt_text} onChange={(e) => setImages(images.map((im, idx) => idx === i ? { ...im, alt_text: e.target.value } : im))} className="admin-input w-32" placeholder="Alt text" />
                <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="p-2 hover:bg-red-100 rounded text-red-500"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setImages([...images, { url: '', alt_text: '', position: images.length }])} className="text-sm text-accent flex items-center gap-1 mt-2"><Plus size={14} /> Add image</button>
          </Section>

          {/* Printful variants are reconciled by provider IDs and remain read-only here. */}
          <Section title="Variants synced from Printful">
            <p className="text-xs text-slate-500">Printful owns the product variants. Sync the catalog from Fulfilment to add and update sizes, colours, images, prices and fulfillment IDs automatically.</p>
            {variants.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Colour</th><th className="py-2 pr-3">Size</th><th className="py-2 pr-3">SKU</th><th className="py-2">Printful ID</th></tr></thead>
                  <tbody>{variants.map((variant) => (
                    <tr key={variant.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{variant.color}</td>
                      <td className="py-2 pr-3">{variant.size}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{variant.sku || '—'}</td>
                      <td className="py-2 font-mono text-xs">{variant.printful_sync_variant_id || 'Not synced'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">No Printful variants are linked yet. Create the product in Printful, then use the catalog sync.</p>}
            <Link to="/admin/printful" className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"><RefreshCw size={14} /> Open Printful catalog sync</Link>
          </Section>

          {/* Additional info */}
          <Section title="Material & Care, Delivery, Returns">
            <Field label="Material & Care"><textarea value={form.material_care} onChange={(e) => setForm({ ...form, material_care: e.target.value })} rows={2} className="admin-input resize-none" /></Field>
            <Field label="Delivery Info"><textarea value={form.delivery_info} onChange={(e) => setForm({ ...form, delivery_info: e.target.value })} rows={2} className="admin-input resize-none" /></Field>
            <Field label="Return Info"><textarea value={form.return_info} onChange={(e) => setForm({ ...form, return_info: e.target.value })} rows={2} className="admin-input resize-none" /></Field>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Section title="Status & Organisation">
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="admin-input cursor-pointer">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Category"><input value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="admin-input" placeholder="e.g. hoodies" /></Field>
            <Field label="Collection"><input value={form.collection_slug} onChange={(e) => setForm({ ...form, collection_slug: e.target.value })} className="admin-input" placeholder="collection slug" /></Field>
            <Field label="Availability label"><input value={form.availability_label} onChange={(e) => setForm({ ...form, availability_label: e.target.value })} className="admin-input" placeholder="Coming Soon / TBA" /></Field>
            <Toggle label="Available for sale" checked={form.available_for_sale} onChange={(v) => setForm({ ...form, available_for_sale: v })} />
            <div className="space-y-2 mt-3">
              <Toggle label="Featured" checked={form.featured} onChange={(v) => setForm({ ...form, featured: v })} />
              <Toggle label="New Arrival" checked={form.is_new_arrival} onChange={(v) => setForm({ ...form, is_new_arrival: v })} />
              <Toggle label="Limited Drop" checked={form.is_limited_drop} onChange={(v) => setForm({ ...form, is_limited_drop: v })} />
            </div>
          </Section>

          <Section title="SEO">
            <Field label="SEO Title"><input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className="admin-input" /></Field>
            <Field label="SEO Description"><textarea value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} rows={2} className="admin-input resize-none" /></Field>
          </Section>

          <button onClick={save} disabled={saving || uploadingImages} className="btn-primary w-full">
            {uploadingImages ? 'Finish image upload…' : saving ? 'Saving…' : saved ? 'Saved!' : <><Save size={14} /> Save Product</>}
          </button>
          {saveError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {saveError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-jet" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
