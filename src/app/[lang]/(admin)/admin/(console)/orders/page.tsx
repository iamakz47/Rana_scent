import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatKWD } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { orderStatusFilters, orderStatusTone as statusTone } from "@/features/admin/orders/transitions";
import { AdminPageHeader, Badge, EmptyState } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.commerce.orders.title };
}

export default async function OrdersPage({ searchParams }: PageProps<"/[lang]/admin/orders">) {
  await requireStaff("orders.read");
  const [{ locale, t }, query] = await Promise.all([getAdminDictionary(), searchParams]);
  const c = t.commerce;
  const status = orderStatusFilters.find((s) => s === query.status) ?? "all";
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 60) : "";
  const phone = typeof query.phone === "string" ? query.phone.replace(/[^\d+]/g, "").slice(0, 16) : "";

  const supabase = await createClient();
  await supabase.rpc("expire_unpaid_orders");
  let request = supabase
    .from("orders")
    .select("id, number, customer_name, phone, status, payment_method, total_fils, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") request = request.eq("status", status);
  if (phone) request = request.eq("phone", phone);
  if (q) {
    const safe = q.replace(/[^\p{L}\p{N} +@.-]/gu, "");
    request = /^\d{4,9}$/.test(safe)
      ? request.or(`number.eq.${safe},phone.ilike.%${safe}%`)
      : request.or(`customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data: orders } = await request;
  const href = (next: Record<string, string>) => {
    const params = new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(q ? { q } : {}), ...next });
    for (const [key, value] of [...params.entries()]) if (!value || value === "all") params.delete(key);
    const qs = params.toString();
    return localePath(locale, `/admin/orders${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title={c.orders.title} body={c.orders.body} />
      <form className="flex flex-wrap gap-2" action={localePath(locale, "/admin/orders")}>
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="order-search" className="sr-only">
          {c.orders.search}
        </label>
        <input
          id="order-search"
          name="q"
          defaultValue={q}
          placeholder={c.orders.search}
          className="min-h-10 min-w-0 flex-1 rounded-full border border-ink/15 bg-canvas px-4 text-step--1 focus:border-gold-deep focus:outline-none sm:max-w-sm"
        />
        <button type="submit" className="min-h-10 rounded-full bg-ink px-4 text-step--1 text-canvas">
          {t.common.search}
        </button>
      </form>
      <nav aria-label={t.common.status} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {orderStatusFilters.map((s) => (
          <Link
            key={s}
            href={href({ status: s })}
            aria-current={status === s ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-step--1 transition-colors",
              status === s ? "border-ink bg-ink text-canvas" : "border-ink/15 text-ink-soft hover:border-gold hover:text-ink",
            )}
          >
            {s === "all" ? c.orders.all : c.statuses[s]}
          </Link>
        ))}
      </nav>
      {!orders?.length ? (
        <EmptyState title={q || status !== "all" || phone ? c.orders.emptyFiltered : c.orders.empty} />
      ) : (
        <ul className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={localePath(locale, `/admin/orders/${order.id}`)}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-surface/70 md:grid-cols-[6rem_minmax(0,1fr)_9rem_9rem_10rem]"
              >
                <span className="font-display text-step-1 tabular-nums text-ink">#{order.number}</span>
                <span className="min-w-0 md:order-none">
                  <span className="block truncate text-ink" dir="auto">
                    {order.customer_name}
                  </span>
                  <span className="block text-[0.78rem] text-ink-soft" dir="ltr">
                    {order.phone}
                  </span>
                </span>
                <span className="hidden text-step--1 tabular-nums text-ink md:block">{formatKWD(order.total_fils, locale)}</span>
                <span className="hidden text-[0.78rem] text-ink-soft md:block">{formatDateTime(order.created_at, locale)}</span>
                <span className="flex flex-col items-end gap-1 md:items-start">
                  <Badge tone={statusTone(order.status)}>{c.statuses[order.status]}</Badge>
                  <span className="text-[0.72rem] text-ink-soft">{c.methods[order.payment_method]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
