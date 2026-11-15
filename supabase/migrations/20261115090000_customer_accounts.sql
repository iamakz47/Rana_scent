-- Rana Scent: customer accounts.
--
-- Customers are ordinary Supabase Auth users with a profile row and no
-- staff_members row, so they never reach the admin (every admin check and
-- every staff RLS policy goes through private.has_permission()).
--
--   * Profiles and addresses: customers read and edit only their own rows
--     (existing RLS). Up to 10 addresses, one default.
--   * Guest orders are NEVER attached to an account because an email
--     matches. claim_guest_order() needs the order's secret token (from the
--     confirmation link) AND a verified account email equal to the order's.
--   * Account deletion is a request reviewed by staff; orders are kept for
--     accounting with the customer link removed.
--   * A small rate limiter backs the customer auth forms.
-- Additive and non-destructive.

-- ---------------------------------------------------------------------------
-- Addresses: at most 10 per customer; one default.
-- ---------------------------------------------------------------------------

create or replace function private.guard_customer_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.customer_addresses a where a.user_id = new.user_id) >= 10 then
      raise exception 'address_limit' using errcode = '23514';
    end if;
    -- The first address becomes the default.
    if not exists (select 1 from public.customer_addresses a where a.user_id = new.user_id) then
      new.is_default := true;
    end if;
  elsif new.user_id is distinct from old.user_id then
    raise exception 'Addresses cannot move between accounts' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_customer_address() from public;
drop trigger if exists customer_addresses_guard on public.customer_addresses;
create trigger customer_addresses_guard before insert or update on public.customer_addresses
  for each row execute function private.guard_customer_address();

-- Makes one address the default (clearing the previous one atomically).
create or replace function public.set_default_address(p_address uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customer_addresses a where a.id = p_address and a.user_id = v_user) then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;
  update public.customer_addresses set is_default = false where user_id = v_user and is_default and id <> p_address;
  update public.customer_addresses set is_default = true where id = p_address;
end;
$$;
revoke all on function public.set_default_address(uuid) from public, anon;
grant execute on function public.set_default_address(uuid) to authenticated;

-- Deleting the default promotes the most recent remaining address.
create or replace function private.after_address_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default then
    update public.customer_addresses set is_default = true
    where id = (select a.id from public.customer_addresses a where a.user_id = old.user_id
                order by a.updated_at desc limit 1);
  end if;
  return null;
end;
$$;
revoke all on function private.after_address_delete() from public;
drop trigger if exists customer_addresses_after_delete on public.customer_addresses;
create trigger customer_addresses_after_delete after delete on public.customer_addresses
  for each row execute function private.after_address_delete();

-- ---------------------------------------------------------------------------
-- Linking a guest order to the signed-in customer
-- ---------------------------------------------------------------------------

-- Requires: a signed-in user whose email is VERIFIED, the order's secret
-- access token (only in the customer's own confirmation link/email), an
-- order that has no account yet, and an order email equal to the verified
-- account email. Any mismatch returns false with no detail, so the function
-- can't be used to probe orders or emails.
create or replace function public.claim_guest_order(p_number bigint, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_order uuid;
begin
  if v_user is null or p_number is null or p_token is null then
    return false;
  end if;
  select lower(u.email) into v_email from auth.users u
  where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return false;
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user) then
    return false;
  end if;
  select o.id into v_order from public.orders o
  where o.number = p_number and o.access_token = p_token and o.user_id is null
    and o.email <> '' and lower(o.email) = v_email
  for update;
  if v_order is null then
    return false;
  end if;
  update public.orders set user_id = v_user where id = v_order;
  insert into public.order_notes (order_id, body, actor_id)
  values (v_order, 'Order linked to the customer''s account by the customer (verified email + order link).', v_user);
  return true;
end;
$$;
revoke all on function public.claim_guest_order(bigint, uuid) from public, anon;
grant execute on function public.claim_guest_order(bigint, uuid) to authenticated;

-- Customer order history (own orders only), newest first.
create or replace function public.my_orders()
returns table (number bigint, status public.order_status, total_fils integer, payment_method text,
  placed_at timestamptz, created_at timestamptz, access_token uuid, items_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.number, o.status, o.total_fils, o.payment_method, o.placed_at, o.created_at, o.access_token,
         (select coalesce(sum(i.quantity), 0) from public.order_items i where i.order_id = o.id)
  from public.orders o
  where o.user_id = (select auth.uid())
  order by o.created_at desc
  limit 200
$$;
revoke all on function public.my_orders() from public, anon;
grant execute on function public.my_orders() to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion requests
-- ---------------------------------------------------------------------------

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null default '',
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'requested' check (status in ('requested', 'completed', 'rejected', 'withdrawn')),
  resolution_note text not null default '' check (char_length(resolution_note) <= 500),
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists account_deletion_one_open on public.account_deletion_requests (user_id)
  where status = 'requested';
create index if not exists account_deletion_status_idx on public.account_deletion_requests (status, created_at desc);
create index if not exists account_deletion_resolved_by_idx on public.account_deletion_requests (resolved_by);

alter table public.account_deletion_requests enable row level security;
create policy "Customers read own deletion requests" on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('customers.read')));

