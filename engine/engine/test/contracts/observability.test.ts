import { describe, it, expect } from 'vitest';
import type { HealthCheck, HealthStatus, DependencyCheck } from '../../src/contracts/observability.js';
import { ok } from '../../src/validation.js';

describe('HealthCheck type', () => {
  it.each(['healthy', 'degraded', 'unhealthy'] as HealthStatus[])(
    'accepts %s status',
    (status) => {
      const check: HealthCheck = { name: 'test', status, latencyMs: 42 };
      expect(check.status).toBe(status);
    },
  );

  it('has optional latencyMs', () => {
    const check: HealthCheck = { name: 'test', status: 'healthy' };
    expect(check.latencyMs).toBeUndefined();
  });
});

describe('DependencyCheck interface', () => {
  it('has name, required, and check method', () => {
    const dep: DependencyCheck = {
      name: 'db',
      required: true,
      check: async () => ok({ name: 'db', status: 'healthy' }),
    };
    expect(dep.name).toBe('db');
    expect(dep.required).toBe(true);
    expect(typeof dep.check).toBe('function');
  });

  it('check returns Result<HealthCheck>', async () => {
    const dep: DependencyCheck = {
      name: 'cache',
      required: false,
      check: async () => ok({ name: 'cache', status: 'degraded', latencyMs: 100 }),
    };
    const result = await dep.check();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('degraded');
      expect(result.value.latencyMs).toBe(100);
    }
  });
});

