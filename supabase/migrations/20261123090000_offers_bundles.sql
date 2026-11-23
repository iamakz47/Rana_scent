-- Rana Scent: Offers & Bundles.
--
--   * An offer IS a product: `products.type = 'bundle'`, exactly one
--     `product_variants` row (the owner's final price), and its included
--     products listed in the existing (previously unused) `bundle_items`
--     table. Nothing is duplicated: the owner picks existing products.
--   * `bundle_items.locked_variant_id` optionally pins one colour; NULL
--     means the customer chooses any available colour at purchase time.
--   * Scheduling (`offer_starts_at` / `offer_ends_at`) and discount-code
--     stacking are per-offer, additive columns on `products`.
--   * Checkout keeps pricing a bundle exactly like any other product (its
--     own variant, own price) for billing, but ALSO expands it into its
--     component products to validate and reserve their real stock, and to
--     record a complete, immutable breakdown for the order. Free-fragrance
--     choices on an included diffuser work exactly as they do standalone.
--   * `track_inventory` (already in the schema, previously unused by
--     checkout) is now actually respected by the stock check: an offer's
--     own placeholder variant is never itself stock-tracked, and any other
--     product correctly marked "always available" is no longer wrongly
--     blocked once its `on_hand` reaches zero.
-- Additive and non-destructive: new columns, tables and functions.

-- ---------------------------------------------------------------------------
-- Schema: offer-only columns and the locked-colour option
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists offer_starts_at timestamptz,
  add column if not exists offer_ends_at timestamptz,
  add column if not exists allow_discount_stacking boolean not null default false;
alter table public.products drop constraint if exists products_offer_window_check;
alter table public.products add constraint products_offer_window_check
  check (offer_starts_at is null or offer_ends_at is null or offer_ends_at > offer_starts_at);

alter table public.bundle_items
  add column if not exists locked_variant_id uuid references public.product_variants (id) on delete set null;

-- An offer cannot include another offer, and a locked colour must belong to
-- the product it is locked on.
create or replace function private.guard_bundle_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_type public.product_type;
begin
  select type into item_type from public.products where id = new.item_product_id;
  if item_type is null then
    raise exception 'Included product not found' using errcode = '23503';
  end if;
  if item_type = 'bundle' then
    raise exception 'An offer cannot include another offer' using errcode = '23514';
  end if;
  if new.locked_variant_id is not null and not exists (
    select 1 from public.product_variants v where v.id = new.locked_variant_id and v.product_id = new.item_product_id
  ) then
    raise exception 'The locked colour must belong to the included product' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_bundle_item() from public;
drop trigger if exists bundle_items_guard on public.bundle_items;
create trigger bundle_items_guard before insert or update on public.bundle_items
  for each row execute function private.guard_bundle_item();

-- Publishing an offer additionally needs at least one included product, all
-- of them currently published (otherwise the storefront would silently show
-- an incomplete bundle while still charging the full price). This extends
-- the existing publish guard; every other product type is unaffected.
create or replace function private.guard_product_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
    if tg_op = 'INSERT' then
      new.created_by := (select auth.uid());
    end if;
    if (tg_op = 'INSERT' and new.status <> 'draft')
       or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
      if not private.has_permission('catalog.publish') then
        raise exception 'Publishing requires the catalog.publish permission' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if tg_op = 'INSERT' or not exists (
      select 1 from public.product_variants v where v.product_id = new.id and v.is_active
    ) then
      raise exception 'A product needs at least one available variant before it is published' using errcode = '23514';
    end if;
    if new.type = 'bundle' then
      if not exists (select 1 from public.bundle_items bi where bi.bundle_id = new.id) then
        raise exception 'An offer needs at least one included product before it is published' using errcode = '23514';
      end if;
      if exists (
        select 1 from public.bundle_items bi join public.products p on p.id = bi.item_product_id
        where bi.bundle_id = new.id and p.status <> 'published'
      ) then
        raise exception 'Every product in an offer must be published before the offer is published' using errcode = '23514';
      end if;
    end if;
    new.published_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_product_status() from public;

-- ---------------------------------------------------------------------------
-- Order breakdown: which real products an offer line resolved to
-- ---------------------------------------------------------------------------

create table public.order_item_components (
  id bigint generated always as identity primary key,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  item_product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  sku text not null,
  name_ar text not null,
  name_en text not null,
  variant_label_ar text not null,
  variant_label_en text not null,
  color_hex text,
  unit_price_fils integer not null check (unit_price_fils >= 0),
  quantity integer not null check (quantity > 0),
  position smallint not null default 0
);
create index order_item_components_order_item_idx on public.order_item_components (order_item_id);
create index order_item_components_variant_idx on public.order_item_components (variant_id);

alter table public.order_item_components enable row level security;
create policy "Customers and order staff read bundle components" on public.order_item_components
  for select to authenticated
  using (
    exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id
            where i.id = order_item_id and o.user_id = (select auth.uid()))
    or (select private.has_permission('orders.read'))
  );
