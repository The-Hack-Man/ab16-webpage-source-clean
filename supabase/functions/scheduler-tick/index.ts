import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  InMemoryEventDispatcher,
  runOutboxTick,
  runSchedulerTick,
  backoffDelay,
  type AutomationConfig,
  type EventHandler,
  type JobRecord,
} from '../../../engine/engine/index.ts';

const AUTOMATION_CONFIG: AutomationConfig = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 2000,
  backoffMaxMs: 300000,
  deadLetterAfter: 5,
  leaseMs: 300000,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const db = createClient(supabaseUrl, serviceRoleKey);
    const workerId = `scheduler-${new Date().toISOString().slice(0, 10)}`;

    const dispatcher = new InMemoryEventDispatcher();

    const notifyHandler: EventHandler = {
      type: 'fan.notified',
      handle: async () => {},
    };
    dispatcher.register(notifyHandler);

    const homepageHandler: EventHandler = {
      type: 'homepage.updated',
      handle: async () => {},
    };
    dispatcher.register(homepageHandler);

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
        console.log(`[scheduler] Processing job ${job.id} of type ${job.type}`, job.payload);
        await db.from('audit_logs').insert({
          actor_id: job.correlationId,
          action: `job.${job.type}.processed`,
          entity: 'job',
          entity_id: job.id,
          details: JSON.stringify({ attempts: job.attempts, payload: job.payload }),
        });
      },
      workerId,
    );

    return new Response(JSON.stringify({
      success: true,
      outbox: { processed: outboxTickResult.processed, failed: outboxTickResult.failed },
      scheduler: { processed: schedulerTickResult.processed, failed: schedulerTickResult.failed, reclaimed: schedulerTickResult.reclaimed },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
