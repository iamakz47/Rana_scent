-- Rana Scent: DRAFT products for the items that have real photography.
-- They are created with status 'draft' (invisible to shoppers), zero stock
-- and unconfirmed specifications. Names and prices are the provisional
-- values from the Phase 1 preview: Rana Scent must review, correct and
-- publish each one from the admin. Nothing here is published.
-- Idempotent: skipped entirely if any product already exists.

do $$
declare
  p uuid;
  cat_diffusers uuid := (select id from public.categories where slug = 'diffusers');
  cat_refills uuid := (select id from public.categories where slug = 'refills');
  devices uuid[] := '{}';
  spec_note constant text := 'Provisional, to be confirmed by Rana Scent';
begin
  if exists (select 1 from public.products) then
    return;
  end if;

  -- Rana Tower
  insert into public.products (slug, type, status, name_ar, name_en, short_description_ar, short_description_en,
    description_ar, description_en, spaces, specs, position)
  values ('rana-tower', 'diffuser', 'draft', 'رنا تاور', 'Rana Tower',
    'حضور عطري يملأ المكان.', 'A presence that fills the room.',
    'فواح أرضي بتصميم عمودي من الأسود اللامع والبرونز، للمجالس والصالات الواسعة.',
    'A floor-standing tower in gloss black and bronze, for majlis and generous halls.',
    array['majlis', 'living', 'office'],
    jsonb_build_array(
      jsonb_build_object('label', jsonb_build_object('ar', 'النوع', 'en', 'Type'), 'value', jsonb_build_object('ar', 'فواح أرضي', 'en', 'Floor-standing diffuser')),
      jsonb_build_object('label', jsonb_build_object('ar', 'اللون', 'en', 'Finish'), 'value', jsonb_build_object('ar', 'أسود لامع مع جوانب برونزية', 'en', 'Gloss black with bronze sides'))
    ), 0)
  returning id into p;
  devices := devices || p;
  insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils)
  values (p, 'RS-DEV-TOWER-BRZ', 'أسود وبرونز', 'Black & bronze', 119000);
  insert into public.product_media (product_id, media_id, position)
  select p, id, 0 from public.media_assets where bucket = 'static' and path = 'images/products/rana-tower.jpg';
  insert into public.product_categories (product_id, category_id, is_primary) values (p, cat_diffusers, true);

  -- Rana Majlis
  insert into public.products (slug, type, status, name_ar, name_en, short_description_ar, short_description_en,
    description_ar, description_en, spaces, position)
  values ('rana-majlis', 'diffuser', 'draft', 'رنا مجلس', 'Rana Majlis',
    'تحكم كامل بأجواء المجلس.', 'Complete control of the majlis atmosphere.',
    'فواح للمساحات الكبيرة بواجهة زجاجية سوداء وشاشة لبرمجة أوقات التعطير.',
    'A large-space diffuser with a black glass face and a display for scheduling.',
    array['majlis', 'office', 'living'], 1)
  returning id into p;
  devices := devices || p;
  insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils)
  values (p, 'RS-DEV-MAJLIS-BLK', 'أسود', 'Black', 79000);
  insert into public.product_media (product_id, media_id, position)
  select p, id, 0 from public.media_assets where bucket = 'static' and path = 'images/products/rana-majlis.jpg';
  insert into public.product_categories (product_id, category_id, is_primary) values (p, cat_diffusers, true);

  -- Rana Aura
  insert into public.products (slug, type, status, name_ar, name_en, short_description_ar, short_description_en,
    description_ar, description_en, spaces, position)
  values ('rana-aura', 'diffuser', 'draft', 'رنا أورا', 'Rana Aura',
    'ذكاء العطر في كل غرفة.', 'Smart fragrance, room by room.',
    'فواح يُركّب في مقبس الكهرباء بلوحة لمس لضبط شدة العطر وأوضاع النهار والليل.',
    'A plug-in diffuser with a touch panel for intensity and day and night modes.',
    array['living', 'bedroom', 'office'], 2)
  returning id into p;
  devices := devices || p;
  insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils)
  values (p, 'RS-DEV-AURA-CHP', 'شامبين', 'Champagne', 29000);
  insert into public.product_media (product_id, media_id, position)
  select p, id, case path when 'images/products/rana-aura.jpg' then 0 else 1 end
  from public.media_assets
  where bucket = 'static' and path in ('images/products/rana-aura.jpg', 'images/products/rana-aura-side.jpg');
  insert into public.product_categories (product_id, category_id, is_primary) values (p, cat_diffusers, true);

  -- Rana Mini
  insert into public.products (slug, type, status, name_ar, name_en, short_description_ar, short_description_en,
    description_ar, description_en, spaces, position)
  values ('rana-mini', 'diffuser', 'draft', 'رنا ميني', 'Rana Mini',
    'عطر هادئ للمساحات الصغيرة.', 'Quiet fragrance for smaller spaces.',
    'فواح أبيض صغير يُركّب مباشرة في مقبس الكهرباء، لغرف النوم والمكاتب.',
    'A compact white diffuser that plugs straight into the wall, for bedrooms and studies.',
    array['bedroom', 'office'], 3)
  returning id into p;
  devices := devices || p;
  insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils)
  values (p, 'RS-DEV-MINI-WHT', 'أبيض', 'White', 15000);
  insert into public.product_media (product_id, media_id, position)
  select p, id, 0 from public.media_assets where bucket = 'static' and path = 'images/products/rana-mini.jpg';
  insert into public.product_categories (product_id, category_id, is_primary) values (p, cat_diffusers, true);

  -- Aroma Oil refill (the photographed 500 ml bottle)
  insert into public.products (slug, type, status, name_ar, name_en, short_description_ar, short_description_en,
    description_ar, description_en, spaces, position)
  values ('aroma-oil', 'refill', 'draft', 'زيت عطري', 'Aroma Oil',
    'زيت عطري لفواحات رنا سنت.', 'Aroma oil made for Rana Scent diffusers.',
    'زيت عطري مصمم لفواحات رنا سنت.', 'Aroma oil made for Rana Scent diffusers.',
    array['majlis', 'living', 'bedroom', 'office', 'car'], 4)
  returning id into p;
  insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils)
  values (p, 'RS-OIL-500', '500 مل', '500 ml', 29000);
  insert into public.product_media (product_id, media_id, position)
  select p, id, 0 from public.media_assets where bucket = 'static' and path = 'images/products/aroma-oil-500ml.jpg';
  insert into public.product_categories (product_id, category_id, is_primary) values (p, cat_refills, true);
  insert into public.device_compatibility (product_id, compatible_product_id)
  select p, d from unnest(devices) as d;

  raise notice '%: 5 draft products created with zero stock', spec_note;
end;
$$;
