import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { getAdminProduct, getProductFormOptions } from "@/features/admin/data/catalog";
import { getAdminDictionary } from "@/features/admin/i18n";
import { ProductEditor } from "@/features/admin/products/product-editor";
import { toProductOptions, toProductValues } from "@/features/admin/products/values";
import { AdminPageHeader, Badge, statusTone } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.products.editTitle };
}

export default async function EditProductPage({ params, searchParams }: PageProps<"/[lang]/admin/products/[id]">) {
  const staff = await requireStaff("catalog.read");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ locale, t }, product, options] = await Promise.all([getAdminDictionary(), getAdminProduct(id), getProductFormOptions(id)]);
  if (!product) notFound();
  const values = toProductValues(product);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t.products.title}
        title={locale === "ar" ? values.name_ar : values.name_en}
        actions={<Badge tone={statusTone(values.status)}>{t.status[values.status]}</Badge>}
      />
      {can(staff, "catalog.write") ? (
        <ProductEditor
          values={values}
          options={toProductOptions(options, locale)}
          canPublish={can(staff, "catalog.publish")}
          created={query.created === "1"}
        />
      ) : (
        <p className="text-ink-soft">{t.common.readOnly}</p>
      )}
    </div>
  );
}
