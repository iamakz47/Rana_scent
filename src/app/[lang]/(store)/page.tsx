import { Fragment } from "react";
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
import { getHomepageContent, type HomepageSectionKey } from "@/features/merchandising/homepage-content";
import { OfferCard } from "@/features/offers/components/offer-card";
import { listOffers } from "@/features/offers/data";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

// Curated pairings for the space finder (sample merchandising). With the
// live catalog, picks come from published products tagged with each space.
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
  const [locale, dict, categories, all, refills, offers, content] = await Promise.all([
    getLocale(),
    getDictionary(),
    listHomeCategories(),
    listProducts(),
    listProducts({ type: ["refill"] }),
    listOffers(),
    getHomepageContent(),
  ]);
  const isSampleCatalog = all.some((product) => product.isSample);

  const featured = all.filter((product) => product.featured && product.type !== "bundle").slice(0, 6);
  const familyCounts = Object.fromEntries(
    scentFamilies.map((family) => [family, refills.filter((refill) => refill.scentFamily === family).length]),
  ) as Record<ScentFamily, number>;

  const pickFor = async (space: Space) => {
    if (isSampleCatalog) {
      const pick = finderPicks[space];
      const [device, ...pairs] = await getProductsBySlug([pick.device, ...pick.refills]);
      return device ? { device, pairs } : null;
    }
    const device = all.find((product) => product.type === "diffuser" && product.spaces.includes(space));
    if (!device) return null;
    return { device, pairs: refills.filter((refill) => refill.spaces.includes(space)).slice(0, 2) };
  };

  const picks = (await Promise.all(spaces.map(async (space) => [space, await pickFor(space)] as const))).filter(
    (entry): entry is readonly [Space, NonNullable<Awaited<ReturnType<typeof pickFor>>>] => entry[1] !== null,
  );

  const panels = Object.fromEntries(
    picks.map(([space, { device, pairs }]) => [
      space,
      <div key={space} className="grid gap-8 md:grid-cols-[1fr_1.5fr] lg:gap-12">
        <div>
          <p className="mb-4 text-step--1 text-gold-deep">{dict.home.finderDevice}</p>
          <ProductCard product={device} locale={locale} dict={dict} morph={false} />
        </div>
        {pairs.length > 0 && (
          <div>
            <p className="mb-4 text-step--1 text-gold-deep">{dict.home.finderRefills}</p>
            <div className="grid grid-cols-2 gap-4">
              {pairs.map((refill) => (
                <ProductCard key={refill.id} product={refill} locale={locale} dict={dict} morph={false} />
              ))}
            </div>
          </div>
        )}
      </div>,
    ]),
  ) as Record<Space, React.ReactNode>;

  const sections: Record<HomepageSectionKey, React.ReactNode> = {
    categories: <CategoryShowcase categories={categories} locale={locale} dict={dict} offerImage={offers.find((offer) => offer.image)?.image} />,
    featured: featured.length > 0 && (
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
    ),
    collections: refills.length > 0 && (
      <FragranceCollections locale={locale} dict={dict} counts={familyCounts} />
    ),
    scent_library: refills.length > 0 && (
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
    ),
    finder: picks.length > 0 && (
      <SpaceFinder spaces={picks.map(([space]) => space)} panels={panels} />
    ),
    story: <Story />,
    // The admin's "sets" slot now shows the current offers (hidden when there are none).
    sets: offers.length > 0 && (
      <section aria-labelledby="sets-title" className="relative overflow-hidden bg-beige" data-testid="home-offers">
        <div className="container-page py-20 lg:py-28">
          <div className="reveal flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <h2 id="sets-title" className="font-display text-step-5 leading-[1] text-ink">
                {dict.home.setsTitle}
              </h2>
              <p className="mt-5 text-step-1 text-ink-soft">{dict.home.setsBody}</p>
            </div>
            <ButtonLink href={localePath(locale, "/offers")} size="lg" variant="outline">
              {dict.home.setsCta}
            </ButtonLink>
          </div>
          <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-3">
            {offers.slice(0, 3).map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),
  };

  return (
    <>
      {/* Hero slider first; then the sections in the admin-defined order. */}
      <HeroSlider locale={locale} dict={dict} settings={content.settings} slides={content.slides} />
      {content.sections.map((key) => (
        <Fragment key={key}>{sections[key]}</Fragment>
      ))}
    </>
  );
}
