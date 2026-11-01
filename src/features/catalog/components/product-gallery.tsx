"use client";

import { useState, ViewTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { ProductArt } from "@/components/brand/product-art";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { cn } from "@/lib/cn";
import type { Product } from "../types";

export function ProductGallery({ product }: { product: Product }) {
  const { locale, dict } = useI18n();
  const [index, setIndex] = useState(0);
  const image = product.images[index];

  return (
    <div className="space-y-3" aria-label={dict.product.gallery} role="group">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/6 bg-gradient-to-b from-navy-800/70 to-navy-950">
        {/* Only the first image is the shared element morphing from the card. */}
        <ViewTransition name={`product-${product.slug}`} share="product-morph" default="none">
          <div className="relative aspect-[4/5]">
            <AnimatePresence initial={false} mode="popLayout">
              <m.div
                key={index}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <ProductArt
                  art={image.art}
                  view={image.view}
                  family={product.scentFamily}
                  uid={`gallery-${product.id}-${index}`}
                  label={image.alt[locale]}
                  tagLabel={dict.common.placeholderImage}
                  className="h-full w-full"
                />
              </m.div>
            </AnimatePresence>
          </div>
        </ViewTransition>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {product.images.map((thumb, thumbIndex) => (
          <button
            key={thumbIndex}
            type="button"
            onClick={() => setIndex(thumbIndex)}
            aria-label={format(dict.product.showImage, { index: thumbIndex + 1 })}
            aria-current={thumbIndex === index}
            className={cn(
              "overflow-hidden rounded-2xl border bg-navy-900 transition-[border-color,opacity] duration-300",
              thumbIndex === index ? "border-gold-300/70" : "border-white/8 opacity-60 hover:opacity-100",
            )}
          >
            <ProductArt
              art={thumb.art}
              view={thumb.view}
              family={product.scentFamily}
              uid={`thumb-${product.id}-${thumbIndex}`}
              label=""
              className="aspect-square"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
