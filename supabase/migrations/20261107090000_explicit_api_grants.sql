-- Rana Scent: explicit Data API privileges for the Phase 2 tables.
--
-- Some Supabase projects (including production) do not grant table
-- privileges to the API roles automatically. Without these grants the
-- storefront and the admin receive "permission denied" on every table.
-- Grants only decide which operations a role may attempt; row-level security
-- still decides which rows. Least privilege: anon may only read the public
-- catalog and content; authenticated gets exactly what its policies use.
-- Idempotent and non-destructive (grants/revokes of privileges only).

grant usage on schema public to anon, authenticated, service_role;

-- No API role ever needs these on Phase 2 tables.
revoke truncate, references, trigger on
  public.roles, public.permissions, public.role_permissions, public.staff_members,
  public.audit_logs, public.profiles, public.media_assets, public.scent_families,
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_categories, public.product_scents, public.device_compatibility,
  public.bundle_items, public.inventory, public.inventory_movements, public.store_settings,
  public.homepage_slides, public.homepage_sections, public.customer_addresses,
  public.shipping_zones, public.shipping_rates, public.discount_codes, public.promotions,
  public.orders, public.order_items, public.order_status_history, public.payments,
  public.payment_events, public.expenses
from anon, authenticated;

-- Anonymous visitors: read-only, public tables only (RLS limits rows to
-- published/visible content). No write privileges at all.
revoke insert, update, delete on
  public.roles, public.permissions, public.role_permissions, public.staff_members,
  public.audit_logs, public.profiles, public.media_assets, public.scent_families,
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_categories, public.product_scents, public.device_compatibility,
  public.bundle_items, public.inventory, public.inventory_movements, public.store_settings,
  public.homepage_slides, public.homepage_sections, public.customer_addresses,
  public.shipping_zones, public.shipping_rates, public.discount_codes, public.promotions,
  public.orders, public.order_items, public.order_status_history, public.payments,
  public.payment_events, public.expenses
from anon;

grant select on
  public.scent_families, public.categories, public.products, public.product_variants,
  public.product_media, public.product_categories, public.product_scents,
  public.device_compatibility, public.bundle_items, public.inventory, public.media_assets,
  public.store_settings, public.homepage_slides, public.homepage_sections,
  public.shipping_zones, public.shipping_rates, public.promotions
to anon;

-- Signed-in users (staff and, later, customers): reads everywhere RLS has a
-- policy for them; writes only where a policy allows it.
grant select on
  public.roles, public.permissions, public.role_permissions, public.staff_members,
  public.audit_logs, public.profiles, public.media_assets, public.scent_families,
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_categories, public.product_scents, public.device_compatibility,
  public.bundle_items, public.inventory, public.inventory_movements, public.store_settings,
  public.homepage_slides, public.homepage_sections, public.customer_addresses,
  public.shipping_zones, public.shipping_rates, public.discount_codes, public.promotions,
  public.orders, public.order_items, public.order_status_history, public.payments,
  public.payment_events, public.expenses
to authenticated;

grant insert, update, delete on
  public.staff_members, public.media_assets, public.scent_families, public.categories,
  public.products, public.product_variants, public.product_media, public.product_categories,
  public.product_scents, public.device_compatibility, public.bundle_items,
  public.homepage_slides, public.customer_addresses, public.shipping_zones,
  public.shipping_rates, public.discount_codes, public.promotions, public.expenses
to authenticated;

grant update on public.profiles, public.store_settings, public.homepage_sections, public.orders
to authenticated;

-- Stock changes only through adjust_inventory(); thresholds are editable.
grant update (low_stock_threshold, track_inventory) on public.inventory to authenticated;

-- Trusted server code (service role bypasses RLS by design).
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
