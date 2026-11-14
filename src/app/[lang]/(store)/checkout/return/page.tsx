import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { confirmReturn } from "@/features/payments/service";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// The customer comes back from Tap's page. The query string is only a hint:
// the server re-checks the charge with Tap before showing the order.
async function Confirm({ searchParams }: { searchParams: PageProps<"/[lang]/checkout/return">["searchParams"] }) {
  const [query, locale, dict] = await Promise.all([searchParams, getLocale(), getDictionary()]);
  const chargeId = typeof query.tap_id === "string" ? query.tap_id : "";
  const result = /^chg_[A-Za-z0-9]+$/.test(chargeId) ? await confirmReturn(chargeId) : null;
  if (result?.orderNumber && result.token) {
    redirect(localePath(result.locale, `/order?n=${result.orderNumber}&t=${result.token}`));
  }
  return (
    <div className="container-page py-24 text-center">
      <p className="font-display text-step-4 text-ink">{dict.checkout.errors.generic}</p>
      <ButtonLink href={localePath(locale, "/cart")} className="mt-8" variant="outline">
        {dict.checkout.backToCart}
      </ButtonLink>
    </div>
  );
}

export default function CheckoutReturnPage({ searchParams }: PageProps<"/[lang]/checkout/return">) {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Confirm searchParams={searchParams} />
    </Suspense>
  );
}
