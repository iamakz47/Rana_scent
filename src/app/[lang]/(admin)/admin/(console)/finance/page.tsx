import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { ExpenseForm } from "@/features/admin/finance/expense-form";
import { financeWindow } from "@/features/admin/finance/window";
import { formatDateTime, formatNumber } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader, Badge, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.commerce.finance.title };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-canvas p-5">
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ink-soft">{label}</p>
      <p className="mt-3 font-display text-step-3 leading-none tabular-nums text-ink">{value}</p>
    </div>
  );
}

export default async function FinancePage() {
  const staff = await requireStaff("finance.read");
  const { locale, t } = await getAdminDictionary();
  const c = t.commerce.finance;
  const supabase = await createClient();
  const [{ data: payments }, { data: refunds }, { data: expenses }] = await Promise.all([
    supabase.from("payments").select("amount_fils, status, provider, method, created_at, order_id").in("status", ["captured", "refunded"]),
    supabase.from("refund_requests").select("id, order_id, amount_fils, status, reason, created_at, orders(number)").order("created_at", { ascending: false }).limit(50),
    supabase.from("expenses").select("*").order("incurred_on", { ascending: false }).limit(100),
  ]);
  const { since30Days: since, todayKuwait } = financeWindow();
  const captured = (payments ?? []).filter((p) => p.status === "captured" || p.status === "refunded");
  const revenue = captured.reduce((sum, p) => sum + p.amount_fils, 0);
  const revenue30 = captured.filter((p) => Date.parse(p.created_at) >= since).reduce((sum, p) => sum + p.amount_fils, 0);
  const refunded = (refunds ?? []).filter((r) => r.status === "processed").reduce((sum, r) => sum + r.amount_fils, 0);
  const expenseTotal = (expenses ?? []).reduce((sum, e) => sum + e.amount_fils, 0);
  const byMethod = new Map<string, number>();
  for (const p of captured) {
    const key = p.provider === "cod" ? t.commerce.methods.cod : (p.method ?? p.provider).toUpperCase();
    byMethod.set(key, (byMethod.get(key) ?? 0) + p.amount_fils);
  }
  const money = (fils: number) => formatKWD(fils, locale);
  const openRefunds = (refunds ?? []).filter((r) => r.status === "requested");

  return (
    <div className="space-y-6">
      <AdminPageHeader title={c.title} body={c.body} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={c.revenue} value={money(revenue)} />
        <Stat label={c.last30} value={money(revenue30)} />
        <Stat label={c.refunded} value={money(refunded)} />
        <Stat label={c.ordersPaid} value={formatNumber(new Set(captured.map((p) => p.order_id)).size, locale)} />
      </section>
      <p className="text-step--1 text-ink-soft">
        {c.net}: <span className="tabular-nums text-ink">{money(revenue - refunded - expenseTotal)}</span>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={c.byMethod}>
          {byMethod.size === 0 ? (
            <p className="text-step--1 text-ink-soft">{c.none}</p>
          ) : (
            <ul className="space-y-2 text-step--1">
              {[...byMethod.entries()].map(([method, amount]) => (
                <li key={method} className="flex justify-between">
                  <span>{method}</span>
                  <span className="tabular-nums">{money(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={c.openRefunds}>
          {openRefunds.length === 0 ? (
            <p className="text-step--1 text-ink-soft">{c.none}</p>
          ) : (
            <ul className="space-y-2 text-step--1">
              {openRefunds.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={localePath(locale, `/admin/orders/${r.order_id}`)} className="text-gold-deep underline-offset-4 hover:underline">
                    #{r.orders?.number} · {r.reason}
                  </Link>
                  <span className="tabular-nums">{money(r.amount_fils)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={c.expenses}>
        <div className="space-y-5">
          {can(staff, "finance.write") ? <ExpenseForm today={todayKuwait} /> : null}
          {(expenses ?? []).length === 0 ? (
            <p className="text-step--1 text-ink-soft">{c.none}</p>
          ) : (
            <ul className="divide-y divide-ink/8 text-step--1">
              {(expenses ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Badge>{c.categories[e.category] ?? e.category}</Badge> {e.description}
                    {e.vendor ? <span className="text-ink-soft"> · {e.vendor}</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[0.75rem] text-ink-soft">{formatDateTime(`${e.incurred_on}T12:00:00Z`, locale).split(",")[0]}</span>
                    <span className="tabular-nums">{money(e.amount_fils)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
