import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CartView } from "@/features/cart/cart-view";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.cart.title, robots: { index: false } };
}

export default async function CartPage() {
  const dict = await getDictionary();
  return (
    <>
      <PageHeader title={dict.cart.title} />
      <div className="container-page pb-24 pt-10">
        <CartView />
      </div>
    </>
  );
}
