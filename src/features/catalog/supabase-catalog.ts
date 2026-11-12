import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { mediaUrl } from "@/features/media/url";
import { CATALOG_TAG } from "./cache-tags";
import {
  scentFamilies,
  spaces as allSpaces,
  type Category,
  type Product,
  type ScentFamily,
  type Space,
} from "./types";

// Published catalog read from Supabase with the anonymous key, so RLS limits
// it to what shoppers may see. Cached across requests and refreshed by the
// admin through updateTag(CATALOG_TAG).

type Pair = { ar?: string; en?: string };
const pair = (value: Pair | undefined) => ({ ar: value?.ar ?? "", en: value?.en ?? "" });

export type CatalogData = { products: Product[]; categories: Category[] };

export async function loadSupabaseCatalog(): Promise<CatalogData> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  const [products, categories, compat, bundles] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, slug, type, name_ar, name_en, short_description_ar, short_description_en, description_ar, description_en,
         notes, specs, specs_confirmed, spaces, is_featured, is_new, position, published_at,
         product_variants(id, sku, label_ar, label_en, price_fils, compare_at_fils, position, is_active, inventory(on_hand)),
         product_media(position, media_assets(bucket, path, alt_ar, alt_en)),
         product_scents(position, scent_families(slug)),
         product_categories(is_primary, categories(slug))`,
      )
      .eq("status", "published")
      .order("position")
      .order("published_at"),
    supabase
      .from("categories")
      .select("slug, product_type, name_ar, name_en, description_ar, description_en, position, is_visible, show_on_home, media_assets(bucket, path, alt_ar, alt_en)")
      .eq("is_visible", true)
      .is("archived_at", null)
      .order("position"),
    supabase.from("device_compatibility").select("source:products!device_compatibility_product_id_fkey(slug), target:products!device_compatibility_compatible_product_id_fkey(slug)"),
    supabase.from("bundle_items").select("quantity, position, bundle:products!bundle_items_bundle_id_fkey(slug), item:products!bundle_items_item_product_id_fkey(slug)"),
  ]);

  // An error (for example, migrations not applied yet) yields an empty
  // catalog: never a fallback to sample merchandise.
  if (products.error || categories.error) {
    console.error("Supabase catalog unavailable", products.error?.message ?? categories.error?.message);
    return { products: [], categories: [] };
  }

  const links = new Map<string, Set<string>>();
  const link = (from?: string, to?: string) => {
    if (!from || !to) return;
    links.set(from, (links.get(from) ?? new Set()).add(to));
  };
  for (const row of compat.data ?? []) {
    link(row.source?.slug, row.target?.slug);
    link(row.target?.slug, row.source?.slug);
  }
  const contents = new Map<string, Array<{ slug: string; quantity: number; position: number }>>();
  for (const row of bundles.data ?? []) {
    if (!row.bundle?.slug || !row.item?.slug) continue;
    contents.set(row.bundle.slug, [...(contents.get(row.bundle.slug) ?? []), { slug: row.item.slug, quantity: row.quantity, position: row.position }]);
  }

  const mapped: Product[] = products.data.map((row) => {
    const notes = row.notes as { top?: Pair; heart?: Pair; base?: Pair } | null;
    const family = [...row.product_scents]
      .sort((a, b) => a.position - b.position)
      .map((s) => s.scent_families?.slug)
      .find((slug): slug is ScentFamily => (scentFamilies as readonly string[]).includes(slug ?? ""));
    const specs = Array.isArray(row.specs) ? (row.specs as Array<{ label?: Pair; value?: Pair }>) : [];
    return {
      id: row.id,
      slug: row.slug,
      type: row.type,
      name: { ar: row.name_ar, en: row.name_en },
      tagline: { ar: row.short_description_ar, en: row.short_description_en },
      description: { ar: row.description_ar, en: row.description_en },
      scentFamily: family,
      notes: notes ? { top: pair(notes.top), heart: pair(notes.heart), base: pair(notes.base) } : undefined,
      bundleContents: contents
        .get(row.slug)
        ?.sort((a, b) => a.position - b.position)
        .map(({ slug, quantity }) => ({ slug, quantity })),
      specs: specs.map((s) => ({ label: pair(s.label), value: pair(s.value) })),
      specsConfirmed: row.specs_confirmed,
      compatibleWith: [...(links.get(row.slug) ?? [])],
      spaces: row.spaces.filter((s): s is Space => (allSpaces as readonly string[]).includes(s)),
      categories: row.product_categories.map((c) => c.categories?.slug).filter((s): s is string => Boolean(s)),
      images: [...row.product_media]
        .sort((a, b) => a.position - b.position)
        .filter((m) => m.media_assets)
        .map((m) => ({
          src: mediaUrl(m.media_assets!),
          alt: { ar: m.media_assets!.alt_ar || row.name_ar, en: m.media_assets!.alt_en || row.name_en },
        })),
      variants: [...row.product_variants]
        .filter((v) => v.is_active)
        .sort((a, b) => a.position - b.position)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          label: { ar: v.label_ar, en: v.label_en },
          priceFils: v.price_fils,
          compareAtFils: v.compare_at_fils ?? undefined,
          stock: v.inventory?.on_hand ?? 0,
        })),
      featured: row.is_featured,
      isNew: row.is_new,
      isSample: false,
    };
  });

  return {
    // A product without an available variant can't be shown or bought.
    products: mapped.filter((product) => product.variants.length > 0),
    categories: categories.data.map((row) => ({
      slug: row.slug,
      type: row.product_type ?? undefined,
      name: { ar: row.name_ar, en: row.name_en },
      description: { ar: row.description_ar, en: row.description_en },
      image: row.media_assets
        ? {
            src: mediaUrl(row.media_assets),
            alt: { ar: row.media_assets.alt_ar || row.name_ar, en: row.media_assets.alt_en || row.name_en },
          }
        : undefined,
      position: row.position,
      enabled: row.is_visible,
      showOnHome: row.show_on_home,
    })),
  };
}
