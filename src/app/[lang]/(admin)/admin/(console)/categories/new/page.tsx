import type { Metadata } from "next";
import { requireStaff } from "@/features/admin/auth/dal";
import { CategoryForm } from "@/features/admin/categories/category-form";
import { emptyCategory, getMediaLibrary } from "@/features/admin/categories/values";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.categories.newTitle };
}

export default async function NewCategoryPage() {
  await requireStaff("catalog.write");
  const { locale, t } = await getAdminDictionary();
  const library = await getMediaLibrary(locale);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t.categories.title} title={t.categories.newTitle} />
      <CategoryForm values={emptyCategory} library={library} />
    </div>
  );
}
