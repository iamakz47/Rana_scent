import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { addressLine } from "@/features/account/address-line";
import { accountsEnabled } from "@/features/account/config";
import { requireCustomer } from "@/features/account/dal";
import { AddressCard, NewAddress } from "@/features/account/forms";
import { AccountsUnavailable, AccountShell, Section } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Addresses() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  if (!accountsEnabled()) return <AccountsUnavailable locale={locale} dict={dict} />;
  await requireCustomer(locale, "/account/addresses");
  const supabase = await createClient();
  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("id, label, recipient_name, phone, governorate, area, block, street, avenue, building, floor, apartment, notes, is_default")
    .order("is_default", { ascending: false })
    .order("created_at");
  const a = dict.account;
  return (
    <AccountShell locale={locale} dict={dict} active="addresses">
      <Section title={a.addresses}>
        <div className="space-y-4">
          {(addresses ?? []).length === 0 ? <p className="text-ink-soft">{a.addressesEmpty}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {(addresses ?? []).map((address) => (
              <AddressCard key={address.id} address={address} line={addressLine(address, locale, dict)} />
            ))}
          </div>
          {(addresses ?? []).length < 10 ? <NewAddress /> : null}
        </div>
      </Section>
    </AccountShell>
  );
}

export default function AccountAddressesPage() {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Addresses />
    </Suspense>
  );
}
