"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { adminButton } from "@/features/admin/ui/primitives";

export type PickerAsset = { id: string; url: string; alt: string; width: number | null; height: number | null };

function Thumb({ asset, className }: { asset: PickerAsset; className?: string }) {
  return (
    // Admin thumbnails load the original file directly; the storefront uses
    // next/image for optimised delivery.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.url}
      alt={asset.alt}
      decoding="async"
      className={cn("aspect-square w-full rounded-lg bg-beige object-contain", className)}
    />
  );
}

// Chooses one image (single) or an ordered list (multiple) from the library.
// The selection is posted as a hidden input: a uuid, or a JSON array of uuids.
export function MediaPicker({
  name,
  library,
  initial,
  multiple = false,
  label,
}: {
  name: string;
  library: PickerAsset[];
  initial: string[];
  multiple?: boolean;
  label: string;
}) {
  const { t } = useAdminI18n();
  const [selected, setSelected] = useState<string[]>(initial.filter((id) => library.some((a) => a.id === id)));
  const [browsing, setBrowsing] = useState(false);
  const byId = new Map(library.map((asset) => [asset.id, asset]));

  const toggle = (id: string) =>
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      return multiple ? [...current, id] : [id];
    });
  const move = (index: number, delta: number) =>
    setSelected((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div className="min-w-0">
      <input type="hidden" name={name} value={multiple ? JSON.stringify(selected) : (selected[0] ?? "")} />
      {selected.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 px-4 py-6 text-center text-step--1 text-ink-soft">
          {t.products.noImages}
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={label}>
          {selected.map((id, index) => {
            const asset = byId.get(id);
            if (!asset) return null;
            return (
              <li key={id} className="relative rounded-xl border border-ink/10 bg-canvas p-1.5">
                <Thumb asset={asset} />
                {multiple && index === 0 ? (
                  <span className="absolute start-2 top-2 rounded-full bg-ink px-2 text-[0.65rem] text-canvas">1</span>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  {multiple ? (
                    <span className="flex gap-1">
                      <button type="button" className={cn(adminButton("ghost", "sm"), "rtl:-scale-x-100")} onClick={() => move(index, -1)} aria-label={t.common.moveUp} disabled={index === 0}>
                        ‹
                      </button>
                      <button
                        type="button"
                        className={cn(adminButton("ghost", "sm"), "rtl:-scale-x-100")}
                        onClick={() => move(index, 1)}
                        aria-label={t.common.moveDown}
                        disabled={index === selected.length - 1}
                      >
                        ›
                      </button>
                    </span>
                  ) : (
                    <span />
                  )}
                  <button type="button" className={cn(adminButton("ghost", "sm"), "px-2")} onClick={() => toggle(id)}>
                    {t.common.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        className={cn(adminButton("outline", "sm"), "mt-3")}
        aria-expanded={browsing}
        onClick={() => setBrowsing((value) => !value)}
      >
        {multiple ? t.products.addImages : t.media.choose}
      </button>

      {browsing ? (
        library.length === 0 ? (
          <p className="mt-3 text-step--1 text-ink-soft">{t.media.emptyBody}</p>
        ) : (
          <ul className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-ink/10 bg-surface p-2 sm:grid-cols-5 lg:grid-cols-8">
            {library.map((asset) => {
              const isSelected = selected.includes(asset.id);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(asset.id)}
                    className={cn(
                      "block w-full rounded-lg border-2 p-0.5 transition-colors",
                      isSelected ? "border-gold-deep" : "border-transparent hover:border-gold/50",
                    )}
                  >
                    <Thumb asset={asset} />
                    <span className="sr-only">
                      {asset.alt} {isSelected ? t.media.chosen : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
