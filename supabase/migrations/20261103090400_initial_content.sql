-- Rana Scent: initial, editable content.
-- Three categories, five scent families, the existing site photography (registered, not
-- moved or deleted) and the current homepage slides. Every row here is a
-- normal record the admin can edit, hide or reorder. Idempotent.

insert into public.scent_families (slug, name_ar, name_en, notes_ar, notes_en, position) values
  ('oud',    'عود',   'Oud',    'دافئ، دخاني، ملكي',   'Warm, smoky, regal',         0),
  ('musk',   'مسك',   'Musk',   'ناعم، نقي، حميم',     'Soft, clean, intimate',      1),
  ('floral', 'زهري',  'Floral', 'مشرق، رومانسي، مضيء', 'Bright, romantic, luminous', 2),
  ('fresh',  'منعش',  'Fresh',  'خفيف، منعش، مبهج',    'Light, airy, uplifting',     3),
  ('woody',  'خشبي',  'Woody',  'جاف، راسخ، هادئ',     'Dry, grounded, calm',        4)
on conflict (slug) do nothing;

-- Site photography that ships in /public/images/products. Bucket 'static'
-- assets are never deleted by the app.
insert into public.media_assets (bucket, path, mime_type, size_bytes, width, height, alt_ar, alt_en) values
  ('static', 'images/products/rana-tower.jpg',      'image/jpeg', 43921, 1600, 1600, 'رنا تاور', 'Rana Tower'),
  ('static', 'images/products/rana-majlis.jpg',     'image/jpeg', 49689, 1600, 1600, 'رنا مجلس', 'Rana Majlis'),
  ('static', 'images/products/rana-aura.jpg',       'image/jpeg', 43077, 1600, 1600, 'رنا أورا', 'Rana Aura'),
  ('static', 'images/products/rana-aura-side.jpg',  'image/jpeg', 60243, 1600, 1600, 'رنا أورا: زاوية 2', 'Rana Aura: view 2'),
  ('static', 'images/products/rana-mini.jpg',       'image/jpeg', 19131, 1600, 1600, 'رنا ميني', 'Rana Mini'),
  ('static', 'images/products/aroma-oil-500ml.jpg', 'image/jpeg', 21041, 800, 1000, 'عبوة زيت عطري 500 مل', '500 ml aroma oil refill')
on conflict (bucket, path) do nothing;

insert into public.categories (slug, product_type, name_ar, name_en, description_ar, description_en, image_id, position, is_visible, show_on_home) values
  ('diffusers', 'diffuser', 'الفواحات الإلكترونية', 'Electronic Diffusers',
   'فواحات تنشر العطر بهدوء في المجلس والبيت والسيارة.',
   'Devices that carry fragrance quietly through majlis, home and car.',
   (select id from public.media_assets where bucket = 'static' and path = 'images/products/rana-aura.jpg'),
   0, true, true),
  ('refills', 'refill', 'عبوات العطر', 'Fragrance Refills',
   'عبوات عطرية مصممة لفواحات رنا سنت.',
   'Fragrance cartridges made for Rana Scent diffusers.',
   (select id from public.media_assets where bucket = 'static' and path = 'images/products/aroma-oil-500ml.jpg'),
   1, true, true),
  ('accessories', 'accessory', 'إكسسوارات الفواحات', 'Diffuser Accessories',
   'قطع تكمل تجربة التعطير.',
   'Pieces that complete the ritual.',
   null, 2, true, true)
on conflict (slug) do nothing;

-- The homepage slides that are live today (brand copy, not merchandise).
-- The accessories slide stays disabled until accessory photography exists.
insert into public.homepage_slides (
  position, is_enabled, status, theme,
  title_ar, title_en, description_ar, description_en,
  primary_cta_label_ar, primary_cta_label_en, primary_cta_href,
  secondary_cta_label_ar, secondary_cta_label_en, secondary_cta_href,
  composition, accent, alt_ar, alt_en
)
select * from (values
  (0, true, 'published'::public.publish_status, 'light',
   'فواحات تليق ببيتك', 'Fragrance, engineered for the home',
   'فواحات إلكترونية بتصميم أنيق تنشر العطر بهدوء في المجلس والبيت.',
   'Elegant electronic diffusers that carry fragrance quietly through the majlis and every room.',
   'تسوّق الفواحات', 'Shop diffusers', '/collections/diffusers',
   'اعثر على فواحك', 'Find your diffuser', '/#find-your-diffuser',
   'diffusers', null::text, 'فواحا رنا تاور ورنا أورا', 'Rana Tower and Rana Aura diffusers'),
  (1, true, 'published'::public.publish_status, 'dark',
   'مكتبة من العطور الفاخرة', 'A library of fine fragrance',
   'عود ومسك وزهور ونفحات منعشة وخشبية: عبوات عطر لكل مزاج.',
   'Oud, musk, floral, fresh and woody: refills for every mood and every room.',
   'اكتشف العبوات', 'Explore refills', '/collections/refills',
   null, null, null,
   'refills', 'oud', 'عبوة زيت عطري من رنا سنت', 'Rana Scent aroma oil refill'),
  (2, false, 'published'::public.publish_status, 'light',
   'لمسات تكمل التجربة', 'The finishing touches',
   'إكسسوارات للفواحات تكمل حضور العطر في البيت والسيارة.',
   'Accessories that complete your diffuser, at home and on the road.',
   'تسوّق الإكسسوارات', 'Shop accessories', '/collections/accessories',
   null, null, null,
   'accessories', null, 'إكسسوارات الفواحات', 'Diffuser accessories')
) as v
where not exists (select 1 from public.homepage_slides);
