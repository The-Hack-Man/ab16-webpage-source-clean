import { describe, it, expect } from 'vitest';
import type {
  OutboxStore,
  SchedulerAdapter,
  OutboxEntry,
  JobRecord,
  JobStatus,
  EventHandler,
  EventDispatcher,
  OutboxTickDeps,
} from '../../src/contracts/automation.js';
import { ok } from '../../src/validation.js';
import { InMemoryEventDispatcher } from '../../src/automation/outbox.js';

describe('OutboxStore interface', () => {
  const mockStore: OutboxStore = {
    enqueue: async () => ok({} as OutboxEntry),
    claimNext: async () => ok(null),
    markPublished: async () => ok(undefined),
    markFailed: async () => ok(undefined),
    pendingCount: async () => ok(0),
  };

  it('enqueue returns OutboxEntry', async () => {
    const result = await mockStore.enqueue({ eventType: 'test', payload: {}, version: 1, correlationId: 'c', idempotencyKey: 'ik' });
    expect(result.ok).toBe(true);
  });

  it('claimNext returns nullable OutboxEntry', async () => {
    const result = await mockStore.claimNext('2025-01-01', 'worker');
    expect(result.ok).toBe(true);
  });

  it('pendingCount returns number', async () => {
    const result = await mockStore.pendingCount();
    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.value).toBe('number');
  });
});

describe('SchedulerAdapter interface', () => {
  const mockScheduler: SchedulerAdapter = {
    schedule: async () => ok({} as JobRecord),
    cancel: async () => ok(undefined),
    claimNext: async () => ok(null),
    markCompleted: async () => ok(undefined),
    markFailed: async () => ok(undefined),
    releaseLease: async () => ok(undefined),
    reclaimExpired: async () => ok(0),
    getById: async () => ok(null),
  };

  it('reclaimExpired returns number', async () => {
    const result = await mockScheduler.reclaimExpired('2025-01-01');
    expect(result.ok).toBe(true);
  });
});

describe('JobStatus type', () => {
  it.each(['pending', 'running', 'completed', 'failed', 'dead'] as JobStatus[])(
    'accepts %s',
    (status) => {
      const job: JobRecord = {
        id: 'j1',
        type: 'test',
        status,
        attempts: 0,
        maxAttempts: 5,
        scheduledFor: '2025-01-01',
        correlationId: 'c1',
      };
      expect(job.status).toBe(status);
    },
  );
});

describe('EventHandler interface', () => {
  it('has type and handle method', () => {
    const handler: EventHandler = {
      type: 'test.event',
      handle: async (_event, _dispatcher) => {},
    };
    expect(handler.type).toBe('test.event');
    expect(typeof handler.handle).toBe('function');
  });
});

describe('EventDispatcher interface', () => {
  it('InMemoryEventDispatcher implements EventDispatcher', () => {
    const dispatcher: EventDispatcher = new InMemoryEventDispatcher();
    expect(typeof dispatcher.register).toBe('function');
    expect(typeof dispatcher.dispatch).toBe('function');
  });
});

describe('OutboxTickDeps', () => {
  it('has all required methods', () => {
    const deps: OutboxTickDeps = {
      enqueue: async () => ok({} as OutboxEntry),
      claimNext: async () => ok(null),
      markPublished: async () => ok(undefined),
      markFailed: async () => ok(undefined),
      pendingCount: async () => ok(0),
    };
    expect(typeof deps.enqueue).toBe('function');
    expect(typeof deps.claimNext).toBe('function');
  });
});

