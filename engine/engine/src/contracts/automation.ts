import type { Result } from '../validation.ts';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dead';

/** Versioned payloads accepted by the durable worker. Add a new contract before
 * registering a handler or producer; unknown types must remain unhandled. */
export type JobContracts = {
  'control_desk.health_check': { schemaVersion: 1; runId: string };
};

export type OutboxEventContracts = {
  'control_desk.health_check.requested': { schemaVersion: 1; runId: string };
};

export type JobType = keyof JobContracts;
export type OutboxEventType = keyof OutboxEventContracts;

export function isVersionedRunPayload(value: unknown): value is { schemaVersion: 1; runId: string } {
  if (!value || typeof value !== 'object') return false;
  const payload = value as { schemaVersion?: unknown; runId?: unknown };
  return payload.schemaVersion === 1
    && typeof payload.runId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.runId);
}

export type JobRecord = {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledFor: string;
  lastError?: string;
  correlationId: string;
  payload?: unknown;
  leasedBy?: string;
  leaseExpiresAt?: string;
};

export type OutboxEntry = {
  id: string;
  eventType: string;
  payload: unknown;
  version: number;
  correlationId: string;
  idempotencyKey: string;
  createdAt: string;
};

export interface OutboxStore {
  enqueue(
    entry: Omit<OutboxEntry, 'id' | 'createdAt'>,
  ): Promise<Result<OutboxEntry>>;
  claimNext(now: string, workerId: string): Promise<Result<OutboxEntry | null>>;
  markPublished(id: string): Promise<Result<void>>;
  markFailed(id: string, error: string): Promise<Result<void>>;
  pendingCount(): Promise<Result<number>>;
}

export interface SchedulerAdapter {
  schedule(
    job: Omit<JobRecord, 'id' | 'status' | 'attempts'>,
  ): Promise<Result<JobRecord>>;
  cancel(jobId: string): Promise<Result<void>>;
  claimNext(now: string, workerId: string, leaseMs: number): Promise<Result<JobRecord | null>>;
  markCompleted(jobId: string): Promise<Result<void>>;
  markFailed(jobId: string, errorMsg: string, retry: boolean): Promise<Result<void>>;
  releaseLease(jobId: string): Promise<Result<void>>;
  reclaimExpired(now: string): Promise<Result<number>>;
  getById(jobId: string): Promise<Result<JobRecord | null>>;
}

export interface EventHandler {
  type: string;
  handle: (event: DomainEvent, dispatcher: EventDispatcher) => Promise<void>;
}

export interface EventDispatcher {
  register(handler: EventHandler): void;
  dispatch(event: DomainEvent): Promise<void>;
}

export type DomainEvent = {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
};

export function buildEvent(
  type: string,
  payload: unknown,
  options?: { correlationId?: string; causationId?: string },
): DomainEvent {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString(),
    correlationId: options?.correlationId,
    causationId: options?.causationId,
  };
}

export interface AutomationConfig {
  defaultMaxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  deadLetterAfter: number;
  leaseMs: number;
}

export type SchedulerTickResult = {
  processed: number;
  failed: number;
  reclaimed: number;
};

export type OutboxTickResult = {
  processed: number;
  failed: number;
};

export interface OutboxTickDeps {
  enqueue: (entry: Omit<OutboxEntry, 'id' | 'createdAt'>) => Promise<Result<OutboxEntry>>;
  claimNext: (now: string, workerId: string) => Promise<Result<OutboxEntry | null>>;
  markPublished: (id: string) => Promise<Result<void>>;
  markFailed: (id: string, error: string) => Promise<Result<void>>;
  pendingCount: () => Promise<Result<number>>;
}
