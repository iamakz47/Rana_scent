import Link from "next/link";
import { ProductVisual } from "@/components/brand/product-visual";
import { ChevronIcon } from "@/components/ui/icons";
import type { Category } from "@/features/catalog/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";

// Quick-access categories directly under the hero. Desktop: three tall
// cards. Phones: full-width rows sized for one-handed tapping. The whole
// card is one link.
export function CategoryShowcase({
  categories,
  locale,
  dict,
}: {
  categories: Category[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="categories-title" className="bg-canvas py-14 sm:py-20 lg:py-24">
      <div className="container-page">
        <h2 id="categories-title" className="font-display text-step-4 leading-[1.05] text-ink">
          {dict.home.categoriesTitle}
        </h2>

        <ul className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4 lg:gap-6">
          {categories.map((category, index) => (
            <li key={category.slug} className="reveal" style={{ animationDelay: `${index * 60}ms` }}>
              <Link
                href={localePath(locale, `/collections/${category.slug}`)}
                className="group/cat flex h-full items-center gap-4 rounded-[1.5rem] border border-ink/8 bg-surface p-3 transition-[background-color,border-color,box-shadow,transform] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-gold/60 hover:bg-beige hover:shadow-[0_24px_50px_-32px_rgba(53,42,36,0.5)] active:translate-y-0 motion-reduce:transform-none sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-[2rem] sm:p-3"
              >
                <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-[1.1rem] bg-beige sm:aspect-[4/5] sm:w-full sm:rounded-[1.5rem] lg:aspect-[5/4]">
                  <ProductVisual
                    image={{ src: category.image.src, art: category.image.art, view: "front", alt: "" }}
                    family={category.image.family}
                    uid={`category-${category.slug}`}
                    sizes="(min-width: 640px) 33vw, 96px"
                    decorative
                    backdrop={
                    <svg
                      aria-hidden
                      viewBox="0 0 400 500"
                      className="absolute inset-x-[12%] bottom-0 h-[88%] w-[76%] text-sand"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path d="M0 500 V200 a200 200 0 0 1 400 0 V500" fill="currentColor" fillOpacity="0.6" />
                    </svg>
                    }
                    className="h-full w-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/cat:-translate-y-1.5 group-hover/cat:scale-[1.04] motion-reduce:transform-none"
                  />
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:px-2 sm:pb-2 sm:pt-5">
                  <div className="min-w-0">
                    <h3 className="font-display text-step-2 leading-tight text-ink">{category.name[locale]}</h3>
                    <p className="mt-1 line-clamp-2 text-step--1 text-ink-soft">{category.description[locale]}</p>
                  </div>
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink transition-[background-color,color,border-color] duration-500 group-hover/cat:border-ink group-hover/cat:bg-ink group-hover/cat:text-canvas"
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
