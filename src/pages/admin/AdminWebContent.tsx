import { useCallback, useEffect, useState } from 'react';
import { Calendar, ExternalLink, FileText, ImagePlus, Newspaper, Pencil, Plus, Save, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PageHeader, SectionCard } from '@/components/admin/ui';

export type WebContentKind = 'news' | 'videos' | 'events' | 'campaigns';
type FieldKind = 'text' | 'url' | 'textarea' | 'datetime-local' | 'image';
type FieldConfig = { name: string; label: string; kind?: FieldKind; required?: boolean; help?: string };
type ContentRow = Record<string, unknown> & { id: string; status: string };
type Draft = Record<string, string>;

const configurations: Record<WebContentKind, {
  title: string;
  singular: string;
  sort: string;
  statuses: Array<{ value: string; label: string }>;
  fields: FieldConfig[];
}> = {
  news: {
    title: 'News', singular: 'article', sort: 'published_at',
    statuses: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }],
    fields: [
      { name: 'title', label: 'Headline', required: true },
      { name: 'slug', label: 'Page URL slug', required: true, help: 'Use lowercase words separated by hyphens.' },
      { name: 'excerpt', label: 'Short summary', kind: 'textarea' },
      { name: 'body', label: 'Article text', kind: 'textarea', required: true },
      { name: 'cover_image_url', label: 'Cover image', kind: 'image' },
      { name: 'author', label: 'Author' },
      { name: 'published_at', label: 'Publish date', kind: 'datetime-local' },
    ],
  },
  videos: {
    title: 'Music videos', singular: 'video', sort: 'release_date',
    statuses: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }],
    fields: [
      { name: 'title', label: 'Video title', required: true },
      { name: 'slug', label: 'Page URL slug', required: true },
      { name: 'youtube_id', label: 'YouTube video ID', help: 'Paste the ID from the video URL, not the full URL.' },
      { name: 'thumbnail_url', label: 'Thumbnail image', kind: 'image' },
      { name: 'description', label: 'Description', kind: 'textarea' },
      { name: 'release_date', label: 'Release date', kind: 'datetime-local' },
    ],
  },
  events: {
    title: 'Events', singular: 'event', sort: 'event_date',
    statuses: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }],
    fields: [
      { name: 'name', label: 'Event name', required: true },
      { name: 'venue', label: 'Venue' },
      { name: 'city', label: 'City' },
      { name: 'event_date', label: 'Event date', kind: 'datetime-local' },
      { name: 'event_image_url', label: 'Event image', kind: 'image' },
      { name: 'ticket_url', label: 'Ticket link', kind: 'url' },
    ],
  },
  campaigns: {
    title: 'Campaigns', singular: 'campaign', sort: 'launch_date',
    statuses: [{ value: 'draft', label: 'Draft' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'live', label: 'Live' }, { value: 'ended', label: 'Ended' }, { value: 'archived', label: 'Archived' }],
    fields: [
      { name: 'name', label: 'Campaign name', required: true },
      { name: 'slug', label: 'Page URL slug', required: true },
      { name: 'description', label: 'Description', kind: 'textarea' },
      { name: 'hero_image_url', label: 'Campaign image', kind: 'image' },
      { name: 'launch_date', label: 'Launch date', kind: 'datetime-local' },
      { name: 'start_date', label: 'Start date', kind: 'datetime-local' },
      { name: 'end_date', label: 'End date', kind: 'datetime-local' },
      { name: 'discount_code', label: 'Discount code' },
    ],
  },
};

const tableFor: Record<WebContentKind, 'news_articles' | 'music_videos' | 'events' | 'campaigns'> = {
  news: 'news_articles', videos: 'music_videos', events: 'events', campaigns: 'campaigns',
};

const titleField: Record<WebContentKind, string> = { news: 'title', videos: 'title', events: 'name', campaigns: 'name' };
function slugify(value: string) {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toInputDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
}

function fromDraftDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function valueFor(row: ContentRow, name: string) {
  const value = row[name];
  if (name.endsWith('_date') || name === 'published_at') return toInputDate(value);
  return typeof value === 'string' ? value : '';
}

function draftFor(kind: WebContentKind, row?: ContentRow): Draft {
  const config = configurations[kind];
  const draft: Draft = { id: row?.id ?? '', status: row?.status ?? 'draft' };
  for (const field of config.fields) draft[field.name] = row ? valueFor(row, field.name) : '';
  if (kind === 'news' && !draft.published_at) draft.published_at = new Date().toISOString().slice(0, 16);
  if (kind === 'news' && !draft.author) draft.author = 'AB16';
  return draft;
}

function displayDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'No date set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No date set' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminWebContent({ kind }: { kind: WebContentKind }) {
  const config = configurations[kind];
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const table = tableFor[kind];
    const { data, error: queryError } = await supabase.from(table).select('*').order(config.sort, { ascending: false, nullsFirst: false });
    if (queryError) setError('Could not load this website content. Confirm admin access and try again.');
    else setRows((data ?? []) as unknown as ContentRow[]);
    setLoading(false);
  }, [config.sort, kind]);

  useEffect(() => { void load(); }, [load]);

  const setValue = (name: string, value: string) => setDraft((current) => {
    if (!current) return current;
    const next = { ...current, [name]: value };
    if (name === titleField[kind] && !current.id && !current.slug) next.slug = slugify(value);
    return next;
  });

  const uploadImage = async (fieldName: string, file?: File) => {
    if (!file || !draft) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setError('Choose a JPG, PNG, WebP, or AVIF image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Images must be 10 MB or smaller.');
      return;
    }
    setUploading(fieldName);
    try {
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'site-image';
      const path = `site-content/${kind}/${crypto.randomUUID()}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      setDraft((current) => current ? { ...current, [fieldName]: url } : current);
    } catch {
      setError('Image upload failed. Check the public product-images storage setup and try again.');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!draft || saving) return;
    setError(null);
    setNotice(null);
    const missing = config.fields.find((field) => field.required && !draft[field.name]?.trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    const title = draft[titleField[kind]].trim();
    const slug = kind === 'events' ? '' : slugify(draft.slug || title);
    if (kind !== 'events' && !slug) {
      setError('Enter a valid page URL slug.');
      return;
    }
    const payload: Record<string, string | null> = { status: draft.status };
    for (const field of config.fields) {
      const value = draft[field.name]?.trim() ?? '';
      if (field.kind === 'datetime-local') payload[field.name] = fromDraftDate(value);
      else payload[field.name] = value || null;
    }
    if (kind !== 'events') payload.slug = slug;
    setSaving(true);
    try {
      const table = tableFor[kind];
      const query = draft.id
        ? supabase.from(table).update(payload as never).eq('id', draft.id)
        : supabase.from(table).insert(payload as never);
      const { error: saveError } = await query;
      if (saveError) throw saveError;
      setDraft(null);
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} saved as ${draft.status}.`);
      await load();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '';
      setError(message.includes('duplicate') || message.includes('unique') ? 'That page URL is already in use. Choose a different slug.' : `Could not save this ${config.singular}. Check the required fields and admin access.`);
    } finally {
      setSaving(false);
    }
  };

  const RowIcon = kind === 'news' ? Newspaper : kind === 'videos' ? Video : kind === 'events' ? Calendar : FileText;
  const getRowTitle = (row: ContentRow) => String(row[titleField[kind]] ?? 'Untitled');

  return (
    <div>
      <PageHeader title={config.title} subtitle={`Manage ${config.title.toLowerCase()} shown on the public website.`} action={<div className="flex flex-wrap gap-2"><Link to="/admin" className="btn-outline">Admin Desk</Link><button type="button" onClick={() => { setError(null); setDraft(draftFor(kind)); }} className="btn-primary"><Plus size={15} /> New {config.singular}</button></div>} />
      {error && <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      <SectionCard title={`${rows.length} ${rows.length === 1 ? config.singular : `${config.singular}s`}`}>
        {loading ? <p role="status" className="text-sm text-slate-500">Loading website content…</p> : rows.length === 0 ? (
          <div className="py-10 text-center"><RowIcon size={30} className="mx-auto text-slate-300" /><p className="mt-3 font-medium text-slate-700">Nothing here yet</p><p className="mt-1 text-sm text-slate-500">Add a draft, check it on the site, then publish when it is ready.</p><button type="button" onClick={() => setDraft(draftFor(kind))} className="btn-primary mt-4"><Plus size={15} /> Create {config.singular}</button></div>
        ) : (
          <div className="divide-y divide-slate-100">{rows.map((row) => <article key={row.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-slate-900">{getRowTitle(row)}</h3><span className={`badge ${row.status === 'published' || row.status === 'live' ? 'bg-green-100 text-green-700' : row.status === 'archived' || row.status === 'ended' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>{row.status}</span></div><p className="mt-1 text-xs text-slate-500">{displayDate(row[config.sort])}{typeof row.slug === 'string' && row.slug ? ` · /${kind === 'news' ? 'music/news' : kind === 'videos' ? 'music/videos' : kind}/${row.slug}` : kind === 'events' ? ' · /music/events' : ''}</p></div>
            <button type="button" onClick={() => { setError(null); setDraft(draftFor(kind, row)); }} className="inline-flex w-fit items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><Pencil size={14} /> Edit</button>
          </article>)}</div>
        )}
      </SectionCard>

      {draft && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !uploading) setDraft(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="content-editor-title" className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6"><div><h2 id="content-editor-title" className="text-xl font-bold text-slate-900">{draft.id ? `Edit ${config.singular}` : `New ${config.singular}`}</h2><p className="mt-1 text-sm text-slate-500">New items start as drafts. Preview before publishing.</p></div><button type="button" onClick={() => setDraft(null)} disabled={saving || Boolean(uploading)} aria-label="Close editor" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">×</button></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">{config.fields.map((field) => <div key={field.name} className={field.kind === 'textarea' || field.kind === 'image' ? 'sm:col-span-2' : ''}>
            <label htmlFor={`web-content-${field.name}`} className="mb-1.5 block text-xs font-semibold text-slate-600">{field.label}{field.required ? ' *' : ''}</label>
            {field.kind === 'textarea' ? <textarea id={`web-content-${field.name}`} required={field.required} value={draft[field.name] ?? ''} onChange={(event) => setValue(field.name, event.target.value)} rows={field.name === 'body' ? 8 : 3} className="admin-input resize-y" /> : field.kind === 'image' ? <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><input id={`web-content-${field.name}`} type="url" value={draft[field.name] ?? ''} onChange={(event) => setValue(field.name, event.target.value)} className="admin-input min-w-48 flex-1" placeholder="Paste image URL or upload a file" /><label className={`inline-flex cursor-pointer items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 ${uploading === field.name ? 'opacity-50' : ''}`}><ImagePlus size={15} />{uploading === field.name ? 'Uploading…' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={Boolean(uploading)} onChange={(event) => { void uploadImage(field.name, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div>{field.help && <p className="text-xs text-slate-500">{field.help}</p>}{draft[field.name] && <img src={draft[field.name]} alt="Content preview" className="max-h-40 rounded border border-slate-200 object-contain" />}</div> : <input id={`web-content-${field.name}`} type={field.kind ?? 'text'} required={field.required} value={draft[field.name] ?? ''} onChange={(event) => setValue(field.name, event.target.value)} className="admin-input" placeholder={field.name === 'slug' ? 'auto-filled-from-title' : ''} />}
            {field.help && field.kind !== 'image' && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
          </div>)}
            <div className="sm:col-span-2"><label htmlFor="web-content-status" className="mb-1.5 block text-xs font-semibold text-slate-600">Status</label><select id="web-content-status" value={draft.status} onChange={(event) => setValue('status', event.target.value)} className="admin-input">{config.statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><p className="mt-1 text-xs text-slate-500">Publishing makes this item visible on the public website.</p></div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-5 sm:p-6"><button type="button" onClick={() => setDraft(null)} disabled={saving || Boolean(uploading)} className="btn-outline">Cancel</button><button type="button" onClick={() => void save()} disabled={saving || Boolean(uploading)} className="btn-primary"><Save size={15} />{saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save draft'}</button></div>
        </section>
      </div>}
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500"><Link to="/admin" className="hover:text-slate-900">← Back to Admin Desk</Link><a href={kind === 'news' ? '/music/news' : kind === 'videos' ? '/music/videos' : kind === 'events' ? '/music/events' : '/shop'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-slate-900">View public page <ExternalLink size={12} /></a></div>
    </div>
  );
}

export function AdminContentHome() {
  const areas = [
    { label: 'Homepage & business details', description: 'Hero, announcement bar, socials and support details.', href: '/admin/settings', icon: FileText },
    { label: 'Products & upload guide', description: 'Product photos, variants, SKU mapping and sale readiness.', href: '/admin/uploads', icon: ImagePlus },
    { label: 'Music releases', description: 'Release artwork, tracklists and streaming links.', href: '/admin/releases', icon: Video },
    { label: 'Music videos', description: 'Video details, thumbnails and publishing status.', href: '/admin/videos', icon: Video },
    { label: 'News articles', description: 'Write, draft, preview and publish site news.', href: '/admin/news', icon: Newspaper },
    { label: 'Events', description: 'Event listings, images, dates and ticket links.', href: '/admin/events', icon: Calendar },
    { label: 'Campaigns', description: 'Homepage campaign artwork, launch dates and status.', href: '/admin/campaigns', icon: FileText },
  ];
  return <div><PageHeader title="Website content" subtitle="Edit public-facing content from the Admin Desk." action={<Link to="/admin" className="btn-outline">Admin Desk</Link>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{areas.map(({ label, description, href, icon: Icon }) => <Link key={href} to={href} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"><Icon size={20} className="mb-4 text-slate-500" /><h2 className="font-semibold text-slate-900">{label}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></Link>)}</div><p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Store terms, privacy, shipping and returns copy still needs approved business wording before launch.</p></div>;
}
