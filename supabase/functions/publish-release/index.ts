import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  ReleasePublisher,
  type PublishRequest,
  type AuthContext,
  type ReleasePublisherConfig,
} from '../../../engine/engine/index.ts';

const SITE_ORIGIN = new URL(Deno.env.get('PUBLIC_SITE_URL') ?? 'https://ab16clothing.co.uk').origin;
const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishBody {
  releaseId: string;
  pushToStreaming?: boolean;
  actorId?: string;
}

const PUBLISHER_CONFIG: ReleasePublisherConfig = { requireMediaUrls: false };

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

    const userRole = (user.app_metadata as { role?: string })?.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isAdmin) {
      return jsonError('Administrator access required', 403);
    }

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

    const contentReader = {
      getReleaseById: async (id: string) => {
        const { data: release, error: relErr } = await serviceRoleDb
          .from('music_releases')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (relErr) return { ok: false, error: new Error(relErr.message) } as const;
        if (!release) return { ok: true, value: null } as const;

        const { data: tracks, error: trErr } = await serviceRoleDb
          .from('tracks')
          .select('*')
          .eq('release_id', id)
          .order('position');

        if (trErr) return { ok: false, error: new Error(trErr.message) } as const;

        return {
          ok: true,
          value: {
            id: release.id,
            title: release.title,
            artist: release.artist,
            type: release.release_type as 'single' | 'ep' | 'album' | 'video',
            status: normalizeStatus(release.status),
            releaseDate: release.release_date ?? new Date().toISOString(),
            tracks: (tracks ?? []).map(mapTrack),
            createdAt: release.created_at ?? new Date().toISOString(),
          },
        } as const;
      },

      listReleases: async () => {
        const { data, error } = await serviceRoleDb
          .from('music_releases')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) return { ok: false, error: new Error(error.message) } as const;
        return { ok: true, value: (data ?? []).map(mapRelease) } as const;
      },

      listCampaigns: async () => {
        const { data, error } = await serviceRoleDb.from('campaigns').select('*');
        if (error) return { ok: false, error: new Error(error.message) } as const;
        return { ok: true, value: (data ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: c.name as string,
          status: c.status as 'draft' | 'scheduled' | 'active' | 'ended',
          startsAt: (c.start_date ?? new Date().toISOString()) as string,
          endsAt: (c.end_date ?? new Date().toISOString()) as string,
        })) } as const;
      },
    };

    const publicationService = {
      publish: async (releaseId: string) => {
        const { data, error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('id', releaseId)
          .select('id, status, updated_at')
          .maybeSingle();
        if (error) return { ok: false, error: new Error(error.message) } as const;
        if (!data) return { ok: false, error: new Error(`Release ${releaseId} not found`) } as const;
        return { ok: true, value: { id: data.id, status: data.status, publishedAt: data.updated_at } } as const;
      },
      schedule: async (releaseId: string, publishAt: string) => {
        const { data, error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'scheduled', release_date: publishAt, updated_at: new Date().toISOString() })
          .eq('id', releaseId)
          .select('id, status, release_date')
          .maybeSingle();
        if (error) return { ok: false, error: new Error(error.message) } as const;
        if (!data) return { ok: false, error: new Error(`Release ${releaseId} not found`) } as const;
        return { ok: true, value: { id: data.id, status: data.status, scheduledAt: data.release_date ?? publishAt } } as const;
      },
    };

    const websitePublisher = {
      publish: async (request: PublishRequest) => {
        const { data: release, error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'published', updated_at: new Date().toISOString() })
          .eq('id', request.releaseId)
          .select('slug')
          .maybeSingle();
        if (error) return { ok: false, error: new Error(error.message) } as const;
        if (!release) return { ok: false, error: new Error(`Release ${request.releaseId} not found`) } as const;

        const affectedPaths: string[] = [`/releases/${release.slug}`, '/releases', '/'];

        return {
          ok: true,
          value: {
            releaseId: request.releaseId,
            publishedAt: new Date().toISOString(),
            affectedPaths,
          },
        } as const;
      },
      unpublish: async (releaseId: string) => {
        const { error } = await serviceRoleDb
          .from('music_releases')
          .update({ status: 'draft', updated_at: new Date().toISOString() })
          .eq('id', releaseId);
        if (error) return { ok: false, error: new Error(error.message) } as const;
        return { ok: true, value: undefined } as const;
      },
    };

    const auditWriter = {
      record: async (event: { actor: string; action: string; resourceType: string; resourceId: string; correlationId?: string; meta?: Record<string, unknown> }) => {
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
        if (error) return { ok: false, error: new Error(error.message) } as const;
        return {
          ok: true,
          value: {
            ...event,
            id: data.id,
            ts: data.created_at,
          },
        } as const;
      },
    };

    const publisher = new ReleasePublisher(
      contentReader,
      publicationService,
      websitePublisher,
      auditWriter,
      PUBLISHER_CONFIG,
    );

    const publishRequest: PublishRequest = {
      releaseId: body.releaseId,
      pushToStreaming: body.pushToStreaming ?? false,
      actorId: body.actorId ?? user.id,
      correlationId,
    };

    const result = await publisher.publish(ctx, publishRequest);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonError(message, 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
