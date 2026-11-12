-- Rana Scent: homepage content, store settings and the media Storage bucket.

-- ---------------------------------------------------------------------------
-- Store settings (single row)
-- ---------------------------------------------------------------------------

create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  slider_autoplay boolean not null default true,
  -- Seconds each hero slide stays on screen. Read by the storefront.
  slider_interval_seconds smallint not null default 4 check (slider_interval_seconds between 2 and 30),
  default_low_stock_threshold integer not null default 5 check (default_low_stock_threshold between 0 and 100000),
  currency text not null default 'KWD' check (currency = 'KWD'),
  contact_email text not null default '' check (contact_email = '' or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text not null default '' check (contact_phone = '' or contact_phone ~ '^\+?[0-9 ]{7,20}$'),
  whatsapp_number text not null default '' check (whatsapp_number = '' or whatsapp_number ~ '^\+?[0-9 ]{7,20}$'),
  instagram_handle text not null default '' check (instagram_handle = '' or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function private.set_updated_at();

insert into public.store_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Homepage slides
-- ---------------------------------------------------------------------------

create table public.homepage_slides (
  id uuid primary key default gen_random_uuid(),
  position smallint not null default 0,
  is_enabled boolean not null default true,
  status public.publish_status not null default 'draft',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  title_ar text not null check (char_length(title_ar) between 1 and 90),
  title_en text not null check (char_length(title_en) between 1 and 90),
  description_ar text not null default '' check (char_length(description_ar) <= 240),
  description_en text not null default '' check (char_length(description_en) <= 240),
  primary_cta_label_ar text not null check (char_length(primary_cta_label_ar) between 1 and 32),
  primary_cta_label_en text not null check (char_length(primary_cta_label_en) between 1 and 32),
  -- Internal, locale-less paths only ("/collections/refills"): never an
  -- external or protocol-relative URL, so a slide cannot become an open redirect.
  primary_cta_href text not null check (primary_cta_href ~ '^/(?!/)[A-Za-z0-9\-._~/?=&#%]*$'),
  secondary_cta_label_ar text check (secondary_cta_label_ar is null or char_length(secondary_cta_label_ar) between 1 and 32),
  secondary_cta_label_en text check (secondary_cta_label_en is null or char_length(secondary_cta_label_en) between 1 and 32),
  secondary_cta_href text check (secondary_cta_href is null or secondary_cta_href ~ '^/(?!/)[A-Za-z0-9\-._~/?=&#%]*$'),
  desktop_media_id uuid references public.media_assets (id) on delete restrict,
  mobile_media_id uuid references public.media_assets (id) on delete restrict,
  -- Built-in photo composition used when no banner image is set.
  composition text check (composition is null or composition in ('diffusers', 'refills', 'accessories')),
  accent text check (accent is null or accent in ('oud', 'musk', 'floral', 'fresh', 'woody')),
  alt_ar text not null default '' check (char_length(alt_ar) <= 160),
  alt_en text not null default '' check (char_length(alt_en) <= 160),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (secondary_cta_href is null and secondary_cta_label_ar is null and secondary_cta_label_en is null)
    or (secondary_cta_href is not null and secondary_cta_label_ar is not null and secondary_cta_label_en is not null)
  ),
  check (composition is not null or desktop_media_id is not null)
);
create index homepage_slides_position_idx on public.homepage_slides (position);
create index homepage_slides_desktop_media_idx on public.homepage_slides (desktop_media_id);
create index homepage_slides_mobile_media_idx on public.homepage_slides (mobile_media_id);
create trigger homepage_slides_updated_at before update on public.homepage_slides
  for each row execute function private.set_updated_at();

create or replace function private.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger homepage_slides_published_at before insert or update on public.homepage_slides
  for each row execute function private.stamp_published_at();

-- ---------------------------------------------------------------------------
-- Homepage sections: visibility, order and optional copy overrides
-- ---------------------------------------------------------------------------

create table public.homepage_sections (
  key text primary key check (key in (
    'categories', 'featured', 'collections', 'scent_library', 'story', 'finder', 'sets'
  )),
  position smallint not null default 0,
  is_visible boolean not null default true,
  -- Optional overrides; empty means "use the built-in copy".
  title_ar text not null default '' check (char_length(title_ar) <= 90),
  title_en text not null default '' check (char_length(title_en) <= 90),
  body_ar text not null default '' check (char_length(body_ar) <= 300),
  body_en text not null default '' check (char_length(body_en) <= 300),
  updated_at timestamptz not null default now()
);
create trigger homepage_sections_updated_at before update on public.homepage_sections
  for each row execute function private.set_updated_at();

insert into public.homepage_sections (key, position) values
  ('categories', 0), ('featured', 1), ('collections', 2), ('scent_library', 3),
  ('story', 4), ('finder', 5), ('sets', 6);

-- ---------------------------------------------------------------------------
-- Media visibility: an asset is public when something public uses it.
-- ---------------------------------------------------------------------------

create or replace function private.media_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.product_media pm
      join public.products p on p.id = pm.product_id
      where pm.media_id = target and p.status = 'published'
    )
    or exists (
      select 1 from public.categories c
      where c.image_id = target and c.is_visible and c.archived_at is null
    )
    or exists (
      select 1 from public.homepage_slides s
      where (s.desktop_media_id = target or s.mobile_media_id = target)
        and s.status = 'published' and s.is_enabled
    )
$$;
revoke all on function private.media_is_public(uuid) from public;
grant execute on function private.media_is_public(uuid) to anon, authenticated, service_role;

