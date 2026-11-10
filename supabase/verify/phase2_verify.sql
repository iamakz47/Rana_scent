-- Rana Scent: Phase 2 post-migration checks. READ-ONLY (selects only).
-- Run after applying the Phase 2 migrations (including the grants migration).
-- Every row should show ok = true. It only reads; it changes nothing.

with expected_tables(name) as (values
  ('roles'),('permissions'),('role_permissions'),('staff_members'),('audit_logs'),('profiles'),
  ('media_assets'),('scent_families'),('categories'),('products'),('product_variants'),('product_media'),
  ('product_categories'),('product_scents'),('device_compatibility'),('bundle_items'),('inventory'),
  ('inventory_movements'),('store_settings'),('homepage_slides'),('homepage_sections'),
  ('customer_addresses'),('shipping_zones'),('shipping_rates'),('discount_codes'),('promotions'),
  ('orders'),('order_items'),('order_status_history'),('payments'),('payment_events'),('expenses')
),
expected_functions(name) as (values
  ('private.has_permission'),('private.staff_role'),('private.is_staff'),('private.bootstrap_owner'),
  ('private.guard_staff_members'),('private.audit_row'),('private.handle_new_user'),
  ('private.product_is_public'),('private.media_is_public'),('public.adjust_inventory'),
  ('public.save_product'),('public.reorder'),('public.assign_staff_role'),('public.list_staff'),
  ('public.media_usage')
),
checks(check_name, ok, detail) as (
  select 'Phase 2 migrations recorded (6)', count(*) = 6, string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations
  where version in ('20261103090000', '20261103090100', '20261103090200', '20261103090300',
                    '20261103090400', '20261103090600')
  union all
  select 'grants migration recorded', count(*) = 1,
    case when count(*) = 1 then '20261107090000' else 'not applied yet: run supabase db push' end
  from supabase_migrations.schema_migrations where version = '20261107090000'
  union all
  select 'draft-products migration NOT applied', count(*) = 0, count(*)::text
  from supabase_migrations.schema_migrations where version = '20261103090500'
  union all
  select 'tables exist (32)', count(c.relname) = 32, count(c.relname)::text || ' of 32'
  from expected_tables e left join pg_class c
    on c.relname = e.name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  union all
  select 'RLS enabled on all 32', bool_and(c.relrowsecurity), string_agg(c.relname, ', ') filter (where not c.relrowsecurity)
  from expected_tables e join pg_class c on c.relname = e.name and c.relnamespace = 'public'::regnamespace
  union all
  select 'functions exist (15)', count(p.oid) = 15, count(p.oid)::text || ' of 15'
  from expected_functions f left join pg_proc p
    on p.oid = (select oid from pg_proc where (pronamespace::regnamespace::text || '.' || proname) = f.name limit 1)
  union all
  select 'policies on Phase 2 tables', count(*) >= 60, count(*)::text || ' policies'
  from pg_policies where schemaname = 'public'
  union all
  select 'storage policies (4)', count(*) = 4, count(*)::text
  from pg_policies where schemaname = 'storage' and policyname like 'Media editors%'
  union all
  select 'media bucket config',
    bool_and(public and file_size_limit = 8388608 and allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/avif']),
    coalesce(max(id), 'missing')
  from storage.buckets where id = 'media'
  union all
  select 'bootstrap_owner not callable by API roles',
    not (has_function_privilege('anon', 'private.bootstrap_owner(uuid,text)', 'execute')
      or has_function_privilege('authenticated', 'private.bootstrap_owner(uuid,text)', 'execute')
      or has_function_privilege('service_role', 'private.bootstrap_owner(uuid,text)', 'execute')),
    'execute only for the database owner'
  union all
  select 'anon has no privileges on private tables',
    not bool_or(has_table_privilege('anon', 'public.' || t, 'select')),
    string_agg(t, ', ') filter (where has_table_privilege('anon', 'public.' || t, 'select'))
  from unnest(array['staff_members','audit_logs','roles','role_permissions','profiles','orders','payments',
    'payment_events','expenses','discount_codes','customer_addresses','inventory_movements']) t
  union all
  select 'anon can read the public catalog',
    has_table_privilege('anon', 'public.categories', 'select')
      and has_table_privilege('anon', 'public.products', 'select')
      and has_table_privilege('anon', 'public.homepage_slides', 'select')
      and has_table_privilege('anon', 'public.store_settings', 'select'),
    'select on categories, products, slides, settings'
  union all
  select 'anon has no write privileges',
    not bool_or(has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
      or has_table_privilege('anon', c.oid, 'delete') or has_table_privilege('anon', c.oid, 'truncate')),
    string_agg(c.relname, ', ') filter (where has_table_privilege('anon', c.oid, 'insert'))
  from expected_tables e join pg_class c on c.relname = e.name and c.relnamespace = 'public'::regnamespace
  union all
  select 'staff can use the admin tables',
    has_table_privilege('authenticated', 'public.products', 'insert')
      and has_table_privilege('authenticated', 'public.staff_members', 'select')
      and not has_table_privilege('authenticated', 'public.audit_logs', 'insert')
      and not has_table_privilege('authenticated', 'public.role_permissions', 'insert'),
    'catalog writable; audit log and role map read-only'
  union all
  select 'role permissions seeded', count(*) = 18 + 18 + 13 + 6 + 6 + 5, count(*)::text || ' grants'
  from public.role_permissions
  union all
  select 'categories (3)', count(*) = 3, string_agg(slug, ', ' order by position) from public.categories
  union all
  select 'scent families (5)', count(*) = 5, string_agg(slug, ', ' order by position) from public.scent_families
  union all
  select 'site photos registered (6)', count(*) = 6, count(*)::text from public.media_assets where bucket = 'static'
  union all
  select 'homepage slides (3)', count(*) = 3, string_agg(title_en, ' | ' order by position) from public.homepage_slides
  union all
  select 'homepage sections (7)', count(*) = 7, count(*)::text from public.homepage_sections
  union all
  select 'slider interval = 4 s', bool_and(slider_interval_seconds = 4 and slider_autoplay), max(slider_interval_seconds)::text
  from public.store_settings
  union all
  select 'no products seeded', count(*) = 0, count(*)::text from public.products
  union all
  select 'no staff yet (owner not assigned)', count(*) = 0, count(*)::text from public.staff_members
)
select check_name, ok, detail from checks;
