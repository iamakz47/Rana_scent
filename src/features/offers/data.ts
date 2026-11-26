import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { CATALOG_TAG } from "@/features/catalog/cache-tags";
import { isLiveCatalog, loadCatalog } from "@/features/catalog/source";
import { defaultVariant as defaultProductVariant, variantImages, type Product, type ProductVariant } from "@/features/catalog/types";
import { computeSavings, type Offer, type OfferItem, type OfferItemChoice } from "./types";

// Offers are read from Supabase directly (locked colours and scheduling
// aren't part of the generic catalog shape); the catalog's own cached load
// supplies everything else (names, images, variants, stock). Both share
// CATALOG_TAG, so an admin save invalidates offers too.

type BundleRow = {
  id: string;
  offer_starts_at: string | null;
  offer_ends_at: string | null;
  allow_discount_stacking: boolean;
  bundle_items: Array<{ item_product_id: string; quantity: number; locked_variant_id: string | null; position: number }>;
};

async function loadBundleRows(): Promise<Map<string, BundleRow>> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, offer_starts_at, offer_ends_at, allow_discount_stacking, bundle_items!bundle_items_bundle_id_fkey(item_product_id, quantity, locked_variant_id, position)",
    )
    .eq("type", "bundle")
    .eq("status", "published");
  if (error || !data) return new Map();
  return new Map(data.map((row) => [row.id, row as BundleRow]));
}

// Each colour carries its own photo, so the offer page can switch photos
// instantly when the customer changes colour (colour-only photos included).
function toChoice(product: Product, variant: ProductVariant): OfferItemChoice {
  return {
    variantId: variant.id,
    label: variant.label,
    colorHex: variant.colorHex,
    priceFils: variant.priceFils,
    stock: variant.stock,
    image: variantImages(product, variant)[0],
  };
}

function isCurrentlyValid(row: BundleRow): boolean {
  const now = Date.now();
  if (row.offer_starts_at && now < new Date(row.offer_starts_at).getTime()) return false;
  if (row.offer_ends_at && now >= new Date(row.offer_ends_at).getTime()) return false;
  return true;
}

// Cached for a few minutes: the schedule check reads the clock, which may
// only happen inside a cache scope (never while prerendering a page), and
// start/end times then take effect within minutes. Admin saves refresh it
// through CATALOG_TAG.
async function buildOffers(): Promise<Offer[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("minutes");
  if (!isLiveCatalog()) return [];
  const [{ products }, bundleRows] = await Promise.all([loadCatalog(), loadBundleRows()]);
  const byId = new Map(products.map((p) => [p.id, p] as [string, Product]));

  const offers: Offer[] = [];
  for (const product of products) {
    if (product.type !== "bundle") continue;
    const row = bundleRows.get(product.id);
    const placeholder = defaultProductVariant(product);
    if (!row || !placeholder) continue;

    const items: OfferItem[] = [];
    let originalPriceFils = 0;
    let incomplete = false;
    for (const link of [...row.bundle_items].sort((a, b) => a.position - b.position)) {
      const item = byId.get(link.item_product_id);
      if (!item || item.variants.length === 0) {
        incomplete = true;
        break;
      }
      const lockedVariant = link.locked_variant_id
        ? item.variants.find((v) => v.id === link.locked_variant_id)
        : undefined;
      if (link.locked_variant_id && !lockedVariant) {
        incomplete = true;
        break;
      }
      const fallback = defaultProductVariant(item);
      const unit = lockedVariant ?? fallback;
      originalPriceFils += unit.priceFils * link.quantity;
      items.push({
        productId: item.id,
        productSlug: item.slug,
        name: item.name,
        image: variantImages(item, unit)[0] ?? item.images[0],
        quantity: link.quantity,
        lockedVariant: lockedVariant ? toChoice(item, lockedVariant) : undefined,
        choices: lockedVariant ? [] : item.variants.map((v) => toChoice(item, v)),
        defaultVariant: toChoice(item, unit),
        freeFragrances: item.freeFragrances,
      });
    }
    if (incomplete || items.length === 0) continue;

    const { savingsFils, savingsPercent } = computeSavings(placeholder.priceFils, originalPriceFils);
    offers.push({
      id: product.id,
      slug: product.slug,
      variantId: placeholder.id,
      name: product.name,
      description: product.description,
      // The offer's own photo, else the first included product's photo.
      image: product.images[0] ?? items[0]?.image,
      priceFils: placeholder.priceFils,
      originalPriceFils,
      savingsFils,
      savingsPercent,
      items,
      allowDiscountStacking: row.allow_discount_stacking,
      startsAt: row.offer_starts_at ?? undefined,
      endsAt: row.offer_ends_at ?? undefined,
      isActive: isCurrentlyValid(row),
    });
  }
  return offers;
}

// Published offers currently within their scheduled window, in catalog order.
export async function listOffers(): Promise<Offer[]> {
  return (await buildOffers()).filter((offer) => offer.isActive);
}

export async function getOffer(slug: string): Promise<Offer | undefined> {
  return (await buildOffers()).find((offer) => offer.slug === slug && offer.isActive);
}
