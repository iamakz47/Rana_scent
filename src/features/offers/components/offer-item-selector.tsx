"use client";

import { AnimatePresence, m } from "motion/react";
import { ProductVisual } from "@/components/brand/product-visual";
import { Swatch } from "@/features/catalog/components/color-selection";
import { FreeFragrancePicker } from "@/features/catalog/components/free-fragrance-picker";
import type { FreeFragrance } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { OfferItem, OfferItemChoice } from "../types";

// One included product of an offer, on the offer's own detail page: its
// photo, name and quantity, then either its locked colour (just a swatch and
// label) or a colour-choice control copied from the product purchase panel's
// radio-pill markup, and, when it has free fragrance cartridges, the shared
// FreeFragrancePicker.
export function OfferItemSelector({
  item,
  colorValue,
  onColorChange,
  fragrances,
  fragranceValue,
  onFragranceChange,
  showErrors,
}: {
  item: OfferItem;
  colorValue: string;
  onColorChange: (variantId: string) => void;
  fragrances: FreeFragrance[];
  fragranceValue: string[];
  onFragranceChange: (ids: string[]) => void;
  showErrors: boolean;
}) {
  const { locale, dict } = useI18n();
  const selected: OfferItemChoice =
    item.lockedVariant ?? item.choices.find((choice) => choice.variantId === colorValue) ?? item.defaultVariant;
  const photo = selected.image ?? item.image;

  return (
    <li className="flex gap-4 border-b border-ink/10 py-6 last:border-b-0">
      {/* The selected colour's photo, fading in when the colour changes. */}
      <div
        className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-beige sm:size-28"
        data-testid={`offer-item-photo-${item.productSlug}`}
        data-src={photo?.src ?? ""}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <m.div
            key={photo?.src ?? "none"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <ProductVisual
              src={photo?.src}
              alt={photo?.alt[locale] ?? item.name[locale]}
              pendingLabel={dict.common.photoComingSoon}
              sizes="112px"
              className="h-full w-full"
            />
          </m.div>
        </AnimatePresence>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-ink">{item.name[locale]}</p>
          <p className="shrink-0 text-step--1 text-ink-soft tabular-nums">× {item.quantity}</p>
        </div>

        {item.lockedVariant ? (
          selected.colorHex ? (
            <p
              className="flex items-center gap-2 text-step--1 text-ink-soft"
              data-testid={`offer-item-color-${item.productSlug}`}
            >
              <Swatch hex={selected.colorHex} />
              {selected.label[locale]}
            </p>
          ) : null
        ) : item.choices.length > 0 ? (
          <fieldset className="min-w-0" data-testid={`offer-item-color-${item.productSlug}`}>
            <legend className="mb-2 text-step--1 text-ink-soft">
              {dict.offers.chooseColor}: <span className="font-medium text-ink">{selected.label[locale]}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {item.choices.map((choice) => {
                const checked = choice.variantId === colorValue;
                return (
                  <label
                    key={choice.variantId}
                    className={cn(
                      "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-deep",
                      checked ? "border-gold bg-gold/8 text-gold-deep" : "border-ink/12 text-ink hover:border-ink/25",
                      choice.stock <= 0 && "opacity-55",
                    )}
                  >
                    <input
                      type="radio"
                      name={`offer-item-${item.productId}`}
                      value={choice.variantId}
                      checked={checked}
                      disabled={choice.stock <= 0}
                      onChange={() => onColorChange(choice.variantId)}
                      className="sr-only"
                    />
                    {choice.colorHex ? (
                      <Swatch
                        hex={choice.colorHex}
                        className={cn("size-5", checked && "ring-2 ring-gold ring-offset-2 ring-offset-canvas")}
                      />
                    ) : null}
                    {choice.label[locale]}
                    {choice.stock <= 0 && <span className="text-step--1">({dict.product.colorUnavailable})</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {item.freeFragrances ? (
          <div data-testid={`offer-item-fragrances-${item.productSlug}`}>
            <p className="mb-2 text-step--1 font-medium text-gold-deep">
              {item.freeFragrances === 1 ? dict.product.freeFragrancesOne : dict.product.freeFragrancesTwo}
            </p>
            <FreeFragrancePicker
              count={item.freeFragrances}
              fragrances={fragrances}
              value={fragranceValue}
              onChange={onFragranceChange}
              showErrors={showErrors}
              compact
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
