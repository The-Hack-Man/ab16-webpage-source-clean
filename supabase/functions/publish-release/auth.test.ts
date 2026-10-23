import { describe, it, expect } from 'vitest';
import { checkAuthorization, type SupabaseUser } from './auth';

function makeUser(overrides: Partial<SupabaseUser> = {}): SupabaseUser {
  return {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  };
}

describe('checkAuthorization', () => {
  it('permits when app_metadata.role is admin', () => {
    const user = makeUser({ app_metadata: { role: 'admin' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(true);
    expect(result.role).toBe('admin');
    expect(result.error).toBeUndefined();
    expect(result.statusCode).toBeUndefined();
  });

  it('permits when app_metadata.role is super_admin', () => {
    const user = makeUser({ app_metadata: { role: 'super_admin' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(true);
    expect(result.role).toBe('super_admin');
  });

  it('denies when app_metadata.role is missing', () => {
    const user = makeUser({ app_metadata: {} });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBeNull();
    expect(result.error).toBe('Administrator access required');
    expect(result.statusCode).toBe(403);
  });

  it('denies when app_metadata is missing entirely', () => {
    const user = makeUser({});
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBeNull();
    expect(result.statusCode).toBe(403);
  });

  it('denies when app_metadata.role is an ordinary user role', () => {
    const user = makeUser({ app_metadata: { role: 'user' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBe('user');
    expect(result.statusCode).toBe(403);
  });

  it('denies when app_metadata.role is an invalid string', () => {
    const user = makeUser({ app_metadata: { role: 'moderator' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBe('moderator');
  });

  it('denies when app_metadata.role is empty string', () => {
    const user = makeUser({ app_metadata: { role: '' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBe('');
  });

  it('NEVER trusts user_metadata.role — denies even when user_metadata.role is admin', () => {
    const user = makeUser({
      app_metadata: {},
      user_metadata: { role: 'admin' },
    });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBeNull();
    expect(result.error).toBe('Administrator access required');
  });

  it('NEVER trusts user_metadata.role — denies even when user_metadata.role is super_admin', () => {
    const user = makeUser({
      app_metadata: {},
      user_metadata: { role: 'super_admin' },
    });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
  });

  it('ignores user_metadata.role when app_metadata has a valid admin role', () => {
    const user = makeUser({
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'super_admin' },
    });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(true);
    expect(result.role).toBe('admin');
  });

  it('is case-sensitive — denies "Admin" with capital A', () => {
    const user = makeUser({ app_metadata: { role: 'Admin' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
    expect(result.role).toBe('Admin');
  });

  it('is case-sensitive — denies "ADMIN" all caps', () => {
    const user = makeUser({ app_metadata: { role: 'ADMIN' } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
  });

  it('denies when role is a non-string type (number)', () => {
    const user = makeUser({ app_metadata: { role: 1 } });
    const result = checkAuthorization(user);
    expect(result.authorized).toBe(false);
  });
});
