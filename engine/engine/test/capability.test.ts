import { describe, it, expect } from 'vitest';
import { hasPermission } from '../src/capability.js';
import type { AuthContext } from '../src/contracts/security.js';

const CAPS = {
  'music:publish': ['admin', 'super_admin'],
  'music:read': ['admin', 'super_admin', 'user'],
  'product:publish': ['admin', 'super_admin'],
};

describe('hasPermission', () => {
  it('returns true when role is in allowed roles', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    expect(hasPermission(ctx, 'music:publish', CAPS)).toBe(true);
  });

  it('returns true for super_admin role', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'super_admin' };
    expect(hasPermission(ctx, 'product:publish', CAPS)).toBe(true);
  });

  it('returns false when role is not in allowed roles', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'user' };
    expect(hasPermission(ctx, 'product:publish', CAPS)).toBe(false);
  });

  it('returns false when userId is empty', () => {
    const ctx: AuthContext = { userId: '', role: 'admin' };
    expect(hasPermission(ctx, 'music:publish', CAPS)).toBe(false);
  });

  it('uses permissions array if provided', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'user', permissions: ['music:read'] };
    expect(hasPermission(ctx, 'music:read', CAPS)).toBe(false);
  });

  it('returns false for unknown permission', () => {
    const ctx: AuthContext = { userId: 'u1', role: 'admin' };
    expect(hasPermission(ctx, 'unknown:permission', CAPS)).toBe(false);
  });

  it('handles null role', () => {
    const ctx: AuthContext = { userId: 'u1', role: null };
    expect(hasPermission(ctx, 'music:publish', CAPS)).toBe(false);
  });
});
