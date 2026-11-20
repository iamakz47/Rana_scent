import type { Metadata } from "next";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { ButtonLink } from "@/components/ui/button";
import { getCustomer } from "@/features/account/dal";
import { ResetForm } from "@/features/account/forms";
import { AuthPage } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Reached from the password-reset email (the link signs the customer in).
async function Reset() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const customer = await getCustomer();
  if (!customer) {
    return (
      <AuthPage title={dict.account.resetTitle}>
        <p className="text-ink-soft">{dict.account.errors.session}</p>
        <ButtonLink href={localePath(locale, "/account/forgot-password")} className="mt-6" variant="outline">
          {dict.account.forgotTitle}
        </ButtonLink>
      </AuthPage>
    );
  }
  return (
    <AuthPage title={dict.account.resetTitle}>
      <ResetForm />
    </AuthPage>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Reset />
    </Suspense>
  );
}
