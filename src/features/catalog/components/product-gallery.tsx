"use client";

import { useState, ViewTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { ProductVisual } from "@/components/brand/product-visual";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { variantImages, type Product } from "../types";
import { useVariantSelection } from "./color-selection";

export function ProductGallery({ product }: { product: Product }) {
  const { locale, dict } = useI18n();
  const { variant } = useVariantSelection(product);
  // Only the selected colour's photos (or the shared photos as a fallback).
  const images = variantImages(product, variant);
  const [picked, setPicked] = useState({ variantId: variant.id, index: 0 });
  // A colour change starts again at that colour's main photo.
  const index = picked.variantId === variant.id ? Math.min(picked.index, Math.max(0, images.length - 1)) : 0;
  const setIndex = (next: number) => setPicked({ variantId: variant.id, index: next });
  const image = images[index];

  return (
    <div className="space-y-3" aria-label={dict.product.gallery} role="group">
      <div className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-beige">
        {/* Only the first image is the shared element morphing from the card. */}
        <ViewTransition name={`product-${product.slug}`} share="product-morph" default="none">
          <div className="relative aspect-[4/5]">
            <AnimatePresence initial={false} mode="popLayout">
              <m.div
                key={image?.src ?? `empty-${variant.id}`}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
                data-testid="gallery-main"
                data-src={image?.src ?? ""}
              >
                <ProductVisual
                  src={image?.src}
                  alt={image?.alt[locale] ?? product.name[locale]}
                  pendingLabel={dict.common.photoComingSoon}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  priority={index === 0}
                  className="h-full w-full"
                />
              </m.div>
            </AnimatePresence>
          </div>
        </ViewTransition>
      </div>

      {images.length > 1 && (
      <div className="grid grid-cols-3 gap-3" data-testid="gallery-thumbs">
        {images.map((thumb, thumbIndex) => (
          <button
            key={`${variant.id}-${thumb.src}`}
            type="button"
            onClick={() => setIndex(thumbIndex)}
            aria-label={format(dict.product.showImage, { index: thumbIndex + 1 })}
            aria-current={thumbIndex === index}
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface transition-[border-color,opacity] duration-300",
              thumbIndex === index ? "border-gold" : "border-ink/10 opacity-60 hover:opacity-100",
            )}
          >
            <ProductVisual
              src={thumb.src}
              alt=""
              pendingLabel={dict.common.photoComingSoon}
              sizes="20vw"
              className="aspect-square"
            />
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
