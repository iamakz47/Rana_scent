"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { uploadOne } from "@/features/admin/media/media-library";
import { imageTypes } from "@/features/admin/media/validation";
import type { PickerAsset } from "@/features/admin/media/media-picker";
import { adminButton } from "@/features/admin/ui/primitives";

const accept = Object.keys(imageTypes).join(",");

// An ordered list of photos (the first is the main photo) with upload,
// choose-from-library, reorder and remove. Controlled by the editor.
export function PhotoPicker({
  value,
  onChange,
  library,
  onUploaded,
  label,
  testId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  library: PickerAsset[];
  onUploaded: (asset: PickerAsset) => void;
  label: string;
  testId?: string;
}) {
  const { locale, t } = useAdminI18n();
  const c = t.p6;
  const input = useRef<HTMLInputElement>(null);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState("");
  const [uploading, startUpload] = useTransition();
  const byId = new Map(library.map((asset) => [asset.id, asset]));
  const shown = value.filter((id) => byId.has(id));

  const move = (index: number, delta: number) => {
    const next = [...shown];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    startUpload(async () => {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadOne(file, "products", locale);
        if (result.status === "ok" && result.asset) {
          onUploaded(result.asset);
          added.push(result.asset.id);
        } else if (result.message) {
          setError(result.message);
        }
      }
      if (added.length) onChange([...shown, ...added]);
      if (input.current) input.current.value = "";
    });
  };

  return (
    <div className="min-w-0" data-testid={testId}>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 px-4 py-5 text-center text-step--1 text-ink-soft">{t.products.noImages}</p>
      ) : (
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label={label}>
          {shown.map((id, index) => {
            const asset = byId.get(id)!;
            return (
              <li key={id} className="relative rounded-xl border border-ink/10 bg-canvas p-1">
                {/* Admin thumbnails load the original file directly. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={asset.alt} decoding="async" className="aspect-square w-full rounded-lg bg-beige object-contain" />
                {index === 0 ? (
                  <span className="absolute start-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[0.62rem] text-canvas">{c.mainPhoto}</span>
                ) : null}
                <div className="mt-1 flex items-center justify-between">
                  <span className="flex">
                    <button type="button" className={cn(adminButton("ghost", "sm"), "px-2 rtl:-scale-x-100")} onClick={() => move(index, -1)} disabled={index === 0} aria-label={t.common.moveUp}>
                      ‹
                    </button>
                    <button
                      type="button"
                      className={cn(adminButton("ghost", "sm"), "px-2 rtl:-scale-x-100")}
                      onClick={() => move(index, 1)}
                      disabled={index === shown.length - 1}
                      aria-label={t.common.moveDown}
                    >
                      ›
                    </button>
                  </span>
                  <button type="button" className={cn(adminButton("ghost", "sm"), "px-2")} onClick={() => onChange(shown.filter((x) => x !== id))} aria-label={`${t.common.remove} ${index + 1}`}>
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <label className={cn(adminButton("outline", "sm"), "cursor-pointer", uploading && "pointer-events-none opacity-60")}>
          <input ref={input} type="file" accept={accept} multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
          {uploading ? c.uploading : c.uploadPhotos}
        </label>
        <button type="button" className={adminButton("ghost", "sm")} aria-expanded={browsing} onClick={() => setBrowsing((v) => !v)}>
          {c.chooseFromLibrary}
        </button>
      </div>
      {error ? <p className="mt-2 text-step--1 text-[#86352b]">{error}</p> : null}

      {browsing ? (
        library.length === 0 ? (
          <p className="mt-3 text-step--1 text-ink-soft">{t.media.emptyBody}</p>
        ) : (
          <ul className="mt-3 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-ink/10 bg-surface p-2 sm:grid-cols-6 lg:grid-cols-8">
            {library.map((asset) => {
              const selected = shown.includes(asset.id);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(selected ? shown.filter((x) => x !== asset.id) : [...shown, asset.id])}
                    className={cn("block w-full rounded-lg border-2 p-0.5", selected ? "border-gold-deep" : "border-transparent hover:border-gold/50")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt="" decoding="async" className="aspect-square w-full rounded-md bg-beige object-contain" />
                    <span className="sr-only">
                      {asset.alt} {selected ? t.media.chosen : ""}
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
