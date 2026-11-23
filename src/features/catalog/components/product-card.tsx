import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { hasColorChoice, type Product } from "../types";
import { ColorProductCard } from "./color-product-card";
import { ProductCardView } from "./product-card-view";

type Props = {
  product: Product;
  locale: Locale;
  dict: Dictionary;
  size?: "default" | "feature";
  // Only one card per product per page may carry the shared-element name.
  morph?: boolean;
  priority?: boolean;
};

export function ProductCard(props: Props) {
  // Devices sold in several colours get swatches that switch the card photo.
  if (hasColorChoice(props.product)) {
    const { dict, locale, ...rest } = props;
    void dict;
    void locale;
    return <ColorProductCard {...rest} />;
  }
  return <ProductCardView {...props} />;
}
