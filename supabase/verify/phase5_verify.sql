-- Rana Scent: Phase 5 post-migration checks. READ-ONLY (selects only).
-- Run in the Supabase SQL editor after applying the Phase 5 migrations.
-- Every row should show ok = true.
with checks(check_name, ok, detail) as (
  select 'Phase 5 migrations recorded (3)', count(*) = 3, string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations
  where version in ('20261120090000', '20261120090100', '20261120090200')
  union all
  select 'product detail columns exist', count(*) = 4, string_agg(column_name, ', ' order by column_name)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'products'
    and column_name in ('free_fragrances', 'free_fragrance_eligible', 'device_specs', 'info_sections')
  union all
  select 'new tables have RLS', bool_and(c.relrowsecurity) and count(*) = 2, string_agg(c.relname, ', ')
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('order_item_fragrances', 'site_policies')
  union all
  select 'six policy drafts, none published yet', count(*) = 6 and bool_and(published_at is null),
    string_agg(key || case when published_at is null then '' else ' (published)' end, ', ' order by position)
  from public.site_policies
  union all
  select 'visitors cannot read policy drafts or fragrance choices',
    not (has_table_privilege('anon', 'public.site_policies', 'select')
      or has_table_privilege('anon', 'public.order_item_fragrances', 'select')),
    'anon has no select'
  union all
  select 'visitors can read published policies and the fragrance list',
    has_function_privilege('anon', 'public.get_policy(text)', 'execute')
      and has_function_privilege('anon', 'public.list_free_fragrances()', 'execute'),
    'get_policy, list_free_fragrances'
  union all
  select 'only signed-in users can call policy edit functions (they check settings.write)',
    not (has_function_privilege('anon', 'public.save_policy_draft(text,text,text,text,text)', 'execute')
      or has_function_privilege('anon', 'public.publish_policy(text)', 'execute')),
    'save_policy_draft, publish_policy'
  union all
  select 'checkout validates free fragrances',
    pg_get_functiondef('public.place_order(jsonb)'::regprocedure) like '%free_fragrance_problem%'
      and pg_get_functiondef('public.quote_order(jsonb,text,text,text)'::regprocedure) like '%free_fragrance_problem%',
    'place_order, quote_order'
  union all
  select 'only diffusers keep a free fragrance count', count(*) = 0, count(*)::text
  from public.products where free_fragrances is not null and type <> 'diffuser'
)
select check_name, ok, detail from checks;
