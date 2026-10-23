import type { Result } from '@engine/validation.js';
import { ok, err } from '@engine/validation.js';
import type { MusicPublicationService, ReleaseRecord } from '@engine/contracts/music.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeDbError } from './utils';

export class SupabaseMusicPublicationService implements MusicPublicationService {
  constructor(private readonly db: SupabaseClient) {}

  async publish(releaseId: string): Promise<Result<ReleaseRecord>> {
    try {
      const { error } = await this.db
        .from('music_releases')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', releaseId);

      if (error) return err(decodeDbError(error));

      return await this.fetchRelease(releaseId);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async schedule(releaseId: string, publishAt: string): Promise<Result<ReleaseRecord>> {
    try {
      const { error } = await this.db
        .from('music_releases')
        .update({
          status: 'scheduled',
          release_date: publishAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', releaseId);

      if (error) return err(decodeDbError(error));

      return await this.fetchRelease(releaseId);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private async fetchRelease(releaseId: string): Promise<Result<ReleaseRecord>> {
    const { data: release, error: relErr } = await this.db
      .from('music_releases')
      .select('*')
      .eq('id', releaseId)
      .maybeSingle();

    if (relErr) return err(decodeDbError(relErr));
    if (!release) return err(new Error(`Release ${releaseId} not found`));

    const { data: tracks, error: trErr } = await this.db
      .from('tracks')
      .select('*')
      .eq('release_id', releaseId)
      .order('position');

    if (trErr) return err(decodeDbError(trErr));

    return ok({
      id: release.id,
      title: release.title,
      artist: release.artist,
      type: release.release_type as ReleaseRecord['type'],
      status: normalizeStatus(release.status),
      releaseDate: release.release_date ?? new Date().toISOString(),
      tracks: (tracks ?? []).map(mapTrack),
      createdAt: release.created_at ?? new Date().toISOString(),
    });
  }
}

function mapTrack(t: Record<string, unknown>): ReleaseRecord['tracks'][number] {
  const duration = t.duration as string | null;
  let durationSeconds = 0;
  if (duration) {
    const parts = duration.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0] ?? '0', 10);
      const secs = parseInt(parts[1] ?? '0', 10);
      durationSeconds = mins * 60 + secs;
    } else {
      const num = parseFloat(duration);
      durationSeconds = isNaN(num) ? 0 : num;
    }
  }
  return {
    id: t.id as string,
    releaseId: t.release_id as string,
    position: t.position as number,
    title: t.title as string,
    durationSeconds,
    isrc: t.isrc as string | undefined,
    mediaUrl: t.preview_url as string | undefined,
  };
}

function normalizeStatus(dbStatus: string): ReleaseRecord['status'] {
  const s = dbStatus.toLowerCase();
  if (s === 'draft') return 'draft';
  if (s === 'scheduled' || s === 'upcoming') return 'scheduled';
  if (s === 'published') return 'published';
  if (s === 'archived') return 'archived';
  return 'draft';
}
