"use client";

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { useWishlist } from "./store";

// Cards are rendered on the server for every product; this component shows
// the ones the visitor saved (stored locally until accounts arrive).
export function WishlistGrid({ cards }: { cards: Record<string, ReactNode> }) {
  const { locale, dict } = useI18n();
  const saved = useWishlist().filter((slug) => slug in cards);

  if (saved.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gold-400/25 px-6 py-24 text-center">
        <p className="font-display text-step-4 text-ivory">{dict.wishlist.empty}</p>
        <p className="mx-auto mt-3 max-w-md text-ivory/60">{dict.wishlist.emptyBody}</p>
        <ButtonLink href={localePath(locale, "/shop")} className="mt-8" size="lg">
          {dict.cart.startShopping}
        </ButtonLink>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4">
      {saved.map((slug) => (
        <li key={slug}>{cards[slug]}</li>
      ))}
    </ul>
  );
}
