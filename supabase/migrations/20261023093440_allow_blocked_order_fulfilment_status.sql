ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfilment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfilment_status_check
  CHECK (fulfilment_status IN ('unfulfilled', 'fulfilled', 'shipped', 'cancelled', 'blocked'));

ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_fulfilment_status_check;;
