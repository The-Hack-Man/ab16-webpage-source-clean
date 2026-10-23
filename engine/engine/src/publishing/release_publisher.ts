import type { Result } from '../validation.js';
import { ok, err } from '../validation.js';
import type { ReleaseRecord } from '../contracts/music.js';
import type {
  MusicContentReader,
  MusicPublicationService,
} from '../contracts/music.js';
import type {
  WebsitePublisher,
  PublishResult,
  PublishRequest,
} from '../contracts/publishing.js';
import type { AuditEventWriter, AuthContext } from '../contracts/security.js';

export type ReleasePublisherConfig = {
  requireMediaUrls: boolean;
};

export class ReleasePublisher {
  constructor(
    private readonly contentReader: MusicContentReader,
    private readonly publicationService: MusicPublicationService,
    private readonly websitePublisher: WebsitePublisher,
    private readonly auditWriter: AuditEventWriter,
    private readonly config: ReleasePublisherConfig,
  ) {}

  async publish(
    ctx: AuthContext,
    request: PublishRequest,
  ): Promise<Result<PublishResult & { release?: ReleaseRecord }>> {
    const releaseResult = await this.contentReader.getReleaseById(request.releaseId);
    if (!releaseResult.ok) {
      return releaseResult;
    }
    const release = releaseResult.value;
    if (!release) {
      return err(`Release ${request.releaseId} not found`);
    }

    if (this.config.requireMediaUrls) {
      const hasMedia = release.tracks.some((t) => t.mediaUrl);
      if (!hasMedia) {
        return err('Release must have media URLs when requireMediaUrls is set');
      }
    }

    const publishResult = await this.publicationService.publish(request.releaseId);
    if (!publishResult.ok) {
      return publishResult;
    }

    const websiteResult = await this.websitePublisher.publish({
      releaseId: request.releaseId,
      pushToStreaming: request.pushToStreaming ?? false,
      actorId: request.actorId ?? ctx.userId,
      correlationId: request.correlationId,
    });
    if (!websiteResult.ok) {
      return websiteResult;
    }

    await this.auditWriter.record({
      actor: request.actorId ?? ctx.userId,
      action: 'release.published',
      resourceType: 'music_release',
      resourceId: request.releaseId,
      correlationId: request.correlationId,
      meta: {
        pushToStreaming: request.pushToStreaming ?? false,
      },
    });

    return ok({
      ...websiteResult.value,
      release: publishResult.value,
    });
  }

  async unpublish(
    ctx: AuthContext,
    releaseId: string,
    correlationId?: string,
  ): Promise<Result<{ releaseId: string; unpublishedAt: string }>> {
    await this.auditWriter.record({
      actor: ctx.userId,
      action: 'release.unpublished',
      resourceType: 'music_release',
      resourceId: releaseId,
      correlationId,
    });

    const result = await this.websitePublisher.unpublish(releaseId);
    if (!result.ok) return result;

    return ok({ releaseId, unpublishedAt: new Date().toISOString() });
  }
}

export type { WebsitePublisher, PublishResult, PublishRequest };
