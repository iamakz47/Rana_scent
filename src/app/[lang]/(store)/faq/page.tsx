import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { PlusIcon } from "@/components/ui/icons";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.pages.faq.title };
}

export default async function FaqPage() {
  const dict = await getDictionary();
  const faq = dict.pages.faq;

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
    <InfoPage title={faq.title}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="max-w-3xl divide-y divide-white/8 border-y border-white/8">
        {faq.items.map((item) => (
          <details key={item.q} name="faq" className="faq group/faq">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-step-1 text-ivory transition-colors hover:text-gold-200 [&::-webkit-details-marker]:hidden">
              {item.q}
              <PlusIcon className="shrink-0 text-gold-300 transition-transform duration-500 group-open/faq:rotate-45" />
            </summary>
            <p className="max-w-[60ch] pb-6 text-ivory/70">{item.a}</p>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
