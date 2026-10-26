# Durable automation contracts

Reviewed: 2026-10-25

## Current allowlist

| Outbox event | Versioned payload | Producer | Consumer / idempotency |
| --- | --- | --- | --- |
| `control_desk.health_check.requested` | `{ schemaVersion: 1, runId: UUID }` | Authenticated admin calls `request_control_desk_health_check()`. The RPC atomically creates `control_desk_runs` and an outbox row. | `scheduler-tick` inserts one `control_desk.health_check` job with `source_event_id = outbox.id`; a unique partial index makes redelivery safe. |

| Job | Versioned payload | Side effect / idempotency |
| --- | --- | --- |
| `control_desk.health_check` | `{ schemaVersion: 1, runId: UUID }` | Read-only aggregate counts, then updates the existing run record. Retrying recomputes the same run and does not create additional business records. |

The type registry and payload guard live in `engine/engine/src/contracts/automation.ts`. Worker dispatch uses complete keyed maps, so adding a new type requires an explicit contract and handler. Unsupported types throw and remain retryable/dead-lettered by the durable queue; they are never acknowledged as successful no-ops. The local `publish-release` function no longer emits its previous `music.release.published` outbox row: repository review found no consumer for it, while it caused the worker to repeatedly fail on an unsupported event. Release publication is already persisted in `music_releases` and recorded in `audit_logs`.

## Producer rules

- Write a domain change and its outbox event in the same database transaction, preferably through a narrow RPC. Do not publish directly from a request handler after committing the business row.
- Use a stable idempotency key for each logical event. Preserve the database outbox UUID as the dispatched event ID.
- Include `schemaVersion`, stable entity UUIDs, and only the minimum data needed to execute. Do not put credentials, payment details, or customer PII in queue payloads.
- Consumers must be idempotent on the event/job identity and validate the version and payload before any external side effect.
- Configure explicit retries, leases, and bounded error text. Do not log payloads or secrets.
- Add a contract, producer transaction, consumer, migration, and retry/idempotency coverage together before registering any further event or job.

## Staging state and gate

Staging Supabase project: `kmwdsrzdewnlkbmiagzo` (`eu-west-2`). The app's local-only public Supabase configuration is in ignored `.env.staging`; run the frontend with Vite `--mode staging` after the schema is complete. Staging currently has the first 16 ordered migrations applied. Its catalog contains five published products, all five verified `available_for_sale=false`; there are no orders. Migration replay stopped because the next checked-in merchandise migration enables products and labels them `In Stock`. The staging Control Desk storage/RPC migration and the remaining queue/security migrations have not been applied. Do not deploy or schedule the worker until the complete schema and its required secrets are installed, then verify auth rejection, event-to-job deduplication, job retries, and read-only results in staging.

The staging advisor currently reports five mutable function `search_path` warnings and one authenticated `SECURITY DEFINER` warning for the existing `consume_mastering_credit()` RPC. The later search-path hardening migration is among those not yet applied. The performance advisor reports seven unindexed foreign keys. These findings remain open while staging migration replay is paused; do not describe this staging schema as fully hardened.

Stripe connector currently exposes only the live merchant context. No test-mode context is connected, no test charge was made, and no test webhook can yet be verified. The Stripe account-management URL provided in the task must be completed by the account owner; after completion, refresh the connected Stripe account list and select a context with `livemode=false` before configuring test mode.

Keep product availability disabled until the offer, fulfilment mappings/provider configuration, and customer-facing terms are approved. No production worker, schedule, or sale setting was changed in this task.
