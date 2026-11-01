import Image from "next/image";
import { cn } from "@/lib/cn";

// OFFICIAL LOGO SLOT
// The official Rana Scent logo has not been added to the repository yet.
// To use it: save the transparent file as public/brand/rana-scent-logo.png
// (or .svg), set LOGO_SRC below and its intrinsic size. Until then a
// typographic placeholder renders, marked with data-logo-placeholder.
const LOGO_SRC: string | null = null;
const LOGO_WIDTH = 480;
const LOGO_HEIGHT = 160;

type Props = {
  className?: string;
  label: string;
  priority?: boolean;
};

export function Logo({ className, label, priority }: Props) {
  if (LOGO_SRC) {
    return (
      <Image
        src={LOGO_SRC}
        alt={label}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className={cn("h-auto w-auto", className)}
      />
    );
  }

  return (
    <span
      data-logo-placeholder
      role="img"
      aria-label={label}
      className={cn("inline-flex flex-col items-center leading-none", className)}
    >
      <span
        aria-hidden
        className="text-gold font-[family-name:var(--font-bodoni)] text-[1.55em] tracking-[0.32em] [margin-inline-end:-0.32em]"
      >
        RANA
      </span>
      <span
        aria-hidden
        className="mt-[0.28em] font-[family-name:var(--font-readex)] text-[0.5em] font-light tracking-[0.62em] text-gold-300 [margin-inline-end:-0.62em]"
      >
        SCENT
      </span>
    </span>
  );
}
