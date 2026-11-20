import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { accountsEnabled } from "@/features/account/config";
import { getCustomer, safeAccountPath } from "@/features/account/dal";
import { LoginForm } from "@/features/account/forms";
import { AccountsUnavailable, AuthPage } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Login({ searchParams }: { searchParams: PageProps<"/[lang]/account/login">["searchParams"] }) {
  const [query, locale, dict] = await Promise.all([searchParams, getLocale(), getDictionary()]);
  if (!accountsEnabled()) return <AccountsUnavailable locale={locale} dict={dict} />;
  const next = safeAccountPath(typeof query.next === "string" ? query.next : "/account");
  const customer = await getCustomer();
  if (customer?.verified) redirect(localePath(locale, next));
  const a = dict.account;
  return (
    <AuthPage
      title={a.loginTitle}
      body={a.guestNote}
      footer={
        <>
          {a.noAccount}{" "}
          <Link href={localePath(locale, "/account/register")} className="text-ink underline underline-offset-4">
            {a.register}
          </Link>
        </>
      }
    >
      {query.error === "link_invalid" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-[#a4493d]/30 bg-[#a4493d]/8 px-4 py-3 text-step--1 text-[#86352b]">
          {a.errors.link_invalid}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthPage>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/[lang]/account/login">) {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}
