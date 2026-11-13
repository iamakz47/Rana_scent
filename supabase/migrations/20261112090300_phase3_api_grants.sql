-- Rana Scent: explicit Data API privileges for the Phase 3 tables.
-- Production does not grant table privileges to the API roles
-- automatically. Idempotent; grants only (RLS still decides rows).
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.order_status_history, public.payments to authenticated;
grant select, insert on public.order_notes to authenticated;
grant select on public.refund_requests to authenticated;
revoke all on public.order_notes, public.refund_requests from anon;
grant all on public.order_notes, public.refund_requests to service_role;
grant usage, select on all sequences in schema public to service_role;
