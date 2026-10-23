import { describe, it, expect } from 'vitest';
import { hasPermission } from '../../src/capability.js';
import type { AuthContext } from '../../src/contracts/security.js';

describe('Capability edge cases', () => {
  const caps = {
    'music:publish': ['admin', 'super_admin'],
    'music:read': ['admin', 'super_admin', 'user'],
  };

  it('empty userId returns false even with correct role', () => {
    expect(hasPermission({ userId: '', role: 'admin' }, 'music:publish', caps)).toBe(false);
  });

  it('null role with empty permissions returns false', () => {
    const ctx: AuthContext = { userId: 'u1', role: null, permissions: [] };
    expect(hasPermission(ctx, 'music:publish', caps)).toBe(false);
  });

  it('admin role grants music:publish', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin', permissions: [] };
    expect(hasPermission(ctx, 'music:publish', caps)).toBe(true);
  });

  it('wildcard permission not supported (exact match only)', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    expect(hasPermission(ctx, 'music:*', caps)).toBe(false);
  });

  it('case-sensitive role matching', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'Admin' };
    expect(hasPermission(ctx, 'music:publish', caps)).toBe(false);
  });
});

