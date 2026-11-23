"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { defaultVariant } from "../types";
import { ProductCardView, type CardProps } from "./product-card-view";

export function ColorProductCard({ product, ...rest }: Omit<CardProps, "locale" | "dict">) {
  const { locale, dict } = useI18n();
  const [id, setId] = useState(() => defaultVariant(product).id);
  const color = product.variants.find((v) => v.id === id) ?? defaultVariant(product);
  const swatches = (
    <div className="relative z-10 mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={dict.product.colorsAvailable} data-testid="card-swatches">
      {product.variants
        .filter((v) => v.colorHex)
        .map((v) => {
          const selected = v.id === color.id;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={v.label[locale]}
              title={v.label[locale]}
              onClick={() => setId(v.id)}
              className={cn(
                "grid size-7 place-items-center rounded-full border transition-colors duration-300",
                selected ? "border-gold-deep" : "border-transparent hover:border-ink/25",
              )}
            >
              <span aria-hidden className="size-4 rounded-full border border-ink/20" style={{ background: v.colorHex }} />
            </button>
          );
        })}
    </div>
  );
  return <ProductCardView product={product} locale={locale} dict={dict} color={color} swatches={swatches} {...rest} />;
}
