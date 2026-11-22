import type { Localized } from "@/i18n/config";
import type { Fils } from "@/lib/money";
import type { DeviceSpecs, InfoSections } from "./product-details";

export const productTypes = ["diffuser", "refill", "bundle", "accessory"] as const;
export type ProductType = (typeof productTypes)[number];

export const scentFamilies = ["oud", "musk", "floral", "fresh", "woody"] as const;
export type ScentFamily = (typeof scentFamilies)[number];

export const spaces = ["majlis", "living", "bedroom", "office", "car"] as const;
export type Space = (typeof spaces)[number];

// A real product photo (served via next/image). Products without photos
// show a neutral "photo coming soon" panel: no drawn stand-ins.
export type ProductImage = {
  src: string;
  alt: Localized;
};

export type ProductVariant = {
  id: string;
  sku: string;
  label: Localized;
  priceFils: Fils;
  compareAtFils?: Fils;
  stock: number;
  // Colour variants: swatch colour (#RRGGBB) and the photos of this colour.
  colorHex?: string;
  images?: ProductImage[];
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
  // Device specifications. PROVISIONAL until Rana Scent confirms them.
  specs?: Array<{ label: Localized; value: Localized }>;
  // True once Rana Scent has confirmed the specifications.
  specsConfirmed?: boolean;
  // Structured device specifications (only entered values) and information sections.
  deviceSpecs?: DeviceSpecs;
  info?: InfoSections;
  // Diffusers: free fragrance cartridges included per device (1 or 2).
  freeFragrances?: 1 | 2;
  // Refills: may be chosen as a free fragrance (default true).
  freeFragranceEligible?: boolean;
  // Category slugs the product belongs to.
  categories?: string[];
  compatibleWith: string[];
  spaces: Space[];
  images: ProductImage[];
  variants: ProductVariant[];
  featured?: boolean;
  isNew?: boolean;
  // Phase 1 preview content (sample data), as opposed to a published product.
  isSample: boolean;
};

// Admin-managed in Phase 2 (create, edit, reorder, enable/disable, upload
// image).
export type Category = {
  slug: string;
  // Optional: a category may group products of any type.
  type?: ProductType;
  name: Localized;
  description: Localized;
  image?: ProductImage;
  position: number;
  enabled: boolean;
  // Shown in the homepage quick-access row.
  showOnHome: boolean;
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

// A product offers a colour choice when at least two variants have a swatch.
export function hasColorChoice(product: Product): boolean {
  return product.variants.filter((variant) => variant.colorHex).length >= 2;
}

// Photos for one variant: its own, falling back to the shared product photos.
export function variantImages(product: Product, variant: ProductVariant | undefined): ProductImage[] {
  return variant?.images?.length ? variant.images : product.images;
}

// The variant shown first: the first one in stock, else the first one.
export function defaultVariant(product: Product): ProductVariant {
  return product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
}
