import { describe, it, expect } from 'vitest';
import { backoffDelay, runSchedulerTick } from '../../src/operations/workflow_runner.js';
import type { SchedulerAdapter, JobRecord, AutomationConfig, SchedulerTickResult } from '../../src/contracts/automation.js';
import { ok, err } from '../../src/validation.js';

class MockScheduler implements SchedulerAdapter {
  jobs: JobRecord[] = [];

  async schedule(_job: Omit<JobRecord, 'id' | 'status' | 'attempts'>) {
    const job: JobRecord = {
      id: crypto.randomUUID(),
      type: _job.type,
      status: 'pending',
      attempts: 0,
      maxAttempts: _job.maxAttempts ?? 5,
      scheduledFor: _job.scheduledFor,
      correlationId: _job.correlationId,
      payload: _job.payload,
      lastError: undefined,
      leasedBy: undefined,
      leaseExpiresAt: undefined,
    };
    this.jobs.push(job);
    return ok(job);
  }

  async cancel(jobId: string) {
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    return ok(undefined);
  }

  async claimNext(_now: string, _workerId: string, _leaseMs: number) {
    const job = this.jobs.find((j) => j.status === 'pending');
    if (!job) return ok(null);
    job.status = 'running';
    return ok(job);
  }

  async markCompleted(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) job.status = 'completed';
    return ok(undefined);
  }

  async markFailed(jobId: string, error: string, retry: boolean) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) {
      job.attempts++;
      job.lastError = error;
      job.status = retry ? 'pending' : 'failed';
    }
    return ok(undefined);
  }

  async releaseLease(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) {
      job.leasedBy = undefined;
      job.leaseExpiresAt = undefined;
    }
    return ok(undefined);
  }

  async reclaimExpired(_now: string) {
    return ok(0);
  }

  async getById(jobId: string) {
    return ok(this.jobs.find((j) => j.id === jobId) ?? null);
  }
}

const config: AutomationConfig = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 1000,
  backoffMaxMs: 30000,
  deadLetterAfter: 5,
  leaseMs: 300000,
};

describe('backoffDelay', () => {
  it('calculates exponential backoff', () => {
    expect(backoffDelay(0, config)).toBe(1000);
    expect(backoffDelay(1, config)).toBe(2000);
    expect(backoffDelay(2, config)).toBe(4000);
  });

  it('caps at maximum delay', () => {
    expect(backoffDelay(100, config)).toBe(30000);
  });

  it('handles zero attempt', () => {
    expect(backoffDelay(0, config)).toBe(1000);
  });
});

describe('runSchedulerTick', () => {
  it('processes a pending job successfully', async () => {
    const scheduler = new MockScheduler();
    await scheduler.schedule({ type: 'test-job', scheduledFor: '2025-01-01T00:00:00Z', maxAttempts: 3, correlationId: 'c1' });

    const result = await runSchedulerTick(
      scheduler,
      config,
      async () => {},
      'worker-1',
      () => new Date(),
    );

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(scheduler.jobs[0].status).toBe('completed');
  });

  it('handles no pending jobs', async () => {
    const scheduler = new MockScheduler();
    const result = await runSchedulerTick(
      scheduler,
      config,
      async () => {},
      'worker-1',
      () => new Date(),
    );
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('marks job as failed on error', async () => {
    const scheduler = new MockScheduler();
    await scheduler.schedule({ type: 'fail-job', scheduledFor: '2025-01-01T00:00:00Z', maxAttempts: 3, correlationId: 'c1' });

    const result = await runSchedulerTick(
      scheduler,
      config,
      async () => { throw new Error('job failed'); },
      'worker-1',
      () => new Date(),
    );

    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('reclaims expired jobs', async () => {
    const scheduler = new MockScheduler();
    const result = await runSchedulerTick(
      scheduler,
      config,
      async () => {},
      'worker-1',
      () => new Date(),
    );
    expect(result.reclaimed).toBe(0);
  });

  it('reports failure when claimNext errors', async () => {
    const scheduler: SchedulerAdapter = {
      schedule: async () => ok({} as JobRecord),
      cancel: async () => ok(undefined),
      claimNext: async () => err('claim failed'),
      markCompleted: async () => ok(undefined),
      markFailed: async () => ok(undefined),
      releaseLease: async () => ok(undefined),
      reclaimExpired: async () => ok(0),
      getById: async () => ok(null),
    };
    Object.assign(scheduler, { claimNext: async () => err('claim failed') });
    const result = await runSchedulerTick(scheduler, config, async () => {}, 'w1', () => new Date());
    expect(result.failed).toBe(1);
  });
});

