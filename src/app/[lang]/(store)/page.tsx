import Link from "next/link";
import { ProductVisual } from "@/components/brand/product-visual";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/features/catalog/components/product-card";
import { getProductsBySlug, listHomeCategories, listProducts } from "@/features/catalog/queries";
import { lowestPrice, scentFamilies, spaces, type ScentFamily, type Space } from "@/features/catalog/types";
import { FragranceCollections } from "@/features/home/fragrance-collections";
import { ScentLibrary } from "@/features/home/scent-library";
import { SpaceFinder } from "@/features/home/space-finder";
import { Story } from "@/features/home/story";
import { CategoryShowcase } from "@/features/merchandising/category-showcase";
import { HeroSlider } from "@/features/merchandising/hero-slider";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { formatKWD } from "@/lib/money";

// Curated pairings for the space finder (sample merchandising).
const finderPicks: Record<Space, { device: string; refills: [string, string] }> = {
  majlis: { device: "rana-tower", refills: ["oud-royale", "cedar-smoke"] },
  living: { device: "rana-aura", refills: ["midnight-musk", "damask-rose"] },
  bedroom: { device: "rana-mini", refills: ["midnight-musk", "white-jasmine"] },
  office: { device: "rana-majlis", refills: ["sea-salt-vetiver", "cedar-smoke"] },
  car: { device: "rana-drive", refills: ["sea-salt-vetiver", "oud-royale"] },
};

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function HomePage() {
  const [locale, dict, categories, all, refills, sets] = await Promise.all([
    getLocale(),
    getDictionary(),
    listHomeCategories(),
    listProducts(),
    listProducts({ type: ["refill"] }),
    listProducts({ type: ["bundle"] }),
  ]);

  const featured = all.filter((product) => product.featured && product.type !== "bundle").slice(0, 6);
  const familyCounts = Object.fromEntries(
    scentFamilies.map((family) => [family, refills.filter((refill) => refill.scentFamily === family).length]),
  ) as Record<ScentFamily, number>;

  const panels = Object.fromEntries(
    await Promise.all(
      spaces.map(async (space) => {
        const pick = finderPicks[space];
        const [device, ...pairs] = await getProductsBySlug([pick.device, ...pick.refills]);
        return [
          space,
          <div key={space} className="grid gap-8 md:grid-cols-[1fr_1.5fr] lg:gap-12">
            <div>
              <p className="mb-4 text-step--1 text-gold-deep">{dict.home.finderDevice}</p>
              <ProductCard product={device} locale={locale} dict={dict} morph={false} />
            </div>
            <div>
              <p className="mb-4 text-step--1 text-gold-deep">{dict.home.finderRefills}</p>
              <div className="grid grid-cols-2 gap-4">
                {pairs.map((refill) => (
                  <ProductCard key={refill.id} product={refill} locale={locale} dict={dict} morph={false} />
                ))}
              </div>
            </div>
          </div>,
        ];
      }),
    ),
  ) as Record<Space, React.ReactNode>;

  return (
    <>
      {/* Hero slider, then categories, with nothing in between. */}
      <HeroSlider locale={locale} dict={dict} />
      <CategoryShowcase categories={categories} locale={locale} dict={dict} />

      <section aria-labelledby="featured-title" className="bg-canvas pb-24 lg:pb-32">
        <div className="container-page">
          <SectionHeading
            id="featured-title"
            title={dict.home.featuredTitle}
            body={dict.home.featuredBody}
            action={
              <ButtonLink href={localePath(locale, "/shop")} variant="outline">
                {dict.common.viewAll}
              </ButtonLink>
            }
            className="reveal"
          />
          <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-3">
            {featured.map((product) => (
              <li key={product.id} className="reveal">
                <ProductCard product={product} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FragranceCollections locale={locale} dict={dict} counts={familyCounts} />

      <ScentLibrary
        refills={refills.map((refill) => ({
          id: refill.id,
          slug: refill.slug,
          name: refill.name,
          tagline: refill.tagline,
          scentFamily: refill.scentFamily,
          notes: refill.notes,
          priceFils: lowestPrice(refill),
          image: refill.images[0]?.src,
        }))}
      />

      <SpaceFinder spaces={[...spaces]} panels={panels} />

      <Story />

      {sets.length > 0 && (
        <section aria-labelledby="sets-title" className="relative overflow-hidden bg-beige">
          <div className="container-page grid items-center gap-10 py-20 md:grid-cols-2 lg:py-28">
            <div className="reveal max-w-lg">
              <h2 id="sets-title" className="font-display text-step-5 leading-[1] text-ink">
                {dict.home.setsTitle}
              </h2>
              <p className="mt-5 text-step-1 text-ink-soft">{dict.home.setsBody}</p>
              <ul className="mt-8 space-y-3">
                {sets.map((set) => (
                  <li key={set.id}>
                    <Link
                      href={localePath(locale, `/products/${set.slug}`)}
                      className="flex min-h-11 items-baseline justify-between gap-4 border-b border-ink/15 pb-3 transition-colors hover:border-gold-deep"
                    >
                      <span className="font-display text-step-2 text-ink">{set.name[locale]}</span>
                      <span className="text-ink tabular-nums">{formatKWD(lowestPrice(set), locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <ButtonLink href={localePath(locale, "/collections/bundles")} className="mt-9" size="lg">
                {dict.home.setsCta}
              </ButtonLink>
            </div>
            <ProductVisual
              src="/images/products/rana-tower.jpg"
              alt={dict.home.setsImageAlt}
              pendingLabel={dict.common.photoComingSoon}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="reveal aspect-square rounded-[2.5rem] bg-canvas"
            />
          </div>
        </section>
      )}
    </>
  );
}
