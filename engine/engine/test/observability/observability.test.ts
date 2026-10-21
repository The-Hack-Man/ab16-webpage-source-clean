import { describe, it, expect } from 'vitest';
import { DefaultObservabilityProvider } from '../../src/observability/index.js';
import type { DependencyCheck, HealthCheck, HealthStatus } from '../../src/contracts/observability.js';
import { ok, err } from '../../src/validation.js';

describe('DefaultObservabilityProvider', () => {
  it('starts with no dependencies', async () => {
    const provider = new DefaultObservabilityProvider();
    const result = await provider.check();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('registers and checks dependencies', async () => {
    const provider = new DefaultObservabilityProvider();
    const dep: DependencyCheck = {
      name: 'test-dep',
      required: true,
      check: async () => ok({ name: 'test-dep', status: 'healthy' as HealthStatus, latencyMs: 5 }),
    };
    provider.registerDependency(dep);
    const result = await provider.check();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(1);
      expect(result.value[0].status).toBe('healthy');
    }
  });

  it('marks unhealthy when dependency check fails', async () => {
    const provider = new DefaultObservabilityProvider();
    const dep: DependencyCheck = {
      name: 'fail-dep',
      required: true,
      check: async () => err(new Error('connection refused')),
    };
    provider.registerDependency(dep);
    const result = await provider.check();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].status).toBe('unhealthy');
    }
  });

  it('handles multiple dependencies', async () => {
    const provider = new DefaultObservabilityProvider();
    provider.registerDependency({ name: 'dep1', required: true, check: async () => ok({ name: 'dep1', status: 'healthy' }) });
    provider.registerDependency({ name: 'dep2', required: true, check: async () => err(new Error('fail')) });
    const result = await provider.check();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(2);
      expect(result.value[0].status).toBe('healthy');
      expect(result.value[1].status).toBe('unhealthy');
    }
  });
});

