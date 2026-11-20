import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { policyKeys } from "@/features/policies/keys";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.policies.title };
}

export default async function PoliciesPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <PageHeader title={dict.policies.title} body={dict.policies.body} />
      <div className="container-page pb-24 pt-10">
        <ul className="grid max-w-3xl gap-3 sm:grid-cols-2">
          {policyKeys.map((key) => (
            <li key={key}>
              <Link
                href={localePath(locale, `/policies/${key}`)}
                className="flex min-h-14 items-center justify-between rounded-2xl border border-ink/10 bg-canvas px-5 text-ink transition-colors hover:border-gold"
              >
                {dict.policies.names[key]}
                <span aria-hidden className="text-gold-deep rtl:rotate-180">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
