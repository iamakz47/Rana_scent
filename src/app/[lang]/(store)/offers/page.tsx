import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { OfferCard } from "@/features/offers/components/offer-card";
import { listOffers } from "@/features/offers/data";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return {
    title: dict.offers.title,
    description: dict.offers.subtitle,
    alternates: {
      canonical: `/${locale}/offers`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/offers`])),
    },
  };
}

export default async function OffersPage() {
  const [locale, dict, offers] = await Promise.all([getLocale(), getDictionary(), listOffers()]);

  return (
    <>
      <PageHeader title={dict.offers.title} body={dict.offers.subtitle} />
      <div className="container-page pb-24 pt-10">
        <h2 className="sr-only">{dict.offers.title}</h2>
        {offers.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-gold/50 px-6 py-20 text-center">
            <p className="font-display text-step-3 text-ink">{dict.offers.emptyTitle}</p>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">{dict.offers.emptyBody}</p>
            <ButtonLink href={localePath(locale, "/shop")} variant="outline" className="mt-8">
              {dict.offers.browseShop}
            </ButtonLink>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4" data-testid="offers-grid">
            {offers.map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
