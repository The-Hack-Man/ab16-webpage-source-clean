import type { Result } from '@engine/validation.js';
import { ok, err } from '@engine/validation.js';
import type { DependencyCheck, HealthCheck } from '@engine/contracts/observability.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseDependencyCheck implements DependencyCheck {
  constructor(
    public readonly name: string,
    private readonly db: SupabaseClient,
    public readonly required: boolean = true,
  ) {}

  async check(): Promise<Result<HealthCheck>> {
    try {
      const start = Date.now();
      const { error } = await this.db.from('outbox').select('id', { count: 'exact', head: true }).limit(1);
      const latencyMs = Date.now() - start;

      if (error) {
        return err(new Error(`Supabase check failed: ${error.message}`));
      }

      return ok({
        name: this.name,
        status: 'healthy',
        latencyMs,
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
