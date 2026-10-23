import { describe, it, expect } from 'vitest';
import type { ReleaseRecord, TrackRecord, CampaignRecord, ReleaseStatus, ReleaseType, CampaignStatus } from '../../src/contracts/music.js';
import type { MusicContentReader, MusicPublicationService } from '../../src/contracts/music.js';
import type { WebsitePublisher, PublishRequest, PublishResult } from '../../src/contracts/publishing.js';
import type { AuditEventWriter, AuditEvent, AuthorisationProvider, AuthContext, Permission } from '../../src/contracts/security.js';
import type { OutboxStore, OutboxEntry, SchedulerAdapter, JobRecord, JobStatus, EventHandler, DomainEvent, EventDispatcher, AutomationConfig, SchedulerTickResult, OutboxTickResult, OutboxTickDeps } from '../../src/contracts/automation.js';
import type { HealthCheck, HealthStatus, DependencyCheck, ObservabilityProvider } from '../../src/contracts/observability.js';
import { ok, err } from '../../src/validation.js';
import { buildEvent } from '../../src/contracts/automation.js';
import { hasPermission } from '../../src/capability.js';

describe('Music contract types', () => {
  it('ReleaseRecord has required fields', () => {
    const r: ReleaseRecord = {
      id: '1',
      title: 'Test',
      artist: 'Artist',
      type: 'album',
      status: 'published',
      releaseDate: '2025-01-01',
      tracks: [],
      createdAt: '2025-01-01',
    };
    expect(r.id).toBe('1');
  });

  it('TrackRecord has required fields', () => {
    const t: TrackRecord = {
      id: 't1',
      releaseId: 'r1',
      position: 1,
      title: 'Track',
      durationSeconds: 210,
    };
    expect(t.title).toBe('Track');
  });

  it('CampaignRecord has required fields', () => {
    const c: CampaignRecord = {
      id: 'c1',
      title: 'Campaign',
      status: 'live',
      startsAt: '2025-01-01',
      endsAt: '2025-02-01',
    };
    expect(c.status).toBe('live');
  });
});

describe('Publishing contract types', () => {
  it('PublishRequest has required fields', () => {
    const req: PublishRequest = { releaseId: 'r1' };
    expect(req.releaseId).toBe('r1');
    expect(req.pushToStreaming).toBeUndefined();
  });

  it('PublishResult has required fields', () => {
    const result: PublishResult = { releaseId: 'r1', publishedAt: '2025-01-01', affectedPaths: ['/'] };
    expect(result.affectedPaths).toHaveLength(1);
  });
});

describe('Security contract types', () => {
  it('AuthContext has userId and role', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    expect(ctx.userId).toBe('u1');
    expect(ctx.role).toBe('admin');
  });

  it('AuditEvent has all fields', () => {
    const event: AuditEvent = {
      id: '1',
      ts: '2025-01-01',
      actor: 'user',
      action: 'publish',
      resourceType: 'release',
      resourceId: 'r1',
    };
    expect(event.action).toBe('publish');
  });
});

describe('Automation contract types', () => {
  it('EventHandler has type and handle', () => {
    const handler: EventHandler = {
      type: 'test',
      handle: async () => {},
    };
    expect(handler.type).toBe('test');
  });

  it('JobRecord has required fields', () => {
    const job: JobRecord = {
      id: 'j1',
      type: 'job',
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      scheduledFor: '2025-01-01',
      correlationId: 'c1',
    };
    expect(job.maxAttempts).toBe(5);
  });

  it('AutomationConfig has required fields', () => {
    const cfg: AutomationConfig = {
      defaultMaxAttempts: 5,
      backoffBaseMs: 1000,
      backoffMaxMs: 30000,
      deadLetterAfter: 5,
      leaseMs: 300000,
    };
    expect(cfg.deadLetterAfter).toBe(5);
  });

  it('buildEvent produces DomainEvent', () => {
    const event: DomainEvent = buildEvent('test', null);
    expect(event.type).toBe('test');
    expect(event.id).toBeTruthy();
  });
});

describe('Observability contract types', () => {
  it('HealthCheck has name, status', () => {
    const hc: HealthCheck = { name: 'db', status: 'healthy' };
    expect(hc.name).toBe('db');
  });
});

