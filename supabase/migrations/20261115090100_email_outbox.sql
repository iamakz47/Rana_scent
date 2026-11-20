-- Rana Scent: transactional email outbox.
--
-- Order events enqueue emails here inside the same transaction that changes
-- the order, so an email can never be "lost" by a crash and never blocks or
-- fails an order. A server dispatcher (service role) renders and sends them.
--   * Idempotent: one row per dedupe_key (e.g. "order:<id>:delivered").
--   * Retries with exponential back-off, then stops (status 'failed').
--   * Every attempt is recorded: the table is the email audit history.
--   * Message bodies are rendered at send time from the order; no payment
--     card data is ever stored or sent.
-- Additive and non-destructive.

-- Staff notification preferences. NOT in store_settings, which is public.
create table if not exists public.notification_settings (
  id smallint primary key default 1 check (id = 1),
  staff_email text not null default '' check (staff_email = '' or staff_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  staff_locale text not null default 'ar' check (staff_locale in ('ar', 'en')),
  customer_emails_enabled boolean not null default true,
  low_stock_alerts boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.notification_settings (id) values (1) on conflict (id) do nothing;
create index if not exists notification_settings_updated_by_idx on public.notification_settings (updated_by);
create trigger notification_settings_updated_at before update on public.notification_settings
  for each row execute function private.set_updated_at();
create trigger notification_settings_audit after update on public.notification_settings
  for each row execute function private.audit_row();

alter table public.notification_settings enable row level security;
create policy "Settings editors read notification settings" on public.notification_settings
  for select to authenticated using ((select private.has_permission('settings.write')));
create policy "Settings editors update notification settings" on public.notification_settings
  for update to authenticated
  using ((select private.has_permission('settings.write')))
  with check ((select private.has_permission('settings.write')) and updated_by = (select auth.uid()));

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique check (char_length(dedupe_key) <= 200),
  kind text not null check (kind ~ '^[a-z_]{3,40}$'),
  audience text not null check (audience in ('customer', 'staff')),
  to_email text not null default '',
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  order_id uuid references public.orders (id) on delete set null,
  refund_id uuid references public.refund_requests (id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  max_attempts smallint not null default 6,
  next_attempt_at timestamptz not null default now(),
  last_error text not null default '' check (char_length(last_error) <= 500),
  provider text not null default '',
  provider_message_id text not null default '',
  subject text not null default '' check (char_length(subject) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_messages_due_idx on public.email_messages (next_attempt_at)
  where status in ('queued', 'failed', 'sending');
create index if not exists email_messages_order_idx on public.email_messages (order_id, created_at);
create index if not exists email_messages_refund_idx on public.email_messages (refund_id);
create index if not exists email_messages_created_idx on public.email_messages (created_at desc);
create trigger email_messages_updated_at before update on public.email_messages
  for each row execute function private.set_updated_at();

alter table public.email_messages enable row level security;
create policy "Order staff read email history" on public.email_messages
  for select to authenticated using ((select private.has_permission('orders.read')));

-- ---------------------------------------------------------------------------
-- Enqueueing
-- ---------------------------------------------------------------------------

create or replace function private.enqueue_email(
  p_kind text, p_audience text, p_dedupe text, p_order uuid default null,
  p_refund uuid default null, p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  o record;
  v_to text := '';
  v_locale text := 'ar';
  v_status text := 'queued';
begin
  select * into s from public.notification_settings where id = 1;
  if p_audience = 'staff' then
    v_to := coalesce(s.staff_email, '');
    v_locale := coalesce(s.staff_locale, 'ar');
  else
    select od.email, od.locale, od.user_id into o from public.orders od where od.id = p_order;
    v_locale := coalesce(o.locale, 'ar');
    v_to := coalesce(nullif(o.email, ''),
      (select u.email from auth.users u where u.id = o.user_id and u.email_confirmed_at is not null), '');
    if s.customer_emails_enabled is false then
      v_status := 'skipped';
    end if;
  end if;
  if v_to = '' then
    v_status := 'skipped';
  end if;
  insert into public.email_messages (dedupe_key, kind, audience, to_email, locale, order_id, refund_id, payload,
    status, last_error)
  values (p_dedupe, p_kind, p_audience, lower(v_to), v_locale, p_order, p_refund, coalesce(p_payload, '{}'::jsonb),
    v_status, case when v_status = 'skipped' then
      case when v_to = '' then 'No recipient' else 'Customer emails are turned off' end else '' end)
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke all on function private.enqueue_email(text, text, text, uuid, uuid, jsonb) from public;

-- Order placed / status changed.
create or replace function private.order_email_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_payment text;
begin
  if tg_op = 'INSERT' then
    if new.payment_method = 'cod' then
      perform private.enqueue_email('order_confirmation', 'customer', 'order:' || new.id || ':confirmation', new.id);
      perform private.enqueue_email('staff_new_cod_order', 'staff', 'staff:' || new.id || ':new_cod', new.id);
    end if;
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'paid' then
    perform private.enqueue_email('payment_succeeded', 'customer', 'order:' || new.id || ':paid', new.id);
    perform private.enqueue_email('staff_new_paid_order', 'staff', 'staff:' || new.id || ':new_paid', new.id);
  elsif new.status in ('processing', 'ready_for_delivery', 'out_for_delivery', 'delivered') then
    perform private.enqueue_email('order_' || new.status::text, 'customer',
      'order:' || new.id || ':' || new.status::text, new.id);
  elsif new.status = 'cancelled' then
    if old.status = 'awaiting_payment' then
      select p.raw_status into v_last_payment from public.payments p where p.order_id = new.id
      order by p.created_at desc limit 1;
      perform private.enqueue_email('payment_failed', 'customer', 'order:' || new.id || ':payment_failed', new.id,
        null, jsonb_build_object('expired', coalesce(v_last_payment, '') = 'EXPIRED'));
    else
      perform private.enqueue_email('order_cancelled', 'customer', 'order:' || new.id || ':cancelled', new.id);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.order_email_events() from public;
drop trigger if exists orders_email_events on public.orders;
create trigger orders_email_events after insert or update of status on public.orders
  for each row execute function private.order_email_events();

-- Refund lifecycle.
create or replace function private.refund_email_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.enqueue_email('staff_refund_requested', 'staff', 'staff:refund:' || new.id || ':requested',
      new.order_id, new.id);
    return null;
  end if;
  if new.status is not distinct from old.status then
    return null;
  end if;
  if new.status = 'processing' then
    perform private.enqueue_email('refund_initiated', 'customer', 'refund:' || new.id || ':initiated', new.order_id, new.id);
  elsif new.status = 'processed' then
    perform private.enqueue_email('refund_completed', 'customer', 'refund:' || new.id || ':completed', new.order_id, new.id);
  elsif new.status = 'failed' then
    perform private.enqueue_email('staff_payment_attention', 'staff', 'staff:refund:' || new.id || ':failed',
      new.order_id, new.id, jsonb_build_object('reason', 'refund_failed'));
  end if;
  return null;
end;
$$;
revoke all on function private.refund_email_events() from public;
drop trigger if exists refund_requests_email_events on public.refund_requests;
create trigger refund_requests_email_events after insert or update of status on public.refund_requests
  for each row execute function private.refund_email_events();

-- Payments that need a human (amount mismatch).
create or replace function private.payment_email_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_status = 'AMOUNT_MISMATCH' and old.raw_status is distinct from 'AMOUNT_MISMATCH' then
    perform private.enqueue_email('staff_payment_attention', 'staff', 'staff:payment:' || new.id || ':mismatch',
      new.order_id, null, jsonb_build_object('reason', 'amount_mismatch'));
  end if;
  return null;
end;
$$;
revoke all on function private.payment_email_events() from public;
drop trigger if exists payments_email_events on public.payments;
create trigger payments_email_events after update of raw_status on public.payments
  for each row execute function private.payment_email_events();

-- Stock crossing the low-stock threshold (at most one alert per variant per day).
create or replace function private.inventory_email_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.track_inventory and new.on_hand <= new.low_stock_threshold and old.on_hand > new.low_stock_threshold
     and coalesce((select n.low_stock_alerts from public.notification_settings n where n.id = 1), true) then
    perform private.enqueue_email('staff_low_stock', 'staff',
      'staff:stock:' || new.variant_id || ':' || to_char(now() at time zone 'Asia/Kuwait', 'YYYY-MM-DD'),
      null, null, jsonb_build_object('variant_id', new.variant_id, 'on_hand', new.on_hand,
        'threshold', new.low_stock_threshold));
  end if;
  return null;
end;
$$;
revoke all on function private.inventory_email_events() from public;
drop trigger if exists inventory_email_events on public.inventory;
create trigger inventory_email_events after update of on_hand on public.inventory
  for each row execute function private.inventory_email_events();

-- ---------------------------------------------------------------------------
-- Dispatcher API (service role only)
-- ---------------------------------------------------------------------------

-- Claims due messages. A message stuck in 'sending' for 10 minutes (crashed
-- worker) becomes due again; the provider idempotency key (the message id)
-- stops a duplicate send.
create or replace function public.claim_email_batch(p_limit integer default 20)
returns setof public.email_messages
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.email_messages m
     set status = 'sending', attempts = m.attempts + 1, next_attempt_at = now() + interval '10 minutes'
   where m.id in (
     select e.id from public.email_messages e
     where e.status in ('queued', 'failed', 'sending') and e.next_attempt_at <= now()
       and e.attempts < e.max_attempts
     order by e.next_attempt_at
     limit greatest(1, least(coalesce(p_limit, 20), 100))
     for update skip locked
   )
  returning m.*;
end;
$$;
revoke all on function public.claim_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer) to service_role;

create or replace function public.finish_email(
  p_id uuid, p_ok boolean, p_provider text, p_provider_message_id text, p_subject text, p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_messages m
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else m.sent_at end,
         provider = left(coalesce(p_provider, ''), 40),
         provider_message_id = left(coalesce(p_provider_message_id, ''), 200),
         subject = left(coalesce(p_subject, m.subject), 300),
         last_error = case when p_ok then '' else left(coalesce(p_error, 'Unknown error'), 500) end,
         -- 1, 2, 4, 8, 16 minutes… between attempts.
         next_attempt_at = case when p_ok then m.next_attempt_at
                                else now() + make_interval(mins => power(2, greatest(m.attempts - 1, 0))::integer) end
   where m.id = p_id and m.status = 'sending';
end;
$$;
revoke all on function public.finish_email(uuid, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_email(uuid, boolean, text, text, text, text) to service_role;

-- Account emails (verification, password reset) are sent directly by the
-- server; this records them in the same history without the secret link.
create or replace function public.log_account_email(
  p_kind text, p_to text, p_locale text, p_ok boolean, p_provider text, p_provider_message_id text, p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_messages (dedupe_key, kind, audience, to_email, locale, status, attempts, provider,
    provider_message_id, last_error, sent_at)
  values ('account:' || gen_random_uuid(), p_kind, 'customer', lower(coalesce(p_to, '')),
    case when p_locale = 'en' then 'en' else 'ar' end,
    case when p_ok then 'sent' else 'failed' end, 1, left(coalesce(p_provider, ''), 40),
    left(coalesce(p_provider_message_id, ''), 200), left(coalesce(p_error, ''), 500),
    case when p_ok then now() end);
end;
$$;
revoke all on function public.log_account_email(text, text, text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.log_account_email(text, text, text, boolean, text, text, text) to service_role;

-- Staff: put a failed email back in the queue.
create or replace function public.retry_email(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('orders.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.email_messages m
     set status = 'queued', attempts = 0, next_attempt_at = now(), last_error = ''
   where m.id = p_id and m.status = 'failed' and m.to_email <> '';
end;
$$;
revoke all on function public.retry_email(uuid) from public, anon;
grant execute on function public.retry_email(uuid) to authenticated;
