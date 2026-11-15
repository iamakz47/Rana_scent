import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { accountsEnabled } from "@/features/account/config";
import { requireCustomer } from "@/features/account/dal";
import { DeletionForm, ProfileForm } from "@/features/account/forms";
import { AccountsUnavailable, AccountShell, Section } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Overview({ searchParams }: { searchParams: PageProps<"/[lang]/account">["searchParams"] }) {
  const [query, locale, dict] = await Promise.all([searchParams, getLocale(), getDictionary()]);
  if (!accountsEnabled()) return <AccountsUnavailable locale={locale} dict={dict} />;
  const customer = await requireCustomer(locale, "/account");
  const supabase = await createClient();
  const [{ data: profile }, { data: deletion }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, preferred_locale, marketing_opt_in").eq("id", customer.id).maybeSingle(),
    supabase.from("account_deletion_requests").select("id").eq("user_id", customer.id).eq("status", "requested").maybeSingle(),
  ]);
  const a = dict.account;
  return (
    <AccountShell locale={locale} dict={dict} active="overview">
      {query.welcome ? (
        <p role="status" className="rounded-2xl border border-gold/40 bg-gold/8 px-4 py-3 text-ink">
          {a.confirmed}
        </p>
      ) : null}
      <Section title={a.profile}>
        <ProfileForm
          email={customer.email}
          values={{
            full_name: profile?.full_name ?? "",
            phone: profile?.phone ?? "",
            preferred_locale: profile?.preferred_locale ?? locale,
            marketing_opt_in: profile?.marketing_opt_in ?? false,
          }}
        />
      </Section>
      <Section title={a.deleteTitle}>
        <p className="mb-4 text-step--1 text-ink-soft">{a.deleteBody}</p>
        <DeletionForm pending={Boolean(deletion)} />
      </Section>
    </AccountShell>
  );
}

export default function AccountPage({ searchParams }: PageProps<"/[lang]/account">) {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}
