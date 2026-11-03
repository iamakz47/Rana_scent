import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogFilters } from "@/features/catalog/components/catalog-filters";
import { ProductGrid, ProductGridSkeleton } from "@/features/catalog/components/product-grid";
import { listProducts, parseCatalogFilter } from "@/features/catalog/queries";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return {
    title: dict.shop.title,
    description: dict.shop.body,
    alternates: {
      canonical: `/${locale}/shop`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/shop`])),
    },
  };
}

async function Results({ searchParams }: { searchParams: PageProps<"/[lang]/shop">["searchParams"] }) {
  const [locale, dict, params] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  const products = await listProducts(parseCatalogFilter(params));
  return <ProductGrid products={products} locale={locale} dict={dict} />;
}

export default async function ShopPage({ searchParams }: PageProps<"/[lang]/shop">) {
  const dict = await getDictionary();

  return (
    <>
      <PageHeader title={dict.shop.title} body={dict.shop.body} />
      <div className="container-page pb-24">
        <div className="pt-8">
          <Suspense>
            <CatalogFilters />
          </Suspense>
        </div>
        <div className="mt-8">
          <Suspense fallback={<ProductGridSkeleton />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
