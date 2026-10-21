import type { Result } from '@engine/validation.js';
import { ok, err } from '@engine/validation.js';
import type { MusicContentReader, ReleaseRecord, TrackRecord, CampaignRecord } from '@engine/contracts/music.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeDbError } from './utils';

export class SupabaseMusicContentReader implements MusicContentReader {
  constructor(private readonly db: SupabaseClient) {}

  async getReleaseById(id: string): Promise<Result<ReleaseRecord | null>> {
    try {
      const { data: release, error } = await this.db
        .from('music_releases')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return err(decodeDbError(error));
      if (!release) return ok(null);

      const { data: tracks, error: trackError } = await this.db
        .from('tracks')
        .select('*')
        .eq('release_id', id)
        .order('position');

      if (trackError) return err(decodeDbError(trackError));

      const mappedTracks = (tracks ?? []).map((t) => this.mapTrack(t));
      return ok({
        id: release.id,
        title: release.title,
        artist: release.artist,
        type: release.release_type as ReleaseRecord['type'],
        status: this.normalizeStatus(release.status),
        releaseDate: release.release_date ?? new Date().toISOString(),
        tracks: mappedTracks,
        createdAt: release.created_at ?? new Date().toISOString(),
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listReleases(opts?: { status?: ReleaseRecord['status'] }): Promise<Result<ReleaseRecord[]>> {
    try {
      let query = this.db.from('music_releases').select('*');
      if (opts?.status) {
        query = query.eq('status', opts.status);
      }
      const { data: releases, error } = await query.order('created_at', { ascending: false });
      if (error) return err(decodeDbError(error));

      const results: ReleaseRecord[] = [];
      for (const r of releases ?? []) {
        const { data: tracks } = await this.db
          .from('tracks')
          .select('*')
          .eq('release_id', r.id)
          .order('position');
        results.push({
          id: r.id,
          title: r.title,
          artist: r.artist,
          type: r.release_type as ReleaseRecord['type'],
          status: this.normalizeStatus(r.status),
          releaseDate: r.release_date ?? new Date().toISOString(),
          tracks: (tracks ?? []).map((t) => this.mapTrack(t)),
          createdAt: r.created_at ?? new Date().toISOString(),
        });
      }
      return ok(results);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listCampaigns(opts?: { status?: CampaignRecord['status'] }): Promise<Result<CampaignRecord[]>> {
    try {
      let query = this.db.from('campaigns').select('*');
      if (opts?.status) {
        query = query.eq('status', opts.status);
      }
      const { data: campaigns, error } = await query;
      if (error) return err(decodeDbError(error));

      return ok((campaigns ?? []).map((c) => ({
        id: c.id,
        title: c.name,
        status: this.normalizeCampaignStatus(c.status),
        startsAt: c.start_date ?? new Date().toISOString(),
        endsAt: c.end_date ?? new Date().toISOString(),
      })));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private mapTrack(t: Record<string, unknown>): TrackRecord {
    return {
      id: t.id as string,
      releaseId: t.release_id as string,
      title: t.title as string,
      position: t.position as number,
      durationSeconds: this.parseDurationToSeconds(t.duration as string | null),
      isrc: t.isrc as string | undefined,
      mediaUrl: t.preview_url as string | undefined,
    };
  }

  private parseDurationToSeconds(duration: string | null): number {
    if (!duration) return 0;
    const parts = duration.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0] ?? '0', 10);
      const secs = parseInt(parts[1] ?? '0', 10);
      if (!isNaN(mins) && !isNaN(secs)) return mins * 60 + secs;
    }
    const num = parseFloat(duration);
    return isNaN(num) ? 0 : num;
  }

  private normalizeStatus(dbStatus: string): ReleaseRecord['status'] {
    const s = dbStatus.toLowerCase();
    if (s === 'draft') return 'draft';
    if (s === 'scheduled' || s === 'upcoming') return 'scheduled';
    if (s === 'published') return 'published';
    if (s === 'archived') return 'archived';
    return 'draft';
  }

  private normalizeCampaignStatus(dbStatus: string): CampaignRecord['status'] {
    const s = dbStatus.toLowerCase();
    if (s === 'draft') return 'draft';
    if (s === 'scheduled' || s === 'live') return 'scheduled';
    if (s === 'ended' || s === 'archived') return 'ended';
    return 'draft';
  }
}
