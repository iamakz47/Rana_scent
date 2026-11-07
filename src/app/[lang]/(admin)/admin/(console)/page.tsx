import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { formatKWD } from "@/lib/money";
import { getCatalogSource } from "@/lib/server-env";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { getDashboard } from "@/features/admin/data/dashboard";
import { formatDateTime, formatNumber } from "@/features/admin/format";
import { getAdminDictionary } from "@/features/admin/i18n";
import { AdminPageHeader, adminButton, Notice, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.dashboard.title };
}

function Stat({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ink-soft">{label}</p>
      <p className="mt-3 font-display text-step-4 leading-none text-ink tabular-nums">{value}</p>
      {note ? <p className="mt-2 text-[0.78rem] text-ink-soft">{note}</p> : null}
    </>
  );
  const className =
    "block rounded-2xl border border-ink/10 bg-canvas p-5 transition-colors " + (href ? "hover:border-gold/60" : "");
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/[lang]/admin">) {
  const staff = await requireStaff("dashboard.view");
  const [{ locale, t }, data, query] = await Promise.all([getAdminDictionary(), getDashboard(staff), searchParams]);
  const n = (value: number) => formatNumber(value, locale);
  const href = (path: string) => localePath(locale, path);
  const source = getCatalogSource();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={t.dashboard.greeting}
        title={staff.displayName || t.dashboard.title}
        body={t.roles[staff.role]}
      />

      {query.denied ? <Notice tone="warning">{t.common.denied}</Notice> : null}

      <section aria-label={t.dashboard.title} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.products ? (
          <>
            <Stat
              label={t.dashboard.totalProducts}
              value={n(data.products.total)}
              note={`${n(data.products.drafts)} ${t.dashboard.drafts}`}
              href={href("/admin/products")}
            />
            <Stat label={t.dashboard.published} value={n(data.products.published)} href={href("/admin/products?status=published")} />
          </>
        ) : null}
        {data.stock ? (
          <>
            <Stat label={t.dashboard.lowStock} value={n(data.stock.low)} href={href("/admin/inventory?filter=low")} />
            <Stat label={t.dashboard.outOfStock} value={n(data.stock.out)} href={href("/admin/inventory?filter=out")} />
          </>
        ) : null}
        {data.orders ? (
          <Stat
            label={t.dashboard.orders}
            value={n(data.orders.count)}
            note={data.orders.count === 0 ? t.dashboard.noOrdersYet : undefined}
          />
        ) : null}
        {data.orders && data.orders.revenueFils !== null ? (
          <Stat
            label={t.dashboard.revenue}
            value={data.orders.revenueFils === 0 ? "—" : formatKWD(data.orders.revenueFils, locale)}
            note={data.orders.revenueFils === 0 ? t.pending.finance.body : undefined}
          />
        ) : null}
      </section>

      {can(staff, "catalog.read") ? (
        <Notice tone={source === "supabase" ? "success" : "gold"}>
          <strong className="font-medium">{t.dashboard.catalogSource}: </strong>
          {source === "supabase" ? t.dashboard.sourceSupabase : t.dashboard.sourceSample}
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {data.activity ? (
          <Panel title={t.dashboard.recentActivity}>
            {data.activity.length === 0 ? (
              <p className="text-step--1 text-ink-soft">{t.dashboard.noActivity}</p>
            ) : (
              <ol className="divide-y divide-ink/8">
                {data.activity.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-step--1">
                    <span className="min-w-0 text-ink">
                      <span className="font-medium" dir="auto">
                        {item.actor ?? (item.hasActor ? t.dashboard.someone : t.dashboard.system)}
                      </span>{" "}
                      {t.dashboard.actionLabels[item.action as "INSERT"] ?? item.action}{" "}
                      {t.dashboard.tables[item.table] ?? item.table}
                    </span>
                    <time dateTime={item.createdAt} className="text-[0.78rem] text-ink-soft tabular-nums">
                      {formatDateTime(item.createdAt, locale)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ) : (
          <div />
        )}

        <Panel title={t.dashboard.quickActions}>
          <div className="flex flex-col gap-2">
            {can(staff, "catalog.write") ? (
              <Link className={adminButton("primary")} href={href("/admin/products/new")}>
                {t.dashboard.newProduct}
              </Link>
            ) : null}
            {can(staff, "content.write") ? (
              <Link className={adminButton("outline")} href={href("/admin/homepage/slides/new")}>
                {t.dashboard.newSlide}
              </Link>
            ) : null}
            {can(staff, "media.write") ? (
              <Link className={adminButton("outline")} href={href("/admin/media")}>
                {t.dashboard.uploadMedia}
              </Link>
            ) : null}
            {can(staff, "inventory.adjust") ? (
              <Link className={adminButton("outline")} href={href("/admin/inventory")}>
                {t.dashboard.adjustStock}
              </Link>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
