export type { Result, AsyncResult } from './src/validation.js';
export { ok, err } from './src/validation.js';

export { classifyError, DomainErrorImpl, type DomainError } from './src/errors.js';

export type { Role, CapabilityMap } from './src/capability.js';
export { hasPermission } from './src/capability.js';

export { MusicService, type MusicConfig } from './src/music/index.js';
export type {
  MusicContentReader,
  MusicPublicationService,
  ReleaseRecord,
  TrackRecord,
  CampaignRecord,
  ReleaseStatus,
  ReleaseType,
  CampaignStatus,
} from './src/contracts/music.js';

export { ReleasePublisher, type ReleasePublisherConfig } from './src/publishing/release_publisher.js';
export type { WebsitePublisher, PublishResult, PublishRequest } from './src/publishing/release_publisher.js';

export { InMemoryEventDispatcher, runOutboxTick, backoffDelay, runSchedulerTick } from './src/automation/index.js';
export type {
  EventHandler,
  EventDispatcher,
  DomainEvent,
  OutboxStore,
  OutboxEntry,
  SchedulerAdapter,
  JobRecord,
  JobStatus,
  SchedulerTickResult,
  OutboxTickResult,
  AutomationConfig,
  OutboxTickDeps,
} from './src/automation/index.js';

export { DefaultObservabilityProvider } from './src/observability/index.js';
export type { HealthCheck, HealthStatus, DependencyCheck, ObservabilityProvider } from './src/observability/index.js';

export { LaunchOrchestrator, type LaunchOrchestratorConfig } from './src/commerce_ops/launch_orchestrator.js';
export { StripeService, STRIPE_CONFIG } from './src/stripe/index.js';

export { buildEvent } from './src/contracts/automation.js';

export type {
  AuditEventWriter,
  AuditEvent,
  AuthorisationProvider,
  AuthContext,
} from './src/contracts/security.js';
export type { Permission } from './src/contracts/security.js';
