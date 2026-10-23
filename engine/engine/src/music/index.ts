import type { Result } from '../validation.js';
import { ok, err } from '../validation.js';
import type {
  MusicContentReader,
  MusicPublicationService,
  ReleaseRecord,
  TrackRecord,
  CampaignRecord,
  ReleaseStatus,
  ReleaseType,
  CampaignStatus,
} from '../contracts/music.js';

export type MusicConfig = {
  minScheduleLeadMs: number;
};

export class MusicService {
  constructor(private readonly config: MusicConfig) {}

  getConfig(): MusicConfig {
    return this.config;
  }

  validateReleaseStatus(status: string): Result<ReleaseStatus> {
    const validStatuses: ReleaseStatus[] = ['draft', 'scheduled', 'upcoming', 'published', 'archived'];
    if (validStatuses.includes(status as ReleaseStatus)) {
      return ok(status as ReleaseStatus);
    }
    return err(`Invalid release status: ${status}`);
  }

  validateReleaseType(type: string): Result<ReleaseType> {
    const validTypes: ReleaseType[] = ['single', 'ep', 'album', 'video'];
    if (validTypes.includes(type as ReleaseType)) {
      return ok(type as ReleaseType);
    }
    return err(`Invalid release type: ${type}`);
  }

  validateCampaignStatus(status: string): Result<CampaignStatus> {
    const validStatuses: CampaignStatus[] = ['draft', 'scheduled', 'live', 'ended', 'archived'];
    if (validStatuses.includes(status as CampaignStatus)) {
      return ok(status as CampaignStatus);
    }
    return err(`Invalid campaign status: ${status}`);
  }

  normalizeReleaseRecord(
    release: Record<string, unknown>,
    tracks: Record<string, unknown>[] = [],
  ): ReleaseRecord {
    return {
      id: release.id as string,
      title: release.title as string,
      artist: release.artist as string,
      type: (release.release_type ?? 'album') as ReleaseType,
      status: this.normalizeStatus((release.status ?? 'draft') as string),
      releaseDate: (release.release_date ?? release.scheduled_for ?? new Date().toISOString()) as string,
      tracks: tracks.map((t) => this.mapTrack(t)),
      createdAt: (release.created_at ?? new Date().toISOString()) as string,
    };
  }

  private normalizeStatus(status: string): ReleaseStatus {
    const s = status.toLowerCase();
    if (s === 'draft') return 'draft';
    if (s === 'scheduled' || s === 'upcoming') return 'scheduled';
    if (s === 'published') return 'published';
    if (s === 'archived') return 'archived';
    return 'draft';
  }

  private mapTrack(t: Record<string, unknown>): TrackRecord {
    return {
      id: t.id as string,
      releaseId: t.release_id as string,
      position: (t.position ?? 0) as number,
      title: t.title as string,
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

  normalizeCampaignRecord(c: Record<string, unknown>): CampaignRecord {
    return {
      id: c.id as string,
      title: c.name as string,
      status: c.status as CampaignStatus,
      startsAt: (c.start_date ?? new Date().toISOString()) as string,
      endsAt: (c.end_date ?? new Date().toISOString()) as string,
    };
  }
}

export type { MusicContentReader, MusicPublicationService, ReleaseRecord, TrackRecord, CampaignRecord };
