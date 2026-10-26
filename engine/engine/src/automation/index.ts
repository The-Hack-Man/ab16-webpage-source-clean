import { InMemoryEventDispatcher } from './outbox.js';

export { InMemoryEventDispatcher };
export type {
  EventHandler,
  EventDispatcher,
  DomainEvent,
  OutboxStore,
  OutboxEntry,
  OutboxTickDeps,
  OutboxTickResult,
  JobRecord,
  JobStatus,
  SchedulerAdapter,
  SchedulerTickResult,
  AutomationConfig,
  JobContracts,
  OutboxEventContracts,
  JobType,
  OutboxEventType,
} from '../contracts/automation.js';
export { buildEvent } from '../contracts/automation.js';
export { runOutboxTick } from './outbox.js';
export { runSchedulerTick, backoffDelay } from '../operations/workflow_runner.js';
