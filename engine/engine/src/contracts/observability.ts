import type { Result } from '../validation.ts';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type HealthCheck = {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
};

export interface DependencyCheck {
  name: string;
  required: boolean;
  check(): Promise<Result<HealthCheck>>;
}

export interface ObservabilityProvider {
  registerDependency(dep: DependencyCheck): void;
  check(): Promise<Result<HealthCheck[]>>;
}
