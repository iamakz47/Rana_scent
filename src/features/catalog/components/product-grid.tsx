import { ViewTransition } from "react";
import { ButtonLink } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { localePath, type Locale } from "@/i18n/config";
import type { Product } from "../types";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  locale,
  dict,
  showCount = true,
}: {
  products: Product[];
  locale: Locale;
  dict: Dictionary;
  showCount?: boolean;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gold/50 px-6 py-20 text-center">
        <p className="font-display text-step-3 text-ink">{dict.shop.emptyTitle}</p>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{dict.shop.emptyBody}</p>
        <ButtonLink href={localePath(locale, "/shop")} variant="outline" className="mt-8">
          {dict.shop.clear}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      {showCount && (
        <p className="mb-6 text-step--1 text-ink-soft" aria-live="polite">
          {products.length === 1 ? dict.shop.resultsOne : format(dict.shop.results, { count: products.length })}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4">
        {products.map((product) => (
          // Keyed boundaries let filtered results animate into new positions.
          <ViewTransition key={product.id} default="none" update="auto">
            <li>
              <ProductCard product={product} locale={locale} dict={dict} />
            </li>
          </ViewTransition>
        ))}
      </ul>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden>
      <div className="skeleton mb-6 h-4 w-28 rounded-full" />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <div className="skeleton aspect-[4/5] rounded-[1.75rem]" />
            <div className="skeleton mt-4 h-5 w-3/4 rounded-full" />
            <div className="skeleton mt-3 h-4 w-1/2 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
