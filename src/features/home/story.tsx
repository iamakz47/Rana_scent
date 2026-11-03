"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ProductVisual } from "@/components/brand/product-visual";
import { useI18n } from "@/i18n/client";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// One real photo per step: the refill, a home diffuser, a large-space tower.
const frames = [
  "/images/products/aroma-oil-500ml.jpg",
  "/images/products/rana-aura.jpg",
  "/images/products/rana-tower.jpg",
];

// "From refill to atmosphere": on large screens the stage pins while the
// three steps advance with scroll; on small screens (and with reduced motion)
// it is a simple stacked sequence.
export function Story() {
  const { dict } = useI18n();
  const root = useRef<HTMLElement>(null);
  const steps = dict.home.storySteps;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const stageFrames = gsap.utils.toArray<HTMLElement>("[data-story-frame]");
        const stepEls = gsap.utils.toArray<HTMLElement>("[data-story-step]");

        gsap.set(stageFrames.slice(1), { autoAlpha: 0, scale: 0.9, filter: "blur(12px)" });
        gsap.set(stepEls.slice(1), { autoAlpha: 0.22 });

        const timeline = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: "[data-story-pin]",
            start: "top top",
            end: () => `+=${window.innerHeight * 2}`,
            scrub: 0.8,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        timeline.fromTo("[data-story-progress]", { scaleY: 0 }, { scaleY: 1, ease: "none", duration: 2 }, 0);
        for (let i = 1; i < stageFrames.length; i++) {
          const at = i - 0.55;
          timeline
            .to(stageFrames[i - 1], { autoAlpha: 0, scale: 1.08, filter: "blur(12px)", duration: 0.5 }, at)
            .to(stageFrames[i], { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.5 }, at)
            .to(stepEls[i - 1], { autoAlpha: 0.22, duration: 0.3 }, at)
            .to(stepEls[i], { autoAlpha: 1, duration: 0.3 }, at);
        }
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="story-title" className="relative bg-canvas">
      <div data-story-pin className="lg:flex lg:h-[100svh] lg:items-center">
        <div className="container-page grid gap-12 py-24 lg:grid-cols-2 lg:items-center lg:py-0">
          {/* Each frame paints the stage colour itself: GSAP's blur filter
              isolates blending, so the photos need their own backdrop. */}
          <div aria-hidden className="relative hidden aspect-square overflow-hidden rounded-[2.5rem] bg-beige lg:block">
            {frames.map((src) => (
              <div key={src} data-story-frame className="absolute inset-0">
                <ProductVisual
                  src={src}
                  alt=""
                  pendingLabel={dict.common.photoComingSoon}
                  sizes="45vw"
                  className="h-full w-full"
                />
              </div>
            ))}
          </div>

          <div className="relative">
            <h2 id="story-title" className="reveal font-display text-step-5 leading-[1] text-ink">
              {dict.home.storyTitle}
            </h2>
            <div className="relative mt-12 ps-8">
              <span aria-hidden className="absolute inset-y-1 start-0 w-px bg-ink/8" />
              <span
                aria-hidden
                data-story-progress
                className="absolute inset-y-1 start-0 hidden w-px origin-top bg-gold lg:block"
                style={{ transform: "scaleY(0)" }}
              />
              <ol className="space-y-12 lg:space-y-10">
                {steps.map((step, index) => (
                  <li key={step.title} data-story-step className="reveal-compact">
                    <div aria-hidden className="mb-6 max-w-sm overflow-hidden rounded-[1.5rem] lg:hidden">
                      <ProductVisual
                        src={frames[index]}
                        alt=""
                        pendingLabel={dict.common.photoComingSoon}
                        sizes="(min-width: 640px) 24rem, 100vw"
                        className="aspect-[4/3]"
                      />
                    </div>
                    <p className="text-step--1 text-gold-deep tabular-nums">{index + 1}</p>
                    <h3 className="mt-1 font-display text-step-3 text-ink">{step.title}</h3>
                    <p className="mt-2 max-w-md text-step-1 text-ink-soft">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
