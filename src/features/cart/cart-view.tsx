"use client";

import { LineVariant } from "@/features/cart/line-variant";
import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, m } from "motion/react";
import { ProductVisual } from "@/components/brand/product-visual";
import { Button, ButtonLink } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { QuantityStepper } from "./quantity-stepper";
import { quoteCheckout } from "@/features/checkout/actions";
import type { FreeFragrance } from "@/features/catalog/queries";
import { LineFragrances } from "./line-fragrances";
import { cartTotals, lineKey, removeLine, setLineQuantity, syncCartPrices, useCartLines } from "./store";
import { useStoreConfig } from "./store-config";

export function CartView({ fragrances }: { fragrances?: FreeFragrance[] }) {
  const { locale, dict } = useI18n();
  const lines = useCartLines();
  const { subtotalFils } = cartTotals(lines);
  const { checkoutEnabled } = useStoreConfig();
  const variantKey = lines.map((line) => `${line.variantId}:${line.quantity}`).join(",");

  // With the live catalog, refresh the displayed prices from the server.
  useEffect(() => {
    if (!checkoutEnabled || lines.length === 0) return;
    let cancelled = false;
    quoteCheckout({
      items: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity, fragrances: line.fragrances?.map((f) => f.id) })),
      governorate: "",
      area: "",
      discountCode: "",
    }).then((result) => {
      if (!cancelled && result.ok) syncCartPrices(result.quote.lines);
    });
    return () => {
      cancelled = true;
    };
    // variantKey captures the cart contents without re-running on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutEnabled, variantKey]);

  if (lines.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gold/50 px-6 py-24 text-center">
        <p className="font-display text-step-4 text-ink">{dict.cart.empty}</p>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{dict.cart.emptyBody}</p>
        <ButtonLink href={localePath(locale, "/shop")} className="mt-8" size="lg">
          {dict.cart.startShopping}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start xl:gap-16">
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <m.li
              key={lineKey(line)}
              layout
              exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
              className="flex gap-4 py-6 sm:gap-6"
            >
              <Link href={localePath(locale, `/products/${line.productSlug}`)} className="shrink-0">
                <ProductVisual
                  src={line.image}
                  alt={line.name[locale]}
                  pendingLabel={dict.common.photoComingSoon}
                  sizes="144px"
                  className="size-28 rounded-2xl bg-beige sm:size-36"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    href={localePath(locale, `/products/${line.productSlug}`)}
                    className="font-display text-step-2 text-ink hover:text-gold-deep"
                  >
                    {line.name[locale]}
                  </Link>
                  <p className="text-step--1 text-ink-soft"><LineVariant line={line} /></p>
                  <p className="mt-1 text-step--1 text-ink-soft tabular-nums">{formatKWD(line.unitPriceFils, locale)}</p>
                  <LineFragrances line={line} lineId={lineKey(line)} fragrances={fragrances} />
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <p className="text-gold-deep tabular-nums sm:text-step-1">
                    {formatKWD(line.unitPriceFils * line.quantity, locale)}
                  </p>
                  <QuantityStepper value={line.quantity} onChange={(q) => setLineQuantity(lineKey(line), q)} compact />
                  <button
                    type="button"
                    onClick={() => removeLine(lineKey(line))}
                    className="min-h-11 px-1 text-step--1 text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                  >
                    {dict.cart.remove}
                  </button>
                </div>
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>

      <aside
        aria-labelledby="summary-title"
        className="rounded-[2rem] border border-gold/50 bg-surface p-6 lg:sticky lg:top-28 lg:p-8"
      >
        <h2 id="summary-title" className="font-display text-step-2 text-ink">
          {dict.cart.summary}
        </h2>
        <div className="mt-6 flex items-baseline justify-between border-b border-ink/10 pb-6">
          <span className="text-ink-soft">{dict.cart.subtotal}</span>
          <span className="text-step-2 text-gold-deep tabular-nums">{formatKWD(subtotalFils, locale)}</span>
        </div>
        <p className="mt-6 text-step--1 text-ink-soft">{dict.cart.taxesNote}</p>
        {checkoutEnabled ? (
          <ButtonLink href={localePath(locale, "/checkout")} className="mt-6 w-full" size="lg">
            {dict.cart.checkout}
          </ButtonLink>
        ) : (
          <Button className="mt-6 w-full" size="lg" disabled>
            {dict.cart.checkoutSoon}
          </Button>
        )}
        <ButtonLink href={localePath(locale, "/shop")} variant="ghost" className="mt-2 w-full">
          {dict.cart.continue}
        </ButtonLink>
      </aside>
    </div>
  );
}
