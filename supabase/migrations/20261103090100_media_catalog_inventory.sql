-- Rana Scent: media library, catalog and inventory.
-- Bilingual content uses paired *_ar / *_en columns. Money is integer fils.

create type public.product_type as enum ('diffuser', 'refill', 'accessory', 'bundle');
create type public.publish_status as enum ('draft', 'published', 'archived');
create type public.inventory_reason as enum (
  'initial', 'restock', 'adjustment', 'correction', 'damage', 'sale', 'return'
);

-- ---------------------------------------------------------------------------
-- Media assets
-- ---------------------------------------------------------------------------
-- bucket 'static' = files that ship with the site under /public (the existing
-- product photography). They are referenced, never deleted by the app.
-- bucket 'media'  = uploads in Supabase Storage.

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('static', 'media')),
  path text not null check (
    char_length(path) between 3 and 300
    and path !~ '(^/|\.\.|//|\\)'
    and path ~ '^[A-Za-z0-9][A-Za-z0-9/_.-]*$'
  ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 8388608),
  width integer check (width is null or width between 1 and 10000),
  height integer check (height is null or height between 1 and 10000),
  alt_ar text not null default '' check (char_length(alt_ar) <= 200),
  alt_en text not null default '' check (char_length(alt_en) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path)
);
create index media_assets_created_at_idx on public.media_assets (created_at desc);
create index media_assets_created_by_idx on public.media_assets (created_by);
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Scent families
-- ---------------------------------------------------------------------------

create table public.scent_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar text not null check (char_length(name_ar) between 1 and 60),
  name_en text not null check (char_length(name_en) between 1 and 60),
  notes_ar text not null default '' check (char_length(notes_ar) <= 120),
  notes_en text not null default '' check (char_length(notes_en) <= 120),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger scent_families_updated_at before update on public.scent_families
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  product_type public.product_type,
  name_ar text not null check (char_length(name_ar) between 1 and 80),
  name_en text not null check (char_length(name_en) between 1 and 80),
  description_ar text not null default '' check (char_length(description_ar) <= 400),
  description_en text not null default '' check (char_length(description_en) <= 400),
  image_id uuid references public.media_assets (id) on delete restrict,
  position smallint not null default 0,
  is_visible boolean not null default true,
  show_on_home boolean not null default true,
  seo_title_ar text not null default '' check (char_length(seo_title_ar) <= 70),
  seo_title_en text not null default '' check (char_length(seo_title_en) <= 70),
  seo_description_ar text not null default '' check (char_length(seo_description_ar) <= 170),
  seo_description_en text not null default '' check (char_length(seo_description_en) <= 170),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_position_idx on public.categories (position) where archived_at is null;
create index categories_image_idx on public.categories (image_id);
create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  type public.product_type not null,
  status public.publish_status not null default 'draft',
  name_ar text not null check (char_length(name_ar) between 1 and 120),
  name_en text not null check (char_length(name_en) between 1 and 120),
  short_description_ar text not null default '' check (char_length(short_description_ar) <= 200),
  short_description_en text not null default '' check (char_length(short_description_en) <= 200),
  description_ar text not null default '' check (char_length(description_ar) <= 5000),
  description_en text not null default '' check (char_length(description_en) <= 5000),
  -- { top: {ar,en}, heart: {ar,en}, base: {ar,en} } for refills.
  notes jsonb check (notes is null or jsonb_typeof(notes) = 'object'),
  -- [{ label: {ar,en}, value: {ar,en} }]; provisional until confirmed.
  specs jsonb not null default '[]' check (jsonb_typeof(specs) = 'array'),
  specs_confirmed boolean not null default false,
  spaces text[] not null default '{}'
    check (spaces <@ array['majlis', 'living', 'bedroom', 'office', 'car']::text[]),
  is_featured boolean not null default false,
  is_new boolean not null default false,
  position integer not null default 0,
  seo_title_ar text not null default '' check (char_length(seo_title_ar) <= 70),
  seo_title_en text not null default '' check (char_length(seo_title_en) <= 70),
  seo_description_ar text not null default '' check (char_length(seo_description_ar) <= 170),
  seo_description_en text not null default '' check (char_length(seo_description_en) <= 170),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_position_idx on public.products (status, position);
create index products_featured_idx on public.products (position) where is_featured and status = 'published';
create index products_type_idx on public.products (type);
create index products_created_by_idx on public.products (created_by);
create index products_updated_by_idx on public.products (updated_by);
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- Publishing needs catalog.publish; everyone else can only save drafts.
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
    new.published_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_product_status() from public;
