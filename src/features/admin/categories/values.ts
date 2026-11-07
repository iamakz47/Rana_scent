import "server-only";
import type { Locale } from "@/i18n/config";
import { mediaUrl } from "@/features/media/url";
import { createClient } from "@/lib/supabase/server";
import type { PickerAsset } from "@/features/admin/media/media-picker";
import type { CategoryValues } from "./category-form";

export async function getMediaLibrary(locale: Locale): Promise<PickerAsset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, bucket, path, alt_ar, alt_en, width, height")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((asset) => ({
    id: asset.id,
    url: mediaUrl(asset),
    alt: (locale === "ar" ? asset.alt_ar : asset.alt_en) || asset.path,
    width: asset.width,
    height: asset.height,
  }));
}

export const emptyCategory: CategoryValues = {
  slug: "",
  product_type: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  image_id: "",
  position: 0,
  is_visible: true,
  show_on_home: true,
  seo_title_ar: "",
  seo_title_en: "",
  seo_description_ar: "",
  seo_description_en: "",
  archived: false,
};
