import type { ReactNode } from "react";
import { ScentField } from "@/components/brand/scent-field";
import { GOLD_HEX } from "@/components/brand/scent-colors";

// Shared top band for inner pages: the scent field drifts behind the title.
export function PageHeader({
  title,
  body,
  tint = GOLD_HEX,
  children,
}: {
  title: string;
  body?: string;
  tint?: string;
  children?: ReactNode;
}) {
  return (
    <header className="grain relative isolate overflow-hidden bg-[radial-gradient(90%_120%_at_80%_0%,var(--color-navy-700)_0%,var(--color-navy-950)_70%)] pb-12 pt-32 lg:pb-16 lg:pt-40">
      <ScentField tint={tint} originX={0.85} originY={-0.25} intensity={0.6} className="opacity-80" />
      <div className="container-page relative">
        <h1 className="hero-fade font-display text-step-5 leading-[1] text-ivory">{title}</h1>
        {body && (
          <p className="hero-fade mt-5 max-w-xl text-step-1 text-ivory/65" style={{ animationDelay: "120ms" }}>
            {body}
          </p>
        )}
        {children}
      </div>
    </header>
  );
}
