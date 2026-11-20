-- Rana Scent: detailed product information, free fragrance selection and
-- owner-managed policies.
--
--   * products.device_specs: structured, optional device specifications
--     (coverage, capacity, dimensions, weight, power, noise, warranty…).
--     Only filled fields are shown; nothing is guessed.
--   * products.info_sections: optional bilingual information sections
--     (overview, operation, installation, maintenance, warranty…).
--   * products.free_fragrances: 1 or 2 free fragrance cartridges included
--     with a diffuser (NULL = not configured / not a diffuser).
--   * products.free_fragrance_eligible: whether a refill may be chosen as a
--     free fragrance.
--   * Checkout validates every free-fragrance choice on the server (count per
--     device, eligibility, stock, duplicates) and stores the choices per
--     device as PREFERENCES (confirmed with the customer on delivery). Free
--     cartridges are not priced and do not reserve stock.
--   * site_policies: bilingual policy drafts the owner edits, previews and
--     publishes. Visitors only ever see published text.
-- Additive and non-destructive: new columns, tables and functions.

-- ---------------------------------------------------------------------------
-- Product details
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists free_fragrances smallint check (free_fragrances in (1, 2)),
  add column if not exists free_fragrance_eligible boolean not null default true,
  add column if not exists device_specs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(device_specs) = 'object' and pg_column_size(device_specs) < 20000),
  add column if not exists info_sections jsonb not null default '{}'::jsonb
    check (jsonb_typeof(info_sections) = 'object' and pg_column_size(info_sections) < 60000);

-- Only diffusers include free fragrances. A trigger (rather than a check
-- constraint) so a product can change type in one save: the count is simply
-- cleared for anything that isn't a diffuser.
create or replace function private.clear_free_fragrances()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type <> 'diffuser' then
    new.free_fragrances := null;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_free_fragrances() from public;
drop trigger if exists products_clear_free_fragrances on public.products;
create trigger products_clear_free_fragrances before insert or update on public.products
  for each row execute function private.clear_free_fragrances();

alter table public.store_settings
  add column if not exists free_fragrance_allow_duplicates boolean not null default true;

-- ---------------------------------------------------------------------------
-- Free fragrance selection
-- ---------------------------------------------------------------------------

-- A fragrance (refill product) that can currently be chosen for free.
create or replace function private.fragrance_is_eligible(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product and p.type = 'refill' and p.status = 'published' and p.free_fragrance_eligible
      and exists (
        select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
        where v.product_id = p.id and v.is_active and (i.on_hand > 0 or not i.track_inventory)
      )
  )
$$;
revoke all on function private.fragrance_is_eligible(uuid) from public;

