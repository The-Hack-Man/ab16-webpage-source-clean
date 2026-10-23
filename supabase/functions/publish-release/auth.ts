export interface SupabaseUser {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface AuthDecision {
  authorized: boolean;
  role: string | null;
  error?: string;
  statusCode?: number;
}

export function checkAuthorization(user: SupabaseUser): AuthDecision {
  const role = (user.app_metadata as { role?: string })?.role ?? null;
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isAdmin) {
    return {
      authorized: false,
      role,
      error: 'Administrator access required',
      statusCode: 403,
    };
  }
  return { authorized: true, role };
}
