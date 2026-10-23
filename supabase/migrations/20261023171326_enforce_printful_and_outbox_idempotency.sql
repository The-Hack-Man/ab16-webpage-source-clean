
-- One local order may reserve at most one Printful fulfilment row.
-- Preflight verified the table currently has zero rows and no duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS printful_orders_order_id_uidx
  ON public.printful_orders (order_id);

-- The outbox's idempotency key must be unique so a retried transaction cannot
-- enqueue the same logical event twice. Preflight verified zero rows/duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS outbox_idempotency_key_uidx
  ON public.outbox (idempotency_key);
;
