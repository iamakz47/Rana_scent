import { mediaUrl } from "@/features/media/url";
import type { Database } from "@/types/database";
import type { HeroSlide } from "./hero-slides";

type MediaRow = Pick<Database["public"]["Tables"]["media_assets"]["Row"], "bucket" | "path" | "width" | "height">;
export type SlideRow = Database["public"]["Tables"]["homepage_slides"]["Row"] & {
  desktop: MediaRow | null;
  mobile: MediaRow | null;
};

// Columns and embedded images for a slide, for both storefront and admin.
export const slideSelect =
  "*, desktop:media_assets!homepage_slides_desktop_media_id_fkey(bucket, path, width, height), mobile:media_assets!homepage_slides_mobile_media_id_fkey(bucket, path, width, height)";

const banner = (media: MediaRow | null) =>
  media && media.width && media.height ? { src: mediaUrl(media), width: media.width, height: media.height } : undefined;

export function rowToHeroSlide(row: SlideRow): HeroSlide {
  const secondary =
    row.secondary_cta_href && row.secondary_cta_label_ar && row.secondary_cta_label_en
      ? { label: { ar: row.secondary_cta_label_ar, en: row.secondary_cta_label_en }, href: row.secondary_cta_href }
      : undefined;
  return {
    id: row.id,
    position: row.position,
    enabled: row.is_enabled,
    status: row.status === "published" ? "published" : "draft",
    theme: row.theme === "dark" ? "dark" : "light",
    title: { ar: row.title_ar, en: row.title_en },
    description: { ar: row.description_ar, en: row.description_en },
    primaryCta: { label: { ar: row.primary_cta_label_ar, en: row.primary_cta_label_en }, href: row.primary_cta_href },
    secondaryCta: secondary,
    media: {
      desktop: banner(row.desktop),
      mobile: banner(row.mobile),
      artwork: (row.composition as HeroSlide["media"]["artwork"]) ?? undefined,
      accent: (row.accent as HeroSlide["media"]["accent"]) ?? undefined,
      alt: { ar: row.alt_ar || row.title_ar, en: row.alt_en || row.title_en },
    },
  };
}
