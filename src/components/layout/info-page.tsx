import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

type Section = { title: string; body: string };

// Long-form content pages (about, policies). `draftNotice` marks content
// that Rana Scent still has to supply or approve.
export function InfoPage({
  title,
  lead,
  sections,
  draftNotice,
  children,
}: {
  title: string;
  lead?: string;
  sections?: Section[];
  draftNotice?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} body={lead} />
      <div className="container-page pb-24 pt-10">
        {draftNotice && (
          <p
            role="note"
            className="mb-12 max-w-3xl rounded-2xl border border-gold-400/30 bg-gold-400/8 px-5 py-4 text-step--1 text-gold-200"
          >
            {draftNotice}
          </p>
        )}
        {sections && (
          <div className="grid max-w-5xl gap-x-16 gap-y-12 md:grid-cols-[14rem_1fr]">
            {sections.map((section) => (
              <section key={section.title} className="contents">
                <h2 className="font-display text-step-2 text-gold-200 md:pt-1">{section.title}</h2>
                <p className="max-w-[65ch] text-step-1 leading-relaxed text-ivory/75">{section.body}</p>
              </section>
            ))}
          </div>
        )}
        {children}
      </div>
    </>
  );
}
