import { ProductArt } from "@/components/brand/product-art";
import { ScentField } from "@/components/brand/scent-field";
import { GOLD_HEX } from "@/components/brand/scent-colors";
import { ButtonLink } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";

// The one orchestrated moment on the page: the headline rises line by line
// while the scent field fills the chamber. Everything else stays quiet.
export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const words = dict.home.heroTitle.split(" ");

  return (
    <section className="grain relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[radial-gradient(120%_80%_at_70%_100%,var(--color-navy-700)_0%,var(--color-navy-900)_45%,var(--color-navy-950)_100%)] pb-14 pt-28 sm:pb-20 lg:items-center lg:pb-0">
      <ScentField tint={GOLD_HEX} originX={0.76} originY={0.66} originYCompact={0.86} className="hero-mist" />

      <div className="container-page grid items-center gap-6 lg:relative lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative z-10 max-w-3xl">
          <h1 className="font-display text-step-6 leading-[0.95] text-ivory">
            {words.map((word, index) => (
              <span
                key={index}
                className="hero-line inline-block overflow-hidden pb-[0.08em] align-bottom [&:not(:last-child)]:me-[0.24em]"
              >
                <span className="inline-block" style={{ animationDelay: `${180 + index * 110}ms` }}>
                  {word}
                </span>
              </span>
            ))}
          </h1>
          <p className="hero-fade mt-6 max-w-md text-step-1 text-ivory/70" style={{ animationDelay: "620ms" }}>
            {dict.home.heroBody}
          </p>
          <div className="hero-fade mt-9 flex flex-wrap gap-3" style={{ animationDelay: "760ms" }}>
            <ButtonLink href={localePath(locale, "/collections/diffusers")} size="lg">
              {dict.home.heroPrimary}
            </ButtonLink>
            <ButtonLink href="#scent-library" variant="outline" size="lg">
              {dict.home.heroSecondary}
            </ButtonLink>
          </div>
        </div>

        {/* Phones: the device floats in the upper chamber, clear of the text. */}
        <div aria-hidden className="hero-device pointer-events-none absolute end-[-4vw] top-[9%] w-[56vw] max-w-[22rem] sm:max-w-[24rem] lg:relative lg:end-auto lg:top-auto lg:w-full lg:max-w-none">
          <div className="opacity-90 lg:opacity-100">
            <ProductArt art="diffuser-tower" uid="hero" label="" className="aspect-[4/5]" />
          </div>
        </div>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy-950 to-transparent" />
    </section>
  );
}
