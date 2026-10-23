import type { Result } from '../validation.js';
import { ok } from '../validation.js';
import type {
  HealthCheck,
  HealthStatus,
  ObservabilityProvider,
  DependencyCheck,
} from '../contracts/observability.js';

export type {
  HealthCheck,
  HealthStatus,
  ObservabilityProvider,
  DependencyCheck,
} from '../contracts/observability.js';

export class DefaultObservabilityProvider implements ObservabilityProvider {
  private dependencies: DependencyCheck[] = [];

  registerDependency(dep: DependencyCheck): void {
    this.dependencies.push(dep);
  }

  async check(): Promise<Result<HealthCheck[]>> {
    const results: HealthCheck[] = [];
    for (const dep of this.dependencies) {
      const result = await dep.check();
      if (!result.ok) {
        results.push({
          name: dep.name,
          status: 'unhealthy',
        });
      } else {
        results.push(result.value);
      }
    }
    return ok(results);
  }
}
