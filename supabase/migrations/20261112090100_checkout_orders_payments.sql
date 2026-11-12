-- Rana Scent: checkout, orders, delivery and payment processing.
--
-- Principles
--   * The browser never supplies a price. place_order() reads every price,
--     discount and delivery fee from the database inside one transaction.
--   * Stock is reserved when the order is placed (row locks, never below
--     zero) and released if the order is cancelled, expires unpaid or the
--     payment fails. No overselling, even under concurrent checkouts.
--   * A checkout submitted twice (same idempotency key) returns the same order.
--   * Only trusted server code (service role) records payment results, and
--     only after verifying them with Tap. A browser redirect never marks an
--     order paid. Duplicate provider events are ignored.
--   * Every status change follows an allowed-transition map and is recorded
--     in order_status_history; staff notes go to order_notes.
-- Additive and non-destructive: new columns, tables and functions, and
-- relaxed or widened check constraints. No data is removed.

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists access_token uuid not null default gen_random_uuid(),
  add column if not exists idempotency_key uuid,
  add column if not exists customer_name text not null default '' check (char_length(customer_name) <= 120),
  add column if not exists payment_method text not null default 'tap' check (payment_method in ('tap', 'cod')),
  add column if not exists delivery_instructions text not null default '' check (char_length(delivery_instructions) <= 300),
  add column if not exists expires_at timestamptz,
  add column if not exists stock_released boolean not null default false,
  add column if not exists courier text not null default '' check (char_length(courier) <= 80),
  add column if not exists tracking_number text not null default '' check (char_length(tracking_number) <= 80),
  add column if not exists estimated_delivery date;

create unique index if not exists orders_idempotency_key_idx on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_phone_idx on public.orders (phone, created_at desc);
create index if not exists orders_expiry_idx on public.orders (expires_at) where status = 'awaiting_payment';

-- Email is optional for guest checkout (phone is the primary contact).
alter table public.orders drop constraint if exists orders_email_check;
alter table public.orders add constraint orders_email_check
  check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('tap', 'cod', 'mock'));
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method is null or method ~ '^[a-z_]{2,30}$');
alter table public.payment_events drop constraint if exists payment_events_provider_check;
alter table public.payment_events add constraint payment_events_provider_check check (provider in ('tap', 'mock'));
alter table public.payments
  add column if not exists provider_reference text,
  add column if not exists raw_status text;
create unique index if not exists payments_one_open_per_order on public.payments (order_id)
  where status in ('initiated', 'authorized');

alter table public.inventory_movements
  add column if not exists order_id uuid references public.orders (id) on delete set null;
create index if not exists inventory_movements_order_idx on public.inventory_movements (order_id);

alter table public.shipping_zones
  add column if not exists areas text[] not null default '{}';

alter table public.store_settings
  add column if not exists cod_enabled boolean not null default false,
  add column if not exists online_payments_enabled boolean not null default true,
  add column if not exists order_expiry_minutes smallint not null default 30
    check (order_expiry_minutes between 10 and 240),
  add column if not exists delivery_note_ar text not null default '' check (char_length(delivery_note_ar) <= 300),
  add column if not exists delivery_note_en text not null default '' check (char_length(delivery_note_en) <= 300);

-- Internal staff notes on an order (never shown to customers).
create table if not exists public.order_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_notes_order_idx on public.order_notes (order_id, created_at);
create index if not exists order_notes_actor_idx on public.order_notes (actor_id);

-- Refunds are requested by staff and processed in Tap, then marked done.
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,
  amount_fils integer not null check (amount_fils > 0),
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'requested' check (status in ('requested', 'processed', 'rejected')),
  provider_refund_id text,
  requested_by uuid references auth.users (id) on delete set null,
  processed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists refund_requests_order_idx on public.refund_requests (order_id);
create index if not exists refund_requests_status_idx on public.refund_requests (status, created_at desc);
create index if not exists refund_requests_payment_idx on public.refund_requests (payment_id);
create index if not exists refund_requests_requested_by_idx on public.refund_requests (requested_by);
create index if not exists refund_requests_processed_by_idx on public.refund_requests (processed_by);

alter table public.order_notes enable row level security;
alter table public.refund_requests enable row level security;

create policy "Order staff read notes" on public.order_notes
  for select to authenticated using ((select private.has_permission('orders.read')));
