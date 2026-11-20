-- Rana Scent: explicit Data API privileges for the Phase 5 tables.
-- Production does not grant table privileges to the API roles
-- automatically. Idempotent; grants only (RLS still decides rows).
revoke all on public.order_item_fragrances, public.site_policies from anon;
grant select on public.order_item_fragrances to authenticated;
grant select on public.site_policies to authenticated;
grant all on public.order_item_fragrances, public.site_policies to service_role;
grant usage, select on all sequences in schema public to service_role;
