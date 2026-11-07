import type { Metadata } from "next";
import { requireStaff } from "@/features/admin/auth/dal";
import { getMediaLibrary } from "@/features/admin/categories/values";
import { SlideForm } from "@/features/admin/homepage/homepage-forms";
import { emptySlide } from "@/features/admin/homepage/slide-values";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.homepage.newSlide };
}

export default async function NewSlidePage() {
  await requireStaff("content.write");
  const { locale, t } = await getAdminDictionary();
  const library = await getMediaLibrary(locale);
  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={t.homepage.slides} title={t.homepage.newSlide} />
      <SlideForm values={emptySlide} library={library} />
    </div>
  );
}
