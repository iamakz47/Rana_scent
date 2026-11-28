import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { PlusIcon } from "@/components/ui/icons";
import { getPublishedPage } from "@/features/site-pages/data";
import { pick } from "@/features/site-pages/schema";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, locale, published] = await Promise.all([getDictionary(), getLocale(), getPublishedPage("faq")]);
  return { title: published ? pick(published.title, locale) : dict.pages.faq.title };
}

export default async function FaqPage() {
  const [dict, locale, published] = await Promise.all([getDictionary(), getLocale(), getPublishedPage("faq")]);
  // The owner's published questions (Admin → Pages), else the built-in ones.
  const faq = published
    ? {
        title: pick(published.title, locale),
        lead: pick(published.lead, locale) || undefined,
        items: published.items.map((item) => ({ q: pick(item.q, locale), a: pick(item.a, locale) })).filter((item) => item.q && item.a),
      }
    : { ...dict.pages.faq, lead: undefined };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <InfoPage title={faq.title} lead={faq.lead}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="max-w-3xl divide-y divide-ink/10 border-y border-ink/10">
        {faq.items.map((item, index) => (
          <details key={index} name="faq" className="faq group/faq" data-testid="faq-item">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-step-1 text-ink transition-colors hover:text-gold-deep [&::-webkit-details-marker]:hidden">
              {item.q}
              <PlusIcon className="shrink-0 text-gold-deep transition-transform duration-500 group-open/faq:rotate-45" />
            </summary>
            <p className="max-w-[60ch] whitespace-pre-line pb-6 text-ink-soft">{item.a}</p>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
