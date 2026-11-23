import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductStatus } from "./catalog";
import type { CatalogSearchItem, OfferItemValue, OfferOptions, OfferValues } from "@/features/admin/offers/offer-editor";
import { filsToKwdInput } from "@/features/admin/format";
import { mediaUrl } from "@/features/media/url";

// Admin data access for offers (bundle products). Mirrors
// `src/features/admin/data/catalog.ts`'s listAdminProducts/getAdminProduct
// conventions, scoped to `products.type = 'bundle'`.

const mediaColumns = "id, bucket, path, alt_ar, alt_en, width, height";

// `bundle_items` has two foreign keys to `products` (bundle_id and
// item_product_id), so every embed must name the exact relationship —
// PostgREST (and the typed client) can't otherwise pick one.
const bundleItemsFromBundle = "bundle_items!bundle_items_bundle_id_fkey";
const itemFromBundleItem = "products!bundle_items_item_product_id_fkey";

export type OfferWindowState = "scheduled" | "active" | "expired";

// A bundle can be `status = 'published'` yet outside its own scheduling
// window — a distinct, additional state shown as its own badge.
export function offerWindowState(startsAt: string | null, endsAt: string | null): OfferWindowState {
  const now = Date.now();
  if (startsAt && now < new Date(startsAt).getTime()) return "scheduled";
  if (endsAt && now >= new Date(endsAt).getTime()) return "expired";
  return "active";
}

export async function listAdminOffers(status?: ProductStatus, options: { search?: string; range?: [number, number] } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      `id, slug, status, name_ar, name_en, offer_starts_at, offer_ends_at, updated_at,
       product_variants(price_fils, is_active),
       product_media(position, media_assets(${mediaColumns})),
       ${bundleItemsFromBundle}(quantity)`,
    )
    .eq("type", "bundle")
    .order("position")
    .order("created_at");
  query = status ? query.eq("status", status) : query.neq("status", "archived");
  // Letters, digits, spaces and - only: nothing that changes the filter syntax.
  const search = (options.search ?? "").replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 60);
  if (search) query = query.or(`name_en.ilike.%${search}%,name_ar.ilike.%${search}%,slug.ilike.%${search}%`);
  if (options.range) query = query.range(...options.range);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => {
    const variant = row.product_variants.find((v) => v.is_active) ?? row.product_variants[0] ?? null;
    const cover = [...row.product_media].sort((a, b) => a.position - b.position)[0]?.media_assets ?? null;
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      name: { ar: row.name_ar, en: row.name_en },
      priceFils: variant?.price_fils ?? null,
      itemCount: row.bundle_items.length,
      cover,
      updatedAt: row.updated_at,
      startsAt: row.offer_starts_at,
      endsAt: row.offer_ends_at,
      windowState: offerWindowState(row.offer_starts_at, row.offer_ends_at),
    };
  });
}

// The full offer, shaped directly into what <OfferEditor> consumes: resolved
// item names/images/variant lists, not raw join rows.
export async function getAdminOffer(id: string): Promise<OfferValues | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("products")
    .select(
      `id, slug, status, name_ar, name_en, description_ar, description_en,
       offer_starts_at, offer_ends_at, allow_discount_stacking,
       product_variants(price_fils),
       product_media(position, media_assets(${mediaColumns})),
       ${bundleItemsFromBundle}(
         item_product_id, quantity, locked_variant_id, position,
         item:${itemFromBundleItem}(
           id, slug, name_ar, name_en, status,
           product_variants(id, label_ar, label_en, price_fils, color_hex, is_active),
           product_media(position, media_assets(${mediaColumns}))
         )
       )`,
    )
    .eq("id", id)
    .eq("type", "bundle")
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const items: OfferItemValue[] = [...row.bundle_items]
    .sort((a, b) => a.position - b.position)
    .filter((link) => link.item !== null)
    .map((link) => {
      const item = link.item!;
      const cover = [...item.product_media].sort((a, b) => a.position - b.position)[0]?.media_assets ?? null;
      return {
        key: item.id,
        product_id: item.id,
        slug: item.slug,
        name: { ar: item.name_ar, en: item.name_en },
        status: item.status,
        cover: cover ? { id: cover.id, url: mediaUrl(cover), alt: cover.alt_en || cover.alt_ar } : null,
        quantity: link.quantity,
        locked_variant_id: link.locked_variant_id ?? "",
        variants: item.product_variants
          .filter((v) => v.is_active)
          .map((v) => ({ id: v.id, label: { ar: v.label_ar, en: v.label_en }, color_hex: v.color_hex, price_fils: v.price_fils })),
      };
    });

  return {
    id: row.id,
    status: row.status,
    name_ar: row.name_ar,
    name_en: row.name_en,
    description_ar: row.description_ar,
    description_en: row.description_en,
    price: filsToKwdInput(row.product_variants[0]?.price_fils ?? 0),
    allow_discount_stacking: row.allow_discount_stacking,
    starts_at: toDatetimeLocal(row.offer_starts_at),
    ends_at: toDatetimeLocal(row.offer_ends_at),
    media: row.product_media
      .filter((m) => m.media_assets)
      .sort((a, b) => a.position - b.position)
      .map((m) => m.media_assets!.id),
    items,
  };
}

// Kuwait is UTC+3 with no DST, same convention as discount code scheduling.
function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const local = new Date(new Date(value).getTime() + 3 * 60 * 60 * 1000).toISOString();
  return local.slice(0, 16);
}

export async function getOfferFormOptions(): Promise<OfferOptions> {
  const supabase = await createClient();
  const { data } = await supabase.from("media_assets").select(mediaColumns).order("created_at", { ascending: false }).limit(200);
  return {
    library: (data ?? []).map((asset) => ({
      id: asset.id,
      url: mediaUrl(asset),
      alt: asset.alt_en || asset.alt_ar || asset.path,
      width: asset.width,
      height: asset.height,
    })),
  };
}

// The item picker's search-as-you-type source: every non-archived product
// that isn't itself an offer (nesting is rejected by the database anyway),
// with its active colours so the picker can offer the locked-colour choice
// inline. No pagination: this is a capped, ranked search, not a listing.
export async function searchAdminCatalogProducts(query: string): Promise<CatalogSearchItem[]> {
  const supabase = await createClient();
  let request = supabase
    .from("products")
    .select(
      `id, slug, status, name_ar, name_en,
       product_media(position, media_assets(${mediaColumns})),
       product_variants(id, label_ar, label_en, color_hex, price_fils, is_active)`,
    )
    .neq("type", "bundle")
    .neq("status", "archived")
    .order("position")
    .order("created_at")
    .limit(40);
  const search = (query ?? "").replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 60);
  if (search) request = request.or(`name_en.ilike.%${search}%,name_ar.ilike.%${search}%,slug.ilike.%${search}%`);
  const { data, error } = await request;
  if (error) throw error;
  return data.map((row) => {
    const cover = [...row.product_media].sort((a, b) => a.position - b.position)[0]?.media_assets ?? null;
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      name: { ar: row.name_ar, en: row.name_en },
      cover: cover ? { id: cover.id, url: mediaUrl(cover), alt: cover.alt_en || cover.alt_ar } : null,
      variants: row.product_variants
        .filter((v) => v.is_active)
        .map((v) => ({ id: v.id, label: { ar: v.label_ar, en: v.label_en }, color_hex: v.color_hex, price_fils: v.price_fils })),
    };
  });
}
