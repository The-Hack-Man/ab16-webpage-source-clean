import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const AUTOMATION_CONFIG = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 2000,
  backoffMaxMs: 300000,
  deadLetterAfter: 5,
  leaseMs: 300000,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function backoffDelay(attempt: number): number {
  const delay = AUTOMATION_CONFIG.backoffBaseMs * Math.pow(2, attempt);
  return Math.min(delay, AUTOMATION_CONFIG.backoffMaxMs);
}

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
    const now = new Date().toISOString();

    // Outbox tick
    let outboxProcessed = 0;
    let outboxFailed = 0;

    const { data: outboxEntry, error: claimErr } = await db.rpc('claim_next_outbox', {
      p_now: now,
      p_worker_id: workerId,
      p_lease_ms: AUTOMATION_CONFIG.leaseMs,
    });
    if (claimErr) {
      outboxFailed = 1;
    } else if (outboxEntry && outboxEntry.length > 0) {
      const entry = outboxEntry[0];
      try {
        await db.from('outbox').update({
          processed: true,
          processed_at: new Date().toISOString(),
        }).eq('id', entry.id);
        outboxProcessed = 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.from('outbox').update({ error: msg }).eq('id', entry.id);
        outboxFailed = 1;
      }
    }

    // Scheduler tick
    let schedulerProcessed = 0;
    let schedulerFailed = 0;
    let schedulerReclaimed = 0;

    const { data: reclaimed, error: reclaimErr } = await db.rpc('reclaim_expired_jobs', { p_now: now });
    if (!reclaimErr) {
      schedulerReclaimed = reclaimed ?? 0;
    }

    const { data: job, error: jobClaimErr } = await db.rpc('claim_next_job', {
      p_now: now,
      p_worker_id: workerId,
      p_lease_ms: AUTOMATION_CONFIG.leaseMs,
    });
    if (jobClaimErr) {
      schedulerFailed = 1;
    } else if (job && job.length > 0) {
      const j = job[0];
      try {
        console.log(`[scheduler] Processing job ${j.id} of type ${j.type}`, j.payload);
        await db.from('audit_logs').insert({
          actor_id: j.correlation_id ?? null,
          action: `job.${j.type}.processed`,
          entity: 'job',
          entity_id: j.id,
          details: JSON.stringify({ attempts: j.attempts, payload: j.payload }),
        });
        await db.from('jobs').update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        }).eq('id', j.id);
        schedulerProcessed = 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const attempts = (j.attempts ?? 0) + 1;
        const isDead = attempts >= (j.max_attempts ?? AUTOMATION_CONFIG.defaultMaxAttempts);
        const canRetry = attempts < AUTOMATION_CONFIG.deadLetterAfter;
        await db.from('jobs').update({
          status: isDead ? 'dead' : (canRetry ? 'pending' : 'failed'),
          attempts,
          last_error: msg,
          leased_by: null,
          lease_expires_at: null,
          scheduled_for: canRetry ? new Date(Date.now() + backoffDelay(attempts - 1)).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('id', j.id);
        schedulerFailed = 1;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      outbox: { processed: outboxProcessed, failed: outboxFailed },
      scheduler: { processed: schedulerProcessed, failed: schedulerFailed, reclaimed: schedulerReclaimed },
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