create trigger products_guard_status before insert or update on public.products
  for each row execute function private.guard_product_status();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and char_length(sku) <= 40),
  label_ar text not null check (char_length(label_ar) between 1 and 60),
  label_en text not null check (char_length(label_en) between 1 and 60),
  price_fils integer not null check (price_fils between 0 and 100000000),
  compare_at_fils integer check (compare_at_fils is null or compare_at_fils > price_fils),
  position smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, position);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function private.set_updated_at();

create table public.product_media (
  product_id uuid not null references public.products (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete restrict,
  position smallint not null default 0,
  primary key (product_id, media_id)
);
create index product_media_media_idx on public.product_media (media_id);

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);
create unique index product_categories_one_primary on public.product_categories (product_id) where is_primary;

create table public.product_scents (
  product_id uuid not null references public.products (id) on delete cascade,
  scent_family_id uuid not null references public.scent_families (id) on delete cascade,
  position smallint not null default 0,
  primary key (product_id, scent_family_id)
);
create index product_scents_family_idx on public.product_scents (scent_family_id);

-- Directed "works with" links: refill → device, accessory → device. The
-- storefront reads them in both directions.
create table public.device_compatibility (
  product_id uuid not null references public.products (id) on delete cascade,
  compatible_product_id uuid not null references public.products (id) on delete cascade,
  primary key (product_id, compatible_product_id),
  check (product_id <> compatible_product_id)
);
create index device_compatibility_target_idx on public.device_compatibility (compatible_product_id);

create table public.bundle_items (
  bundle_id uuid not null references public.products (id) on delete cascade,
  item_product_id uuid not null references public.products (id) on delete restrict,
  quantity smallint not null default 1 check (quantity between 1 and 50),
  position smallint not null default 0,
  primary key (bundle_id, item_product_id),
  check (bundle_id <> item_product_id)
);
create index bundle_items_item_idx on public.bundle_items (item_product_id);

-- ---------------------------------------------------------------------------
-- Inventory (variant level)
-- ---------------------------------------------------------------------------

create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  on_hand integer not null default 0 check (on_hand >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold between 0 and 100000),
  track_inventory boolean not null default true,
  updated_at timestamptz not null default now()
);
create index inventory_low_stock_idx on public.inventory (on_hand) where track_inventory;
create trigger inventory_updated_at before update on public.inventory
  for each row execute function private.set_updated_at();

-- Movement history is kept: a variant with history is deactivated, not deleted.
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity_change integer not null check (quantity_change <> 0),
  quantity_after integer not null check (quantity_after >= 0),
  reason public.inventory_reason not null,
  note text not null default '' check (char_length(note) <= 300),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_created_idx on public.inventory_movements (created_at desc);
create index inventory_movements_actor_idx on public.inventory_movements (actor_id);

-- Every variant gets an inventory row at zero.
create or replace function private.create_inventory_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (variant_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;
revoke all on function private.create_inventory_row() from public;
create trigger product_variants_inventory after insert on public.product_variants
  for each row execute function private.create_inventory_row();

-- Atomic stock adjustment: one row-locking UPDATE (which refuses to go below
-- zero) plus an append-only movement record with actor, change, reason and
-- time. This is the only client path that changes stock.
create or replace function public.adjust_inventory(
  target_variant uuid,
  quantity_change integer,
  reason public.inventory_reason,
  note text default ''
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_on_hand integer;
begin
  if not private.has_permission('inventory.adjust') then
    raise exception 'Adjusting stock requires the inventory.adjust permission' using errcode = '42501';
  end if;
  if quantity_change is null or quantity_change = 0 then
    raise exception 'Quantity change must be a non-zero whole number' using errcode = '22023';
  end if;
  if reason in ('sale', 'return') then
    raise exception 'Sales and returns are recorded by orders, not manual adjustments' using errcode = '22023';
  end if;
  if char_length(coalesce(note, '')) > 300 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  update public.inventory
     set on_hand = on_hand + quantity_change
   where variant_id = target_variant
     and on_hand + quantity_change >= 0
  returning on_hand into new_on_hand;

  if new_on_hand is null then
    if not exists (select 1 from public.inventory where variant_id = target_variant) then
      raise exception 'Variant not found' using errcode = 'P0002';
    end if;
    raise exception 'Stock cannot go below zero' using errcode = '23514';
  end if;

  insert into public.inventory_movements (variant_id, quantity_change, quantity_after, reason, note, actor_id)
  values (target_variant, quantity_change, new_on_hand, reason, coalesce(note, ''), (select auth.uid()));

  return new_on_hand;
end;
$$;
revoke all on function public.adjust_inventory(uuid, integer, public.inventory_reason, text) from public, anon;
grant execute on function public.adjust_inventory(uuid, integer, public.inventory_reason, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public visibility helpers (used by RLS)
-- ---------------------------------------------------------------------------

create or replace function private.product_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.products where id = target and status = 'published')
$$;
revoke all on function private.product_is_public(uuid) from public;
grant execute on function private.product_is_public(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.media_assets enable row level security;
alter table public.scent_families enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_scents enable row level security;
alter table public.device_compatibility enable row level security;
alter table public.bundle_items enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;

-- Scent families: public reference data.
create policy "Anyone reads scent families" on public.scent_families
  for select to anon, authenticated using (true);
create policy "Catalog writers manage scent families" on public.scent_families
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

-- Categories: visible ones are public; staff see everything.
create policy "Public reads visible categories" on public.categories
  for select to anon, authenticated
  using ((is_visible and archived_at is null) or (select private.has_permission('catalog.read')));
create policy "Catalog writers insert categories" on public.categories
  for insert to authenticated with check ((select private.has_permission('catalog.write')));
create policy "Catalog writers update categories" on public.categories
  for update to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));
create policy "Publishers delete categories" on public.categories
  for delete to authenticated using ((select private.has_permission('catalog.publish')));

-- Products: published ones are public; drafts and archive are staff-only.
create policy "Public reads published products" on public.products
  for select to anon, authenticated
  using (status = 'published' or (select private.has_permission('catalog.read')));
create policy "Catalog writers insert products" on public.products
  for insert to authenticated with check ((select private.has_permission('catalog.write')));
create policy "Catalog writers update products" on public.products
  for update to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));
