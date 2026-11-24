import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { RichText } from "@/components/ui/rich-text";
import { getPublishedPage } from "@/features/site-pages/data";
import { pick } from "@/features/site-pages/schema";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, locale, published] = await Promise.all([getDictionary(), getLocale(), getPublishedPage("about")]);
  return { title: published ? pick(published.title, locale) : dict.pages.about.title };
}

export default async function Page() {
  const [dict, locale, published] = await Promise.all([getDictionary(), getLocale(), getPublishedPage("about")]);
  // The owner's published text (Admin → Pages), else the built-in draft.
  if (published) {
    return (
      <InfoPage title={pick(published.title, locale)} lead={pick(published.lead, locale) || undefined}>
        <RichText text={pick(published.body, locale)} className="max-w-3xl text-step-1" headingLevel={2} data-testid="page-body" />
      </InfoPage>
    );
  }
  const page = dict.pages.about;
  return <InfoPage title={page.title} lead={page.lead} sections={page.sections} draftNotice={dict.pages.draftNotice} />;
}
