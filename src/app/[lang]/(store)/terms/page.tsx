import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { PolicyView } from "@/features/policies/policy-view";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.policies.names.terms };
}

// The owner-published policy when available, otherwise the built-in page.
export default async function Page() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return <PolicyView policyKey="terms" locale={locale} dict={dict} />;
}
