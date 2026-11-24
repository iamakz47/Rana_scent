-- Rana Scent: Phase 7 (Offers & Bundles) post-migration checks. READ-ONLY.
-- Run in the Supabase SQL editor after applying both Phase 7 migrations
-- (20261123090000_offers_bundles.sql, 20261123090100_offers_api_grants.sql).
-- Every row should show ok = true.
with checks(check_name, ok, detail) as (
  select 'Phase 7 migrations recorded (2)', count(*) = 2, string_agg(version, ', ')
  from supabase_migrations.schema_migrations
  where version in ('20261123090000', '20261123090100')
  union all
  select 'offer schedule/stacking columns exist (3)', count(*) = 3, string_agg(column_name, ', ')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'products'
    and column_name in ('offer_starts_at', 'offer_ends_at', 'allow_discount_stacking')
  union all
  select 'locked colour column exists', count(*) = 1, string_agg(column_name, ', ')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'bundle_items' and column_name = 'locked_variant_id'
  union all
  select 'offer order-breakdown tables exist (2)', count(*) = 2, string_agg(table_name, ', ')
  from information_schema.tables
  where table_schema = 'public' and table_name in ('order_item_components', 'order_item_component_fragrances')
  union all
  select 'RLS enabled on both new tables', bool_and(relrowsecurity), string_agg(relname, ', ')
  from pg_class
  where relname in ('order_item_components', 'order_item_component_fragrances') and relnamespace = 'public'::regnamespace
  union all
  select 'save_offer exists and is not callable by visitors', not has_function_privilege('anon', 'public.save_offer(jsonb)', 'execute'), ''
  from pg_proc where proname = 'save_offer' and pronamespace = 'public'::regnamespace
  union all
  select 'signed-in staff can read the offer breakdown', has_table_privilege('authenticated', 'public.order_item_components', 'select')
    and has_table_privilege('authenticated', 'public.order_item_component_fragrances', 'select'), ''
  union all
  select 'visitors cannot read the offer breakdown directly', not has_table_privilege('anon', 'public.order_item_components', 'select')
    and not has_table_privilege('anon', 'public.order_item_component_fragrances', 'select'), ''
  union all
  select 'checkout respects non-stock-tracked items (track_inventory)', bool_and(prosrc like '%track_inventory%'), ''
  from pg_proc where proname in ('price_cart', 'price_bundle') and pronamespace = 'private'::regnamespace
  union all
  select 'an offer cannot include another offer (nesting guard trigger)', count(*) = 1, string_agg(tgname, ', ')
  from pg_trigger where tgname = 'bundle_items_guard' and not tgisinternal
  union all
  select 'no bundle_items row with a locked colour from the wrong product', count(*) = 0, count(*)::text
  from public.bundle_items bi
  join public.product_variants v on v.id = bi.locked_variant_id
  where v.product_id <> bi.item_product_id
  union all
  select 'no offer published without every included product published', count(*) = 0, count(*)::text
  from public.products p
  where p.type = 'bundle' and p.status = 'published'
    and exists (
      select 1 from public.bundle_items bi join public.products ip on ip.id = bi.item_product_id
      where bi.bundle_id = p.id and ip.status <> 'published'
    )
)
select check_name, ok, detail from checks;
