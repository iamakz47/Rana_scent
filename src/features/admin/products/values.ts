import "server-only";
import type { Locale } from "@/i18n/config";
import { mediaUrl } from "@/features/media/url";
import { filsToKwdInput } from "@/features/admin/format";
import type { getAdminProduct, getProductFormOptions } from "@/features/admin/data/catalog";
import type { ProductOptions, ProductValues } from "./product-editor";
import { formatSpecs } from "./schema";
import { parseDeviceSpecs, parseInfoSections, simpleSpecKeys, specValue, type DeviceSpecs, type SimpleSpecKey } from "@/features/catalog/product-details";
import storeAr from "@/i18n/dictionaries/ar.json";
import storeEn from "@/i18n/dictionaries/en.json";

// The six specifications as editable text. Older numeric values (coverage in
// m², capacity in ml) are shown as the text the store displays today.
function simpleSpecs(specs: DeviceSpecs): ProductValues["simple_specs"] {
  const labels = (d: typeof storeEn) => ({ ...d.product.specLabels, units: d.product.specUnits, upTo: d.product.specUpTo });
  const legacyEn: Partial<Record<SimpleSpecKey, string>> = {
    coverage: specs.coverage_m2 ? specValue({ coverage_m2: specs.coverage_m2 }, "coverage", "en", labels(storeEn)) : "",
    capacity: specs.capacity_ml ? specValue({ capacity_ml: specs.capacity_ml }, "capacity", "en", labels(storeEn)) : "",
    color: specs.colors?.en ?? "",
  };
  return Object.fromEntries(
    simpleSpecKeys.map((key) => [
      key,
      {
        ar: specValue(specs, key, "ar", labels(storeAr as typeof storeEn)),
        en: specs[key]?.en || legacyEn[key] || "",
      },
    ]),
  ) as ProductValues["simple_specs"];
}

// The length × width × height inputs, as the text each one should show.
function boxDimensions(specs: DeviceSpecs): ProductValues["dimensions"] {
  return {
    length: specs.length_cm !== undefined ? String(specs.length_cm) : "",
    width: specs.width_cm !== undefined ? String(specs.width_cm) : "",
    height: specs.height_cm !== undefined ? String(specs.height_cm) : "",
  };
}

const randomSku = () => `RS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
  device_specs: {},
  simple_specs: Object.fromEntries(simpleSpecKeys.map((key) => [key, { ar: "", en: "" }])) as ProductValues["simple_specs"],
  dimensions: { length: "", width: "", height: "" },
  info_sections: {},
  free_fragrances: "",
  free_fragrance_eligible: true,
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
  new_sku: "",
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
    device_specs: parseDeviceSpecs(row.device_specs),
    simple_specs: simpleSpecs(parseDeviceSpecs(row.device_specs)),
    dimensions: boxDimensions(parseDeviceSpecs(row.device_specs)),
    info_sections: parseInfoSections(row.info_sections),
    free_fragrances: row.free_fragrances === 1 ? "1" : row.free_fragrances === 2 ? "2" : "",
    free_fragrance_eligible: row.free_fragrance_eligible,
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
        stock: String(variant.inventory?.on_hand ?? 0),
        color_hex: (variant as { color_hex?: string | null }).color_hex ?? "",
        media: mediaFor(row, variant.id),
      })),
    // Shared photos: those not attached to a colour.
    media: mediaFor(row, null),
    new_sku: "",
    scents: [...row.product_scents].sort((a, b) => a.position - b.position).map((s) => s.scent_family_id),
    compatible: row.device_compatibility.map((d) => d.compatible_product_id),
  };
}

type Row = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

function mediaFor(row: Row, variantId: string | null): string[] {
  return [...row.product_media]
    .filter((m) => ((m as { variant_id?: string | null }).variant_id ?? null) === variantId)
    .sort((a, b) => a.position - b.position)
    .map((m) => m.media_assets?.id)
    .filter((id): id is string => Boolean(id));
}

// A fresh SKU suggestion for new products and colours.
export function suggestSku(): string {
  return randomSku();
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
