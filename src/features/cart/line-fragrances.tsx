"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { FreeFragrancePicker } from "@/features/catalog/components/free-fragrance-picker";
import type { FreeFragrance } from "@/features/catalog/queries";
import { setLineFragrances, type CartLine } from "./store";

// Shows a line's free fragrances (they apply to each device on the line)
// and, where a fragrance list is available, lets the customer change them.
export function LineFragrances({
  line,
  lineId,
  fragrances,
}: {
  line: CartLine;
  lineId: string;
  fragrances?: FreeFragrance[];
}) {
  const { locale, dict } = useI18n();
  const p = dict.product;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(line.fragrances?.map((f) => f.id) ?? []);
  if (!line.fragrances?.length) return null;
  const count = line.fragrances.length as 1 | 2;

  if (editing && fragrances) {
    return (
      <div className="mt-3 space-y-3">
        <FreeFragrancePicker count={count} fragrances={fragrances} value={draft} onChange={setDraft} compact />
        <div className="flex gap-3">
          <button
            type="button"
            disabled={draft.filter((id) => fragrances.some((f) => f.id === id)).length < count}
            onClick={() => {
              setLineFragrances(
                lineId,
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
          <button type="button" onClick={() => setEditing(false)} className="min-h-10 px-2 text-step--1 text-ink-soft underline-offset-4 hover:underline">
            {dict.account.cancel}
          </button>
        </div>
      </div>
    );
  }

  const unavailable = fragrances ? line.fragrances.some((f) => !fragrances.some((item) => item.id === f.id)) : false;
  return (
    <div className="mt-2 text-step--1">
      <p className="text-ink-soft">
        {p.freeFragrances} <span className="text-gold-deep">({p.freeLabel})</span>
        {line.quantity > 1 ? <span> · × {line.quantity}</span> : null}
      </p>
      <ol className="mt-1 list-decimal ps-5 text-ink" data-testid="line-fragrances">
        {line.fragrances.map((f, index) => (
          <li key={`${f.id}-${index}`}>{f.name[locale]}</li>
        ))}
      </ol>
      {unavailable ? <p className="mt-1 text-[#86352b]">{dict.checkout.errors.fragrance_unavailable}</p> : null}
      {fragrances ? (
        <button
          type="button"
          onClick={() => {
            setDraft(line.fragrances!.map((f) => f.id));
            setEditing(true);
          }}
          className="mt-1 min-h-10 text-step--1 text-ink underline underline-offset-4 hover:text-gold-deep"
        >
          {p.change}
        </button>
      ) : null}
    </div>
  );
}
