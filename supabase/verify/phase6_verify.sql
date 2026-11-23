-- Rana Scent: Phase 6 (colour variants) post-migration checks. READ-ONLY.
-- Run in the Supabase SQL editor after applying the Phase 6 migration.
-- Every row should show ok = true.
with checks(check_name, ok, detail) as (
  select 'Phase 6 migration recorded', count(*) = 1, string_agg(version, ', ')
  from supabase_migrations.schema_migrations
  where version = '20261121090000'
  union all
  select 'colour swatch column exists', count(*) = 1, string_agg(column_name, ', ')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'product_variants' and column_name = 'color_hex'
  union all
  select 'photo-to-colour column exists', count(*) = 1, string_agg(column_name, ', ')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'product_media' and column_name = 'variant_id'
  union all
  select 'swatches are #RRGGBB or empty', count(*) = 0, count(*)::text
  from public.product_variants where color_hex is not null and color_hex !~ '^#[0-9A-Fa-f]{6}$'
  union all
  select 'save_product stores colours', bool_and(prosrc like '%media_variants%' and prosrc like '%color_hex%'), ''
  from pg_proc where proname = 'save_product' and pronamespace = 'public'::regnamespace
  union all
  select 'save_product not callable by visitors', not has_function_privilege('anon', 'public.save_product(jsonb)', 'execute'), ''
  union all
  select 'every existing variant and photo kept (none orphaned)', count(*) = 0, count(*)::text
  from public.product_media pm
  where pm.variant_id is not null and not exists (select 1 from public.product_variants v where v.id = pm.variant_id and v.product_id = pm.product_id)
)
select check_name, ok, detail from checks;
