import { describe, it, expect } from 'vitest';
import { hasPermission } from '../../src/capability.js';
import type { AuthorisationProvider, AuthContext, Permission } from '../../src/contracts/security.js';
import { ok } from '../../src/validation.js';

describe('AuthorisationProvider interface', () => {
  const caps: Record<Permission, string[]> = {
    'music:publish': ['admin'],
    'music:read': ['admin', 'user'],
  };

  it('AuthorisationProvider.can returns boolean result', async () => {
    const provider: AuthorisationProvider = {
      can: async (ctx, perm) => ok(hasPermission(ctx, perm, caps)),
    };
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    const result = await provider.can(ctx, 'music:publish');
    expect(result.ok).toBe(true);
  });

  it('denies for insufficient role', async () => {
    const provider: AuthorisationProvider = {
      can: async (ctx, perm) => ok(hasPermission(ctx, perm, caps)),
    };
    const ctx: AuthContext = { userId: 'u1', role: 'user' };
    const result = await provider.can(ctx, 'music:publish');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(false);
  });

  it('allows for matching role', async () => {
    const provider: AuthorisationProvider = {
      can: async (ctx, perm) => ok(hasPermission(ctx, perm, caps)),
    };
    const ctx: AuthContext = { userId: 'u1', role: 'user' };
    const result = await provider.can(ctx, 'music:read');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });
});

describe('AuthContext type', () => {
  it('has optional permissions field', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin', permissions: ['music:publish'] };
    expect(ctx.permissions).toHaveLength(1);
  });

  it('works without permissions field', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'user' };
    expect(ctx.permissions).toBeUndefined();
  });
});

