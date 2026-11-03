import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { HeroCarousel } from "./hero-carousel";
import { HeroSlideContent } from "./hero-slide-content";
import { getHeroSlider, intervalMs } from "./hero-slides";

// Server wrapper: loads slides and settings, renders each slide on the
// server and hands the client carousel only what it needs.
export async function HeroSlider({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { settings, slides } = await getHeroSlider();

  return (
    <>
      <h1 className="sr-only">{dict.home.pageTitle}</h1>
      <HeroCarousel
        autoplay={settings.autoplay}
        intervalMs={intervalMs(settings)}
        slides={slides.map((slide, index) => ({
          id: slide.id,
          label: slide.title[locale],
          content: <HeroSlideContent slide={slide} locale={locale} dict={dict} priority={index === 0} />,
        }))}
      />
    </>
  );
}
