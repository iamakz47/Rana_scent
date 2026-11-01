"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { ProductArt } from "@/components/brand/product-art";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import type { ArtKind, ScentFamily } from "@/features/catalog/types";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { formatKWD } from "@/lib/money";
import { QuantityStepper } from "./quantity-stepper";
import {
  cartTotals,
  removeLine,
  setCartDrawerOpen,
  setLineQuantity,
  useCartDrawerOpen,
  useCartLines,
} from "./store";

export function CartDrawer() {
  const { locale, dict } = useI18n();
  const open = useCartDrawerOpen();
  const lines = useCartLines();
  const { count, subtotalFils } = cartTotals(lines);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => setCartDrawerOpen(false);

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="cart-drawer-title"
      className="drawer"
    >
      <div className="flex h-full flex-col border-s border-gold-400/15 bg-navy-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 sm:px-7">
          <h2 id="cart-drawer-title" className="font-display text-step-2">
            {dict.cart.title}
            <span className="ms-3 align-middle text-step--1 text-ivory/50 tabular-nums">
              {count === 1 ? dict.cart.itemCountOne : format(dict.cart.itemCount, { count })}
            </span>
          </h2>
          <IconButton label={dict.common.close} onClick={close} autoFocus>
            <CloseIcon />
          </IconButton>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="font-display text-step-3">{dict.cart.empty}</p>
            <p className="text-ivory/60">{dict.cart.emptyBody}</p>
            <ButtonLink href={localePath(locale, "/shop")} variant="outline" onClick={close} className="mt-2">
              {dict.cart.startShopping}
            </ButtonLink>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-2 sm:px-7">
              <AnimatePresence initial={false}>
                {lines.map((line) => (
                  <m.li
                    key={line.variantId}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: locale === "ar" ? -40 : 40, transition: { duration: 0.25 } }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="flex gap-4 rounded-2xl border border-white/6 bg-navy-800/50 p-3"
                  >
                    <Link
                      href={localePath(locale, `/products/${line.productSlug}`)}
                      onClick={close}
                      className="shrink-0"
                    >
                      <ProductArt
                        art={line.art as ArtKind}
                        family={line.scentFamily as ScentFamily | undefined}
                        uid={`drawer-${line.variantId}`}
                        label={line.name[locale]}
                        className="size-24 rounded-xl bg-navy-950"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{line.name[locale]}</p>
                          <p className="text-step--1 text-ivory/55">{line.variantLabel[locale]}</p>
                        </div>
                        <p className="shrink-0 text-step--1 text-gold-200 tabular-nums">
                          {formatKWD(line.unitPriceFils * line.quantity, locale)}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <QuantityStepper
                          value={line.quantity}
                          onChange={(quantity) => setLineQuantity(line.variantId, quantity)}
                          min={1}
                          compact
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(line.variantId)}
                          className="min-h-11 px-2 text-step--1 text-ivory/50 underline-offset-4 transition-colors hover:text-ivory hover:underline"
                        >
                          {dict.cart.remove}
                        </button>
                      </div>
                    </div>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>

            <div className="space-y-4 border-t border-gold-400/15 px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-7">
              <div className="flex items-baseline justify-between">
                <span className="text-ivory/70">{dict.cart.subtotal}</span>
                <span className="text-step-2 text-gold-200 tabular-nums">{formatKWD(subtotalFils, locale)}</span>
              </div>
              <p className="text-step--1 text-ivory/50">{dict.cart.taxesNote}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ButtonLink href={localePath(locale, "/cart")} variant="outline" onClick={close}>
                  {dict.cart.viewCart}
                </ButtonLink>
                <Button disabled title={dict.cart.checkoutSoon}>
                  {dict.cart.checkoutSoon}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
