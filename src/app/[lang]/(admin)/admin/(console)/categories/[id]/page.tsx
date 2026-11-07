import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/features/admin/auth/dal";
import { CategoryForm } from "@/features/admin/categories/category-form";
import { getMediaLibrary } from "@/features/admin/categories/values";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader } from "@/features/admin/ui/primitives";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.categories.editTitle };
}

export default async function EditCategoryPage({ params }: PageProps<"/[lang]/admin/categories/[id]">) {
  await requireStaff("catalog.write");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { locale, t } = await getAdminDictionary();
  const supabase = await createClient();
  const [{ data: c }, library] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).maybeSingle(),
    getMediaLibrary(locale),
  ]);
  if (!c) notFound();
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t.categories.title} title={locale === "ar" ? c.name_ar : c.name_en} />
      <CategoryForm
        library={library}
        values={{
          id: c.id,
          slug: c.slug,
          product_type: c.product_type ?? "",
          name_ar: c.name_ar,
          name_en: c.name_en,
          description_ar: c.description_ar,
          description_en: c.description_en,
          image_id: c.image_id ?? "",
          position: c.position,
          is_visible: c.is_visible,
          show_on_home: c.show_on_home,
          seo_title_ar: c.seo_title_ar,
          seo_title_en: c.seo_title_en,
          seo_description_ar: c.seo_description_ar,
          seo_description_en: c.seo_description_en,
          archived: Boolean(c.archived_at),
        }}
      />
    </div>
  );
}
