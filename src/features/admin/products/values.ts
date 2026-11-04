import "server-only";
import type { Locale } from "@/i18n/config";
import { mediaUrl } from "@/features/media/url";
import { filsToKwdInput } from "@/features/admin/format";
import type { getAdminProduct, getProductFormOptions } from "@/features/admin/data/catalog";
import type { ProductOptions, ProductValues } from "./product-editor";
import { formatSpecs } from "./schema";

type Notes = { top?: { ar?: string; en?: string }; heart?: { ar?: string; en?: string }; base?: { ar?: string; en?: string } };
const pair = (value?: { ar?: string; en?: string }) => ({ ar: value?.ar ?? "", en: value?.en ?? "" });

export const emptyProduct: ProductValues = {
  slug: "",
  type: "diffuser",
  status: "draft",
  name_ar: "",
  name_en: "",
  short_description_ar: "",
  short_description_en: "",
  description_ar: "",
  description_en: "",
  notes: { top: pair(), heart: pair(), base: pair() },
  specs_ar: "",
  specs_en: "",
  specs_confirmed: false,
  spaces: [],
  is_featured: false,
  is_new: false,
  position: 0,
  category_id: "",
  seo_title_ar: "",
  seo_title_en: "",
  seo_description_ar: "",
  seo_description_en: "",
  variants: [],
  media: [],
  scents: [],
  compatible: [],
};

export function toProductValues(row: NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>): ProductValues {
  const notes = (row.notes ?? {}) as Notes;
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status,
    name_ar: row.name_ar,
    name_en: row.name_en,
    short_description_ar: row.short_description_ar,
    short_description_en: row.short_description_en,
    description_ar: row.description_ar,
    description_en: row.description_en,
    notes: { top: pair(notes.top), heart: pair(notes.heart), base: pair(notes.base) },
    specs_ar: formatSpecs(row.specs, "ar"),
    specs_en: formatSpecs(row.specs, "en"),
    specs_confirmed: row.specs_confirmed,
    spaces: row.spaces,
    is_featured: row.is_featured,
    is_new: row.is_new,
    position: row.position,
    category_id: row.product_categories.find((c) => c.is_primary)?.category_id ?? row.product_categories[0]?.category_id ?? "",
    seo_title_ar: row.seo_title_ar,
    seo_title_en: row.seo_title_en,
    seo_description_ar: row.seo_description_ar,
    seo_description_en: row.seo_description_en,
    variants: [...row.product_variants]
      .sort((a, b) => a.position - b.position)
      .map((variant) => ({
        key: variant.id,
        id: variant.id,
        sku: variant.sku,
        label_ar: variant.label_ar,
        label_en: variant.label_en,
        price: filsToKwdInput(variant.price_fils),
        compare_at: filsToKwdInput(variant.compare_at_fils),
        is_active: variant.is_active,
        on_hand: variant.inventory?.on_hand ?? 0,
      })),
    media: [...row.product_media].sort((a, b) => a.position - b.position).map((m) => m.media_assets?.id).filter((id): id is string => Boolean(id)),
    scents: [...row.product_scents].sort((a, b) => a.position - b.position).map((s) => s.scent_family_id),
    compatible: row.device_compatibility.map((d) => d.compatible_product_id),
  };
}

export function toProductOptions(options: Awaited<ReturnType<typeof getProductFormOptions>>, locale: Locale): ProductOptions {
  const name = (row: { name_ar: string; name_en: string }) => (locale === "ar" ? row.name_ar : row.name_en);
  return {
    categories: options.categories.map((c) => ({ id: c.id, name: name(c) })),
    scents: options.scents.map((s) => ({ id: s.id, name: name(s) })),
    products: options.products.map((p) => ({ id: p.id, name: name(p), type: p.type })),
    library: options.media.map((asset) => ({
      id: asset.id,
      url: mediaUrl(asset),
      alt: (locale === "ar" ? asset.alt_ar : asset.alt_en) || asset.path,
      width: asset.width,
      height: asset.height,
    })),
  };
}