-- Fragrances customers can choose from (for the storefront).
create or replace function public.list_free_fragrances()
returns table (id uuid, slug text, name_ar text, name_en text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.name_ar, p.name_en
  from public.products p
  where private.fragrance_is_eligible(p.id)
  order by p.position, p.name_en
$$;
revoke all on function public.list_free_fragrances() from public;
grant execute on function public.list_free_fragrances() to anon, authenticated, service_role;

-- Validates the free-fragrance choices of every cart line. Returns NULL when
-- valid, otherwise a stable error key. The count comes from the product, never
-- from the browser: a line must carry exactly free_fragrances choices (none for
-- products without free fragrances).
create or replace function private.free_fragrance_problem(p_items jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e jsonb;
  v_expected integer;
  v_choices jsonb;
  v_ids uuid[];
  v_allow_dupes boolean;
  v_id uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return null;
  end if;
  select coalesce(s.free_fragrance_allow_duplicates, true) into v_allow_dupes from public.store_settings s where s.id = 1;
  for e in select value from jsonb_array_elements(p_items) loop
    select coalesce(p.free_fragrances, 0) into v_expected
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = (e ->> 'variant_id')::uuid;
    if not found then
      continue; -- unknown variants are reported by the pricing step
    end if;
    v_choices := coalesce(e -> 'fragrances', '[]'::jsonb);
    if jsonb_typeof(v_choices) <> 'array' then
      return 'fragrance_invalid';
    end if;
    if jsonb_array_length(v_choices) <> v_expected then
      return case when v_expected > 0 then 'fragrance_selection_required' else 'fragrance_invalid' end;
    end if;
    if v_expected = 0 then
      continue;
    end if;
    v_ids := array(select (x)::uuid from jsonb_array_elements_text(v_choices) x);
    foreach v_id in array v_ids loop
      if not private.fragrance_is_eligible(v_id) then
        return 'fragrance_unavailable';
      end if;
    end loop;
    if not v_allow_dupes and (select count(distinct x) from unnest(v_ids) x) < array_length(v_ids, 1) then
      return 'fragrance_duplicate';
    end if;
  end loop;
  return null;
exception
  when invalid_text_representation then
    return 'fragrance_invalid';
end;
$$;
revoke all on function private.free_fragrance_problem(jsonb) from public;

-- Free-fragrance preferences per device of an order line.
create table if not exists public.order_item_fragrances (
  id bigint generated always as identity primary key,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  device_no smallint not null check (device_no between 1 and 999),
  slot smallint not null check (slot in (1, 2)),
  fragrance_product_id uuid references public.products (id) on delete set null,
  name_ar text not null,
  name_en text not null,
  unique (order_item_id, device_no, slot)
);
create index if not exists order_item_fragrances_product_idx on public.order_item_fragrances (fragrance_product_id);

alter table public.order_item_fragrances enable row level security;
create policy "Customers and order staff read fragrance choices" on public.order_item_fragrances
  for select to authenticated
  using (
    exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id
            where i.id = order_item_id and o.user_id = (select auth.uid()))
    or (select private.has_permission('orders.read'))
  );

-- Saves the validated choices of every cart line against the order's lines.
-- Each device of a line gets its own numbered set of choices.
create or replace function private.save_free_fragrances(p_order uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e jsonb;
  v_item uuid;
  v_qty integer;
  v_next integer;
  v_device integer;
  v_slot integer;
  v_choice uuid;
begin
  for e in select value from jsonb_array_elements(p_items) loop
    if jsonb_array_length(coalesce(e -> 'fragrances', '[]'::jsonb)) = 0 then
      continue;
    end if;
    select i.id into v_item from public.order_items i
    where i.order_id = p_order and i.variant_id = (e ->> 'variant_id')::uuid;
    v_qty := (e ->> 'quantity')::integer;
    select coalesce(max(f.device_no), 0) into v_next from public.order_item_fragrances f where f.order_item_id = v_item;
    for v_device in 1 .. v_qty loop
      v_slot := 0;
      for v_choice in select (x)::uuid from jsonb_array_elements_text(e -> 'fragrances') x loop
        v_slot := v_slot + 1;
        insert into public.order_item_fragrances (order_item_id, device_no, slot, fragrance_product_id, name_ar, name_en)
        select v_item, v_next + v_device, v_slot, p.id, p.name_ar, p.name_en
        from public.products p where p.id = v_choice;
      end loop;
    end loop;
  end loop;
end;
$$;
revoke all on function private.save_free_fragrances(uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

create table if not exists public.site_policies (
  key text primary key check (key in ('returns', 'refunds', 'warranty', 'delivery', 'terms', 'privacy')),
  position smallint not null default 0,
  draft_title_ar text not null default '' check (char_length(draft_title_ar) <= 120),
  draft_title_en text not null default '' check (char_length(draft_title_en) <= 120),
  draft_body_ar text not null default '' check (char_length(draft_body_ar) <= 30000),
  draft_body_en text not null default '' check (char_length(draft_body_en) <= 30000),
  published_title_ar text not null default '',
  published_title_en text not null default '',
  published_body_ar text not null default '',
  published_body_en text not null default '',
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null
);
create index if not exists site_policies_draft_updated_by_idx on public.site_policies (draft_updated_by);
create index if not exists site_policies_published_by_idx on public.site_policies (published_by);

alter table public.site_policies enable row level security;
-- Drafts are visible to settings editors (owner, admin) only.
create policy "Settings editors read policies" on public.site_policies
  for select to authenticated using ((select private.has_permission('settings.write')));

create trigger site_policies_audit after insert or update on public.site_policies
  for each row execute function private.audit_row('key');

-- Published text for visitors. NULL until the owner publishes.
create or replace function public.get_policy(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'key', s.key,
    'title', jsonb_build_object('ar', s.published_title_ar, 'en', s.published_title_en),
    'body', jsonb_build_object('ar', s.published_body_ar, 'en', s.published_body_en),
    'published_at', s.published_at)
  from public.site_policies s
  where s.key = p_key and s.published_at is not null
$$;
revoke all on function public.get_policy(text) from public;
grant execute on function public.get_policy(text) to anon, authenticated, service_role;

create or replace function public.list_published_policies()
returns table (key text, title_ar text, title_en text, published_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.key, s.published_title_ar, s.published_title_en, s.published_at
  from public.site_policies s where s.published_at is not null order by s.position
$$;
revoke all on function public.list_published_policies() from public;
grant execute on function public.list_published_policies() to anon, authenticated, service_role;

create or replace function public.save_policy_draft(p_key text, p_title_ar text, p_title_en text, p_body_ar text, p_body_en text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('settings.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.site_policies
     set draft_title_ar = btrim(coalesce(p_title_ar, '')), draft_title_en = btrim(coalesce(p_title_en, '')),
         draft_body_ar = coalesce(p_body_ar, ''), draft_body_en = coalesce(p_body_en, ''),
         draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where key = p_key;
  if not found then
    raise exception 'Policy not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.save_policy_draft(text, text, text, text, text) from public, anon;
grant execute on function public.save_policy_draft(text, text, text, text, text) to authenticated;

-- Publishing copies the current draft. Both languages need a title and text.
create or replace function public.publish_policy(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  if not private.has_permission('settings.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into s from public.site_policies where key = p_key for update;
  if not found then
    raise exception 'Policy not found' using errcode = 'P0002';
  end if;
  if btrim(s.draft_title_ar) = '' or btrim(s.draft_title_en) = '' or btrim(s.draft_body_ar) = '' or btrim(s.draft_body_en) = '' then
    raise exception 'policy_incomplete' using errcode = '22023';
  end if;
  update public.site_policies
     set published_title_ar = s.draft_title_ar, published_title_en = s.draft_title_en,
         published_body_ar = s.draft_body_ar, published_body_en = s.draft_body_en,
         published_at = now(), published_by = (select auth.uid())
   where key = p_key;
end;
$$;
revoke all on function public.publish_policy(text) from public, anon;
grant execute on function public.publish_policy(text) to authenticated;

-- Takes a policy off the site (back to the built-in page).
create or replace function public.unpublish_policy(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('settings.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.site_policies set published_at = null, published_by = (select auth.uid()) where key = p_key;
end;
$$;
revoke all on function public.unpublish_policy(text) from public, anon;
grant execute on function public.unpublish_policy(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Updated functions (previous definitions plus the free-fragrance and product
-- detail steps marked "Phase 5")
-- ---------------------------------------------------------------------------

create or replace function public.save_product(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid := nullif(payload ->> 'id', '')::uuid;
  v jsonb;
  vid uuid;
  keep uuid[] := '{}';
begin
  if pid is null then
    insert into public.products (
      slug, type, name_ar, name_en, short_description_ar, short_description_en,
      description_ar, description_en, notes, specs, specs_confirmed, spaces,
      is_featured, is_new, position, seo_title_ar, seo_title_en, seo_description_ar, seo_description_en
    ) values (
      payload ->> 'slug', (payload ->> 'type')::public.product_type,
      payload ->> 'name_ar', payload ->> 'name_en',
      coalesce(payload ->> 'short_description_ar', ''), coalesce(payload ->> 'short_description_en', ''),
      coalesce(payload ->> 'description_ar', ''), coalesce(payload ->> 'description_en', ''),
      nullif(payload -> 'notes', 'null'::jsonb), coalesce(payload -> 'specs', '[]'::jsonb),
      coalesce((payload ->> 'specs_confirmed')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(payload -> 'spaces')), '{}'),
      coalesce((payload ->> 'is_featured')::boolean, false), coalesce((payload ->> 'is_new')::boolean, false),
      coalesce((payload ->> 'position')::integer, 0),
      coalesce(payload ->> 'seo_title_ar', ''), coalesce(payload ->> 'seo_title_en', ''),
      coalesce(payload ->> 'seo_description_ar', ''), coalesce(payload ->> 'seo_description_en', '')
    )
    returning id into pid;
  else
    update public.products set
      slug = payload ->> 'slug',
      type = (payload ->> 'type')::public.product_type,
      name_ar = payload ->> 'name_ar',
      name_en = payload ->> 'name_en',
      short_description_ar = coalesce(payload ->> 'short_description_ar', ''),
      short_description_en = coalesce(payload ->> 'short_description_en', ''),
      description_ar = coalesce(payload ->> 'description_ar', ''),
      description_en = coalesce(payload ->> 'description_en', ''),
      notes = nullif(payload -> 'notes', 'null'::jsonb),
      specs = coalesce(payload -> 'specs', '[]'::jsonb),
      specs_confirmed = coalesce((payload ->> 'specs_confirmed')::boolean, false),
      spaces = coalesce(array(select jsonb_array_elements_text(payload -> 'spaces')), '{}'),
      is_featured = coalesce((payload ->> 'is_featured')::boolean, false),
      is_new = coalesce((payload ->> 'is_new')::boolean, false),
      position = coalesce((payload ->> 'position')::integer, 0),
      seo_title_ar = coalesce(payload ->> 'seo_title_ar', ''),
      seo_title_en = coalesce(payload ->> 'seo_title_en', ''),
      seo_description_ar = coalesce(payload ->> 'seo_description_ar', ''),
      seo_description_en = coalesce(payload ->> 'seo_description_en', '')
    where id = pid;
    if not found then
      raise exception 'Product not found or not editable' using errcode = 'P0002';
    end if;
  end if;

  -- Phase 5: device details, information sections and free fragrances.
  update public.products set
    free_fragrances = case when type = 'diffuser' then nullif(payload ->> 'free_fragrances', '')::smallint end,
    free_fragrance_eligible = coalesce((payload ->> 'free_fragrance_eligible')::boolean, true),
    device_specs = coalesce(nullif(payload -> 'device_specs', 'null'::jsonb), '{}'::jsonb),
    info_sections = coalesce(nullif(payload -> 'info_sections', 'null'::jsonb), '{}'::jsonb)
  where id = pid;

  -- Variants: update or insert those sent, then remove the rest. Variants
  -- with stock history are deactivated instead of deleted.
  for v in select value from jsonb_array_elements(coalesce(payload -> 'variants', '[]'::jsonb)) loop
    vid := nullif(v ->> 'id', '')::uuid;
    if vid is null then
      insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils, compare_at_fils, position, is_active)
      values (
        pid, v ->> 'sku', v ->> 'label_ar', v ->> 'label_en', (v ->> 'price_fils')::integer,
        nullif(v ->> 'compare_at_fils', '')::integer, coalesce((v ->> 'position')::smallint, 0),
        coalesce((v ->> 'is_active')::boolean, true)
      )
      returning id into vid;
    else
      update public.product_variants set
        sku = v ->> 'sku',
        label_ar = v ->> 'label_ar',
        label_en = v ->> 'label_en',
        price_fils = (v ->> 'price_fils')::integer,
        compare_at_fils = nullif(v ->> 'compare_at_fils', '')::integer,
        position = coalesce((v ->> 'position')::smallint, 0),
        is_active = coalesce((v ->> 'is_active')::boolean, true)
      where id = vid and product_id = pid;
      if not found then
        raise exception 'Variant does not belong to this product' using errcode = 'P0002';
      end if;
    end if;
    keep := keep || vid;
  end loop;

  update public.product_variants pv set is_active = false
  where pv.product_id = pid and not (pv.id = any (keep))
    and exists (select 1 from public.inventory_movements m where m.variant_id = pv.id);
  delete from public.product_variants pv
  where pv.product_id = pid and not (pv.id = any (keep))
    and not exists (select 1 from public.inventory_movements m where m.variant_id = pv.id);

  delete from public.product_media where product_id = pid;
  insert into public.product_media (product_id, media_id, position)
  select pid, e.value::uuid, (e.ordinality - 1)::smallint
  from jsonb_array_elements_text(coalesce(payload -> 'media', '[]'::jsonb)) with ordinality as e (value, ordinality);

  delete from public.product_categories where product_id = pid;
  if nullif(payload ->> 'category_id', '') is not null then
    insert into public.product_categories (product_id, category_id, is_primary)
    values (pid, (payload ->> 'category_id')::uuid, true);
  end if;

  delete from public.product_scents where product_id = pid;
  insert into public.product_scents (product_id, scent_family_id, position)
  select pid, e.value::uuid, (e.ordinality - 1)::smallint
  from jsonb_array_elements_text(coalesce(payload -> 'scents', '[]'::jsonb)) with ordinality as e (value, ordinality);

  delete from public.device_compatibility where product_id = pid;
  insert into public.device_compatibility (product_id, compatible_product_id)
  select pid, e.value::uuid
  from jsonb_array_elements_text(coalesce(payload -> 'compatible', '[]'::jsonb)) as e (value)
  where e.value::uuid <> pid;

  return pid;
end;
$$;
revoke all on function public.save_product(jsonb) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated;

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
  v_fragrance text;
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
  -- Phase 5: free-fragrance choices are checked like prices: on the server.
  v_fragrance := private.free_fragrance_problem(p_items);
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
  -- Strip the country code only when it really is one: "+965…", "00965…"
  -- or an 11-digit "965…". A local number may itself start with 965.
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

  -- Phase 5: free-fragrance choices (count per device, eligibility, stock).
  v_problem := private.free_fragrance_problem(v_items);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = '22023';
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

  -- Phase 5: store each device's free-fragrance preferences.
  perform private.save_free_fragrances(v_order.id, v_items);

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
    'total_fils', o.total_fils, 'refunded_fils', o.refunded_fils, 'shipping_address', o.shipping_address,
    'placed_at', o.placed_at, 'expires_at', o.expires_at, 'tracking_number', o.tracking_number,
    'courier', o.courier, 'estimated_delivery', o.estimated_delivery,
    'delivery_instructions', o.delivery_instructions, 'has_account', o.user_id is not null,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'name', jsonb_build_object('ar', i.name_ar, 'en', i.name_en),
                'label', jsonb_build_object('ar', i.variant_label_ar, 'en', i.variant_label_en),
                'quantity', i.quantity, 'unit_price_fils', i.unit_price_fils, 'line_total_fils', i.line_total_fils,
                'free_fragrances', (select coalesce(jsonb_agg(jsonb_build_object('device', f.device_no, 'slot', f.slot,
                    'name', jsonb_build_object('ar', f.name_ar, 'en', f.name_en)) order by f.device_no, f.slot), '[]'::jsonb)
                  from public.order_item_fragrances f where f.order_item_id = i.id))
                order by i.name_en), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at)
                order by h.created_at), '[]'::jsonb)
              from public.order_status_history h where h.order_id = o.id),
    'payment_status', (select p.status from public.payments p where p.order_id = o.id
                       order by p.created_at desc limit 1)
  )
  from public.orders o
  where o.number = order_number and o.access_token = token
$$;
revoke all on function public.get_order_for_customer(bigint, uuid) from public;
grant execute on function public.get_order_for_customer(bigint, uuid) to anon, authenticated, service_role;
