import { InfoPage } from "@/components/layout/info-page";
import { RichText } from "@/components/ui/rich-text";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getPublishedPolicy } from "./data";
import type { PolicyKey } from "./keys";

// The owner-published policy when there is one; otherwise the site's built-in
// page (or a short "being finalised" note). Drafts are never shown here.
export async function PolicyView({ policyKey, locale, dict }: { policyKey: PolicyKey; locale: Locale; dict: Dictionary }) {
  const policy = await getPublishedPolicy(policyKey);
  if (policy) {
    const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-KW", { dateStyle: "long" }).format(
      new Date(policy.published_at),
    );
    return (
      <InfoPage title={policy.title[locale]}>
        <p className="mb-8 text-step--1 text-ink-soft">{format(dict.policies.lastUpdated, { date })}</p>
        <article className="max-w-3xl" data-policy={policyKey}>
          <RichText text={policy.body[locale]} className="text-step-0" headingLevel={2} />
        </article>
      </InfoPage>
    );
  }
  const fallback =
    policyKey === "privacy"
      ? dict.pages.privacy
      : policyKey === "terms"
        ? dict.pages.terms
        : policyKey === "delivery" || policyKey === "returns"
          ? dict.pages.shipping
          : null;
  if (fallback) return <InfoPage title={fallback.title} sections={fallback.sections} draftNotice={dict.pages.draftNotice} />;
  return (
    <InfoPage title={dict.policies.names[policyKey]}>
      <p className="max-w-2xl text-step-1 text-ink-soft">{dict.policies.pending}</p>
    </InfoPage>
  );
}
