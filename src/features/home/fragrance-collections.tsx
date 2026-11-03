import Link from "next/link";
import { scentHex } from "@/components/brand/scent-colors";
import { scentFamilies, type ScentFamily } from "@/features/catalog/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, type Locale } from "@/i18n/config";

// The five fragrance families, each in its own colour. Every tile opens the
// shop filtered to that family's refills.
export function FragranceCollections({
  locale,
  dict,
  counts,
}: {
  locale: Locale;
  dict: Dictionary;
  counts: Record<ScentFamily, number>;
}) {
  return (
    <section aria-labelledby="collections-title" className="bg-surface py-20 lg:py-28">
      <div className="container-page">
        <div className="reveal max-w-2xl">
          <h2 id="collections-title" className="font-display text-step-4 leading-[1.05] text-ink">
            {dict.home.collectionsTitle}
          </h2>
          <p className="mt-4 text-step-1 text-ink-soft">{dict.home.collectionsBody}</p>
        </div>

        <ul className="scrollbar-none -mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 lg:gap-4">
          {scentFamilies.map((family) => (
            <li key={family} className="w-[64vw] max-w-64 shrink-0 snap-start sm:w-auto sm:max-w-none">
              <Link
                href={`${localePath(locale, "/shop")}?type=refill&family=${family}`}
                className="group/fam flex h-full flex-col rounded-[1.75rem] border border-ink/8 bg-canvas p-3 transition-[border-color,box-shadow] duration-500 hover:border-ink/20 hover:shadow-[0_24px_50px_-34px_rgba(53,42,36,0.5)]"
              >
                <span
                  aria-hidden
                  className="relative block aspect-[4/5] overflow-hidden rounded-[1.25rem]"
                  style={{ background: `color-mix(in oklab, ${scentHex[family]} 22%, var(--color-canvas))` }}
                >
                  <span
                    className="absolute inset-x-[18%] bottom-0 top-[22%] rounded-t-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/fam:-translate-y-2 motion-reduce:transform-none"
                    style={{
                      background: `linear-gradient(180deg, ${scentHex[family]} 0%, color-mix(in oklab, ${scentHex[family]} 55%, var(--color-canvas)) 100%)`,
                    }}
                  />
                </span>
                <span className="mt-4 flex items-baseline justify-between gap-2 px-1">
                  <span className="font-display text-step-2 text-ink">{dict.families[family]}</span>
                  <span className="text-step--1 text-ink-soft tabular-nums">{counts[family]}</span>
                </span>
                <span className="mt-1 px-1 pb-1 text-step--1 text-ink-soft">{dict.familyNotes[family]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
