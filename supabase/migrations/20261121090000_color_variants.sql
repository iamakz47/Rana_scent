-- Phase 6: colour variants.
--
-- A colour is an ordinary product variant (its own SKU, price, stock and
-- availability) with an optional swatch colour. Photos can belong to one
-- colour; photos without a colour are shared by every colour.
-- Additive only: existing variants, photos, stock and orders are untouched.

alter table public.product_variants
  add column if not exists color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');

alter table public.product_media
  add column if not exists variant_id uuid references public.product_variants (id) on delete set null;
create index if not exists product_media_variant_idx on public.product_media (variant_id);

-- save_product: also stores colour swatches and photo-to-colour links, and
-- accepts "0" free fragrances (none). Otherwise identical to the Phase 5 version.
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
    free_fragrances = case when type = 'diffuser' then nullif(nullif(payload ->> 'free_fragrances', ''), '0')::smallint end,
    free_fragrance_eligible = coalesce((payload ->> 'free_fragrance_eligible')::boolean, true),
    device_specs = coalesce(nullif(payload -> 'device_specs', 'null'::jsonb), '{}'::jsonb),
    info_sections = coalesce(nullif(payload -> 'info_sections', 'null'::jsonb), '{}'::jsonb)
  where id = pid;

  -- Variants: update or insert those sent, then remove the rest. Variants
  -- with stock history are deactivated instead of deleted.
  for v in select value from jsonb_array_elements(coalesce(payload -> 'variants', '[]'::jsonb)) loop
    vid := nullif(v ->> 'id', '')::uuid;
    if vid is null then
      insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils, compare_at_fils, position, is_active, color_hex)
      values (
        pid, v ->> 'sku', v ->> 'label_ar', v ->> 'label_en', (v ->> 'price_fils')::integer,
        nullif(v ->> 'compare_at_fils', '')::integer, coalesce((v ->> 'position')::smallint, 0),
        coalesce((v ->> 'is_active')::boolean, true), nullif(v ->> 'color_hex', '')
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
        is_active = coalesce((v ->> 'is_active')::boolean, true),
        color_hex = nullif(v ->> 'color_hex', '')
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

  -- Phase 6: photos that belong to one colour (variant), matched by SKU so
  -- colours created in this same save can be referenced.
  update public.product_media pm set variant_id = pv.id
  from jsonb_array_elements(coalesce(payload -> 'media_variants', '[]'::jsonb)) as e (value)
  join public.product_variants pv on pv.product_id = pid and pv.sku = upper(e.value ->> 'variant_sku')
  where pm.product_id = pid and pm.media_id = (e.value ->> 'media_id')::uuid;

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
