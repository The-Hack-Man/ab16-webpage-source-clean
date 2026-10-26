import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  runOutboxTick,
  runSchedulerTick,
  backoffDelay,
  type AutomationConfig,
  type DomainEvent,
  type EventDispatcher,
  type JobRecord,
  type JobType,
  type OutboxEventType,
  isVersionedRunPayload,
} from '../../../engine/engine/index.ts';

const AUTOMATION_CONFIG: AutomationConfig = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 2000,
  backoffMaxMs: 300000,
  deadLetterAfter: 5,
  leaseMs: 300000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function safeEqual(provided: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const providedBytes = encoder.encode(provided);
  const expectedBytes = encoder.encode(expected);
  if (providedBytes.length !== expectedBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index++) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function getHealthCheckRunId(payload: unknown): string {
  if (!isVersionedRunPayload(payload)) throw new Error('Invalid or unsupported health-check payload');
  return payload.runId;
}

const outboxHandlers: Record<OutboxEventType, (event: DomainEvent) => Promise<void>> = {
  'control_desk.health_check.requested': async (event) => {
    const runId = getHealthCheckRunId(event.payload);
    const { error: insertError } = await db.from('jobs').insert({
      type: 'control_desk.health_check',
      status: 'pending',
      max_attempts: AUTOMATION_CONFIG.defaultMaxAttempts,
      correlation_id: event.correlationId ?? runId,
      payload: { schemaVersion: 1, runId },
      source_event_id: event.id,
    }).select('id').maybeSingle();

    // A previously handled delivery already created the same job.
    if (insertError && insertError.code !== '23505') throw insertError;
    const { data: job, error: lookupError } = await db.from('jobs')
      .select('id').eq('source_event_id', event.id).single();
    if (lookupError || !job) throw lookupError ?? new Error('Health-check job was not persisted');
    const { error: runError } = await db.from('control_desk_runs')
      .update({ job_id: job.id }).eq('id', runId);
    if (runError) throw runError;
  },
};

let db: ReturnType<typeof createClient>;

const jobHandlers: Record<JobType, (job: JobRecord) => Promise<void>> = {
  'control_desk.health_check': async (job) => {
    const runId = getHealthCheckRunId(job.payload);
    try {
      const [products, available, orders, pendingJobs, pendingOutbox] = await Promise.all([
        db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('available_for_sale', true),
        db.from('orders').select('id', { count: 'exact', head: true }),
        db.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        db.from('outbox').select('id', { count: 'exact', head: true }).eq('processed', false),
      ]);
      const firstError = [products.error, available.error, orders.error, pendingJobs.error, pendingOutbox.error].find(Boolean);
      if (firstError) throw firstError;

      const result = {
        checkedAt: new Date().toISOString(),
        publishedProducts: products.count ?? 0,
        saleableProducts: available.count ?? 0,
        orders: orders.count ?? 0,
        pendingJobs: pendingJobs.count ?? 0,
        pendingOutboxEvents: pendingOutbox.count ?? 0,
      };
      const { error } = await db.from('control_desk_runs').update({
        status: 'completed',
        result,
        completed_at: result.checkedAt,
      }).eq('id', runId);
      if (error) throw error;
    } catch (error) {
      if (job.attempts + 1 >= job.maxAttempts) {
        await db.from('control_desk_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId);
      }
      throw error;
    }
  },
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('SCHEDULER_SECRET') ?? '';
  const providedSecret = req.headers.get('x-scheduler-secret') ?? '';
  if (!expectedSecret) {
    console.error('[scheduler] Missing SCHEDULER_SECRET configuration');
    return jsonResponse({ error: 'Server not configured' }, 503);
  }
  if (!safeEqual(providedSecret, expectedSecret)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  if (Object.keys(outboxHandlers).length === 0 || Object.keys(jobHandlers).length === 0) {
    console.error('[scheduler] Refusing to claim work because handlers are not configured');
    return jsonResponse({ error: 'Worker handlers are not configured' }, 503);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[scheduler] Missing Supabase configuration');
      return jsonResponse({ error: 'Server not configured' }, 503);
    }

    db = createClient(supabaseUrl, serviceRoleKey);
    // The claim RPCs require a UUID and each invocation needs its own lease owner.
    const workerId = crypto.randomUUID();

    const dispatcher: EventDispatcher = {
      dispatch: async (event: DomainEvent) => {
        const handler = Object.prototype.hasOwnProperty.call(outboxHandlers, event.type)
          ? outboxHandlers[event.type]
          : undefined;
        if (!handler) throw new Error(`No handler configured for outbox event type: ${event.type}`);
        await handler(event);
      },
    };

    const outboxTickResult = await runOutboxTick(
      {
        enqueue: async (entry) => {
          const { data, error } = await db.from('outbox').insert({
            event_type: entry.eventType,
            payload: entry.payload,
            version: entry.version,
            correlation_id: entry.correlationId,
            idempotency_key: entry.idempotencyKey,
          }).select('id, created_at, event_type, payload, version, correlation_id, idempotency_key').single();
          if (error) return { ok: false, error: new Error(error.message) };
          return {
            ok: true,
            value: {
              id: data.id,
              eventType: data.event_type,
              payload: data.payload,
              version: data.version,
              correlationId: data.correlation_id,
              idempotencyKey: data.idempotency_key,
              createdAt: data.created_at,
            },
          };
        },
        claimNext: async (now, wid) => {
          const { data, error } = await db.rpc('claim_next_outbox', {
            p_now: now,
            p_worker_id: wid,
            p_lease_ms: AUTOMATION_CONFIG.leaseMs,
          });
          if (error) return { ok: false, error: new Error(error.message) };
          if (!data || data.length === 0) return { ok: true, value: null };
          const row = data[0];
          return {
            ok: true,
            value: {
              id: row.id,
              eventType: row.event_type,
              payload: row.payload,
              version: row.version,
              correlationId: row.correlation_id,
              idempotencyKey: row.idempotency_key,
              createdAt: row.created_at,
            },
          };
        },
        markPublished: async (id) => {
          const { error } = await db.from('outbox').update({
            processed: true,
            processed_at: new Date().toISOString(),
          }).eq('id', id);
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: undefined };
        },
        markFailed: async (id, error) => {
          const { error: dbError } = await db.from('outbox').update({ error }).eq('id', id);
          if (dbError) return { ok: false, error: new Error(dbError.message) };
          return { ok: true, value: undefined };
        },
        pendingCount: async () => {
          const { count, error } = await db.from('outbox').select('id', { count: 'exact', head: true }).eq('processed', false);
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: count ?? 0 };
        },
      },
      dispatcher,
      workerId,
      () => new Date(),
    );

    const schedulerTickResult = await runSchedulerTick(
      {
        schedule: async (job) => {
          const { data, error } = await db.from('jobs').insert({
            type: job.type,
            scheduled_for: job.scheduledFor,
            max_attempts: job.maxAttempts,
            correlation_id: job.correlationId,
            payload: job.payload,
          }).select('id, type, status, attempts, max_attempts, scheduled_for, last_error, correlation_id, payload, leased_by, lease_expires_at').single();
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: mapJob(data) };
        },
        cancel: async (jobId) => {
          const { error } = await db.from('jobs').delete().eq('id', jobId);
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: undefined };
        },
        claimNext: async (now, wid, leaseMs) => {
          const { data, error } = await db.rpc('claim_next_job', {
            p_now: now,
            p_worker_id: wid,
            p_lease_ms: leaseMs,
          });
          if (error) return { ok: false, error: new Error(error.message) };
          if (!data || data.length === 0) return { ok: true, value: null };
          return { ok: true, value: mapJob(data[0]) };
        },
        markCompleted: async (jobId) => {
          const { error } = await db.from('jobs').update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          }).eq('id', jobId);
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: undefined };
        },
        markFailed: async (jobId, errorMsg, retry) => {
          const current = await db.from('jobs').select('attempts, max_attempts').eq('id', jobId).maybeSingle();
          if (current.error) return { ok: false, error: new Error(current.error.message) };
          const attempts = (current.data?.attempts ?? 0) + 1;
          const maxAttempts = current.data?.max_attempts ?? AUTOMATION_CONFIG.defaultMaxAttempts;
          const isDead = attempts >= maxAttempts;
          const { error } = await db.from('jobs').update({
            status: isDead ? 'dead' : (retry ? 'pending' : 'failed'),
            attempts,
            last_error: errorMsg,
            leased_by: null,
            lease_expires_at: null,
            scheduled_for: retry ? new Date(Date.now() + backoffDelay(attempts - 1, AUTOMATION_CONFIG)).toISOString() : null,
            updated_at: new Date().toISOString(),
          }).eq('id', jobId);
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: undefined };
        },
        releaseLease: async (jobId) => {
          const { error } = await db.from('jobs').update({
            leased_by: null,
            lease_expires_at: null,
            updated_at: new Date().toISOString(),
          }).eq('id', jobId);
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: undefined };
        },
        reclaimExpired: async (now) => {
          const { data, error } = await db.rpc('reclaim_expired_jobs', { p_now: now });
          if (error) return { ok: false, error: new Error(error.message) };
          return { ok: true, value: data ?? 0 };
        },
        getById: async (jobId) => {
          const { data, error } = await db.from('jobs').select('id, type, status, attempts, max_attempts, scheduled_for, last_error, correlation_id, payload, leased_by, lease_expires_at').eq('id', jobId).maybeSingle();
          if (error) return { ok: false, error: new Error(error.message) };
          if (!data) return { ok: true, value: null };
          return { ok: true, value: mapJob(data) };
        },
      },
      AUTOMATION_CONFIG,
      () => new Date(),
      async (job: JobRecord) => {
        const handler = Object.prototype.hasOwnProperty.call(jobHandlers, job.type)
          ? jobHandlers[job.type]
          : undefined;
        if (!handler) throw new Error(`No handler configured for job type: ${job.type}`);
        await handler(job);
      },
      workerId,
    );

    const summary = {
      success: true,
      outbox: { processed: outboxTickResult.processed, failed: outboxTickResult.failed },
      scheduler: { processed: schedulerTickResult.processed, failed: schedulerTickResult.failed, reclaimed: schedulerTickResult.reclaimed },
    };
    console.log('[scheduler] Tick completed', summary);
    return jsonResponse(summary);
  } catch (e) {
    console.error('[scheduler] Tick failed', e instanceof Error ? e.message : 'Unknown error');
    return jsonResponse({ error: 'Scheduler tick failed' }, 500);
  }
});

function mapJob(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    type: row.type as string,
    status: row.status as 'pending' | 'running' | 'completed' | 'failed' | 'dead',
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    scheduledFor: row.scheduled_for as string,
    lastError: row.last_error as string | undefined,
    correlationId: row.correlation_id as string,
    payload: row.payload,
    leasedBy: row.leased_by as string | undefined,
    leaseExpiresAt: row.lease_expires_at as string | undefined,
  };
}
