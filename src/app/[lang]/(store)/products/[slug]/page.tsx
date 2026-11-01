import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScentField } from "@/components/brand/scent-field";
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
  return products.map((product) => ({ slug: product.slug }));
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
      <section className="grain relative isolate overflow-hidden pb-20 pt-28 lg:pt-32">
        <ScentField tint={tint} originX={0.28} originY={-0.3} intensity={0.55} className="opacity-70" />
        <div className="container-page relative">
          <nav aria-label={dict.product.breadcrumb} className="mb-8 text-step--1 text-ivory/55">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href={localePath(locale)} className="hover:text-ivory">
                  {dict.nav.home}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={localePath(locale, "/shop")} className="hover:text-ivory">
                  {dict.nav.shop}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ivory/85">
                {product.name[locale]}
              </li>
            </ol>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 xl:gap-24">
            <ProductGallery product={product} />

            <div className="lg:sticky lg:top-28 lg:self-start">
              {product.scentFamily && (
                <p className="flex items-center gap-2 text-step--1" style={{ color: tint }}>
                  <span aria-hidden className="h-px w-8 bg-current" />
                  {dict.families[product.scentFamily]}
                </p>
              )}
              <h1 className="mt-3 font-display text-step-5 leading-[1] text-ivory">{product.name[locale]}</h1>
              <p className="mt-4 text-step-1 text-ivory/70">{product.tagline[locale]}</p>
              <p className="mt-4 max-w-prose text-ivory/60">{product.description[locale]}</p>
              <p className="mt-4 inline-block rounded-full border border-white/12 px-3 py-1 text-step--1 text-ivory/55">
                {dict.common.sampleNotice}
              </p>

              <div className="mt-8 border-t border-gold-400/15 pt-8">
                <PurchasePanel product={product} />
              </div>

              {product.notes && (
                <section aria-labelledby="notes-title" className="mt-10 border-t border-gold-400/15 pt-8">
                  <h2 id="notes-title" className="font-display text-step-2 text-ivory">
                    {dict.product.notes}
                  </h2>
                  <dl className="mt-5 grid grid-cols-3 gap-4">
                    {(["top", "heart", "base"] as const).map((key) => (
                      <div key={key} className="rounded-2xl border border-white/8 bg-navy-900/50 p-4">
                        <dt className="text-step--1 text-ivory/50">{dict.product[key]}</dt>
                        <dd className="mt-1 text-ivory">{product.notes![key][locale]}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {product.type === "diffuser" && (
                <section aria-labelledby="specs-title" className="mt-10 border-t border-gold-400/15 pt-8">
                  <h2 id="specs-title" className="font-display text-step-2 text-ivory">
                    {dict.product.specs}
                  </h2>
                  <p className="mt-3 text-ivory/60">{dict.product.specsPending}</p>
                </section>
              )}

              {contents.length > 0 && (
                <section aria-labelledby="contents-title" className="mt-10 border-t border-gold-400/15 pt-8">
                  <h2 id="contents-title" className="font-display text-step-2 text-ivory">
                    {dict.product.inTheSet}
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {contents.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={localePath(locale, `/products/${item.slug}`)}
                          className="flex min-h-11 items-center justify-between rounded-xl px-1 text-ivory/85 hover:text-gold-200"
                        >
                          {item.name[locale]}
                          <span className="text-ivory/45 tabular-nums">
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
        <section aria-labelledby="compat-title" className="bg-navy-900 py-20">
          <div className="container-page">
            <h2 id="compat-title" className="font-display text-step-4 text-ivory">
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
          <h2 id="related-title" className="font-display text-step-4 text-ivory">
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
