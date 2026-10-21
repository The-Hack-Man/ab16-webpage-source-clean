import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, ArrowLeft, Plus, X, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Track } from '@/types';

interface TrackRow { id?: string; title: string; position: number; duration: string; explicit: boolean; preview_url: string; }

export function AdminReleaseEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '', slug: '', artist: 'JAMIE G', featured_artists: '', cover_art_url: '',
    release_type: 'single', release_date: '', status: 'draft', description: '',
    spotify_url: '', apple_music_url: '', youtube_url: '', soundcloud_url: '',
    tidal_url: '', bandcamp_url: '', pre_save_url: '', label: '', copyright: '',
    explicit: false, accent_color: '', countdown_visible: true, countdown_timezone: 'Europe/London', announcement_text: '',
  });

  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: rel } = await supabase.from('music_releases').select('*').eq('id', id).maybeSingle();
      if (rel) {
        setForm({
          title: rel.title ?? '', slug: rel.slug ?? '', artist: rel.artist ?? 'JAMIE G', featured_artists: rel.featured_artists ?? '',
          cover_art_url: rel.cover_art_url ?? '', release_type: rel.release_type ?? 'single',
          release_date: rel.release_date ? new Date(rel.release_date).toISOString().slice(0, 16) : '',
          status: rel.status ?? 'draft', description: rel.description ?? '',
          spotify_url: rel.spotify_url ?? '', apple_music_url: rel.apple_music_url ?? '',
          youtube_url: rel.youtube_url ?? '', soundcloud_url: rel.soundcloud_url ?? '',
          tidal_url: rel.tidal_url ?? '', bandcamp_url: rel.bandcamp_url ?? '',
          pre_save_url: rel.pre_save_url ?? '', label: rel.label ?? '', copyright: rel.copyright ?? '',
          explicit: rel.explicit ?? false, accent_color: rel.accent_color ?? '', countdown_visible: rel.countdown_visible ?? true, countdown_timezone: rel.countdown_timezone ?? 'Europe/London', announcement_text: rel.announcement_text ?? '',
        });
      }
      const { data: tr } = await supabase.from('tracks').select('*').eq('release_id', id).order('position');
      if (tr && tr.length) setTracks(tr.map((t: Track) => ({ id: t.id, title: t.title, position: t.position, duration: t.duration ?? '', explicit: t.explicit, preview_url: t.preview_url ?? '' })));
    })();
  }, [id]);

  const save = async () => {
    if (saving) return;

    if (!form.title.trim()) {
      setSaveError('Release title is required');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const slug = form.slug.trim() || form.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      if (!slug) {
        setSaveError('Could not generate a valid slug — please enter one manually');
        return;
      }

      const payload = {
        title: form.title, slug, artist: form.artist, featured_artists: form.featured_artists || null,
        cover_art_url: form.cover_art_url || null, release_type: form.release_type,
        release_date: form.release_date || null, status: form.status, description: form.description || null,
        spotify_url: form.spotify_url || null, apple_music_url: form.apple_music_url || null,
        youtube_url: form.youtube_url || null, soundcloud_url: form.soundcloud_url || null,
        tidal_url: form.tidal_url || null, bandcamp_url: form.bandcamp_url || null,
        pre_save_url: form.pre_save_url || null, label: form.label || null, copyright: form.copyright || null,
        explicit: form.explicit, accent_color: form.accent_color || null, countdown_visible: form.countdown_visible, countdown_timezone: form.countdown_timezone, announcement_text: form.announcement_text || null,
      };

      let releaseId = id;

      if (isEdit) {
        const { error } = await supabase
          .from('music_releases')
          .update(payload)
          .eq('id', id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
      } else {
        const { data: newRel, error } = await supabase
          .from('music_releases')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!newRel?.id) throw new Error('Release was inserted but no ID was returned');
        releaseId = newRel.id;
      }

      if (!releaseId) throw new Error('Could not determine release ID');

      const validTracks = tracks.filter((t) => t.title.trim());
      const trackPayloads = validTracks.map((t, idx) => ({
        release_id: releaseId, title: t.title.trim(), position: idx + 1, duration: t.duration || null,
        explicit: t.explicit, preview_url: t.preview_url || null,
      }));

      if (trackPayloads.length) {
        const { error: trackInsertError } = await supabase.from('tracks').insert(trackPayloads);
        if (trackInsertError) throw trackInsertError;
      }

      if (isEdit) {
        const validPositions = validTracks.map((_, idx) => idx + 1);
        if (validPositions.length) {
          const { error: staleTrackError } = await supabase
            .from('tracks')
            .delete()
            .eq('release_id', releaseId)
            .not('position', 'in', `(${validPositions.join(',')})`);
          if (staleTrackError) throw staleTrackError;
        }
      }

      setSaved(true);
      setTimeout(() => navigate('/admin/releases'), 1500);
    } catch (err) {
      const supabaseErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const message = supabaseErr?.message
        ? `${supabaseErr.message}${supabaseErr.details ? ` — ${supabaseErr.details}` : ''}`
        : 'Failed to save release — check the console for details';
      setSaveError(message);
      console.error('Release save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const publishRelease = async () => {
    if (publishing) return;

    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be signed in to publish releases');
      }

      const res = await fetch('/api/publish-release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          releaseId: id,
          pushToStreaming: false,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Publish request failed');
      }

      if (result.result?.affectedPaths) {
        setPublishSuccess(true);
        setTimeout(() => {
          setPublishSuccess(false);
          navigate('/admin/releases');
        }, 2000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish release';
      setPublishError(message);
      console.error('Release publish error:', err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <Link to="/admin/releases" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-jet mb-4"><ArrowLeft size={16} /> Back to Releases</Link>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Release' : 'New Release'}</h1>

      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        <div className="space-y-6">
          <Section title="Release Details">
            <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="admin-input" /></Field>
            <Field label="Slug (URL)"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input" placeholder="auto-generated" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Artist"><input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} className="admin-input" /></Field>
              <Field label="Featured Artists"><input value={form.featured_artists} onChange={(e) => setForm({ ...form, featured_artists: e.target.value })} className="admin-input" placeholder="optional" /></Field>
            </div>
            <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="admin-input resize-none" /></Field>
            <Field label="Cover Art URL"><input value={form.cover_art_url} onChange={(e) => setForm({ ...form, cover_art_url: e.target.value })} className="admin-input" placeholder="https://…" /></Field>
          </Section>

          <Section title="Streaming Links">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Spotify URL"><input value={form.spotify_url} onChange={(e) => setForm({ ...form, spotify_url: e.target.value })} className="admin-input" /></Field>
              <Field label="Apple Music URL"><input value={form.apple_music_url} onChange={(e) => setForm({ ...form, apple_music_url: e.target.value })} className="admin-input" /></Field>
              <Field label="YouTube URL"><input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} className="admin-input" /></Field>
              <Field label="SoundCloud URL"><input value={form.soundcloud_url} onChange={(e) => setForm({ ...form, soundcloud_url: e.target.value })} className="admin-input" /></Field>
              <Field label="Tidal URL"><input value={form.tidal_url} onChange={(e) => setForm({ ...form, tidal_url: e.target.value })} className="admin-input" /></Field>
              <Field label="Bandcamp URL"><input value={form.bandcamp_url} onChange={(e) => setForm({ ...form, bandcamp_url: e.target.value })} className="admin-input" /></Field>
              <Field label="Pre-save URL"><input value={form.pre_save_url} onChange={(e) => setForm({ ...form, pre_save_url: e.target.value })} className="admin-input" /></Field>
            </div>
          </Section>

          <Section title="Tracklist">
            {tracks.map((t, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <span className="text-xs text-slate-400 w-6">{i + 1}</span>
                <input value={t.title} onChange={(e) => setTracks(tracks.map((tr, idx) => idx === i ? { ...tr, title: e.target.value } : tr))} className="admin-input flex-1" placeholder="Track title" />
                <input value={t.duration} onChange={(e) => setTracks(tracks.map((tr, idx) => idx === i ? { ...tr, duration: e.target.value } : tr))} className="admin-input w-20" placeholder="3:42" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={t.explicit} onChange={(e) => setTracks(tracks.map((tr, idx) => idx === i ? { ...tr, explicit: e.target.checked } : tr))} className="accent-jet" /> E</label>
                <button onClick={() => setTracks(tracks.filter((_, idx) => idx !== i))} className="p-2 hover:bg-red-100 rounded text-red-500"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setTracks([...tracks, { title: '', position: tracks.length + 1, duration: '', explicit: false, preview_url: '' }])} className="text-sm text-accent flex items-center gap-1 mt-2"><Plus size={14} /> Add track</button>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Status & Metadata">
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="admin-input cursor-pointer">
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="upcoming">Upcoming</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Release Type">
              <select value={form.release_type} onChange={(e) => setForm({ ...form, release_type: e.target.value })} className="admin-input cursor-pointer">
                <option value="single">Single</option><option value="ep">EP</option><option value="album">Album</option>
                <option value="mixtape">Mixtape</option><option value="deluxe">Deluxe</option><option value="feature">Feature</option>
                <option value="remix">Remix</option><option value="instrumental">Instrumental</option>
              </select>
            </Field>
            <Field label="Release Date"><input type="datetime-local" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} className="admin-input" /></Field>
            <Field label="Countdown timezone"><input value={form.countdown_timezone} onChange={(e) => setForm({ ...form, countdown_timezone: e.target.value })} className="admin-input" placeholder="Europe/London" /></Field>
            <Field label="Announcement text"><textarea value={form.announcement_text} onChange={(e) => setForm({ ...form, announcement_text: e.target.value })} rows={2} className="admin-input resize-none" /></Field>
            <Toggle label="Show countdown" checked={form.countdown_visible} onChange={(v) => setForm({ ...form, countdown_visible: v })} />
            <Field label="Accent Colour (hex)"><input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="admin-input" placeholder="#080808" /></Field>
            <Field label="Label"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="admin-input" /></Field>
            <Field label="Copyright"><input value={form.copyright} onChange={(e) => setForm({ ...form, copyright: e.target.value })} className="admin-input" /></Field>
            <Toggle label="Explicit Content" checked={form.explicit} onChange={(v) => setForm({ ...form, explicit: v })} />
          </Section>

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : saved ? 'Saved!' : <><Save size={14} /> Save Release</>}
          </button>
          {saveError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {saveError}
            </div>
          )}

          {isEdit && (
            <>
              <button
                onClick={publishRelease}
                disabled={publishing || form.status === 'published'}
                className="btn-outline w-full mt-4"
              >
                {publishing ? 'Publishing…' : publishSuccess ? 'Published!' : <><Upload size={14} /> Publish to Site</>}
              </button>
              {publishError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {publishError}
                </div>
              )}
            </>
          )}
        </div>
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
