import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-full font-medium tracking-wide transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-[var(--ease-out-expo)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-canvas shadow-[0_10px_30px_-14px_rgba(53,42,36,0.55)] hover:bg-espresso hover:shadow-[0_14px_36px_-14px_rgba(53,42,36,0.7)]",
  outline: "border border-ink/25 text-ink hover:border-gold hover:bg-gold/10",
  ghost: "text-ink hover:bg-ink/5",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-step--1",
  lg: "min-h-13 px-7 text-step-0",
};

// The primary button carries a gold light sweep on hover, like light on metal.
function Sheen({ variant }: { variant: Variant }) {
  if (variant !== "primary") return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -start-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-gold-light/40 to-transparent transition-[inset-inline-start] duration-700 ease-[var(--ease-out-expo)] group-hover/btn:start-[150%] motion-reduce:hidden"
    />
  );
}

type Common = { variant?: Variant; size?: Size; children: ReactNode; className?: string };

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: Common & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Sheen variant={variant} />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Sheen variant={variant} />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: { label: string } & ComponentProps<"button">) {
  return (
    <button
      aria-label={label}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors duration-300 hover:bg-ink/5 hover:text-gold-deep",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
