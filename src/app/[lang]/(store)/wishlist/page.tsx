import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProductCard } from "@/features/catalog/components/product-card";
import { listProducts } from "@/features/catalog/queries";
import { WishlistGrid } from "@/features/wishlist/wishlist-grid";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.wishlist.title, robots: { index: false } };
}

export default async function WishlistPage() {
  const [locale, dict, products] = await Promise.all([getLocale(), getDictionary(), listProducts()]);
  const cards = Object.fromEntries(
    products.map((product) => [
      product.slug,
      <ProductCard key={product.id} product={product} locale={locale} dict={dict} />,
    ]),
  );

  return (
    <>
      <PageHeader title={dict.wishlist.title} />
      <div className="container-page pb-24 pt-10">
        <WishlistGrid cards={cards} />
      </div>
    </>
  );
}