revoke all on public.order_item_components from anon;
revoke insert, update, delete, truncate on public.order_item_components from authenticated;

-- Free-fragrance preferences of a component, same shape as order_item_fragrances
-- but scoped to one included product within one bundle line.
create table public.order_item_component_fragrances (
  id bigint generated always as identity primary key,
  order_item_component_id bigint not null references public.order_item_components (id) on delete cascade,
  device_no smallint not null check (device_no between 1 and 999),
  slot smallint not null check (slot in (1, 2)),
  fragrance_product_id uuid references public.products (id) on delete set null,
  name_ar text not null,
  name_en text not null,
  unique (order_item_component_id, device_no, slot)
);

alter table public.order_item_component_fragrances enable row level security;
create policy "Customers and order staff read bundle fragrance choices" on public.order_item_component_fragrances
  for select to authenticated
  using (
    exists (
      select 1 from public.order_item_components c
      join public.order_items i on i.id = c.order_item_id
      join public.orders o on o.id = i.order_id
      where c.id = order_item_component_id and o.user_id = (select auth.uid())
    )
    or (select private.has_permission('orders.read'))
  );
revoke all on public.order_item_component_fragrances from anon;
revoke insert, update, delete, truncate on public.order_item_component_fragrances from authenticated;

-- ---------------------------------------------------------------------------
-- Admin write: save_offer
-- ---------------------------------------------------------------------------

