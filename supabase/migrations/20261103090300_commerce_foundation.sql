-- Rana Scent: commerce foundation (no live checkout or payments yet).
-- Customers, addresses, orders, payments, marketing, delivery and expenses.
-- Clients can read what they are allowed to; orders and payments are only
-- written by trusted server code (service role) in a later phase, never
-- by the browser. A payment is never "paid" because of a redirect: only a
-- verified provider event recorded in payment_events can mark it captured.

create type public.order_status as enum (
  'pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);
create type public.payment_status as enum (
  'initiated', 'authorized', 'captured', 'failed', 'cancelled', 'refunded'
);

-- ---------------------------------------------------------------------------
-- Customer addresses (Kuwait format)
-- ---------------------------------------------------------------------------

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 40),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text not null check (phone ~ '^\+?[0-9 ]{7,20}$'),
  governorate text not null check (governorate in (
    'capital', 'hawalli', 'farwaniya', 'ahmadi', 'jahra', 'mubarak_al_kabeer'
  )),
  area text not null check (char_length(area) between 1 and 80),
  block text not null check (char_length(block) between 1 and 20),
  street text not null check (char_length(street) between 1 and 80),
  avenue text not null default '' check (char_length(avenue) <= 40),
  building text not null check (char_length(building) between 1 and 40),
  floor text not null default '' check (char_length(floor) <= 10),
  apartment text not null default '' check (char_length(apartment) <= 20),
  notes text not null default '' check (char_length(notes) <= 300),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_user_idx on public.customer_addresses (user_id);
create unique index customer_addresses_one_default on public.customer_addresses (user_id) where is_default;
create trigger customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null check (char_length(name_ar) between 1 and 80),
  name_en text not null check (char_length(name_en) between 1 and 80),
  governorates text[] not null default '{}' check (governorates <@ array[
    'capital', 'hawalli', 'farwaniya', 'ahmadi', 'jahra', 'mubarak_al_kabeer'
  ]::text[]),
  is_active boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_zones_updated_at before update on public.shipping_zones
  for each row execute function private.set_updated_at();

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  name_ar text not null check (char_length(name_ar) between 1 and 80),
  name_en text not null check (char_length(name_en) between 1 and 80),
  price_fils integer not null check (price_fils between 0 and 1000000),
  free_over_fils integer check (free_over_fils is null or free_over_fils > 0),
  min_days smallint not null default 1 check (min_days >= 0),
  max_days smallint not null default 3 check (max_days >= min_days),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipping_rates_zone_idx on public.shipping_rates (zone_id);
create trigger shipping_rates_updated_at before update on public.shipping_rates
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Marketing
-- ---------------------------------------------------------------------------

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,24}$'),
  kind text not null check (kind in ('percentage', 'fixed')),
  -- Percentage: 1–100. Fixed: amount in fils.
  value integer not null check (value > 0),
  min_subtotal_fils integer not null default 0 check (min_subtotal_fils >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percentage' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger discount_codes_updated_at before update on public.discount_codes
  for each row execute function private.set_updated_at();

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (char_length(title_ar) between 1 and 90),
  title_en text not null check (char_length(title_en) between 1 and 90),
  body_ar text not null default '' check (char_length(body_ar) <= 300),
  body_en text not null default '' check (char_length(body_en) <= 300),
  href text check (href is null or href ~ '^/(?!/)[A-Za-z0-9\-._~/?=&#%]*$'),
  media_id uuid references public.media_assets (id) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index promotions_media_idx on public.promotions (media_id);
create trigger promotions_updated_at before update on public.promotions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  user_id uuid references public.profiles (id) on delete set null,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check (phone ~ '^\+?[0-9 ]{7,20}$'),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status public.order_status not null default 'pending',
  currency text not null default 'KWD' check (currency = 'KWD'),
  subtotal_fils integer not null check (subtotal_fils >= 0),
  discount_fils integer not null default 0 check (discount_fils >= 0),
  shipping_fils integer not null default 0 check (shipping_fils >= 0),
  total_fils integer not null check (total_fils >= 0),
  discount_code_id uuid references public.discount_codes (id) on delete set null,
  shipping_rate_id uuid references public.shipping_rates (id) on delete set null,
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  customer_note text not null default '' check (char_length(customer_note) <= 500),
  placed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_fils <= subtotal_fils),
  check (total_fils = subtotal_fils - discount_fils + shipping_fils)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_discount_code_idx on public.orders (discount_code_id);
create index orders_shipping_rate_idx on public.orders (shipping_rate_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- Snapshot at purchase time.
  sku text not null,
  name_ar text not null,
  name_en text not null,
  variant_label_ar text not null default '',
  variant_label_en text not null default '',
  unit_price_fils integer not null check (unit_price_fils >= 0),
  quantity integer not null check (quantity between 1 and 999),
  line_total_fils integer not null check (line_total_fils >= 0),
  check (line_total_fils = unit_price_fils * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text not null default '' check (char_length(note) <= 500),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);
create index order_status_history_actor_idx on public.order_status_history (actor_id);

create or replace function private.record_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, actor_id)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, (select auth.uid()));
  end if;
  return null;
end;
$$;
revoke all on function private.record_order_status() from public;
create trigger orders_status_history after insert or update of status on public.orders
  for each row execute function private.record_order_status();

