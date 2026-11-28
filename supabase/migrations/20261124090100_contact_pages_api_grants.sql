-- Explicit Data API privileges for contact messages and content pages.
-- Production grants nothing to the API roles automatically. Idempotent;
-- grants only (RLS still decides rows). Visitors never read either table:
-- they send messages and read published pages through functions.
revoke all on public.contact_messages, public.site_pages from anon;
revoke insert, update, delete, truncate on public.contact_messages, public.site_pages from authenticated;
grant select on public.contact_messages, public.site_pages to authenticated;
grant all on public.contact_messages, public.site_pages to service_role;
