import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { HeroSlide } from "./hero-slides";

type Props = { slide: HeroSlide; locale: Locale; priority: boolean };

// One slide: copy on the reading-start side, composition on the end side
// (stacked on phones). Uploaded banners (desktop + mobile) replace the drawn
// artwork once the admin adds them.
export function HeroSlideContent({ slide, locale, priority }: Props) {
  const dark = slide.theme === "dark";
  const { media } = slide;
  // Compositions draw their own stage; the plain arch only backs uploaded banners.
  const composed = Boolean(media.artwork) && !media.desktop && !media.mobile;

  return (
    <div className={cn("relative h-full w-full overflow-hidden", dark ? "theme-dark" : "bg-beige")}>
      {!composed && <Arch dark={dark} className="absolute bottom-0 end-[-12%] h-[96%] lg:end-[2%]" />}

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
            media.artwork && <SlideArtwork kind={media.artwork} label={media.alt[locale]} />
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

// Slide compositions built from real product photos, used until a designed
// banner is uploaded for the slide.
function SlideArtwork({ kind, label }: { kind: NonNullable<HeroSlide["media"]["artwork"]>; label: string }) {
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
    // A light arch panel inside the dark slide: the bottle photo blends into
    // it, and the panel itself becomes the composition.
    return (
      <div role="img" aria-label={label} className="absolute inset-0 flex items-end justify-center">
        <div className="relative isolate h-[94%] w-[min(78%,26rem)] overflow-hidden rounded-t-full bg-[#efe7db]">
          <Image
            src="/images/products/aroma-oil-500ml.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 26rem, 78vw"
            className="object-contain object-bottom p-[8%] pt-[18%] mix-blend-multiply"
          />
        </div>
      </div>
    );
  }
  // No real photography for this composition yet: show nothing rather than
  // a stand-in. (The accessories slide is disabled until photos arrive.)
  return null;
}
