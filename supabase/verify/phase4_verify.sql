-- Rana Scent: Phase 4 post-migration checks. READ-ONLY (selects only).
-- Run in the Supabase SQL editor after applying the Phase 4 migrations.
-- Every row should show ok = true.
with checks(check_name, ok, detail) as (
  select 'Phase 4 migrations recorded (4)', count(*) = 4, string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations
  where version in ('20261115090000', '20261115090100', '20261115090200', '20261115090300')
  union all
  select 'new tables have RLS', bool_and(c.relrowsecurity) and count(*) = 3, string_agg(c.relname, ', ')
  from pg_class c where c.relnamespace = 'public'::regnamespace
    and c.relname in ('account_deletion_requests', 'email_messages', 'notification_settings')
  union all
  select 'notification settings row exists', count(*) = 1, coalesce(max(staff_locale), 'missing')
  from public.notification_settings
  union all
  select 'orders track refunded amounts', count(*) = 1, 'orders.refunded_fils'
  from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'refunded_fils'
  union all
  select 'refund statuses include processing and failed',
    pg_get_constraintdef(oid) like '%processing%' and pg_get_constraintdef(oid) like '%failed%', conname
  from pg_constraint where conname = 'refund_requests_status_check'
  union all
  select 'customer functions exist (7)', count(*) = 7, string_agg(proname, ', ' order by proname)
  from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('set_default_address', 'claim_guest_order', 'my_orders', 'request_account_deletion',
     'withdraw_account_deletion', 'resolve_account_deletion', 'consume_rate_limit')
  union all
  select 'refund and email functions exist (11)', count(*) = 11, string_agg(proname, ', ' order by proname)
  from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('approve_refund', 'record_refund_result', 'reopen_refund', 'payments_to_reconcile', 'abandon_unstarted_payment',
     'claim_email_batch', 'finish_email', 'log_account_email', 'retry_email', 'request_refund', 'resolve_refund')
  union all
  select 'server-only functions are closed to visitors and signed-in users',
    bool_and(not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')
      and has_function_privilege('service_role', p.oid, 'execute')),
    string_agg(p.proname, ', ' order by p.proname)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in
    ('record_refund_result', 'payments_to_reconcile', 'abandon_unstarted_payment', 'claim_email_batch',
     'finish_email', 'log_account_email', 'consume_rate_limit')
  union all
  select 'customer functions need a signed-in user',
    bool_and(not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute')),
    string_agg(p.proname, ', ' order by p.proname)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in
    ('set_default_address', 'claim_guest_order', 'my_orders', 'request_account_deletion', 'approve_refund')
  union all
  select 'visitors cannot read Phase 4 tables',
    not (has_table_privilege('anon', 'public.email_messages', 'select')
      or has_table_privilege('anon', 'public.notification_settings', 'select')
      or has_table_privilege('anon', 'public.account_deletion_requests', 'select')),
    'anon has no select'
  union all
  select 'signed-in users have the Phase 4 grants (RLS limits rows)',
    has_table_privilege('authenticated', 'public.customer_addresses', 'insert')
      and has_table_privilege('authenticated', 'public.email_messages', 'select')
      and has_table_privilege('authenticated', 'public.notification_settings', 'update')
      and not has_table_privilege('authenticated', 'public.email_messages', 'insert'),
    'addresses, email history, notification settings'
  union all
  select 'every SECURITY DEFINER function pins search_path',
    count(*) = 0, coalesce(string_agg(n.nspname || '.' || p.proname, ', '), 'none unpinned')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  union all
  select 'order emails are queued by triggers', count(*) = 4, string_agg(tgname, ', ' order by tgname)
  from pg_trigger where tgname in ('orders_email_events', 'refund_requests_email_events', 'payments_email_events',
    'inventory_email_events')
)
select check_name, ok, detail from checks;