create trigger account_deletion_requests_audit after insert or update on public.account_deletion_requests
  for each row execute function private.audit_row();

create or replace function public.request_account_deletion(p_reason text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_members s where s.user_id = v_user) then
    -- Staff accounts are removed by an owner/admin in Staff, not here.
    raise exception 'staff_account' using errcode = '22023';
  end if;
  select r.id into v_id from public.account_deletion_requests r
  where r.user_id = v_user and r.status = 'requested';
  if v_id is not null then
    return v_id;
  end if;
  insert into public.account_deletion_requests (user_id, email, reason)
  select v_user, coalesce(u.email, ''), left(btrim(coalesce(p_reason, '')), 500)
  from auth.users u where u.id = v_user
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.request_account_deletion(text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;

create or replace function public.withdraw_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_deletion_requests set status = 'withdrawn', resolved_at = now()
  where user_id = (select auth.uid()) and status = 'requested';
end;
$$;
revoke all on function public.withdraw_account_deletion() from public, anon;
grant execute on function public.withdraw_account_deletion() to authenticated;

-- Staff (customers.read + orders.write, i.e. support/manager/admin/owner)
-- complete or reject a request. Completing anonymises the customer's
-- profile and addresses and detaches their orders; the server then deletes
-- the auth user with the service role.
create or replace function public.resolve_account_deletion(p_request uuid, p_complete boolean, p_note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not (private.has_permission('customers.read') and private.has_permission('orders.write')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into r from public.account_deletion_requests d where d.id = p_request and d.status = 'requested' for update;
  if not found then
    raise exception 'Request not found or already resolved' using errcode = 'P0002';
  end if;
  if r.user_id is not null and exists (select 1 from public.staff_members s where s.user_id = r.user_id) then
    raise exception 'staff_account' using errcode = '22023';
  end if;
  update public.account_deletion_requests d
     set status = case when p_complete then 'completed' else 'rejected' end,
         resolution_note = left(btrim(coalesce(p_note, '')), 500),
         resolved_by = (select auth.uid()), resolved_at = now()
   where d.id = p_request;
  if p_complete and r.user_id is not null then
    delete from public.customer_addresses where user_id = r.user_id;
    update public.profiles set full_name = '', phone = null, marketing_opt_in = false where id = r.user_id;
    update public.orders set user_id = null where user_id = r.user_id;
    return r.user_id;
  end if;
  return null;
end;
$$;
revoke all on function public.resolve_account_deletion(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_account_deletion(uuid, boolean, text) to authenticated;

-- The order guard blocks clients from changing orders.user_id; the
-- definer functions above run as the owner, which the guard allows.

-- ---------------------------------------------------------------------------
-- Rate limiting (customer sign-in, sign-up, password reset, guest checkout)
-- ---------------------------------------------------------------------------

create table if not exists private.rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

-- Returns true when the call is allowed. Keys are hashed by the server
-- (never raw emails or IPs). Service role only.
create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_bucket is null or char_length(p_bucket) > 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit' using errcode = '22023';
  end if;
  insert into private.rate_limits as rl (bucket, window_start, hits) values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.hits + 1 end,
        window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning hits into v_hits;
  -- Opportunistic cleanup of stale buckets.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
