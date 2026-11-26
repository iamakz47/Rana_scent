import Link from "next/link";
import type { ReactNode } from "react";
import { ProductVisual } from "@/components/brand/product-visual";
import { ChevronIcon } from "@/components/ui/icons";
import type { Category, ProductImage } from "@/features/catalog/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

type Card = {
  key: string;
  href: string;
  title: string;
  body: string;
  visual: ReactNode;
  offers?: boolean;
};

const arch = (
  <svg
    aria-hidden
    viewBox="0 0 400 500"
    className="absolute inset-x-[12%] bottom-0 h-[88%] w-[76%] text-sand"
    fill="none"
    preserveAspectRatio="none"
  >
    <path d="M0 500 V200 a200 200 0 0 1 400 0 V500" fill="currentColor" fillOpacity="0.6" />
  </svg>
);

const zoom =
  "h-full w-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/cat:-translate-y-1.5 group-hover/cat:scale-[1.04] motion-reduce:transform-none";

// Quick-access categories directly under the hero, plus Offers & Bundles as
// a fourth card. Desktop: a balanced four-card grid. Phones: a horizontal
// carousel that snaps card by card. Each card is one link.
export function CategoryShowcase({
  categories,
  locale,
  dict,
  offerImage,
}: {
  categories: Category[];
  locale: Locale;
  dict: Dictionary;
  // A real photo from a current offer, when there is one.
  offerImage?: ProductImage;
}) {
  const cards: Card[] = [
    ...categories.map((category) => ({
      key: category.slug,
      href: localePath(locale, `/collections/${category.slug}`),
      title: category.name[locale],
      body: category.description[locale],
      visual: (
        <ProductVisual
          src={category.image?.src}
          alt=""
          pendingLabel={dict.common.photoComingSoon}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 72vw"
          backdrop={arch}
          className={zoom}
        />
      ),
    })),
    {
      key: "offers",
      href: localePath(locale, "/offers"),
      title: dict.home.offersCardTitle,
      body: dict.home.offersCardBody,
      offers: true,
      visual: offerImage ? (
        <ProductVisual src={offerImage.src} alt="" pendingLabel={dict.common.photoComingSoon} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 72vw" backdrop={arch} className={zoom} />
      ) : (
        // No offer photo yet: a gold panel with a simple gift-bundle motif.
        <div className={cn(zoom, "relative grid place-items-center bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--color-gold)_55%,transparent),transparent_70%)]")}>
          <svg aria-hidden viewBox="0 0 120 120" className="w-[42%] text-gold-deep" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="18" y="46" width="84" height="58" rx="6" />
            <path d="M12 34h96v14H12zM60 34v70" />
            <path d="M60 34c-6-14-26-18-26-6 0 6 12 6 26 6zM60 34c6-14 26-18 26-6 0 6-12 6-26 6z" />
          </svg>
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="categories-title" className="bg-canvas py-14 sm:py-20 lg:py-24">
      <div className="container-page">
        <h2 id="categories-title" className="font-display text-step-4 leading-[1.05] text-ink">
          {dict.home.categoriesTitle}
        </h2>

        <ul
          className="scrollbar-none -mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:mt-10 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-5"
          data-testid="home-categories"
        >
          {cards.map((card, index) => (
            <li
              key={card.key}
              className="reveal w-[72vw] max-w-[19rem] shrink-0 snap-start sm:w-auto sm:max-w-none"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <Link
                href={card.href}
                data-testid={card.offers ? "home-offers-card" : undefined}
                className={cn(
                  "group/cat flex h-full flex-col rounded-[1.75rem] border p-3 transition-[background-color,border-color,box-shadow,transform] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[0_24px_50px_-32px_rgba(53,42,36,0.5)] active:translate-y-0 motion-reduce:transform-none sm:rounded-[2rem]",
                  card.offers
                    ? "border-gold/60 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-gold)_22%,var(--color-surface)),var(--color-beige))] hover:border-gold-deep"
                    : "border-ink/8 bg-surface hover:border-gold/60 hover:bg-beige",
                )}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.35rem] bg-beige sm:rounded-[1.5rem] lg:aspect-[4/5]">
                  {card.visual}
                  {card.offers ? (
                    <span className="absolute start-3 top-3 rounded-full bg-gold px-3 py-1 text-[0.7rem] font-semibold text-ink shadow-sm">
                      {dict.home.offersCardBadge}
                    </span>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 pb-1 pt-4 sm:px-2 sm:pb-2 sm:pt-5">
                  <div className="min-w-0">
                    <h3 className="font-display text-step-2 leading-tight text-ink">{card.title}</h3>
                    <p className="mt-1 line-clamp-2 text-step--1 text-ink-soft">{card.body}</p>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-full border transition-[background-color,color,border-color] duration-500 group-hover/cat:border-ink group-hover/cat:bg-ink group-hover/cat:text-canvas",
                      card.offers ? "border-gold-deep/40 text-gold-deep" : "border-ink/15 text-ink",
                    )}
                  >
                    <ChevronIcon size={18} className="rtl:rotate-180" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
