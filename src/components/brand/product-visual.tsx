import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  // A real photo, or undefined when Rana Scent hasn't supplied one yet.
  src?: string;
  alt: string;
  sizes: string;
  // Text for the empty state ("Photo coming soon"); always shown when there is no photo.
  pendingLabel: string;
  priority?: boolean;
  className?: string;
  // Drawn behind the photo inside the same blend layer (e.g. an arch).
  backdrop?: ReactNode;
};

// Real product photography only. There are no drawn stand-ins: without a
// photo this renders a plain panel that says the photo is coming.
//
// Photos are studio shots on white. `mix-blend-multiply` lets the white fall
// away into the warm stage colour behind it. The wrapper paints that stage
// colour itself (bg-beige by default, override via className) so the blend
// still works when a hover transform creates a new stacking context.
export function ProductVisual({ src, alt, sizes, pendingLabel, priority, className, backdrop }: Props) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-beige", className)}>
        {backdrop}
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain p-[7%] mix-blend-multiply"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt ? `${alt}: ${pendingLabel}` : pendingLabel}
      className={cn("relative grid place-items-center overflow-hidden bg-beige", className)}
    >
      <span className="rounded-full border border-ink/12 bg-canvas/70 px-3 py-1.5 text-step--1 text-ink-soft">
        {pendingLabel}
      </span>
    </div>
  );
}
