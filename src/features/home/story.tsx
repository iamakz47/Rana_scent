"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ProductArt } from "@/components/brand/product-art";
import type { ArtKind, ProductImage } from "@/features/catalog/types";
import { useI18n } from "@/i18n/client";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const frames: Array<{ art: ArtKind; view: ProductImage["view"]; family?: "oud" }> = [
  { art: "cartridge", view: "front", family: "oud" },
  { art: "diffuser-compact", view: "front", family: "oud" },
  { art: "diffuser-tower", view: "context", family: "oud" },
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
    <section ref={root} aria-labelledby="story-title" className="relative bg-navy-950">
      <div data-story-pin className="lg:flex lg:h-[100svh] lg:items-center">
        <div className="container-page grid gap-12 py-24 lg:grid-cols-2 lg:items-center lg:py-0">
          <div aria-hidden className="relative hidden aspect-square lg:block">
            <div className="absolute inset-[8%] rounded-full border border-gold-400/15" />
            <div className="absolute inset-[22%] rounded-full border border-gold-400/10" />
            {frames.map((frame, index) => (
              <div key={index} data-story-frame className="absolute inset-0">
                <ProductArt art={frame.art} view={frame.view} family={frame.family} uid={`story-${index}`} label="" className="h-full w-full" />
              </div>
            ))}
          </div>

          <div className="relative">
            <h2 id="story-title" className="reveal font-display text-step-5 leading-[1] text-ivory">
              {dict.home.storyTitle}
            </h2>
            <div className="relative mt-12 ps-8">
              <span aria-hidden className="absolute inset-y-1 start-0 w-px bg-white/10" />
              <span
                aria-hidden
                data-story-progress
                className="absolute inset-y-1 start-0 hidden w-px origin-top bg-gold-300 lg:block"
                style={{ transform: "scaleY(0)" }}
              />
              <ol className="space-y-12 lg:space-y-10">
                {steps.map((step, index) => (
                  <li key={step.title} data-story-step className="reveal-compact">
                    <div aria-hidden className="mb-6 aspect-[4/3] max-w-sm overflow-hidden rounded-[1.5rem] bg-navy-900 lg:hidden">
                      <ProductArt
                        art={frames[index].art}
                        view={frames[index].view}
                        family={frames[index].family}
                        uid={`story-m-${index}`}
                        label=""
                        className="h-full w-full"
                      />
                    </div>
                    <p className="text-step--1 text-gold-300 tabular-nums">{index + 1}</p>
                    <h3 className="mt-1 font-display text-step-3 text-ivory">{step.title}</h3>
                    <p className="mt-2 max-w-md text-step-1 text-ivory/65">{step.body}</p>
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
