import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { checkAuthorization } from './auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PublishBody {
  releaseId: string;
  pushToStreaming?: boolean;
  actorId?: string;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

interface AuthContext {
  userId: string;
  role: string | null;
  permissions?: string[];
}

interface PublishRequest {
  releaseId: string;
  pushToStreaming?: boolean;
  actorId?: string;
  correlationId?: string;
}

interface PublishResult {
  releaseId: string;
  publishedAt: string;
  affectedPaths: string[];
}

interface ReleaseRecord {
  id: string;
  title: string;
  artist: string;
  type: 'single' | 'ep' | 'album' | 'video';
  status: 'draft' | 'scheduled' | 'upcoming' | 'published' | 'archived';
  releaseDate: string;
  tracks: { id: string; releaseId: string; position: number; title: string; durationSeconds: number; isrc?: string; mediaUrl?: string }[];
  createdAt: string;
}

interface MusicContentReader {
  getReleaseById(id: string): Promise<Result<ReleaseRecord | null>>;
  listReleases(): Promise<Result<ReleaseRecord[]>>;
  listCampaigns(): Promise<Result<{ id: string; title: string; status: string; startsAt: string; endsAt: string }[]>>;
}

interface MusicPublicationService {
  publish(releaseId: string): Promise<Result<ReleaseRecord>>;
  schedule(releaseId: string, publishAt: string): Promise<Result<ReleaseRecord>>;
}

interface WebsitePublisher {
  publish(request: PublishRequest): Promise<Result<PublishResult>>;
  unpublish(releaseId: string): Promise<Result<void>>;
}

interface AuditEventWriter {
  record(event: { actor: string; action: string; resourceType: string; resourceId: string; correlationId?: string; meta?: Record<string, unknown> }): Promise<Result<{ id: string; ts: string; actor: string; action: string; resourceType: string; resourceId: string; correlationId?: string; meta?: Record<string, unknown> }>>;
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err(message: string | Error): Result<never> {
  return { ok: false, error: message instanceof Error ? message : new Error(message) };
}

async function publishRelease(
  ctx: AuthContext,
  request: PublishRequest,
  contentReader: MusicContentReader,
  publicationService: MusicPublicationService,
  websitePublisher: WebsitePublisher,
  auditWriter: AuditEventWriter,
): Promise<Result<PublishResult & { release?: ReleaseRecord }>> {
  const releaseResult = await contentReader.getReleaseById(request.releaseId);
  if (!releaseResult.ok) return releaseResult;
  const release = releaseResult.value;
  if (!release) return err(`Release ${request.releaseId} not found`);

  const publishResult = await publicationService.publish(request.releaseId);
  if (!publishResult.ok) return publishResult;

  const websiteResult = await websitePublisher.publish({
    releaseId: request.releaseId,
    pushToStreaming: request.pushToStreaming ?? false,
    actorId: request.actorId ?? ctx.userId,
    correlationId: request.correlationId,
  });
  if (!websiteResult.ok) return websiteResult;

  await auditWriter.record({
    actor: request.actorId ?? ctx.userId,
    action: 'release.published',
    resourceType: 'music_release',
    resourceId: request.releaseId,
    correlationId: request.correlationId,
    meta: { pushToStreaming: request.pushToStreaming ?? false },
  });

  return ok({ ...websiteResult.value, release: publishResult.value });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError('Server is not configured', 503);
    }

    const authHeader = req.headers.get('authorization') ?? '';
    const userToken = authHeader.replace('Bearer ', '');

    if (!userToken) {
      return jsonError('Authentication required', 401);
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return jsonError('Invalid or expired session', 401);
    }

    const authDecision = checkAuthorization(user);
    if (!authDecision.authorized) {
      return jsonError(authDecision.error!, authDecision.statusCode!);
    }
    const userRole = authDecision.role;

    const body: PublishBody = await req.json();
    if (!body.releaseId) {
      return jsonError('releaseId is required', 400);
    }

    const correlationId = crypto.randomUUID();
    const ctx: AuthContext = {
      userId: user.id,
      role: userRole ?? 'admin',
      permissions: ['music:publish', 'music:read'],
    };

    const serviceRoleDb = createClient(supabaseUrl, serviceRoleKey);

    const contentReader: MusicContentReader = {
      getReleaseById: async (id: string) => {
        const { data: release, error: relErr } = await serviceRoleDb
          .from('music_releases')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (relErr) return err(relErr.message);
        if (!release) return ok(null);

        const { data: tracks, error: trErr } = await serviceRoleDb
          .from('tracks')
          .select('*')
          .eq('release_id', id)
          .order('position');

        if (trErr) return err(trErr.message);

        return ok({
          id: release.id,
          title: release.title,
          artist: release.artist,
          type: release.release_type as 'single' | 'ep' | 'album' | 'video',
          status: normalizeStatus(release.status),
          releaseDate: release.release_date ?? new Date().toISOString(),
          tracks: (tracks ?? []).map(mapTrack),
          createdAt: release.created_at ?? new Date().toISOString(),
        });
      },

      listReleases: async () => {
        const { data, error } = await serviceRoleDb
          .from('music_releases')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) return err(error.message);
        return ok((data ?? []).map(mapRelease));
      },

