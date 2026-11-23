"use client";

import { useI18n } from "@/i18n/client";
import type { CartLine } from "./store";

// "Colour: Red" with a swatch for colour variants; the plain option label otherwise.
export function LineVariant({ line }: { line: Pick<CartLine, "variantLabel" | "colorHex"> }) {
  const { locale, dict } = useI18n();
  if (!line.colorHex) return <>{line.variantLabel[locale]}</>;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="line-color">
      <span aria-hidden className="inline-block size-3 rounded-full border border-ink/20" style={{ background: line.colorHex }} />
      {dict.product.color}: {line.variantLabel[locale]}
    </span>
  );
}
