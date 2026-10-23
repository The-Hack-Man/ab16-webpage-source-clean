import type { Result } from '../validation.js';
import { ok } from '../validation.js';

export type LaunchOrchestratorConfig = {
  minScheduleLeadMs: number;
};

export class LaunchOrchestrator {
  constructor(private readonly config: LaunchOrchestratorConfig) {}

  getConfig(): LaunchOrchestratorConfig {
    return this.config;
  }

  validateLaunchTiming(
    scheduledFor: string,
    now: string,
  ): Result<{ valid: boolean; leadMs: number }> {
    const scheduled = new Date(scheduledFor).getTime();
    const currentTime = new Date(now).getTime();
    const leadMs = scheduled - currentTime;
    const valid = leadMs >= this.config.minScheduleLeadMs;
    return ok({ valid, leadMs });
  }
}
