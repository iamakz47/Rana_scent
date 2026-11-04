import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { getMediaLibrary } from "@/features/admin/categories/values";
import { SlideForm } from "@/features/admin/homepage/homepage-forms";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.homepage.editSlide };
}

export default async function EditSlidePage({ params }: PageProps<"/[lang]/admin/homepage/slides/[id]">) {
  await requireStaff("content.write");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { locale, t } = await getAdminDictionary();
  const supabase = await createClient();
  const [{ data: s }, library] = await Promise.all([
    supabase.from("homepage_slides").select("*").eq("id", id).maybeSingle(),
    getMediaLibrary(locale),
  ]);
  if (!s) notFound();
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t.homepage.slides} title={locale === "ar" ? s.title_ar : s.title_en} />
      <SlideForm
        library={library}
        values={{
          id: s.id,
          status: s.status === "published" ? "published" : "draft",
          is_enabled: s.is_enabled,
          theme: s.theme === "dark" ? "dark" : "light",
          title_ar: s.title_ar,
          title_en: s.title_en,
          description_ar: s.description_ar,
          description_en: s.description_en,
          primary_cta_label_ar: s.primary_cta_label_ar,
          primary_cta_label_en: s.primary_cta_label_en,
          primary_cta_href: s.primary_cta_href,
          secondary_cta_label_ar: s.secondary_cta_label_ar ?? "",
          secondary_cta_label_en: s.secondary_cta_label_en ?? "",
          secondary_cta_href: s.secondary_cta_href ?? "",
          desktop_media_id: s.desktop_media_id ?? "",
          mobile_media_id: s.mobile_media_id ?? "",
          composition: s.composition ?? "",
          accent: s.accent ?? "",
          alt_ar: s.alt_ar,
          alt_en: s.alt_en,
        }}
      />
    </div>
  );
}
