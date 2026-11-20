"use client";

import { useId } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import type { FreeFragrance } from "../queries";

// Free fragrance choices for one device: one or two dropdowns filled from the
// live fragrance catalogue, under a soft caution note. The choice is a
// preference the delivery representative confirms with the customer.
export function FreeFragrancePicker({
  count,
  fragrances,
  value,
  onChange,
  showErrors = false,
  compact = false,
}: {
  count: 1 | 2;
  fragrances: FreeFragrance[];
  value: string[];
  onChange: (ids: string[]) => void;
  showErrors?: boolean;
  compact?: boolean;
}) {
  const { locale, dict } = useI18n();
  const p = dict.product;
  const id = useId();
  const labels = [p.freeFirst, p.freeSecond];

  return (
    <div className="space-y-3">
      <p
        role="note"
        className={cn(
          "flex items-start gap-2 rounded-2xl border border-[#d9b44a]/45 bg-[#fbf1cf] px-4 py-3 text-[#4a3b12]",
          compact ? "text-step--1" : "text-step-0",
        )}
      >
        <span aria-hidden className="mt-0.5 inline-grid size-5 shrink-0 place-items-center rounded-full bg-[#e7c45f] text-[0.7rem] font-semibold text-[#4a3b12]">
          !
        </span>
        <span>{p.freeCaution}</span>
      </p>
      {fragrances.length === 0 ? (
        <p className="text-step--1 text-[#86352b]">{p.freeUnavailable}</p>
      ) : (
        <div className={cn("grid gap-3", count === 2 && !compact && "sm:grid-cols-2")}>
          {Array.from({ length: count }, (_, index) => {
            const selectId = `${id}-${index}`;
            const missing = showErrors && !value[index];
            return (
              <div key={index} className="min-w-0">
                <label htmlFor={selectId} className="mb-1.5 block text-step--1 font-medium text-ink">
                  {labels[index]}
                </label>
                <select
                  id={selectId}
                  required
                  value={value[index] ?? ""}
                  aria-invalid={missing}
                  onChange={(event) => {
                    const next = Array.from({ length: count }, (_, i) => value[i] ?? "");
                    next[index] = event.target.value;
                    onChange(next);
                  }}
                  className="block w-full min-w-0 rounded-xl border border-ink/15 bg-canvas px-4 py-3 text-step-0 text-ink transition-colors hover:border-ink/30 focus:border-gold-deep focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-deep aria-[invalid=true]:border-[#a4493d]"
                >
                  <option value="" disabled>
                    {p.chooseFragrance}
                  </option>
                  {fragrances.map((fragrance) => (
                    <option key={fragrance.id} value={fragrance.id}>
                      {fragrance.name[locale]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
      {showErrors && value.filter(Boolean).length < count && fragrances.length > 0 ? (
        <p role="alert" className="text-step--1 text-[#86352b]">
          {p.freeRequired}
        </p>
      ) : null}
    </div>
  );
}
