"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ProductArt } from "@/components/brand/product-art";
import { ScentField } from "@/components/brand/scent-field";
import { scentHex } from "@/components/brand/scent-colors";
import type { Product } from "@/features/catalog/types";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";

type Refill = Pick<Product, "id" | "slug" | "name" | "tagline" | "scentFamily" | "notes"> & {
  priceFils: number;
};

// The refill shelf. Hovering or focusing a refill tints the mist behind the
// shelf with that family's colour and reveals its notes.
export function ScentLibrary({ refills }: { refills: Refill[] }) {
  const { locale, dict } = useI18n();
  const [activeId, setActiveId] = useState(refills[0]?.id);
  const active = refills.find((refill) => refill.id === activeId) ?? refills[0];
  const tint = active?.scentFamily ? scentHex[active.scentFamily] : "#d5b46a";

  if (!active) return null;

  return (
    <section
      id="scent-library"
      aria-labelledby="scent-library-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-navy-950 py-24 lg:py-32"
    >
      <ScentField tint={tint} originX={0.5} originY={-0.2} intensity={0.75} className="opacity-80" />

      <div className="container-page relative">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div className="reveal">
            <h2 id="scent-library-title" className="font-display text-step-5 leading-[1] text-ivory">
              {dict.home.libraryTitle}
            </h2>
            <p className="mt-5 max-w-md text-step-1 text-ivory/65">{dict.home.libraryBody}</p>
          </div>

          <div aria-live="polite" className="min-h-40 lg:justify-self-end">
            <AnimatePresence mode="wait">
              <m.div
                key={active.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md"
              >
                {active.scentFamily && (
                  <p className="flex items-center gap-2 text-step--1" style={{ color: tint }}>
                    <span aria-hidden className="h-px w-8 bg-current" />
                    {dict.families[active.scentFamily]}
                  </p>
                )}
                <p className="mt-2 font-display text-step-3 text-ivory">{active.name[locale]}</p>
                <p className="mt-1 text-ivory/65">{active.tagline[locale]}</p>
                {active.notes && (
                  <dl className="mt-4 grid grid-cols-3 gap-4 text-step--1">
                    {(["top", "heart", "base"] as const).map((key) => (
                      <div key={key}>
                        <dt className="text-ivory/45">{dict.product[key]}</dt>
                        <dd className="text-ivory/85">{active.notes![key][locale]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </m.div>
            </AnimatePresence>
          </div>
        </div>

        <ul className="scrollbar-none -mx-4 mt-14 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible">
          {refills.map((refill) => {
            const isActive = refill.id === active.id;
            const color = refill.scentFamily ? scentHex[refill.scentFamily] : "#d5b46a";
            return (
              <li key={refill.id} className="w-[42vw] max-w-52 shrink-0 snap-start sm:w-48 lg:w-auto lg:max-w-none">
                <Link
                  href={localePath(locale, `/products/${refill.slug}`)}
                  onPointerEnter={() => setActiveId(refill.id)}
                  onFocus={() => setActiveId(refill.id)}
                  className="group/tube relative block rounded-[1.5rem] border border-white/6 bg-navy-900/40 p-3 backdrop-blur-sm transition-[transform,border-color,background-color] duration-700 ease-[var(--ease-out-expo)] hover:-translate-y-2 data-[active=true]:-translate-y-2 data-[active=true]:bg-navy-800/50 motion-reduce:transform-none"
                  data-active={isActive}
                  style={{ borderColor: isActive ? `${color}66` : undefined }}
                >
                  <ProductArt
                    art="cartridge"
                    family={refill.scentFamily}
                    uid={`shelf-${refill.id}`}
                    label={refill.name[locale]}
                    className="aspect-[3/5]"
                  />
                  <span className="mt-2 block px-1 text-step--1 leading-snug text-ivory">{refill.name[locale]}</span>
                  <span className="block px-1 pb-1 text-step--1 text-gold-200/80 tabular-nums">
                    {formatKWD(refill.priceFils, locale)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
