import type { Result } from '../validation.js';

export type ReleaseStatus =
  | 'draft'
  | 'scheduled'
  | 'upcoming'
  | 'published'
  | 'archived';

export type ReleaseType = 'single' | 'ep' | 'album' | 'video';

export type TrackRecord = {
  id: string;
  releaseId: string;
  position: number;
  title: string;
  durationSeconds: number;
  isrc?: string;
  mediaUrl?: string;
};

export type ReleaseRecord = {
  id: string;
  title: string;
  artist: string;
  type: ReleaseType;
  status: ReleaseStatus;
  releaseDate: string;
  tracks: TrackRecord[];
  createdAt: string;
};

export type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'archived';

export type CampaignRecord = {
  id: string;
  title: string;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string;
};

export interface MusicContentReader {
  getReleaseById(id: string): Promise<Result<ReleaseRecord | null>>;
  listReleases(opts?: { status?: ReleaseStatus }): Promise<Result<ReleaseRecord[]>>;
  listCampaigns(opts?: { status?: CampaignStatus }): Promise<Result<CampaignRecord[]>>;
}

export interface MusicPublicationService {
  publish(releaseId: string): Promise<Result<ReleaseRecord>>;
  schedule(releaseId: string, publishAt: string): Promise<Result<ReleaseRecord>>;
}
