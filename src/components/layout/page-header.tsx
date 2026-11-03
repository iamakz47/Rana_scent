import type { ReactNode } from "react";

// Shared top band for inner pages: a quiet beige band with a majlis-arch
// outline, so inner pages share the brand's shape language without noise.
export function PageHeader({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <header className="relative isolate overflow-hidden border-b border-ink/8 bg-beige/60 pb-12 pt-14 lg:pb-16 lg:pt-20">
      <svg
        aria-hidden
        viewBox="0 0 400 300"
        className="pointer-events-none absolute -bottom-8 end-[-4rem] -z-10 h-[130%] text-sand sm:end-8"
        fill="none"
      >
        <path d="M60 300 V150 a140 140 0 0 1 280 0 V300" stroke="currentColor" strokeWidth="1.5" />
        <path d="M100 300 V160 a100 100 0 0 1 200 0 V300" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      </svg>
      <div className="container-page">
        <h1 className="fade-up font-display text-step-5 leading-[1] text-ink">{title}</h1>
        {body && (
          <p className="fade-up mt-5 max-w-xl text-step-1 text-ink-soft" style={{ animationDelay: "120ms" }}>
            {body}
          </p>
        )}
        {children}
      </div>
    </header>
  );
}
