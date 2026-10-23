import type { Result } from '@engine/validation.js';
import { ok, err } from '@engine/validation.js';
import type { AuditEventWriter, AuditEvent } from '@engine/contracts/security.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeDbError } from './utils';

export class SupabaseAuditWriter implements AuditEventWriter {
  constructor(private readonly db: SupabaseClient) {}

  async record(event: Omit<AuditEvent, 'id' | 'ts'>): Promise<Result<AuditEvent>> {
    try {
      const { data, error } = await this.db
        .from('audit_logs')
        .insert({
          actor_id: event.actor,
          action: event.action,
          entity: event.resourceType,
          entity_id: event.resourceId,
          details: JSON.stringify({
            meta: event.meta,
            correlationId: event.correlationId,
          }),
        })
        .select('id, created_at')
        .single();

      if (error) return err(decodeDbError(error));

      return ok({
        ...event,
        id: data.id,
        ts: data.created_at,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
