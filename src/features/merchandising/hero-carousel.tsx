"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon, PauseIcon, PlayIcon } from "@/components/ui/icons";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { cn } from "@/lib/cn";

type Slide = { id: string; label: string; content: ReactNode };

type Props = {
  slides: Slide[];
  // From slider settings (admin-editable); never hardcoded here.
  intervalMs: number;
  autoplay: boolean;
};

const SWIPE_THRESHOLD = 48;

// Accessible auto-advancing carousel (WAI-ARIA APG pattern): pauses on
// hover, focus, touch and when off-screen or in a background tab; has an
// explicit pause/play control; never autoplays under reduced motion.
// Slides are stacked in a fixed-height frame, so switching never shifts
// layout.
export function HeroCarousel({ slides, intervalMs, autoplay }: Props) {
  const { dict } = useI18n();
  const t = dict.heroSlider;
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const resumeTimer = useRef<number | undefined>(undefined);

  const playing = autoplay && count > 1 && !reducedMotion && !userPaused && !interacting && !hidden;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Reduced motion: no autoplay at all (also stops the progress animation).
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Pause while the tab is hidden or the carousel is scrolled out of view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let offscreen = false;
    let tabHidden = document.hidden;
    const sync = () => setHidden(offscreen || tabHidden);
    const observer = new IntersectionObserver(([entry]) => {
      offscreen = !entry.isIntersecting;
      sync();
    });
    observer.observe(root);
    const onVisibility = () => {
      tabHidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // One timer per slide; it restarts whenever the slide or play state changes.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, intervalMs);
    return () => window.clearTimeout(timer);
  }, [playing, next, intervalMs, index]);

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  const forward = (direction: 1 | -1) => {
    // "Next" always follows reading order, so it moves left in RTL.
    if (direction === 1) next();
    else prev();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const rtl = document.documentElement.dir === "rtl";
    const towardEnd = event.key === (rtl ? "ArrowLeft" : "ArrowRight");
    event.preventDefault();
    forward(towardEnd ? 1 : -1);
  };

  if (count === 0) return null;

  return (
    <section
      ref={rootRef}
      aria-roledescription={t.roleDescription}
      aria-label={t.label}
      data-paused={!playing}
      onKeyDown={onKeyDown}
      onPointerEnter={(event) => event.pointerType === "mouse" && setInteracting(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
      onTouchStart={(event) => {
        window.clearTimeout(resumeTimer.current);
        setInteracting(true);
        touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (start) {
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            const rtl = document.documentElement.dir === "rtl";
            // Swiping toward the reading start reveals the next slide.
            forward((dx < 0) !== rtl ? 1 : -1);
          }
        }
        // Resume shortly after the finger lifts.
        resumeTimer.current = window.setTimeout(() => setInteracting(false), intervalMs);
      }}
      className="relative isolate h-[min(84svh,48rem)] min-h-[36rem] overflow-hidden bg-beige"
      style={{ "--interval": `${intervalMs}ms` } as React.CSSProperties}
    >
      <div aria-live={playing ? "off" : "polite"} className="absolute inset-0">
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription={t.slide}
              aria-label={format(t.slideOf, { index: slideIndex + 1, count })}
              aria-hidden={!active}
              inert={!active}
              data-active={active}
              className="hero-slide absolute inset-0"
            >
              {slide.content}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-5 sm:pb-7">
          <div className="container-page flex items-center justify-between gap-3">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-ink/10 bg-canvas/85 p-1.5 backdrop-blur-md">
              {slides.map((slide, slideIndex) => {
                const active = slideIndex === index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => go(slideIndex)}
                    aria-label={format(t.goTo, { index: slideIndex + 1, label: slide.label })}
                    aria-current={active}
                    className="group/dot grid h-8 place-items-center px-1.5"
                  >
                    <span
                      className={cn(
                        "relative block h-1 overflow-hidden rounded-full bg-ink/15 transition-[width] duration-500 ease-[var(--ease-out-expo)]",
                        active ? "w-10 sm:w-14" : "w-4 group-hover/dot:bg-ink/30",
                      )}
                    >
                      {active && (
                        <span
                          key={`${index}-${playing}`}
                          className={cn(
                            "absolute inset-0 origin-[inline-start] bg-ink",
                            playing ? "hero-progress" : "",
                          )}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-ink/10 bg-canvas/85 p-1 backdrop-blur-md">
              <ControlButton label={t.previous} onClick={() => forward(-1)}>
                <ChevronIcon size={18} className="rotate-180 rtl:rotate-0" />
              </ControlButton>
              {autoplay && !reducedMotion && (
                <ControlButton
                  label={userPaused ? t.play : t.pause}
                  onClick={() => setUserPaused((value) => !value)}
                  pressed={userPaused}
                >
                  {userPaused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
                </ControlButton>
              )}
              <ControlButton label={t.next} onClick={() => forward(1)}>
                <ChevronIcon size={18} className="rtl:rotate-180" />
              </ControlButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ControlButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-ink/8"
    >
      {children}
    </button>
  );
}
