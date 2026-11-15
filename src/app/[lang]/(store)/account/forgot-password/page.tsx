import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { accountsEnabled } from "@/features/account/config";
import { ForgotForm } from "@/features/account/forms";
import { AccountsUnavailable, AuthPage } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Forgot() {
  await connection();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  if (!accountsEnabled()) return <AccountsUnavailable locale={locale} dict={dict} />;
  return (
    <AuthPage title={dict.account.forgotTitle} body={dict.account.forgotBody}>
      <ForgotForm />
    </AuthPage>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Forgot />
    </Suspense>
  );
}
