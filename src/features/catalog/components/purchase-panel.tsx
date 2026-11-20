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
import type { FreeFragrance } from "../queries";
import type { Product } from "../types";
import { FreeFragrancePicker } from "./free-fragrance-picker";

export function PurchasePanel({ product, fragrances = [] }: { product: Product; fragrances?: FreeFragrance[] }) {
  const { locale, dict } = useI18n();
  const initial = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(initial.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((item) => item.id === variantId) ?? initial;
  const soldOut = variant.stock <= 0;
  const freeCount = product.freeFragrances;
  const [choices, setChoices] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const chosen = freeCount ? choices.slice(0, freeCount).filter((id) => fragrances.some((f) => f.id === id)) : [];
  const choicesComplete = !freeCount || chosen.length === freeCount;

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
          <legend className="mb-3 text-step--1 text-ink-soft">{dict.product.option}</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((item) => {
              const checked = item.id === variant.id;
              return (
                <label
                  key={item.id}
                  className={cn(
                    "relative inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border px-5 transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-deep",
                    checked ? "border-gold text-gold-deep" : "border-ink/12 text-ink hover:border-ink/25",
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

      {freeCount ? (
        <section aria-label={dict.product.freeFragrances} className="space-y-3">
          <p className="text-step--1 font-medium text-gold-deep">
            {freeCount === 1 ? dict.product.freeFragrancesOne : dict.product.freeFragrancesTwo}
          </p>
          <FreeFragrancePicker
            count={freeCount}
            fragrances={fragrances}
            value={choices}
            onChange={(ids) => {
              setChoices(ids);
              setShowErrors(false);
            }}
            showErrors={showErrors}
          />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(variant.stock, 20))} />
        <Button
          size="lg"
          className="min-w-52 flex-1"
          disabled={soldOut || (Boolean(freeCount) && fragrances.length === 0)}
          onClick={() => {
            if (!choicesComplete) {
              setShowErrors(true);
              return;
            }
            const selected = chosen.map((id) => {
              const fragrance = fragrances.find((f) => f.id === id)!;
              return { id: fragrance.id, name: fragrance.name };
            });
            addToCart({ ...toCartLine(product, variant), ...(freeCount ? { fragrances: selected } : {}) }, quantity);
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

      <p className="text-step--1 text-ink-soft">{dict.product.deliveryNote}</p>
    </div>
  );
}
