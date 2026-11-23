"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import { Price } from "@/components/ui/price";
import { QuantityStepper } from "@/features/cart/quantity-stepper";
import { addToCart, setCartDrawerOpen, type BundleComponentLine } from "@/features/cart/store";
import type { FreeFragrance } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { formatKWD } from "@/lib/money";
import type { Offer, OfferItemChoice } from "../types";
import { OfferItemSelector } from "./offer-item-selector";

// The offer detail page's interactive half: every included item (with its
// colour/fragrance controls, where it has any) plus the bundle's own price
// and single "Add to cart" action. One quantity stepper for the whole
// bundle, matching PurchasePanel rather than per-item steppers.
export function OfferPurchasePanel({ offer, fragrances }: { offer: Offer; fragrances: FreeFragrance[] }) {
  const { locale, dict } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [colorChoice, setColorChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(offer.items.map((item) => [item.productId, item.defaultVariant.variantId])),
  );
  const [fragranceChoice, setFragranceChoice] = useState<Record<string, string[]>>({});
  const [showErrors, setShowErrors] = useState(false);

  const resolved = useMemo(
    () =>
      offer.items.map((item) => {
        const choice: OfferItemChoice =
          item.lockedVariant ?? item.choices.find((c) => c.variantId === colorChoice[item.productId]) ?? item.defaultVariant;
        const fragranceIds = (fragranceChoice[item.productId] ?? []).filter((id) => fragrances.some((f) => f.id === id));
        return { item, choice, fragranceIds };
      }),
    [offer.items, colorChoice, fragranceChoice, fragrances],
  );

  const soldOut = resolved.some(({ choice }) => choice.stock <= 0);
  // Mirrors PurchasePanel: a required fragrance picker with nothing to pick
  // from blocks the button outright, rather than only on submit.
  const fragrancesUnavailable = offer.items.some((item) => item.freeFragrances && fragrances.length === 0);
  const fragrancesComplete = resolved.every(
    ({ item, fragranceIds }) => !item.freeFragrances || fragranceIds.length === item.freeFragrances,
  );

  return (
    <div className="space-y-8">
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {resolved.map(({ item }) => (
          <OfferItemSelector
            key={item.productId}
            item={item}
            colorValue={colorChoice[item.productId] ?? item.defaultVariant.variantId}
            onColorChange={(variantId) => setColorChoice((prev) => ({ ...prev, [item.productId]: variantId }))}
            fragrances={fragrances}
            fragranceValue={fragranceChoice[item.productId] ?? []}
            onFragranceChange={(ids) => {
              setFragranceChoice((prev) => ({ ...prev, [item.productId]: ids }));
              setShowErrors(false);
            }}
            showErrors={showErrors}
          />
        ))}
      </ul>

      <div className="space-y-5 rounded-[1.75rem] border border-gold/40 bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-step--1 text-ink-soft">{dict.offers.offerPrice}</p>
            <Price fils={offer.priceFils} compareAtFils={offer.originalPriceFils} locale={locale} className="text-step-3" />
          </div>
          {offer.savingsFils > 0 ? (
            <p className="text-step--1 text-gold-deep" data-testid="offer-savings-amount">
              {dict.offers.youSave} {formatKWD(offer.savingsFils, locale)} ·{" "}
              {format(dict.offers.percentOff, { percent: offer.savingsPercent })}
            </p>
          ) : null}
        </div>

        {showErrors && !fragrancesComplete ? (
          <p role="alert" className="text-step--1 text-[#86352b]">
            {dict.offers.selectionRequired}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={20} />
          <Button
            size="lg"
            className="min-w-52 flex-1"
            data-testid="offer-add-to-cart"
            disabled={soldOut || fragrancesUnavailable}
            onClick={() => {
              if (!fragrancesComplete) {
                setShowErrors(true);
                return;
              }
              const components: BundleComponentLine[] = resolved.map(({ item, choice, fragranceIds }) => ({
                itemProductId: item.productId,
                variantId: choice.variantId,
                name: item.name,
                variantLabel: choice.label,
                quantity: item.quantity,
                ...(choice.colorHex ? { colorHex: choice.colorHex } : {}),
                ...(item.freeFragrances
                  ? { fragrances: fragranceIds.map((id) => ({ id, name: fragrances.find((f) => f.id === id)!.name })) }
                  : {}),
              }));
              addToCart(
                {
                  variantId: offer.variantId,
                  productSlug: offer.slug,
                  name: offer.name,
                  variantLabel: { ar: "الحزمة", en: "Bundle" },
                  unitPriceFils: offer.priceFils,
                  ...(offer.image?.src ? { image: offer.image.src } : {}),
                  bundle: { offerId: offer.id, components },
                },
                quantity,
              );
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
                    <CheckIcon size={18} /> {dict.offers.added}
                  </>
                ) : (
                  dict.offers.addToCart
                )}
              </m.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </div>
  );
}
