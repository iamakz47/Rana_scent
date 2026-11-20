import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { accountsEnabled } from "@/features/account/config";
import { RegisterForm } from "@/features/account/forms";
import { AccountsUnavailable, AuthPage } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Register() {
  await connection();
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  if (!accountsEnabled()) return <AccountsUnavailable locale={locale} dict={dict} />;
  const a = dict.account;
  return (
    <AuthPage
      title={a.registerTitle}
      body={a.registerBody}
      footer={
        <>
          {a.haveAccount}{" "}
          <Link href={localePath(locale, "/account/login")} className="text-ink underline underline-offset-4">
            {a.signIn}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthPage>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Register />
    </Suspense>
  );
}
