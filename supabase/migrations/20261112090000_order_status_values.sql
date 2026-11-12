-- Rana Scent: delivery stages for orders.
-- Kept in its own migration: Postgres cannot use a new enum value in the
-- same transaction that adds it. Additive and non-destructive.
alter type public.order_status add value if not exists 'ready_for_delivery' after 'processing';
alter type public.order_status add value if not exists 'out_for_delivery' after 'ready_for_delivery';
