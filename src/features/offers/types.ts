import type { Localized } from "@/i18n/config";
import type { Fils } from "@/lib/money";
import type { ProductImage } from "@/features/catalog/types";

// An offer is a product bundle: the owner picks existing products and
// quantities and sets one final price. Nothing here duplicates a product;
// an OfferItem only points at one.

export type OfferItemChoice = {
  variantId: string;
  label: Localized;
  colorHex?: string;
  priceFils: Fils;
  stock: number;
  // This colour's own main photo (or the product's shared photo).
  image?: ProductImage;
};

export type OfferItem = {
  productId: string;
  productSlug: string;
  name: Localized;
  image?: ProductImage;
  quantity: number;
  // Set when the owner locked this item to one colour: the customer can't
  // choose, and `choices` is empty.
  lockedVariant?: OfferItemChoice;
  // Choosable colours (empty when locked, or when the product has only one).
  choices: OfferItemChoice[];
  // The colour used for the original-price calculation and as the initial
  // selection: the locked colour, else the product's own default colour.
  defaultVariant: OfferItemChoice;
  // Diffusers: free fragrance cartridges included per device (1 or 2).
  freeFragrances?: 1 | 2;
};

export type Offer = {
  id: string;
  slug: string;
  // The one product_variants row behind the offer's own flat price: this is
  // the variantId a cart line for this offer uses for billing.
  variantId: string;
  name: Localized;
  description: Localized;
  image?: ProductImage;
  priceFils: Fils;
  originalPriceFils: Fils;
  savingsFils: Fils;
  savingsPercent: number;
  items: OfferItem[];
  allowDiscountStacking: boolean;
  startsAt?: string;
  endsAt?: string;
  // Published and, if scheduled, currently within its start/end window.
  isActive: boolean;
};

// Percent rounded to one decimal, matching the KWD three-decimal display
// convention's general "don't over-round money" spirit.
export function computeSavings(priceFils: Fils, originalPriceFils: Fils): { savingsFils: Fils; savingsPercent: number } {
  const savingsFils = Math.max(originalPriceFils - priceFils, 0);
  const savingsPercent = originalPriceFils > 0 ? Math.round((savingsFils / originalPriceFils) * 1000) / 10 : 0;
  return { savingsFils, savingsPercent };
}
