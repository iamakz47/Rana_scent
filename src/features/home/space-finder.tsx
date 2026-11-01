"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import type { Space } from "@/features/catalog/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

// Space chooser. Panels are rendered on the server and passed in, so this
// component only handles the selection and the transition between them.
export function SpaceFinder({ spaces, panels }: { spaces: Space[]; panels: Record<Space, ReactNode> }) {
  const { dict } = useI18n();
  const [active, setActive] = useState<Space>(spaces[0]);
  const groupId = useId();

  return (
    <section aria-labelledby={`${groupId}-title`} className="relative bg-navy-900 py-24 lg:py-32">
      <div className="container-page">
        <div className="reveal max-w-2xl">
          <h2 id={`${groupId}-title`} className="font-display text-step-5 leading-[1] text-ivory">
            {dict.home.finderTitle}
          </h2>
          <p className="mt-5 text-step-1 text-ivory/65">{dict.home.finderBody}</p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby={`${groupId}-title`}
          className="scrollbar-none -mx-4 mt-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
          onKeyDown={(event) => {
            const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const rtl = document.documentElement.dir === "rtl";
            const forward =
              event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
            const index = spaces.indexOf(active);
            const next = spaces[(index + (forward ? 1 : spaces.length - 1)) % spaces.length];
            setActive(next);
            document.getElementById(`${groupId}-${next}`)?.focus();
          }}
        >
          {spaces.map((space) => {
            const checked = space === active;
            return (
              <button
                key={space}
                id={`${groupId}-${space}`}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => setActive(space)}
                className={cn(
                  "relative min-h-11 shrink-0 rounded-full border px-5 text-step--1 transition-colors duration-300",
                  checked
                    ? "border-gold-300 text-navy-950"
                    : "border-white/12 text-ivory/75 hover:border-gold-400/50 hover:text-ivory",
                )}
              >
                {checked && (
                  <m.span
                    layoutId={`${groupId}-pill`}
                    className="absolute inset-0 rounded-full bg-gold"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{dict.spaces[space]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-12" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={active}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {panels[active]}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
