-- The existing printful_orders_order_idx is already UNIQUE on order_id.
-- Keep it as the one canonical uniqueness guarantee.
DROP INDEX IF EXISTS public.printful_orders_order_id_uidx;;
