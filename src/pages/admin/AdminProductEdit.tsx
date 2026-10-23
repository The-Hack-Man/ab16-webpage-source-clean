import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, ArrowLeft, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProductImage, ProductVariant } from '@/types';

interface VariantRow {
  id?: string;
  size: string;
  color: string;
  sku: string;
  stock: string;
  price_override: string;
  printful_sync_variant_id: string;
}

export function AdminProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadedVariantIds, setLoadedVariantIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '', slug: '', description: '', story: '', price: '', compare_at_price: '',
    category_slug: '', collection_slug: '', status: 'draft', available_for_sale: true, availability_label: '', featured: false,
    is_new_arrival: false, is_limited_drop: false, material_care: '', delivery_info: '', return_info: '',
    seo_title: '', seo_description: '',
  });

  const [images, setImages] = useState<{ id?: string; url: string; alt_text: string; position: number }[]>([
    { url: '', alt_text: '', position: 0 },
  ]);
  const [variants, setVariants] = useState<VariantRow[]>([
    { size: 'M', color: 'Black', sku: '', stock: '0', price_override: '', printful_sync_variant_id: '' },
  ]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: prod } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (prod) {
        setForm({
          name: prod.name ?? '', slug: prod.slug ?? '', description: prod.description ?? '', story: prod.story ?? '',
          price: (prod.price / 100).toFixed(2), compare_at_price: prod.compare_at_price ? (prod.compare_at_price / 100).toFixed(2) : '',
          category_slug: prod.category_slug ?? '', collection_slug: prod.collection_slug ?? '', status: prod.status ?? 'draft',
          available_for_sale: prod.available_for_sale ?? true, availability_label: prod.availability_label ?? '',
          featured: prod.featured ?? false, is_new_arrival: prod.is_new_arrival ?? false, is_limited_drop: prod.is_limited_drop ?? false,
          material_care: prod.material_care ?? '', delivery_info: prod.delivery_info ?? '', return_info: prod.return_info ?? '',
          seo_title: prod.seo_title ?? '', seo_description: prod.seo_description ?? '',
        });
      }
      const { data: imgs } = await supabase.from('product_images').select('*').eq('product_id', id).order('position');
      if (imgs && imgs.length) setImages(imgs.map((i: ProductImage) => ({ id: i.id, url: i.url, alt_text: i.alt_text ?? '', position: i.position })));

      const { data: vars } = await supabase.from('product_variants').select('*').eq('product_id', id);
      if (vars && vars.length) {
        setLoadedVariantIds(vars.map((v) => v.id));
        setVariants(vars.map((v: ProductVariant) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku ?? '',
          stock: String(v.stock),
          price_override: v.price_override ? (v.price_override / 100).toFixed(2) : '',
          printful_sync_variant_id: v.printful_sync_variant_id ? String(v.printful_sync_variant_id) : '',
        })));
      }
    })();
  }, [id]);

  const save = async () => {
    if (saving) return;

    if (!form.name.trim()) {
      setSaveError('Product name is required');
      return;
    }

    if (variants.some((variant) => {
      if (!variant.printful_sync_variant_id.trim()) return false;
      const id = Number(variant.printful_sync_variant_id);
      return !Number.isSafeInteger(id) || id <= 0;
    })) {
      setSaveError('Printful sync variant IDs must be positive whole numbers.');
      return;
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

      const imgPayloads = images.filter((i) => i.url.trim()).map((i, idx) => ({
        product_id: productId, url: i.url.trim(), alt_text: i.alt_text || null, position: idx,
      }));
      if (imgPayloads.length) {
        const { error: imgInsertError } = await supabase.from('product_images').insert(imgPayloads);
        if (imgInsertError) throw imgInsertError;
      }

      if (isEdit) {
        const validImgPositions = imgPayloads.map((_, idx) => idx);
        const { error: imgDeleteError } = await supabase
          .from('product_images')
          .delete()
          .eq('product_id', productId)
          .not('position', 'in', `(${validImgPositions.join(',')})`);
        if (imgDeleteError) throw imgDeleteError;
      }

      const varPayloads = variants
        .filter((variant) => variant.size.trim() && variant.color.trim())
        .map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          product_id: productId,
          size: variant.size.trim(),
          color: variant.color.trim(),
          sku: variant.sku || null,
          stock: parseInt(variant.stock || '0'),
          price_override: variant.price_override ? Math.round(parseFloat(variant.price_override) * 100) : null,
          printful_sync_variant_id: variant.printful_sync_variant_id.trim()
            ? Number(variant.printful_sync_variant_id)
            : null,
        }));
      let savedVariantIds: string[] = [];
      if (varPayloads.length) {
        const { data: savedVariants, error: varInsertError } = await supabase
          .from('product_variants')
          .upsert(varPayloads, { onConflict: 'id' })
          .select('id');
        if (varInsertError) throw varInsertError;
        savedVariantIds = savedVariants?.map((variant) => variant.id) ?? [];
      }

      if (isEdit) {
        const removedVariantIds = loadedVariantIds.filter((variantId) => !savedVariantIds.includes(variantId));
        if (removedVariantIds.length > 0) {
          const { error: varDeleteError } = await supabase
            .from('product_variants')
            .delete()
            .in('id', removedVariantIds);
          if (varDeleteError) throw varDeleteError;
        }
      }

      setLoadedVariantIds(savedVariantIds);
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
            <p className="text-xs text-slate-400 mb-3">Paste image URLs. Upload via Supabase Storage when configured.</p>
            {images.map((img, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={img.url} onChange={(e) => setImages(images.map((im, idx) => idx === i ? { ...im, url: e.target.value } : im))} className="admin-input flex-1" placeholder="https://image-url.jpg" />
                <input value={img.alt_text} onChange={(e) => setImages(images.map((im, idx) => idx === i ? { ...im, alt_text: e.target.value } : im))} className="admin-input w-32" placeholder="Alt text" />
                <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="p-2 hover:bg-red-100 rounded text-red-500"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setImages([...images, { url: '', alt_text: '', position: images.length }])} className="text-sm text-accent flex items-center gap-1 mt-2"><Plus size={14} /> Add image</button>
          </Section>

          {/* Variants */}
          <Section title="Variants (Size / Colour / Stock)">
            <p className="text-xs text-slate-400 mb-3">Add each matching Printful sync variant ID from your linked Printful store. The shop SKU is not a Printful ID.</p>
            {variants.map((v, i) => (
              <div key={v.id ?? i} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-2">
                <input value={v.size} onChange={(e) => setVariants(variants.map((vr, idx) => idx === i ? { ...vr, size: e.target.value } : vr))} className="admin-input" placeholder="Size" />
                <input value={v.color} onChange={(e) => setVariants(variants.map((vr, idx) => idx === i ? { ...vr, color: e.target.value } : vr))} className="admin-input" placeholder="Colour" />
                <input value={v.stock} onChange={(e) => setVariants(variants.map((vr, idx) => idx === i ? { ...vr, stock: e.target.value } : vr))} className="admin-input" placeholder="Stock" type="number" />
                <input value={v.price_override} onChange={(e) => setVariants(variants.map((vr, idx) => idx === i ? { ...vr, price_override: e.target.value } : vr))} className="admin-input" placeholder="Price override" type="number" step="0.01" />
                <input value={v.printful_sync_variant_id} onChange={(e) => setVariants(variants.map((vr, idx) => idx === i ? { ...vr, printful_sync_variant_id: e.target.value } : vr))} className="admin-input" placeholder="Printful sync ID" type="number" min="1" step="1" aria-label={`Printful sync variant ID for ${v.color} size ${v.size}`} />
                <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="p-2 hover:bg-red-100 rounded text-red-500"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setVariants([...variants, { size: '', color: '', sku: '', stock: '0', price_override: '', printful_sync_variant_id: '' }])} className="text-sm text-accent flex items-center gap-1 mt-2"><Plus size={14} /> Add variant</button>
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

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : saved ? 'Saved!' : <><Save size={14} /> Save Product</>}
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