create policy "Order staff add notes" on public.order_notes
  for insert to authenticated
  with check ((select private.has_permission('orders.write')) and actor_id = (select auth.uid()));

create policy "Staff read refund requests" on public.refund_requests
  for select to authenticated
  using ((select private.has_permission('finance.read')) or (select private.has_permission('orders.read')));

revoke all on public.order_notes, public.refund_requests from anon;
grant select, insert on public.order_notes to authenticated;
grant select on public.refund_requests to authenticated;
grant all on public.order_notes, public.refund_requests to service_role;

create trigger refund_requests_audit after insert or update on public.refund_requests
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Order status rules
-- ---------------------------------------------------------------------------

-- Allowed transitions. 'paid' and 'refunded' are reachable only from trusted
-- server code (definer functions / service role), never by a direct staff
-- update through the API.
create or replace function private.order_transition_allowed(from_status public.order_status, to_status public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case from_status
    when 'pending' then to_status in ('awaiting_payment', 'processing', 'cancelled')
    when 'awaiting_payment' then to_status in ('paid', 'cancelled')
    when 'paid' then to_status in ('processing', 'cancelled', 'refunded')
    when 'processing' then to_status in ('ready_for_delivery', 'cancelled', 'refunded')
    when 'ready_for_delivery' then to_status in ('out_for_delivery', 'processing', 'cancelled')
    when 'out_for_delivery' then to_status in ('delivered', 'ready_for_delivery')
    when 'shipped' then to_status in ('delivered')
    when 'delivered' then to_status in ('refunded')
    when 'cancelled' then to_status in ('refunded')
    else false
  end
$$;

-- Replaces the Phase 2 guard. SECURITY INVOKER on purpose: current_user is
-- the API role for direct client updates and the function owner inside
-- trusted definer functions, which is exactly the distinction we need.
create or replace function private.guard_order_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  from_client boolean := current_user in ('anon', 'authenticated');
begin
  if new.status is distinct from old.status then
    if not private.order_transition_allowed(old.status, new.status) then
      raise exception 'Order cannot move from % to %', old.status, new.status using errcode = '23514';
    end if;
    if from_client and new.status in ('paid', 'refunded') then
      raise exception 'Payment status changes come from verified payment events only' using errcode = '42501';
    end if;
  end if;
  if from_client and (
       (new.subtotal_fils, new.discount_fils, new.shipping_fils, new.total_fils, new.user_id, new.email,
        new.phone, new.customer_name, new.shipping_address, new.payment_method, new.access_token,
        new.idempotency_key, new.discount_code_id, new.stock_released, new.expires_at)
       is distinct from
       (old.subtotal_fils, old.discount_fils, old.shipping_fils, old.total_fils, old.user_id, old.email,
        old.phone, old.customer_name, old.shipping_address, old.payment_method, old.access_token,
        old.idempotency_key, old.discount_code_id, old.stock_released, old.expires_at)
     ) then
    raise exception 'Order amounts, customer and payment details cannot be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_order_update() from public;
grant execute on function private.guard_order_update() to anon, authenticated, service_role;

-- Returns reserved stock and the discount redemption exactly once.
create or replace function private.release_order(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  item record;
begin
  select * into o from public.orders where id = target for update;
  if not found or o.stock_released then
    return;
  end if;
  for item in
    select variant_id, sum(quantity)::integer as qty from public.order_items
    where order_id = target and variant_id is not null group by variant_id order by variant_id
  loop
    update public.inventory set on_hand = on_hand + item.qty where variant_id = item.variant_id;
    if found then
      insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, order_id)
      select item.variant_id, item.qty, i.on_hand, 'return', 'Released from order #' || o.number, target
      from public.inventory i where i.variant_id = item.variant_id;
    end if;
  end loop;
  if o.discount_code_id is not null then
    update public.discount_codes set redemptions_count = greatest(redemptions_count - 1, 0)
    where id = o.discount_code_id;
  end if;
  update public.orders set stock_released = true where id = target;
end;
$$;
revoke all on function private.release_order(uuid) from public;

-- Cancelled orders give their stock back, whoever cancels them. Delivered
-- cash-on-delivery orders record the cash payment.
create or replace function private.after_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform private.release_order(new.id);
  end if;
  if new.status = 'delivered' and new.payment_method = 'cod' and old.status <> 'delivered' then
    insert into public.payments (order_id, provider, method, status, amount_fils, currency, raw_status)
    values (new.id, 'cod', 'cash', 'captured', new.total_fils, 'KWD', 'COLLECTED');
  end if;
  return null;
end;
$$;
revoke all on function private.after_order_status_change() from public;
drop trigger if exists orders_after_status_change on public.orders;
create trigger orders_after_status_change after update of status on public.orders
  for each row execute function private.after_order_status_change();

-- Unpaid online orders release their stock after the expiry window. Called
-- opportunistically on every checkout and by the admin orders page.
create or replace function private.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired integer := 0;
  target uuid;
begin
  for target in
    select id from public.orders
    where status = 'awaiting_payment' and expires_at < now()
    order by expires_at
    limit 200
    for update skip locked
  loop
    update public.payments set status = 'cancelled', raw_status = 'EXPIRED'
    where order_id = target and status in ('initiated', 'authorized');
    update public.orders set status = 'cancelled' where id = target;
    expired := expired + 1;
  end loop;
  return expired;
end;
$$;
revoke all on function private.expire_unpaid_orders() from public;

create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.has_permission('orders.read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return private.expire_unpaid_orders();
end;
$$;
revoke all on function public.expire_unpaid_orders() from public, anon;
grant execute on function public.expire_unpaid_orders() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pricing (shared by the quote and the order)
-- ---------------------------------------------------------------------------

-- Validates the cart and returns priced lines. Raises with a stable message
-- prefix the app maps to a translated error.
create or replace function private.price_cart(items jsonb)
returns table (variant_id uuid, product_id uuid, sku text, name_ar text, name_en text,
  label_ar text, label_en text, unit_price_fils integer, quantity integer, on_hand integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'cart_empty' using errcode = '22023';
  end if;
  if jsonb_array_length(items) > 30 then
    raise exception 'cart_too_large' using errcode = '22023';
  end if;
  return query
  with requested as (
    select (e ->> 'variant_id')::uuid as vid, sum((e ->> 'quantity')::integer)::integer as qty
    from jsonb_array_elements(items) e
    group by 1
  )
  select v.id, p.id, v.sku, p.name_ar, p.name_en, v.label_ar, v.label_en, v.price_fils, r.qty, i.on_hand
  from requested r
  join public.product_variants v on v.id = r.vid and v.is_active
  join public.products p on p.id = v.product_id and p.status = 'published'
  join public.inventory i on i.variant_id = v.id
  order by v.id;
end;
$$;
revoke all on function private.price_cart(jsonb) from public;

create or replace function private.discount_for(p_code text, p_subtotal integer)
returns table (discount_id uuid, discount_fils integer, problem text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d record;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select null::uuid, 0, null::text;
    return;
  end if;
  select * into d from public.discount_codes dc where dc.code = upper(btrim(p_code));
  if not found or not d.is_active
     or (d.starts_at is not null and d.starts_at > now())
     or (d.ends_at is not null and d.ends_at <= now()) then
    return query select null::uuid, 0, 'discount_invalid'::text;
  elsif d.max_redemptions is not null and d.redemptions_count >= d.max_redemptions then
    return query select null::uuid, 0, 'discount_used_up'::text;
  elsif p_subtotal < d.min_subtotal_fils then
    return query select null::uuid, 0, 'discount_minimum'::text;
  elsif d.kind = 'percentage' then
    return query select d.id, (p_subtotal * d.value / 100)::integer, null::text;
  else
    return query select d.id, least(d.value, p_subtotal), null::text;
  end if;
end;
$$;
revoke all on function private.discount_for(text, integer) from public;

-- Cheapest active rate of an active zone serving the governorate (and the
-- area, when the zone lists areas). Free above the rate's threshold.
create or replace function private.delivery_for(p_governorate text, p_area text, p_amount integer)
returns table (rate_id uuid, shipping_fils integer, min_days smallint, max_days smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         case when r.free_over_fils is not null and p_amount >= r.free_over_fils then 0 else r.price_fils end,
         r.min_days, r.max_days
  from public.shipping_zones z
  join public.shipping_rates r on r.zone_id = z.id and r.is_active
  where z.is_active
    and p_governorate = any (z.governorates)
    and (cardinality(z.areas) = 0
         or lower(btrim(coalesce(p_area, ''))) = any (select lower(btrim(a)) from unnest(z.areas) a))
  order by 2, r.max_days, z.position
  limit 1
$$;
revoke all on function private.delivery_for(text, text, integer) from public;

-- Public, read-only quote for the checkout summary. Never reveals other
-- discount codes; reports only whether the given one applies.
create or replace function public.quote_order(p_items jsonb, p_governorate text default null, p_area text default '',
  p_discount_code text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lines jsonb;
  v_subtotal integer;
  v_short jsonb;
  v_requested integer;
  v_discount_id uuid;
  v_discount integer;
  v_problem text;
  v_rate uuid;
  v_shipping integer;
  v_min smallint;
  v_max smallint;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', c.variant_id, 'sku', c.sku, 'name', jsonb_build_object('ar', c.name_ar, 'en', c.name_en),
           'label', jsonb_build_object('ar', c.label_ar, 'en', c.label_en),
           'unit_price_fils', c.unit_price_fils, 'quantity', c.quantity,
           'line_total_fils', c.unit_price_fils * c.quantity, 'available', c.on_hand)), '[]'::jsonb),
         coalesce(sum(c.unit_price_fils * c.quantity), 0)::integer,
         coalesce(jsonb_agg(c.variant_id) filter (where c.quantity > c.on_hand), '[]'::jsonb)
    into v_lines, v_subtotal, v_short
  from private.price_cart(p_items) c;

  select count(distinct (e ->> 'variant_id')) into v_requested from jsonb_array_elements(p_items) e;
  select d.discount_id, d.discount_fils, d.problem into v_discount_id, v_discount, v_problem
  from private.discount_for(p_discount_code, v_subtotal) d;
  if p_governorate is not null then
    select x.rate_id, x.shipping_fils, x.min_days, x.max_days into v_rate, v_shipping, v_min, v_max
    from private.delivery_for(p_governorate, p_area, v_subtotal - v_discount) x;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'unavailable_count', v_requested - jsonb_array_length(v_lines),
    'short_stock', v_short,
    'subtotal_fils', v_subtotal,
    'discount_fils', v_discount,
    'discount_problem', v_problem,
    'delivery_available', v_rate is not null,
    'shipping_fils', coalesce(v_shipping, 0),
    'delivery_days', case when v_rate is null then null else jsonb_build_object('min', v_min, 'max', v_max) end,
    'total_fils', v_subtotal - v_discount + coalesce(v_shipping, 0)
  );
exception
  when invalid_text_representation then
    raise exception 'cart_invalid' using errcode = '22023';
end;
$$;
revoke all on function public.quote_order(jsonb, text, text, text) from public;
grant execute on function public.quote_order(jsonb, text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Place order
-- ---------------------------------------------------------------------------

create or replace function public.place_order(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_key uuid;
  v_existing record;
  v_method text := coalesce(p_payload ->> 'payment_method', 'tap');
  v_name text := btrim(coalesce(p_payload ->> 'customer_name', ''));
  v_phone text := regexp_replace(coalesce(p_payload ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_email text := lower(btrim(coalesce(p_payload ->> 'email', '')));
  v_addr jsonb := p_payload -> 'address';
  v_gov text := p_payload -> 'address' ->> 'governorate';
  v_items jsonb := p_payload -> 'items';
  v_line record;
  v_subtotal integer := 0;
  v_requested integer;
  v_priced integer := 0;
  v_discount_id uuid;
  v_discount integer;
  v_problem text;
  v_rate uuid;
  v_shipping integer;
  v_order record;
begin
  -- Idempotency: the same checkout submitted twice returns the same order.
  v_key := nullif(p_payload ->> 'idempotency_key', '')::uuid;
  if v_key is null then
    raise exception 'idempotency_missing' using errcode = '22023';
  end if;
  select o.id, o.number, o.access_token, o.total_fils, o.payment_method, o.status into v_existing
  from public.orders o where o.idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'number', v_existing.number,
      'access_token', v_existing.access_token, 'total_fils', v_existing.total_fils,
      'payment_method', v_existing.payment_method, 'status', v_existing.status, 'duplicate', true);
  end if;

  perform private.expire_unpaid_orders();
  select * into v_settings from public.store_settings where id = 1;

  -- Customer and address
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'name_invalid' using errcode = '22023';
  end if;
  v_phone := regexp_replace(v_phone, '^(\+?965)', '');
  if v_phone !~ '^[2569][0-9]{7}$' then
    raise exception 'phone_invalid' using errcode = '22023';
  end if;
  v_phone := '+965' || v_phone;
  if v_email <> '' and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254) then
    raise exception 'email_invalid' using errcode = '22023';
  end if;
  if v_addr is null or jsonb_typeof(v_addr) <> 'object'
     or coalesce(v_gov, '') not in ('capital', 'hawalli', 'farwaniya', 'ahmadi', 'jahra', 'mubarak_al_kabeer')
     or char_length(btrim(coalesce(v_addr ->> 'area', ''))) not between 1 and 80
     or char_length(btrim(coalesce(v_addr ->> 'block', ''))) not between 1 and 20
     or char_length(btrim(coalesce(v_addr ->> 'street', ''))) not between 1 and 80
     or char_length(btrim(coalesce(v_addr ->> 'building', ''))) not between 1 and 40
     or char_length(coalesce(v_addr ->> 'avenue', '')) > 40
     or char_length(coalesce(v_addr ->> 'floor', '')) > 10
     or char_length(coalesce(v_addr ->> 'apartment', '')) > 20 then
    raise exception 'address_invalid' using errcode = '22023';
  end if;
  if char_length(coalesce(p_payload ->> 'delivery_instructions', '')) > 300
     or char_length(coalesce(p_payload ->> 'customer_note', '')) > 500 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  if v_method not in ('tap', 'cod')
     or (v_method = 'tap' and not v_settings.online_payments_enabled)
     or (v_method = 'cod' and not v_settings.cod_enabled) then
    raise exception 'payment_method_unavailable' using errcode = '22023';
  end if;

  -- Basic abuse limit: at most 5 unpaid online orders per phone per hour.
  if (select count(*) from public.orders o
      where o.phone = v_phone and o.status = 'awaiting_payment'
        and o.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_orders' using errcode = '22023';
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'cart_empty' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_items) e
             where coalesce((e ->> 'quantity')::integer, 0) not between 1 and 20) then
    raise exception 'quantity_invalid' using errcode = '22023';
  end if;
  select count(distinct (e ->> 'variant_id')) into v_requested from jsonb_array_elements(v_items) e;

  -- Lock the stock rows of every requested variant in a fixed order, then
  -- price them. Concurrent checkouts for the same item wait for each other.
  perform 1 from public.inventory i
  where i.variant_id in (select (e ->> 'variant_id')::uuid from jsonb_array_elements(v_items) e)
  order by i.variant_id
  for update;

  drop table if exists pg_temp.checkout_lines;
  create temporary table checkout_lines on commit drop as
    select * from private.price_cart(v_items);
  select count(*), coalesce(sum(c.unit_price_fils * c.quantity), 0) into v_priced, v_subtotal
  from pg_temp.checkout_lines c;
  if v_priced <> v_requested then
    raise exception 'item_unavailable' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.checkout_lines c where c.quantity > c.on_hand) then
    raise exception 'out_of_stock' using errcode = '22023';
  end if;

  -- Discount (lock the code row so its redemption limit can't be overshot)
  if btrim(coalesce(p_payload ->> 'discount_code', '')) <> '' then
    perform 1 from public.discount_codes dc where dc.code = upper(btrim(p_payload ->> 'discount_code')) for update;
  end if;
  select d.discount_id, d.discount_fils, d.problem into v_discount_id, v_discount, v_problem
  from private.discount_for(p_payload ->> 'discount_code', v_subtotal) d;
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '22023';
  end if;

  select x.rate_id, x.shipping_fils into v_rate, v_shipping
  from private.delivery_for(v_gov, v_addr ->> 'area', v_subtotal - v_discount) x;
  if v_rate is null then
    raise exception 'delivery_unavailable' using errcode = '22023';
  end if;

  insert into public.orders (
    user_id, email, phone, customer_name, locale, status, subtotal_fils, discount_fils, shipping_fils, total_fils,
    discount_code_id, shipping_rate_id, shipping_address, customer_note, delivery_instructions, payment_method,
    idempotency_key, placed_at, expires_at
  ) values (
    (select pr.id from public.profiles pr where pr.id = (select auth.uid())),
    v_email, v_phone, v_name,
    case when p_payload ->> 'locale' = 'en' then 'en' else 'ar' end,
    (case when v_method = 'tap' then 'awaiting_payment' else 'pending' end)::public.order_status,
    v_subtotal, v_discount, v_shipping, v_subtotal - v_discount + v_shipping,
    v_discount_id, v_rate,
    jsonb_build_object(
      'governorate', v_gov,
      'area', btrim(v_addr ->> 'area'), 'block', btrim(v_addr ->> 'block'), 'street', btrim(v_addr ->> 'street'),
      'avenue', btrim(coalesce(v_addr ->> 'avenue', '')), 'building', btrim(v_addr ->> 'building'),
      'floor', btrim(coalesce(v_addr ->> 'floor', '')), 'apartment', btrim(coalesce(v_addr ->> 'apartment', ''))
    ),
    btrim(coalesce(p_payload ->> 'customer_note', '')), btrim(coalesce(p_payload ->> 'delivery_instructions', '')),
    v_method, v_key, now(),
    case when v_method = 'tap' then now() + make_interval(mins => v_settings.order_expiry_minutes) end
  )
  returning id, number, access_token, total_fils, status into v_order;

  for v_line in select * from pg_temp.checkout_lines loop
    insert into public.order_items (order_id, product_id, variant_id, sku, name_ar, name_en,
      variant_label_ar, variant_label_en, unit_price_fils, quantity, line_total_fils)
    values (v_order.id, v_line.product_id, v_line.variant_id, v_line.sku, v_line.name_ar, v_line.name_en,
      v_line.label_ar, v_line.label_en, v_line.unit_price_fils, v_line.quantity,
      v_line.unit_price_fils * v_line.quantity);

    update public.inventory i set on_hand = i.on_hand - v_line.quantity where i.variant_id = v_line.variant_id;
    insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, order_id)
    values (v_line.variant_id, -v_line.quantity, v_line.on_hand - v_line.quantity, 'sale',
            'Reserved for order #' || v_order.number, v_order.id);
  end loop;

  if v_discount_id is not null then
    update public.discount_codes dc set redemptions_count = dc.redemptions_count + 1 where dc.id = v_discount_id;
  end if;

  if v_method = 'tap' then
    insert into public.payments (order_id, provider, status, amount_fils, currency)
    values (v_order.id, 'tap', 'initiated', v_order.total_fils, 'KWD');
  end if;

  return jsonb_build_object('order_id', v_order.id, 'number', v_order.number,
    'access_token', v_order.access_token, 'total_fils', v_order.total_fils,
    'payment_method', v_method, 'status', v_order.status, 'duplicate', false);
exception
  when invalid_text_representation then
    raise exception 'cart_invalid' using errcode = '22023';
end;
$$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated, service_role;

-- Order confirmation for the customer: only with the order's secret token.
create or replace function public.get_order_for_customer(order_number bigint, token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'payment_method', o.payment_method,
    'customer_name', o.customer_name, 'phone', o.phone, 'email', o.email, 'locale', o.locale,
    'subtotal_fils', o.subtotal_fils, 'discount_fils', o.discount_fils, 'shipping_fils', o.shipping_fils,
    'total_fils', o.total_fils, 'shipping_address', o.shipping_address, 'placed_at', o.placed_at,
    'expires_at', o.expires_at, 'tracking_number', o.tracking_number, 'courier', o.courier,
    'estimated_delivery', o.estimated_delivery,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', jsonb_build_object('ar', i.name_ar, 'en', i.name_en),
                'label', jsonb_build_object('ar', i.variant_label_ar, 'en', i.variant_label_en),
                'quantity', i.quantity, 'unit_price_fils', i.unit_price_fils, 'line_total_fils', i.line_total_fils)
                order by i.name_en), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'payment_status', (select p.status from public.payments p where p.order_id = o.id
                       order by p.created_at desc limit 1)
  )
  from public.orders o
  where o.number = order_number and o.access_token = token
