import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { HOMEPAGE_TAG } from "@/features/catalog/cache-tags";
import { isLiveCatalog } from "@/features/catalog/source";
import { DEFAULT_SLIDER_SETTINGS, getHeroSlider, heroSliderSettingsSchema, selectSlides, type HeroSlide, type HeroSliderSettings } from "./hero-slides";
import { rowToHeroSlide, slideSelect, type SlideRow } from "./slide-rows";

export const homepageSectionKeys = ["categories", "featured", "collections", "scent_library", "story", "finder", "sets"] as const;
export type HomepageSectionKey = (typeof homepageSectionKeys)[number];

export type HomepageContent = {
  settings: HeroSliderSettings;
  slides: HeroSlide[];
  // Visible sections in display order.
  sections: HomepageSectionKey[];
};

async function loadFromSupabase(): Promise<HomepageContent> {
  "use cache";
  cacheTag(HOMEPAGE_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  const [settings, slides, sections] = await Promise.all([
    supabase.from("store_settings").select("slider_autoplay, slider_interval_seconds").eq("id", 1).maybeSingle(),
    supabase.from("homepage_slides").select(slideSelect).eq("status", "published").eq("is_enabled", true).order("position"),
    supabase.from("homepage_sections").select("key, position, is_visible").order("position"),
  ]);
  if (settings.error || slides.error || sections.error) {
    console.error("Supabase homepage content unavailable");
    return { settings: DEFAULT_SLIDER_SETTINGS, slides: [], sections: [...homepageSectionKeys] };
  }
  const parsed = heroSliderSettingsSchema.safeParse({
    autoplay: settings.data?.slider_autoplay ?? DEFAULT_SLIDER_SETTINGS.autoplay,
    autoplayIntervalSeconds: settings.data?.slider_interval_seconds ?? DEFAULT_SLIDER_SETTINGS.autoplayIntervalSeconds,
  });
  return {
    settings: parsed.success ? parsed.data : DEFAULT_SLIDER_SETTINGS,
    slides: selectSlides(((slides.data ?? []) as unknown as SlideRow[]).map(rowToHeroSlide)),
    sections: (sections.data ?? [])
      .filter((s) => s.is_visible)
      .map((s) => s.key)
      .filter((key): key is HomepageSectionKey => (homepageSectionKeys as readonly string[]).includes(key)),
  };
}

export async function getHomepageContent(): Promise<HomepageContent> {
  if (isLiveCatalog()) return loadFromSupabase();
  const { settings, slides } = await getHeroSlider();
  return { settings, slides, sections: [...homepageSectionKeys] };
}