-- Staff may move orders through fulfilment, but never to "paid" or
-- "refunded": those follow verified payment events only.
create or replace function private.guard_order_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.status in ('paid', 'refunded') and new.status is distinct from old.status then
    raise exception 'Payment status changes come from verified payment events only' using errcode = '42501';
  end if;
  if (new.subtotal_fils, new.discount_fils, new.shipping_fils, new.total_fils, new.user_id, new.email)
     is distinct from (old.subtotal_fils, old.discount_fils, old.shipping_fils, old.total_fils, old.user_id, old.email) then
    raise exception 'Order amounts and customer cannot be edited' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_order_update() from public;
create trigger orders_guard before update on public.orders
  for each row execute function private.guard_order_update();

-- ---------------------------------------------------------------------------
-- Payments (Tap: KNET, cards, Apple Pay). Foundation only.
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'tap' check (provider in ('tap')),
  provider_charge_id text unique,
  method text check (method is null or method in ('knet', 'card', 'apple_pay')),
  status public.payment_status not null default 'initiated',
  amount_fils integer not null check (amount_fils > 0),
  currency text not null default 'KWD' check (currency = 'KWD'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

-- Raw provider webhooks, stored for idempotency and audit.
create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments (id) on delete set null,
  provider text not null default 'tap' check (provider in ('tap')),
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
create index payment_events_payment_idx on public.payment_events (payment_id);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'inventory', 'shipping', 'marketing', 'packaging', 'software', 'fees', 'salaries', 'rent', 'other'
  )),
  description text not null check (char_length(description) between 1 and 300),
  vendor text not null default '' check (char_length(vendor) <= 120),
  amount_fils integer not null check (amount_fils between 1 and 1000000000),
  incurred_on date not null,
  receipt_media_id uuid references public.media_assets (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_incurred_idx on public.expenses (incurred_on desc);
create index expenses_receipt_idx on public.expenses (receipt_media_id);
create index expenses_created_by_idx on public.expenses (created_by);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.customer_addresses enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.discount_codes enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.expenses enable row level security;

create policy "Customers manage own addresses" on public.customer_addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Staff read addresses" on public.customer_addresses
  for select to authenticated using ((select private.has_permission('customers.read')));

create policy "Public reads active shipping zones" on public.shipping_zones
  for select to anon, authenticated
  using (is_active or (select private.has_permission('settings.write')));
create policy "Settings editors manage shipping zones" on public.shipping_zones
  for all to authenticated
  using ((select private.has_permission('settings.write')))
  with check ((select private.has_permission('settings.write')));

create policy "Public reads active shipping rates" on public.shipping_rates
  for select to anon, authenticated
  using (is_active or (select private.has_permission('settings.write')));
create policy "Settings editors manage shipping rates" on public.shipping_rates
  for all to authenticated
  using ((select private.has_permission('settings.write')))
  with check ((select private.has_permission('settings.write')));

-- Discount codes are validated on the server; never listed publicly.
create policy "Marketing reads discount codes" on public.discount_codes
  for select to authenticated using ((select private.has_permission('marketing.write')));
create policy "Marketing manages discount codes" on public.discount_codes
  for all to authenticated
  using ((select private.has_permission('marketing.write')))
  with check ((select private.has_permission('marketing.write')));

create policy "Public reads live promotions" on public.promotions
  for select to anon, authenticated
  using (
    (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select private.has_permission('marketing.write'))
  );
create policy "Marketing manages promotions" on public.promotions
  for all to authenticated
  using ((select private.has_permission('marketing.write')))
  with check ((select private.has_permission('marketing.write')));

create policy "Customers read own orders" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('orders.read')));
create policy "Order staff update orders" on public.orders
  for update to authenticated
  using ((select private.has_permission('orders.write')))
  with check ((select private.has_permission('orders.write')));

create policy "Customers read own order items" on public.order_items
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.has_permission('orders.read'))
  );
create policy "Customers read own order history" on public.order_status_history
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.has_permission('orders.read'))
  );

create policy "Finance reads payments" on public.payments
  for select to authenticated
  using ((select private.has_permission('finance.read')) or (select private.has_permission('orders.read')));
create policy "Finance reads payment events" on public.payment_events
  for select to authenticated using ((select private.has_permission('finance.read')));

create policy "Finance reads expenses" on public.expenses
  for select to authenticated using ((select private.has_permission('finance.read')));
create policy "Finance manages expenses" on public.expenses
  for all to authenticated
  using ((select private.has_permission('finance.write')))
  with check ((select private.has_permission('finance.write')));

-- Orders, items, history and payments are created by trusted server code.
revoke all on public.orders, public.order_items, public.order_status_history,
  public.payments, public.payment_events, public.expenses, public.discount_codes,
  public.customer_addresses from anon;
revoke insert, delete, truncate on public.orders from authenticated;
revoke insert, update, delete, truncate on public.order_items, public.order_status_history,
  public.payments, public.payment_events from authenticated;

create trigger orders_audit after update on public.orders
  for each row execute function private.audit_row();
create trigger payments_audit after insert or update on public.payments
  for each row execute function private.audit_row();
create trigger discount_codes_audit after insert or update or delete on public.discount_codes
  for each row execute function private.audit_row();
create trigger promotions_audit after insert or update or delete on public.promotions
  for each row execute function private.audit_row();
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function private.audit_row();
create trigger shipping_rates_audit after insert or update or delete on public.shipping_rates
  for each row execute function private.audit_row();
