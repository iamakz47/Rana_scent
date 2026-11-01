import Link from "next/link";
import { ProductArt } from "@/components/brand/product-art";
import { ScentField } from "@/components/brand/scent-field";
import { GOLD_HEX } from "@/components/brand/scent-colors";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/features/catalog/components/product-card";
import { getProductsBySlug, listProducts } from "@/features/catalog/queries";
import { lowestPrice, spaces, type Space } from "@/features/catalog/types";
import { Hero } from "@/features/home/hero";
import { ScentLibrary } from "@/features/home/scent-library";
import { SpaceFinder } from "@/features/home/space-finder";
import { Story } from "@/features/home/story";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { formatKWD } from "@/lib/money";

// Curated pairings for the space finder (sample merchandising).
const finderPicks: Record<Space, { device: string; refills: [string, string] }> = {
  majlis: { device: "rana-majlis", refills: ["oud-royale", "cedar-smoke"] },
  living: { device: "rana-aura", refills: ["midnight-musk", "damask-rose"] },
  bedroom: { device: "rana-aura", refills: ["midnight-musk", "white-jasmine"] },
  office: { device: "rana-aura", refills: ["sea-salt-vetiver", "cedar-smoke"] },
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
  const [locale, dict, refills, devices, sets] = await Promise.all([
    getLocale(),
    getDictionary(),
    listProducts({ type: ["refill"] }),
    listProducts({ type: ["diffuser"] }),
    listProducts({ type: ["bundle"] }),
  ]);

  const panels = Object.fromEntries(
    await Promise.all(
      spaces.map(async (space) => {
        const pick = finderPicks[space];
        const [device, ...pairs] = await getProductsBySlug([pick.device, ...pick.refills]);
        return [
          space,
          <div key={space} className="grid gap-8 md:grid-cols-[1fr_1.5fr] lg:gap-12">
            <div>
              <p className="mb-4 text-step--1 text-gold-300">{dict.home.finderDevice}</p>
              <ProductCard product={device} locale={locale} dict={dict} morph={false} />
            </div>
            <div>
              <p className="mb-4 text-step--1 text-gold-300">{dict.home.finderRefills}</p>
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

  const [leadDevice, ...otherDevices] = devices;
  const leadSet = sets[0];

  return (
    <>
      <Hero locale={locale} dict={dict} />

      <ScentLibrary
        refills={refills.map((refill) => ({
          id: refill.id,
          slug: refill.slug,
          name: refill.name,
          tagline: refill.tagline,
          scentFamily: refill.scentFamily,
          notes: refill.notes,
          priceFils: lowestPrice(refill),
        }))}
      />

      <Story />

      <section aria-labelledby="devices-title" className="bg-navy-950 py-24 lg:py-32">
        <div className="container-page">
          <SectionHeading
            title={dict.home.devicesTitle}
            body={dict.home.devicesBody}
            action={
              <ButtonLink href={localePath(locale, "/collections/diffusers")} variant="outline">
                {dict.common.viewAll}
              </ButtonLink>
            }
            className="reveal [&_h2]:text-step-5"
          />
          {/* A staggered editorial row: each device steps down from the last. */}
          <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr] lg:items-start">
            <div className="reveal sm:col-span-2 lg:col-span-1">
              <ProductCard product={leadDevice} locale={locale} dict={dict} size="feature" />
            </div>
            {otherDevices.map((device, index) => (
              <div key={device.id} className={index === 0 ? "reveal lg:mt-28" : "reveal lg:mt-56"}>
                <ProductCard product={device} locale={locale} dict={dict} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <SpaceFinder spaces={[...spaces]} panels={panels} />

      {leadSet && (
        <section aria-labelledby="sets-title" className="relative overflow-hidden bg-porcelain text-navy-950">
          <div className="container-page grid items-center gap-10 py-20 md:grid-cols-2 lg:py-28">
            <div className="reveal max-w-lg">
              <h2 id="sets-title" className="font-display text-step-5 leading-[1]">
                {dict.home.setsTitle}
              </h2>
              <p className="mt-5 text-step-1 text-charcoal-600">{dict.home.setsBody}</p>
              <ul className="mt-8 space-y-3">
                {sets.map((set) => (
                  <li key={set.id}>
                    <Link
                      href={localePath(locale, `/products/${set.slug}`)}
                      className="group/set flex min-h-11 items-baseline justify-between gap-4 border-b border-navy-950/12 pb-3 transition-colors hover:border-gold-600"
                    >
                      <span className="font-display text-step-2">{set.name[locale]}</span>
                      <span className="text-gold-700 tabular-nums">
                        {formatKWD(lowestPrice(set), locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <ButtonLink href={localePath(locale, "/collections/bundles")} className="mt-9" size="lg">
                {dict.home.setsCta}
              </ButtonLink>
            </div>
            <div aria-hidden className="reveal relative aspect-square overflow-hidden rounded-[2.5rem] bg-[radial-gradient(80%_70%_at_50%_40%,#ffffff_0%,var(--color-porcelain-deep)_70%)]">
              <ProductArt art="bundle" family="oud" uid="sets-art" label="" className="absolute inset-0" />
            </div>
          </div>
        </section>
      )}

      <section className="grain relative isolate overflow-hidden bg-navy-950 py-32 text-center lg:py-44">
        <ScentField tint={GOLD_HEX} originX={0.5} originY={-0.15} intensity={0.85} />
        <div className="container-page relative">
          <p className="reveal mx-auto max-w-4xl font-display text-step-5 leading-[1.05] text-ivory">
            {dict.home.closingTitle}
          </p>
          <p className="reveal mx-auto mt-6 max-w-xl text-step-1 text-ivory/65">{dict.home.closingBody}</p>
        </div>
      </section>
    </>
  );
}
