import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProductGrid } from "@/features/catalog/components/product-grid";
import { getCategory, listCategories, listProducts } from "@/features/catalog/queries";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

const typeCollections: Record<string, string> = {
  diffusers: "diffuser",
  refills: "refill",
  bundles: "bundle",
  accessories: "accessory",
};

// Live-catalog slugs that weren't prerendered render on request. Blocking
// (rather than streaming behind a skeleton) keeps a real 404 status for
// unknown or unpublished products.
export const instant = false;

export async function generateStaticParams() {
  const categories = await listCategories();
  // Cache Components needs at least one param; an unknown slug renders 404.
  return categories.length ? categories.map((category) => ({ slug: category.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/collections/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const category = await getCategory(slug);
  if (!category) return {};
  return {
    title: category.name[locale],
    description: category.description[locale],
    alternates: {
      canonical: `/${locale}/collections/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/collections/${slug}`])),
    },
  };
}

export default async function CollectionPage({ params }: PageProps<"/[lang]/collections/[slug]">) {
  const [{ slug }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  const category = await getCategory(slug);
  if (!category) {
    // The main navigation links to type collections ("Sets" -> bundles). When
    // the live catalog has no category with that slug, show the same products
    // through the shop's type filter instead of a dead end.
    const type = typeCollections[slug];
    if (type) redirect(localePath(locale, `/shop?type=${type}`));
    notFound();
  }
  const products = await listProducts({ category: category.slug });

  return (
    <>
      <PageHeader title={category.name[locale]} body={category.description[locale]} />
      <div className="container-page pb-24 pt-10">
        <h2 className="sr-only">{category.name[locale]}</h2>
        <ProductGrid products={products} locale={locale} dict={dict} />
      </div>
    </>
  );
}
