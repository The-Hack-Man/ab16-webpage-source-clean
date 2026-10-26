import type {
  EventHandler,
  EventDispatcher,
  DomainEvent,
  OutboxStore,
  OutboxEntry,
  OutboxTickDeps,
  OutboxTickResult,
} from '../contracts/automation.js';
import { buildEvent } from '../contracts/automation.js';

export class InMemoryEventDispatcher implements EventDispatcher {
  private handlers: EventHandler[] = [];

  register(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async dispatch(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      if (handler.type === event.type) {
        await handler.handle(event, this);
      }
    }
  }
}

export async function runOutboxTick(
  deps: OutboxStore,
  dispatcher: EventDispatcher,
  workerId: string,
  clock: () => Date,
): Promise<OutboxTickResult> {
  let processed = 0;
  let failed = 0;

  const now = clock().toISOString();
  const result = await deps.claimNext(now, workerId);

  if (!result.ok) {
    return { processed: 0, failed: 1 };
  }

  if (!result.value) {
    return { processed: 0, failed: 0 };
  }

  const entry = result.value;
  try {
    const event = {
      ...buildEvent(entry.eventType, entry.payload, {
      correlationId: entry.correlationId,
      }),
      // Keep the durable outbox id as the event id so handlers can make their
      // side effects idempotent across retries.
      id: entry.id,
    };
    await dispatcher.dispatch(event);
    await deps.markPublished(entry.id);
    processed++;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await deps.markFailed(entry.id, message);
    failed++;
  }

  return { processed, failed };
}
