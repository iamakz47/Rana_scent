-- Rana Scent: explicit Data API privileges for the Phase 4 tables.
-- Production does not grant table privileges to the API roles
-- automatically. Idempotent; grants only (RLS still decides rows).
revoke all on public.account_deletion_requests, public.email_messages, public.notification_settings from anon;
grant select on public.account_deletion_requests to authenticated;
grant select on public.email_messages to authenticated;
grant select, update on public.notification_settings to authenticated;
grant all on public.account_deletion_requests, public.email_messages, public.notification_settings to service_role;
-- Customers manage their own addresses and profile (RLS limits rows).
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, update on public.profiles to authenticated;
-- Server code (service role) reads orders and items to render emails and
-- reconcile payments.
grant select on public.orders, public.order_items, public.payments, public.refund_requests,
  public.product_variants, public.products, public.inventory to service_role;
grant usage, select on all sequences in schema public to service_role;
