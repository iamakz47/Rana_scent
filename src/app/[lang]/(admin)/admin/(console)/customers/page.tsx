import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { DeletionResolveForm } from "@/features/admin/customers/deletion-form";
import { formatDateTime, formatNumber } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader, Badge, EmptyState, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.commerce.customers.title };
}

export default async function CustomersPage({ searchParams }: PageProps<"/[lang]/admin/customers">) {
  const staff = await requireStaff("customers.read");
  const [{ locale, t }, query] = await Promise.all([getAdminDictionary(), searchParams]);
  const c = t.commerce.customers;
  const q = typeof query.q === "string" ? query.q.trim().replace(/[%_]/g, "").slice(0, 60) : "";
  const supabase = await createClient();
  const [{ data: customers }, { data: deletions }] = await Promise.all([
    supabase.rpc("list_customers", { p_search: q }),
    supabase
      .from("account_deletion_requests")
      .select("id, email, reason, created_at")
      .eq("status", "requested")
      .order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title={c.title} body={c.body} />
      <Panel title={t.p4.deletionTitle}>
        {!deletions?.length ? (
          <p className="text-step--1 text-ink-soft">{t.p4.deletionEmpty}</p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {deletions.map((d) => (
              <li key={d.id} className="py-3 text-step--1">
                <p dir="ltr" className="text-start text-ink">
                  {d.email}
                </p>
                <p className="text-[0.78rem] text-ink-soft">
                  {t.p4.requestedAt}: {formatDateTime(d.created_at, locale)}
                  {d.reason ? ` · ${t.p4.reason}: ${d.reason}` : ""}
                </p>
                {can(staff, "orders.write") ? <DeletionResolveForm requestId={d.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <form className="flex gap-2" action={localePath(locale, "/admin/customers")}>
        <label htmlFor="customer-search" className="sr-only">
          {c.search}
        </label>
        <input
          id="customer-search"
          name="q"
          defaultValue={q}
          placeholder={c.search}
          className="min-h-10 min-w-0 flex-1 rounded-full border border-ink/15 bg-canvas px-4 text-step--1 focus:border-gold-deep focus:outline-none sm:max-w-sm"
        />
        <button type="submit" className="min-h-10 rounded-full bg-ink px-4 text-step--1 text-canvas">
          {t.common.search}
        </button>
      </form>
      {!customers?.length ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
          {customers.map((customer) => (
            <li key={customer.phone} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_6rem_9rem_10rem_auto]">
              <span className="min-w-0">
                <span className="block truncate text-ink" dir="auto">
                  {customer.customer_name}
                </span>
                <span className="block text-[0.78rem] text-ink-soft" dir="ltr">
                  {customer.phone}
                  {customer.email ? ` · ${customer.email}` : ""}
                </span>
              </span>
              <span className="hidden text-step--1 text-ink-soft md:block">
                {c.orders}: <span className="tabular-nums">{formatNumber(Number(customer.orders_count), locale)}</span>
              </span>
              <span className="hidden text-step--1 tabular-nums md:block">{formatKWD(Number(customer.paid_total_fils), locale)}</span>
              <span className="hidden text-[0.78rem] text-ink-soft md:block">{formatDateTime(customer.last_order_at, locale)}</span>
              <span className="flex items-center gap-2">
                <Badge>{customer.has_account ? c.account : c.guest}</Badge>
                <Link
                  href={localePath(locale, `/admin/orders?phone=${encodeURIComponent(customer.phone)}`)}
                  className="text-step--1 text-gold-deep underline-offset-4 hover:underline"
                >
                  {c.viewOrders}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
