import type { Result } from '../validation.ts';

export type PublishRequest = {
  releaseId: string;
  pushToStreaming?: boolean;
  actorId?: string;
  correlationId?: string;
};

export type PublishResult = {
  releaseId: string;
  publishedAt: string;
  affectedPaths: string[];
};

export interface WebsitePublisher {
  publish(request: PublishRequest): Promise<Result<PublishResult>>;
  unpublish(releaseId: string): Promise<Result<void>>;
}