create policy "Publishers delete unpublished products" on public.products
  for delete to authenticated
  using (status <> 'published' and (select private.has_permission('catalog.publish')));

-- Child tables follow their product's visibility.
create policy "Public reads variants of published products" on public.product_variants
  for select to anon, authenticated
  using ((is_active and private.product_is_public(product_id)) or (select private.has_permission('catalog.read')));
create policy "Catalog writers manage variants" on public.product_variants
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

create policy "Public reads media of published products" on public.product_media
  for select to anon, authenticated
  using (private.product_is_public(product_id) or (select private.has_permission('catalog.read')));
create policy "Catalog writers manage product media" on public.product_media
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

create policy "Public reads categories of published products" on public.product_categories
  for select to anon, authenticated
  using (private.product_is_public(product_id) or (select private.has_permission('catalog.read')));
create policy "Catalog writers manage product categories" on public.product_categories
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

create policy "Public reads scents of published products" on public.product_scents
  for select to anon, authenticated
  using (private.product_is_public(product_id) or (select private.has_permission('catalog.read')));
create policy "Catalog writers manage product scents" on public.product_scents
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

create policy "Public reads compatibility of published products" on public.device_compatibility
  for select to anon, authenticated
  using (
    (private.product_is_public(product_id) and private.product_is_public(compatible_product_id))
    or (select private.has_permission('catalog.read'))
  );
create policy "Catalog writers manage compatibility" on public.device_compatibility
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

create policy "Public reads bundle items of published products" on public.bundle_items
  for select to anon, authenticated
  using (
    (private.product_is_public(bundle_id) and private.product_is_public(item_product_id))
    or (select private.has_permission('catalog.read'))
  );
create policy "Catalog writers manage bundle items" on public.bundle_items
  for all to authenticated
  using ((select private.has_permission('catalog.write')))
  with check ((select private.has_permission('catalog.write')));

-- Inventory: the storefront shows availability for published products.
-- Stock only changes through adjust_inventory(); thresholds are editable by
-- inventory.adjust (column-level grant below).
create policy "Public reads stock of published products" on public.inventory
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.product_variants v
      where v.id = variant_id and v.is_active and private.product_is_public(v.product_id)
    )
    or (select private.has_permission('inventory.read'))
  );
create policy "Inventory adjusters edit thresholds" on public.inventory
  for update to authenticated
  using ((select private.has_permission('inventory.adjust')))
  with check ((select private.has_permission('inventory.adjust')));
revoke insert, update, delete, truncate on public.inventory from anon, authenticated;
grant update (low_stock_threshold, track_inventory) on public.inventory to authenticated;

create policy "Staff read inventory movements" on public.inventory_movements
  for select to authenticated using ((select private.has_permission('inventory.read')));
revoke all on public.inventory_movements from anon;
revoke insert, update, delete, truncate on public.inventory_movements from authenticated;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row();
create trigger products_audit after insert or update or delete on public.products
  for each row execute function private.audit_row();
create trigger product_variants_audit after insert or update or delete on public.product_variants
  for each row execute function private.audit_row();
create trigger media_assets_audit after insert or update or delete on public.media_assets
  for each row execute function private.audit_row();
create trigger inventory_audit after update on public.inventory
  for each row execute function private.audit_row('variant_id');
