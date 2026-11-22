import { variantImages, type Product, type ProductVariant } from "@/features/catalog/types";
import type { CartLine } from "./store";

export function toCartLine(product: Product, variant: ProductVariant): Omit<CartLine, "quantity"> {
  return {
    variantId: variant.id,
    productSlug: product.slug,
    name: product.name,
    variantLabel: variant.label,
    unitPriceFils: variant.priceFils,
    // The photo of the chosen colour, so the cart shows the right device.
    image: variantImages(product, variant)[0]?.src,
    ...(variant.colorHex ? { colorHex: variant.colorHex } : {}),
    scentFamily: product.scentFamily,
  };
}