-- A readable, collision-safe slug from the English name (falling back to a
-- generic word), plus a short random suffix. The owner never types one.
create or replace function private.unique_offer_slug(p_name_en text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base text;
begin
  base := lower(coalesce(nullif(btrim(p_name_en), ''), 'offer'));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then
    base := 'offer';
  end if;
  return left(base, 60) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
end;
$$;
revoke all on function private.unique_offer_slug(text) from public;
grant execute on function private.unique_offer_slug(text) to authenticated;

create or replace function private.unique_offer_sku()
returns text
language sql
set search_path = ''
as $$
  select 'OFFER-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10))
$$;
revoke all on function private.unique_offer_sku() from public;
grant execute on function private.unique_offer_sku() to authenticated;

-- Saves an offer (a bundle product, its one price-carrying variant, its
-- promotional image and its included products) in one transaction.
-- SECURITY INVOKER: every write is still checked by the existing catalog RLS
-- policies (catalog.write), exactly like save_product. The server, not the
-- browser, computes and checks the original total vs. the offer price.
create or replace function public.save_offer(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid := nullif(payload ->> 'id', '')::uuid;
  vid uuid;
  items jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  item_count integer := jsonb_array_length(items);
  v_price integer := coalesce((payload ->> 'price_fils')::integer, 0);
  v_original integer;
begin
  if item_count < 1 or item_count > 20 then
    raise exception 'offer_items_invalid' using errcode = '22023';
  end if;
  if (select count(distinct (e.value ->> 'item_product_id')) from jsonb_array_elements(items) e) <> item_count then
    raise exception 'offer_items_invalid' using errcode = '22023';
  end if;

  -- The original total: the locked colour's price when one is set, else the
  -- cheapest currently active colour of that product.
  select coalesce(sum(
    coalesce(
      (select v.price_fils from public.product_variants v
        where v.id = nullif(e.value ->> 'locked_variant_id', '')::uuid
          and v.product_id = (e.value ->> 'item_product_id')::uuid),
      (select min(v.price_fils) from public.product_variants v
        where v.product_id = (e.value ->> 'item_product_id')::uuid and v.is_active)
    ) * greatest(coalesce((e.value ->> 'quantity')::integer, 1), 1)
  ), 0) into v_original
  from jsonb_array_elements(items) e;

  if v_price <= 0 then
    raise exception 'offer_price_invalid' using errcode = '22023';
  end if;
  if v_original = 0 or v_price >= v_original then
    raise exception 'offer_price_too_high' using errcode = '22023';
  end if;

  if pid is null then
    insert into public.products (
      slug, type, name_ar, name_en, description_ar, description_en,
      offer_starts_at, offer_ends_at, allow_discount_stacking
    ) values (
      private.unique_offer_slug(payload ->> 'name_en'), 'bundle',
      payload ->> 'name_ar', payload ->> 'name_en',
      coalesce(payload ->> 'description_ar', ''), coalesce(payload ->> 'description_en', ''),
      nullif(payload ->> 'starts_at', '')::timestamptz, nullif(payload ->> 'ends_at', '')::timestamptz,
      coalesce((payload ->> 'allow_discount_stacking')::boolean, false)
    )
    returning id into pid;
  else
    if not exists (select 1 from public.products where id = pid and type = 'bundle') then
      raise exception 'Offer not found' using errcode = 'P0002';
    end if;
    update public.products set
      name_ar = payload ->> 'name_ar',
      name_en = payload ->> 'name_en',
      description_ar = coalesce(payload ->> 'description_ar', ''),
      description_en = coalesce(payload ->> 'description_en', ''),
      offer_starts_at = nullif(payload ->> 'starts_at', '')::timestamptz,
      offer_ends_at = nullif(payload ->> 'ends_at', '')::timestamptz,
      allow_discount_stacking = coalesce((payload ->> 'allow_discount_stacking')::boolean, false)
    where id = pid;
    if not found then
      raise exception 'Offer not found' using errcode = 'P0002';
    end if;
  end if;

  select id into vid from public.product_variants where product_id = pid and is_active limit 1;
  if vid is null then
    insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils, is_active)
    values (pid, private.unique_offer_sku(), 'الحزمة', 'Bundle', v_price, true);
  else
    update public.product_variants set price_fils = v_price where id = vid;
  end if;

  delete from public.bundle_items where bundle_id = pid;
  insert into public.bundle_items (bundle_id, item_product_id, quantity, locked_variant_id, position)
  select pid, (e.value ->> 'item_product_id')::uuid, greatest(coalesce((e.value ->> 'quantity')::integer, 1), 1),
         nullif(e.value ->> 'locked_variant_id', '')::uuid, (e.ordinality - 1)::smallint
  from jsonb_array_elements(items) with ordinality as e (value, ordinality);

  delete from public.product_media where product_id = pid;
  insert into public.product_media (product_id, media_id, position)
  select pid, m.value::uuid, (m.ordinality - 1)::smallint
  from jsonb_array_elements_text(coalesce(payload -> 'media', '[]'::jsonb)) with ordinality as m (value, ordinality);

  return pid;
exception
  when invalid_text_representation then
    raise exception 'offer_items_invalid' using errcode = '22023';
end;
$$;
revoke all on function public.save_offer(jsonb) from public, anon;
grant execute on function public.save_offer(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Checkout: pricing and stock for a bundle line
-- ---------------------------------------------------------------------------

-- Re-derives price and stock for the plain (non-offer) lines of a cart.
-- Bundles are never priced here: they go through price_bundle() below, which
-- uses the offer's own price rather than summing its components. A product
-- marked "not stock-tracked" is reported with its real on_hand (for display)
-- but callers must gate the short-stock check on track_inventory, same as
-- private.fragrance_is_eligible already does elsewhere.
drop function if exists private.price_cart(jsonb);
create function private.price_cart(items jsonb)
returns table (variant_id uuid, product_id uuid, sku text, name_ar text, name_en text,
  label_ar text, label_en text, unit_price_fils integer, quantity integer, on_hand integer,
  track_inventory boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception 'cart_invalid' using errcode = '22023';
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
  select v.id, p.id, v.sku, p.name_ar, p.name_en, v.label_ar, v.label_en, v.price_fils, r.qty, i.on_hand,
         i.track_inventory
  from requested r
  join public.product_variants v on v.id = r.vid and v.is_active
  join public.products p on p.id = v.product_id and p.status = 'published' and p.type <> 'bundle'
  join public.inventory i on i.variant_id = v.id
  order by v.id;
end;
$$;
revoke all on function private.price_cart(jsonb) from public;

-- The currently-valid offer behind a cart line's own (placeholder) variant.
create or replace function private.bundle_header(p_variant_id uuid)
returns table (bundle_id uuid, sku text, name_ar text, name_en text, price_fils integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, v.sku, p.name_ar, p.name_en, v.price_fils
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id and v.is_active and p.type = 'bundle' and p.status = 'published'
    and (p.offer_starts_at is null or now() >= p.offer_starts_at)
    and (p.offer_ends_at is null or now() < p.offer_ends_at)
$$;
revoke all on function private.bundle_header(uuid) from public;

-- Resolves one offer line's included products to real variants: the owner's
-- locked colour when set, otherwise whichever colour the customer chose
-- (validated here, never trusted as-is). A bundle_items row that cannot be
-- resolved (unknown/inactive/unpublished) is simply left out, so the caller
-- can detect a short count and fail closed exactly like price_cart does.
create or replace function private.price_bundle(p_bundle_id uuid, p_quantity integer, p_components jsonb)
returns table (
  item_product_id uuid, variant_id uuid, sku text, name_ar text, name_en text,
  variant_label_ar text, variant_label_en text, color_hex text,
  unit_price_fils integer, quantity integer, on_hand integer, track_inventory boolean,
  fragrances jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  with wanted as (
    select bi.item_product_id, bi.quantity as per_bundle_qty, bi.locked_variant_id,
           match.value ->> 'variant_id' as chosen_variant_text,
           coalesce(match.value -> 'fragrances', '[]'::jsonb) as fragrances
    from public.bundle_items bi
    left join lateral (
      select e.value
      from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) e (value)
      where (e.value ->> 'item_product_id') = bi.item_product_id::text
      limit 1
    ) match (value) on true
    where bi.bundle_id = p_bundle_id
  ),
  resolved as (
    select item_product_id, coalesce(locked_variant_id, nullif(chosen_variant_text, '')::uuid) as variant_id,
           per_bundle_qty, fragrances
    from wanted
  )
  select p.id, v.id, v.sku, p.name_ar, p.name_en, v.label_ar, v.label_en, v.color_hex,
         v.price_fils, (r.per_bundle_qty * greatest(p_quantity, 0))::integer, i.on_hand, i.track_inventory,
         r.fragrances
  from resolved r
  join public.product_variants v on v.id = r.variant_id and v.product_id = r.item_product_id and v.is_active
  join public.products p on p.id = r.item_product_id and p.status = 'published'
  join public.inventory i on i.variant_id = v.id;
exception
  when invalid_text_representation then
    return;
end;
$$;
revoke all on function private.price_bundle(uuid, integer, jsonb) from public;

-- Validates one included product's free-fragrance choices (count, eligibility,
-- duplicates), the same rules private.free_fragrance_problem applies to a
-- standalone line.
create or replace function private.component_fragrance_problem(p_item_product_id uuid, p_fragrances jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expected integer;
  v_ids uuid[];
  v_allow_dupes boolean;
  v_id uuid;
begin
  select coalesce(free_fragrances, 0) into v_expected from public.products where id = p_item_product_id;
  if jsonb_array_length(coalesce(p_fragrances, '[]'::jsonb)) <> coalesce(v_expected, 0) then
    return case when coalesce(v_expected, 0) > 0 then 'fragrance_selection_required' else 'fragrance_invalid' end;
  end if;
  if coalesce(v_expected, 0) = 0 then
    return null;
  end if;
  select coalesce(free_fragrance_allow_duplicates, true) into v_allow_dupes from public.store_settings where id = 1;
  v_ids := array(select (x)::uuid from jsonb_array_elements_text(p_fragrances) x);
  foreach v_id in array v_ids loop
    if not private.fragrance_is_eligible(v_id) then
      return 'fragrance_unavailable';
    end if;
  end loop;
  if not v_allow_dupes and (select count(distinct x) from unnest(v_ids) x) < array_length(v_ids, 1) then
    return 'fragrance_duplicate';
  end if;
  return null;
exception
  when invalid_text_representation then
    return 'fragrance_invalid';
end;
$$;
revoke all on function private.component_fragrance_problem(uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- quote_order: add offer lines to the live checkout summary
-- ---------------------------------------------------------------------------

create or replace function public.quote_order(p_items jsonb, p_governorate text default null, p_area text default '',
  p_discount_code text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plain_items jsonb;
  v_bundle_entries jsonb;
  v_lines jsonb;
  v_subtotal integer;
  v_short jsonb;
  v_requested integer := 0;
  v_discount_id uuid;
  v_discount integer;
  v_problem text;
  v_rate uuid;
  v_shipping integer;
  v_min smallint;
  v_max smallint;
  v_fragrance text;
  v_entry jsonb;
  v_entry_qty integer;
  v_bundle_id uuid;
  v_bundle_sku text;
  v_bundle_name_ar text;
  v_bundle_name_en text;
  v_bundle_price integer;
  v_expected_count integer;
  v_actual_count integer;
  v_bundle_lines jsonb := '[]'::jsonb;
  v_bundle_subtotal integer := 0;
  v_unavailable integer := 0;
  v_any_no_stack boolean := false;
  v_comp record;
begin
  select coalesce(jsonb_agg(e.value), '[]'::jsonb) into v_plain_items
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e where not (e.value ? 'bundle');
  select coalesce(jsonb_agg(e.value), '[]'::jsonb) into v_bundle_entries
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e where e.value ? 'bundle';
  if jsonb_array_length(v_plain_items) = 0 and jsonb_array_length(v_bundle_entries) = 0 then
    raise exception 'cart_empty' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', c.variant_id, 'sku', c.sku, 'name', jsonb_build_object('ar', c.name_ar, 'en', c.name_en),
           'label', jsonb_build_object('ar', c.label_ar, 'en', c.label_en),
           'unit_price_fils', c.unit_price_fils, 'quantity', c.quantity,
           'line_total_fils', c.unit_price_fils * c.quantity, 'available', c.on_hand)), '[]'::jsonb),
         coalesce(sum(c.unit_price_fils * c.quantity), 0)::integer,
         coalesce(jsonb_agg(c.variant_id) filter (where c.quantity > c.on_hand and c.track_inventory), '[]'::jsonb)
    into v_lines, v_subtotal, v_short
  from private.price_cart(v_plain_items) c;
  v_lines := coalesce(v_lines, '[]'::jsonb);
  v_subtotal := coalesce(v_subtotal, 0);
  v_short := coalesce(v_short, '[]'::jsonb);

  if jsonb_array_length(v_plain_items) > 0 then
    select count(distinct (e ->> 'variant_id')) into v_requested from jsonb_array_elements(v_plain_items) e;
    v_unavailable := greatest(v_requested - jsonb_array_length(v_lines), 0);
  end if;

  v_fragrance := private.free_fragrance_problem(v_plain_items);

  for v_entry in select value from jsonb_array_elements(v_bundle_entries) loop
    v_entry_qty := coalesce((v_entry ->> 'quantity')::integer, 0);
    v_bundle_id := null;
    select h.bundle_id, h.sku, h.name_ar, h.name_en, h.price_fils
      into v_bundle_id, v_bundle_sku, v_bundle_name_ar, v_bundle_name_en, v_bundle_price
    from private.bundle_header((v_entry ->> 'variant_id')::uuid) h;

    if v_bundle_id is null then
      v_unavailable := v_unavailable + 1;
      continue;
    end if;

    select count(*) into v_expected_count from public.bundle_items where bundle_id = v_bundle_id;
    select count(*) into v_actual_count
    from private.price_bundle(v_bundle_id, v_entry_qty, v_entry -> 'bundle' -> 'components');
    if v_actual_count <> v_expected_count then
      v_unavailable := v_unavailable + 1;
      continue;
    end if;

    if exists (
      select 1 from private.price_bundle(v_bundle_id, v_entry_qty, v_entry -> 'bundle' -> 'components') b
      where b.quantity > b.on_hand and b.track_inventory
    ) then
      v_short := v_short || jsonb_build_array((v_entry ->> 'variant_id')::text);
    end if;

    if v_fragrance is null then
      for v_comp in select * from private.price_bundle(v_bundle_id, v_entry_qty, v_entry -> 'bundle' -> 'components') loop
        if v_fragrance is null then
          v_fragrance := private.component_fragrance_problem(v_comp.item_product_id, v_comp.fragrances);
        end if;
      end loop;
    end if;

    if not coalesce((select allow_discount_stacking from public.products where id = v_bundle_id), false) then
      v_any_no_stack := true;
    end if;

    v_bundle_subtotal := v_bundle_subtotal + v_bundle_price * v_entry_qty;
    v_bundle_lines := v_bundle_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_entry ->> 'variant_id', 'sku', v_bundle_sku,
      'name', jsonb_build_object('ar', v_bundle_name_ar, 'en', v_bundle_name_en),
      'label', jsonb_build_object('ar', 'الحزمة', 'en', 'Bundle'),
      'unit_price_fils', v_bundle_price, 'quantity', v_entry_qty,
      'line_total_fils', v_bundle_price * v_entry_qty, 'available', 9999));
  end loop;

  v_lines := v_lines || v_bundle_lines;
  v_subtotal := v_subtotal + v_bundle_subtotal;

  select d.discount_id, d.discount_fils, d.problem into v_discount_id, v_discount, v_problem
  from private.discount_for(p_discount_code, v_subtotal) d;
  if v_any_no_stack and btrim(coalesce(p_discount_code, '')) <> '' then
    v_discount := 0;
    v_problem := 'discount_blocked_by_offer';
  end if;
  if p_governorate is not null then
    select x.rate_id, x.shipping_fils, x.min_days, x.max_days into v_rate, v_shipping, v_min, v_max
    from private.delivery_for(p_governorate, p_area, v_subtotal - v_discount) x;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'unavailable_count', v_unavailable,
    'short_stock', v_short,
    'subtotal_fils', v_subtotal,
    'discount_fils', v_discount,
    'discount_problem', v_problem,
    'delivery_available', v_rate is not null,
    'shipping_fils', coalesce(v_shipping, 0),
    'delivery_days', case when v_rate is null then null else jsonb_build_object('min', v_min, 'max', v_max) end,
    'total_fils', v_subtotal - v_discount + coalesce(v_shipping, 0),
    'fragrance_problem', v_fragrance
  );
