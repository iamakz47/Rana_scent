import type { Metadata } from "next";
import Link from "next/link";
import { localePath } from "@/i18n/config";
import { can, requireStaff } from "@/features/admin/auth/dal";
import { reorderCategories } from "@/features/admin/categories/actions";
import { listAdminCategories } from "@/features/admin/data/catalog";
import { getAdminDictionary } from "@/features/admin/i18n";
import { mediaUrl } from "@/features/media/url";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { AdminPageHeader, adminButton, Badge, EmptyState, Panel } from "@/features/admin/ui/primitives";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminDictionary();
  return { title: t.categories.title };
}

export default async function CategoriesPage() {
  const staff = await requireStaff("catalog.read");
  const [{ locale, t }, categories] = await Promise.all([getAdminDictionary(), listAdminCategories()]);
  const writable = can(staff, "catalog.write");
  const active = categories.filter((c) => !c.archived_at);
  const archived = categories.filter((c) => c.archived_at);
  const row = (c: (typeof categories)[number]) => (
    <Link href={localePath(locale, `/admin/categories/${c.id}`)} className="flex min-w-0 items-center gap-3 hover:text-gold-deep">
      <span className="block size-11 shrink-0 overflow-hidden rounded-lg bg-beige">
        {c.media_assets ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(c.media_assets)} alt="" className="size-full object-contain" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{locale === "ar" ? c.name_ar : c.name_en}</span>
        <span className="block truncate text-[0.78rem] text-ink-soft">
          {c.product_categories[0]?.count ?? 0} {t.categories.products}
        </span>
      </span>
      <span className="ms-auto hidden flex-wrap justify-end gap-1.5 sm:flex">
        <Badge tone={c.is_visible ? "success" : "neutral"}>{c.is_visible ? t.common.visible : t.common.hidden}</Badge>
        {c.show_on_home ? <Badge tone="gold">{t.nav.homepage}</Badge> : null}
      </span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t.categories.title}
        body={t.categories.body}
        actions={
          writable ? (
            <Link href={localePath(locale, "/admin/categories/new")} className={adminButton("primary")}>
              {t.categories.new}
            </Link>
          ) : undefined
        }
      />
      {active.length === 0 ? (
        <EmptyState title={t.categories.emptyTitle} body={t.categories.emptyBody} />
      ) : (
        <SortableList action={reorderCategories} disabled={!writable} items={active.map((c) => ({ id: c.id, content: row(c) }))} />
      )}
      {archived.length > 0 ? (
        <Panel title={t.categories.archived}>
          <ul className="space-y-3">
            {archived.map((c) => (
              <li key={c.id}>{row(c)}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