-- Where an asset is used (admin "in use" badges and the delete check).
create or replace function public.media_usage(target uuid)
returns table (kind text, ref_id uuid, label text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.has_permission('media.write') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select 'product'::text, p.id, p.name_en from public.product_media pm
      join public.products p on p.id = pm.product_id where pm.media_id = target
    union all
    select 'category', c.id, c.name_en from public.categories c where c.image_id = target
    union all
    select 'slide', s.id, s.title_en from public.homepage_slides s
      where s.desktop_media_id = target or s.mobile_media_id = target;
end;
$$;
revoke all on function public.media_usage(uuid) from public, anon;
grant execute on function public.media_usage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.store_settings enable row level security;
alter table public.homepage_slides enable row level security;
alter table public.homepage_sections enable row level security;

create policy "Anyone reads store settings" on public.store_settings
  for select to anon, authenticated using (true);
-- Slider settings are content; the rest of the row is settings. Both roles
-- that may edit get the update policy; the trigger below narrows columns.
create policy "Content or settings editors update settings" on public.store_settings
  for update to authenticated
  using ((select private.has_permission('content.write')) or (select private.has_permission('settings.write')))
  with check ((select private.has_permission('content.write')) or (select private.has_permission('settings.write')));
revoke insert, delete, truncate on public.store_settings from anon, authenticated;

create or replace function private.guard_store_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  new.updated_by := (select auth.uid());
  if not private.has_permission('settings.write') and (
       new.default_low_stock_threshold is distinct from old.default_low_stock_threshold
    or new.contact_email is distinct from old.contact_email
    or new.contact_phone is distinct from old.contact_phone
    or new.whatsapp_number is distinct from old.whatsapp_number
    or new.instagram_handle is distinct from old.instagram_handle
  ) then
    raise exception 'Changing store settings requires settings.write' using errcode = '42501';
  end if;
  if not private.has_permission('content.write') and (
       new.slider_autoplay is distinct from old.slider_autoplay
    or new.slider_interval_seconds is distinct from old.slider_interval_seconds
  ) then
    raise exception 'Changing slider settings requires content.write' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_store_settings() from public;
create trigger store_settings_guard before update on public.store_settings
  for each row execute function private.guard_store_settings();

create policy "Public reads live slides" on public.homepage_slides
  for select to anon, authenticated
  using ((status = 'published' and is_enabled) or (select private.has_permission('content.write')));
create policy "Content editors insert slides" on public.homepage_slides
  for insert to authenticated with check ((select private.has_permission('content.write')));
create policy "Content editors update slides" on public.homepage_slides
  for update to authenticated
  using ((select private.has_permission('content.write')))
  with check ((select private.has_permission('content.write')));
create policy "Content editors delete slides" on public.homepage_slides
  for delete to authenticated using ((select private.has_permission('content.write')));

create policy "Anyone reads homepage sections" on public.homepage_sections
  for select to anon, authenticated using (true);
create policy "Content editors update sections" on public.homepage_sections
  for update to authenticated
  using ((select private.has_permission('content.write')))
  with check ((select private.has_permission('content.write')));
revoke insert, delete, truncate on public.homepage_sections from anon, authenticated;

-- Media assets: public when used by something public; staff with media,
-- catalog or content access see the library.
create policy "Public reads media in use" on public.media_assets
  for select to anon, authenticated
  using (
    private.media_is_public(id)
    or (select private.has_permission('media.write'))
    or (select private.has_permission('catalog.read'))
    or (select private.has_permission('content.write'))
  );
create policy "Media editors insert uploads" on public.media_assets
  for insert to authenticated
  with check (bucket = 'media' and (select private.has_permission('media.write')));
create policy "Media editors update assets" on public.media_assets
  for update to authenticated
  using ((select private.has_permission('media.write')))
  with check ((select private.has_permission('media.write')));
-- Site photography (bucket 'static') can never be deleted from the app.
create policy "Media editors delete uploads" on public.media_assets
  for delete to authenticated
  using (bucket = 'media' and (select private.has_permission('media.write')));

create or replace function private.guard_media_assets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.created_by := (select auth.uid());
    else
      -- The bucket never changes and site photography is fixed. An upload
      -- may be replaced (new file at a new path, same asset id), so every
      -- product, category and slide using it updates at once.
      new.bucket := old.bucket;
      if old.bucket = 'static' then
        new.path := old.path;
        new.mime_type := old.mime_type;
        new.size_bytes := old.size_bytes;
        new.width := old.width;
        new.height := old.height;
      end if;
      new.created_by := old.created_by;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_media_assets() from public;
create trigger media_assets_guard before insert or update on public.media_assets
  for each row execute function private.guard_media_assets();

create trigger store_settings_audit after update on public.store_settings
  for each row execute function private.audit_row();
create trigger homepage_slides_audit after insert or update or delete on public.homepage_slides
  for each row execute function private.audit_row();
create trigger homepage_sections_audit after update on public.homepage_sections
  for each row execute function private.audit_row('key');

-- ---------------------------------------------------------------------------
-- Storage bucket for uploads
-- ---------------------------------------------------------------------------
-- Public read (these images appear on the storefront); listing and every
-- write require media.write. Paths are generated server-side as
-- <folder>/<uuid>.<ext> and constrained here too.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Media editors list media objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select private.has_permission('media.write')));
create policy "Media editors upload media objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select private.has_permission('media.write'))
    and name ~ '^(products|categories|hero|library)/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$'
  );
create policy "Media editors update media objects" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select private.has_permission('media.write')))
  with check (
    bucket_id = 'media'
    and (select private.has_permission('media.write'))
    and name ~ '^(products|categories|hero|library)/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$'
  );
create policy "Media editors delete media objects" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select private.has_permission('media.write')));
