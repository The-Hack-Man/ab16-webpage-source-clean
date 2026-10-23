import { describe, it, expect } from 'vitest';
import type { WebsitePublisher, PublishRequest, PublishResult } from '../../src/contracts/publishing.js';
import { ok, err } from '../../src/validation.js';

describe('WebsitePublisher interface', () => {
  const mockPublisher: WebsitePublisher = {
    publish: async (_req: PublishRequest) => ok({ releaseId: 'r1', publishedAt: '2025-01-01', affectedPaths: ['/releases/r1'] }),
    unpublish: async (_id: string) => ok(undefined),
  };

  it('publish returns PublishResult', async () => {
    const result = await mockPublisher.publish({ releaseId: 'r1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.releaseId).toBe('r1');
      expect(result.value.affectedPaths).toContain('/releases/r1');
    }
  });

  it('unpublish returns Result<void>', async () => {
    const result = await mockPublisher.unpublish('r1');
    expect(result.ok).toBe(true);
  });

  it('publishes with all request fields', async () => {
    const req: PublishRequest = {
      releaseId: 'r1',
      pushToStreaming: true,
      actorId: 'user-1',
      correlationId: 'corr-1',
    };
    const result = await mockPublisher.publish(req);
    expect(result.ok).toBe(true);
  });
});

describe('PublishResult type', () => {
  it('affectedPaths is an array', () => {
    const result: PublishResult = { releaseId: 'r1', publishedAt: '2025-01-01', affectedPaths: ['/a', '/b'] };
    expect(Array.isArray(result.affectedPaths)).toBe(true);
  });
});

