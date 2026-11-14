-- LOCAL/TEST ONLY: a small published catalogue and active delivery for
-- checkout testing. Never run against production.
do $$
declare
  p uuid;
  v uuid;
  cat uuid := (select id from public.categories where slug = 'diffusers');
  img uuid := (select id from public.media_assets where path = 'images/products/rana-aura.jpg');
begin
  if exists (select 1 from public.products where slug = 'fixture-aura') then return; end if;
  insert into public.products (slug, type, status, name_ar, name_en, short_description_ar, short_description_en, is_featured, spaces)
  values ('fixture-aura', 'diffuser', 'draft', 'رنا أورا (اختبار)', 'Rana Aura (test)', 'فواح ذكي.', 'A smart diffuser.', true, array['living'])
  returning id into p;
  insert into public.product_variants (product_id, sku, label_ar, label_en, price_fils)
  values (p, 'RS-FIXTURE-AURA', 'شامبين', 'Champagne', 29000) returning id into v;
  update public.inventory set on_hand = 25 where variant_id = v;
  insert into public.product_media (product_id, media_id, position) values (p, img, 0);
  insert into public.product_categories (product_id, category_id, is_primary) values (p, cat, true);
  update public.products set status = 'published' where id = p;
end $$;
update public.shipping_zones set is_active = true where name_en = 'All of Kuwait';
update public.shipping_rates set is_active = true, price_fils = 2000, free_over_fils = 50000 where name_en = 'Standard delivery';
update public.store_settings set cod_enabled = true, online_payments_enabled = true where id = 1;
