import { describe, it, expect } from 'vitest';
import { LaunchOrchestrator } from '../../src/commerce_ops/launch_orchestrator.js';

const config = { minScheduleLeadMs: 60000 };

describe('LaunchOrchestrator', () => {
  it('returns config', () => {
    const orch = new LaunchOrchestrator(config);
    expect(orch.getConfig()).toEqual(config);
  });

  it('validates timing with sufficient lead', () => {
    const orch = new LaunchOrchestrator(config);
    const result = orch.validateLaunchTiming(
      '2025-12-02T00:00:00Z',
      '2025-01-01T00:00:00Z',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.valid).toBe(true);
    }
  });

  it('invalidates timing with insufficient lead', () => {
    const orch = new LaunchOrchestrator(config);
    const now = new Date().toISOString();
    const soon = new Date(Date.now() + 30000).toISOString();
    const result = orch.validateLaunchTiming(soon, now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.valid).toBe(false);
    }
  });

  it('calculates leadMs correctly', () => {
    const orch = new LaunchOrchestrator(config);
    const result = orch.validateLaunchTiming(
      '2025-01-02T00:00:00Z',
      '2025-01-01T00:00:00Z',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.leadMs).toBeGreaterThan(0);
    }
  });
});

