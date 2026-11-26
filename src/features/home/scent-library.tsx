"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ProductVisual } from "@/components/brand/product-visual";
import { GOLD_HEX, scentHex } from "@/components/brand/scent-colors";
import { ButtonLink } from "@/components/ui/button";
import { ChevronIcon } from "@/components/ui/icons";
import type { Product } from "@/features/catalog/types";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { format } from "@/i18n/format";
import { formatKWD } from "@/lib/money";
import { cn } from "@/lib/cn";

type Refill = Pick<Product, "id" | "slug" | "name" | "tagline" | "scentFamily" | "notes"> & {
  priceFils: number;
  image?: string;
};

const noteKeys = ["top", "heart", "base"] as const;

// A light, boutique-style carousel. Every card already shows its name,
// price, family and notes — nothing is locked behind hover — while hovering
// (mouse only) or scrolling updates the larger "selected fragrance" panel
// above the shelf. Desktop gets arrow controls; touch gets native swipe and
// scroll-snap, with a dot trail below the shelf.
export function ScentLibrary({ refills }: { refills: Refill[] }) {
  const { locale, dict } = useI18n();
  const [activeId, setActiveId] = useState(refills[0]?.id);
  const active = refills.find((refill) => refill.id === activeId) ?? refills[0];
  const tint = active?.scentFamily ? scentHex[active.scentFamily] : GOLD_HEX;

  const trackRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [edge, setEdge] = useState({ start: true, end: refills.length <= 1 });

  // Tracks the leading card that's substantially on-shelf (reading order, so
  // it works the same in RTL), so the active state follows free
  // swiping/scrolling too, not only hover and the arrows. "Centre-most" would
  // pick an arbitrary card on desktop, where several sit in the frame at once.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;

    const update = () => {
      const trackRect = track.getBoundingClientRect();
      let bestId: string | undefined;
      for (const refill of refills) {
        const el = itemRefs.current.get(refill.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const visible = Math.min(rect.right, trackRect.right) - Math.max(rect.left, trackRect.left);
        if (visible / rect.width >= 0.6) {
          bestId = refill.id;
          break;
        }
      }
      if (bestId) setActiveId(bestId);
      setEdge({
        start: track.scrollLeft <= 1,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1,
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [refills]);

  const scrollToId = useCallback((id: string) => {
    itemRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  const step = (direction: 1 | -1) => {
    const ids = refills.map((refill) => refill.id);
    const currentIndex = Math.max(ids.indexOf(active?.id ?? ids[0]), 0);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), ids.length - 1);
    scrollToId(ids[nextIndex]);
  };

  if (!active) return null;

  return (
    <section
      id="scent-library"
      aria-labelledby="scent-library-title"
      className="relative isolate scroll-mt-24 overflow-hidden bg-gradient-to-b from-surface to-canvas py-24 lg:py-32"
    >
      <div className="container-page relative">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div className="reveal">
            <h2 id="scent-library-title" className="font-display text-step-5 leading-[1] text-ink">
              {dict.home.libraryTitle}
            </h2>
            <p className="mt-5 max-w-md text-step-1 text-ink-soft">{dict.home.libraryBody}</p>
          </div>

          <div aria-live="polite" className="lg:justify-self-end lg:w-full lg:max-w-lg">
            <AnimatePresence mode="wait">
              <m.div
                key={active.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface p-7 shadow-[0_30px_70px_-45px_rgba(53,42,36,0.4)] sm:p-8"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-20 start-1/2 h-48 w-[120%] -translate-x-1/2 rounded-full blur-3xl rtl:translate-x-1/2"
                  style={{ background: `color-mix(in oklab, ${tint} 20%, transparent)` }}
                />
                <div className="relative">
                  {active.scentFamily && (
                    <p className="flex items-center gap-2 text-step--1 font-medium text-ink-soft">
                      <span aria-hidden className="h-px w-8" style={{ background: tint }} />
                      {dict.families[active.scentFamily]}
                    </p>
                  )}
                  <p className="mt-3 font-display text-step-3 text-ink">{active.name[locale]}</p>
                  <p className="mt-2 text-step-0 text-ink-soft">{active.tagline[locale]}</p>
                  {active.notes && (
                    <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-ink/10 pt-5 text-step--1">
                      {noteKeys.map((key) => (
                        <div key={key}>
                          <dt className="text-ink-soft">{dict.product[key]}</dt>
                          <dd className="mt-1 text-ink">{active.notes![key][locale]}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <ButtonLink
                    href={localePath(locale, `/products/${active.slug}`)}
                    size="lg"
                    className="mt-7 w-full sm:w-auto"
                  >
                    {dict.home.libraryCta}
                    <ChevronIcon size={16} className="rtl:rotate-180" />
                  </ButtonLink>
                </div>
              </m.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="relative mt-14">
          {refills.length > 1 && (
            <>
              <NavButton
                label={dict.home.libraryPrevious}
                disabled={edge.start}
                onClick={() => step(-1)}
                className="start-0"
              >
                <ChevronIcon size={20} className="rotate-180 rtl:rotate-0" />
              </NavButton>
              <NavButton
                label={dict.home.libraryNext}
                disabled={edge.end}
                onClick={() => step(1)}
                className="end-0"
              >
                <ChevronIcon size={20} className="rtl:rotate-180" />
              </NavButton>
            </>
          )}

          <ul
            ref={trackRef}
            className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:gap-6 lg:px-16 scroll-px-4 sm:scroll-px-0 lg:scroll-px-16"
          >
            {refills.map((refill) => {
              const isActive = refill.id === active.id;
              const color = refill.scentFamily ? scentHex[refill.scentFamily] : GOLD_HEX;
              return (
                <li
                  key={refill.id}
                  ref={(node) => {
                    if (node) itemRefs.current.set(refill.id, node);
                    else itemRefs.current.delete(refill.id);
                  }}
                  className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-72 lg:w-[23rem]"
                >
                  <Link
                    href={localePath(locale, `/products/${refill.slug}`)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setActiveId(refill.id);
                    }}
                    onFocus={() => setActiveId(refill.id)}
                    data-active={isActive}
                    className="group/card relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-34px_rgba(53,42,36,0.4)] data-[active=true]:-translate-y-1.5 data-[active=true]:shadow-[0_30px_60px_-34px_rgba(53,42,36,0.4)] motion-reduce:transform-none"
                    style={{ borderColor: isActive ? `color-mix(in oklab, ${color} 55%, transparent)` : undefined }}
                  >
                    <div
                      className="relative aspect-[4/5] overflow-hidden"
                      style={{ "--color-beige": `color-mix(in oklab, ${color} 18%, var(--color-canvas))` } as React.CSSProperties}
                    >
                      <ProductVisual
                        src={refill.image}
                        alt={refill.name[locale]}
                        pendingLabel={dict.common.photoComingSoon}
                        sizes="(min-width: 1024px) 23rem, 78vw"
                        className="h-full w-full"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-x-6 top-4 h-1 rounded-full"
                        style={{ background: color }}
                      />
                    </div>

                    <span className="flex flex-1 flex-col gap-3 p-5">
                      {refill.scentFamily && (
                        <span className="inline-flex items-center gap-2 text-step--1 font-medium text-ink-soft">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                          {dict.families[refill.scentFamily]}
                        </span>
                      )}
                      <span className="font-display text-step-2 leading-tight text-ink">{refill.name[locale]}</span>
                      <span className="line-clamp-2 text-step--1 text-ink-soft">{refill.tagline[locale]}</span>

                      {refill.notes && (
                        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-ink/8 pt-3 text-[0.7rem] leading-tight">
                          {noteKeys.map((key) => (
                            <div key={key}>
                              <dt className="text-ink-soft uppercase tracking-wide">{dict.product[key]}</dt>
                              <dd className="mt-0.5 line-clamp-2 text-ink">{refill.notes![key][locale]}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      <span className="flex items-center justify-between pt-1">
                        <span className="text-step-0 text-gold-deep tabular-nums">
                          {formatKWD(refill.priceFils, locale)}
                        </span>
                        <ChevronIcon
                          size={16}
                          className="text-ink-soft transition-transform duration-300 group-hover/card:translate-x-1 rtl:rotate-180 rtl:group-hover/card:-translate-x-1"
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {refills.length > 1 && (
          <div className="mt-7 flex justify-center gap-2 lg:hidden">
            {refills.map((refill) => {
              const isActive = refill.id === active.id;
              const color = refill.scentFamily ? scentHex[refill.scentFamily] : GOLD_HEX;
              return (
                <button
                  key={refill.id}
                  type="button"
                  onClick={() => scrollToId(refill.id)}
                  aria-label={format(dict.home.libraryGoTo, { name: refill.name[locale] })}
                  aria-current={isActive}
                  className="grid h-8 w-6 place-items-center"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-[width,background-color] duration-300 ease-[var(--ease-out-expo)]",
                      isActive ? "w-6" : "w-1.5 bg-ink/15",
                    )}
                    style={{ background: isActive ? color : undefined }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-canvas text-ink shadow-[0_18px_40px_-20px_rgba(53,42,36,0.45)] transition-[opacity,box-shadow] duration-300 hover:shadow-[0_22px_46px_-18px_rgba(53,42,36,0.55)] disabled:pointer-events-none disabled:opacity-0 lg:flex",
        className,
      )}
    >
      {children}
    </button>
  );
}
