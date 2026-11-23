import Link from "next/link";
import { ProductVisual } from "@/components/brand/product-visual";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { localePath, type Locale } from "@/i18n/config";
import type { Offer } from "../types";

// A listing card for one offer: promotional image (or the shared "photo
// coming soon" panel), name, how many products it includes, the original
// price struck through against the offer price, and a savings badge. Not a
// Product, so this doesn't try to reuse ProductCardView.
export function OfferCard({ offer, locale, dict }: { offer: Offer; locale: Locale; dict: Dictionary }) {
  const href = localePath(locale, `/offers/${offer.slug}`);
  const count = offer.items.length;

  return (
    <article className="group/card relative flex h-full flex-col" data-testid="offer-card">
      {/* The title link below is the accessible link; this image link is a
          duplicate pointer target, hidden from assistive tech and tab order. */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative block overflow-hidden rounded-[1.75rem] border border-ink/10 bg-beige transition-[border-color,box-shadow] duration-700 ease-[var(--ease-out-expo)] group-hover/card:border-gold/45 group-hover/card:shadow-[0_28px_60px_-34px_rgba(53,42,36,0.45)]"
      >
        <ProductVisual
          src={offer.image?.src}
          alt={offer.image?.alt[locale] ?? offer.name[locale]}
          pendingLabel={dict.common.photoComingSoon}
          sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, 50vw"
          className="aspect-[4/5] transition-transform duration-[900ms] ease-[var(--ease-out-expo)] group-hover/card:-translate-y-2 group-hover/card:scale-[1.03] motion-reduce:transform-none"
        />
        {offer.savingsPercent > 0 ? (
          <span
            className="absolute start-4 top-4 rounded-full bg-gold px-2.5 py-1 text-[0.65rem] font-semibold text-ink"
            data-testid="offer-savings-badge"
          >
            {format(dict.offers.percentOff, { percent: offer.savingsPercent })}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-1 pt-4">
        <h3 className="font-display leading-tight text-ink text-step-2">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-[1.75rem] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-gold-deep"
          >
            {offer.name[locale]}
          </Link>
        </h3>
        <p className="text-step--1 text-ink-soft" data-testid="offer-includes-count">
          {count === 1 ? dict.offers.includesOne : format(dict.offers.includes, { count })}
        </p>
        <Price fils={offer.priceFils} compareAtFils={offer.originalPriceFils} locale={locale} />
        <Link
          href={href}
          className="relative z-10 mt-auto inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-ink/15 px-4 text-step--1 text-ink transition-colors duration-300 hover:border-gold hover:text-gold-deep"
        >
          {dict.offers.detailsButton}
        </Link>
      </div>
    </article>
  );
}
