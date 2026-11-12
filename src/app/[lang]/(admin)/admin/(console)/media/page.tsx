import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { getAdminDictionary } from "@/features/admin/i18n";
import { MediaLibrary, type LibraryAsset } from "@/features/admin/media/media-library";
import { mediaUrl } from "@/features/media/url";
import { AdminPageHeader } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.media.title };
}

export default async function MediaPage() {
  await requireStaff("media.write");
  const { locale, t } = await getAdminDictionary();
  const supabase = await createClient();
  const [assets, productMedia, categories, slides] = await Promise.all([
    supabase.from("media_assets").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("product_media").select("media_id, products(name_ar, name_en)"),
    supabase.from("categories").select("image_id, name_ar, name_en").not("image_id", "is", null),
    supabase.from("homepage_slides").select("desktop_media_id, mobile_media_id, title_ar, title_en"),
  ]);

  const usage = new Map<string, string[]>();
  const add = (id: string | null, label: string) => {
    if (!id) return;
    usage.set(id, [...(usage.get(id) ?? []), label]);
  };
  const name = (row: { name_ar: string; name_en: string } | null) => (row ? (locale === "ar" ? row.name_ar : row.name_en) : "");
  for (const pm of productMedia.data ?? []) add(pm.media_id, name(pm.products));
  for (const c of categories.data ?? []) add(c.image_id, name(c));
  for (const s of slides.data ?? []) {
    const title = locale === "ar" ? s.title_ar : s.title_en;
    add(s.desktop_media_id, `${t.homepage.slides}: ${title}`);
    if (s.mobile_media_id !== s.desktop_media_id) add(s.mobile_media_id, `${t.homepage.slides}: ${title}`);
  }

  const list: LibraryAsset[] = (assets.data ?? []).map((a) => ({
    id: a.id,
    url: mediaUrl(a),
    bucket: a.bucket,
    path: a.path,
    altAr: a.alt_ar,
    altEn: a.alt_en,
    width: a.width,
    height: a.height,
    sizeBytes: a.size_bytes,
    usage: usage.get(a.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t.media.title} body={t.media.body} />
      <MediaLibrary assets={list} usageLabels={{}} />
    </div>
  );
}
