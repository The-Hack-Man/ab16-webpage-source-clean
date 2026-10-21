import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ReleasePublisher,
  type ReleasePublisherConfig,
  MusicService,
  type MusicConfig,
  InMemoryEventDispatcher,
  buildEvent,
  classifyError,
  DefaultObservabilityProvider,
  type AutomationConfig,
  type EventDispatcher,
  type DomainEvent,
} from '@engine';
import type {
  MusicContentReader,
  MusicPublicationService,
} from '@engine/contracts/music.js';
import type {
  WebsitePublisher,
} from '@engine/contracts/publishing.js';
import type {
  AuditEventWriter,
  AuthorisationProvider,
  AuthContext,
} from '@engine/contracts/security.js';
import type {
  OutboxStore,
  SchedulerAdapter,
  JobRecord,
} from '@engine/contracts/automation.js';
import type {
  HealthCheck,
  DependencyCheck,
} from '@engine/contracts/observability.js';
import {
  SupabaseMusicContentReader,
  SupabaseMusicPublicationService,
  SupabaseWebsitePublisher,
  SupabaseAuditWriter,
  SupabaseOutboxStore,
  SupabaseSchedulerAdapter,
  SupabaseAuthorisationProvider,
  SupabaseDependencyCheck,
  decodeDbError,
} from './adapters';

const AUTOMATION_CONFIG: AutomationConfig = {
  defaultMaxAttempts: 5,
  backoffBaseMs: 2000,
  backoffMaxMs: 300000,
  deadLetterAfter: 5,
  leaseMs: 300000,
};

const MUSIC_CONFIG: MusicConfig = {
  minScheduleLeadMs: 60_000,
};

const RELEASE_PUBLISHER_CONFIG: ReleasePublisherConfig = {
  requireMediaUrls: false,
};

const WEBSITE_BASE_URL = import.meta.env.VITE_SITE_URL ?? 'https://ab16clothing.co.uk';

export class EngineIntegration {
  public readonly contentReader: MusicContentReader;
  public readonly publicationService: MusicPublicationService;
  public readonly websitePublisher: WebsitePublisher;
  public readonly auditWriter: AuditEventWriter;
  public readonly outboxStore: OutboxStore;
  public readonly scheduler: SchedulerAdapter;
  public readonly authorisationProvider: AuthorisationProvider;
  public readonly observability: DefaultObservabilityProvider;
  public readonly musicService: MusicService;
  public readonly releasePublisher: ReleasePublisher;
  public readonly dispatcher: EventDispatcher;

  constructor(private readonly db: SupabaseClient) {
    this.contentReader = new SupabaseMusicContentReader(db);
    this.publicationService = new SupabaseMusicPublicationService(db);
    this.websitePublisher = new SupabaseWebsitePublisher(db, WEBSITE_BASE_URL);
    this.auditWriter = new SupabaseAuditWriter(db);
    this.outboxStore = new SupabaseOutboxStore(db);
    this.scheduler = new SupabaseSchedulerAdapter(db);
    this.authorisationProvider = new SupabaseAuthorisationProvider({
      'music:publish': ['admin', 'super_admin'],
      'music:read': ['admin', 'super_admin'],
      'music:write': ['admin', 'super_admin'],
      'product:publish': ['admin', 'super_admin'],
      'automation:manage': ['admin', 'super_admin'],
      'security:audit': ['admin', 'super_admin'],
      'campaign:manage': ['admin', 'super_admin'],
      'fan:notify': ['admin', 'super_admin'],
      'seo:manage': ['admin', 'super_admin'],
      'health:manage': ['admin', 'super_admin'],
      'workflow:manage': ['admin', 'super_admin'],
      'commerce:read': ['admin', 'super_admin'],
      'commerce:write': ['admin', 'super_admin'],
      'inventory:read': ['admin', 'super_admin'],
      'inventory:write': ['admin', 'super_admin'],
      'analytics:read': ['admin', 'super_admin'],
      'orders:read': ['admin', 'super_admin'],
      'orders:write': ['admin', 'super_admin'],
    });
    this.observability = new DefaultObservabilityProvider();
    this.musicService = new MusicService(MUSIC_CONFIG);
    this.releasePublisher = new ReleasePublisher(
      this.contentReader,
      this.publicationService,
      this.websitePublisher,
      this.auditWriter,
      RELEASE_PUBLISHER_CONFIG,
    );

    const supabaseDepCheck: DependencyCheck = new SupabaseDependencyCheck('supabase', db);
    this.observability.registerDependency(supabaseDepCheck);

    this.dispatcher = new InMemoryEventDispatcher();
  }

  getAutomationConfig(): AutomationConfig {
    return AUTOMATION_CONFIG;
  }
}

export type {
  HealthCheck,
  DependencyCheck,
  AuthContext,
  EventDispatcher,
  DomainEvent,
  JobRecord,
  AuditEventWriter,
  AuthorisationProvider,
  OutboxStore,
  SchedulerAdapter,
  MusicContentReader,
  MusicPublicationService,
  WebsitePublisher,
};

export { decodeDbError, buildEvent, classifyError };
