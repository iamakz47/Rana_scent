import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { formatDateTime } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { StockRow, type StockRowData } from "@/features/admin/inventory/stock-row";
import { AdminPageHeader, EmptyState, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.inventory.title };
}

const filters = ["all", "low", "out"] as const;

export default async function InventoryPage({ searchParams }: PageProps<"/[lang]/admin/inventory">) {
  const staff = await requireStaff("inventory.read");
  const [{ locale, t }, query] = await Promise.all([getAdminDictionary(), searchParams]);
  const filter = filters.find((f) => f === query.filter) ?? "all";
  const supabase = await createClient();
  const [stock, moves] = await Promise.all([
    supabase
      .from("inventory")
      .select("variant_id, on_hand, low_stock_threshold, product_variants!inner(sku, label_ar, label_en, is_active, position, products!inner(name_ar, name_en, status, position))")
      .eq("product_variants.is_active", true)
      .neq("product_variants.products.status", "archived"),
    supabase
      .from("inventory_movements")
      .select("id, quantity_change, quantity_after, reason, note, created_at, actor_id, product_variants(sku, label_ar, label_en, products(name_ar, name_en))")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const team = can(staff, "staff.read") ? (await supabase.rpc("list_staff")).data ?? [] : [];
  const names = new Map(team.map((m) => [m.user_id, m.display_name || m.email]));
  const name = (row: { name_ar: string; name_en: string } | null | undefined) => (row ? (locale === "ar" ? row.name_ar : row.name_en) : "");

  const rows: StockRowData[] = (stock.data ?? [])
    .map((row) => {
      const v = row.product_variants;
      const status: StockRowData["status"] =
        row.on_hand === 0 ? "out_of_stock" : row.on_hand <= row.low_stock_threshold ? "low_stock" : "in_stock";
      return {
        variantId: row.variant_id,
        product: name(v.products),
        variant: locale === "ar" ? v.label_ar : v.label_en,
        sku: v.sku,
        onHand: row.on_hand,
        threshold: row.low_stock_threshold,
        status,
        sort: v.products.position * 1000 + v.position,
      };
    })
    .filter((row) => (filter === "low" ? row.status === "low_stock" : filter === "out" ? row.status === "out_of_stock" : true))
    .sort((a, b) => a.sort - b.sort);

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t.inventory.title} body={t.inventory.body} />
      <nav aria-label={t.common.status} className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={localePath(locale, f === "all" ? "/admin/inventory" : `/admin/inventory?filter=${f}`)}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-step--1 transition-colors",
              filter === f ? "border-ink bg-ink text-canvas" : "border-ink/15 text-ink-soft hover:border-gold hover:text-ink",
            )}
          >
            {t.inventory.filters[f]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={t.inventory.emptyTitle} body={t.inventory.emptyBody} />
      ) : (
        <ul className="divide-y divide-ink/8 rounded-2xl border border-ink/10 bg-canvas">
          {rows.map((row) => (
            <StockRow key={row.variantId} row={row} canAdjust={can(staff, "inventory.adjust")} />
          ))}
        </ul>
      )}
      <Panel title={t.inventory.history}>
        {(moves.data ?? []).length === 0 ? (
          <p className="text-step--1 text-ink-soft">{t.inventory.noHistory}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[40rem] text-step--1">
              <thead className="text-start text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th className="pb-2 text-start font-medium">{t.inventory.when}</th>
                  <th className="pb-2 text-start font-medium">{t.products.name}</th>
                  <th className="pb-2 text-end font-medium">{t.inventory.change}</th>
                  <th className="pb-2 text-end font-medium">{t.inventory.after}</th>
                  <th className="pb-2 text-start font-medium ps-4">{t.inventory.reason}</th>
                  <th className="pb-2 text-start font-medium">{t.inventory.who}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {(moves.data ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pe-3 text-ink-soft tabular-nums">{formatDateTime(m.created_at, locale)}</td>
                    <td className="py-2 pe-3">
                      {name(m.product_variants?.products)}{" "}
                      <span className="text-ink-soft">· {locale === "ar" ? m.product_variants?.label_ar : m.product_variants?.label_en}</span>
                      {m.note ? <span className="block text-[0.78rem] text-ink-soft">{m.note}</span> : null}
                    </td>
                    <td className={cn("py-2 text-end tabular-nums", m.quantity_change < 0 ? "text-[#86352b]" : "text-[#3f5c3b]")} dir="ltr">
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </td>
                    <td className="py-2 text-end tabular-nums">{m.quantity_after}</td>
                    <td className="py-2 ps-4">{t.inventory.reasons[m.reason]}</td>
                    <td className="py-2 text-ink-soft">{m.actor_id ? (names.get(m.actor_id) ?? t.dashboard.someone) : t.dashboard.system}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
