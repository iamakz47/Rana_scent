"use client";

import { createContext, Suspense, use, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { defaultVariant, type Product, type ProductVariant } from "../types";

// The variant (colour) chosen on a product page, shared by the gallery, the
// purchase panel and the specification table so they always agree.
type Selection = { variant: ProductVariant; select: (id: string) => void };

const SelectionContext = createContext<Selection | null>(null);

export function useVariantSelection(product: Product): Selection {
  const context = use(SelectionContext);
  // Outside a provider (e.g. a lone panel), fall back to local state.
  const [id, setId] = useState(() => defaultVariant(product).id);
  if (context) return context;
  return { variant: product.variants.find((v) => v.id === id) ?? defaultVariant(product), select: setId };
}

// Opens the colour named in ?color=<SKU> (from a product card), if it exists.
function ColorFromUrl({ product, onPick }: { product: Product; onPick: (id: string) => void }) {
  const sku = useSearchParams().get("color");
  useEffect(() => {
    if (!sku) return;
    const match = product.variants.find((v) => v.sku.toLowerCase() === sku.toLowerCase());
    if (match) onPick(match.id);
  }, [sku, product, onPick]);
  return null;
}

export function VariantSelectionProvider({ product, children }: { product: Product; children: ReactNode }) {
  const [id, setId] = useState(() => defaultVariant(product).id);
  const variant = product.variants.find((v) => v.id === id) ?? defaultVariant(product);
  return (
    <SelectionContext value={{ variant, select: setId }}>
      <Suspense fallback={null}>
        <ColorFromUrl product={product} onPick={setId} />
      </Suspense>
      {children}
    </SelectionContext>
  );
}

export function Swatch({ hex, className }: { hex: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 shrink-0 rounded-full border border-ink/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]", className)}
      style={{ background: hex }}
    />
  );
}

// The "Colour" row of the specification table follows the selected colour.
export function SelectedColorSpec({ product }: { product: Product }) {
  const { locale } = useI18n();
  const { variant } = useVariantSelection(product);
  return (
    <span className="inline-flex items-center gap-2" data-testid="spec-color">
      {variant.colorHex ? <Swatch hex={variant.colorHex} /> : null}
      {variant.label[locale]}
    </span>
  );
}
