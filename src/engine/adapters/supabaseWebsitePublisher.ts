import { ok, err } from '@engine/validation.js';
import type { Result } from '@engine/validation.js';
import type { WebsitePublisher, PublishResult, PublishRequest } from '@engine/contracts/publishing.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeDbError } from './utils';

export class SupabaseWebsitePublisher implements WebsitePublisher {
  private readonly baseUrl: string;

  constructor(private readonly db: SupabaseClient, baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async publish(request: PublishRequest): Promise<Result<PublishResult>> {
    try {
      const { data: release, error } = await this.db
        .from('music_releases')
        .update({
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.releaseId)
        .select('slug')
        .maybeSingle();

      if (error) return err(decodeDbError(error));
      if (!release) return err(new Error(`Release ${request.releaseId} not found`));

      const slug = release.slug;

      return ok({
        releaseId: request.releaseId,
        publishedAt: new Date().toISOString(),
        affectedPaths: [
          `/releases/${slug}`,
          '/releases',
          '/',
        ],
      });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async unpublish(releaseId: string): Promise<Result<void>> {
    try {
      const { error } = await this.db
        .from('music_releases')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', releaseId);

      if (error) return err(decodeDbError(error));
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
