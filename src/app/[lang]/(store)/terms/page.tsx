import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.pages.terms.title };
}

export default async function Page() {
  const dict = await getDictionary();
  const page = dict.pages.terms;
  return <InfoPage title={page.title} sections={page.sections} draftNotice={dict.pages.draftNotice} />;
}
