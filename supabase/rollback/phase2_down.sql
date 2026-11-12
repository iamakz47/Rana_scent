-- Rana Scent: Phase 2 ROLLBACK. Emergency use only, and only with approval.
--
-- Removes exactly the objects created by supabase/migrations/20261103090000
-- to 20261103090600, returning the database to its pre-Phase-2 state.
-- WARNING: it deletes all Phase 2 data (products, staff roles, slides, stock
-- history, audit log...) and the uploads in the "media" Storage bucket.
-- Auth users are NOT deleted. Take a backup first.
--
-- Run in the Supabase SQL editor as the project owner, then clear the
-- migration history so the files can be re-applied later:
--   delete from supabase_migrations.schema_migrations where version between '20261103090000' and '20261103090600';

begin;

-- Hooks into schemas Phase 2 does not own.
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "Media editors list media objects" on storage.objects;
drop policy if exists "Media editors upload media objects" on storage.objects;
drop policy if exists "Media editors update media objects" on storage.objects;
drop policy if exists "Media editors delete media objects" on storage.objects;

-- Public functions (tables' own triggers and policies go with the tables).
drop function if exists public.save_product(jsonb);
drop function if exists public.reorder(text, uuid[]);
drop function if exists public.media_usage(uuid);
drop function if exists public.list_staff();
drop function if exists public.assign_staff_role(text, text, text);
drop function if exists public.adjust_inventory(uuid, integer, public.inventory_reason, text);

-- Tables, children first.
drop table if exists
  public.payment_events, public.payments, public.order_status_history, public.order_items,
  public.orders, public.expenses, public.discount_codes, public.promotions,
  public.shipping_rates, public.shipping_zones, public.customer_addresses,
  public.homepage_slides, public.homepage_sections, public.store_settings,
  public.inventory_movements, public.inventory, public.bundle_items,
  public.device_compatibility, public.product_scents, public.product_categories,
  public.product_media, public.product_variants, public.products, public.categories,
  public.scent_families, public.media_assets, public.audit_logs, public.staff_members,
  public.role_permissions, public.permissions, public.roles, public.profiles;

drop type if exists public.payment_status, public.order_status, public.inventory_reason,
  public.publish_status, public.product_type;

-- Phase 2 helper functions, then the schema only if nothing else is in it
-- (no CASCADE, so unrelated objects can never be removed).
drop function if exists
  private.audit_row(), private.bootstrap_owner(uuid, text), private.create_inventory_row(),
  private.find_confirmed_user(text), private.guard_media_assets(), private.guard_order_update(),
  private.guard_product_status(), private.guard_staff_members(), private.guard_store_settings(),
  private.handle_new_user(), private.has_permission(text), private.is_staff(),
  private.media_is_public(uuid), private.product_is_public(uuid), private.record_order_status(),
  private.set_updated_at(), private.staff_role(), private.stamp_published_at();
drop schema if exists private;

commit;

-- Storage bucket: Supabase blocks deleting storage rows from SQL. Remove it
-- in the dashboard (Storage → media → empty bucket → delete bucket).