exception
  when invalid_text_representation then
    raise exception 'cart_invalid' using errcode = '22023';
end;
$$;
revoke all on function public.quote_order(jsonb, text, text, text) from public;
grant execute on function public.quote_order(jsonb, text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- place_order: price, validate and reserve offer lines
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
  v_plain_items jsonb;
  v_bundle_entries jsonb;
  v_line record;
  v_subtotal integer := 0;
  v_requested integer := 0;
  v_priced integer := 0;
  v_discount_id uuid;
  v_discount integer;
  v_problem text;
  v_rate uuid;
  v_shipping integer;
  v_order record;
  v_entry jsonb;
  v_entry_qty integer;
  v_bundle_id uuid;
  v_bundle_sku text;
  v_bundle_name_ar text;
  v_bundle_name_en text;
  v_bundle_price integer;
  v_expected_count integer;
  v_order_item_id uuid;
  v_order_item_component_id bigint;
  v_any_no_stack boolean := false;
  v_comp record;
  v_device integer;
  v_slot integer;
  v_choice uuid;
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
  if v_phone ~ '^\+965' then
    v_phone := substr(v_phone, 5);
  elsif v_phone ~ '^00965' then
    v_phone := substr(v_phone, 6);
  elsif v_phone ~ '^965[0-9]{8}$' then
    v_phone := substr(v_phone, 4);
  end if;
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

  select coalesce(jsonb_agg(e.value), '[]'::jsonb) into v_plain_items
    from jsonb_array_elements(v_items) e where not (e.value ? 'bundle');
  select coalesce(jsonb_agg(e.value), '[]'::jsonb) into v_bundle_entries
    from jsonb_array_elements(v_items) e where e.value ? 'bundle';
  if jsonb_array_length(v_plain_items) = 0 and jsonb_array_length(v_bundle_entries) = 0 then
    raise exception 'cart_empty' using errcode = '22023';
  end if;

  -- Lock the stock rows of every variant this checkout can possibly touch,
  -- in one fixed order: plain lines, every offer's own placeholder variant,
  -- every component variant the customer chose, and every locked colour of
  -- an offer in the cart. Concurrent checkouts for the same item wait.
  perform 1 from public.inventory i
  where i.variant_id in (
    select (e ->> 'variant_id')::uuid from jsonb_array_elements(v_plain_items) e
    union
    select (e ->> 'variant_id')::uuid from jsonb_array_elements(v_bundle_entries) e
    union
    select (c ->> 'variant_id')::uuid
    from jsonb_array_elements(v_bundle_entries) e,
         jsonb_array_elements(coalesce(e -> 'bundle' -> 'components', '[]'::jsonb)) c
    where nullif(c ->> 'variant_id', '') is not null
    union
    select bi.locked_variant_id
    from jsonb_array_elements(v_bundle_entries) e
    join public.product_variants v on v.id = (e ->> 'variant_id')::uuid
    join public.bundle_items bi on bi.bundle_id = v.product_id and bi.locked_variant_id is not null
  )
  order by i.variant_id
  for update;

  drop table if exists pg_temp.checkout_lines;
  create temporary table checkout_lines on commit drop as
    select * from private.price_cart(v_plain_items);
  if jsonb_array_length(v_plain_items) > 0 then
    select count(distinct (e ->> 'variant_id')) into v_requested from jsonb_array_elements(v_plain_items) e;
    select count(*), coalesce(sum(c.unit_price_fils * c.quantity), 0) into v_priced, v_subtotal
    from pg_temp.checkout_lines c;
    if v_priced <> v_requested then
      raise exception 'item_unavailable' using errcode = '22023';
    end if;
    if exists (select 1 from pg_temp.checkout_lines c where c.quantity > c.on_hand and c.track_inventory) then
      raise exception 'out_of_stock' using errcode = '22023';
    end if;
  end if;

  -- Free-fragrance choices of plain lines (count per device, eligibility, stock).
  v_problem := private.free_fragrance_problem(v_plain_items);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '22023';
  end if;

  -- Offers: each cart line is resolved and validated on its own, so two
  -- lines of the same offer with different colours are never merged.
  for v_entry in select value from jsonb_array_elements(v_bundle_entries) loop
    v_entry_qty := coalesce((v_entry ->> 'quantity')::integer, 0);
    v_bundle_id := null;
    select h.bundle_id, h.sku, h.name_ar, h.name_en, h.price_fils
      into v_bundle_id, v_bundle_sku, v_bundle_name_ar, v_bundle_name_en, v_bundle_price
    from private.bundle_header((v_entry ->> 'variant_id')::uuid) h;
    if v_bundle_id is null then
      raise exception 'item_unavailable' using errcode = '22023';
    end if;

    select count(*) into v_expected_count from public.bundle_items where bundle_id = v_bundle_id;

    drop table if exists pg_temp.bundle_components;
    create temporary table bundle_components on commit drop as
      select * from private.price_bundle(v_bundle_id, v_entry_qty, v_entry -> 'bundle' -> 'components');

    if (select count(*) from pg_temp.bundle_components) <> v_expected_count then
      raise exception 'item_unavailable' using errcode = '22023';
    end if;
    if exists (select 1 from pg_temp.bundle_components where quantity > on_hand and track_inventory) then
      raise exception 'out_of_stock' using errcode = '22023';
    end if;
    for v_comp in select * from pg_temp.bundle_components loop
      v_problem := private.component_fragrance_problem(v_comp.item_product_id, v_comp.fragrances);
      if v_problem is not null then
        raise exception '%', v_problem using errcode = '22023';
      end if;
    end loop;

    if not coalesce((select allow_discount_stacking from public.products where id = v_bundle_id), false) then
      v_any_no_stack := true;
    end if;
    v_subtotal := v_subtotal + v_bundle_price * v_entry_qty;

    -- This pass only validates and prices (so a bad line fails before any
    -- order or payment is created); the matching order_items and
    -- order_item_components rows are inserted in the second pass below,
    -- once v_order.id exists.
  end loop;

  -- Discount (lock the code row so its redemption limit can't be overshot).
  -- An offer that does not allow stacking blocks a discount code entirely,
  -- since there is one discount slot for the whole order, not per line.
  if v_any_no_stack and btrim(coalesce(p_payload ->> 'discount_code', '')) <> '' then
    raise exception 'discount_blocked_by_offer' using errcode = '22023';
  end if;
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

  -- Plain lines: unchanged from the original checkout.
  for v_line in select * from pg_temp.checkout_lines loop
    insert into public.order_items (order_id, product_id, variant_id, sku, name_ar, name_en,
      variant_label_ar, variant_label_en, unit_price_fils, quantity, line_total_fils)
    values (v_order.id, v_line.product_id, v_line.variant_id, v_line.sku, v_line.name_ar, v_line.name_en,
      v_line.label_ar, v_line.label_en, v_line.unit_price_fils, v_line.quantity,
      v_line.unit_price_fils * v_line.quantity);

    if v_line.track_inventory then
      update public.inventory i set on_hand = i.on_hand - v_line.quantity where i.variant_id = v_line.variant_id;
      insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, order_id)
      values (v_line.variant_id, -v_line.quantity, v_line.on_hand - v_line.quantity, 'sale',
              'Reserved for order #' || v_order.number, v_order.id);
    end if;
  end loop;

  -- Offer lines: insert the bundle's own order_items row (billing) plus one
  -- order_item_components row per included product (the real breakdown),
  -- and reserve stock against those real components, not the offer itself.
  for v_entry in select value from jsonb_array_elements(v_bundle_entries) loop
    v_entry_qty := coalesce((v_entry ->> 'quantity')::integer, 0);
    v_bundle_id := null;
    select h.bundle_id, h.sku, h.name_ar, h.name_en, h.price_fils
      into v_bundle_id, v_bundle_sku, v_bundle_name_ar, v_bundle_name_en, v_bundle_price
    from private.bundle_header((v_entry ->> 'variant_id')::uuid) h;
    if v_bundle_id is null then
      raise exception 'item_unavailable' using errcode = '22023';
    end if;

    insert into public.order_items (order_id, product_id, variant_id, sku, name_ar, name_en,
      variant_label_ar, variant_label_en, unit_price_fils, quantity, line_total_fils)
    values (v_order.id, v_bundle_id, (v_entry ->> 'variant_id')::uuid, v_bundle_sku, v_bundle_name_ar, v_bundle_name_en,
      'الحزمة', 'Bundle', v_bundle_price, v_entry_qty, v_bundle_price * v_entry_qty)
    returning id into v_order_item_id;

    for v_comp in
      select * from private.price_bundle(v_bundle_id, v_entry_qty, v_entry -> 'bundle' -> 'components')
      order by item_product_id
    loop
      insert into public.order_item_components (order_item_id, item_product_id, variant_id, sku, name_ar, name_en,
        variant_label_ar, variant_label_en, color_hex, unit_price_fils, quantity, position)
      values (v_order_item_id, v_comp.item_product_id, v_comp.variant_id, v_comp.sku, v_comp.name_ar, v_comp.name_en,
        v_comp.variant_label_ar, v_comp.variant_label_en, v_comp.color_hex, v_comp.unit_price_fils, v_comp.quantity, 0)
      returning id into v_order_item_component_id;

      if v_comp.track_inventory then
        update public.inventory i set on_hand = i.on_hand - v_comp.quantity where i.variant_id = v_comp.variant_id;
        insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, order_id)
        values (v_comp.variant_id, -v_comp.quantity, v_comp.on_hand - v_comp.quantity, 'sale',
                'Reserved for order #' || v_order.number || ' (offer)', v_order.id);
      end if;

      if jsonb_array_length(coalesce(v_comp.fragrances, '[]'::jsonb)) > 0 then
        for v_device in 1 .. v_comp.quantity loop
          v_slot := 0;
          for v_choice in select (x)::uuid from jsonb_array_elements_text(v_comp.fragrances) x loop
            v_slot := v_slot + 1;
            insert into public.order_item_component_fragrances
              (order_item_component_id, device_no, slot, fragrance_product_id, name_ar, name_en)
            select v_order_item_component_id, v_device, v_slot, p.id, p.name_ar, p.name_en
            from public.products p where p.id = v_choice;
          end loop;
        end loop;
      end if;
    end loop;
  end loop;

  -- Free-fragrance preferences of plain lines.
  perform private.save_free_fragrances(v_order.id, v_plain_items);

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

