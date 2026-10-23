# Stripe webhook recovery patch

This patch is intentionally **not deployed**. It contains an additive migration and a corrected helper. It does not include a replacement `stripe-webhook/index.ts` because the current live function contains audio-mastering and fulfilment logic that must be preserved and patched in place.

## Apply sequence

1. Review and apply `20261023_stripe_event_claim_status.sql`.
2. In the live webhook source, change the claim RPC to `claim_stripe_event_v2` and handle its result:
   - `claimed`: proceed.
   - `completed`: return HTTP 200 duplicate acknowledgement.
   - `locked`: return HTTP 500 (or another retryable non-2xx) so Stripe redelivers; do not claim it was processed.
3. Remove the current early-return path that marks an event completed merely because a Printful remote ID exists. Reconcile the local `printful_orders` row and `orders.fulfilment_status`; do not create a second remote order.
4. Check the result of every `mark_stripe_event_completed` and `mark_stripe_event_failed` RPC. A failed completion write must return non-2xx.
5. Preserve the current audio-mastering job/payment validation and atomic `grant_mastering_credits` RPC.
6. Deploy the webhook only after the migration and code review, then test Stripe signed-event redelivery in test mode.

## Important limitations

- The SQL is additive and preserves the old boolean RPC for compatibility.
- The helper is pure code; replacing it does not change deployed behaviour unless the webhook imports and uses it.
- Do not create Printful mappings without checking the actual Printful product/variant IDs.
- This patch does not rotate Stripe keys or claim end-to-end tests have passed.
