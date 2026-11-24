-- Rana Scent: contact messages and content pages, post-migration checks.
-- READ-ONLY. Every row should show ok = true.
with checks(check_name, ok, detail) as (
  select 'contact/pages migrations recorded (2)', count(*) = 2, string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations where version in ('20261124090000', '20261124090100')
  union all
  select 'tables exist with RLS', count(*) = 2 and bool_and(c.relrowsecurity), string_agg(c.relname, ', ')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('contact_messages', 'site_pages')
  union all
  select 'visitors cannot read either table', not has_table_privilege('anon', 'public.contact_messages', 'select')
    and not has_table_privilege('anon', 'public.site_pages', 'select'), ''
  union all
  select 'visitors can send messages and read published pages',
    has_function_privilege('anon', 'public.submit_contact_message(text, text, text, text, text, text)', 'execute')
    and has_function_privilege('anon', 'public.get_site_page(text)', 'execute'), ''
  union all
  select 'visitors cannot edit pages or messages',
    not has_function_privilege('anon', 'public.save_site_page_draft(text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.publish_site_page(text)', 'execute')
    and not has_function_privilege('anon', 'public.set_contact_message_status(uuid, text)', 'execute'), ''
  union all
  select 'the three pages exist', count(*) = 3, string_agg(key, ', ' order by key)
  from public.site_pages where key in ('about', 'contact', 'faq')
  union all
  select 'elevated functions pin search_path', bool_and(p.proconfig::text like '%search_path=%'), string_agg(p.proname, ', ')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('submit_contact_message', 'set_contact_message_status', 'get_site_page',
    'save_site_page_draft', 'publish_site_page', 'unpublish_site_page')
)
select check_name, ok, detail from checks;
