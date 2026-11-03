import Image from "next/image";
import { ProductArt } from "@/components/brand/product-art";
import { ButtonLink } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { HeroSlide } from "./hero-slides";

type Props = { slide: HeroSlide; locale: Locale; dict: Dictionary; priority: boolean };

// One slide: copy on the reading-start side, composition on the end side
// (stacked on phones). Uploaded banners (desktop + mobile) replace the drawn
// artwork once the admin adds them.
export function HeroSlideContent({ slide, locale, dict, priority }: Props) {
  const dark = slide.theme === "dark";
  const { media } = slide;
  // The diffusers composition uses real product photos and draws its own arch.
  const photographic = media.artwork === "diffusers" && !media.desktop && !media.mobile;

  return (
    <div className={cn("relative h-full w-full overflow-hidden", dark ? "theme-dark" : "bg-beige")}>
      {!photographic && <Arch dark={dark} className="absolute bottom-0 end-[-12%] h-[96%] lg:end-[2%]" />}

      <div className="container-page relative flex h-full flex-col pb-24 pt-6 sm:pb-28 lg:grid lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-10 lg:py-0">
        <div className="slide-art relative min-h-0 flex-1 lg:order-last lg:h-[78%]">
          {media.desktop || media.mobile ? (
            <>
              {media.mobile && (
                <Image
                  src={media.mobile.src}
                  alt={media.alt[locale]}
                  fill
                  priority={priority}
                  sizes="100vw"
                  className="object-contain lg:hidden"
                />
              )}
              {media.desktop && (
                <Image
                  src={media.desktop.src}
                  alt={media.alt[locale]}
                  fill
                  priority={priority}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className={cn("object-contain", media.mobile && "hidden lg:block")}
                />
              )}
            </>
          ) : (
            media.artwork && <SlideArtwork kind={media.artwork} id={slide.id} label={media.alt[locale]} />
          )}
          {!media.desktop && !media.mobile && !photographic && (
            <span className="absolute end-0 top-0 rounded-full border border-ink/12 bg-canvas/85 px-2.5 py-1 text-[0.625rem] text-ink-soft">
              {dict.common.placeholderImage}
            </span>
          )}
        </div>

        <div className="relative z-10 max-w-xl shrink-0">
          <h2
            className="slide-rise font-display text-[clamp(2.1rem,1.3rem+3.6vw,5.25rem)] leading-[1] text-ink"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            {slide.title[locale]}
          </h2>
          <p
            className="slide-rise mt-4 max-w-md text-step-1 text-ink-soft lg:mt-6"
            style={{ "--delay": "200ms" } as React.CSSProperties}
          >
            {slide.description[locale]}
          </p>
          <div
            className="slide-rise mt-6 flex flex-wrap gap-3 lg:mt-9"
            style={{ "--delay": "320ms" } as React.CSSProperties}
          >
            <ButtonLink href={localePath(locale, slide.primaryCta.href)} size="lg">
              {slide.primaryCta.label[locale]}
            </ButtonLink>
            {slide.secondaryCta && (
              <ButtonLink href={localePath(locale, slide.secondaryCta.href)} variant="outline" size="lg">
                {slide.secondaryCta.label[locale]}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Arch({ dark, className }: { dark: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 600 700" className={cn("pointer-events-none text-sand opacity-70", className)} fill="none">
      <path d="M40 700 V320 a260 260 0 0 1 520 0 V700" fill="currentColor" fillOpacity={dark ? 0.35 : 0.55} />
      <path d="M90 700 V330 a210 210 0 0 1 420 0 V700" stroke="var(--color-gold)" strokeOpacity="0.45" />
    </svg>
  );
}

// Slide compositions used until a designed banner is uploaded. The diffusers
// slide composes real product photos; the others are drawn placeholders, each
// piece in its own positioned frame (ProductArt is itself relative).
function SlideArtwork({ kind, id, label }: { kind: NonNullable<HeroSlide["media"]["artwork"]>; id: string; label: string }) {
  if (kind === "diffusers") {
    // One isolated stage painted in the slide colour, so multiply-blended
    // studio photos lose their white background against the arch. The mask
    // sits on this stage (not on the photos) so it doesn't break the blend.
    return (
      <div
        role="img"
        aria-label={label}
        // Feathered edges dissolve the stage into the identical slide colour,
        // so the photos' faint studio tone never shows a frame.
        className="absolute inset-0 isolate overflow-hidden bg-beige [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,#000_90%,transparent),linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]"
      >
        <Arch dark={false} className="absolute inset-x-[6%] bottom-0 mx-auto h-[100%]" />
        <div className="absolute bottom-0 end-0 aspect-square h-full">
          <Image
            src="/images/products/rana-tower.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 80vw"
            className="object-contain mix-blend-multiply"
          />
        </div>
        {/* Phones show the tower alone; the pair would crowd a narrow frame. */}
        <div className="absolute bottom-0 start-0 hidden aspect-square h-[62%] sm:block">
          <Image
            src="/images/products/rana-aura.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 26vw, 50vw"
            className="object-contain mix-blend-multiply"
          />
        </div>
      </div>
    );
  }
  if (kind === "refills") {
    const families = ["oud", "musk", "floral", "fresh", "woody"] as const;
    const heights = ["74%", "88%", "100%", "88%", "74%"];
    return (
      <div role="img" aria-label={label} className="absolute inset-x-[4%] inset-y-[8%] flex items-end justify-center gap-[3%]">
        {families.map((family, index) => (
          <ProductArt
            key={family}
            art="cartridge"
            family={family}
            uid={`${id}-${family}`}
            label=""
            viewBox="120 96 160 372"
            halo={false}
            className="w-[16%]"
            style={{ height: heights[index] }}
          />
        ))}
      </div>
    );
  }
  return (
    <div role="img" aria-label={label} className="absolute inset-0">
      <div className="absolute inset-y-[4%] end-[10%] w-[50%]">
        <ProductArt art="diffuser-car" uid={`${id}-a`} label="" className="h-full w-full" />
      </div>
      <div className="absolute bottom-0 start-0 h-[56%] w-[54%]">
        <ProductArt art="accessory" uid={`${id}-b`} label="" className="h-full w-full" />
      </div>
    </div>
  );
}
