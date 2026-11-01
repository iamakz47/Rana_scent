import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/info-page";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.pages.about.title };
}

export default async function Page() {
  const dict = await getDictionary();
  const page = dict.pages.about;
  return <InfoPage title={page.title} lead={page.lead} sections={page.sections} draftNotice={dict.pages.draftNotice} />;
}
