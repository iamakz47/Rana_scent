import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { formatKWD } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { accountsEnabled } from "@/features/account/config";
import { requireCustomer } from "@/features/account/dal";
import { AccountsUnavailable, AccountShell, Section } from "@/features/account/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function Orders() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  if (!accountsEnabled()) return <AccountsUnavailable locale={locale} dict={dict} />;
  await requireCustomer(locale, "/account/orders");
  const supabase = await createClient();
  const { data: orders } = await supabase.rpc("my_orders");
  const a = dict.account;
  const statuses = dict.order.statuses as Record<string, string>;
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-KW", { dateStyle: "medium" });
  return (
    <AccountShell locale={locale} dict={dict} active="orders">
      <Section title={a.orders}>
        {(orders ?? []).length === 0 ? (
          <p className="text-ink-soft">{a.ordersEmpty}</p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {(orders ?? []).map((o) => (
              <li key={o.number} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{format(a.orderNumber, { number: o.number })}</p>
                  <p className="text-step--1 text-ink-soft">
                    {dateFormat.format(new Date(o.placed_at ?? o.created_at))} · {format(a.itemsCount, { count: o.items_count })} ·{" "}
                    <span className="tabular-nums">{formatKWD(o.total_fils, locale)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-gold/12 px-3 py-1 text-[0.75rem] text-gold-deep">{statuses[o.status] ?? o.status}</span>
                  <Link
                    href={localePath(locale, `/order?n=${o.number}&t=${o.access_token}`)}
                    className="text-step--1 text-ink underline underline-offset-4"
                  >
                    {a.viewOrder}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-step--1 text-ink-soft">{a.linkHint}</p>
      </Section>
    </AccountShell>
  );
}

export default function AccountOrdersPage() {
  return (
    <Suspense fallback={<div className="container-page py-24" aria-busy />}>
      <Orders />
    </Suspense>
  );
}
