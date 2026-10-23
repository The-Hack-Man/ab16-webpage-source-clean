import type { Result } from '../validation.js';
import { ok, err } from '../validation.js';
import type {
  SchedulerAdapter,
  JobRecord,
  JobStatus,
  AutomationConfig,
  SchedulerTickResult,
} from '../contracts/automation.js';
import { buildEvent } from '../contracts/automation.js';

export function backoffDelay(attempt: number, config: AutomationConfig): number {
  const base = config.backoffBaseMs;
  const maxDelay = config.backoffMaxMs;
  const delay = base * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

export type JobHandler = (job: JobRecord) => Promise<void>;

export async function runSchedulerTick(
  scheduler: SchedulerAdapter,
  config: AutomationConfig,
  handler: JobHandler,
  workerId: string,
  clock: () => Date,
): Promise<SchedulerTickResult> {
  let processed = 0;
  let failed = 0;
  let reclaimed = 0;

  const now = clock().toISOString();

  const reclaimResult = await scheduler.reclaimExpired(now);
  if (reclaimResult.ok) {
    reclaimed = reclaimResult.value;
  }

  const claimResult = await scheduler.claimNext(now, workerId, config.leaseMs);
  if (!claimResult.ok) {
    return { processed: 0, failed: 1, reclaimed };
  }

  if (!claimResult.value) {
    return { processed: 0, failed: 0, reclaimed };
  }

  const job = claimResult.value;
  try {
    await handler(job);
    await scheduler.markCompleted(job.id);
    processed++;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const canRetry = job.attempts < config.deadLetterAfter;
    await scheduler.markFailed(job.id, message, canRetry);
    failed++;
  }

  return { processed, failed, reclaimed };
}
