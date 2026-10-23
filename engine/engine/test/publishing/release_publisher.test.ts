import { describe, it, expect } from 'vitest';
import { ReleasePublisher, ReleasePublisherConfig } from '../../src/publishing/release_publisher.js';
import type { MusicContentReader, MusicPublicationService, ReleaseRecord } from '../../src/contracts/music.js';
import type { WebsitePublisher, PublishRequest } from '../../src/contracts/publishing.js';
import type { AuditEventWriter, AuthContext } from '../../src/contracts/security.js';
import { ok, err, type Result } from '../../src/validation.js';

function makeRelease(overrides: Partial<ReleaseRecord> = {}): ReleaseRecord {
  return {
    id: 'rel-1',
    title: 'Test Release',
    artist: 'Test Artist',
    type: 'album',
    status: 'draft',
    releaseDate: '2025-01-01T00:00:00Z',
    tracks: [],
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeContentReader(release: ReleaseRecord | null): MusicContentReader {
  return {
    getReleaseById: async () => release ? ok(release) : ok(null),
    listReleases: async () => ok(release ? [release] : []),
    listCampaigns: async () => ok([]),
  };
}

function makePublicationService(release: ReleaseRecord): MusicPublicationService {
  return {
    publish: async () => ok(release),
    schedule: async () => ok(release),
  };
}

function makeWebsitePublisher(result: Result<{ releaseId: string; publishedAt: string; affectedPaths: string[] }>): WebsitePublisher {
  return {
    publish: async () => result,
    unpublish: async () => ok(undefined),
  };
}

function makeAuditWriter(): AuditEventWriter {
  const records: any[] = [];
  return {
    record: async (event) => ok({ ...event, id: 'audit-1', ts: '2025-01-01T00:00:00Z' }),
  };
}

const config: ReleasePublisherConfig = { requireMediaUrls: false };
const ctx: AuthContext = { userId: 'user-1', role: 'admin' };

describe('ReleasePublisher', () => {
  it('publishes a release successfully', async () => {
    const release = makeRelease({ status: 'scheduled' });
    const reader = makeContentReader(release);
    const pub = makePublicationService(release);
    const site = makeWebsitePublisher(ok({ releaseId: 'rel-1', publishedAt: '2025-06-01T00:00:00Z', affectedPaths: ['/releases/test'] }));
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, config);

    const result = await publisher.publish(ctx, { releaseId: 'rel-1', actorId: 'user-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.releaseId).toBe('rel-1');
    }
  });

  it('returns error when release not found', async () => {
    const reader = makeContentReader(null);
    const pub = makePublicationService(makeRelease());
    const site = makeWebsitePublisher(ok({ releaseId: '', publishedAt: '', affectedPaths: [] }));
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, config);

    const result = await publisher.publish(ctx, { releaseId: 'missing' });
    expect(result.ok).toBe(false);
  });

  it('returns error when publication fails', async () => {
    const release = makeRelease({ status: 'scheduled' });
    const reader = makeContentReader(release);
    const pub: MusicPublicationService = {
      publish: async () => err('publish failed'),
      schedule: async () => ok(release),
    };
    const site = makeWebsitePublisher(ok({ releaseId: '', publishedAt: '', affectedPaths: [] }));
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, config);

    const result = await publisher.publish(ctx, { releaseId: 'rel-1' });
    expect(result.ok).toBe(false);
  });

  it('returns error when website publisher fails', async () => {
    const release = makeRelease({ status: 'scheduled' });
    const reader = makeContentReader(release);
    const pub = makePublicationService(release);
    const site: WebsitePublisher = {
      publish: async () => err('site failed'),
      unpublish: async () => ok(undefined),
    };
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, config);

    const result = await publisher.publish(ctx, { releaseId: 'rel-1' });
    expect(result.ok).toBe(false);
  });

  it('enforces requireMediaUrls', async () => {
    const release = makeRelease({
      status: 'scheduled',
      tracks: [],
    });
    const reader = makeContentReader(release);
    const pub = makePublicationService(release);
    const site = makeWebsitePublisher(ok({ releaseId: '', publishedAt: '', affectedPaths: [] }));
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, { requireMediaUrls: true });

    const result = await publisher.publish(ctx, { releaseId: 'rel-1' });
    expect(result.ok).toBe(false);
  });

  it('publishes with media URLs when requireMediaUrls is true', async () => {
    const release = makeRelease({
      status: 'scheduled',
      tracks: [{ id: 't1', releaseId: 'rel-1', position: 1, title: 'T1', durationSeconds: 0, mediaUrl: 'http://test' }],
    });
    const reader = makeContentReader(release);
    const pub = makePublicationService(release);
    const site = makeWebsitePublisher(ok({ releaseId: 'rel-1', publishedAt: '', affectedPaths: [] }));
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, { requireMediaUrls: true });

    const result = await publisher.publish(ctx, { releaseId: 'rel-1' });
    expect(result.ok).toBe(true);
  });

  it('unpublishes a release', async () => {
    const reader = makeContentReader(null);
    const pub = makePublicationService(makeRelease());
    const site: WebsitePublisher = {
      publish: async () => ok({ releaseId: '', publishedAt: '', affectedPaths: [] }),
      unpublish: async () => ok(undefined),
    };
    const audit = makeAuditWriter();
    const publisher = new ReleasePublisher(reader, pub, site, audit, config);

    const result = await publisher.unpublish(ctx, 'rel-1');
    expect(result.ok).toBe(true);
  });
});

