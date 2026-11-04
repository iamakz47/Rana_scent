import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { HeroCarousel } from "./hero-carousel";
import { HeroSlideContent } from "./hero-slide-content";
import { intervalMs, type HeroSlide, type HeroSliderSettings } from "./hero-slides";

// Server wrapper: renders each slide on the server and hands the client
// carousel only what it needs. With no live slides, the hero is omitted.
export function HeroSlider({
  locale,
  dict,
  settings,
  slides,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: HeroSliderSettings;
  slides: HeroSlide[];
}) {
  if (slides.length === 0) return <h1 className="sr-only">{dict.home.pageTitle}</h1>;

  return (
    <>
      <h1 className="sr-only">{dict.home.pageTitle}</h1>
      <HeroCarousel
        autoplay={settings.autoplay}
        intervalMs={intervalMs(settings)}
        slides={slides.map((slide, index) => ({
          id: slide.id,
          label: slide.title[locale],
          content: <HeroSlideContent slide={slide} locale={locale} priority={index === 0} />,
        }))}
      />
    </>
  );
}
