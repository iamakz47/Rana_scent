import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GOLD_HEX, scentHex } from "@/components/brand/scent-colors";
import { ProductCard } from "@/features/catalog/components/product-card";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { PurchasePanel } from "@/features/catalog/components/purchase-panel";
import { getProduct, getProductsBySlug, getRelatedProducts, listProducts } from "@/features/catalog/queries";
import { lowestPrice, productStock } from "@/features/catalog/types";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getSiteUrl } from "@/lib/env";
import { FILS_PER_KWD } from "@/lib/money";

export async function generateStaticParams() {
  const products = await listProducts();
  // Cache Components needs at least one param; an unknown slug renders 404.
  return products.length ? products.map((product) => ({ slug: product.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: product.name[locale],
    description: product.tagline[locale],
    alternates: {
      canonical: `/${locale}/products/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/products/${slug}`])),
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/[lang]/products/[slug]">) {
  const [{ slug }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const product = await getProduct(slug);
  if (!product) notFound();

  const [related, compatible, contents] = await Promise.all([
    getRelatedProducts(product),
    getProductsBySlug(product.compatibleWith),
    getProductsBySlug(product.bundleContents?.map((item) => item.slug) ?? []),
  ]);
  const tint = product.scentFamily ? scentHex[product.scentFamily] : GOLD_HEX;
  const compatibilityTitle =
    product.type === "diffuser"
      ? dict.product.fitsRefills
      : product.type === "accessory"
        ? dict.product.fitsAccessory
        : dict.product.fitsDevices;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name[locale],
    description: product.description[locale],
    sku: product.variants[0].sku,
    brand: { "@type": "Brand", name: "Rana Scent" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "KWD",
      lowPrice: (lowestPrice(product) / FILS_PER_KWD).toFixed(3),
      highPrice: (Math.max(...product.variants.map((v) => v.priceFils)) / FILS_PER_KWD).toFixed(3),
      offerCount: product.variants.length,
      availability: productStock(product) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/${locale}/products/${product.slug}`, getSiteUrl()).toString(),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output is escaped for "<" so it cannot close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="relative pb-20 pt-8 lg:pt-12">
        <div className="container-page">
          <nav aria-label={dict.product.breadcrumb} className="mb-8 text-step--1 text-ink-soft">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href={localePath(locale)} className="hover:text-ink">
                  {dict.nav.home}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={localePath(locale, "/shop")} className="hover:text-ink">
                  {dict.nav.shop}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ink">
                {product.name[locale]}
              </li>
            </ol>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 xl:gap-24">
            <ProductGallery product={product} />

            <div className="lg:sticky lg:top-28 lg:self-start">
              {product.scentFamily && (
                <p className="flex items-center gap-2 text-step--1 text-ink-soft">
                  <span aria-hidden className="h-0.5 w-8 rounded-full" style={{ background: tint }} />
                  {dict.families[product.scentFamily]}
                </p>
              )}
              <h1 className="mt-3 font-display text-step-5 leading-[1] text-ink">{product.name[locale]}</h1>
              <p className="mt-4 text-step-1 text-ink-soft">{product.tagline[locale]}</p>
              <p className="mt-4 max-w-prose text-ink-soft">{product.description[locale]}</p>
              {product.isSample ? (
                <p className="mt-4 inline-block rounded-full border border-ink/12 px-3 py-1 text-step--1 text-ink-soft">
                  {dict.common.sampleNotice}
                </p>
              ) : null}

              <div className="mt-8 border-t border-ink/10 pt-8">
                <PurchasePanel product={product} />
              </div>

              {product.notes && (
                <section aria-labelledby="notes-title" className="mt-10 border-t border-ink/10 pt-8">
                  <h2 id="notes-title" className="font-display text-step-2 text-ink">
                    {dict.product.notes}
                  </h2>
                  <dl className="mt-5 grid grid-cols-3 gap-4">
                    {(["top", "heart", "base"] as const).map((key) => (
                      <div key={key} className="rounded-2xl border border-ink/10 bg-surface p-4">
                        <dt className="text-step--1 text-ink-soft">{dict.product[key]}</dt>
                        <dd className="mt-1 text-ink">{product.notes![key][locale]}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {product.type === "diffuser" && (
                <section aria-labelledby="specs-title" className="mt-10 border-t border-ink/10 pt-8">
                  <h2 id="specs-title" className="font-display text-step-2 text-ink">
                    {dict.product.specs}
                  </h2>
                  {product.specs?.length ? (
                    <>
                      <dl className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
                        {product.specs.map((item) => (
                          <div key={item.label.en} className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-4 py-3">
                            <dt className="text-ink-soft">{item.label[locale]}</dt>
                            <dd className="text-ink">{item.value[locale]}</dd>
                          </div>
                        ))}
                      </dl>
                      {!product.specsConfirmed ? (
                        <p className="mt-3 text-step--1 text-ink-soft">{dict.product.specsProvisional}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-3 text-ink-soft">{dict.product.specsPending}</p>
                  )}
                </section>
              )}

              {contents.length > 0 && (
                <section aria-labelledby="contents-title" className="mt-10 border-t border-ink/10 pt-8">
                  <h2 id="contents-title" className="font-display text-step-2 text-ink">
                    {dict.product.inTheSet}
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {contents.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={localePath(locale, `/products/${item.slug}`)}
                          className="flex min-h-11 items-center justify-between rounded-xl px-1 text-ink hover:text-gold-deep"
                        >
                          {item.name[locale]}
                          <span className="text-ink-soft tabular-nums">
                            × {product.bundleContents?.find((entry) => entry.slug === item.slug)?.quantity}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>

      {compatible.length > 0 && (
        <section aria-labelledby="compat-title" className="bg-beige/60 py-20">
          <div className="container-page">
            <h2 id="compat-title" className="font-display text-step-4 text-ink">
              {compatibilityTitle}
            </h2>
            <ul className="scrollbar-none -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {compatible.map((item) => (
                <li key={item.id} className="w-[64vw] max-w-72 shrink-0 snap-start sm:w-64">
                  <ProductCard product={item} locale={locale} dict={dict} morph={false} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="related-title" className="py-20 lg:py-28">
        <div className="container-page">
          <h2 id="related-title" className="font-display text-step-4 text-ink">
            {dict.product.related}
          </h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} locale={locale} dict={dict} morph={!compatible.some((c) => c.id === item.id)} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
