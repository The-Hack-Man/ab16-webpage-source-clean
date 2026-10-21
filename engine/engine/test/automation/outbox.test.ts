import { describe, it, expect } from 'vitest';
import { InMemoryEventDispatcher } from '../../src/automation/outbox.js';
import { buildEvent } from '../../src/contracts/automation.js';
import type { EventHandler, DomainEvent, EventDispatcher } from '../../src/contracts/automation.js';
import { runOutboxTick } from '../../src/automation/outbox.js';
import type { OutboxStore, OutboxEntry, OutboxTickResult } from '../../src/contracts/automation.js';
import { ok, err } from '../../src/validation.js';

class MockOutboxStore implements OutboxStore {
  entries: OutboxEntry[] = [];
  published: string[] = [];
  failed: string[] = [];

  async enqueue(_entry: Omit<OutboxEntry, 'id' | 'createdAt'>) {
    const entry: OutboxEntry = { ..._entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.entries.push(entry);
    return ok(entry);
  }

  async claimNext(_now: string, _workerId: string) {
    const entry = this.entries.find((e) => !this.published.includes(e.id) && !this.failed.includes(e.id));
    if (!entry) return ok(null);
    return ok(entry);
  }

  async markPublished(id: string) {
    this.published.push(id);
    return ok(undefined);
  }

  async markFailed(id: string, _error: string) {
    this.failed.push(id);
    return ok(undefined);
  }

  async pendingCount() {
    return ok(this.entries.length - this.published.length - this.failed.length);
  }
}

describe('InMemoryEventDispatcher', () => {
  it('registers and dispatches events', async () => {
    const dispatcher = new InMemoryEventDispatcher();
    let received = false;
    const handler: EventHandler = {
      type: 'test.event',
      handle: async () => { received = true; },
    };
    dispatcher.register(handler);
    await dispatcher.dispatch(buildEvent('test.event', { value: 1 }));
    expect(received).toBe(true);
  });

  it('does not call handler for different event type', async () => {
    const dispatcher = new InMemoryEventDispatcher();
    let received = false;
    const handler: EventHandler = {
      type: 'test.event',
      handle: async () => { received = true; },
    };
    dispatcher.register(handler);
    await dispatcher.dispatch(buildEvent('other.event', {}));
    expect(received).toBe(false);
  });

  it('supports multiple handlers for same type', async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const calls: string[] = [];
    dispatcher.register({ type: 'test', handle: async () => calls.push('a') });
    dispatcher.register({ type: 'test', handle: async () => calls.push('b') });
    await dispatcher.dispatch(buildEvent('test', {}));
    expect(calls).toEqual(['a', 'b']);
  });

  it('supports multiple event types', async () => {
    const dispatcher = new InMemoryEventDispatcher();
    const calls: string[] = [];
    dispatcher.register({ type: 'a', handle: async () => calls.push('a') });
    dispatcher.register({ type: 'b', handle: async () => calls.push('b') });
    await dispatcher.dispatch(buildEvent('a', {}));
    await dispatcher.dispatch(buildEvent('b', {}));
    expect(calls).toEqual(['a', 'b']);
  });
});

describe('runOutboxTick', () => {
  it('processes a pending outbox entry', async () => {
    const store = new MockOutboxStore();
    await store.enqueue({ eventType: 'test.event', payload: {}, version: 1, correlationId: 'c1', idempotencyKey: 'ik1' });

    const dispatcher = new InMemoryEventDispatcher();
    let handled = false;
    dispatcher.register({ type: 'test.event', handle: async () => { handled = true; } });

    const result = await runOutboxTick(store, dispatcher, 'worker-1', () => new Date());
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(handled).toBe(true);
  });

  it('returns no-op when no entries are pending', async () => {
    const store = new MockOutboxStore();
    const dispatcher = new InMemoryEventDispatcher();
    const result = await runOutboxTick(store, dispatcher, 'worker-1', () => new Date());
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('marks entry as failed when handler throws', async () => {
    const store = new MockOutboxStore();
    await store.enqueue({ eventType: 'test.event', payload: {}, version: 1, correlationId: 'c1', idempotencyKey: 'ik1' });

    const dispatcher = new InMemoryEventDispatcher();
    dispatcher.register({ type: 'test.event', handle: async () => { throw new Error('handler failed'); } });

    const result = await runOutboxTick(store, dispatcher, 'worker-1', () => new Date());
    expect(result.failed).toBe(1);
  });

  it('processes multiple entries in sequence', async () => {
    const store = new MockOutboxStore();
    await store.enqueue({ eventType: 'a', payload: {}, version: 1, correlationId: 'c1', idempotencyKey: 'ik1' });
    // Clear processed to simulate next entry
    store.published = [];

    const dispatcher = new InMemoryEventDispatcher();
    dispatcher.register({ type: 'a', handle: async () => {} });

    const result = await runOutboxTick(store, dispatcher, 'w1', () => new Date());
    expect(result.processed).toBe(1);
  });

  it('reports failure when claimNext returns error', async () => {
    const store: OutboxStore = {
      enqueue: async () => ok({} as OutboxEntry),
      claimNext: async () => err('claim failed'),
      markPublished: async () => ok(undefined),
      markFailed: async () => ok(undefined),
      pendingCount: async () => ok(0),
    };

    const dispatcher = new InMemoryEventDispatcher();
    const result = await runOutboxTick(store, dispatcher, 'w1', () => new Date());
    expect(result.failed).toBe(1);
  });
});

