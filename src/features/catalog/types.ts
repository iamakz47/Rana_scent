import type { Localized } from "@/i18n/config";
import type { Fils } from "@/lib/money";

export const productTypes = ["diffuser", "refill", "bundle", "accessory"] as const;
export type ProductType = (typeof productTypes)[number];

export const scentFamilies = ["oud", "musk", "floral", "fresh", "woody"] as const;
export type ScentFamily = (typeof scentFamilies)[number];

export const spaces = ["majlis", "living", "bedroom", "office", "car"] as const;
export type Space = (typeof spaces)[number];

// Placeholder artwork until real photography exists. Each "art" kind maps to
// a drawn illustration in ProductArt; `src` takes over once photos are added.
export type ArtKind =
  | "diffuser-tower"
  | "diffuser-compact"
  | "diffuser-car"
  | "cartridge"
  | "bundle"
  | "accessory";

export type ProductImage = {
  src?: string;
  art: ArtKind;
  view: "front" | "detail" | "context";
  alt: Localized;
};

export type ProductVariant = {
  id: string;
  sku: string;
  label: Localized;
  priceFils: Fils;
  compareAtFils?: Fils;
  stock: number;
};

export type Product = {
  id: string;
  slug: string;
  type: ProductType;
  name: Localized;
  tagline: Localized;
  description: Localized;
  scentFamily?: ScentFamily;
  notes?: { top: Localized; heart: Localized; base: Localized };
  bundleContents?: Array<{ slug: string; quantity: number }>;
  compatibleWith: string[];
  spaces: Space[];
  images: ProductImage[];
  variants: ProductVariant[];
  featured?: boolean;
  isNew?: boolean;
  // Every product here is sample content until the real catalog is loaded.
  isSample: true;
};

export type Category = {
  slug: string;
  type: ProductType;
  name: Localized;
  description: Localized;
};

export type Availability = "in_stock" | "low_stock" | "out_of_stock";

export const LOW_STOCK_THRESHOLD = 5;

export function availabilityOf(stock: number): Availability {
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export function productStock(product: Product): number {
  return product.variants.reduce((total, variant) => total + variant.stock, 0);
}

export function lowestPrice(product: Product): Fils {
  return Math.min(...product.variants.map((variant) => variant.priceFils));
}
