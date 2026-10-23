import { describe, it, expect } from 'vitest';
import { backoffDelay, runSchedulerTick } from '../../src/operations/workflow_runner.js';
import type { AutomationConfig, SchedulerAdapter } from '../../src/contracts/automation.js';
import { ok, err } from '../../src/validation.js';

const config: AutomationConfig = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 2000,
  backoffMaxMs: 300000,
  deadLetterAfter: 5,
  leaseMs: 300000,
};

describe('backoffDelay', () => {
  it('calculates exponential backoff from base', () => {
    expect(backoffDelay(0, config)).toBe(2000);
  });

  it('doubles with each attempt', () => {
    expect(backoffDelay(1, config)).toBe(4000);
    expect(backoffDelay(2, config)).toBe(8000);
    expect(backoffDelay(3, config)).toBe(16000);
  });

  it('caps at max delay', () => {
    expect(backoffDelay(10, config)).toBe(300000);
    expect(backoffDelay(100, config)).toBe(300000);
  });

  it('respects custom base and max', () => {
    const custom: AutomationConfig = { ...config, backoffBaseMs: 500, backoffMaxMs: 5000 };
    expect(backoffDelay(3, custom)).toBe(4000);
    expect(backoffDelay(4, custom)).toBe(5000);
  });

  it('handles attempt 0', () => {
    expect(backoffDelay(0, config)).toBe(2000);
  });
});

describe('runSchedulerTick with mock scheduler', () => {
  function makeScheduler() {
    return {
      schedule: async (job: any) => ok({ id: 'j1', ...job, status: 'pending', attempts: 0 }),
      cancel: async (_id: string) => ok(undefined),
      claimNext: async () => ok(null),
      markCompleted: async (_id: string) => ok(undefined),
      markFailed: async (_id: string, _e: string, _r: boolean) => ok(undefined),
      releaseLease: async (_id: string) => ok(undefined),
      reclaimExpired: async () => ok(0),
      getById: async (_id: string) => ok(null),
    };
  }

  it('returns zero counts with no pending jobs', async () => {
    const scheduler = makeScheduler();
    const result = await runSchedulerTick(scheduler, config, async () => {}, 'w1', () => new Date());
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.reclaimed).toBe(0);
  });

  it('handles reclaimExpired returning non-zero', async () => {
    const scheduler = makeScheduler();
    Object.assign(scheduler, { reclaimExpired: async () => ok(5) });
    const result = await runSchedulerTick(scheduler, config, async () => {}, 'w1', () => new Date());
    expect(result.reclaimed).toBe(5);
  });
});