$$;
revoke all on function public.get_order_for_customer(bigint, uuid) from public;
grant execute on function public.get_order_for_customer(bigint, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Payments (trusted server only)
-- ---------------------------------------------------------------------------

-- Attaches the provider charge id when the server creates the hosted payment.
create or replace function public.attach_payment_charge(p_order uuid, p_provider text, p_charge_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments pm
     set provider = p_provider, provider_charge_id = p_charge_id
   where pm.order_id = p_order and pm.status = 'initiated'
     and (pm.provider_charge_id is null or pm.provider_charge_id = p_charge_id);
  if not found then
    raise exception 'No open payment for this order' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.attach_payment_charge(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_payment_charge(uuid, text, text) to service_role;

-- Records a VERIFIED provider result (the server has already checked the
-- webhook signature and re-fetched the charge from the provider). Idempotent:
-- a provider event is processed once; replays return 'duplicate'.
create or replace function public.record_payment_result(
  p_provider text,
  p_event_id text,
  p_charge_id text,
  p_status text,
  p_amount_fils integer,
  p_currency text,
  p_method text,
  p_reference text,
  p_signature_valid boolean,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row bigint;
  pay record;
  o record;
  mapped public.payment_status;
begin
  insert into public.payment_events (provider, provider_event_id, event_type, signature_valid, payload)
  values (p_provider, p_event_id, coalesce(p_status, 'unknown'), p_signature_valid, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_id) do nothing
  returning id into event_row;
  if event_row is null then
    return 'duplicate';
  end if;
  if not p_signature_valid then
    update public.payment_events set processed_at = now() where id = event_row;
    return 'rejected_signature';
  end if;

  select * into pay from public.payments pm where pm.provider_charge_id = p_charge_id and pm.provider = p_provider for update;
  if not found then
    update public.payment_events set processed_at = now() where id = event_row;
    return 'unknown_charge';
  end if;
  update public.payment_events set payment_id = pay.id where id = event_row;
  select * into o from public.orders where id = pay.order_id for update;

  mapped := case upper(coalesce(p_status, ''))
    when 'CAPTURED' then 'captured'
    when 'AUTHORIZED' then 'authorized'
    when 'INITIATED' then 'initiated'
    when 'IN_PROGRESS' then 'initiated'
    when 'CANCELLED' then 'cancelled'
    when 'ABANDONED' then 'cancelled'
    when 'VOID' then 'cancelled'
    when 'REFUNDED' then 'refunded'
    else 'failed'
  end;

  if mapped = 'captured' and (p_amount_fils is distinct from pay.amount_fils or upper(coalesce(p_currency, '')) <> 'KWD') then
    update public.payments set status = 'failed', raw_status = 'AMOUNT_MISMATCH' where id = pay.id;
    update public.payment_events set processed_at = now() where id = event_row;
    insert into public.order_notes (order_id, body)
    values (o.id, 'Payment amount mismatch on charge ' || p_charge_id || ': review before fulfilling.');
    return 'amount_mismatch';
  end if;

  -- Never move a settled payment backwards (e.g. a late "failed" event).
  if pay.status in ('captured', 'refunded') and mapped not in ('refunded') then
    update public.payment_events set processed_at = now() where id = event_row;
    return 'ignored_settled';
  end if;

  update public.payments pm
     set status = mapped, method = coalesce(nullif(lower(p_method), ''), pm.method),
         provider_reference = coalesce(p_reference, pm.provider_reference), raw_status = upper(p_status)
   where pm.id = pay.id;

  if mapped = 'captured' then
    if o.status = 'awaiting_payment' then
      update public.orders set status = 'paid', expires_at = null where id = o.id;
    elsif o.status = 'cancelled' then
      -- Paid after the order expired: stock was released. Flag for refund.
      insert into public.refund_requests (order_id, payment_id, amount_fils, reason)
      values (o.id, pay.id, pay.amount_fils, 'Payment captured after the order was cancelled or expired');
    end if;
  elsif mapped in ('failed', 'cancelled') and o.status = 'awaiting_payment' then
    update public.orders set status = 'cancelled' where id = o.id;
  end if;

  update public.payment_events set processed_at = now() where id = event_row;
  return mapped::text;
end;
$$;
revoke all on function public.record_payment_result(text, text, text, text, integer, text, text, text, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_payment_result(text, text, text, text, integer, text, text, text, boolean, jsonb)
  to service_role;

-- Staff: request a refund (orders.write or finance.write).
create or replace function public.request_refund(p_order uuid, p_amount integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  pay record;
  already integer;
  rid uuid;
begin
  if not (private.has_permission('orders.write') or private.has_permission('finance.write')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into o from public.orders od where od.id = p_order;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  select * into pay from public.payments pm where pm.order_id = o.id and pm.status = 'captured'
  order by pm.created_at desc limit 1;
  if not found then
    raise exception 'refund_no_payment' using errcode = '22023';
  end if;
  select coalesce(sum(rr.amount_fils), 0) into already from public.refund_requests rr
  where rr.order_id = o.id and rr.status in ('requested', 'processed');
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'refund_reason_missing' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount + already > pay.amount_fils then
    raise exception 'refund_amount_invalid' using errcode = '22023';
  end if;
  insert into public.refund_requests (order_id, payment_id, amount_fils, reason, requested_by)
  values (o.id, pay.id, p_amount, btrim(p_reason), (select auth.uid()))
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.request_refund(uuid, integer, text) from public, anon;
grant execute on function public.request_refund(uuid, integer, text) to authenticated;

-- Finance: mark a refund done (after refunding in the Tap dashboard), or reject it.
create or replace function public.resolve_refund(p_request uuid, p_approve boolean, p_provider_refund_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  refunded_total integer;
  paid integer;
begin
  if not private.has_permission('finance.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into r from public.refund_requests rr where rr.id = p_request and rr.status = 'requested' for update;
  if not found then
    raise exception 'Refund request not found or already resolved' using errcode = 'P0002';
  end if;
  update public.refund_requests rr
     set status = case when p_approve then 'processed' else 'rejected' end,
         provider_refund_id = nullif(btrim(coalesce(p_provider_refund_id, '')), ''),
         processed_by = (select auth.uid()), processed_at = now()
   where rr.id = p_request;
  if p_approve then
    select coalesce(sum(rr.amount_fils), 0) into refunded_total from public.refund_requests rr
    where rr.order_id = r.order_id and rr.status = 'processed';
    select pm.amount_fils into paid from public.payments pm where pm.id = r.payment_id;
    if refunded_total >= paid then
      update public.payments pm set status = 'refunded' where pm.id = r.payment_id;
      update public.orders od set status = 'refunded'
      where od.id = r.order_id and private.order_transition_allowed(od.status, 'refunded');
    end if;
  end if;
end;
$$;
revoke all on function public.resolve_refund(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_refund(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Customers (admin view over orders; guests have no account)
-- ---------------------------------------------------------------------------

create or replace function public.list_customers(p_search text default '')
returns table (phone text, customer_name text, email text, orders_count bigint, paid_total_fils bigint,
  last_order_at timestamptz, has_account boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('customers.read') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select o.phone,
           (array_agg(o.customer_name order by o.created_at desc))[1],
           (array_agg(o.email order by o.created_at desc) filter (where o.email <> ''))[1],
           count(*),
           coalesce(sum(o.total_fils) filter (where o.status in ('paid', 'processing', 'ready_for_delivery',
             'out_for_delivery', 'delivered', 'shipped')), 0)::bigint,
           max(o.created_at),
           bool_or(o.user_id is not null)
    from public.orders o
    where coalesce(p_search, '') = '' or o.phone ilike '%' || p_search || '%'
       or o.customer_name ilike '%' || p_search || '%' or o.email ilike '%' || p_search || '%'
    group by o.phone
    order by max(o.created_at) desc
    limit 500;
end;
$$;
revoke all on function public.list_customers(text) from public, anon;
grant execute on function public.list_customers(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants (production does not grant table privileges automatically)
-- ---------------------------------------------------------------------------
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.order_status_history, public.payments to authenticated;

-- A provisional, INACTIVE delivery zone so the owner only has to set the fee
-- and switch it on. Checkout reports "delivery unavailable" until then.
insert into public.shipping_zones (name_ar, name_en, governorates, is_active, position)
select 'جميع مناطق الكويت', 'All of Kuwait',
       array['capital', 'hawalli', 'farwaniya', 'ahmadi', 'jahra', 'mubarak_al_kabeer'], false, 0
where not exists (select 1 from public.shipping_zones);
insert into public.shipping_rates (zone_id, name_ar, name_en, price_fils, min_days, max_days, is_active)
select z.id, 'توصيل عادي', 'Standard delivery', 2000, 1, 3, false
from public.shipping_zones z
where z.name_en = 'All of Kuwait' and not exists (select 1 from public.shipping_rates);