      listCampaigns: async () => {
        const { data, error } = await serviceRoleDb.from('campaigns').select('*');
        if (error) return err(error.message);
        return ok((data ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: c.name as string,
          status: c.status as string,
          startsAt: (c.start_date ?? new Date().toISOString()) as string,
          endsAt: (c.end_date ?? new Date().toISOString()) as string,
        })));
      },
    };

    const publicationService: MusicPublicationService = {
      publish: async (releaseId: string) => {
        const { data, error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('id', releaseId)
          .select('id, status, updated_at')
          .maybeSingle();
        if (error) return err(error.message);
        if (!data) return err(`Release ${releaseId} not found`);
        return ok({
          id: data.id,
          title: '',
          artist: '',
          type: 'single' as const,
          status: 'published' as const,
          releaseDate: new Date().toISOString(),
          tracks: [],
          createdAt: data.updated_at,
        });
      },
      schedule: async (releaseId: string, publishAt: string) => {
        const { data, error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'scheduled', release_date: publishAt, updated_at: new Date().toISOString() })
          .eq('id', releaseId)
          .select('id, status, release_date')
          .maybeSingle();
        if (error) return err(error.message);
        if (!data) return err(`Release ${releaseId} not found`);
        return ok({
          id: data.id,
          title: '',
          artist: '',
          type: 'single' as const,
          status: 'scheduled' as const,
          releaseDate: data.release_date ?? publishAt,
          tracks: [],
          createdAt: new Date().toISOString(),
        });
      },
    };

    const websitePublisher: WebsitePublisher = {
      publish: async (request: PublishRequest) => {
        const { data: release, error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('id', request.releaseId)
          .select('slug')
          .maybeSingle();
        if (error) return err(error.message);
        if (!release) return err(`Release ${request.releaseId} not found`);

        const affectedPaths: string[] = [`/releases/${release.slug}`, '/releases', '/'];

        await serviceRoleDb.from('outbox').insert({
          event_type: 'music.release.published',
          payload: { releaseId: request.releaseId, actorId: ctx.userId },
          version: 1,
          correlation_id: correlationId,
          idempotency_key: `music.release.published:${correlationId}`,
        });

        return ok({
          releaseId: request.releaseId,
          publishedAt: new Date().toISOString(),
          affectedPaths,
        });
      },
      unpublish: async (releaseId: string) => {
        const { error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'draft', updated_at: new Date().toISOString() })
          .eq('id', releaseId);
        if (error) return err(error.message);
        return ok(undefined);
      },
    };

    const auditWriter: AuditEventWriter = {
      record: async (event) => {
        const { data, error } = await serviceRoleDb
          .from('audit_logs')
          .insert({
            actor_id: event.actor,
            action: event.action,
            entity: event.resourceType,
            entity_id: event.resourceId,
            details: JSON.stringify({ meta: event.meta, correlationId: event.correlationId }),
          })
          .select('id, created_at')
          .single();
        if (error) return err(error.message);
        return ok({ ...event, id: data.id, ts: data.created_at });
      },
    };

    const publishRequest: PublishRequest = {
      releaseId: body.releaseId,
      pushToStreaming: body.pushToStreaming ?? false,
      actorId: body.actorId ?? user.id,
      correlationId,
    };

    const result = await publishRelease(ctx, publishRequest, contentReader, publicationService, websitePublisher, auditWriter);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonError(message, 500);
  }
});

function normalizeStatus(status: string): ReleaseRecord['status'] {
  const valid = ['draft', 'scheduled', 'upcoming', 'published', 'archived'];
  return (valid.includes(status) ? status : 'draft') as ReleaseRecord['status'];
}

function mapTrack(t: Record<string, unknown>): ReleaseRecord['tracks'][number] {
  return {
    id: String(t.id),
    releaseId: String(t.release_id),
    position: Number(t.position),
    title: String(t.title),
    durationSeconds: Number(t.duration_seconds ?? 0),
    isrc: t.isrc as string | undefined,
    mediaUrl: t.media_url as string | undefined,
  };
}

function mapRelease(r: Record<string, unknown>): ReleaseRecord {
  return {
    id: String(r.id),
    title: String(r.title),
    artist: String(r.artist),
    type: (r.release_type as ReleaseRecord['type']) ?? 'single',
    status: normalizeStatus(String(r.status)),
    releaseDate: (r.release_date as string) ?? new Date().toISOString(),
    tracks: [],
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
