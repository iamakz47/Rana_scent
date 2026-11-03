import type { Product, ProductVariant } from "@/features/catalog/types";
import type { CartLine } from "./store";

export function toCartLine(product: Product, variant: ProductVariant): Omit<CartLine, "quantity"> {
  return {
    variantId: variant.id,
    productSlug: product.slug,
    name: product.name,
    variantLabel: variant.label,
    unitPriceFils: variant.priceFils,
    art: product.images[0]?.art ?? "cartridge",
    image: product.images[0]?.src,
    scentFamily: product.scentFamily,
  };
}
