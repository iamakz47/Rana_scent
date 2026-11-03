import { describe, expect, it } from "vitest";
import { listHomeCategories } from "@/features/catalog/queries";
import {
  DEFAULT_SLIDER_SETTINGS,
  getHeroSlider,
  heroSlideSchema,
  heroSliderSettingsSchema,
  intervalMs,
  selectSlides,
  type HeroSlide,
} from "./hero-slides";

const slide = (overrides: Partial<HeroSlide>): HeroSlide => ({
  id: "s",
  position: 0,
  enabled: true,
  status: "published",
  theme: "light",
  title: { ar: "عنوان", en: "Title" },
  description: { ar: "وصف", en: "Description" },
  primaryCta: { label: { ar: "تسوّق", en: "Shop" }, href: "/shop" },
  media: { artwork: "diffusers", alt: { ar: "صورة", en: "Image" } },
  ...overrides,
});

describe("hero slider settings", () => {
  it("defaults to a 4 second interval, stored in seconds", () => {
    expect(DEFAULT_SLIDER_SETTINGS.autoplayIntervalSeconds).toBe(4);
    expect(intervalMs(DEFAULT_SLIDER_SETTINGS)).toBe(4000);
    expect(intervalMs({ autoplay: true, autoplayIntervalSeconds: 6.5 })).toBe(6500);
  });

  it("rejects intervals outside 2–30 seconds", () => {
    expect(heroSliderSettingsSchema.safeParse({ autoplay: true, autoplayIntervalSeconds: 1 }).success).toBe(false);
    expect(heroSliderSettingsSchema.safeParse({ autoplay: true, autoplayIntervalSeconds: 31 }).success).toBe(false);
  });
});

describe("hero slides", () => {
  it("orders by position and hides disabled and draft slides", () => {
    const result = selectSlides([
      slide({ id: "c", position: 2 }),
      slide({ id: "a", position: 0 }),
      slide({ id: "off", position: 1, enabled: false }),
      slide({ id: "draft", position: 1, status: "draft" }),
    ]);
    expect(result.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("includes drafts in preview mode, never disabled slides", () => {
    const result = selectSlides(
      [slide({ id: "draft", status: "draft" }), slide({ id: "off", enabled: false })],
      { preview: true },
    );
    expect(result.map((s) => s.id)).toEqual(["draft"]);
  });

  it("only allows internal CTA destinations", () => {
    const ok = heroSlideSchema.safeParse(slide({ primaryCta: { label: { ar: "أ", en: "A" }, href: "/collections/refills" } }));
    expect(ok.success).toBe(true);
    for (const href of ["https://evil.example", "//evil.example", "javascript:alert(1)", "shop"]) {
      const bad = heroSlideSchema.safeParse(slide({ primaryCta: { label: { ar: "أ", en: "A" }, href } }));
      expect(bad.success, href).toBe(false);
    }
  });

  it("ships valid demo slides; the accessories slide stays hidden until it has photos", async () => {
    const { settings, slides } = await getHeroSlider();
    expect(settings.autoplayIntervalSeconds).toBe(4);
    expect(slides.map((s) => s.media.artwork)).toEqual(["diffusers", "refills"]);
  });
});

describe("home categories", () => {
  it("lists the three quick-access categories in order", async () => {
    const categories = await listHomeCategories();
    expect(categories.map((c) => c.name.en)).toEqual(["Electronic Diffusers", "Fragrance Refills", "Diffuser Accessories"]);
    expect(categories.map((c) => c.name.ar)).toEqual(["الفواحات الإلكترونية", "عبوات العطر", "إكسسوارات الفواحات"]);
  });
});
