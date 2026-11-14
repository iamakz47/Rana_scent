-- Rana Scent: Phase 3 post-migration checks. READ-ONLY (selects only).
-- Run in the Supabase SQL editor after applying the Phase 3 migrations.
-- Every row should show ok = true.
with checks(check_name, ok, detail) as (
  select 'Phase 3 migrations recorded (4)', count(*) = 4, string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations
  where version in ('20261112090000', '20261112090100', '20261112090200', '20261112090300')
  union all
  select 'order statuses include delivery stages',
    enum_range(null::public.order_status)::text[] @> array['ready_for_delivery', 'out_for_delivery'],
    array_to_string(enum_range(null::public.order_status)::text[], ', ')
  union all
  select 'new tables have RLS', bool_and(c.relrowsecurity), string_agg(c.relname, ', ')
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('order_notes', 'refund_requests')
  union all
  select 'checkout functions exist (8)', count(*) = 8, string_agg(proname, ', ' order by proname)
  from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('place_order', 'quote_order', 'get_order_for_customer', 'attach_payment_charge', 'record_payment_result',
     'request_refund', 'resolve_refund', 'list_customers')
  union all
  select 'visitors can check out',
    has_function_privilege('anon', 'public.place_order(jsonb)', 'execute')
      and has_function_privilege('anon', 'public.quote_order(jsonb,text,text,text)', 'execute')
      and has_function_privilege('anon', 'public.get_order_for_customer(bigint,uuid)', 'execute'),
    'place_order, quote_order, get_order_for_customer'
  union all
  select 'only the server records payments',
    not (has_function_privilege('anon', 'public.record_payment_result(text,text,text,text,integer,text,text,text,boolean,jsonb)', 'execute')
      or has_function_privilege('authenticated', 'public.record_payment_result(text,text,text,text,integer,text,text,text,boolean,jsonb)', 'execute')
      or has_function_privilege('anon', 'public.attach_payment_charge(uuid,text,text)', 'execute')
      or has_function_privilege('authenticated', 'public.attach_payment_charge(uuid,text,text)', 'execute'))
      and has_function_privilege('service_role', 'public.record_payment_result(text,text,text,text,integer,text,text,text,boolean,jsonb)', 'execute'),
    'service_role only'
  union all
  select 'visitors cannot read orders, notes or refunds',
    not (has_table_privilege('anon', 'public.orders', 'select') or has_table_privilege('anon', 'public.order_notes', 'select')
      or has_table_privilege('anon', 'public.refund_requests', 'select') or has_table_privilege('anon', 'public.payments', 'select')),
    'anon has no select'
  union all
  select 'staff can use order screens',
    has_table_privilege('authenticated', 'public.orders', 'update')
      and has_table_privilege('authenticated', 'public.order_notes', 'insert')
      and not has_table_privilege('authenticated', 'public.order_items', 'insert')
      and not has_table_privilege('authenticated', 'public.payments', 'update'),
    'orders update, notes insert; items/payments read-only'
  union all
  select 'checkout settings present', count(*) = 1, max(format('cod=%s online=%s hold=%s min', cod_enabled, online_payments_enabled, order_expiry_minutes))
  from public.store_settings where order_expiry_minutes between 10 and 240
  union all
  select 'delivery zone exists', count(*) >= 1, count(*) filter (where is_active)::text || ' active'
  from public.shipping_zones
)
select check_name, ok, detail from checks;
