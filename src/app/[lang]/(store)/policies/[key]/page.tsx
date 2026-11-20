import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { isPolicyKey, policyKeys } from "@/features/policies/keys";
import { PolicyView } from "@/features/policies/policy-view";

export function generateStaticParams() {
  return policyKeys.map((key) => ({ key }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/policies/[key]">): Promise<Metadata> {
  const [{ key }, dict] = await Promise.all([params, getDictionary()]);
  return isPolicyKey(key) ? { title: dict.policies.names[key] } : {};
}

export default async function PolicyPage({ params }: PageProps<"/[lang]/policies/[key]">) {
  const [{ key }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  if (!isPolicyKey(key)) notFound();
  return <PolicyView policyKey={key} locale={locale} dict={dict} />;
}
