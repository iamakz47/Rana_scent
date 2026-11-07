import type { Metadata } from "next";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { getProductFormOptions } from "@/features/admin/data/catalog";
import { getAdminDictionary } from "@/features/admin/i18n";
import { ProductEditor } from "@/features/admin/products/product-editor";
import { emptyProduct, toProductOptions } from "@/features/admin/products/values";
import { AdminPageHeader } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.products.newTitle };
}

export default async function NewProductPage() {
  const staff = await requireStaff("catalog.write");
  const [{ locale, t }, options] = await Promise.all([getAdminDictionary(), getProductFormOptions()]);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t.products.title} title={t.products.newTitle} body={t.products.emptyBody} />
      <ProductEditor values={emptyProduct} options={toProductOptions(options, locale)} canPublish={can(staff, "catalog.publish")} />
    </div>
  );
}