-- ---------------------------------------------------------------------------
-- Cancellation: release stock reserved by offer lines too
-- ---------------------------------------------------------------------------

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
    select i.variant_id, sum(i.quantity)::integer as qty
    from public.order_items i
    join public.product_variants v on v.id = i.variant_id
    join public.products p on p.id = v.product_id
    where i.order_id = target and i.variant_id is not null and p.type <> 'bundle'
    group by i.variant_id order by i.variant_id
  loop
    update public.inventory set on_hand = on_hand + item.qty where variant_id = item.variant_id;
    if found then
      insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, order_id)
      select item.variant_id, item.qty, i.on_hand, 'return', 'Released from order #' || o.number, target
      from public.inventory i where i.variant_id = item.variant_id;
    end if;
  end loop;

  -- Offer lines: restore stock for every included product, grouped across
  -- every offer line of this order (not just the first).
  for item in
    select c.variant_id, sum(c.quantity)::integer as qty
    from public.order_item_components c
    join public.order_items i on i.id = c.order_item_id
    where i.order_id = target and c.variant_id is not null
    group by c.variant_id order by c.variant_id
  loop
    update public.inventory set on_hand = on_hand + item.qty where variant_id = item.variant_id;
    if found then
      insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, order_id)
      select item.variant_id, item.qty, i.on_hand, 'return', 'Released from order #' || o.number || ' (offer)', target
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

-- ---------------------------------------------------------------------------
-- Guest order confirmation: show the offer breakdown too
-- ---------------------------------------------------------------------------

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
                'quantity', i.quantity, 'unit_price_fils', i.unit_price_fils, 'line_total_fils', i.line_total_fils,
                'components', (select coalesce(jsonb_agg(jsonb_build_object(
                                 'name', jsonb_build_object('ar', c.name_ar, 'en', c.name_en),
                                 'label', jsonb_build_object('ar', c.variant_label_ar, 'en', c.variant_label_en),
                                 'color_hex', c.color_hex, 'quantity', c.quantity) order by c.position), '[]'::jsonb)
                               from public.order_item_components c where c.order_item_id = i.id))
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
