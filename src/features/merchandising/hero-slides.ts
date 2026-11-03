import { z } from "zod";
import { scentFamilies } from "@/features/catalog/types";

// Homepage hero slider: data model, validation and read API.
//
// Admin-ready by design. Phase 2 stores these rows in Supabase
// (hero_slides + store_settings) and the admin dashboard edits them through
// the same schemas: add/edit/delete, reorder (position), enable/disable,
// desktop + mobile images, ar/en copy, CTA labels and destinations, a
// draft/published status for previewing, and the autoplay interval in
// seconds.

const localized = (max: number) =>
  z.object({ ar: z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) });

// Destinations are internal, locale-less paths ("/collections/refills");
// the locale prefix is added at render time. External or protocol-relative
// URLs are rejected so a slide can never become an open redirect.
const internalPath = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&#%]*$/, "Use an internal path such as /collections/refills");

const bannerImage = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const slideArtworks = ["diffusers", "refills", "accessories"] as const;

export const heroSlideSchema = z.object({
  id: z.string().min(1),
  position: z.number().int().nonnegative(),
  enabled: z.boolean(),
  status: z.enum(["draft", "published"]),
  theme: z.enum(["light", "dark"]),
  title: localized(90),
  description: localized(240),
  primaryCta: z.object({ label: localized(32), href: internalPath }),
  secondaryCta: z.object({ label: localized(32), href: internalPath }).optional(),
  media: z.object({
    // Uploaded banners (Phase 2+). When absent, the drawn artwork shows.
    desktop: bannerImage.optional(),
    mobile: bannerImage.optional(),
    artwork: z.enum(slideArtworks).optional(),
    accent: z.enum(scentFamilies).optional(),
    alt: localized(160),
  }),
});

export const heroSliderSettingsSchema = z.object({
  autoplay: z.boolean(),
  // Stored in seconds, as the admin edits it.
  autoplayIntervalSeconds: z.number().min(2).max(30),
});

export type HeroSlide = z.infer<typeof heroSlideSchema>;
export type HeroSliderSettings = z.infer<typeof heroSliderSettingsSchema>;

export const DEFAULT_SLIDER_SETTINGS: HeroSliderSettings = {
  autoplay: true,
  autoplayIntervalSeconds: 4,
};

// DEMO CONTENT. Replaced by Supabase rows in Phase 2.
const demoSlides: HeroSlide[] = [
  {
    id: "slide-diffusers",
    position: 0,
    enabled: true,
    status: "published",
    theme: "light",
    title: { ar: "فواحات تليق ببيتك", en: "Fragrance, engineered for the home" },
    description: {
      ar: "فواحات إلكترونية بتصميم أنيق تنشر العطر بهدوء في المجلس والبيت.",
      en: "Elegant electronic diffusers that carry fragrance quietly through the majlis and every room.",
    },
    primaryCta: { label: { ar: "تسوّق الفواحات", en: "Shop diffusers" }, href: "/collections/diffusers" },
    secondaryCta: { label: { ar: "اعثر على فواحك", en: "Find your diffuser" }, href: "/#find-your-diffuser" },
    media: {
      artwork: "diffusers",
      alt: { ar: "فواحا رنا تاور ورنا أورا", en: "Rana Tower and Rana Aura diffusers" },
    },
  },
  {
    id: "slide-refills",
    position: 1,
    enabled: true,
    status: "published",
    theme: "dark",
    title: { ar: "مكتبة من العطور الفاخرة", en: "A library of fine fragrance" },
    description: {
      ar: "عود ومسك وزهور ونفحات منعشة وخشبية: عبوات عطر لكل مزاج.",
      en: "Oud, musk, floral, fresh and woody: refills for every mood and every room.",
    },
    primaryCta: { label: { ar: "اكتشف العبوات", en: "Explore refills" }, href: "/collections/refills" },
    media: {
      artwork: "refills",
      accent: "oud",
      alt: { ar: "عبوات عطر رنا سنت (صورة توضيحية)", en: "Rana Scent fragrance refills (illustration)" },
    },
  },
  {
    id: "slide-accessories",
    position: 2,
    enabled: true,
    status: "published",
    theme: "light",
    title: { ar: "لمسات تكمل التجربة", en: "The finishing touches" },
    description: {
      ar: "إكسسوارات للفواحات تكمل حضور العطر في البيت والسيارة.",
      en: "Accessories that complete your diffuser, at home and on the road.",
    },
    primaryCta: { label: { ar: "تسوّق الإكسسوارات", en: "Shop accessories" }, href: "/collections/accessories" },
    media: {
      artwork: "accessories",
      alt: { ar: "إكسسوارات الفواحات (صورة توضيحية)", en: "Diffuser accessories (illustration)" },
    },
  },
];

// Visible slides in display order. `preview` includes drafts so the admin
// can review a slide before publishing it (Phase 2 gates this behind an
// authenticated draft mode).
export function selectSlides(slides: readonly HeroSlide[], { preview = false } = {}): HeroSlide[] {
  return slides
    .filter((slide) => slide.enabled && (preview || slide.status === "published"))
    .sort((a, b) => a.position - b.position);
}

export function intervalMs(settings: HeroSliderSettings): number {
  return Math.round(settings.autoplayIntervalSeconds * 1000);
}

export async function getHeroSlider(options?: { preview?: boolean }) {
  const settings = heroSliderSettingsSchema.parse(DEFAULT_SLIDER_SETTINGS);
  const slides = selectSlides(z.array(heroSlideSchema).parse(demoSlides), options);
  return { settings, slides };
}
