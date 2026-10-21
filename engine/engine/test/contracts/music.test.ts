import { describe, it, expect } from 'vitest';
import type { MusicContentReader, MusicPublicationService } from '../../src/contracts/music.js';
import type { ReleaseRecord } from '../../src/contracts/music.js';
import { ok, err } from '../../src/validation.js';
import type { Result } from '../../src/validation.js';

describe('MusicContentReader interface', () => {
  it('content reader returns Result<ReleaseRecord | null>', async () => {
    const reader: MusicContentReader = {
      getReleaseById: async () => ok(null),
      listReleases: async () => ok([]),
      listCampaigns: async () => ok([]),
    };
    const result = await reader.getReleaseById('missing');
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.id).toBeTruthy();
    } else if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('publication service returns Result<ReleaseRecord>', async () => {
    const release: ReleaseRecord = {
      id: 'r1', title: 'T', artist: 'A', type: 'album',
      status: 'published', releaseDate: '2025-01-01', tracks: [], createdAt: '2025-01-01',
    };
    const pub: MusicPublicationService = {
      publish: async () => ok(release),
      schedule: async () => ok(release),
    };
    const result = await pub.publish('r1');
    expect(result.ok).toBe(true);
  });

  it('handles errors from content reader', async () => {
    const reader: MusicContentReader = {
      getReleaseById: async () => err('db error'),
      listReleases: async () => ok([]),
      listCampaigns: async () => ok([]),
    };
    const result = await reader.getReleaseById('r1');
    expect(result.ok).toBe(false);
  });
});

describe('Result pattern with music types', () => {
  it('Result can be discriminated', () => {
    const success: Result<string> = ok('hello');
    const failure: Result<string> = err('error');
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });
});

