import { ok } from '@engine/validation.js';
import type { AuthorisationProvider, AuthContext, Permission } from '@engine/contracts/security.js';

export class SupabaseAuthorisationProvider implements AuthorisationProvider {
  constructor(private readonly allowedRoles: Record<Permission, string[]>) {}

  async can(
    ctx: AuthContext,
    permission: Permission,
  ): Promise<{ ok: true; value: boolean } | { ok: false; error: Error }> {
    if (!ctx.userId) return ok(false);
    const allowedRoles = this.allowedRoles[permission] ?? [];
    const userRole = ctx.role ?? '';
    return ok(allowedRoles.includes(userRole));
  }
}
