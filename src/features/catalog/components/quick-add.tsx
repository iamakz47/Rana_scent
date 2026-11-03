"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { BagIcon, CheckIcon } from "@/components/ui/icons";
import { addToCart, setCartDrawerOpen } from "@/features/cart/store";
import type { CartLine } from "@/features/cart/store";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

// Adds the first in-stock variant straight from a product card.
export function QuickAdd({ line, disabled, className }: { line: Omit<CartLine, "quantity">; disabled?: boolean; className?: string }) {
  const { locale, dict } = useI18n();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${disabled ? dict.product.outOfStock : dict.product.addToCart}: ${line.name[locale]}`}
      onClick={(event) => {
        event.preventDefault();
        addToCart(line);
        setAdded(true);
        setCartDrawerOpen(true);
        window.setTimeout(() => setAdded(false), 1600);
      }}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full bg-gold text-ink shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 disabled:bg-none disabled:bg-ink/8 disabled:text-ink-soft",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={added ? "done" : "add"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="inline-flex"
        >
          {added ? <CheckIcon size={20} /> : <BagIcon size={20} />}
        </m.span>
      </AnimatePresence>
    </button>
  );
}
