"use client";

import { useState } from "react";
import { Swatch } from "@/features/catalog/components/color-selection";
import { FreeFragrancePicker } from "@/features/catalog/components/free-fragrance-picker";
import type { FreeFragrance } from "@/features/catalog/queries";
import { useI18n } from "@/i18n/client";
import { setBundleComponentFragrances, type BundleComponentLine, type CartLine } from "./store";

// One included product's free-fragrance choices, inside a bundle line. Same
// "Change" affordance as LineFragrances, but scoped to this one component via
// setBundleComponentFragrances rather than setLineFragrances.
function BundleComponentFragrances({
  lineId,
  component,
  fragrances,
}: {
  lineId: string;
  component: BundleComponentLine;
  fragrances?: FreeFragrance[];
}) {
  const { locale, dict } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(component.fragrances?.map((f) => f.id) ?? []);
  if (!component.fragrances?.length) return null;
  const count = component.fragrances.length as 1 | 2;

  if (editing && fragrances) {
    return (
      <div className="mt-2 space-y-3">
        <FreeFragrancePicker count={count} fragrances={fragrances} value={draft} onChange={setDraft} compact />
        <div className="flex gap-3">
          <button
            type="button"
            disabled={draft.filter((id) => fragrances.some((f) => f.id === id)).length < count}
            onClick={() => {
              setBundleComponentFragrances(
                lineId,
                component.itemProductId,
                draft.map((id) => {
                  const f = fragrances.find((item) => item.id === id)!;
                  return { id: f.id, name: f.name };
                }),
              );
              setEditing(false);
            }}
            className="min-h-10 rounded-full bg-ink px-4 text-step--1 text-canvas disabled:opacity-45"
          >
            {dict.account.save}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="min-h-10 px-2 text-step--1 text-ink-soft underline-offset-4 hover:underline"
          >
            {dict.account.cancel}
          </button>
        </div>
      </div>
    );
  }

  const unavailable = fragrances ? component.fragrances.some((f) => !fragrances.some((item) => item.id === f.id)) : false;
  return (
    <div className="mt-1 text-step--1">
      <ol className="list-decimal ps-5 text-ink-soft">
        {component.fragrances.map((f, index) => (
          <li key={`${f.id}-${index}`}>{f.name[locale]}</li>
        ))}
      </ol>
      {unavailable ? <p className="mt-1 text-[#86352b]">{dict.checkout.errors.fragrance_unavailable}</p> : null}
      {fragrances ? (
        <button
          type="button"
          onClick={() => {
            setDraft(component.fragrances!.map((f) => f.id));
            setEditing(true);
          }}
          className="mt-1 min-h-10 text-step--1 text-ink underline underline-offset-4 hover:text-gold-deep"
        >
          {dict.product.change}
        </button>
      ) : null}
    </div>
  );
}

// A bundle (offer) line's content, in the drawer or the cart page: the
// offer's own name as the title, then every included product indented
// underneath it (its chosen colour, chosen fragrances where it has any, and
// how many of it one bundle includes). The quantity stepper and remove
// control around this are the line's own, reused as-is from LineVariant's
// call sites in the drawer/cart page.
export function LineBundle({
  line,
  lineId,
  fragrances,
}: {
  line: CartLine & { bundle: NonNullable<CartLine["bundle"]> };
  lineId: string;
  fragrances?: FreeFragrance[];
}) {
  const { locale, dict } = useI18n();
  return (
    <div data-testid="line-bundle">
      <p className="truncate font-medium">{line.name[locale]}</p>
      <p className="text-step--1 text-ink-soft">{dict.offers.includedBreakdown}</p>
      <ul className="mt-2 space-y-2.5 border-s border-ink/10 ps-3">
        {line.bundle.components.map((component, index) => (
          <li key={`${component.itemProductId}-${index}`} className="text-step--1">
            <p className="flex flex-wrap items-center gap-1.5 text-ink">
              {component.colorHex ? <Swatch hex={component.colorHex} /> : null}
              <span>{component.name[locale]}</span>
              <span className="text-ink-soft">· {component.variantLabel[locale]}</span>
              {component.quantity ? <span className="text-ink-soft tabular-nums">× {component.quantity}</span> : null}
            </p>
            <BundleComponentFragrances lineId={lineId} component={component} fragrances={fragrances} />
          </li>
        ))}
      </ul>
    </div>
  );
}
