import type { Result } from '../validation.ts';

export type Permission =
  | 'music:publish'
  | 'music:read'
  | 'music:write'
  | 'product:publish'
  | 'automation:manage'
  | 'security:audit'
  | 'campaign:manage'
  | 'fan:notify'
  | 'seo:manage'
  | 'health:manage'
  | 'workflow:manage'
  | 'commerce:read'
  | 'commerce:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'analytics:read'
  | 'orders:read'
  | 'orders:write'
  | string;

export type AuthContext = {
  userId: string;
  role: string | null;
  permissions?: string[];
};

export type AuditEvent = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId?: string;
  meta?: Record<string, unknown>;
};

export interface AuditEventWriter {
  record(
    event: Omit<AuditEvent, 'id' | 'ts'>,
  ): Promise<Result<AuditEvent>>;
}

export interface AuthorisationProvider {
  can(
    ctx: AuthContext,
    permission: Permission,
  ): Promise<{ ok: true; value: boolean } | { ok: false; error: Error }>;
}
