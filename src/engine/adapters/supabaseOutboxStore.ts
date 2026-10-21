import type { Result } from '@engine/validation.js';
import { ok, err } from '@engine/validation.js';
import type { OutboxStore, OutboxEntry } from '@engine/contracts/automation.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeDbError } from './utils';

export class SupabaseOutboxStore implements OutboxStore {
  constructor(private readonly db: SupabaseClient) {}

  async enqueue(entry: Omit<OutboxEntry, 'id' | 'createdAt'>): Promise<Result<OutboxEntry>> {
    try {
      const { data, error } = await this.db
        .from('outbox')
        .insert({
          event_type: entry.eventType,
          payload: entry.payload,
          version: entry.version,
          correlation_id: entry.correlationId,
          idempotency_key: entry.idempotencyKey,
        })
        .select('id, created_at, event_type, payload, version, correlation_id, idempotency_key')
        .single();

      if (error) return err(decodeDbError(error));

      return ok({
        id: data.id,
        eventType: data.event_type,
        payload: data.payload,
        version: data.version,
        correlationId: data.correlation_id,
        idempotencyKey: data.idempotency_key,
        createdAt: data.created_at,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async claimNext(now: string, workerId: string): Promise<Result<OutboxEntry | null>> {
    try {
      const { data, error } = await this.db.rpc('claim_next_outbox', {
        p_now: now,
        p_worker_id: workerId,
        p_lease_ms: 300000,
      });

      if (error) return err(decodeDbError(error));
      if (!data || data.length === 0) return ok(null);

      const row = data[0];
      return ok({
        id: row.id,
        eventType: row.event_type,
        payload: row.payload,
        version: row.version,
        correlationId: row.correlation_id,
        idempotencyKey: row.idempotency_key,
        createdAt: row.created_at,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async markPublished(id: string): Promise<Result<void>> {
    try {
      const { error } = await this.db
        .from('outbox')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return err(decodeDbError(error));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async markFailed(id: string, error: string): Promise<Result<void>> {
    try {
      const { error: dbError } = await this.db
        .from('outbox')
        .update({ error: error })
        .eq('id', id);
      if (dbError) return err(decodeDbError(dbError));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async pendingCount(): Promise<Result<number>> {
    try {
      const { count, error } = await this.db
        .from('outbox')
        .select('id', { count: 'exact', head: true })
        .eq('processed', false);
      if (error) return err(decodeDbError(error));
      return ok(count ?? 0);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
