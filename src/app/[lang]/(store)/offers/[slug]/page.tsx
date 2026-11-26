import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductVisual } from "@/components/brand/product-visual";
import { listFreeFragrances } from "@/features/catalog/queries";
import { OfferPurchasePanel } from "@/features/offers/components/offer-purchase-panel";
import { getOffer, listOffers } from "@/features/offers/data";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

// Live-catalog slugs that weren't prerendered render on request. Blocking
// (rather than streaming behind a skeleton) keeps a real 404 status for an
// unknown, unpublished or since-expired offer slug.
export const instant = false;

export async function generateStaticParams() {
  const offers = await listOffers();
  // Cache Components needs at least one param; an unknown slug renders 404.
  return offers.length ? offers.map((offer) => ({ slug: offer.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/offers/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const offer = await getOffer(slug);
  if (!offer) return {};
  return {
    title: offer.name[locale],
    description: offer.description[locale],
    alternates: {
      canonical: `/${locale}/offers/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/offers/${slug}`])),
    },
  };
}

export default async function OfferPage({ params }: PageProps<"/[lang]/offers/[slug]">) {
  const [{ slug }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const offer = await getOffer(slug);
  if (!offer) notFound();

  // Fetched once and shared by every item's picker, same as the standalone
  // product page.
  const fragrances = offer.items.some((item) => item.freeFragrances) ? await listFreeFragrances() : [];
  const description = offer.description[locale]?.trim() ?? "";

  return (
    <section className="pb-20 pt-8 lg:pt-12">
      <div className="container-page">
        <nav aria-label={dict.offers.breadcrumb} className="mb-8 text-step--1 text-ink-soft">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href={localePath(locale)} className="hover:text-ink">
                {dict.nav.home}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={localePath(locale, "/offers")} className="hover:text-ink">
                {dict.offers.title}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-ink">
              {offer.name[locale]}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 xl:gap-24">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-ink/10 bg-beige">
              <ProductVisual
                src={offer.image?.src}
                alt={offer.image?.alt[locale] ?? offer.name[locale]}
                pendingLabel={dict.common.photoComingSoon}
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
                className="aspect-[4/5]"
              />
            </div>
            {description ? <p className="text-step-0 text-ink-soft" data-testid="offer-description">{description}</p> : null}
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <h1 className="font-display text-step-5 leading-[1] text-ink">{offer.name[locale]}</h1>

            <div className="mt-8 border-t border-ink/10 pt-8">
              <h2 className="font-display text-step-2 text-ink">{dict.offers.whatsIncluded}</h2>
              <div className="mt-4">
                <OfferPurchasePanel offer={offer} fragrances={fragrances} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
