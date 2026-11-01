"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Availability } from "@/components/ui/availability";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import { Price } from "@/components/ui/price";
import { QuantityStepper } from "@/features/cart/quantity-stepper";
import { addToCart, setCartDrawerOpen } from "@/features/cart/store";
import { toCartLine } from "@/features/cart/to-cart-line";
import { WishlistButton } from "@/features/wishlist/wishlist-button";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { Product } from "../types";

export function PurchasePanel({ product }: { product: Product }) {
  const { locale, dict } = useI18n();
  const initial = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(initial.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((item) => item.id === variantId) ?? initial;
  const soldOut = variant.stock <= 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Price
          fils={variant.priceFils}
          compareAtFils={variant.compareAtFils}
          locale={locale}
          className="text-step-3"
        />
        <Availability
          stock={variant.stock}
          labels={{ inStock: dict.product.inStock, lowStock: dict.product.lowStock, outOfStock: dict.product.outOfStock }}
        />
      </div>

      {product.variants.length > 1 && (
        <fieldset className="min-w-0">
          <legend className="mb-3 text-step--1 text-ivory/60">{dict.product.option}</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((item) => {
              const checked = item.id === variant.id;
              return (
                <label
                  key={item.id}
                  className={cn(
                    "relative inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border px-5 transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-300",
                    checked ? "border-gold-300 text-gold-200" : "border-white/12 text-ivory/80 hover:border-white/30",
                    item.stock <= 0 && "opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name={`variant-${product.id}`}
                    value={item.id}
                    checked={checked}
                    onChange={() => {
                      setVariantId(item.id);
                      setQuantity(1);
                    }}
                    className="sr-only"
                  />
                  {item.label[locale]}
                  {item.stock <= 0 && <span className="text-step--1">({dict.product.outOfStock})</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(variant.stock, 20))} />
        <Button
          size="lg"
          className="min-w-52 flex-1"
          disabled={soldOut}
          onClick={() => {
            addToCart(toCartLine(product, variant), quantity);
            setAdded(true);
            setCartDrawerOpen(true);
            window.setTimeout(() => setAdded(false), 1800);
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={soldOut ? "sold" : added ? "added" : "add"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-2"
            >
              {soldOut ? (
                dict.product.outOfStock
              ) : added ? (
                <>
                  <CheckIcon size={18} /> {dict.product.added}
                </>
              ) : (
                dict.product.addToCart
              )}
            </m.span>
          </AnimatePresence>
        </Button>
        <WishlistButton slug={product.slug} className="size-13" />
      </div>

      <p className="text-step--1 text-ivory/55">{dict.product.deliveryNote}</p>
    </div>
  );
}
