import { describe, it, expect } from 'vitest';
import { MusicService } from '../src/music/index.js';
import { ReleasePublisher } from '../src/publishing/release_publisher.js';
import { InMemoryEventDispatcher, runOutboxTick, buildEvent } from '../src/automation/index.js';
import type { ReleaseRecord, MusicContentReader, MusicPublicationService } from '../src/contracts/music.js';
import type { WebsitePublisher } from '../src/contracts/publishing.js';
import type { AuditEventWriter, AuthContext } from '../src/contracts/security.js';
import { ok, err } from '../src/validation.js';

describe('Engine integration', () => {
  it('MusicService + ReleasePublisher work together', async () => {
    const musicService = new MusicService({ minScheduleLeadMs: 60000 });
    expect(musicService.validateReleaseStatus('published').ok).toBe(true);
  });

  it('InMemoryEventDispatcher dispatches events that runOutboxTick processes', async () => {
    const dispatcher = new InMemoryEventDispatcher();
    let handled = false;
    dispatcher.register({ type: 'integration.test', handle: async () => { handled = true; } });

    const event = buildEvent('integration.test', { value: 1 });
    await dispatcher.dispatch(event);
    expect(handled).toBe(true);
  });

  it('ReleasePublisher coordinates all dependencies', async () => {
    const release: ReleaseRecord = {
      id: 'rel-1', title: 'Test', artist: 'Artist', type: 'album',
      status: 'scheduled', releaseDate: '2025-12-02', tracks: [], createdAt: '2025-01-01',
    };
    const reader: MusicContentReader = {
      getReleaseById: async () => ok(release),
      listReleases: async () => ok([release]),
      listCampaigns: async () => ok([]),
    };
    const pub: MusicPublicationService = {
      publish: async () => ok(release),
      schedule: async () => ok(release),
    };
    const site: WebsitePublisher = {
      publish: async () => ok({ releaseId: 'rel-1', publishedAt: '2025-06-01', affectedPaths: ['/releases/test'] }),
      unpublish: async () => ok(undefined),
    };
    const audit: AuditEventWriter = {
      record: async () => ok({ id: 'a1', ts: '2025-01-01', actor: 'u1', action: 'publish', resourceType: 'release', resourceId: 'rel-1' }),
    };

    const publisher = new ReleasePublisher(reader, pub, site, audit, { requireMediaUrls: false });
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    const result = await publisher.publish(ctx, { releaseId: 'rel-1' });
    expect(result.ok).toBe(true);
  });

  it('Error flow through publisher', async () => {
    const reader: MusicContentReader = {
      getReleaseById: async () => err('not found'),
      listReleases: async () => ok([]),
      listCampaigns: async () => ok([]),
    };
    const pub: MusicPublicationService = { publish: async () => ok({} as any), schedule: async () => ok({} as any) };
    const site: WebsitePublisher = { publish: async () => ok({} as any), unpublish: async () => ok(undefined) };
    const audit: AuditEventWriter = { record: async () => ok({} as any) };

    const publisher = new ReleasePublisher(reader, pub, site, audit, { requireMediaUrls: false });
    const result = await publisher.publish({ userId: 'u1', role: 'admin' }, { releaseId: 'missing' });
    expect(result.ok).toBe(false);
  });
});
