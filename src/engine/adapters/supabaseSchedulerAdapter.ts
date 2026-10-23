import type { Result } from '@engine/validation.js';
import { ok, err } from '@engine/validation.js';
import type {
  SchedulerAdapter,
  JobRecord,
  JobStatus,
} from '@engine/contracts/automation.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeDbError } from './utils';

export class SupabaseSchedulerAdapter implements SchedulerAdapter {
  constructor(private readonly db: SupabaseClient) {}

  async schedule(job: Omit<JobRecord, 'id' | 'status' | 'attempts'>): Promise<Result<JobRecord>> {
    try {
      const { data, error } = await this.db
        .from('jobs')
        .insert({
          type: job.type,
          scheduled_for: job.scheduledFor,
          max_attempts: job.maxAttempts,
          correlation_id: job.correlationId,
          payload: job.payload as unknown as Record<string, unknown>,
          lease_expires_at: null,
          leased_by: null,
        })
        .select('id, type, status, attempts, max_attempts, scheduled_for, last_error, correlation_id, payload, leased_by, lease_expires_at, created_at, updated_at')
        .single();

      if (error) return err(decodeDbError(error));
      return ok(this.mapRow(data));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async cancel(jobId: string): Promise<Result<void>> {
    try {
      const { error } = await this.db.from('jobs').delete().eq('id', jobId);
      if (error) return err(decodeDbError(error));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async claimNext(now: string, workerId: string, leaseMs: number): Promise<Result<JobRecord | null>> {
    try {
      const { data, error } = await this.db.rpc('claim_next_job', {
        p_now: now,
        p_worker_id: workerId,
        p_lease_ms: leaseMs,
      });

      if (error) return err(decodeDbError(error));
      if (!data || data.length === 0) return ok(null);
      return ok(this.mapRow(data[0]));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async markCompleted(jobId: string): Promise<Result<void>> {
    try {
      const { error } = await this.db
        .from('jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
      if (error) return err(decodeDbError(error));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async markFailed(jobId: string, errorMsg: string, retry: boolean): Promise<Result<void>> {
    try {
      const current = await this.db.from('jobs').select('attempts, max_attempts').eq('id', jobId).maybeSingle();
      if (current.error) return err(decodeDbError(current.error));
      if (!current.data) return err(new Error(`Job ${jobId} not found`));

      const attempts = current.data.attempts + 1;
      const isDead = attempts >= current.data.max_attempts;

      const { error } = await this.db
        .from('jobs')
        .update({
          status: isDead ? 'dead' : (retry ? 'pending' : 'failed'),
          attempts,
          last_error: errorMsg,
          lease_expires_at: null,
          leased_by: null,
          scheduled_for: retry
            ? new Date(Date.now() + Math.min(1000 * 60 * 60, 1000 * 60 * 60)).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) return err(decodeDbError(error));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async releaseLease(jobId: string): Promise<Result<void>> {
    try {
      const { error } = await this.db
        .from('jobs')
        .update({
          leased_by: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (error) return err(decodeDbError(error));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async reclaimExpired(now: string): Promise<Result<number>> {
    try {
      const { data, error } = await this.db.rpc('reclaim_expired_jobs', {
        p_now: now,
      });

      if (error) return err(decodeDbError(error));
      return ok(data ?? 0);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getById(jobId: string): Promise<Result<JobRecord | null>> {
    try {
      const { data, error } = await this.db
        .from('jobs')
        .select('id, type, status, attempts, max_attempts, scheduled_for, last_error, correlation_id, payload, leased_by, lease_expires_at, created_at, updated_at')
        .eq('id', jobId)
        .maybeSingle();

      if (error) return err(decodeDbError(error));
      if (!data) return ok(null);
      return ok(this.mapRow(data));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private mapRow(row: Record<string, unknown>): JobRecord {
    return {
      id: row.id as string,
      type: row.type as string,
      status: (row.status as JobStatus),
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
}
