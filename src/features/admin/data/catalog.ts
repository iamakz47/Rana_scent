import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ProductStatus = Database["public"]["Enums"]["publish_status"];
export type ProductType = Database["public"]["Enums"]["product_type"];
export type MediaAsset = Pick<
  Database["public"]["Tables"]["media_assets"]["Row"],
  "id" | "bucket" | "path" | "alt_ar" | "alt_en" | "width" | "height"
>;

const mediaColumns = "id, bucket, path, alt_ar, alt_en, width, height";

export async function listAdminProducts(status?: ProductStatus) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      `id, slug, type, status, name_ar, name_en, is_featured, position, updated_at,
       product_variants(id, price_fils, is_active, inventory(on_hand)),
       product_media(position, media_assets(${mediaColumns}))`,
    )
    .order("position")
    .order("created_at");
  query = status ? query.eq("status", status) : query.neq("status", "archived");
  const { data, error } = await query;
  if (error) throw error;
  return data.map((product) => {
    const variants = product.product_variants.filter((v) => v.is_active);
    const prices = variants.map((v) => v.price_fils);
    const cover = [...product.product_media].sort((a, b) => a.position - b.position)[0]?.media_assets ?? null;
    return {
      id: product.id,
      slug: product.slug,
      type: product.type,
      status: product.status,
      name: { ar: product.name_ar, en: product.name_en },
      featured: product.is_featured,
      updatedAt: product.updated_at,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      stock: variants.reduce((total, v) => total + (v.inventory?.on_hand ?? 0), 0),
      variantCount: variants.length,
      cover,
    };
  });
}

export async function getAdminProduct(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `*, product_variants(*, inventory(on_hand)),
       product_media(position, media_assets(${mediaColumns})),
       product_categories(category_id, is_primary),
       product_scents(scent_family_id, position),
       device_compatibility!device_compatibility_product_id_fkey(compatible_product_id)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProductFormOptions(excludeId?: string) {
  const supabase = await createClient();
  const [categories, scents, products, media] = await Promise.all([
    supabase.from("categories").select("id, name_ar, name_en, product_type").is("archived_at", null).order("position"),
    supabase.from("scent_families").select("id, slug, name_ar, name_en").order("position"),
    supabase.from("products").select("id, name_ar, name_en, type").neq("status", "archived").order("position"),
    supabase.from("media_assets").select(mediaColumns).order("created_at", { ascending: false }).limit(200),
  ]);
  return {
    categories: categories.data ?? [],
    scents: scents.data ?? [],
    products: (products.data ?? []).filter((p) => p.id !== excludeId),
    media: media.data ?? [],
  };
}

export async function listAdminCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(`*, media_assets(${mediaColumns}), product_categories(count)`)
    .order("archived_at", { nullsFirst: true })
    .order("position");
  if (error) throw error;
  return data;
}
